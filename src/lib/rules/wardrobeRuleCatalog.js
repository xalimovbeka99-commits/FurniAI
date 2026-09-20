/**
 * FurniAI — Wardrobe Rule Catalog v0.1 (Gate G4 / AI-Alpha)
 * ---------------------------------------------------------------------
 * SAFETY CONTRACT
 *
 * No agent may author a furniture rule. Every constant in this catalog is
 * addressable data with explicit provenance pointing at a Bekzod-approved
 * source. Provenance classes:
 *
 *   RULEBOOK_V0_1                  docs/WARDROBE_RULEBOOK_V0.1.md, by rule ID.
 *   GOLDEN_FIXTURE_BEKZOD_APPROVED src/lib/furnispec/goldenWardrobe.fixture.json.
 *   BEKZOD_RULING                  Explicit Bekzod workshop ruling (not in Rulebook).
 *   REQUIRES_BEKZOD_RULING         NOT approved. Must NEVER be applied silently;
 *                                  `resolve()` throws, forcing a clarification gap.
 *
 * This file contains no numeric literal that is not attached to a rule record.
 */

export const RULE_PROVENANCE = Object.freeze({
  RULEBOOK_V0_1: "RULEBOOK_V0_1",
  GOLDEN_FIXTURE_BEKZOD_APPROVED: "GOLDEN_FIXTURE_BEKZOD_APPROVED",
  BEKZOD_RULING: "BEKZOD_RULING",
  REQUIRES_BEKZOD_RULING: "REQUIRES_BEKZOD_RULING",
});

export const RULE_CATALOG_VERSION = "wardrobe-rules/0.1";

/** @returns {Readonly<{id:string,value:any,provenance:string,note:string}>} */
function rule(id, value, provenance, note) {
  return Object.freeze({ id, value, provenance, note });
}

const { RULEBOOK_V0_1, GOLDEN_FIXTURE_BEKZOD_APPROVED, BEKZOD_RULING, REQUIRES_BEKZOD_RULING } = RULE_PROVENANCE;

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

  // --- Bekzod hardware rulings 2026-09-15 (SYSTEM32_BORING_SCOPE §6 answered).
  // CNC / drilling coordinates remain BLOCKED; these unlock rule *values* only.
  shelfPinHoleDepthMm: rule(
    "BEK-SHELF-PIN-DEPTH",
    13.0,
    BEKZOD_RULING,
    "Bekzod ruling: shelf-pin hole depth 13.0 mm in 18 mm board. For 16 mm board use 11.5 mm (shelfPinHoleDepthMmByBoardThickness)."
  ),
  shelfPinHoleDepthMmByBoardThickness: rule(
    "BEK-SHELF-PIN-DEPTH-BY-BOARD",
    Object.freeze({ 18: 13.0, 16: 11.5 }),
    BEKZOD_RULING,
    "Thickness variants for shelf-pin hole depth (mm keyed by board thickness mm)."
  ),
  shelfPinColumnOriginDatum: rule(
    "BEK-SHELF-PIN-ORIGIN",
    "BOTTOM_PANEL_UPPER_FACE_PLUS_64MM",
    BEKZOD_RULING,
    "Bekzod ruling: column origin = bottom panel upper face + 64 mm. Upper bound term TOP_PANEL_LOWER_FACE_MINUS_64MM is the mirror datum."
  ),
  shelfPinColumnOriginUpperDatum: rule(
    "BEK-SHELF-PIN-ORIGIN-UPPER",
    "TOP_PANEL_LOWER_FACE_MINUS_64MM",
    BEKZOD_RULING,
    "Upper-column mirror datum for shelf-pin System 32 columns."
  ),
  shelfPinRearRowPolicy: rule(
    "BEK-SHELF-PIN-REAR-ROW",
    "BORED_MIRROR_FRONT_37MM",
    BEKZOD_RULING,
    "Bekzod ruling: rear row is bored, mirroring the front 37 mm edge setback."
  ),
  drawerRunnerFamily: rule(
    "BEK-DRAWER-RUNNER",
    "UNDERMOUNT_CONCEALED_21MM",
    BEKZOD_RULING,
    "Bekzod ruling: concealed undermount runner family; 21 mm total clear-width reduction."
  ),
  drawerSlideWidthDeductionMm: rule(
    "BEK-DRAWER-SLIDE-DEDUCTION",
    21.0,
    BEKZOD_RULING,
    "Bekzod ruling: undermount total width reduction 21.0 mm (box clear width = bay - 21)."
  ),
  drawerFrontRevealMm: rule(
    "BEK-DRAWER-FRONT-REVEAL",
    2.0,
    BEKZOD_RULING,
    "Bekzod ruling: 2.0 mm perimeter reveal on all sides of each drawer front."
  ),

  // --- NOT approved. Reading these through resolve() throws by design.
  bayCountForWidth: rule("UNRULED-BAY-COUNT", null, REQUIRES_BEKZOD_RULING, "No approved rule maps overall width to a bay count. Must be asked."),
  // Ruled 2026-09-18 (RULEBOOK_V0_2_DOORS_PER_BAY). Supersedes
  // UNRULED-DOORS-PER-BAY, which resolve() threw on. Keyed on the BAY's clear
  // width, not the wardrobe's overall width: two 900mm bays and one 1800mm bay
  // are different cabinets.
  doorsPerBayThresholdMm: rule("RULEBOOK_V0_2_DOORS_PER_BAY", 600.0, BEKZOD_RULING, "A bay at or above this clear width takes two door leaves; below it, one."),
  doorsPerBayAtOrAboveThreshold: rule("RULEBOOK_V0_2_DOORS_PER_BAY", 2, BEKZOD_RULING, "Leaves for a bay whose clear width is >= the threshold."),
  doorsPerBayBelowThreshold: rule("RULEBOOK_V0_2_DOORS_PER_BAY", 1, BEKZOD_RULING, "Leaves for a bay whose clear width is < the threshold."),
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

/**
 * Door leaves for one bay, from RULEBOOK_V0_2_DOORS_PER_BAY.
 *
 * Replaces the width->doorCount ladder the adapter hard-coded, which read the
 * wardrobe's OVERALL width and invented two thresholds. This reads each bay's
 * own clear width against one ruled threshold.
 *
 * @param {number} bayClearWidthMm
 */
export function doorsForBayWidth(bayClearWidthMm) {
  if (!Number.isFinite(bayClearWidthMm) || bayClearWidthMm <= 0) {
    const err = new Error(
      `Cannot choose a door count for a bay of "${bayClearWidthMm}"mm. The ruling is keyed on bay clear width, which must be known.`
    );
    err.code = "DOORS_PER_BAY_AMBIGUOUS";
    throw err;
  }
  return bayClearWidthMm >= resolve("doorsPerBayThresholdMm")
    ? resolve("doorsPerBayAtOrAboveThreshold")
    : resolve("doorsPerBayBelowThreshold");
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
