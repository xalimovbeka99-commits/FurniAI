/**
 * Furniture knowledge — KITCHEN.
 * ----------------------------------------------------------------------
 * Every number here is a CONFIGURABLE APPLICATION RULE for FurniAI's
 * concept stage — not a building code or a hardware spec. Tune freely;
 * nothing outside this file needs to change when you do (validator.js and
 * furnitureBrain.js only ever read through this module's exported
 * functions). Modelled on wardrobe.js — see that file's header for the
 * pattern this follows.
 *
 * Scope reminder (docs/fsl-v1.md): `/builder` renders ONE cabinet carcass
 * in kitchen styling, not a fitted multi-cabinet run. Dimensions below
 * describe that single carcass (a full floor-to-overhead run treated as
 * one piece), not a real kitchen's total footprint.
 */
import { GENERATION_TARGETS } from "../fsl/enums.js";

export const FURNITURE_TYPE = "kitchen";

/**
 * min/max = structurally impossible outside this range (hard error).
 * standardMin/standardMax = still valid, but unusual enough to warn about.
 * default = applied when allow_defaults is true and the user didn't say.
 */
export const DIMENSION_RULES = Object.freeze({
  width_mm: { min: 600, max: 8000, standardMin: 1500, standardMax: 4500, default: 3000 },
  height_mm: { min: 700, max: 2500, standardMin: 1800, standardMax: 2300, default: 2200 },
  depth_mm: {
    min: 300,
    max: 700,
    standardMin: 550,
    standardMax: 650,
    default: 600,
    worktopClearanceMin: 500,
  },
});

export const DEFAULT_MATERIALS = Object.freeze({
  body: { material: "particle_board", thickness_mm: 18, finish: "white_matte" },
  facades: { material: "mdf", thickness_mm: 18, finish: "white_matte" },
  back_panel: { material: "hdf", thickness_mm: 6, finish: "white" },
});

export const DEFAULT_STYLE = Object.freeze({
  theme: "modern",
  primary_color: "white",
  secondary_color: null,
  finish: "matte",
  door_style: "flat_panel",
  handle_style: "bar",
});

/** Components a kitchen concept may legitimately contain. */
export const ALLOWED_COMPONENTS = Object.freeze([
  "side_panel",
  "top_panel",
  "bottom_panel",
  "back_panel",
  "divider",
  "shelf",
  "hinged_door",
  "drawer",
  "handle",
  "internal_led",
  "plinth",
  "countertop",
  "base_cabinet",
  "wall_cabinet",
  "tall_cabinet",
  "corner_cabinet",
  "end_panel",
  "filler_panel",
]);

export const COMPONENT_RULES = Object.freeze({
  door: { minWidthMm: 300, maxWidthMm: 600 },
  maxDrawersPerColumn: 5,
});

export function isStandardDimension(axis, valueMm) {
  const rule = DIMENSION_RULES[axis];
  if (!rule) return true;
  return valueMm >= rule.standardMin && valueMm <= rule.standardMax;
}

export function isStructurallyValidDimension(axis, valueMm) {
  const rule = DIMENSION_RULES[axis];
  if (!rule) return true;
  return Number.isFinite(valueMm) && valueMm >= rule.min && valueMm <= rule.max;
}

export function defaultDimensionMm(axis) {
  return DIMENSION_RULES[axis]?.default ?? null;
}

/**
 * Kitchen-specific semantic warnings beyond plain range checks — worktop
 * clearance vs depth, door width vs a hinge- and hand-friendly range for
 * base cabinetry. Returns `createWarning`-shaped plain objects (kept
 * dependency-free here; the validator wraps them).
 */
export function semanticWarnings({ dimensions, components = [] }) {
  const warnings = [];
  const depth = dimensions?.depth_mm;
  if (Number.isFinite(depth) && depth < DIMENSION_RULES.depth_mm.worktopClearanceMin) {
    warnings.push({
      code: "UNUSUAL_KITCHEN_DEPTH",
      field: "dimensions.depth_mm",
      message: "The requested depth is shallow for a standard worktop and base-cabinet run.",
      severity: "warning",
    });
  }

  const width = dimensions?.width_mm;
  const doorComponents = components.filter((c) => c.type === "hinged_door");
  const totalDoors = doorComponents.reduce((sum, c) => sum + (c.quantity || 0), 0);
  if (Number.isFinite(width) && totalDoors > 0) {
    const perDoorWidth = width / totalDoors;
    if (perDoorWidth > COMPONENT_RULES.door.maxWidthMm) {
      warnings.push({
        code: "DOOR_WIDTH_TOO_WIDE",
        field: "components",
        message: `At ${totalDoors} door(s) across ${width}mm, each door would be ~${Math.round(perDoorWidth)}mm — wider than the recommended ${COMPONENT_RULES.door.maxWidthMm}mm maximum for base cabinetry. Consider more doors.`,
        severity: "warning",
      });
    } else if (perDoorWidth < COMPONENT_RULES.door.minWidthMm) {
      warnings.push({
        code: "DOOR_WIDTH_TOO_NARROW",
        field: "components",
        message: `At ${totalDoors} door(s) across ${width}mm, each door would be ~${Math.round(perDoorWidth)}mm — narrower than the recommended ${COMPONENT_RULES.door.minWidthMm}mm minimum. Consider fewer doors.`,
        severity: "warning",
      });
    }
  }

  return warnings;
}

/** Concept tolerates more; configurator target is held to the same rules today (kept explicit for future divergence). */
export function toleranceForTarget(target) {
  return target === GENERATION_TARGETS.CONFIGURATOR ? "strict" : "loose";
}

// --- Component defaults ---------------------------------------------------
// Simple, documented v1 placeholders, same spirit as wardrobe.js — not a
// universal cabinetry standard.

const DEFAULT_QUANTITY_BY_TYPE = Object.freeze({
  shelf: 1,
  open_shelf: 1,
  internal_led: 1,
});

const DEFAULT_PROPERTIES_BY_TYPE = Object.freeze({
  hinged_door: { soft_close: true },
  drawer: { soft_close: true },
  internal_led: { activation: "switch" },
  shelf: { adjustable: true },
  open_shelf: { adjustable: true },
});

const MATERIAL_REF_BY_TYPE = Object.freeze({
  hinged_door: "facades",
  drawer: "facades",
  handle: "facades",
  countertop: "facades",
  shelf: "body",
  open_shelf: "body",
  side_panel: "body",
  top_panel: "body",
  bottom_panel: "body",
  divider: "body",
  plinth: "body",
  end_panel: "body",
  filler_panel: "body",
  base_cabinet: "body",
  wall_cabinet: "body",
  tall_cabinet: "body",
  corner_cabinet: "body",
  back_panel: "back_panel",
});

export function defaultComponentQuantity(type) {
  return DEFAULT_QUANTITY_BY_TYPE[type] ?? 1;
}

export function defaultComponentProperties(type) {
  return DEFAULT_PROPERTIES_BY_TYPE[type] ?? {};
}

export function defaultMaterialRefFor(type) {
  return MATERIAL_REF_BY_TYPE[type] ?? null;
}
