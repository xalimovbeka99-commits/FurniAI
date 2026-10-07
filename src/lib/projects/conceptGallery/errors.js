/**
 * Error classification. Everything switches on `code` (and on HTTP status
 * only when there is no code), never on message text.
 *
 * Errors from Asset Engineer's creative source / viewer (AssetViewerError,
 * with `serverCode` / `status` extras) are classified through the server
 * code they carry. A list client is expected to reject with an object like
 *   { status: 409, code: "ASSET_NOT_READY", message?, details? }
 * which is the `{ ok:false, code, error, details? }` body plus the HTTP
 * status. A rejection with no `status` (fetch TypeError, abort excluded) is
 * a network failure.
 */
import { CODE } from "./contract.js";

export const ERROR_KIND = Object.freeze({
  SIGNED_OUT: "signed_out",
  NETWORK: "network",
  SERVER: "server",
  NOT_CONFIGURED: "not_configured",
  INTEGRITY: "integrity",
  NOT_FOUND: "not_found",
  ASSET_NOT_READY: "asset_not_ready",
  ASSET_UNAVAILABLE: "asset_unavailable",
  /** HTTP 403 / UNAUTHORIZED / v2.1 FORBIDDEN: signed in but not allowed. Only 401 is signed out. */
  FORBIDDEN: "forbidden",
  /** A 2xx answer that can't be used (v2.1 RESOLVE_MALFORMED). Never retried. */
  MALFORMED: "malformed",
  /** HTTP 429 / PROVIDER_RATE_LIMITED: busy; same "try again in a moment" spirit as 5xx. */
  RATE_LIMITED: "rate_limited",
  /** Rev 2 §4 refusals that a retry in a moment won't fix (402 credits, provider auth, rejected request). */
  PROVIDER_REFUSED: "provider_refused",
  /** Rev 2 §4 PROVIDER_UNAVAILABLE / PROVIDER_UNEXPECTED_RESPONSE: the generation service didn't answer usably. */
  PROVIDER_UNAVAILABLE: "provider_unavailable",
  REQUEST: "request",
});

/**
 * Failures a person may sensibly try again. The gallery NEVER retries them by itself: it shows a
 * visible "Try again" action and the request runs again only when that is clicked.
 * Not here: 401/403 (page-wide sign-in / permission), 404/409 integrity (the record), 410 (gone),
 * *_NOT_CONFIGURED (deployment) and ASSET_NOT_READY (the job status is re-checked instead).
 */
export const USER_RETRY_KINDS = Object.freeze(
  new Set(["network", "server", "rate_limited", "provider_unavailable", "provider_refused", "malformed", "request"]),
);

const PROVIDER_REFUSED = new Set([CODE.PROVIDER_INSUFFICIENT_CREDITS, CODE.PROVIDER_AUTH_REJECTED, CODE.PROVIDER_REJECTED_REQUEST]);
const PROVIDER_DOWN = new Set([CODE.PROVIDER_UNAVAILABLE, CODE.PROVIDER_UNEXPECTED_RESPONSE]);

const NOT_CONFIGURED = new Set([
  CODE.CREATIVE_NOT_CONFIGURED,
  CODE.CREATIVE_STORE_NOT_CONFIGURED,
  CODE.PERSISTENCE_NOT_CONFIGURED,
  "CREATIVE_GENERATION_DISABLED",
]);

export function isAbortError(err) {
  return Boolean(err) && (err.name === "AbortError" || err.code === "ABORT_ERR");
}

/**
 * @param {unknown} err
 * @returns {{ kind: string, code: string, status: number|null }}
 */
/**
 * Codes thrown by Asset Engineer's createCreativeAssetSource / mountAssetViewer
 * (src/lib/assetViewer/errors.js, v2.1 at b34e259). When the error carries the
 * server's `serverCode`, that wins; these cover the cases without one.
 */
const VIEWER_CODE_KIND = Object.freeze({
  SIGN_IN_REQUIRED: "signed_out",
  SIGN_IN_UNAVAILABLE: "server",
  CONCEPTS_NOT_CONFIGURED: "not_configured",
  SERVICE_UNAVAILABLE: "server",
  PROVIDER_UNAVAILABLE: "provider_unavailable",
  CONCEPT_NOT_FOUND: "not_found",
  ASSET_NOT_READY: "asset_not_ready",
  ASSET_UNAVAILABLE: "asset_unavailable",
  RECORD_INTEGRITY_FAILED: "integrity",
  FORBIDDEN: "forbidden",
  RESOLVE_MALFORMED: "malformed",
});

/**
 * Viewer codes that mean "the file arrived (or would) but couldn't be shown here".
 * Only these make Open suggest Download; any other failure would hit Download too.
 */
export const DISPLAY_FAILURE_CODES = Object.freeze(
  new Set(["ASSET_DISPLAY_FAILED", "FETCH_FAILED", "PARSE_FAILED", "UNSUPPORTED_FORMAT", "EMPTY_SCENE", "FILE_TOO_LARGE", "WEBGL_UNAVAILABLE", "MISSING_DEPENDENCY", "VIEWER_ERROR"]),
);

