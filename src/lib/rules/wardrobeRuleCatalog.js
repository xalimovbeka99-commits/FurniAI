/**
 * FurniAI — Wardrobe Rule Catalog v0.1 (Gate G4 / AI-Alpha)
 * ---------------------------------------------------------------------
 * SAFETY CONTRACT
 *
 * No agent may author a furniture rule. Every constant in this catalog is
 * addressable data with explicit provenance pointing at a Bekzod-approved
 * source. Three provenance classes exist:
 *
 *   RULEBOOK_V0_1                  docs/WARDROBE_RULEBOOK_V0.1.md, by rule ID.
 *   GOLDEN_FIXTURE_BEKZOD_APPROVED src/lib/furnispec/goldenWardrobe.fixture.json.
 *   REQUIRES_BEKZOD_RULING         NOT approved. Must NEVER be applied silently;
 *                                  `resolve()` throws, forcing a clarification gap.
 *
 * This file contains no numeric literal that is not attached to a rule record.
 */

export const RULE_PROVENANCE = Object.freeze({
  RULEBOOK_V0_1: "RULEBOOK_V0_1",
  GOLDEN_FIXTURE_BEKZOD_APPROVED: "GOLDEN_FIXTURE_BEKZOD_APPROVED",
  REQUIRES_BEKZOD_RULING: "REQUIRES_BEKZOD_RULING",
});

export const RULE_CATALOG_VERSION = "wardrobe-rules/0.1";

/** @returns {Readonly<{id:string,value:any,provenance:string,note:string}>} */
function rule(id, value, provenance, note) {
  return Object.freeze({ id, value, provenance, note });
}

const { RULEBOOK_V0_1, GOLDEN_FIXTURE_BEKZOD_APPROVED, REQUIRES_BEKZOD_RULING } = RULE_PROVENANCE;

