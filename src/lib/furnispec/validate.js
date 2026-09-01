/**
 * FurniSpec v0.1 — Validator
 * ---------------------------------------------------------------------
 * Validates canonical FurniSpec v0.1 documents against structural,
 * mathematical, geometric, and safety invariants.
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
  SIDE_INSET_STATUS,
} from "./schema.js";

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

  // Helper for finite positive numbers
  const checkPositiveNumber = (val, path, name) => {
    if (typeof val !== "number" || !Number.isFinite(val) || val <= 0) {
      addError("INVALID_DIMENSION", `${name} must be a strictly positive finite number. Got ${val}.`, path);
      return false;
    }
    return true;
  };

  // 2. Envelope validation
  const env = spec.envelope;
  if (!env || typeof env !== "object") {
    addError("MISSING_ENVELOPE", "envelope object is required.", "envelope");
  } else {
    checkPositiveNumber(env.widthMm, "envelope.widthMm", "envelope.widthMm");
    checkPositiveNumber(env.heightMm, "envelope.heightMm", "envelope.heightMm");
    checkPositiveNumber(env.depthMm, "envelope.depthMm", "envelope.depthMm");
  }

  // 3. Plinth validation
  const plinth = spec.plinth;
  if (!plinth || typeof plinth !== "object") {
    addError("MISSING_PLINTH", "plinth object is required.", "plinth");
  } else {
    checkPositiveNumber(plinth.heightMm, "plinth.heightMm", "plinth.heightMm");
    if (typeof plinth.frontRecessMm !== "number" || !Number.isFinite(plinth.frontRecessMm) || plinth.frontRecessMm < 0) {
      addError("INVALID_DIMENSION", "plinth.frontRecessMm must be a non-negative finite number.", "plinth.frontRecessMm");
    }
    if (plinth.sideInsetMm !== undefined) {
      if (typeof plinth.sideInsetMm !== "number" || !Number.isFinite(plinth.sideInsetMm) || plinth.sideInsetMm < 0) {
        addError("INVALID_DIMENSION", "plinth.sideInsetMm must be a non-negative finite number.", "plinth.sideInsetMm");
      }
      if (!Object.values(SIDE_INSET_STATUS).includes(plinth.sideInsetStatus)) {
        addError("INVALID_SIDE_INSET_STATUS", `plinth.sideInsetStatus must be one of [${Object.values(SIDE_INSET_STATUS).join(", ")}].`, "plinth.sideInsetStatus");
      }
    }
  }

  // 4. Carcass validation
  const carcass = spec.carcass;
  if (!carcass || typeof carcass !== "object") {
    addError("MISSING_CARCASS", "carcass object is required.", "carcass");
  } else {
    checkPositiveNumber(carcass.heightMm, "carcass.heightMm", "carcass.heightMm");
    checkPositiveNumber(carcass.depthMm, "carcass.depthMm", "carcass.depthMm");
    checkPositiveNumber(carcass.panelThicknessMm, "carcass.panelThicknessMm", "carcass.panelThicknessMm");
    checkPositiveNumber(carcass.backThicknessMm, "carcass.backThicknessMm", "carcass.backThicknessMm");
    checkPositiveNumber(carcass.grooveWidthMm, "carcass.grooveWidthMm", "carcass.grooveWidthMm");
    checkPositiveNumber(carcass.grooveDepthMm, "carcass.grooveDepthMm", "carcass.grooveDepthMm");
    checkPositiveNumber(carcass.grooveRearDatumMm, "carcass.grooveRearDatumMm", "carcass.grooveRearDatumMm");
  }

  // 5. Height Closure Check
  if (env && plinth && carcass && env.heightMm && plinth.heightMm && carcass.heightMm) {
    const expectedHeight = plinth.heightMm + carcass.heightMm;
    if (Math.abs(env.heightMm - expectedHeight) > 0.001) {
      addError("HEIGHT_MISMATCH", `Overall height (${env.heightMm}mm) does not equal plinth (${plinth.heightMm}mm) + carcass (${carcass.heightMm}mm).`, "envelope.heightMm");
    }
  }

  // 6. Bays validation & Width Closure Check
  const seenIds = new Set();
  seenIds.add(spec.specId);

  if (!Array.isArray(spec.bays) || spec.bays.length === 0) {
    addError("MISSING_BAYS", "bays must be a non-empty array.", "bays");
  } else if (env && carcass && env.widthMm && carcass.panelThicknessMm) {
    let sumBayWidths = 0;
    const dividerCount = spec.bays.length - 1;
    const requiredSidesWidth = 2 * carcass.panelThicknessMm + dividerCount * carcass.panelThicknessMm;

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

      if (checkPositiveNumber(bay.clearWidthMm, `${bayPath}.clearWidthMm`, "clearWidthMm")) {
        sumBayWidths += bay.clearWidthMm;
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
        });
      }
    });

    const calculatedTotalWidth = requiredSidesWidth + sumBayWidths;
    if (Math.abs(env.widthMm - calculatedTotalWidth) > 0.001) {
      addError("WIDTH_MISMATCH", `Overall width (${env.widthMm}mm) does not equal outer sides + dividers (${requiredSidesWidth}mm) + bays sum (${sumBayWidths}mm = ${calculatedTotalWidth}mm).`, "envelope.widthMm");
    }
  }

  // 7. Doors validation & Door Closure Check
  const doors = spec.doors;
  if (!doors || typeof doors !== "object") {
    addError("MISSING_DOORS", "doors object is required.", "doors");
  } else {
    if (typeof doors.count !== "number" || !Number.isInteger(doors.count) || doors.count < 1) {
      addError("INVALID_DOOR_COUNT", "doors.count must be a positive integer (>= 1).", "doors.count");
    }
    checkPositiveNumber(doors.thicknessMm, "doors.thicknessMm", "doors.thicknessMm");
    checkPositiveNumber(doors.finishedWidthMm, "doors.finishedWidthMm", "doors.finishedWidthMm");
    checkPositiveNumber(doors.finishedHeightMm, "doors.finishedHeightMm", "doors.finishedHeightMm");

    const rev = doors.reveals;
    if (!rev || typeof rev !== "object") {
      addError("MISSING_DOOR_REVEALS", "doors.reveals object is required.", "doors.reveals");
    } else {
      ["topMm", "bottomMm", "leftMm", "rightMm", "interDoorMm"].forEach((key) => {
        if (typeof rev[key] !== "number" || !Number.isFinite(rev[key]) || rev[key] < 0) {
          addError("INVALID_DIMENSION", `doors.reveals.${key} must be a non-negative finite number.`, `doors.reveals.${key}`);
        }
      });

      // Door width closure check
      if (env && env.widthMm && doors.count && doors.finishedWidthMm) {
        const gapCount = doors.count + 1; // Left reveal + (count - 1) inter-door + Right reveal
        const totalGapsWidth = rev.leftMm + rev.rightMm + (doors.count - 1) * rev.interDoorMm;
        const totalDoorsWidth = doors.count * doors.finishedWidthMm;
        const totalFrontWidth = totalGapsWidth + totalDoorsWidth;

        if (Math.abs(env.widthMm - totalFrontWidth) > 0.001) {
          addError("DOOR_WIDTH_MISMATCH", `Total front width (${totalFrontWidth}mm = ${doors.count} doors * ${doors.finishedWidthMm}mm + ${gapCount} gaps) does not equal envelope width (${env.widthMm}mm).`, "doors.finishedWidthMm");
        }
      }

      // Door height closure check
      if (carcass && carcass.heightMm && doors.finishedHeightMm) {
        const totalDoorHeightZone = rev.topMm + rev.bottomMm + doors.finishedHeightMm;
        if (Math.abs(carcass.heightMm - totalDoorHeightZone) > 0.001) {
          addError("DOOR_HEIGHT_MISMATCH", `Total door height zone (${totalDoorHeightZone}mm = top gap ${rev.topMm}mm + door ${doors.finishedHeightMm}mm + bottom gap ${rev.bottomMm}mm) does not equal carcass height (${carcass.heightMm}mm).`, "doors.finishedHeightMm");
        }
      }
    }
  }

  // 8. Depth Closure Check
  if (env && carcass && doors && env.depthMm && carcass.depthMm && doors.thicknessMm) {
    const bumperGapMm = 2.0; // Standard operating air gap
    const expectedDepth = carcass.depthMm + doors.thicknessMm + bumperGapMm;
    if (Math.abs(env.depthMm - expectedDepth) > 0.001) {
      addError("DEPTH_MISMATCH", `Overall depth (${env.depthMm}mm) does not equal carcass depth (${carcass.depthMm}mm) + door thickness (${doors.thicknessMm}mm) + bumper gap (${bumperGapMm}mm).`, "envelope.depthMm");
    }
  }

  // 9. Hardware & Machining Policy Check
  const hw = spec.hardware;
  const mach = spec.machiningPolicy;
  if (!hw || typeof hw !== "object") {
    addError("MISSING_HARDWARE", "hardware object is required.", "hardware");
  } else if (!mach || typeof mach !== "object") {
    addError("MISSING_MACHINING_POLICY", "machiningPolicy object is required.", "machiningPolicy");
  } else {
    // If drilling hardware is unapproved/blocked, machiningPolicy.drilling MUST NOT be APPROVED
    const isHardwareBlocked =
      hw.hinges?.status === HARDWARE_APPROVAL_STATUS.BLOCKED_PENDING_HARDWARE_APPROVAL ||
      hw.shelfPins?.status === HARDWARE_APPROVAL_STATUS.BLOCKED_PENDING_HARDWARE_APPROVAL ||
      hw.joinery?.status === HARDWARE_APPROVAL_STATUS.BLOCKED_PENDING_HARDWARE_APPROVAL;

    if (isHardwareBlocked && mach.drilling === MACHINING_POLICY.APPROVED) {
      addError("ILLEGAL_DRILLING_APPROVAL", "machiningPolicy.drilling cannot be APPROVED while hardware specifications are BLOCKED_PENDING_HARDWARE_APPROVAL.", "machiningPolicy.drilling");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
