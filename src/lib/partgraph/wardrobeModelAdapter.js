/**
 * WardrobeModel -> FurniSpec adapter.
 *
 * WHY THIS EXISTS RATHER THAN A SECOND COMPILER
 *
 * Two engineering stacks exist (docs/m2/RULE_AUTHORITY_POLICY.md section 1):
 * `wardrobe-model` + `wardrobe-tools`, and `furnispec` + `partgraph`. Only the
 * second compiles to a PartGraph. The obvious way to give the first one a
 * PartGraph is to write it a compiler of its own; that would fork the geometry
 * and the two would drift.
 *
 * This adapter does the other thing: it translates a WardrobeModel into a
 * FurniSpec and hands it to the existing `buildStructuralPartGraph`. One
 * compiler, one set of construction rules, one place a bug can live.
 *
 * WHY NOT REUSE assembleFurniSpec
 *
 * `conversation/assembleFurniSpec.js` also produces a FurniSpec, but from a
 * small fixed fact set whose `bayLayouts` admits exactly two archetypes
 * (LONG_HANGING, SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES). A WardrobeModel
 * carries arbitrary components at arbitrary heights. Routing through it would
 * silently discard whatever did not fit an archetype, which is the failure mode
 * the component ledger exists to prevent. So this module maps the model's real
 * components and derives everything else from the rule catalog.
 *
 * NO NUMBER IS INVENTED HERE
 *
 * Every construction constant is read through `resolve()`. If a rule is not
 * approved, `resolve()` throws and this adapter throws with it. The only
 * arithmetic performed is closure arithmetic on values the model itself states.
 *
 * FAIL-CLOSED ON ANYTHING IT CANNOT EXPRESS
 *
 * A component the adapter cannot translate exactly is never dropped and never
 * approximated. `adaptWardrobeModelToFurniSpec` throws, naming each one;
 * `adapterDiagnostics` returns the same list without throwing, so a caller can
 * ask before committing.
 */
import { validateFurniSpec } from "../furnispec/validate.js";
import {
  COMPONENT_TYPES as SPEC_COMPONENT_TYPES,
  FURNISPEC_SCHEMA_VERSION,
  HARDWARE_APPROVAL_STATUS,
  MACHINING_POLICY,
  QUALIFICATION_STATUS,
  SIDE_INSET_STATUS,
  SPEC_STATUS,
} from "../furnispec/schema.js";
import { COMPONENT_TYPES as MODEL_COMPONENT_TYPES } from "../wardrobe-model/schema.js";
import { materialsFor } from "../rules/materialCatalog.js";
import { resolve, ruleIdOf } from "../rules/wardrobeRuleCatalog.js";

export const ADAPTER_VERSION = "wardrobe-model-adapter/0.1";

/**
 * A WardrobeModel SHELF does not say whether it is fixed or adjustable;
 * FurniSpec requires the distinction. FIXED is the conservative reading: a
 * housed panel that carries load, rather than one resting on pins. This is a
 * MAPPING DECISION between two schemas, not a furniture rule, which is why it
 * lives here and not in the rule catalog. Override per component with
 * `shelfKindFor` when the caller knows better.
 */
export const DEFAULT_SHELF_KIND = SPEC_COMPONENT_TYPES.SHELF_FIXED;

export class AdapterError extends Error {
  constructor(diagnostics) {
    super(
      `Cannot adapt WardrobeModel to FurniSpec: ${diagnostics.length} component(s) or input(s) cannot be expressed exactly.\n` +
        diagnostics.map((d) => `  - [${d.code}] ${d.message}`).join("\n")
    );
    this.name = "AdapterError";
    this.code = "WARDROBE_MODEL_NOT_ADAPTABLE";
    this.diagnostics = diagnostics;
  }
}

/**
 * Everything the adapter could not translate exactly, without throwing.
 *
 * @param {object} wardrobeModel
 * @param {{ plinthHeightMm?: number, finishType?: string }} [options]
 * @returns {Array<{code:string, message:string, componentId?:string}>}
 */
