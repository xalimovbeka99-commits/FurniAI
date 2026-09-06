/**
 * FurniAI — Human Approval Contract (Gate G4 / AI-Alpha R1)
 * ---------------------------------------------------------------------
 * The ONLY door between a PROPOSED FurniSpec and generated geometry.
 *
 * An approval is a structured record that must reference the exact proposal
 * it approves. It is never inferred, never defaulted, and never satisfied by
 * a truthy value. `null`, `{}`, a string, a boolean, a blank `approvedBy`, a
 * wrong spec ID, a wrong revision, a wrong fingerprint, or an approval issued
 * against an earlier proposal are all rejected with typed error codes.
 *
 * The fingerprint is ALWAYS recomputed from `proposal.spec` at validation
 * time. The value stored on the proposal object is never trusted, so a
 * proposal mutated after a human approved it fails the check.
 */

import { serializeCanonicalJson } from "../furnispec/normalize.js";
import { FINGERPRINT_ALGORITHM, FINGERPRINT_PREFIX, isFingerprint, sha256Hex } from "./fingerprint.js";

export const APPROVAL_ERROR = Object.freeze({
  MISSING_PROPOSAL: "MISSING_PROPOSAL",
  INVALID_PROPOSAL: "INVALID_PROPOSAL",
  MISSING_APPROVAL: "MISSING_APPROVAL",
  INVALID_APPROVAL_TYPE: "INVALID_APPROVAL_TYPE",
  MISSING_APPROVED_BY: "MISSING_APPROVED_BY",
  BLANK_APPROVED_BY: "BLANK_APPROVED_BY",
  MISSING_PROPOSAL_ID: "MISSING_PROPOSAL_ID",
  PROPOSAL_ID_MISMATCH: "PROPOSAL_ID_MISMATCH",
  MISSING_PROPOSAL_REVISION: "MISSING_PROPOSAL_REVISION",
  PROPOSAL_REVISION_MISMATCH: "PROPOSAL_REVISION_MISMATCH",
  MISSING_PROPOSAL_FINGERPRINT: "MISSING_PROPOSAL_FINGERPRINT",
  MALFORMED_PROPOSAL_FINGERPRINT: "MALFORMED_PROPOSAL_FINGERPRINT",
  PROPOSAL_FINGERPRINT_MISMATCH: "PROPOSAL_FINGERPRINT_MISMATCH",
  PROPOSAL_TAMPERED_SINCE_ISSUE: "PROPOSAL_TAMPERED_SINCE_ISSUE",
});

export { FINGERPRINT_ALGORITHM };

/**
 * Canonical fingerprint of a FurniSpec proposal.
 * @param {object} spec the PROPOSED FurniSpec, exactly as it was put to the human
 * @returns {string} e.g. "fs256:9f2c…"
 */
export function fingerprintFurniSpec(spec) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
    throw new TypeError("fingerprintFurniSpec expects a FurniSpec object.");
  }
  return FINGERPRINT_PREFIX + sha256Hex(serializeCanonicalJson(spec));
}

/**
 * Builds the immutable proposal record shown to the human for approval.
 * @param {object} spec PROPOSED FurniSpec
 */
