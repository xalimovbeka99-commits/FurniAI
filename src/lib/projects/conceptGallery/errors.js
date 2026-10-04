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
  REQUEST: "request",
});

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
 * (src/lib/assetViewer/errors.js at 42c3fa6). When the error carries the
 * server's `serverCode`, that wins; these cover the cases without one.
 */
const VIEWER_CODE_KIND = Object.freeze({
  SIGN_IN_REQUIRED: "signed_out",
  SIGN_IN_UNAVAILABLE: "server",
  CONCEPTS_NOT_CONFIGURED: "not_configured",
  SERVICE_UNAVAILABLE: "server",
  PROVIDER_UNAVAILABLE: "server",
  CONCEPT_NOT_FOUND: "not_found",
  ASSET_NOT_READY: "asset_not_ready",
  ASSET_UNAVAILABLE: "asset_unavailable",
  RECORD_INTEGRITY_FAILED: "integrity",
});

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
  if (code === CODE.ASSET_NOT_READY) return { kind: ERROR_KIND.ASSET_NOT_READY, code, status };
  if (code === CODE.ASSET_UNAVAILABLE) return { kind: ERROR_KIND.ASSET_UNAVAILABLE, code, status };
  if (code === CODE.MISSING_JOB) return { kind: ERROR_KIND.NOT_FOUND, code, status };
  if (code && NOT_CONFIGURED.has(code)) return { kind: ERROR_KIND.NOT_CONFIGURED, code, status };
  if (status === null && (code === null || code === CODE.NETWORK)) {
    return { kind: ERROR_KIND.NETWORK, code: CODE.NETWORK, status: null };
  }
  if (status !== null && status >= 500) return { kind: ERROR_KIND.SERVER, code: code || CODE.INTERNAL, status };
  return { kind: ERROR_KIND.REQUEST, code: code || `HTTP_${status ?? "ERROR"}`, status };
}

/** Transient failures worth one more asset-address call (contract §2.5 "call it again once"). */
export function isRetryableAssetError(classified) {
  return classified.kind === ERROR_KIND.NETWORK || classified.kind === ERROR_KIND.SERVER || classified.status === 429;
}

/** Customer-facing text per kind for the list. Static strings only. */
export const LIST_MESSAGES = Object.freeze({
  [ERROR_KIND.SIGNED_OUT]: "Sign in to see your 3D concepts.",
  [ERROR_KIND.NETWORK]: "We couldn't reach FurniAI. Check your connection and try again.",
  [ERROR_KIND.SERVER]: "FurniAI couldn't load your 3D concepts right now. Try again in a moment.",
  [ERROR_KIND.NOT_CONFIGURED]: "3D concepts aren't available on this deployment yet.",
  [ERROR_KIND.INTEGRITY]: "Your concept list failed an integrity check, so it isn't shown.",
  [ERROR_KIND.NOT_FOUND]: "Your concept list couldn't be found.",
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
