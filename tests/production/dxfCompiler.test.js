/**
 * Preflight tests for the gated DXF CNC layer compiler.
 */
import { describe, expect, it } from "vitest";
import fixture from "../../src/lib/furnispec/goldenWardrobe.fixture.json";
import { buildStructuralPartGraph } from "../../src/lib/partgraph/buildStructuralPartGraph.js";
import {
  compilePanelToDxf,
  compileCabinetDxfPackage,
  DXF_LAYERS,
  dxfHasLayer,
  extractClosedPolylines,
  extractCircles,
  isSystem32DrillingApproved,
} from "../../src/lib/production/dxfCompiler.js";

function assertClosed(verts) {
  expect(verts.length).toBeGreaterThanOrEqual(4);
  const [fx, fy] = verts[0];
  const [lx, ly] = verts[verts.length - 1];
  expect(fx).toBeCloseTo(lx, 6);
  expect(fy).toBeCloseTo(ly, 6);
}

function outlineBounds(outlineVerts) {
  const xs = outlineVerts.map((v) => v[0]);
  const ys = outlineVerts.map((v) => v[1]);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function polylineInside(outline, poly, eps = 1e-6) {
  const b = outlineBounds(outline);
  return poly.every(
    ([x, y]) =>
      x >= b.minX - eps &&
      x <= b.maxX + eps &&
      y >= b.minY - eps &&
      y <= b.maxY + eps
  );
}

describe("dxfCompiler — OUTLINE_CONTOUR closed polylines", () => {
  it("emits a closed OUTLINE_CONTOUR (first == last vertex) for a flat panel", () => {
    const dxf = compilePanelToDxf({
      id: "TEST_PANEL",
      lengthMm: 800,
      widthMm: 580,
      thicknessMm: 18,
    });
    const outlines = extractClosedPolylines(dxf, DXF_LAYERS.OUTLINE_CONTOUR);
    expect(outlines.length).toBe(1);
    assertClosed(outlines[0]);
    expect(outlines[0][0][0]).toBeCloseTo(0, 6);
    expect(outlines[0][0][1]).toBeCloseTo(0, 6);
  });

  it("keeps every golden-package OUTLINE_CONTOUR closed", () => {
    const graph = buildStructuralPartGraph(fixture);
    const pack = compileCabinetDxfPackage(graph);
    expect(pack.length).toBeGreaterThan(0);
    for (const entry of pack) {
      const outlines = extractClosedPolylines(entry.dxfContent, DXF_LAYERS.OUTLINE_CONTOUR);
      expect(outlines.length).toBeGreaterThanOrEqual(1);
      for (const verts of outlines) assertClosed(verts);
    }
  });
});

describe("dxfCompiler — groove never crosses outer boundary", () => {
  it("keeps GROOVE_BACK_PANEL inside OUTLINE_CONTOUR on groove host panels", () => {
    const graph = buildStructuralPartGraph(fixture);
    const hosts = graph.parts.filter((p) =>
      ["TOP_PANEL", "BOTTOM_PANEL", "SIDE_PANEL_LEFT", "SIDE_PANEL_RIGHT"].includes(p.role)
    );
    expect(hosts.length).toBeGreaterThanOrEqual(4);

    for (const panel of hosts) {
      const ops = (graph.operations || []).filter((o) => o.hostPartId === panel.id);
      const dxf = compilePanelToDxf(panel, { operations: ops, partGraph: graph });
      expect(dxfHasLayer(dxf, DXF_LAYERS.GROOVE_BACK_PANEL)).toBe(true);

      const outlines = extractClosedPolylines(dxf, DXF_LAYERS.OUTLINE_CONTOUR);
      const grooves = extractClosedPolylines(dxf, DXF_LAYERS.GROOVE_BACK_PANEL);
      expect(grooves.length).toBe(1);
      assertClosed(grooves[0]);
      expect(polylineInside(outlines[0], grooves[0])).toBe(true);
    }
  });

  it("does not put a groove on BACK_PANEL insert by default", () => {
    const graph = buildStructuralPartGraph(fixture);
    const back = graph.parts.find((p) => p.role === "BACK_PANEL");
    const dxf = compilePanelToDxf(back, { partGraph: graph });
    expect(dxfHasLayer(dxf, DXF_LAYERS.GROOVE_BACK_PANEL)).toBe(false);
  });
});

describe("dxfCompiler — DRILL_SYSTEM_32 fail-closed gate", () => {
  const sidePanel = {
    id: "SIDE_TEST",
    role: "SIDE_PANEL_LEFT",
    lengthMm: 2200,
    widthMm: 580,
    thicknessMm: 18,
    system32Host: true,
  };

  it("omits DRILL_SYSTEM_32 when drilling is not explicitly approved", () => {
    const dxf = compilePanelToDxf(sidePanel, {
      qualificationStatus: "CNC_QUALIFIED",
    });
    expect(dxfHasLayer(dxf, DXF_LAYERS.DRILL_SYSTEM_32)).toBe(false);
    expect(extractCircles(dxf, DXF_LAYERS.DRILL_SYSTEM_32)).toHaveLength(0);
  });

  it("omits DRILL_SYSTEM_32 when qualification is not CNC_QUALIFIED (workshop status)", () => {
    const dxf = compilePanelToDxf(sidePanel, {
      approveSystem32Drilling: true,
      qualificationStatus: "WORKSHOP_REVIEW_NOT_CNC_QUALIFIED",
    });
    expect(isSystem32DrillingApproved({
      approveSystem32Drilling: true,
      qualificationStatus: "WORKSHOP_REVIEW_NOT_CNC_QUALIFIED",
    })).toBe(false);
    expect(dxfHasLayer(dxf, DXF_LAYERS.DRILL_SYSTEM_32)).toBe(false);
  });

  it("omits DRILL_SYSTEM_32 on golden PartGraph (never invents CNC_QUALIFIED)", () => {
    const graph = buildStructuralPartGraph(fixture);
    expect(graph.qualificationStatus).not.toBe("CNC_QUALIFIED");
    const pack = compileCabinetDxfPackage(graph, { approveSystem32Drilling: true });
    for (const entry of pack) {
      expect(dxfHasLayer(entry.dxfContent, DXF_LAYERS.DRILL_SYSTEM_32)).toBe(false);
    }
  });

  it("emits DRILL_SYSTEM_32 only when approve + CNC_QUALIFIED are both explicit", () => {
    const dxf = compilePanelToDxf(sidePanel, {
      approveSystem32Drilling: true,
      qualificationStatus: "CNC_QUALIFIED",
      system32Holes: [
        { x: 100, y: 37 },
        { x: 132, y: 37 },
      ],
    });
    expect(dxfHasLayer(dxf, DXF_LAYERS.DRILL_SYSTEM_32)).toBe(true);
    const circles = extractCircles(dxf, DXF_LAYERS.DRILL_SYSTEM_32);
    expect(circles).toHaveLength(2);
    for (const c of circles) {
      expect(c.r).toBeCloseTo(2.5, 5);
    }
    expect(dxf).toMatch(/depthMm=13/);
  });
});

describe("dxfCompiler — cabinet package metadata", () => {
  it("returns metadata fields for every machinable panel from golden PartGraph", () => {
    const graph = buildStructuralPartGraph(fixture);
    const pack = compileCabinetDxfPackage(graph);
    expect(pack.length).toBe(graph.parts.length);

    for (const entry of pack) {
      expect(entry.filename).toMatch(/\.dxf$/);
      expect(entry.filename).toBe(`${entry.metadata.partId}.dxf`);
      expect(entry.dxfContent).toContain("OUTLINE_CONTOUR");
      expect(entry.metadata).toMatchObject({
        partId: expect.any(String),
        role: expect.any(String),
        boardThicknessMm: expect.any(Number),
        materialCode: expect.any(String),
        grainDirection: expect.any(String),
      });
      expect(entry.metadata.edgeBanding).toEqual(
        expect.objectContaining({
          L1: expect.any(Number),
          L2: expect.any(Number),
          W1: expect.any(Number),
          W2: expect.any(Number),
        })
      );
      expect(entry.metadata.boardThicknessMm).toBeGreaterThan(0);
    }

    const top = pack.find((e) => e.metadata.partId === "CARC_TOP");
    expect(top).toBeTruthy();
    expect(top.metadata.edgeBanding.L1).toBe(1); // front visible 1.0 mm (10 dmm)
  });

  it("skips non-machinable / accessory panels", () => {
    const synthetic = {
      qualificationStatus: "WORKSHOP_REVIEW_NOT_CNC_QUALIFIED",
      parts: [
        {
          id: "GOOD",
          role: "TOP_PANEL",
          geometryType: "RECTANGULAR_PANEL",
          materialCode: "MDF_18",
          grainDirection: "LENGTH",
          finished: { lengthDmm: 10000, widthDmm: 5800, thicknessDmm: 180 },
          edges: {
            LENGTH_EDGE_1: 10,
            LENGTH_EDGE_2: 0,
            WIDTH_EDGE_1: 10,
            WIDTH_EDGE_2: 10,
          },
        },
        {
          id: "SKIP_ACCESSORY",
          role: "FIXED_SHELF",
          geometryType: "RECTANGULAR_PANEL",
          group: "accessory",
          finished: { lengthDmm: 5000, widthDmm: 4000, thicknessDmm: 180 },
          edges: {
            LENGTH_EDGE_1: 0,
            LENGTH_EDGE_2: 0,
            WIDTH_EDGE_1: 0,
            WIDTH_EDGE_2: 0,
          },
        },
        {
          id: "SKIP_FLAG",
          role: "DOOR_PANEL",
          geometryType: "RECTANGULAR_PANEL",
          nonMachinable: true,
          finished: { lengthDmm: 20000, widthDmm: 4000, thicknessDmm: 180 },
          edges: {
            LENGTH_EDGE_1: 10,
            LENGTH_EDGE_2: 10,
            WIDTH_EDGE_1: 10,
            WIDTH_EDGE_2: 10,
          },
        },
      ],
      operations: [],
    };
    const pack = compileCabinetDxfPackage(synthetic);
    expect(pack.map((p) => p.filename)).toEqual(["GOOD.dxf"]);
    expect(pack[0].metadata.edgeBanding).toEqual({ L1: 1, L2: 0, W1: 1, W2: 1 });
  });
});