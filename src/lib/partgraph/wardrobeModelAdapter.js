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
 * - Defaults status=PROPOSED (draft) with labelled adapterAssumptions — does not
 *   silently promote to workshop-approved / CNC-qualified.
 * - qualificationStatus stays WORKSHOP_REVIEW_NOT_CNC_QUALIFIED.
 * - Hardware drilling remains BLOCKED_PENDING_HARDWARE_APPROVAL.
 * - SHELF → SHELF_FIXED is an explicit mapping assumption (WardrobeModel has no kind).
 * - HANGING_RAIL LONG vs SHORT keeps prior product heuristic (drop > 1000 → LONG)
 *   to avoid silent intent change; Claude nearer-target mapping is documented only.
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
import { validateFurniSpec } from "../furnispec/validate.js";
import { resolve, ruleIdOf, doorsForBayWidth } from "../rules/wardrobeRuleCatalog.js";
import { resolve } from "../rules/wardrobeRuleCatalog.js";

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

  // Plinth — provisional default when model/options omit it (labelled below).
  const plinthHeightMm = Number(
    options.plinthHeightMm ?? wardrobeModel.plinthHeightMm ?? 100.0
  );
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
  // BAY_WIDTH_CLOSURE_FAILED, not silent adjustment. The previous version
  // rescaled every bay proportionally when the sections did not close, and
  // then absorbed any remainder into the LAST bay - a stated 800mm section
  // came back as 834.9mm with no notice. Everywhere else in this kernel a
  // derivation that does not close exactly throws rather than rounds.
  const closureDiffMm = Math.round((availableInteriorWidthMm - sumRawWidths) * 10) / 10;
  if (closureDiffMm !== 0) {
    const err = new Error(
      `Bay widths do not close: sections total ${sumRawWidths}mm but ${availableInteriorWidthMm}mm is available ` +
        `(overall ${widthMm}mm minus two ${panelThicknessMm}mm sides and ${bayCount - 1} divider(s)). ` +
        `Difference ${closureDiffMm}mm. Adjust the section widths rather than having them adjusted for you.`
    );
    err.code = "BAY_WIDTH_CLOSURE_FAILED";
    err.differenceMm = closureDiffMm;
    throw err;
  }

  const bays = rawSections.map((sec, index) => {
    const clearWidthMm = Number(sec.widthMm);

    const bayId = sec.id || `bay-${pad2(index + 1)}`;
    const components = [];

    const secComponents = Array.isArray(sec.components) ? sec.components : [];
    secComponents.forEach((comp, compIdx) => {
      const cId = comp.id || `${bayId}-comp-${compIdx + 1}`;
      const cType = String(comp.type || "").toUpperCase();

      if (cType === "SHELF") {
        // Mapping assumption: WardrobeModel SHELF → SHELF_FIXED (labelled on draft).
        const shelfDepthMm = carcassDepthMm - resolve("fixedShelfRearSetbackMm");
        const pos = Number(comp.positionMm) || 0;
        let openingAbove;
        if (pos > 0) {
          openingAbove = carcassHeightMm - pos - panelThicknessMm;
          // Do NOT silently clamp/relocate with a 50 mm floor — that moves the shelf.
          if (!(openingAbove > 0)) {
            throw new Error(
              `Cannot adapt shelf "${cId}": position ${pos}mm leaves non-positive clear opening above ` +
                `(${openingAbove}mm). Refuse rather than relocate.`
            );
          }
        } else {
          openingAbove = resolve("topCompartmentClearOpeningMm");
        }
        components.push({
          id: cId,
          type: COMPONENT_TYPES.SHELF_FIXED,
          clearOpeningAboveMm: openingAbove,
          thicknessMm: panelThicknessMm,
          depthMm: shelfDepthMm,
        });
      } else if (cType === "HANGING_RAIL") {
        const drop = Number(comp.positionMm) || resolve("longHangingTargetClearDropMm");
        // Preserve prior product heuristic (drop > 1000 → LONG) to avoid silent reclass.
        components.push({
          id: cId,
          type: drop > 1000 ? COMPONENT_TYPES.HANGING_RAIL_LONG : COMPONENT_TYPES.HANGING_RAIL_SHORT,
          offsetBelowShelfMm: resolve("hangingRailOffsetBelowShelfMm"),
          targetClearDropMm: drop,
        });
      } else if (cType === "DRAWER_BANK") {
        components.push({
          id: cId,
          type: COMPONENT_TYPES.DRAWER_BANK,
          offsetFromBottomMm: Number(comp.positionMm) || 0,
          rows: comp.rows || 3,
        });
      } else if (cType === "DOOR" || cType === "DIVIDER") {
        // Doors handled at envelope level; dividers implied by section splits.
      } else {
        // M2-OMIT-01: never silently drop an unmapped component type.
        throw new Error(
          `Cannot adapt component "${cId}" of type "${comp.type}" — unmapped types are refused, not dropped.`
        );
      }
    });

    return {
      id: bayId,
      index,
      clearWidthMm,
      components,
    };
  });

  // Closure was asserted above, before any bay was built. Nothing is adjusted here.

  // Doors calculation & closure
  // Check if door components specify leaves
  const doorComps = rawSections.flatMap((s) => (s.components || []).filter((c) => String(c.type || "").toUpperCase() === "DOOR"));
  const doorLeavesSpecified = doorComps.reduce((sum, d) => sum + (d.leaves || 1), 0);

  let doorCount = doorLeavesSpecified > 0
    ? doorLeavesSpecified
    // RULEBOOK_V0_2_DOORS_PER_BAY, per bay. A customer's stated `leaves` wins.
    : bays.reduce((sum, bay) => sum + doorsForBayWidth(bay.clearWidthMm), 0);

  // Door reveals: 2.0 mm everywhere
  const revealMm = resolve("doorRevealMm");
  const revealTopMm = revealMm;
  const revealBottomMm = revealMm;
  const revealPerimeterMm = revealMm;
  const revealInterMm = revealMm;

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
  const status = options.status || SPEC_STATUS.PROPOSED;
  const assumptions = [
    {
      key: "plinth.heightMm",
      value: plinthHeightMm,
      provenance: "PROVISIONAL_PENDING_BEKZOD_REVIEW",
      note: "WardrobeModel has no plinth; default 100 mm unless options/model supply plinthHeightMm.",
    },
    {
      key: "shelf.kind",
      value: "SHELF_FIXED",
      provenance: "MAPPING_ASSUMPTION",
      note: "WardrobeModel SHELF has no fixed/adjustable flag; default FIXED (housed).",
    },
    {
      key: "hangingRail.kind",
      value: "drop > 1000 → LONG else SHORT",
      provenance: "PRODUCT_HEURISTIC_PRESERVED",
      note: "Prior candidate heuristic retained to avoid silent intent change vs Claude nearer-of-(1400,900) mapping.",
    },
    {
      key: "shelf.openingAbove",
      value: "computed from position; refuse if non-positive",
      provenance: "MAPPING_ASSUMPTION",
      note: "Removed silent Math.max(...,50) clamp that relocated shelves. Fallback uses topCompartmentClearOpeningMm (GOLDEN).",
    },
    {
      key: "drawer.constructionDefaults",
      value: "emitDrawerBankParts provisional pack",
      provenance: "PROVISIONAL_PENDING_BEKZOD_REVIEW",
      note: "Five Claude drawerPack inputs filled by conversational construction defaults — not BEKZOD_RULING box geometry.",
    },
  ];

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
    status,
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
        // Was 1.5, against WR-005's 1.0. An adapter emitting different
        // clearances than the rulebook states is a second source of truth.
        grooveRootAllowanceMm: resolve("grooveRootAllowanceMm"),
      },
      adjustableShelf: {
        sideClearanceMm: resolve("adjustableShelfSideClearanceMm"),
        // Was 10.0, against GF-ADJ-FRONT's 5.0.
        frontSetbackMm: resolve("adjustableShelfFrontSetbackMm"),
      },
    },
    safetyAndMachining: {
      backGrooveMachining: "APPROVED",
      hardwareDrilling: "BLOCKED_PENDING_HARDWARE_APPROVAL",
      cncQualified: "NO",
    },
    adapterAssumptions: assumptions,
  };

  // The header promises this is "consumable by buildStructuralPartGraph()".
  // Nothing checked it, so a malformed spec surfaced as a kernel error naming
  // the kernel - sending the next reader to the wrong file.
  const validation = validateFurniSpec(furniSpec);
  if (!validation.valid) {
    const err = new Error(
      "adaptWardrobeModelToFurniSpec produced a FurniSpec the validator rejects: " +
        validation.errors.slice(0, 5)
          .map((e) => `[${e.code}] ${e.message}${e.path ? ` (at ${e.path})` : ""}`)
          .join(" ")
    );
    err.code = "ADAPTED_FURNISPEC_INVALID";
    err.validationErrors = validation.errors;
    throw err;
  }

  return furniSpec;
}
