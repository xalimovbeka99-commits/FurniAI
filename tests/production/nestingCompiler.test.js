/**
 * Preflight tests for rectangular nesting + cut-list CSV exporter.
 */
import { describe, expect, it } from "vitest";
import fixture from "../../src/lib/furnispec/goldenWardrobe.fixture.json";
import { buildStructuralPartGraph } from "../../src/lib/partgraph/buildStructuralPartGraph.js";
import {
  aabbsOverlap,
  allowedOrientations,
  buildCutListRows,
  canRotateForGrain,
  compileNestingManifest,
  CUT_LIST_CSV_COLUMNS,
  generateCutListCsv,
  normalizeGrainDirection,
  packFfdhShelves,
  resolveCutPanelMm,
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
  lengthDmm,
  widthDmm,
  thicknessDmm = 180,
  grainDirection = "LENGTH",
  edges = { LENGTH_EDGE_1: 0, LENGTH_EDGE_2: 0, WIDTH_EDGE_1: 0, WIDTH_EDGE_2: 0 },
  quantity = 1,
  materialCode = "MEL_WHITE_18",
  raw,
}) {
  const finished = { lengthDmm, widthDmm, thicknessDmm };
  const rawDims =
    raw ||
    {
      lengthDmm: lengthDmm - (edges.WIDTH_EDGE_1 + edges.WIDTH_EDGE_2),
      widthDmm: widthDmm - (edges.LENGTH_EDGE_1 + edges.LENGTH_EDGE_2),
      thicknessDmm,
    };
  return {
    id,
    role,
    quantity,
    materialCode,
    geometryType: "RECTANGULAR_PANEL",
    grainDirection,
    finished,
    raw: rawDims,
    edges,
  };
}

describe("nestingCompiler — grain direction enforcement", () => {
  it("maps LENGTHWISE alias to LENGTH and rejects 90° rotation", () => {
    expect(normalizeGrainDirection("LENGTHWISE")).toBe("LENGTH");
    expect(normalizeGrainDirection("LENGTH")).toBe("LENGTH");
    expect(canRotateForGrain("LENGTHWISE")).toBe(false);
    expect(canRotateForGrain("LENGTH")).toBe(false);
    expect(allowedOrientations("LENGTHWISE")).toEqual(["natural"]);
  });

  it("rejects rotation for WIDTH grain; allows rotation only for NONE", () => {
    expect(canRotateForGrain("WIDTH")).toBe(false);
    expect(canRotateForGrain("NONE")).toBe(true);
    expect(allowedOrientations("NONE")).toEqual(["natural", "rotated"]);
  });

  it("LENGTHWISE/LENGTH parts never appear rotated in the nest", () => {
    const graph = syntheticGraph([
      panel({
        id: "LONG_GRAIN",
        lengthDmm: 8000, // 800 mm
        widthDmm: 4000, // 400 mm
        grainDirection: "LENGTHWISE",
        quantity: 2,
      }),
      panel({
        id: "LEN_GRAIN",
        lengthDmm: 6000,
        widthDmm: 3000,
        grainDirection: "LENGTH",
        quantity: 1,
      }),
    ]);
    const manifest = compileNestingManifest(graph);
    const placements = manifest.sheets.flatMap((s) => s.placements);
    expect(placements.length).toBe(3);
    for (const p of placements) {
      expect(p.orientation).toBe("natural");
      // natural: w = length, h = width
      if (p.partId === "LONG_GRAIN") {
        expect(p.w).toBeCloseTo(800, 1);
        expect(p.h).toBeCloseTo(400, 1);
      }
    }
  });

  it("NONE grain may rotate when it packs better / is allowed", () => {
    // Tall thin strip: natural 100×900 may not fit height on small usable;
    // rotated 900×100 fits width-wise on 1220 sheet with trim.
    // Use a sheet where natural height exceeds usable but rotated fits.
    const graph = syntheticGraph([
      panel({
        id: "FREE_GRAIN",
        lengthDmm: 1000, // 100 mm
        widthDmm: 20000, // 2000 mm — exceeds 1220 usable (1190) naturally as height
        grainDirection: "NONE",
        quantity: 1,
      }),
    ]);
    // Force small stock only via options
    const pack = packFfdhShelves(
      [
        {
          instanceId: "FREE_GRAIN#1",
          partId: "FREE_GRAIN",
          role: "TOP_PANEL",
          grain: "NONE",
          lengthMm: 100,
          widthMm: 2000,
          areaMm2: 100 * 2000,
        },
      ],
      { id: "SHEET_2440x1220", lengthMm: 2440, widthMm: 1220 },
      { kerfMm: 3.5, perimeterTrimMm: 15 }
    );
    // natural: 100×2000 — height 2000 > usable 1190 → only rotated 2000×100 works
    expect(pack.unplaced).toHaveLength(0);
    expect(pack.sheets[0].placements[0].orientation).toBe("rotated");
    expect(pack.sheets[0].placements[0].w).toBeCloseTo(2000, 1);
    expect(pack.sheets[0].placements[0].h).toBeCloseTo(100, 1);

    // LENGTH grain with same dims must fail (cannot rotate)
    const lengthPack = packFfdhShelves(
      [
        {
          instanceId: "LOCKED#1",
          partId: "LOCKED",
          role: "TOP_PANEL",
          grain: "LENGTH",
          lengthMm: 100,
          widthMm: 2000,
          areaMm2: 100 * 2000,
        },
      ],
      { id: "SHEET_2440x1220", lengthMm: 2440, widthMm: 1220 },
      { kerfMm: 3.5, perimeterTrimMm: 15 }
    );
    expect(lengthPack.unplaced.length).toBe(1);
  });
});

