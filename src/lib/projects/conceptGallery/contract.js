/**
 * Constants from docs/creative/SCENARIO_3D_API_CONTRACT.md (status: PROPOSED),
 * checked against Claude's backend at 7f42f956 (src/lib/creative/*).
 *
 * The gallery only reads what that contract returns. It has no prompt field,
 * no reference image URL, no thumbnail, no dimensions and no designId, so the
 * gallery shows none of them.
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
/** Error backoff ceiling (the gallery's choice; the contract only says to keep polling). */
export const MAX_BACKOFF_MS = 30000;

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
