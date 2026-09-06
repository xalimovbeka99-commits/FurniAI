/**
 * MANDATORY NEGATIVE TESTS — the trusted approval boundary.
 *
 * Every case below must leave `partGraph === null`. If any one of these ever
 * produces geometry, an unapproved wardrobe can reach a workshop.
 */
import { describe, expect, it } from "vitest";
import { APPROVAL_ERROR, createProposal, fingerprintFurniSpec, validateApproval } from "./approval.js";
import { APPROVAL_STATE, PIPELINE_STAGE, approveAndPreview, proposeWardrobe } from "./pipeline.js";
import {
  COMPLETE_DESCRIPTION,
  INCOMPLETE_DESCRIPTION,
  OUT_OF_SLICE_DESCRIPTION,
} from "./fixtures/demoScenarios.js";

const SPEC_ID = "furnispec-ai-alpha-approval-test";

function proposal(revision = 1, specId = SPEC_ID) {
  const result = proposeWardrobe({ description: COMPLETE_DESCRIPTION, specId, revision });
  expect(result.stage).toBe(PIPELINE_STAGE.READY_FOR_REVIEW);
  return result.proposal;
}

function validApprovalFor(p) {
  return {
    approvedBy: "Bekzod Khalimov",
    proposalId: p.specId,
    proposalRevision: p.revision,
    proposalFingerprint: p.fingerprint,
  };
}

/** Asserts the boundary held: no geometry, and the safety report says so. */
function expectNoGeometry(result, expectedCode) {
  expect(result.partGraph).toBeNull();
  expect(result.partGraphValidation).toBeNull();
  expect(result.stage).not.toBe(PIPELINE_STAGE.APPROVED_FOR_PREVIEW);
  expect(result.safety.geometryGenerated).toBe(false);
  expect(result.safety.previewAuthorized).toBe(false);
  expect(result.safety.approvalState).not.toBe(APPROVAL_STATE.APPROVED);
  if (expectedCode) {
    expect(result.approvalValidation.valid).toBe(false);
    expect(result.approvalValidation.errors.map((e) => e.code)).toContain(expectedCode);
  }
}

describe("POSITIVE CONTROL — a valid approval does produce geometry", () => {
  it("reaches APPROVED_FOR_PREVIEW with 19 parts", () => {
    const p = proposal();
    const result = approveAndPreview({ proposal: p, approval: validApprovalFor(p) });
    expect(result.stage).toBe(PIPELINE_STAGE.APPROVED_FOR_PREVIEW);
    expect(result.partGraph.summary.totalStructuralParts).toBe(19);
    expect(result.spec.status).toBe("APPROVED");
    expect(result.safety.geometryGenerated).toBe(true);
    expect(result.safety.previewAuthorized).toBe(true);
  });
});

