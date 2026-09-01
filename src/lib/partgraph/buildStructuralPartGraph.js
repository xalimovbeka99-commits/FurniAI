/**
 * PartGraph v0.1 — Pure Deterministic Rectangular Kernel
 * ---------------------------------------------------------------------
 * Generates canonical structural PartGraph data structures from a validated
 * FurniSpec v0.1 specification.
 *
 * Guaranteed invariants:
 * - Pure deterministic execution: zero I/O, randomness, dates, or UI dependencies.
 * - All internal math performed in exact integer deci-millimetres (0.1 mm).
 * - Generates exactly 19 structural parts for the 2-bay Golden Wardrobe.
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
  const plinthSideInsetDmm = toDeciMm(furniSpec.plinth.sideInsetMm ?? 50.0, "plinth.sideInsetMm");

  const carcassHDmm = assertDeciMm(furniSpec.carcass.heightMm, "carcass.heightMm");
  const carcassDDmm = assertDeciMm(furniSpec.carcass.depthMm, "carcass.depthMm");
  const panelTDmm = assertDeciMm(furniSpec.carcass.panelThicknessMm, "carcass.panelThicknessMm");
  const backTDmm = assertDeciMm(furniSpec.carcass.backThicknessMm, "carcass.backThicknessMm");
  const grvWidthDmm = assertDeciMm(furniSpec.carcass.grooveWidthMm, "carcass.grooveWidthMm");
  const grvDepthDmm = assertDeciMm(furniSpec.carcass.grooveDepthMm, "carcass.grooveDepthMm");
  const grvRearDatumDmm = assertDeciMm(furniSpec.carcass.grooveRearDatumMm, "carcass.grooveRearDatumMm");

  const doorTDmm = assertDeciMm(furniSpec.doors.thicknessMm, "doors.thicknessMm");
  const bumperGapDmm = toDeciMm(furniSpec.doors.bumperGapMm ?? 2.0, "doors.bumperGapMm");
  const doorCount = furniSpec.doors.count;
  const doorWDmm = assertDeciMm(furniSpec.doors.finishedWidthMm, "doors.finishedWidthMm");
  const doorHDmm = assertDeciMm(furniSpec.doors.finishedHeightMm, "doors.finishedHeightMm");

  const revTopDmm = toDeciMm(furniSpec.doors.reveals.topMm, "doors.reveals.topMm");
  const revBotDmm = toDeciMm(furniSpec.doors.reveals.bottomMm, "doors.reveals.bottomMm");
  const revLeftDmm = toDeciMm(furniSpec.doors.reveals.leftMm, "doors.reveals.leftMm");
  const revRightDmm = toDeciMm(furniSpec.doors.reveals.rightMm, "doors.reveals.rightMm");
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
  const internalCarcassHDmm = yTopBottomDmm - yBotTopDmm; // 2264.0 mm

  // Compute primary global X datums
  const internalCarcassWDmm = envWDmm - 2 * panelTDmm; // 1764.0 mm

  // Divider and shelf depth (set back 20.0mm before carcass rear)
  const dividerDepthDmm = carcassDDmm - 200; // 5600 dmm (560.0 mm)
  const adjShelfDepthDmm = dividerDepthDmm - 100; // 5500 dmm (550.0 mm)

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

  // 5. CARC_DIV_01 (Center Vertical Divider)
  const leftBayClearWDmm = assertDeciMm(furniSpec.bays[0].clearWidthMm, "bays[0].clearWidthMm");
  const divMinXDmm = panelTDmm + leftBayClearWDmm;
  const divMaxXDmm = divMinXDmm + panelTDmm;

  parts.push(
    createPanel({
      id: "CARC_DIV_01",
      role: PART_ROLES.DIVIDER_PANEL,
      materialCode: matCarcass,
      lengthDmm: internalCarcassHDmm,
      widthDmm: dividerDepthDmm,
      thicknessDmm: panelTDmm,
      minXDmm: divMinXDmm,
      maxXDmm: divMaxXDmm,
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

  // 6. SHELF_FIX_L1 (Left Bay Fixed Top Shelf)
  const topShelfClearOpeningDmm = 3500; // 350.0 mm
  const fixShelfYDmm = yTopBottomDmm - topShelfClearOpeningDmm - panelTDmm; // 20140 dmm

  parts.push(
    createPanel({
      id: "SHELF_FIX_L1",
      role: PART_ROLES.FIXED_SHELF,
      materialCode: matCarcass,
      lengthDmm: leftBayClearWDmm,
      widthDmm: dividerDepthDmm,
      thicknessDmm: panelTDmm,
      minXDmm: panelTDmm,
      maxXDmm: divMinXDmm,
      minYDmm: fixShelfYDmm,
      maxYDmm: fixShelfYDmm + panelTDmm,
      minZDmm: zCarcassFrontDmm,
      maxZDmm: zCarcassFrontDmm + dividerDepthDmm,
      orientation: ORIENTATIONS.HORIZONTAL_XZ,
      edges: {
        LENGTH_EDGE_1: edgeFrontDmm,
        LENGTH_EDGE_2: edgeRearDmm,
        WIDTH_EDGE_1: 0,
        WIDTH_EDGE_2: 0,
      },
      sourceRuleIds: ["WR-003", "WR-008", "WR-013"],
    })
  );

  // 7. SHELF_FIX_R1 (Right Bay Fixed Top Shelf)
  const rightBayClearWDmm = assertDeciMm(furniSpec.bays[1].clearWidthMm, "bays[1].clearWidthMm");
  parts.push(
    createPanel({
      id: "SHELF_FIX_R1",
      role: PART_ROLES.FIXED_SHELF,
      materialCode: matCarcass,
      lengthDmm: rightBayClearWDmm,
      widthDmm: dividerDepthDmm,
      thicknessDmm: panelTDmm,
      minXDmm: divMaxXDmm,
      maxXDmm: envWDmm - panelTDmm,
      minYDmm: fixShelfYDmm,
      maxYDmm: fixShelfYDmm + panelTDmm,
      minZDmm: zCarcassFrontDmm,
      maxZDmm: zCarcassFrontDmm + dividerDepthDmm,
      orientation: ORIENTATIONS.HORIZONTAL_XZ,
      edges: {
        LENGTH_EDGE_1: edgeFrontDmm,
        LENGTH_EDGE_2: edgeRearDmm,
        WIDTH_EDGE_1: 0,
        WIDTH_EDGE_2: 0,
      },
      sourceRuleIds: ["WR-003", "WR-008", "WR-013"],
    })
  );

  // 8 & 9. SHELF_ADJ_R2 & SHELF_ADJ_R3 (Right Bay Adjustable Shelves)
  // Short hanging drop = 900.0 mm from hanging rail center (rail at fixShelfYDmm - 1000 = 19140)
  // Adj Shelf 3 Upper Face = 19140 - 9000 = 10140 dmm (Lower Face = 9960 dmm)
  // Adj Shelf 2 Upper Face = 9960 - 3500 = 6460 dmm (Lower Face = 6280 dmm)
  const adjShelfWDmm = rightBayClearWDmm - 20; // 8710 dmm (leaves 1mm gap per side)
  const adjShelf3MinYDmm = 9960;
  const adjShelf2MinYDmm = 6280;

  parts.push(
    createPanel({
      id: "SHELF_ADJ_R2",
      role: PART_ROLES.ADJUSTABLE_SHELF,
      materialCode: matCarcass,
      lengthDmm: adjShelfWDmm,
      widthDmm: adjShelfDepthDmm,
      thicknessDmm: panelTDmm,
      minXDmm: divMaxXDmm + 10,
      maxXDmm: envWDmm - panelTDmm - 10,
      minYDmm: adjShelf2MinYDmm,
      maxYDmm: adjShelf2MinYDmm + panelTDmm,
      minZDmm: zCarcassFrontDmm + 50,
      maxZDmm: zCarcassFrontDmm + 50 + adjShelfDepthDmm,
      orientation: ORIENTATIONS.HORIZONTAL_XZ,
      edges: {
        LENGTH_EDGE_1: edgeFrontDmm,
        LENGTH_EDGE_2: edgeRearDmm,
        WIDTH_EDGE_1: edgeFrontDmm,
        WIDTH_EDGE_2: edgeFrontDmm,
      },
      sourceRuleIds: ["WR-003", "WR-008", "WR-013"],
    })
  );

  parts.push(
    createPanel({
      id: "SHELF_ADJ_R3",
      role: PART_ROLES.ADJUSTABLE_SHELF,
      materialCode: matCarcass,
      lengthDmm: adjShelfWDmm,
      widthDmm: adjShelfDepthDmm,
      thicknessDmm: panelTDmm,
      minXDmm: divMaxXDmm + 10,
      maxXDmm: envWDmm - panelTDmm - 10,
      minYDmm: adjShelf3MinYDmm,
      maxYDmm: adjShelf3MinYDmm + panelTDmm,
      minZDmm: zCarcassFrontDmm + 50,
      maxZDmm: zCarcassFrontDmm + 50 + adjShelfDepthDmm,
      orientation: ORIENTATIONS.HORIZONTAL_XZ,
      edges: {
        LENGTH_EDGE_1: edgeFrontDmm,
        LENGTH_EDGE_2: edgeRearDmm,
        WIDTH_EDGE_1: edgeFrontDmm,
        WIDTH_EDGE_2: edgeFrontDmm,
      },
      sourceRuleIds: ["WR-003", "WR-008", "WR-013"],
    })
  );

  // 10. BACK_PANEL_01 (Back Panel)
  // Engages 6.0 mm (60 dmm) into 7.0 mm groove on all 4 sides
  const backPanelWDmm = internalCarcassWDmm + 2 * (grvDepthDmm - 10); // 17760 dmm
  const backPanelHDmm = internalCarcassHDmm + 2 * (grvDepthDmm - 10); // 22760 dmm
  // Groove channel occupies Z in [5860, 5930] dmm (586.0mm to 593.0mm)
  const zBackGrooveChannelMinDmm = zCarcassRearDmm - grvRearDatumDmm + 60; // 6000 - 200 + 60 = 5860 dmm
  const zBackPanelMinDmm = zBackGrooveChannelMinDmm + 5; // 5865 dmm (centered in 70 dmm groove)

  parts.push(
    createPanel({
      id: "BACK_PANEL_01",
      role: PART_ROLES.BACK_PANEL,
      materialCode: matBack,
      lengthDmm: backPanelHDmm,
      widthDmm: backPanelWDmm,
      thicknessDmm: backTDmm,
      minXDmm: panelTDmm - 60,
      maxXDmm: envWDmm - panelTDmm + 60,
      minYDmm: yBotTopDmm - 60,
      maxYDmm: yTopBottomDmm + 60,
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

  // 11-14. DOOR_01 .. DOOR_04 (Hinged Doors)
  let doorXCursorDmm = revLeftDmm;
  const doorMinYDmm = yPlinthTopDmm + revBotDmm;
  const doorMaxYDmm = doorMinYDmm + doorHDmm;

  for (let d = 1; d <= doorCount; d++) {
    const doorId = `DOOR_0${d}`;
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

  // 15-19. PLINTH STRUCTURE (5 parts)
  const plinthWidthDmm = envWDmm - 2 * plinthSideInsetDmm; // 17000 dmm
  const zPlinthFrontMinDmm = zCarcassFrontDmm + plinthRecessDmm; // 700 dmm
  const zPlinthFrontMaxDmm = zPlinthFrontMinDmm + panelTDmm; // 880 dmm
  const zPlinthRearMaxDmm = zCarcassRearDmm - plinthRecessDmm; // 5500 dmm (or 5800 - 200 = 5800-180) -> 5800 - 200 = 5600
  // Standardized rear plinth rail sits at [5620, 5800]
  const zPlinthRearMinDmm = 5620;
  const zPlinthRearMaxDmmFixed = 5800;
  const plinthSideLengthDmm = zPlinthRearMinDmm - zPlinthFrontMaxDmm; // 4740 dmm (474.0 mm)

  // 15. PLINTH_FRONT
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

  // 16. PLINTH_REAR
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
      maxZDmm: zPlinthRearMaxDmmFixed,
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

  // 17. PLINTH_SIDE_L
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

  // 18. PLINTH_SIDE_R
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

  // 19. PLINTH_CROSS_C
  parts.push(
    createPanel({
      id: "PLINTH_CROSS_C",
      role: PART_ROLES.PLINTH_CROSS_STRETCHER,
      materialCode: matCarcass,
      lengthDmm: plinthSideLengthDmm,
      widthDmm: plinthHDmm,
      thicknessDmm: panelTDmm,
      minXDmm: divMinXDmm,
      maxXDmm: divMaxXDmm,
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
