import { describe, it, expect } from "vitest";
import * as sideboard from "./sideboard.js";
import { validateFsl } from "../fsl/validator.js";
import { FSL_VERSION } from "../fsl/enums.js";

function baseSideboardFsl(overrides = {}) {
  return {
    fsl_version: FSL_VERSION,
    project: { name: "Sideboard", furniture_type: "sideboard", subtype: null, description: "A sideboard." },
    dimensions: { width_mm: 1600, height_mm: 800, depth_mm: 450 },
    style: { theme: "contemporary", primary_color: "walnut", secondary_color: null, finish: "satin", door_style: "flat_panel", handle_style: "bar" },
    materials: {
      body: { material: "particle_board", thickness_mm: 18, finish: "walnut" },
      facades: { material: "laminate", thickness_mm: 18, finish: "walnut" },
      back_panel: { material: "hdf", thickness_mm: 6, finish: "grey" },
    },
    layout: { section_count: 2, configuration: "linear" },
    components: [],
    appliances: [],
    features: [],
    views: ["front", "side", "top", "isometric"],
    assumptions: [],
    warnings: [],
    missing_information: [],
    metadata: {},
    status: "ready",
    ...overrides,
  };
}

describe("sideboard knowledge", () => {
  it("defaults to a low, wide piece, not the inherited 1800mm tall cabinet default", () => {
    // Regression guard: before this file existed, sideboard inherited the
    // generic fallback's 1800mm default via the `cabinet` configurator type
    // — see this file's header comment.
    expect(sideboard.defaultDimensionMm("height_mm")).toBe(800);
    expect(sideboard.defaultDimensionMm("height_mm")).not.toBe(1800);
    expect(sideboard.defaultDimensionMm("width_mm")).toBe(1600);
    expect(sideboard.defaultDimensionMm("depth_mm")).toBe(450);
  });

  it("treats the approved standard ranges as valid without warning", () => {
    expect(sideboard.isStandardDimension("width_mm", 1200)).toBe(true);
    expect(sideboard.isStandardDimension("width_mm", 2000)).toBe(true);
    expect(sideboard.isStandardDimension("height_mm", 750)).toBe(true);
    expect(sideboard.isStandardDimension("height_mm", 900)).toBe(true);
    expect(sideboard.isStandardDimension("depth_mm", 400)).toBe(true);
    expect(sideboard.isStandardDimension("depth_mm", 500)).toBe(true);
  });

  it("flags dimensions outside the standard range as unusual but still valid", () => {
    expect(sideboard.isStructurallyValidDimension("height_mm", 1100)).toBe(true);
    expect(sideboard.isStandardDimension("height_mm", 1100)).toBe(false);
  });

  it("rejects dimensions outside the hard bounds", () => {
    expect(sideboard.isStructurallyValidDimension("width_mm", 300)).toBe(false);
    expect(sideboard.isStructurallyValidDimension("height_mm", 1800)).toBe(false);
    expect(sideboard.isStructurallyValidDimension("depth_mm", 700)).toBe(false);
  });

  it("warns when drawer width implied by count is too narrow", () => {
    const warnings = sideboard.semanticWarnings({
      dimensions: { width_mm: 1600 },
      components: [{ type: "drawer", quantity: 6 }], // ~267mm/drawer
    });
    expect(warnings).toContainEqual(expect.objectContaining({ code: "SIDEBOARD_DRAWER_TOO_NARROW" }));
  });

  it("warns when drawer width implied by count is too wide for a single slide run", () => {
    const warnings = sideboard.semanticWarnings({
      dimensions: { width_mm: 1600 },
      components: [{ type: "drawer", quantity: 2 }], // 800mm/drawer
    });
    expect(warnings).toContainEqual(expect.objectContaining({ code: "SIDEBOARD_DRAWER_TOO_WIDE" }));
  });

  it("does not warn on a sensible drawer width", () => {
    const warnings = sideboard.semanticWarnings({
      dimensions: { width_mm: 1600 },
      components: [{ type: "drawer", quantity: 3 }], // ~533mm/drawer
    });
    expect(warnings).toEqual([]);
  });

  it("applies documented default materials", () => {
    expect(sideboard.DEFAULT_MATERIALS.body.material).toBe("particle_board");
    expect(sideboard.DEFAULT_MATERIALS.facades.material).toBe("laminate");
    expect(sideboard.DEFAULT_MATERIALS.back_panel.material).toBe("hdf");
  });

  it("applies documented component defaults", () => {
    expect(sideboard.defaultComponentQuantity("shelf")).toBe(2);
    expect(sideboard.defaultComponentProperties("drawer")).toEqual({ soft_close: true });
    expect(sideboard.defaultMaterialRefFor("shelf")).toBe("body");
    expect(sideboard.defaultMaterialRefFor("mirror")).toBe(null); // not an allowed sideboard component
  });

  it("keeps leg as an allowed (if configurator-unsupported) component, with no forced default", () => {
    expect(sideboard.ALLOWED_COMPONENTS).toContain("leg");
    // `leg` intentionally has no entry in the default-quantity/properties
    // maps — it must never appear unless the request already asked for it.
    expect(sideboard.defaultComponentQuantity("leg")).toBe(1); // generic fallback, only reached if already present
    expect(sideboard.defaultComponentProperties("leg")).toEqual({});
  });

  it("excludes hanging_rail and mirror as atypical sideboard components", () => {
    expect(sideboard.ALLOWED_COMPONENTS).not.toContain("hanging_rail");
    expect(sideboard.ALLOWED_COMPONENTS).not.toContain("mirror");
  });

  it("reports full configurator compatibility for a sideboard with only supported components", () => {
    const fsl = baseSideboardFsl({
      components: [
        { id: "door-1", type: "hinged_door", quantity: 2, position: null, dimensions: null, material_ref: "facades", properties: { soft_close: true } },
        { id: "drawer-1", type: "drawer", quantity: 3, position: null, dimensions: null, material_ref: "facades", properties: { soft_close: true } },
      ],
    });
    const result = validateFsl(fsl, { target: "configurator" });
    expect(result.errors).toEqual([]);
    expect(result.compatibility.compatible).toBe(true);
    expect(result.compatibility.unsupported_fields).toEqual([]);
  });

  it("marks a sideboard with legs as partially_supported, not silently compatible", () => {
    const fsl = baseSideboardFsl({
      components: [
        { id: "leg-1", type: "leg", quantity: 4, position: null, dimensions: null, material_ref: "body", properties: {} },
      ],
    });
    const result = validateFsl(fsl, { target: "configurator" });
    expect(result.errors).toEqual([]);
    expect(result.compatibility.compatible).toBe(false);
    expect(result.compatibility.unsupported_fields.some((f) => f.message.includes("leg"))).toBe(true);
  });
});
