/**
 * Provider-neutral error taxonomy (Step 5 of the provider-failover mission).
 * ----------------------------------------------------------------------
 * ProviderError is thrown by individual provider adapters (Anthropic,
 * OpenAI) for problems that are about the PROVIDER, not about the request:
 * missing/invalid credentials, rate limits, quota, timeouts, transient
 * server errors, or the provider being unreachable. Every one of these
 * codes is retriable — providerRouter.js fails over to the next configured
 * provider when it sees one.
 *
 * Anything else (FslError business-logic codes, wardrobe kernel/tool
 * errors, JSON parsing failures in the route, deterministic validation
 * failures) is NOT a ProviderError and must never trigger failover — see
 * isRetriableProviderFailure below and providerRouter.js's callWithFailover.
 */
import { FslError, ERROR_CODES } from "../fsl/errors.js";

export const PROVIDER_ERROR_CODES = Object.freeze({
  MISSING_API_KEY: "MISSING_API_KEY",
  AUTH_ERROR: "AUTH_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  TIMEOUT: "TIMEOUT",
  SERVER_ERROR: "SERVER_ERROR",
  UNAVAILABLE: "UNAVAILABLE",
  UNKNOWN: "UNKNOWN",
});

// Every one of these is a "the provider itself could not serve this
// request" condition — safe to retry on a different provider. AUTH_ERROR
// (an actually-configured-but-rejected key) is included alongside the
// explicitly-listed MISSING_API_KEY: a revoked/expired/invalid key is the
// same class of provider-availability problem from FurniAI's perspective,
// even though the mission's example list only names the missing-key case.
const RETRIABLE_CODES = new Set([
  PROVIDER_ERROR_CODES.MISSING_API_KEY,
  PROVIDER_ERROR_CODES.AUTH_ERROR,
  PROVIDER_ERROR_CODES.RATE_LIMITED,
  PROVIDER_ERROR_CODES.QUOTA_EXCEEDED,
  PROVIDER_ERROR_CODES.TIMEOUT,
  PROVIDER_ERROR_CODES.SERVER_ERROR,
  PROVIDER_ERROR_CODES.UNAVAILABLE,
]);

export class ProviderError extends Error {
  /**
   * @param {string} code one of PROVIDER_ERROR_CODES
   * @param {string} message client-safe message — never a raw SDK error, header, or key
   * @param {{ provider?: string|null, cause?: Error|null }} [opts]
   */
  constructor(code, message, { provider = null, cause = null } = {}) {
    super(message);
    this.name = "ProviderError";
    this.code = code in PROVIDER_ERROR_CODES ? code : PROVIDER_ERROR_CODES.UNKNOWN;
    this.provider = provider;
    // Non-enumerable and non-JSON-serializable on purpose: `cause` may hold
    // the raw SDK error (which can embed request headers, payloads, or
    // partial secrets in its own .message). Kept for a debugger to inspect
    // by name, but excluded from JSON.stringify/spread/for-in and from
    // Node's default console.error printing of this error object — see
    // redactErrorForLogging below, which is what call sites must use
    // instead of logging this object directly.
    Object.defineProperty(this, "cause", { value: cause, enumerable: false, writable: true, configurable: true });
  }

  get retriable() {
    return RETRIABLE_CODES.has(this.code);
  }

  toJSON() {
    return { name: this.name, code: this.code, message: this.message, provider: this.provider };
  }
}

/** Thrown by providerRouter.js when every configured provider was tried (or
 * none is configured at all) and none could serve the request. Distinct
 * from ProviderError so call sites can tell "one provider hiccuped" apart
 * from "there is no working AI provider right now" without inspecting a
 * list. */
export class AllProvidersUnavailableError extends Error {
  constructor(message = "No AI provider is currently available.", { attempted = [] } = {}) {
    super(message);
    this.name = "AllProvidersUnavailableError";
    this.code = "AI_PROVIDER_UNAVAILABLE";
    this.attempted = attempted;
  }
}

/**
 * Classifies a raw SDK error (Anthropic or OpenAI — both SDKs attach a
 * numeric `status`/`response.status` and follow the same fetch-based
 * AbortError convention for timeouts) into a ProviderError. Never rethrows
 * or logs the raw error — callers get a stable, secret-free message.
 */
