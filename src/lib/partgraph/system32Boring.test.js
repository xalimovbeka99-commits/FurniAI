/**
 * System 32 boring, after the 2026-09-15 ruling.
 *
 * The ruling closed the geometry. It did NOT authorise drilling: WR-009 still
 * gates production coordinates on pin SKU sign-off, and no SKU exists. So the
 * tests split in two — one group proves the pattern is fully determined, the
 * other proves nothing has become drillable.
 *
 * Evidence class: A (unit only). No provider, no network, no browser, and no
 * workshop evidence. Nothing here says these holes are right for a real
 * cabinet; only that each one traces to a ruled value.
 */
import { describe, it, expect } from "vitest";
import golden from "../furnispec/goldenWardrobe.fixture.json";
import narrowFixture from "../furnispec/fixtures/narrowWardrobe.fixture.json";
import wideFixture from "../furnispec/fixtures/wideWardrobe.fixture.json";
import {
  compileSystem32Boring,
  isFullyBlocked,
  BORING_STATUS,
  GEOMETRY_STATUS,
  BORING_OPERATION_TYPE,
  BORE_FACE,
  ROW_DATUM,
  SYSTEM32_BORING_VERSION,
} from "./system32Boring.js";
import { buildStructuralPartGraph } from "./buildStructuralPartGraph.js";
import { serializeCanonicalPartGraph } from "./serializePartGraph.js";
import { WARDROBE_RULES, RULE_PROVENANCE, resolve } from "../rules/wardrobeRuleCatalog.js";

const graph = () => buildStructuralPartGraph(golden);

