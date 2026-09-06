import { describe, expect, it } from "vitest";
import {
  previewDraftWardrobe,
  parseConversationalCommand,
  applyConversationalEdit,
  PIPELINE_STAGE,
  APPROVAL_STATE,
} from "./pipeline.js";
import { OBSERVATION_ORIGIN } from "./intakeModel.js";
import { SPEC_STATUS, QUALIFICATION_STATUS } from "../furnispec/schema.js";

describe("previewDraftWardrobe (Immediate Draft Preview)", () => {
  it("generates an immediate 3D draft preview from ordinary description using Bekzod-approved defaults", () => {
    const draft = previewDraftWardrobe({
      description: "Make me a wardrobe for my bedroom",
      specId: "spec-draft-001",
      revision: 1,
    });

    expect(draft.stage).toBe(PIPELINE_STAGE.DRAFT_PREVIEW);
    expect(draft.previewType).toBe("DRAFT_PREVIEW");
    expect(draft.spec).not.toBeNull();
    expect(draft.spec.status).toBe(SPEC_STATUS.PROPOSED); // NEVER APPROVED
    expect(draft.spec.envelope.widthMm).toBe(1800);
    expect(draft.spec.envelope.heightMm).toBe(2400);
    expect(draft.spec.envelope.depthMm).toBe(600);
    expect(draft.spec.plinth.heightMm).toBe(100);
    expect(draft.spec.bays).toHaveLength(2);
    expect(draft.spec.doors.count).toBe(4);

    // Provenance / Origin tracking:
    expect(draft.origins["envelope.widthMm"]).toBe(OBSERVATION_ORIGIN.DEFAULTED);
    expect(draft.origins["envelope.heightMm"]).toBe(OBSERVATION_ORIGIN.DEFAULTED);
    expect(draft.origins["envelope.depthMm"]).toBe(OBSERVATION_ORIGIN.DEFAULTED);
    expect(draft.origins["plinth.heightMm"]).toBe(OBSERVATION_ORIGIN.DEFAULTED);
    expect(draft.origins["bayCount"]).toBe(OBSERVATION_ORIGIN.DEFAULTED);
    expect(draft.origins["doorCount"]).toBe(OBSERVATION_ORIGIN.DEFAULTED);

    // Generated geometry exists and passes PartGraph validation:
    expect(draft.partGraph).not.toBeNull();
    expect(draft.partGraph.parts).toHaveLength(19);
    expect(draft.partGraphValidation.valid).toBe(true);

    // Safety readouts strictly enforce unapproved workshop status:
    expect(draft.safety.approvalState).toBe(APPROVAL_STATE.NOT_APPROVED);
    expect(draft.safety.workshopApproved).toBe(false);
    expect(draft.safety.previewAuthorized).toBe(true);
    expect(draft.safety.geometryGenerated).toBe(true);
    expect(draft.safety.cncQualified).toBe(false);
    expect(draft.safety.drillingBlocked).toBe(true);
    expect(draft.safety.specQualificationStatus).toBe(QUALIFICATION_STATUS.WORKSHOP_REVIEW_NOT_CNC_QUALIFIED);
  });

  it("records stated dimensions as CUSTOMER_STATED while defaulting remaining values", () => {
    const draft = previewDraftWardrobe({
      description: "A wardrobe 2100mm wide and 2200mm tall",
      specId: "spec-draft-002",
      revision: 1,
    });

    expect(draft.stage).toBe(PIPELINE_STAGE.DRAFT_PREVIEW);
    expect(draft.spec.envelope.widthMm).toBe(2100);
    expect(draft.spec.envelope.heightMm).toBe(2200);
    expect(draft.spec.envelope.depthMm).toBe(600); // defaulted

    expect(draft.origins["envelope.widthMm"]).toBe(OBSERVATION_ORIGIN.CUSTOMER_STATED);
    expect(draft.origins["envelope.heightMm"]).toBe(OBSERVATION_ORIGIN.CUSTOMER_STATED);
    expect(draft.origins["envelope.depthMm"]).toBe(OBSERVATION_ORIGIN.DEFAULTED);
    expect(draft.origins["plinth.heightMm"]).toBe(OBSERVATION_ORIGIN.DEFAULTED);
  });

  it("refuses out-of-slice requests without generating draft geometry", () => {
    const draft = previewDraftWardrobe({
      description: "Wardrobe with sliding doors and a glass kitchen counter",
      specId: "spec-draft-oos",
    });

    expect(draft.stage).toBe(PIPELINE_STAGE.UNSUPPORTED_REQUEST);
    expect(draft.partGraph).toBeNull();
    expect(draft.spec).toBeNull();
    expect(draft.safety.previewAuthorized).toBe(false);
    expect(draft.safety.geometryGenerated).toBe(false);
  });
});

describe("Conversational Editing (applyConversationalEdit)", () => {
  it("parses 'Make it 2000 mm wide' and updates width to 2000mm", () => {
    const initialDraft = previewDraftWardrobe({
      description: "A wardrobe for my bedroom",
      specId: "spec-conv-001",
      revision: 1,
    });
    expect(initialDraft.spec.envelope.widthMm).toBe(1800);

    const editResult = applyConversationalEdit({
      currentObservations: initialDraft.observations,
      commandText: "Make it 2000 mm wide.",
      specId: "spec-conv-001",
      revision: 1,
    });

    expect(editResult.ok).toBe(true);
    expect(editResult.spec.revision).toBe(2);
    expect(editResult.spec.status).toBe(SPEC_STATUS.PROPOSED);
    expect(editResult.spec.envelope.widthMm).toBe(2000);
    expect(editResult.origins["envelope.widthMm"]).toBe(OBSERVATION_ORIGIN.CUSTOMER_STATED);
    expect(editResult.partGraph.parts).toHaveLength(19);
    expect(editResult.partGraph.summary.envelope.widthDmm).toBe(20000);
  });

  it("parses shelf-layout change 'Add another shelf on the right'", () => {
    const initialDraft = previewDraftWardrobe({
      description: "A wardrobe for my bedroom",
      specId: "spec-conv-002",
      revision: 1,
    });

    const editResult = applyConversationalEdit({
      currentObservations: initialDraft.observations,
      commandText: "Add another shelf on the right",
      specId: "spec-conv-002",
      revision: 1,
    });

    expect(editResult.ok).toBe(true);
    expect(editResult.spec.revision).toBe(2);
    expect(editResult.spec.bays[1].components.some(c => c.type === "SHELF_ADJUSTABLE")).toBe(true);
  });

  it("parses direct command helper parseConversationalCommand", () => {
    const wCmd = parseConversationalCommand("make it 2000 mm wide");
    expect(wCmd.changes["envelope.widthMm"]).toBe(2000);

    const hCmd = parseConversationalCommand("make it 2.2m tall");
    expect(hCmd.changes["envelope.heightMm"]).toBe(2200);

    const dCmd = parseConversationalCommand("depth 550mm");
    expect(dCmd.changes["envelope.depthMm"]).toBe(550);

    const shelfCmd = parseConversationalCommand("shelves on both sides", { bayCount: 2 });
    expect(shelfCmd.changes.bayLayouts).toHaveLength(2);
  });
});
