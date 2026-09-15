/**
 * Physical limit registry — the fourth provenance class.
 *
 * THE GAP THIS CLOSES
 *
 * `wardrobeRuleCatalog.js` tracks provenance for 31 construction constants and
 * `resolve()` throws on the three nobody has approved. But it is not the only
 * place FurniAI enforces a physical rule. `wardrobe-model/schema.js` DEFAULTS
 * carries fail-closed limits that the validator rejects designs against, and
 * those have no provenance at all — so a limit enforced there is
 * indistinguishable, from the outside, from one Bekzod signed off.
 *
 * That silence is the problem. An unapproved limit that rejects a customer's
 * design is not safer than one that accepts it: both are decisions nobody
 * authorised, and only one of them is visible.
 *
 * THE FOURTH CLASS
 *
 * The catalog's existing states do not fit these. `REQUIRES_BEKZOD_RULING`
 * means "no value exists, so ask" — `resolve()` throws. A fail-closed physical
 * limit is the opposite shape: a value IS enforced, and removing it would
 * weaken safety rather than restore honesty. It needs its own state:
 *
 *   PROVISIONAL_PENDING_BEKZOD_REVIEW
 *     Enforced today. Chosen by an engineer, not approved by Bekzod.
 *     Keep enforcing it; never describe it as approved; surface it for review.
 *
 * WHAT THIS FILE DOES NOT DO
 *
 * It does not define any limit's value. Values live where they are enforced,
 * and this registry names them and reads them from there. Copying a number
 * here would create two sources of truth for one rule, which is the defect it
 * exists to detect.
 */
import { RULE_PROVENANCE, RULE_CATALOG_VERSION } from "./wardrobeRuleCatalog.js";

export const PHYSICAL_LIMIT_PROVENANCE = Object.freeze({
  ...RULE_PROVENANCE,
  /** Enforced, engineer-chosen, NOT approved. Must be reviewed, not removed. */
  PROVISIONAL_PENDING_BEKZOD_REVIEW: "PROVISIONAL_PENDING_BEKZOD_REVIEW",
});

export const PHYSICAL_LIMIT_REGISTRY_VERSION = "physical-limits/0.1";

/**
 * Every fail-closed physical limit FurniAI enforces, by the DEFAULTS key it is
 * read from. `scope` says what it constrains, `unit` how to read the number,
 * `enforcedBy` where a reader can see it rejecting a design.
 *
 * Adding a limit to DEFAULTS without adding it here fails
 * `physicalLimitRegistry.test.js` — that test is the actual mechanism; this
 * table is only its data.
 */