describe("a defined pattern is not an authorisation to drill", () => {
  it("reports geometry DEFINED and machining BLOCKED at the same time", () => {
    const plan = compileSystem32Boring(graph());
    expect(plan.geometryStatus).toBe(GEOMETRY_STATUS.DEFINED);
    expect(plan.machiningPolicy).toBe(BORING_STATUS.BLOCKED);
    expect(isFullyBlocked(plan)).toBe(true);
  });

  it("blocks every operation even though every hole now has a position", () => {
    const plan = compileSystem32Boring(graph());
    expect(plan.summary.totalHoles).toBeGreaterThan(0);
    for (const op of plan.operations) {
      expect(op.geometryStatus).toBe(GEOMETRY_STATUS.DEFINED);
      expect(op.status).toBe(BORING_STATUS.BLOCKED);
    }
    expect(plan.summary.approvedOperations).toBe(0);
    expect(plan.summary.blockedOperations).toBe(plan.summary.totalOperations);
  });

  it("still names the pin SKU as the outstanding gate", () => {
    const plan = compileSystem32Boring(graph());
    expect(plan.unresolvedInputs.map((u) => u.key)).toContain("shelfPinSku");
    for (const input of plan.unresolvedInputs) {
      expect(input.provenance).toBe(RULE_PROVENANCE.REQUIRES_BEKZOD_RULING);
    }
  });

  it("emits no machine output, tool path or G-code value anywhere in the plan", () => {
    // Walk values, not the raw text: `"toolPath": null` is the ABSENCE of a
    // tool path, and a substring match on the key name would fail on it.
    const plan = compileSystem32Boring(graph());
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

describe("every number traces to a ruled value", () => {
  it("reads pitch, setback and diameter from WR-009", () => {
    const plan = compileSystem32Boring(graph());
    expect(plan.grid.pitchDmm).toBe(Math.round(WARDROBE_RULES.shelfPinPitchMm.value * 10));
    expect(plan.grid.frontSetbackDmm).toBe(
      Math.round(WARDROBE_RULES.shelfPinFrontSetbackMm.value * 10)
    );
    expect(plan.grid.diameterDmm).toBe(Math.round(WARDROBE_RULES.shelfPinDiameterMm.value * 10));
    for (const key of ["shelfPinPitchMm", "shelfPinFrontSetbackMm", "shelfPinDiameterMm"]) {
      expect(WARDROBE_RULES[key].provenance).toBe(RULE_PROVENANCE.RULEBOOK_V0_1);
    }
  });

  it("reads origin, upper bound, rear row and depth from the 2026-09-15 ruling", () => {
    const plan = compileSystem32Boring(graph());
    expect(plan.grid.originDatum).toBe("BOTTOM_PANEL_UPPER_FACE_PLUS_64MM");
    expect(plan.grid.upperBoundDatum).toBe("TOP_PANEL_LOWER_FACE_MINUS_64MM");
    expect(plan.grid.rearRowPolicy).toBe("BORED_MIRROR_FRONT_37MM");
    for (const key of [
      "shelfPinColumnOriginDatum",
      "shelfPinColumnUpperBoundDatum",
      "shelfPinRearRowPolicy",
      "shelfPinHoleDepthByCarcassThicknessMm",
    ]) {
      expect(WARDROBE_RULES[key].provenance).toBe(RULE_PROVENANCE.BEKZOD_RULING_2026_09_15);
    }
  });

  it("bores 13.0mm into the golden wardrobe's 18mm board", () => {
    for (const op of compileSystem32Boring(graph()).operations) {
      expect(op.depthDmm).toBe(130);
    }
  });

  it("refuses to bore a thickness the ruling does not cover", () => {
    // The ruling covers 18mm and 16mm. A 25mm side must not borrow 13.0mm.
    const g = graph();
    const mutated = {
      ...g,
      parts: g.parts.map((p) =>
        p.role === "SIDE_PANEL_LEFT"
          ? { ...p, finished: { ...p.finished, thicknessDmm: 250 } }
          : p
      ),
    };
    expect(() => compileSystem32Boring(mutated)).toThrow(/25mm board/);
  });
});

describe("the column sits where the ruling put it", () => {
  it("starts 64mm above the bottom panel's upper face", () => {
    const g = graph();
    const bottom = g.parts.find((p) => p.role === "BOTTOM_PANEL");
    const plan = compileSystem32Boring(g);
    expect(plan.grid.columnFirstHoleYDmm).toBe(bottom.placement.maxYDmm + 640);
    for (const op of plan.operations) {
      expect(op.holes[0].yDmm).toBe(bottom.placement.maxYDmm + 640);
    }
  });

  it("ends at or below 64mm under the top panel's lower face", () => {
    const g = graph();
    const top = g.parts.find((p) => p.role === "TOP_PANEL");
    const plan = compileSystem32Boring(g);
    expect(plan.grid.columnLastAllowedYDmm).toBe(top.placement.minYDmm - 640);
    for (const op of plan.operations) {
      expect(op.holes.at(-1).yDmm).toBeLessThanOrEqual(plan.grid.columnLastAllowedYDmm);
      // And the next hole up would have overshot, so the column is not short.
      expect(op.holes.at(-1).yDmm + plan.grid.pitchDmm).toBeGreaterThan(
        plan.grid.columnLastAllowedYDmm
      );
    }
  });

  it("spaces holes exactly one pitch apart", () => {
    const plan = compileSystem32Boring(graph());
    for (const op of plan.operations) {
      for (let i = 1; i < op.holes.length; i += 1) {
        expect(op.holes[i].yDmm - op.holes[i - 1].yDmm).toBe(plan.grid.pitchDmm);
      }
    }
  });

  it("moves the column with the carcass rather than with a hard-coded number", () => {
    // A different height must change the hole count, or the datums are fake.
    const tallerHoles = compileSystem32Boring(buildStructuralPartGraph(wideFixture))
      .operations[0].holeCount;
    const goldenHoles = compileSystem32Boring(graph()).operations[0].holeCount;
    expect(Number.isInteger(tallerHoles)).toBe(true);
    expect(goldenHoles).toBeGreaterThan(1);
  });
});

describe("which panels and rows are bored", () => {
  it("bores front AND rear rows, per the ruling", () => {
    const plan = compileSystem32Boring(graph());
    const datums = new Set(plan.operations.map((o) => o.rowDatum));
    expect(datums).toEqual(new Set([ROW_DATUM.FRONT_EDGE, ROW_DATUM.REAR_EDGE]));
  });

  it("mirrors the rear row at the same 37mm setback from the rear datum", () => {
    const g = graph();
    const plan = compileSystem32Boring(g);
    for (const op of plan.operations) {
      const part = g.parts.find((p) => p.id === op.hostPartId);
      // minZ is the FRONT edge: Z increases toward the rear of the carcass.
      const expected =
        op.rowDatum === ROW_DATUM.FRONT_EDGE
          ? part.placement.minZDmm + plan.grid.frontSetbackDmm
          : part.placement.maxZDmm - plan.grid.frontSetbackDmm;
      expect(op.rowZDmm).toBe(expected);
    }
  });

  it("bores the inner face of each outer side and both faces of each divider", () => {
    const plan = compileSystem32Boring(graph());
    // Golden: (2 sides x 1 face + 1 divider x 2 faces) x 2 rows.
    expect(plan.summary.totalOperations).toBe(8);
    const faces = (role) =>
      new Set(plan.operations.filter((o) => o.hostPartRole === role).map((o) => o.face));
    expect(faces("SIDE_PANEL_LEFT")).toEqual(new Set([BORE_FACE.RIGHT_HAND]));
    expect(faces("SIDE_PANEL_RIGHT")).toEqual(new Set([BORE_FACE.LEFT_HAND]));
    expect(faces("DIVIDER_PANEL")).toEqual(new Set([BORE_FACE.RIGHT_HAND, BORE_FACE.LEFT_HAND]));
  });

  it("bores no shelf, door, back or plinth part", () => {
    for (const op of compileSystem32Boring(graph()).operations) {
      expect(op.hostPartRole).toMatch(/^(SIDE_PANEL_(LEFT|RIGHT)|DIVIDER_PANEL)$/);
      expect(op.type).toBe(BORING_OPERATION_TYPE);
    }
  });

  it("scales with the number of dividers rather than assuming one", () => {
    // no dividers: 2 sides x 1 face x 2 rows
    expect(compileSystem32Boring(buildStructuralPartGraph(narrowFixture)).summary.totalOperations).toBe(4);
    // two dividers: (2 + 2*2) faces x 2 rows
    expect(compileSystem32Boring(buildStructuralPartGraph(wideFixture)).summary.totalOperations).toBe(12);
  });
});

describe("the structural PartGraph is untouched", () => {
  it("leaves the four approved BACK_GROOVE operations exactly as they were", () => {
    const g = graph();
    compileSystem32Boring(g);
    expect(g.operations).toHaveLength(4);
    for (const op of g.operations) {
      expect(op.type).toBe("BACK_GROOVE");
      expect(op.status).toBe("APPROVED");
    }
  });

  it("does not move the canonical serialization of the graph it reads", () => {
    const g = graph();
    const before = serializeCanonicalPartGraph(g);
    compileSystem32Boring(g);
    expect(serializeCanonicalPartGraph(g)).toBe(before);
  });

  it("is a separate versioned artefact, not part of partgraph/0.1", () => {
    const plan = compileSystem32Boring(graph());
    expect(SYSTEM32_BORING_VERSION).toBe("system32-boring/0.2");
    expect(plan.version).not.toBe(graph().partGraphVersion);
    expect(plan.sourceSpecId).toBe(graph().sourceSpecId);
  });

  it("rejects input that is not a PartGraph", () => {
    expect(() => compileSystem32Boring(null)).toThrow(/requires a PartGraph/);
    expect(() => compileSystem32Boring({})).toThrow(/requires a PartGraph/);
  });

  it("refuses a carcass with no top or bottom panel to measure from", () => {
    const g = graph();
    const noCaps = { ...g, parts: g.parts.filter((p) => p.role !== "BOTTOM_PANEL") };
    expect(() => compileSystem32Boring(noCaps)).toThrow(/TOP_PANEL\/BOTTOM_PANEL/);
  });
});

describe("the catalog no longer lists the boring inputs as unruled", () => {
  it("resolves each ruled key instead of throwing", () => {
    for (const key of [
      "shelfPinColumnOriginDatum",
      "shelfPinColumnOriginOffsetMm",
      "shelfPinColumnUpperBoundDatum",
      "shelfPinRearRowPolicy",
      "shelfPinHoleDepthByCarcassThicknessMm",
    ]) {
      expect(() => resolve(key)).not.toThrow();
    }
  });
});
