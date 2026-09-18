/**
 * M3 contract — multi-material / multi-thickness nesting (ENFORCED).
 *
 * Different materials/thicknesses never share a sheet:
 *   - 18 mm carcass MFC     → group 18 mm
 *   - 6 mm HDF backing      → group 6 mm
 *   - 15 mm birch plywood   → group 15 mm (drawer boxes)
 *
 * Waste/yield is computed per material group (runs[]), never merged as the
 * primary metric.
 *
 * Status: ENFORCED via compileNestingManifest material×thickness grouping.
 */
import { describe, expect, it } from "vitest";
import {
  compileNestingManifest,
  groupCutRowsByMaterialThickness,
  materialThicknessGroupKey,
  buildCutListRows,
} from "../../src/lib/production/nestingCompiler.js";

function syntheticGraph(parts) {
  return {
    qualificationStatus: "WORKSHOP_REVIEW_NOT_CNC_QUALIFIED",
    parts,
    operations: [],
  };
}

function panel({
  id,
  role = "TOP_PANEL",
  lengthMm,
  widthMm,
  thicknessMm,
  materialCode,
  grainDirection = "NONE",
  quantity = 1,
}) {
  const lengthDmm = Math.round(lengthMm * 10);
  const widthDmm = Math.round(widthMm * 10);
  const thicknessDmm = Math.round(thicknessMm * 10);
  return {
    id,
    role,
    quantity,
    materialCode,
    geometryType: "RECTANGULAR_PANEL",
    grainDirection,
    finished: { lengthDmm, widthDmm, thicknessDmm },
    raw: { lengthDmm, widthDmm, thicknessDmm },
    edges: { LENGTH_EDGE_1: 0, LENGTH_EDGE_2: 0, WIDTH_EDGE_1: 0, WIDTH_EDGE_2: 0 },
  };
}

describe("multiMaterialNesting — group keys (ENFORCED)", () => {
  it("builds distinct keys for 18 / 6 / 15 mm material tuples", () => {
    expect(materialThicknessGroupKey({ material: "MEL_WHITE_18", thicknessMm: 18 })).toBe(
      "MEL_WHITE_18|18"
    );
    expect(materialThicknessGroupKey({ material: "HDF_WHITE_6", thicknessMm: 6 })).toBe(
      "HDF_WHITE_6|6"
    );
    expect(materialThicknessGroupKey({ material: "BIRCH_PLY_15", thicknessMm: 15 })).toBe(
      "BIRCH_PLY_15|15"
    );
  });

  it("groupCutRowsByMaterialThickness separates the three shop groups", () => {
    const graph = syntheticGraph([
      panel({
        id: "CARC_SIDE",
        role: "SIDE_PANEL_LEFT",
        lengthMm: 580,
        widthMm: 800,
        thicknessMm: 18,
        materialCode: "MEL_WHITE_18",
        grainDirection: "LENGTH",
      }),
      panel({
        id: "BACK",
        role: "BACK_PANEL",
        lengthMm: 800,
        widthMm: 2000,
        thicknessMm: 6,
        materialCode: "HDF_WHITE_6",
      }),
      panel({
        id: "DRW_SIDE",
        role: "DRAWER_SIDE",
        lengthMm: 450,
        widthMm: 150,
        thicknessMm: 15,
        materialCode: "BIRCH_PLY_15",
      }),
    ]);
    const rows = buildCutListRows(graph);
    const groups = groupCutRowsByMaterialThickness(rows);
    expect(groups.size).toBe(3);
    expect(groups.has("MEL_WHITE_18|18")).toBe(true);
    expect(groups.has("HDF_WHITE_6|6")).toBe(true);
    expect(groups.has("BIRCH_PLY_15|15")).toBe(true);
  });
});

