/**
 * Emit discrete DRAWER_* structural panels for a DRAWER_BANK component.
 *
 * AUTHORITATIVE drawer construction (see docs/m2/integ/DRAWER_COMPILER_DECISION.md).
 * Claude drawerPack.js is NOT wired — conversational path would regress.
 *
 * Ruled (BEKZOD_RULING): reveal 2.0 mm, slide deduction 21.0 mm total, runner family.
 * Provisional construction defaults (PROVISIONAL_PENDING_BEKZOD_REVIEW) — NOT
 * BEKZOD_APPROVED furniture rules:
 *   boxHeightMm ← drawerH - 2*reveal
 *   boxDepthMm ← carcassDepth - DRAWER_SIDE_DEPTH_SETBACK_MM (50)
 *   boxBottomClearanceMm ← 0
 *   bottomThicknessMm ← 6.0 (HDF_WHITE_6; decoupled from matCarcass)
 *   backBetweenSides ← true
 *   DRAWER_BOX_SIDE_THICKNESS_MM = 15, DRAWER_BOTTOM_SIDE_INSET_TOTAL_MM = 10
 *
 * PL-006: BACK = W - 21 - 2*15. Throws DEGENERATE_DRAWER_GEOMETRY when any
 * finished dim is non-positive. Exact row division required when heightMm set.
 * Integer deci-mm. CNC / drilling stay blocked.
 */
import { PART_ROLES, ORIENTATIONS, GRAIN_DIRECTIONS } from "./schema.js";
import { resolve, ruleIdOf } from "../rules/wardrobeRuleCatalog.js";

/** Nominal row height when FurniSpec omits heightMm (matches wardrobe-model DEFAULTS). */
export const DEFAULT_DRAWER_ROW_HEIGHT_MM = 180;
/** Side / back board thickness (construction constant for undermount pack). */
export const DRAWER_BOX_SIDE_THICKNESS_MM = 15;
/** Front-to-back side length setback from carcass depth. */
export const DRAWER_SIDE_DEPTH_SETBACK_MM = 50;
/** Bottom groove inset total (5 mm each side into the box sides). */
export const DRAWER_BOTTOM_SIDE_INSET_TOTAL_MM = 10;
/** Drawer bottom board — always 6 mm white HDF, never carcass melamine. */
export const DRAWER_BOTTOM_MATERIAL_CODE = "HDF_WHITE_6";
export const DRAWER_BOTTOM_THICKNESS_MM = 6.0;

/**
 * @param {object} args
 * @returns {{ panels: object[], partIds: string[] }}
 */
