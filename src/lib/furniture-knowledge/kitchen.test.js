import { describe, it, expect } from "vitest";
import * as kitchen from "./kitchen.js";

describe("kitchen knowledge", () => {
  it("exposes the documented dimension defaults", () => {
    expect(kitchen.defaultDimensionMm("width_mm")).toBe(3000);
    expect(kitchen.defaultDimensionMm("height_mm")).toBe(2200);
    expect(kitchen.defaultDimensionMm("depth_mm")).toBe(600);
  });

  it("treats hard-bound-but-unusual dimensions as structurally valid", () => {
    expect(kitchen.isStructurallyValidDimension("depth_mm", 300)).toBe(true);
    expect(kitchen.isStandardDimension("depth_mm", 300)).toBe(false);
  });

  it("rejects dimensions outside the hard bounds", () => {
    expect(kitchen.isStructurallyValidDimension("width_mm", 100)).toBe(false);
    expect(kitchen.isStructurallyValidDimension("height_mm", 9000)).toBe(false);
  });

  it("warns on a depth too shallow for a standard worktop", () => {
    const warnings = kitchen.semanticWarnings({ dimensions: { depth_mm: 400 }, components: [] });
    expect(warnings).toContainEqual(expect.objectContaining({ code: "UNUSUAL_KITCHEN_DEPTH" }));
  });

  it("does not warn on a standard depth", () => {
    const warnings = kitchen.semanticWarnings({ dimensions: { depth_mm: 600 }, components: [] });
    expect(warnings.some((w) => w.code === "UNUSUAL_KITCHEN_DEPTH")).toBe(false);
  });

  it("warns when door width implied by count is too wide for base cabinetry", () => {
    const warnings = kitchen.semanticWarnings({
      dimensions: { width_mm: 3000 },
      components: [{ type: "hinged_door", quantity: 2 }], // 1500mm/door
    });
    expect(warnings).toContainEqual(expect.objectContaining({ code: "DOOR_WIDTH_TOO_WIDE" }));
  });

  it("warns when door width implied by count is too narrow", () => {
    const warnings = kitchen.semanticWarnings({
      dimensions: { width_mm: 3000 },
      components: [{ type: "hinged_door", quantity: 20 }], // 150mm/door
    });
    expect(warnings).toContainEqual(expect.objectContaining({ code: "DOOR_WIDTH_TOO_NARROW" }));
  });

  it("applies documented component defaults", () => {
    expect(kitchen.defaultComponentQuantity("shelf")).toBe(1);
    expect(kitchen.defaultComponentQuantity("unknown_type")).toBe(1);
    expect(kitchen.defaultComponentProperties("hinged_door")).toEqual({ soft_close: true });
    expect(kitchen.defaultComponentProperties("internal_led")).toEqual({ activation: "switch" });
    expect(kitchen.defaultMaterialRefFor("countertop")).toBe("facades");
    expect(kitchen.defaultMaterialRefFor("back_panel")).toBe("back_panel");
    expect(kitchen.defaultMaterialRefFor("mirror")).toBe(null); // not a typical kitchen component
  });

  it("keeps a countertop as an allowed (if configurator-unsupported) component", () => {
    expect(kitchen.ALLOWED_COMPONENTS).toContain("countertop");
    expect(kitchen.ALLOWED_COMPONENTS).toContain("corner_cabinet");
  });
});