export const WARDROBE_RULES = Object.freeze({
  constructionStyle: rule("WR-001", "CAP_STYLE", RULEBOOK_V0_1, "Cap Style (Style B): top/bottom cap the outer sides and divider."),

  panelThicknessMm: rule("WR-003", 18.0, RULEBOOK_V0_1, "Carcass panels, shelves, divider, doors and plinth rails."),
  backThicknessMm: rule("WR-003", 6.0, RULEBOOK_V0_1, "Back panel core thickness."),

  grooveDepthMm: rule("WR-004", 7.0, RULEBOOK_V0_1, "Back groove machined into top, bottom and both outer sides."),
  grooveWidthMm: rule("WR-005", 7.0, RULEBOOK_V0_1, "6.0mm back panel + 1.0mm assembly glue gap."),
  grooveRootAllowanceMm: rule("WR-005", 1.0, RULEBOOK_V0_1, "Assembly glue gap component of the 7.0mm groove width."),
  grooveRearDatumMm: rule("WR-006", 20.0, RULEBOOK_V0_1, "Groove rear face measured from the carcass rear datum."),

  doorBumperGapMm: rule("RULEBOOK-S1-Z-ALLOCATION", 2.0, RULEBOOK_V0_1, "Door bumper / operating air gap, Z in [18.0, 20.0]."),
  doorRevealMm: rule("WR-008", 2.0, RULEBOOK_V0_1, "2.0mm perimeter reveals and 2.0mm gaps between doors."),

  plinthFrontRecessMm: rule("WR-007", 0.0, RULEBOOK_V0_1, "Frame-aligned plinth: front fascia sits at the carcass front datum, zero recess."),
  plinthSideInsetMm: rule("WR-007", 0.0, RULEBOOK_V0_1, "Frame-aligned plinth: side returns align with the carcass frame footprint."),

  hangingRailOffsetBelowShelfMm: rule("WR-012", 100.0, RULEBOOK_V0_1, "Rail centre 100.0mm below the underside of the fixed shelf."),

  edgeBandFrontVisibleMm: rule("WR-013", 1.0, RULEBOOK_V0_1, "Front visible edges receive 1.0mm PVC."),
  edgeBandRearUnbandedMm: rule("WR-013", 0.0, RULEBOOK_V0_1, "Non-visible edges receive 0.0mm."),
  edgeBandDoorPerimeterMm: rule("WR-013", 1.0, RULEBOOK_V0_1, "Door perimeter banding."),

  hingeType: rule("WR-010", "CONCEALED_110", RULEBOOK_V0_1, "110 degree soft-close concealed clip-on, semantic only."),
  hingeCountPerDoor: rule("WR-011", 5, RULEBOOK_V0_1, "Five hinges per door."),
  shelfPinPitchMm: rule("WR-009", 32.0, RULEBOOK_V0_1, "System 32 semantic grid; drilling coordinates blocked."),

  // --- Values present in the Bekzod-approved Golden Wardrobe fixture but not
  // --- stated as a numbered Rulebook rule. Approved, but by fixture not by rule.
  topCompartmentClearOpeningMm: rule("GF-TOP-OPENING", 350.0, GOLDEN_FIXTURE_BEKZOD_APPROVED, "Clear opening above the top fixed shelf."),
  shelfCompartmentClearOpeningMm: rule("GF-SHELF-OPENING", 350.0, GOLDEN_FIXTURE_BEKZOD_APPROVED, "Clear opening above an adjustable shelf."),
  longHangingTargetClearDropMm: rule("GF-HANG-LONG", 1400.0, GOLDEN_FIXTURE_BEKZOD_APPROVED, "Long hanging zone target clear drop."),
  shortHangingTargetClearDropMm: rule("GF-HANG-SHORT", 900.0, GOLDEN_FIXTURE_BEKZOD_APPROVED, "Short hanging zone target clear drop."),
  fixedShelfRearSetbackMm: rule("GF-SHELF-REAR", 20.0, GOLDEN_FIXTURE_BEKZOD_APPROVED, "Fixed shelf / divider depth = carcass depth - 20.0mm (WR-002 rear clearance)."),
  adjustableShelfSideClearanceMm: rule("GF-ADJ-SIDE", 1.0, GOLDEN_FIXTURE_BEKZOD_APPROVED, "Adjustable shelf side clearance per face."),
  adjustableShelfFrontSetbackMm: rule("GF-ADJ-FRONT", 5.0, GOLDEN_FIXTURE_BEKZOD_APPROVED, "Adjustable shelf front setback, applied symmetrically front and rear."),

  shelfPinType: rule("WR-009", "SYSTEM_32_PIN_5MM", RULEBOOK_V0_1, "System 32 5mm shelf pin, semantic only."),
  joineryType: rule("GF-JOINERY", "CONFIRMAT_AND_DOWEL", GOLDEN_FIXTURE_BEKZOD_APPROVED, "Carcass joinery family; drilling coordinates blocked."),
  hangingRailType: rule("GF-RAIL", "OVAL_TUBE_15X30", GOLDEN_FIXTURE_BEKZOD_APPROVED, "Hanging rail profile, preview only."),

  // --- NOT approved. Reading these through resolve() throws by design.
  bayCountForWidth: rule("UNRULED-BAY-COUNT", null, REQUIRES_BEKZOD_RULING, "No approved rule maps overall width to a bay count. Must be asked."),
  doorsPerBay: rule("UNRULED-DOORS-PER-BAY", null, REQUIRES_BEKZOD_RULING, "Golden, narrow and wide fixtures all use 2 doors per bay, but no Rulebook rule states it. Must be asked."),
  unevenBayWidthDistribution: rule("UNRULED-BAY-SPLIT", null, REQUIRES_BEKZOD_RULING, "No approved rule for distributing a non-integral bay-width remainder. Must be asked."),
});

export class UnapprovedRuleError extends Error {
  constructor(key, ruleRecord) {
    super(
      `Rule "${key}" (${ruleRecord.id}) is ${RULE_PROVENANCE.REQUIRES_BEKZOD_RULING} and cannot be applied. ${ruleRecord.note}`
    );
    this.name = "UnapprovedRuleError";
    this.code = "UNAPPROVED_RULE_APPLICATION";
    this.ruleKey = key;
    this.ruleId = ruleRecord.id;
  }
}

/**
 * Reads an approved rule value. Throws for any rule awaiting a Bekzod ruling,
 * so an unapproved constant can never leak into the trusted path.
 * @param {keyof typeof WARDROBE_RULES} key
 */
export function resolve(key) {
  const record = WARDROBE_RULES[key];
  if (!record) {
    throw new Error(`Unknown rule key "${key}".`);
  }
  if (record.provenance === RULE_PROVENANCE.REQUIRES_BEKZOD_RULING) {
    throw new UnapprovedRuleError(key, record);
  }
  return record.value;
}

/** Returns the rule ID for provenance recording without reading the value. */
export function ruleIdOf(key) {
  const record = WARDROBE_RULES[key];
  if (!record) throw new Error(`Unknown rule key "${key}".`);
  return record.id;
}

/** Every rule that still needs a Bekzod ruling. */
export function unapprovedRuleKeys() {
  return Object.keys(WARDROBE_RULES)
    .filter((k) => WARDROBE_RULES[k].provenance === RULE_PROVENANCE.REQUIRES_BEKZOD_RULING)
    .sort();
}
