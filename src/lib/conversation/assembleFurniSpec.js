/**
 * FurniAI — FurniSpec Assembler (Gate G4 / AI-Alpha)
 * ---------------------------------------------------------------------
 * THE TRUST BOUNDARY. Everything upstream of this module is a proposal;
 * everything downstream is trusted geometry.
 *
 * SAFETY CONTRACT
 * - Refuses to assemble while any BLOCKING gap stands (AssemblyBlockedError).
 * - Every value in the output is either a customer-stated/confirmed fact or a
 *   closure derivation from an APPROVED rule. Each derivation is recorded with
 *   its rule IDs and its formula in the returned `derivations` array.
 * - All arithmetic is exact integer deci-millimetres. A derivation that does
 *   not close exactly throws rather than rounding.
 * - CNC qualification and hardware drilling are hard-wired blocked and are not
 *   parameters. There is no argument that can turn either on.
 */

import { fromDeciMm, toDeciMm } from "../furnispec/units.js";
import {
  FURNISPEC_SCHEMA_VERSION,
  HARDWARE_APPROVAL_STATUS,
  MACHINING_POLICY,
  QUALIFICATION_STATUS,
  SIDE_INSET_STATUS,
  SPEC_STATUS,
} from "../furnispec/schema.js";
import { materialsFor } from "../rules/materialCatalog.js";
import { resolve, ruleIdOf } from "../rules/wardrobeRuleCatalog.js";
import { BAY_LAYOUT, GAP_SEVERITY } from "./intakeModel.js";

export class AssemblyBlockedError extends Error {
  constructor(gaps) {
    super(`FurniSpec assembly refused: ${gaps.length} blocking clarification gap(s) unresolved.`);
    this.name = "AssemblyBlockedError";
    this.code = "ASSEMBLY_BLOCKED_BY_CLARIFICATION";
    this.gaps = gaps;
  }
}

