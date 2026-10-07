/**
 * Adapter for the PROPOSED /api/creative contract, REVISION 2
 * (docs/creative/SCENARIO_3D_API_CONTRACT.md, Claude 3946b53, merged into the
 * candidate as b1f4f3a). Revision 1 responses (no usage.billingOutcome) still
 * work: the outcome is derived with the server's own rule and marked
 * `source: "derived"`. The viewer only consumes the HTTP contract; no backend
 * code is imported.
 *
 *   const source = createCreativeAssetSource({
 *     fetchImpl: window.fetch.bind(window),
 *     getAuthToken: async () => session?.access_token,   // Supabase access token
 *   });
 *   const asset = await source.resolve(jobId, 0);          // fresh url EVERY call
 *   const { job } = await source.getJob(jobId);
 *
 * Rules taken from the contract (§2.5):
 * - The asset url is resolved from the provider on every call and may expire
 *   at an unknown time, so this module NEVER caches, memoises or persists it.
 *   Each resolve() is one GET with a freshly obtained Bearer token.
 * - Errors are mapped by the response `code`, never by message text (the
 *   auth messages mention "design"; 409 is shared by two codes).
 * - Every resolve failure carries `details.cause`: "network" (transport,
 *   RESOLVE_FAILED), "malformed" (a 2xx without a usable body,
 *   RESOLVE_MALFORMED) or "http" (an error answer, mapped by code), plus
 *   `details.retryable` from isRetryableResolveError(). The viewer re-resolves
 *   ONCE on a retryable failure; hosts calling resolve() themselves should
 *   use the same predicate.
 * - Only glb/gltf are viewable; every other format (or null) is download-only.
 * - v3 (team follow-up, narrowed): RESOLVE_FAILED means network/transport
 *   ONLY (details.cause "network"). An error answer whose code the viewer
 *   does not know (e.g. 500 INTERNAL), or a non-2xx with no code that no
 *   status rule covers, is RESOLVE_SERVER_ERROR (cause "http"; retryable on
 *   5xx). The QE assertions that pinned 500 INTERNAL -> RESOLVE_FAILED
 *   (tests/acceptance/scenario/viewerV21) already fail at f472aef for an
 *   unrelated rev 2 reason, so narrowing adds no failure (ASSET_VIEWER.md §12.3).
 * - A 429 is retried after a short fixed delay (RATE_LIMIT_RETRY_DELAY_MS,
 *   injectable); see retryDelayForResolveError().
 */
import { AssetViewerError } from "./errors.js";

export const DEFAULT_CREATIVE_BASE_URL = "/api/creative";

/** Formats the backend can report (FORMAT_BY_EXT in creativeService.js). Anything else -> null. */
export const CREATIVE_FORMATS = /* @__PURE__ */ Object.freeze(["glb", "gltf", "fbx", "obj", "usdz", "stl", "ply", "zip"]);
/** Formats the viewer will try to display. Everything else is offered as download-only. */
export const VIEWABLE_FORMATS = /* @__PURE__ */ Object.freeze(["glb", "gltf"]);

export const MIME_BY_FORMAT = /* @__PURE__ */ Object.freeze({
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  fbx: "application/octet-stream",
  obj: "model/obj",
  usdz: "model/vnd.usdz+zip",
  stl: "model/stl",
  ply: "application/octet-stream",
  zip: "application/zip",
});

/**
 * Fallback used ONLY when a response lacks a non-blank `concept.notice` (the
 * contract says every job/asset response carries one). Character-for-character
 * copy of CONCEPT_NOTICE.notice in src/lib/creative/creativeService.js (backend
 * bundle 7f42f95, line 36), so the fallback never drifts from the server's text.
 */
export const DEFAULT_CONCEPT_NOTICE =
  "AI-generated visual concept. Not a FurniAI design: it has no verified measurements, no separately editable doors or panels, and cannot be manufactured from.";