describe("MANDATORY NEGATIVE TESTS — PartGraph must remain null", () => {
  it("1. missing approval (null and undefined)", () => {
    const p = proposal();
    expectNoGeometry(approveAndPreview({ proposal: p, approval: null }), APPROVAL_ERROR.MISSING_APPROVAL);
    expectNoGeometry(approveAndPreview({ proposal: p, approval: undefined }), APPROVAL_ERROR.MISSING_APPROVAL);
  });

  it("2. empty approval object", () => {
    const p = proposal();
    const result = approveAndPreview({ proposal: p, approval: {} });
    expectNoGeometry(result, APPROVAL_ERROR.MISSING_APPROVED_BY);
    const codes = result.approvalValidation.errors.map((e) => e.code);
    expect(codes).toContain(APPROVAL_ERROR.MISSING_PROPOSAL_ID);
    expect(codes).toContain(APPROVAL_ERROR.MISSING_PROPOSAL_REVISION);
    expect(codes).toContain(APPROVAL_ERROR.MISSING_PROPOSAL_FINGERPRINT);
  });

  it("3. string, boolean, number and array approvals", () => {
    const p = proposal();
    for (const bad of ["approved", "yes", "", true, false, 1, 0, [], ["approved"]]) {
      expectNoGeometry(
        approveAndPreview({ proposal: p, approval: bad }),
        bad === "" || typeof bad !== "object" || Array.isArray(bad)
          ? APPROVAL_ERROR.INVALID_APPROVAL_TYPE
          : undefined
      );
    }
  });

  it("4. blank approvedBy", () => {
    const p = proposal();
    for (const blank of ["", "   ", "\t\n"]) {
      expectNoGeometry(
        approveAndPreview({ proposal: p, approval: { ...validApprovalFor(p), approvedBy: blank } }),
        APPROVAL_ERROR.BLANK_APPROVED_BY
      );
    }
    expectNoGeometry(
      approveAndPreview({ proposal: p, approval: { ...validApprovalFor(p), approvedBy: 42 } }),
      APPROVAL_ERROR.BLANK_APPROVED_BY
    );
  });

  it("5. wrong proposal ID", () => {
    const p = proposal();
    expectNoGeometry(
      approveAndPreview({ proposal: p, approval: { ...validApprovalFor(p), proposalId: "some-other-spec" } }),
      APPROVAL_ERROR.PROPOSAL_ID_MISMATCH
    );
  });

  it("6. wrong revision", () => {
    const p = proposal(1);
    expectNoGeometry(
      approveAndPreview({ proposal: p, approval: { ...validApprovalFor(p), proposalRevision: 2 } }),
      APPROVAL_ERROR.PROPOSAL_REVISION_MISMATCH
    );
    expectNoGeometry(
      approveAndPreview({ proposal: p, approval: { ...validApprovalFor(p), proposalRevision: "1" } }),
      APPROVAL_ERROR.PROPOSAL_REVISION_MISMATCH
    );
  });

  it("7. wrong fingerprint", () => {
    const p = proposal();
    expectNoGeometry(
      approveAndPreview({
        proposal: p,
        approval: { ...validApprovalFor(p), proposalFingerprint: `fs256:${"0".repeat(64)}` },
      }),
      APPROVAL_ERROR.PROPOSAL_FINGERPRINT_MISMATCH
    );
    expectNoGeometry(
      approveAndPreview({ proposal: p, approval: { ...validApprovalFor(p), proposalFingerprint: "not-a-fingerprint" } }),
      APPROVAL_ERROR.MALFORMED_PROPOSAL_FINGERPRINT
    );
  });

  it("8. approval belonging to an earlier proposal", () => {
    const first = proposal(1);
    const firstApproval = validApprovalFor(first);
    const second = proposeWardrobe({ description: COMPLETE_DESCRIPTION, specId: SPEC_ID, revision: 2 }).proposal;

    expect(second.fingerprint).not.toBe(first.fingerprint);
    expectNoGeometry(
      approveAndPreview({ proposal: second, approval: firstApproval }),
      APPROVAL_ERROR.PROPOSAL_REVISION_MISMATCH
    );
    expect(
      approveAndPreview({ proposal: second, approval: firstApproval }).approvalValidation.errors.map((e) => e.code)
    ).toContain(APPROVAL_ERROR.PROPOSAL_FINGERPRINT_MISMATCH);
  });

  it("9. proposal modified after it was approved", () => {
    const p = proposal();
    const approval = validApprovalFor(p);

    // Someone widens the wardrobe by 200mm after the human signed off.
    const tampered = {
      ...p,
      spec: { ...p.spec, envelope: { ...p.spec.envelope, widthMm: p.spec.envelope.widthMm + 200 } },
    };

    const result = approveAndPreview({ proposal: tampered, approval });
    expectNoGeometry(result, APPROVAL_ERROR.PROPOSAL_FINGERPRINT_MISMATCH);
    expect(result.approvalValidation.errors.map((e) => e.code)).toContain(APPROVAL_ERROR.PROPOSAL_TAMPERED_SINCE_ISSUE);
  });

  it("10. unsupported furniture request", () => {
    const result = proposeWardrobe({ description: OUT_OF_SLICE_DESCRIPTION, specId: SPEC_ID, revision: 1 });
    expect(result.stage).toBe(PIPELINE_STAGE.UNSUPPORTED_REQUEST);
    expect(result.proposal).toBeNull();
    expectNoGeometry(result);
    // and it cannot be approved into existence
    expectNoGeometry(
      approveAndPreview({
        proposal: result.proposal,
        approval: { approvedBy: "Bekzod", proposalId: SPEC_ID, proposalRevision: 1, proposalFingerprint: `fs256:${"a".repeat(64)}` },
      }),
      APPROVAL_ERROR.MISSING_PROPOSAL
    );
  });

  it("11. invalid FurniSpec inside an otherwise correctly-signed proposal", () => {
    const p = proposal();
    // Break width closure, then re-fingerprint so the approval itself is honest.
    const brokenSpec = { ...p.spec, envelope: { ...p.spec.envelope, widthMm: 1234.0 } };
    const brokenProposal = { ...p, spec: brokenSpec, fingerprint: fingerprintFurniSpec(brokenSpec) };
    const approval = {
      approvedBy: "Bekzod",
      proposalId: brokenProposal.specId,
      proposalRevision: brokenProposal.revision,
      proposalFingerprint: brokenProposal.fingerprint,
    };

    const result = approveAndPreview({ proposal: brokenProposal, approval });
    expect(result.approvalValidation.valid).toBe(true); // the approval matched
    expect(result.stage).toBe(PIPELINE_STAGE.VALIDATION_FAILED); // the spec did not
    expect(result.validation.valid).toBe(false);
    expectNoGeometry(result);
  });

  it("12. a blocking clarification gap still open", () => {
    const result = proposeWardrobe({ description: INCOMPLETE_DESCRIPTION, specId: SPEC_ID, revision: 1 });
    expect(result.stage).toBe(PIPELINE_STAGE.NEEDS_CLARIFICATION);
    expect(result.proposal).toBeNull();
    expect(result.spec).toBeNull();
    expectNoGeometry(result);
    expectNoGeometry(
      approveAndPreview({
        proposal: result.proposal,
        approval: { approvedBy: "Bekzod", proposalId: SPEC_ID, proposalRevision: 1, proposalFingerprint: `fs256:${"b".repeat(64)}` },
      }),
      APPROVAL_ERROR.MISSING_PROPOSAL
    );
  });
});

