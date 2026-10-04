/**
 * FIXTURE DATA shaped exactly like SCENARIO_3D_API_CONTRACT.md (PROPOSED)
 * §2.4 / §2.5 / §5 and like toJobView / getAssetLink / toCreativeErrorBody in
 * Claude's backend at 7f42f956. Not real Scenario output: ids, dates, models
 * and URLs are invented.
 */
export const CONCEPT = Object.freeze({
  kind: "visual_concept",
  editable: false,
  dimensionsVerified: false,
  partsSeparable: false,
  manufacturable: false,
  notice:
    "AI-generated visual concept. Not a FurniAI design: it has no verified measurements, no separately editable doors or panels, and cannot be manufactured from.",
});

/** Exact key sets (order-insensitive). Checked by fixtureShape.test.js. */
export const JOB_VIEW_KEYS = Object.freeze([
  "jobId", "status", "provider", "model", "sourceReferenceId", "providerStatus", "providerProgress",
  "outputs", "usage", "storage", "error", "createdAt", "submittedAt", "completedAt", "updatedAt", "concept",
]);
export const OUTPUT_KEYS = Object.freeze(["index", "format", "mimeType"]);
export const USAGE_KEYS = Object.freeze(["estimatedCost", "reportedCost", "unit"]);
export const STORAGE_KEYS = Object.freeze(["durableCopy", "reason"]);
export const CONCEPT_KEYS = Object.freeze(Object.keys(CONCEPT));
export const ASSET_VIEW_KEYS = Object.freeze([
  "jobId", "index", "url", "format", "mimeType", "resolvedAt", "expiresAt", "expiryKnown", "durableCopy", "concept",
]);
export const STATUSES = Object.freeze(["submitting", "processing", "succeeded", "failed", "submission_unknown"]);

let seq = 0;
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export function jobView(overrides = {}) {
  const n = ++seq;
  const base = {
    jobId: uuid(n),
    status: "processing",
    provider: "scenario",
    model: "model_fixture-img23d",
    sourceReferenceId: uuid(1000 + n),
    providerStatus: "in-progress",
    providerProgress: null,
    outputs: [],
    usage: { estimatedCost: 12, reportedCost: null, unit: "provider_cost_units" },
    storage: { durableCopy: false, reason: "ASSET_STORAGE_NOT_CONFIGURED" },
    error: null,
    createdAt: "2026-10-04T07:10:00.000Z",
    submittedAt: "2026-10-04T07:10:01.000Z",
    completedAt: null,
    updatedAt: "2026-10-04T07:10:05.000Z",
    concept: { ...CONCEPT },
  };
  return { ...base, ...overrides };
}

export const glbOutput = (index = 0) => ({ index, format: "glb", mimeType: "model/gltf-binary" });

export function succeededJob(overrides = {}) {
  return jobView({
    status: "succeeded",
    providerStatus: "success",
    outputs: [glbOutput(0)],
    usage: { estimatedCost: 12, reportedCost: 12, unit: "provider_cost_units" },
    completedAt: "2026-10-04T07:12:30.000Z",
    updatedAt: "2026-10-04T07:12:30.000Z",
    ...overrides,
  });
}

export function failedJob(overrides = {}) {
  return jobView({
    status: "failed",
    providerStatus: "failure",
    completedAt: "2026-10-04T07:11:00.000Z",
    updatedAt: "2026-10-04T07:11:00.000Z",
    error: { code: "PROVIDER_REJECTED_REQUEST", message: "The generation service could not use this reference image." },
    ...overrides,
  });
}

export function unknownJob(overrides = {}) {
  return jobView({
    status: "submission_unknown",
    providerStatus: null,
    submittedAt: null,
    completedAt: "2026-10-04T07:10:31.000Z",
    updatedAt: "2026-10-04T07:10:31.000Z",
    error: { code: "PROVIDER_UNAVAILABLE", message: "No answer arrived from the generation service. It may have been charged." },
    ...overrides,
  });
}

export const listBody = (jobs) => ({ ok: true, jobs });
export const jobBody = (job, refresh) => ({ ok: true, job, ...(refresh ? { refresh } : {}) });

let urlSeq = 0;
export function assetView(job, index = 0, overrides = {}) {
  const out = job.outputs[index] || glbOutput(index);
  return {
    jobId: job.jobId,
    index,
    url: `https://cdn.fixture.invalid/assets/${job.jobId}/${index}/model.glb?sig=fixture-${++urlSeq}`,
    format: out.format,
    mimeType: null,
    resolvedAt: "2026-10-04T07:20:00.000Z",
    expiresAt: null,
    expiryKnown: false,
    durableCopy: false,
    concept: { ...CONCEPT },
    ...overrides,
  };
}
export const assetBody = (job, index, overrides) => ({ ok: true, asset: assetView(job, index, overrides) });

/** `{ ok:false, code, error, details? }` plus the HTTP status, as the API answers. */
export const ERROR_RESPONSES = Object.freeze({
  MISSING_AUTH: { status: 401, body: { ok: false, code: "MISSING_AUTH", error: "Sign in to continue." } },
  ASSET_NOT_READY: { status: 409, body: { ok: false, code: "ASSET_NOT_READY", error: "This generation has no asset to download.", details: { jobStatus: "processing" } } },
  ASSET_UNAVAILABLE: {
    status: 410,
    body: { ok: false, code: "ASSET_UNAVAILABLE", error: "The generation service no longer holds this asset, and FurniAI has no stored copy of it.", details: { durableCopy: false } },
  },
  RECORD_INTEGRITY_FAILED: { status: 409, body: { ok: false, code: "RECORD_INTEGRITY_FAILED", error: "This record failed an integrity check." } },
  MISSING_JOB: { status: 404, body: { ok: false, code: "MISSING_JOB", error: "That generation was not found." } },
  INTERNAL: { status: 500, body: { ok: false, code: "INTERNAL", error: "Something went wrong." } },
  PROVIDER_UNAVAILABLE: { status: 502, body: { ok: false, code: "PROVIDER_UNAVAILABLE", error: "The generation service is unavailable." } },
  CREATIVE_STORE_NOT_CONFIGURED: {
    status: 503,
    body: { ok: false, code: "CREATIVE_STORE_NOT_CONFIGURED", error: "3D concept generation has nowhere durable to record jobs on this deployment. Nothing was submitted." },
  },
});

/** What a client rejects with for an error response: status + the body's code/message/details. */
export function clientError({ status, body }) {
  return { status, code: body.code, message: body.error, ...(body.details ? { details: body.details } : {}) };
}
export const errorFor = (code) => clientError(ERROR_RESPONSES[code]);

/** A network failure: no status, like fetch's TypeError. */
export function networkError() {
  const e = new TypeError("Failed to fetch");
  return e;
}
