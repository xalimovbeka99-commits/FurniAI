/**
 * Creative generation service: reference upload → Scenario 3D job → result.
 *
 * WHAT THIS PRODUCES. A generated mesh is a VISUAL CONCEPT. It is not a
 * FurniSpec, is not compiled to a PartGraph, has no verified dimensions and no
 * independently editable parts. Nothing here reads or writes a wardrobe
 * design; every job view says so in `concept`.
 *
 * BILLING SAFETY, in order:
 *   1. an idempotency key maps to at most one job, replayed without a provider call;
 *   2. one ACTIVE job per (user, reference, model);
 *   3. generation must be switched on and a per-job cost cap set;
 *   4. the provider's cost preview (dry run) must be readable and within the cap;
 *   5. the job is reserved in the store BEFORE the paid call;
 *   6. the paid call is made once and never retried — a lost answer becomes
 *      `submission_unknown`, which is never resubmitted automatically.
 */
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { CreativeError, CREATIVE_ERROR } from "./errors.js";
import { validateReferenceUpload } from "./referenceUpload.js";

export const JOB_STATUS = Object.freeze({
  SUBMITTING: "submitting",
  PROCESSING: "processing",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  SUBMISSION_UNKNOWN: "submission_unknown",
});

export const CONCEPT_NOTICE = Object.freeze({
  kind: "visual_concept",
  editable: false,
  dimensionsVerified: false,
  partsSeparable: false,
  manufacturable: false,
  notice: "AI-generated visual concept. Not a FurniAI design: it has no verified measurements, no separately editable doors or panels, and cannot be manufactured from.",
});

const KEY_RE = /^[A-Za-z0-9_-]{8,128}$/;
const MIN_POLL_INTERVAL_MS = 2_000;
const STALE_SUBMITTING_MS = 120_000;
const FORMAT_BY_EXT = { glb: "glb", gltf: "gltf", fbx: "fbx", obj: "obj", usdz: "usdz", stl: "stl", ply: "ply", zip: "zip" };

let processKey = null;

/**
 * @param {{ store: object, client: object, config: object, now?: () => Date, signingKey?: string }} deps
 */
