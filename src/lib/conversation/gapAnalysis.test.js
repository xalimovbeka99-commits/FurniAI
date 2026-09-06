import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyseGaps, blockingGaps, isReadyForAssembly } from "./gapAnalysis.js";
import { interpretDescription } from "./interpretDescription.js";
import {
  GAP_KIND,
  GAP_SEVERITY,
  OBSERVATION_ORIGIN,
  REQUIRED_INTAKE_KEYS,
  observation,
} from "./intakeModel.js";
import { COMPLETE_DESCRIPTION, INCOMPLETE_DESCRIPTION } from "./fixtures/demoScenarios.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const COMPLETE_FACTS = {
  "envelope.widthMm": 1800.0,
  "envelope.heightMm": 2400.0,
  "envelope.depthMm": 600.0,
  "plinth.heightMm": 100.0,
  bayCount: 2,
  doorCount: 4,
  finishType: "melamine",
  bayLayouts: ["LONG_HANGING", "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES"],
};

function interpretationFrom(facts) {
  return {
    observations: Object.entries(facts).map(([k, v]) => observation(k, v, OBSERVATION_ORIGIN.CUSTOMER_STATED)),
    ambiguities: [],
  };
}

describe("clarification gap analysis", () => {
  it("reports no gaps when every required fact is present and closes", () => {
    const gaps = analyseGaps(interpretationFrom(COMPLETE_FACTS));
    expect(gaps).toEqual([]);
    expect(isReadyForAssembly(gaps)).toBe(true);
  });

  it("raises exactly one blocking gap for each individually missing required fact", () => {
    for (const key of REQUIRED_INTAKE_KEYS) {
      const facts = { ...COMPLETE_FACTS };
      delete facts[key];
      const gaps = analyseGaps(interpretationFrom(facts));
      const forKey = gaps.filter((g) => g.key === key);
      expect(forKey, `missing ${key}`).toHaveLength(1);
      expect(forKey[0].kind).toBe(GAP_KIND.MISSING_REQUIRED_FACT);
      expect(forKey[0].severity).toBe(GAP_SEVERITY.BLOCKING);
    }
  });

  it("raises one blocking gap per missing fact for a bare request", () => {
    const gaps = analyseGaps(interpretDescription(INCOMPLETE_DESCRIPTION));
    expect(blockingGaps(gaps)).toHaveLength(REQUIRED_INTAKE_KEYS.length);
    expect(new Set(gaps.map((g) => g.key))).toEqual(new Set(REQUIRED_INTAKE_KEYS));
    expect(isReadyForAssembly(gaps)).toBe(false);
  });

  it("offers two doors per bay only as a proposal, citing the unruled rule", () => {
    const facts = { ...COMPLETE_FACTS };
    delete facts.doorCount;
    const g = analyseGaps(interpretationFrom(facts)).find((x) => x.key === "doorCount");
    expect(g.proposal).toBe(4);
    expect(g.proposalBasis).toBe("UNRULED-DOORS-PER-BAY");
    expect(g.severity).toBe(GAP_SEVERITY.BLOCKING);
  });

  it("never proposes a bay count, because no approved rule derives one", () => {
    const facts = { ...COMPLETE_FACTS };
    delete facts.bayCount;
    const g = analyseGaps(interpretationFrom(facts)).find((x) => x.key === "bayCount");
    expect(g.proposal).toBeNull();
    expect(g.proposalBasis).toBe("UNRULED-BAY-COUNT");
  });

  it("blocks a bay width that does not divide exactly instead of rounding", () => {
    // 1800.1mm - 3 x 18mm panel = 1746.1mm of clear width, which cannot be
    // split into 2 bays at exact 0.1mm precision.
    const gaps = analyseGaps(interpretationFrom({ ...COMPLETE_FACTS, "envelope.widthMm": 1800.1 }));
    expect(gaps.some((g) => g.key === "bayCount" && g.kind === GAP_KIND.UNRULED_DERIVATION)).toBe(true);
  });

  it("accepts a bay width that divides exactly to a half-millimetre", () => {
    // 1801mm - 54mm = 1747mm -> 873.5mm per bay, exact at 0.1mm precision.
    const gaps = analyseGaps(interpretationFrom({ ...COMPLETE_FACTS, "envelope.widthMm": 1801.0 }));
    expect(gaps.some((g) => g.key === "bayCount")).toBe(false);
  });

  it("blocks a door width that does not divide exactly", () => {
    const gaps = analyseGaps(interpretationFrom({ ...COMPLETE_FACTS, doorCount: 3 }));
    expect(gaps.some((g) => g.key === "doorCount" && g.kind === GAP_KIND.UNRULED_DERIVATION)).toBe(true);
  });

  it("blocks a layout list that does not match the bay count", () => {
    const gaps = analyseGaps(interpretationFrom({ ...COMPLETE_FACTS, bayLayouts: ["LONG_HANGING"] }));
    expect(gaps.some((g) => g.key === "bayLayouts" && g.kind === GAP_KIND.CONFLICTING_FACT)).toBe(true);
  });

  it("blocks a finish with no Bekzod-approved material", () => {
    const gaps = analyseGaps(interpretationFrom({ ...COMPLETE_FACTS, finishType: "veneer" }));
    expect(gaps.some((g) => g.key === "finishType" && g.kind === GAP_KIND.OUT_OF_SLICE)).toBe(true);
  });

  it("blocks a plinth that leaves no carcass", () => {
    const gaps = analyseGaps(interpretationFrom({ ...COMPLETE_FACTS, "plinth.heightMm": 2400.0 }));
    expect(gaps.some((g) => g.key === "plinth.heightMm" && g.kind === GAP_KIND.CONFLICTING_FACT)).toBe(true);
  });

  it("is deterministic and ordered", () => {
    const input = interpretDescription(INCOMPLETE_DESCRIPTION);
    const baseline = JSON.stringify(analyseGaps(input));
    for (let i = 0; i < 50; i += 1) expect(JSON.stringify(analyseGaps(input))).toBe(baseline);
  });

  it("makes no AI provider call — enforced against the module source", () => {
    const source = readFileSync(path.join(HERE, "gapAnalysis.js"), "utf8");
    expect(source).not.toMatch(/ai-provider|anthropic|openai|fetch\(/i);
  });

  it("does not lose the complete description's own analysis", () => {
    expect(analyseGaps(interpretDescription(COMPLETE_DESCRIPTION))).toEqual([]);
  });
});