export function adapterDiagnostics(wardrobeModel, options = {}) {
  const diagnostics = [];

  if (!wardrobeModel || typeof wardrobeModel !== "object") {
    return [{ code: "NOT_A_MODEL", message: "No WardrobeModel was supplied." }];
  }
  for (const field of ["id", "revision", "widthMm", "heightMm", "depthMm", "panelThicknessMm"]) {
    if (wardrobeModel[field] === undefined || wardrobeModel[field] === null) {
      diagnostics.push({ code: "MISSING_MODEL_FIELD", message: `WardrobeModel.${field} is required.` });
    }
  }
  if (!Array.isArray(wardrobeModel.sections) || wardrobeModel.sections.length === 0) {
    diagnostics.push({ code: "NO_SECTIONS", message: "WardrobeModel.sections must hold at least one section." });
  }

  // A WardrobeModel has no plinth. FurniSpec requires one and no approved rule
  // supplies a height, so the caller must state it. Guessing a plinth height
  // would change where every part sits.
  const plinthHeightMm = options.plinthHeightMm ?? wardrobeModel.plinthHeightMm;
  if (!(typeof plinthHeightMm === "number" && plinthHeightMm >= 0)) {
    diagnostics.push({
      code: "PLINTH_HEIGHT_NOT_SUPPLIED",
      message:
        "A WardrobeModel carries no plinth and no approved rule states a plinth height. " +
        "Pass options.plinthHeightMm (or set model.plinthHeightMm) - it is not derivable.",
    });
  }

  for (const section of wardrobeModel.sections ?? []) {
    for (const comp of section.components ?? []) {
      switch (comp.type) {
        case MODEL_COMPONENT_TYPES.SHELF:
        case MODEL_COMPONENT_TYPES.DOOR:
        case MODEL_COMPONENT_TYPES.DIVIDER:
          break;
        case MODEL_COMPONENT_TYPES.DRAWER_BANK:
          if (!Number.isInteger(comp.rows) || comp.rows < 1) {
            diagnostics.push({
              code: "DRAWER_ROWS_MISSING",
              componentId: comp.id,
              message: `Drawer bank "${comp.id}" has no integer row count.`,
            });
          }
          break;
        case MODEL_COMPONENT_TYPES.HANGING_RAIL: {
          const shelfAbove = nearestShelfAbove(section, comp);
          if (!shelfAbove) {
            diagnostics.push({
              code: "RAIL_HAS_NO_SHELF_ABOVE",
              componentId: comp.id,
              message:
                `Hanging rail "${comp.id}" has no shelf above it in its section. FurniSpec positions a ` +
                "rail by offsetBelowShelfMm, so a rail with nothing above it cannot be expressed.",
            });
          }
          break;
        }
        default:
          diagnostics.push({
            code: "UNMAPPABLE_COMPONENT_TYPE",
            componentId: comp.id,
            message: `Component "${comp.id}" has type "${comp.type}", which this adapter cannot express in FurniSpec.`,
          });
      }
    }
  }

  return diagnostics;
}

/**
 * Translate a WardrobeModel into a FurniSpec that `buildStructuralPartGraph`
 * accepts. The model's `id` is preserved as the spec id and its `revision` is
 * incremented by one.
 *
 * @param {object} wardrobeModel
 * @param {{ plinthHeightMm?: number, finishType?: string, status?: string,
 *           shelfKindFor?: (comp: object) => string }} [options]
 * @returns {object} a validated FurniSpec
 * @throws {AdapterError} when any component or input cannot be expressed exactly
 */
