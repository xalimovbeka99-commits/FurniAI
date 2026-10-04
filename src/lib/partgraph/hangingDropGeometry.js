/**
 * Hanging-rail clear drop — geometric consistency with the compiled carcass.
 * ---------------------------------------------------------------------
 * A HANGING_RAIL_* component may declare `targetClearDropMm`. Before this
 * module nothing read it: a 5000 mm target in a 2300 mm carcass, a rail
 * placed below the carcass bottom, or a short-hanging target larger than the
 * space above the shelf beneath it all validated, compiled and saved.
 *
 * This is NOT a practical furniture minimum and introduces no new furniture
 * value. It checks one identity against geometry the kernel has already
 * computed:
 *
 *   achievable clear drop = rail centre Y − upper face Y of the next
 *                           structural part below the rail in the same bay
 *                           (the carcass bottom panel if there is none)
 *
 * The datum is the one already used by the kernel for
 * SHELF_ADJUSTABLE.clearDropAboveMm (rail centre → shelf upper face) and by
 * docs/WARDROBE_RULEBOOK_V0.1.md §E ("Clear Vertical Hanging Drop:
 * 1914.0 − 118.0 = 1796.0 mm"). A declared target the geometry cannot
 * deliver (achievable < target) is refused. A rail whose centre is not
 * strictly inside the bay's clear height, or that passes through a
 * structural part, is refused whether or not it declares a target.
 *
 * Whether the drop should instead be measured from the tube underside or
 * allow a hanger-hook allowance is a workshop decision (Bekzod) and is not
 * taken here; see docs/m3/HANGING_DROP_GEOMETRY.md.
 *
 * All comparisons are exact integer deci-millimetres (0.1 mm, the supported
 * precision). Pure: no I/O, no randomness.
 */

import { toDeciMm } from "../furnispec/units.js";

export const HANGING_DROP_ERROR = Object.freeze({
  NOT_ACHIEVABLE: "HANGING_DROP_NOT_ACHIEVABLE",
  RAIL_OUTSIDE_BAY: "HANGING_RAIL_OUTSIDE_BAY",
  RAIL_INTERSECTS_PART: "HANGING_RAIL_INTERSECTS_PART",
  INTERIOR_PART_OUTSIDE_BAY: "INTERIOR_PART_OUTSIDE_BAY",
});

export const HANGING_DROP_DATUM =
  "rail centre to the upper face of the next structural part below it in the same bay " +
  "(carcass bottom panel if none) — WARDROBE_RULEBOOK_V0.1 §E";

export class HangingDropGeometryError extends Error {
  /**
   * @param {string} code one of HANGING_DROP_ERROR
   * @param {string} message
   * @param {object} details
   */
  constructor(code, message, details) {
    super(message);
    this.name = "HangingDropGeometryError";
    this.code = code;
    this.details = details;
  }
}

const fmt = (dmm) => `${dmm / 10}mm`;

/**
 * Every interior part (shelf, drawer part) must lie within the bay's clear
 * height: between the carcass bottom panel's upper face and the carcass top
 * panel's lower face. Before this check a 1200 mm-high draft placed its two
 * adjustable shelves at Y −572 mm and −204 mm — below the floor — and was
 * previewed as valid. Pure containment; no furniture value is involved.
 *
 * @throws {HangingDropGeometryError}
 */
export function assertInteriorPartsInsideBay({ bayParts, yBotTopDmm, yTopBottomDmm }) {
  for (const p of bayParts) {
    if (p.minYDmm < yBotTopDmm || p.maxYDmm > yTopBottomDmm) {
      throw new HangingDropGeometryError(
        HANGING_DROP_ERROR.INTERIOR_PART_OUTSIDE_BAY,
        `Part ${p.id} (Y ${fmt(p.minYDmm)} – ${fmt(p.maxYDmm)}) lies outside the bay clear height ` +
          `(${fmt(yBotTopDmm)} – ${fmt(yTopBottomDmm)}).`,
        {
          partId: p.id,
          bayIndex: p.bayIndex,
          partMinYMm: p.minYDmm / 10,
          partMaxYMm: p.maxYDmm / 10,
          bayClearFromYMm: yBotTopDmm / 10,
          bayClearToYMm: yTopBottomDmm / 10,
        }
      );
    }
  }
}

