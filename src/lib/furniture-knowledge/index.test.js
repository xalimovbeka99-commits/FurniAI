import { describe, it, expect } from "vitest";
import { getCategoryKnowledge, CATEGORIES_WITH_DEDICATED_KNOWLEDGE } from "./index.js";

describe("getCategoryKnowledge dispatch", () => {
  it("lists exactly the categories with dedicated rules", () => {
    expect(new Set(CATEGORIES_WITH_DEDICATED_KNOWLEDGE)).toEqual(
      new Set(["wardrobe", "kitchen", "bookcase", "office_cabinet", "sideboard"])
    );
  });

  it("routes kitchen to its dedicated knowledge, not the generic fallback", () => {
    const knowledge = getCategoryKnowledge("kitchen");
    expect(knowledge.dimensionRules.depth_mm.default).toBe(600);
    expect(knowledge.allowedComponents).toContain("countertop");
  });

  it("routes bookcase to its dedicated knowledge", () => {
    const knowledge = getCategoryKnowledge("bookcase");
    expect(knowledge.dimensionRules.width_mm.default).toBe(1200);
    expect(knowledge.semanticWarnings({ dimensions: { width_mm: 2400 }, components: [{ type: "shelf", quantity: 1 }] })).toContainEqual(
      expect.objectContaining({ code: "UNUSUAL_SHELF_SPAN" })
    );
  });

  it("routes office_cabinet to its dedicated knowledge, correcting the old desk-height default", () => {
    const knowledge = getCategoryKnowledge("office_cabinet");
    expect(knowledge.dimensionRules.height_mm.default).toBe(1800);
  });

  it("routes sideboard to its dedicated knowledge, no longer the generic cabinet fallback", () => {
    // Regression guard: before sideboard.js existed, this type fell through
    // to genericCategory.js and inherited the `cabinet` configurator type's
    // 1800mm height default via genericKnowledgeFor — see sideboard.js's
    // header comment and genericCategory.js's own note about this case.
    const knowledge = getCategoryKnowledge("sideboard");
    expect(knowledge.dimensionRules.height_mm.default).toBe(800);
    expect(knowledge.dimensionRules.height_mm.default).not.toBe(1800);
    expect(knowledge.allowedComponents).not.toBe(null); // generic fallback's signature is `null`; dedicated files restrict it
    expect(knowledge.allowedComponents).toContain("leg");
  });

  it("still falls back to generic knowledge for a type with no dedicated file", () => {
    const knowledge = getCategoryKnowledge("tv_unit");
    expect(knowledge.allowedComponents).toBe(null); // generic fallback's signature: no per-type restriction
  });

  it("returns null for a furniture_type outside the FSL vocabulary", () => {
    expect(getCategoryKnowledge("spaceship")).toBe(null);
  });
});