function classifyViewerError(e) {
  const status = Number.isInteger(e.status) ? e.status : null;
  if (typeof e.serverCode === "string" && e.serverCode) return classifyError({ status, code: e.serverCode });
  const kind = VIEWER_CODE_KIND[e.code];
  if (kind) return { kind, code: e.code, status };
  if (e.code === "RESOLVE_FAILED") {
    if (status === null) return { kind: ERROR_KIND.NETWORK, code: CODE.NETWORK, status };
    if (status >= 500) return { kind: ERROR_KIND.SERVER, code: e.code, status };
  }
  return { kind: ERROR_KIND.REQUEST, code: e.code || "VIEWER_ERROR", status };
}

export function classifyError(err) {
  const e = err && typeof err === "object" ? err : {};
  if (e.name === "AssetViewerError") return classifyViewerError(e);
  const status = Number.isInteger(e.status) ? e.status : null;
  const code = typeof e.code === "string" && e.code ? e.code : null;

  if (code === CODE.SIGNED_OUT || code === CODE.MISSING_AUTH || status === 401) {
    return { kind: ERROR_KIND.SIGNED_OUT, code: code || CODE.MISSING_AUTH, status };
  }
  if (code === CODE.RECORD_INTEGRITY_FAILED) return { kind: ERROR_KIND.INTEGRITY, code, status };
  if (code === CODE.FORBIDDEN || code === CODE.UNAUTHORIZED) return { kind: ERROR_KIND.FORBIDDEN, code, status };
  if (code === CODE.ASSET_NOT_READY) return { kind: ERROR_KIND.ASSET_NOT_READY, code, status };
  if (code === CODE.ASSET_UNAVAILABLE) return { kind: ERROR_KIND.ASSET_UNAVAILABLE, code, status };
  if (code === CODE.MISSING_JOB) return { kind: ERROR_KIND.NOT_FOUND, code, status };
  if (code && NOT_CONFIGURED.has(code)) return { kind: ERROR_KIND.NOT_CONFIGURED, code, status };
  if (code === CODE.INVALID_RESPONSE) return { kind: ERROR_KIND.MALFORMED, code, status };
  if (status === 403) return { kind: ERROR_KIND.FORBIDDEN, code: code || CODE.FORBIDDEN, status };
  if (code === CODE.PROVIDER_RATE_LIMITED || status === 429) return { kind: ERROR_KIND.RATE_LIMITED, code: code || "HTTP_429", status };
  if (code && PROVIDER_DOWN.has(code)) return { kind: ERROR_KIND.PROVIDER_UNAVAILABLE, code, status };
  if ((code && PROVIDER_REFUSED.has(code)) || status === 402) return { kind: ERROR_KIND.PROVIDER_REFUSED, code: code || "HTTP_402", status };
  if (status === null && (code === null || code === CODE.NETWORK)) {
    return { kind: ERROR_KIND.NETWORK, code: CODE.NETWORK, status: null };
  }
  if (status !== null && status >= 500) return { kind: ERROR_KIND.SERVER, code: code || CODE.INTERNAL, status };
  return { kind: ERROR_KIND.REQUEST, code: code || `HTTP_${status ?? "ERROR"}`, status };
}

/** Customer-facing text per kind for the list. Static strings only. */
export const LIST_MESSAGES = Object.freeze({
  [ERROR_KIND.SIGNED_OUT]: "Sign in to see your 3D concepts.",
  [ERROR_KIND.NETWORK]: "We couldn't reach FurniAI. Check your connection and try again.",
  [ERROR_KIND.SERVER]: "FurniAI couldn't load your 3D concepts right now. Try again in a moment.",
  [ERROR_KIND.NOT_CONFIGURED]: "3D concepts aren't available on this deployment yet.",
  [ERROR_KIND.INTEGRITY]: "Your concept list failed an integrity check, so it isn't shown.",
  [ERROR_KIND.NOT_FOUND]: "Your concept list couldn't be found.",
  [ERROR_KIND.FORBIDDEN]: "This account doesn't have permission to see these 3D concepts.",
  [ERROR_KIND.MALFORMED]: "FurniAI sent a reply this page couldn't read, so your 3D concepts can't be shown right now.",
  [ERROR_KIND.RATE_LIMITED]: "FurniAI is busy and couldn't load your 3D concepts right now. Try again in a moment.",
  [ERROR_KIND.PROVIDER_REFUSED]: "The 3D generation service isn't accepting requests from FurniAI right now, so your 3D concepts can't be shown. Try again later.",
  [ERROR_KIND.PROVIDER_UNAVAILABLE]: "The 3D generation service isn't responding right now, so your 3D concepts can't be shown. Try again in a moment.",
  [ERROR_KIND.REQUEST]: "FurniAI couldn't load your 3D concepts.",
});

