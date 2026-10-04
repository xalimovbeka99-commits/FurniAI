/**
 * SIMULATED /api/creative stand-in. FIXTURES ONLY. NOT Scenario: no provider
 * is contacted, no credits exist, nothing here was produced by Scenario.
 *
 * It reproduces the response SHAPES of the PROPOSED contract
 * (SCENARIO_3D_API_CONTRACT.md §2.4/§2.5) and of the Claude backend bundle
 * (api/creative.js + src/lib/creative/* at 7f42f95): `{ ok:false, code,
 * error, details? }` errors, `cache-control: no-store`, the asset/job views
 * and the verbatim CONCEPT_NOTICE. It is used by the vitest suites (via
 * `standIn.fetch`) and by docs/m3/asset-viewer/demo/serve.mjs.
 *
 * Signed asset addresses are SINGLE USE: the second request for the same
 * address answers 403, so any viewer that reuses a url instead of
 * re-resolving fails visibly.
 */

export const SIMULATED_LABEL = "SIMULATED /api/creative stand-in · fixtures only · not a Scenario result";
export const SIM_TOKEN = "sim-token";

/** Verbatim copy of CONCEPT_NOTICE from src/lib/creative/creativeService.js @ 7f42f95. */
export const SIM_CONCEPT = Object.freeze({
  kind: "visual_concept",
  editable: false,
  dimensionsVerified: false,
  partsSeparable: false,
  manufacturable: false,
  notice:
    "AI-generated visual concept. Not a FurniAI design: it has no verified measurements, no separately editable doors or panels, and cannot be manufactured from.",
});

const GLB = { format: "glb", mimeType: "model/gltf-binary" };

/** Simulated jobs. `asset` = behaviour of ?resource=asset for that job. */
export function defaultSimJobs() {
  return {
    "sim-glb-chair": { status: "succeeded", outputs: [{ file: "chair-textured.glb", ...GLB }] },
    "sim-glb-table": { status: "succeeded", outputs: [{ file: "table-untextured.glb", format: "glb", mimeType: null }] },
    "sim-processing": {
      status: "processing",
      providerStatus: "sim-in-progress",
      providerProgress: 0.37,
      succeedAfterPolls: 2,
      refreshFailsOnPoll: 1,
      outputsWhenDone: [{ file: "chair-textured.glb", ...GLB }],
    },
    "sim-submitting": { status: "submitting", providerStatus: null, providerProgress: null },
    "sim-expired-url": { status: "succeeded", asset: "expire-first", outputs: [{ file: "table-untextured.glb", ...GLB }] },
    "sim-gone": { status: "succeeded", asset: "gone", outputs: [{ file: "chair-textured.glb", ...GLB }] },
    "sim-integrity": { status: "succeeded", asset: "integrity", outputs: [{ file: "chair-textured.glb", ...GLB }] },
    "sim-provider-down": { status: "succeeded", asset: "provider-down", outputs: [{ file: "chair-textured.glb", ...GLB }] },
    "sim-fbx": { status: "succeeded", outputs: [{ file: "simulated-download-only.fbx", format: "fbx", mimeType: "application/octet-stream" }] },
    "sim-null-format": { status: "succeeded", outputs: [{ file: "simulated-asset.bin", format: null, mimeType: null }] },
    "sim-resolves-zip": { status: "succeeded", outputs: [{ file: "simulated-download-only.zip", ...GLB, resolveFormat: "zip" }] },
    "sim-corrupt": { status: "succeeded", outputs: [{ file: "corrupt.glb", ...GLB }] },
    "sim-cors": { status: "succeeded", asset: "cors", outputs: [{ file: "chair-textured.glb", ...GLB }] },
    "sim-two-outputs": {
      status: "succeeded",
      outputs: [
        { file: "chair-textured.glb", ...GLB },
        { file: "table-untextured.glb", ...GLB },
      ],
    },
    "sim-failed": {
      status: "failed",
      error: { code: "PROVIDER_GENERATION_FAILED", message: "The 3D generation service reported that this generation failed." },
    },
    "sim-submission-unknown": {
      status: "submission_unknown",
      error: {
        code: "PROVIDER_UNAVAILABLE",
        message: "The request was sent but no answer arrived. It is not known whether a generation started or was charged.",
      },
    },
    "sim-weird-status": { status: "queued_somewhere" },
  };
}

const JSON_HEADERS = Object.freeze({
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-furniai-simulated": "stand-in; not Scenario",
});

function err(status, code, error, details) {
  return { status, headers: { ...JSON_HEADERS }, body: { ok: false, code, error, ...(details ? { details } : {}) } };
}
function ok(body) {
  return { status: 200, headers: { ...JSON_HEADERS }, body: { ok: true, ...body } };
}

