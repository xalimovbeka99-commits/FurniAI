/**
 * FSL / Furniture Generation API — stable error codes (Section 8).
 * ----------------------------------------------------------------------
 * FslError is the one exception type every layer (brain, validator,
 * adapter, AI provider) throws. The API route is the ONLY place that
 * catches it and turns it into an HTTP response — domain code never knows
 * about HTTP status codes.
 */

export const ERROR_CODES = Object.freeze({
  INVALID_REQUEST: "INVALID_REQUEST",
  EMPTY_MESSAGE: "EMPTY_MESSAGE",
  UNSUPPORTED_FURNITURE_TYPE: "UNSUPPORTED_FURNITURE_TYPE",
  INVALID_FSL: "INVALID_FSL",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  INVALID_DIMENSION: "INVALID_DIMENSION",
  INVALID_COMPONENT: "INVALID_COMPONENT",
  UNSUPPORTED_CONFIGURATOR_FEATURE: "UNSUPPORTED_CONFIGURATOR_FEATURE",
  AI_PROVIDER_ERROR: "AI_PROVIDER_ERROR",
  AI_PROVIDER_TIMEOUT: "AI_PROVIDER_TIMEOUT",
  AI_PROVIDER_UNAVAILABLE: "AI_PROVIDER_UNAVAILABLE",
  AI_PROVIDER_REQUEST_ERROR: "AI_PROVIDER_REQUEST_ERROR",
  STRUCTURED_OUTPUT_ERROR: "STRUCTURED_OUTPUT_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
});

/** Every code maps to exactly one HTTP status — the route trusts this table blindly. */
const HTTP_STATUS_BY_CODE = Object.freeze({
  [ERROR_CODES.INVALID_REQUEST]: 400,
  [ERROR_CODES.EMPTY_MESSAGE]: 400,
  [ERROR_CODES.MISSING_REQUIRED_FIELD]: 400,
  [ERROR_CODES.UNSUPPORTED_FURNITURE_TYPE]: 422,
  [ERROR_CODES.INVALID_FSL]: 422,
  [ERROR_CODES.INVALID_DIMENSION]: 422,
  [ERROR_CODES.INVALID_COMPONENT]: 422,
  [ERROR_CODES.UNSUPPORTED_CONFIGURATOR_FEATURE]: 200,
  [ERROR_CODES.AI_PROVIDER_ERROR]: 502,
  [ERROR_CODES.AI_PROVIDER_TIMEOUT]: 504,
  [ERROR_CODES.AI_PROVIDER_UNAVAILABLE]: 503,
  [ERROR_CODES.AI_PROVIDER_REQUEST_ERROR]: 500,
  [ERROR_CODES.STRUCTURED_OUTPUT_ERROR]: 502,
  [ERROR_CODES.INTERNAL_ERROR]: 500,
});

export class FslError extends Error {
  /**
   * @param {string} code one of ERROR_CODES
   * @param {string} message client-safe message — never a stack trace or raw provider payload
   * @param {{ field?: string, details?: object }} [opts]
   */
  constructor(code, message, { field = null, details = null } = {}) {
    super(message);
    this.name = "FslError";
    this.code = code in ERROR_CODES ? code : ERROR_CODES.INTERNAL_ERROR;
    this.field = field;
    this.details = details;
  }

  get httpStatus() {
    return HTTP_STATUS_BY_CODE[this.code] ?? 500;
  }

  /** Shape matching the API error contract (Section 8). */
  toJSON() {
    return {
      code: this.code,
      field: this.field,
      message: this.message,
      details: this.details,
    };
  }
}

export function httpStatusForCode(code) {
  return HTTP_STATUS_BY_CODE[code] ?? 500;
}
