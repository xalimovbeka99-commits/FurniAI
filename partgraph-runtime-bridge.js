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
    ACCEPTED_DIMENSION_UNITS: () => ACCEPTED_DIMENSION_UNITS,
    APPROVAL_STATE: () => APPROVAL_STATE,
    BEKZOD_APPROVED_DEFAULTS: () => BEKZOD_APPROVED_DEFAULTS,
    DMM_TO_THREE: () => DMM_TO_THREE,
    OBSERVATION_ORIGIN: () => OBSERVATION_ORIGIN,
    PIPELINE_STAGE: () => PIPELINE_STAGE,
    applyConversationalEdit: () => applyConversationalEdit,
    approveAndPreview: () => approveAndPreview,
    buildCutListRows: () => buildCutListRows,
    buildStructuralPartGraph: () => buildStructuralPartGraph,
    compileCabinetDxfPackage: () => compileCabinetDxfPackage,
    compileNestingManifest: () => compileNestingManifest,
    compilePanelToDxf: () => compilePanelToDxf,
    createDeterministicPhraseAdapter: () => createDeterministicPhraseAdapter,
    createProposal: () => createProposal,
    createZipBuffer: () => createZipBuffer,
    disposePartGraphGroup: () => disposePartGraphGroup,
    draftPreviewSafety: () => draftPreviewSafety,
    exportCabinetDxfZip: () => exportCabinetDxfZip,
    exportCutListCSV: () => exportCutListCSV,
    exportShopDrawingsPDF: () => exportShopDrawingsPDF,
    exportShopDrawingsSVG: () => exportShopDrawingsSVG,
    formatNestingReport: () => formatNestingReport,
    generateCutListCsv: () => generateCutListCsv,
    generateShopDrawingsSVG: () => generateShopDrawingsSVG,
    goldenSpec: () => goldenWardrobe_fixture_default,
    loadApprovedPartGraph: () => loadApprovedPartGraph,
    loadDraftPartGraph: () => loadDraftPartGraph,
    loadGoldenWardrobe: () => loadGoldenWardrobe,
    parseAndValidateClarifyInput: () => parseAndValidateClarifyInput,
    parseConversationalCommand: () => parseConversationalCommand,
    parseDimension: () => parseDimension,
    partGraphToThree: () => partGraphToThree,
    previewDraftWardrobe: () => previewDraftWardrobe,
    proposeWardrobe: () => proposeWardrobe,
    runConversationToWardrobe: () => runConversationToWardrobe,
    updateParametricMaterial: () => updateParametricMaterial,
    validateApproval: () => validateApproval,
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
      frontRecessMm: 0,
      sideInsetMm: 0,
      sideInsetStatus: "BEKZOD_APPROVED"
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
    PLINTH_CROSS_STRETCHER: "PLINTH_CROSS_STRETCHER",
    DRAWER_FRONT: "DRAWER_FRONT",
    DRAWER_SIDE_L: "DRAWER_SIDE_L",
    DRAWER_SIDE_R: "DRAWER_SIDE_R",
    DRAWER_BACK: "DRAWER_BACK",
    DRAWER_BOTTOM: "DRAWER_BOTTOM"
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

  // src/lib/partgraph/componentOutcomes.js
  var COMPONENT_OUTCOME = Object.freeze({
    STRUCTURAL: "STRUCTURAL",
    PREVIEW: "PREVIEW",
    UNSUPPORTED: "UNSUPPORTED"
  });
  var COMPONENT_DIAGNOSTIC_CODE = Object.freeze({
    /** The kernel has no representation for this component type at all. */
    COMPONENT_NOT_REPRESENTED: "COMPONENT_NOT_REPRESENTED",
    /** The type passed FurniSpec validation but no policy is declared here. */
    UNDECLARED_COMPONENT_TYPE: "UNDECLARED_COMPONENT_TYPE",
    /** The type is representable but this instance could not be placed. */
    COMPONENT_NOT_PLACED: "COMPONENT_NOT_PLACED"
  });
  var COMPONENT_REPRESENTATION_POLICY = Object.freeze({
    [COMPONENT_TYPES.SHELF_FIXED]: Object.freeze({
      outcome: COMPONENT_OUTCOME.STRUCTURAL,
      representation: "Fixed shelf panel cut to the clear bay width."
    }),
    [COMPONENT_TYPES.SHELF_ADJUSTABLE]: Object.freeze({
      outcome: COMPONENT_OUTCOME.STRUCTURAL,
      representation: "Adjustable shelf panel, inset by the clearance policy."
    }),
    [COMPONENT_TYPES.HANGING_RAIL_LONG]: Object.freeze({
      outcome: COMPONENT_OUTCOME.PREVIEW,
      previewKind: "HANGING_RAIL",
      representation: "Bought hanging rail. Not a cut panel. Recorded as a placement datum (rail centre height) and, where the preview lane is enabled, drawn as a PREVIEW_ONLY visual."
    }),
    [COMPONENT_TYPES.HANGING_RAIL_SHORT]: Object.freeze({
      outcome: COMPONENT_OUTCOME.PREVIEW,
      previewKind: "HANGING_RAIL",
      representation: "Bought hanging rail. Not a cut panel. Recorded as a placement datum (rail centre height) and, where the preview lane is enabled, drawn as a PREVIEW_ONLY visual."
    }),
    [COMPONENT_TYPES.DRAWER_BANK]: Object.freeze({
      outcome: COMPONENT_OUTCOME.STRUCTURAL,
      representation: "Drawer pack panels (front, sides, back, bottom) cut from the approved undermount concealed 21 mm runner family and 2.0 mm perimeter reveal. Hardware drilling / CNC remain blocked."
    })
  });
  function createComponentLedger() {
    const entries = /* @__PURE__ */ new Map();
    function key(bayIndex, componentId) {
      return `${bayIndex}:${componentId}`;
    }
    function put(entry) {
      const k = key(entry.bayIndex, entry.componentId);
      if (entries.has(k)) {
        throw new Error(
          `Component "${entry.componentId}" in bay ${entry.bayIndex} was recorded twice in the outcome ledger.`
        );
      }
      entries.set(k, Object.freeze(entry));
    }
    return {
      /** A component that produced real manufacturing parts. */
      recordStructural(comp, bayIndex, partIds) {
        const policy = COMPONENT_REPRESENTATION_POLICY[comp.type];
        put({
          componentId: comp.id,
          componentType: comp.type,
          bayIndex,
          outcome: COMPONENT_OUTCOME.STRUCTURAL,
          partIds: Object.freeze([...partIds]),
          representation: policy?.representation ?? null
        });
      },
      /**
       * A component represented visually and/or by a placement datum, never as a
       * cut part. `datum` documents what the kernel actually computed (for a
       * hanging rail: its centre height), so the outcome is meaningful even when
       * the visual preview lane is not enabled on this branch.
       */
      recordPreview(comp, bayIndex, datum = null) {
        const policy = COMPONENT_REPRESENTATION_POLICY[comp.type];
        put({
          componentId: comp.id,
          componentType: comp.type,
          bayIndex,
          outcome: COMPONENT_OUTCOME.PREVIEW,
          previewKind: policy?.previewKind ?? null,
          partIds: Object.freeze([]),
          placementDatum: datum ? Object.freeze({ ...datum }) : null,
          representation: policy?.representation ?? null
        });
      },
      /**
       * A component the kernel cannot represent. `overrides` lets a caller
       * narrow the diagnostic (e.g. COMPONENT_NOT_PLACED) without duplicating
       * the customer-facing copy.
       */
      recordUnsupported(comp, bayIndex, overrides = {}) {
        const policy = COMPONENT_REPRESENTATION_POLICY[comp.type];
        const undeclared = !policy;
        put({
          componentId: comp.id,
          componentType: comp.type,
          bayIndex,
          outcome: COMPONENT_OUTCOME.UNSUPPORTED,
          partIds: Object.freeze([]),
          diagnosticCode: overrides.diagnosticCode ?? policy?.diagnosticCode ?? COMPONENT_DIAGNOSTIC_CODE.UNDECLARED_COMPONENT_TYPE,
          reason: overrides.reason ?? policy?.reason ?? `Component type "${comp.type}" passed FurniSpec validation but no representation policy is declared for it.`,
          customerMessage: overrides.customerMessage ?? policy?.customerMessage ?? "I couldn't include one of the parts you asked for in this design. Everything else is unchanged.",
          suggestedAlternative: policy?.suggestedAlternative ?? null,
          undeclared
        });
      },
      /** Has this component already been accounted for? */
      has(comp, bayIndex) {
        return entries.has(key(bayIndex, comp.id));
      },
      finish() {
        const list = Object.freeze([...entries.values()]);
        const count = (outcome) => list.filter((e) => e.outcome === outcome).length;
        return {
          componentOutcomes: list,
          counts: Object.freeze({
            totalComponents: list.length,
            structuralComponents: count(COMPONENT_OUTCOME.STRUCTURAL),
            previewComponents: count(COMPONENT_OUTCOME.PREVIEW),
            unsupportedComponents: count(COMPONENT_OUTCOME.UNSUPPORTED)
          })
        };
      }
    };
  }
  function unsupportedComponentsForCustomer(componentOutcomes = []) {
    return componentOutcomes.filter((e) => e.outcome === COMPONENT_OUTCOME.UNSUPPORTED).map((e) => ({
      request: e.componentId,
      componentType: e.componentType,
      bayIndex: e.bayIndex,
      code: e.diagnosticCode,
      reason: e.customerMessage,
      engineeringReason: e.reason,
      alternative: e.suggestedAlternative ? e.suggestedAlternative.summary : null,
      alternativeApplied: false
    }));
  }

  // src/lib/rules/wardrobeRuleCatalog.js
  var RULE_PROVENANCE = Object.freeze({
    RULEBOOK_V0_1: "RULEBOOK_V0_1",
    GOLDEN_FIXTURE_BEKZOD_APPROVED: "GOLDEN_FIXTURE_BEKZOD_APPROVED",
    BEKZOD_RULING: "BEKZOD_RULING",
    REQUIRES_BEKZOD_RULING: "REQUIRES_BEKZOD_RULING"
  });
  function rule(id, value, provenance, note) {
    return Object.freeze({ id, value, provenance, note });
  }
  var { RULEBOOK_V0_1, GOLDEN_FIXTURE_BEKZOD_APPROVED, BEKZOD_RULING, REQUIRES_BEKZOD_RULING } = RULE_PROVENANCE;
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
    // --- Bekzod hardware rulings 2026-09-15 (SYSTEM32_BORING_SCOPE §6 answered).
    // CNC / drilling coordinates remain BLOCKED; these unlock rule *values* only.
    shelfPinHoleDepthMm: rule(
      "BEK-SHELF-PIN-DEPTH",
      13,
      BEKZOD_RULING,
      "Bekzod ruling: shelf-pin hole depth 13.0 mm in 18 mm board. For 16 mm board use 11.5 mm (shelfPinHoleDepthMmByBoardThickness)."
    ),
    shelfPinHoleDepthMmByBoardThickness: rule(
      "BEK-SHELF-PIN-DEPTH-BY-BOARD",
      Object.freeze({ 18: 13, 16: 11.5 }),
      BEKZOD_RULING,
      "Thickness variants for shelf-pin hole depth (mm keyed by board thickness mm)."
    ),
    shelfPinColumnOriginDatum: rule(
      "BEK-SHELF-PIN-ORIGIN",
      "BOTTOM_PANEL_UPPER_FACE_PLUS_64MM",
      BEKZOD_RULING,
      "Bekzod ruling: column origin = bottom panel upper face + 64 mm. Upper bound term TOP_PANEL_LOWER_FACE_MINUS_64MM is the mirror datum."
    ),
    shelfPinColumnOriginUpperDatum: rule(
      "BEK-SHELF-PIN-ORIGIN-UPPER",
      "TOP_PANEL_LOWER_FACE_MINUS_64MM",
      BEKZOD_RULING,
      "Upper-column mirror datum for shelf-pin System 32 columns."
    ),
    shelfPinRearRowPolicy: rule(
      "BEK-SHELF-PIN-REAR-ROW",
      "BORED_MIRROR_FRONT_37MM",
      BEKZOD_RULING,
      "Bekzod ruling: rear row is bored, mirroring the front 37 mm edge setback."
    ),
    drawerRunnerFamily: rule(
      "BEK-DRAWER-RUNNER",
      "UNDERMOUNT_CONCEALED_21MM",
      BEKZOD_RULING,
      "Bekzod ruling: concealed undermount runner family; 21 mm total clear-width reduction."
    ),
    drawerSlideWidthDeductionMm: rule(
      "BEK-DRAWER-SLIDE-DEDUCTION",
      21,
      BEKZOD_RULING,
      "Bekzod ruling: undermount total width reduction 21.0 mm (box clear width = bay - 21)."
    ),
    drawerFrontRevealMm: rule(
      "BEK-DRAWER-FRONT-REVEAL",
      2,
      BEKZOD_RULING,
      "Bekzod ruling: 2.0 mm perimeter reveal on all sides of each drawer front."
    ),
    // --- NOT approved. Reading these through resolve() throws by design.
    bayCountForWidth: rule("UNRULED-BAY-COUNT", null, REQUIRES_BEKZOD_RULING, "No approved rule maps overall width to a bay count. Must be asked."),
    // Ruled 2026-09-18 (RULEBOOK_V0_2_DOORS_PER_BAY). Supersedes
    // UNRULED-DOORS-PER-BAY, which resolve() threw on. Keyed on the BAY's clear
    // width, not the wardrobe's overall width: two 900mm bays and one 1800mm bay
    // are different cabinets.
    doorsPerBayThresholdMm: rule("RULEBOOK_V0_2_DOORS_PER_BAY", 600, BEKZOD_RULING, "A bay at or above this clear width takes two door leaves; below it, one."),
    doorsPerBayAtOrAboveThreshold: rule("RULEBOOK_V0_2_DOORS_PER_BAY", 2, BEKZOD_RULING, "Leaves for a bay whose clear width is >= the threshold."),
    doorsPerBayBelowThreshold: rule("RULEBOOK_V0_2_DOORS_PER_BAY", 1, BEKZOD_RULING, "Leaves for a bay whose clear width is < the threshold."),
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
  function doorsForBayWidth(bayClearWidthMm) {
    if (!Number.isFinite(bayClearWidthMm) || bayClearWidthMm <= 0) {
      const err = new Error(
        `Cannot choose a door count for a bay of "${bayClearWidthMm}"mm. The ruling is keyed on bay clear width, which must be known.`
      );
      err.code = "DOORS_PER_BAY_AMBIGUOUS";
      throw err;
    }
    return bayClearWidthMm >= resolve("doorsPerBayThresholdMm") ? resolve("doorsPerBayAtOrAboveThreshold") : resolve("doorsPerBayBelowThreshold");
  }
  function ruleIdOf(key) {
    const record = WARDROBE_RULES[key];
    if (!record) throw new Error(`Unknown rule key "${key}".`);
    return record.id;
  }

  // src/lib/partgraph/emitDrawerBankParts.js
  var DEFAULT_DRAWER_ROW_HEIGHT_MM = 180;
  var DRAWER_BOX_SIDE_THICKNESS_MM = 15;
  var DRAWER_SIDE_DEPTH_SETBACK_MM = 50;
  var DRAWER_BOTTOM_SIDE_INSET_TOTAL_MM = 10;
  var DRAWER_BOTTOM_MATERIAL_CODE = "HDF_WHITE_6";
  var DRAWER_BOTTOM_THICKNESS_MM = 6;
  function emitDrawerBankParts({
    comp,
    bay,
    yBotTopDmm,
    zCarcassFrontDmm,
    carcassDepthMm,
    matCarcass,
    matFront,
    edgeFrontDmm,
    edgeRearDmm,
    toDeciMm: toDeciMm2
  }) {
    const revealMm = resolve("drawerFrontRevealMm");
    const slideDeductionMm = resolve("drawerSlideWidthDeductionMm");
    const frontThicknessMm = resolve("panelThicknessMm");
    const bottomThicknessMm = DRAWER_BOTTOM_THICKNESS_MM;
    const rows = Math.max(1, Number(comp.rows) || 1);
    const bankHeightMm = comp.heightMm != null ? Number(comp.heightMm) : rows * DEFAULT_DRAWER_ROW_HEIGHT_MM;
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
    const degenerate = [
      ["front width", frontWidthMm],
      ["front height", frontHeightMm],
      ["box height", boxHeightMm],
      ["side length", sideLengthMm],
      ["back width", backWidthMm],
      ["bottom width", bottomWidthMm],
      ["bottom depth", bottomDepthMm],
      ["bottom thickness", bottomThicknessMm]
    ].filter(([, value]) => !(value > 0));
    if (degenerate.length > 0) {
      const err = new Error(
        `Drawer bank "${comp.id}" computes non-positive ${degenerate.map(([what, value]) => `${what} (${value}mm)`).join(", ")}. A ${bayWidthMm}mm bay cannot carry a drawer box: the back is bay - ${slideDeductionMm} - 2 x ${DRAWER_BOX_SIDE_THICKNESS_MM}, so the bay must exceed ${slideDeductionMm + 2 * DRAWER_BOX_SIDE_THICKNESS_MM}mm.`
      );
      err.code = "DEGENERATE_DRAWER_GEOMETRY";
      throw err;
    }
    const halfDeductionMm = slideDeductionMm / 2;
    const boxMinXMm = bay.minXDmm / 10 + halfDeductionMm;
    const boxMaxXMm = bay.maxXDmm / 10 - halfDeductionMm;
    const offsetBottomMm = Number(comp.offsetFromBottomMm ?? 0);
    const bankBottomYDmm = yBotTopDmm + toDeciMm2(offsetBottomMm, `${comp.id}.offsetFromBottomMm`);
    const baseId = (comp.partId || comp.id).toUpperCase().replace(/-/g, "_");
    const sourceRuleIds = [
      ruleIdOf("drawerFrontRevealMm"),
      ruleIdOf("drawerSlideWidthDeductionMm"),
      ruleIdOf("drawerRunnerFamily"),
      ruleIdOf("panelThicknessMm")
    ];
    const panels = [];
    const partIds = [];
    for (let r = 0; r < rows; r++) {
      const rowTag = `R${String(r + 1).padStart(2, "0")}`;
      const apertureMinYMm = offsetBottomMm + r * drawerHeightMm + yBotTopDmm / 10;
      const apertureMinYDmm = bankBottomYDmm + toDeciMm2(r * drawerHeightMm, `${comp.id}.row${r}`);
      const apertureMaxYDmm = apertureMinYDmm + toDeciMm2(drawerHeightMm, `${comp.id}.drawerH`);
      const revealDmm = toDeciMm2(revealMm, "drawerFrontRevealMm");
      const frontMinYDmm = apertureMinYDmm + revealDmm;
      const frontMaxYDmm = apertureMaxYDmm - revealDmm;
      const frontWidthDmm = toDeciMm2(frontWidthMm, "drawerFrontWidth");
      const frontHeightDmm = toDeciMm2(frontHeightMm, "drawerFrontHeight");
      const frontThickDmm = toDeciMm2(frontThicknessMm, "drawerFrontThickness");
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
          WIDTH_EDGE_2: edgeFrontDmm
        },
        sourceRuleIds
      });
      partIds.push(frontId);
      const boxHDmm = toDeciMm2(boxHeightMm, "drawerBoxHeight");
      const sideThickDmm = toDeciMm2(DRAWER_BOX_SIDE_THICKNESS_MM, "drawerSideT");
      const sideLenDmm = toDeciMm2(sideLengthMm, "drawerSideLen");
      const sideMinYDmm = frontMinYDmm;
      const sideMaxYDmm = sideMinYDmm + boxHDmm;
      const sideMinZDmm = zCarcassFrontDmm + frontThickDmm;
      const sideMaxZDmm = sideMinZDmm + sideLenDmm;
      const boxMinXDmm = toDeciMm2(boxMinXMm, "boxMinX");
      const boxMaxXDmm = toDeciMm2(boxMaxXMm, "boxMaxX");
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
          WIDTH_EDGE_2: 0
        },
        sourceRuleIds
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
          WIDTH_EDGE_2: 0
        },
        sourceRuleIds
      });
      partIds.push(sideRId);
      const backWidthDmm = toDeciMm2(backWidthMm, "drawerBackW");
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
          WIDTH_EDGE_2: 0
        },
        sourceRuleIds
      });
      partIds.push(backId);
      const bottomWidthDmm = toDeciMm2(bottomWidthMm, "drawerBottomW");
      const bottomDepthDmm = toDeciMm2(bottomDepthMm, "drawerBottomD");
      const bottomThickDmm = toDeciMm2(bottomThicknessMm, "drawerBottomT");
      const bottomInsetDmm = toDeciMm2(DRAWER_BOTTOM_SIDE_INSET_TOTAL_MM / 2, "bottomInset");
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
          WIDTH_EDGE_2: 0
        },
        sourceRuleIds
      });
      partIds.push(bottomId);
    }
    return { panels, partIds };
  }

  // src/lib/partgraph/buildStructuralPartGraph.js
  function resolveHangingRailTube(tubeType) {
    const raw = String(tubeType || "OVAL_TUBE_15X30").toUpperCase();
    let m = raw.match(/^OVAL_TUBE_(\d+(?:\.\d+)?)X(\d+(?:\.\d+)?)$/);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      const minorDiamMm = Math.min(a, b);
      const majorDiamMm = Math.max(a, b);
      return {
        tubeType: raw,
        tubeTypeResolved: true,
        profile: "OVAL",
        minorDiamMm,
        majorDiamMm,
        assumptionNotes: [
          `Parsed ${raw}: minor(vertical)=${minorDiamMm}mm, major(depth)=${majorDiamMm}mm.`
        ]
      };
    }
    m = raw.match(/^ROUND_(?:D|DIA)?_?(\d+(?:\.\d+)?)$/);
    if (m) {
      const d = Number(m[1]);
      return {
        tubeType: raw,
        tubeTypeResolved: true,
        profile: "ROUND",
        minorDiamMm: d,
        majorDiamMm: d,
        assumptionNotes: [`Parsed ${raw}: round diameter ${d}mm.`]
      };
    }
    return {
      tubeType: raw,
      tubeTypeResolved: false,
      profile: "OVAL",
      minorDiamMm: 15,
      majorDiamMm: 30,
      assumptionNotes: [
        `Unknown tubeType "${raw}" \u2014 rendered as fixed OVAL 15\xD730 mm fallback (limitation).`,
        "Supported patterns: OVAL_TUBE_<minor>X<major>, ROUND_D<diam> / ROUND_<diam>."
      ]
    };
  }
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
    const drawerPanels = [];
    const previews = [];
    const ledger = createComponentLedger();
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
          ledger.recordStructural(comp, bay.index, [partId]);
        } else if (comp.type.startsWith("HANGING_RAIL")) {
          const offsetBelowDmm = assertDeciMm(comp.offsetBelowShelfMm, `${comp.id}.offsetBelowShelfMm`);
          currentRailCenterY = currentBottomFaceY - offsetBelowDmm;
          const railHw = furniSpec.hardware?.hangingRails || {};
          const tube = resolveHangingRailTube(railHw.type || "OVAL_TUBE_15X30");
          const endInsetMm = 2;
          const endInsetDmm = Math.round(endInsetMm * 10);
          const minXDmm = bay.minXDmm + endInsetDmm;
          const maxXDmm = bay.maxXDmm - endInsetDmm;
          const centerZDmm = zCarcassFrontDmm + Math.floor(dividerDepthDmm / 2);
          const halfMinorDmm = Math.round(tube.minorDiamMm / 2 * 10);
          const halfMajorDmm = Math.round(tube.majorDiamMm / 2 * 10);
          const lengthMm = (maxXDmm - minXDmm) / 10;
          previews.push({
            id: (comp.partId || comp.id).toUpperCase().replace(/-/g, "_"),
            kind: "HANGING_RAIL",
            status: "PREVIEW_ONLY",
            visualConcept: true,
            engineeringVerified: false,
            manufacturingOutput: false,
            sourceComponentId: comp.id,
            sourceComponentType: comp.type,
            tubeType: tube.tubeType,
            tubeTypeResolved: tube.tubeTypeResolved,
            profile: tube.profile,
            bayIndex: bay.index,
            minXDmm,
            maxXDmm,
            minYDmm: currentRailCenterY - halfMinorDmm,
            maxYDmm: currentRailCenterY + halfMinorDmm,
            minZDmm: centerZDmm - halfMajorDmm,
            maxZDmm: centerZDmm + halfMajorDmm,
            centerYDmm: currentRailCenterY,
            centerZDmm,
            assumed: {
              minorDiamMm: tube.minorDiamMm,
              majorDiamMm: tube.majorDiamMm,
              lengthMm,
              endInsetMm,
              offsetBelowShelfMm: comp.offsetBelowShelfMm,
              centerZRule: "zCarcassFront + floor(dividerDepth/2) \u2014 mid carcass depth heuristic",
              centerYRule: "shelfBottomFaceY - offsetBelowShelfMm",
              finishIntent: "chrome metal preview (independent of melamine materialKey)"
            },
            notes: [
              "Visual hanging-rail preview for customer layout comprehension.",
              "Not a PartGraph structural panel; excluded from totalStructuralParts.",
              `Hardware status: ${railHw.status || "PREVIEW_ONLY"}.`,
              ...tube.assumptionNotes
            ]
          });
          ledger.recordPreview(comp, bay.index, {
            previewId: previews[previews.length - 1].id,
            railCenterYDmm: currentRailCenterY,
            bayMinXDmm: bay.minXDmm,
            bayMaxXDmm: bay.maxXDmm
          });
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
          ledger.recordStructural(comp, bay.index, [partId]);
        } else if (comp.type === "DRAWER_BANK") {
          const { panels, partIds } = emitDrawerBankParts({
            comp,
            bay,
            yBotTopDmm,
            zCarcassFrontDmm,
            carcassDepthMm: carcassDDmm / 10,
            matCarcass,
            matFront,
            edgeFrontDmm,
            edgeRearDmm,
            toDeciMm
          });
          for (const panel of panels) drawerPanels.push(panel);
          ledger.recordStructural(comp, bay.index, partIds);
        } else {
          ledger.recordUnsupported(comp, bay.index);
        }
      }
    }
    drawerPanels.sort((a, b) => a.bayIndex - b.bayIndex || a.minYDmm - b.minYDmm);
    for (const d of drawerPanels) {
      parts.push(createPanel(d));
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
    const { componentOutcomes, counts: componentCounts } = ledger.finish();
    for (const entry of componentOutcomes) {
      if (entry.outcome !== "UNSUPPORTED") continue;
      warnings.push({
        code: entry.diagnosticCode,
        message: `Component "${entry.componentId}" (${entry.componentType}) in bay ${entry.bayIndex} is not represented: ${entry.reason}`,
        componentId: entry.componentId,
        componentType: entry.componentType,
        bayIndex: entry.bayIndex
      });
    }
    return {
      partGraphVersion: PARTGRAPH_VERSION,
      sourceSpecId: furniSpec.specId,
      sourceRevision: furniSpec.revision,
      unitScale: "deci-mm",
      qualificationStatus: furniSpec.qualificationStatus,
      parts,
      previews,
      operations,
      warnings,
      componentOutcomes,
      summary: {
        totalStructuralParts: parts.length,
        totalPreviewParts: previews.length,
        totalComponents: componentCounts.totalComponents,
        structuralComponents: componentCounts.structuralComponents,
        previewComponents: componentCounts.previewComponents,
        unsupportedComponents: componentCounts.unsupportedComponents,
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
      HANGING_RAIL: new threeInstance.MeshStandardMaterial({
        color: 12633806,
        roughness: 0.28,
        metalness: 0.85,
        name: "mat_hanging_rail_preview_chrome"
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
        edgeLine.raycast = () => {
        };
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
          hinge,
          doorMesh: mesh
        };
        const meshRelX = isLeftHinged ? widthThree / 2 : -widthThree / 2;
        mesh.position.set(meshRelX, 0, 0);
        mesh.userData = {
          partId: id,
          role,
          isDoorMesh: true,
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
          hinge,
          materialCode: part.materialCode || null,
          rawDimensionsMm: part.raw ? {
            lengthMm: part.raw.lengthDmm / 10,
            widthMm: part.raw.widthDmm / 10,
            thicknessMm: part.raw.thicknessDmm / 10
          } : null,
          edgesMm: part.edges ? {
            lengthEdge1Mm: part.edges.LENGTH_EDGE_1 / 10,
            lengthEdge2Mm: part.edges.LENGTH_EDGE_2 / 10,
            widthEdge1Mm: part.edges.WIDTH_EDGE_1 / 10,
            widthEdge2Mm: part.edges.WIDTH_EDGE_2 / 10
          } : null,
          partData: part
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
          isDoorMesh: false,
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
          interactive: false,
          materialCode: part.materialCode || null,
          rawDimensionsMm: part.raw ? {
            lengthMm: part.raw.lengthDmm / 10,
            widthMm: part.raw.widthDmm / 10,
            thicknessMm: part.raw.thicknessDmm / 10
          } : null,
          edgesMm: part.edges ? {
            lengthEdge1Mm: part.edges.LENGTH_EDGE_1 / 10,
            lengthEdge2Mm: part.edges.LENGTH_EDGE_2 / 10,
            widthEdge1Mm: part.edges.WIDTH_EDGE_1 / 10,
            widthEdge2Mm: part.edges.WIDTH_EDGE_2 / 10
          } : null,
          partData: part
        };
        rootGroup.add(mesh);
      }
    }
    const previewList = Array.isArray(partGraph.previews) ? partGraph.previews : [];
    let previewMeshCount = 0;
    for (const preview of previewList) {
      if (!preview || preview.kind !== "HANGING_RAIL") continue;
      const minX = preview.minXDmm * DMM_TO_THREE;
      const maxX = preview.maxXDmm * DMM_TO_THREE;
      const minY = preview.minYDmm * DMM_TO_THREE;
      const maxY = preview.maxYDmm * DMM_TO_THREE;
      const minZ = preview.minZDmm * DMM_TO_THREE;
      const maxZ = preview.maxZDmm * DMM_TO_THREE;
      const lengthX = Math.max(maxX - minX, 1e-6);
      const diamY = Math.max(maxY - minY, 1e-6);
      const diamZ = Math.max(maxZ - minZ, 1e-6);
      const radius = diamY / 2;
      const geometry = new T.CylinderGeometry(radius, radius, lengthX, 24);
      geometry.rotateZ(Math.PI / 2);
      const mesh = new T.Mesh(geometry, materials.HANGING_RAIL);
      mesh.name = `preview_${preview.id}`;
      mesh.position.set(
        (minX + maxX) / 2,
        (minY + maxY) / 2,
        (minZ + maxZ) / 2
      );
      mesh.scale.set(1, 1, diamZ / diamY);
      mesh.userData = {
        id: preview.id,
        kind: preview.kind,
        status: preview.status || "PREVIEW_ONLY",
        visualConcept: true,
        engineeringVerified: false,
        manufacturingOutput: false,
        isStructuralPanel: false,
        isPreviewMesh: true,
        tubeType: preview.tubeType || null,
        tubeTypeResolved: preview.tubeTypeResolved !== false,
        profile: preview.profile || null,
        assumed: preview.assumed || null,
        bayIndex: preview.bayIndex,
        sourceComponentId: preview.sourceComponentId || null,
        notes: preview.notes || [],
        // Intended finish: chrome preview metal — updateParametricMaterial must NOT recolor this.
        finishIntent: preview.assumed && preview.assumed.finishIntent || "chrome metal preview"
      };
      rootGroup.add(mesh);
      previewMeshCount += 1;
    }
    rootGroup.userData = {
      sourceSpecId: partGraph.sourceSpecId,
      partGraphVersion: partGraph.partGraphVersion,
      structuralPartCount: partGraph.parts.length,
      previewPartCount: previewMeshCount,
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
      if (typeof part.role !== "string" || !Object.prototype.hasOwnProperty.call(PART_ROLES, part.role)) {
        addError(
          "INVALID_PART_ROLE",
          `Part "${part.id}" has role ${JSON.stringify(part.role)}, which is not a declared PART_ROLES member.`,
          part.id
        );
      }
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
          const isDrawerAssemblyOverlap = typeof p1.role === "string" && typeof p2.role === "string" && p1.role.startsWith("DRAWER_") && p2.role.startsWith("DRAWER_");
          if (!isBackPanelEngagement && !isDrawerAssemblyOverlap) {
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
    SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES: "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES",
    /** Bottom drawer bank (STRUCTURAL DRAWER_* pack) with short hanging above. */
    DRAWER_BANK_WITH_SHORT_HANGING: "DRAWER_BANK_WITH_SHORT_HANGING"
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
      } else if (layout === BAY_LAYOUT.DRAWER_BANK_WITH_SHORT_HANGING) {
        components.push({
          id: `drawer-bank-b${nn}`,
          type: "DRAWER_BANK",
          offsetFromBottomMm: 0,
          rows: 3
        });
        components.push({
          id: `rail-short-b${nn}`,
          type: "HANGING_RAIL_SHORT",
          offsetBelowShelfMm: fromDeciMm(railOffsetDmm),
          targetClearDropMm: fromDeciMm(shortDropDmm)
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
  function isFingerprint(value) {
    return typeof value === "string" && /^fs256:[0-9a-f]{64}$/.test(value);
  }

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
  function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  function validateApproval({ proposal, approval }) {
    const errors = [];
    const add = (code, field, message) => errors.push({ code, field, message });
    if (proposal === null || proposal === void 0) {
      add(APPROVAL_ERROR.MISSING_PROPOSAL, "proposal", "There is no proposal to approve.");
      return { valid: false, errors, expectedFingerprint: null };
    }
    if (!isPlainObject(proposal) || !isPlainObject(proposal.spec)) {
      add(APPROVAL_ERROR.INVALID_PROPOSAL, "proposal", "Proposal must be a record carrying the proposed FurniSpec.");
      return { valid: false, errors, expectedFingerprint: null };
    }
    const expectedFingerprint = fingerprintFurniSpec(proposal.spec);
    if (isFingerprint(proposal.fingerprint) && proposal.fingerprint !== expectedFingerprint) {
      add(
        APPROVAL_ERROR.PROPOSAL_TAMPERED_SINCE_ISSUE,
        "proposal.spec",
        "The proposed FurniSpec has changed since the proposal was issued. Re-issue the proposal and obtain a fresh approval."
      );
    }
    if (approval === null || approval === void 0) {
      add(APPROVAL_ERROR.MISSING_APPROVAL, "approval", "No approval was supplied. Geometry requires an explicit human approval record.");
      return { valid: false, errors, expectedFingerprint };
    }
    if (!isPlainObject(approval)) {
      add(
        APPROVAL_ERROR.INVALID_APPROVAL_TYPE,
        "approval",
        `Approval must be a structured record, not ${Array.isArray(approval) ? "an array" : typeof approval}.`
      );
      return { valid: false, errors, expectedFingerprint };
    }
    if (!Object.prototype.hasOwnProperty.call(approval, "approvedBy")) {
      add(APPROVAL_ERROR.MISSING_APPROVED_BY, "approval.approvedBy", "approvedBy is required \u2014 an approval must name the person giving it.");
    } else if (typeof approval.approvedBy !== "string" || approval.approvedBy.trim() === "") {
      add(APPROVAL_ERROR.BLANK_APPROVED_BY, "approval.approvedBy", "approvedBy must be a non-empty string.");
    }
    if (!Object.prototype.hasOwnProperty.call(approval, "proposalId")) {
      add(APPROVAL_ERROR.MISSING_PROPOSAL_ID, "approval.proposalId", "proposalId is required.");
    } else if (approval.proposalId !== proposal.specId) {
      add(
        APPROVAL_ERROR.PROPOSAL_ID_MISMATCH,
        "approval.proposalId",
        `Approval references spec "${String(approval.proposalId)}" but the proposal is "${proposal.specId}".`
      );
    }
    if (!Object.prototype.hasOwnProperty.call(approval, "proposalRevision")) {
      add(APPROVAL_ERROR.MISSING_PROPOSAL_REVISION, "approval.proposalRevision", "proposalRevision is required.");
    } else if (!Number.isInteger(approval.proposalRevision) || approval.proposalRevision !== proposal.revision) {
      add(
        APPROVAL_ERROR.PROPOSAL_REVISION_MISMATCH,
        "approval.proposalRevision",
        `Approval references revision ${String(approval.proposalRevision)} but the proposal is revision ${proposal.revision}.`
      );
    }
    if (!Object.prototype.hasOwnProperty.call(approval, "proposalFingerprint")) {
      add(APPROVAL_ERROR.MISSING_PROPOSAL_FINGERPRINT, "approval.proposalFingerprint", "proposalFingerprint is required.");
    } else if (!isFingerprint(approval.proposalFingerprint)) {
      add(
        APPROVAL_ERROR.MALFORMED_PROPOSAL_FINGERPRINT,
        "approval.proposalFingerprint",
        `proposalFingerprint must match ${FINGERPRINT_PREFIX}<64 lower-case hex chars>.`
      );
    } else if (approval.proposalFingerprint !== expectedFingerprint) {
      add(
        APPROVAL_ERROR.PROPOSAL_FINGERPRINT_MISMATCH,
        "approval.proposalFingerprint",
        "The approval does not match this proposal. It may belong to an earlier proposal, or the proposal changed after it was approved."
      );
    }
    return { valid: errors.length === 0, errors, expectedFingerprint };
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
        proposalBasis = WARDROBE_RULES.doorsPerBayThresholdMm.id;
        const bayCount = get("bayCount");
        const envelopeWidthMm = get("envelope.widthMm");
        const panelTMm = WARDROBE_RULES.panelThicknessMm.value;
        if (Number.isFinite(envelopeWidthMm) && bayCount > 0) {
          const bayClearWidthMm = (envelopeWidthMm - 2 * panelTMm - (bayCount - 1) * panelTMm) / bayCount;
          proposal = bayCount * doorsForBayWidth(bayClearWidthMm);
          detail = `No ${fact.label} was supplied. ${WARDROBE_RULES.doorsPerBayThresholdMm.note} At about ${Math.round(bayClearWidthMm)}mm per bay that gives ${proposal} in total, offered for confirmation.`;
        } else {
          detail = `No ${fact.label} was supplied, and the door count depends on each bay's clear width, which is not yet known.`;
        }
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
  function blockingGaps(gaps) {
    return gaps.filter((g) => g.severity === GAP_SEVERITY.BLOCKING);
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
    bayLayouts: "What goes inside each bay, left to right? Options in this slice: full-height hanging, short hanging over two adjustable shelves, or a drawer bank with short hanging above.",
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
    [BAY_LAYOUT.SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES]: "short hanging over two adjustable shelves, with a shelf over the top",
    [BAY_LAYOUT.DRAWER_BANK_WITH_SHORT_HANGING]: "drawer bank at the bottom with short hanging above, and a shelf over the top"
  });
  function questionFor(gapRecord) {
    const base = PHRASING[gapRecord.key] ?? `Could you confirm ${gapRecord.key}?`;
    const prefix = KIND_PREFIX[gapRecord.kind];
    let question = prefix ? `${prefix} ${base}` : base;
    if (gapRecord.proposal !== null && gapRecord.proposal !== void 0) {
      question += ` We would suggest ${JSON.stringify(gapRecord.proposal)} \u2014 can you confirm?`;
    }
    return Object.freeze({
      key: gapRecord.key,
      severity: gapRecord.severity,
      kind: gapRecord.kind,
      question,
      why: gapRecord.detail,
      proposal: gapRecord.proposal ?? null,
      proposalBasis: gapRecord.proposalBasis ?? null
    });
  }
  function questionsFor(gaps) {
    return gaps.map(questionFor);
  }

  // src/lib/conversation/componentRequests.js
  var REQUEST_VERB = "add|put|fit|install|include|want|need|like|love|have|give|get|use|with|featuring";
  var NEGATION = /\b(no|not|n't|never|without|none|don't|dont|do\s+not|does\s+not|doesn't|won't|will\s+not|can't|cannot|rather\s+not|instead\s+of|skip|drop|remove|delete|take\s+out|get\s+rid|no\s+need|unless)\b/i;
  var REFERENCE_FRAMING = /\b(you\s+(?:showed|mentioned|suggested|said)|the\s+ones?\s+(?:you|in)|showroom|catalogue|catalog|last\s+time|earlier|previous|other\s+wardrobe|like\s+the\s+one)\b/i;
  var GAP = "(?:\\s+(?:up\\s+to|a|an|the|some|any|more|extra|another|about|around|at\\s+least|\\d+|one|two|three|four|five|six|couple|few|pair|of|my|our|it|its))*(?:\\s+[a-z-]+){0,2}\\s+";
  var COMPONENT_WORDS = Object.freeze([
    {
      noun: "drawers?|drawer\\s+bank|chest\\s+of\\s+drawers",
      componentType: COMPONENT_TYPES.DRAWER_BANK,
      customerWord: "drawers"
    }
  ]);
  var UNMODELLED_WORDS = Object.freeze([
    { noun: "handles?|knobs?|pulls?", customerWord: "handles" },
    { noun: "mirrors?|mirrored\\s+doors?", customerWord: "a mirror" },
    { noun: "lighting|lights|led\\s+strips?|leds?|spotlights?|light\\s+strips?", customerWord: "lighting" },
    { noun: "locks?|lockable", customerWord: "a lock" },
    { noun: "shoe\\s+racks?|tie\\s+racks?|trouser\\s+racks?|baskets?|pull-?out\\s+racks?", customerWord: "racks and baskets" },
    { noun: "soft[-\\s]?close|push[-\\s]?to[-\\s]?open", customerWord: "soft-close hardware" }
  ]);
  function toClauses(text) {
    return text.split(/[;.!?]+|,\s*|\s+\band\b\s+|\s+\bbut\b\s+|\s+\bthen\b\s+|\s+\balso\b\s+|\s+\bhowever\b\s+/i).map((c) => c.trim()).filter(Boolean);
  }
  function clauseRequests(clause, noun) {
    const governed = new RegExp(`\\b(?:${REQUEST_VERB})\\b${GAP}(?:${noun})\\b`, "i");
    if (governed.test(clause)) return true;
    const quantified = new RegExp(`\\b(?:\\d+|two|three|four|five|six)\\s+(?:[a-z-]+\\s+){0,2}?(?:${noun})\\b`, "i");
    return quantified.test(clause);
  }
  function detectUnsupportedComponentRequest(text) {
    if (typeof text !== "string" || !text.trim()) return null;
    const unsupported = [];
    const seen = /* @__PURE__ */ new Set();
    for (const clause of toClauses(text)) {
      if (NEGATION.test(clause) || REFERENCE_FRAMING.test(clause)) continue;
      for (const { noun, componentType, customerWord } of COMPONENT_WORDS) {
        if (seen.has(customerWord) || !clauseRequests(clause, noun)) continue;
        const policy = COMPONENT_REPRESENTATION_POLICY[componentType];
        if (!policy || policy.outcome !== COMPONENT_OUTCOME.UNSUPPORTED) continue;
        seen.add(customerWord);
        unsupported.push({
          request: customerWord,
          componentType,
          code: policy.diagnosticCode ?? COMPONENT_DIAGNOSTIC_CODE.COMPONENT_NOT_REPRESENTED,
          reason: policy.customerMessage,
          engineeringReason: policy.reason,
          alternative: policy.suggestedAlternative ? policy.suggestedAlternative.summary : null,
          alternativeApplied: false
        });
      }
      for (const { noun, customerWord } of UNMODELLED_WORDS) {
        if (seen.has(customerWord) || !clauseRequests(clause, noun)) continue;
        seen.add(customerWord);
        unsupported.push({
          request: customerWord,
          componentType: null,
          code: COMPONENT_DIAGNOSTIC_CODE.COMPONENT_NOT_REPRESENTED,
          reason: `I can't add ${customerWord} to the design yet. Your wardrobe is unchanged.`,
          engineeringReason: `"${customerWord}" has no representation in FurniSpec v0.1 \u2014 it is neither a cut part nor an approved hardware item.`,
          alternative: null,
          alternativeApplied: false
        });
      }
    }
    if (unsupported.length === 0) return null;
    return {
      unsupported,
      error: unsupported.map((u) => u.alternative ? `${u.reason} If you'd like, I can use ${u.alternative}.` : u.reason).join(" ")
    };
  }

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
  var MAX_RESOLUTION_ROUNDS = 8;
  function proposeWardrobe({ description, answers = {}, specId, revision = 1, adapter = createDeterministicPhraseAdapter() }) {
    assertProposalOnly(adapter);
    const rawDescription = description ?? "";
    const interpretation = adapter.interpret(rawDescription);
    let observations = [...interpretation.observations];
    let ambiguities = [...interpretation.ambiguities];
    const answeredKeys = [];
    for (let round = 0; round < MAX_RESOLUTION_ROUNDS; round += 1) {
      const currentGaps = analyseGaps({ observations, ambiguities });
      const answerable = blockingGaps(currentGaps).filter(
        (g) => Object.prototype.hasOwnProperty.call(answers, g.key)
      );
      if (answerable.length === 0) break;
      for (const g of answerable) {
        observations = observations.filter((o) => o.key !== g.key);
        ambiguities = ambiguities.filter((a) => a.key !== g.key);
        observations.push(
          observation(g.key, answers[g.key], OBSERVATION_ORIGIN.CUSTOMER_CONFIRMED, {
            sourceText: `answer to: ${g.key}`
          })
        );
        answeredKeys.push(g.key);
      }
    }
    const gaps = analyseGaps({ observations, ambiguities });
    const questions = questionsFor(gaps);
    const open = blockingGaps(gaps);
    const outOfSlice = gaps.filter((g) => g.kind === GAP_KIND.OUT_OF_SLICE);
    const base = {
      adapterId: adapter.id,
      adapterKind: adapter.kind,
      interpretation,
      observations,
      gaps,
      questions,
      answeredKeys,
      spec: null,
      derivations: null,
      validation: null,
      proposal: null,
      approval: null,
      approvalValidation: null,
      partGraph: null,
      partGraphValidation: null
    };
    if (outOfSlice.length > 0) {
      return { ...base, stage: PIPELINE_STAGE.UNSUPPORTED_REQUEST, safety: preApprovalSafety(null) };
    }
    if (open.length > 0) {
      return { ...base, stage: PIPELINE_STAGE.NEEDS_CLARIFICATION, safety: preApprovalSafety(null) };
    }
    const facts = Object.fromEntries(observations.map((o) => [o.key, o.value]));
    let assembled;
    try {
      assembled = assembleFurniSpec({ facts, gaps, specId, revision, status: SPEC_STATUS.PROPOSED });
    } catch (err) {
      if (err instanceof AssemblyBlockedError) {
        return { ...base, stage: PIPELINE_STAGE.NEEDS_CLARIFICATION, safety: preApprovalSafety(null) };
      }
      throw err;
    }
    const validation = validateFurniSpec(assembled.spec);
    if (!validation.valid) {
      return {
        ...base,
        stage: PIPELINE_STAGE.VALIDATION_FAILED,
        spec: assembled.spec,
        derivations: assembled.derivations,
        validation,
        safety: preApprovalSafety(assembled.spec)
      };
    }
    const proposal = createProposal(assembled.spec);
    return {
      ...base,
      stage: PIPELINE_STAGE.READY_FOR_REVIEW,
      spec: assembled.spec,
      // status PROPOSED
      derivations: assembled.derivations,
      validation,
      proposal,
      safety: preApprovalSafety(assembled.spec)
    };
  }
  function approveAndPreview({ proposal, approval }) {
    const approvalValidation = validateApproval({ proposal, approval });
    if (!approvalValidation.valid) {
      return {
        stage: proposal ? PIPELINE_STAGE.READY_FOR_REVIEW : PIPELINE_STAGE.NEEDS_CLARIFICATION,
        proposal: proposal ?? null,
        approval: approval ?? null,
        approvalValidation,
        spec: proposal?.spec ?? null,
        validation: null,
        partGraph: null,
        partGraphValidation: null,
        safety: preApprovalSafety(proposal?.spec ?? null, APPROVAL_STATE.APPROVAL_REJECTED)
      };
    }
    const approvedSpec = { ...proposal.spec, status: SPEC_STATUS.APPROVED };
    const validation = validateFurniSpec(approvedSpec);
    if (!validation.valid) {
      return {
        stage: PIPELINE_STAGE.VALIDATION_FAILED,
        proposal,
        approval,
        approvalValidation,
        spec: approvedSpec,
        validation,
        partGraph: null,
        partGraphValidation: null,
        safety: preApprovalSafety(approvedSpec, APPROVAL_STATE.APPROVAL_REJECTED)
      };
    }
    const partGraph = buildStructuralPartGraph(approvedSpec);
    const partGraphValidation = validatePartGraph(partGraph);
    const unrepresentable = unrepresentableComponents(partGraph);
    if (unrepresentable) {
      return {
        stage: PIPELINE_STAGE.UNSUPPORTED_REQUEST,
        proposal,
        approval,
        approvalValidation,
        spec: null,
        validation,
        partGraph: null,
        partGraphValidation: null,
        unsupported: unrepresentable.unsupported,
        error: unrepresentable.customerMessage,
        safety: preApprovalSafety(null, APPROVAL_STATE.APPROVAL_REJECTED)
      };
    }
    return {
      stage: PIPELINE_STAGE.APPROVED_FOR_PREVIEW,
      proposal,
      approval,
      approvalValidation,
      approvedFingerprint: approvalValidation.expectedFingerprint,
      spec: approvedSpec,
      validation,
      partGraph,
      partGraphValidation,
      safety: approvedSafety(approvedSpec, partGraph, approval)
    };
  }
  function runConversationToWardrobe({ description, answers = {}, specId, revision = 1, approval = null, adapter }) {
    const proposed = proposeWardrobe({ description, answers, specId, revision, ...adapter ? { adapter } : {} });
    if (proposed.stage !== PIPELINE_STAGE.READY_FOR_REVIEW || approval === null || approval === void 0) {
      return proposed;
    }
    const previewed = approveAndPreview({ proposal: proposed.proposal, approval });
    return { ...proposed, ...previewed };
  }
  function unrepresentableComponents(partGraph) {
    const outcomes = partGraph?.componentOutcomes ?? [];
    const blocked = outcomes.filter((e) => e.outcome === COMPONENT_OUTCOME.UNSUPPORTED);
    if (blocked.length === 0) return null;
    const unsupported = unsupportedComponentsForCustomer(outcomes);
    const customerMessage = unsupported.map((u) => u.alternative ? `${u.reason} If you'd like, I can use ${u.alternative}.` : u.reason).join(" ");
    return { unsupported, customerMessage };
  }
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
    const unrepresentable = unrepresentableComponents(partGraph);
    if (unrepresentable) {
      return {
        stage: PIPELINE_STAGE.UNSUPPORTED_REQUEST,
        interpretation,
        observations,
        gaps,
        spec: null,
        proposal: null,
        partGraph: null,
        partGraphValidation: null,
        unsupported: unrepresentable.unsupported,
        error: unrepresentable.customerMessage,
        safety: preApprovalSafety(null)
      };
    }
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
    const unsupportedRequest = detectUnsupportedComponentRequest(t);
    if (unsupportedRequest) {
      return {
        error: unsupportedRequest.error,
        unsupported: unsupportedRequest.unsupported
      };
    }
    const DRAWER_INTENT = new RegExp(
      [
        "\\b(?:add|put|fit|install|include|want|need|like|have|give|get)\\b[\\s\\S]{0,48}\\bdrawers?\\b",
        "\\b(?:\\d+|two|three|four|five|six)\\s+(?:[a-z-]+\\s+){0,2}?drawers?\\b",
        "\\bdrawer\\s+bank\\b",
        "\\bchest\\s+of\\s+drawers\\b"
      ].join("|"),
      "i"
    );
    const DRAWER_NEGATION = /\b(no|not|n't|never|without|don't|dont|do\s+not)\b/i;
    if (DRAWER_INTENT.test(t) && !DRAWER_NEGATION.test(t)) {
      const currentBays = currentFacts.bayCount || 2;
      const layouts = currentFacts.bayLayouts ? [...currentFacts.bayLayouts] : ["LONG_HANGING", "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES"];
      while (layouts.length < currentBays) {
        layouts.push("SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES");
      }
      const isLeft = /\b(?:left|bay\s*1)\b/i.test(t);
      const isRight = /\b(?:right|bay\s*2)\b/i.test(t);
      let targetBayIdx;
      if (isLeft) targetBayIdx = 0;
      else if (isRight) targetBayIdx = 1;
      else {
        targetBayIdx = layouts.findIndex((l) => l !== "DRAWER_BANK_WITH_SHORT_HANGING");
        if (targetBayIdx === -1) targetBayIdx = 0;
      }
      if (targetBayIdx >= currentBays) {
        return {
          error: `Cannot modify bay ${targetBayIdx + 1} because this wardrobe only has ${currentBays} bay${currentBays > 1 ? "s" : ""}.`
        };
      }
      const baySide = targetBayIdx === 0 ? "left" : targetBayIdx === 1 ? "right" : `bay ${targetBayIdx + 1}`;
      if (layouts[targetBayIdx] === "DRAWER_BANK_WITH_SHORT_HANGING") {
        return {
          error: `The ${baySide} bay already has a drawer bank with short hanging above.`
        };
      }
      layouts[targetBayIdx] = "DRAWER_BANK_WITH_SHORT_HANGING";
      return {
        changes: { bayLayouts: layouts },
        assistantReply: `Added a drawer bank to the ${baySide} bay (with short hanging above).`
      };
    }
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
    const SHELF_INTENT = new RegExp(
      [
        "\\badd\\s+(?:another\\s+|more\\s+|a\\s+|an\\s+|\\d+\\s+|two\\s+|three\\s+)?shelv(?:es|ing)?\\b",
        "\\badd\\s+(?:another\\s+|more\\s+)?shelf\\b",
        "\\bmore\\s+shelves\\b",
        "\\ball\\s+shelves\\b",
        "\\b(?:use|switch|change|configure|want|need|with|give)\\b[^.]*\\bshelv(?:es|ing)\\b",
        "\\b(?:\\d+|one|two|three|four)\\s+shelves\\b",
        "\\bshelves\\s+(?:in|on)\\s+both\\b"
      ].join("|"),
      "i"
    );
    if (SHELF_INTENT.test(t)) {
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
    const FINISH_WORDS = "oak|walnut|white|grey|taupe|cream|black|navy|sage|ash";
    const SCOPED_PART = /\b(door|doors|handle|handles|shelf|shelves|drawer|drawers|rail|rails|interior|inside|back|plinth|trim|edge|edges|frame|top|side|sides)\b/i;
    const matMatch = t.match(new RegExp(`\\b(${FINISH_WORDS})\\b`, "i"));
    if (matMatch) {
      const mat = matMatch[1].toLowerCase();
      const beforeColour = t.slice(0, matMatch.index);
      const afterColour = t.slice(matMatch.index + matMatch[1].length);
      const scopedAfter = SCOPED_PART.test(afterColour);
      const scopedBefore = SCOPED_PART.test(beforeColour);
      if (scopedAfter || scopedBefore) {
        const named = (afterColour.match(SCOPED_PART) || beforeColour.match(SCOPED_PART))[1].toLowerCase();
        if (/\b(add|fit|install|include|put|attach|give\s+it)\b/i.test(beforeColour)) {
          return {
            error: `I can't add ${named} to the design yet. Your wardrobe is unchanged \u2014 you can still change its size, layout or finish.`
          };
        }
        return {
          error: `I can only change the finish of the whole wardrobe at the moment, not just the ${named}. Your design is unchanged \u2014 say "make it ${mat}" if you'd like the whole wardrobe in ${mat}.`
        };
      }
      const explicitFinishWord = /finish|material|colour|color|paint/i.test(t);
      const colourIsTheRequest = /(?:make|paint|change|switch|turn|do|have|want|like|use|try|in|to)\b[^.]*$/i.test(beforeColour) && /^[\s,.!?]*(please|thanks|thank you)?[\s,.!?]*$/i.test(afterColour);
      if (explicitFinishWord || colourIsTheRequest) {
        return {
          changes: { materialKey: mat },
          assistantReply: `Changed finish to ${mat}.`
        };
      }
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
      const parsedUnsupported = Array.isArray(parsed.unsupported) ? parsed.unsupported : [];
      return {
        ok: false,
        kind: parsedUnsupported.length > 0 ? "UNSUPPORTED" : "REJECTED",
        error: parsed.error,
        ...parsedUnsupported.length > 0 ? { unsupported: parsedUnsupported } : {}
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
          error: draft2.error || draft2.validation?.errors?.map((e) => e.message).join("; ") || "Failed to generate valid wardrobe geometry for this change.",
          // Carry the structured refusal so the browser can show the reason and
          // the offered alternative, rather than a generic failure string.
          ...draft2.unsupported ? { unsupported: draft2.unsupported } : {}
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
        error: draft.error || draft.validation?.errors?.map((e) => e.message).join("; ") || "Failed to generate valid wardrobe geometry for this change.",
        // Carry the structured refusal so the browser can show the reason and
        // the offered alternative, rather than a generic failure string.
        ...draft.unsupported ? { unsupported: draft.unsupported } : {}
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
  function approvedSafety(spec, partGraph, approval) {
    const drillingOperations = (partGraph?.operations ?? []).filter((op) => /DRILL|BORE|HINGE_CUP|PIN_HOLE/i.test(op.type));
    return {
      approvalState: APPROVAL_STATE.APPROVED,
      approvedBy: approval.approvedBy,
      previewAuthorized: true,
      geometryGenerated: true,
      cncQualified: false,
      specQualificationStatus: spec.qualificationStatus,
      partGraphQualificationStatus: partGraph?.qualificationStatus ?? null,
      cncQualificationAsserted: spec.qualificationStatus === QUALIFICATION_STATUS.WORKSHOP_REVIEW_NOT_CNC_QUALIFIED && partGraph?.qualificationStatus === QUALIFICATION_STATUS.WORKSHOP_REVIEW_NOT_CNC_QUALIFIED,
      drillingPolicy: spec.machiningPolicy?.drilling ?? null,
      drillingOperationCount: drillingOperations.length,
      drillingBlocked: spec.machiningPolicy?.drilling === "BLOCKED_PENDING_HARDWARE_APPROVAL" && drillingOperations.length === 0,
      hardwareStatuses: hardwareStatusesOf(spec),
      approvedOperationTypes: [...new Set((partGraph?.operations ?? []).map((op) => op.type))].sort(),
      note: "Workshop review only. Approval authorises a preview, never a machine."
    };
  }
  function hardwareStatusesOf(spec) {
    return Object.fromEntries(Object.entries(spec.hardware ?? {}).map(([k, v]) => [k, v?.status ?? "UNKNOWN"]));
  }

  // src/lib/drawing/projectionEngine.js
  var SHEET_SIZES = Object.freeze({
    A3: { widthMm: 420, heightMm: 297, marginMm: 10 },
    A4: { widthMm: 297, heightMm: 210, marginMm: 8 }
  });
  function extractPanelDatums(part) {
    const p = part.placement || {};
    return {
      id: part.id,
      role: String(part.role || ""),
      minX: (p.minXDmm ?? 0) / 10,
      maxX: (p.maxXDmm ?? 0) / 10,
      minY: (p.minYDmm ?? 0) / 10,
      maxY: (p.maxYDmm ?? 0) / 10,
      minZ: (p.minZDmm ?? 0) / 10,
      maxZ: (p.maxZDmm ?? 0) / 10,
      width: ((p.maxXDmm ?? 0) - (p.minXDmm ?? 0)) / 10,
      height: ((p.maxYDmm ?? 0) - (p.minYDmm ?? 0)) / 10,
      depth: ((p.maxZDmm ?? 0) - (p.minZDmm ?? 0)) / 10,
      rawPart: part
    };
  }
  function analyzePartGraphStructure(partGraph, options = {}) {
    const parts = Array.isArray(partGraph?.parts) ? partGraph.parts : [];
    const panels = parts.map(extractPanelDatums);
    let minCarcassX = Infinity, maxCarcassX = -Infinity;
    let minCarcassY = Infinity, maxCarcassY = -Infinity;
    let minCarcassZ = Infinity, maxCarcassZ = -Infinity;
    for (const p of panels) {
      if (!p.role.startsWith("FILLER_") && !p.role.startsWith("PLINTH_") && p.role !== "DOOR_PANEL" && p.role !== "DOOR" && !p.role.startsWith("DRAWER_")) {
        minCarcassX = Math.min(minCarcassX, p.minX);
        maxCarcassX = Math.max(maxCarcassX, p.maxX);
        minCarcassY = Math.min(minCarcassY, p.minY);
        maxCarcassY = Math.max(maxCarcassY, p.maxY);
        minCarcassZ = Math.min(minCarcassZ, p.minZ);
        maxCarcassZ = Math.max(maxCarcassZ, p.maxZ);
      }
    }
    let plinthHeightMm = 100;
    const plinthParts = panels.filter((p) => p.role.includes("PLINTH"));
    if (plinthParts.length > 0) {
      plinthHeightMm = Math.max(...plinthParts.map((p) => p.maxY));
    }
    if (!Number.isFinite(minCarcassX)) minCarcassX = 0;
    if (!Number.isFinite(maxCarcassX)) maxCarcassX = 1800;
    if (!Number.isFinite(minCarcassY)) minCarcassY = plinthHeightMm;
    if (!Number.isFinite(maxCarcassY)) maxCarcassY = 2400;
    if (!Number.isFinite(minCarcassZ)) minCarcassZ = 20;
    if (!Number.isFinite(maxCarcassZ)) maxCarcassZ = 600;
    const carcassWidthMm = maxCarcassX - minCarcassX;
    const totalHeightMm = Math.max(maxCarcassY, minCarcassY + (maxCarcassY - minCarcassY));
    const carcassHeightMm = maxCarcassY - plinthHeightMm;
    const carcassDepthMm = maxCarcassZ - minCarcassZ;
    const totalDepthMm = maxCarcassZ;
    const scribeLeftMm = Number(partGraph.scribeLeftMm ?? options.scribeLeftMm ?? 0);
    const scribeRightMm = Number(partGraph.scribeRightMm ?? options.scribeRightMm ?? 0);
    const roomWidthMm = carcassWidthMm + scribeLeftMm + scribeRightMm;
    const dividers = panels.filter(
      (p) => p.role === "DIVIDER" || p.role === PART_ROLES.DIVIDER_PANEL
    ).sort((a, b) => a.minX - b.minX);
    const leftGable = panels.find(
      (p) => p.role === "GABLE_L" || p.role === "SIDE_PANEL_LEFT" || p.role === "GABLE" && p.minX < carcassWidthMm / 2
    );
    const gableThickness = leftGable ? leftGable.width : 18;
    const bays = [];
    const verticalBoundaries = [
      minCarcassX + gableThickness,
      ...dividers.flatMap((d) => [d.minX, d.maxX]),
      maxCarcassX - gableThickness
    ];
    for (let i = 0; i < verticalBoundaries.length - 1; i += 2) {
      const bayLeft = verticalBoundaries[i];
      const bayRight = verticalBoundaries[i + 1];
      bays.push({
        bayIndex: bays.length + 1,
        minX: bayLeft,
        maxX: bayRight,
        widthMm: Math.round((bayRight - bayLeft) * 10) / 10
      });
    }
    return {
      panels,
      bounds: {
        minCarcassX,
        maxCarcassX,
        minCarcassY,
        maxCarcassY,
        minCarcassZ,
        maxCarcassZ,
        carcassWidthMm,
        totalHeightMm,
        carcassHeightMm,
        carcassDepthMm,
        totalDepthMm,
        plinthHeightMm,
        scribeLeftMm,
        scribeRightMm,
        roomWidthMm,
        gableThickness
      },
      bays,
      dividers
    };
  }
  function projectOrthographicViews(partGraph, options = {}) {
    const structure = analyzePartGraphStructure(partGraph, options);
    const { panels, bounds, bays } = structure;
    const frontElevationPanels = [];
    for (const p of panels) {
      let strokeClass = "carcass-stroke";
      let fillClass = "panel-fill";
      let isDashed = false;
      let isRevealOutline = false;
      if (p.role.includes("PLINTH")) {
        strokeClass = "plinth-stroke";
        fillClass = "plinth-fill";
      } else if (p.role === PART_ROLES.ADJUSTABLE_SHELF || p.role === "SHELF_ADJ") {
        isDashed = true;
        fillClass = "shelf-adj-fill";
      } else if (p.role === PART_ROLES.DRAWER_FRONT || p.role === "DRAWER_FRONT") {
        fillClass = "drawer-front-fill";
        isRevealOutline = true;
      } else if (p.role.startsWith("DRAWER_") && p.role !== "DRAWER_FRONT") {
        continue;
      } else if (p.role === "DOOR_PANEL" || p.role === "DOOR") {
        continue;
      }
      frontElevationPanels.push({
        id: p.id,
        role: p.role,
        x: p.minX,
        y: p.minY,
        width: p.width,
        height: p.height,
        strokeClass,
        fillClass,
        isDashed,
        isRevealOutline
      });
    }
    if (bounds.scribeLeftMm > 0) {
      frontElevationPanels.push({
        id: "FILLER_LEFT",
        role: "FILLER_LEFT",
        x: bounds.minCarcassX - bounds.scribeLeftMm,
        y: 0,
        width: bounds.scribeLeftMm,
        height: bounds.totalHeightMm,
        strokeClass: "scribe-stroke",
        fillClass: "scribe-fill",
        isDashed: false
      });
    }
    if (bounds.scribeRightMm > 0) {
      frontElevationPanels.push({
        id: "FILLER_RIGHT",
        role: "FILLER_RIGHT",
        x: bounds.maxCarcassX,
        y: 0,
        width: bounds.scribeRightMm,
        height: bounds.totalHeightMm,
        strokeClass: "scribe-stroke",
        fillClass: "scribe-fill",
        isDashed: false
      });
    }
    const frontDimensions = [
      {
        axis: "X",
        tier: "OVERALL",
        start: bounds.minCarcassX - bounds.scribeLeftMm,
        end: bounds.maxCarcassX + bounds.scribeRightMm,
        elevation: bounds.totalHeightMm + 90,
        label: `${bounds.roomWidthMm} mm (Wall-to-Wall)`
      },
      {
        axis: "X",
        tier: "CARCASS",
        start: bounds.minCarcassX,
        end: bounds.maxCarcassX,
        elevation: bounds.totalHeightMm + 45,
        label: `${bounds.carcassWidthMm} mm (Carcass)`
      },
      {
        axis: "Y",
        tier: "SUB",
        start: 0,
        end: bounds.plinthHeightMm,
        elevation: bounds.minCarcassX - bounds.scribeLeftMm - 45,
        label: `${bounds.plinthHeightMm} mm`
      },
      {
        axis: "Y",
        tier: "OVERALL",
        start: 0,
        end: bounds.totalHeightMm,
        elevation: bounds.minCarcassX - bounds.scribeLeftMm - 90,
        label: `${bounds.totalHeightMm} mm (Height)`
      }
    ];
    for (const bay of bays) {
      frontDimensions.push({
        axis: "X",
        tier: "BAYS",
        start: bay.minX,
        end: bay.maxX,
        elevation: -45,
        label: `Bay ${bay.bayIndex}: ${bay.widthMm} mm`
      });
    }
    const drawerFrontPanels = panels.filter((p) => p.role === "DRAWER_FRONT" || p.role === PART_ROLES.DRAWER_FRONT);
    for (const df of drawerFrontPanels) {
      frontDimensions.push({
        axis: "Y",
        tier: "DRAWER_FRONT",
        start: df.minY,
        end: df.maxY,
        elevation: df.maxX + 35,
        label: `${Math.round(df.height * 10) / 10} mm (DF)`
      });
    }
    const crossSectionPanels = [];
    crossSectionPanels.push({
      id: "SEC_TOP",
      role: "TOP_PANEL",
      z: bounds.minCarcassZ,
      y: bounds.totalHeightMm - bounds.gableThickness,
      depth: bounds.carcassDepthMm,
      thickness: bounds.gableThickness
    });
    crossSectionPanels.push({
      id: "SEC_BOT",
      role: "BOTTOM_PANEL",
      z: bounds.minCarcassZ,
      y: bounds.plinthHeightMm,
      depth: bounds.carcassDepthMm,
      thickness: bounds.gableThickness
    });
    crossSectionPanels.push({
      id: "SEC_PLINTH_F",
      role: "PLINTH_FRONT",
      z: bounds.minCarcassZ,
      y: 0,
      depth: bounds.gableThickness,
      thickness: bounds.plinthHeightMm
    });
    crossSectionPanels.push({
      id: "SEC_PLINTH_R",
      role: "PLINTH_REAR",
      z: bounds.maxCarcassZ - bounds.gableThickness,
      y: 0,
      depth: bounds.gableThickness,
      thickness: bounds.plinthHeightMm
    });
    crossSectionPanels.push({
      id: "SEC_BACK",
      role: "BACK_PANEL",
      z: bounds.maxCarcassZ - 20 - 6,
      y: bounds.plinthHeightMm + 7,
      depth: 6,
      thickness: bounds.carcassHeightMm - 14,
      isHatched: true
    });
    const shelves = panels.filter(
      (p) => p.role.includes("SHELF") && p.role !== "TOP_PANEL" && p.role !== "BOTTOM_PANEL"
    );
    for (const s of shelves) {
      crossSectionPanels.push({
        id: `SEC_${s.id}`,
        role: s.role,
        z: s.minZ,
        y: s.minY,
        depth: s.depth,
        thickness: s.height,
        isDashed: s.role.includes("ADJ")
      });
    }
    const drawerFronts = panels.filter((p) => p.role === "DRAWER_FRONT" || p.role === PART_ROLES.DRAWER_FRONT);
    for (const df of drawerFronts) {
      crossSectionPanels.push({
        id: `SEC_DF_${df.id}`,
        role: "DRAWER_FRONT",
        z: 0,
        y: df.minY,
        depth: 18,
        thickness: df.height
      });
      const boxDepth = Math.max(350, bounds.carcassDepthMm - 80);
      crossSectionPanels.push({
        id: `SEC_DBOX_${df.id}`,
        role: "DRAWER_BOX",
        z: 20,
        y: df.minY + 15,
        depth: boxDepth,
        thickness: Math.max(100, df.height - 40),
        isInternalBox: true
      });
    }
    const crossSectionDimensions = [
      {
        axis: "Z",
        tier: "OVERALL",
        start: 0,
        end: bounds.totalDepthMm,
        elevation: bounds.totalHeightMm + 45,
        label: `${bounds.totalDepthMm} mm (Total Depth)`
      },
      {
        axis: "Z",
        tier: "CARCASS",
        start: bounds.minCarcassZ,
        end: bounds.maxCarcassZ,
        elevation: bounds.totalHeightMm + 15,
        label: `${bounds.carcassDepthMm} mm (Carcass Depth)`
      },
      {
        axis: "Z",
        tier: "GROOVE",
        start: bounds.maxCarcassZ - 20,
        end: bounds.maxCarcassZ,
        elevation: bounds.plinthHeightMm + 50,
        label: "20 mm (Groove)"
      },
      {
        axis: "Y",
        tier: "PLINTH_DATUM",
        start: 0,
        end: bounds.plinthHeightMm,
        elevation: -20,
        label: `${bounds.plinthHeightMm} mm (Plinth)`
      }
    ];
    const rails = panels.filter((p) => p.role.includes("RAIL"));
    for (const r of rails) {
      const railZ = r.minZ > 0 ? (r.minZ + r.maxZ) / 2 : bounds.minCarcassZ + bounds.carcassDepthMm / 2;
      const railY = (r.minY + r.maxY) / 2;
      crossSectionPanels.push({
        id: `SEC_${r.id}`,
        role: "HANGING_RAIL",
        z: railZ - 12.5,
        y: railY - 12.5,
        depth: 25,
        thickness: 25,
        isCircle: true
      });
      crossSectionDimensions.push({
        axis: "Y",
        tier: "RAIL_DROP",
        start: railY,
        end: bounds.totalHeightMm - bounds.gableThickness,
        elevation: bounds.totalDepthMm + 25,
        label: `${Math.round((bounds.totalHeightMm - bounds.gableThickness - railY) * 10) / 10} mm (Rail Drop)`
      });
    }
    const planPanels = [];
    planPanels.push({
      id: "PLAN_GABLE_L",
      x: bounds.minCarcassX,
      z: bounds.minCarcassZ,
      width: bounds.gableThickness,
      depth: bounds.carcassDepthMm
    });
    planPanels.push({
      id: "PLAN_GABLE_R",
      x: bounds.maxCarcassX - bounds.gableThickness,
      z: bounds.minCarcassZ,
      width: bounds.gableThickness,
      depth: bounds.carcassDepthMm
    });
    for (const d of structure.dividers) {
      planPanels.push({
        id: `PLAN_${d.id}`,
        x: d.minX,
        z: d.minZ,
        width: d.width,
        depth: d.depth
      });
    }
    planPanels.push({
      id: "PLAN_BACK",
      x: bounds.minCarcassX + bounds.gableThickness / 2,
      z: bounds.maxCarcassZ - 26,
      width: bounds.carcassWidthMm - bounds.gableThickness,
      depth: 6
    });
    if (bounds.scribeLeftMm > 0) {
      planPanels.push({
        id: "PLAN_SCRIBE_L",
        x: bounds.minCarcassX - bounds.scribeLeftMm,
        z: bounds.minCarcassZ,
        width: bounds.scribeLeftMm,
        depth: 18,
        isScribe: true
      });
    }
    if (bounds.scribeRightMm > 0) {
      planPanels.push({
        id: "PLAN_SCRIBE_R",
        x: bounds.maxCarcassX,
        z: bounds.minCarcassZ,
        width: bounds.scribeRightMm,
        depth: 18,
        isScribe: true
      });
    }
    const planDimensions = [
      {
        axis: "X",
        tier: "ROOM",
        start: bounds.minCarcassX - bounds.scribeLeftMm,
        end: bounds.maxCarcassX + bounds.scribeRightMm,
        elevation: -30,
        label: `${bounds.roomWidthMm} mm`
      },
      {
        axis: "Z",
        tier: "DEPTH",
        start: bounds.minCarcassZ,
        end: bounds.maxCarcassZ,
        elevation: bounds.maxCarcassX + bounds.scribeRightMm + 30,
        label: `${bounds.carcassDepthMm} mm`
      }
    ];
    return {
      sourceSpecId: partGraph.sourceSpecId || "furnispec-wardrobe",
      revision: partGraph.revision ?? options.revision ?? 1,
      bounds,
      bays,
      views: {
        frontElevation: {
          panels: frontElevationPanels,
          dimensions: frontDimensions
        },
        crossSection: {
          panels: crossSectionPanels,
          dimensions: crossSectionDimensions
        },
        plan: {
          panels: planPanels,
          dimensions: planDimensions
        }
      }
    };
  }
  function renderDimensionSVG(x1, y1, x2, y2, text, options = {}) {
    const { isVertical = false, tickSize = 2, textOffset = 2.5 } = options;
    let out = "";
    out += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" class="dim-line" />
`;
    if (isVertical) {
      out += `<line x1="${(x1 - tickSize).toFixed(2)}" y1="${(y1 + tickSize).toFixed(2)}" x2="${(x1 + tickSize).toFixed(2)}" y2="${(y1 - tickSize).toFixed(2)}" class="dim-tick" />
`;
      out += `<line x1="${(x2 - tickSize).toFixed(2)}" y1="${(y2 + tickSize).toFixed(2)}" x2="${(x2 + tickSize).toFixed(2)}" y2="${(y2 - tickSize).toFixed(2)}" class="dim-tick" />
`;
      const midY = (y1 + y2) / 2;
      out += `<text x="${(x1 - textOffset).toFixed(2)}" y="${midY.toFixed(2)}" class="dim-text" text-anchor="middle" transform="rotate(-90 ${(x1 - textOffset).toFixed(2)} ${midY.toFixed(2)})">${text}</text>
`;
    } else {
      out += `<line x1="${(x1 - tickSize).toFixed(2)}" y1="${(y1 + tickSize).toFixed(2)}" x2="${(x1 + tickSize).toFixed(2)}" y2="${(y1 - tickSize).toFixed(2)}" class="dim-tick" />
`;
      out += `<line x1="${(x2 - tickSize).toFixed(2)}" y1="${(y2 + tickSize).toFixed(2)}" x2="${(x2 + tickSize).toFixed(2)}" y2="${(y2 - tickSize).toFixed(2)}" class="dim-tick" />
`;
      const midX = (x1 + x2) / 2;
      out += `<text x="${midX.toFixed(2)}" y="${(y1 - textOffset).toFixed(2)}" class="dim-text" text-anchor="middle">${text}</text>
`;
    }
    return out;
  }
  function assertRenderablePartGraph(partGraph, entryPoint) {
    if (!partGraph || !Array.isArray(partGraph.parts)) {
      throw new Error(`${entryPoint} requires a PartGraph object.`);
    }
    const result = validatePartGraph(partGraph);
    if (!result.valid) {
      const degenerate = result.errors.filter(
        (e) => e.code === "INVALID_FINISHED_DIMENSION" || e.code === "INVALID_RAW_DIMENSION"
      );
      const reported = (degenerate.length > 0 ? degenerate : result.errors).slice(0, 3);
      throw new Error(
        `${entryPoint} refuses an invalid PartGraph: ` + reported.map((e) => `[${e.code}] ${e.message}`).join(" ")
      );
    }
  }
  function generateShopDrawingsSVG(partGraph, options = {}) {
    assertRenderablePartGraph(partGraph, "generateShopDrawingsSVG");
    const sheet = SHEET_SIZES[options.sheetSize || "A3"] || SHEET_SIZES.A3;
    const proj = projectOrthographicViews(partGraph, options);
    const { bounds, views } = proj;
    const sheetW = sheet.widthMm;
    const sheetH = sheet.heightMm;
    const m = sheet.marginMm;
    const scaleElevation = Math.min(200 / (bounds.roomWidthMm + 180), 200 / (bounds.totalHeightMm + 180));
    const scaleSection = Math.min(130 / (bounds.totalDepthMm + 100), 75 / (bounds.totalHeightMm + 100));
    const scalePlan = Math.min(130 / (bounds.roomWidthMm + 80), 50 / (bounds.totalDepthMm + 60));
    let svg = `<?xml version="1.0" encoding="UTF-8"?>
`;
    svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sheetW} ${sheetH}" width="${sheetW}mm" height="${sheetH}mm">
`;
    svg += `  <defs>
    <style>
      .sheet-border { fill: none; stroke: #111827; stroke-width: 0.7; }
      .sheet-margin { fill: none; stroke: #4b5563; stroke-width: 0.35; }
      .grid-line { stroke: #e5e7eb; stroke-width: 0.2; }
      .title-block-border { fill: #f9fafb; stroke: #111827; stroke-width: 0.5; }
      .title-block-grid { stroke: #9ca3af; stroke-width: 0.25; }
      .title-main { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 700; font-size: 3.5px; fill: #111827; }
      .title-sub { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 2.2px; fill: #4b5563; }
      .title-val { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 600; font-size: 2.4px; fill: #1f2937; }
      .view-header { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 700; font-size: 3.0px; fill: #1e3a8a; }
      .view-scale { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 2.0px; fill: #6b7280; }
      .carcass-stroke { fill: #fefce8; stroke: #1e293b; stroke-width: 0.35; }
      .plinth-stroke { fill: #f3f4f6; stroke: #374151; stroke-width: 0.35; }
      .scribe-stroke { fill: #f1f5f9; stroke: #475569; stroke-width: 0.35; stroke-dasharray: 1.5, 0.8; }
      .shelf-adj-fill { fill: #eff6ff; stroke: #2563eb; stroke-width: 0.3; stroke-dasharray: 2.0, 1.0; }
      .drawer-front-fill { fill: #fdf4ff; stroke: #7e22ce; stroke-width: 0.35; }
      .reveal-outline { fill: none; stroke: #6b21a8; stroke-width: 0.25; }
      .section-cut-hatch { fill: #e0e7ff; stroke: #1e3a8a; stroke-width: 0.35; }
      .internal-box { fill: #fffbeb; stroke: #b45309; stroke-width: 0.25; stroke-dasharray: 2.0, 1.0; }
      .dim-line { stroke: #2563eb; stroke-width: 0.22; }
      .dim-tick { stroke: #1d4ed8; stroke-width: 0.35; }
      .dim-text { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 600; font-size: 2.1px; fill: #1e40af; }
      .legend-title { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 700; font-size: 2.4px; fill: #111827; }
      .legend-item { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 1.9px; fill: #374151; }
    </style>
  </defs>
`;
    svg += `  <!-- ISO A3 Drawing Sheet Border -->
`;
    svg += `  <rect x="0" y="0" width="${sheetW}" height="${sheetH}" fill="#ffffff" />
`;
    svg += `  <rect x="${m}" y="${m}" width="${sheetW - 2 * m}" height="${sheetH - 2 * m}" class="sheet-margin" />
`;
    svg += `  <rect x="${m + 2}" y="${m + 2}" width="${sheetW - 2 * m - 4}" height="${sheetH - 2 * m - 4}" class="sheet-border" />
`;
    const feX = m + 22;
    const feY = sheetH - m - 42;
    svg += `
  <!-- VIEW A: FRONT ELEVATION (OPEN CARCASS) -->
`;
    svg += `  <g id="view_front_elevation">
`;
    svg += `    <text x="${feX}" y="${m + 16}" class="view-header">VIEW A: FRONT ELEVATION (OPEN CARCASS)</text>
`;
    svg += `    <text x="${feX}" y="${m + 20}" class="view-scale">SCALE 1:${Math.round(1 / scaleElevation)} (ALL RUNNING DIMS IN MM)</text>
`;
    for (const p of views.frontElevation.panels) {
      const px = feX + (p.x + bounds.scribeLeftMm) * scaleElevation;
      const py = feY - (p.y + p.height) * scaleElevation;
      const pw = p.width * scaleElevation;
      const ph = p.height * scaleElevation;
      const cls = p.isRevealOutline ? "drawer-front-fill" : p.isDashed ? "shelf-adj-fill" : p.strokeClass;
      svg += `    <rect id="${p.id}" x="${px.toFixed(2)}" y="${py.toFixed(2)}" width="${pw.toFixed(2)}" height="${ph.toFixed(2)}" class="${cls}" />
`;
      if (p.isRevealOutline) {
        svg += `    <rect x="${(px + 0.4).toFixed(2)}" y="${(py + 0.4).toFixed(2)}" width="${Math.max(0.1, pw - 0.8).toFixed(2)}" height="${Math.max(0.1, ph - 0.8).toFixed(2)}" class="reveal-outline" />
`;
      }
    }
    for (const d of views.frontElevation.dimensions) {
      if (d.axis === "X") {
        const x1 = feX + (d.start + bounds.scribeLeftMm) * scaleElevation;
        const x2 = feX + (d.end + bounds.scribeLeftMm) * scaleElevation;
        const dimY = feY - d.elevation * scaleElevation;
        svg += `    ${renderDimensionSVG(x1, dimY, x2, dimY, d.label, { isVertical: false })}`;
        svg += `    <line x1="${x1.toFixed(2)}" y1="${(dimY + 1.5).toFixed(2)}" x2="${x1.toFixed(2)}" y2="${feY.toFixed(2)}" stroke="#93c5fd" stroke-width="0.15" stroke-dasharray="1.0, 0.5" />
`;
        svg += `    <line x1="${x2.toFixed(2)}" y1="${(dimY + 1.5).toFixed(2)}" x2="${x2.toFixed(2)}" y2="${feY.toFixed(2)}" stroke="#93c5fd" stroke-width="0.15" stroke-dasharray="1.0, 0.5" />
`;
      } else if (d.axis === "Y") {
        const y1 = feY - d.start * scaleElevation;
        const y2 = feY - d.end * scaleElevation;
        const dimX = feX + (d.elevation + bounds.scribeLeftMm) * scaleElevation;
        svg += `    ${renderDimensionSVG(dimX, y1, dimX, y2, d.label, { isVertical: true })}`;
        svg += `    <line x1="${dimX.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${feX.toFixed(2)}" y2="${y1.toFixed(2)}" stroke="#93c5fd" stroke-width="0.15" stroke-dasharray="1.0, 0.5" />
`;
        svg += `    <line x1="${dimX.toFixed(2)}" y1="${y2.toFixed(2)}" x2="${feX.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="#93c5fd" stroke-width="0.15" stroke-dasharray="1.0, 0.5" />
`;
      }
    }
    svg += `  </g>
`;
    const csX = sheetW - m - 146;
    const csY = m + 218;
    svg += `
  <!-- VIEW B: CROSS-SECTION A-A -->
`;
    svg += `  <g id="view_cross_section">
`;
    svg += `    <text x="${csX}" y="${m + 148}" class="view-header">VIEW B: CROSS-SECTION A-A (SIDE PROFILE)</text>
`;
    svg += `    <text x="${csX}" y="${m + 152}" class="view-scale">SCALE 1:${Math.round(1 / scaleSection)} (CARCASS DEPTH &amp; BACK GROOVE)</text>
`;
    for (const p of views.crossSection.panels) {
      const px = csX + p.z * scaleSection;
      const py = csY - (p.y + p.thickness) * scaleSection;
      const pw = p.depth * scaleSection;
      const ph = p.thickness * scaleSection;
      const cls = p.isInternalBox ? "internal-box" : p.isHatched ? "section-cut-hatch" : "carcass-stroke";
      svg += `    <rect id="${p.id}" x="${px.toFixed(2)}" y="${py.toFixed(2)}" width="${pw.toFixed(2)}" height="${ph.toFixed(2)}" class="${cls}" />
`;
    }
    for (const d of views.crossSection.dimensions) {
      const x1 = csX + d.start * scaleSection;
      const x2 = csX + d.end * scaleSection;
      const dimY = csY - d.elevation * scaleSection;
      svg += `    ${renderDimensionSVG(x1, dimY, x2, dimY, d.label, { isVertical: false })}`;
    }
    svg += `  </g>
`;
    const pvX = sheetW - m - 146;
    const pvY = m + 80;
    svg += `
  <!-- VIEW C: PLAN VIEW (TOP-DOWN) -->
`;
    svg += `  <g id="view_plan_top_down">
`;
    svg += `    <text x="${pvX}" y="${m + 68}" class="view-header">VIEW C: PLAN VIEW (TOP-DOWN)</text>
`;
    svg += `    <text x="${pvX}" y="${m + 72}" class="view-scale">SCALE 1:${Math.round(1 / scalePlan)} (WALL SCRIBES &amp; GABLES)</text>
`;
    for (const p of views.plan.panels) {
      const px = pvX + (p.x + bounds.scribeLeftMm) * scalePlan;
      const py = pvY + (p.z - bounds.minCarcassZ) * scalePlan;
      const pw = p.width * scalePlan;
      const ph = p.depth * scalePlan;
      const cls = p.isScribe ? "scribe-stroke" : "carcass-stroke";
      svg += `    <rect id="${p.id}" x="${px.toFixed(2)}" y="${py.toFixed(2)}" width="${pw.toFixed(2)}" height="${ph.toFixed(2)}" class="${cls}" />
`;
    }
    svg += `  </g>
`;
    const legX = sheetW - m - 146;
    const legY = m + 14;
    const carcassCode = partGraph.metadata?.materials?.carcass?.code || "W980_SM_WHITE_18";
    const facadeCode = partGraph.metadata?.materials?.fronts?.code || "H3303_ST10_OAK_18";
    svg += `
  <!-- MATERIAL & HARDWARE SCHEDULE (TOP RIGHT) -->
`;
    svg += `  <g id="material_legend">
`;
    svg += `    <rect x="${legX}" y="${legY}" width="144" height="52" fill="#f8fafc" stroke="#64748b" stroke-width="0.3" rx="1.0" />
`;
    svg += `    <text x="${legX + 4}" y="${legY + 6}" class="legend-title">MATERIAL &amp; HARDWARE SCHEDULE</text>
`;
    svg += `    <text x="${legX + 4}" y="${legY + 12}" class="legend-item">\u2022 CARCASS STOCK: ${carcassCode} (18.0 mm MFC)</text>
`;
    svg += `    <text x="${legX + 4}" y="${legY + 18}" class="legend-item">\u2022 FACADE STOCK: ${facadeCode} (18.0 mm MFC)</text>
`;
    svg += `    <text x="${legX + 4}" y="${legY + 24}" class="legend-item">\u2022 BACK PANEL: 6.0 mm HDF Insert into 7.0 mm Groove</text>
`;
    svg += `    <text x="${legX + 4}" y="${legY + 30}" class="legend-item">\u2022 DRAWER PACK: 15.0 mm Sides/Back, 6.0 mm Bottom (HDF_WHITE_6), 18.0 mm Front</text>
`;
    svg += `    <text x="${legX + 4}" y="${legY + 36}" class="legend-item">\u2022 HARDWARE: UNDERMOUNT_CONCEALED_21MM slides (nominal deduction 21.0 mm)</text>
`;
    svg += `    <text x="${legX + 4}" y="${legY + 42}" class="legend-item">\u2022 EDGE-BANDING (1.0 mm ABS): All exposed carcass front edges &amp; facades</text>
`;
    svg += `    <text x="${legX + 4}" y="${legY + 48}" class="legend-item">\u2022 EDGE-BANDING (0.4 mm Melamine): Shelves front face (adjustable)</text>
`;
    svg += `  </g>
`;
    const tbX = sheetW - m - 146;
    const tbY = sheetH - m - 56;
    const tbW = 144;
    const tbH = 52;
    const dateStr = options.date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    svg += `
  <!-- TITLE BLOCK (BOTTOM RIGHT) -->
`;
    svg += `  <g id="title_block">
`;
    svg += `    <rect x="${tbX}" y="${tbY}" width="${tbW}" height="${tbH}" class="title-block-border" />
`;
    svg += `    <line x1="${tbX}" y1="${tbY + 13}" x2="${tbX + tbW}" y2="${tbY + 13}" class="title-block-grid" />
`;
    svg += `    <line x1="${tbX}" y1="${tbY + 31}" x2="${tbX + tbW}" y2="${tbY + 31}" class="title-block-grid" />
`;
    svg += `    <line x1="${tbX + 72}" y1="${tbY + 13}" x2="${tbX + 72}" y2="${tbY + tbH}" class="title-block-grid" />
`;
    svg += `    <!-- Project & Organization Header -->
`;
    svg += `    <text x="${tbX + 4}" y="${tbY + 5}" class="title-main">${options.projectName || "FurniAI Engineering Systems"}</text>
`;
    svg += `    <text x="${tbX + 4}" y="${tbY + 10}" class="title-sub">AUTOMATED SHOP DRAWING &amp; FABRICATION SPECIFICATION</text>
`;
    svg += `    <!-- Design ID & Revision -->
`;
    svg += `    <text x="${tbX + 4}" y="${tbY + 18}" class="title-sub">DESIGN ID:</text>
`;
    svg += `    <text x="${tbX + 4}" y="${tbY + 24}" class="title-val">${proj.sourceSpecId}</text>
`;
    svg += `    <text x="${tbX + 76}" y="${tbY + 18}" class="title-sub">REVISION:</text>
`;
    svg += `    <text x="${tbX + 76}" y="${tbY + 24}" class="title-val">Rev ${proj.revision}</text>
`;
    svg += `    <text x="${tbX + 76}" y="${tbY + 29}" class="title-sub" style="font-size:1.9px;">SLIDES: UNDERMOUNT_CONCEALED_21MM | BOTTOMS: HDF_WHITE_6</text>
`;
    svg += `    <!-- Drawing Status & Scale -->
`;
    svg += `    <text x="${tbX + 4}" y="${tbY + 37}" class="title-sub">QUALIFICATION STATUS:</text>
`;
    svg += `    <text x="${tbX + 4}" y="${tbY + 43}" class="title-val">WORKSHOP REVIEW (NOT CNC)</text>
`;
    svg += `    <text x="${tbX + 76}" y="${tbY + 37}" class="title-sub">SHEET SIZE / DATE:</text>
`;
    svg += `    <text x="${tbX + 76}" y="${tbY + 43}" class="title-val">${sheet.widthMm}x${sheet.heightMm} mm (A3) | ${dateStr}</text>
`;
    svg += `    <text x="${tbX + 4}" y="${tbY + 49}" class="title-sub">UNITS:</text>
`;
    svg += `    <text x="${tbX + 16}" y="${tbY + 49}" class="title-val">MILLIMETRES (mm)</text>
`;
    svg += `    <text x="${tbX + 76}" y="${tbY + 49}" class="title-sub">ACCURACY: \xB10.5 mm</text>
`;
    svg += `  </g>
`;
    svg += `</svg>
`;
    return svg;
  }
  function exportShopDrawingsSVG(partGraph, filename, options = {}) {
    const svgContent = generateShopDrawingsSVG(partGraph, options);
    const name = filename || `${partGraph.sourceSpecId || "wardrobe"}-shop-drawings.svg`;
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    return {
      filename: name,
      mimeType: "image/svg+xml",
      content: svgContent
    };
  }
  function exportShopDrawingsPDF(partGraph, filename, options = {}) {
    const svgContent = generateShopDrawingsSVG(partGraph, options);
    const name = filename || `${partGraph.sourceSpecId || "wardrobe"}-shop-drawings.pdf`;
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${name}</title>
            <style>
              @page { size: A3 landscape; margin: 0; }
              body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background: #fff; }
              svg { width: 100vw; height: 100vh; max-width: 420mm; max-height: 297mm; }
            </style>
          </head>
          <body>
            ${svgContent}
            <script>
              window.onload = function() {
                window.print();
              };
            <\/script>
          </body>
        </html>
      `);
        printWindow.document.close();
      }
    }
    return {
      filename: name,
      mimeType: "application/pdf",
      content: svgContent
    };
  }

  // src/lib/production/dxfCompiler.js
  var DXF_LAYERS = Object.freeze({
    OUTLINE_CONTOUR: "OUTLINE_CONTOUR",
    GROOVE_BACK_PANEL: "GROOVE_BACK_PANEL",
    DRILL_SYSTEM_32: "DRILL_SYSTEM_32"
  });
  var GROOVE_HOST_ROLES = /* @__PURE__ */ new Set([
    PART_ROLES.TOP_PANEL,
    PART_ROLES.BOTTOM_PANEL,
    PART_ROLES.SIDE_PANEL_LEFT,
    PART_ROLES.SIDE_PANEL_RIGHT
  ]);
  var SYSTEM32_HOST_ROLES = /* @__PURE__ */ new Set([
    PART_ROLES.SIDE_PANEL_LEFT,
    PART_ROLES.SIDE_PANEL_RIGHT,
    PART_ROLES.DIVIDER_PANEL
  ]);
  var GROOVE_WIDTH_MM_MIN = 7;
  var GROOVE_WIDTH_MM_MAX = 8.5;
  var GROOVE_DEPTH_MM_MIN = 7;
  var GROOVE_DEPTH_MM_MAX = 10;
  var SYSTEM32_DIAMETER_MM = 5;
  var SYSTEM32_DEPTH_DEFAULT_MM = 13;
  function isSystem32DrillingApproved(options = {}) {
    const explicit = options.approveSystem32Drilling === true || options.approveDrilling === true || options.emitSystem32 === true;
    const status = options.qualificationStatus ?? options.partGraph?.qualificationStatus ?? null;
    return explicit === true && status === "CNC_QUALIFIED";
  }
  function compilePanelToDxf(panel, options = {}) {
    if (!panel || typeof panel !== "object") {
      throw new Error("compilePanelToDxf requires a panel object.");
    }
    const dims = resolvePanelDimsMm(panel);
    const { lengthMm: L, widthMm: W, thicknessMm: T } = dims;
    if (!(L > 0) || !(W > 0)) {
      throw new Error(`Panel "${panel.id || "?"}" has non-positive flat dimensions.`);
    }
    if (!(T > 0)) {
      throw new Error(`Panel "${panel.id || "?"}" has non-positive thickness (${T}).`);
    }
    const layers = /* @__PURE__ */ new Set([DXF_LAYERS.OUTLINE_CONTOUR]);
    const entities = [];
    const outline = [
      [0, 0],
      [L, 0],
      [L, W],
      [0, W],
      [0, 0]
    ];
    entities.push(...polylineEntity(DXF_LAYERS.OUTLINE_CONTOUR, outline));
    const groove = resolveGrooveSpec(panel, options, dims);
    if (groove) {
      layers.add(DXF_LAYERS.GROOVE_BACK_PANEL);
      const groovePoly = buildInsetGroovePolyline(L, W, groove);
      assertPolylineInsideOutline(groovePoly, L, W);
      entities.push(
        ...commentEntity(
          `GROOVE_BACK_PANEL widthMm=${fmt(groove.widthMm)} depthMm=${fmt(groove.depthMm)} rearSetbackMm=${fmt(groove.rearSetbackMm)}`
        )
      );
      entities.push(...polylineEntity(DXF_LAYERS.GROOVE_BACK_PANEL, groovePoly));
      entities.push(...xdataFurniai([
        ["grooveWidthMm", String(groove.widthMm)],
        ["grooveDepthMm", String(groove.depthMm)],
        ["grooveRearSetbackMm", String(groove.rearSetbackMm)]
      ]));
    }
    const drillOk = isSystem32DrillingApproved(options);
    if (drillOk && isSystem32Host(panel)) {
      layers.add(DXF_LAYERS.DRILL_SYSTEM_32);
      const depthMm = resolveSystem32DepthMm(options);
      const holes = resolveSystem32Holes(panel, dims, options);
      entities.push(
        ...commentEntity(
          `DRILL_SYSTEM_32 diameterMm=${SYSTEM32_DIAMETER_MM} depthMm=${fmt(depthMm)} count=${holes.length}`
        )
      );
      for (const h of holes) {
        assertPointInsideOutline(h.x, h.y, L, W, SYSTEM32_DIAMETER_MM / 2);
        entities.push(...circleEntity(DXF_LAYERS.DRILL_SYSTEM_32, h.x, h.y, SYSTEM32_DIAMETER_MM / 2));
      }
      entities.push(...xdataFurniai([
        ["drillDiameterMm", String(SYSTEM32_DIAMETER_MM)],
        ["drillDepthMm", String(depthMm)]
      ]));
    }
    return buildDxfDocument([...layers], entities);
  }
  function compileCabinetDxfPackage(partGraph, options = {}) {
    if (!partGraph || typeof partGraph !== "object") {
      throw new Error("compileCabinetDxfPackage requires a PartGraph object.");
    }
    const parts = Array.isArray(partGraph.parts) ? partGraph.parts : [];
    const operations = Array.isArray(partGraph.operations) ? partGraph.operations : [];
    const packageOptions = {
      ...options,
      partGraph,
      qualificationStatus: options.qualificationStatus ?? partGraph.qualificationStatus ?? null
    };
    const out = [];
    for (const panel of parts) {
      if (!isMachinablePanel(panel)) continue;
      const panelOps = operations.filter((op) => op && op.hostPartId === panel.id);
      const dxfContent = compilePanelToDxf(panel, {
        ...packageOptions,
        operations: panelOps.length ? panelOps : packageOptions.operations
      });
      out.push({
        filename: safeDxfFilename(panel.id),
        dxfContent,
        metadata: buildPanelMetadata(panel)
      });
    }
    return out;
  }
  function isMachinablePanel(panel) {
    if (!panel || typeof panel !== "object") return false;
    if (panel.machinable === false || panel.nonMachinable === true) return false;
    if (panel.geometryType && panel.geometryType !== GEOMETRY_TYPES.RECTANGULAR_PANEL) {
      return false;
    }
    if (panel.group === "accessory" || panel.previewOnly === true) return false;
    return Boolean(panel.finished || panel.lengthMm != null && panel.widthMm != null);
  }
  function resolvePanelDimsMm(panel) {
    if (panel.finished && panel.finished.lengthDmm != null) {
      return {
        lengthMm: fromDeciMm(panel.finished.lengthDmm),
        widthMm: fromDeciMm(panel.finished.widthDmm),
        thicknessMm: fromDeciMm(panel.finished.thicknessDmm)
      };
    }
    const lengthMm = Number(panel.lengthMm ?? panel.length);
    const widthMm = Number(panel.widthMm ?? panel.width);
    const thicknessMm = Number(panel.thicknessMm ?? panel.thickness ?? 18);
    return { lengthMm, widthMm, thicknessMm };
  }
  function buildPanelMetadata(panel) {
    const dims = resolvePanelDimsMm(panel);
    const edges = panel.edges || {};
    const toMm = (dmm) => {
      if (dmm == null) return 0;
      if (typeof dmm === "number" && Number.isInteger(dmm)) return fromDeciMm(dmm);
      return Number(dmm) || 0;
    };
    return {
      partId: panel.id ?? null,
      role: panel.role ?? null,
      boardThicknessMm: dims.thicknessMm,
      materialCode: panel.materialCode ?? null,
      grainDirection: panel.grainDirection ?? null,
      edgeBanding: {
        L1: toMm(edges.LENGTH_EDGE_1),
        L2: toMm(edges.LENGTH_EDGE_2),
        W1: toMm(edges.WIDTH_EDGE_1),
        W2: toMm(edges.WIDTH_EDGE_2)
      },
      finishedMm: {
        length: dims.lengthMm,
        width: dims.widthMm,
        thickness: dims.thicknessMm
      }
    };
  }
  function safeDxfFilename(id) {
    const base = String(id || "panel").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "panel";
    return `${base}.dxf`;
  }
  function resolveGrooveSpec(panel, options, dims) {
    const ops = options.operations || options.partGraph?.operations?.filter((o) => o.hostPartId === panel.id) || [];
    const grooveOp = ops.find(
      (o) => o && (o.type === "BACK_GROOVE" || o.type === "GROOVE")
    );
    const isBackInsert = panel.role === PART_ROLES.BACK_PANEL;
    if (isBackInsert && !grooveOp && panel.hasBackGroove !== true && !panel.backGroove) {
      return null;
    }
    const roleIsHost = GROOVE_HOST_ROLES.has(panel.role);
    const explicitMeta = panel.hasBackGroove === true || panel.backGroove != null;
    if (!grooveOp && !roleIsHost && !explicitMeta && !options.forceGroove) {
      return null;
    }
    let widthMm = Number(
      options.grooveWidthMm ?? grooveOp?.widthMm ?? (grooveOp?.widthDmm != null ? fromDeciMm(grooveOp.widthDmm) : null) ?? panel.backGroove?.widthMm ?? safeResolve("grooveWidthMm", 7)
    );
    let depthMm = Number(
      options.grooveDepthMm ?? grooveOp?.depthMm ?? (grooveOp?.depthDmm != null ? fromDeciMm(grooveOp.depthDmm) : null) ?? panel.backGroove?.depthMm ?? safeResolve("grooveDepthMm", 7)
    );
    const rearSetbackMm = Number(
      options.grooveRearSetbackMm ?? panel.backGroove?.rearSetbackMm ?? safeResolve("grooveRearDatumMm", 20)
    );
    widthMm = clamp(widthMm, GROOVE_WIDTH_MM_MIN, GROOVE_WIDTH_MM_MAX);
    depthMm = clamp(depthMm, GROOVE_DEPTH_MM_MIN, GROOVE_DEPTH_MM_MAX);
    const maxWidth = Math.max(0.5, dims.widthMm - 2 * 0.5);
    if (widthMm > maxWidth) widthMm = maxWidth;
    return { widthMm, depthMm, rearSetbackMm };
  }
  function buildInsetGroovePolyline(lengthMm, widthMm, groove) {
    const inset = 0.5;
    const half = groove.widthMm / 2;
    let cy = widthMm - groove.rearSetbackMm - half;
    const minCy = inset + half;
    const maxCy = widthMm - inset - half;
    cy = clamp(cy, minCy, maxCy);
    const x0 = inset;
    const x1 = lengthMm - inset;
    const y0 = cy - half;
    const y1 = cy + half;
    return [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
      [x0, y0]
    ];
  }
  function assertPolylineInsideOutline(verts, L, W) {
    const eps = 1e-6;
    for (const [x, y] of verts) {
      if (x < -eps || y < -eps || x > L + eps || y > W + eps) {
        throw new Error(
          `Groove vertex (${x}, ${y}) crosses outer outline 0..${L} \xD7 0..${W}.`
        );
      }
    }
  }
  function assertPointInsideOutline(x, y, L, W, radius = 0) {
    const eps = 1e-6;
    if (x - radius < -eps || y - radius < -eps || x + radius > L + eps || y + radius > W + eps) {
      throw new Error(
        `Hole at (${x}, ${y}) r=${radius} crosses outer outline 0..${L} \xD7 0..${W}.`
      );
    }
  }
  function isSystem32Host(panel) {
    if (panel.system32Host === true) return true;
    if (panel.role && SYSTEM32_HOST_ROLES.has(panel.role)) return true;
    if (Array.isArray(panel.system32Holes) || panel.emitSystem32 === true) return true;
    return false;
  }
  function resolveSystem32DepthMm(options) {
    if (Number.isFinite(options.system32DepthMm)) return options.system32DepthMm;
    return safeResolve("shelfPinHoleDepthMm", SYSTEM32_DEPTH_DEFAULT_MM);
  }
  function resolveSystem32Holes(panel, dims, options) {
    if (Array.isArray(options.system32Holes) && options.system32Holes.length) {
      return options.system32Holes.map((h) => ({ x: Number(h.x), y: Number(h.y) }));
    }
    if (Array.isArray(panel.system32Holes) && panel.system32Holes.length) {
      return panel.system32Holes.map((h) => ({ x: Number(h.x), y: Number(h.y) }));
    }
    const pitchMm = safeResolve("shelfPinPitchMm", 32);
    const frontSetbackMm = 37;
    const originFromBottomMm = 64;
    const radius = SYSTEM32_DIAMETER_MM / 2;
    const margin = radius + 0.5;
    const { lengthMm: L, widthMm: W } = dims;
    const colsY = [frontSetbackMm, W - frontSetbackMm].filter(
      (y) => y >= margin && y <= W - margin
    );
    const holes = [];
    for (let x = originFromBottomMm; x <= L - margin; x += pitchMm) {
      if (x < margin) continue;
      for (const y of colsY) {
        holes.push({ x: round1(x), y: round1(y) });
      }
    }
    return holes;
  }
  function safeResolve(key, fallback) {
    try {
      const v = resolve(key);
      return v == null ? fallback : v;
    } catch {
      return fallback;
    }
  }
  function buildDxfDocument(layerNames, entityLines) {
    const lines = [];
    const push = (...xs) => {
      for (const x of xs) lines.push(String(x));
    };
    push("0", "SECTION", "2", "HEADER");
    push("9", "$ACADVER", "1", "AC1009");
    push("9", "$INSUNITS", "70", "4");
    push("9", "$MEASUREMENT", "70", "1");
    push("0", "ENDSEC");
    push("0", "SECTION", "2", "TABLES");
    push("0", "TABLE", "2", "LAYER", "70", String(layerNames.length));
    for (const name of layerNames) {
      push(
        "0",
        "LAYER",
        "2",
        name,
        "70",
        "0",
        "62",
        String(layerColor(name)),
        "6",
        "CONTINUOUS"
      );
    }
    push("0", "ENDTAB");
    push("0", "TABLE", "2", "APPID", "70", "1");
    push("0", "APPID", "2", "FURNIAI", "70", "0");
    push("0", "ENDTAB");
    push("0", "ENDSEC");
    push("0", "SECTION", "2", "ENTITIES");
    for (const line of entityLines) push(line);
    push("0", "ENDSEC");
    push("0", "EOF");
    return `${lines.join("\n")}
`;
  }
  function layerColor(name) {
    switch (name) {
      case DXF_LAYERS.OUTLINE_CONTOUR:
        return 7;
      case DXF_LAYERS.GROOVE_BACK_PANEL:
        return 2;
      case DXF_LAYERS.DRILL_SYSTEM_32:
        return 3;
      default:
        return 7;
    }
  }
  function polylineEntity(layer, vertices) {
    const lines = [];
    lines.push("0", "POLYLINE", "8", layer, "66", "1", "70", "1");
    for (const [x, y] of vertices) {
      lines.push("0", "VERTEX", "8", layer, "10", fmt(x), "20", fmt(y), "30", "0.0");
    }
    lines.push("0", "SEQEND", "8", layer);
    return lines;
  }
  function circleEntity(layer, cx, cy, radius) {
    return [
      "0",
      "CIRCLE",
      "8",
      layer,
      "10",
      fmt(cx),
      "20",
      fmt(cy),
      "30",
      "0.0",
      "40",
      fmt(radius)
    ];
  }
  function commentEntity(text) {
    return ["999", String(text)];
  }
  function xdataFurniai(pairs) {
    const lines = ["1001", "FURNIAI"];
    for (const [k, v] of pairs) {
      lines.push("1000", `${k}=${v}`);
    }
    return lines;
  }
  function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
  }
  function fmt(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0.0";
    const rounded = Math.round(x * 1e3) / 1e3;
    let s = rounded.toFixed(3);
    s = s.replace(/\.?0+$/, "");
    if (!s.includes(".")) s = `${s}.0`;
    return s;
  }
  function round1(n) {
    return Math.round(Number(n) * 10) / 10;
  }

  // src/lib/production/nestingCompiler.js
  var STOCK_SHEETS = Object.freeze([
    Object.freeze({ id: "SHEET_2440x1220", lengthMm: 2440, widthMm: 1220 }),
    Object.freeze({ id: "SHEET_2800x2070", lengthMm: 2800, widthMm: 2070 })
  ]);
  var DEFAULT_KERF_MM = 3.5;
  var DEFAULT_PERIMETER_TRIM_MM = 15;
  var MAX_USABLE_SHEET_LENGTH_MM = 2800 - 2 * DEFAULT_PERIMETER_TRIM_MM;
  var MAX_USABLE_SHEET_WIDTH_MM = 2070 - 2 * DEFAULT_PERIMETER_TRIM_MM;
  var PANEL_EXCEEDS_SHEET_ENVELOPE = "PANEL_EXCEEDS_SHEET_ENVELOPE";
  var UNROUTED_MATERIAL_ERROR = "UNROUTED_MATERIAL_ERROR";
  var ROUTED_MATERIAL_CODES = Object.freeze([
    "MEL_WHITE_18",
    "MEL_WHITE_15",
    "HDF_WHITE_6",
    "HDF_WHITE_06",
    "BIRCH_PLY_15"
  ]);
  var ROUTED_MATERIAL_SET = new Set(ROUTED_MATERIAL_CODES);
  function isRoutedMaterialCode(materialCode) {
    const code = String(materialCode ?? "").trim().toUpperCase();
    return code.length > 0 && ROUTED_MATERIAL_SET.has(code);
  }
  function assertRoutedMaterialCode(materialCode, partId = "") {
    const code = String(materialCode ?? "").trim();
    const upper = code.toUpperCase();
    if (isRoutedMaterialCode(upper)) return upper;
    const label = code.length > 0 ? code : "(empty)";
    const where = partId ? ` part "${partId}"` : "";
    const err = new Error(
      `Unrecognized material code ${label}${where}: nesting refuses unrouted stock (no default bucket).`
    );
    err.code = UNROUTED_MATERIAL_ERROR;
    err.materialCode = code;
    if (partId) err.partId = partId;
    throw err;
  }
  var OVERSIZED_SPLIT_POLICIES = Object.freeze({
    TWO_PIECE_TONGUE_AND_GROOVE: "TWO_PIECE_TONGUE_AND_GROOVE",
    H_CHANNEL_SPLICE: "H_CHANNEL_SPLICE"
  });
  var CUT_LIST_CSV_COLUMNS = Object.freeze([
    "Part ID",
    "Role",
    "Material",
    "Cut Length (mm)",
    "Cut Width (mm)",
    "Thickness (mm)",
    "Qty",
    "Grain",
    "Band L1",
    "Band L2",
    "Band W1",
    "Band W2"
  ]);
  function normalizeGrainDirection(grain) {
    if (grain == null || grain === "") return GRAIN_DIRECTIONS.NONE;
    const g = String(grain).trim().toUpperCase();
    if (g === "LENGTHWISE" || g === GRAIN_DIRECTIONS.LENGTH || g === "L") {
      return GRAIN_DIRECTIONS.LENGTH;
    }
    if (g === GRAIN_DIRECTIONS.WIDTH || g === "W") {
      return GRAIN_DIRECTIONS.WIDTH;
    }
    if (g === GRAIN_DIRECTIONS.NONE || g === "NO_GRAIN" || g === "-") {
      return GRAIN_DIRECTIONS.NONE;
    }
    return g;
  }
  function allowedOrientations(grainNormalized) {
    const g = normalizeGrainDirection(grainNormalized);
    if (g === GRAIN_DIRECTIONS.NONE) return ["natural", "rotated"];
    if (g === GRAIN_DIRECTIONS.LENGTH || g === GRAIN_DIRECTIONS.WIDTH) {
      return ["natural"];
    }
    return ["natural"];
  }
  function isMachinablePanel2(panel) {
    if (!panel || typeof panel !== "object") return false;
    if (panel.machinable === false || panel.nonMachinable === true) return false;
    if (panel.geometryType && panel.geometryType !== GEOMETRY_TYPES.RECTANGULAR_PANEL) {
      return false;
    }
    if (panel.group === "accessory" || panel.previewOnly === true) return false;
    return Boolean(panel.finished || panel.raw || panel.lengthMm != null && panel.widthMm != null);
  }
  function edgeToMm(dmm) {
    if (dmm == null) return 0;
    if (typeof dmm === "number" && Number.isInteger(dmm)) return fromDeciMm(dmm);
    return Number(dmm) || 0;
  }
  function resolveCutPanelMm(panel) {
    const edges = panel.edges || {};
    const band = {
      L1: edgeToMm(edges.LENGTH_EDGE_1),
      L2: edgeToMm(edges.LENGTH_EDGE_2),
      W1: edgeToMm(edges.WIDTH_EDGE_1),
      W2: edgeToMm(edges.WIDTH_EDGE_2)
    };
    let cutLengthMm;
    let cutWidthMm;
    let thicknessMm;
    let finishedLengthMm;
    let finishedWidthMm;
    if (panel.raw && panel.raw.lengthDmm != null) {
      cutLengthMm = fromDeciMm(panel.raw.lengthDmm);
      cutWidthMm = fromDeciMm(panel.raw.widthDmm);
      thicknessMm = fromDeciMm(panel.raw.thicknessDmm ?? panel.finished?.thicknessDmm ?? 180);
    } else if (panel.finished && panel.finished.lengthDmm != null) {
      finishedLengthMm = fromDeciMm(panel.finished.lengthDmm);
      finishedWidthMm = fromDeciMm(panel.finished.widthDmm);
      thicknessMm = fromDeciMm(panel.finished.thicknessDmm);
      cutLengthMm = finishedLengthMm - band.W1 - band.W2;
      cutWidthMm = finishedWidthMm - band.L1 - band.L2;
    } else {
      cutLengthMm = Number(panel.cutLengthMm ?? panel.lengthMm ?? panel.length);
      cutWidthMm = Number(panel.cutWidthMm ?? panel.widthMm ?? panel.width);
      thicknessMm = Number(panel.thicknessMm ?? panel.thickness ?? 18);
    }
    if (panel.finished && panel.finished.lengthDmm != null) {
      finishedLengthMm = fromDeciMm(panel.finished.lengthDmm);
      finishedWidthMm = fromDeciMm(panel.finished.widthDmm);
    } else {
      finishedLengthMm = cutLengthMm + band.W1 + band.W2;
      finishedWidthMm = cutWidthMm + band.L1 + band.L2;
    }
    const grain = normalizeGrainDirection(panel.grainDirection);
    const qty = Math.max(1, Number(panel.quantity ?? panel.qty ?? 1) || 1);
    return {
      partId: panel.id ?? null,
      role: panel.role ?? null,
      material: panel.materialCode ?? panel.material ?? "",
      cutLengthMm,
      cutWidthMm,
      thicknessMm,
      finishedLengthMm,
      finishedWidthMm,
      qty,
      grain,
      grainRaw: panel.grainDirection ?? GRAIN_DIRECTIONS.NONE,
      band
    };
  }
  function csvEscape(v) {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  function roundMm(n, digits = 1) {
    const f = 10 ** digits;
    return Math.round(Number(n) * f) / f;
  }
  function buildCutListRows(partGraph) {
    if (!partGraph || typeof partGraph !== "object") {
      throw new Error("buildCutListRows requires a PartGraph object.");
    }
    const parts = Array.isArray(partGraph.parts) ? partGraph.parts : [];
    const rows = [];
    for (const panel of parts) {
      if (!isMachinablePanel2(panel)) continue;
      const r = resolveCutPanelMm(panel);
      if (!(r.cutLengthMm > 0) || !(r.cutWidthMm > 0)) {
        throw new Error(
          `Panel "${r.partId || "?"}" has non-positive cut dimensions (${r.cutLengthMm}\xD7${r.cutWidthMm}).`
        );
      }
      if (!(r.thicknessMm > 0)) {
        throw new Error(
          `Panel "${r.partId || "?"}" has non-positive thickness (${r.thicknessMm}).`
        );
      }
      rows.push({
        partId: r.partId,
        role: r.role,
        material: r.material,
        cutLengthMm: roundMm(r.cutLengthMm),
        cutWidthMm: roundMm(r.cutWidthMm),
        thicknessMm: roundMm(r.thicknessMm),
        qty: r.qty,
        grain: r.grain,
        bandL1: roundMm(r.band.L1),
        bandL2: roundMm(r.band.L2),
        bandW1: roundMm(r.band.W1),
        bandW2: roundMm(r.band.W2)
      });
    }
    return rows;
  }
  function generateCutListCsv(partGraph) {
    const rows = buildCutListRows(partGraph);
    const lines = [CUT_LIST_CSV_COLUMNS.join(",")];
    for (const r of rows) {
      lines.push(
        [
          csvEscape(r.partId),
          csvEscape(r.role),
          csvEscape(r.material),
          r.cutLengthMm,
          r.cutWidthMm,
          r.thicknessMm,
          r.qty,
          csvEscape(r.grain),
          r.bandL1,
          r.bandL2,
          r.bandW1,
          r.bandW2
        ].join(",")
      );
    }
    return lines.join("\n");
  }
  function sumEdgeBandingLinearMeters(cutRows) {
    const acc = /* @__PURE__ */ new Map();
    const add = (thicknessMm, lengthMm, qty) => {
      if (!(thicknessMm > 0) || !(lengthMm > 0)) return;
      const t = roundMm(thicknessMm, 2);
      acc.set(t, (acc.get(t) || 0) + lengthMm * qty);
    };
    for (const r of cutRows) {
      add(r.bandL1, r.cutLengthMm, r.qty);
      add(r.bandL2, r.cutLengthMm, r.qty);
      add(r.bandW1, r.cutWidthMm, r.qty);
      add(r.bandW2, r.cutWidthMm, r.qty);
    }
    const out = {};
    for (const [t, mm] of [...acc.entries()].sort((a, b) => a[0] - b[0])) {
      out[String(t)] = roundMm(mm / 1e3, 4);
    }
    return out;
  }
  function expandNestItems(cutRows) {
    const items = [];
    for (const r of cutRows) {
      for (let i = 0; i < r.qty; i++) {
        items.push({
          instanceId: `${r.partId}#${i + 1}`,
          partId: r.partId,
          role: r.role,
          grain: r.grain,
          material: r.material,
          thicknessMm: r.thicknessMm,
          lengthMm: r.cutLengthMm,
          widthMm: r.cutWidthMm,
          areaMm2: r.cutLengthMm * r.cutWidthMm
        });
      }
    }
    return items;
  }
  function placementCandidates(item) {
    const orients = allowedOrientations(item.grain);
    const out = [];
    for (const o of orients) {
      if (o === "natural") {
        out.push({
          placedW: item.lengthMm,
          placedH: item.widthMm,
          orientation: "natural"
        });
      } else {
        out.push({
          placedW: item.widthMm,
          placedH: item.lengthMm,
          orientation: "rotated"
        });
      }
    }
    return out;
  }
  function aabbsOverlap(a, b, eps = 1e-6) {
    return a.x < b.x + b.w - eps && a.x + a.w > b.x + eps && a.y < b.y + b.h - eps && a.y + a.h > b.y + eps;
  }
  function packFfdhShelves(items, sheet, options = {}) {
    const kerfMm = options.kerfMm ?? DEFAULT_KERF_MM;
    const trimMm = options.perimeterTrimMm ?? DEFAULT_PERIMETER_TRIM_MM;
    const usableW = sheet.lengthMm - 2 * trimMm;
    const usableH = sheet.widthMm - 2 * trimMm;
    if (!(usableW > 0) || !(usableH > 0)) {
      throw new Error(
        `Stock ${sheet.id || "?"} usable area non-positive after ${trimMm}mm trim.`
      );
    }
    const unplaced = [];
    const placeable = [];
    for (const item of items) {
      const cands = placementCandidates(item).filter(
        (c) => c.placedW <= usableW + 1e-9 && c.placedH <= usableH + 1e-9
      );
      if (cands.length === 0) {
        unplaced.push({
          ...item,
          reason: `does not fit usable ${roundMm(usableW)}\xD7${roundMm(usableH)} mm on ${sheet.id || "sheet"} (grain=${item.grain})`
        });
      } else {
        placeable.push({ item, cands });
      }
    }
    placeable.sort((a, b) => {
      const ah = Math.max(...a.cands.map((c) => c.placedH));
      const bh = Math.max(...b.cands.map((c) => c.placedH));
      if (bh !== ah) return bh - ah;
      const aw = Math.max(...a.cands.map((c) => c.placedW));
      const bw = Math.max(...b.cands.map((c) => c.placedW));
      return bw - aw;
    });
    const sheets = [];
    const newSheet = () => {
      const s = { index: sheets.length, placements: [], shelves: [] };
      sheets.push(s);
      return s;
    };
    const newShelf = (sheetState, height) => {
      const shelf = {
        y: 0,
        height,
        cursorX: 0,
        placements: []
      };
      if (sheetState.shelves.length === 0) {
        shelf.y = 0;
      } else {
        const prev = sheetState.shelves[sheetState.shelves.length - 1];
        shelf.y = prev.y + prev.height + kerfMm;
      }
      sheetState.shelves.push(shelf);
      return shelf;
    };
    let current = newSheet();
    for (const { item, cands } of placeable) {
      let placed = false;
      const ordered = [...cands].sort((a, b) => {
        if (a.orientation === "natural" && b.orientation !== "natural") return -1;
        if (b.orientation === "natural" && a.orientation !== "natural") return 1;
        return b.placedH - a.placedH;
      });
      for (const cand of ordered) {
        for (const shelf of current.shelves) {
          if (cand.placedH > shelf.height + 1e-9) continue;
          const needW = cand.placedW + (shelf.cursorX > 0 ? kerfMm : 0);
          if (shelf.cursorX + needW <= usableW + 1e-9) {
            const x = shelf.cursorX === 0 ? 0 : shelf.cursorX + kerfMm;
            const placement = {
              instanceId: item.instanceId,
              partId: item.partId,
              role: item.role,
              grain: item.grain,
              orientation: cand.orientation,
              x: roundMm(x, 3),
              y: roundMm(shelf.y, 3),
              w: roundMm(cand.placedW, 3),
              h: roundMm(cand.placedH, 3),
              sheetIndex: current.index
            };
            shelf.placements.push(placement);
            current.placements.push(placement);
            shelf.cursorX = x + cand.placedW;
            placed = true;
            break;
          }
        }
        if (placed) break;
        const usedH = current.shelves.length === 0 ? 0 : current.shelves[current.shelves.length - 1].y + current.shelves[current.shelves.length - 1].height;
        const gap2 = current.shelves.length === 0 ? 0 : kerfMm;
        if (usedH + gap2 + cand.placedH <= usableH + 1e-9) {
          const shelf = newShelf(current, cand.placedH);
          shelf.height = cand.placedH;
          const placement = {
            instanceId: item.instanceId,
            partId: item.partId,
            role: item.role,
            grain: item.grain,
            orientation: cand.orientation,
            x: 0,
            y: roundMm(shelf.y, 3),
            w: roundMm(cand.placedW, 3),
            h: roundMm(cand.placedH, 3),
            sheetIndex: current.index
          };
          shelf.placements.push(placement);
          current.placements.push(placement);
          shelf.cursorX = cand.placedW;
          placed = true;
          break;
        }
      }
      if (!placed) {
        current = newSheet();
        let done = false;
        for (const cand of ordered) {
          if (cand.placedW > usableW + 1e-9 || cand.placedH > usableH + 1e-9) continue;
          const shelf = newShelf(current, cand.placedH);
          const placement = {
            instanceId: item.instanceId,
            partId: item.partId,
            role: item.role,
            grain: item.grain,
            orientation: cand.orientation,
            x: 0,
            y: 0,
            w: roundMm(cand.placedW, 3),
            h: roundMm(cand.placedH, 3),
            sheetIndex: current.index
          };
          shelf.placements.push(placement);
          current.placements.push(placement);
          shelf.cursorX = cand.placedW;
          done = true;
          break;
        }
        if (!done) {
          unplaced.push({
            ...item,
            reason: `failed to pack on ${sheet.id || "sheet"} after new-sheet attempt`
          });
        }
      }
    }
    while (sheets.length > 0 && sheets[sheets.length - 1].placements.length === 0) {
      sheets.pop();
    }
    for (const s of sheets) {
      const rects = s.placements.map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h, id: p.instanceId }));
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          if (aabbsOverlap(rects[i], rects[j])) {
            throw new Error(
              `Nesting overlap on ${sheet.id} sheet ${s.index}: ${rects[i].id} vs ${rects[j].id}`
            );
          }
        }
      }
    }
    const sheetCount = sheets.length;
    const totalSheetAreaMm2 = sheetCount * sheet.lengthMm * sheet.widthMm;
    const totalPanelAreaMm2 = items.filter((it) => !unplaced.some((u) => u.instanceId === it.instanceId)).reduce((a, it) => a + it.areaMm2, 0);
    const yieldEfficiencyPct = totalSheetAreaMm2 > 0 ? roundMm(totalPanelAreaMm2 / totalSheetAreaMm2 * 100, 2) : 0;
    return {
      stock: {
        id: sheet.id,
        lengthMm: sheet.lengthMm,
        widthMm: sheet.widthMm,
        usableLengthMm: roundMm(usableW, 1),
        usableWidthMm: roundMm(usableH, 1)
      },
      kerfMm,
      perimeterTrimMm: trimMm,
      sheets: sheets.map((s) => ({
        index: s.index,
        placements: s.placements
      })),
      sheetCount,
      totalSheetAreaMm2,
      totalPanelAreaMm2,
      yieldEfficiencyPct,
      unplaced
    };
  }
  function scorePack(pack) {
    const unplacedPenalty = (pack.unplaced?.length || 0) * 1e9;
    const stockArea = pack.stock.lengthMm * pack.stock.widthMm;
    return unplacedPenalty + pack.sheetCount * 1e6 - pack.yieldEfficiencyPct * 1e3 + stockArea;
  }
  function materialThicknessGroupKey(row) {
    const material = String(row.material ?? row.materialCode ?? "").trim() || "UNKNOWN_MATERIAL";
    const thicknessMm = roundMm(row.thicknessMm ?? 0, 2);
    return `${material}|${thicknessMm}`;
  }
  function groupCutRowsByMaterialThickness(cutRows) {
    const groups = /* @__PURE__ */ new Map();
    for (const row of cutRows) {
      const groupKey = materialThicknessGroupKey(row);
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          groupKey,
          material: String(row.material ?? "").trim() || "UNKNOWN_MATERIAL",
          thicknessMm: roundMm(row.thicknessMm ?? 0, 2),
          rows: []
        });
      }
      groups.get(groupKey).rows.push(row);
    }
    return groups;
  }
  function usableSheetEnvelopeMm(perimeterTrimMm = DEFAULT_PERIMETER_TRIM_MM, stock = { lengthMm: 2800, widthMm: 2070 }) {
    return {
      lengthMm: stock.lengthMm - 2 * perimeterTrimMm,
      widthMm: stock.widthMm - 2 * perimeterTrimMm
    };
  }
  function exceedsSheetEnvelope(lengthMm, widthMm, grain, usable) {
    const orients = allowedOrientations(grain);
    for (const o of orients) {
      const placedW = o === "natural" ? lengthMm : widthMm;
      const placedH = o === "natural" ? widthMm : lengthMm;
      if (placedW <= usable.lengthMm + 1e-9 && placedH <= usable.widthMm + 1e-9) {
        return false;
      }
    }
    return true;
  }
  function splitPanelAtDividerFaces(lengthMm, widthMm, dividerPlacementsMm, usable) {
    const dividers = [...new Set(
      (dividerPlacementsMm || []).map(Number).filter((x) => Number.isFinite(x) && x > 1e-9 && x < lengthMm - 1e-9)
    )].sort((a, b) => a - b);
    if (dividers.length === 0) {
      return {
        ok: false,
        code: PANEL_EXCEEDS_SHEET_ENVELOPE,
        message: "Oversized panel has split policy but no internal bay divider placements to align seams."
      };
    }
    const cuts = [0, ...dividers, lengthMm];
    const pieces = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const x0 = cuts[i];
      const x1 = cuts[i + 1];
      const pieceLengthMm = roundMm(x1 - x0, 3);
      const pieceWidthMm = roundMm(widthMm, 3);
      if (pieceLengthMm > usable.lengthMm + 1e-9 || pieceWidthMm > usable.widthMm + 1e-9) {
        return {
          ok: false,
          code: PANEL_EXCEEDS_SHEET_ENVELOPE,
          message: `Split piece ${pieceLengthMm}\xD7${pieceWidthMm} mm still exceeds usable ${usable.lengthMm}\xD7${usable.widthMm} mm.`
        };
      }
      pieces.push({
        index: i,
        lengthMm: pieceLengthMm,
        widthMm: pieceWidthMm,
        /** Left edge X in original panel coords — equals divider face when i > 0 */
        seamX: i === 0 ? null : roundMm(x0, 3),
        leftX: roundMm(x0, 3),
        rightX: roundMm(x1, 3)
      });
    }
    for (const piece of pieces) {
      if (piece.seamX != null && !dividers.some((d) => Math.abs(d - piece.seamX) < 1e-6)) {
        return {
          ok: false,
          code: PANEL_EXCEEDS_SHEET_ENVELOPE,
          message: `Seam X=${piece.seamX} does not align with an internal bay divider face.`
        };
      }
    }
    return { ok: true, pieces, dividerPlacementsMm: dividers };
  }
  function evaluateOversizedPanelPolicy(panel, options = {}) {
    if (!panel || typeof panel !== "object") {
      return {
        ok: false,
        oversized: false,
        code: "INVALID_PANEL",
        message: "evaluateOversizedPanelPolicy requires a panel object."
      };
    }
    const lengthMm = Number(panel.cutLengthMm ?? panel.lengthMm ?? panel.length);
    const widthMm = Number(panel.cutWidthMm ?? panel.widthMm ?? panel.width);
    const grain = normalizeGrainDirection(panel.grainDirection ?? panel.grain);
    const perimeterTrimMm = options.perimeterTrimMm ?? DEFAULT_PERIMETER_TRIM_MM;
    const stock = options.envelopeStock ?? { lengthMm: 2800, widthMm: 2070 };
    const usable = options.usableEnvelopeMm ?? usableSheetEnvelopeMm(perimeterTrimMm, stock);
    if (!(lengthMm > 0) || !(widthMm > 0)) {
      return {
        ok: false,
        oversized: false,
        code: "INVALID_PANEL_DIMS",
        message: `Panel "${panel.partId || panel.id || "?"}" has non-positive dims.`
      };
    }
    const oversized = exceedsSheetEnvelope(lengthMm, widthMm, grain, usable);
    if (!oversized) {
      return {
        ok: true,
        oversized: false,
        policy: null,
        pieces: [
          {
            index: 0,
            lengthMm: roundMm(lengthMm, 3),
            widthMm: roundMm(widthMm, 3),
            seamX: null,
            leftX: 0,
            rightX: roundMm(lengthMm, 3)
          }
        ],
        seamXs: [],
        usableEnvelopeMm: usable
      };
    }
    const policy = panel.splitPolicy ?? options.splitPolicy ?? panel.oversizedSplitPolicy ?? null;
    const allowed = new Set(Object.values(OVERSIZED_SPLIT_POLICIES));
    if (!policy || !allowed.has(policy)) {
      return {
        ok: false,
        oversized: true,
        code: PANEL_EXCEEDS_SHEET_ENVELOPE,
        message: `Panel "${panel.partId || panel.id || "?"}" ${roundMm(lengthMm)}\xD7${roundMm(widthMm)} mm exceeds usable sheet envelope ${usable.lengthMm}\xD7${usable.widthMm} mm (SHEET_2800x2070 minus ${perimeterTrimMm} mm trim each side). Configure split policy ${Object.values(OVERSIZED_SPLIT_POLICIES).join(" | ")}.`,
        policy: policy || null,
        usableEnvelopeMm: usable
      };
    }
    const dividers = panel.dividerPlacementsMm ?? options.dividerPlacementsMm ?? panel.internalBayDividerFacesMm ?? [];
    const split = splitPanelAtDividerFaces(lengthMm, widthMm, dividers, usable);
    if (!split.ok) {
      return {
        ok: false,
        oversized: true,
        code: split.code || PANEL_EXCEEDS_SHEET_ENVELOPE,
        message: split.message,
        policy,
        usableEnvelopeMm: usable
      };
    }
    const seamXs = split.pieces.map((p) => p.seamX).filter((x) => x != null);
    return {
      ok: true,
      oversized: true,
      policy,
      pieces: split.pieces,
      seamXs,
      dividerPlacementsMm: split.dividerPlacementsMm,
      usableEnvelopeMm: usable
    };
  }
  function packMaterialThicknessRun(group, stockSheets, kerfMm, perimeterTrimMm) {
    const items = expandNestItems(group.rows);
    const packsByStock = {};
    let primary = null;
    for (const stock of stockSheets) {
      const pack = packFfdhShelves(items, stock, { kerfMm, perimeterTrimMm });
      packsByStock[stock.id] = {
        sheetCount: pack.sheetCount,
        yieldEfficiencyPct: pack.yieldEfficiencyPct,
        totalPanelAreaMm2: pack.totalPanelAreaMm2,
        totalSheetAreaMm2: pack.totalSheetAreaMm2,
        unplacedCount: pack.unplaced.length,
        unplaced: pack.unplaced,
        sheets: pack.sheets,
        stock: pack.stock
      };
      if (!primary || scorePack(pack) < scorePack(primary)) {
        primary = pack;
      }
    }
    if (!primary) {
      throw new Error(`packMaterialThicknessRun: no stock for group ${group.groupKey}`);
    }
    if (primary.unplaced.length > 0) {
      const sample = primary.unplaced[0];
      throw new Error(
        `Nesting failed in group ${group.groupKey}: ${primary.unplaced.length} part(s) do not fit. Example: ${sample.instanceId} \u2014 ${sample.reason}`
      );
    }
    const sheets = primary.sheets.map((s) => ({
      ...s,
      groupKey: group.groupKey,
      material: group.material,
      thicknessMm: group.thicknessMm,
      placements: s.placements.map((p) => ({
        ...p,
        groupKey: group.groupKey,
        material: group.material,
        thicknessMm: group.thicknessMm
      }))
    }));
    return {
      groupKey: group.groupKey,
      material: group.material,
      thicknessMm: group.thicknessMm,
      cutList: group.rows,
      packsByStock,
      primaryStockId: primary.stock.id,
      sheetCount: primary.sheetCount,
      yieldEfficiencyPct: primary.yieldEfficiencyPct,
      totalPanelAreaMm2: primary.totalPanelAreaMm2,
      totalSheetAreaMm2: primary.totalSheetAreaMm2,
      sheets,
      stock: primary.stock
    };
  }
  function compileNestingManifest(partGraph, options = {}) {
    if (!partGraph || typeof partGraph !== "object") {
      throw new Error("compileNestingManifest requires a PartGraph object.");
    }
    const kerfMm = options.kerfMm ?? DEFAULT_KERF_MM;
    const perimeterTrimMm = options.perimeterTrimMm ?? DEFAULT_PERIMETER_TRIM_MM;
    const stockSheets = options.stockSheets ?? STOCK_SHEETS;
    const envelopeStock = stockSheets.find((s) => s.id === "SHEET_2800x2070") || stockSheets.reduce(
      (best, s) => !best || s.lengthMm * s.widthMm > best.lengthMm * best.widthMm ? s : best,
      null
    ) || { lengthMm: 2800, widthMm: 2070 };
    const usable = usableSheetEnvelopeMm(perimeterTrimMm, envelopeStock);
    const cutRows = buildCutListRows(partGraph);
    for (const row of cutRows) {
      assertRoutedMaterialCode(row.material ?? row.materialCode, row.partId);
    }
    const edgeBandingLinearMetersByThicknessMm = sumEdgeBandingLinearMeters(cutRows);
    const partsById = new Map(
      (Array.isArray(partGraph.parts) ? partGraph.parts : []).map((p) => [p.id, p])
    );
    const splitExpandedRows = [];
    const oversizedDecisions = [];
    for (const row of cutRows) {
      const src = partsById.get(row.partId) || {};
      const decision = evaluateOversizedPanelPolicy(
        {
          partId: row.partId,
          cutLengthMm: row.cutLengthMm,
          cutWidthMm: row.cutWidthMm,
          grain: row.grain,
          splitPolicy: src.splitPolicy ?? options.splitPolicy,
          dividerPlacementsMm: src.dividerPlacementsMm ?? src.internalBayDividerFacesMm ?? options.dividerPlacementsMm
        },
        { perimeterTrimMm, usableEnvelopeMm: usable, envelopeStock }
      );
      oversizedDecisions.push({ partId: row.partId, ...decision });
      if (!decision.ok) {
        const err = new Error(decision.message || `Oversized panel rejected: ${decision.code}`);
        err.code = decision.code || PANEL_EXCEEDS_SHEET_ENVELOPE;
        err.partId = row.partId;
        throw err;
      }
      if (decision.oversized && decision.pieces && decision.pieces.length > 1) {
        for (const piece of decision.pieces) {
          splitExpandedRows.push({
            ...row,
            partId: `${row.partId}__SPLIT_${piece.index + 1}`,
            cutLengthMm: piece.lengthMm,
            cutWidthMm: piece.widthMm,
            qty: row.qty,
            splitFrom: row.partId,
            seamX: piece.seamX,
            splitPolicy: decision.policy
          });
        }
      } else {
        splitExpandedRows.push(row);
      }
    }
    const groups = groupCutRowsByMaterialThickness(splitExpandedRows);
    const runs = [];
    for (const group of groups.values()) {
      runs.push(packMaterialThicknessRun(group, stockSheets, kerfMm, perimeterTrimMm));
    }
    runs.sort((a, b) => {
      if (b.thicknessMm !== a.thicknessMm) return b.thicknessMm - a.thicknessMm;
      return String(a.material).localeCompare(String(b.material));
    });
    const sheetCount = runs.reduce((n, r) => n + r.sheetCount, 0);
    const totalPanelAreaMm2 = runs.reduce((n, r) => n + r.totalPanelAreaMm2, 0);
    const totalSheetAreaMm2 = runs.reduce((n, r) => n + r.totalSheetAreaMm2, 0);
    const blendedYieldEfficiencyPct = totalSheetAreaMm2 > 0 ? roundMm(totalPanelAreaMm2 / totalSheetAreaMm2 * 100, 2) : 0;
    let globalIndex = 0;
    const sheets = [];
    for (const run of runs) {
      for (const s of run.sheets) {
        sheets.push({
          ...s,
          index: globalIndex++,
          runGroupKey: run.groupKey
        });
      }
    }
    const packsByStock = {};
    for (const stock of stockSheets) {
      let sc = 0;
      let panelArea = 0;
      let sheetArea = 0;
      const stockSheetsList = [];
      for (const run of runs) {
        const p = run.packsByStock[stock.id];
        if (!p) continue;
        sc += p.sheetCount;
        panelArea += p.totalPanelAreaMm2;
        sheetArea += p.totalSheetAreaMm2;
        for (const s of p.sheets) {
          stockSheetsList.push({
            ...s,
            groupKey: run.groupKey,
            material: run.material,
            thicknessMm: run.thicknessMm
          });
        }
      }
      packsByStock[stock.id] = {
        sheetCount: sc,
        yieldEfficiencyPct: sheetArea > 0 ? roundMm(panelArea / sheetArea * 100, 2) : 0,
        totalPanelAreaMm2: panelArea,
        totalSheetAreaMm2: sheetArea,
        unplacedCount: 0,
        unplaced: [],
        sheets: stockSheetsList,
        stock: {
          id: stock.id,
          lengthMm: stock.lengthMm,
          widthMm: stock.widthMm,
          usableLengthMm: roundMm(stock.lengthMm - 2 * perimeterTrimMm, 1),
          usableWidthMm: roundMm(stock.widthMm - 2 * perimeterTrimMm, 1)
        },
        note: "Aggregated across independent material\xD7thickness runs \u2014 not a single mixed nest."
      };
    }
    const primaryRun = runs.reduce(
      (best, r) => !best || r.totalPanelAreaMm2 > best.totalPanelAreaMm2 ? r : best,
      null
    ) || runs[0];
    return {
      algorithm: "FFDH_SHELF_BY_MATERIAL_THICKNESS",
      algorithmNotes: "Independent First-Fit Decreasing Height shelf packing per (materialCode, thicknessMm) group. Sheets are never shared across different material/thickness tuples. Yield % and sheet counts are primary per run (runs[]); top-level sheetCount is the procurement sum. blendedYieldEfficiencyPct is non-primary (legacy display only). Oversized panels exceeding usable 2770\xD72040 fail closed unless TWO_PIECE_TONGUE_AND_GROOVE or H_CHANNEL_SPLICE with divider-aligned seams.",
      kerfMm,
      perimeterTrimMm,
      usableEnvelopeMm: usable,
      grainPolicy: {
        LENGTH: "part length \u2016 sheet length (X); rotation rejected",
        LENGTHWISE: "alias of LENGTH",
        WIDTH: "part width \u2016 sheet width (Y); rotation rejected",
        NONE: "rotation allowed"
      },
      materialGrouping: "materialCode+thicknessMm",
      cutList: splitExpandedRows,
      edgeBandingLinearMetersByThicknessMm,
      oversizedDecisions,
      runs,
      totalPanelAreaMm2,
      totalSheetAreaMm2,
      sheetCount,
      // Primary yield metric is per-run — do not treat top-level as authoritative.
      yieldEfficiencyPct: primaryRun ? primaryRun.yieldEfficiencyPct : 0,
      primaryYieldSource: primaryRun ? { groupKey: primaryRun.groupKey, note: "yieldEfficiencyPct mirrors largest panel-area run; see runs[] for all" } : null,
      blendedYieldEfficiencyPct,
      packsByStock,
      primaryStockId: primaryRun ? primaryRun.primaryStockId : null,
      sheets,
      stock: primaryRun ? primaryRun.stock : null
    };
  }

  // src/lib/production/exportBridge.js
  var CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
      }
      table[n] = c;
    }
    return table;
  })();
  function computeCrc32(bytes) {
    let crc = 0 ^ -1;
    for (let i = 0; i < bytes.length; i++) {
      crc = crc >>> 8 ^ CRC_TABLE[(crc ^ bytes[i]) & 255];
    }
    return (crc ^ -1) >>> 0;
  }
  function createZipBuffer(files) {
    const encoder = new TextEncoder();
    const fileEntries = files.map((f) => {
      const nameBytes = encoder.encode(f.name);
      const dataBytes = typeof f.data === "string" ? encoder.encode(f.data) : f.data;
      const crc = computeCrc32(dataBytes);
      return { nameBytes, dataBytes, crc, size: dataBytes.length };
    });
    let totalSize = 0;
    for (const f of fileEntries) {
      totalSize += 30 + f.nameBytes.length + f.size;
      totalSize += 46 + f.nameBytes.length;
    }
    totalSize += 22;
    const buf = new Uint8Array(totalSize);
    const view = new DataView(buf.buffer);
    let offset = 0;
    const centralDirOffsets = [];
    for (const f of fileEntries) {
      centralDirOffsets.push(offset);
      view.setUint32(offset, 67324752, true);
      view.setUint16(offset + 4, 10, true);
      view.setUint16(offset + 6, 0, true);
      view.setUint16(offset + 8, 0, true);
      view.setUint16(offset + 10, 0, true);
      view.setUint16(offset + 12, 0, true);
      view.setUint32(offset + 14, f.crc, true);
      view.setUint32(offset + 18, f.size, true);
      view.setUint32(offset + 22, f.size, true);
      view.setUint16(offset + 26, f.nameBytes.length, true);
      view.setUint16(offset + 28, 0, true);
      offset += 30;
      buf.set(f.nameBytes, offset);
      offset += f.nameBytes.length;
      buf.set(f.dataBytes, offset);
      offset += f.size;
    }
    const centralDirStart = offset;
    for (let i = 0; i < fileEntries.length; i++) {
      const f = fileEntries[i];
      const localHeaderOffset = centralDirOffsets[i];
      view.setUint32(offset, 33639248, true);
      view.setUint16(offset + 4, 20, true);
      view.setUint16(offset + 6, 10, true);
      view.setUint16(offset + 8, 0, true);
      view.setUint16(offset + 10, 0, true);
      view.setUint16(offset + 12, 0, true);
      view.setUint16(offset + 14, 0, true);
      view.setUint32(offset + 16, f.crc, true);
      view.setUint32(offset + 20, f.size, true);
      view.setUint32(offset + 24, f.size, true);
      view.setUint16(offset + 28, f.nameBytes.length, true);
      view.setUint16(offset + 30, 0, true);
      view.setUint16(offset + 32, 0, true);
      view.setUint16(offset + 34, 0, true);
      view.setUint16(offset + 36, 0, true);
      view.setUint32(offset + 38, 0, true);
      view.setUint32(offset + 42, localHeaderOffset, true);
      offset += 46;
      buf.set(f.nameBytes, offset);
      offset += f.nameBytes.length;
    }
    const centralDirSize = offset - centralDirStart;
    view.setUint32(offset, 101010256, true);
    view.setUint16(offset + 4, 0, true);
    view.setUint16(offset + 6, 0, true);
    view.setUint16(offset + 8, fileEntries.length, true);
    view.setUint16(offset + 10, fileEntries.length, true);
    view.setUint32(offset + 12, centralDirSize, true);
    view.setUint32(offset + 16, centralDirStart, true);
    view.setUint16(offset + 20, 0, true);
    return buf;
  }
  function triggerFileDownload(filename, mimeType, data) {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function exportCutListCSV(partGraph, filename) {
    const csvContent = generateCutListCsv(partGraph);
    const name = filename || `${partGraph?.sourceSpecId || "furniai"}-cut-list.csv`;
    triggerFileDownload(name, "text/csv;charset=utf-8;", csvContent);
    return {
      filename: name,
      mimeType: "text/csv",
      content: csvContent
    };
  }
  function exportCabinetDxfZip(partGraph, filename, options = {}) {
    const dxfFiles = compileCabinetDxfPackage(partGraph, options);
    const name = filename || `${partGraph?.sourceSpecId || "furniai"}-cnc-dxf.zip`;
    const filesToZip = dxfFiles.map((f) => ({
      name: f.filename,
      data: f.dxfContent
    }));
    const manifestText = [
      "============================================================",
      "FurniAI CNC Fabrication Package \u2014 AutoCAD R12 DXF Layer Set",
      "============================================================",
      `Source Spec ID: ${partGraph?.sourceSpecId || "N/A"}`,
      `Qualification Status: ${partGraph?.qualificationStatus || "WORKSHOP_REVIEW_NOT_CNC_QUALIFIED"}`,
      `Total Machinable Panels: ${dxfFiles.length}`,
      `Generated: ${(/* @__PURE__ */ new Date()).toISOString()}`,
      "",
      "LAYERS INCLUDED:",
      "  - OUTLINE_CONTOUR: Closed perimeter polyline (outer dimension)",
      "  - GROOVE_BACK_PANEL: Back panel insert groove toolpath (7.0 mm width)",
      "  - DRILL_SYSTEM_32: Shelf pin holes (Fail-closed: requires CNC_QUALIFIED)",
      "",
      "PANEL FILES:",
      ...dxfFiles.map((f) => `  * ${f.filename}`),
      "============================================================"
    ].join("\n");
    filesToZip.push({
      name: "README_CNC_PACKAGE.txt",
      data: manifestText
    });
    const zipBuffer = createZipBuffer(filesToZip);
    triggerFileDownload(name, "application/zip", zipBuffer);
    return {
      filename: name,
      mimeType: "application/zip",
      buffer: zipBuffer,
      fileCount: dxfFiles.length
    };
  }
  function formatNestingReport(manifest) {
    if (!manifest || typeof manifest !== "object") {
      throw new Error("formatNestingReport requires a compiled nesting manifest.");
    }
    const stockW = manifest.stock?.lengthMm || 2440;
    const stockH = manifest.stock?.widthMm || 1220;
    const totalSheetM2 = (manifest.totalSheetAreaMm2 / 1e6).toFixed(2);
    const totalPanelM2 = (manifest.totalPanelAreaMm2 / 1e6).toFixed(2);
    const yieldPct = Number(manifest.yieldEfficiencyPct ?? manifest.blendedYieldEfficiencyPct ?? 0).toFixed(1);
    const edgeBandingLines = [];
    const bandingEntries = Object.entries(
      manifest.edgeBandingLinearMetersByThicknessMm || {}
    );
    for (const [thickness, meters] of bandingEntries) {
      const label = thickness === "1" || thickness === "1.0" ? "1.0 mm ABS (Front / Exposed Edges)" : `${thickness} mm Edge Tape`;
      edgeBandingLines.push({
        thicknessMm: Number(thickness),
        label,
        linearMeters: meters
      });
    }
    const textLines = [
      "============================================================",
      "FurniAI Sheet Nesting & Material Optimization Report",
      "============================================================",
      `Stock Format:       ${manifest.primaryStockId} (${stockW} \xD7 ${stockH} mm)`,
      `Required Sheets:    ${manifest.sheetCount} sheets`,
      `Material Yield:     ${yieldPct}% (primary run; see per-material runs)`,
      `Total Sheet Area:   ${totalSheetM2} m\xB2`,
      `Net Panel Area:     ${totalPanelM2} m\xB2`,
      `Kerf Width:         ${manifest.kerfMm} mm`,
      `Perimeter Trim:     ${manifest.perimeterTrimMm} mm`,
      "------------------------------------------------------------",
      "EDGE-BANDING SCHEDULE:",
      ...edgeBandingLines.map(
        (e) => `  \u2022 ${e.label}: ${e.linearMeters.toFixed(2)} m`
      ),
      "------------------------------------------------------------",
      ...Array.isArray(manifest.runs) && manifest.runs.length ? [
        "MATERIAL RUNS (independent nests \u2014 yield per group):",
        ...manifest.runs.map(
          (r) => `  \u2022 ${r.material} @ ${r.thicknessMm} mm: ${r.sheetCount} sheet(s), yield ${Number(r.yieldEfficiencyPct).toFixed(1)}%`
        ),
        "------------------------------------------------------------"
      ] : [],
      `Total Parts Placed: ${manifest.cutList?.length || 0}`,
      "============================================================"
    ];
    const html = `
<div class="nesting-report-modal-content">
  <div style="font-family:'Space Mono',monospace;font-size:11px;color:#888;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;">Manufacturing Preflight</div>
  <h3 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#1C1E21;">Sheet Nesting &amp; Material Report</h3>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px;">
    <div style="background:#F5F3EF;padding:12px;border-radius:8px;border:1px solid #E5E0D6;">
      <div style="font-size:10.5px;color:#666;text-transform:uppercase;letter-spacing:.05em;">Sheets Required</div>
      <div style="font-size:22px;font-weight:700;color:#1C1E21;margin-top:2px;">${manifest.sheetCount} <span style="font-size:12px;font-weight:400;color:#666;">sheets</span></div>
      <div style="font-size:10px;color:#888;margin-top:2px;">${stockW} \xD7 ${stockH} mm</div>
    </div>
    <div style="background:#F5F3EF;padding:12px;border-radius:8px;border:1px solid #E5E0D6;">
      <div style="font-size:10.5px;color:#666;text-transform:uppercase;letter-spacing:.05em;">Material Yield</div>
      <div style="font-size:22px;font-weight:700;color:#00B4D8;margin-top:2px;">${yieldPct}%</div>
      <div style="font-size:10px;color:#888;margin-top:2px;">${totalPanelM2} m\xB2 of ${totalSheetM2} m\xB2</div>
    </div>
    <div style="background:#F5F3EF;padding:12px;border-radius:8px;border:1px solid #E5E0D6;">
      <div style="font-size:10.5px;color:#666;text-transform:uppercase;letter-spacing:.05em;">Cut Parts</div>
      <div style="font-size:22px;font-weight:700;color:#1C1E21;margin-top:2px;">${manifest.cutList?.length || 0}</div>
      <div style="font-size:10px;color:#888;margin-top:2px;">Kerf: ${manifest.kerfMm} mm</div>
    </div>
  </div>

  <div style="margin-bottom:18px;">
    <div style="font-size:11px;font-weight:600;color:#1C1E21;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Edge-Banding Linear Meters</div>
    <div style="background:#fff;border:1px solid #E5E0D6;border-radius:8px;padding:10px 14px;">
      ${edgeBandingLines.map(
      (e) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #F0ECE4;font-size:12px;">
          <span style="color:#444;">${e.label}</span>
          <strong style="font-family:'Space Mono',monospace;color:#1C1E21;">${e.linearMeters.toFixed(2)} m</strong>
        </div>`
    ).join("")}
    </div>
  </div>

  <div style="font-size:10.5px;color:#888;line-height:1.4;">
    Optimization: First-Fit Decreasing Height (FFDH) shelf packing. Guillotine cut compatible.
  </div>