export function classifySdkError(err, providerName) {
  if (err?.name === "AbortError") {
    return new ProviderError(PROVIDER_ERROR_CODES.TIMEOUT, "The AI provider did not respond in time.", { provider: providerName, cause: err });
  }
  const status = err?.status ?? err?.response?.status ?? null;
  if (status === 401 || status === 403) {
    return new ProviderError(PROVIDER_ERROR_CODES.AUTH_ERROR, "The AI provider rejected the request credentials.", { provider: providerName, cause: err });
  }
  if (status === 429) {
    return new ProviderError(PROVIDER_ERROR_CODES.RATE_LIMITED, "The AI provider is rate-limiting requests.", { provider: providerName, cause: err });
  }
  if (typeof status === "number" && status >= 500) {
    return new ProviderError(PROVIDER_ERROR_CODES.SERVER_ERROR, "The AI provider had a server-side error.", { provider: providerName, cause: err });
  }
  if (err?.name === "APIConnectionError" || ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EAI_AGAIN"].includes(err?.code)) {
    return new ProviderError(PROVIDER_ERROR_CODES.UNAVAILABLE, "The AI provider is unreachable.", { provider: providerName, cause: err });
  }
  return new ProviderError(PROVIDER_ERROR_CODES.UNKNOWN, "The AI provider request failed.", { provider: providerName, cause: err });
}

/**
 * Maps a raw SDK error to the FSL extraction contract's error codes
 * (Step 7: "the structured extraction contract must remain the same from
 * the FurniAI Brain's perspective"), preserving classifySdkError's
 * retriable/non-retriable distinction instead of collapsing every non-
 * timeout failure into the single retriable AI_PROVIDER_ERROR code.
 *
 * - TIMEOUT                              -> AI_PROVIDER_TIMEOUT (retriable)
 * - retriable (auth/rate-limit/5xx/net)  -> AI_PROVIDER_ERROR (retriable)
 * - anything else (4xx client error, a   -> AI_PROVIDER_REQUEST_ERROR
 *   malformed request WE built, or a         (NOT retriable — this is an
 *   genuinely unrecognized failure)          integration defect, not a
 *                                             "try the other provider" case)
 *
 * Fixing a bug found in review: both anthropicProvider.js and
 * openaiProvider.js previously threw AI_PROVIDER_ERROR for every non-abort
 * failure, which made a 400-class integration defect (bad request shape,
 * config mistake) silently fail over to the second provider instead of
 * surfacing as the real bug it is.
 */
export function toFslProviderError(err, providerName) {
  const classified = classifySdkError(err, providerName);
  if (classified.code === PROVIDER_ERROR_CODES.TIMEOUT) {
    return new FslError(ERROR_CODES.AI_PROVIDER_TIMEOUT, "The AI provider did not respond in time.");
  }
  if (classified.retriable) {
    return new FslError(ERROR_CODES.AI_PROVIDER_ERROR, "The AI provider request failed.");
  }
  return new FslError(ERROR_CODES.AI_PROVIDER_REQUEST_ERROR, "The AI provider rejected the request.");
}

/**
 * True for errors that should trigger provider failover: ProviderError
 * instances marked retriable, plus the FSL layer's own two provider-level
 * FslError codes (AI_PROVIDER_ERROR, AI_PROVIDER_TIMEOUT) so the router can
 * classify failures from anthropicProvider.js / openaiProvider.js — both of
 * which preserve the existing FslError contract for the FSL extraction
 * operation — without providerRouter.js importing fsl/errors.js directly.
 *
 * Deliberately false for STRUCTURED_OUTPUT_ERROR: a provider that responded
 * but never produced a valid tool call is a model/prompt-quality outcome,
 * not a provider-availability one, and the mission's explicit failover list
 * does not include it — retrying a second provider on every ambiguous user
 * message would double cost/latency for a case that often reproduces on
 * both providers anyway. Everything else (validation errors, kernel/tool
 * errors, malformed requests) is also false, by construction: those are
 * never ProviderError/FslError-provider-coded in the first place.
 *
 * Also recognizes two shapes that reach the chat router unclassified by
 * design (see anthropicChatClient.js): runWardrobeAgent.js's own
 * `AgentTimeoutError` (its internal AbortController timeout), and a raw
 * Anthropic/OpenAI SDK error that was never wrapped in a ProviderError —
 * classified on the spot via classifySdkError and treated as retriable
 * unless classification lands on UNKNOWN, where "fail over blindly" is a
 * worse default than "surface the real error."
 */
