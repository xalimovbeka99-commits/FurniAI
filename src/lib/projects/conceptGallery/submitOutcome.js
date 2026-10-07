/**
 * Wording for the answers to POST /api/creative?resource=jobs (contract rev 2 §2.3, §4), for a
 * host's Generate flow. The gallery itself never submits and never retries a submission; this is
 * the one place that says, truthfully, what a submit answer means for billing:
 *
 * - "No request sent" answers (budget cap, cost unverified, disabled, duplicate, prior unknown…):
 *   billing "not_submitted" — FurniAI did not send the paid request for THIS attempt.
 * - Provider refusals (429, 402 credits, auth, rejected): the paid request WAS sent and refused;
 *   billing "unconfirmed" (never "no charge": Scenario's policy for refusals is unverified).
 * - PROVIDER_UNAVAILABLE / PROVIDER_UNEXPECTED_RESPONSE: sent, answer lost; "may have been charged".
 * - A network failure or an unexpected 5xx on the POST: FurniAI can't tell whether it sent the
 *   paid request; billing "unknown". Only the same idempotency key may be resent (a replay is free
 *   of a second provider call by contract), and only when the person asks.
 *
 * Every retry is user-initiated (`retry: "user"`); `"none"` means don't offer one at all.
 */
import { ACKNOWLEDGE_UNKNOWN_CHARGE_FIELD, CODE } from "./contract.js";
import { BILLING_TEXT, PRIOR_SUBMISSION_UNKNOWN_MESSAGE } from "./errors.js";

export const SUBMIT_BILLING_TEXT = Object.freeze({
  not_submitted: "No paid request was sent for this attempt.",
  unconfirmed_refused: "The paid request was sent and refused. Whether the generation service charged for it isn't confirmed.",
  unconfirmed_lost: "The paid request was sent and no answer came back. It may have been charged.",
  unknown: "It isn't known whether the paid request was sent. It may have been charged.",
});