/**
 * @param {object} o
 * @param {Record<string, Uint8Array|Buffer>} o.files   fixture bytes by file name
 * @param {string} [o.cdnBase]       base for signed addresses (tests: an .invalid host)
 * @param {string} [o.blockedCdnBase] base whose responses lack CORS (sim-cors)
 */
export function createCreativeStandIn({
  files = {},
  cdnBase = "https://cdn.sim.invalid/sim-asset",
  blockedCdnBase = "https://cors-blocked.sim.invalid/sim-asset",
  token = SIM_TOKEN,
  jobs = defaultSimJobs(),
  now = () => new Date(),
} = {}) {
  const table = new Map(Object.entries(jobs).map(([id, j]) => [id, { ...j, polls: 0, resolves: 0 }]));
  const issued = new Map(); // token -> { file, uses, expired }
  const forced = []; // queued forced responses: { resource, status, code, error, details }
  const log = [];
  let n = 0;

  function view(id, j) {
    const outputs = (j.outputs || []).map((o, i) => ({ index: i, format: o.format === undefined ? null : o.format, mimeType: o.mimeType ?? null }));
    const terminal = ["succeeded", "failed", "submission_unknown"].includes(j.status);
    return {
      jobId: id,
      status: j.status,
      provider: "simulated-stand-in",
      model: "sim-model (not a Scenario model)",
      sourceReferenceId: `sim-ref-${id}`,
      providerStatus: j.providerStatus ?? (j.status === "succeeded" ? "sim-success" : null),
      providerProgress: j.providerProgress ?? null,
      outputs,
      usage: { estimatedCost: null, reportedCost: null, unit: "provider_cost_units" },
      storage: { durableCopy: false, reason: "ASSET_STORAGE_NOT_CONFIGURED" },
      error: j.error || null,
      createdAt: "2026-10-04T07:00:00.000Z",
      submittedAt: j.status === "submitting" ? null : "2026-10-04T07:00:01.000Z",
      completedAt: terminal ? "2026-10-04T07:02:00.000Z" : null,
      updatedAt: now().toISOString(),
      concept: { ...SIM_CONCEPT },
    };
  }

  function issue(j, file) {
    n += 1;
    const t = `t${String(n).padStart(4, "0")}`;
    const expired = j.asset === "expire-first" && j.resolves === 1;
    issued.set(t, { file, uses: 0, expired });
    const base = j.asset === "cors" ? blockedCdnBase : cdnBase;
    return `${base}/${t}/${encodeURIComponent(file)}?X-Sim-Signature=sig${n}&X-Sim-Single-Use=1`;
  }

  /** Pure handler for /api/creative. `url` may be absolute or path+query. */
  function handleApi(method, url, headers = {}) {
    const u = new URL(url, "http://stand-in.local");
    const resource = u.searchParams.get("resource");
    const auth = headers.authorization || headers.Authorization || "";
    const entry = { kind: "api", resource, jobId: u.searchParams.get("jobId"), index: u.searchParams.get("index"), auth: Boolean(auth) };
    log.push(entry);
    const res = route(method, u, resource, auth);
    entry.status = res.status;
    entry.code = res.body && res.body.code;
    return res;
  }

  function route(method, u, resource, auth) {
    if (method !== "GET") return err(405, "METHOD_NOT_ALLOWED", "Simulated stand-in only implements GET.");
    if (!/^Bearer\s+\S+/.test(auth)) return err(401, "MISSING_AUTH", "Sign in is required to save or open a design.");
    if (auth.replace(/^Bearer\s+/, "") !== token) return err(401, "MISSING_AUTH", "Sign in is required to save or open a design.");
    const fi = forced.findIndex((f) => !f.resource || f.resource === resource);
    if (fi >= 0) {
      const f = forced.splice(fi, 1)[0];
      return err(f.status, f.code, f.error || "Simulated failure.", f.details);
    }
    const jobId = u.searchParams.get("jobId");
    if (resource === "jobs") {
      if (!jobId) return ok({ jobs: [...table.entries()].map(([id, j]) => view(id, j)) });
      const j = table.get(jobId);
      if (!j) return err(404, "MISSING_JOB", "That generation was not found.");
      let refresh = { ok: true };
      if (j.status === "processing" || j.status === "submitting") {
        j.polls += 1;
        if (j.refreshFailsOnPoll === j.polls) refresh = { ok: false, code: "PROVIDER_UNAVAILABLE" };
        if (j.succeedAfterPolls && j.polls > j.succeedAfterPolls) {
          j.status = "succeeded";
          j.providerStatus = "sim-success";
          j.outputs = j.outputsWhenDone;
        }
      }
      return ok({ job: view(jobId, j), refresh });
    }
    if (resource === "asset") {
      if (!jobId) return err(400, "BAD_REQUEST", "jobId is required.");
      const rawIndex = u.searchParams.get("index");
      const index = rawIndex === null || rawIndex === "" ? 0 : Number(rawIndex);
      if (!Number.isInteger(index) || index < 0) return err(400, "BAD_REQUEST", "index must be a non-negative integer.");
      const j = table.get(jobId);
      if (!j) return err(404, "MISSING_JOB", "That generation was not found.");
      if (j.asset === "integrity") return err(409, "RECORD_INTEGRITY_FAILED", "This record was not written by FurniAI and will not be used.");
      if (j.status !== "succeeded") return err(409, "ASSET_NOT_READY", "This generation has no asset to download.", { jobStatus: j.status });
      const out = (j.outputs || [])[index];
      if (!out) return err(409, "ASSET_NOT_READY", "This generation has no asset to download.", { jobStatus: j.status });
      if (j.asset === "gone") return err(410, "ASSET_UNAVAILABLE", "The generation service no longer holds this asset, and FurniAI has no stored copy of it.", { durableCopy: false });
      if (j.asset === "provider-down") return err(502, "PROVIDER_UNAVAILABLE", "The generation provider could not be reached.");
      j.resolves += 1;
      const fmt = out.resolveFormat !== undefined ? out.resolveFormat : out.format === undefined ? null : out.format;
      return ok({
        asset: {
          jobId,
          index,
          url: issue(j, out.file),
          format: fmt,
          mimeType: out.mimeType ?? null,
          resolvedAt: now().toISOString(),
          expiresAt: null,
          expiryKnown: false,
          durableCopy: false,
          concept: { ...SIM_CONCEPT },
        },
      });
    }
    return err(404, "NOT_FOUND", "Unknown resource.");
  }

  /** Signed-address handler: `/t0001/<file>` after the cdn base. Single use. */
  function handleCdn(pathAfterBase) {
    const m = /^\/?(t\d{4})\/([^?#]+)/.exec(pathAfterBase);
    const rec = m ? issued.get(m[1]) : null;
    const entry = { kind: "cdn", token: m ? m[1] : null };
    log.push(entry);
    if (!rec) return (entry.status = 403), { status: 403, headers: { "content-type": "text/plain" }, bytes: Buffer.from("SIMULATED: unknown signed address\n") };
    if (rec.expired || rec.uses >= 1) {
      entry.status = 403;
      return { status: 403, headers: { "content-type": "text/plain" }, bytes: Buffer.from("SIMULATED: signed address expired (single use)\n") };
    }
    rec.uses += 1;
    const bytes = files[rec.file];
    if (!bytes) return (entry.status = 404), { status: 404, headers: { "content-type": "text/plain" }, bytes: Buffer.from("SIMULATED: no such fixture\n") };
    entry.status = 200;
    return { status: 200, headers: { "content-type": "application/octet-stream", "content-length": String(bytes.length) }, bytes };
  }

  /** fetch() for tests: /api/creative -> handleApi, cdnBase -> handleCdn, blocked base -> network error. */
  async function fetchImpl(url, init = {}) {
    if (init.signal && init.signal.aborted) {
      const e = new Error("aborted");
      e.name = "AbortError";
      throw e;
    }
    const s = String(url);
    if (s.startsWith(blockedCdnBase)) {
      log.push({ kind: "cdn", blocked: true });
      throw new TypeError("Failed to fetch"); // what a browser reports for a CORS refusal
    }
    if (s.startsWith(cdnBase)) {
      const r = handleCdn(s.slice(cdnBase.length));
      return new Response(r.bytes, { status: r.status, headers: r.headers });
    }
    const hdrs = {};
    const h = init.headers || {};
    for (const k of Object.keys(h)) hdrs[k.toLowerCase()] = h[k];
    const r = handleApi(init.method || "GET", s, hdrs);
    return new Response(JSON.stringify(r.body), { status: r.status, headers: r.headers });
  }

  return {
    handleApi,
    handleCdn,
    fetch: fetchImpl,
    log,
    /** Queue a forced error for the next matching request (resource "asset" | "jobs" | undefined = any). */
    failNext(f) {
      forced.push(f);
    },
    job: (id) => table.get(id),
    get issuedCount() {
      return issued.size;
    },
    count(kind, resource) {
      return log.filter((e) => e.kind === kind && (resource === undefined || e.resource === resource)).length;
    },
    label: SIMULATED_LABEL,
  };
}
