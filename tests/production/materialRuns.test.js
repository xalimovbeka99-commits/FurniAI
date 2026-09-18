import { describe, it, expect } from "vitest";
import { buildStructuralPartGraph } from "../../src/lib/partgraph/buildStructuralPartGraph.js";
import goldenSpec from "../../src/lib/furnispec/goldenWardrobe.fixture.json";
import { computeMaterialRuns, formatMaterialTupleLabel } from "../../src/components/builder/ExportMenu.jsx";

describe("ExportMenu Multi-Run Nesting & Material Batches Suite", () => {
  it("formats material tuples into human-readable manufacturing labels", () => {
    expect(formatMaterialTupleLabel("MEL_WHITE_18", 18)).toBe("18 mm Carcass Melamine (MEL_WHITE_18)");
    expect(formatMaterialTupleLabel("HDF_WHITE_6", 6)).toBe("6 mm HDF Backing & Drawer Bottoms (HDF_WHITE_6)");
    expect(formatMaterialTupleLabel("BIRCH_PLY_15", 15)).toBe("15 mm Birch Plywood Drawer Boxes (BIRCH_PLY_15)");
  });
  it("computes discrete material runs for standard golden wardrobe", () => {
    const graph = buildStructuralPartGraph(goldenSpec);
    const runs = computeMaterialRuns(graph);

    expect(Array.isArray(runs)).toBe(true);
    expect(runs.length).toBeGreaterThanOrEqual(3);

    const carcassRun = runs.find((r) => r.id === "carcass_18mm");
    expect(carcassRun).toBeDefined();
    expect(carcassRun.name).toBe("Carcass 18mm");
    expect(carcassRun.partsCount).toBe(18);
    expect(carcassRun.sheetCount).toBeGreaterThan(0);
    expect(carcassRun.yieldPct).toBeGreaterThan(0);
    expect(Number.isFinite(carcassRun.yieldPct)).toBe(true);
    expect(carcassRun.status).toBe("Optimized");

    const backRun = runs.find((r) => r.id === "back_6mm");
    expect(backRun).toBeDefined();
    expect(backRun.name).toBe("Back Panel 6mm");
    expect(backRun.partsCount).toBe(1);
    expect(backRun.sheetCount).toBe(1);
    expect(backRun.yieldPct).toBeGreaterThan(0);
    expect(Number.isFinite(backRun.yieldPct)).toBe(true);

    const drawerRun = runs.find((r) => r.id === "drawer_15mm");
    expect(drawerRun).toBeDefined();
    expect(drawerRun.name).toBe("Drawer Box 15mm");
    expect(drawerRun.partsCount).toBe(0);
    expect(drawerRun.sheetCount).toBe(0);
    expect(drawerRun.yieldPct).toBe(0);
    expect(drawerRun.status).toBe("No parts scheduled");
  });

  it("handles synthetic drawer box parts in the 15mm run", () => {
    const graph = buildStructuralPartGraph(goldenSpec);
    const drawerParts = [
      {
        id: "DRAWER_SIDE_L_01",
        role: "DRAWER_SIDE_LEFT",
        quantity: 1,
        materialCode: "MEL_WHITE_15",
        geometryType: "RECTANGULAR_PANEL",
        grainDirection: "LENGTH",
        finished: { lengthDmm: 5000, widthDmm: 1500, thicknessDmm: 150 },
        raw: { lengthDmm: 5000, widthDmm: 1500, thicknessDmm: 150 },
        edges: { LENGTH_EDGE_1: 0, LENGTH_EDGE_2: 0, WIDTH_EDGE_1: 0, WIDTH_EDGE_2: 0 },
      },
      {
        id: "DRAWER_SIDE_R_01",
        role: "DRAWER_SIDE_RIGHT",
        quantity: 1,
        materialCode: "MEL_WHITE_15",
        geometryType: "RECTANGULAR_PANEL",
        grainDirection: "LENGTH",
        finished: { lengthDmm: 5000, widthDmm: 1500, thicknessDmm: 150 },
        raw: { lengthDmm: 5000, widthDmm: 1500, thicknessDmm: 150 },
        edges: { LENGTH_EDGE_1: 0, LENGTH_EDGE_2: 0, WIDTH_EDGE_1: 0, WIDTH_EDGE_2: 0 },
      },
    ];

    const graphWithDrawers = {
      ...graph,
      parts: [...graph.parts, ...drawerParts],
    };

    const runs = computeMaterialRuns(graphWithDrawers);
    const drawerRun = runs.find((r) => r.id === "drawer_15mm");
    expect(drawerRun).toBeDefined();
    expect(drawerRun.partsCount).toBe(2);
    expect(drawerRun.sheetCount).toBeGreaterThan(0);
    expect(drawerRun.yieldPct).toBeGreaterThan(0);
    expect(Number.isFinite(drawerRun.yieldPct)).toBe(true);
  });

  it("guards against unrouted parts and never emits NaN or undefined", () => {
    const graph = buildStructuralPartGraph(goldenSpec);
    const customPart = {
      id: "CUSTOM_THICK_TOP",
      role: "SPECIAL_VALANCE",
      quantity: 1,
      materialCode: "SOLID_OAK_25",
      geometryType: "RECTANGULAR_PANEL",
      grainDirection: "LENGTH",
      finished: { lengthDmm: 18000, widthDmm: 1000, thicknessDmm: 250 },
      raw: { lengthDmm: 18000, widthDmm: 1000, thicknessDmm: 250 },
      edges: { LENGTH_EDGE_1: 0, LENGTH_EDGE_2: 0, WIDTH_EDGE_1: 0, WIDTH_EDGE_2: 0 },
    };

    const graphWithCustom = {
      ...graph,
      parts: [...graph.parts, customPart],
    };

    const runs = computeMaterialRuns(graphWithCustom);
    for (const run of runs) {
      expect(Number.isFinite(run.sheetCount)).toBe(true);
      expect(Number.isFinite(run.yieldPct)).toBe(true);
      expect(Number.isFinite(run.partsCount)).toBe(true);
      expect(run.sheetCount).not.toBeNaN();
      expect(run.yieldPct).not.toBeNaN();
      expect(run.stockFormat).toBeDefined();
      expect(typeof run.stockFormat).toBe("string");
    }

    const unroutedRun = runs.find((r) => r.id === "unrouted");
    expect(unroutedRun).toBeDefined();
    expect(unroutedRun.name).toBe("Other Materials");
    expect(unroutedRun.partsCount).toBe(1);
  });

  it("handles null, empty, or corrupt graphs gracefully without throwing", () => {
    expect(computeMaterialRuns(null)).toEqual([]);
    expect(computeMaterialRuns({})).toEqual([]);
    expect(computeMaterialRuns({ parts: [] })).toBeDefined();

    const corruptPart = { id: "CORRUPT", role: null, finished: null };
    const runs = computeMaterialRuns({ parts: [corruptPart] });
    expect(Array.isArray(runs)).toBe(true);
    for (const run of runs) {
      expect(Number.isNaN(run.sheetCount)).toBe(false);
      expect(Number.isNaN(run.yieldPct)).toBe(false);
    }
  });
});
