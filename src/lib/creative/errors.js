/**
 * Error codes for creative (visual-concept) generation.
 * Never include credentials or Authorization material in messages.
 */
export const CREATIVE_ERROR = Object.freeze({
  BAD_REQUEST: "BAD_REQUEST",
  UNSUPPORTED_FILE_TYPE: "UNSUPPORTED_FILE_TYPE",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  /** Right type, but truncated, corrupt or outside the accepted dimensions. */
  INVALID_IMAGE: "INVALID_IMAGE",
  MISSING_REFERENCE: "MISSING_REFERENCE",
  MISSING_JOB: "MISSING_JOB",
  /** Same user, same reference and model, and a job is still running. No provider call was made. */
  DUPLICATE_ACTIVE_JOB: "DUPLICATE_ACTIVE_JOB",
  /** The idempotency key was already used with a different request. */
  IDEMPOTENCY_KEY_REUSED: "IDEMPOTENCY_KEY_REUSED",
  /**
   * The last generation for this reference ended `submission_unknown`: it may
   * have run and been charged. A new one needs `acknowledgeUnknownCharge: true`.
   */
  PRIOR_SUBMISSION_UNKNOWN: "PRIOR_SUBMISSION_UNKNOWN",
  /** Credentials, model id or input mapping absent on this deployment. */
  CREATIVE_NOT_CONFIGURED: "CREATIVE_NOT_CONFIGURED",
  /** Paid generation is switched off (SCENARIO_LIVE_GENERATION_ENABLED != "yes"). */
  CREATIVE_GENERATION_DISABLED: "CREATIVE_GENERATION_DISABLED",
  /** No durable job store on a deployed environment. */
  CREATIVE_STORE_NOT_CONFIGURED: "CREATIVE_STORE_NOT_CONFIGURED",
  /** The provider's cost preview could not be read, so nothing was submitted. */
  COST_UNVERIFIED: "COST_UNVERIFIED",
  /** The cost preview exceeds the configured per-job cap. Nothing was submitted. */
  COST_CAP_EXCEEDED: "COST_CAP_EXCEEDED",
  PROVIDER_AUTH_REJECTED: "PROVIDER_AUTH_REJECTED",
  PROVIDER_INSUFFICIENT_CREDITS: "PROVIDER_INSUFFICIENT_CREDITS",
  PROVIDER_RATE_LIMITED: "PROVIDER_RATE_LIMITED",
  PROVIDER_REJECTED_REQUEST: "PROVIDER_REJECTED_REQUEST",
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  /** The provider answered in a shape this code does not recognise. Fail closed. */
  PROVIDER_UNEXPECTED_RESPONSE: "PROVIDER_UNEXPECTED_RESPONSE",
  /** The job has not produced an asset (not finished, or failed). */
  ASSET_NOT_READY: "ASSET_NOT_READY",
  /** The provider no longer serves the asset; there is no durable copy. */
  ASSET_UNAVAILABLE: "ASSET_UNAVAILABLE",
  STORAGE_UNAVAILABLE: "STORAGE_UNAVAILABLE",
  /** A stored record does not verify against this server's signature. Never acted on; blocks new generations for its reference. */
  RECORD_INTEGRITY_FAILED: "RECORD_INTEGRITY_FAILED",
});

const STATUS = {
  BAD_REQUEST: 400,
  UNSUPPORTED_FILE_TYPE: 415,
  FILE_TOO_LARGE: 413,
  INVALID_IMAGE: 422,
  MISSING_REFERENCE: 404,
  MISSING_JOB: 404,
  DUPLICATE_ACTIVE_JOB: 409,
  IDEMPOTENCY_KEY_REUSED: 409,
  PRIOR_SUBMISSION_UNKNOWN: 409,
  CREATIVE_NOT_CONFIGURED: 503,
  CREATIVE_GENERATION_DISABLED: 503,
  CREATIVE_STORE_NOT_CONFIGURED: 503,
  COST_UNVERIFIED: 502,
  COST_CAP_EXCEEDED: 402,
  PROVIDER_AUTH_REJECTED: 502,
  PROVIDER_INSUFFICIENT_CREDITS: 402,
  PROVIDER_RATE_LIMITED: 429,
  PROVIDER_REJECTED_REQUEST: 502,
  PROVIDER_UNAVAILABLE: 502,
  PROVIDER_UNEXPECTED_RESPONSE: 502,
  ASSET_NOT_READY: 409,
  ASSET_UNAVAILABLE: 410,
  STORAGE_UNAVAILABLE: 503,
  RECORD_INTEGRITY_FAILED: 409,
};

export class CreativeError extends Error {
  /**
   * @param {string} code
   * @param {string} message customer-safe
   * @param {{ status?: number, details?: object, outcomeUnknown?: boolean }} [opts]
   *   `outcomeUnknown` — a billable request may have reached the provider and
   *   its answer was lost; whether a generation started is not known.
   */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "CreativeError";
    this.code = code;
    this.status = opts.status ?? STATUS[code] ?? 400;
    this.details = opts.details;
    this.outcomeUnknown = opts.outcomeUnknown === true;
  }
}

export function toCreativeErrorBody(err) {
  if (err instanceof CreativeError) {
    return { ok: false, code: err.code, error: err.message, ...(err.details ? { details: err.details } : {}) };
  }
  return { ok: false, code: "INTERNAL", error: "Could not complete the request." };
}
