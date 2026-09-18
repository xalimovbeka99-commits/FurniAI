/**
 * System 32 boring — the tests that matter are the refusals.
 *
 * WR-009 approves the grid and blocks the coordinates. A compiler that quietly
 * produced drillable output would break the one manufacturing guarantee FurniAI
 * has made consistently: hardware drilling BLOCKED, CNC NOT QUALIFIED. So most
 * of this file asserts what the compiler will not do.
 *
 * Evidence class: A (unit only). No provider, no network, no browser, and
 * emphatically no workshop evidence — nothing here says these holes are right,
 * only that nothing claims they are approved.
 */
import { describe, it, expect } from "vitest";
import {
  compileSystem32Boring,
  isFullyBlocked,
  BORING_STATUS,
  BORING_OPERATION_TYPE,
  BORE_FACE,
  ROW_DATUM,
  PROVISIONAL_COLUMN_ORIGIN,
  SYSTEM32_BORING_VERSION,
} from "./system32Boring.js";
import { buildStructuralPartGraph } from "./buildStructuralPartGraph.js";
import { serializeCanonicalPartGraph } from "./serializePartGraph.js";
import { WARDROBE_RULES, RULE_PROVENANCE } from "../rules/wardrobeRuleCatalog.js";

import golden from "../furnispec/goldenWardrobe.fixture.json";
import narrowFixture from "../furnispec/fixtures/narrowWardrobe.fixture.json";
import wideFixture from "../furnispec/fixtures/wideWardrobe.fixture.json";

const graph = () => buildStructuralPartGraph(golden);

describe("nothing here is approved", () => {
  it("blocks every operation it emits", () => {
    const plan = compileSystem32Boring(graph());
    expect(plan.operations.length).toBeGreaterThan(0);
    expect(isFullyBlocked(plan)).toBe(true);
    for (const op of plan.operations) {
      expect(op.status).toBe(BORING_STATUS.BLOCKED);
    }
  });

  it("counts zero approved operations, whatever the options", () => {
    for (const options of [{}, { enumerateHoles: true }]) {
      const plan = compileSystem32Boring(graph(), options);
      expect(plan.summary.approvedOperations).toBe(0);
      expect(plan.summary.blockedOperations).toBe(plan.summary.totalOperations);
    }
  });

  it("emits no machine output, tool path or G-code value anywhere in the plan", () => {
    // Walk values, not the raw text: `"toolPath": null` is the ABSENCE of a
    // tool path, and a substring match on the key name would fail on it.
    const plan = compileSystem32Boring(graph(), { enumerateHoles: true });
    const offenders = [];
    (function walk(node, path) {
      if (node === null || node === undefined) return;
      if (typeof node === "string") {
        if (/gcode|g-code|toolpath|postprocessor|\bCNC_QUALIFIED\b/i.test(node)) {
          offenders.push(`${path} = ${node}`);
        }
        return;
      }
      if (typeof node !== "object") return;
      for (const [key, value] of Object.entries(node)) {
        if (/^(machineOutput|toolPath)$/.test(key) && value !== null) {
          offenders.push(`${path}.${key} is not null`);
        }
        walk(value, `${path}.${key}`);
      }
    })(plan, "plan");

    expect(offenders).toEqual([]);
    expect(serializeCanonicalPartGraph(plan)).not.toMatch(
      /"(?:machineOutput|toolPath)":(?!\s*null)/
    );
  });

  it("copies the graph's qualification status and never upgrades it", () => {
    const g = graph();
    expect(g.qualificationStatus).toBe("WORKSHOP_REVIEW_NOT_CNC_QUALIFIED");
    expect(compileSystem32Boring(g).qualificationStatus).toBe(g.qualificationStatus);
  });

  it("refuses a PartGraph that claims CNC qualification", () => {
    const g = { ...graph(), qualificationStatus: "CNC_QUALIFIED" };
    expect(() => compileSystem32Boring(g)).toThrow(/CNC_QUALIFIED/);
  });
});

