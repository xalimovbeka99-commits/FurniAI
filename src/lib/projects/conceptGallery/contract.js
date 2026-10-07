/**
 * Constants from docs/creative/SCENARIO_3D_API_CONTRACT.md, **revision 2**
 * (status: PROPOSED), as merged into integ/scenario-candidate at f472aef
 * (Claude's 3946b53). Rev 2 adds usage.billingOutcome, storage.durableCopy,
 * PRIOR_SUBMISSION_UNKNOWN / acknowledgeUnknownCharge, 422 INVALID_IMAGE and the
 * provider error codes below. A rev 1 server simply has no billingOutcome.
 *
 * The gallery only reads what that contract returns. It has no prompt field,
 * no reference image URL, no thumbnail, no dimensions and no designId, so the
 * gallery shows none of them (a host may inject a reference thumbnail resolver).
 */

/** `status` values. FurniAI owns these; they are the only ones. */
export const JOB_STATUS = Object.freeze({
  SUBMITTING: "submitting",
  PROCESSING: "processing",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  SUBMISSION_UNKNOWN: "submission_unknown",
});

const NON_TERMINAL = new Set([JOB_STATUS.SUBMITTING, JOB_STATUS.PROCESSING]);
const KNOWN = new Set(Object.values(JOB_STATUS));

/** True while the job can still change, which is when it gets polled. */
export const isNonTerminal = (status) => NON_TERMINAL.has(status);
export const isKnownStatus = (status) => KNOWN.has(status);

/** Contract §2.4: load only glb/gltf in a viewer; every other format (or null) is download-only. */
export const VIEWABLE_FORMATS = Object.freeze(["glb", "gltf"]);
export const isViewableFormat = (format) => typeof format === "string" && VIEWABLE_FORMATS.includes(format.toLowerCase());

/** Contract §2.4 polling window. */
export const MIN_POLL_MS = 3000;
export const MAX_POLL_MS = 5000;
/**
 * Polling is status checking, not a retry: it stays inside the 3–5 s window even after a
 * failed round, and pauses (with a visible "Check status again") after this many failed
 * rounds in a row, or at once on 429. Nothing restarts it except the user or a reload.
 */
export const POLL_FAILURES_BEFORE_PAUSE = 3;
/** §2.4: the list returns at most this many jobs, newest first. No pagination exists. */
export const LIST_LIMIT = 50;
/** §2.3 request field that makes a second purchase after PRIOR_SUBMISSION_UNKNOWN deliberate. */
export const ACKNOWLEDGE_UNKNOWN_CHARGE_FIELD = "acknowledgeUnknownCharge";

/**
 * The server sends `concept.notice` on every job and asset. It is shown
 * verbatim. This copy (identical to CONCEPT_NOTICE.notice at 7f42f956) is
 * used only if a response arrives without one.
 */
export const FALLBACK_CONCEPT_NOTICE =
  "AI-generated visual concept. Not a FurniAI design: it has no verified measurements, no separately editable doors or panels, and cannot be manufactured from.";

/** Contract §2.4 and §3: the exact warning for `submission_unknown`. */
export const SUBMISSION_UNKNOWN_WARNING =
  "We sent this request to the generation service but never got an answer. It may have been charged. It has not been retried, and FurniAI will not retry it automatically.";

/**
 * Contract rev 2 §2.4 / §4: `usage.billingOutcome`. FurniAI knows whether it sent
 * the paid request; it does not know what was charged unless a cost is reported.
 * `unconfirmed` is NOT "free" and is never rendered as "no charge".
 */
export const BILLING_OUTCOME = Object.freeze({
  NOT_SUBMITTED: "not_submitted",
  UNCONFIRMED: "unconfirmed",
  REPORTED: "reported",
});
const BILLING_OUTCOMES = new Set(Object.values(BILLING_OUTCOME));
export const isBillingOutcome = (v) => BILLING_OUTCOMES.has(v);

/** Error `code`s the gallery switches on. Codes, never message text. */
export const CODE = Object.freeze({
  MISSING_AUTH: "MISSING_AUTH",
  AUTH_UNAVAILABLE: "AUTH_UNAVAILABLE",
  PERSISTENCE_NOT_CONFIGURED: "PERSISTENCE_NOT_CONFIGURED",
  CREATIVE_NOT_CONFIGURED: "CREATIVE_NOT_CONFIGURED",
  CREATIVE_STORE_NOT_CONFIGURED: "CREATIVE_STORE_NOT_CONFIGURED",
  MISSING_JOB: "MISSING_JOB",
  BAD_REQUEST: "BAD_REQUEST",
  ASSET_NOT_READY: "ASSET_NOT_READY",
  ASSET_UNAVAILABLE: "ASSET_UNAVAILABLE",
  RECORD_INTEGRITY_FAILED: "RECORD_INTEGRITY_FAILED",
  INTERNAL: "INTERNAL",
  /** Rev 2 §2.3 (POST only; the gallery never submits, but hosts can reuse the wording). */
  PRIOR_SUBMISSION_UNKNOWN: "PRIOR_SUBMISSION_UNKNOWN",
  /** Rev 2 §4 provider errors (job.error, and possibly an asset resolve). */
  PROVIDER_INSUFFICIENT_CREDITS: "PROVIDER_INSUFFICIENT_CREDITS",
  PROVIDER_AUTH_REJECTED: "PROVIDER_AUTH_REJECTED",
  PROVIDER_RATE_LIMITED: "PROVIDER_RATE_LIMITED",
  PROVIDER_REJECTED_REQUEST: "PROVIDER_REJECTED_REQUEST",
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  PROVIDER_UNEXPECTED_RESPONSE: "PROVIDER_UNEXPECTED_RESPONSE",
  PROVIDER_GENERATION_FAILED: "PROVIDER_GENERATION_FAILED",
  /** Rev 2 §2.3 submit refusals ("No request sent"). The gallery never submits; describeSubmitResponse() words them. */
  COST_CAP_EXCEEDED: "COST_CAP_EXCEEDED",
  COST_UNVERIFIED: "COST_UNVERIFIED",
  CREATIVE_GENERATION_DISABLED: "CREATIVE_GENERATION_DISABLED",
  DUPLICATE_ACTIVE_JOB: "DUPLICATE_ACTIVE_JOB",
  IDEMPOTENCY_KEY_REUSED: "IDEMPOTENCY_KEY_REUSED",
  MISSING_REFERENCE: "MISSING_REFERENCE",
  INVALID_IMAGE: "INVALID_IMAGE",
  /**
   * 403 is not in the contract (only 401 is auth). The persistence layer can answer
   * 403 UNAUTHORIZED (signed in, not allowed); v2.1's viewer maps it to FORBIDDEN.
   */
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  /** Client-side codes (never sent by the server). */
  NETWORK: "NETWORK",
  SIGNED_OUT: "SIGNED_OUT",
  INVALID_RESPONSE: "INVALID_RESPONSE",
});
