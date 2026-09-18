import { describe, expect, it } from "vitest";
import {
  RULE_PROVENANCE,
  UnapprovedRuleError,
  WARDROBE_RULES,
  resolve,
  ruleIdOf,
  unapprovedRuleKeys,
} from "./wardrobeRuleCatalog.js";

describe("wardrobe rule catalog", () => {
  it("gives every rule an id, a provenance and a note", () => {
    for (const [key, record] of Object.entries(WARDROBE_RULES)) {
      expect(typeof record.id, key).toBe("string");
      expect(record.id.length, key).toBeGreaterThan(0);
      expect(Object.values(RULE_PROVENANCE), key).toContain(record.provenance);
      expect(record.note.length, key).toBeGreaterThan(0);
    }
  });

  it("refuses to apply any rule that still needs a Bekzod ruling", () => {
    const unapproved = unapprovedRuleKeys();
    expect(unapproved.length).toBeGreaterThan(0);
    for (const key of unapproved) {
      expect(() => resolve(key)).toThrow(UnapprovedRuleError);
      expect(WARDROBE_RULES[key].value).toBeNull();
    }
  });

  it("names every rule that still needs a Bekzod ruling, by key", () => {
    // Exact equality on purpose: this roster must not grow or shrink silently.
    // It grew by three when the System 32 boring compiler was added. WR-009
    // approves the 32.0mm pitch and the 37.0mm front setback, and in the same
    // Rulebook row blocks the drilling coordinates. Three inputs a hole column
    // actually needs are stated nowhere: the hole depth (the 12-14mm figure in
    // docs/knowledge-base/construction-standards.md cites Wikipedia, not
    // Bekzod), the column origin datum, and whether a rear row is bored at all.
    // They are registered as unruled rather than chosen, so resolve() throws on
    // each and the boring compiler reports them instead of guessing.
    expect(unapprovedRuleKeys()).toEqual([
      "bayCountForWidth",
      "doorsPerBay",
      "shelfPinColumnOriginDatum",
      "shelfPinHoleDepthMm",
      "shelfPinRearRowPolicy",
      "unevenBayWidthDistribution",
    ]);
  });

  it("resolves approved rules to their Rulebook values", () => {
    expect(resolve("panelThicknessMm")).toBe(18.0);
    expect(resolve("backThicknessMm")).toBe(6.0);
    expect(resolve("doorRevealMm")).toBe(2.0);
    expect(resolve("doorBumperGapMm")).toBe(2.0);
    expect(ruleIdOf("panelThicknessMm")).toBe("WR-003");
    expect(ruleIdOf("doorRevealMm")).toBe("WR-008");
  });

  it("is frozen against mutation", () => {
    expect(Object.isFrozen(WARDROBE_RULES)).toBe(true);
    expect(Object.isFrozen(WARDROBE_RULES.panelThicknessMm)).toBe(true);
  });
});