export function createCreativeService({ store, client, config, now = () => new Date(), signingKey }) {
  const key = signingKey || (processKey ??= randomBytes(32).toString("hex"));
  const iso = () => now().toISOString();

  const mac = (parts) => createHmac("sha256", key).update(JSON.stringify(parts)).digest("hex");
  const refSig = (r) => mac(["ref", r.referenceId, r.userId, r.sha256, r.provider, r.providerAssetId]);
  const jobSig = (j) => mac(["job", j.jobId, j.userId, j.referenceId, j.modelId, j.providerJobId ?? null, (j.outputs ?? []).map((o) => o.assetId)]);
  const sigOk = (expected, actual) => typeof actual === "string" && actual.length === expected.length && timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
  function assertIntact(ok) {
    if (!ok) throw new CreativeError(CREATIVE_ERROR.RECORD_INTEGRITY_FAILED, "This record was not written by FurniAI and will not be used.");
  }

  async function update(job, patch) {
    const next = { ...job, ...patch, updatedAt: iso() };
    next.sig = jobSig(next);
    const saved = await store.updateJob(job.userId, job.jobId, { ...patch, updatedAt: next.updatedAt, sig: next.sig });
    return saved ?? next;
  }

  function requireCredentials() {
    if (!config.credentialsConfigured) {
      throw new CreativeError(CREATIVE_ERROR.CREATIVE_NOT_CONFIGURED, "3D concept generation is not configured on this deployment.", { details: { missing: config.missing } });
    }
  }

  async function settleStale(job) {
    if (job.status === JOB_STATUS.SUBMITTING && now() - new Date(job.createdAt) > STALE_SUBMITTING_MS) {
      return update(job, {
        status: JOB_STATUS.SUBMISSION_UNKNOWN,
        error: { code: CREATIVE_ERROR.PROVIDER_UNAVAILABLE, message: "The request was interrupted while being submitted. It is not known whether a generation started." },
      });
    }
    return job;
  }

  return {
    /** Validate, de-duplicate by content, hand the image to the provider, record it. */
    async createReference({ userId, body }) {
      const file = validateReferenceUpload(body);
      const existing = await store.findReferenceBySha(userId, file.sha256);
      if (existing && sigOk(refSig(existing), existing.sig)) return { reference: toReferenceView(existing), reused: true };
      requireCredentials();
      const { assetId } = await client.uploadAsset(file);
      const ref = { referenceId: randomUUID(), userId, name: file.name, contentType: file.contentType, bytes: file.bytes, sha256: file.sha256, provider: "scenario", providerAssetId: assetId, createdAt: iso() };
      ref.sig = refSig(ref);
      await store.insertReference(ref);
      return { reference: toReferenceView(ref), reused: false };
    },

    async submitJob({ userId, body }) {
      const referenceId = body?.referenceId;
      const idempotencyKey = body?.idempotencyKey;
      if (typeof idempotencyKey !== "string" || !KEY_RE.test(idempotencyKey)) {
        throw new CreativeError(CREATIVE_ERROR.BAD_REQUEST, "idempotencyKey is required: 8–128 characters of A–Z, a–z, 0–9, '_' or '-'. Generate one per Generate click and resend it unchanged on retry.");
      }
      if (typeof referenceId !== "string" || !referenceId) throw new CreativeError(CREATIVE_ERROR.BAD_REQUEST, "referenceId is required.");

      // 1. Replay — no provider call, whatever the configuration is now.
      const prior = await store.findJobByKey(userId, idempotencyKey);
      if (prior) return replay(prior, referenceId);

      // 3. Configuration gates.
      if (!config.configured) throw new CreativeError(CREATIVE_ERROR.CREATIVE_NOT_CONFIGURED, "3D concept generation is not configured on this deployment.", { details: { missing: config.missing } });
      if (!config.liveEnabled) throw new CreativeError(CREATIVE_ERROR.CREATIVE_GENERATION_DISABLED, "3D concept generation is switched off on this deployment. Nothing was generated.");
      if (config.maxCostPerJob == null) throw new CreativeError(CREATIVE_ERROR.CREATIVE_NOT_CONFIGURED, "3D concept generation has no spend cap configured. Nothing was generated.", { details: { missing: ["SCENARIO_MAX_COST_PER_JOB"] } });

      const ref = await store.getReference(userId, referenceId);
      if (!ref) throw new CreativeError(CREATIVE_ERROR.MISSING_REFERENCE, "That reference image was not found.");
      assertIntact(sigOk(refSig(ref), ref.sig));

      const params = { ...config.extraParams, [config.imageParam]: config.imageParamIsArray ? [ref.providerAssetId] : ref.providerAssetId };

      // 4. Cost preview — free; must be readable and within the cap.
      const { cost } = await client.estimateCost(params);
      if (cost > config.maxCostPerJob) {
        throw new CreativeError(CREATIVE_ERROR.COST_CAP_EXCEEDED, "This generation would cost more than the configured limit. Nothing was generated.", { details: { estimatedCost: cost, maxCostPerJob: config.maxCostPerJob } });
      }

      // 2 + 5. Reserve atomically before paying.
      const draft = {
        jobId: randomUUID(), userId, idempotencyKey, referenceId, provider: "scenario", modelId: config.modelId,
        status: JOB_STATUS.SUBMITTING, providerJobId: null, providerStatus: null, providerProgress: null, outputs: [],
        estimatedCost: cost, reportedCost: null, error: null,
        createdAt: iso(), submittedAt: null, completedAt: null, updatedAt: iso(), lastPolledAt: null,
      };
      draft.sig = jobSig(draft);
      let reserved = await store.reserveJob(draft);
      if (!reserved.created && reserved.conflict === "active") {
        const settled = await settleStale(reserved.job);
        if (settled.status !== reserved.job.status) reserved = await store.reserveJob(draft);
      }
      if (!reserved.created) {
        if (reserved.conflict === "key") return replay(reserved.job, referenceId);
        throw new CreativeError(CREATIVE_ERROR.DUPLICATE_ACTIVE_JOB, "A 3D concept is already being generated from this reference. Nothing new was submitted.", { details: { jobId: reserved.job.jobId } });
      }

      // 6. The paid call. Once.
      let job = reserved.job;
      try {
        const sub = await client.submitGeneration(params);
        job = await update(job, { status: JOB_STATUS.PROCESSING, providerJobId: sub.providerJobId, providerStatus: sub.providerStatus, submittedAt: iso() });
        return { job: toJobView(job), replayed: false, httpStatus: 202 };
      } catch (err) {
        const ce = err instanceof CreativeError ? err : new CreativeError(CREATIVE_ERROR.PROVIDER_UNAVAILABLE, "The 3D generation service could not be reached.", { outcomeUnknown: true });
        const unknown = ce.outcomeUnknown;
        job = await update(job, {
          status: unknown ? JOB_STATUS.SUBMISSION_UNKNOWN : JOB_STATUS.FAILED,
          completedAt: unknown ? null : iso(),
          error: { code: ce.code, message: unknown ? "The request was sent but no answer arrived. It is not known whether a generation started or was charged." : ce.message },
        });
        throw new CreativeError(ce.code, job.error.message, { status: ce.status, details: { ...(ce.details ?? {}), jobId: job.jobId, jobStatus: job.status, outcomeUnknown: unknown } });
      }
    },

    /** Read a job; refresh it from the provider at most once per MIN_POLL_INTERVAL_MS. */
    async getJob({ userId, jobId }) {
      let job = await store.getJob(userId, jobId);
      if (!job) throw new CreativeError(CREATIVE_ERROR.MISSING_JOB, "That generation was not found.");
      assertIntact(sigOk(jobSig(job), job.sig));
      job = await settleStale(job);
      let refresh = null;
      if (job.status === JOB_STATUS.PROCESSING && job.providerJobId) {
        const last = job.lastPolledAt ? new Date(job.lastPolledAt).getTime() : 0;
        if (now().getTime() - last >= MIN_POLL_INTERVAL_MS) {
          try {
            job = await refreshFromProvider(job);
            refresh = { ok: true };
          } catch (err) {
            // A failed status check says nothing about the generation itself.
            refresh = { ok: false, code: err instanceof CreativeError ? err.code : "INTERNAL" };
          }
        }
      }
      return { job: toJobView(job), ...(refresh ? { refresh } : {}) };
    },

    async listJobs({ userId }) {
      const jobs = await store.listJobs(userId);
      return { jobs: jobs.filter((j) => sigOk(jobSig(j), j.sig)).map(toJobView) };
    },

    /** A CURRENT download address, resolved from the provider on every call — never a stored URL. */
    async getAssetLink({ userId, jobId, index = 0 }) {
      const job = await store.getJob(userId, jobId);
      if (!job) throw new CreativeError(CREATIVE_ERROR.MISSING_JOB, "That generation was not found.");
      assertIntact(sigOk(jobSig(job), job.sig));
      const out = job.status === JOB_STATUS.SUCCEEDED ? job.outputs?.[index] : null;
      if (!out) throw new CreativeError(CREATIVE_ERROR.ASSET_NOT_READY, "This generation has no asset to download.", { details: { jobStatus: job.status } });
      requireCredentials();
      let asset;
      try {
        asset = await client.getAsset(out.assetId);
      } catch (err) {
        if (err instanceof CreativeError && err.details?.notFound) {
          throw new CreativeError(CREATIVE_ERROR.ASSET_UNAVAILABLE, "The generation service no longer holds this asset, and FurniAI has no stored copy of it.", { details: { durableCopy: false } });
        }
        throw err;
      }
      return {
        jobId: job.jobId, index, url: asset.url, format: detectFormat(asset) ?? out.format, mimeType: asset.mimeType,
        resolvedAt: iso(), expiresAt: null, expiryKnown: false, durableCopy: false,
        concept: CONCEPT_NOTICE,
      };
    },
  };

  function replay(prior, referenceId) {
    assertIntact(sigOk(jobSig(prior), prior.sig));
    if (prior.referenceId !== referenceId) {
      throw new CreativeError(CREATIVE_ERROR.IDEMPOTENCY_KEY_REUSED, "This idempotencyKey was already used for a different reference. Nothing was submitted.", { details: { jobId: prior.jobId } });
    }
    return { job: toJobView(prior), replayed: true, httpStatus: 200 };
  }

  async function refreshFromProvider(job) {
    const p = await client.getJob(job.providerJobId);
    const patch = { providerStatus: p.providerStatus, providerProgress: p.providerProgress, lastPolledAt: iso(), ...(p.cost != null ? { reportedCost: p.cost } : {}) };
    if (config.successStatuses.includes(p.providerStatus)) {
      if (p.assetIds.length === 0) {
        Object.assign(patch, { status: JOB_STATUS.FAILED, completedAt: iso(), error: { code: CREATIVE_ERROR.PROVIDER_UNEXPECTED_RESPONSE, message: "The generation finished but returned no asset." } });
      } else {
        const outputs = [];
        for (const assetId of p.assetIds) {
          let format = null;
          let mimeType = null;
          try {
            const a = await client.getAsset(assetId);
            format = detectFormat(a);
            mimeType = a.mimeType;
          } catch { /* format stays unknown; the asset id is what matters */ }
          outputs.push({ assetId, format, mimeType });
        }
        Object.assign(patch, { status: JOB_STATUS.SUCCEEDED, completedAt: iso(), outputs, error: null });
      }
    } else if (config.failureStatuses.includes(p.providerStatus)) {
      Object.assign(patch, { status: JOB_STATUS.FAILED, completedAt: iso(), error: { code: "PROVIDER_GENERATION_FAILED", message: p.providerError || "The generation service reported that this generation failed." } });
    }
    return update(job, patch);
  }
}