describe("nestingCompiler — nested parts never overlap", () => {
  it("AABBs on each sheet do not overlap (kerf-separated)", () => {
    const graph = syntheticGraph([
      panel({ id: "A", lengthDmm: 5000, widthDmm: 4000, quantity: 4, grainDirection: "NONE" }),
      panel({ id: "B", lengthDmm: 7000, widthDmm: 3000, quantity: 3, grainDirection: "LENGTH" }),
      panel({ id: "C", lengthDmm: 9000, widthDmm: 5000, quantity: 2, grainDirection: "WIDTH" }),
    ]);
    const manifest = compileNestingManifest(graph);
    for (const sheet of manifest.sheets) {
      const rects = sheet.placements.map((p) => ({
        x: p.x,
        y: p.y,
        w: p.w,
        h: p.h,
        id: p.instanceId,
      }));
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          expect(aabbsOverlap(rects[i], rects[j])).toBe(false);
        }
      }
    }
  });

  it("golden wardrobe nest has no overlapping placements", () => {
    const graph = buildStructuralPartGraph(fixture);
    const manifest = compileNestingManifest(graph);
    expect(manifest.sheetCount).toBeGreaterThan(0);
    for (const sheet of manifest.sheets) {
      const rects = sheet.placements;
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          expect(
            aabbsOverlap(
              { x: rects[i].x, y: rects[i].y, w: rects[i].w, h: rects[i].h },
              { x: rects[j].x, y: rects[j].y, w: rects[j].w, h: rects[j].h }
            )
          ).toBe(false);
        }
      }
    }
  });
});

describe("nestingCompiler — CSV columns / sample rows", () => {
  it("emits exact column headers", () => {
    const graph = syntheticGraph([
      panel({
        id: "CARC_TOP",
        role: "TOP_PANEL",
        lengthDmm: 10000,
        widthDmm: 5800,
        edges: {
          LENGTH_EDGE_1: 10,
          LENGTH_EDGE_2: 0,
          WIDTH_EDGE_1: 10,
          WIDTH_EDGE_2: 10,
        },
      }),
    ]);
    const csv = generateCutListCsv(graph);
    const header = csv.split("\n")[0];
    expect(header).toBe(CUT_LIST_CSV_COLUMNS.join(","));
    expect(CUT_LIST_CSV_COLUMNS).toEqual([
      "Part ID",
      "Role",
      "Material",
      "Cut Length (mm)",
      "Cut Width (mm)",
      "Thickness (mm)",
      "Qty",
      "Grain",
      "Band L1",
      "Band L2",
      "Band W1",
      "Band W2",
    ]);
  });

  it("sample row uses raw cut sizes and banding mm from edges", () => {
    const graph = syntheticGraph([
      panel({
        id: "CARC_TOP",
        role: "TOP_PANEL",
        lengthDmm: 10000, // finished 1000
        widthDmm: 5800, // finished 580
        thicknessDmm: 180,
        grainDirection: "LENGTH",
        edges: {
          LENGTH_EDGE_1: 10, // 1.0 mm
          LENGTH_EDGE_2: 0,
          WIDTH_EDGE_1: 10,
          WIDTH_EDGE_2: 10,
        },
      }),
    ]);
    const rows = buildCutListRows(graph);
    expect(rows).toHaveLength(1);
    // raw length = 1000 - 1 - 1 = 998; raw width = 580 - 1 - 0 = 579
    expect(rows[0].cutLengthMm).toBeCloseTo(998, 1);
    expect(rows[0].cutWidthMm).toBeCloseTo(579, 1);
    expect(rows[0].thicknessMm).toBeCloseTo(18, 1);
    expect(rows[0].bandL1).toBeCloseTo(1, 1);
    expect(rows[0].bandL2).toBe(0);
    expect(rows[0].bandW1).toBeCloseTo(1, 1);
    expect(rows[0].bandW2).toBeCloseTo(1, 1);

    const csv = generateCutListCsv(graph);
    const dataLine = csv.split("\n")[1];
    expect(dataLine).toContain("CARC_TOP");
    expect(dataLine).toContain("TOP_PANEL");
    expect(dataLine).toContain("MEL_WHITE_18");
    expect(dataLine).toContain("LENGTH");
  });

  it("golden graph CSV has one data row per machinable part", () => {
    const graph = buildStructuralPartGraph(fixture);
    const csv = generateCutListCsv(graph);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe(CUT_LIST_CSV_COLUMNS.join(","));
    expect(lines.length - 1).toBe(graph.parts.length);
  });
});