describe("the grid comes from WR-009, not from a literal in this module", () => {
  it("reads pitch, setback and diameter from the approved rule catalog", () => {
    const plan = compileSystem32Boring(graph());
    expect(plan.grid.pitchDmm).toBe(Math.round(WARDROBE_RULES.shelfPinPitchMm.value * 10));
    expect(plan.grid.frontSetbackDmm).toBe(
      Math.round(WARDROBE_RULES.shelfPinFrontSetbackMm.value * 10)
    );
    expect(plan.grid.diameterDmm).toBe(
      Math.round(WARDROBE_RULES.shelfPinDiameterMm.value * 10)
    );
  });

  it("uses only rules the catalog marks approved", () => {
    for (const key of ["shelfPinPitchMm", "shelfPinFrontSetbackMm", "shelfPinDiameterMm"]) {
      expect(WARDROBE_RULES[key].id).toBe("WR-009");
      expect(WARDROBE_RULES[key].provenance).toBe(RULE_PROVENANCE.RULEBOOK_V0_1);
    }
  });

  it("leaves hole depth null and names it as an open ruling", () => {
    const plan = compileSystem32Boring(graph());
    expect(plan.grid.depthDmm).toBeNull();
    for (const op of plan.operations) {
      expect(op.depthDmm).toBeNull();
      expect(op.depthStatus).toBe(RULE_PROVENANCE.REQUIRES_BEKZOD_RULING);
    }
    expect(plan.unresolvedInputs.map((u) => u.key)).toContain("shelfPinHoleDepthMm");
  });

  it("reports every unapproved input rather than choosing a value", () => {
    const plan = compileSystem32Boring(graph());
    expect(plan.unresolvedInputs.length).toBeGreaterThanOrEqual(4);
    for (const input of plan.unresolvedInputs) {
      expect(input.provenance).toBe(RULE_PROVENANCE.REQUIRES_BEKZOD_RULING);
      expect(input.question.length).toBeGreaterThan(20);
    }
  });
});

describe("which panels are bored", () => {
  it("bores the inner face of each outer side and both faces of each divider", () => {
    const plan = compileSystem32Boring(graph());
    // Golden: 2 sides x 1 face + 1 divider x 2 faces.
    expect(plan.summary.totalOperations).toBe(4);
    const byRole = (role) => plan.operations.filter((o) => o.hostPartRole === role);
    expect(byRole("SIDE_PANEL_LEFT")).toHaveLength(1);
    expect(byRole("SIDE_PANEL_LEFT")[0].face).toBe(BORE_FACE.RIGHT_HAND);
    expect(byRole("SIDE_PANEL_RIGHT")).toHaveLength(1);
    expect(byRole("SIDE_PANEL_RIGHT")[0].face).toBe(BORE_FACE.LEFT_HAND);
    expect(byRole("DIVIDER_PANEL")).toHaveLength(2);
  });

  it("bores no shelf, door, back or plinth part", () => {
    const plan = compileSystem32Boring(graph());
    for (const op of plan.operations) {
      expect(op.hostPartRole).toMatch(/^(SIDE_PANEL_(LEFT|RIGHT)|DIVIDER_PANEL)$/);
      expect(op.type).toBe(BORING_OPERATION_TYPE);
    }
  });

  it("scales with the number of dividers rather than assuming one", () => {
    const narrow = compileSystem32Boring(buildStructuralPartGraph(narrowFixture));
    expect(narrow.summary.totalOperations).toBe(2); // no dividers: two sides only
    const wide = compileSystem32Boring(buildStructuralPartGraph(wideFixture));
    expect(wide.summary.totalOperations).toBe(6); // two dividers: 2 + 2*2
  });

  it("derives the row position from each part's own front edge", () => {
    const g = graph();
    const plan = compileSystem32Boring(g);
    for (const op of plan.operations) {
      const part = g.parts.find((p) => p.id === op.hostPartId);
      expect(op.rowZDmm).toBe(part.placement.maxZDmm - plan.grid.frontSetbackDmm);
      expect(op.rowDatum).toBe(ROW_DATUM.FRONT_EDGE);
    }
  });

  it("emits no rear row, which no rule approves", () => {
    const plan = compileSystem32Boring(graph());
    expect(plan.grid.rearRow).toBeNull();
    expect(plan.operations.some((o) => o.rowDatum === ROW_DATUM.REAR_EDGE)).toBe(false);
    expect(plan.unresolvedInputs.map((u) => u.key)).toContain("shelfPinRearRowPolicy");
  });
});