/** Reported from the asset the provider actually returned — never assumed from the model. */
function detectFormat(asset) {
  try {
    const ext = new URL(asset.url).pathname.split(".").pop().toLowerCase();
    if (FORMAT_BY_EXT[ext]) return FORMAT_BY_EXT[ext];
  } catch { /* fall through */ }
  if (asset.mimeType === "model/gltf-binary") return "glb";
  if (asset.mimeType === "model/gltf+json") return "gltf";
  return null;
}

function toReferenceView(r) {
  return { referenceId: r.referenceId, name: r.name, contentType: r.contentType, bytes: r.bytes, sha256: r.sha256, createdAt: r.createdAt };
}

export function toJobView(j) {
  return {
    jobId: j.jobId,
    status: j.status,
    provider: j.provider,
    model: j.modelId,
    sourceReferenceId: j.referenceId,
    providerStatus: j.providerStatus ?? null,
    providerProgress: j.providerProgress ?? null,
    outputs: (j.outputs ?? []).map((o, index) => ({ index, format: o.format ?? null, mimeType: o.mimeType ?? null })),
    usage: { estimatedCost: j.estimatedCost ?? null, reportedCost: j.reportedCost ?? null, unit: "provider_cost_units" },
    storage: { durableCopy: false, reason: "ASSET_STORAGE_NOT_CONFIGURED" },
    error: j.error ?? null,
    createdAt: j.createdAt,
    submittedAt: j.submittedAt ?? null,
    completedAt: j.completedAt ?? null,
    updatedAt: j.updatedAt,
    concept: CONCEPT_NOTICE,
  };
}