const unitText = (unit) => (unit === "provider_cost_units" || !unit ? "provider units, unit unverified" : unit);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Rev 2 "No request sent" refusals: our own sentence (the server's is not shown verbatim). */
const NOT_SENT = Object.freeze({
  [CODE.COST_CAP_EXCEEDED]: (d) => {
    const est = num(d.estimatedCost);
    const cap = num(d.maxCostPerJob);
    const nums = est !== null && cap !== null ? ` (estimate ${est}, limit ${cap}, both in ${unitText(null)})` : "";
    return `This concept would cost more than the per-concept budget set for FurniAI${nums}, so it wasn't generated.`;
  },
  [CODE.COST_UNVERIFIED]: () => "FurniAI couldn't confirm what this concept would cost, so it didn't send the generation request.",
  [CODE.CREATIVE_GENERATION_DISABLED]: () => "Generating 3D concepts is switched off on this deployment.",
  [CODE.CREATIVE_NOT_CONFIGURED]: () => "Generating 3D concepts isn't set up on this deployment.",
  [CODE.CREATIVE_STORE_NOT_CONFIGURED]: () => "Generating 3D concepts isn't set up on this deployment.",
  [CODE.PERSISTENCE_NOT_CONFIGURED]: () => "Generating 3D concepts isn't set up on this deployment.",
  [CODE.DUPLICATE_ACTIVE_JOB]: () => "A concept from this reference is still generating. Wait for it to finish.",
  [CODE.IDEMPOTENCY_KEY_REUSED]: () => "This request was already used for a different reference image. Start a new Generate.",
  [CODE.MISSING_REFERENCE]: () => "That reference image isn't available any more. Upload it again.",
  [CODE.RECORD_INTEGRITY_FAILED]: () => "A stored record for this reference failed an integrity check, so nothing can be generated from it until support looks at it.",
  [CODE.BAD_REQUEST]: () => "The generate request was incomplete.",
});

const REFUSED = Object.freeze({
  [CODE.PROVIDER_RATE_LIMITED]: "The 3D generation service is busy and refused this request. Wait before trying again: another attempt is a new paid request.",
  [CODE.PROVIDER_INSUFFICIENT_CREDITS]: "The 3D generation service reported that FurniAI's account doesn't have enough credits.",
  [CODE.PROVIDER_AUTH_REJECTED]: "The 3D generation service didn't accept FurniAI's credentials.",
  [CODE.PROVIDER_REJECTED_REQUEST]: "The 3D generation service refused this request.",
});

const LOST = new Set([CODE.PROVIDER_UNAVAILABLE, CODE.PROVIDER_UNEXPECTED_RESPONSE]);

/**
 * @param {number|null} status   HTTP status, or null for a network failure
 * @param {object|null} body     parsed JSON body (or null)
 * @returns {{ outcome: string, code: string|null, message: string, billingOutcome: string,
 *             billingText: string, needsAcknowledgement: boolean, acknowledgeField: string|null,
 *             jobId: string|null, retry: "user"|"none", resendSameKeyOnly: boolean }}
 */
export function describeSubmitResponse(status, body) {
  const b = body && typeof body === "object" ? body : {};
  const d = b.details && typeof b.details === "object" ? b.details : {};
  const code = typeof b.code === "string" && b.code ? b.code : null;
  const jobId = typeof d.jobId === "string" ? d.jobId : b.job && typeof b.job.jobId === "string" ? b.job.jobId : null;
  const base = { code, jobId, needsAcknowledgement: false, acknowledgeField: null, resendSameKeyOnly: false };

  if ((status === 202 || status === 200) && b.ok === true && b.job) {
    const outcome = b.job.usage && typeof b.job.usage.billingOutcome === "string" ? b.job.usage.billingOutcome : null;
    const cost = num(b.job.usage && b.job.usage.reportedCost);
    const billingText =
      outcome === "not_submitted" ? BILLING_TEXT.not_submitted
        : outcome === "reported" ? (cost === null ? BILLING_TEXT.reportedNoCost : BILLING_TEXT.reported(cost, b.job.usage.unit))
          : outcome === "unconfirmed" ? BILLING_TEXT.unconfirmedPending
            : BILLING_TEXT.missing;
    return {
      ...base,
      outcome: b.replayed ? "replayed" : "submitted",
      message: b.replayed ? "This Generate was already sent. Showing the existing concept; nothing new was requested." : "Sent to the 3D generation service.",
      billingOutcome: outcome || "unknown",
      billingText,
      retry: "none",
    };
  }
  if (code === CODE.PRIOR_SUBMISSION_UNKNOWN) {
    return {
      ...base,
      outcome: "needs_acknowledgement",
      message: PRIOR_SUBMISSION_UNKNOWN_MESSAGE,
      billingOutcome: "not_submitted",
      billingText: SUBMIT_BILLING_TEXT.not_submitted,
      needsAcknowledgement: true,
      acknowledgeField: ACKNOWLEDGE_UNKNOWN_CHARGE_FIELD,
      retry: "user", // only as a deliberate "Generate anyway", resent with acknowledgeUnknownCharge: true
    };
  }
  if (status === 401 || code === CODE.MISSING_AUTH) {
    return { ...base, outcome: "signed_out", message: "Sign in to generate 3D concepts.", billingOutcome: "not_submitted", billingText: SUBMIT_BILLING_TEXT.not_submitted, retry: "none" };
  }
  if (code && NOT_SENT[code]) {
    const budget = code === CODE.COST_CAP_EXCEEDED;
    const unavailable = status === 503;
    return {
      ...base,
      outcome: budget ? "budget" : unavailable ? "unavailable" : "refused_not_sent",
      message: NOT_SENT[code](d),
      billingOutcome: "not_submitted",
      billingText: SUBMIT_BILLING_TEXT.not_submitted,
      retry: code === CODE.COST_UNVERIFIED ? "user" : "none",
    };
  }
  if (code && REFUSED[code]) {
    return {
      ...base,
      outcome: code === CODE.PROVIDER_RATE_LIMITED ? "rate_limited" : "provider_refused",
      message: REFUSED[code],
      billingOutcome: "unconfirmed",
      billingText: SUBMIT_BILLING_TEXT.unconfirmed_refused,
      retry: code === CODE.PROVIDER_RATE_LIMITED ? "user" : "none",
    };
  }
  if (code && LOST.has(code)) {
    return {
      ...base,
      outcome: "provider_unavailable",
      message: "The 3D generation service didn't answer. The request may have started a generation, and it isn't retried automatically.",
      billingOutcome: "unconfirmed",
      billingText: SUBMIT_BILLING_TEXT.unconfirmed_lost,
      retry: "none", // a second purchase needs acknowledgeUnknownCharge after this (PRIOR_SUBMISSION_UNKNOWN)
    };
  }
  if (status === 429) {
    return { ...base, outcome: "rate_limited", message: "FurniAI is busy. Wait a moment before trying again.", billingOutcome: "unknown", billingText: SUBMIT_BILLING_TEXT.unknown, retry: "user", resendSameKeyOnly: true };
  }
  // Network failure, or a status this code doesn't know: whether FurniAI sent the paid request is unknown.
  const fromServer = typeof d.billingOutcome === "string" ? d.billingOutcome : null;
  return {
    ...base,
    outcome: status === null ? "network" : "unknown",
    message: status === null ? "FurniAI couldn't be reached, so it isn't known whether this Generate went through." : "FurniAI couldn't complete this Generate, and it isn't known whether it went through.",
    billingOutcome: fromServer === "not_submitted" ? "not_submitted" : "unknown",
    billingText: fromServer === "not_submitted" ? SUBMIT_BILLING_TEXT.not_submitted : SUBMIT_BILLING_TEXT.unknown,
    retry: "user",
    resendSameKeyOnly: true, // resend with the SAME idempotencyKey: a replay never makes a second provider call
  };
}