/**
 * @param {object} args
 * @param {Array<{comp:object, bayIndex:number, railCenterYDmm:number}>} args.rails
 * @param {Array<{id:string, bayIndex:number, minYDmm:number, maxYDmm:number}>} args.bayParts
 *        structural parts that sit inside a bay's clear width (shelves, drawer parts)
 * @param {number} args.yBotTopDmm upper face of the carcass bottom panel
 * @param {number} args.yTopBottomDmm lower face of the carcass top panel
 * @returns {Array<object>} one measurement per rail (for tests / diagnostics)
 * @throws {HangingDropGeometryError} on the first inconsistent rail
 */
export function assertHangingDropGeometry({ rails, bayParts, yBotTopDmm, yTopBottomDmm }) {
  const measurements = [];
  for (const rail of rails) {
    const { comp, bayIndex, railCenterYDmm: y } = rail;
    const base = {
      componentId: comp.id,
      componentType: comp.type,
      bayIndex,
      railCentreYMm: y / 10,
      datum: HANGING_DROP_DATUM,
    };

    if (!(y > yBotTopDmm && y < yTopBottomDmm)) {
      throw new HangingDropGeometryError(
        HANGING_DROP_ERROR.RAIL_OUTSIDE_BAY,
        `Hanging rail "${comp.id}" centre (Y ${fmt(y)}) is not inside the bay clear height ` +
          `(${fmt(yBotTopDmm)} – ${fmt(yTopBottomDmm)}).`,
        { ...base, bayClearFromYMm: yBotTopDmm / 10, bayClearToYMm: yTopBottomDmm / 10 }
      );
    }

    const inBay = bayParts.filter((p) => p.bayIndex === bayIndex);
    const pierced = inBay.find((p) => p.minYDmm < y && y < p.maxYDmm);
    if (pierced) {
      throw new HangingDropGeometryError(
        HANGING_DROP_ERROR.RAIL_INTERSECTS_PART,
        `Hanging rail "${comp.id}" centre (Y ${fmt(y)}) passes through part ${pierced.id} ` +
          `(${fmt(pierced.minYDmm)} – ${fmt(pierced.maxYDmm)}).`,
        { ...base, partId: pierced.id }
      );
    }

    let obstructionId = "CARCASS_BOTTOM";
    let obstructionTopDmm = yBotTopDmm;
    for (const p of inBay) {
      if (p.maxYDmm <= y && p.maxYDmm > obstructionTopDmm) {
        obstructionTopDmm = p.maxYDmm;
        obstructionId = p.id;
      }
    }
    const achievableDmm = y - obstructionTopDmm;
    const measurement = {
      ...base,
      obstructionId,
      obstructionUpperFaceYMm: obstructionTopDmm / 10,
      achievableClearDropMm: achievableDmm / 10,
      targetClearDropMm: comp.targetClearDropMm,
    };

    if (comp.targetClearDropMm !== undefined) {
      const targetDmm = toDeciMm(comp.targetClearDropMm, `${comp.id}.targetClearDropMm`);
      if (targetDmm > achievableDmm) {
        throw new HangingDropGeometryError(
          HANGING_DROP_ERROR.NOT_ACHIEVABLE,
          `Hanging rail "${comp.id}" declares a clear drop of ${fmt(targetDmm)}, but only ` +
            `${fmt(achievableDmm)} is available above ${obstructionId === "CARCASS_BOTTOM" ? "the carcass bottom" : obstructionId}.`,
          measurement
        );
      }
    }
    measurements.push(measurement);
  }
  return measurements;
}