</div>
  `.trim();
    return {
      sheetCount: manifest.sheetCount,
      primaryStockId: manifest.primaryStockId,
      stockDimensionsMm: { length: stockW, width: stockH },
      yieldEfficiencyPct: manifest.yieldEfficiencyPct,
      totalSheetAreaM2: Number(totalSheetM2),
      totalPanelAreaM2: Number(totalPanelM2),
      edgeBanding: edgeBandingLines,
      partsCount: manifest.cutList?.length || 0,
      text: textLines.join("\n"),
      html
    };
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
    if (typeof builder.updateActionButtons === "function") {
      builder.updateActionButtons();
    }
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
  function loadApprovedPartGraph(builder, partGraph) {
    if (!builder || !builder.scene) {
      throw new Error("Builder and Builder.scene are required.");
    }
    if (!partGraph || !Array.isArray(partGraph.parts)) {
      throw new Error("loadApprovedPartGraph requires a valid PartGraph with parts array.");
    }
    builder.clear();
    const THREE2 = typeof window !== "undefined" && window.THREE || globalThis.THREE;
    const furnitureGroup = partGraphToThree(partGraph, { threeInstance: THREE2 });
    const env = partGraph.summary?.envelope;
    const envW = (env?.widthDmm ?? 18e3) * DMM_TO_THREE;
    const envH = (env?.heightDmm ?? 24e3) * DMM_TO_THREE;
    const envD = (env?.depthDmm ?? 6e3) * DMM_TO_THREE;
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
    if (typeof builder.updateActionButtons === "function") {
      builder.updateActionButtons();
    }
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
  var loadDraftPartGraph = loadApprovedPartGraph;
  return __toCommonJS(browserBridge_exports);
})();