describe("validateApproval unit behaviour", () => {
  it("recomputes the fingerprint rather than trusting the proposal record", () => {
    const p = proposal();
    const lying = { ...p, fingerprint: `fs256:${"c".repeat(64)}` };
    const result = validateApproval({ proposal: lying, approval: validApprovalFor(p) });
    expect(result.expectedFingerprint).toBe(p.fingerprint);
    expect(result.errors.map((e) => e.code)).toContain(APPROVAL_ERROR.PROPOSAL_TAMPERED_SINCE_ISSUE);
  });

  it("rejects a proposal that is not a record", () => {
    for (const bad of ["proposal", 7, true, []]) {
      const result = validateApproval({ proposal: bad, approval: { approvedBy: "x" } });
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(APPROVAL_ERROR.INVALID_PROPOSAL);
    }
  });

  it("is deterministic", () => {
    const p = proposal();
    const baseline = JSON.stringify(validateApproval({ proposal: p, approval: {} }));
    for (let i = 0; i < 25; i += 1) {
      expect(JSON.stringify(validateApproval({ proposal: p, approval: {} }))).toBe(baseline);
    }
  });

  it("gives the same fingerprint for the same spec and a different one for any change", () => {
    const p = proposal();
    expect(fingerprintFurniSpec(p.spec)).toBe(p.fingerprint);
    expect(fingerprintFurniSpec({ ...p.spec, revision: 99 })).not.toBe(p.fingerprint);
    expect(fingerprintFurniSpec({ ...p.spec, status: "APPROVED" })).not.toBe(p.fingerprint);
  });

  it("createProposal freezes the record it hands to the human", () => {
    expect(Object.isFrozen(createProposal(proposal().spec))).toBe(true);
  });
});
