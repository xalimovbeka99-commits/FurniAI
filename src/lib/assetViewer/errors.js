/**
 * Asset viewer error contract. Every failure the viewer reports carries one
 * of these codes plus a human message safe to show a customer. `detail` is
 * for logs/devtools only (never rendered).
 */

export const ERROR_MESSAGE = /* @__PURE__ */ Object.freeze({
  INVALID_ASSET: "This model can't be shown: no file or link was provided.",
  UNSUPPORTED_FORMAT: "This model's file type isn't supported by the viewer yet.",
  FETCH_FAILED: "The model couldn't be downloaded. Check your connection and try again.",
  FILE_TOO_LARGE: "This model file is too large to preview here.",
  PARSE_FAILED: "The model file appears to be damaged or incomplete and couldn't be opened.",
  EMPTY_SCENE: "The model file opened, but it doesn't contain anything to show.",
  WEBGL_UNAVAILABLE: "3D preview isn't available in this browser (WebGL is disabled or unsupported).",
  MISSING_DEPENDENCY: "The 3D viewer isn't fully set up on this page.",
  VIEWER_DISPOSED: "The 3D viewer has been closed.",
  SIGN_IN_REQUIRED: "Please sign in to view this 3D concept.",
  SIGN_IN_UNAVAILABLE: "Sign-in is temporarily unavailable, so this 3D concept can't be opened right now. Please try again later.",
  FORBIDDEN: "This account doesn't have permission to open this 3D concept.",
  CONCEPTS_NOT_CONFIGURED: "3D concepts aren't available on this site yet.",
  SERVICE_UNAVAILABLE: "The 3D concept service is temporarily unavailable. Please try again later.",
  PROVIDER_UNAVAILABLE: "The 3D generation service couldn't be reached. Please try again later.",
  CONCEPT_NOT_FOUND: "This 3D concept couldn't be found. It may belong to another account or have been removed.",
  ASSET_NOT_READY: "This 3D concept isn't ready yet.",
  ASSET_UNAVAILABLE: "This 3D concept is no longer available. The generation service no longer has the file and no copy was kept.",
  RECORD_INTEGRITY_FAILED: "This 3D concept can't be opened because its record failed a safety check.",
  RESOLVE_FAILED: "The 3D concept couldn't be opened. Please try again.",
  RESOLVE_SERVER_ERROR: "The 3D concept service had a problem opening this concept. Please try again later.",
  RESOLVE_MALFORMED: "The 3D concept service sent a reply that couldn't be read, so this concept can't be opened right now.",
  ASSET_DISPLAY_FAILED: "This 3D concept couldn't be displayed here. Downloading it may still work.",
  GENERATION_FAILED: "The 3D concept couldn't be generated.",
  SUBMISSION_UNKNOWN:
    "The request was sent but no answer came back, so it isn't known whether a 3D concept was started. It may have been charged. It will not be retried automatically.",
  JOB_STATUS_UNKNOWN: "The status of this 3D concept couldn't be understood.",
  WEBGL_CONTEXT_LOST: "The 3D preview stopped: the browser's graphics context was lost.",
  PRIOR_SUBMISSION_UNKNOWN: "The last 3D concept request for this image may have been charged; its outcome is unknown. Nothing new was sent or will be sent automatically.",
  DUPLICATE_ACTIVE_JOB: "A 3D concept is already being generated from this image. Nothing new was sent.",
});

/**
 * Every code is its own name (ERROR_CODE.X === "X"), derived from
 * ERROR_MESSAGE so the two can never drift. Notes on some codes:
 * - FORBIDDEN (v2.1): HTTP 403 / UNAUTHORIZED, signed in but not allowed. The message only says access is
 *   blocked (no sign-in wording; 401 keeps its sign-in prompt). Its record has pageWide:true: hosts treat it page-wide.
 * - RESOLVE_FAILED: network/transport failure ONLY (details.cause "network"; offline, DNS, CORS on
 *   the API call, connection reset). Narrowed in v3.
 * - RESOLVE_SERVER_ERROR (v3): an error answer whose code the viewer does not know (e.g. 500
 *   INTERNAL), or a non-2xx with no code and no status rule. details.cause "http", `status` and
 *   `serverCode` set; retryable on 5xx only. Before v3 this was RESOLVE_FAILED.
 * - RESOLVE_MALFORMED (v2.1): a 2xx whose body is not a usable answer (cause "malformed"). Never retried.
 * - WEBGL_CONTEXT_LOST (v3): the context was lost after the viewer started (GPU reset, too many contexts).
 * - PRIOR_SUBMISSION_UNKNOWN (rev 2 409): the last job for this reference ended submission_unknown.
 *   Never retried or resubmitted by the viewer; `relatedJobId` names that job.
 * - DUPLICATE_ACTIVE_JOB (rev 2 409): one active job per reference; `relatedJobId` is the running one.
 */
