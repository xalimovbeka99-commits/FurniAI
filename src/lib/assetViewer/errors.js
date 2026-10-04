/**
 * Asset viewer error contract. Every failure the viewer reports carries one
 * of these codes plus a human message safe to show a customer. `detail` is
 * for logs/devtools only (never rendered).
 */
export const ERROR_CODE = Object.freeze({
  INVALID_ASSET: "INVALID_ASSET",
  UNSUPPORTED_FORMAT: "UNSUPPORTED_FORMAT",
  FETCH_FAILED: "FETCH_FAILED",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  PARSE_FAILED: "PARSE_FAILED",
  EMPTY_SCENE: "EMPTY_SCENE",
  WEBGL_UNAVAILABLE: "WEBGL_UNAVAILABLE",
  MISSING_DEPENDENCY: "MISSING_DEPENDENCY",
  VIEWER_DISPOSED: "VIEWER_DISPOSED",
  // ---- /api/creative (AI visual concept) contract, see creativeAsset.js ----
  SIGN_IN_REQUIRED: "SIGN_IN_REQUIRED",
  SIGN_IN_UNAVAILABLE: "SIGN_IN_UNAVAILABLE",
  CONCEPTS_NOT_CONFIGURED: "CONCEPTS_NOT_CONFIGURED",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  CONCEPT_NOT_FOUND: "CONCEPT_NOT_FOUND",
  ASSET_NOT_READY: "ASSET_NOT_READY",
  ASSET_UNAVAILABLE: "ASSET_UNAVAILABLE",
  RECORD_INTEGRITY_FAILED: "RECORD_INTEGRITY_FAILED",
  RESOLVE_FAILED: "RESOLVE_FAILED",
  ASSET_DISPLAY_FAILED: "ASSET_DISPLAY_FAILED",
  GENERATION_FAILED: "GENERATION_FAILED",
  SUBMISSION_UNKNOWN: "SUBMISSION_UNKNOWN",
  JOB_STATUS_UNKNOWN: "JOB_STATUS_UNKNOWN",
});

export const ERROR_MESSAGE = Object.freeze({
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
  CONCEPTS_NOT_CONFIGURED: "3D concepts aren't available on this site yet.",
  SERVICE_UNAVAILABLE: "The 3D concept service is temporarily unavailable. Please try again later.",
  PROVIDER_UNAVAILABLE: "The 3D generation service couldn't be reached. Please try again later.",
  CONCEPT_NOT_FOUND: "This 3D concept couldn't be found. It may belong to another account or have been removed.",
  ASSET_NOT_READY: "This 3D concept isn't ready yet.",
  ASSET_UNAVAILABLE: "This 3D concept is no longer available. The generation service no longer has the file and no copy was kept.",
  RECORD_INTEGRITY_FAILED: "This 3D concept can't be opened because its record failed a safety check.",
  RESOLVE_FAILED: "The 3D concept couldn't be opened. Please try again.",
  ASSET_DISPLAY_FAILED: "This 3D concept couldn't be displayed here. Downloading it may still work.",
  GENERATION_FAILED: "The 3D concept couldn't be generated.",
  SUBMISSION_UNKNOWN:
    "The request was sent but no answer came back, so it isn't known whether a 3D concept was started. It may have been charged. It will not be retried automatically.",
  JOB_STATUS_UNKNOWN: "The status of this 3D concept couldn't be understood.",
});

/** Extra serialisable fields an AssetViewerError may carry into its record. */
const RECORD_EXTRAS = ["status", "serverCode", "jobStatus", "downloadAvailable", "chargeMayHaveOccurred", "autoRetry", "attempts"];

export class AssetViewerError extends Error {
  /**
   * @param {keyof typeof ERROR_CODE} code
   * @param {string} [detail] developer-facing detail (not shown to customers)
   * @param {object} [extra] e.g. { status } for FETCH_FAILED, { serverCode } for
   *   /api/creative errors, { message } to replace the default customer message
   *   with a vetted one (used for a failed job's own error message).
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

/** Plain, serialisable error record as exposed in viewer state / onError. */
export function toErrorRecord(err) {
  if (err instanceof AssetViewerError) {
    const rec = { code: err.code, message: err.message, detail: err.detail };
    for (const k of RECORD_EXTRAS) if (err[k] !== undefined) rec[k] = err[k];
    return rec;
  }
  return {
    code: ERROR_CODE.PARSE_FAILED,
    message: ERROR_MESSAGE.PARSE_FAILED,
    detail: err && err.message ? String(err.message) : String(err),
  };
}