/**
 * usage.billingOutcome (rev 2 §2.4). `unconfirmed` is NOT "free": nothing in
 * this module, its state or its UI ever says a provider request cost nothing.
 */
export const BILLING_OUTCOMES = /* @__PURE__ */ Object.freeze(["not_submitted", "reported", "unconfirmed"]);

const BILLING_TEXT = {
  not_submitted: "The paid generation request was not sent for this job.",
  reported: "The 3D generation service reported a cost for this job.",
  unconfirmed: "Charge not confirmed: the paid request was or may have been sent and no cost has been reported. This does not mean it was free.",
};

/** Customer-safe line for a billing outcome; anything unknown is treated as unconfirmed. */
export function describeBillingOutcome(outcome) {
  return BILLING_TEXT[outcome] || BILLING_TEXT.unconfirmed;
}

/**
 * { outcome, source } from a job view. rev 2: `usage.billingOutcome`
 * (source "server"). rev 1 (field absent): derived with the backend's own
 * rule (reported cost -> reported; submitting -> not_submitted; otherwise
 * unconfirmed), source "derived". An unrecognised value becomes
 * "unconfirmed", never "free". Costs stay on the job (`usage`).
 */
export function normalizeBilling(job) {
  const u = (job && job.usage) || {};
  const o = u.billingOutcome;
  if (typeof o === "string") return { outcome: BILLING_OUTCOMES.includes(o) ? o : "unconfirmed", source: "server" };
  return { outcome: typeof u.reportedCost === "number" ? "reported" : job && job.status === "submitting" ? "not_submitted" : "unconfirmed", source: "derived" };
}

/**
 * reference.validation (rev 2 §2.2), for hosts that show an uploaded
 * reference. `structure` does NOT prove the pixel data decodes.
 */
export function describeReferenceValidation(level) {
  if (level === "decoded") return "Image fully decoded and checked.";
  if (level === "structure") return "File structure checked; the image data itself was not decoded here.";
  return "Validation level not reported.";
}

const CONCEPT_FLAGS = ["editable", "dimensionsVerified", "partsSeparable", "manufacturable"];
const MAX_JOB_MESSAGE_CHARS = 300;

/**
 * Normalised concept block for viewer state. Flags are reported as the
 * server sent them (booleans only, default false), but the viewer never
 * acts on a `true`: no dimensions, no editing, no export, whatever they say.
 * A non-blank server `notice` is kept VERBATIM (no trimming, collapsing or
 * truncation; it is only ever rendered with textContent).
 */
export function normalizeConcept(concept) {
  const c = concept && typeof concept === "object" ? concept : null;
  const notice = c && typeof c.notice === "string" && c.notice.trim() ? c.notice : "";
  const out = { kind: c && typeof c.kind === "string" && c.kind ? c.kind : "visual_concept" };
  for (const k of CONCEPT_FLAGS) out[k] = c && typeof c[k] === "boolean" ? c[k] : false;
  out.notice = notice || DEFAULT_CONCEPT_NOTICE;
  out.noticeSource = notice ? "server" : "viewer-default";
  return out;
}

export function normalizeCreativeFormat(format) {
  if (typeof format !== "string") return null;
  const f = format.trim().toLowerCase();
  return CREATIVE_FORMATS.includes(f) ? f : null;
}

export function isViewableFormat(format) {
  return VIEWABLE_FORMATS.includes(format);
}

/** Download name: concept-<jobId>-<index>.<format|bin> (the provider's own name is not trusted). */
export function creativeFilename(jobId, index, format) {
  const safeJob = String(jobId || "unknown").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 64) || "unknown";
  const i = Number.isInteger(index) && index >= 0 ? index : 0;
  return `furniai-concept-${safeJob}-${i}.${normalizeCreativeFormat(format) || "bin"}`;
}

