/**
 * PL-006 — a degenerate drawer part must not reach ANY artifact.
 *
 * WHAT THE HANDOFF ASSUMED, AND WHAT MEASUREMENT FOUND
 *
 * docs/m2/integ/CLAUDE_PL006_REPRODUCTION_HANDOFF.md asks for strictly positive
 * finished dimensions to be enforced, and states that the exporters "still emit
 * this zero-width part without fail-closing". Measured at the three boundary
 * widths through the real published entry points, two of those premises were
 * wrong and one defect was wider than described:
 *
 *   bay      DRAWER_BACK   validatePartGraph   CSV      nesting   DXF      SVG
 *   50.9mm   -0.1mm        invalid             throws   throws    throws   RENDERED
 *   51.0mm    0.0mm        invalid             throws   throws    throws   RENDERED
 *   51.1mm    0.1mm        valid               renders  renders   renders  rendered
 *
 * 1. `validatePartGraph` ALREADY enforced strictly positive finished and raw
 *    dimensions. That instruction needed no code.
 * 2. Three of the four exporters ALREADY failed closed, naming the part. Only
 *    `generateShopDrawingsSVG` rendered — and a shop drawing is the artifact a
 *    workshop actually acts on, so it was the worst one to leave open.
 * 3. A 50.9mm bay produced a NEGATIVE part and did not throw at build time at
 *    all. `minDrawerBayClearWidthMm` is enforced in wardrobe-model's kernel and
 *    validator, which a FurniSpec never passes through — so the FurniSpec path
 *    had no bay-width guard whatsoever. The handoff describes a zero-width
 *    defect; the reachable one was unbounded-negative.
 *
 * A positive-part fixture would have proven none of this. It could not have
 * distinguished "the validator lacks a rule" (false) from "the exporters do not
 * consult it" (true of exactly one), and those need opposite fixes.
 *
 * THE FIX, IN THREE PLACES
 *
 *   emitDrawerBankParts  throws DEGENERATE_DRAWER_GEOMETRY at the source
 *   kernel + validator   compare `<=`, not `<` — at exactly the sum the back is 0mm
 *   projectionEngine     validates before drawing, like the other three
 *
 * Evidence class: A (unit/integration). No browser, no workshop. Nothing here
 * says a 0.1mm drawer back is manufacturable — only that it is arithmetically
 * positive, which is all any rule currently states.
 */
import { describe, it, expect } from "vitest";
import { buildStructuralPartGraph } from "./buildStructuralPartGraph.js";
import { validatePartGraph } from "./validatePartGraph.js";
import { generateCutListCsv, compileNestingManifest } from "../production/nestingCompiler.js";
import { compileCabinetDxfPackage } from "../production/dxfCompiler.js";
import { generateShopDrawingsSVG } from "../drawing/projectionEngine.js";
import { DEFAULTS } from "../wardrobe-model/schema.js";
import goldenFixture from "../furnispec/goldenWardrobe.fixture.json";
import { DRAWER_BOX_SIDE_THICKNESS_MM } from "./emitDrawerBankParts.js";
import { resolve } from "../rules/wardrobeRuleCatalog.js";

/**
 * The construction floor, derived from the emitter's own formula rather than
 * restated as a literal: `backWidth = bay - slideDeduction - 2 * sideThickness`.
 */
const DEDUCTION_SUM_MM = resolve("drawerSlideWidthDeductionMm") + 2 * DRAWER_BOX_SIDE_THICKNESS_MM;

/** A FurniSpec whose single bay is `bayWidthMm` wide and carries one drawer bank. */
function specWithDrawerBayOfWidth(bayWidthMm) {
  const spec = structuredClone(goldenFixture);
  const panelT = spec.carcass.panelThicknessMm;
  spec.bays = [
    {
      id: "bay-01",
      index: 0,
      clearWidthMm: bayWidthMm,
      components: [{ id: "drawer-bank-b1", type: "DRAWER_BANK", offsetFromBottomMm: 0, rows: 1 }],
    },
  ];
  spec.envelope.widthMm = bayWidthMm + 2 * panelT;
  spec.doors.count = 1;
  spec.doors.finishedWidthMm = spec.envelope.widthMm - 2 * spec.doors.reveals.leftMm;
  spec.hardware.hinges.totalCount = spec.hardware.hinges.countPerDoor;
  return spec;
}

/**
 * A PartGraph carrying a degenerate part, built by hand. Needed ONLY to test
 * the exporters' own guards now that the source refuses to produce one — the
 * exporters must still fail closed on a graph that reaches them from anywhere.
 */
function graphWithZeroWidthPart() {
  const graph = structuredClone(buildStructuralPartGraph(goldenFixture));
  const victim = graph.parts.find((p) => p.role === "ADJUSTABLE_SHELF") ?? graph.parts[0];
  victim.finished.widthDmm = 0;
  victim.raw.widthDmm = 0;
  return graph;
}

