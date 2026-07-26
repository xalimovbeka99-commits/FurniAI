import { describe, it, expect } from "vitest";
import * as officeCabinet from "./officeCabinet.js";

describe("office_cabinet knowledge", () => {
  it("defaults to a tall storage cabinet, not desk height", () => {
    // Regression guard: before this file existed, office_cabinet inherited
    // the generic fallback's 750mm desk-height default via the `office`
    // configurator type — see this file's header comment.
    expect(officeCabinet.defaultDimensionMm("height_mm")).toBe(1800);
    expect(officeCabinet.defaultDimensionMm("height_mm")).not.toBe(750);
  });

  it("still treats desk height as a structurally valid, in-range value", () => {
    expect(officeCabinet.isStructurallyValidDimension("height_mm", 750)).toBe(true);
    expect(officeCabinet.isStandardDimension("height_mm", 750)).toBe(true);
  });

  it("rejects dimensions outside the hard bounds", () => {
    expect(officeCabinet.isStructurallyValidDimension("width_mm", 100)).toBe(false);
    expect(officeCabinet.isStructurallyValidDimension("height_mm", 3000)).toBe(false);
  });

  it("warns when drawer width implied by count is too narrow to be useful for filing", () => {
    const warnings = officeCabinet.semanticWarnings({
      dimensions: { width_mm: 900 },
      components: [{ type: "drawer", quantity: 5 }], // 180mm/drawer
    });
    expect(warnings).toContainEqual(expect.objectContaining({ code: "FILING_DRAWER_TOO_NARROW" }));
  });

  it("warns when drawer width implied by count is too wide for a single slide run", () => {
    const warnings = officeCabinet.semanticWarnings({
      dimensions: { width_mm: 1200 },
      components: [{ type: "drawer", quantity: 1 }], // 1200mm/drawer
    });
    expect(warnings).toContainEqual(expect.objectContaining({ code: "FILING_DRAWER_TOO_WIDE" }));
  });

  it("does not warn on a sensible drawer width", () => {
    const warnings = officeCabinet.semanticWarnings({
      dimensions: { width_mm: 900 },
      components: [{ type: "drawer", quantity: 2 }], // 450mm/drawer
    });
    expect(warnings).toEqual([]);
  });

  it("applies documented component defaults", () => {
    expect(officeCabinet.defaultComponentQuantity("shelf")).toBe(3);
    expect(officeCabinet.defaultComponentProperties("drawer")).toEqual({ soft_close: true });
    expect(officeCabinet.defaultMaterialRefFor("shelf")).toBe("body");
    expect(officeCabinet.defaultMaterialRefFor("mirror")).toBe(null); // not a typical office cabinet component
  });
});