export class ClosureError extends Error {
  constructor(message, path) {
    super(message);
    this.name = "ClosureError";
    this.code = "DERIVATION_DOES_NOT_CLOSE";
    this.path = path;
  }
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * @param {object} args
 * @param {Record<string, any>} args.facts confirmed intake facts
 * @param {Array} args.gaps gap list from analyseGaps
 * @param {string} args.specId
 * @param {number} args.revision
 * @param {"PROPOSED"|"APPROVED"} args.status explicit; there is no default
 * @returns {{spec:object, derivations:Array<{path:string,value:number,ruleIds:string[],formula:string}>}}
 */
export function assembleFurniSpec({ facts, gaps = [], specId, revision, status }) {
  const blocking = gaps.filter((g) => g.severity === GAP_SEVERITY.BLOCKING);
  if (blocking.length > 0) throw new AssemblyBlockedError(blocking);

  if (typeof specId !== "string" || specId.trim() === "") throw new Error("assembleFurniSpec requires an explicit specId.");
  if (!Number.isInteger(revision) || revision < 1) throw new Error("assembleFurniSpec requires an explicit integer revision >= 1.");
  if (status !== SPEC_STATUS.PROPOSED && status !== SPEC_STATUS.APPROVED) {
    throw new Error(`assembleFurniSpec requires an explicit status of PROPOSED or APPROVED, got "${status}".`);
  }

  const derivations = [];
  const record = (path, valueDmm, ruleKeys, formula) => {
    derivations.push({
      path,
      value: fromDeciMm(valueDmm),
      ruleIds: ruleKeys.map(ruleIdOf),
      formula,
    });
    return fromDeciMm(valueDmm);
  };

  // --- Stated facts (exact, never rounded) -----------------------------------
  const envWDmm = toDeciMm(facts["envelope.widthMm"], "envelope.widthMm");
  const envHDmm = toDeciMm(facts["envelope.heightMm"], "envelope.heightMm");
  const envDDmm = toDeciMm(facts["envelope.depthMm"], "envelope.depthMm");
  const plinthHDmm = toDeciMm(facts["plinth.heightMm"], "plinth.heightMm");
  const bayCount = facts.bayCount;
  const doorCount = facts.doorCount;
  const finishType = facts.finishType;
  const bayLayouts = facts.bayLayouts;

  if (!Number.isInteger(bayCount) || bayCount < 1) throw new Error("bayCount must be a positive integer.");
  if (!Number.isInteger(doorCount) || doorCount < 1) throw new Error("doorCount must be a positive integer.");
  if (!Array.isArray(bayLayouts) || bayLayouts.length !== bayCount) {
    throw new Error("bayLayouts must contain exactly one layout per bay.");
  }

  // --- Approved rule constants ------------------------------------------------
  const panelTDmm = toDeciMm(resolve("panelThicknessMm"), "panelThicknessMm");
  const backTDmm = toDeciMm(resolve("backThicknessMm"), "backThicknessMm");
  const bumperDmm = toDeciMm(resolve("doorBumperGapMm"), "doorBumperGapMm");
  const revealDmm = toDeciMm(resolve("doorRevealMm"), "doorRevealMm");
  const railOffsetDmm = toDeciMm(resolve("hangingRailOffsetBelowShelfMm"), "hangingRailOffsetBelowShelfMm");
  const topOpeningDmm = toDeciMm(resolve("topCompartmentClearOpeningMm"), "topCompartmentClearOpeningMm");
  const shelfOpeningDmm = toDeciMm(resolve("shelfCompartmentClearOpeningMm"), "shelfCompartmentClearOpeningMm");
  const longDropDmm = toDeciMm(resolve("longHangingTargetClearDropMm"), "longHangingTargetClearDropMm");
  const shortDropDmm = toDeciMm(resolve("shortHangingTargetClearDropMm"), "shortHangingTargetClearDropMm");
  const shelfRearSetbackDmm = toDeciMm(resolve("fixedShelfRearSetbackMm"), "fixedShelfRearSetbackMm");
  const adjFrontSetbackDmm = toDeciMm(resolve("adjustableShelfFrontSetbackMm"), "adjustableShelfFrontSetbackMm");

  // --- Closure derivations ----------------------------------------------------
  const carcassHDmm = envHDmm - plinthHDmm;
  const carcassHeightMm = record("carcass.heightMm", carcassHDmm, [], "envelope.heightMm - plinth.heightMm");

  const carcassDDmm = envDDmm - panelTDmm - bumperDmm;
  const carcassDepthMm = record(
    "carcass.depthMm",
    carcassDDmm,
    ["panelThicknessMm", "doorBumperGapMm"],
    "envelope.depthMm - doorThickness(WR-003) - bumperGap"
  );

  const internalWidthDmm = envWDmm - (bayCount + 1) * panelTDmm;
  if (internalWidthDmm <= 0 || internalWidthDmm % bayCount !== 0) {
    throw new ClosureError(
      `Bay clear width does not close exactly: ${internalWidthDmm / 10}mm over ${bayCount} bays.`,
      "bays[].clearWidthMm"
    );
  }
  const bayClearWDmm = internalWidthDmm / bayCount;
  const bayClearWidthMm = record(
    "bays[].clearWidthMm",
    bayClearWDmm,
    ["panelThicknessMm"],
    "(envelope.widthMm - (bayCount + 1) * panelThickness(WR-003)) / bayCount"
  );

  const doorZoneDmm = envWDmm - 2 * revealDmm - (doorCount - 1) * revealDmm;
  if (doorZoneDmm <= 0 || doorZoneDmm % doorCount !== 0) {
    throw new ClosureError(
      `Door finished width does not close exactly: ${doorZoneDmm / 10}mm over ${doorCount} doors.`,
      "doors.finishedWidthMm"
    );
  }
  const doorWDmm = doorZoneDmm / doorCount;
  const doorFinishedWidthMm = record(
    "doors.finishedWidthMm",
    doorWDmm,
    ["doorRevealMm"],
    "(envelope.widthMm - 2*reveal(WR-008) - (doorCount-1)*reveal(WR-008)) / doorCount"
  );

  const doorHDmm = carcassHDmm - 2 * revealDmm;
  if (doorHDmm <= 0) throw new ClosureError("Door finished height does not close.", "doors.finishedHeightMm");
  const doorFinishedHeightMm = record(
    "doors.finishedHeightMm",
    doorHDmm,
    ["doorRevealMm"],
    "carcass.heightMm - topReveal(WR-008) - bottomReveal(WR-008)"
  );

  const fixedShelfDDmm = carcassDDmm - shelfRearSetbackDmm;
  const fixedShelfDepthMm = record(
    "component.fixedShelf.depthMm",
    fixedShelfDDmm,
    ["fixedShelfRearSetbackMm"],
    "carcass.depthMm - fixedShelfRearSetback"
  );

  const adjShelfDDmm = fixedShelfDDmm - 2 * adjFrontSetbackDmm;
  const adjShelfDepthMm = record(
    "component.adjustableShelf.depthMm",
    adjShelfDDmm,
    ["fixedShelfRearSetbackMm", "adjustableShelfFrontSetbackMm"],
    "fixedShelfDepth - 2 * adjustableShelfFrontSetback"
  );

  // --- Bays and components ----------------------------------------------------
  const bays = bayLayouts.map((layout, index) => {
    const nn = pad2(index + 1);
    const components = [];
    components.push({
      id: `shelf-fix-b${nn}`,
      type: "SHELF_FIXED",
      clearOpeningAboveMm: fromDeciMm(topOpeningDmm),
      thicknessMm: fromDeciMm(panelTDmm),
      depthMm: fixedShelfDepthMm,
    });

    if (layout === BAY_LAYOUT.LONG_HANGING) {
      components.push({
        id: `rail-long-b${nn}`,
        type: "HANGING_RAIL_LONG",
        offsetBelowShelfMm: fromDeciMm(railOffsetDmm),
        targetClearDropMm: fromDeciMm(longDropDmm),
      });
    } else if (layout === BAY_LAYOUT.SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES) {
      components.push({
        id: `rail-short-b${nn}`,
        type: "HANGING_RAIL_SHORT",
        offsetBelowShelfMm: fromDeciMm(railOffsetDmm),
        targetClearDropMm: fromDeciMm(shortDropDmm),
      });
      components.push({
        id: `shelf-adj-b${nn}-1`,
        type: "SHELF_ADJUSTABLE",
        clearDropAboveMm: fromDeciMm(shortDropDmm),
        thicknessMm: fromDeciMm(panelTDmm),
        depthMm: adjShelfDepthMm,
      });
      components.push({
        id: `shelf-adj-b${nn}-2`,
        type: "SHELF_ADJUSTABLE",
        clearOpeningAboveMm: fromDeciMm(shelfOpeningDmm),
        thicknessMm: fromDeciMm(panelTDmm),
        depthMm: adjShelfDepthMm,
      });
    } else {
      throw new Error(`Unsupported bay layout "${layout}".`);
    }

    return { id: `bay-${nn}`, index, clearWidthMm: bayClearWidthMm, components };
  });

  const materials = materialsFor(finishType);

  const spec = {
    schemaVersion: FURNISPEC_SCHEMA_VERSION,
    specId,
    revision,
    unit: "mm",
    furnitureType: "wardrobe",
    wardrobeType: "straight_hinged",
    constructionStyle: resolve("constructionStyle"),
    finishType,
    status,
    // Hard safety invariants. Not parameters.
    qualificationStatus: QUALIFICATION_STATUS.WORKSHOP_REVIEW_NOT_CNC_QUALIFIED,
    envelope: {
      widthMm: fromDeciMm(envWDmm),
      heightMm: fromDeciMm(envHDmm),
      depthMm: fromDeciMm(envDDmm),
    },
    plinth: {
      heightMm: fromDeciMm(plinthHDmm),
      frontRecessMm: resolve("plinthFrontRecessMm"),
      sideInsetMm: resolve("plinthSideInsetMm"),
      sideInsetStatus: SIDE_INSET_STATUS.BEKZOD_APPROVED,
    },
    carcass: {
      heightMm: carcassHeightMm,
      depthMm: carcassDepthMm,
      panelThicknessMm: fromDeciMm(panelTDmm),
      backThicknessMm: fromDeciMm(backTDmm),
      grooveWidthMm: resolve("grooveWidthMm"),
      grooveDepthMm: resolve("grooveDepthMm"),
      grooveRearDatumMm: resolve("grooveRearDatumMm"),
    },
    bays,
    doors: {
      count: doorCount,
      thicknessMm: fromDeciMm(panelTDmm),
      bumperGapMm: fromDeciMm(bumperDmm),
      finishedWidthMm: doorFinishedWidthMm,
      finishedHeightMm: doorFinishedHeightMm,
      reveals: {
        topMm: fromDeciMm(revealDmm),
        bottomMm: fromDeciMm(revealDmm),
        leftMm: fromDeciMm(revealDmm),
        rightMm: fromDeciMm(revealDmm),
        interDoorMm: fromDeciMm(revealDmm),
      },
    },
    materials,
    edgeBanding: {
      frontVisibleMm: resolve("edgeBandFrontVisibleMm"),
      rearUnbandedMm: resolve("edgeBandRearUnbandedMm"),
      doorPerimeterMm: resolve("edgeBandDoorPerimeterMm"),
    },
    clearancePolicy: {
      adjustableShelf: {
        sideClearanceMm: resolve("adjustableShelfSideClearanceMm"),
        frontSetbackMm: resolve("adjustableShelfFrontSetbackMm"),
      },
      backPanel: {
        grooveRootAllowanceMm: resolve("grooveRootAllowanceMm"),
      },
    },
    hardware: {
      hinges: {
        type: resolve("hingeType"),
        countPerDoor: resolve("hingeCountPerDoor"),
        totalCount: resolve("hingeCountPerDoor") * doorCount,
        status: HARDWARE_APPROVAL_STATUS.BLOCKED_PENDING_HARDWARE_APPROVAL,
        note: "HARDWARE_SKU_PENDING_BEKZOD_CONFIRMATION",
      },
      shelfPins: {
        type: resolve("shelfPinType"),
        pitchMm: resolve("shelfPinPitchMm"),
        status: HARDWARE_APPROVAL_STATUS.BLOCKED_PENDING_HARDWARE_APPROVAL,
      },
      joinery: {
        type: resolve("joineryType"),
        status: HARDWARE_APPROVAL_STATUS.BLOCKED_PENDING_HARDWARE_APPROVAL,
      },
      hangingRails: {
        type: resolve("hangingRailType"),
        status: HARDWARE_APPROVAL_STATUS.PREVIEW_ONLY,
      },
    },
    machiningPolicy: {
      backGroove: MACHINING_POLICY.APPROVED,
      // Hard-wired. No caller can approve drilling from this path.
      drilling: MACHINING_POLICY.BLOCKED_PENDING_HARDWARE_APPROVAL,
    },
  };

  return { spec, derivations };
}
