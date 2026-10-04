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
 *   to avoid silent intent change; the drop is now the model's real clear drop,
 *   and the rail is placed at the model's rod centre (2026-09-30).
 * - SHELF / HANGING_RAIL / DRAWER_BANK positions are translated from the model's
 *   interior-floor datum; components are emitted top-down per bay.
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
import { zoneHeightMm } from "../wardrobe-model/schema.js";

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

    // WardrobeModel positions are heights above the section's interior floor
    // (wardrobe-model/schema.js). FurniSpec positions a SHELF from the bay
    // floor (offsetFromBottomMm) and a HANGING_RAIL relative to the underside
    // of whatever the kernel placed above it (offsetBelowShelfMm), walking the
    // bay top-down. So the zone components are emitted top-down and every
    // position is translated from the model's own geometry.
    //
    // Before 2026-09-30 a rail was always put 100 mm under the shelf above it
    // and its model POSITION was declared as its clear DROP: a rail the
    // customer placed 1400 mm above the floor, over a shelf at 400 mm, was
    // compiled 264 mm above the floor, under that shelf, claiming a 1400 mm
    // drop. A shelf's position was measured from the carcass top instead of
    // the floor. Both are corrected here; nothing is clamped or relocated —
    // a model that does not fit the carcass is refused by the kernel.
    const interiorTopMm = carcassHeightMm - 2 * panelThicknessMm;
    const zoneOf = (comp) => {
      const t = String(comp.type || "").toUpperCase();
      const pos = Number(comp.positionMm) || 0;
      const h =
        comp.heightMm != null && Number.isFinite(Number(comp.heightMm))
          ? Number(comp.heightMm)
          : zoneHeightMm(t, comp);
      return { t, pos, h };
    };
    const ordered = secComponents
      .map((comp, compIdx) => ({ comp, compIdx, ...zoneOf(comp) }))
      .sort((a, b) => b.pos - a.pos || a.compIdx - b.compIdx);

    let underFaceAboveMm = interiorTopMm; // underside of the component above, from interior floor
    ordered.forEach(({ comp, compIdx, t: cType, pos, h }) => {
      const cId = comp.id || `${bayId}-comp-${compIdx + 1}`;

      if (cType === "SHELF") {
        // Mapping assumption: WardrobeModel SHELF → SHELF_FIXED (labelled on draft).
        const shelfDepthMm = carcassDepthMm - resolve("fixedShelfRearSetbackMm");
        components.push({
          id: cId,
          type: COMPONENT_TYPES.SHELF_FIXED,
          offsetFromBottomMm: pos,
          thicknessMm: panelThicknessMm,
          depthMm: shelfDepthMm,
        });
        underFaceAboveMm = pos;
      } else if (cType === "HANGING_RAIL") {
        // Rod centre = position + zone/2 (wardrobe-model/kernel.js auto-stack).
        const rodCentreMm = pos + h / 2;
        const offsetBelowMm = underFaceAboveMm - rodCentreMm;
        if (!(offsetBelowMm > 0)) {
          const err = new Error(
            `Cannot adapt hanging rail "${cId}": its rod centre (${rodCentreMm}mm above the floor) is not below ` +
              `the component above it (underside ${underFaceAboveMm}mm). Refuse rather than relocate.`
          );
          err.code = "RAIL_POSITION_NOT_REPRESENTABLE";
          throw err;
        }
        // The drop the MODEL actually has: rod centre down to the top of the
        // highest zone component below it in this section, or the floor.
        const obstructionTopMm = ordered
          .filter((o) => o.comp !== comp && o.t !== "DOOR" && o.t !== "DIVIDER" && o.pos + o.h <= rodCentreMm)
          .reduce((top, o) => Math.max(top, o.pos + o.h), 0);
        const drop = rodCentreMm - obstructionTopMm;
        // Preserve prior product heuristic (drop > 1000 → LONG), now on the real drop.
        components.push({
          id: cId,
          type: drop > 1000 ? COMPONENT_TYPES.HANGING_RAIL_LONG : COMPONENT_TYPES.HANGING_RAIL_SHORT,
          offsetBelowShelfMm: offsetBelowMm,
          targetClearDropMm: drop,
        });
      } else if (cType === "DRAWER_BANK") {
        components.push({
          id: cId,
          type: COMPONENT_TYPES.DRAWER_BANK,
          offsetFromBottomMm: pos,
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