describe("multiMaterialNesting — never share a sheet (ENFORCED)", () => {
  it("18 mm carcass, 6 mm HDF, and 15 mm birch never co-reside on one sheet", () => {
    const graph = syntheticGraph([
      panel({
        id: "CARC_TOP",
        role: "TOP_PANEL",
        lengthMm: 800,
        widthMm: 580,
        thicknessMm: 18,
        materialCode: "MEL_WHITE_18",
        grainDirection: "LENGTH",
        quantity: 2,
      }),
      panel({
        id: "CARC_SHELF",
        role: "FIXED_SHELF",
        lengthMm: 780,
        widthMm: 560,
        thicknessMm: 18,
        materialCode: "MEL_WHITE_18",
        grainDirection: "LENGTH",
        quantity: 2,
      }),
      panel({
        id: "BACK_HDF",
        role: "BACK_PANEL",
        lengthMm: 796,
        widthMm: 2000,
        thicknessMm: 6,
        materialCode: "HDF_WHITE_6",
        grainDirection: "NONE",
      }),
      panel({
        id: "DRW_SIDE_L",
        role: "DRAWER_SIDE",
        lengthMm: 450,
        widthMm: 140,
        thicknessMm: 15,
        materialCode: "BIRCH_PLY_15",
        quantity: 4,
      }),
      panel({
        id: "DRW_BACK",
        role: "DRAWER_BACK",
        lengthMm: 360,
        widthMm: 140,
        thicknessMm: 15,
        materialCode: "BIRCH_PLY_15",
        quantity: 2,
      }),
    ]);

    const manifest = compileNestingManifest(graph);
    expect(manifest.algorithm).toBe("FFDH_SHELF_BY_MATERIAL_THICKNESS");
    expect(manifest.runs.length).toBe(3);

    const byThickness = Object.fromEntries(
      manifest.runs.map((r) => [r.thicknessMm, r])
    );
    expect(byThickness[18]).toBeTruthy();
    expect(byThickness[6]).toBeTruthy();
    expect(byThickness[15]).toBeTruthy();

    // Every sheet belongs to exactly one material×thickness group
    for (const sheet of manifest.sheets) {
      expect(sheet.groupKey || sheet.runGroupKey).toBeTruthy();
      const thickness = sheet.thicknessMm;
      const materials = new Set(sheet.placements.map((p) => p.material));
      const thicknesses = new Set(sheet.placements.map((p) => p.thicknessMm));
      expect(materials.size).toBe(1);
      expect(thicknesses.size).toBe(1);
      expect(thicknesses.has(thickness)).toBe(true);
    }

    // Cross-check: no sheet mixes 18 with 6 or 15
    for (const sheet of manifest.sheets) {
      const tSet = new Set(sheet.placements.map((p) => p.thicknessMm));
      expect(tSet.size).toBe(1);
    }
  });

  it("yield / waste is primary per material group, not a merged global primary", () => {
    const graph = syntheticGraph([
      panel({
        id: "CARC_A",
        lengthMm: 500,
        widthMm: 400,
        thicknessMm: 18,
        materialCode: "MEL_WHITE_18",
        quantity: 4,
      }),
      panel({
        id: "BACK_B",
        lengthMm: 500,
        widthMm: 400,
        thicknessMm: 6,
        materialCode: "HDF_WHITE_6",
        quantity: 1,
      }),
      panel({
        id: "DRW_C",
        lengthMm: 400,
        widthMm: 150,
        thicknessMm: 15,
        materialCode: "BIRCH_PLY_15",
        quantity: 3,
      }),
    ]);

    const manifest = compileNestingManifest(graph);
    expect(manifest.runs.length).toBe(3);

    for (const run of manifest.runs) {
      expect(run.sheetCount).toBeGreaterThanOrEqual(1);
      expect(run.yieldEfficiencyPct).toBeGreaterThan(0);
      expect(run.yieldEfficiencyPct).toBeLessThanOrEqual(100);
      expect(run.totalPanelAreaMm2).toBeGreaterThan(0);
      expect(run.totalSheetAreaMm2).toBeGreaterThan(0);
      const expected =
        (run.totalPanelAreaMm2 / run.totalSheetAreaMm2) * 100;
      expect(run.yieldEfficiencyPct).toBeCloseTo(expected, 1);
    }

    // Blended figure may exist for legacy display but is explicitly non-primary
    expect(manifest.blendedYieldEfficiencyPct).toBeTypeOf("number");
    expect(manifest.algorithmNotes).toMatch(/per run/i);
    expect(manifest.primaryYieldSource).toBeTruthy();

    // Procurement total sheets = sum of independent runs
    const sumSheets = manifest.runs.reduce((n, r) => n + r.sheetCount, 0);
    expect(manifest.sheetCount).toBe(sumSheets);
  });
});

