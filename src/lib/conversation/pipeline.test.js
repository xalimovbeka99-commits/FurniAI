import { describe, expect, it } from "vitest";
import goldenFixture from "../furnispec/goldenWardrobe.fixture.json";
import { buildStructuralPartGraph } from "../partgraph/buildStructuralPartGraph.js";
import {
  APPROVAL_STATE,
  PIPELINE_STAGE,
  approveAndPreview,
  proposeWardrobe,
  runConversationToWardrobe,
} from "./pipeline.js";
import { REQUIRED_INTAKE_KEYS } from "./intakeModel.js";
import {
  COMPLETE_DESCRIPTION,
  INCOMPLETE_ANSWERS,
  INCOMPLETE_DESCRIPTION,
  OUT_OF_SLICE_DESCRIPTION,
} from "./fixtures/demoScenarios.js";

const SPEC_ID = "furnispec-ai-alpha-pipeline-test";

function propose(description, extra = {}) {
  return proposeWardrobe({ description, specId: SPEC_ID, revision: 1, ...extra });
}
function approvalFor(p, approvedBy = "Bekzod Khalimov") {
  return { approvedBy, proposalId: p.specId, proposalRevision: p.revision, proposalFingerprint: p.fingerprint };
}
const structuralKey = (p) =>
  JSON.stringify([p.role, p.quantity, p.materialCode, p.finished, p.raw, p.placement, p.orientation, p.grainDirection, p.edges, p.status]);

describe("stage 1 — propose", () => {
  it("produces a PROPOSED FurniSpec, READY_FOR_REVIEW, with no geometry", () => {
    const result = propose(COMPLETE_DESCRIPTION);
    expect(result.stage).toBe(PIPELINE_STAGE.READY_FOR_REVIEW);
    expect(result.spec.status).toBe("PROPOSED");
    expect(result.validation.errors).toEqual([]);
    expect(result.partGraph).toBeNull();
    expect(result.partGraphValidation).toBeNull();
    expect(result.gaps).toEqual([]);
  });

  it("issues an immutable proposal record with a canonical fingerprint", () => {
    const { proposal } = propose(COMPLETE_DESCRIPTION);
    expect(proposal.specId).toBe(SPEC_ID);
    expect(proposal.revision).toBe(1);
    expect(proposal.status).toBe("PROPOSED");
    expect(proposal.fingerprint).toMatch(/^fs256:[0-9a-f]{64}$/);
    expect(proposal.fingerprintAlgorithm).toContain("sha256");
    expect(Object.isFrozen(proposal)).toBe(true);
  });

  it("safety before approval never implies approved geometry", () => {
    const { safety } = propose(COMPLETE_DESCRIPTION);
    expect(safety.approvalState).toBe(APPROVAL_STATE.NOT_APPROVED);
    expect(safety.previewAuthorized).toBe(false);
    expect(safety.geometryGenerated).toBe(false);
    expect(safety.cncQualified).toBe(false);
    expect(safety.partGraphQualificationStatus).toBeNull();
    expect(safety.approvedOperationTypes).toEqual([]);
    expect(safety.drillingOperationCount).toBe(0);
  });

  it("returns NEEDS_CLARIFICATION with one question per gap", () => {
    const result = propose(INCOMPLETE_DESCRIPTION);
    expect(result.stage).toBe(PIPELINE_STAGE.NEEDS_CLARIFICATION);
    expect(result.proposal).toBeNull();
    expect(result.spec).toBeNull();
    expect(result.gaps).toHaveLength(REQUIRED_INTAKE_KEYS.length);
    expect(result.questions).toHaveLength(result.gaps.length);
  });

  it("returns UNSUPPORTED_REQUEST — not NEEDS_CLARIFICATION — for an out-of-slice request", () => {
    const result = propose(OUT_OF_SLICE_DESCRIPTION);
    expect(result.stage).toBe(PIPELINE_STAGE.UNSUPPORTED_REQUEST);
    expect(result.stage).not.toBe(PIPELINE_STAGE.NEEDS_CLARIFICATION);
    expect(result.proposal).toBeNull();
  });

  it("returns UNSUPPORTED_REQUEST for a finish with no approved material", () => {
    const result = propose(INCOMPLETE_DESCRIPTION, { answers: { ...INCOMPLETE_ANSWERS, finishType: "veneer" } });
    expect(result.stage).toBe(PIPELINE_STAGE.UNSUPPORTED_REQUEST);
  });

  it("reaches READY_FOR_REVIEW once every question is answered", () => {
    const result = propose(INCOMPLETE_DESCRIPTION, { answers: INCOMPLETE_ANSWERS });
    expect(result.stage).toBe(PIPELINE_STAGE.READY_FOR_REVIEW);
    expect(result.answeredKeys.sort()).toEqual([...REQUIRED_INTAKE_KEYS].sort());
    for (const key of REQUIRED_INTAKE_KEYS) {
      expect(result.observations.find((o) => o.key === key).origin).toBe("CUSTOMER_CONFIRMED");
    }
    expect(result.partGraph).toBeNull();
  });

  it("is deterministic, fingerprint included", () => {
    const baseline = JSON.stringify(propose(COMPLETE_DESCRIPTION));
    for (let i = 0; i < 25; i += 1) expect(JSON.stringify(propose(COMPLETE_DESCRIPTION))).toBe(baseline);
  });

  it("uses a proposal-only adapter and names it in the result", () => {
    const result = propose(COMPLETE_DESCRIPTION);
    expect(result.adapterId).toBe("deterministic-phrase-interpreter/0.1");
    expect(result.adapterKind).toBe("DETERMINISTIC");
  });
});

