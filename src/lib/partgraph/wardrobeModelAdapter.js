/**
 * src/lib/partgraph/wardrobeModelAdapter.js
 * ---------------------------------------------------------------------
 * Canonical WardrobeModel -> FurniSpec Adapter
 *
 * Translates an interactive WardrobeModel (integer mm, sections, components)
 * into a canonical, strictly validated FurniSpec v0.1 specification consumable
 * by buildStructuralPartGraph().
 *
 * INVARIANTS:
 * - Preserves wardrobeModel.id as specId / sourceSpecId.
 * - Carries over the current revision counter without dropping or skipping.
 * - Reconciles envelope, plinth, carcass, bays, and doors arithmetic with exact
 *   deci-mm closure.
 * - Sets status="APPROVED", qualificationStatus="WORKSHOP_REVIEW_NOT_CNC_QUALIFIED".
 * - Hardware drilling remains BLOCKED_PENDING_HARDWARE_APPROVAL.
 */

import {
  FURNISPEC_SCHEMA_VERSION,
  FURNITURE_TYPES,
  WARDROBE_TYPES,
  CONSTRUCTION_STYLES,
  FINISH_TYPES,
  SPEC_STATUS,
  QUALIFICATION_STATUS,
  HARDWARE_APPROVAL_STATUS,
  MACHINING_POLICY,
  COMPONENT_TYPES,
  SIDE_INSET_STATUS,
} from "../furnispec/schema.js";

function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * Translates a WardrobeModel into a validated FurniSpec v0.1 object.
 *
 * @param {object} wardrobeModel - The interactive WardrobeModel
 * @param {object} [options]
 * @param {string} [options.finishType="melamine"]
 * @returns {object} Canonical FurniSpec v0.1 document
 */