describe("multiMaterialNesting — drawer bottoms pack into HDF_WHITE_6|6 (ENFORCED)", () => {
  it("DRAWER_BOTTOM nests in HDF_WHITE_6|6 run, separate from MEL_WHITE_18|18 carcass", () => {
    const graph = syntheticGraph([
      panel({
        id: "CARC_SIDE",
        role: "SIDE_PANEL_LEFT",
        lengthMm: 580,
        widthMm: 800,
        thicknessMm: 18,
        materialCode: "MEL_WHITE_18",
        grainDirection: "LENGTH",
      }),
      panel({
        id: "DRW_SIDE_L",
        role: "DRAWER_SIDE_L",
        lengthMm: 450,
        widthMm: 140,
        thicknessMm: 18,
        materialCode: "MEL_WHITE_18",
        quantity: 2,
      }),
      panel({
        id: "DRW_BOTTOM_R01",
        role: "DRAWER_BOTTOM",
        lengthMm: 420,
        widthMm: 430,
        thicknessMm: 6,
        materialCode: "HDF_WHITE_6",
        grainDirection: "LENGTH",
      }),
      panel({
        id: "DRW_BOTTOM_R02",
        role: "DRAWER_BOTTOM",
        lengthMm: 420,
        widthMm: 430,
        thicknessMm: 6,
        materialCode: "HDF_WHITE_6",
        grainDirection: "LENGTH",
      }),
    ]);

    const rows = buildCutListRows(graph);
    const groups = groupCutRowsByMaterialThickness(rows);
    expect(groups.has("MEL_WHITE_18|18")).toBe(true);
    expect(groups.has("HDF_WHITE_6|6")).toBe(true);
    expect(groups.has("MEL_WHITE_18|6")).toBe(false);

    const hdfRows = groups.get("HDF_WHITE_6|6").rows;
    expect(hdfRows.every((r) => r.material === "HDF_WHITE_6" && r.thicknessMm === 6)).toBe(true);
    expect(hdfRows.some((r) => /BOTTOM/i.test(r.partId || r.id || ""))).toBe(true);

    const melRows = groups.get("MEL_WHITE_18|18").rows;
    expect(melRows.every((r) => r.material === "MEL_WHITE_18" && r.thicknessMm === 18)).toBe(true);
    expect(melRows.some((r) => /BOTTOM/i.test(r.partId || r.id || ""))).toBe(false);

    const manifest = compileNestingManifest(graph);
    const hdfRun = manifest.runs.find((r) => r.groupKey === "HDF_WHITE_6|6");
    const melRun = manifest.runs.find((r) => r.groupKey === "MEL_WHITE_18|18");
    expect(hdfRun).toBeTruthy();
    expect(melRun).toBeTruthy();
    expect(hdfRun.groupKey).not.toBe(melRun.groupKey);

    // Bottoms never share a sheet with 18 mm melamine
    for (const sheet of manifest.sheets) {
      const materials = new Set(sheet.placements.map((p) => p.material));
      const thicknesses = new Set(sheet.placements.map((p) => p.thicknessMm));
      expect(materials.size).toBe(1);
      expect(thicknesses.size).toBe(1);
      if (materials.has("HDF_WHITE_6")) {
        expect(thicknesses.has(6)).toBe(true);
        expect(materials.has("MEL_WHITE_18")).toBe(false);
      }
    }
  });
});