export const ERROR_CODE = /* @__PURE__ */ Object.freeze(Object.fromEntries(Object.keys(ERROR_MESSAGE).map((k) => [k, k])));

/**
 * v3: FETCH_FAILED says honestly WHY a plain link failed (error.reason). A 404/410 or an
 * expired link is not a connection problem, so it never says "check your connection".
 */
export const FETCH_FAILED_MESSAGE = /* @__PURE__ */ Object.freeze({
  network: ERROR_MESSAGE.FETCH_FAILED, // transport error, incl. a CORS refusal (indistinguishable in a browser)
  offline: "You appear to be offline, so the model couldn't be downloaded. Reconnect and try again.",
  "cross-origin": "The model couldn't be downloaded: the connection failed, or the file's server doesn't allow this page to load it. Try again.",
  gone: "This model's link no longer works: the file wasn't found or has been removed.",
  denied: "This model's link has expired or isn't allowed from this page.",
  server: "The server holding this model had a problem. Try again in a moment.",
  http: "The model couldn't be downloaded from its link.",
});

/** v3: PARSE_FAILED / EMPTY_SCENE sub-reasons (error.reason) for an invalid file. */
export const INVALID_FILE_MESSAGE = /* @__PURE__ */ Object.freeze({
  html: "The link returned a web page instead of a 3D model file.",
  "bad-magic": "This file isn't a valid 3D model file.",
  truncated: "The model file is incomplete. It may have been cut off while downloading.",
  "no-mesh": ERROR_MESSAGE.EMPTY_SCENE,
});

/** Extra serialisable fields an AssetViewerError may carry into its record. */
const RECORD_EXTRAS = [
  "status", "serverCode", "jobStatus", "downloadAvailable", "chargeMayHaveOccurred", "autoRetry", "attempts", "details",
  "billingOutcome", "relatedJobId", "requiresAcknowledgement", "webglReason", "reason",
];

export class AssetViewerError extends Error {
  /**
   * @param {keyof typeof ERROR_CODE} code
   * @param {string} [detail] developer-facing detail (not shown to customers)
   * @param {object} [extra] e.g. { status } for FETCH_FAILED, { serverCode } for
   *   /api/creative errors, { message } to replace the default customer message
   *   with a vetted one (used for a failed job's own error message),
   *   { details: { cause, retryable } } for /api/creative resolve failures.
   */
  constructor(code, detail, extra = {}) {
    const { message, ...rest } = extra || {};
    super((typeof message === "string" && message) || ERROR_MESSAGE[code] || "Unknown viewer error.");
    this.name = "AssetViewerError";
    this.code = ERROR_CODE[code] ? code : "PARSE_FAILED";
    this.detail = detail || null;
    Object.assign(this, rest);
  }
}

/**
 * Duck-typed so an error from a SEPARATE bundle (the optional /api/creative
 * adapter, entry.creative.js, has its own copy of this class) or a custom
 * asset source is still recognised.
 */
export function isViewerError(err) {
  return Boolean(err && typeof err === "object" && err.name === "AssetViewerError" && Object.hasOwn(ERROR_CODE, err.code));
}

/** Plain, serialisable error record as exposed in viewer state / onError. */
export function toErrorRecord(err) {
  if (isViewerError(err)) {
    const rec = { code: err.code, message: err.message, detail: err.detail };
    for (const k of RECORD_EXTRAS) if (err[k] !== undefined) rec[k] = err[k];
    if (err.code === "FORBIDDEN") rec.pageWide = true; // INT-403: one page-level message; a host may close its viewer panel
    return rec;
  }
  return {
    code: ERROR_CODE.PARSE_FAILED,
    message: ERROR_MESSAGE.PARSE_FAILED,
    detail: err && err.message ? String(err.message) : String(err),
  };
}