export const PHYSICAL_LIMITS = Object.freeze({
  maxPanelThicknessMm: Object.freeze({
    id: "PL-001",
    unit: "mm",
    scope: "Upper bound on any carcass/panel thickness.",
    enforcedBy: "src/lib/wardrobe-model/validator.js — INVALID_DIMENSION",
    provenance: PHYSICAL_LIMIT_PROVENANCE.PROVISIONAL_PENDING_BEKZOD_REVIEW,
    note: "Plausibility envelope chosen by an engineer. No rulebook entry and no workshop ruling.",
  }),
  minShelfClearanceMm: Object.freeze({
    id: "PL-002",
    unit: "mm",
    scope: "Minimum clear vertical gap between two shelf zones.",
    enforcedBy: "src/lib/wardrobe-model/validator.js — shelf spacing check",
    provenance: PHYSICAL_LIMIT_PROVENANCE.PROVISIONAL_PENDING_BEKZOD_REVIEW,
    note: "Usability floor, not a structural one. Not approved.",
  }),
  minHangingClearanceBelowMm: Object.freeze({
    id: "PL-003",
    unit: "mm",
    scope: "Minimum clear drop below a hanging-rail rod centre.",
    enforcedBy: "src/lib/wardrobe-model/validator.js — INSUFFICIENT_HANGING_CLEARANCE",
    provenance: PHYSICAL_LIMIT_PROVENANCE.PROVISIONAL_PENDING_BEKZOD_REVIEW,
    note: "Garment-length assumption. Widely used in the trade; not approved here, and the trade is not Bekzod.",
  }),
  minHangingInteriorDepthMm: Object.freeze({
    id: "PL-004",
    unit: "mm",
    scope: "Minimum interior depth for a bay carrying a hanging rod.",
    enforcedBy: "src/lib/wardrobe-model/validator.js — INSUFFICIENT_DEPTH_FOR_HANGING",
    provenance: PHYSICAL_LIMIT_PROVENANCE.PROVISIONAL_PENDING_BEKZOD_REVIEW,
    note: "Shoulder-width assumption. Not approved.",
  }),
  maxUnsupportedShelfSpanMm: Object.freeze({
    id: "PL-005",
    unit: "mm",
    scope: "Maximum continuous shelf span with no vertical partition.",
    enforcedBy: "src/lib/wardrobe-model/validator.js — unsupported span check",
    provenance: PHYSICAL_LIMIT_PROVENANCE.PROVISIONAL_PENDING_BEKZOD_REVIEW,
    note:
      "Deflection depends on material, thickness and load, none of which this limit reads. " +
      "A single span number cannot be correct for every material — this is the one most likely to be wrong in both directions.",
  }),
  minDrawerBayClearWidthMm: Object.freeze({
    id: "PL-006",
    unit: "mm",
    scope: "Minimum bay clear width for a DRAWER_BANK (undermount 21mm + L/R box sides 15mm each).",
    enforcedBy: "src/lib/wardrobe-model/kernel.js + validator.js — INSUFFICIENT_BAY_WIDTH_FOR_DRAWERS",
    provenance: PHYSICAL_LIMIT_PROVENANCE.PROVISIONAL_PENDING_BEKZOD_REVIEW,
    note: "Construction floor from emitDrawerBankParts constants; engineer-chosen, not a Bekzod width ruling.",
  }),
});

/** Limits enforced without approval. Non-empty is the expected state today. */
export function provisionalLimits() {
  return Object.freeze(
    Object.entries(PHYSICAL_LIMITS)
      .filter(([, r]) => r.provenance === PHYSICAL_LIMIT_PROVENANCE.PROVISIONAL_PENDING_BEKZOD_REVIEW)
      .map(([key, r]) => ({ key, ...r }))
  );
}

/**
 * Read a limit's enforced value from the module that enforces it, so the
 * registry can never disagree with behaviour.
 *
 * @param {string} key a PHYSICAL_LIMITS key
 * @param {Record<string, number>} defaults the DEFAULTS object from wardrobe-model/schema.js
 */
export function enforcedValueOf(key, defaults) {
  if (!Object.prototype.hasOwnProperty.call(PHYSICAL_LIMITS, key)) {
    throw new Error(`"${key}" is not a registered physical limit.`);
  }
  if (!defaults || !Object.prototype.hasOwnProperty.call(defaults, key)) {
    throw new Error(
      `Physical limit "${key}" is registered but not present in DEFAULTS — the registry and the kernel disagree.`
    );
  }
  return defaults[key];
}

/**
 * The one versioned policy statement, for an operator or a reviewer. Values are
 * read live from the kernel; nothing here is a second copy.
 */
export function rulePolicySummary(defaults) {
  return Object.freeze({
    ruleCatalogVersion: RULE_CATALOG_VERSION,
    physicalLimitRegistryVersion: PHYSICAL_LIMIT_REGISTRY_VERSION,
    limits: Object.entries(PHYSICAL_LIMITS).map(([key, r]) => ({
      key,
      id: r.id,
      value: defaults && key in defaults ? defaults[key] : null,
      unit: r.unit,
      scope: r.scope,
      provenance: r.provenance,
      approved: r.provenance === PHYSICAL_LIMIT_PROVENANCE.GOLDEN_FIXTURE_BEKZOD_APPROVED
        || r.provenance === PHYSICAL_LIMIT_PROVENANCE.RULEBOOK_V0_1,
      enforcedBy: r.enforcedBy,
    })),
  });
}
