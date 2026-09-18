/**
 * System 32 shelf-pin boring compiler — SEMANTIC ONLY, ALWAYS BLOCKED.
 *
 * WHAT THE RULEBOOK ACTUALLY SAYS
 *
 * WR-009 (docs/WARDROBE_RULEBOOK_V0.1.md) approves the System 32 *semantic
 * grid* — 32.0 mm pitch, 37.0 mm front-edge setback, 5 mm pin — and in the same
 * row states: "Exact drilling coordinates are `MACHINING_BLOCKED` pending
 * Bekzod pin SKU sign-off."
 *
 * So the grid is approved and the coordinates are not. This module compiles the
 * approved half and refuses the unapproved half, rather than treating WR-009 as
 * wholly available or wholly forbidden. Every operation it emits carries
 * `status: BLOCKED_PENDING_HARDWARE_APPROVAL`, no machine output, and no tool
 * path. Nothing here changes `qualificationStatus`, which stays whatever the
 * PartGraph already said.
 *
 * WHY IT IS A SEPARATE FUNCTION, NOT A BRANCH INSIDE buildStructuralPartGraph
 *
 * `buildStructuralPartGraph.test.js` case 16 asserts that the structural
 * operation list contains exactly four BACK_GROOVE operations, all APPROVED —
 * it is the standing proof that hardware drilling is absent from the structural
 * graph. Splicing boring into that list would have required weakening that
 * assertion, which is the wrong direction entirely. The boring plan is a
 * separate artefact computed FROM a PartGraph. The structural graph is
 * untouched, byte for byte, and its canonical fingerprint does not move.
 *
 * WHAT IS STILL MISSING, AND WHY NO HOLES ARE ENUMERATED BY DEFAULT
 *
 * A pitch and a setback do not locate a hole. You also need the origin datum —
 * where the first hole of a column sits — and WR-009 does not state one. Three
 * further inputs are unapproved: hole depth (the 12-14 mm figure in the
 * knowledge-base note cites Wikipedia, not Bekzod), whether a rear row is bored
 * at all, and the pin SKU the rulebook names as the gate.
 *
 * Absent an origin datum, `holes` is `null` and `holeCount` is `null`. Passing
 * `{ enumerateHoles: true }` produces a review preview under an explicitly
 * named provisional datum, and every such plan carries a non-empty
 * `assumptions[]` naming it. The preview is for Bekzod to look at and correct.
 * It is not a cut list, and the BLOCKED status does not change either way.
 */
import { WARDROBE_RULES, RULE_PROVENANCE } from "../rules/wardrobeRuleCatalog.js";
import { PART_ROLES } from "./schema.js";

export const SYSTEM32_BORING_VERSION = "system32-boring/0.1";

/** The only status a boring operation may ever carry at this gate. */
export const BORING_STATUS = Object.freeze({
  BLOCKED: "BLOCKED_PENDING_HARDWARE_APPROVAL",
});

export const BORING_OPERATION_TYPE = "SHELF_PIN_LINE_BORING";

/** Which face of the panel a row is bored into, and the outward normal. */
export const BORE_FACE = Object.freeze({
  RIGHT_HAND: "RIGHT_HAND",
  LEFT_HAND: "LEFT_HAND",
});

/** Which edge a row's setback is measured from. */
export const ROW_DATUM = Object.freeze({
  FRONT_EDGE: "FRONT_EDGE",
  REAR_EDGE: "REAR_EDGE",
});

/**
 * The provisional column origin used only when `enumerateHoles` is requested.
 * Named so a reviewer can disagree with it by name.
 */
export const PROVISIONAL_COLUMN_ORIGIN = "FIRST_HOLE_ONE_PITCH_ABOVE_PANEL_LOWER_EDGE";

/**
 * Panel roles that carry shelf-pin columns: the two outer sides (inner face
 * only) and every divider (both faces).
 */
const BORED_ROLES = Object.freeze({
  [PART_ROLES.SIDE_PANEL_LEFT]: [BORE_FACE.RIGHT_HAND],
  [PART_ROLES.SIDE_PANEL_RIGHT]: [BORE_FACE.LEFT_HAND],
  [PART_ROLES.DIVIDER_PANEL]: [BORE_FACE.RIGHT_HAND, BORE_FACE.LEFT_HAND],
});

const FACE_NORMAL = Object.freeze({
  [BORE_FACE.RIGHT_HAND]: Object.freeze([1, 0, 0]),
  [BORE_FACE.LEFT_HAND]: Object.freeze([-1, 0, 0]),
});

/** Read an approved rule value, refusing anything that is not approved. */
function approved(key) {
  const record = WARDROBE_RULES[key];
  if (!record) throw new Error(`No rule record for "${key}".`);
  if (
    record.provenance !== RULE_PROVENANCE.RULEBOOK_V0_1 &&
    record.provenance !== RULE_PROVENANCE.GOLDEN_FIXTURE_BEKZOD_APPROVED
  ) {
    throw new Error(
      `Rule "${key}" (${record.id}) is ${record.provenance} and must not be applied: ${record.note}`
    );
  }
  return record.value;
}

/** An unapproved input, reported rather than guessed. */
function unresolved(key) {
  const record = WARDROBE_RULES[key];
  return Object.freeze({
    key,
    ruleId: record.id,
    provenance: record.provenance,
    question: record.note,
  });
}

const toDmm = (mm) => Math.round(mm * 10);

/**
 * Compile the System 32 shelf-pin boring plan for a structural PartGraph.
 *
 * @param {object} partGraph a graph from `buildStructuralPartGraph`
 * @param {{ enumerateHoles?: boolean }} [options]
 *   `enumerateHoles` produces a review preview under PROVISIONAL_COLUMN_ORIGIN.
 *   It does not approve anything and does not change any operation's status.
 * @returns {Readonly<object>} the boring plan. Never mutates `partGraph`.
 */
