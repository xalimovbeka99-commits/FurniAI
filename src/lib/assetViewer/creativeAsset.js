/**
 * Adapter for the PROPOSED /api/creative contract
 * (docs/creative/SCENARIO_3D_API_CONTRACT.md on the Claude backend bundle,
 * tip 7f42f95). The viewer only consumes the HTTP contract; no backend code
 * is imported.
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
 * - Only glb/gltf are viewable; every other format (or null) is download-only.
 */
import { AssetViewerError } from "./errors.js";

export const DEFAULT_CREATIVE_BASE_URL = "/api/creative";

/** Formats the backend can report (FORMAT_BY_EXT in creativeService.js). Anything else -> null. */
export const CREATIVE_FORMATS = Object.freeze(["glb", "gltf", "fbx", "obj", "usdz", "stl", "ply", "zip"]);
/** Formats the viewer will try to display. Everything else is offered as download-only. */
export const VIEWABLE_FORMATS = Object.freeze(["glb", "gltf"]);

export const MIME_BY_FORMAT = Object.freeze({
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
 * Used ONLY when a response lacks `concept.notice` (the contract says every
 * job/asset response carries one). Deliberately as strict as the server's.
 */
export const DEFAULT_CONCEPT_NOTICE =
  "AI-generated visual concept. Not a FurniAI design: it has no verified measurements, no separately editable parts, and cannot be manufactured from.";

const CONCEPT_FLAGS = ["editable", "dimensionsVerified", "partsSeparable", "manufacturable"];
const MAX_NOTICE_CHARS = 600;
const MAX_JOB_MESSAGE_CHARS = 300;

/**
 * Normalised concept block for viewer state. Flags are reported as the
 * server sent them (booleans only, default false), but the viewer never
 * acts on a `true`: no dimensions, no editing, no export, whatever they say.
 */
export function normalizeConcept(concept) {
  const c = concept && typeof concept === "object" ? concept : null;
  const notice = c && typeof c.notice === "string" ? c.notice.replace(/\s+/g, " ").trim().slice(0, MAX_NOTICE_CHARS) : "";
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

const CODE_MAP = Object.freeze({
  MISSING_AUTH: "SIGN_IN_REQUIRED",
  UNAUTHORIZED: "SIGN_IN_REQUIRED",
  AUTH_UNAVAILABLE: "SIGN_IN_UNAVAILABLE",
  PERSISTENCE_NOT_CONFIGURED: "CONCEPTS_NOT_CONFIGURED",
  CREATIVE_NOT_CONFIGURED: "CONCEPTS_NOT_CONFIGURED",
  CREATIVE_STORE_NOT_CONFIGURED: "CONCEPTS_NOT_CONFIGURED",
  CREATIVE_GENERATION_DISABLED: "CONCEPTS_NOT_CONFIGURED",
  STORAGE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  MISSING_JOB: "CONCEPT_NOT_FOUND",
  ASSET_NOT_READY: "ASSET_NOT_READY",
  ASSET_UNAVAILABLE: "ASSET_UNAVAILABLE",
  RECORD_INTEGRITY_FAILED: "RECORD_INTEGRITY_FAILED",
  BAD_REQUEST: "INVALID_ASSET",
  PROVIDER_AUTH_REJECTED: "PROVIDER_UNAVAILABLE",
  PROVIDER_REJECTED_REQUEST: "PROVIDER_UNAVAILABLE",
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  PROVIDER_UNEXPECTED_RESPONSE: "PROVIDER_UNAVAILABLE",
  PROVIDER_RATE_LIMITED: "PROVIDER_UNAVAILABLE",
  PROVIDER_INSUFFICIENT_CREDITS: "PROVIDER_UNAVAILABLE",
});

/** Fallback when a response carries no `code` at all (e.g. a proxy error page). */
function codeForStatus(status) {
  if (status === 401 || status === 403) return "SIGN_IN_REQUIRED";
  if (status === 404) return "CONCEPT_NOT_FOUND";
  if (status === 410) return "ASSET_UNAVAILABLE";
  if (status >= 500) return "SERVICE_UNAVAILABLE";
  return "RESOLVE_FAILED";
}

/**
 * Maps an /api/creative error response to an AssetViewerError. Switches on
 * `body.code`; HTTP status is only consulted when there is no code. Unknown
 * codes (incl. INTERNAL) become RESOLVE_FAILED.
 */
export function mapCreativeError(status, body) {
  const serverCode = body && typeof body.code === "string" && body.code ? body.code : null;
  const viewerCode = serverCode ? CODE_MAP[serverCode] || "RESOLVE_FAILED" : codeForStatus(status);
  const extra = { status, serverCode };
  const details = body && body.details && typeof body.details === "object" ? body.details : null;
  if (details && typeof details.jobStatus === "string") extra.jobStatus = details.jobStatus;
  return new AssetViewerError(viewerCode, `/api/creative HTTP ${status} ${serverCode || "(no code)"}`, extra);
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
      throw new AssetViewerError("RESOLVE_FAILED", redactUrls(`network error: ${e && e.message ? e.message : e}`));
    }
    const body = await readJson(res);
    if (!res.ok || !body || body.ok !== true) {
      if (res.ok) throw new AssetViewerError("RESOLVE_FAILED", `/api/creative HTTP ${res.status}: body is not an ok:true JSON object`, { status: res.status });
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
      throw new AssetViewerError("RESOLVE_FAILED", "asset response has no http(s) url");
    }
    if ((a.jobId !== undefined && a.jobId !== jobId.trim()) || (a.index !== undefined && a.index !== i)) {
      throw new AssetViewerError("RESOLVE_FAILED", "asset response is for a different job/index");
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
    if (!body.job || typeof body.job !== "object") throw new AssetViewerError("RESOLVE_FAILED", "jobs response has no job object");
    return { job: body.job, refresh: body.refresh && typeof body.refresh === "object" ? body.refresh : null };
  }

  return Object.freeze({ resolve, getJob, kind: "creative-api", baseUrl });
}