export function adaptWardrobeModelToFurniSpec(wardrobeModel, options = {}) {
  if (!wardrobeModel || typeof wardrobeModel !== "object") {
    throw new TypeError("adaptWardrobeModelToFurniSpec requires a valid wardrobeModel object.");
  }

  const specId = wardrobeModel.id || "furnispec-wardrobe-model";
  const revision = typeof wardrobeModel.revision === "number" && wardrobeModel.revision >= 1
    ? Math.floor(wardrobeModel.revision)
    : 1;

  const widthMm = Number(wardrobeModel.widthMm);
  const heightMm = Number(wardrobeModel.heightMm);
  const depthMm = Number(wardrobeModel.depthMm);

  if (!Number.isFinite(widthMm) || widthMm <= 0) throw new Error("wardrobeModel.widthMm must be a positive number.");
  if (!Number.isFinite(heightMm) || heightMm <= 0) throw new Error("wardrobeModel.heightMm must be a positive number.");
  if (!Number.isFinite(depthMm) || depthMm <= 0) throw new Error("wardrobeModel.depthMm must be a positive number.");

  const panelThicknessMm = Number(wardrobeModel.panelThicknessMm) || 18.0;

  // Plinth (standard 100mm height)
  const plinthHeightMm = 100.0;
  const plinth = {
    heightMm: plinthHeightMm,
    frontRecessMm: 0.0,
    sideInsetMm: 0.0,
    sideInsetStatus: SIDE_INSET_STATUS.BEKZOD_APPROVED,
  };

  // Carcass
  // Total depth = carcass.depthMm + door.thicknessMm (18) + bumperGap (2) = 580 + 18 + 2 = 600
  const doorThicknessMm = 18.0;
  const bumperGapMm = 2.0;
  const carcassDepthMm = depthMm - doorThicknessMm - bumperGapMm;
  const carcassHeightMm = heightMm - plinthHeightMm;

  const carcass = {
    heightMm: carcassHeightMm,
    depthMm: carcassDepthMm,
    panelThicknessMm,
    backThicknessMm: 6.0,
    grooveWidthMm: 7.0,
    grooveDepthMm: 7.0,
    grooveRearDatumMm: 20.0,
  };

  // Sections -> Bays
  const rawSections = Array.isArray(wardrobeModel.sections) && wardrobeModel.sections.length > 0
    ? wardrobeModel.sections
    : [{ id: "section-01", widthMm: widthMm - 2 * panelThicknessMm, components: [] }];

  const bayCount = rawSections.length;
  const totalDividersWidth = (bayCount - 1) * panelThicknessMm;
  const totalSidesWidth = 2 * panelThicknessMm;
  const availableInteriorWidthMm = widthMm - totalSidesWidth - totalDividersWidth;

  // Reconcile bay clear widths to guarantee exact sum = availableInteriorWidthMm
  const sumRawWidths = rawSections.reduce((acc, s) => acc + (Number(s.widthMm) || 0), 0);
  const bays = rawSections.map((sec, index) => {
    let clearWidthMm;
    if (Math.abs(sumRawWidths - availableInteriorWidthMm) < 0.001) {
      clearWidthMm = Number(sec.widthMm);
    } else {
      // Distribute available width proportionally or equally
      const ratio = sumRawWidths > 0 ? (Number(sec.widthMm) || 1) / sumRawWidths : 1 / bayCount;
      clearWidthMm = Math.round((availableInteriorWidthMm * ratio) * 10) / 10;
    }

    const bayId = sec.id || `bay-${pad2(index + 1)}`;
    const components = [];

    const secComponents = Array.isArray(sec.components) ? sec.components : [];
    secComponents.forEach((comp, compIdx) => {
      const cId = comp.id || `${bayId}-comp-${compIdx + 1}`;
      const cType = String(comp.type || "").toUpperCase();

      if (cType === "SHELF") {
        // Shelf: default 18mm thickness, 560mm depth, clearOpening above
        const shelfDepthMm = carcassDepthMm - 20.0;
        const pos = Number(comp.positionMm) || 0;
        const openingAbove = pos > 0 ? Math.max(carcassHeightMm - pos - panelThicknessMm, 50) : 350.0;
        components.push({
          id: cId,
          type: COMPONENT_TYPES.SHELF_FIXED,
          clearOpeningAboveMm: openingAbove,
          thicknessMm: panelThicknessMm,
          depthMm: shelfDepthMm,
        });
      } else if (cType === "HANGING_RAIL") {
        const drop = Number(comp.positionMm) || 1400.0;
        components.push({
          id: cId,
          type: drop > 1000 ? COMPONENT_TYPES.HANGING_RAIL_LONG : COMPONENT_TYPES.HANGING_RAIL_SHORT,
          offsetBelowShelfMm: 100.0,
          targetClearDropMm: drop,
        });
      } else if (cType === "DRAWER_BANK") {
        components.push({
          id: cId,
          type: COMPONENT_TYPES.DRAWER_BANK,
          offsetFromBottomMm: Number(comp.positionMm) || 0,
          rows: comp.rows || 3,
        });
      }
    });

    return {
      id: bayId,
      index,
      clearWidthMm,
      components,
    };
  });

  // Ensure exact width reconciliation for validateFurniSpec:
  // requiredSidesWidthDmm + sumBayWidthsDmm === envWDmm
  const currentSumBays = bays.reduce((sum, b) => sum + b.clearWidthMm, 0);
  const diffWidth = availableInteriorWidthMm - currentSumBays;
  if (Math.abs(diffWidth) > 0.0001 && bays.length > 0) {
    // Add discrepancy to the last bay to guarantee exact closure
    bays[bays.length - 1].clearWidthMm = Math.round((bays[bays.length - 1].clearWidthMm + diffWidth) * 10) / 10;
  }

  // Doors calculation & closure
  // Check if door components specify leaves
  const doorComps = rawSections.flatMap((s) => (s.components || []).filter((c) => String(c.type || "").toUpperCase() === "DOOR"));
  const doorLeavesSpecified = doorComps.reduce((sum, d) => sum + (d.leaves || 1), 0);

  let doorCount = doorLeavesSpecified > 0
    ? doorLeavesSpecified
    : (widthMm >= 1800 ? 4 : (widthMm >= 1000 ? 2 : 1));

  // Door reveals: 2.0 mm everywhere
  const revealTopMm = 2.0;
  const revealBottomMm = 2.0;
  const revealPerimeterMm = 2.0;
  const revealInterMm = 2.0;

  // Door finished height = carcass.heightMm - topReveal - bottomReveal
  const doorFinishedHeightMm = carcassHeightMm - revealTopMm - revealBottomMm;

  // Door finished width closure:
  // env.widthMm = leftReveal + rightReveal + (count - 1) * interReveal + count * doorWidth
  const totalRevealsWidthMm = 2 * revealPerimeterMm + (doorCount - 1) * revealInterMm;
  const doorFinishedWidthMm = Math.round(((widthMm - totalRevealsWidthMm) / doorCount) * 10) / 10;

  const doors = {
    count: doorCount,
    thicknessMm: doorThicknessMm,
    bumperGapMm,
    finishedWidthMm: doorFinishedWidthMm,
    finishedHeightMm: doorFinishedHeightMm,
    reveals: {
      topMm: revealTopMm,
      bottomMm: revealBottomMm,
      leftMm: revealPerimeterMm,
      rightMm: revealPerimeterMm,
      interDoorMm: revealInterMm,
    },
  };

  const finishType = options.finishType || FINISH_TYPES.MELAMINE;

  const furniSpec = {
    schemaVersion: FURNISPEC_SCHEMA_VERSION,
    specId,
    sourceSpecId: specId,
    revision,
    unit: "mm",
    furnitureType: FURNITURE_TYPES.WARDROBE,
    wardrobeType: WARDROBE_TYPES.STRAIGHT_HINGED,
    constructionStyle: CONSTRUCTION_STYLES.CAP_STYLE,
    finishType,
    status: SPEC_STATUS.APPROVED,
    qualificationStatus: QUALIFICATION_STATUS.WORKSHOP_REVIEW_NOT_CNC_QUALIFIED,
    envelope: {
      widthMm,
      heightMm,
      depthMm,
    },
    plinth,
    carcass,
    bays,
    doors,
    edgeBanding: {
      frontVisibleMm: 1.0,
      doorPerimeterMm: 1.0,
      rearUnbandedMm: 0.0,
    },
    materials: {
      carcass: {
        code: "MEL_WHITE_18",
        name: "White Melamine 18mm",
        thicknessMm: panelThicknessMm,
      },
      backPanel: {
        code: "HDF_WHITE_06",
        name: "White HDF 6mm",
        thicknessMm: 6.0,
      },
      fronts: {
        code: "MEL_WHITE_18",
        name: "White Melamine 18mm",
        thicknessMm: doorThicknessMm,
      },
    },
    hardware: {
      hinges: {
        series: "CONCEALED_CLIP_ON_110",
        brand: "BLUM_OR_HETTICH",
        approvalDate: null,
        status: HARDWARE_APPROVAL_STATUS.BLOCKED_PENDING_HARDWARE_APPROVAL,
      },
      shelfPins: {
        series: "DUBO_5MM_PLASTIC_OR_STEEL",
        brand: "GENERIC_SYSTEM_32",
        approvalDate: null,
        status: HARDWARE_APPROVAL_STATUS.BLOCKED_PENDING_HARDWARE_APPROVAL,
      },
      joinery: {
        series: "MINIFIX_OR_CONFIRMAT",
        brand: "GENERIC_CAM_LOCK",
        approvalDate: null,
        status: HARDWARE_APPROVAL_STATUS.BLOCKED_PENDING_HARDWARE_APPROVAL,
      },
    },
    machiningPolicy: {
      backGroove: MACHINING_POLICY.APPROVED,
      drilling: MACHINING_POLICY.BLOCKED_PENDING_HARDWARE_APPROVAL,
    },
    clearancePolicy: {
      backPanel: {
        grooveRootAllowanceMm: 1.5,
      },
      adjustableShelf: {
        sideClearanceMm: 1.0,
        frontSetbackMm: 10.0,
      },
    },
    safetyAndMachining: {
      backGrooveMachining: "APPROVED",
      hardwareDrilling: "BLOCKED_PENDING_HARDWARE_APPROVAL",
      cncQualified: "NO",
    },
  };

  return furniSpec;
}
