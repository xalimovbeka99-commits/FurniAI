/**
 * F1 DEFERral lock — UNSUPPORTED_FURNITURE_TYPE consistency.
 *
 * Current behavior (locked, not changed in F1):
 * - FSL validator emits UNSUPPORTED_FURNITURE_TYPE only for types outside
 *   fsl/enums FURNITURE_TYPES (e.g. "spaceship"). Known enum types such as
 *   "kitchen" / "bookcase" are accepted by FSL even when FurniSpec/path-B
 *   cannot represent them.
 * - FurniSpec validator emits UNSUPPORTED_FURNITURE_TYPE for any furnitureType
 *   other than wardrobe.
 * - Wardrobe tools have no furnitureType field and therefore never emit
 *   UNSUPPORTED_FURNITURE_TYPE; unknown component types map to INVALID_ARGUMENT.
 *
 * Unifying these surfaces is deferred past F1. This test locks the asymmetry
 * so a silent drift is visible.
 */
import { describe, expect, test } from "vitest";
import { validateFsl } from "@/lib/fsl/validator.js";
import { ERROR_CODES } from "@/lib/fsl/errors.js";
import { FSL_VERSION, FSL_STATUS, FURNITURE_TYPES } from "@/lib/fsl/enums.js";
import { validateFurniSpec } from "@/lib/furnispec/validate.js";
import golden from "@/lib/furnispec/goldenWardrobe.fixture.json";
import { findTool } from "@/lib/wardrobe-tools/tools.js";

function minimalFsl(furnitureType) {
  return {
    fsl_version: FSL_VERSION,
    status: FSL_STATUS.DRAFT,
    project: { furniture_type: furnitureType, name: "deferral" },
    dimensions: { width_mm: 1800, height_mm: 2400, depth_mm: 600 },
    components: [],
    materials: [],
  };
}

describe("F1 deferral: UNSUPPORTED_FURNITURE_TYPE surface asymmetry", () => {
  test("FSL: unknown type -> UNSUPPORTED_FURNITURE_TYPE", () => {
    const result = validateFsl(minimalFsl("spaceship"));
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: ERROR_CODES.UNSUPPORTED_FURNITURE_TYPE })
    );
  });

  test("FSL: enum kitchen/bookcase are NOT UNSUPPORTED_FURNITURE_TYPE", () => {
    expect(FURNITURE_TYPES).toContain("kitchen");
    expect(FURNITURE_TYPES).toContain("bookcase");
    for (const type of ["kitchen", "bookcase"]) {
      const result = validateFsl(minimalFsl(type));
      expect(result.errors.some((e) => e.code === ERROR_CODES.UNSUPPORTED_FURNITURE_TYPE)).toBe(false);
    }
  });

  test("FurniSpec: non-wardrobe -> UNSUPPORTED_FURNITURE_TYPE", () => {
    const bad = { ...golden, furnitureType: "kitchen" };
    const result = validateFurniSpec(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "UNSUPPORTED_FURNITURE_TYPE")).toBe(true);
  });

  test("Wardrobe tools: unknown component type is INVALID_ARGUMENT, not UNSUPPORTED_FURNITURE_TYPE", () => {
    const created = findTool("wardrobe_create").run(null, { widthMm: 900, heightMm: 2600, depthMm: 600 });
    expect(created.success).toBe(true);
    const added = findTool("component_add").run(created.model, {
      sectionId: created.model.sections[0].id,
      type: "WINE_RACK",
      positionMm: 900,
    });
    expect(added.success).toBe(false);
    expect(added.error).toBe("INVALID_ARGUMENT");
    expect(added.error).not.toBe("UNSUPPORTED_FURNITURE_TYPE");
  });
});
