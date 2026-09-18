/**
 * M3 contract — oversized panel envelope + split policy (ENFORCED).
 *
 * Max usable sheet: SHEET_2800x2070 minus 15 mm trim each side → 2770×2040 mm.
 * Panels exceeding that envelope reject with PANEL_EXCEEDS_SHEET_ENVELOPE unless
 * an explicit split policy is configured:
 *   TWO_PIECE_TONGUE_AND_GROOVE | H_CHANNEL_SPLICE
 * Seams must align with internal bay divider faces (seam X = divider placement).
 *
 * Status: ENFORCED via evaluateOversizedPanelPolicy + compileNestingManifest preflight.
 */
import { describe, expect, it } from "vitest";
import {
  MAX_USABLE_SHEET_LENGTH_MM,
  MAX_USABLE_SHEET_WIDTH_MM,
  OVERSIZED_SPLIT_POLICIES,
  PANEL_EXCEEDS_SHEET_ENVELOPE,
  compileNestingManifest,
  evaluateOversizedPanelPolicy,
  usableSheetEnvelopeMm,
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
  thicknessMm = 18,
  grainDirection = "LENGTH",
  materialCode = "MEL_WHITE_18",
  quantity = 1,
  splitPolicy,
  dividerPlacementsMm,
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
    ...(splitPolicy ? { splitPolicy } : {}),
    ...(dividerPlacementsMm ? { dividerPlacementsMm } : {}),
  };
}

describe("oversizedPanels — usable envelope constants (ENFORCED)", () => {
  it("SHEET_2800x2070 minus 15 mm trim each side is 2770×2040", () => {
    expect(MAX_USABLE_SHEET_LENGTH_MM).toBe(2770);
    expect(MAX_USABLE_SHEET_WIDTH_MM).toBe(2040);
    const env = usableSheetEnvelopeMm(15, { lengthMm: 2800, widthMm: 2070 });
    expect(env.lengthMm).toBe(2770);
    expect(env.widthMm).toBe(2040);
  });
});

describe("oversizedPanels — reject without split policy (ENFORCED)", () => {
  it("rejects panel longer than 2770 mm with PANEL_EXCEEDS_SHEET_ENVELOPE", () => {
    const result = evaluateOversizedPanelPolicy({
      partId: "TOP_WIDE",
      lengthMm: 3000,
      widthMm: 580,
      grain: "LENGTH",
    });
    expect(result.ok).toBe(false);
    expect(result.oversized).toBe(true);
    expect(result.code).toBe(PANEL_EXCEEDS_SHEET_ENVELOPE);
  });

  it("rejects panel taller than 2040 mm when grain locks orientation", () => {
    const result = evaluateOversizedPanelPolicy({
      partId: "SIDE_TALL",
      lengthMm: 600,
      widthMm: 2100,
      grain: "LENGTH",
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(PANEL_EXCEEDS_SHEET_ENVELOPE);
  });

  it("compileNestingManifest throws PANEL_EXCEEDS_SHEET_ENVELOPE for oversized top", () => {
    const graph = syntheticGraph([
      panel({ id: "TOP_WIDE", lengthMm: 3200, widthMm: 580 }),
    ]);
    expect(() => compileNestingManifest(graph)).toThrow(/PANEL_EXCEEDS_SHEET_ENVELOPE|exceeds usable/i);
    try {
      compileNestingManifest(graph);
    } catch (err) {
      expect(err.code).toBe(PANEL_EXCEEDS_SHEET_ENVELOPE);
    }
  });

  it("accepts panels that fit the envelope", () => {
    const result = evaluateOversizedPanelPolicy({
      partId: "TOP_OK",
      lengthMm: 2400,
      widthMm: 580,
      grain: "LENGTH",
    });
    expect(result.ok).toBe(true);
    expect(result.oversized).toBe(false);
  });
});

describe("oversizedPanels — split policy seams at divider faces (ENFORCED)", () => {
  const dividerX = 1600; // internal bay divider face

  it("TWO_PIECE_TONGUE_AND_GROOVE splits with seam X === divider placement", () => {
    const result = evaluateOversizedPanelPolicy(
      {
        partId: "TOP_SPLIT_TG",
        lengthMm: 3200,
        widthMm: 580,
        grain: "LENGTH",
        splitPolicy: OVERSIZED_SPLIT_POLICIES.TWO_PIECE_TONGUE_AND_GROOVE,
        dividerPlacementsMm: [dividerX],
      }
    );
    expect(result.ok).toBe(true);
    expect(result.oversized).toBe(true);
    expect(result.policy).toBe("TWO_PIECE_TONGUE_AND_GROOVE");
    expect(result.pieces.length).toBe(2);
    expect(result.pieces[1].seamX).toBe(dividerX);
    expect(result.seamXs).toEqual([dividerX]);
    // Pieces must each fit usable envelope
    for (const piece of result.pieces) {
      expect(piece.lengthMm).toBeLessThanOrEqual(2770);
      expect(piece.widthMm).toBeLessThanOrEqual(2040);
    }
  });

  it("H_CHANNEL_SPLICE splits with seam X === divider placement", () => {
    const result = evaluateOversizedPanelPolicy({
      partId: "TOP_SPLIT_H",
      lengthMm: 3000,
      widthMm: 600,
      grain: "LENGTH",
      splitPolicy: OVERSIZED_SPLIT_POLICIES.H_CHANNEL_SPLICE,
      dividerPlacementsMm: [1500],
    });
    expect(result.ok).toBe(true);
    expect(result.policy).toBe("H_CHANNEL_SPLICE");
    expect(result.pieces[1].seamX).toBe(1500);
  });

  it("split policy without divider placements still fails closed", () => {
    const result = evaluateOversizedPanelPolicy({
      partId: "TOP_NO_DIV",
      lengthMm: 3000,
      widthMm: 580,
      grain: "LENGTH",
      splitPolicy: OVERSIZED_SPLIT_POLICIES.TWO_PIECE_TONGUE_AND_GROOVE,
      dividerPlacementsMm: [],
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(PANEL_EXCEEDS_SHEET_ENVELOPE);
  });

  it("compileNestingManifest nests split pieces when policy + dividers configured", () => {
    const graph = syntheticGraph([
      panel({
        id: "TOP_SPLIT",
        lengthMm: 3200,
        widthMm: 580,
        splitPolicy: OVERSIZED_SPLIT_POLICIES.TWO_PIECE_TONGUE_AND_GROOVE,
        dividerPlacementsMm: [dividerX],
      }),
    ]);
    const manifest = compileNestingManifest(graph);
    expect(manifest.oversizedDecisions[0].ok).toBe(true);
    expect(manifest.oversizedDecisions[0].seamXs).toEqual([dividerX]);
    const splitParts = manifest.cutList.filter((r) => String(r.partId).startsWith("TOP_SPLIT__SPLIT_"));
    expect(splitParts.length).toBe(2);
    expect(splitParts.some((r) => r.seamX === dividerX)).toBe(true);
    expect(manifest.sheetCount).toBeGreaterThanOrEqual(1);
  });
});
