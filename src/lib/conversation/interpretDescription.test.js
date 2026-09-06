import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GAP_KIND, OBSERVATION_ORIGIN, REQUIRED_INTAKE_KEYS } from "./intakeModel.js";
import { interpretDescription } from "./interpretDescription.js";
import { COMPLETE_DESCRIPTION, INCOMPLETE_DESCRIPTION, OUT_OF_SLICE_DESCRIPTION } from "./fixtures/demoScenarios.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function facts(result) {
  return Object.fromEntries(result.observations.map((o) => [o.key, o.value]));
}

describe("deterministic description interpreter", () => {
  it("extracts every required fact from a complete description", () => {
    const f = facts(interpretDescription(COMPLETE_DESCRIPTION));
    expect(f).toEqual({
      "envelope.widthMm": 1800.0,
      "envelope.heightMm": 2400.0,
      "envelope.depthMm": 600.0,
      "plinth.heightMm": 100.0,
      bayCount: 2,
      doorCount: 4,
      finishType: "melamine",
      bayLayouts: ["LONG_HANGING", "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES"],
    });
    expect(Object.keys(f).sort()).toEqual([...REQUIRED_INTAKE_KEYS].sort());
  });

  it("tags every extracted fact as customer-stated and cites its source text", () => {
    for (const obs of interpretDescription(COMPLETE_DESCRIPTION).observations) {
      expect(obs.origin).toBe(OBSERVATION_ORIGIN.CUSTOMER_STATED);
      expect(obs.sourceText).toBeTruthy();
      expect(obs.sourceSpan).toHaveLength(2);
      expect(COMPLETE_DESCRIPTION.slice(obs.sourceSpan[0], obs.sourceSpan[1])).toContain(
        obs.sourceText.split(" | ")[0]
      );
    }
  });

  it("is deterministic across repeated runs", () => {
    const baseline = JSON.stringify(interpretDescription(COMPLETE_DESCRIPTION));
    for (let i = 0; i < 100; i += 1) {
      expect(JSON.stringify(interpretDescription(COMPLETE_DESCRIPTION))).toBe(baseline);
    }
  });

  it("invents nothing from an incomplete description", () => {
    const result = interpretDescription(INCOMPLETE_DESCRIPTION);
    expect(result.observations).toEqual([]);
  });

  it("treats a hedged dimension as ambiguous rather than a value", () => {
    const result = interpretDescription(INCOMPLETE_DESCRIPTION);
    const heights = result.ambiguities.filter((a) => a.key === "envelope.heightMm");
    expect(heights).toHaveLength(1);
    expect(heights[0].kind).toBe(GAP_KIND.AMBIGUOUS_FACT);
    expect(heights[0].sourceText).toBe("about 2 metres tall");
    expect(result.observations.find((o) => o.key === "envelope.heightMm")).toBeUndefined();
  });

  it("rejects a dimension finer than 0.1mm instead of rounding it", () => {
    const result = interpretDescription("Make it 1800.005mm wide.");
    expect(result.observations.find((o) => o.key === "envelope.widthMm")).toBeUndefined();
    expect(result.ambiguities.some((a) => a.key === "envelope.widthMm")).toBe(true);
  });

  it("flags requests outside the first manufacturing slice", () => {
    const result = interpretDescription(OUT_OF_SLICE_DESCRIPTION);
    expect(result.unmatchedIntent).toContain("sliding");
    expect(result.ambiguities.some((a) => a.kind === GAP_KIND.OUT_OF_SLICE)).toBe(true);
  });

  it("makes no AI provider call — enforced against the module source", () => {
    const source = readFileSync(path.join(HERE, "interpretDescription.js"), "utf8");
    expect(source).not.toMatch(/ai-provider|anthropic|openai|fetch\(/i);
  });
});
