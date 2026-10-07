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

  it("names the bay count, doors-per-bay and bay-split rules as unruled", () => {
    // doorsPerBay left this roster on 2026-09-18, when
    // RULEBOOK_V0_2_DOORS_PER_BAY replaced UNRULED-DOORS-PER-BAY. Exact
    // equality is kept so the roster cannot grow or shrink silently.
    expect(unapprovedRuleKeys()).toEqual(["bayCountForWidth", "unevenBayWidthDistribution"]);
  });

  it("resolves approved rules to their Rulebook values", () => {
    expect(resolve("panelThicknessMm")).toBe(18.0);
    expect(resolve("backThicknessMm")).toBe(6.0);
    expect(resolve("doorRevealMm")).toBe(2.0);
    expect(resolve("doorBumperGapMm")).toBe(2.0);
    expect(ruleIdOf("panelThicknessMm")).toBe("WR-003");
    expect(ruleIdOf("doorRevealMm")).toBe("WR-008");
  });

  it("resolves Bekzod 2026-09-15 hardware rulings", () => {
    expect(resolve("shelfPinHoleDepthMm")).toBe(13.0);
    expect(resolve("shelfPinHoleDepthMmByBoardThickness")).toEqual({ 18: 13.0, 16: 11.5 });
    expect(resolve("shelfPinColumnOriginDatum")).toBe("BOTTOM_PANEL_UPPER_FACE_PLUS_64MM");
    expect(resolve("shelfPinColumnOriginUpperDatum")).toBe("TOP_PANEL_LOWER_FACE_MINUS_64MM");
    expect(resolve("shelfPinRearRowPolicy")).toBe("BORED_MIRROR_FRONT_37MM");
    expect(resolve("drawerRunnerFamily")).toBe("UNDERMOUNT_CONCEALED_21MM");
    expect(resolve("drawerSlideWidthDeductionMm")).toBe(21.0);
    expect(resolve("drawerFrontRevealMm")).toBe(2.0);
    expect(WARDROBE_RULES.shelfPinHoleDepthMm.provenance).toBe(RULE_PROVENANCE.BEKZOD_RULING);
    expect(WARDROBE_RULES.drawerSlideWidthDeductionMm.provenance).toBe(RULE_PROVENANCE.BEKZOD_RULING);
  });

  it("is frozen against mutation", () => {
    expect(Object.isFrozen(WARDROBE_RULES)).toBe(true);
    expect(Object.isFrozen(WARDROBE_RULES.panelThicknessMm)).toBe(true);
  });
});