export function isRetriableProviderFailure(err) {
  if (err instanceof ProviderError) return err.retriable;
  if (err && err.name === "FslError") {
    return err.code === "AI_PROVIDER_ERROR" || err.code === "AI_PROVIDER_TIMEOUT";
  }
  if (err && err.name === "AgentTimeoutError") return true;
  if (err && (typeof err.status === "number" || typeof err?.response?.status === "number" || err.name === "APIConnectionError")) {
    return classifySdkError(err, null).retriable;
  }
  return false;
}

/** Generic, fixed message for anything not on the trusted allowlist below —
 * never derived from the error being redacted. */
const GENERIC_UNSAFE_MESSAGE = "An internal AI provider error occurred.";
const GENERIC_UNSAFE_CODE = "UNKNOWN_ERROR";

/**
 * Redacts an error down to `{name, code, message}` for logging. Required
 * because Node's console.error/util.inspect prints an Error's `.cause`
 * chain UNCONDITIONALLY — even when `cause` is a non-enumerable property
 * (verified: `Object.defineProperty(..., {enumerable:false})` does not
 * suppress it) — so `console.error("...", err)` on a raw ProviderError can
 * still leak whatever the wrapped SDK error's own `.message`/`.stack`
 * contains (headers, request bodies, partial keys). Every route's catch
 * block must log the RETURN VALUE of this function, never the error object
 * itself.
 *
 * `.message` is an ALLOWLIST, not a blocklist (fixing a second review
 * finding: the previous version trusted *every* error's `.message`,
 * including a raw/unrecognized SDK or transport error whose message text
 * is not guaranteed sanitized and could itself directly embed request
 * content like `Authorization: Bearer <token>` — no `.cause` needed for
 * that leak). `.message` is passed through only for the handful of error
 * classes this codebase constructs itself with a fixed, hand-written
 * string and never interpolates raw provider/SDK content into: ProviderError,
 * FslError, AllProvidersUnavailableError, and runWardrobeAgent.js's
 * AgentTimeoutError (checked by `.name` — it isn't exported, and every
 * throw site for it is a single hardcoded string in that one file).
 * Anything else — a plain Error, TypeError, raw Anthropic/OpenAI SDK error,
 * or any error class not on this list — is unknown input and gets a fixed
 * generic message instead. `.name` and `.code` are still passed through
 * (short symbolic identifiers, not free-form text) so logs stay
 * distinguishable; only the free-text `.message` is gated.
 */
export function redactErrorForLogging(err) {
  const isTrustedDomainError =
    err instanceof ProviderError || err instanceof FslError || err instanceof AllProvidersUnavailableError || err?.name === "AgentTimeoutError";

  if (isTrustedDomainError) {
    return { name: err.name, code: err.code ?? null, message: err.message };
  }
  return { name: err?.name ?? "Error", code: GENERIC_UNSAFE_CODE, message: GENERIC_UNSAFE_MESSAGE };
}

/**
 * A stable code string for observability logging (Step 9), covering the
 * same error shapes isRetriableProviderFailure recognizes — used so a raw,
 * unclassified SDK error (from anthropicChatClient.js's deliberate
 * passthrough) still shows a real code in providerRouter.js's attempt log
 * instead of `null`. Returns null only when nothing recognizable is found.
 */
export function errorCodeOf(err) {
  if (err instanceof ProviderError) return err.code;
  if (err && err.name === "FslError") return err.code;
  if (err && err.name === "AgentTimeoutError") return PROVIDER_ERROR_CODES.TIMEOUT;
  if (err && (typeof err.status === "number" || typeof err?.response?.status === "number" || err.name === "APIConnectionError")) {
    return classifySdkError(err, null).code;
  }
  return err?.code ?? null;
}