/** Customer-safe, single-line version of a failed job's error.message (textContent only). */
export function safeJobMessage(message) {
  if (typeof message !== "string") return null;
  const m = message.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (!m) return null;
  if (/https?:\/\//i.test(m)) return null; // never echo addresses
  return m.length > MAX_JOB_MESSAGE_CHARS ? `${m.slice(0, MAX_JOB_MESSAGE_CHARS - 1)}…` : m;
}

/** Replaces any http(s) address in developer detail text (signed urls must not leak into logs/state). */
export function redactUrls(text) {
  return typeof text === "string" ? text.replace(/\bhttps?:\/\/[^\s"'<>)]+/gi, "[url]") : text;
}

const CODE_MAP = /* @__PURE__ */ Object.freeze({
  MISSING_AUTH: "SIGN_IN_REQUIRED",
  // persistence/errors.js answers UNAUTHORIZED with 403: signed in, not allowed. Not "please sign in".
  UNAUTHORIZED: "FORBIDDEN",
  FORBIDDEN: "FORBIDDEN",
  AUTH_UNAVAILABLE: "SIGN_IN_UNAVAILABLE",
  PERSISTENCE_NOT_CONFIGURED: "CONCEPTS_NOT_CONFIGURED",
  STORAGE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  MISSING_JOB: "CONCEPT_NOT_FOUND",
  ASSET_NOT_READY: "ASSET_NOT_READY",
  ASSET_UNAVAILABLE: "ASSET_UNAVAILABLE",
  RECORD_INTEGRITY_FAILED: "RECORD_INTEGRITY_FAILED",
  BAD_REQUEST: "INVALID_ASSET",
  // CREATIVE_*_NOT_CONFIGURED / CREATIVE_GENERATION_DISABLED -> CONCEPTS_NOT_CONFIGURED and
  // PROVIDER_* -> PROVIDER_UNAVAILABLE are prefix rules in viewerCodeFor().
  // rev 2, POST ?resource=jobs answers a host may hand to viewer.showSubmitResponse():
  PRIOR_SUBMISSION_UNKNOWN: "PRIOR_SUBMISSION_UNKNOWN",
  DUPLICATE_ACTIVE_JOB: "DUPLICATE_ACTIVE_JOB",
});

function viewerCodeFor(c) {
  if (Object.hasOwn(CODE_MAP, c)) return CODE_MAP[c];
  if (/^CREATIVE_\w*(NOT_CONFIGURED|DISABLED)$/.test(c)) return "CONCEPTS_NOT_CONFIGURED";
  return c.startsWith("PROVIDER_") ? "PROVIDER_UNAVAILABLE" : "RESOLVE_SERVER_ERROR";
}

/** Fallback when a response carries no `code` at all (e.g. a proxy error page). Only 401 means signed out. */
function codeForStatus(status) {
  if (status === 401) return "SIGN_IN_REQUIRED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "CONCEPT_NOT_FOUND";
  if (status === 410) return "ASSET_UNAVAILABLE";
  if (status >= 500) return "SERVICE_UNAVAILABLE";
  return "RESOLVE_SERVER_ERROR";
}

/**
 * Viewer codes that a second identical GET cannot change, whatever the HTTP
 * status says: auth/permission, not-found/gone/not-ready, integrity, a bad
 * request, and a deployment that is not set up (503 *_NOT_CONFIGURED).
 */
const NEVER_RETRY_CODES = /* @__PURE__ */ new Set([
  "SIGN_IN_REQUIRED",
  "FORBIDDEN",
  "CONCEPT_NOT_FOUND",
  "ASSET_NOT_READY",
  "ASSET_UNAVAILABLE",
  "RECORD_INTEGRITY_FAILED",
  "INVALID_ASSET",
  "CONCEPTS_NOT_CONFIGURED",
  "RESOLVE_MALFORMED",
  "PRIOR_SUBMISSION_UNKNOWN",
  "DUPLICATE_ACTIVE_JOB",
]);

/**
 * The viewer's default resolve-retry rule (contract §2.5 only says "if a load
 * fails, call it again once"; it is silent on a failed resolve):
 *   retry ONCE on a network/transport error, any 5xx, or 429
 *   (incl. PROVIDER_UNAVAILABLE / PROVIDER_AUTH_REJECTED / ... 502, PROVIDER_RATE_LIMITED 429,
 *   AUTH_UNAVAILABLE / STORAGE_UNAVAILABLE 503, INTERNAL 500);
 *   never on 401/402/403/404/409/410, ASSET_NOT_READY, RECORD_INTEGRITY_FAILED,
 *   a malformed body, *_NOT_CONFIGURED, a missing token or an abort.
 * Accepts errors from custom sources too: without `details.cause`, the HTTP `status` decides.
 */
export function isRetryableResolveError(err) {
  if (!err || typeof err !== "object") return false;
  if (err.name === "AbortError" || err.code === 20) return false;
  const cause = err.details && typeof err.details === "object" ? err.details.cause : undefined;
  if (cause === "network") return true;
  if (cause === "malformed") return false;
  if (NEVER_RETRY_CODES.has(err.code)) return false;
  const s = err.status;
  return Number.isInteger(s) && (s === 429 || (s >= 500 && s <= 599));
}

/** Fixed pause before the single retry of a 429 (team follow-up, 2026-10-05). */
export const RATE_LIMIT_RETRY_DELAY_MS = 1000;

/** How long to wait before the ONE retry of a retryable resolve failure: `rateLimitMs` for a 429, else 0. */
export function retryDelayForResolveError(err, rateLimitMs = RATE_LIMIT_RETRY_DELAY_MS) {
  return err && err.status === 429 && rateLimitMs > 0 ? rateLimitMs : 0;
}

function withCause(err, cause) {
  err.details = { cause };
  err.details.retryable = isRetryableResolveError(err);
  return err;
}

function malformed(detail, extra) {
  return withCause(new AssetViewerError("RESOLVE_MALFORMED", detail, extra), "malformed");
}

/**
 * Maps an /api/creative error response to an AssetViewerError. Switches on
 * `body.code`; HTTP status is only consulted when there is no code. Unknown
 * codes (incl. INTERNAL) become RESOLVE_SERVER_ERROR (v3; was RESOLVE_FAILED).
 * `details.cause` is "http".
 * The server's own `details` are not copied (only `jobStatus` is kept).
 */
export function mapCreativeError(status, body) {
  const serverCode = body && typeof body.code === "string" && body.code ? body.code : null;
  const viewerCode = serverCode ? viewerCodeFor(serverCode) : codeForStatus(status);
  const extra = { status, serverCode };
  const details = body && body.details && typeof body.details === "object" ? body.details : null;
  if (details && typeof details.jobStatus === "string") extra.jobStatus = details.jobStatus;
  // rev 2: provider errors carry billingOutcome; 409s name the related job.
  if (details && typeof details.billingOutcome === "string") extra.billingOutcome = BILLING_OUTCOMES.includes(details.billingOutcome) ? details.billingOutcome : "unconfirmed";
  if (details && typeof details.jobId === "string") extra.relatedJobId = details.jobId;
  if (serverCode === "PRIOR_SUBMISSION_UNKNOWN") Object.assign(extra, { chargeMayHaveOccurred: true, autoRetry: false, requiresAcknowledgement: true });
  return withCause(new AssetViewerError(viewerCode, `/api/creative HTTP ${status} ${serverCode || "(no code)"}`, extra), "http");
}

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export function createCreativeAssetSource({ fetchImpl, getAuthToken, baseUrl = DEFAULT_CREATIVE_BASE_URL } = {}) {
  const doFetch = fetchImpl || (typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : null);
  if (typeof doFetch !== "function") throw new TypeError("createCreativeAssetSource: fetchImpl is required");
  if (typeof getAuthToken !== "function") throw new TypeError("createCreativeAssetSource: getAuthToken() is required");

  function endpoint(params) {
    const q = new URLSearchParams(params).toString();
    return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}${q}`;
  }

  async function call(params, signal) {
    let token;
    try {
      token = await getAuthToken(); // asked for EVERY call: tokens refresh, and nothing is cached here
    } catch (e) {
      throw new AssetViewerError("SIGN_IN_REQUIRED", `getAuthToken threw: ${e && e.message ? e.message : e}`);
    }
    if (typeof token !== "string" || !token.trim()) {
      throw new AssetViewerError("SIGN_IN_REQUIRED", "no auth token available; request not sent");
    }
    let res;
    try {
      res = await doFetch(endpoint(params), {
        method: "GET",
        headers: { Authorization: `Bearer ${token.trim()}`, Accept: "application/json" },
        cache: "no-store",
        credentials: "same-origin",
        signal,
      });
    } catch (e) {
      if (e && (e.name === "AbortError" || e.code === 20)) throw e;
      throw withCause(new AssetViewerError("RESOLVE_FAILED", redactUrls(`network error: ${e && e.message ? e.message : e}`)), "network");
    }
    const body = await readJson(res);
    if (!res.ok || !body || body.ok !== true) {
      if (res.ok) throw malformed(`/api/creative HTTP ${res.status}: body is not an ok:true JSON object`, { status: res.status });
      throw mapCreativeError(res.status, body);
    }
    return body;
  }

  /**
   * GET ?resource=asset&jobId=&index= -> a fresh, single-use-safe descriptor.
   * The returned `url` must be used immediately and then dropped.
   */
  async function resolve(jobId, index = 0, { signal } = {}) {
    if (typeof jobId !== "string" || !jobId.trim()) throw new AssetViewerError("INVALID_ASSET", "jobId is required");
    const i = index === undefined || index === null ? 0 : index;
    if (!Number.isInteger(i) || i < 0) throw new AssetViewerError("INVALID_ASSET", `index must be a non-negative integer (got ${String(index)})`);
    const body = await call({ resource: "asset", jobId: jobId.trim(), index: String(i) }, signal);
    const a = body.asset;
    if (!a || typeof a !== "object" || typeof a.url !== "string" || !/^https?:\/\//i.test(a.url)) {
      throw malformed("asset response has no http(s) url", { status: 200 });
    }
    if ((a.jobId !== undefined && a.jobId !== jobId.trim()) || (a.index !== undefined && a.index !== i)) {
      throw malformed("asset response is for a different job/index", { status: 200 });
    }
    const format = normalizeCreativeFormat(a.format);
    return {
      jobId: jobId.trim(),
      index: i,
      url: a.url,
      format,
      mimeType: typeof a.mimeType === "string" && a.mimeType ? a.mimeType : null,
      filename: creativeFilename(jobId.trim(), i, format),
      concept: normalizeConcept(a.concept),
      resolvedAt: typeof a.resolvedAt === "string" ? a.resolvedAt : null,
      expiresAt: typeof a.expiresAt === "string" ? a.expiresAt : null,
      expiryKnown: a.expiryKnown === true,
      durableCopy: a.durableCopy === true,
    };
  }

  /** GET ?resource=jobs&jobId= -> { job, refresh }. `refresh.ok:false` is informational only. */
  async function getJob(jobId, { signal } = {}) {
    if (typeof jobId !== "string" || !jobId.trim()) throw new AssetViewerError("INVALID_ASSET", "jobId is required");
    const body = await call({ resource: "jobs", jobId: jobId.trim() }, signal);
    if (!body.job || typeof body.job !== "object") throw malformed("jobs response has no job object", { status: 200 });
    return { job: body.job, refresh: body.refresh && typeof body.refresh === "object" ? body.refresh : null };
  }

  return Object.freeze({
    resolve,
    getJob,
    /** Same rule as the exported isRetryableResolveError, so a host needs no second import. */
    isRetryable: isRetryableResolveError,
    /** Pause before that one retry: 1 s for a 429, else 0. */
    retryDelayMs: (err) => retryDelayForResolveError(err),
    kind: "creative-api",
    baseUrl,
  });
}
