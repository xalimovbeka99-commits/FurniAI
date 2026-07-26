import { describe, it, expect } from "vitest";
import * as bookcase from "./bookcase.js";

describe("bookcase knowledge", () => {
  it("exposes the documented dimension defaults", () => {
    expect(bookcase.defaultDimensionMm("width_mm")).toBe(1200);
    expect(bookcase.defaultDimensionMm("height_mm")).toBe(2000);
    expect(bookcase.defaultDimensionMm("depth_mm")).toBe(350);
  });

  it("rejects dimensions outside the hard bounds", () => {
    expect(bookcase.isStructurallyValidDimension("depth_mm", 50)).toBe(false);
    expect(bookcase.isStructurallyValidDimension("width_mm", 5000)).toBe(false);
  });

  it("warns when a single-column shelf span is likely to sag under book weight", () => {
    const warnings = bookcase.semanticWarnings({
      dimensions: { width_mm: 2400 },
      components: [{ type: "shelf", quantity: 4 }], // no dividers -> one 2400mm column
    });
    expect(warnings).toContainEqual(expect.objectContaining({ code: "UNUSUAL_SHELF_SPAN" }));
  });

  it("does not warn once enough dividers bring the span back under the limit", () => {
    const warnings = bookcase.semanticWarnings({
      dimensions: { width_mm: 2400 },
      components: [
        { type: "shelf", quantity: 4 },
        { type: "divider", quantity: 3 }, // 4 columns -> 600mm span
      ],
    });
    expect(warnings.some((w) => w.code === "UNUSUAL_SHELF_SPAN")).toBe(false);
  });

  it("does not warn when there are no shelves at all", () => {
    const warnings = bookcase.semanticWarnings({ dimensions: { width_mm: 2400 }, components: [] });
    expect(warnings).toEqual([]);
  });

  it("applies documented component defaults", () => {
    expect(bookcase.defaultComponentQuantity("shelf")).toBe(4);
    expect(bookcase.defaultComponentQuantity("open_shelf")).toBe(4);
    expect(bookcase.defaultComponentProperties("shelf")).toEqual({ adjustable: true });
    expect(bookcase.defaultMaterialRefFor("open_shelf")).toBe("body");
    expect(bookcase.defaultMaterialRefFor("hanging_rail")).toBe(null); // not typical for a bookcase
  });

  it("does not list hanging_rail or mirror as typical bookcase components", () => {
    expect(bookcase.ALLOWED_COMPONENTS).not.toContain("hanging_rail");
    expect(bookcase.ALLOWED_COMPONENTS).not.toContain("mirror");
  });
});
