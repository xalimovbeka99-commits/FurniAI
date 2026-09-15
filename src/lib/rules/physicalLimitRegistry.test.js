/**
 * No physical limit may be enforced without a declared provenance.
 *
 * The mechanism, not the table, is the deliverable here. A fail-closed limit
 * that rejects a customer's design is a decision; if nobody approved it, that
 * must be visible rather than implied by silence. These tests fail when a limit
 * is enforced with no provenance, and when the registry and the kernel disagree
 * about what is enforced.
 *
 * Evidence class: A (parser/unit-only). No provider, no network, no browser.
 */
import { describe, it, expect } from "vitest";
import {
  PHYSICAL_LIMITS,
  PHYSICAL_LIMIT_PROVENANCE,
  PHYSICAL_LIMIT_REGISTRY_VERSION,
  provisionalLimits,
  enforcedValueOf,
  rulePolicySummary,
} from "./physicalLimitRegistry.js";
import { RULE_PROVENANCE, RULE_CATALOG_VERSION } from "./wardrobeRuleCatalog.js";
import { DEFAULTS } from "../wardrobe-model/schema.js";

/**
 * Keys in DEFAULTS that are fail-closed LIMITS rather than nominal defaults.
 * A min/max prefix is the signal: it bounds what a customer may have, whereas
 * `panelThicknessMm` or `drawerRowHeightMm` are starting values a customer can
 * change. Only the former can reject a design.
 */
const LIMIT_KEY = /^(?:min|max)[A-Z]/;

function limitKeysInKernel() {
  return Object.keys(DEFAULTS).filter((k) => LIMIT_KEY.test(k));
}

describe("the drift guard", () => {
  it("registers every fail-closed limit the kernel enforces", () => {
    // THE test. A limit added to DEFAULTS without a registry entry is a limit
    // enforced with no declared provenance — indistinguishable from an
    // approved one, which is the failure this whole file exists to prevent.
    //
    // Envelope bounds on the wardrobe itself (width/height/depth/section width)
    // predate the registry and are excluded by name, not by pattern, so a NEW
    // one cannot slip in behind the exclusion.
    const PRE_EXISTING_ENVELOPE_BOUNDS = new Set([
      "minWardrobeWidthMm", "maxWardrobeWidthMm",
      "minWardrobeHeightMm", "maxWardrobeHeightMm",
      "minWardrobeDepthMm", "maxWardrobeDepthMm",
      "minSectionWidthMm",
      "minDrawerRows", "maxDrawerRows",
      "minDoorLeaves", "maxDoorLeaves",
    ]);

    const unregistered = limitKeysInKernel().filter(
      (k) => !PRE_EXISTING_ENVELOPE_BOUNDS.has(k) && !Object.prototype.hasOwnProperty.call(PHYSICAL_LIMITS, k)
    );

    expect(
      unregistered,
      `These limits are enforced with no declared provenance: ${unregistered.join(", ")}. ` +
        `Register them in physicalLimitRegistry.js — do not delete the limit.`
    ).toEqual([]);
  });

  it("reports a registered limit that the kernel does not define", () => {
    // The other direction. A registry entry with no enforcement is a claim
    // about behaviour that is not true.
    // On integ/f1-claude-handoff (base 8f0cfa1) the five gates from b3288bf
    // are already present in DEFAULTS — `missing` must be empty.
    const missing = Object.keys(PHYSICAL_LIMITS).filter(
      (k) => !Object.prototype.hasOwnProperty.call(DEFAULTS, k)
    );

    expect(missing, `Registered but not in DEFAULTS: ${missing.join(", ")}`).toEqual([]);
  });

  it("reads each enforced value from the kernel, never from a second copy", () => {
    for (const key of Object.keys(PHYSICAL_LIMITS)) {
      if (!Object.prototype.hasOwnProperty.call(DEFAULTS, key)) continue;
      const value = enforcedValueOf(key, DEFAULTS);
      expect(value).toBe(DEFAULTS[key]);
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("refuses to read a limit the kernel does not define", () => {
    expect(() => enforcedValueOf("maxPanelThicknessMm", {})).toThrow(/registry and the kernel disagree/);
    expect(() => enforcedValueOf("notARule", DEFAULTS)).toThrow(/not a registered physical limit/);
  });
});

describe("provenance honesty", () => {
  it("declares all six physical gates provisional, and none approved", () => {
    // No approval for any of these exists in docs/WARDROBE_RULEBOOK_V0.1.md,
    // in the golden fixture, or anywhere else in the repository. Absent that,
    // provisional is the only accurate label.
    expect(provisionalLimits()).toHaveLength(6);
    for (const limit of provisionalLimits()) {
      expect(limit.provenance).toBe(PHYSICAL_LIMIT_PROVENANCE.PROVISIONAL_PENDING_BEKZOD_REVIEW);
      expect(limit.id).toMatch(/^PL-\d{3}$/);
      expect(limit.unit).toBe("mm");
      expect(limit.scope.length).toBeGreaterThan(10);
      expect(limit.enforcedBy).toMatch(/^src\//);
      expect(limit.note.length).toBeGreaterThan(10);
    }
  });

  it("never labels a provisional limit as approved", () => {
    const summary = rulePolicySummary(DEFAULTS);
    for (const limit of summary.limits) {
      if (limit.provenance === PHYSICAL_LIMIT_PROVENANCE.PROVISIONAL_PENDING_BEKZOD_REVIEW) {
        expect(limit.approved, `${limit.key} is provisional but reported approved`).toBe(false);
      }
    }
  });

  it("keeps the new state distinct from REQUIRES_BEKZOD_RULING", () => {
    // They are different situations and must not be conflated: one has no
    // value and must be asked about (resolve() throws), the other has a value
    // that is actively enforced and must not be removed.
    expect(PHYSICAL_LIMIT_PROVENANCE.PROVISIONAL_PENDING_BEKZOD_REVIEW).not.toBe(
      RULE_PROVENANCE.REQUIRES_BEKZOD_RULING
    );
    expect(Object.values(RULE_PROVENANCE)).not.toContain(
      PHYSICAL_LIMIT_PROVENANCE.PROVISIONAL_PENDING_BEKZOD_REVIEW
    );
  });

  it("inherits the catalog's existing provenance classes rather than redefining them", () => {
    for (const [key, value] of Object.entries(RULE_PROVENANCE)) {
      expect(PHYSICAL_LIMIT_PROVENANCE[key]).toBe(value);
    }
  });
});

describe("the versioned policy statement", () => {
  it("names both versions so a reviewer knows what they approved", () => {
    const summary = rulePolicySummary(DEFAULTS);
    expect(summary.ruleCatalogVersion).toBe(RULE_CATALOG_VERSION);
    expect(summary.physicalLimitRegistryVersion).toBe(PHYSICAL_LIMIT_REGISTRY_VERSION);
  });

  it("gives every limit units, scope, provenance and where it is enforced", () => {
    for (const limit of rulePolicySummary(DEFAULTS).limits) {
      expect(limit).toMatchObject({
        id: expect.stringMatching(/^PL-/),
        unit: "mm",
        scope: expect.any(String),
        provenance: expect.any(String),
        enforcedBy: expect.any(String),
        approved: expect.any(Boolean),
      });
    }
  });

  it("invents no approval", () => {
    // The one thing this file must never do.
    const blob = JSON.stringify(rulePolicySummary(DEFAULTS));
    expect(blob).not.toMatch(/BEKZOD_APPROVED/);
    expect(rulePolicySummary(DEFAULTS).limits.some((l) => l.approved)).toBe(false);
  });
});
