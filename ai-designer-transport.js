var AiDesignerTransport = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/lib/adapters/aiDesignerTransport.js
  var aiDesignerTransport_exports = {};
  __export(aiDesignerTransport_exports, {
    AI_DESIGNER_ENDPOINT: () => AI_DESIGNER_ENDPOINT,
    RESULT_KIND: () => RESULT_KIND,
    RESULT_SOURCE: () => RESULT_SOURCE,
    proposeDesignChange: () => proposeDesignChange
  });

  // src/lib/furnispec/schema.js
  var FURNISPEC_SCHEMA_VERSION = "furnispec/0.1";
  var FURNITURE_TYPES = Object.freeze({
    WARDROBE: "wardrobe"
  });
  var WARDROBE_TYPES = Object.freeze({
    STRAIGHT_HINGED: "straight_hinged"
  });
  var CONSTRUCTION_STYLES = Object.freeze({
    CAP_STYLE: "CAP_STYLE",
    // Style B: Top/bottom cap outer sides
    FULL_HEIGHT_SIDES: "FULL_HEIGHT_SIDES"
    // Style A: Sides run full height
  });
  var FINISH_TYPES = Object.freeze({
    MELAMINE: "melamine",
    PAINTED: "painted",
    VENEER: "veneer"
  });
  var SPEC_STATUS = Object.freeze({
    DRAFT: "DRAFT",
    PROPOSED: "PROPOSED",
    APPROVED: "APPROVED"
  });
  var QUALIFICATION_STATUS = Object.freeze({
    WORKSHOP_REVIEW_NOT_CNC_QUALIFIED: "WORKSHOP_REVIEW_NOT_CNC_QUALIFIED",
    CNC_QUALIFIED: "CNC_QUALIFIED"
    // Blocked until Gate G8 physical coupon
  });
  var HARDWARE_APPROVAL_STATUS = Object.freeze({
    APPROVED: "APPROVED",
    BLOCKED_PENDING_HARDWARE_APPROVAL: "BLOCKED_PENDING_HARDWARE_APPROVAL",
    PREVIEW_ONLY: "PREVIEW_ONLY"
  });
  var MACHINING_POLICY = Object.freeze({
    APPROVED: "APPROVED",
    BLOCKED_PENDING_HARDWARE_APPROVAL: "BLOCKED_PENDING_HARDWARE_APPROVAL"
  });
  var COMPONENT_TYPES = Object.freeze({
    SHELF_FIXED: "SHELF_FIXED",
    SHELF_ADJUSTABLE: "SHELF_ADJUSTABLE",
    HANGING_RAIL_LONG: "HANGING_RAIL_LONG",
    HANGING_RAIL_SHORT: "HANGING_RAIL_SHORT",
    DRAWER_BANK: "DRAWER_BANK"
  });
  var SIDE_INSET_STATUS = Object.freeze({
    ASSUMPTION_PENDING_BEKZOD_APPROVAL: "ASSUMPTION_PENDING_BEKZOD_APPROVAL",
    BEKZOD_APPROVED: "BEKZOD_APPROVED"
  });

  // src/lib/furnispec/units.js
  var DimensionPrecisionError = class extends Error {
    constructor(field, value, message) {
      super(message || `${field}: value ${value} cannot be represented at 0.1mm (deci-mm) precision.`);
      this.name = "DimensionPrecisionError";
      this.code = "UNSUPPORTED_DIMENSION_PRECISION";
      this.field = field;
      this.value = value;
    }
  };
  function toDeciMm(valueMm, field = "dimension") {
    if (typeof valueMm !== "number" || !Number.isFinite(valueMm)) {
      throw new DimensionPrecisionError(field, valueMm, `${field} must be a finite number, got ${valueMm}.`);
    }
    const scaled = valueMm * 10;
    const rounded = Math.round(scaled);
    if (Math.abs(scaled - rounded) > 1e-5) {
      throw new DimensionPrecisionError(
        field,
        valueMm,
        `${field} (${valueMm}mm) has precision finer than 0.1mm. Silent rounding is forbidden.`
      );
    }
    return rounded;
  }
  function fromDeciMm(dmm) {
    if (typeof dmm !== "number" || !Number.isInteger(dmm)) {
      throw new Error(`fromDeciMm expects an integer deci-millimetre value, got ${dmm}.`);
    }
    return dmm / 10;
  }
  function assertDeciMm(valueMm, field) {
    const dmm = toDeciMm(valueMm, field);
    if (dmm <= 0) {
      throw new DimensionPrecisionError(field, valueMm, `${field} must be strictly positive (> 0), got ${valueMm}mm.`);
    }
    return dmm;
  }

  // src/lib/furnispec/validate.js
  function validateFurniSpec(spec) {
    const errors = [];
    const addError = (code, message, path = "") => {
      errors.push({ code, message, path });
    };
    if (!spec || typeof spec !== "object") {
      return {
        valid: false,
        errors: [{ code: "INVALID_SPEC_TYPE", message: "Spec must be a non-null object." }]
      };
    }
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
    if (spec.qualificationStatus === QUALIFICATION_STATUS.CNC_QUALIFIED) {
      addError("CNC_QUALIFIED_FORBIDDEN", "CNC qualification is forbidden prior to Gate G8 physical factory coupon validation.", "qualificationStatus");
    } else if (spec.qualificationStatus !== QUALIFICATION_STATUS.WORKSHOP_REVIEW_NOT_CNC_QUALIFIED) {
      addError("UNSUPPORTED_QUALIFICATION_STATUS", `Invalid qualificationStatus "${spec.qualificationStatus}".`, "qualificationStatus");
    }
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
    const plinth = spec.plinth;
    let plinthHDmm = null;
    if (!plinth || typeof plinth !== "object") {
      addError("MISSING_PLINTH", "plinth object is required.", "plinth");
    } else {
      plinthHDmm = checkPositiveDeciMm(plinth.heightMm, "plinth.heightMm", "plinth.heightMm");
      checkNonNegativeDeciMm(plinth.frontRecessMm, "plinth.frontRecessMm", "plinth.frontRecessMm");
      if (plinth.sideInsetMm === void 0) {
        addError("MISSING_PLINTH_SIDE_INSET", "plinth.sideInsetMm is required.", "plinth.sideInsetMm");
      } else {
        checkNonNegativeDeciMm(plinth.sideInsetMm, "plinth.sideInsetMm", "plinth.sideInsetMm");
        if (plinth.sideInsetStatus !== void 0 && !Object.values(SIDE_INSET_STATUS).includes(plinth.sideInsetStatus)) {
          addError("INVALID_SIDE_INSET_STATUS", `plinth.sideInsetStatus must be one of [${Object.values(SIDE_INSET_STATUS).join(", ")}].`, "plinth.sideInsetStatus");
        }
      }
    }
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
    if (envHDmm !== null && plinthHDmm !== null && carcassHDmm !== null) {
      const expectedHDmm = plinthHDmm + carcassHDmm;
      if (envHDmm !== expectedHDmm) {
        addError("HEIGHT_MISMATCH", `Overall height (${env.heightMm}mm) does not equal plinth (${plinth.heightMm}mm) + carcass (${carcass.heightMm}mm).`, "envelope.heightMm");
      }
    }
    const seenIds = /* @__PURE__ */ new Set();
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
              const hasPos = comp.clearOpeningAboveMm !== void 0 || comp.elevationMm !== void 0 || comp.offsetFromBottomMm !== void 0;
              if (!hasPos) {
                addError("MISSING_COMPONENT_POSITION", `Component "${comp.id}" must specify clearOpeningAboveMm, elevationMm, or offsetFromBottomMm.`, compPath);
              }
            } else if (comp.type === "SHELF_ADJUSTABLE") {
              const hasPos = comp.clearDropAboveMm !== void 0 || comp.clearOpeningAboveMm !== void 0 || comp.elevationMm !== void 0 || comp.offsetFromBottomMm !== void 0;
              if (!hasPos) {
                addError("MISSING_COMPONENT_POSITION", `Component "${comp.id}" must specify clearDropAboveMm, clearOpeningAboveMm, elevationMm, or offsetFromBottomMm.`, compPath);
              }
            } else if (comp.type.startsWith("HANGING_RAIL")) {
              if (comp.offsetBelowShelfMm === void 0) {
                addError("MISSING_RAIL_OFFSET", `Hanging rail "${comp.id}" requires offsetBelowShelfMm.`, `${compPath}.offsetBelowShelfMm`);
              } else {
                checkPositiveDeciMm(comp.offsetBelowShelfMm, `${compPath}.offsetBelowShelfMm`, "offsetBelowShelfMm");
              }
            }
            const internalCarcassHDmm = carcassHDmm !== null && carcassTDmm !== null ? carcassHDmm - 2 * carcassTDmm : null;
            if (comp.clearOpeningAboveMm !== void 0) {
              const opDmm = checkPositiveDeciMm(comp.clearOpeningAboveMm, `${compPath}.clearOpeningAboveMm`, "clearOpeningAboveMm");
              if (opDmm !== null && internalCarcassHDmm !== null && opDmm >= internalCarcassHDmm) {
                addError("COMPONENT_OUTSIDE_BAY", `clearOpeningAboveMm (${comp.clearOpeningAboveMm}mm) exceeds internal carcass height (${internalCarcassHDmm / 10}mm).`, `${compPath}.clearOpeningAboveMm`);
              }
            }
            if (comp.clearDropAboveMm !== void 0) {
              const dropDmm = checkPositiveDeciMm(comp.clearDropAboveMm, `${compPath}.clearDropAboveMm`, "clearDropAboveMm");
              if (dropDmm !== null && internalCarcassHDmm !== null && dropDmm >= internalCarcassHDmm) {
                addError("COMPONENT_OUTSIDE_BAY", `clearDropAboveMm (${comp.clearDropAboveMm}mm) exceeds internal carcass height (${internalCarcassHDmm / 10}mm).`, `${compPath}.clearDropAboveMm`);
              }
            }
            if (comp.thicknessMm !== void 0) {
              checkPositiveDeciMm(comp.thicknessMm, `${compPath}.thicknessMm`, "thicknessMm");
            }
            if (comp.depthMm !== void 0) {
              const cDepthDmm = checkPositiveDeciMm(comp.depthMm, `${compPath}.depthMm`, "depthMm");
              if (cDepthDmm !== null && carcassDDmm !== null && cDepthDmm > carcassDDmm) {
                addError("SHELF_DEPTH_EXCEEDS_CARCASS", `Component depth (${comp.depthMm}mm) exceeds carcass depth (${carcass.depthMm}mm).`, `${compPath}.depthMm`);
              }
            }
            if (comp.widthMm !== void 0 && bayWDmm !== null) {
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
      if (doors.bumperGapMm === void 0) {
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
      const isHardwareBlocked = hw.hinges?.status === HARDWARE_APPROVAL_STATUS.BLOCKED_PENDING_HARDWARE_APPROVAL || hw.shelfPins?.status === HARDWARE_APPROVAL_STATUS.BLOCKED_PENDING_HARDWARE_APPROVAL || hw.joinery?.status === HARDWARE_APPROVAL_STATUS.BLOCKED_PENDING_HARDWARE_APPROVAL;
      if (isHardwareBlocked && mach.drilling === MACHINING_POLICY.APPROVED) {
        addError(
          "ILLEGAL_DRILLING_APPROVAL",
          "machiningPolicy.drilling cannot be APPROVED while hardware specifications are BLOCKED_PENDING_HARDWARE_APPROVAL.",
          "machiningPolicy.drilling"
        );
      }
    }
    const rootAllowance = spec.clearancePolicy?.backPanel?.grooveRootAllowanceMm ?? spec.carcass?.grooveRootAllowanceMm;
    if (rootAllowance === void 0) {
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
            if (comp.type === "SHELF_ADJUSTABLE" && (comp.sideClearanceMm === void 0 || comp.frontSetbackMm === void 0)) {
              missingPolicy = true;
              break;
            }
          }
        }
      } else {
        if (adjPolicy.sideClearanceMm === void 0 || adjPolicy.frontSetbackMm === void 0) {
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
      errors
    };
  }

  // src/lib/partgraph/schema.js
  var PARTGRAPH_VERSION = "partgraph/0.1";
  var PART_ROLES = Object.freeze({
    TOP_PANEL: "TOP_PANEL",
    BOTTOM_PANEL: "BOTTOM_PANEL",
    SIDE_PANEL_LEFT: "SIDE_PANEL_LEFT",
    SIDE_PANEL_RIGHT: "SIDE_PANEL_RIGHT",
    DIVIDER_PANEL: "DIVIDER_PANEL",
    FIXED_SHELF: "FIXED_SHELF",
    ADJUSTABLE_SHELF: "ADJUSTABLE_SHELF",
    BACK_PANEL: "BACK_PANEL",
    DOOR_PANEL: "DOOR_PANEL",
    PLINTH_FRONT_FASCIA: "PLINTH_FRONT_FASCIA",
    PLINTH_REAR_RAIL: "PLINTH_REAR_RAIL",
    PLINTH_SIDE_RETURN_LEFT: "PLINTH_SIDE_RETURN_LEFT",
    PLINTH_SIDE_RETURN_RIGHT: "PLINTH_SIDE_RETURN_RIGHT",
    PLINTH_CROSS_STRETCHER: "PLINTH_CROSS_STRETCHER"
  });
  var GEOMETRY_TYPES = Object.freeze({
    RECTANGULAR_PANEL: "RECTANGULAR_PANEL"
  });
  var GRAIN_DIRECTIONS = Object.freeze({
    LENGTH: "LENGTH",
    WIDTH: "WIDTH",
    NONE: "NONE"
  });
  var ORIENTATIONS = Object.freeze({
    HORIZONTAL_XZ: "HORIZONTAL_XZ",
    // Panels flat on XZ plane (Top, Bottom, Shelves)
    VERTICAL_YZ: "VERTICAL_YZ",
    // Panels vertical on YZ plane (Sides, Dividers, Plinth Side Returns)
    VERTICAL_XY: "VERTICAL_XY"
    // Panels facing front on XY plane (Doors, Back, Plinth Front/Rear)
  });

  // src/lib/partgraph/buildStructuralPartGraph.js
  function buildStructuralPartGraph(furniSpec) {
    const valResult = validateFurniSpec(furniSpec);
    if (!valResult.valid) {
      const err = new Error(`Cannot generate PartGraph from invalid FurniSpec: ${valResult.errors.map((e) => e.message).join("; ")}`);
      err.code = "INVALID_FURNISPEC";
      err.validationErrors = valResult.errors;
      throw err;
    }
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
    const zDoorFrontDmm = 0;
    const zDoorRearDmm = doorTDmm;
    const zCarcassFrontDmm = doorTDmm + bumperGapDmm;
    const zCarcassRearDmm = zCarcassFrontDmm + carcassDDmm;
    const yFloorDmm = 0;
    const yPlinthTopDmm = plinthHDmm;
    const yBotTopDmm = yPlinthTopDmm + panelTDmm;
    const yTopBottomDmm = yFloorDmm + envHDmm - panelTDmm;
    const yTopTopDmm = yFloorDmm + envHDmm;
    const internalCarcassHDmm = yTopBottomDmm - yBotTopDmm;
    const internalCarcassWDmm = envWDmm - 2 * panelTDmm;
    const dividerDepthDmm = carcassDDmm - grvRearDatumDmm;
    const parts = [];
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
      sourceRuleIds
    }) => {
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
          thicknessDmm
        },
        raw: {
          lengthDmm: rawLengthDmm,
          widthDmm: rawWidthDmm,
          thicknessDmm
        },
        placement: {
          minXDmm,
          maxXDmm,
          minYDmm,
          maxYDmm,
          minZDmm,
          maxZDmm
        },
        orientation,
        grainDirection,
        edges: {
          LENGTH_EDGE_1: edges.LENGTH_EDGE_1,
          LENGTH_EDGE_2: edges.LENGTH_EDGE_2,
          WIDTH_EDGE_1: edges.WIDTH_EDGE_1,
          WIDTH_EDGE_2: edges.WIDTH_EDGE_2
        },
        status: "APPROVED",
        sourceRuleIds
      };
    };
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
          WIDTH_EDGE_2: edgeFrontDmm
        },
        sourceRuleIds: ["WR-001", "WR-003", "WR-013"]
      })
    );
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
          WIDTH_EDGE_2: edgeFrontDmm
        },
        sourceRuleIds: ["WR-001", "WR-003", "WR-013"]
      })
    );
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
          WIDTH_EDGE_2: 0
        },
        sourceRuleIds: ["WR-001", "WR-003", "WR-013"]
      })
    );
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
          WIDTH_EDGE_2: 0
        },
        sourceRuleIds: ["WR-001", "WR-003", "WR-013"]
      })
    );
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
        components: bay.components || []
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
          maxXDmm: divMaxX
        });
        xCursor = divMaxX;
      }
    }
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
            WIDTH_EDGE_2: 0
          },
          sourceRuleIds: ["WR-002", "WR-003", "WR-013"]
        })
      );
    }
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
          if (comp.clearOpeningAboveMm !== void 0) {
            const openingDmm = toDeciMm(comp.clearOpeningAboveMm, `${comp.id}.clearOpeningAboveMm`);
            maxYDmm = currentBottomFaceY - openingDmm;
            minYDmm = maxYDmm - thicknessDmm;
          } else if (comp.elevationMm !== void 0) {
            minYDmm = toDeciMm(comp.elevationMm, `${comp.id}.elevationMm`);
            maxYDmm = minYDmm + thicknessDmm;
          } else if (comp.offsetFromBottomMm !== void 0) {
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
              WIDTH_EDGE_2: 0
            },
            sourceRuleIds: ["WR-003", "WR-008", "WR-013"]
          });
        } else if (comp.type.startsWith("HANGING_RAIL")) {
          const offsetBelowDmm = assertDeciMm(comp.offsetBelowShelfMm, `${comp.id}.offsetBelowShelfMm`);
          currentRailCenterY = currentBottomFaceY - offsetBelowDmm;
        } else if (comp.type === "SHELF_ADJUSTABLE") {
          let minYDmm;
          let maxYDmm;
          if (comp.clearDropAboveMm !== void 0 && currentRailCenterY !== null) {
            const dropDmm = toDeciMm(comp.clearDropAboveMm, `${comp.id}.clearDropAboveMm`);
            maxYDmm = currentRailCenterY - dropDmm;
            minYDmm = maxYDmm - thicknessDmm;
          } else if (comp.clearOpeningAboveMm !== void 0) {
            const openingDmm = toDeciMm(comp.clearOpeningAboveMm, `${comp.id}.clearOpeningAboveMm`);
            maxYDmm = currentBottomFaceY - openingDmm;
            minYDmm = maxYDmm - thicknessDmm;
          } else if (comp.elevationMm !== void 0) {
            minYDmm = toDeciMm(comp.elevationMm, `${comp.id}.elevationMm`);
            maxYDmm = minYDmm + thicknessDmm;
          } else if (comp.offsetFromBottomMm !== void 0) {
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
              WIDTH_EDGE_2: edgeFrontDmm
            },
            sourceRuleIds: ["WR-003", "WR-008", "WR-013"]
          });
        }
      }
    }
    fixedShelves.sort((a, b) => a.bayIndex - b.bayIndex || b.minYDmm - a.minYDmm);
    for (const s of fixedShelves) {
      parts.push(createPanel(s));
    }
    adjShelves.sort((a, b) => a.bayIndex - b.bayIndex || a.minYDmm - b.minYDmm);
    for (const s of adjShelves) {
      parts.push(createPanel(s));
    }
    const rootAllowanceMm = furniSpec.clearancePolicy?.backPanel?.grooveRootAllowanceMm ?? furniSpec.carcass?.grooveRootAllowanceMm;
    const rootAllowanceDmm = assertDeciMm(rootAllowanceMm, "clearancePolicy.backPanel.grooveRootAllowanceMm");
    const engagementDmm = grvDepthDmm - rootAllowanceDmm;
    const backPanelWDmm = internalCarcassWDmm + 2 * engagementDmm;
    const backPanelHDmm = internalCarcassHDmm + 2 * engagementDmm;
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
          WIDTH_EDGE_2: 0
        },
        sourceRuleIds: ["WR-003", "WR-004", "WR-005", "WR-006"]
      })
    );
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
            WIDTH_EDGE_2: edgeDoorDmm
          },
          sourceRuleIds: ["WR-003", "WR-007", "WR-008", "WR-013"]
        })
      );
      doorXCursorDmm = maxXDmm + revInterDmm;
    }
    const plinthWidthDmm = envWDmm - 2 * plinthSideInsetDmm;
    const zPlinthFrontMinDmm = zCarcassFrontDmm + plinthRecessDmm;
    const zPlinthFrontMaxDmm = zPlinthFrontMinDmm + panelTDmm;
    const zPlinthRearMaxDmm = zCarcassRearDmm;
    const zPlinthRearMinDmm = zPlinthRearMaxDmm - panelTDmm;
    const plinthSideLengthDmm = zPlinthRearMinDmm - zPlinthFrontMaxDmm;
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
          WIDTH_EDGE_2: edgeFrontDmm
        },
        sourceRuleIds: ["WR-005", "WR-006", "WR-007", "WR-013"]
      })
    );
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
          WIDTH_EDGE_2: 0
        },
        sourceRuleIds: ["WR-005", "WR-007"]
      })
    );
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
          WIDTH_EDGE_2: 0
        },
        sourceRuleIds: ["WR-005", "WR-006", "WR-007", "WR-013"]
      })
    );
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
          WIDTH_EDGE_2: 0
        },
        sourceRuleIds: ["WR-005", "WR-006", "WR-007", "WR-013"]
      })
    );
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
            WIDTH_EDGE_2: 0
          },
          sourceRuleIds: ["WR-005", "WR-007"]
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
              WIDTH_EDGE_2: 0
            },
            sourceRuleIds: ["WR-005", "WR-007"]
          })
        );
      });
    }
    const operations = [
      {
        id: "OP_GRV_SIDE_L",
        hostPartId: "CARC_SIDE_L",
        type: "BACK_GROOVE",
        face: "INNER",
        vector: [1, 0, 0],
        widthDmm: grvWidthDmm,
        depthDmm: grvDepthDmm,
        status: "APPROVED"
      },
      {
        id: "OP_GRV_SIDE_R",
        hostPartId: "CARC_SIDE_R",
        type: "BACK_GROOVE",
        face: "INNER",
        vector: [-1, 0, 0],
        widthDmm: grvWidthDmm,
        depthDmm: grvDepthDmm,
        status: "APPROVED"
      },
      {
        id: "OP_GRV_TOP",
        hostPartId: "CARC_TOP",
        type: "BACK_GROOVE",
        face: "LOWER",
        vector: [0, -1, 0],
        widthDmm: grvWidthDmm,
        depthDmm: grvDepthDmm,
        status: "APPROVED"
      },
      {
        id: "OP_GRV_BOT",
        hostPartId: "CARC_BOT",
        type: "BACK_GROOVE",
        face: "UPPER",
        vector: [0, 1, 0],
        widthDmm: grvWidthDmm,
        depthDmm: grvDepthDmm,
        status: "APPROVED"
      }
    ];
    const warnings = [];
    if (furniSpec.plinth.sideInsetStatus === "ASSUMPTION_PENDING_BEKZOD_APPROVAL") {
      warnings.push({
        code: "PLINTH_SIDE_INSET_ASSUMPTION",
        message: `Plinth side inset (${furniSpec.plinth.sideInsetMm}mm) is an assumption pending Bekzod workshop confirmation.`
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
          depthDmm: envDDmm
        }
      }
    };
  }

  // src/lib/partgraph/validatePartGraph.js
  function validatePartGraph(partGraph) {
    const errors = [];
    const addError = (code, message, partId = void 0) => {
      errors.push({ code, message, partId });
    };
    if (!partGraph || typeof partGraph !== "object") {
      return {
        valid: false,
        errors: [{ code: "INVALID_PARTGRAPH_TYPE", message: "PartGraph must be a non-null object." }]
      };
    }
    if (partGraph.partGraphVersion !== PARTGRAPH_VERSION) {
      addError("UNSUPPORTED_PARTGRAPH_VERSION", `Expected version "${PARTGRAPH_VERSION}", got "${partGraph.partGraphVersion}".`);
    }
    if (partGraph.unitScale !== "deci-mm") {
      addError("INVALID_UNIT_SCALE", `unitScale must be "deci-mm", got "${partGraph.unitScale}".`);
    }
    if (partGraph.qualificationStatus === "CNC_QUALIFIED") {
      addError("CNC_QUALIFIED_FORBIDDEN", "CNC qualification is forbidden in Phase 1 / Gate G2.");
    }
    const parts = partGraph.parts;
    if (!Array.isArray(parts) || parts.length === 0) {
      addError("EMPTY_PARTS_LIST", "PartGraph parts array must be non-empty.");
      return { valid: false, errors };
    }
    const seenPartIds = /* @__PURE__ */ new Set();
    for (const part of parts) {
      if (!part.id || typeof part.id !== "string") {
        addError("MISSING_PART_ID", "Part requires a string id.");
        continue;
      }
      if (seenPartIds.has(part.id)) {
        addError("DUPLICATE_PART_ID", `Duplicate Part ID "${part.id}".`, part.id);
      }
      seenPartIds.add(part.id);
      const fin = part.finished || {};
      ["lengthDmm", "widthDmm", "thicknessDmm"].forEach((dim) => {
        const val = fin[dim];
        if (typeof val !== "number" || !Number.isInteger(val) || val <= 0) {
          addError("INVALID_FINISHED_DIMENSION", `Part "${part.id}" finished.${dim} must be a strictly positive integer, got ${val}.`, part.id);
        }
      });
      const raw = part.raw || {};
      ["lengthDmm", "widthDmm", "thicknessDmm"].forEach((dim) => {
        const val = raw[dim];
        if (typeof val !== "number" || !Number.isInteger(val) || val <= 0) {
          addError("INVALID_RAW_DIMENSION", `Part "${part.id}" raw.${dim} must be a strictly positive integer, got ${val}.`, part.id);
        }
      });
      const edges = part.edges || {};
      const expectedRawLengthDmm = (fin.lengthDmm || 0) - ((edges.WIDTH_EDGE_1 || 0) + (edges.WIDTH_EDGE_2 || 0));
      const expectedRawWidthDmm = (fin.widthDmm || 0) - ((edges.LENGTH_EDGE_1 || 0) + (edges.LENGTH_EDGE_2 || 0));
      if (raw.lengthDmm !== expectedRawLengthDmm) {
        addError(
          "RAW_LENGTH_MISMATCH",
          `Part "${part.id}" raw length (${raw.lengthDmm}) != finished length (${fin.lengthDmm}) - edge banding (${edges.WIDTH_EDGE_1} + ${edges.WIDTH_EDGE_2}).`,
          part.id
        );
      }
      if (raw.widthDmm !== expectedRawWidthDmm) {
        addError(
          "RAW_WIDTH_MISMATCH",
          `Part "${part.id}" raw width (${raw.widthDmm}) != finished width (${fin.widthDmm}) - edge banding (${edges.LENGTH_EDGE_1} + ${edges.LENGTH_EDGE_2}).`,
          part.id
        );
      }
      const p = part.placement || {};
      ["minXDmm", "maxXDmm", "minYDmm", "maxYDmm", "minZDmm", "maxZDmm"].forEach((coord) => {
        const val = p[coord];
        if (typeof val !== "number" || !Number.isInteger(val) || val < 0) {
          addError("INVALID_PLACEMENT_COORDINATE", `Part "${part.id}" placement.${coord} must be a non-negative integer, got ${val}.`, part.id);
        }
      });
      const boxDeltaX = (p.maxXDmm || 0) - (p.minXDmm || 0);
      const boxDeltaY = (p.maxYDmm || 0) - (p.minYDmm || 0);
      const boxDeltaZ = (p.maxZDmm || 0) - (p.minZDmm || 0);
      if (part.orientation === ORIENTATIONS.HORIZONTAL_XZ) {
        const match1 = boxDeltaX === fin.lengthDmm && boxDeltaZ === fin.widthDmm;
        const match2 = boxDeltaX === fin.widthDmm && boxDeltaZ === fin.lengthDmm;
        if (!(match1 || match2) || boxDeltaY !== fin.thicknessDmm) {
          addError(
            "BOUNDING_BOX_MISMATCH",
            `Part "${part.id}" bounding box (${boxDeltaX}x${boxDeltaY}x${boxDeltaZ}) does not match finished dimensions (${fin.lengthDmm}x${fin.thicknessDmm}x${fin.widthDmm}) for HORIZONTAL_XZ.`,
            part.id
          );
        }
      } else if (part.orientation === ORIENTATIONS.VERTICAL_YZ) {
        const match1 = boxDeltaY === fin.lengthDmm && boxDeltaZ === fin.widthDmm;
        const match2 = boxDeltaY === fin.widthDmm && boxDeltaZ === fin.lengthDmm;
        if (!(match1 || match2) || boxDeltaX !== fin.thicknessDmm) {
          addError(
            "BOUNDING_BOX_MISMATCH",
            `Part "${part.id}" bounding box (${boxDeltaX}x${boxDeltaY}x${boxDeltaZ}) does not match finished dimensions (${fin.thicknessDmm}x${fin.lengthDmm}x${fin.widthDmm}) for VERTICAL_YZ.`,
            part.id
          );
        }
      } else if (part.orientation === ORIENTATIONS.VERTICAL_XY) {
        const match1 = boxDeltaY === fin.lengthDmm && boxDeltaX === fin.widthDmm;
        const match2 = boxDeltaY === fin.widthDmm && boxDeltaX === fin.lengthDmm;
        if (!(match1 || match2) || boxDeltaZ !== fin.thicknessDmm) {
          addError(
            "BOUNDING_BOX_MISMATCH",
            `Part "${part.id}" bounding box (${boxDeltaX}x${boxDeltaY}x${boxDeltaZ}) does not match finished dimensions (${fin.widthDmm}x${fin.lengthDmm}x${fin.thicknessDmm}) for VERTICAL_XY.`,
            part.id
          );
        }
      }
    }
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        const p1 = parts[i];
        const p2 = parts[j];
        const overlapX = Math.min(p1.placement.maxXDmm, p2.placement.maxXDmm) - Math.max(p1.placement.minXDmm, p2.placement.minXDmm);
        const overlapY = Math.min(p1.placement.maxYDmm, p2.placement.maxYDmm) - Math.max(p1.placement.minYDmm, p2.placement.minYDmm);
        const overlapZ = Math.min(p1.placement.maxZDmm, p2.placement.maxZDmm) - Math.max(p1.placement.minZDmm, p2.placement.minZDmm);
        if (overlapX > 0 && overlapY > 0 && overlapZ > 0) {
          const isBackPanelEngagement = p1.id === "BACK_PANEL_01" && ["CARC_TOP", "CARC_BOT", "CARC_SIDE_L", "CARC_SIDE_R"].includes(p2.id) || p2.id === "BACK_PANEL_01" && ["CARC_TOP", "CARC_BOT", "CARC_SIDE_L", "CARC_SIDE_R"].includes(p1.id);
          if (!isBackPanelEngagement) {
            addError(
              "UNINTENDED_PART_COLLISION",
              `Part "${p1.id}" and Part "${p2.id}" collide with overlap volume ${overlapX}x${overlapY}x${overlapZ} dmm.`,
              p1.id
            );
          }
        }
      }
    }
    const operations = partGraph.operations || [];
    for (const op of operations) {
      if (!seenPartIds.has(op.hostPartId)) {
        addError("INVALID_HOST_PART", `Operation "${op.id}" references non-existent hostPartId "${op.hostPartId}".`);
      }
    }
    return {
      valid: errors.length === 0,
      errors
    };
  }

  // src/lib/rules/wardrobeRuleCatalog.js
  var RULE_PROVENANCE = Object.freeze({
    RULEBOOK_V0_1: "RULEBOOK_V0_1",
    GOLDEN_FIXTURE_BEKZOD_APPROVED: "GOLDEN_FIXTURE_BEKZOD_APPROVED",
    REQUIRES_BEKZOD_RULING: "REQUIRES_BEKZOD_RULING"
  });
  function rule(id, value, provenance, note) {
    return Object.freeze({ id, value, provenance, note });
  }
  var { RULEBOOK_V0_1, GOLDEN_FIXTURE_BEKZOD_APPROVED, REQUIRES_BEKZOD_RULING } = RULE_PROVENANCE;
  var WARDROBE_RULES = Object.freeze({
    constructionStyle: rule("WR-001", "CAP_STYLE", RULEBOOK_V0_1, "Cap Style (Style B): top/bottom cap the outer sides and divider."),
    panelThicknessMm: rule("WR-003", 18, RULEBOOK_V0_1, "Carcass panels, shelves, divider, doors and plinth rails."),
    backThicknessMm: rule("WR-003", 6, RULEBOOK_V0_1, "Back panel core thickness."),
    grooveDepthMm: rule("WR-004", 7, RULEBOOK_V0_1, "Back groove machined into top, bottom and both outer sides."),
    grooveWidthMm: rule("WR-005", 7, RULEBOOK_V0_1, "6.0mm back panel + 1.0mm assembly glue gap."),
    grooveRootAllowanceMm: rule("WR-005", 1, RULEBOOK_V0_1, "Assembly glue gap component of the 7.0mm groove width."),
    grooveRearDatumMm: rule("WR-006", 20, RULEBOOK_V0_1, "Groove rear face measured from the carcass rear datum."),
    doorBumperGapMm: rule("RULEBOOK-S1-Z-ALLOCATION", 2, RULEBOOK_V0_1, "Door bumper / operating air gap, Z in [18.0, 20.0]."),
    doorRevealMm: rule("WR-008", 2, RULEBOOK_V0_1, "2.0mm perimeter reveals and 2.0mm gaps between doors."),
    plinthFrontRecessMm: rule("WR-007", 0, RULEBOOK_V0_1, "Frame-aligned plinth: front fascia sits at the carcass front datum, zero recess."),
    plinthSideInsetMm: rule("WR-007", 0, RULEBOOK_V0_1, "Frame-aligned plinth: side returns align with the carcass frame footprint."),
    hangingRailOffsetBelowShelfMm: rule("WR-012", 100, RULEBOOK_V0_1, "Rail centre 100.0mm below the underside of the fixed shelf."),
    edgeBandFrontVisibleMm: rule("WR-013", 1, RULEBOOK_V0_1, "Front visible edges receive 1.0mm PVC."),
    edgeBandRearUnbandedMm: rule("WR-013", 0, RULEBOOK_V0_1, "Non-visible edges receive 0.0mm."),
    edgeBandDoorPerimeterMm: rule("WR-013", 1, RULEBOOK_V0_1, "Door perimeter banding."),
    hingeType: rule("WR-010", "CONCEALED_110", RULEBOOK_V0_1, "110 degree soft-close concealed clip-on, semantic only."),
    hingeCountPerDoor: rule("WR-011", 5, RULEBOOK_V0_1, "Five hinges per door."),
    shelfPinPitchMm: rule("WR-009", 32, RULEBOOK_V0_1, "System 32 semantic grid; drilling coordinates blocked."),
    // --- Values present in the Bekzod-approved Golden Wardrobe fixture but not
    // --- stated as a numbered Rulebook rule. Approved, but by fixture not by rule.
    topCompartmentClearOpeningMm: rule("GF-TOP-OPENING", 350, GOLDEN_FIXTURE_BEKZOD_APPROVED, "Clear opening above the top fixed shelf."),
    shelfCompartmentClearOpeningMm: rule("GF-SHELF-OPENING", 350, GOLDEN_FIXTURE_BEKZOD_APPROVED, "Clear opening above an adjustable shelf."),
    longHangingTargetClearDropMm: rule("GF-HANG-LONG", 1400, GOLDEN_FIXTURE_BEKZOD_APPROVED, "Long hanging zone target clear drop."),
    shortHangingTargetClearDropMm: rule("GF-HANG-SHORT", 900, GOLDEN_FIXTURE_BEKZOD_APPROVED, "Short hanging zone target clear drop."),
    fixedShelfRearSetbackMm: rule("GF-SHELF-REAR", 20, GOLDEN_FIXTURE_BEKZOD_APPROVED, "Fixed shelf / divider depth = carcass depth - 20.0mm (WR-002 rear clearance)."),
    adjustableShelfSideClearanceMm: rule("GF-ADJ-SIDE", 1, GOLDEN_FIXTURE_BEKZOD_APPROVED, "Adjustable shelf side clearance per face."),
    adjustableShelfFrontSetbackMm: rule("GF-ADJ-FRONT", 5, GOLDEN_FIXTURE_BEKZOD_APPROVED, "Adjustable shelf front setback, applied symmetrically front and rear."),
    shelfPinType: rule("WR-009", "SYSTEM_32_PIN_5MM", RULEBOOK_V0_1, "System 32 5mm shelf pin, semantic only."),
    joineryType: rule("GF-JOINERY", "CONFIRMAT_AND_DOWEL", GOLDEN_FIXTURE_BEKZOD_APPROVED, "Carcass joinery family; drilling coordinates blocked."),
    hangingRailType: rule("GF-RAIL", "OVAL_TUBE_15X30", GOLDEN_FIXTURE_BEKZOD_APPROVED, "Hanging rail profile, preview only."),
    // --- NOT approved. Reading these through resolve() throws by design.
    bayCountForWidth: rule("UNRULED-BAY-COUNT", null, REQUIRES_BEKZOD_RULING, "No approved rule maps overall width to a bay count. Must be asked."),
    doorsPerBay: rule("UNRULED-DOORS-PER-BAY", null, REQUIRES_BEKZOD_RULING, "Golden, narrow and wide fixtures all use 2 doors per bay, but no Rulebook rule states it. Must be asked."),
    unevenBayWidthDistribution: rule("UNRULED-BAY-SPLIT", null, REQUIRES_BEKZOD_RULING, "No approved rule for distributing a non-integral bay-width remainder. Must be asked.")
  });
  var UnapprovedRuleError = class extends Error {
    constructor(key, ruleRecord) {
      super(
        `Rule "${key}" (${ruleRecord.id}) is ${RULE_PROVENANCE.REQUIRES_BEKZOD_RULING} and cannot be applied. ${ruleRecord.note}`
      );
      this.name = "UnapprovedRuleError";
      this.code = "UNAPPROVED_RULE_APPLICATION";
      this.ruleKey = key;
      this.ruleId = ruleRecord.id;
    }
  };
  function resolve(key) {
    const record = WARDROBE_RULES[key];
    if (!record) {
      throw new Error(`Unknown rule key "${key}".`);
    }
    if (record.provenance === RULE_PROVENANCE.REQUIRES_BEKZOD_RULING) {
      throw new UnapprovedRuleError(key, record);
    }
    return record.value;
  }
  function ruleIdOf(key) {
    const record = WARDROBE_RULES[key];
    if (!record) throw new Error(`Unknown rule key "${key}".`);
    return record.id;
  }

  // src/lib/rules/materialCatalog.js
  var MATERIAL_CATALOG = Object.freeze({
    melamine: Object.freeze({
      provenance: RULE_PROVENANCE.GOLDEN_FIXTURE_BEKZOD_APPROVED,
      sourceId: "GF-MATERIALS",
      carcass: Object.freeze({ code: "MEL_WHITE_18", name: "18mm White Melamine Particleboard", thicknessMm: 18 }),
      backPanel: Object.freeze({ code: "HDF_WHITE_6", name: "6mm White HDF Backer", thicknessMm: 6 }),
      fronts: Object.freeze({ code: "MEL_WHITE_18", name: "18mm White Melamine Particleboard", thicknessMm: 18 })
    })
  });
  function hasApprovedMaterials(finishType) {
    return Object.prototype.hasOwnProperty.call(MATERIAL_CATALOG, finishType);
  }
  function materialsFor(finishType) {
    if (!hasApprovedMaterials(finishType)) {
      const err = new Error(`No Bekzod-approved material record for finish "${finishType}".`);
      err.code = "UNAPPROVED_MATERIAL";
      throw err;
    }
    const entry = MATERIAL_CATALOG[finishType];
    return {
      carcass: { ...entry.carcass },
      backPanel: { ...entry.backPanel },
      fronts: { ...entry.fronts }
    };
  }

  // src/lib/conversation/intakeModel.js
  var OBSERVATION_ORIGIN = Object.freeze({
    /** The customer said it, in their own words. */
    CUSTOMER_STATED: "CUSTOMER_STATED",
    /** The customer confirmed a value put to them in a clarification question. */
    CUSTOMER_CONFIRMED: "CUSTOMER_CONFIRMED",
    /** Extracted or parsed from prompt chips, assistant suggestions, or conversation context. */
    EXTRACTED: "EXTRACTED",
    /** Supplied using Bekzod-approved Golden Wardrobe defaults for immediate draft preview. */
    DEFAULTED: "DEFAULTED",
    /** Derived by a closure equation from approved rules and stated values. */
    RULE_DERIVED: "RULE_DERIVED"
  });
  var BEKZOD_APPROVED_DEFAULTS = Object.freeze({
    "envelope.widthMm": 1800,
    "envelope.heightMm": 2400,
    "envelope.depthMm": 600,
    "plinth.heightMm": 100,
    bayCount: 2,
    doorCount: 4,
    finishType: "melamine",
    bayLayouts: Object.freeze(["LONG_HANGING", "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES"])
  });
  var GAP_KIND = Object.freeze({
    /** The fact was never supplied. */
    MISSING_REQUIRED_FACT: "MISSING_REQUIRED_FACT",
    /** Supplied, but hedged or imprecise ("about 2 metres"). */
    AMBIGUOUS_FACT: "AMBIGUOUS_FACT",
    /** Supplied, but internally inconsistent with another stated fact. */
    CONFLICTING_FACT: "CONFLICTING_FACT",
    /** Would require applying a rule that has no Bekzod ruling. */
    UNRULED_DERIVATION: "UNRULED_DERIVATION",
    /** Requested, but outside the first manufacturing slice. */
    OUT_OF_SLICE: "OUT_OF_SLICE"
  });
  var GAP_SEVERITY = Object.freeze({
    /** The kernel must refuse the spec while this gap stands. */
    BLOCKING: "BLOCKING",
    /** Worth asking, but does not stop assembly. */
    ADVISORY: "ADVISORY"
  });
  var BAY_LAYOUT = Object.freeze({
    LONG_HANGING: "LONG_HANGING",
    SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES: "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES"
  });
  var SUPPORTED_FINISHES = Object.freeze(["melamine"]);
  var REQUIRED_INTAKE_FACTS = Object.freeze([
    Object.freeze({ key: "envelope.widthMm", label: "overall width", unit: "mm", derivable: false }),
    Object.freeze({ key: "envelope.heightMm", label: "overall height", unit: "mm", derivable: false }),
    Object.freeze({ key: "envelope.depthMm", label: "overall depth", unit: "mm", derivable: false }),
    Object.freeze({ key: "plinth.heightMm", label: "plinth height", unit: "mm", derivable: false }),
    Object.freeze({ key: "bayCount", label: "number of bays", unit: "count", derivable: false }),
    Object.freeze({ key: "doorCount", label: "number of hinged doors", unit: "count", derivable: false }),
    Object.freeze({ key: "finishType", label: "finish", unit: "enum", derivable: false }),
    Object.freeze({ key: "bayLayouts", label: "interior layout of each bay", unit: "enum[]", derivable: false })
  ]);
  var REQUIRED_INTAKE_KEYS = Object.freeze(REQUIRED_INTAKE_FACTS.map((f) => f.key));
  function observation(key, value, origin, meta = {}) {
    if (!Object.values(OBSERVATION_ORIGIN).includes(origin)) {
      throw new Error(`Unknown observation origin "${origin}".`);
    }
    return Object.freeze({
      key,
      value,
      origin,
      sourceText: meta.sourceText ?? null,
      sourceSpan: meta.sourceSpan ? Object.freeze([...meta.sourceSpan]) : null,
      ruleIds: Object.freeze([...meta.ruleIds ?? []])
    });
  }
  function gap(key, kind, severity, meta = {}) {
    if (!Object.values(GAP_KIND).includes(kind)) throw new Error(`Unknown gap kind "${kind}".`);
    if (!Object.values(GAP_SEVERITY).includes(severity)) throw new Error(`Unknown gap severity "${severity}".`);
    return Object.freeze({
      key,
      kind,
      severity,
      detail: meta.detail ?? "",
      sourceText: meta.sourceText ?? null,
      /** A value put to the customer for confirmation. Never applied on its own. */
      proposal: meta.proposal ?? null,
      proposalBasis: meta.proposalBasis ?? null
    });
  }
  function sortGaps(gaps) {
    const order = new Map(REQUIRED_INTAKE_KEYS.map((k, i) => [k, i]));
    return [...gaps].sort((a, b) => {
      const ai = order.has(a.key) ? order.get(a.key) : REQUIRED_INTAKE_KEYS.length;
      const bi = order.has(b.key) ? order.get(b.key) : REQUIRED_INTAKE_KEYS.length;
      if (ai !== bi) return ai - bi;
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    });
  }

  // src/lib/conversation/assembleFurniSpec.js
  var AssemblyBlockedError = class extends Error {
    constructor(gaps) {
      super(`FurniSpec assembly refused: ${gaps.length} blocking clarification gap(s) unresolved.`);
      this.name = "AssemblyBlockedError";
      this.code = "ASSEMBLY_BLOCKED_BY_CLARIFICATION";
      this.gaps = gaps;
    }
  };
  var ClosureError = class extends Error {
    constructor(message, path) {
      super(message);
      this.name = "ClosureError";
      this.code = "DERIVATION_DOES_NOT_CLOSE";
      this.path = path;
    }
  };
  function pad2(n) {
    return String(n).padStart(2, "0");
  }
  function assembleFurniSpec({ facts, gaps = [], specId, revision, status }) {
    const blocking = gaps.filter((g) => g.severity === GAP_SEVERITY.BLOCKING);
    if (blocking.length > 0) throw new AssemblyBlockedError(blocking);
    if (typeof specId !== "string" || specId.trim() === "") throw new Error("assembleFurniSpec requires an explicit specId.");
    if (!Number.isInteger(revision) || revision < 1) throw new Error("assembleFurniSpec requires an explicit integer revision >= 1.");
    if (status !== SPEC_STATUS.PROPOSED && status !== SPEC_STATUS.APPROVED) {
      throw new Error(`assembleFurniSpec requires an explicit status of PROPOSED or APPROVED, got "${status}".`);
    }
    const derivations = [];
    const record = (path, valueDmm, ruleKeys, formula) => {
      derivations.push({
        path,
        value: fromDeciMm(valueDmm),
        ruleIds: ruleKeys.map(ruleIdOf),
        formula
      });
      return fromDeciMm(valueDmm);
    };
    const envWDmm = toDeciMm(facts["envelope.widthMm"], "envelope.widthMm");
    const envHDmm = toDeciMm(facts["envelope.heightMm"], "envelope.heightMm");
    const envDDmm = toDeciMm(facts["envelope.depthMm"], "envelope.depthMm");
    const plinthHDmm = toDeciMm(facts["plinth.heightMm"], "plinth.heightMm");
    const bayCount = facts.bayCount;
    const doorCount = facts.doorCount;
    const finishType = facts.finishType;
    const bayLayouts = facts.bayLayouts;
    if (!Number.isInteger(bayCount) || bayCount < 1) throw new Error("bayCount must be a positive integer.");
    if (!Number.isInteger(doorCount) || doorCount < 1) throw new Error("doorCount must be a positive integer.");
    if (!Array.isArray(bayLayouts) || bayLayouts.length !== bayCount) {
      throw new Error("bayLayouts must contain exactly one layout per bay.");
    }
    const panelTDmm = toDeciMm(resolve("panelThicknessMm"), "panelThicknessMm");
    const backTDmm = toDeciMm(resolve("backThicknessMm"), "backThicknessMm");
    const bumperDmm = toDeciMm(resolve("doorBumperGapMm"), "doorBumperGapMm");
    const revealDmm = toDeciMm(resolve("doorRevealMm"), "doorRevealMm");
    const railOffsetDmm = toDeciMm(resolve("hangingRailOffsetBelowShelfMm"), "hangingRailOffsetBelowShelfMm");
    const topOpeningDmm = toDeciMm(resolve("topCompartmentClearOpeningMm"), "topCompartmentClearOpeningMm");
    const shelfOpeningDmm = toDeciMm(resolve("shelfCompartmentClearOpeningMm"), "shelfCompartmentClearOpeningMm");
    const longDropDmm = toDeciMm(resolve("longHangingTargetClearDropMm"), "longHangingTargetClearDropMm");
    const shortDropDmm = toDeciMm(resolve("shortHangingTargetClearDropMm"), "shortHangingTargetClearDropMm");
    const shelfRearSetbackDmm = toDeciMm(resolve("fixedShelfRearSetbackMm"), "fixedShelfRearSetbackMm");
    const adjFrontSetbackDmm = toDeciMm(resolve("adjustableShelfFrontSetbackMm"), "adjustableShelfFrontSetbackMm");
    const carcassHDmm = envHDmm - plinthHDmm;
    const carcassHeightMm = record("carcass.heightMm", carcassHDmm, [], "envelope.heightMm - plinth.heightMm");
    const carcassDDmm = envDDmm - panelTDmm - bumperDmm;
    const carcassDepthMm = record(
      "carcass.depthMm",
      carcassDDmm,
      ["panelThicknessMm", "doorBumperGapMm"],
      "envelope.depthMm - doorThickness(WR-003) - bumperGap"
    );
    const internalWidthDmm = envWDmm - (bayCount + 1) * panelTDmm;
    if (internalWidthDmm <= 0 || internalWidthDmm % bayCount !== 0) {
      throw new ClosureError(
        `Bay clear width does not close exactly: ${internalWidthDmm / 10}mm over ${bayCount} bays.`,
        "bays[].clearWidthMm"
      );
    }
    const bayClearWDmm = internalWidthDmm / bayCount;
    const bayClearWidthMm = record(
      "bays[].clearWidthMm",
      bayClearWDmm,
      ["panelThicknessMm"],
      "(envelope.widthMm - (bayCount + 1) * panelThickness(WR-003)) / bayCount"
    );
    const doorZoneDmm = envWDmm - 2 * revealDmm - (doorCount - 1) * revealDmm;
    if (doorZoneDmm <= 0 || doorZoneDmm % doorCount !== 0) {
      throw new ClosureError(
        `Door finished width does not close exactly: ${doorZoneDmm / 10}mm over ${doorCount} doors.`,
        "doors.finishedWidthMm"
      );
    }
    const doorWDmm = doorZoneDmm / doorCount;
    const doorFinishedWidthMm = record(
      "doors.finishedWidthMm",
      doorWDmm,
      ["doorRevealMm"],
      "(envelope.widthMm - 2*reveal(WR-008) - (doorCount-1)*reveal(WR-008)) / doorCount"
    );
    const doorHDmm = carcassHDmm - 2 * revealDmm;
    if (doorHDmm <= 0) throw new ClosureError("Door finished height does not close.", "doors.finishedHeightMm");
    const doorFinishedHeightMm = record(
      "doors.finishedHeightMm",
      doorHDmm,
      ["doorRevealMm"],
      "carcass.heightMm - topReveal(WR-008) - bottomReveal(WR-008)"
    );
    const fixedShelfDDmm = carcassDDmm - shelfRearSetbackDmm;
    const fixedShelfDepthMm = record(
      "component.fixedShelf.depthMm",
      fixedShelfDDmm,
      ["fixedShelfRearSetbackMm"],
      "carcass.depthMm - fixedShelfRearSetback"
    );
    const adjShelfDDmm = fixedShelfDDmm - 2 * adjFrontSetbackDmm;
    const adjShelfDepthMm = record(
      "component.adjustableShelf.depthMm",
      adjShelfDDmm,
      ["fixedShelfRearSetbackMm", "adjustableShelfFrontSetbackMm"],
      "fixedShelfDepth - 2 * adjustableShelfFrontSetback"
    );
    const bays = bayLayouts.map((layout, index) => {
      const nn = pad2(index + 1);
      const components = [];
      components.push({
        id: `shelf-fix-b${nn}`,
        type: "SHELF_FIXED",
        clearOpeningAboveMm: fromDeciMm(topOpeningDmm),
        thicknessMm: fromDeciMm(panelTDmm),
        depthMm: fixedShelfDepthMm
      });
      if (layout === BAY_LAYOUT.LONG_HANGING) {
        components.push({
          id: `rail-long-b${nn}`,
          type: "HANGING_RAIL_LONG",
          offsetBelowShelfMm: fromDeciMm(railOffsetDmm),
          targetClearDropMm: fromDeciMm(longDropDmm)
        });
      } else if (layout === BAY_LAYOUT.SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES) {
        components.push({
          id: `rail-short-b${nn}`,
          type: "HANGING_RAIL_SHORT",
          offsetBelowShelfMm: fromDeciMm(railOffsetDmm),
          targetClearDropMm: fromDeciMm(shortDropDmm)
        });
        components.push({
          id: `shelf-adj-b${nn}-1`,
          type: "SHELF_ADJUSTABLE",
          clearDropAboveMm: fromDeciMm(shortDropDmm),
          thicknessMm: fromDeciMm(panelTDmm),
          depthMm: adjShelfDepthMm
        });
        components.push({
          id: `shelf-adj-b${nn}-2`,
          type: "SHELF_ADJUSTABLE",
          clearOpeningAboveMm: fromDeciMm(shelfOpeningDmm),
          thicknessMm: fromDeciMm(panelTDmm),
          depthMm: adjShelfDepthMm
        });
      } else {
        throw new Error(`Unsupported bay layout "${layout}".`);
      }
      return { id: `bay-${nn}`, index, clearWidthMm: bayClearWidthMm, components };
    });
    const materials = materialsFor(finishType);
    const spec = {
      schemaVersion: FURNISPEC_SCHEMA_VERSION,
      specId,
      revision,
      unit: "mm",
      furnitureType: "wardrobe",
      wardrobeType: "straight_hinged",
      constructionStyle: resolve("constructionStyle"),
      finishType,
      status,
      // Hard safety invariants. Not parameters.
      qualificationStatus: QUALIFICATION_STATUS.WORKSHOP_REVIEW_NOT_CNC_QUALIFIED,
      envelope: {
        widthMm: fromDeciMm(envWDmm),
        heightMm: fromDeciMm(envHDmm),
        depthMm: fromDeciMm(envDDmm)
      },
      plinth: {
        heightMm: fromDeciMm(plinthHDmm),
        frontRecessMm: resolve("plinthFrontRecessMm"),
        sideInsetMm: resolve("plinthSideInsetMm"),
        sideInsetStatus: SIDE_INSET_STATUS.BEKZOD_APPROVED
      },
      carcass: {
        heightMm: carcassHeightMm,
        depthMm: carcassDepthMm,
        panelThicknessMm: fromDeciMm(panelTDmm),
        backThicknessMm: fromDeciMm(backTDmm),
        grooveWidthMm: resolve("grooveWidthMm"),
        grooveDepthMm: resolve("grooveDepthMm"),
        grooveRearDatumMm: resolve("grooveRearDatumMm")
      },
      bays,
      doors: {
        count: doorCount,
        thicknessMm: fromDeciMm(panelTDmm),
        bumperGapMm: fromDeciMm(bumperDmm),
        finishedWidthMm: doorFinishedWidthMm,
        finishedHeightMm: doorFinishedHeightMm,
        reveals: {
          topMm: fromDeciMm(revealDmm),
          bottomMm: fromDeciMm(revealDmm),
          leftMm: fromDeciMm(revealDmm),
          rightMm: fromDeciMm(revealDmm),
          interDoorMm: fromDeciMm(revealDmm)
        }
      },
      materials,
      edgeBanding: {
        frontVisibleMm: resolve("edgeBandFrontVisibleMm"),
        rearUnbandedMm: resolve("edgeBandRearUnbandedMm"),
        doorPerimeterMm: resolve("edgeBandDoorPerimeterMm")
      },
      clearancePolicy: {
        adjustableShelf: {
          sideClearanceMm: resolve("adjustableShelfSideClearanceMm"),
          frontSetbackMm: resolve("adjustableShelfFrontSetbackMm")
        },
        backPanel: {
          grooveRootAllowanceMm: resolve("grooveRootAllowanceMm")
        }
      },
      hardware: {
        hinges: {
          type: resolve("hingeType"),
          countPerDoor: resolve("hingeCountPerDoor"),
          totalCount: resolve("hingeCountPerDoor") * doorCount,
          status: HARDWARE_APPROVAL_STATUS.BLOCKED_PENDING_HARDWARE_APPROVAL,
          note: "HARDWARE_SKU_PENDING_BEKZOD_CONFIRMATION"
        },
        shelfPins: {
          type: resolve("shelfPinType"),
          pitchMm: resolve("shelfPinPitchMm"),
          status: HARDWARE_APPROVAL_STATUS.BLOCKED_PENDING_HARDWARE_APPROVAL
        },
        joinery: {
          type: resolve("joineryType"),
          status: HARDWARE_APPROVAL_STATUS.BLOCKED_PENDING_HARDWARE_APPROVAL
        },
        hangingRails: {
          type: resolve("hangingRailType"),
          status: HARDWARE_APPROVAL_STATUS.PREVIEW_ONLY
        }
      },
      machiningPolicy: {
        backGroove: MACHINING_POLICY.APPROVED,
        // Hard-wired. No caller can approve drilling from this path.
        drilling: MACHINING_POLICY.BLOCKED_PENDING_HARDWARE_APPROVAL
      }
    };
    return { spec, derivations };
  }

  // src/lib/furnispec/normalize.js
  function normalizeValue(val, path = "root") {
    if (val === null || val === void 0) {
      return val;
    }
    if (typeof val === "number") {
      if (!Number.isFinite(val)) return val;
      const dmm = toDeciMm(val, path);
      return fromDeciMm(dmm);
    }
    if (Array.isArray(val)) {
      return val.map((item, idx) => normalizeValue(item, `${path}[${idx}]`));
    }
    if (typeof val === "object") {
      const sortedKeys = Object.keys(val).sort();
      const result = {};
      for (const key of sortedKeys) {
        result[key] = normalizeValue(val[key], `${path}.${key}`);
      }
      return result;
    }
    return val;
  }
  function normalizeFurniSpec(spec) {
    return normalizeValue(spec, "spec");
  }
  function serializeCanonicalJson(spec) {
    const normalized = normalizeFurniSpec(spec);
    return JSON.stringify(normalized, null, 2);
  }

  // src/lib/conversation/fingerprint.js
  var K = Object.freeze([
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298
  ]);
  var rotr = (x, n) => (x >>> n | x << 32 - n) >>> 0;
  function sha256Hex(message) {
    if (typeof message !== "string") throw new TypeError("sha256Hex expects a string.");
    const input = new TextEncoder().encode(message);
    const bitLength = input.length * 8;
    const paddedLength = input.length + 72 >> 6 << 6;
    const buffer = new Uint8Array(paddedLength);
    buffer.set(input);
    buffer[input.length] = 128;
    const view = new DataView(buffer.buffer);
    view.setUint32(paddedLength - 8, Math.floor(bitLength / 4294967296), false);
    view.setUint32(paddedLength - 4, bitLength >>> 0, false);
    let h0 = 1779033703, h1 = 3144134277, h2 = 1013904242, h3 = 2773480762;
    let h4 = 1359893119, h5 = 2600822924, h6 = 528734635, h7 = 1541459225;
    const w = new Uint32Array(64);
    for (let offset = 0; offset < paddedLength; offset += 64) {
      for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4, false);
      for (let i = 16; i < 64; i += 1) {
        const s0 = (rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ w[i - 15] >>> 3) >>> 0;
        const s1 = (rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ w[i - 2] >>> 10) >>> 0;
        w[i] = w[i - 16] + s0 + w[i - 7] + s1 >>> 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let i = 0; i < 64; i += 1) {
        const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
        const ch = (e & f ^ ~e & g) >>> 0;
        const temp1 = h + S1 + ch + K[i] + w[i] >>> 0;
        const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
        const maj = (a & b ^ a & c ^ b & c) >>> 0;
        const temp2 = S0 + maj >>> 0;
        h = g;
        g = f;
        f = e;
        e = d + temp1 >>> 0;
        d = c;
        c = b;
        b = a;
        a = temp1 + temp2 >>> 0;
      }
      h0 = h0 + a >>> 0;
      h1 = h1 + b >>> 0;
      h2 = h2 + c >>> 0;
      h3 = h3 + d >>> 0;
      h4 = h4 + e >>> 0;
      h5 = h5 + f >>> 0;
      h6 = h6 + g >>> 0;
      h7 = h7 + h >>> 0;
    }
    return [h0, h1, h2, h3, h4, h5, h6, h7].map((x) => x.toString(16).padStart(8, "0")).join("");
  }
  var FINGERPRINT_ALGORITHM = "fs256:sha256(serializeCanonicalJson(furnispec))";
  var FINGERPRINT_PREFIX = "fs256:";

  // src/lib/conversation/approval.js
  var APPROVAL_ERROR = Object.freeze({
    MISSING_PROPOSAL: "MISSING_PROPOSAL",
    INVALID_PROPOSAL: "INVALID_PROPOSAL",
    MISSING_APPROVAL: "MISSING_APPROVAL",
    INVALID_APPROVAL_TYPE: "INVALID_APPROVAL_TYPE",
    MISSING_APPROVED_BY: "MISSING_APPROVED_BY",
    BLANK_APPROVED_BY: "BLANK_APPROVED_BY",
    MISSING_PROPOSAL_ID: "MISSING_PROPOSAL_ID",
    PROPOSAL_ID_MISMATCH: "PROPOSAL_ID_MISMATCH",
    MISSING_PROPOSAL_REVISION: "MISSING_PROPOSAL_REVISION",
    PROPOSAL_REVISION_MISMATCH: "PROPOSAL_REVISION_MISMATCH",
    MISSING_PROPOSAL_FINGERPRINT: "MISSING_PROPOSAL_FINGERPRINT",
    MALFORMED_PROPOSAL_FINGERPRINT: "MALFORMED_PROPOSAL_FINGERPRINT",
    PROPOSAL_FINGERPRINT_MISMATCH: "PROPOSAL_FINGERPRINT_MISMATCH",
    PROPOSAL_TAMPERED_SINCE_ISSUE: "PROPOSAL_TAMPERED_SINCE_ISSUE"
  });
  function fingerprintFurniSpec(spec) {
    if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
      throw new TypeError("fingerprintFurniSpec expects a FurniSpec object.");
    }
    return FINGERPRINT_PREFIX + sha256Hex(serializeCanonicalJson(spec));
  }
  function createProposal(spec) {
    const fingerprint = fingerprintFurniSpec(spec);
    return Object.freeze({
      specId: spec.specId,
      revision: spec.revision,
      status: spec.status,
      fingerprint,
      fingerprintAlgorithm: FINGERPRINT_ALGORITHM,
      spec
    });
  }

  // src/lib/conversation/gapAnalysis.js
  function analyseGaps(interpretation) {
    const observations = interpretation?.observations ?? [];
    const ambiguities = interpretation?.ambiguities ?? [];
    const values = /* @__PURE__ */ new Map();
    for (const obs of observations) values.set(obs.key, obs.value);
    const gaps = [...ambiguities];
    const alreadyFlagged = new Set(ambiguities.map((a) => a.key));
    const has = (key) => values.has(key) && !alreadyFlagged.has(key);
    const get = (key) => values.get(key);
    for (const fact of REQUIRED_INTAKE_FACTS) {
      if (has(fact.key) || alreadyFlagged.has(fact.key)) continue;
      let proposal = null;
      let proposalBasis = null;
      let detail = `No ${fact.label} was supplied and no approved rule can supply it.`;
      if (fact.key === "bayCount") {
        detail = `No ${fact.label} was supplied. ${WARDROBE_RULES.bayCountForWidth.note} It cannot be inferred from the overall width.`;
        proposalBasis = WARDROBE_RULES.bayCountForWidth.id;
      } else if (fact.key === "doorCount" && has("bayCount")) {
        proposal = get("bayCount") * 2;
        proposalBasis = WARDROBE_RULES.doorsPerBay.id;
        detail = `No ${fact.label} was supplied. ${WARDROBE_RULES.doorsPerBay.note} Two doors per bay is offered for confirmation only.`;
      } else if (fact.key === "bayLayouts" && has("bayCount")) {
        detail = `The interior layout of each of the ${get("bayCount")} bays was not described.`;
      }
      gaps.push(gap(fact.key, GAP_KIND.MISSING_REQUIRED_FACT, GAP_SEVERITY.BLOCKING, { detail, proposal, proposalBasis }));
    }
    if (has("finishType") && !SUPPORTED_FINISHES.includes(get("finishType"))) {
      gaps.push(
        gap("finishType", GAP_KIND.OUT_OF_SLICE, GAP_SEVERITY.BLOCKING, {
          detail: `Finish "${get("finishType")}" has no Bekzod-approved material record in the first slice. Approved finishes: ${SUPPORTED_FINISHES.join(", ")}.`
        })
      );
    }
    if (has("bayCount") && has("bayLayouts")) {
      const layouts = get("bayLayouts");
      if (!Array.isArray(layouts) || layouts.length !== get("bayCount")) {
        gaps.push(
          gap("bayLayouts", GAP_KIND.CONFLICTING_FACT, GAP_SEVERITY.BLOCKING, {
            detail: `${get("bayCount")} bays were requested but ${Array.isArray(layouts) ? layouts.length : 0} interior layout(s) were described. Each bay needs its own layout.`
          })
        );
      }
    }
    if (has("envelope.widthMm") && has("bayCount")) {
      const panelTDmm = toDeciMm(resolve("panelThicknessMm"), "panelThicknessMm");
      const widthDmm = toDeciMm(get("envelope.widthMm"), "envelope.widthMm");
      const bays = get("bayCount");
      const internalDmm = widthDmm - (bays + 1) * panelTDmm;
      if (internalDmm <= 0) {
        gaps.push(
          gap("bayCount", GAP_KIND.CONFLICTING_FACT, GAP_SEVERITY.BLOCKING, {
            detail: `${bays} bays need ${(bays + 1) * panelTDmm / 10}mm of ${resolve("panelThicknessMm")}mm panel (rule ${ruleIdOf("panelThicknessMm")}), which does not fit inside an overall width of ${get("envelope.widthMm")}mm.`
          })
        );
      } else if (internalDmm % bays !== 0) {
        gaps.push(
          gap("bayCount", GAP_KIND.UNRULED_DERIVATION, GAP_SEVERITY.BLOCKING, {
            detail: `${internalDmm / 10}mm of clear width does not divide evenly into ${bays} bays. ${WARDROBE_RULES.unevenBayWidthDistribution.note}`,
            proposalBasis: WARDROBE_RULES.unevenBayWidthDistribution.id
          })
        );
      }
    }
    if (has("envelope.heightMm") && has("plinth.heightMm")) {
      const panelTDmm = toDeciMm(resolve("panelThicknessMm"), "panelThicknessMm");
      const carcassDmm = toDeciMm(get("envelope.heightMm"), "envelope.heightMm") - toDeciMm(get("plinth.heightMm"), "plinth.heightMm");
      if (carcassDmm <= 2 * panelTDmm) {
        gaps.push(
          gap("plinth.heightMm", GAP_KIND.CONFLICTING_FACT, GAP_SEVERITY.BLOCKING, {
            detail: `A ${get("plinth.heightMm")}mm plinth leaves ${carcassDmm / 10}mm of carcass inside a ${get("envelope.heightMm")}mm envelope, which cannot contain the top and bottom panels.`
          })
        );
      }
    }
    if (has("envelope.depthMm")) {
      const doorTDmm = toDeciMm(resolve("panelThicknessMm"), "doorThicknessMm");
      const bumperDmm = toDeciMm(resolve("doorBumperGapMm"), "doorBumperGapMm");
      const carcassDDmm = toDeciMm(get("envelope.depthMm"), "envelope.depthMm") - doorTDmm - bumperDmm;
      if (carcassDDmm <= 0) {
        gaps.push(
          gap("envelope.depthMm", GAP_KIND.CONFLICTING_FACT, GAP_SEVERITY.BLOCKING, {
            detail: `An overall depth of ${get("envelope.depthMm")}mm leaves no carcass once the ${resolve("panelThicknessMm")}mm door (${ruleIdOf("panelThicknessMm")}) and ${resolve("doorBumperGapMm")}mm bumper gap (${ruleIdOf("doorBumperGapMm")}) are removed.`
          })
        );
      }
    }
    if (has("envelope.widthMm") && has("doorCount")) {
      const revealDmm = toDeciMm(resolve("doorRevealMm"), "doorRevealMm");
      const count = get("doorCount");
      const widthDmm = toDeciMm(get("envelope.widthMm"), "envelope.widthMm");
      const availableDmm = widthDmm - 2 * revealDmm - (count - 1) * revealDmm;
      if (availableDmm <= 0) {
        gaps.push(
          gap("doorCount", GAP_KIND.CONFLICTING_FACT, GAP_SEVERITY.BLOCKING, {
            detail: `${count} doors and their ${resolve("doorRevealMm")}mm reveals (${ruleIdOf("doorRevealMm")}) exceed the ${get("envelope.widthMm")}mm overall width.`
          })
        );
      } else if (availableDmm % count !== 0) {
        gaps.push(
          gap("doorCount", GAP_KIND.UNRULED_DERIVATION, GAP_SEVERITY.BLOCKING, {
            detail: `${availableDmm / 10}mm of door width does not divide evenly into ${count} doors. No approved rule distributes the remainder.`,
            proposalBasis: WARDROBE_RULES.unevenBayWidthDistribution.id
          })
        );
      }
    }
    return sortGaps(gaps);
  }

  // src/lib/conversation/interpretDescription.js
  var INTERPRETER_ID = "deterministic-phrase-interpreter/0.1";
  var NUMBER_WORDS = Object.freeze({
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10
  });
  var HEDGE = "(?:about|around|roughly|approximately|approx\\.?|circa|~|some ?where around|or so|ish)";
  var UNIT_TO_MM = Object.freeze({ mm: 1, millimetre: 1, millimeter: 1, cm: 10, centimetre: 10, centimeter: 10, m: 1e3, metre: 1e3, meter: 1e3 });
  var DIMENSION_ROLES = Object.freeze([
    { key: "envelope.widthMm", words: "(?:wide|width|across)" },
    { key: "envelope.heightMm", words: "(?:high|tall|height)" },
    { key: "envelope.depthMm", words: "(?:deep|depth)" }
  ]);
  var OUT_OF_SLICE_TERMS = Object.freeze([
    { pattern: /\bsliding\b/i, detail: "Sliding-door manufacturing is deferred; the first slice builds straight hinged wardrobes only." },
    { pattern: /\bcorner wardrobe\b|\bl-shaped\b/i, detail: "Corner wardrobes are deferred." },
    { pattern: /\bcurved\b/i, detail: "Curved and freeform carcasses are deferred." },
    { pattern: /\bkitchen\b/i, detail: "Kitchens are not yet a manufacturing product." },
    { pattern: /\bwalk[- ]?in\b/i, detail: "Walk-in configurations are outside the first manufacturing slice." }
  ]);
  function parseCount(token) {
    const lower = token.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, lower)) return NUMBER_WORDS[lower];
    const n = Number(lower);
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  function toExactMm(magnitude, unitToken) {
    const unitKey = (unitToken || "mm").toLowerCase().replace(/s$/, "").replace(/\./g, "");
    const factor = UNIT_TO_MM[unitKey];
    if (factor === void 0) return null;
    try {
      return fromDeciMm(toDeciMm(Number(magnitude) * factor, "dimension"));
    } catch {
      return null;
    }
  }
  function interpretDescription(description) {
    if (typeof description !== "string") {
      throw new TypeError("interpretDescription expects a string description.");
    }
    const text = description;
    const observations = [];
    const ambiguities = [];
    const seen = /* @__PURE__ */ new Set();
    const push = (key, value, meta) => {
      if (seen.has(key)) return;
      seen.add(key);
      observations.push(observation(key, value, OBSERVATION_ORIGIN.CUSTOMER_STATED, meta));
    };
    for (const role of DIMENSION_ROLES) {
      const re = new RegExp(
        `(${HEDGE}\\s+)?(\\d+(?:\\.\\d+)?)\\s*(mm|cm|m|millimetres?|millimeters?|centimetres?|centimeters?|metres?|meters?)?\\s*(?:\\w+\\s+){0,2}?${role.words}`,
        "i"
      );
      const m = re.exec(text);
      if (!m) continue;
      const sourceText = m[0].trim();
      const span = [m.index, m.index + m[0].length];
      if (m[1]) {
        ambiguities.push(
          gap(role.key, GAP_KIND.AMBIGUOUS_FACT, GAP_SEVERITY.BLOCKING, {
            detail: `"${sourceText}" is hedged. A manufacturing dimension must be exact.`,
            sourceText
          })
        );
        seen.add(role.key);
        continue;
      }
      const mm = toExactMm(m[2], m[3]);
      if (mm === null) {
        ambiguities.push(
          gap(role.key, GAP_KIND.AMBIGUOUS_FACT, GAP_SEVERITY.BLOCKING, {
            detail: `"${sourceText}" cannot be represented exactly at 0.1mm precision. Silent rounding is forbidden.`,
            sourceText
          })
        );
        seen.add(role.key);
        continue;
      }
      push(role.key, mm, { sourceText, sourceSpan: span });
    }
    const plinthRe = new RegExp(
      `(?:(${HEDGE})\\s+)?(?:(\\d+(?:\\.\\d+)?)\\s*(mm|cm|m)?\\s*(?:high\\s+)?plinth|plinth\\s+(?:of\\s+|at\\s+)?(\\d+(?:\\.\\d+)?)\\s*(mm|cm|m)?)`,
      "i"
    );
    const pm = plinthRe.exec(text);
    if (pm) {
      const sourceText = pm[0].trim();
      if (pm[1]) {
        ambiguities.push(
          gap("plinth.heightMm", GAP_KIND.AMBIGUOUS_FACT, GAP_SEVERITY.BLOCKING, {
            detail: `"${sourceText}" is hedged. Plinth height sets the carcass height and must be exact.`,
            sourceText
          })
        );
        seen.add("plinth.heightMm");
      } else {
        const mm = toExactMm(pm[2] ?? pm[4], pm[3] ?? pm[5]);
        if (mm !== null) push("plinth.heightMm", mm, { sourceText, sourceSpan: [pm.index, pm.index + pm[0].length] });
      }
    }
    const bayRe = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:equal\s+|separate\s+)?bays?\b/i;
    const bm = bayRe.exec(text);
    if (bm) {
      const n = parseCount(bm[1]);
      if (n !== null) push("bayCount", n, { sourceText: bm[0].trim(), sourceSpan: [bm.index, bm.index + bm[0].length] });
    }
    const doorRe = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:\w+\s+){0,2}?doors?\b/i;
    const dm = doorRe.exec(text);
    if (dm) {
      const n = parseCount(dm[1]);
      if (n !== null) push("doorCount", n, { sourceText: dm[0].trim(), sourceSpan: [dm.index, dm.index + dm[0].length] });
    }
    const finishRe = /\b(melamine|painted|lacquered|veneer(?:ed)?)\b/i;
    const fm = finishRe.exec(text);
    if (fm) {
      const raw = fm[1].toLowerCase();
      const finish = raw.startsWith("melamine") ? "melamine" : raw.startsWith("veneer") ? "veneer" : "painted";
      push("finishType", finish, { sourceText: fm[0], sourceSpan: [fm.index, fm.index + fm[0].length] });
    }
    const layoutPatterns = [
      { layout: BAY_LAYOUT.LONG_HANGING, re: /\b(?:full[- ]?(?:height|length)\s+hanging|long\s+hanging|full\s+hanging)\b/gi },
      { layout: BAY_LAYOUT.SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES, re: /\bshort\s+hanging\b/gi }
    ];
    const layoutHits = [];
    for (const { layout, re } of layoutPatterns) {
      let hit;
      while ((hit = re.exec(text)) !== null) {
        layoutHits.push({ index: hit.index, layout, sourceText: hit[0] });
      }
    }
    layoutHits.sort((a, b) => a.index - b.index);
    if (layoutHits.length > 0) {
      push(
        "bayLayouts",
        layoutHits.map((h) => h.layout),
        { sourceText: layoutHits.map((h) => h.sourceText).join(" | "), sourceSpan: [layoutHits[0].index, layoutHits[layoutHits.length - 1].index + layoutHits[layoutHits.length - 1].sourceText.length] }
      );
    }
    const unmatchedIntent = [];
    for (const term of OUT_OF_SLICE_TERMS) {
      const om = term.pattern.exec(text);
      if (om) {
        unmatchedIntent.push(om[0]);
        ambiguities.push(
          gap("furnitureScope", GAP_KIND.OUT_OF_SLICE, GAP_SEVERITY.BLOCKING, {
            detail: term.detail,
            sourceText: om[0]
          })
        );
      }
    }
    return {
      interpreterId: INTERPRETER_ID,
      observations,
      ambiguities,
      unmatchedIntent
    };
  }

  // src/lib/conversation/proposalAdapter.js
  var ADAPTER_KIND = Object.freeze({
    DETERMINISTIC: "DETERMINISTIC",
    LLM: "LLM"
  });
  var PROPOSAL_ADAPTER_CONTRACT = Object.freeze({
    requiredMethods: Object.freeze(["interpret"]),
    /** Method names an adapter must NEVER expose — the trust boundary in code. */
    forbiddenMethods: Object.freeze([
      "approve",
      "approveProposal",
      "buildPartGraph",
      "buildStructuralPartGraph",
      "generateGeometry",
      "assembleFurniSpec"
    ]),
    returns: "{ observations: Observation[], ambiguities: Gap[], unmatchedIntent: string[] }"
  });
  function assertProposalOnly(adapter) {
    if (!adapter || typeof adapter !== "object") throw new TypeError("A proposal adapter must be an object.");
    for (const method of PROPOSAL_ADAPTER_CONTRACT.requiredMethods) {
      if (typeof adapter[method] !== "function") {
        throw new Error(`Proposal adapter "${adapter.id ?? "anonymous"}" is missing required method ${method}().`);
      }
    }
    for (const method of PROPOSAL_ADAPTER_CONTRACT.forbiddenMethods) {
      if (typeof adapter[method] === "function") {
        throw new Error(
          `Proposal adapter "${adapter.id ?? "anonymous"}" exposes ${method}(). An adapter may only propose; approval and geometry are outside its authority.`
        );
      }
    }
    return adapter;
  }
  function createDeterministicPhraseAdapter() {
    return assertProposalOnly({
      id: "deterministic-phrase-interpreter/0.1",
      kind: ADAPTER_KIND.DETERMINISTIC,
      liveModel: null,
      interpret(description) {
        return interpretDescription(description);
      }
    });
  }

  // src/lib/conversation/questions.js
  var PHRASING = Object.freeze({
    "envelope.widthMm": "How wide should the wardrobe be, wall to wall, in millimetres?",
    "envelope.heightMm": "What is the finished overall height in millimetres, floor to top?",
    "envelope.depthMm": "How deep should it be in millimetres, including the doors?",
    "plinth.heightMm": "How high should the plinth be in millimetres?",
    bayCount: "How many bays should the wardrobe be divided into?",
    doorCount: "How many hinged doors across the front?",
    finishType: "Which finish: melamine, painted or veneer?",
    bayLayouts: "What goes inside each bay, left to right? Options in this slice: full-height hanging, or short hanging over two adjustable shelves.",
    furnitureScope: "This request falls outside the straight hinged wardrobe we can build today. Shall we proceed with a straight hinged wardrobe instead?"
  });
  var KIND_PREFIX = Object.freeze({
    [GAP_KIND.AMBIGUOUS_FACT]: "That measurement was approximate, and a cut panel needs an exact one.",
    [GAP_KIND.CONFLICTING_FACT]: "Those two details do not fit together.",
    [GAP_KIND.UNRULED_DERIVATION]: "This needs a decision from the workshop, not a guess.",
    [GAP_KIND.OUT_OF_SLICE]: "That is outside what we can manufacture today."
  });
  var LAYOUT_LABELS = Object.freeze({
    [BAY_LAYOUT.LONG_HANGING]: "full-height hanging with a shelf over the top",
    [BAY_LAYOUT.SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES]: "short hanging over two adjustable shelves, with a shelf over the top"
  });

  // src/lib/conversation/clarifyInput.js
  var ACCEPTED_DIMENSION_UNITS = Object.freeze({
    // Millimetre variants (factor to dmm = 10, factor to mm = 1)
    "": { factorDmm: 10n, factorMm: 1, baseUnit: "mm" },
    mm: { factorDmm: 10n, factorMm: 1, baseUnit: "mm" },
    millimetre: { factorDmm: 10n, factorMm: 1, baseUnit: "mm" },
    millimetres: { factorDmm: 10n, factorMm: 1, baseUnit: "mm" },
    millimeter: { factorDmm: 10n, factorMm: 1, baseUnit: "mm" },
    millimeters: { factorDmm: 10n, factorMm: 1, baseUnit: "mm" },
    // Centimetre variants (factor to dmm = 100, factor to mm = 10)
    cm: { factorDmm: 100n, factorMm: 10, baseUnit: "cm" },
    centimetre: { factorDmm: 100n, factorMm: 10, baseUnit: "cm" },
    centimetres: { factorDmm: 100n, factorMm: 10, baseUnit: "cm" },
    centimeter: { factorDmm: 100n, factorMm: 10, baseUnit: "cm" },
    centimeters: { factorDmm: 100n, factorMm: 10, baseUnit: "cm" },
    // Metre variants (factor to dmm = 10000, factor to mm = 1000)
    m: { factorDmm: 10000n, factorMm: 1e3, baseUnit: "m" },
    metre: { factorDmm: 10000n, factorMm: 1e3, baseUnit: "m" },
    metres: { factorDmm: 10000n, factorMm: 1e3, baseUnit: "m" },
    meter: { factorDmm: 10000n, factorMm: 1e3, baseUnit: "m" },
    meters: { factorDmm: 10000n, factorMm: 1e3, baseUnit: "m" }
  });
  var HEDGE_PATTERN = /(?:~|\b(?:about|around|roughly|approx(?:imately)?|or so)\b)/i;
  var WORD_NUMS = Object.freeze({
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10
  });
  function parseDimension(rawVal) {
    if (typeof rawVal !== "string") {
      return { ok: false, error: "Dimension input must be a string." };
    }
    const str = rawVal.trim();
    if (str.length === 0) {
      return { ok: false, error: "Please enter a valid numeric dimension in millimetres (e.g. 1800 or 1.8m)." };
    }
    if (str.startsWith("-")) {
      return { ok: false, error: "Negative dimensions are not permitted. Dimension must be a positive number." };
    }
    if (HEDGE_PATTERN.test(str)) {
      return { ok: false, error: "Measurements must be exact. Approximate values are not permitted." };
    }
    const match = /^\+?(?:(\d+)(?:\.(\d+))?|\.(\d+))\s*([a-zA-Z]+)?$/i.exec(str);
    if (!match) {
      return { ok: false, error: "Please enter a valid numeric dimension in millimetres (e.g. 1800 or 1.8m)." };
    }
    const intStr = match[1] ?? "0";
    const fracStr = match[2] ?? match[3] ?? "";
    const unitRaw = (match[4] ?? "").toLowerCase();
    const unitDef = ACCEPTED_DIMENSION_UNITS[unitRaw];
    if (!unitDef) {
      return { ok: false, error: "Please enter a valid numeric dimension in millimetres (e.g. 1800 or 1.8m)." };
    }
    const intPart = BigInt(intStr);
    const fracLen = BigInt(fracStr.length);
    const multiplier = unitDef.factorDmm;
    let totalDmm;
    if (fracLen === 0n) {
      totalDmm = intPart * multiplier;
    } else {
      const divisor = 10n ** fracLen;
      const fracPart = BigInt(fracStr);
      const fracDmmScaled = fracPart * multiplier;
      if (fracDmmScaled % divisor !== 0n) {
        return { ok: false, error: "Precision finer than 0.1mm is not supported." };
      }
      totalDmm = intPart * multiplier + fracDmmScaled / divisor;
    }
    if (totalDmm <= 0n) {
      return { ok: false, error: "Dimension must be a positive number greater than zero." };
    }
    const finalMm = Number(totalDmm) / 10;
    const isPlainMm = unitRaw === "" || unitRaw === "mm";
    return {
      ok: true,
      value: finalMm,
      convertedText: !isPlainMm ? `${finalMm} mm` : null
    };
  }
  function parseAndValidateClarifyInput(gapKey, rawVal, currentBayCount = 2) {
    if (rawVal === void 0 || rawVal === null) {
      return { ok: false, error: "Please enter an answer." };
    }
    if (typeof rawVal === "string" && rawVal.trim().length === 0) {
      return { ok: false, error: "Please enter an answer." };
    }
    if (gapKey.endsWith("Mm")) {
      return parseDimension(typeof rawVal === "string" ? rawVal : String(rawVal));
    }
    const v = typeof rawVal === "string" ? rawVal.trim() : rawVal;
    if (gapKey === "bayCount" || gapKey === "doorCount") {
      const label = gapKey === "bayCount" ? "Bay" : "Door";
      if (typeof v === "string" && HEDGE_PATTERN.test(v)) {
        return { ok: false, error: "Counts must be exact integers." };
      }
      if (typeof v === "string") {
        const lower = v.toLowerCase();
        if (WORD_NUMS[lower] !== void 0) {
          return { ok: true, value: WORD_NUMS[lower] };
        }
        if (!/^\+?\d+$/.test(v)) {
          return { ok: false, error: `${label} count must be a positive whole number (e.g. 2, 4).` };
        }
        const n = parseInt(v, 10);
        if (n <= 0) {
          return { ok: false, error: "Count must be at least 1." };
        }
        return { ok: true, value: n };
      }
      if (typeof v === "number") {
        if (!Number.isInteger(v) || v <= 0) {
          return { ok: false, error: `${label} count must be a positive whole number (e.g. 2, 4).` };
        }
        return { ok: true, value: v };
      }
      return { ok: false, error: `${label} count must be a positive whole number (e.g. 2, 4).` };
    }
    if (gapKey === "finishType") {
      if (typeof v === "string") {
        const lower = v.toLowerCase();
        if (lower.includes("melamine")) return { ok: true, value: "melamine" };
        if (lower.includes("painted") || lower.includes("paint")) return { ok: true, value: "painted" };
        if (lower.includes("veneer")) return { ok: true, value: "veneer" };
        return { ok: true, value: lower };
      }
      return { ok: true, value: v };
    }
    if (gapKey === "bayLayouts") {
      if (Array.isArray(v)) {
        if (v.length === 0) {
          return { ok: false, error: "Please select an interior layout for each bay." };
        }
        for (let i = 0; i < v.length; i++) {
          if (!v[i]) {
            return { ok: false, error: `Please select an interior layout for Bay ${i + 1}.` };
          }
        }
        return { ok: true, value: v };
      }
      if (typeof v === "string" && v.startsWith("[") && v.endsWith("]")) {
        try {
          const arr = JSON.parse(v);
          if (Array.isArray(arr) && arr.length > 0) {
            for (let i = 0; i < arr.length; i++) {
              if (!arr[i]) {
                return { ok: false, error: `Please select an interior layout for Bay ${i + 1}.` };
              }
            }
            return { ok: true, value: arr };
          }
        } catch (_e) {
        }
      }
      return { ok: false, error: "Please use the bay selectors below to choose each bay layout." };
    }
    return { ok: true, value: v };
  }

  // src/lib/conversation/pipeline.js
  var PIPELINE_STAGE = Object.freeze({
    NEEDS_CLARIFICATION: "NEEDS_CLARIFICATION",
    UNSUPPORTED_REQUEST: "UNSUPPORTED_REQUEST",
    VALIDATION_FAILED: "VALIDATION_FAILED",
    READY_FOR_REVIEW: "READY_FOR_REVIEW",
    DRAFT_PREVIEW: "DRAFT_PREVIEW",
    APPROVED_FOR_PREVIEW: "APPROVED_FOR_PREVIEW"
  });
  var APPROVAL_STATE = Object.freeze({
    NOT_APPROVED: "NOT_APPROVED",
    APPROVAL_REJECTED: "APPROVAL_REJECTED",
    APPROVED: "APPROVED"
  });
  function previewDraftWardrobe({
    description,
    answers = {},
    initialObservations = null,
    specId,
    revision = 1,
    adapter = createDeterministicPhraseAdapter()
  }) {
    assertProposalOnly(adapter);
    let observations = [];
    let ambiguities = [];
    let interpretation = null;
    if (Array.isArray(initialObservations) && initialObservations.length > 0) {
      observations = [...initialObservations];
    } else {
      const rawDescription = description ?? "";
      interpretation = adapter.interpret(rawDescription);
      observations = [...interpretation.observations];
      ambiguities = [...interpretation.ambiguities];
    }
    const gaps = analyseGaps({ observations, ambiguities });
    const outOfSlice = gaps.filter((g) => g.kind === GAP_KIND.OUT_OF_SLICE);
    if (outOfSlice.length > 0) {
      return {
        stage: PIPELINE_STAGE.UNSUPPORTED_REQUEST,
        interpretation,
        observations,
        gaps,
        spec: null,
        proposal: null,
        partGraph: null,
        safety: preApprovalSafety(null)
      };
    }
    for (const [key, value] of Object.entries(answers)) {
      observations = observations.filter((o) => o.key !== key);
      observations.push(
        observation(key, value, OBSERVATION_ORIGIN.CUSTOMER_CONFIRMED, {
          sourceText: `refinement for: ${key}`
        })
      );
    }
    const existingKeys = new Set(observations.map((o) => o.key));
    for (const requiredKey of REQUIRED_INTAKE_KEYS) {
      if (!existingKeys.has(requiredKey)) {
        const defaultValue = BEKZOD_APPROVED_DEFAULTS[requiredKey];
        observations.push(
          observation(requiredKey, defaultValue, OBSERVATION_ORIGIN.DEFAULTED, {
            sourceText: `Bekzod-approved default for ${requiredKey}`
          })
        );
      }
    }
    const facts = Object.fromEntries(observations.map((o) => [o.key, o.value]));
    const origins = Object.fromEntries(observations.map((o) => [o.key, o.origin]));
    const effectiveSpecId = specId || `furnispec-draft-${Math.floor(1e3 + Math.random() * 9e3)}`;
    let assembled;
    try {
      assembled = assembleFurniSpec({
        facts,
        gaps: [],
        // All facts resolved or defaulted
        specId: effectiveSpecId,
        revision,
        status: SPEC_STATUS.PROPOSED
        // STRICTLY PROPOSED
      });
    } catch (err) {
      return {
        stage: PIPELINE_STAGE.VALIDATION_FAILED,
        error: err.message,
        observations,
        origins,
        spec: null,
        proposal: null,
        partGraph: null,
        safety: preApprovalSafety(null)
      };
    }
    const validation = validateFurniSpec(assembled.spec);
    if (!validation.valid) {
      return {
        stage: PIPELINE_STAGE.VALIDATION_FAILED,
        spec: assembled.spec,
        derivations: assembled.derivations,
        validation,
        observations,
        origins,
        proposal: null,
        partGraph: null,
        safety: preApprovalSafety(assembled.spec)
      };
    }
    const proposal = createProposal(assembled.spec);
    const partGraph = buildStructuralPartGraph(assembled.spec);
    const partGraphValidation = validatePartGraph(partGraph);
    return {
      stage: PIPELINE_STAGE.DRAFT_PREVIEW,
      previewType: "DRAFT_PREVIEW",
      spec: assembled.spec,
      proposal,
      partGraph,
      partGraphValidation,
      observations,
      origins,
      facts,
      derivations: assembled.derivations,
      validation,
      safety: draftPreviewSafety(assembled.spec, partGraph)
    };
  }
  var UNIT_RE_STR = "(?:mm|millimetres?|millimeters?|cm|centimetres?|centimeters?|m|metres?|meters?)";
  var NUM_RE_STR = "[+-]?\\s*(?:\\d+(?:\\.\\d+)?|\\.\\d+)";
  function extractDimension(text, axis) {
    let trailingWords;
    let leadingWords;
    if (axis === "width") {
      trailingWords = "(?:wide|width)";
      leadingWords = "width";
    } else if (axis === "height") {
      trailingWords = "(?:high|tall|height)";
      leadingWords = "height";
    } else if (axis === "depth") {
      trailingWords = "(?:deep|depth)";
      leadingWords = "depth";
    }
    const m1 = text.match(new RegExp(`(?:(?:make|set)\\s+(?:it\\s+)?)?(${NUM_RE_STR}\\s*${UNIT_RE_STR}?)\\s*${trailingWords}\\b`, "i"));
    if (m1 && m1[1]) return m1[1].trim();
    const m2 = text.match(new RegExp(`\\b${leadingWords}\\s*(?:to|is|of|:|=)?\\s*(${NUM_RE_STR}\\s*${UNIT_RE_STR}?)\\b`, "i"));
    if (m2 && m2[1]) return m2[1].trim();
    return null;
  }
  function parseConversationalCommand(text, currentFacts = {}) {
    if (typeof text !== "string" || !text.trim()) return null;
    const t = text.trim();
    const widthRaw = extractDimension(t, "width");
    if (widthRaw !== null) {
      const parsedDim = parseDimension(widthRaw);
      if (!parsedDim.ok) {
        return {
          error: parsedDim.error || "Invalid width dimension."
        };
      }
      const widthMm = parsedDim.value;
      return {
        changes: { "envelope.widthMm": widthMm },
        assistantReply: `Updated width to ${widthMm} mm.`
      };
    }
    const heightRaw = extractDimension(t, "height");
    if (heightRaw !== null) {
      const parsedDim = parseDimension(heightRaw);
      if (!parsedDim.ok) {
        return {
          error: parsedDim.error || "Invalid height dimension."
        };
      }
      const heightMm = parsedDim.value;
      return {
        changes: { "envelope.heightMm": heightMm },
        assistantReply: `Updated height to ${heightMm} mm.`
      };
    }
    const depthRaw = extractDimension(t, "depth");
    if (depthRaw !== null) {
      const parsedDim = parseDimension(depthRaw);
      if (!parsedDim.ok) {
        return {
          error: parsedDim.error || "Invalid depth dimension."
        };
      }
      const depthMm = parsedDim.value;
      return {
        changes: { "envelope.depthMm": depthMm },
        assistantReply: `Updated depth to ${depthMm} mm.`
      };
    }
    const isExplicitTwoShelvesSwitch = (text2) => {
      if (/\b(?:all\s+shelves|shelves\s+(?:in|on)\s+both)\b/i.test(text2)) return false;
      const patterns = [
        /\b(?:switch|change|convert|set|configure|use)\s+(?:the\s+)?(?:left|right|bay\s*[12])\s+(?:bay\s+)?(?:to\s+)?(?:short\s+hanging(?:\s+with)?\s+)?(?:two|2)\s+shelves\b/i,
        /\b(?:switch|change|convert|set|configure|use)\s+(?:short\s+hanging(?:\s+with)?\s+)?(?:two|2)\s+shelves\s+(?:on|in)\s+(?:the\s+)?(?:left|right|bay\s*[12])\b/i,
        /\b(?:two|2)\s+shelves\s+(?:on|in)\s+(?:the\s+)?(?:left|right|bay\s*[12])\b/i,
        /\b(?:short\s+hanging(?:\s+with)?\s+(?:two|2)\s+shelves)\s+(?:on|in)\s+(?:the\s+)?(?:left|right|bay\s*[12])\b/i,
        /\b(?:switch|change|convert|set|configure)\s+(?:the\s+)?(?:left|right|bay\s*[12])\s+(?:bay\s+)?to\s+(?:shelves|short\s+hanging)\b/i,
        /\b(?:yes[,\s]+)?(?:switch|change|use)\s+(?:the\s+)?(?:left|right)\s+(?:bay\s+)?(?:to\s+)?(?:two|2)\s+shelves\b/i
      ];
      return patterns.some((p) => p.test(text2));
    };
    if (isExplicitTwoShelvesSwitch(t)) {
      const currentBays = currentFacts.bayCount || 2;
      const layouts = currentFacts.bayLayouts ? [...currentFacts.bayLayouts] : ["LONG_HANGING", "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES"];
      const isLeft = /\b(?:left|bay\s*1)\b/i.test(t);
      const isRight = /\b(?:right|bay\s*2)\b/i.test(t);
      const targetBayIdx = isLeft ? 0 : isRight ? 1 : 0;
      const baySide = targetBayIdx === 0 ? "left" : "right";
      if (targetBayIdx >= currentBays) {
        return {
          error: `Cannot modify bay ${targetBayIdx + 1} because this wardrobe only has ${currentBays} bay${currentBays > 1 ? "s" : ""}.`
        };
      }
      if (layouts[targetBayIdx] === "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES") {
        return {
          error: `The ${baySide} bay is already configured as short hanging with two adjustable shelves.`
        };
      }
      layouts[targetBayIdx] = "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES";
      return {
        changes: { bayLayouts: layouts },
        assistantReply: `Configured the ${baySide} bay as short hanging with two adjustable shelves.`
      };
    }
    if (/\b(?:add\s+(?:another\s+|more\s+)?shelf|more\s+shelves|add\s+shelv(?:es|ing)|shelves)\b/i.test(t)) {
      if (/all\s+shelves|shelves\s+(?:in|on)\s+both\s+(?:bays|sides)/i.test(t)) {
        const currentBays2 = currentFacts.bayCount || 2;
        const currentLayouts = currentFacts.bayLayouts || [];
        const allAlreadyShelves = currentLayouts.length === currentBays2 && currentLayouts.every((l) => l === "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES");
        if (allAlreadyShelves) {
          return {
            error: `All ${currentBays2} bays are already configured with short hanging and two adjustable shelves.`
          };
        }
        const layouts2 = Array(currentBays2).fill("SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES");
        return {
          changes: { bayLayouts: layouts2 },
          assistantReply: `Configured all ${currentBays2} bays with short hanging and two adjustable shelves.`
        };
      }
      const currentBays = currentFacts.bayCount || 2;
      const layouts = currentFacts.bayLayouts ? [...currentFacts.bayLayouts] : ["LONG_HANGING", "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES"];
      const isLeft = /\b(?:left|bay\s*1)\b/i.test(t);
      const isRight = /\b(?:right|bay\s*2)\b/i.test(t);
      let targetBayIdx;
      if (isLeft) {
        targetBayIdx = 0;
      } else if (isRight) {
        targetBayIdx = 1;
      } else {
        targetBayIdx = layouts.findIndex((l) => l === "LONG_HANGING");
        if (targetBayIdx === -1) {
          return {
            error: `All bays already have the maximum supported shelving for this manufacturing slice (2 adjustable shelves per bay + top fixed shelf). You can switch a bay to full-height long hanging if desired.`
          };
        }
      }
      if (targetBayIdx >= currentBays) {
        return {
          error: `Cannot modify bay ${targetBayIdx + 1} because this wardrobe only has ${currentBays} bay${currentBays > 1 ? "s" : ""}.`
        };
      }
      const currentBayLayout = layouts[targetBayIdx];
      const baySide = targetBayIdx === 0 ? "left" : "right";
      const otherSide = targetBayIdx === 0 ? "right" : "left";
      if (currentBayLayout === "LONG_HANGING") {
        return {
          error: `Adding a single shelf to full-height long hanging is not supported in this manufacturing slice. The supported shelving layout is short hanging with two adjustable shelves. To use this layout, reply 'switch ${baySide} bay to short hanging with two shelves' or 'use two shelves on the ${baySide}'.`
        };
      }
      return {
        error: `The ${baySide} bay already has the maximum supported shelving for this manufacturing slice (2 adjustable shelves + top fixed shelf). You can change the ${otherSide} bay to shelves or switch back to full-height long hanging.`
      };
    }
    if (/\b(?:all\s+hanging|hanging\s+(?:in|on)\s+both\s+(?:bays|sides)|full\s+hanging\s+(?:in|on)\s+both)\b/i.test(t)) {
      const currentBays = currentFacts.bayCount || 2;
      const currentLayouts = currentFacts.bayLayouts || [];
      const allAlreadyHanging = currentLayouts.length === currentBays && currentLayouts.every((l) => l === "LONG_HANGING");
      if (allAlreadyHanging) {
        return {
          error: `All ${currentBays} bays are already configured with full-height long hanging.`
        };
      }
      const layouts = Array(currentBays).fill("LONG_HANGING");
      return {
        changes: { bayLayouts: layouts },
        assistantReply: `Configured all ${currentBays} bays with full-height long hanging.`
      };
    }
    if (/\b(?:hanging|full[- ]?hanging|long\s+hanging)\b/i.test(t)) {
      const currentBays = currentFacts.bayCount || 2;
      const layouts = currentFacts.bayLayouts ? [...currentFacts.bayLayouts] : ["LONG_HANGING", "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES"];
      const isLeft = /\b(?:left|bay\s*1)\b/i.test(t);
      const isRight = /\b(?:right|bay\s*2)\b/i.test(t);
      if (isLeft || isRight) {
        const targetBayIdx = isLeft ? 0 : 1;
        const baySide = targetBayIdx === 0 ? "left" : "right";
        if (layouts[targetBayIdx] === "LONG_HANGING") {
          return {
            error: `The ${baySide} bay is already configured for full-height long hanging.`
          };
        }
        layouts[targetBayIdx] = "LONG_HANGING";
        return {
          changes: { bayLayouts: layouts },
          assistantReply: `Configured the ${baySide} bay for full-height long hanging.`
        };
      }
    }
    const bayMatch = t.match(/(?:make\s+it\s+)?(\d+)\s*bays?/i);
    if (bayMatch) {
      const count = parseInt(bayMatch[1], 10);
      if (count >= 1 && count <= 6) {
        const layouts = Array(count).fill("SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES");
        layouts[0] = "LONG_HANGING";
        return {
          changes: {
            bayCount: count,
            doorCount: count * 2,
            bayLayouts: layouts
          },
          assistantReply: `Updated to ${count} bays with ${count * 2} hinged doors.`
        };
      }
    }
    const matMatch = t.match(/\b(oak|walnut|white|grey|taupe|cream|black|navy|sage|ash)\b/i);
    if (matMatch && /finish|material|color|colour/i.test(t)) {
      const mat = matMatch[1].toLowerCase();
      return {
        changes: { materialKey: mat },
        assistantReply: `Changed finish to ${mat}.`
      };
    }
    return null;
  }
  function applyConversationalEdit({
    currentObservations = [],
    commandText,
    specId,
    revision = 1,
    adapter = createDeterministicPhraseAdapter()
  }) {
    const currentFacts = Object.fromEntries(currentObservations.map((o) => [o.key, o.value]));
    const parsed = parseConversationalCommand(commandText, currentFacts);
    if (parsed && parsed.error) {
      return {
        ok: false,
        error: parsed.error
      };
    }
    if (!parsed) {
      const interpretation = adapter.interpret(commandText);
      if (interpretation.observations.length === 0) {
        return {
          ok: false,
          error: `Could not interpret modification from "${commandText}". Try e.g. "Make it 2000 mm wide" or "Add another shelf on the right".`
        };
      }
      const newKeys = new Set(interpretation.observations.map((o) => o.key));
      const mergedObservations = [
        ...currentObservations.filter((o) => !newKeys.has(o.key)),
        ...interpretation.observations
      ];
      const draft2 = previewDraftWardrobe({
        description: "",
        answers: Object.fromEntries(mergedObservations.map((o) => [o.key, o.value])),
        specId,
        revision: revision + 1,
        adapter
      });
      if (!draft2.spec || !draft2.partGraph || draft2.validation && !draft2.validation.valid) {
        return {
          ok: false,
          error: draft2.error || draft2.validation?.errors?.map((e) => e.message).join("; ") || "Failed to generate valid wardrobe geometry for this change."
        };
      }
      if (draft2.partGraphValidation && !draft2.partGraphValidation.valid) {
        return {
          ok: false,
          error: draft2.partGraphValidation.errors?.join("; ") || "Generated part graph validation failed."
        };
      }
      return {
        ok: true,
        assistantReply: `Updated wardrobe design (Revision ${revision + 1}).`,
        ...draft2
      };
    }
    const materialKey = parsed.changes.materialKey;
    const changes = { ...parsed.changes };
    delete changes.materialKey;
    const newObservations = currentObservations.filter((o) => !Object.prototype.hasOwnProperty.call(changes, o.key)).concat(
      Object.entries(changes).map(
        ([k, v]) => observation(k, v, OBSERVATION_ORIGIN.CUSTOMER_STATED, { sourceText: commandText })
      )
    );
    const draft = previewDraftWardrobe({
      initialObservations: newObservations,
      specId,
      revision: revision + 1,
      adapter
    });
    if (!draft.spec || !draft.partGraph || draft.validation && !draft.validation.valid) {
      return {
        ok: false,
        error: draft.error || draft.validation?.errors?.map((e) => e.message).join("; ") || "Failed to generate valid wardrobe geometry for this change."
      };
    }
    if (draft.partGraphValidation && !draft.partGraphValidation.valid) {
      return {
        ok: false,
        error: draft.partGraphValidation.errors?.join("; ") || "Generated part graph validation failed."
      };
    }
    return {
      ok: true,
      assistantReply: `${parsed.assistantReply} (Revision ${revision + 1})`,
      materialKey,
      ...draft
    };
  }
  function draftPreviewSafety(spec, partGraph) {
    const drillingOperations = (partGraph?.operations ?? []).filter((op) => /DRILL|BORE|HINGE_CUP|PIN_HOLE/i.test(op.type));
    return {
      approvalState: APPROVAL_STATE.NOT_APPROVED,
      previewAuthorized: true,
      draftPreview: true,
      workshopApproved: false,
      geometryGenerated: true,
      cncQualified: false,
      specQualificationStatus: spec?.qualificationStatus ?? null,
      partGraphQualificationStatus: partGraph?.qualificationStatus ?? null,
      cncQualificationAsserted: false,
      drillingPolicy: spec?.machiningPolicy?.drilling ?? null,
      drillingOperationCount: drillingOperations.length,
      drillingBlocked: spec?.machiningPolicy?.drilling === "BLOCKED_PENDING_HARDWARE_APPROVAL" && drillingOperations.length === 0,
      hardwareStatuses: spec ? hardwareStatusesOf(spec) : {},
      approvedOperationTypes: [],
      note: "DRAFT PREVIEW ONLY \u2014 NOT APPROVED FOR WORKSHOP. Geometry rendered from Bekzod-approved defaults with status PROPOSED. Approval is required before CNC or production."
    };
  }
  function preApprovalSafety(spec, approvalState = APPROVAL_STATE.NOT_APPROVED) {
    return {
      approvalState,
      previewAuthorized: false,
      geometryGenerated: false,
      cncQualified: false,
      specQualificationStatus: spec?.qualificationStatus ?? null,
      partGraphQualificationStatus: null,
      drillingPolicy: spec?.machiningPolicy?.drilling ?? null,
      drillingOperationCount: 0,
      drillingBlocked: spec ? spec.machiningPolicy?.drilling === "BLOCKED_PENDING_HARDWARE_APPROVAL" : true,
      hardwareStatuses: spec ? hardwareStatusesOf(spec) : {},
      approvedOperationTypes: [],
      note: "No geometry exists. Nothing in this report describes approved manufacturing output."
    };
  }
  function hardwareStatusesOf(spec) {
    return Object.fromEntries(Object.entries(spec.hardware ?? {}).map(([k, v]) => [k, v?.status ?? "UNKNOWN"]));
  }

  // src/lib/ai-designer/proposalFromModel.js
  function createModelProposalAdapter(edits, { providerId = "unknown", unsupported = [] } = {}) {
    const observations = edits.filter((e) => e.key !== "materialKey").map(
      (e) => observation(e.key, e.value, OBSERVATION_ORIGIN.CUSTOMER_STATED, {
        sourceText: e.sourceText ?? `model proposal (${providerId})`
      })
    );
    return assertProposalOnly({
      id: `llm-proposal-adapter/${providerId}`,
      kind: ADAPTER_KIND.LLM,
      liveModel: providerId,
      interpret() {
        return { observations, ambiguities: [], unmatchedIntent: unsupported.map((u) => u.request) };
      }
    });
  }
  function materialKeyFrom(edits) {
    const hit = edits.find((e) => e.key === "materialKey");
    return hit ? hit.value : null;
  }

  // src/lib/ai-designer/designEditSchema.js
  var EDITABLE_KEYS = Object.freeze([...REQUIRED_INTAKE_KEYS, "materialKey"]);
  var FORBIDDEN_KEY_PATTERNS = Object.freeze([
    /partgraph/i,
    /panel/i,
    /placement/i,
    /coordinate/i,
    /\bdrill/i,
    /machining/i,
    /qualification/i,
    /approval/i,
    /fingerprint/i,
    /\bstatus\b/i,
    /cnc/i,
    /gcode/i,
    /operation/i,
    /hardware/i,
    /groove/i,
    /thickness/i,
    /revision/i,
    /specid/i
  ]);
  var MODEL_PROPOSAL_ERROR = Object.freeze({
    NOT_AN_OBJECT: "NOT_AN_OBJECT",
    EDITS_NOT_ARRAY: "EDITS_NOT_ARRAY",
    NO_EDITS: "NO_EDITS",
    UNKNOWN_KEY: "UNKNOWN_KEY",
    FORBIDDEN_KEY: "FORBIDDEN_KEY",
    INVALID_VALUE: "INVALID_VALUE",
    DUPLICATE_KEY: "DUPLICATE_KEY",
    TOO_MANY_EDITS: "TOO_MANY_EDITS"
  });
  var MAX_EDITS = EDITABLE_KEYS.length;
  function keyIsForbidden(key) {
    return FORBIDDEN_KEY_PATTERNS.some((p) => p.test(key));
  }
  function validateModelProposal(raw, { currentBayCount = 2 } = {}) {
    const errors = [];
    const fail = (code, message, key) => errors.push(key ? { code, key, message } : { code, message });
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      fail(MODEL_PROPOSAL_ERROR.NOT_AN_OBJECT, "Model output must be a JSON object.");
      return { ok: false, edits: [], unsupported: [], reply: "", errors };
    }
    const reply = typeof raw.reply === "string" ? raw.reply.trim() : "";
    const unsupported = Array.isArray(raw.unsupported) ? raw.unsupported.filter((u) => u && typeof u === "object" && typeof u.request === "string" && typeof u.reason === "string").map((u) => ({
      request: u.request,
      reason: u.reason,
      alternative: typeof u.alternative === "string" ? u.alternative : null
    })) : [];
    if (!Array.isArray(raw.edits)) {
      fail(MODEL_PROPOSAL_ERROR.EDITS_NOT_ARRAY, "`edits` must be an array.");
      return { ok: false, edits: [], unsupported, reply, errors };
    }
    if (raw.edits.length > MAX_EDITS) {
      fail(MODEL_PROPOSAL_ERROR.TOO_MANY_EDITS, `At most ${MAX_EDITS} edits may be proposed at once.`);
      return { ok: false, edits: [], unsupported, reply, errors };
    }
    const seen = /* @__PURE__ */ new Set();
    const edits = [];
    for (const edit of raw.edits) {
      if (!edit || typeof edit !== "object" || Array.isArray(edit) || typeof edit.key !== "string") {
        fail(MODEL_PROPOSAL_ERROR.UNKNOWN_KEY, "Each edit must be an object with a string `key`.");
        continue;
      }
      const key = edit.key;
      if (keyIsForbidden(key)) {
        fail(MODEL_PROPOSAL_ERROR.FORBIDDEN_KEY, `"${key}" is owned by the deterministic kernel and cannot be model-set.`, key);
        continue;
      }
      if (!EDITABLE_KEYS.includes(key)) {
        fail(MODEL_PROPOSAL_ERROR.UNKNOWN_KEY, `"${key}" is not a customer-editable design fact.`, key);
        continue;
      }
      if (seen.has(key)) {
        fail(MODEL_PROPOSAL_ERROR.DUPLICATE_KEY, `"${key}" was proposed more than once.`, key);
        continue;
      }
      seen.add(key);
      if (key === "materialKey") {
        if (typeof edit.value !== "string" || edit.value.trim() === "") {
          fail(MODEL_PROPOSAL_ERROR.INVALID_VALUE, "materialKey must be a non-empty string.", key);
          continue;
        }
        edits.push({ key, value: edit.value.trim().toLowerCase(), sourceText: typeof edit.sourceText === "string" ? edit.sourceText : null });
        continue;
      }
      const parsed = parseAndValidateClarifyInput(key, edit.value, currentBayCount);
      if (!parsed.ok) {
        fail(MODEL_PROPOSAL_ERROR.INVALID_VALUE, parsed.error || `Invalid value for ${key}.`, key);
        continue;
      }
      edits.push({ key, value: parsed.value, sourceText: typeof edit.sourceText === "string" ? edit.sourceText : null });
    }
    return { ok: errors.length === 0, edits, unsupported, reply, errors };
  }

  // src/lib/adapters/aiDesignerTransport.js
  var AI_DESIGNER_ENDPOINT = "/api/design/propose";
  var RESULT_SOURCE = Object.freeze({
    DETERMINISTIC: "DETERMINISTIC",
    MODEL: "MODEL"
  });
  var RESULT_KIND = Object.freeze({
    DESIGN_UPDATED: "DESIGN_UPDATED",
    MATERIAL_UPDATED: "MATERIAL_UPDATED",
    NEEDS_MORE_DETAIL: "NEEDS_MORE_DETAIL",
    UNSUPPORTED: "UNSUPPORTED",
    REJECTED: "REJECTED",
    DESIGNER_UNAVAILABLE: "DESIGNER_UNAVAILABLE"
  });
  function factsFrom(observations) {
    return Object.fromEntries((observations ?? []).map((o) => [o.key, o.value]));
  }
  async function proposeDesignChange({
    message,
    currentObservations = [],
    specId,
    revision = 1,
    endpoint = AI_DESIGNER_ENDPOINT,
    fetchImpl = typeof fetch === "function" ? fetch : null,
    signal = void 0
  }) {
    if (typeof message !== "string" || message.trim() === "") {
      return { ok: false, source: RESULT_SOURCE.DETERMINISTIC, kind: RESULT_KIND.REJECTED, error: "Please describe the change you want." };
    }
    const parsed = parseConversationalCommand(message, factsFrom(currentObservations));
    if (parsed) {
      const applied2 = applyConversationalEdit({ currentObservations, commandText: message, specId, revision });
      return applied2.ok ? { ...applied2, source: RESULT_SOURCE.DETERMINISTIC, kind: RESULT_KIND.DESIGN_UPDATED } : { ...applied2, source: RESULT_SOURCE.DETERMINISTIC, kind: RESULT_KIND.REJECTED };
    }
    if (typeof fetchImpl !== "function") {
      return {
        ok: false,
        source: RESULT_SOURCE.MODEL,
        kind: RESULT_KIND.DESIGNER_UNAVAILABLE,
        error: "The FurniAI designer is not reachable from this browser. Your design is unchanged."
      };
    }
    let payload;
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message,
          currentFacts: factsFrom(currentObservations),
          currentBayCount: factsFrom(currentObservations).bayCount ?? 2
        }),
        ...signal ? { signal } : {}
      });
      payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        return {
          ok: false,
          source: RESULT_SOURCE.MODEL,
          kind: RESULT_KIND.DESIGNER_UNAVAILABLE,
          code: payload?.code ?? `HTTP_${response.status}`,
          error: payload?.error ?? "The FurniAI designer is not available right now. Your design is unchanged."
        };
      }
    } catch (err) {
      return {
        ok: false,
        source: RESULT_SOURCE.MODEL,
        kind: RESULT_KIND.DESIGNER_UNAVAILABLE,
        code: err?.name === "AbortError" ? "ABORTED" : "NETWORK_ERROR",
        error: "Could not reach the FurniAI designer. Your design is unchanged."
      };
    }
    const revalidated = validateModelProposal(
      { edits: payload.edits, unsupported: payload.unsupported, reply: payload.reply },
      { currentBayCount: factsFrom(currentObservations).bayCount ?? 2 }
    );
    const edits = revalidated.edits;
    const unsupported = revalidated.unsupported;
    const clientRejected = revalidated.errors;
    if (edits.length === 0) {
      return {
        ok: false,
        source: RESULT_SOURCE.MODEL,
        kind: unsupported.length > 0 ? RESULT_KIND.UNSUPPORTED : clientRejected.length > 0 ? RESULT_KIND.REJECTED : RESULT_KIND.NEEDS_MORE_DETAIL,
        assistantReply: payload.reply || "",
        unsupported,
        rejected: [...payload.rejected ?? [], ...clientRejected],
        error: unsupported.length > 0 ? unsupported[0].reason : payload.reply || "I need a little more detail before I can change the design."
      };
    }
    const materialKey = materialKeyFrom(edits);
    const structural = edits.filter((e) => e.key !== "materialKey");
    if (structural.length === 0) {
      return {
        ok: true,
        source: RESULT_SOURCE.MODEL,
        kind: RESULT_KIND.MATERIAL_UPDATED,
        materialKey,
        assistantReply: payload.reply || `Changed finish to ${materialKey}.`,
        unsupported
      };
    }
    const adapter = createModelProposalAdapter(structural, { providerId: payload.provider ?? "server", unsupported });
    const applied = applyConversationalEdit({ currentObservations, commandText: message, specId, revision, adapter });
    if (!applied.ok) {
      return {
        ...applied,
        source: RESULT_SOURCE.MODEL,
        kind: RESULT_KIND.REJECTED,
        assistantReply: payload.reply || "",
        unsupported
      };
    }
    return {
      ...applied,
      source: RESULT_SOURCE.MODEL,
      kind: RESULT_KIND.DESIGN_UPDATED,
      materialKey: materialKey ?? applied.materialKey ?? null,
      assistantReply: payload.reply || applied.assistantReply,
      unsupported,
      rejected: clientRejected
    };
  }
  return __toCommonJS(aiDesignerTransport_exports);
})();