describe("stage 2 — approve, then preview", () => {
  it("generates the 19-part PartGraph only after a matching approval", () => {
    const stage1 = propose(COMPLETE_DESCRIPTION);
    const stage2 = approveAndPreview({ proposal: stage1.proposal, approval: approvalFor(stage1.proposal) });

    expect(stage2.stage).toBe(PIPELINE_STAGE.APPROVED_FOR_PREVIEW);
    expect(stage2.spec.status).toBe("APPROVED");
    expect(stage2.approvedFingerprint).toBe(stage1.proposal.fingerprint);
    expect(stage2.partGraph.summary.totalStructuralParts).toBe(19);
    expect(stage2.partGraphValidation.errors).toEqual([]);
  });

  it("reproduces the Bekzod-approved Golden Wardrobe geometry part for part", () => {
    const stage1 = propose(COMPLETE_DESCRIPTION);
    const stage2 = approveAndPreview({ proposal: stage1.proposal, approval: approvalFor(stage1.proposal) });
    const mine = stage2.partGraph.parts.map(structuralKey).sort();
    const golden = buildStructuralPartGraph(goldenFixture).parts.map(structuralKey).sort();
    expect(mine).toEqual(golden);
  });

  it("keeps CNC unqualified and drilling blocked after approval", () => {
    const stage1 = propose(COMPLETE_DESCRIPTION);
    const { safety, partGraph } = approveAndPreview({ proposal: stage1.proposal, approval: approvalFor(stage1.proposal) });
    expect(safety.cncQualified).toBe(false);
    expect(safety.cncQualificationAsserted).toBe(true);
    expect(safety.specQualificationStatus).toBe("WORKSHOP_REVIEW_NOT_CNC_QUALIFIED");
    expect(safety.partGraphQualificationStatus).toBe("WORKSHOP_REVIEW_NOT_CNC_QUALIFIED");
    expect(safety.drillingPolicy).toBe("BLOCKED_PENDING_HARDWARE_APPROVAL");
    expect(safety.drillingOperationCount).toBe(0);
    expect(safety.drillingBlocked).toBe(true);
    expect(safety.approvedOperationTypes).toEqual(["BACK_GROOVE"]);
    expect(Object.values(safety.hardwareStatuses)).not.toContain("APPROVED");
    expect(JSON.stringify(partGraph)).not.toMatch(/DRILL|HINGE_CUP|PIN_HOLE|GCODE|G-CODE/i);
  });

  it("records who approved it", () => {
    const stage1 = propose(COMPLETE_DESCRIPTION);
    const stage2 = approveAndPreview({ proposal: stage1.proposal, approval: approvalFor(stage1.proposal, "Bekzod Khalimov") });
    expect(stage2.safety.approvedBy).toBe("Bekzod Khalimov");
  });

  it("is deterministic end to end", () => {
    const run = () => {
      const s1 = propose(COMPLETE_DESCRIPTION);
      return JSON.stringify(approveAndPreview({ proposal: s1.proposal, approval: approvalFor(s1.proposal) }));
    };
    const baseline = run();
    for (let i = 0; i < 20; i += 1) expect(run()).toBe(baseline);
  });
});

describe("runConversationToWardrobe convenience wrapper", () => {
  it("stops at READY_FOR_REVIEW with no approval", () => {
    const result = runConversationToWardrobe({ description: COMPLETE_DESCRIPTION, specId: SPEC_ID, revision: 1 });
    expect(result.stage).toBe(PIPELINE_STAGE.READY_FOR_REVIEW);
    expect(result.partGraph).toBeNull();
  });

  it("cannot be driven past the boundary by a truthy approval", () => {
    for (const bad of [true, "approved", 1, {}, []]) {
      const result = runConversationToWardrobe({
        description: COMPLETE_DESCRIPTION,
        specId: SPEC_ID,
        revision: 1,
        approval: bad,
      });
      expect(result.stage).not.toBe(PIPELINE_STAGE.APPROVED_FOR_PREVIEW);
      expect(result.partGraph).toBeNull();
    }
  });

  it("completes both stages when the approval matches", () => {
    const staged = proposeWardrobe({ description: COMPLETE_DESCRIPTION, specId: SPEC_ID, revision: 1 });
    const result = runConversationToWardrobe({
      description: COMPLETE_DESCRIPTION,
      specId: SPEC_ID,
      revision: 1,
      approval: approvalFor(staged.proposal),
    });
    expect(result.stage).toBe(PIPELINE_STAGE.APPROVED_FOR_PREVIEW);
    expect(result.partGraph.summary.totalStructuralParts).toBe(19);
  });
});