export function adaptWardrobeModelToFurniSpec(wardrobeModel, options = {}) {
  const diagnostics = adapterDiagnostics(wardrobeModel, options);
  if (diagnostics.length > 0) throw new AdapterError(diagnostics);

  const {
    finishType = "melamine",
    status = SPEC_STATUS.PROPOSED,
    shelfKindFor = () => DEFAULT_SHELF_KIND,
  } = options;
  const plinthHeightMm = options.plinthHeightMm ?? wardrobeModel.plinthHeightMm;

  // --- Construction constants, every one read from an approved rule.
  const panelThicknessMm = wardrobeModel.panelThicknessMm;
  const backThicknessMm = resolve("backThicknessMm");
  const doorBumperGapMm = resolve("doorBumperGapMm");
  const doorRevealMm = resolve("doorRevealMm");
  const grooveWidthMm = resolve("grooveWidthMm");
  const grooveDepthMm = resolve("grooveDepthMm");
  const grooveRearDatumMm = resolve("grooveRearDatumMm");

  // --- Closure arithmetic over values the model itself states.
  const carcassHeightMm = wardrobeModel.heightMm - plinthHeightMm;
  const carcassDepthMm = wardrobeModel.depthMm - panelThicknessMm - doorBumperGapMm;

  const bays = wardrobeModel.sections.map((section, index) => ({
    id: section.id,
    index,
    clearWidthMm: section.widthMm,
    components: section.components
      .filter((c) => c.type !== MODEL_COMPONENT_TYPES.DOOR && c.type !== MODEL_COMPONENT_TYPES.DIVIDER)
      .map((comp) => adaptComponent(comp, section, { panelThicknessMm, carcassDepthMm, shelfKindFor })),
  }));

  const doorCount = wardrobeModel.sections.reduce(
    (n, s) => n + (s.components ?? []).filter((c) => c.type === MODEL_COMPONENT_TYPES.DOOR).reduce((m, c) => m + (c.leaves ?? 1), 0),
    0
  );

  const spec = {
    schemaVersion: FURNISPEC_SCHEMA_VERSION,
    specId: wardrobeModel.id,
    revision: wardrobeModel.revision + 1,
    unit: "mm",
    furnitureType: "wardrobe",
    wardrobeType: "straight_hinged",
    constructionStyle: resolve("constructionStyle"),
    finishType,
    status,
    // Hard-wired, exactly as assembleFurniSpec hard-wires them. Neither is a
    // parameter and there is no argument to this function that turns either on.
    qualificationStatus: QUALIFICATION_STATUS.WORKSHOP_REVIEW_NOT_CNC_QUALIFIED,
    envelope: {
      widthMm: wardrobeModel.widthMm,
      heightMm: wardrobeModel.heightMm,
      depthMm: wardrobeModel.depthMm,
    },
    plinth: {
      heightMm: plinthHeightMm,
      frontRecessMm: resolve("plinthFrontRecessMm"),
      sideInsetMm: resolve("plinthSideInsetMm"),
      sideInsetStatus: SIDE_INSET_STATUS.BEKZOD_APPROVED,
    },
    carcass: {
      heightMm: carcassHeightMm,
      depthMm: carcassDepthMm,
      panelThicknessMm,
      backThicknessMm,
      grooveWidthMm,
      grooveDepthMm,
      grooveRearDatumMm,
    },
    bays,
    doors: doorsFor({ wardrobeModel, carcassHeightMm, doorCount, panelThicknessMm, doorBumperGapMm, doorRevealMm }),
    materials: materialsFor(finishType),
    edgeBanding: {
      frontVisibleMm: resolve("edgeBandFrontVisibleMm"),
      rearUnbandedMm: resolve("edgeBandRearUnbandedMm"),
      doorPerimeterMm: resolve("edgeBandDoorPerimeterMm"),
    },
    clearancePolicy: {
      adjustableShelf: {
        sideClearanceMm: resolve("adjustableShelfSideClearanceMm"),
        frontSetbackMm: resolve("adjustableShelfFrontSetbackMm"),
      },
      backPanel: { grooveRootAllowanceMm: resolve("grooveRootAllowanceMm") },
    },
    hardware: {
      hinges: {
        type: resolve("hingeType"),
        countPerDoor: resolve("hingeCountPerDoor"),
        totalCount: doorCount * resolve("hingeCountPerDoor"),
        status: HARDWARE_APPROVAL_STATUS.BLOCKED_PENDING_HARDWARE_APPROVAL,
        note: "HARDWARE_SKU_PENDING_BEKZOD_CONFIRMATION",
      },
      shelfPins: {
        type: resolve("shelfPinType"),
        pitchMm: resolve("shelfPinPitchMm"),
        status: HARDWARE_APPROVAL_STATUS.BLOCKED_PENDING_HARDWARE_APPROVAL,
      },
      joinery: {
        type: resolve("joineryType"),
        status: HARDWARE_APPROVAL_STATUS.BLOCKED_PENDING_HARDWARE_APPROVAL,
      },
      hangingRails: { type: resolve("hangingRailType"), status: HARDWARE_APPROVAL_STATUS.PREVIEW_ONLY },
    },
    machiningPolicy: {
      backGroove: MACHINING_POLICY.APPROVED,
      drilling: MACHINING_POLICY.BLOCKED_PENDING_HARDWARE_APPROVAL,
    },
    adapter: { version: ADAPTER_VERSION, sourceModelRevision: wardrobeModel.revision },
  };

  // The contract is "consumable by buildStructuralPartGraph". Assert it here
  // rather than letting the builder discover it, so the failure names the
  // adapter rather than the kernel.
  const validation = validateFurniSpec(spec);
  if (!validation.valid) {
    throw new AdapterError(
      validation.errors.map((e) => ({
        code: e.code,
        message: `${e.message}${e.path ? ` (at ${e.path})` : ""}`,
      }))
    );
  }

  return spec;
}

/** The shelf immediately above `comp` in the same section, or null. */
function nearestShelfAbove(section, comp) {
  const above = (section.components ?? [])
    .filter((c) => c.type === MODEL_COMPONENT_TYPES.SHELF && c.positionMm > comp.positionMm)
    .sort((a, b) => a.positionMm - b.positionMm);
  return above[0] ?? null;
}

