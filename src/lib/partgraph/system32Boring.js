/**
 * System 32 shelf-pin boring compiler.
 *
 * TWO GATES, NOT ONE
 *
 * This module distinguishes two things that were previously conflated under a
 * single BLOCKED status:
 *
 *   geometryStatus     Is the hole pattern fully determined? Yes, since the
 *                      2026-09-15 ruling. Pitch, front setback, rear row,
 *                      column origin, column upper bound and hole depth are
 *                      all ruled, so every hole has a position and a depth.
 *
 *   status             Is drilling AUTHORISED? No. WR-009 gates production
 *                      drilling coordinates on pin SKU sign-off, no SKU is
 *                      recorded, and the standing manufacturing policy is
 *                      unchanged: CNC NOT QUALIFIED, hardware drilling
 *                      BLOCKED. Every operation therefore still carries
 *                      BLOCKED_PENDING_HARDWARE_APPROVAL.
 *
 * A defined schema is not an authorisation to cut. Keeping the two fields
 * separate is what lets the schema be finished without anything downstream
 * mistaking it for a machining release.
 *
 * WHAT THE RULINGS FIXED
 *
 * WR-009 (Rulebook) already approved the semantic grid: 32.0mm pitch, 37.0mm
 * front-edge setback, 5mm pin. The 2026-09-15 ruling added the three inputs
 * that a pitch and a setback do not supply:
 *
 *   - hole depth, by carcass thickness (13.0mm into 18mm, 11.5mm into 16mm)
 *   - column origin: 64.0mm above the bottom panel's upper face, with the
 *     column ending 64.0mm below the top panel's lower face
 *   - rear row: bored, mirroring the front row at 37.0mm from the rear datum
 *
 * Holes are now enumerated by default. The provisional-origin machinery this
 * module carried before the ruling is gone, along with the opt-in flag that
 * guarded it: there is nothing provisional left to guard.
 *
 * WHY IT IS A SEPARATE FUNCTION, NOT A BRANCH INSIDE buildStructuralPartGraph
 *
 * `buildStructuralPartGraph.test.js` case 16 asserts the structural operation
 * list holds exactly four BACK_GROOVE operations, all APPROVED — the standing
 * proof that hardware drilling is absent from the structural graph. Splicing
 * boring into that list would mean weakening that assertion. The boring plan is
 * computed FROM a PartGraph instead; the graph is not mutated and its canonical
 * serialization does not move.
 */
import {
  WARDROBE_RULES,
  RULE_PROVENANCE,
  resolve,
  shelfPinHoleDepthFor,
} from "../rules/wardrobeRuleCatalog.js";
import { PART_ROLES } from "./schema.js";

export const SYSTEM32_BORING_VERSION = "system32-boring/0.2";

/** Machining authorisation. Only one value is reachable at this gate. */
export const BORING_STATUS = Object.freeze({
  BLOCKED: "BLOCKED_PENDING_HARDWARE_APPROVAL",
});

/** Whether the hole pattern itself is determined. Independent of authorisation. */
export const GEOMETRY_STATUS = Object.freeze({
  DEFINED: "DEFINED",
  UNDEFINED: "UNDEFINED_PENDING_RULING",
});

export const BORING_OPERATION_TYPE = "SHELF_PIN_LINE_BORING";

/** Which face of the panel a row is bored into. */
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

const toDmm = (mm) => Math.round(mm * 10);

/**
 * Compile the System 32 shelf-pin boring plan for a structural PartGraph.
 *
 * @param {object} partGraph a graph from `buildStructuralPartGraph`
 * @returns {Readonly<object>} the boring plan. Never mutates `partGraph`.
 */
