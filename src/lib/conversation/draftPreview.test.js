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

  it("rejects negative dimensions such as 'Make it -2000 mm wide' without modifying draft", () => {
    const initialDraft = previewDraftWardrobe({
      description: "A wardrobe for my bedroom",
      specId: "spec-conv-neg",
      revision: 1,
    });
    expect(initialDraft.spec.envelope.widthMm).toBe(1800);

    const editResult = applyConversationalEdit({
      currentObservations: initialDraft.observations,
      commandText: "Make it -2000 mm wide",
      specId: "spec-conv-neg",
      revision: 1,
    });

    expect(editResult.ok).toBe(false);
    expect(editResult.error).toMatch(/Negative dimensions are not permitted/i);
  });

  it("rejects precision finer than 0.1mm such as 'Make it 2000.00001 mm wide' without rounding", () => {
    const initialDraft = previewDraftWardrobe({
      description: "A wardrobe for my bedroom",
      specId: "spec-conv-prec",
      revision: 1,
    });
    expect(initialDraft.spec.envelope.widthMm).toBe(1800);

    const editResult = applyConversationalEdit({
      currentObservations: initialDraft.observations,
      commandText: "Make it 2000.00001 mm wide",
      specId: "spec-conv-prec",
      revision: 1,
    });

    expect(editResult.ok).toBe(false);
    expect(editResult.error).toMatch(/Precision finer than 0.1mm is not supported/i);
  });

  it("converts spelled-out units accurately (e.g. '180 centimetres wide')", () => {
    const initialDraft = previewDraftWardrobe({
      description: "A wardrobe for my bedroom",
      specId: "spec-conv-units",
      revision: 1,
    });

    const editResult = applyConversationalEdit({
      currentObservations: initialDraft.observations,
      commandText: "Make it 180 centimetres wide",
      specId: "spec-conv-units",
      revision: 1,
    });

    expect(editResult.ok).toBe(true);
    expect(editResult.spec.envelope.widthMm).toBe(1800);
  });

  it("honestly rejects 'Add another shelf on the right' when right bay already has maximum supported shelving", () => {
    const initialDraft = previewDraftWardrobe({
      description: "A wardrobe for my bedroom",
      specId: "spec-conv-shelflimit",
      revision: 1,
    });
    // Bay 1 (right bay) already has SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES (max 2 adj shelves)
    expect(initialDraft.spec.bays[1].components.filter((c) => c.type === "SHELF_ADJUSTABLE")).toHaveLength(2);

    const editResult = applyConversationalEdit({
      currentObservations: initialDraft.observations,
      commandText: "Add another shelf on the right",
      specId: "spec-conv-shelflimit",
      revision: 1,
    });

    // Must NOT report false success or pretend a shelf was added
    expect(editResult.ok).toBe(false);
    expect(editResult.error).toMatch(/maximum supported shelving/i);
    expect(editResult.error).toMatch(/change the left bay to shelves or switch back/i);
  });

  it("adds shelving to the left bay when requested ('Add another shelf on the left'), increasing PartGraph parts", () => {
    const initialDraft = previewDraftWardrobe({
      description: "A wardrobe for my bedroom",
      specId: "spec-conv-addshelf",
      revision: 1,
    });
    // Bay 0 (left) starts with LONG_HANGING (0 adjustable shelves)
    expect(initialDraft.spec.bays[0].components.filter((c) => c.type === "SHELF_ADJUSTABLE")).toHaveLength(0);
    expect(initialDraft.partGraph.parts).toHaveLength(19);

    const editResult = applyConversationalEdit({
      currentObservations: initialDraft.observations,
      commandText: "Add another shelf on the left",
      specId: "spec-conv-addshelf",
      revision: 1,
    });

    expect(editResult.ok).toBe(true);
    expect(editResult.spec.revision).toBe(2);
    // Bay 0 now has 2 adjustable shelves
    expect(editResult.spec.bays[0].components.filter((c) => c.type === "SHELF_ADJUSTABLE")).toHaveLength(2);
    // Verified PartGraph has 21 parts (19 original + 2 added shelves)
    expect(editResult.partGraph.parts).toHaveLength(21);
    expect(editResult.partGraphValidation.valid).toBe(true);
  });

  it("verifies step-by-step undo: original -> width edit -> shelf edit -> undo once -> undo again", () => {
    const specId = "spec-conv-undo-test";

    // 1. Original Draft (Revision 1)
    const original = previewDraftWardrobe({
      description: "A wardrobe for my bedroom",
      specId,
      revision: 1,
    });
    expect(original.spec.specId).toBe(specId);
    expect(original.spec.revision).toBe(1);
    expect(original.spec.envelope.widthMm).toBe(1800);
    expect(original.spec.bays[0].components.filter((c) => c.type === "SHELF_ADJUSTABLE")).toHaveLength(0);

    const undoStack = [];

    // 2. Width edit: "Make it 2000 mm wide"
    const snapshot1 = {
      spec: JSON.parse(JSON.stringify(original.spec)),
      proposal: { ...original.proposal },
      partGraph: original.partGraph,
      observations: [...original.observations],
      origins: { ...original.origins },
      revision: original.spec.revision,
    };

    const widthEdit = applyConversationalEdit({
      currentObservations: original.observations,
      commandText: "Make it 2000 mm wide",
      specId,
      revision: 1,
    });
    expect(widthEdit.ok).toBe(true);
    expect(widthEdit.spec.specId).toBe(specId); // Preserves specId
    expect(widthEdit.spec.revision).toBe(2);
    expect(widthEdit.spec.envelope.widthMm).toBe(2000);
    undoStack.push(snapshot1);

    // 3. Shelf edit: "Add another shelf on the left"
    const snapshot2 = {
      spec: JSON.parse(JSON.stringify(widthEdit.spec)),
      proposal: { ...widthEdit.proposal },
      partGraph: widthEdit.partGraph,
      observations: [...widthEdit.observations],
      origins: { ...widthEdit.origins },
      revision: widthEdit.spec.revision,
    };

    const shelfEdit = applyConversationalEdit({
      currentObservations: widthEdit.observations,
      commandText: "Add another shelf on the left",
      specId,
      revision: 2,
    });
    expect(shelfEdit.ok).toBe(true);
    expect(shelfEdit.spec.specId).toBe(specId); // Preserves specId
    expect(shelfEdit.spec.revision).toBe(3);
    expect(shelfEdit.spec.envelope.widthMm).toBe(2000);
    expect(shelfEdit.spec.bays[0].components.filter((c) => c.type === "SHELF_ADJUSTABLE")).toHaveLength(2);
    undoStack.push(snapshot2);

    // 4. Undo once: restores width edit (Revision 2, width 2000mm, Bay 0 long hanging)
    expect(undoStack).toHaveLength(2);
    const restoredWidthEdit = undoStack.pop();
    expect(restoredWidthEdit.spec.specId).toBe(specId);
    expect(restoredWidthEdit.revision).toBe(2);
    expect(restoredWidthEdit.spec.envelope.widthMm).toBe(2000);
    expect(restoredWidthEdit.spec.bays[0].components.filter((c) => c.type === "SHELF_ADJUSTABLE")).toHaveLength(0);

    // 5. Undo again: restores original (Revision 1, width 1800mm, Bay 0 long hanging)
    expect(undoStack).toHaveLength(1);
    const restoredOriginal = undoStack.pop();
    expect(restoredOriginal.spec.specId).toBe(specId);
    expect(restoredOriginal.revision).toBe(1);
    expect(restoredOriginal.spec.envelope.widthMm).toBe(1800);
    expect(restoredOriginal.spec.bays[0].components.filter((c) => c.type === "SHELF_ADJUSTABLE")).toHaveLength(0);
    expect(undoStack).toHaveLength(0);
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
