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
});

export class AssetViewerError extends Error {
  /**
   * @param {keyof typeof ERROR_CODE} code
   * @param {string} [detail] developer-facing detail (not shown to customers)
   * @param {object} [extra] e.g. { status } for FETCH_FAILED
   */
  constructor(code, detail, extra = {}) {
    super(ERROR_MESSAGE[code] || "Unknown viewer error.");
    this.name = "AssetViewerError";
    this.code = ERROR_CODE[code] ? code : "PARSE_FAILED";
    this.detail = detail || null;
    Object.assign(this, extra);
  }
}

/** Plain, serialisable error record as exposed in viewer state / onError. */
export function toErrorRecord(err) {
  if (err instanceof AssetViewerError) {
    const rec = { code: err.code, message: err.message, detail: err.detail };
    if (err.status !== undefined) rec.status = err.status;
    return rec;
  }
  return {
    code: ERROR_CODE.PARSE_FAILED,
    message: ERROR_MESSAGE.PARSE_FAILED,
    detail: err && err.message ? String(err.message) : String(err),
  };
}