export function compileSystem32Boring(partGraph) {
  if (!partGraph || !Array.isArray(partGraph.parts)) {
    throw new Error("compileSystem32Boring requires a PartGraph with a parts array.");
  }
  if (partGraph.qualificationStatus === "CNC_QUALIFIED") {
    // Defence in depth. validatePartGraph already forbids this value at this
    // gate; a boring plan is the last place it should be allowed to appear.
    throw new Error("Refusing to compile boring for a CNC_QUALIFIED PartGraph at Gate G2.");
  }

  const pitchDmm = toDmm(resolve("shelfPinPitchMm"));
  const frontSetbackDmm = toDmm(resolve("shelfPinFrontSetbackMm"));
  const diameterDmm = toDmm(resolve("shelfPinDiameterMm"));
  const originOffsetDmm = toDmm(resolve("shelfPinColumnOriginOffsetMm"));
  const rearRowPolicy = resolve("shelfPinRearRowPolicy");
  const bearsRearRow = rearRowPolicy === "BORED_MIRROR_FRONT_37MM";

  const column = columnBounds(partGraph, originOffsetDmm);

  const rowDatums = bearsRearRow
    ? [ROW_DATUM.FRONT_EDGE, ROW_DATUM.REAR_EDGE]
    : [ROW_DATUM.FRONT_EDGE];

  const operations = [];
  for (const part of partGraph.parts) {
    const faces = BORED_ROLES[part.role];
    if (!faces) continue;

    // Depth is a function of the board being bored, not of the wardrobe.
    // An unruled thickness throws here rather than borrowing a ruled depth.
    const depthDmm = toDmm(shelfPinHoleDepthFor(part.finished.thicknessDmm / 10));
    const holes = enumerateColumn(column, pitchDmm);

    for (const face of faces) {
      for (const rowDatum of rowDatums) {
        operations.push(
          Object.freeze({
            id: `OP_S32_${part.id}_${face}_${rowDatum}`,
            hostPartId: part.id,
            hostPartRole: part.role,
            type: BORING_OPERATION_TYPE,
            face,
            vector: FACE_NORMAL[face],
            rowDatum,
            setbackFromDatumDmm: frontSetbackDmm,
            // Z increases toward the REAR, so a panel's FRONT edge is its
            // minZ. Getting this backwards puts the front row 37mm from the
            // back of the wardrobe, which is why it is asserted in the tests
            // against the part's own placement rather than restated here.
            rowZDmm:
              rowDatum === ROW_DATUM.FRONT_EDGE
                ? part.placement.minZDmm + frontSetbackDmm
                : part.placement.maxZDmm - frontSetbackDmm,
            pitchDmm,
            diameterDmm,
            depthDmm,
            holes,
            holeCount: holes.length,
            geometryStatus: GEOMETRY_STATUS.DEFINED,
            /** Machining authorisation, NOT geometry. See the header. */
            status: BORING_STATUS.BLOCKED,
            machineOutput: null,
            toolPath: null,
            sourceRuleIds: Object.freeze([
              "WR-009",
              WARDROBE_RULES.shelfPinColumnOriginDatum.id,
              WARDROBE_RULES.shelfPinHoleDepthByCarcassThicknessMm.id,
              WARDROBE_RULES.shelfPinRearRowPolicy.id,
            ]),
          })
        );
      }
    }
  }

  return Object.freeze({
    version: SYSTEM32_BORING_VERSION,
    sourceSpecId: partGraph.sourceSpecId ?? null,
    sourceRevision: partGraph.sourceRevision ?? null,
    unitScale: partGraph.unitScale ?? "deci-mm",
    /** Copied, never computed. This module cannot qualify anything. */
    qualificationStatus: partGraph.qualificationStatus,
    machiningPolicy: BORING_STATUS.BLOCKED,
    geometryStatus: GEOMETRY_STATUS.DEFINED,
    grid: Object.freeze({
      pitchDmm,
      frontSetbackDmm,
      diameterDmm,
      originOffsetDmm,
      originDatum: resolve("shelfPinColumnOriginDatum"),
      upperBoundDatum: resolve("shelfPinColumnUpperBoundDatum"),
      rearRowPolicy,
      columnFirstHoleYDmm: column.firstYDmm,
      columnLastAllowedYDmm: column.upperBoundYDmm,
      sourceRuleIds: Object.freeze(["WR-009", "BR-2026-09-15-PIN-ORIGIN", "BR-2026-09-15-PIN-REAR-ROW"]),
    }),
    operations: Object.freeze(operations),
    /**
     * What still stands between this plan and a machine. The geometry is
     * settled; authorisation is not.
     */
    unresolvedInputs: Object.freeze([
      Object.freeze({
        key: "shelfPinSku",
        ruleId: "WR-009",
        provenance: RULE_PROVENANCE.REQUIRES_BEKZOD_RULING,
        question:
          "WR-009 names pin SKU sign-off as the gate on production drilling coordinates. No SKU is recorded anywhere in the repository, so drilling stays blocked even though the pattern is now fully defined.",
      }),
    ]),
    summary: Object.freeze({
      totalOperations: operations.length,
      blockedOperations: operations.length,
      approvedOperations: 0,
      totalHoles: operations.reduce((n, op) => n + op.holeCount, 0),
    }),
  });
}

/**
 * The shared vertical extent of every shelf-pin column, from the ruled datums.
 * Both bounds are read from the carcass panels themselves, so a taller or
 * shorter wardrobe moves them without any rule changing.
 */
function columnBounds(partGraph, originOffsetDmm) {
  const bottom = partGraph.parts.find((p) => p.role === PART_ROLES.BOTTOM_PANEL);
  const top = partGraph.parts.find((p) => p.role === PART_ROLES.TOP_PANEL);
  if (!bottom || !top) {
    throw new Error(
      "Cannot locate a shelf-pin column: the PartGraph has no TOP_PANEL/BOTTOM_PANEL to measure the ruled datums from."
    );
  }
  return Object.freeze({
    // BOTTOM_PANEL_UPPER_FACE_PLUS_64MM
    firstYDmm: bottom.placement.maxYDmm + originOffsetDmm,
    // TOP_PANEL_LOWER_FACE_MINUS_64MM
    upperBoundYDmm: top.placement.minYDmm - originOffsetDmm,
  });
}

/** Holes at the ruled pitch, from the ruled origin, up to the ruled bound. */
function enumerateColumn(column, pitchDmm) {
  const holes = [];
  let index = 0;
  for (let y = column.firstYDmm; y <= column.upperBoundYDmm; y += pitchDmm) {
    holes.push(Object.freeze({ index, yDmm: y }));
    index += 1;
  }
  return Object.freeze(holes);
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
      (op) => op.status === BORING_STATUS.BLOCKED && op.machineOutput === null && op.toolPath === null
    )
  );
}