describe("hole positions are a review preview, never a default", () => {
  it("enumerates nothing by default, because WR-009 states no origin datum", () => {
    const plan = compileSystem32Boring(graph());
    expect(plan.summary.holesEnumerated).toBe(false);
    for (const op of plan.operations) {
      expect(op.holes).toBeNull();
      expect(op.holeCount).toBeNull();
      expect(op.columnOrigin).toBeNull();
    }
    expect(plan.assumptions).toHaveLength(0);
  });

  it("never enumerates without recording the provisional origin by name", () => {
    const plan = compileSystem32Boring(graph(), { enumerateHoles: true });
    expect(plan.assumptions).toHaveLength(1);
    expect(plan.assumptions[0].datum).toBe(PROVISIONAL_COLUMN_ORIGIN);
    for (const op of plan.operations) {
      expect(op.columnOrigin).toBe(PROVISIONAL_COLUMN_ORIGIN);
      expect(op.holeCount).toBeGreaterThan(0);
    }
  });

  it("spaces enumerated holes exactly one pitch apart, inside the panel", () => {
    const g = graph();
    const plan = compileSystem32Boring(g, { enumerateHoles: true });
    for (const op of plan.operations) {
      const part = g.parts.find((p) => p.id === op.hostPartId);
      for (let i = 1; i < op.holes.length; i += 1) {
        expect(op.holes[i].yDmm - op.holes[i - 1].yDmm).toBe(plan.grid.pitchDmm);
      }
      expect(op.holes[0].yDmm).toBeGreaterThan(part.placement.minYDmm);
      expect(op.holes.at(-1).yDmm).toBeLessThan(part.placement.maxYDmm);
    }
  });

  it("keeps every operation blocked even with holes enumerated", () => {
    expect(isFullyBlocked(compileSystem32Boring(graph(), { enumerateHoles: true }))).toBe(true);
  });
});

describe("the structural PartGraph is untouched", () => {
  it("leaves the four approved BACK_GROOVE operations exactly as they were", () => {
    const g = graph();
    compileSystem32Boring(g, { enumerateHoles: true });
    expect(g.operations).toHaveLength(4);
    for (const op of g.operations) {
      expect(op.type).toBe("BACK_GROOVE");
      expect(op.status).toBe("APPROVED");
    }
  });

  it("does not move the canonical serialization of the graph it reads", () => {
    const g = graph();
    const before = serializeCanonicalPartGraph(g);
    compileSystem32Boring(g, { enumerateHoles: true });
    expect(serializeCanonicalPartGraph(g)).toBe(before);
  });

  it("is a separate versioned artefact, not part of partgraph/0.1", () => {
    const plan = compileSystem32Boring(graph());
    expect(SYSTEM32_BORING_VERSION).toBe("system32-boring/0.1");
    expect(plan.version).not.toBe(graph().partGraphVersion);
    expect(plan.sourceSpecId).toBe(graph().sourceSpecId);
  });

  it("rejects input that is not a PartGraph", () => {
    expect(() => compileSystem32Boring(null)).toThrow(/requires a PartGraph/);
    expect(() => compileSystem32Boring({})).toThrow(/requires a PartGraph/);
  });
});
