/**
 * FurniSpec v0.1 — Validator (G2.2 Enhanced)
 * ---------------------------------------------------------------------
 * Validates canonical FurniSpec v0.1 documents against structural,
 * mathematical, geometric, and safety invariants with strict deci-mm
 * integer precision checking (0.1 mm resolution).
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
} from "./schema.js";
import { toDeciMm } from "./units.js";

/**
 * Validates a FurniSpec object.
 * @param {any} spec
 * @returns {{ valid: boolean, errors: Array<{ code: string, message: string, path?: string }> }}
 */
export function validateFurniSpec(spec) {
  const errors = [];

  const addError = (code, message, path = "") => {
    errors.push({ code, message, path });
  };

  if (!spec || typeof spec !== "object") {
    return {
      valid: false,
      errors: [{ code: "INVALID_SPEC_TYPE", message: "Spec must be a non-null object." }],
    };
  }

  // 1. Root-level metadata checks
  if (spec.schemaVersion !== FURNISPEC_SCHEMA_VERSION) {
    addError("UNSUPPORTED_SCHEMA_VERSION", `Expected schemaVersion "${FURNISPEC_SCHEMA_VERSION}", got "${spec.schemaVersion}".`, "schemaVersion");
  }

  if (!spec.specId || typeof spec.specId !== "string" || spec.specId.trim() === "") {
    addError("MISSING_SPEC_ID", "specId is required and must be a non-empty string.", "specId");
  }

  if (typeof spec.revision !== "number" || !Number.isInteger(spec.revision) || spec.revision < 1) {
    addError("INVALID_REVISION", "revision must be a positive integer (>= 1).", "revision");
  }

  if (spec.unit !== "mm") {
    addError("INVALID_UNIT", `unit must be "mm", got "${spec.unit}".`, "unit");
  }

  if (spec.furnitureType !== FURNITURE_TYPES.WARDROBE) {
    addError("UNSUPPORTED_FURNITURE_TYPE", `furnitureType must be "${FURNITURE_TYPES.WARDROBE}".`, "furnitureType");
  }

  if (spec.wardrobeType !== WARDROBE_TYPES.STRAIGHT_HINGED) {
    addError("UNSUPPORTED_WARDROBE_TYPE", `wardrobeType must be "${WARDROBE_TYPES.STRAIGHT_HINGED}".`, "wardrobeType");
  }

  if (!Object.values(CONSTRUCTION_STYLES).includes(spec.constructionStyle)) {
    addError("UNSUPPORTED_CONSTRUCTION_STYLE", `Invalid constructionStyle "${spec.constructionStyle}".`, "constructionStyle");
  }

  if (!Object.values(FINISH_TYPES).includes(spec.finishType)) {
    addError("UNSUPPORTED_FINISH_TYPE", `Invalid finishType "${spec.finishType}".`, "finishType");
  }

  if (!Object.values(SPEC_STATUS).includes(spec.status)) {
    addError("INVALID_STATUS", `Invalid status "${spec.status}".`, "status");
  }

  // Safety & Qualification Gate
  if (spec.qualificationStatus === QUALIFICATION_STATUS.CNC_QUALIFIED) {
    addError("CNC_QUALIFIED_FORBIDDEN", "CNC qualification is forbidden prior to Gate G8 physical factory coupon validation.", "qualificationStatus");
  } else if (spec.qualificationStatus !== QUALIFICATION_STATUS.WORKSHOP_REVIEW_NOT_CNC_QUALIFIED) {
    addError("UNSUPPORTED_QUALIFICATION_STATUS", `Invalid qualificationStatus "${spec.qualificationStatus}".`, "qualificationStatus");
  }

  // Helper for strictly positive numbers with exact deci-mm precision
  const checkPositiveDeciMm = (val, path, name) => {
    if (typeof val !== "number" || !Number.isFinite(val)) {
      addError("INVALID_DIMENSION", `${name} must be a finite number. Got ${val}.`, path);
      return null;
    }
    try {
      const dmm = toDeciMm(val, path);
      if (dmm <= 0) {
        addError("INVALID_DIMENSION", `${name} must be strictly positive (> 0). Got ${val}.`, path);
        return null;
      }
      return dmm;
    } catch (err) {
      if (err.code === "UNSUPPORTED_DIMENSION_PRECISION") {
        addError("UNSUPPORTED_DIMENSION_PRECISION", err.message, path);
      } else {
        addError("INVALID_DIMENSION", err.message, path);
      }
      return null;
    }
  };

  // Helper for non-negative numbers with exact deci-mm precision
  const checkNonNegativeDeciMm = (val, path, name) => {
    if (typeof val !== "number" || !Number.isFinite(val)) {
      addError("INVALID_DIMENSION", `${name} must be a finite number. Got ${val}.`, path);
      return null;
    }
    try {
      const dmm = toDeciMm(val, path);
      if (dmm < 0) {
        addError("INVALID_DIMENSION", `${name} must be non-negative (>= 0). Got ${val}.`, path);
        return null;
      }
      return dmm;
    } catch (err) {
      if (err.code === "UNSUPPORTED_DIMENSION_PRECISION") {
        addError("UNSUPPORTED_DIMENSION_PRECISION", err.message, path);
      } else {
        addError("INVALID_DIMENSION", err.message, path);
      }
      return null;
    }
  };

  // 2. Envelope validation
  const env = spec.envelope;
  let envWDmm = null;
  let envHDmm = null;
  let envDDmm = null;
  if (!env || typeof env !== "object") {
    addError("MISSING_ENVELOPE", "envelope object is required.", "envelope");
  } else {
    envWDmm = checkPositiveDeciMm(env.widthMm, "envelope.widthMm", "envelope.widthMm");
    envHDmm = checkPositiveDeciMm(env.heightMm, "envelope.heightMm", "envelope.heightMm");
    envDDmm = checkPositiveDeciMm(env.depthMm, "envelope.depthMm", "envelope.depthMm");
  }

  // 3. Plinth validation
  const plinth = spec.plinth;
  let plinthHDmm = null;
  if (!plinth || typeof plinth !== "object") {
    addError("MISSING_PLINTH", "plinth object is required.", "plinth");
  } else {
    plinthHDmm = checkPositiveDeciMm(plinth.heightMm, "plinth.heightMm", "plinth.heightMm");
    checkNonNegativeDeciMm(plinth.frontRecessMm, "plinth.frontRecessMm", "plinth.frontRecessMm");
    if (plinth.sideInsetMm === undefined) {
      addError("MISSING_PLINTH_SIDE_INSET", "plinth.sideInsetMm is required.", "plinth.sideInsetMm");
    } else {
      checkNonNegativeDeciMm(plinth.sideInsetMm, "plinth.sideInsetMm", "plinth.sideInsetMm");
      if (plinth.sideInsetStatus !== undefined && !Object.values(SIDE_INSET_STATUS).includes(plinth.sideInsetStatus)) {
        addError("INVALID_SIDE_INSET_STATUS", `plinth.sideInsetStatus must be one of [${Object.values(SIDE_INSET_STATUS).join(", ")}].`, "plinth.sideInsetStatus");
      }
    }
  }

  // 4. Carcass validation
  const carcass = spec.carcass;
  let carcassHDmm = null;
  let carcassDDmm = null;
  let carcassTDmm = null;
  if (!carcass || typeof carcass !== "object") {
    addError("MISSING_CARCASS", "carcass object is required.", "carcass");
  } else {
    carcassHDmm = checkPositiveDeciMm(carcass.heightMm, "carcass.heightMm", "carcass.heightMm");
    carcassDDmm = checkPositiveDeciMm(carcass.depthMm, "carcass.depthMm", "carcass.depthMm");
    carcassTDmm = checkPositiveDeciMm(carcass.panelThicknessMm, "carcass.panelThicknessMm", "carcass.panelThicknessMm");
    checkPositiveDeciMm(carcass.backThicknessMm, "carcass.backThicknessMm", "carcass.backThicknessMm");
    checkPositiveDeciMm(carcass.grooveWidthMm, "carcass.grooveWidthMm", "carcass.grooveWidthMm");
    checkPositiveDeciMm(carcass.grooveDepthMm, "carcass.grooveDepthMm", "carcass.grooveDepthMm");
    checkPositiveDeciMm(carcass.grooveRearDatumMm, "carcass.grooveRearDatumMm", "carcass.grooveRearDatumMm");
  }

  // 5. Height Closure Check
  if (envHDmm !== null && plinthHDmm !== null && carcassHDmm !== null) {
    const expectedHDmm = plinthHDmm + carcassHDmm;
    if (envHDmm !== expectedHDmm) {
      addError("HEIGHT_MISMATCH", `Overall height (${env.heightMm}mm) does not equal plinth (${plinth.heightMm}mm) + carcass (${carcass.heightMm}mm).`, "envelope.heightMm");
    }
  }

  // 6. Bays validation & Width Closure Check
  const seenIds = new Set();
  seenIds.add(spec.specId);

  if (!Array.isArray(spec.bays) || spec.bays.length === 0) {
    addError("MISSING_BAYS", "bays must be a non-empty array.", "bays");
  } else if (envWDmm !== null && carcassTDmm !== null) {
    let sumBayWidthsDmm = 0;
    const dividerCount = spec.bays.length - 1;
    const requiredSidesWidthDmm = 2 * carcassTDmm + dividerCount * carcassTDmm;

    spec.bays.forEach((bay, index) => {
      const bayPath = `bays[${index}]`;
      if (!bay || typeof bay !== "object") {
        addError("INVALID_BAY", "Bay entry must be an object.", bayPath);
        return;
      }

      if (!bay.id || typeof bay.id !== "string") {
        addError("MISSING_BAY_ID", "Bay requires a string id.", `${bayPath}.id`);
      } else if (seenIds.has(bay.id)) {
        addError("DUPLICATE_ID", `Duplicate ID "${bay.id}".`, `${bayPath}.id`);
      } else {
        seenIds.add(bay.id);
      }

      const bayWDmm = checkPositiveDeciMm(bay.clearWidthMm, `${bayPath}.clearWidthMm`, "clearWidthMm");
      if (bayWDmm !== null) {
        sumBayWidthsDmm += bayWDmm;
      }

      if (Array.isArray(bay.components)) {
        bay.components.forEach((comp, compIdx) => {
          const compPath = `${bayPath}.components[${compIdx}]`;
          if (!comp || typeof comp !== "object") {
            addError("INVALID_COMPONENT", "Component must be an object.", compPath);
            return;
          }
          if (!comp.id || typeof comp.id !== "string") {
            addError("MISSING_COMPONENT_ID", "Component requires a string id.", `${compPath}.id`);
          } else if (seenIds.has(comp.id)) {
            addError("DUPLICATE_ID", `Duplicate component ID "${comp.id}".`, `${compPath}.id`);
          } else {
            seenIds.add(comp.id);
          }

          if (!Object.values(COMPONENT_TYPES).includes(comp.type)) {
            addError("UNSUPPORTED_COMPONENT_TYPE", `Unknown component type "${comp.type}".`, `${compPath}.type`);
          }

          if (comp.type === "SHELF_FIXED") {
            const hasPos = comp.clearOpeningAboveMm !== undefined || comp.elevationMm !== undefined || comp.offsetFromBottomMm !== undefined;
            if (!hasPos) {
              addError("MISSING_COMPONENT_POSITION", `Component "${comp.id}" must specify clearOpeningAboveMm, elevationMm, or offsetFromBottomMm.`, compPath);
            }
          } else if (comp.type === "SHELF_ADJUSTABLE") {
            const hasPos = comp.clearDropAboveMm !== undefined || comp.clearOpeningAboveMm !== undefined || comp.elevationMm !== undefined || comp.offsetFromBottomMm !== undefined;
            if (!hasPos) {
              addError("MISSING_COMPONENT_POSITION", `Component "${comp.id}" must specify clearDropAboveMm, clearOpeningAboveMm, elevationMm, or offsetFromBottomMm.`, compPath);
            }
          } else if (comp.type.startsWith("HANGING_RAIL")) {
            if (comp.offsetBelowShelfMm === undefined) {
              addError("MISSING_RAIL_OFFSET", `Hanging rail "${comp.id}" requires offsetBelowShelfMm.`, `${compPath}.offsetBelowShelfMm`);
            } else {
              checkPositiveDeciMm(comp.offsetBelowShelfMm, `${compPath}.offsetBelowShelfMm`, "offsetBelowShelfMm");
            }
          }

          const internalCarcassHDmm = (carcassHDmm !== null && carcassTDmm !== null) ? carcassHDmm - 2 * carcassTDmm : null;

          if (comp.clearOpeningAboveMm !== undefined) {
            const opDmm = checkPositiveDeciMm(comp.clearOpeningAboveMm, `${compPath}.clearOpeningAboveMm`, "clearOpeningAboveMm");
            if (opDmm !== null && internalCarcassHDmm !== null && opDmm >= internalCarcassHDmm) {
              addError("COMPONENT_OUTSIDE_BAY", `clearOpeningAboveMm (${comp.clearOpeningAboveMm}mm) exceeds internal carcass height (${internalCarcassHDmm / 10}mm).`, `${compPath}.clearOpeningAboveMm`);
            }
          }
          if (comp.clearDropAboveMm !== undefined) {
            const dropDmm = checkPositiveDeciMm(comp.clearDropAboveMm, `${compPath}.clearDropAboveMm`, "clearDropAboveMm");
            if (dropDmm !== null && internalCarcassHDmm !== null && dropDmm >= internalCarcassHDmm) {
              addError("COMPONENT_OUTSIDE_BAY", `clearDropAboveMm (${comp.clearDropAboveMm}mm) exceeds internal carcass height (${internalCarcassHDmm / 10}mm).`, `${compPath}.clearDropAboveMm`);
            }
          }
          if (comp.thicknessMm !== undefined) {
            checkPositiveDeciMm(comp.thicknessMm, `${compPath}.thicknessMm`, "thicknessMm");
          }
          if (comp.depthMm !== undefined) {
            const cDepthDmm = checkPositiveDeciMm(comp.depthMm, `${compPath}.depthMm`, "depthMm");
            if (cDepthDmm !== null && carcassDDmm !== null && cDepthDmm > carcassDDmm) {
              addError("SHELF_DEPTH_EXCEEDS_CARCASS", `Component depth (${comp.depthMm}mm) exceeds carcass depth (${carcass.depthMm}mm).`, `${compPath}.depthMm`);
            }
          }
          if (comp.widthMm !== undefined && bayWDmm !== null) {
            const cWidthDmm = checkPositiveDeciMm(comp.widthMm, `${compPath}.widthMm`, "widthMm");
            if (cWidthDmm !== null && cWidthDmm > bayWDmm) {
              addError("SHELF_WIDTH_EXCEEDS_BAY", `Component width (${comp.widthMm}mm) exceeds bay clear width (${bay.clearWidthMm}mm).`, `${compPath}.widthMm`);
            }
          }
        });
      }
    });

    const calculatedTotalWidthDmm = requiredSidesWidthDmm + sumBayWidthsDmm;
    if (envWDmm !== calculatedTotalWidthDmm) {
      addError(
        "WIDTH_MISMATCH",
        `Overall width (${env.widthMm}mm) does not equal outer sides + dividers (${requiredSidesWidthDmm / 10}mm) + bays sum (${sumBayWidthsDmm / 10}mm = ${calculatedTotalWidthDmm / 10}mm).`,
        "envelope.widthMm"
      );
    }
  }

  // 7. Doors validation & Door Closure Check
  const doors = spec.doors;
  let doorTDmm = null;
  let doorWDmm = null;
  let doorHDmm = null;
  let bumperGapDmm = null;

  if (!doors || typeof doors !== "object") {
    addError("MISSING_DOORS", "doors object is required.", "doors");
  } else {
    if (typeof doors.count !== "number" || !Number.isInteger(doors.count) || doors.count < 1) {
      addError("INVALID_DOOR_COUNT", "doors.count must be a positive integer (>= 1).", "doors.count");
    }
    doorTDmm = checkPositiveDeciMm(doors.thicknessMm, "doors.thicknessMm", "doors.thicknessMm");
    if (doors.bumperGapMm === undefined) {
      addError("MISSING_BUMPER_GAP", "doors.bumperGapMm is required.", "doors.bumperGapMm");
    } else {
      bumperGapDmm = checkNonNegativeDeciMm(doors.bumperGapMm, "doors.bumperGapMm", "doors.bumperGapMm");
    }
    doorWDmm = checkPositiveDeciMm(doors.finishedWidthMm, "doors.finishedWidthMm", "doors.finishedWidthMm");
    doorHDmm = checkPositiveDeciMm(doors.finishedHeightMm, "doors.finishedHeightMm", "doors.finishedHeightMm");

    const rev = doors.reveals;
    if (!rev || typeof rev !== "object") {
      addError("MISSING_DOOR_REVEALS", "doors.reveals object is required.", "doors.reveals");
    } else {
      const topRevDmm = checkNonNegativeDeciMm(rev.topMm, "doors.reveals.topMm", "doors.reveals.topMm");
      const botRevDmm = checkNonNegativeDeciMm(rev.bottomMm, "doors.reveals.bottomMm", "doors.reveals.bottomMm");
      const leftRevDmm = checkNonNegativeDeciMm(rev.leftMm, "doors.reveals.leftMm", "doors.reveals.leftMm");
      const rightRevDmm = checkNonNegativeDeciMm(rev.rightMm, "doors.reveals.rightMm", "doors.reveals.rightMm");
      const interRevDmm = checkNonNegativeDeciMm(rev.interDoorMm, "doors.reveals.interDoorMm", "doors.reveals.interDoorMm");

      // Door width closure check
      if (envWDmm !== null && doors.count && doorWDmm !== null && leftRevDmm !== null && rightRevDmm !== null && interRevDmm !== null) {
        const totalGapsWidthDmm = leftRevDmm + rightRevDmm + (doors.count - 1) * interRevDmm;
        const totalDoorsWidthDmm = doors.count * doorWDmm;
        const totalFrontWidthDmm = totalGapsWidthDmm + totalDoorsWidthDmm;

        if (envWDmm !== totalFrontWidthDmm) {
          addError(
            "DOOR_WIDTH_MISMATCH",
            `Total front width (${totalFrontWidthDmm / 10}mm = ${doors.count} doors * ${doors.finishedWidthMm}mm + gaps) does not equal envelope width (${env.widthMm}mm).`,
            "doors.finishedWidthMm"
          );
        }
      }

      // Door height closure check
      if (carcassHDmm !== null && doorHDmm !== null && topRevDmm !== null && botRevDmm !== null) {
        const totalDoorHeightZoneDmm = topRevDmm + botRevDmm + doorHDmm;
        if (carcassHDmm !== totalDoorHeightZoneDmm) {
          addError(
            "DOOR_HEIGHT_MISMATCH",
            `Total door height zone (${totalDoorHeightZoneDmm / 10}mm = top gap ${rev.topMm}mm + door ${doors.finishedHeightMm}mm + bottom gap ${rev.bottomMm}mm) does not equal carcass height (${carcass.heightMm}mm).`,
            "doors.finishedHeightMm"
          );
        }
      }
    }
  }

  // 8. Depth Closure Check
  if (envDDmm !== null && carcassDDmm !== null && doorTDmm !== null && bumperGapDmm !== null) {
    const expectedDepthDmm = carcassDDmm + doorTDmm + bumperGapDmm;
    if (envDDmm !== expectedDepthDmm) {
      addError(
        "DEPTH_MISMATCH",
        `Overall depth (${env.depthMm}mm) does not equal carcass depth (${carcass.depthMm}mm) + door thickness (${doors.thicknessMm}mm) + bumper gap (${doors.bumperGapMm}mm).`,
        "envelope.depthMm"
      );
    }
  }

  // 9. Materials & Edge-Banding Validation
  const mats = spec.materials;
  if (!mats || typeof mats !== "object") {
    addError("MISSING_MATERIALS", "materials object is required.", "materials");
  } else {
    ["carcass", "backPanel", "fronts"].forEach((mKey) => {
      const m = mats[mKey];
      const mPath = `materials.${mKey}`;
      if (!m || typeof m !== "object") {
        addError("INVALID_MATERIAL_SPEC", `Material specification for "${mKey}" is required.`, mPath);
      } else {
        if (!m.code || typeof m.code !== "string") addError("MISSING_MATERIAL_CODE", `Material "${mKey}" requires string code.`, `${mPath}.code`);
        if (!m.name || typeof m.name !== "string") addError("MISSING_MATERIAL_NAME", `Material "${mKey}" requires string name.`, `${mPath}.name`);
        checkPositiveDeciMm(m.thicknessMm, `${mPath}.thicknessMm`, "thicknessMm");
      }
    });
  }

  const eb = spec.edgeBanding;
  if (!eb || typeof eb !== "object") {
    addError("MISSING_EDGE_BANDING", "edgeBanding object is required.", "edgeBanding");
  } else {
    checkNonNegativeDeciMm(eb.frontVisibleMm, "edgeBanding.frontVisibleMm", "frontVisibleMm");
    checkNonNegativeDeciMm(eb.rearUnbandedMm, "edgeBanding.rearUnbandedMm", "rearUnbandedMm");
    checkNonNegativeDeciMm(eb.doorPerimeterMm, "edgeBanding.doorPerimeterMm", "doorPerimeterMm");
  }

  // 10. Hardware & Machining Policy Check
  const hw = spec.hardware;
  const mach = spec.machiningPolicy;
  if (!hw || typeof hw !== "object") {
    addError("MISSING_HARDWARE", "hardware object is required.", "hardware");
  } else if (!mach || typeof mach !== "object") {
    addError("MISSING_MACHINING_POLICY", "machiningPolicy object is required.", "machiningPolicy");
  } else {
    if (!Object.values(MACHINING_POLICY).includes(mach.backGroove)) {
      addError("INVALID_MACHINING_POLICY", `Invalid machiningPolicy.backGroove "${mach.backGroove}".`, "machiningPolicy.backGroove");
    }
    if (!Object.values(MACHINING_POLICY).includes(mach.drilling)) {
      addError("INVALID_MACHINING_POLICY", `Invalid machiningPolicy.drilling "${mach.drilling}".`, "machiningPolicy.drilling");
    }

    const isHardwareBlocked =
      hw.hinges?.status === HARDWARE_APPROVAL_STATUS.BLOCKED_PENDING_HARDWARE_APPROVAL ||
      hw.shelfPins?.status === HARDWARE_APPROVAL_STATUS.BLOCKED_PENDING_HARDWARE_APPROVAL ||
      hw.joinery?.status === HARDWARE_APPROVAL_STATUS.BLOCKED_PENDING_HARDWARE_APPROVAL;

    if (isHardwareBlocked && mach.drilling === MACHINING_POLICY.APPROVED) {
      addError(
        "ILLEGAL_DRILLING_APPROVAL",
        "machiningPolicy.drilling cannot be APPROVED while hardware specifications are BLOCKED_PENDING_HARDWARE_APPROVAL.",
        "machiningPolicy.drilling"
      );
    }
  }

  // 11. Clearance & Tolerance Policy Check
  const rootAllowance = spec.clearancePolicy?.backPanel?.grooveRootAllowanceMm ?? spec.carcass?.grooveRootAllowanceMm;
  if (rootAllowance === undefined) {
    addError(
      "MISSING_BACK_PANEL_TOLERANCE_POLICY",
      "Back-panel tolerance policy (grooveRootAllowanceMm) is required.",
      "clearancePolicy.backPanel.grooveRootAllowanceMm"
    );
  } else {
    checkPositiveDeciMm(rootAllowance, "clearancePolicy.backPanel.grooveRootAllowanceMm", "grooveRootAllowanceMm");
  }

  const hasAdjShelf = Array.isArray(spec.bays) && spec.bays.some((b) => Array.isArray(b.components) && b.components.some((c) => c.type === "SHELF_ADJUSTABLE"));
  if (hasAdjShelf) {
    const adjPolicy = spec.clearancePolicy?.adjustableShelf;
    let missingPolicy = false;
    if (!adjPolicy) {
      for (const bay of spec.bays) {
        for (const comp of bay.components || []) {
          if (comp.type === "SHELF_ADJUSTABLE" && (comp.sideClearanceMm === undefined || comp.frontSetbackMm === undefined)) {
            missingPolicy = true;
            break;
          }
        }
      }
    } else {
      if (adjPolicy.sideClearanceMm === undefined || adjPolicy.frontSetbackMm === undefined) {
        missingPolicy = true;
      } else {
        checkPositiveDeciMm(adjPolicy.sideClearanceMm, "clearancePolicy.adjustableShelf.sideClearanceMm", "sideClearanceMm");
        checkPositiveDeciMm(adjPolicy.frontSetbackMm, "clearancePolicy.adjustableShelf.frontSetbackMm", "frontSetbackMm");
      }
    }
    if (missingPolicy) {
      addError(
        "MISSING_ADJUSTABLE_SHELF_CLEARANCE_POLICY",
        "Adjustable-shelf clearance policy (sideClearanceMm and frontSetbackMm) is required.",
        "clearancePolicy.adjustableShelf"
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
