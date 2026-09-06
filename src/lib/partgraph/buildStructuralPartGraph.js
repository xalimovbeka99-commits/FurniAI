/**
 * PartGraph v0.1 — Pure Deterministic Rectangular Kernel (Generalized)
 * ---------------------------------------------------------------------
 * Generates canonical structural PartGraph data structures from a validated
 * FurniSpec v0.1 specification.
 *
 * Guaranteed invariants:
 * - Pure deterministic execution: zero I/O, randomness, dates, or UI dependencies.
 * - All internal math performed in exact integer deci-millimetres (0.1 mm).
 * - Fully parametric: derives all panel quantities, dimensions, and placements
 *   exclusively from the input FurniSpec without hardcoded fixture values.
 * - Hardware drilling machining is explicitly excluded/blocked.
 */

import { validateFurniSpec } from "../furnispec/validate.js";
import { assertDeciMm, toDeciMm } from "../furnispec/units.js";
import { PARTGRAPH_VERSION, PART_ROLES, GEOMETRY_TYPES, GRAIN_DIRECTIONS, ORIENTATIONS } from "./schema.js";

/**
 * Builds the canonical structural PartGraph from a FurniSpec v0.1 object.
 *
 * @param {object} furniSpec
 * @returns {object} Canonical PartGraph object
 */