export function createProposal(spec) {
  const fingerprint = fingerprintFurniSpec(spec);
  return Object.freeze({
    specId: spec.specId,
    revision: spec.revision,
    status: spec.status,
    fingerprint,
    fingerprintAlgorithm: FINGERPRINT_ALGORITHM,
    spec,
  });
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates a human approval against the exact proposal it claims to approve.
 * Pure; no I/O, no clock, no model call.
 *
 * @param {object} args
 * @param {object|null} args.proposal proposal record from createProposal()
 * @param {unknown} args.approval whatever the caller supplied
 * @returns {{valid: boolean, errors: Array<{code:string, field:string, message:string}>, expectedFingerprint: string|null}}
 */
export function validateApproval({ proposal, approval }) {
  const errors = [];
  const add = (code, field, message) => errors.push({ code, field, message });

  // --- The proposal itself must be a real, self-consistent record ----------
  if (proposal === null || proposal === undefined) {
    add(APPROVAL_ERROR.MISSING_PROPOSAL, "proposal", "There is no proposal to approve.");
    return { valid: false, errors, expectedFingerprint: null };
  }
  if (!isPlainObject(proposal) || !isPlainObject(proposal.spec)) {
    add(APPROVAL_ERROR.INVALID_PROPOSAL, "proposal", "Proposal must be a record carrying the proposed FurniSpec.");
    return { valid: false, errors, expectedFingerprint: null };
  }

  // Recomputed from the spec in hand — the stored value is never trusted.
  const expectedFingerprint = fingerprintFurniSpec(proposal.spec);

  if (isFingerprint(proposal.fingerprint) && proposal.fingerprint !== expectedFingerprint) {
    add(
      APPROVAL_ERROR.PROPOSAL_TAMPERED_SINCE_ISSUE,
      "proposal.spec",
      "The proposed FurniSpec has changed since the proposal was issued. Re-issue the proposal and obtain a fresh approval."
    );
  }

  // --- The approval must be a structured record ----------------------------
  if (approval === null || approval === undefined) {
    add(APPROVAL_ERROR.MISSING_APPROVAL, "approval", "No approval was supplied. Geometry requires an explicit human approval record.");
    return { valid: false, errors, expectedFingerprint };
  }
  if (!isPlainObject(approval)) {
    add(
      APPROVAL_ERROR.INVALID_APPROVAL_TYPE,
      "approval",
      `Approval must be a structured record, not ${Array.isArray(approval) ? "an array" : typeof approval}.`
    );
    return { valid: false, errors, expectedFingerprint };
  }

  // --- approvedBy ----------------------------------------------------------
  if (!Object.prototype.hasOwnProperty.call(approval, "approvedBy")) {
    add(APPROVAL_ERROR.MISSING_APPROVED_BY, "approval.approvedBy", "approvedBy is required — an approval must name the person giving it.");
  } else if (typeof approval.approvedBy !== "string" || approval.approvedBy.trim() === "") {
    add(APPROVAL_ERROR.BLANK_APPROVED_BY, "approval.approvedBy", "approvedBy must be a non-empty string.");
  }

  // --- proposalId ----------------------------------------------------------
  if (!Object.prototype.hasOwnProperty.call(approval, "proposalId")) {
    add(APPROVAL_ERROR.MISSING_PROPOSAL_ID, "approval.proposalId", "proposalId is required.");
  } else if (approval.proposalId !== proposal.specId) {
    add(
      APPROVAL_ERROR.PROPOSAL_ID_MISMATCH,
      "approval.proposalId",
      `Approval references spec "${String(approval.proposalId)}" but the proposal is "${proposal.specId}".`
    );
  }

  // --- proposalRevision ----------------------------------------------------
  if (!Object.prototype.hasOwnProperty.call(approval, "proposalRevision")) {
    add(APPROVAL_ERROR.MISSING_PROPOSAL_REVISION, "approval.proposalRevision", "proposalRevision is required.");
  } else if (!Number.isInteger(approval.proposalRevision) || approval.proposalRevision !== proposal.revision) {
    add(
      APPROVAL_ERROR.PROPOSAL_REVISION_MISMATCH,
      "approval.proposalRevision",
      `Approval references revision ${String(approval.proposalRevision)} but the proposal is revision ${proposal.revision}.`
    );
  }

  // --- proposalFingerprint -------------------------------------------------
  if (!Object.prototype.hasOwnProperty.call(approval, "proposalFingerprint")) {
    add(APPROVAL_ERROR.MISSING_PROPOSAL_FINGERPRINT, "approval.proposalFingerprint", "proposalFingerprint is required.");
  } else if (!isFingerprint(approval.proposalFingerprint)) {
    add(
      APPROVAL_ERROR.MALFORMED_PROPOSAL_FINGERPRINT,
      "approval.proposalFingerprint",
      `proposalFingerprint must match ${FINGERPRINT_PREFIX}<64 lower-case hex chars>.`
    );
  } else if (approval.proposalFingerprint !== expectedFingerprint) {
    add(
      APPROVAL_ERROR.PROPOSAL_FINGERPRINT_MISMATCH,
      "approval.proposalFingerprint",
      "The approval does not match this proposal. It may belong to an earlier proposal, or the proposal changed after it was approved."
    );
  }

  return { valid: errors.length === 0, errors, expectedFingerprint };
}
