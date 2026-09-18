/**
 * Drawer pack compiler — DRAWER_BANK into five discrete parts per row.
 *
 * WHAT THE 2026-09-15 RULING UNLOCKED
 *
 * `componentOutcomes.js` held DRAWER_BANK UNSUPPORTED for one stated reason:
 * "drawer box dimensions depend on a runner family that has not been approved."
 * The ruling named the family (UNDERMOUNT_CONCEALED_21MM) and its width
 * deduction (21.0mm total, not per side), and set the front reveal at 2.0mm.
 * That is what this module compiles.
 *
 * WHAT THE RULING DID NOT SETTLE, AND HOW THAT IS HANDLED
 *
 * A runner family and a width deduction fix the box's WIDTH. They do not fix
 * its height, its depth, the clearance the runner needs beneath it, the bottom
 * panel's thickness, or whether the back sits between the sides or behind them.
 * Those are five further construction decisions, and none of them is ruled.
 *
 * Rather than choose them, this compiler requires them on the FurniSpec
 * component and names the missing one when they are absent. A bank that
 * supplies them compiles into real parts; a bank that does not is recorded
 * UNSUPPORTED with the exact field named, so the customer is told rather than
 * handed a box built on a guess. See DRAWER_PACK_REQUIRED_INPUTS.
 *
 * DERIVED, NOT INVENTED
 *
 * Three quantities ARE derived here, each from values the spec already states:
 *
 *   row height    = the bank's own heightMm divided by its own rows
 *   box width     = the bay's clear width minus the ruled 21.0mm deduction
 *   front width   = clear width + one panel thickness - two ruled reveals
 *
 * The last is half-overlay tiling: each front covers half of the panel on
 * either side of its bay, which is the only arrangement in which adjacent
 * fronts neither collide nor leave the carcass showing. The formula and its
 * rule IDs travel with every part.
 */
import { resolve } from "../rules/wardrobeRuleCatalog.js";
import { PART_ROLES, GRAIN_DIRECTIONS, ORIENTATIONS } from "./schema.js";

export const DRAWER_PACK_VERSION = "drawer-pack/0.1";

/**
 * Construction inputs the ruling does not supply. Each must be present on the
 * DRAWER_BANK component. The list is exported so the diagnostic, the tests and
 * the documentation cannot drift apart.
 */
export const DRAWER_PACK_REQUIRED_INPUTS = Object.freeze([
  Object.freeze({
    field: "boxHeightMm",
    question: "How tall is the drawer box side, for a given row height?",
  }),
  Object.freeze({
    field: "boxDepthMm",
    question: "How deep is the drawer box? Undermount runners come in nominal lengths; which one?",
  }),
  Object.freeze({
    field: "boxBottomClearanceMm",
    question: "How much clearance does the undermount runner need beneath the box?",
  }),
  Object.freeze({
    field: "bottomThicknessMm",
    question: "What thickness is the drawer bottom?",
  }),
  Object.freeze({
    field: "backBetweenSides",
    question:
      "Does the drawer back sit BETWEEN the two sides (true) or behind them, full box width (false)?",
  }),
]);

/** Inputs the spec must already carry for a bank to be sized at all. */
const BANK_INPUTS = Object.freeze(["rows", "heightMm"]);

/**
 * Which required inputs a bank is missing. Empty means it will compile.
 * @param {object} bank a FurniSpec DRAWER_BANK component
 * @returns {string[]} field names
 */
export function missingDrawerInputs(bank) {
  const missing = [];
  for (const field of BANK_INPUTS) {
    if (bank[field] === undefined || bank[field] === null) missing.push(field);
  }
  if (Number.isInteger(bank.rows) && bank.rows < 1) missing.push("rows");
  for (const { field } of DRAWER_PACK_REQUIRED_INPUTS) {
    const value = bank[field];
    const present = field === "backBetweenSides" ? typeof value === "boolean" : typeof value === "number";
    if (!present) missing.push(field);
  }
  return missing;
}

