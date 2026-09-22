/**
 * Fail-closed error codes for durable wardrobe design persistence.
 * Never include credentials or Authorization material in messages.
 */

export const PERSISTENCE_ERROR = Object.freeze({
  MISSING_AUTH: "MISSING_AUTH",
  UNAUTHORIZED: "UNAUTHORIZED",
  MISSING_DESIGN: "MISSING_DESIGN",
  STALE_REVISION: "STALE_REVISION",
  CONFLICT_REVISION: "CONFLICT_REVISION",
  FINGERPRINT_MISMATCH: "FINGERPRINT_MISMATCH",
  INVALID_FURNISPEC: "INVALID_FURNISPEC",
  INVALID_PARTGRAPH: "INVALID_PARTGRAPH",
  UNSUPPORTED_COMPONENT: "UNSUPPORTED_COMPONENT",
  BAD_REQUEST: "BAD_REQUEST",
  /**
   * The store itself failed or refused — unreachable, timed out, or answered
   * an error we did not ask for. Distinct from BAD_REQUEST, which blames the
   * caller: a 5xx carrying a 4xx-shaped code makes the class of failure
   * unreadable in logs and sends the UI down the wrong branch.
   */
  STORAGE_UNAVAILABLE: "STORAGE_UNAVAILABLE",
  /** A design id that already exists. NOT a revision conflict. */
  CONFLICT_DESIGN: "CONFLICT_DESIGN",
});

export class PersistenceError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {{ status?: number, details?: object }} [opts]
   */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "PersistenceError";
    this.code = code;
    this.status = opts.status ?? statusFor(code);
    this.details = opts.details ?? undefined;
  }
}

function statusFor(code) {
  switch (code) {
    case PERSISTENCE_ERROR.MISSING_AUTH:
      return 401;
    case PERSISTENCE_ERROR.UNAUTHORIZED:
      return 403;
    case PERSISTENCE_ERROR.MISSING_DESIGN:
      return 404;
    case PERSISTENCE_ERROR.STALE_REVISION:
    case PERSISTENCE_ERROR.CONFLICT_REVISION:
    case PERSISTENCE_ERROR.CONFLICT_DESIGN:
    case PERSISTENCE_ERROR.FINGERPRINT_MISMATCH:
      return 409;
    case PERSISTENCE_ERROR.STORAGE_UNAVAILABLE:
      return 503;
    case PERSISTENCE_ERROR.INVALID_FURNISPEC:
    case PERSISTENCE_ERROR.INVALID_PARTGRAPH:
    case PERSISTENCE_ERROR.UNSUPPORTED_COMPONENT:
    case PERSISTENCE_ERROR.BAD_REQUEST:
      return 400;
    default:
      return 400;
  }
}

export function toErrorBody(err) {
  if (err instanceof PersistenceError) {
    return {
      ok: false,
      code: err.code,
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    };
  }
  return {
    ok: false,
    code: "INTERNAL",
    error: "Could not complete the design persistence request.",
  };
}
