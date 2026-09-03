var PartGraphBridge = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
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
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // three-global:three
  var require_three = __commonJS({
    "three-global:three"(exports, module) {
      module.exports = globalThis.THREE || window.THREE;
    }
  });

  // src/lib/adapters/browserBridge.js
  var browserBridge_exports = {};
  __export(browserBridge_exports, {
    DMM_TO_THREE: () => DMM_TO_THREE,
    buildStructuralPartGraph: () => buildStructuralPartGraph,
    disposePartGraphGroup: () => disposePartGraphGroup,
    goldenSpec: () => goldenWardrobe_fixture_default,
    loadGoldenWardrobe: () => loadGoldenWardrobe,
    partGraphToThree: () => partGraphToThree,
    updateParametricMaterial: () => updateParametricMaterial,
    validateFurniSpec: () => validateFurniSpec
  });

  // src/lib/furnispec/goldenWardrobe.fixture.json
  var goldenWardrobe_fixture_default = {
    schemaVersion: "furnispec/0.1",
    specId: "furnispec-golden-wardrobe-01",
    revision: 1,
    unit: "mm",
    furnitureType: "wardrobe",
    wardrobeType: "straight_hinged",
    constructionStyle: "CAP_STYLE",
    finishType: "melamine",
    status: "APPROVED",
    qualificationStatus: "WORKSHOP_REVIEW_NOT_CNC_QUALIFIED",
    envelope: {
      widthMm: 1800,
      heightMm: 2400,
      depthMm: 600
    },
    plinth: {
      heightMm: 100,
      frontRecessMm: 50,
      sideInsetMm: 50,
      sideInsetStatus: "ASSUMPTION_PENDING_BEKZOD_APPROVAL"
    },
    carcass: {
      heightMm: 2300,
      depthMm: 580,
      panelThicknessMm: 18,
      backThicknessMm: 6,
      grooveWidthMm: 7,
      grooveDepthMm: 7,
      grooveRearDatumMm: 20
    },
    bays: [
      {
        id: "bay-01",
        index: 0,
        clearWidthMm: 873,
        components: [
          {
            id: "shelf-fix-l1",
            type: "SHELF_FIXED",
            clearOpeningAboveMm: 350,
            thicknessMm: 18,
            depthMm: 560
          },
          {
            id: "rail-long-l1",
            type: "HANGING_RAIL_LONG",
            offsetBelowShelfMm: 100,
            targetClearDropMm: 1400
          }
        ]
      },
      {
        id: "bay-02",
        index: 1,
        clearWidthMm: 873,
        components: [
          {
            id: "shelf-fix-r1",
            type: "SHELF_FIXED",
            clearOpeningAboveMm: 350,
            thicknessMm: 18,
            depthMm: 560
          },
          {
            id: "rail-short-r1",
            type: "HANGING_RAIL_SHORT",
            offsetBelowShelfMm: 100,
            targetClearDropMm: 900
          },
          {
            id: "shelf-adj-r3",
            type: "SHELF_ADJUSTABLE",
            clearDropAboveMm: 900,
            thicknessMm: 18,
            depthMm: 550
          },
          {
            id: "shelf-adj-r2",
            type: "SHELF_ADJUSTABLE",
            clearOpeningAboveMm: 350,
            thicknessMm: 18,
            depthMm: 550
          }
        ]
      }
    ],
    doors: {
      count: 4,
      thicknessMm: 18,
      bumperGapMm: 2,
      finishedWidthMm: 447.5,
      finishedHeightMm: 2296,
      reveals: {
        topMm: 2,
        bottomMm: 2,
        leftMm: 2,
        rightMm: 2,
        interDoorMm: 2
      }
    },
    materials: {
      carcass: {
        code: "MEL_WHITE_18",
        name: "18mm White Melamine Particleboard",
        thicknessMm: 18
      },
      backPanel: {
        code: "HDF_WHITE_6",
        name: "6mm White HDF Backer",
        thicknessMm: 6
      },
      fronts: {
        code: "MEL_WHITE_18",
        name: "18mm White Melamine Particleboard",
        thicknessMm: 18
      }
    },
    edgeBanding: {
      frontVisibleMm: 1,
      rearUnbandedMm: 0,
      doorPerimeterMm: 1
    },
    clearancePolicy: {
      adjustableShelf: {
        sideClearanceMm: 1,
        frontSetbackMm: 5
      },
      backPanel: {
        grooveRootAllowanceMm: 1
      }
    },
    hardware: {
      hinges: {
        type: "CONCEALED_110",
        countPerDoor: 5,
        totalCount: 20,
        status: "BLOCKED_PENDING_HARDWARE_APPROVAL",
        note: "HARDWARE_SKU_PENDING_BEKZOD_CONFIRMATION"
      },
      shelfPins: {
        type: "SYSTEM_32_PIN_5MM",
        pitchMm: 32,
        status: "BLOCKED_PENDING_HARDWARE_APPROVAL"
      },
      joinery: {
        type: "CONFIRMAT_AND_DOWEL",
        status: "BLOCKED_PENDING_HARDWARE_APPROVAL"
      },
      hangingRails: {
        type: "OVAL_TUBE_15X30",
        status: "PREVIEW_ONLY"
      }
    },
    machiningPolicy: {
      backGroove: "APPROVED",
      drilling: "BLOCKED_PENDING_HARDWARE_APPROVAL"
    }
  };

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
        if (!Object.values(SIDE_INSET_STATUS).includes(plinth.sideInsetStatus)) {
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
    const plinthSideInsetDmm = assertDeciMm(furniSpec.plinth.sideInsetMm, "plinth.sideInsetMm");
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
    const zPlinthRearMaxDmm = zCarcassRearDmm - grvRearDatumDmm;
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

  // src/lib/adapters/partGraphToThree.js
  var THREE = __toESM(require_three());
  var DMM_TO_THREE = 1e-4;
  function createPartGraphMaterials(threeInstance = THREE) {
    return {
      CARCASS: new threeInstance.MeshStandardMaterial({
        color: 16118765,
        roughness: 0.65,
        metalness: 0.02,
        name: "mat_carcass_white_melamine"
      }),
      DOOR: new threeInstance.MeshStandardMaterial({
        color: 16513525,
        roughness: 0.4,
        metalness: 0.05,
        name: "mat_door_front_melamine"
      }),
      BACK_PANEL: new threeInstance.MeshStandardMaterial({
        color: 15065557,
        roughness: 0.85,
        metalness: 0,
        name: "mat_back_panel_hdf"
      }),
      PLINTH: new threeInstance.MeshStandardMaterial({
        color: 4012598,
        roughness: 0.75,
        metalness: 0.1,
        name: "mat_plinth_fascia"
      }),
      EDGE: new threeInstance.LineBasicMaterial({
        color: 2368031,
        transparent: true,
        opacity: 0.35,
        name: "mat_door_edge"
      }),
      DEFAULT: new threeInstance.MeshStandardMaterial({
        color: 14276043,
        roughness: 0.5,
        metalness: 0.05,
        name: "mat_default_panel"
      })
    };
  }
  function getMaterialForRole(role, materials) {
    switch (role) {
      case "TOP_PANEL":
      case "BOTTOM_PANEL":
      case "SIDE_PANEL_LEFT":
      case "SIDE_PANEL_RIGHT":
      case "DIVIDER_PANEL":
      case "FIXED_SHELF":
      case "ADJUSTABLE_SHELF":
        return materials.CARCASS;
      case "DOOR_PANEL":
        return materials.DOOR;
      case "BACK_PANEL":
        return materials.BACK_PANEL;
      case "PLINTH_FRONT_FASCIA":
      case "PLINTH_REAR_RAIL":
      case "PLINTH_SIDE_RETURN_LEFT":
      case "PLINTH_SIDE_RETURN_RIGHT":
      case "PLINTH_CROSS_STRETCHER":
        return materials.PLINTH;
      default:
        return materials.DEFAULT;
    }
  }
  function partGraphToThree(partGraph, options = {}) {
    if (!partGraph || typeof partGraph !== "object") {
      throw new TypeError("partGraphToThree requires a valid PartGraph object.");
    }
    if (!Array.isArray(partGraph.parts)) {
      throw new TypeError("partGraphToThree: partGraph.parts must be an array.");
    }
    const T = options.threeInstance || THREE;
    const rootGroup = new T.Group();
    rootGroup.name = `furniture_${partGraph.sourceSpecId || "partgraph"}`;
    const materials = createPartGraphMaterials(T);
    const allocatedMaterials = Object.values(materials);
    const doorParts = partGraph.parts.filter(
      (p) => p.role === "DOOR_PANEL" || typeof p.id === "string" && p.id.startsWith("DOOR_")
    );
    const doorPivots = [];
    for (const part of partGraph.parts) {
      const { placement, finished, id, role } = part;
      if (!placement) {
        throw new Error(`Part "${id}" is missing placement coordinates.`);
      }
      const widthDmm = placement.maxXDmm - placement.minXDmm;
      const heightDmm = placement.maxYDmm - placement.minYDmm;
      const depthDmm = placement.maxZDmm - placement.minZDmm;
      const widthThree = widthDmm * DMM_TO_THREE;
      const heightThree = heightDmm * DMM_TO_THREE;
      const depthThree = depthDmm * DMM_TO_THREE;
      const centerXDmm = (placement.minXDmm + placement.maxXDmm) / 2;
      const centerYDmm = (placement.minYDmm + placement.maxYDmm) / 2;
      const centerZDmm = (placement.minZDmm + placement.maxZDmm) / 2;
      const geometry = new T.BoxGeometry(widthThree, heightThree, depthThree);
      const material = getMaterialForRole(role, materials);
      const mesh = new T.Mesh(geometry, material);
      mesh.name = `part_${id}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const isDoor = role === "DOOR_PANEL" || typeof id === "string" && id.startsWith("DOOR_");
      if (isDoor) {
        const edgeGeometry = new T.EdgesGeometry(geometry);
        const edgeLine = new T.LineSegments(edgeGeometry, materials.EDGE);
        edgeLine.name = `edges_${id}`;
        mesh.add(edgeLine);
        const doorIdx = doorParts.indexOf(part);
        const isLeftHinged = doorIdx % 2 === 0;
        const hinge = isLeftHinged ? "left" : "right";
        const pivotX = isLeftHinged ? placement.minXDmm * DMM_TO_THREE : placement.maxXDmm * DMM_TO_THREE;
        const pivotY = centerYDmm * DMM_TO_THREE;
        const pivotZ = centerZDmm * DMM_TO_THREE;
        const openY = isLeftHinged ? Math.PI * 0.55 : -Math.PI * 0.55;
        const pivot = new T.Group();
        pivot.name = `pivot_${id}`;
        pivot.position.set(pivotX, pivotY, pivotZ);
        pivot.userData = {
          interactive: true,
          kind: "door",
          openY,
          cur: 0,
          base: 0,
          hover: 0,
          suppress: 0,
          partId: id,
          hinge
        };
        const meshRelX = isLeftHinged ? widthThree / 2 : -widthThree / 2;
        mesh.position.set(meshRelX, 0, 0);
        mesh.userData = {
          partId: id,
          role,
          finishedDimensionsMm: finished ? {
            lengthMm: finished.lengthDmm / 10,
            widthMm: finished.widthDmm / 10,
            thicknessMm: finished.thicknessDmm / 10
          } : null,
          placementDmm: {
            minXDmm: placement.minXDmm,
            maxXDmm: placement.maxXDmm,
            minYDmm: placement.minYDmm,
            maxYDmm: placement.maxYDmm,
            minZDmm: placement.minZDmm,
            maxZDmm: placement.maxZDmm
          },
          sourceSpecId: partGraph.sourceSpecId || null,
          interactive: true,
          pivot,
          hinge
        };
        pivot.add(mesh);
        rootGroup.add(pivot);
        doorPivots.push(pivot);
      } else {
        mesh.position.set(
          centerXDmm * DMM_TO_THREE,
          centerYDmm * DMM_TO_THREE,
          centerZDmm * DMM_TO_THREE
        );
        mesh.userData = {
          partId: id,
          role,
          finishedDimensionsMm: finished ? {
            lengthMm: finished.lengthDmm / 10,
            widthMm: finished.widthDmm / 10,
            thicknessMm: finished.thicknessDmm / 10
          } : null,
          placementDmm: {
            minXDmm: placement.minXDmm,
            maxXDmm: placement.maxXDmm,
            minYDmm: placement.minYDmm,
            maxYDmm: placement.maxYDmm,
            minZDmm: placement.minZDmm,
            maxZDmm: placement.maxZDmm
          },
          sourceSpecId: partGraph.sourceSpecId || null,
          interactive: true
        };
        rootGroup.add(mesh);
      }
    }
    rootGroup.userData = {
      sourceSpecId: partGraph.sourceSpecId,
      partGraphVersion: partGraph.partGraphVersion,
      structuralPartCount: partGraph.parts.length,
      materials: allocatedMaterials,
      materialMap: materials,
      doorPivots,
      dispose: () => disposePartGraphGroup(rootGroup)
    };
    if (options.centerOrigin && partGraph.summary?.envelope) {
      const env = partGraph.summary.envelope;
      rootGroup.position.set(
        -env.widthDmm / 2 * DMM_TO_THREE,
        -env.heightDmm / 2 * DMM_TO_THREE,
        -env.depthDmm / 2 * DMM_TO_THREE
      );
    }
    return rootGroup;
  }
  function disposePartGraphGroup(group) {
    if (!group) return;
    const materialsToDispose = /* @__PURE__ */ new Set();
    group.traverse((obj) => {
      if (obj.geometry && typeof obj.geometry.dispose === "function") {
        obj.geometry.dispose();
      }
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m && materialsToDispose.add(m));
        } else {
          materialsToDispose.add(obj.material);
        }
      }
    });
    if (group.userData?.materials && Array.isArray(group.userData.materials)) {
      group.userData.materials.forEach((mat) => mat && materialsToDispose.add(mat));
    }
    materialsToDispose.forEach((mat) => {
      if (typeof mat.dispose === "function") {
        mat.dispose();
      }
    });
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }
  }

  // src/lib/adapters/browserBridge.js
  var FALLBACK_MAT = {
    oak: { color: 13150330, rough: 0.75, metal: 0 },
    walnut: { color: 7230006, rough: 0.7, metal: 0 },
    white: { color: 15921644, rough: 0.45, metal: 0 },
    grey: { color: 5132114, rough: 0.5, metal: 0 },
    taupe: { color: 11575956, rough: 0.55, metal: 0 },
    cream: { color: 15130061, rough: 0.5, metal: 0 },
    black: { color: 1842204, rough: 0.4, metal: 0 },
    navy: { color: 2899536, rough: 0.55, metal: 0 },
    sage: { color: 10268552, rough: 0.55, metal: 0 },
    terracotta: { color: 11887901, rough: 0.6, metal: 0 },
    mahogany: { color: 7287593, rough: 0.68, metal: 0 },
    ash: { color: 14274752, rough: 0.72, metal: 0 },
    ivory: { color: 16117990, rough: 0.42, metal: 0 }
  };
  function updateParametricMaterial(builder, matKey) {
    if (!builder || !builder.scene) return;
    const MAT = typeof window !== "undefined" && window.MAT || typeof globalThis !== "undefined" && globalThis.MAT || FALLBACK_MAT;
    const matDef = MAT && MAT[matKey] || FALLBACK_MAT[matKey] || { color: 15262940, rough: 0.6, metal: 0 };
    const furnitureGroup = builder.parts.find(
      (p) => p && p.userData && p.userData.materialMap
    ) || builder.scene.getObjectByName("furniture_furnispec-golden-wardrobe-01");
    if (!furnitureGroup || !furnitureGroup.userData?.materialMap) {
      return;
    }
    const materials = furnitureGroup.userData.materialMap;
    const color = matDef.color;
    const rough = matDef.rough !== void 0 ? matDef.rough : 0.6;
    const metal = matDef.metal !== void 0 ? matDef.metal : 0.02;
    if (materials.CARCASS) {
      materials.CARCASS.color.setHex(color);
      materials.CARCASS.roughness = rough;
      materials.CARCASS.metalness = metal;
      materials.CARCASS.needsUpdate = true;
    }
    if (materials.DOOR) {
      materials.DOOR.color.setHex(color);
      materials.DOOR.roughness = Math.max(0.25, rough * 0.9);
      materials.DOOR.metalness = metal;
      materials.DOOR.needsUpdate = true;
    }
    if (materials.PLINTH) {
      const dkFn = typeof window !== "undefined" && typeof window.dk === "function" ? window.dk : null;
      const plinthColor = dkFn ? dkFn(color, 0.75) : color;
      materials.PLINTH.color.setHex(plinthColor);
      materials.PLINTH.roughness = Math.max(0.7, rough);
      materials.PLINTH.metalness = metal;
      materials.PLINTH.needsUpdate = true;
    }
    builder.parametricMat = matKey;
    if (typeof document !== "undefined") {
      const swatches = document.querySelectorAll(".b-sw");
      swatches.forEach((s) => {
        s.classList.toggle("active", s.dataset.mat === matKey);
      });
    }
  }
  function loadGoldenWardrobe(builder) {
    if (!builder || !builder.scene) {
      throw new Error("Builder and Builder.scene are required.");
    }
    builder.clear();
    const validation = validateFurniSpec(goldenWardrobe_fixture_default);
    if (!validation.valid) {
      throw new Error(
        "Golden FurniSpec validation failed: " + JSON.stringify(validation.errors)
      );
    }
    const partGraph = buildStructuralPartGraph(goldenWardrobe_fixture_default);
    const THREE2 = typeof window !== "undefined" && window.THREE || globalThis.THREE;
    const furnitureGroup = partGraphToThree(partGraph, { threeInstance: THREE2 });
    const env = partGraph.summary.envelope;
    const envW = env.widthDmm * DMM_TO_THREE;
    const envH = env.heightDmm * DMM_TO_THREE;
    const envD = env.depthDmm * DMM_TO_THREE;
    furnitureGroup.position.set(-envW / 2, -envH / 2, -envD / 2);
    builder.attach(furnitureGroup);
    builder.doorObjs = [];
    if (Array.isArray(furnitureGroup.userData?.doorPivots)) {
      builder.doorObjs.push(...furnitureGroup.userData.doorPivots);
    }
    const fl = builder.scene.getObjectByName("floor");
    if (fl) {
      fl.position.y = -envH / 2 - 1e-3;
    }
    builder.camDist = 4.8;
    builder.rotY = Math.PI - 0.42;
    builder.rotX = 0.06;
    builder.lookAtZ = 0;
    const currentMat = builder.parametricMat || "white";
    updateParametricMaterial(builder, currentMat);
    return {
      partGraph,
      furnitureGroup,
      envelope: {
        widthMm: envW * 1e3,
        heightMm: envH * 1e3,
        depthMm: envD * 1e3
      },
      partCount: partGraph.parts.length,
      doorCount: builder.doorObjs.length
    };
  }
  return __toCommonJS(browserBridge_exports);
})();
