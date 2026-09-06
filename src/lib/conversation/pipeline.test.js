import { describe, expect, it } from "vitest";
import { PIPELINE_STAGE, runConversationToWardrobe } from "./pipeline.js";
import { REQUIRED_INTAKE_KEYS } from "./intakeModel.js";
import {
  COMPLETE_DESCRIPTION,
  INCOMPLETE_ANSWERS,
  INCOMPLETE_DESCRIPTION,
  OUT_OF_SLICE_DESCRIPTION,
} from "./fixtures/demoScenarios.js";

const SPEC_ID = "furnispec-ai-alpha-pipeline-test";

function run(description, extra = {}) {
  return runConversationToWardrobe({ description, specId: SPEC_ID, revision: 1, ...extra });
}

describe("conversation to parametric wardrobe pipeline", () => {
  it("turns a complete description into a validated FurniSpec and a 19-part PartGraph", () => {
    const result = run(COMPLETE_DESCRIPTION, { approval: { approvedBy: "Bekzod" } });
    expect(result.stage).toBe(PIPELINE_STAGE.PART_GRAPH_READY);
    expect(result.gaps).toEqual([]);
    expect(result.validation.errors).toEqual([]);
    expect(result.spec.status).toBe("APPROVED");
    expect(result.partGraph.summary.totalStructuralParts).toBe(19);
    expect(result.partGraphValidation.errors).toEqual([]);
    expect(result.partGraphValidation.valid).toBe(true);
  });

  it("leaves the spec PROPOSED when no one has approved it", () => {
    const result = run(COMPLETE_DESCRIPTION);
    expect(result.stage).toBe(PIPELINE_STAGE.PART_GRAPH_READY);
    expect(result.spec.status).toBe("PROPOSED");
  });

  it("stops at clarification for an incomplete request and asks a question per gap", () => {
    const result = run(INCOMPLETE_DESCRIPTION);
    expect(result.stage).toBe(PIPELINE_STAGE.CLARIFICATION_REQUIRED);
    expect(result.spec).toBeNull();
    expect(result.partGraph).toBeNull();
    expect(result.gaps).toHaveLength(REQUIRED_INTAKE_KEYS.length);
    expect(result.questions).toHaveLength(result.gaps.length);
    for (const q of result.questions) {
      expect(q.question.length).toBeGreaterThan(0);
      expect(q.why.length).toBeGreaterThan(0);
    }
  });

  it("crosses the trust boundary only once the customer has answered", () => {
    const before = run(INCOMPLETE_DESCRIPTION);
    expect(before.stage).toBe(PIPELINE_STAGE.CLARIFICATION_REQUIRED);

    const after = run(INCOMPLETE_DESCRIPTION, {
      answers: INCOMPLETE_ANSWERS,
      approval: { approvedBy: "Bekzod" },
    });
    expect(after.stage).toBe(PIPELINE_STAGE.PART_GRAPH_READY);
    expect(after.answeredKeys.sort()).toEqual([...REQUIRED_INTAKE_KEYS].sort());
    expect(after.partGraph.summary.totalStructuralParts).toBe(19);
    for (const key of REQUIRED_INTAKE_KEYS) {
      const obs = after.observations.find((o) => o.key === key);
      expect(obs.origin).toBe("CUSTOMER_CONFIRMED");
    }
  });

  it("refuses an out-of-slice request rather than substituting something buildable", () => {
    const result = run(OUT_OF_SLICE_DESCRIPTION);
    expect(result.stage).toBe(PIPELINE_STAGE.CLARIFICATION_REQUIRED);
    expect(result.gaps.some((g) => g.kind === "OUT_OF_SLICE")).toBe(true);
    expect(result.partGraph).toBeNull();
  });

  it("keeps CNC unqualified and hardware drilling blocked", () => {
    const result = run(COMPLETE_DESCRIPTION, { approval: { approvedBy: "Bekzod" } });
    expect(result.safety.cncQualified).toBe(false);
    expect(result.safety.cncQualificationAsserted).toBe(true);
    expect(result.safety.drillingBlocked).toBe(true);
    expect(result.safety.drillingOperationCount).toBe(0);
    expect(result.safety.drillingPolicy).toBe("BLOCKED_PENDING_HARDWARE_APPROVAL");
    expect(result.safety.approvedOperationTypes).toEqual(["BACK_GROOVE"]);
    expect(Object.values(result.safety.hardwareStatuses)).not.toContain("APPROVED");
  });

  it("produces no drilling coordinates anywhere in the PartGraph", () => {
    const result = run(COMPLETE_DESCRIPTION, { approval: { approvedBy: "Bekzod" } });
    const serialized = JSON.stringify(result.partGraph);
    expect(serialized).not.toMatch(/DRILL|HINGE_CUP|PIN_HOLE|GCODE|G-CODE/i);
  });

  it("is deterministic end to end", () => {
    const args = { description: COMPLETE_DESCRIPTION, specId: SPEC_ID, revision: 1, approval: { approvedBy: "Bekzod" } };
    const baseline = JSON.stringify(runConversationToWardrobe(args));
    for (let i = 0; i < 25; i += 1) {
      expect(JSON.stringify(runConversationToWardrobe(args))).toBe(baseline);
    }
  });

  it("does not accept an answer to a question that was never asked", () => {
    const result = run(COMPLETE_DESCRIPTION, { answers: { bayCount: 9 }, approval: { approvedBy: "Bekzod" } });
    expect(result.answeredKeys).toEqual([]);
    expect(result.spec.bays).toHaveLength(2);
  });
});
