/**
 * Adversarial multi-material nesting edge cases (M3 CAM).
 * - Unrecognized material codes must fail-closed with UNROUTED_MATERIAL_ERROR.
 * - Grained stock (birch ply / LENGTHWISE) must not rotate; melamine NONE may.
 */
import { describe, it, expect } from "vitest";
import {
  compileNestingManifest,
  canRotateForGrain,
  allowedOrientations,
  normalizeGrainDirection,
  UNROUTED_MATERIAL_ERROR,
  isRoutedMaterialCode,
  assertRoutedMaterialCode,
} from "../../src/lib/production/nestingCompiler.js";
import { GEOMETRY_TYPES } from "../../src/lib/partgraph/schema.js";

function panel({
  id,
  materialCode,
  grainDirection = "NONE",
  lengthDmm = 6000,
  widthDmm = 4000,
  thicknessDmm = 180,
}) {
  return {
    id,
    role: "SHELF",
    quantity: 1,
    materialCode,
    geometryType: GEOMETRY_TYPES.RECTANGULAR_PANEL,
    grainDirection,
    finished: { lengthDmm, widthDmm, thicknessDmm },
    raw: { lengthDmm, widthDmm, thicknessDmm },
    edges: { LENGTH_EDGE_1: 0, LENGTH_EDGE_2: 0, WIDTH_EDGE_1: 0, WIDTH_EDGE_2: 0 },
  };
}

describe("adversarialNesting — unrouted material fail-closed", () => {
  it("exports UNROUTED_MATERIAL_ERROR and rejects unknown codes from the helper", () => {
    expect(UNROUTED_MATERIAL_ERROR).toBe("UNROUTED_MATERIAL_ERROR");
    expect(isRoutedMaterialCode("MEL_WHITE_18")).toBe(true);
    expect(isRoutedMaterialCode("BIRCH_PLY_15")).toBe(true);
    expect(isRoutedMaterialCode("TOTALLY_FAKE_99")).toBe(false);
    expect(isRoutedMaterialCode("")).toBe(false);
    expect(isRoutedMaterialCode(null)).toBe(false);

    try {
      assertRoutedMaterialCode("TOTALLY_FAKE_99", "P1");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err.code).toBe(UNROUTED_MATERIAL_ERROR);
      expect(err.materialCode).toBe("TOTALLY_FAKE_99");
      expect(err.partId).toBe("P1");
    }
  });

  it("compileNestingManifest throws UNROUTED_MATERIAL_ERROR for unrecognized material (no default bucket)", () => {
    const graph = {
      parts: [
        panel({ id: "OK_CARCASS", materialCode: "MEL_WHITE_18", thicknessDmm: 180 }),
        panel({ id: "BAD_STOCK", materialCode: "UNOBTAINIUM_42", thicknessDmm: 180 }),
      ],
    };

    let caught;
    try {
      compileNestingManifest(graph);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(caught.code).toBe(UNROUTED_MATERIAL_ERROR);
    expect(String(caught.message)).toMatch(/UNOBTAINIUM_42|unrouted/i);
    // Must not silently schedule under UNKNOWN_MATERIAL / Other Materials
    expect(String(caught.message)).not.toMatch(/UNKNOWN_MATERIAL/);
  });

  it("compileNestingManifest throws UNROUTED_MATERIAL_ERROR for empty material code", () => {
    const graph = {
      parts: [panel({ id: "EMPTY_MAT", materialCode: "", thicknessDmm: 180 })],
    };
    expect(() => compileNestingManifest(graph)).toThrowError();
    try {
      compileNestingManifest(graph);
    } catch (err) {
      expect(err.code).toBe(UNROUTED_MATERIAL_ERROR);
    }
  });

  it("still nests when every part uses a routed code", () => {
    const graph = {
      parts: [
        panel({ id: "M18", materialCode: "MEL_WHITE_18", grainDirection: "NONE", thicknessDmm: 180 }),
        panel({ id: "H6", materialCode: "HDF_WHITE_6", grainDirection: "NONE", thicknessDmm: 60, lengthDmm: 8000, widthDmm: 5000 }),
        panel({
          id: "B15",
          materialCode: "BIRCH_PLY_15",
          grainDirection: "LENGTHWISE",
          thicknessDmm: 150,
          lengthDmm: 5000,
          widthDmm: 2000,
        }),
      ],
    };
    const manifest = compileNestingManifest(graph);
    expect(manifest.runs.length).toBeGreaterThanOrEqual(3);
    const materials = new Set(manifest.runs.map((r) => r.material));
    expect(materials.has("MEL_WHITE_18")).toBe(true);
    expect(materials.has("HDF_WHITE_6")).toBe(true);
    expect(materials.has("BIRCH_PLY_15")).toBe(true);
    expect(materials.has("UNKNOWN_MATERIAL")).toBe(false);
  });
});

describe("adversarialNesting — mixed-grain rotation rules", () => {
  it("birch ply / LENGTHWISE must not rotate; melamine NONE may rotate", () => {
    expect(normalizeGrainDirection("LENGTHWISE")).toBe("LENGTH");
    expect(canRotateForGrain("LENGTHWISE")).toBe(false);
    expect(canRotateForGrain("LENGTH")).toBe(false);
    expect(allowedOrientations("LENGTHWISE")).toEqual(["natural"]);

    expect(canRotateForGrain("NONE")).toBe(true);
    expect(allowedOrientations("NONE")).toEqual(["natural", "rotated"]);
  });

  it("LENGTHWISE birch parts never appear rotated in the nest; NONE melamine may", () => {
    const graph = {
      parts: [
        // Tall-and-narrow when natural: forces NONE parts to prefer rotation if helpful,
        // while LENGTHWISE must stay natural-only.
        panel({
          id: "BIRCH_GRAINED",
          materialCode: "BIRCH_PLY_15",
          grainDirection: "LENGTHWISE",
          thicknessDmm: 150,
          lengthDmm: 8000,
          widthDmm: 3000,
        }),
        panel({
          id: "MEL_FREE",
          materialCode: "MEL_WHITE_18",
          grainDirection: "NONE",
          thicknessDmm: 180,
          lengthDmm: 9000,
          widthDmm: 3000,
        }),
      ],
    };
    const manifest = compileNestingManifest(graph);
    const placements = manifest.sheets.flatMap((s) => s.placements || s.parts || []);
    // Support either placements shape
    const all = placements.length
      ? placements
      : manifest.runs.flatMap((r) => (r.sheets || []).flatMap((s) => s.placements || []));

    const birch = all.filter((p) => String(p.partId || p.id || "").includes("BIRCH"));
    expect(birch.length).toBeGreaterThan(0);
    for (const p of birch) {
      const orient = p.orientation || p.placedOrientation || "natural";
      expect(orient).toBe("natural");
    }

    // Melamine NONE: rotation is allowed by policy (may or may not be chosen by packer)
    expect(canRotateForGrain("NONE")).toBe(true);
    const melRun = manifest.runs.find((r) => r.material === "MEL_WHITE_18");
    expect(melRun).toBeDefined();
    expect(melRun.sheetCount).toBeGreaterThan(0);
  });
});