export function buildStructuralPartGraph(furniSpec) {
  const valResult = validateFurniSpec(furniSpec);
  if (!valResult.valid) {
    const err = new Error(`Cannot generate PartGraph from invalid FurniSpec: ${valResult.errors.map((e) => e.message).join("; ")}`);
    err.code = "INVALID_FURNISPEC";
    err.validationErrors = valResult.errors;
    throw err;
  }

  // Extract all dimensions in integer deci-millimetres (1 dmm = 0.1 mm)
  const envWDmm = assertDeciMm(furniSpec.envelope.widthMm, "envelope.widthMm");
  const envHDmm = assertDeciMm(furniSpec.envelope.heightMm, "envelope.heightMm");
  const envDDmm = assertDeciMm(furniSpec.envelope.depthMm, "envelope.depthMm");

  const plinthHDmm = assertDeciMm(furniSpec.plinth.heightMm, "plinth.heightMm");
  const plinthRecessDmm = toDeciMm(furniSpec.plinth.frontRecessMm, "plinth.frontRecessMm");
  const plinthSideInsetDmm = toDeciMm(furniSpec.plinth.sideInsetMm, "plinth.sideInsetMm");

  const carcassHDmm = assertDeciMm(furniSpec.carcass.heightMm, "carcass.heightMm");
  const carcassDDmm = assertDeciMm(furniSpec.carcass.depthMm, "carcass.depthMm");
  const panelTDmm = assertDeciMm(furniSpec.carcass.panelThicknessMm, "carcass.panelThicknessMm");
  const backTDmm = assertDeciMm(furniSpec.carcass.backThicknessMm, "carcass.backThicknessMm");
  const grvWidthDmm = assertDeciMm(furniSpec.carcass.grooveWidthMm, "carcass.grooveWidthMm");
  const grvDepthDmm = assertDeciMm(furniSpec.carcass.grooveDepthMm, "carcass.grooveDepthMm");
  const grvRearDatumDmm = assertDeciMm(furniSpec.carcass.grooveRearDatumMm, "carcass.grooveRearDatumMm");

  const doorTDmm = assertDeciMm(furniSpec.doors.thicknessMm, "doors.thicknessMm");
  const bumperGapDmm = assertDeciMm(furniSpec.doors.bumperGapMm, "doors.bumperGapMm");
  const doorCount = furniSpec.doors.count;
  const doorWDmm = assertDeciMm(furniSpec.doors.finishedWidthMm, "doors.finishedWidthMm");
  const doorHDmm = assertDeciMm(furniSpec.doors.finishedHeightMm, "doors.finishedHeightMm");

  const revTopDmm = toDeciMm(furniSpec.doors.reveals.topMm, "doors.reveals.topMm");
  const revBotDmm = toDeciMm(furniSpec.doors.reveals.bottomMm, "doors.reveals.bottomMm");
  const revLeftDmm = toDeciMm(furniSpec.doors.reveals.leftMm, "doors.reveals.leftMm");
  const revInterDmm = toDeciMm(furniSpec.doors.reveals.interDoorMm, "doors.reveals.interDoorMm");

  const edgeFrontDmm = toDeciMm(furniSpec.edgeBanding.frontVisibleMm, "edgeBanding.frontVisibleMm");
  const edgeDoorDmm = toDeciMm(furniSpec.edgeBanding.doorPerimeterMm, "edgeBanding.doorPerimeterMm");
  const edgeRearDmm = toDeciMm(furniSpec.edgeBanding.rearUnbandedMm, "edgeBanding.rearUnbandedMm");

  const matCarcass = furniSpec.materials.carcass.code;
  const matBack = furniSpec.materials.backPanel.code;
  const matFront = furniSpec.materials.fronts.code;

  // Compute primary global Z datums
  const zDoorFrontDmm = 0;
  const zDoorRearDmm = doorTDmm;
  const zCarcassFrontDmm = doorTDmm + bumperGapDmm;
  const zCarcassRearDmm = zCarcassFrontDmm + carcassDDmm;

  // Compute primary global Y datums
  const yFloorDmm = 0;
  const yPlinthTopDmm = plinthHDmm;
  const yBotTopDmm = yPlinthTopDmm + panelTDmm;
  const yTopBottomDmm = yFloorDmm + envHDmm - panelTDmm;
  const yTopTopDmm = yFloorDmm + envHDmm;
  const internalCarcassHDmm = yTopBottomDmm - yBotTopDmm;

  // Compute primary global X datums
  const internalCarcassWDmm = envWDmm - 2 * panelTDmm;

  // Divider and shelf depth (set back behind carcass rear by groove rear datum)
  const dividerDepthDmm = carcassDDmm - grvRearDatumDmm;

  const parts = [];

  // Helper to build a structural panel entry
  const createPanel = ({
    id,
    role,
    materialCode,
    lengthDmm,
    widthDmm,
    thicknessDmm,
    minXDmm,
    maxXDmm,
    minYDmm,
    maxYDmm,
    minZDmm,
    maxZDmm,
    orientation,
    grainDirection = GRAIN_DIRECTIONS.LENGTH,
    edges,
    sourceRuleIds,
  }) => {
    // Calculate raw cutting dimensions by subtracting edge banding on each edge
    const rawLengthDmm = lengthDmm - (edges.WIDTH_EDGE_1 + edges.WIDTH_EDGE_2);
    const rawWidthDmm = widthDmm - (edges.LENGTH_EDGE_1 + edges.LENGTH_EDGE_2);

    return {
      id,
      role,
      quantity: 1,
      materialCode,
      geometryType: GEOMETRY_TYPES.RECTANGULAR_PANEL,
      finished: {
        lengthDmm,
        widthDmm,
        thicknessDmm,
      },
      raw: {
        lengthDmm: rawLengthDmm,
        widthDmm: rawWidthDmm,
        thicknessDmm,
      },
      placement: {
        minXDmm,
        maxXDmm,
        minYDmm,
        maxYDmm,
        minZDmm,
        maxZDmm,
      },
      orientation,
      grainDirection,
      edges: {
        LENGTH_EDGE_1: edges.LENGTH_EDGE_1,
        LENGTH_EDGE_2: edges.LENGTH_EDGE_2,
        WIDTH_EDGE_1: edges.WIDTH_EDGE_1,
        WIDTH_EDGE_2: edges.WIDTH_EDGE_2,
      },
      status: "APPROVED",
      sourceRuleIds,
    };
  };

  // 1. CARC_TOP (Top Cap Panel)
  parts.push(
    createPanel({
      id: "CARC_TOP",
      role: PART_ROLES.TOP_PANEL,
      materialCode: matCarcass,
      lengthDmm: envWDmm,
      widthDmm: carcassDDmm,
      thicknessDmm: panelTDmm,
      minXDmm: 0,
      maxXDmm: envWDmm,
      minYDmm: yTopBottomDmm,
      maxYDmm: yTopTopDmm,
      minZDmm: zCarcassFrontDmm,
      maxZDmm: zCarcassRearDmm,
      orientation: ORIENTATIONS.HORIZONTAL_XZ,
      edges: {
        LENGTH_EDGE_1: edgeFrontDmm,
        LENGTH_EDGE_2: edgeRearDmm,
        WIDTH_EDGE_1: edgeFrontDmm,
        WIDTH_EDGE_2: edgeFrontDmm,
      },
      sourceRuleIds: ["WR-001", "WR-003", "WR-013"],
    })
  );

  // 2. CARC_BOT (Bottom Base Panel)
  parts.push(
    createPanel({
      id: "CARC_BOT",
      role: PART_ROLES.BOTTOM_PANEL,
      materialCode: matCarcass,
      lengthDmm: envWDmm,
      widthDmm: carcassDDmm,
      thicknessDmm: panelTDmm,
      minXDmm: 0,
      maxXDmm: envWDmm,
      minYDmm: yPlinthTopDmm,
      maxYDmm: yBotTopDmm,
      minZDmm: zCarcassFrontDmm,
      maxZDmm: zCarcassRearDmm,
      orientation: ORIENTATIONS.HORIZONTAL_XZ,
      edges: {
        LENGTH_EDGE_1: edgeFrontDmm,
        LENGTH_EDGE_2: edgeRearDmm,
        WIDTH_EDGE_1: edgeFrontDmm,
        WIDTH_EDGE_2: edgeFrontDmm,
      },
      sourceRuleIds: ["WR-001", "WR-003", "WR-013"],
    })
  );

  // 3. CARC_SIDE_L (Left Outer Side Panel)
  parts.push(
    createPanel({
      id: "CARC_SIDE_L",
      role: PART_ROLES.SIDE_PANEL_LEFT,
      materialCode: matCarcass,
      lengthDmm: internalCarcassHDmm,
      widthDmm: carcassDDmm,
      thicknessDmm: panelTDmm,
      minXDmm: 0,
      maxXDmm: panelTDmm,
      minYDmm: yBotTopDmm,
      maxYDmm: yTopBottomDmm,
      minZDmm: zCarcassFrontDmm,
      maxZDmm: zCarcassRearDmm,
      orientation: ORIENTATIONS.VERTICAL_YZ,
      edges: {
        LENGTH_EDGE_1: edgeFrontDmm,
        LENGTH_EDGE_2: edgeRearDmm,
        WIDTH_EDGE_1: 0,
        WIDTH_EDGE_2: 0,
      },
      sourceRuleIds: ["WR-001", "WR-003", "WR-013"],
    })
  );

  // 4. CARC_SIDE_R (Right Outer Side Panel)
  parts.push(
    createPanel({
      id: "CARC_SIDE_R",
      role: PART_ROLES.SIDE_PANEL_RIGHT,
      materialCode: matCarcass,
      lengthDmm: internalCarcassHDmm,
      widthDmm: carcassDDmm,
      thicknessDmm: panelTDmm,
      minXDmm: envWDmm - panelTDmm,
      maxXDmm: envWDmm,
      minYDmm: yBotTopDmm,
      maxYDmm: yTopBottomDmm,
      minZDmm: zCarcassFrontDmm,
      maxZDmm: zCarcassRearDmm,
      orientation: ORIENTATIONS.VERTICAL_YZ,
      edges: {
        LENGTH_EDGE_1: edgeFrontDmm,
        LENGTH_EDGE_2: edgeRearDmm,
        WIDTH_EDGE_1: 0,
        WIDTH_EDGE_2: 0,
      },
      sourceRuleIds: ["WR-001", "WR-003", "WR-013"],
    })
  );

  // 5. Divider and Bay geometry calculation
  const baySpans = [];
  const dividers = [];
  let xCursor = panelTDmm;

  for (let b = 0; b < furniSpec.bays.length; b++) {
    const bay = furniSpec.bays[b];
    const clearWDmm = assertDeciMm(bay.clearWidthMm, `bays[${b}].clearWidthMm`);
    const bayMinX = xCursor;
    const bayMaxX = bayMinX + clearWDmm;

    baySpans.push({
      index: b,
      id: bay.id,
      minXDmm: bayMinX,
      maxXDmm: bayMaxX,
      clearWidthDmm: clearWDmm,
      components: bay.components || [],
    });

    xCursor = bayMaxX;

    if (b < furniSpec.bays.length - 1) {
      const divIndex = b + 1;
      const divId = `CARC_DIV_${String(divIndex).padStart(2, "0")}`;
      const divMinX = xCursor;
      const divMaxX = divMinX + panelTDmm;

      dividers.push({
        id: divId,
        minXDmm: divMinX,
        maxXDmm: divMaxX,
      });

      xCursor = divMaxX;
    }
  }

  // Push dividers into parts
  for (const div of dividers) {
    parts.push(
      createPanel({
        id: div.id,
        role: PART_ROLES.DIVIDER_PANEL,
        materialCode: matCarcass,
        lengthDmm: internalCarcassHDmm,
        widthDmm: dividerDepthDmm,
        thicknessDmm: panelTDmm,
        minXDmm: div.minXDmm,
        maxXDmm: div.maxXDmm,
        minYDmm: yBotTopDmm,
        maxYDmm: yTopBottomDmm,
        minZDmm: zCarcassFrontDmm,
        maxZDmm: zCarcassFrontDmm + dividerDepthDmm,
        orientation: ORIENTATIONS.VERTICAL_YZ,
        edges: {
          LENGTH_EDGE_1: edgeFrontDmm,
          LENGTH_EDGE_2: edgeRearDmm,
          WIDTH_EDGE_1: 0,
          WIDTH_EDGE_2: 0,
        },
        sourceRuleIds: ["WR-002", "WR-003", "WR-013"],
      })
    );
  }

  // 6. Shelves Calculation (Fixed and Adjustable)
  const fixedShelves = [];
  const adjShelves = [];

  for (const bay of baySpans) {
    let currentBottomFaceY = yTopBottomDmm;
    let currentRailCenterY = null;

    for (const comp of bay.components) {
      const thicknessDmm = comp.thicknessMm ? toDeciMm(comp.thicknessMm, `${comp.id}.thicknessMm`) : panelTDmm;
      const compDepthDmm = comp.depthMm ? toDeciMm(comp.depthMm, `${comp.id}.depthMm`) : dividerDepthDmm;

      if (comp.type === "SHELF_FIXED") {
        let minYDmm;
        let maxYDmm;

        if (comp.clearOpeningAboveMm !== undefined) {
          const openingDmm = toDeciMm(comp.clearOpeningAboveMm, `${comp.id}.clearOpeningAboveMm`);
          maxYDmm = currentBottomFaceY - openingDmm;
          minYDmm = maxYDmm - thicknessDmm;
        } else if (comp.elevationMm !== undefined) {
          minYDmm = toDeciMm(comp.elevationMm, `${comp.id}.elevationMm`);
          maxYDmm = minYDmm + thicknessDmm;
        } else if (comp.offsetFromBottomMm !== undefined) {
          minYDmm = yBotTopDmm + toDeciMm(comp.offsetFromBottomMm, `${comp.id}.offsetFromBottomMm`);
          maxYDmm = minYDmm + thicknessDmm;
        } else {
          throw new Error(`Component "${comp.id}" missing vertical positioning.`);
        }

        currentBottomFaceY = minYDmm;

        const partId = comp.partId || comp.id.toUpperCase().replace(/-/g, "_");
        fixedShelves.push({
          id: partId,
          bayIndex: bay.index,
          role: PART_ROLES.FIXED_SHELF,
          materialCode: matCarcass,
          lengthDmm: bay.clearWidthDmm,
          widthDmm: compDepthDmm,
          thicknessDmm,
          minXDmm: bay.minXDmm,
          maxXDmm: bay.maxXDmm,
          minYDmm,
          maxYDmm,
          minZDmm: zCarcassFrontDmm,
          maxZDmm: zCarcassFrontDmm + compDepthDmm,
          orientation: ORIENTATIONS.HORIZONTAL_XZ,
          edges: {
            LENGTH_EDGE_1: edgeFrontDmm,
            LENGTH_EDGE_2: edgeRearDmm,
            WIDTH_EDGE_1: 0,
            WIDTH_EDGE_2: 0,
          },
          sourceRuleIds: ["WR-003", "WR-008", "WR-013"],
        });
      } else if (comp.type.startsWith("HANGING_RAIL")) {
        const offsetBelowDmm = assertDeciMm(comp.offsetBelowShelfMm, `${comp.id}.offsetBelowShelfMm`);
        currentRailCenterY = currentBottomFaceY - offsetBelowDmm;
      } else if (comp.type === "SHELF_ADJUSTABLE") {
        let minYDmm;
        let maxYDmm;

        if (comp.clearDropAboveMm !== undefined && currentRailCenterY !== null) {
          const dropDmm = toDeciMm(comp.clearDropAboveMm, `${comp.id}.clearDropAboveMm`);
          maxYDmm = currentRailCenterY - dropDmm;
          minYDmm = maxYDmm - thicknessDmm;
        } else if (comp.clearOpeningAboveMm !== undefined) {
          const openingDmm = toDeciMm(comp.clearOpeningAboveMm, `${comp.id}.clearOpeningAboveMm`);
          maxYDmm = currentBottomFaceY - openingDmm;
          minYDmm = maxYDmm - thicknessDmm;
        } else if (comp.elevationMm !== undefined) {
          minYDmm = toDeciMm(comp.elevationMm, `${comp.id}.elevationMm`);
          maxYDmm = minYDmm + thicknessDmm;
        } else if (comp.offsetFromBottomMm !== undefined) {
          minYDmm = yBotTopDmm + toDeciMm(comp.offsetFromBottomMm, `${comp.id}.offsetFromBottomMm`);
          maxYDmm = minYDmm + thicknessDmm;
        } else {
          throw new Error(`Component "${comp.id}" missing vertical positioning.`);
        }

        currentBottomFaceY = minYDmm;

        const partId = comp.partId || comp.id.toUpperCase().replace(/-/g, "_");

        const sideClearanceMm = comp.sideClearanceMm ?? furniSpec.clearancePolicy?.adjustableShelf?.sideClearanceMm;
        const frontSetbackMm = comp.frontSetbackMm ?? furniSpec.clearancePolicy?.adjustableShelf?.frontSetbackMm;
        const sideClearanceDmm = assertDeciMm(sideClearanceMm, `${comp.id}.sideClearanceMm`);
        const frontSetbackDmm = assertDeciMm(frontSetbackMm, `${comp.id}.frontSetbackMm`);

        const adjLengthDmm = bay.clearWidthDmm - 2 * sideClearanceDmm;

        adjShelves.push({
          id: partId,
          bayIndex: bay.index,
          role: PART_ROLES.ADJUSTABLE_SHELF,
          materialCode: matCarcass,
          lengthDmm: adjLengthDmm,
          widthDmm: compDepthDmm,
          thicknessDmm,
          minXDmm: bay.minXDmm + sideClearanceDmm,
          maxXDmm: bay.maxXDmm - sideClearanceDmm,
          minYDmm,
          maxYDmm,
          minZDmm: zCarcassFrontDmm + frontSetbackDmm,
          maxZDmm: zCarcassFrontDmm + frontSetbackDmm + compDepthDmm,
          orientation: ORIENTATIONS.HORIZONTAL_XZ,
          edges: {
            LENGTH_EDGE_1: edgeFrontDmm,
            LENGTH_EDGE_2: edgeRearDmm,
            WIDTH_EDGE_1: edgeFrontDmm,
            WIDTH_EDGE_2: edgeFrontDmm,
          },
          sourceRuleIds: ["WR-003", "WR-008", "WR-013"],
        });
      }
    }
  }

  // Push fixed shelves (ordered by bayIndex, then by Y descending)
  fixedShelves.sort((a, b) => a.bayIndex - b.bayIndex || b.minYDmm - a.minYDmm);
  for (const s of fixedShelves) {
    parts.push(createPanel(s));
  }

  // Push adjustable shelves (ordered by bayIndex, then by Y ascending from bottom up)
  adjShelves.sort((a, b) => a.bayIndex - b.bayIndex || a.minYDmm - b.minYDmm);
  for (const s of adjShelves) {
    parts.push(createPanel(s));
  }

  // 7. BACK_PANEL_01 (Back Panel)
  // Engages into groove on all 4 sides with explicit expansion gap at groove root
  const rootAllowanceMm = furniSpec.clearancePolicy?.backPanel?.grooveRootAllowanceMm ?? furniSpec.carcass?.grooveRootAllowanceMm;
  const rootAllowanceDmm = assertDeciMm(rootAllowanceMm, "clearancePolicy.backPanel.grooveRootAllowanceMm");
  const engagementDmm = grvDepthDmm - rootAllowanceDmm;
  const backPanelWDmm = internalCarcassWDmm + 2 * engagementDmm;
  const backPanelHDmm = internalCarcassHDmm + 2 * engagementDmm;

  // Groove channel runs along rear lip of thickness (grvDepthDmm)
  const zBackGrooveChannelMinDmm = zCarcassRearDmm - grvDepthDmm - grvWidthDmm;
  const backPanelAirGapDmm = Math.floor((grvWidthDmm - backTDmm) / 2);
  const zBackPanelMinDmm = zBackGrooveChannelMinDmm + backPanelAirGapDmm;

  parts.push(
    createPanel({
      id: "BACK_PANEL_01",
      role: PART_ROLES.BACK_PANEL,
      materialCode: matBack,
      lengthDmm: backPanelHDmm,
      widthDmm: backPanelWDmm,
      thicknessDmm: backTDmm,
      minXDmm: panelTDmm - engagementDmm,
      maxXDmm: envWDmm - panelTDmm + engagementDmm,
      minYDmm: yBotTopDmm - engagementDmm,
      maxYDmm: yTopBottomDmm + engagementDmm,
      minZDmm: zBackPanelMinDmm,
      maxZDmm: zBackPanelMinDmm + backTDmm,
      orientation: ORIENTATIONS.VERTICAL_XY,
      grainDirection: GRAIN_DIRECTIONS.LENGTH,
      edges: {
        LENGTH_EDGE_1: 0,
        LENGTH_EDGE_2: 0,
        WIDTH_EDGE_1: 0,
        WIDTH_EDGE_2: 0,
      },
      sourceRuleIds: ["WR-003", "WR-004", "WR-005", "WR-006"],
    })
  );

  // 8. DOOR_01 .. DOOR_N (Hinged Doors)
  let doorXCursorDmm = revLeftDmm;
  const doorMinYDmm = yPlinthTopDmm + revBotDmm;
  const doorMaxYDmm = doorMinYDmm + doorHDmm;

  for (let d = 1; d <= doorCount; d++) {
    const doorId = `DOOR_${String(d).padStart(2, "0")}`;
    const minXDmm = doorXCursorDmm;
    const maxXDmm = minXDmm + doorWDmm;

    parts.push(
      createPanel({
        id: doorId,
        role: PART_ROLES.DOOR_PANEL,
        materialCode: matFront,
        lengthDmm: doorHDmm,
        widthDmm: doorWDmm,
        thicknessDmm: doorTDmm,
        minXDmm,
        maxXDmm,
        minYDmm: doorMinYDmm,
        maxYDmm: doorMaxYDmm,
        minZDmm: zDoorFrontDmm,
        maxZDmm: zDoorRearDmm,
        orientation: ORIENTATIONS.VERTICAL_XY,
        grainDirection: GRAIN_DIRECTIONS.LENGTH,
        edges: {
          LENGTH_EDGE_1: edgeDoorDmm,
          LENGTH_EDGE_2: edgeDoorDmm,
          WIDTH_EDGE_1: edgeDoorDmm,
          WIDTH_EDGE_2: edgeDoorDmm,
        },
        sourceRuleIds: ["WR-003", "WR-007", "WR-008", "WR-013"],
      })
    );

    doorXCursorDmm = maxXDmm + revInterDmm;
  }

  // 9. PLINTH STRUCTURE (Aligned with Carcass Frame Footprint)
  const plinthWidthDmm = envWDmm - 2 * plinthSideInsetDmm;
  const zPlinthFrontMinDmm = zCarcassFrontDmm + plinthRecessDmm;
  const zPlinthFrontMaxDmm = zPlinthFrontMinDmm + panelTDmm;
  const zPlinthRearMaxDmm = zCarcassRearDmm;
  const zPlinthRearMinDmm = zPlinthRearMaxDmm - panelTDmm;
  const plinthSideLengthDmm = zPlinthRearMinDmm - zPlinthFrontMaxDmm;

  // Plinth Front Fascia
  parts.push(
    createPanel({
      id: "PLINTH_FRONT",
      role: PART_ROLES.PLINTH_FRONT_FASCIA,
      materialCode: matFront,
      lengthDmm: plinthWidthDmm,
      widthDmm: plinthHDmm,
      thicknessDmm: panelTDmm,
      minXDmm: plinthSideInsetDmm,
      maxXDmm: plinthSideInsetDmm + plinthWidthDmm,
      minYDmm: yFloorDmm,
      maxYDmm: yPlinthTopDmm,
      minZDmm: zPlinthFrontMinDmm,
      maxZDmm: zPlinthFrontMaxDmm,
      orientation: ORIENTATIONS.VERTICAL_XY,
      edges: {
        LENGTH_EDGE_1: edgeFrontDmm,
        LENGTH_EDGE_2: 0,
        WIDTH_EDGE_1: edgeFrontDmm,
        WIDTH_EDGE_2: edgeFrontDmm,
      },
      sourceRuleIds: ["WR-005", "WR-006", "WR-007", "WR-013"],
    })
  );

  // Plinth Rear Rail
  parts.push(
    createPanel({
      id: "PLINTH_REAR",
      role: PART_ROLES.PLINTH_REAR_RAIL,
      materialCode: matCarcass,
      lengthDmm: plinthWidthDmm,
      widthDmm: plinthHDmm,
      thicknessDmm: panelTDmm,
      minXDmm: plinthSideInsetDmm,
      maxXDmm: plinthSideInsetDmm + plinthWidthDmm,
      minYDmm: yFloorDmm,
      maxYDmm: yPlinthTopDmm,
      minZDmm: zPlinthRearMinDmm,
      maxZDmm: zPlinthRearMaxDmm,
      orientation: ORIENTATIONS.VERTICAL_XY,
      edges: {
        LENGTH_EDGE_1: 0,
        LENGTH_EDGE_2: 0,
        WIDTH_EDGE_1: 0,
        WIDTH_EDGE_2: 0,
      },
      sourceRuleIds: ["WR-005", "WR-007"],
    })
  );

  // Plinth Left Side Return
  parts.push(
    createPanel({
      id: "PLINTH_SIDE_L",
      role: PART_ROLES.PLINTH_SIDE_RETURN_LEFT,
      materialCode: matFront,
      lengthDmm: plinthSideLengthDmm,
      widthDmm: plinthHDmm,
      thicknessDmm: panelTDmm,
      minXDmm: plinthSideInsetDmm,
      maxXDmm: plinthSideInsetDmm + panelTDmm,
      minYDmm: yFloorDmm,
      maxYDmm: yPlinthTopDmm,
      minZDmm: zPlinthFrontMaxDmm,
      maxZDmm: zPlinthRearMinDmm,
      orientation: ORIENTATIONS.VERTICAL_YZ,
      edges: {
        LENGTH_EDGE_1: edgeFrontDmm,
        LENGTH_EDGE_2: 0,
        WIDTH_EDGE_1: 0,
        WIDTH_EDGE_2: 0,
      },
      sourceRuleIds: ["WR-005", "WR-006", "WR-007", "WR-013"],
    })
  );

  // Plinth Right Side Return
  parts.push(
    createPanel({
      id: "PLINTH_SIDE_R",
      role: PART_ROLES.PLINTH_SIDE_RETURN_RIGHT,
      materialCode: matFront,
      lengthDmm: plinthSideLengthDmm,
      widthDmm: plinthHDmm,
      thicknessDmm: panelTDmm,
      minXDmm: plinthSideInsetDmm + plinthWidthDmm - panelTDmm,
      maxXDmm: plinthSideInsetDmm + plinthWidthDmm,
      minYDmm: yFloorDmm,
      maxYDmm: yPlinthTopDmm,
      minZDmm: zPlinthFrontMaxDmm,
      maxZDmm: zPlinthRearMinDmm,
      orientation: ORIENTATIONS.VERTICAL_YZ,
      edges: {
        LENGTH_EDGE_1: edgeFrontDmm,
        LENGTH_EDGE_2: 0,
        WIDTH_EDGE_1: 0,
        WIDTH_EDGE_2: 0,
      },
      sourceRuleIds: ["WR-005", "WR-006", "WR-007", "WR-013"],
    })
  );

  // Plinth Cross Stretchers (under each vertical divider)
  if (dividers.length === 1) {
    parts.push(
      createPanel({
        id: "PLINTH_CROSS_C",
        role: PART_ROLES.PLINTH_CROSS_STRETCHER,
        materialCode: matCarcass,
        lengthDmm: plinthSideLengthDmm,
        widthDmm: plinthHDmm,
        thicknessDmm: panelTDmm,
        minXDmm: dividers[0].minXDmm,
        maxXDmm: dividers[0].maxXDmm,
        minYDmm: yFloorDmm,
        maxYDmm: yPlinthTopDmm,
        minZDmm: zPlinthFrontMaxDmm,
        maxZDmm: zPlinthRearMinDmm,
        orientation: ORIENTATIONS.VERTICAL_YZ,
        edges: {
          LENGTH_EDGE_1: 0,
          LENGTH_EDGE_2: 0,
          WIDTH_EDGE_1: 0,
          WIDTH_EDGE_2: 0,
        },
        sourceRuleIds: ["WR-005", "WR-007"],
      })
    );
  } else if (dividers.length > 1) {
    dividers.forEach((div, idx) => {
      const stretcherId = `PLINTH_CROSS_${String(idx + 1).padStart(2, "0")}`;
      parts.push(
        createPanel({
          id: stretcherId,
          role: PART_ROLES.PLINTH_CROSS_STRETCHER,
          materialCode: matCarcass,
          lengthDmm: plinthSideLengthDmm,
          widthDmm: plinthHDmm,
          thicknessDmm: panelTDmm,
          minXDmm: div.minXDmm,
          maxXDmm: div.maxXDmm,
          minYDmm: yFloorDmm,
          maxYDmm: yPlinthTopDmm,
          minZDmm: zPlinthFrontMaxDmm,
          maxZDmm: zPlinthRearMinDmm,
          orientation: ORIENTATIONS.VERTICAL_YZ,
          edges: {
            LENGTH_EDGE_1: 0,
            LENGTH_EDGE_2: 0,
            WIDTH_EDGE_1: 0,
            WIDTH_EDGE_2: 0,
          },
          sourceRuleIds: ["WR-005", "WR-007"],
        })
      );
    });
  }

  // Four Approved Back Groove Operations
  const operations = [
    {
      id: "OP_GRV_SIDE_L",
      hostPartId: "CARC_SIDE_L",
      type: "BACK_GROOVE",
      face: "INNER",
      vector: [1, 0, 0],
      widthDmm: grvWidthDmm,
      depthDmm: grvDepthDmm,
      status: "APPROVED",
    },
    {
      id: "OP_GRV_SIDE_R",
      hostPartId: "CARC_SIDE_R",
      type: "BACK_GROOVE",
      face: "INNER",
      vector: [-1, 0, 0],
      widthDmm: grvWidthDmm,
      depthDmm: grvDepthDmm,
      status: "APPROVED",
    },
    {
      id: "OP_GRV_TOP",
      hostPartId: "CARC_TOP",
      type: "BACK_GROOVE",
      face: "LOWER",
      vector: [0, -1, 0],
      widthDmm: grvWidthDmm,
      depthDmm: grvDepthDmm,
      status: "APPROVED",
    },
    {
      id: "OP_GRV_BOT",
      hostPartId: "CARC_BOT",
      type: "BACK_GROOVE",
      face: "UPPER",
      vector: [0, 1, 0],
      widthDmm: grvWidthDmm,
      depthDmm: grvDepthDmm,
      status: "APPROVED",
    },
  ];

  // Warnings
  const warnings = [];
  if (furniSpec.plinth.sideInsetStatus === "ASSUMPTION_PENDING_BEKZOD_APPROVAL") {
    warnings.push({
      code: "PLINTH_SIDE_INSET_ASSUMPTION",
      message: `Plinth side inset (${furniSpec.plinth.sideInsetMm}mm) is an assumption pending Bekzod workshop confirmation.`,
    });
  }

  return {
    partGraphVersion: PARTGRAPH_VERSION,
    sourceSpecId: furniSpec.specId,
    sourceRevision: furniSpec.revision,
    unitScale: "deci-mm",
    qualificationStatus: furniSpec.qualificationStatus,
    parts,
    operations,
    warnings,
    summary: {
      totalStructuralParts: parts.length,
      totalOperations: operations.length,
      approvedOperations: operations.filter((op) => op.status === "APPROVED").length,
      blockedOperations: operations.filter((op) => op.status !== "APPROVED").length,
      envelope: {
        widthDmm: envWDmm,
        heightDmm: envHDmm,
        depthDmm: envDDmm,
      },
    },
  };
}