/** Customer-facing text for Open / Download failures. */
export const ASSET_MESSAGES = Object.freeze({
  [ERROR_KIND.ASSET_NOT_READY]: "This concept's file isn't ready yet. We're checking its status again.",
  [ERROR_KIND.ASSET_UNAVAILABLE]:
    "This file is no longer available. The generation service has removed it and FurniAI has no stored copy.",
  [ERROR_KIND.INTEGRITY]: "This concept's record failed an integrity check, so it can't be opened or downloaded.",
  [ERROR_KIND.NOT_FOUND]: "This concept no longer exists.",
  [ERROR_KIND.SIGNED_OUT]: "Sign in again to open or download this concept.",
  [ERROR_KIND.NETWORK]: "We couldn't reach FurniAI to get this file. Check your connection and try again.",
  [ERROR_KIND.SERVER]: "FurniAI couldn't get this file right now. Try again in a moment.",
  [ERROR_KIND.NOT_CONFIGURED]: "3D concept files aren't available on this deployment yet.",
  [ERROR_KIND.FORBIDDEN]: "This account doesn't have permission to get this file.",
  [ERROR_KIND.MALFORMED]: "FurniAI sent a reply this page couldn't read, so this file can't be opened or downloaded right now.",
  // Starts like the 5xx text on purpose (QE nit, acceptance pins the prefix): busy, so try again shortly.
  [ERROR_KIND.RATE_LIMITED]: "FurniAI couldn't get this file right now because the service is busy. Try again in a moment.",
  [ERROR_KIND.PROVIDER_REFUSED]: "FurniAI couldn't get this file: the 3D generation service refused the request. Try again later.",
  [ERROR_KIND.PROVIDER_UNAVAILABLE]: "FurniAI couldn't get this file because the 3D generation service isn't responding. Try again in a moment.",
  [ERROR_KIND.REQUEST]: "FurniAI couldn't get this file.",
});

/**
 * Open only: the viewer got the file but couldn't show it (ASSET_DISPLAY_FAILED and other
 * viewer-side codes). Download is a real alternative here, unlike a server or network failure.
 */
export const DISPLAY_FAILED_MESSAGE = "The 3D view couldn't show this file. Downloading it may still work.";

/** Job-level failures seen while polling one job, or returned by Open/Download for the record. */
export const JOB_MESSAGES = Object.freeze({
  [ERROR_KIND.INTEGRITY]: "This concept's record failed an integrity check. It is not used and is no longer updated.",
  [ERROR_KIND.NOT_FOUND]: "This concept no longer exists.",
  [ERROR_KIND.FORBIDDEN]: "This account doesn't have permission to open this concept.",
});

/**
 * Rev 2 §2.3 `409 PRIOR_SUBMISSION_UNKNOWN` (POST only). The gallery never submits;
 * this is the wording a host's Generate flow should reuse. It never says "no charge".
 */
/** On a submission_unknown card: what happens if the person generates again from the same reference. */
export const PRIOR_SUBMISSION_UNKNOWN_CARD_NOTE =
  "Generating again from this reference will ask you to confirm first, because this attempt may have been charged.";

export const PRIOR_SUBMISSION_UNKNOWN_MESSAGE =
  "The last 3D concept requested from this reference never got an answer from the generation service. It may have run and may have been charged. Generating again could be charged a second time, so only continue if you mean to.";

/**
 * Billing wording per rev 2 `usage.billingOutcome`. Never "free" / "no charge":
 * FurniAI only knows whether it sent the paid request and any cost the service reported.
 */
export const BILLING_TEXT = Object.freeze({
  not_submitted: "Not sent yet: FurniAI hasn't sent the paid generation request for this concept.",
  unconfirmed: "Not confirmed: the request was or may have been sent and no cost has been reported. It may have been charged.",
  unconfirmedPending: "Not confirmed yet: the request was sent and no cost has been reported so far.",
  reported: (cost, unit) => `Cost reported by the generation service: ${cost} ${unit === "provider_cost_units" || !unit ? "provider units (unit unverified)" : unit}.`,
  reportedNoCost: "Reported, but the amount wasn't included.",
  missing: "Not reported by this server.",
});

/**
 * Our own sentence for known rev 2 failure codes. The server's message for these
 * mixes in billing claims we render separately, so it isn't shown. Unknown codes and
 * PROVIDER_GENERATION_FAILED (the provider's own reason) fall back to the sanitised message.
 */
export const FAILED_MESSAGES = Object.freeze({
  [CODE.PROVIDER_REJECTED_REQUEST]: "The generation service refused this request.",
  [CODE.PROVIDER_RATE_LIMITED]: "The generation service was busy and refused this request.",
  [CODE.PROVIDER_INSUFFICIENT_CREDITS]: "The generation service reported that FurniAI's account doesn't have enough credits.",
  [CODE.PROVIDER_AUTH_REJECTED]: "The generation service didn't accept FurniAI's credentials.",
});

/** Error thrown by resolveUrl() so a viewer can switch on `.code` too. */
export class ConceptAssetError extends Error {
  constructor(classified, cause) {
    super(ASSET_MESSAGES[classified.kind] || ASSET_MESSAGES[ERROR_KIND.REQUEST]);
    this.name = "ConceptAssetError";
    this.kind = classified.kind;
    this.code = classified.code;
    this.status = classified.status;
    if (cause !== undefined) this.cause = cause;
  }
}