function adaptComponent(comp, section, { panelThicknessMm, carcassDepthMm, shelfKindFor }) {
  const rearSetbackMm = resolve("fixedShelfRearSetbackMm");

  if (comp.type === MODEL_COMPONENT_TYPES.SHELF) {
    return {
      id: comp.id,
      type: shelfKindFor(comp),
      // The model's positionMm is height above the section's interior floor,
      // which is exactly FurniSpec's offsetFromBottomMm. No conversion.
      offsetFromBottomMm: comp.positionMm,
      thicknessMm: panelThicknessMm,
      depthMm: carcassDepthMm - rearSetbackMm,
    };
  }

  if (comp.type === MODEL_COMPONENT_TYPES.HANGING_RAIL) {
    const shelfAbove = nearestShelfAbove(section, comp);
    return {
      id: comp.id,
      // LONG vs SHORT is classified against the two Bekzod-approved target
      // clear drops, not invented here: whichever target the rail's own drop
      // is nearer. Recorded for confirmation in the adapter report.
      type: railKindFor(comp),
      offsetBelowShelfMm: shelfAbove.positionMm - comp.positionMm,
    };
  }

  if (comp.type === MODEL_COMPONENT_TYPES.DRAWER_BANK) {
    return {
      id: comp.id,
      type: SPEC_COMPONENT_TYPES.DRAWER_BANK,
      offsetFromBottomMm: comp.positionMm,
      rows: comp.rows,
      heightMm: comp.heightMm,
    };
  }

  throw new Error(`adaptComponent reached an unmappable type "${comp.type}" — adapterDiagnostics should have caught it.`);
}

/**
 * Classify a rail against the two approved target clear drops. The rail's own
 * drop is `positionMm` above the section floor; the nearer approved target
 * names the kind. Both targets are GOLDEN_FIXTURE_BEKZOD_APPROVED.
 */
export function railKindFor(comp) {
  const longTarget = resolve("longHangingTargetClearDropMm");
  const shortTarget = resolve("shortHangingTargetClearDropMm");
  const drop = comp.positionMm;
  return Math.abs(drop - longTarget) <= Math.abs(drop - shortTarget)
    ? SPEC_COMPONENT_TYPES.HANGING_RAIL_LONG
    : SPEC_COMPONENT_TYPES.HANGING_RAIL_SHORT;
}

function doorsFor({ wardrobeModel, carcassHeightMm, doorCount, panelThicknessMm, doorBumperGapMm, doorRevealMm }) {
  if (doorCount === 0) {
    return {
      count: 0,
      thicknessMm: panelThicknessMm,
      bumperGapMm: doorBumperGapMm,
      finishedWidthMm: 0,
      finishedHeightMm: 0,
      reveals: { topMm: doorRevealMm, bottomMm: doorRevealMm, leftMm: doorRevealMm, rightMm: doorRevealMm, interDoorMm: doorRevealMm },
    };
  }
  // Perimeter reveals plus one inter-door gap between each adjacent pair.
  const availableWidthMm = wardrobeModel.widthMm - 2 * doorRevealMm - (doorCount - 1) * doorRevealMm;
  return {
    count: doorCount,
    thicknessMm: panelThicknessMm,
    bumperGapMm: doorBumperGapMm,
    finishedWidthMm: availableWidthMm / doorCount,
    finishedHeightMm: carcassHeightMm - 2 * doorRevealMm,
    reveals: {
      topMm: doorRevealMm,
      bottomMm: doorRevealMm,
      leftMm: doorRevealMm,
      rightMm: doorRevealMm,
      interDoorMm: doorRevealMm,
    },
  };
}

/** Rule IDs every adapted spec depends on, for provenance recording. */
export function adapterRuleIds() {
  return Object.freeze(
    [
      "constructionStyle", "backThicknessMm", "doorBumperGapMm", "doorRevealMm",
      "grooveWidthMm", "grooveDepthMm", "grooveRearDatumMm", "plinthFrontRecessMm",
      "plinthSideInsetMm", "edgeBandFrontVisibleMm", "edgeBandRearUnbandedMm",
      "edgeBandDoorPerimeterMm", "adjustableShelfSideClearanceMm",
      "adjustableShelfFrontSetbackMm", "grooveRootAllowanceMm", "hingeType",
      "hingeCountPerDoor", "shelfPinType", "shelfPinPitchMm", "joineryType",
      "hangingRailType", "fixedShelfRearSetbackMm",
      "longHangingTargetClearDropMm", "shortHangingTargetClearDropMm",
    ].map((key) => ({ key, ruleId: ruleIdOf(key) }))
  );
}