describe("nestingCompiler — yield / sheet count sanity", () => {
  it("small fixture reports sane sheet count and yield on both stocks", () => {
    // Four 500×400 panels → easily fit on one 2440×1220 with trim/kerf
    const graph = syntheticGraph([
      panel({
        id: "P1",
        lengthDmm: 5000,
        widthDmm: 4000,
        quantity: 4,
        grainDirection: "NONE",
      }),
    ]);
    const manifest = compileNestingManifest(graph);
    expect(manifest.algorithm).toBe("FFDH_SHELF");
    expect(manifest.kerfMm).toBe(3.5);
    expect(manifest.perimeterTrimMm).toBe(15);
    expect(manifest.sheetCount).toBe(1);
    expect(manifest.yieldEfficiencyPct).toBeGreaterThan(0);
    expect(manifest.yieldEfficiencyPct).toBeLessThanOrEqual(100);

    const panelArea = 4 * 500 * 400;
    expect(manifest.totalPanelAreaMm2).toBe(panelArea);
    const expectedYield =
      (panelArea / (manifest.stock.lengthMm * manifest.stock.widthMm * manifest.sheetCount)) * 100;
    expect(manifest.yieldEfficiencyPct).toBeCloseTo(expectedYield, 1);

    expect(manifest.packsByStock.SHEET_2440x1220.sheetCount).toBeGreaterThanOrEqual(1);
    expect(manifest.packsByStock.SHEET_2800x2070.sheetCount).toBeGreaterThanOrEqual(1);
  });

  it("sums edge banding linear meters by thickness", () => {
    const graph = syntheticGraph([
      panel({
        id: "BANDED",
        lengthDmm: 10000,
        widthDmm: 5000,
        quantity: 2,
        edges: {
          LENGTH_EDGE_1: 20, // 2 mm along length (cut length)
          LENGTH_EDGE_2: 20,
          WIDTH_EDGE_1: 10, // 1 mm along width
          WIDTH_EDGE_2: 0,
        },
      }),
    ]);
    const manifest = compileNestingManifest(graph);
    // cut L = 1000-1-0=999; cut W = 500-2-2=496
    // 2mm tape: 2 edges * 999 mm * qty 2 = 3996 mm = 3.996 m
    // 1mm tape: 1 edge * 496 mm * qty 2 = 992 mm = 0.992 m
    expect(manifest.edgeBandingLinearMetersByThicknessMm["2"]).toBeCloseTo(3.996, 3);
    expect(manifest.edgeBandingLinearMetersByThicknessMm["1"]).toBeCloseTo(0.992, 3);
  });

  it("resolveCutPanelMm accepts LENGTHWISE alias on panels", () => {
    const r = resolveCutPanelMm(
      panel({ id: "X", lengthDmm: 1000, widthDmm: 500, grainDirection: "LENGTHWISE" })
    );
    expect(r.grain).toBe("LENGTH");
  });
});