/**
 * Compile one DRAWER_BANK into five parts per row.
 *
 * All arithmetic is integer deci-millimetre. A row height that does not divide
 * exactly throws rather than rounding, in line with the kernel's numeric policy.
 *
 * @param {object} args
 * @param {object} args.bank the FurniSpec DRAWER_BANK component
 * @param {{index:number, minXDmm:number, maxXDmm:number, clearWidthDmm:number}} args.bay
 * @param {number} args.bankBottomYDmm the bank's lower datum in graph coordinates
 * @param {number} args.panelTDmm carcass/front panel thickness
 * @param {number} args.zCarcassFrontDmm the carcass front datum
 * @param {string} args.matCarcass box material code
 * @param {string} args.matFront front material code
 * @param {number} args.edgeFrontDmm visible-edge banding
 * @param {number} args.edgeRearDmm unbanded edge
 * @returns {{parts: object[], partIds: string[], derivations: object[]}}
 */
export function compileDrawerPack({
  bank,
  bay,
  bankBottomYDmm,
  panelTDmm,
  zCarcassFrontDmm,
  matCarcass,
  matFront,
  edgeFrontDmm,
  edgeRearDmm,
}) {
  const missing = missingDrawerInputs(bank);
  if (missing.length > 0) {
    throw new Error(`Drawer bank "${bank.id}" is missing required input(s): ${missing.join(", ")}.`);
  }

  const toDmm = (mm, what) => {
    const dmm = Math.round(mm * 10);
    if (Math.abs(mm * 10 - dmm) > 1e-9) {
      throw new Error(`${what} (${mm}mm) is finer than 0.1mm and would have to be rounded.`);
    }
    return dmm;
  };

  // --- Ruled values.
  const deductionDmm = toDmm(resolve("drawerSlideWidthDeductionMm"), "drawerSlideWidthDeductionMm");
  const revealDmm = toDmm(resolve("drawerFrontRevealMm"), "drawerFrontRevealMm");

  // --- Stated values.
  const rows = bank.rows;
  const bankHeightDmm = toDmm(bank.heightMm, `${bank.id}.heightMm`);
  const boxHeightDmm = toDmm(bank.boxHeightMm, `${bank.id}.boxHeightMm`);
  const boxDepthDmm = toDmm(bank.boxDepthMm, `${bank.id}.boxDepthMm`);
  const boxBottomClearDmm = toDmm(bank.boxBottomClearanceMm, `${bank.id}.boxBottomClearanceMm`);
  const bottomTDmm = toDmm(bank.bottomThicknessMm, `${bank.id}.bottomThicknessMm`);
  const backBetweenSides = bank.backBetweenSides;

  // --- Derived, exactly.
  if (bankHeightDmm % rows !== 0) {
    throw new Error(
      `Drawer bank "${bank.id}": ${bank.heightMm}mm over ${rows} rows does not divide to an exact 0.1mm row height.`
    );
  }
  const rowHeightDmm = bankHeightDmm / rows;

  if (deductionDmm % 2 !== 0) {
    // 21.0mm total is 210 dmm, which halves exactly. Guard the general case.
    throw new Error(
      `The ruled drawer slide deduction (${resolve("drawerSlideWidthDeductionMm")}mm total) does not split into two equal sides at 0.1mm.`
    );
  }
  const perSideDmm = deductionDmm / 2;

  const boxMinXDmm = bay.minXDmm + perSideDmm;
  const boxMaxXDmm = bay.maxXDmm - perSideDmm;
  const boxWidthDmm = boxMaxXDmm - boxMinXDmm;
  if (boxWidthDmm <= 2 * panelTDmm) {
    throw new Error(
      `Drawer bank "${bank.id}": a ${bay.clearWidthDmm / 10}mm bay leaves no box after the ruled ${resolve("drawerSlideWidthDeductionMm")}mm deduction.`
    );
  }

  // Inset in the bay opening: the drawers sit behind the doors.
  const frontWidthDmm = bay.clearWidthDmm - 2 * revealDmm;
  const frontHeightDmm = rowHeightDmm - 2 * revealDmm;
  if (frontHeightDmm <= 0) {
    throw new Error(
      `Drawer bank "${bank.id}": a ${rowHeightDmm / 10}mm row leaves no front after two ${resolve("drawerFrontRevealMm")}mm reveals.`
    );
  }
  if (boxHeightDmm + boxBottomClearDmm > rowHeightDmm) {
    throw new Error(
      `Drawer bank "${bank.id}": box (${bank.boxHeightMm}mm) plus runner clearance (${bank.boxBottomClearanceMm}mm) exceeds the ${rowHeightDmm / 10}mm row.`
    );
  }

  // Z increases toward the REAR: the carcass front datum is the smallest Z a
  // part inside the carcass may take. The front panel occupies the first
  // panel-thickness of that, and the box runs back from behind it.
  const frontZDmm = zCarcassFrontDmm;
  const boxFrontZDmm = frontZDmm + panelTDmm;
  const boxRearZDmm = boxFrontZDmm + boxDepthDmm;

  const parts = [];
  const idBase = (bank.partId || bank.id.toUpperCase().replace(/-/g, "_"));
  const ruleIds = Object.freeze([
    "BR-2026-09-15-RUNNER-FAMILY",
    "BR-2026-09-15-RUNNER-DEDUCTION",
    "BR-2026-09-15-DRAWER-REVEAL",
    "WR-003",
    "WR-013",
  ]);

  for (let row = 0; row < rows; row += 1) {
    const rowBottomY = bankBottomYDmm + row * rowHeightDmm;
    const n = String(row + 1).padStart(2, "0");
    const boxBottomY = rowBottomY + boxBottomClearDmm;

    // 1. The front. Also the front of the box — there is no separate box front.
    parts.push({
      id: `${idBase}_R${n}_FRONT`,
      bayIndex: bay.index,
      role: PART_ROLES.DRAWER_FRONT,
      materialCode: matFront,
      lengthDmm: frontWidthDmm,
      widthDmm: frontHeightDmm,
      thicknessDmm: panelTDmm,
      minXDmm: bay.minXDmm + revealDmm,
      maxXDmm: bay.maxXDmm - revealDmm,
      minYDmm: rowBottomY + revealDmm,
      maxYDmm: rowBottomY + rowHeightDmm - revealDmm,
      minZDmm: frontZDmm,
      maxZDmm: frontZDmm + panelTDmm,
      orientation: ORIENTATIONS.VERTICAL_XY,
      grainDirection: GRAIN_DIRECTIONS.WIDTH,
      edges: {
        LENGTH_EDGE_1: edgeFrontDmm,
        LENGTH_EDGE_2: edgeFrontDmm,
        WIDTH_EDGE_1: edgeFrontDmm,
        WIDTH_EDGE_2: edgeFrontDmm,
      },
      sourceRuleIds: ruleIds,
    });

    // 2 & 3. Box sides, inset by half the ruled deduction each.
    for (const [role, minX, maxX] of [
      [PART_ROLES.DRAWER_SIDE_L, boxMinXDmm, boxMinXDmm + panelTDmm],
      [PART_ROLES.DRAWER_SIDE_R, boxMaxXDmm - panelTDmm, boxMaxXDmm],
    ]) {
      parts.push({
        id: `${idBase}_R${n}_${role === PART_ROLES.DRAWER_SIDE_L ? "SIDE_L" : "SIDE_R"}`,
        bayIndex: bay.index,
        role,
        materialCode: matCarcass,
        // VERTICAL_YZ convention, the same one CARC_SIDE_L uses: `length` is
        // the Y span and `width` is the Z span. Not the joiner's reading of a
        // drawer side, but the validator's bounding-box contract, and one
        // convention beats two.
        lengthDmm: boxHeightDmm,
        widthDmm: boxDepthDmm,
        thicknessDmm: panelTDmm,
        minXDmm: minX,
        maxXDmm: maxX,
        minYDmm: boxBottomY,
        maxYDmm: boxBottomY + boxHeightDmm,
        minZDmm: boxFrontZDmm,
        maxZDmm: boxRearZDmm,
        orientation: ORIENTATIONS.VERTICAL_YZ,
        grainDirection: GRAIN_DIRECTIONS.LENGTH,
        edges: {
          LENGTH_EDGE_1: edgeFrontDmm,
          LENGTH_EDGE_2: edgeRearDmm,
          WIDTH_EDGE_1: edgeRearDmm,
          WIDTH_EDGE_2: edgeRearDmm,
        },
        sourceRuleIds: ruleIds,
      });
    }

    // 4. The back, between the sides or spanning the full box width.
    const backMinX = backBetweenSides ? boxMinXDmm + panelTDmm : boxMinXDmm;
    const backMaxX = backBetweenSides ? boxMaxXDmm - panelTDmm : boxMaxXDmm;
    parts.push({
      id: `${idBase}_R${n}_BACK`,
      bayIndex: bay.index,
      role: PART_ROLES.DRAWER_BACK,
      materialCode: matCarcass,
      lengthDmm: backMaxX - backMinX,
      widthDmm: boxHeightDmm,
      thicknessDmm: panelTDmm,
      minXDmm: backMinX,
      maxXDmm: backMaxX,
      minYDmm: boxBottomY,
      maxYDmm: boxBottomY + boxHeightDmm,
      minZDmm: boxRearZDmm - panelTDmm,
      maxZDmm: boxRearZDmm,
      orientation: ORIENTATIONS.VERTICAL_XY,
      grainDirection: GRAIN_DIRECTIONS.LENGTH,
      edges: {
        LENGTH_EDGE_1: edgeRearDmm,
        LENGTH_EDGE_2: edgeRearDmm,
        WIDTH_EDGE_1: edgeRearDmm,
        WIDTH_EDGE_2: edgeRearDmm,
      },
      sourceRuleIds: ruleIds,
    });

    // 5. The bottom, captured between the sides.
    const bottomMaxZ = boxRearZDmm - (backBetweenSides ? panelTDmm : 0);
    parts.push({
      id: `${idBase}_R${n}_BOTTOM`,
      bayIndex: bay.index,
      role: PART_ROLES.DRAWER_BOTTOM,
      materialCode: matCarcass,
      lengthDmm: boxMaxXDmm - panelTDmm - (boxMinXDmm + panelTDmm),
      widthDmm: bottomMaxZ - boxFrontZDmm,
      thicknessDmm: bottomTDmm,
      minXDmm: boxMinXDmm + panelTDmm,
      maxXDmm: boxMaxXDmm - panelTDmm,
      minYDmm: boxBottomY,
      maxYDmm: boxBottomY + bottomTDmm,
      minZDmm: boxFrontZDmm,
      maxZDmm: bottomMaxZ,
      orientation: ORIENTATIONS.HORIZONTAL_XZ,
      grainDirection: GRAIN_DIRECTIONS.LENGTH,
      edges: { LENGTH_EDGE_1: edgeRearDmm, LENGTH_EDGE_2: edgeRearDmm, WIDTH_EDGE_1: edgeRearDmm, WIDTH_EDGE_2: edgeRearDmm },
      sourceRuleIds: ruleIds,
    });
  }

  return {
    parts,
    partIds: parts.map((p) => p.id),
    derivations: Object.freeze([
      Object.freeze({
        path: "drawer.rowHeightMm",
        value: rowHeightDmm / 10,
        formula: `${bank.heightMm} / ${rows}`,
        ruleIds: Object.freeze([]),
      }),
      Object.freeze({
        path: "drawer.boxWidthMm",
        value: boxWidthDmm / 10,
        formula: `${bay.clearWidthDmm / 10} - ${resolve("drawerSlideWidthDeductionMm")}`,
        ruleIds: Object.freeze(["BR-2026-09-15-RUNNER-DEDUCTION"]),
      }),
      Object.freeze({
        path: "drawer.frontWidthMm",
        value: frontWidthDmm / 10,
        formula: `${bay.clearWidthDmm / 10} - 2 * ${resolve("drawerFrontRevealMm")} (inset in the bay opening)`,
        ruleIds: Object.freeze(["BR-2026-09-15-DRAWER-REVEAL"]),
      }),
    ]),
  };
}