export function compileSystem32Boring(partGraph, options = {}) {
  const { enumerateHoles = false } = options;

  if (!partGraph || !Array.isArray(partGraph.parts)) {
    throw new Error("compileSystem32Boring requires a PartGraph with a parts array.");
  }
  if (partGraph.qualificationStatus === "CNC_QUALIFIED") {
    // Defence in depth. validatePartGraph already forbids this value at this
    // gate; a boring plan is the last place it should be allowed to appear.
    throw new Error("Refusing to compile boring for a CNC_QUALIFIED PartGraph at Gate G2.");
  }

  const pitchDmm = toDmm(approved("shelfPinPitchMm"));
  const frontSetbackDmm = toDmm(approved("shelfPinFrontSetbackMm"));
  const diameterDmm = toDmm(approved("shelfPinDiameterMm"));

  const unresolvedInputs = [
    unresolved("shelfPinHoleDepthMm"),
    unresolved("shelfPinColumnOriginDatum"),
    unresolved("shelfPinRearRowPolicy"),
    Object.freeze({
      key: "shelfPinSku",
      ruleId: "WR-009",
      provenance: RULE_PROVENANCE.REQUIRES_BEKZOD_RULING,
      question:
        "WR-009 names pin SKU sign-off as the gate on drilling coordinates. No SKU is recorded anywhere in the repository.",
    }),
  ];

  const assumptions = [];
  const operations = [];

  for (const part of partGraph.parts) {
    const faces = BORED_ROLES[part.role];
    if (!faces) continue;

    for (const face of faces) {
      const { holes, holeCount } = enumerateHoles
        ? enumerateColumn(part, pitchDmm)
        : { holes: null, holeCount: null };

      operations.push(
        Object.freeze({
          id: `OP_S32_${part.id}_${face}_${ROW_DATUM.FRONT_EDGE}`,
          hostPartId: part.id,
          hostPartRole: part.role,
          type: BORING_OPERATION_TYPE,
          face,
          vector: FACE_NORMAL[face],
          rowDatum: ROW_DATUM.FRONT_EDGE,
          /** Part-local: measured back from the panel's front edge. */
          setbackFromDatumDmm: frontSetbackDmm,
          /** Graph coordinate of the row, derived from the part's own placement. */
          rowZDmm: part.placement.maxZDmm - frontSetbackDmm,
          pitchDmm,
          diameterDmm,
          depthDmm: null,
          depthStatus: RULE_PROVENANCE.REQUIRES_BEKZOD_RULING,
          columnOrigin: enumerateHoles ? PROVISIONAL_COLUMN_ORIGIN : null,
          holes,
          holeCount,
          status: BORING_STATUS.BLOCKED,
          machineOutput: null,
          toolPath: null,
          sourceRuleIds: Object.freeze(["WR-009"]),
        })
      );
    }
  }

  if (enumerateHoles && operations.length > 0) {
    assumptions.push(
      Object.freeze({
        code: "PROVISIONAL_COLUMN_ORIGIN",
        datum: PROVISIONAL_COLUMN_ORIGIN,
        message:
          "Hole positions are enumerated from a provisional origin one pitch above each panel's lower edge. " +
          "WR-009 states no origin datum, so these positions are a review preview for Bekzod to correct, " +
          "not an approved result. Every operation remains blocked.",
      })
    );
  }

  return Object.freeze({
    version: SYSTEM32_BORING_VERSION,
    sourceSpecId: partGraph.sourceSpecId ?? null,
    sourceRevision: partGraph.sourceRevision ?? null,
    unitScale: partGraph.unitScale ?? "deci-mm",
    /** Copied, never computed. This module cannot qualify anything. */
    qualificationStatus: partGraph.qualificationStatus,
    machiningPolicy: BORING_STATUS.BLOCKED,
    grid: Object.freeze({
      pitchDmm,
      frontSetbackDmm,
      diameterDmm,
      depthDmm: null,
      rearRow: null,
      sourceRuleIds: Object.freeze(["WR-009"]),
    }),
    operations: Object.freeze(operations),
    assumptions: Object.freeze(assumptions),
    unresolvedInputs: Object.freeze(unresolvedInputs),
    summary: Object.freeze({
      totalOperations: operations.length,
      blockedOperations: operations.length,
      approvedOperations: 0,
      holesEnumerated: enumerateHoles,
    }),
  });
}

/**
 * Enumerate a column from the provisional origin. Pure geometry over the
 * part's own placement; it invents no rule beyond the origin, which the caller
 * has already been told is unapproved.
 */
function enumerateColumn(part, pitchDmm) {
  const lower = part.placement.minYDmm;
  const upper = part.placement.maxYDmm;
  const holes = [];
  let index = 0;
  for (let y = lower + pitchDmm; y <= upper - pitchDmm; y += pitchDmm) {
    holes.push(Object.freeze({ index, yDmm: y }));
    index += 1;
  }
  return { holes: Object.freeze(holes), holeCount: holes.length };
}

/**
 * True when every operation in a plan is blocked and carries no machine output.
 * Exported so callers and tests can assert the invariant without re-deriving it.
 */
export function isFullyBlocked(plan) {
  return (
    plan.machiningPolicy === BORING_STATUS.BLOCKED &&
    plan.summary.approvedOperations === 0 &&
    plan.operations.every(
      (op) =>
        op.status === BORING_STATUS.BLOCKED &&
        op.machineOutput === null &&
        op.toolPath === null &&
        op.depthDmm === null
    )
  );
}
