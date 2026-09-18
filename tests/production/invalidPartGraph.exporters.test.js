/**
 * PERMANENT invalid-PartGraph exporter regression.
 *
 * Pattern: start from a VALID PartGraph (golden structural build), mutate ONE
 * finished/raw dimension, assert SVG + DXF + CSV + nesting ALL refuse.
 *
 * SVG wording: a returned SVG for invalid input would be a failure to REJECT —
 * not proof a degenerate rectangle was painted. These tests require throw.
 */
import { describe, expect, it } from "vitest";
import goldenFixture from "../../src/lib/furnispec/goldenWardrobe.fixture.json";
import { buildStructuralPartGraph } from "../../src/lib/partgraph/buildStructuralPartGraph.js";
import { generateShopDrawingsSVG } from "../../src/lib/drawing/projectionEngine.js";
import { compilePanelToDxf, compileCabinetDxfPackage } from "../../src/lib/production/dxfCompiler.js";
import {
  generateCutListCsv,
  compileNestingManifest,
  buildCutListRows,
} from "../../src/lib/production/nestingCompiler.js";

function validGraph() {
  return structuredClone(buildStructuralPartGraph(goldenFixture));
}

function mutateFirstPanel(graph, mutator) {
  const g = structuredClone(graph);
  const victim = g.parts.find((p) => p.role === "ADJUSTABLE_SHELF") ?? g.parts[0];
  mutator(victim);
  return { graph: g, victim };
}

const SVG_RE = /non-positive|INVALID_FINISHED|INVALID_RAW|refuses an invalid PartGraph/i;

describe("invalid PartGraph exporters — valid control then mutate one dim", () => {
  it("positive control is accepted by all exporters", () => {
    const g = validGraph();
    expect(() => generateShopDrawingsSVG(g)).not.toThrow();
    expect(() => compileCabinetDxfPackage(g)).not.toThrow();
    expect(() => generateCutListCsv(g)).not.toThrow();
    expect(() => compileNestingManifest(g)).not.toThrow();
  });

  it("zero width (mutate finished+raw widthDmm → 0) refused by SVG+DXF+CSV+nesting", () => {
    const base = validGraph();
    const { graph, victim } = mutateFirstPanel(base, (p) => {
      p.finished.widthDmm = 0;
      p.raw.widthDmm = 0;
    });
    expect(() => generateShopDrawingsSVG(graph)).toThrow(SVG_RE);
    expect(() => compilePanelToDxf(victim)).toThrow(/non-positive/);
    expect(() => compileCabinetDxfPackage(graph)).toThrow(/non-positive/);
    expect(() => generateCutListCsv(graph)).toThrow(/non-positive/);
    expect(() => compileNestingManifest(graph)).toThrow(/non-positive/);
  });

  it("negative width refused by all exporters", () => {
    const { graph, victim } = mutateFirstPanel(validGraph(), (p) => {
      p.finished.widthDmm = -10;
      p.raw.widthDmm = -10;
    });
    expect(() => generateShopDrawingsSVG(graph)).toThrow(SVG_RE);
    expect(() => compilePanelToDxf(victim)).toThrow(/non-positive/);
    expect(() => generateCutListCsv(graph)).toThrow(/non-positive/);
    expect(() => compileNestingManifest(graph)).toThrow(/non-positive/);
  });

  it("zero thickness refused by all exporters", () => {
    const { graph, victim } = mutateFirstPanel(validGraph(), (p) => {
      p.finished.thicknessDmm = 0;
      p.raw.thicknessDmm = 0;
    });
    expect(() => generateShopDrawingsSVG(graph)).toThrow(SVG_RE);
    expect(() => compilePanelToDxf(victim)).toThrow(/non-positive thickness/);
    expect(() => buildCutListRows(graph)).toThrow(/non-positive thickness/);
    expect(() => compileNestingManifest(graph)).toThrow(/non-positive thickness/);
  });

  it("negative thickness refused by all exporters", () => {
    const { graph, victim } = mutateFirstPanel(validGraph(), (p) => {
      p.finished.thicknessDmm = -180;
      p.raw.thicknessDmm = -180;
    });
    expect(() => generateShopDrawingsSVG(graph)).toThrow(SVG_RE);
    expect(() => compilePanelToDxf(victim)).toThrow(/non-positive thickness/);
    expect(() => buildCutListRows(graph)).toThrow(/non-positive thickness/);
  });

  it("supported precision boundary: 0.1 mm (1 dmm) accepted by DXF + cut-list", () => {
    const panel = {
      id: "MIN_POS",
      role: "DRAWER_BACK",
      quantity: 1,
      materialCode: "MEL_WHITE_18",
      geometryType: "RECTANGULAR_PANEL",
      grainDirection: "LENGTH",
      finished: { lengthDmm: 1, widthDmm: 1, thicknessDmm: 1 },
      raw: { lengthDmm: 1, widthDmm: 1, thicknessDmm: 1 },
      edges: { LENGTH_EDGE_1: 0, LENGTH_EDGE_2: 0, WIDTH_EDGE_1: 0, WIDTH_EDGE_2: 0 },
    };
    const g = {
      qualificationStatus: "WORKSHOP_REVIEW_NOT_CNC_QUALIFIED",
      parts: [panel],
      operations: [],
    };
    expect(() => compilePanelToDxf(panel)).not.toThrow();
    const rows = buildCutListRows(g);
    expect(rows[0].cutLengthMm).toBeCloseTo(0.1, 6);
    expect(rows[0].cutWidthMm).toBeCloseTo(0.1, 6);
    expect(rows[0].thicknessMm).toBeCloseTo(0.1, 6);
  });
});