export function emitDrawerBankParts({
  comp,
  bay,
  yBotTopDmm,
  zCarcassFrontDmm,
  carcassDepthMm,
  matCarcass,
  matFront,
  edgeFrontDmm,
  edgeRearDmm,
  toDeciMm,
}) {
  const revealMm = resolve("drawerFrontRevealMm");
  const slideDeductionMm = resolve("drawerSlideWidthDeductionMm");
  const frontThicknessMm = resolve("panelThicknessMm");
  const bottomThicknessMm = DRAWER_BOTTOM_THICKNESS_MM;

  const rows = Math.max(1, Number(comp.rows) || 1);
  const bankHeightMm =
    comp.heightMm != null ? Number(comp.heightMm) : rows * DEFAULT_DRAWER_ROW_HEIGHT_MM;
  // Exact 0.1 mm row division when height is stated (ported from Claude drawerPack discipline).
  if (comp.heightMm != null) {
    const bankHeightDmm = Math.round(bankHeightMm * 10);
    if (Math.abs(bankHeightMm * 10 - bankHeightDmm) > 1e-9 || bankHeightDmm % rows !== 0) {
      const err = new Error(
        `Drawer bank "${comp.id || "?"}": ${bankHeightMm}mm over ${rows} rows does not divide to an exact 0.1mm row height.`
      );
      err.code = "DEGENERATE_DRAWER_GEOMETRY";
      throw err;
    }
  }
  const drawerHeightMm = bankHeightMm / rows;
  const frontHeightMm = drawerHeightMm - 2 * revealMm;
  const boxHeightMm = frontHeightMm;

  const bayWidthMm = bay.clearWidthDmm / 10;
  const sideLengthMm = carcassDepthMm - DRAWER_SIDE_DEPTH_SETBACK_MM;
  const frontWidthMm = bayWidthMm - 2 * revealMm;
  const backWidthMm = bayWidthMm - slideDeductionMm - 2 * DRAWER_BOX_SIDE_THICKNESS_MM;
  const bottomWidthMm = bayWidthMm - slideDeductionMm - DRAWER_BOTTOM_SIDE_INSET_TOTAL_MM;
  const bottomDepthMm = sideLengthMm - DRAWER_BOX_SIDE_THICKNESS_MM;

  // PL-006, fail at the source. The FurniSpec path has no bay-width guard of
  // its own - `minDrawerBayClearWidthMm` is enforced in wardrobe-model's
  // kernel and validator, which a FurniSpec never passes through. Measured
  // before this guard: a 50.9mm bay produced a DRAWER_BACK of -0.1mm, and the
  // SVG shop drawing rendered it. Refusing here protects every consumer,
  // including ones that would otherwise only catch it downstream.
  const degenerate = [
    ["front width", frontWidthMm],
    ["front height", frontHeightMm],
    ["box height", boxHeightMm],
    ["side length", sideLengthMm],
    ["back width", backWidthMm],
    ["bottom width", bottomWidthMm],
    ["bottom depth", bottomDepthMm],
    ["bottom thickness", bottomThicknessMm],
  ].filter(([, value]) => !(value > 0));
  if (degenerate.length > 0) {
    const err = new Error(
      `Drawer bank "${comp.id}" computes non-positive ${degenerate
        .map(([what, value]) => `${what} (${value}mm)`)
        .join(", ")}. A ${bayWidthMm}mm bay cannot carry a drawer box: the back is ` +
        `bay - ${slideDeductionMm} - 2 x ${DRAWER_BOX_SIDE_THICKNESS_MM}, so the bay must exceed ` +
        `${slideDeductionMm + 2 * DRAWER_BOX_SIDE_THICKNESS_MM}mm.`
    );
    err.code = "DEGENERATE_DRAWER_GEOMETRY";
    throw err;
  }

  const halfDeductionMm = slideDeductionMm / 2;
  const boxMinXMm = bay.minXDmm / 10 + halfDeductionMm;
  const boxMaxXMm = bay.maxXDmm / 10 - halfDeductionMm;

  const offsetBottomMm = Number(comp.offsetFromBottomMm ?? 0);
  const bankBottomYDmm = yBotTopDmm + toDeciMm(offsetBottomMm, `${comp.id}.offsetFromBottomMm`);

  const baseId = (comp.partId || comp.id).toUpperCase().replace(/-/g, "_");
  const sourceRuleIds = [
    ruleIdOf("drawerFrontRevealMm"),
    ruleIdOf("drawerSlideWidthDeductionMm"),
    ruleIdOf("drawerRunnerFamily"),
    ruleIdOf("panelThicknessMm"),
  ];

  const panels = [];
  const partIds = [];

  for (let r = 0; r < rows; r++) {
    const rowTag = `R${String(r + 1).padStart(2, "0")}`;
    const apertureMinYMm = offsetBottomMm + r * drawerHeightMm + yBotTopDmm / 10;
    // aperture in global Y (mm): bank bottom is yBotTop + offset
    const apertureMinYDmm = bankBottomYDmm + toDeciMm(r * drawerHeightMm, `${comp.id}.row${r}`);
    const apertureMaxYDmm = apertureMinYDmm + toDeciMm(drawerHeightMm, `${comp.id}.drawerH`);

    const revealDmm = toDeciMm(revealMm, "drawerFrontRevealMm");
    const frontMinYDmm = apertureMinYDmm + revealDmm;
    const frontMaxYDmm = apertureMaxYDmm - revealDmm;
    const frontWidthDmm = toDeciMm(frontWidthMm, "drawerFrontWidth");
    const frontHeightDmm = toDeciMm(frontHeightMm, "drawerFrontHeight");
    const frontThickDmm = toDeciMm(frontThicknessMm, "drawerFrontThickness");
    const frontMinXDmm = bay.minXDmm + revealDmm;
    const frontMaxXDmm = frontMinXDmm + frontWidthDmm;

    const frontId = `${baseId}_${rowTag}_FRONT`;
    panels.push({
      id: frontId,
      bayIndex: bay.index,
      role: PART_ROLES.DRAWER_FRONT,
      materialCode: matFront,
      lengthDmm: frontHeightDmm,
      widthDmm: frontWidthDmm,
      thicknessDmm: frontThickDmm,
      minXDmm: frontMinXDmm,
      maxXDmm: frontMaxXDmm,
      minYDmm: frontMinYDmm,
      maxYDmm: frontMaxYDmm,
      minZDmm: zCarcassFrontDmm,
      maxZDmm: zCarcassFrontDmm + frontThickDmm,
      orientation: ORIENTATIONS.VERTICAL_XY,
      grainDirection: GRAIN_DIRECTIONS.LENGTH,
      edges: {
        LENGTH_EDGE_1: edgeFrontDmm,
        LENGTH_EDGE_2: edgeFrontDmm,
        WIDTH_EDGE_1: edgeFrontDmm,
        WIDTH_EDGE_2: edgeFrontDmm,
      },
      sourceRuleIds,
    });
    partIds.push(frontId);

    const boxHDmm = toDeciMm(boxHeightMm, "drawerBoxHeight");
    const sideThickDmm = toDeciMm(DRAWER_BOX_SIDE_THICKNESS_MM, "drawerSideT");
    const sideLenDmm = toDeciMm(sideLengthMm, "drawerSideLen");
    const sideMinYDmm = frontMinYDmm;
    const sideMaxYDmm = sideMinYDmm + boxHDmm;
    const sideMinZDmm = zCarcassFrontDmm + frontThickDmm;
    const sideMaxZDmm = sideMinZDmm + sideLenDmm;

    const boxMinXDmm = toDeciMm(boxMinXMm, "boxMinX");
    const boxMaxXDmm = toDeciMm(boxMaxXMm, "boxMaxX");

    const sideLId = `${baseId}_${rowTag}_SIDE_L`;
    panels.push({
      id: sideLId,
      bayIndex: bay.index,
      role: PART_ROLES.DRAWER_SIDE_L,
      materialCode: matCarcass,
      lengthDmm: sideLenDmm,
      widthDmm: boxHDmm,
      thicknessDmm: sideThickDmm,
      minXDmm: boxMinXDmm,
      maxXDmm: boxMinXDmm + sideThickDmm,
      minYDmm: sideMinYDmm,
      maxYDmm: sideMaxYDmm,
      minZDmm: sideMinZDmm,
      maxZDmm: sideMaxZDmm,
      orientation: ORIENTATIONS.VERTICAL_YZ,
      grainDirection: GRAIN_DIRECTIONS.LENGTH,
      edges: {
        LENGTH_EDGE_1: edgeFrontDmm,
        LENGTH_EDGE_2: edgeRearDmm,
        WIDTH_EDGE_1: 0,
        WIDTH_EDGE_2: 0,
      },
      sourceRuleIds,
    });
    partIds.push(sideLId);

    const sideRId = `${baseId}_${rowTag}_SIDE_R`;
    panels.push({
      id: sideRId,
      bayIndex: bay.index,
      role: PART_ROLES.DRAWER_SIDE_R,
      materialCode: matCarcass,
      lengthDmm: sideLenDmm,
      widthDmm: boxHDmm,
      thicknessDmm: sideThickDmm,
      minXDmm: boxMaxXDmm - sideThickDmm,
      maxXDmm: boxMaxXDmm,
      minYDmm: sideMinYDmm,
      maxYDmm: sideMaxYDmm,
      minZDmm: sideMinZDmm,
      maxZDmm: sideMaxZDmm,
      orientation: ORIENTATIONS.VERTICAL_YZ,
      grainDirection: GRAIN_DIRECTIONS.LENGTH,
      edges: {
        LENGTH_EDGE_1: edgeFrontDmm,
        LENGTH_EDGE_2: edgeRearDmm,
        WIDTH_EDGE_1: 0,
        WIDTH_EDGE_2: 0,
      },
      sourceRuleIds,
    });
    partIds.push(sideRId);

    const backWidthDmm = toDeciMm(backWidthMm, "drawerBackW");
    const backId = `${baseId}_${rowTag}_BACK`;
    panels.push({
      id: backId,
      bayIndex: bay.index,
      role: PART_ROLES.DRAWER_BACK,
      materialCode: matCarcass,
      lengthDmm: boxHDmm,
      widthDmm: backWidthDmm,
      thicknessDmm: sideThickDmm,
      minXDmm: boxMinXDmm + sideThickDmm,
      maxXDmm: boxMinXDmm + sideThickDmm + backWidthDmm,
      minYDmm: sideMinYDmm,
      maxYDmm: sideMaxYDmm,
      minZDmm: sideMaxZDmm - sideThickDmm,
      maxZDmm: sideMaxZDmm,
      orientation: ORIENTATIONS.VERTICAL_XY,
      grainDirection: GRAIN_DIRECTIONS.LENGTH,
      edges: {
        LENGTH_EDGE_1: 0,
        LENGTH_EDGE_2: 0,
        WIDTH_EDGE_1: 0,
        WIDTH_EDGE_2: 0,
      },
      sourceRuleIds,
    });
    partIds.push(backId);

    const bottomWidthDmm = toDeciMm(bottomWidthMm, "drawerBottomW");
    const bottomDepthDmm = toDeciMm(bottomDepthMm, "drawerBottomD");
    const bottomThickDmm = toDeciMm(bottomThicknessMm, "drawerBottomT");
    const bottomInsetDmm = toDeciMm(DRAWER_BOTTOM_SIDE_INSET_TOTAL_MM / 2, "bottomInset");
    const bottomId = `${baseId}_${rowTag}_BOTTOM`;
    panels.push({
      id: bottomId,
      bayIndex: bay.index,
      role: PART_ROLES.DRAWER_BOTTOM,
      materialCode: DRAWER_BOTTOM_MATERIAL_CODE,
      lengthDmm: bottomWidthDmm,
      widthDmm: bottomDepthDmm,
      thicknessDmm: bottomThickDmm,
      minXDmm: boxMinXDmm + bottomInsetDmm,
      maxXDmm: boxMinXDmm + bottomInsetDmm + bottomWidthDmm,
      minYDmm: sideMinYDmm,
      maxYDmm: sideMinYDmm + bottomThickDmm,
      minZDmm: sideMinZDmm,
      maxZDmm: sideMinZDmm + bottomDepthDmm,
      orientation: ORIENTATIONS.HORIZONTAL_XZ,
      grainDirection: GRAIN_DIRECTIONS.LENGTH,
      edges: {
        LENGTH_EDGE_1: 0,
        LENGTH_EDGE_2: 0,
        WIDTH_EDGE_1: 0,
        WIDTH_EDGE_2: 0,
      },
      sourceRuleIds,
    });
    partIds.push(bottomId);

    // silence unused lint for aperture locals in case of tree-shake
    void apertureMinYMm;
  }

  return { panels, partIds };
}