describe("1. the boundary comes from the formula, not from a chosen number", () => {
  it("sits at the sum of the deductions, read from the emitter's own constant", () => {
    expect(DEDUCTION_SUM_MM).toBe(51);
    expect(DEFAULTS.minDrawerBayClearWidthMm).toBe(DEDUCTION_SUM_MM);
  });

  it("refuses a bay BELOW the sum, which previously built a negative part", () => {
    expect(() => buildStructuralPartGraph(specWithDrawerBayOfWidth(50.9))).toThrow(
      /non-positive back width/
    );
  });

  it("refuses a bay EXACTLY at the sum, which previously built a zero-width part", () => {
    // The off-by-one: the guard compared `<`, so equality was accepted and the
    // back computed to exactly 0mm.
    expect(() => buildStructuralPartGraph(specWithDrawerBayOfWidth(DEDUCTION_SUM_MM))).toThrow(
      /non-positive back width/
    );
  });

  it("names the formula in the refusal, so the number is checkable", () => {
    let message = "";
    try {
      buildStructuralPartGraph(specWithDrawerBayOfWidth(DEDUCTION_SUM_MM));
    } catch (error) {
      message = error.message;
      expect(error.code).toBe("DEGENERATE_DRAWER_GEOMETRY");
    }
    expect(message).toMatch(/bay - 21 - 2 x 15/);
    expect(message).toMatch(/must exceed 51mm/);
  });

  it("accepts one tenth above the sum — arithmetic validity, not manufacturability", () => {
    const graph = buildStructuralPartGraph(specWithDrawerBayOfWidth(DEDUCTION_SUM_MM + 0.1));
    const back = graph.parts.find((p) => p.role === "DRAWER_BACK");
    expect(back.finished.widthDmm).toBe(1);
    expect(validatePartGraph(graph).valid).toBe(true);
    // Deliberately NOT rejected. No rulebook ruling states a practical minimum
    // drawer width, and inventing one (200mm, 300mm) is what the handoff
    // forbids. Recorded in the reconciliation report as an open question.
  });

  it("holds the boundary at 0.1mm precision", () => {
    for (const width of [50.8, 50.9, 51.0]) {
      expect(() => buildStructuralPartGraph(specWithDrawerBayOfWidth(width)), `${width}mm`).toThrow();
    }
    for (const width of [51.1, 51.2, 60]) {
      expect(() => buildStructuralPartGraph(specWithDrawerBayOfWidth(width)), `${width}mm`).not.toThrow();
    }
  });
});

describe("2. the validator's positive-dimension rule already existed", () => {
  it("rejects a zero finished dimension, naming the part", () => {
    const result = validatePartGraph(graphWithZeroWidthPart());
    expect(result.valid).toBe(false);
    const error = result.errors.find((e) => e.code === "INVALID_FINISHED_DIMENSION");
    expect(error).toBeDefined();
    expect(error.message).toMatch(/strictly positive/);
    expect(error.partId).toBeTruthy();
  });
});

describe("3. every artifact entry point fails closed on an invalid PartGraph", () => {
  const ENTRY_POINTS = [
    ["generateCutListCsv", (g) => generateCutListCsv(g)],
    ["compileNestingManifest", (g) => compileNestingManifest(g)],
    ["compileCabinetDxfPackage", (g) => compileCabinetDxfPackage(g)],
    ["generateShopDrawingsSVG", (g) => generateShopDrawingsSVG(g)],
  ];

  it.each(ENTRY_POINTS)("%s refuses a graph the validator rejects", (name, call) => {
    const graph = graphWithZeroWidthPart();
    expect(validatePartGraph(graph).valid, "precondition: the graph is invalid").toBe(false);
    expect(() => call(graph), `${name} rendered an invalid PartGraph`).toThrow(
      /non-positive|invalid PartGraph|INVALID_FINISHED_DIMENSION/i
    );
  });

  it.each(ENTRY_POINTS)("%s still renders a valid PartGraph", (name, call) => {
    const graph = buildStructuralPartGraph(goldenFixture);
    expect(validatePartGraph(graph).valid).toBe(true);
    expect(() => call(graph), `${name} refused a valid PartGraph`).not.toThrow();
  });

  it("names the offending part in the SVG refusal, not just 'invalid'", () => {
    // The SVG guard was the one added here; a refusal a workshop cannot act on
    // is barely better than a drawing it should not act on.
    let message = "";
    try {
      generateShopDrawingsSVG(graphWithZeroWidthPart());
    } catch (error) {
      message = error.message;
    }
    expect(message).toMatch(/generateShopDrawingsSVG/);
    expect(message).toMatch(/INVALID_FINISHED_DIMENSION/);
  });
});

describe("4. rejection is atomic — nothing upstream moves", () => {
  it("leaves a valid design byte-identical when a drawer request is refused", () => {
    const good = buildStructuralPartGraph(goldenFixture);
    const snapshot = JSON.stringify(good);

    expect(() => buildStructuralPartGraph(specWithDrawerBayOfWidth(DEDUCTION_SUM_MM))).toThrow();

    expect(JSON.stringify(good)).toBe(snapshot);
  });

  it("emits no partial drawer parts when one row is degenerate", () => {
    // The emitter validates before it pushes anything, so a refused bank
    // cannot leave a half-built row behind in the parts array.
    let graph = null;
    try {
      graph = buildStructuralPartGraph(specWithDrawerBayOfWidth(DEDUCTION_SUM_MM));
    } catch {
      /* expected */
    }
    expect(graph).toBeNull();
  });

  it("does not disturb the golden fixture's own part count", () => {
    const before = buildStructuralPartGraph(goldenFixture).parts.length;
    try {
      buildStructuralPartGraph(specWithDrawerBayOfWidth(50.9));
    } catch {
      /* expected */
    }
    expect(buildStructuralPartGraph(goldenFixture).parts.length).toBe(before);
  });
});
