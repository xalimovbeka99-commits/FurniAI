/**
 * Furniture knowledge — BOOKCASE.
 * ----------------------------------------------------------------------
 * Every number here is a CONFIGURABLE APPLICATION RULE for FurniAI's
 * concept stage — not a building code or a hardware spec. Tune freely;
 * nothing outside this file needs to change when you do (validator.js and
 * furnitureBrain.js only ever read through this module's exported
 * functions). Modelled on wardrobe.js — see that file's header for the
 * pattern this follows. Maps onto `/builder`'s `shelves` configurator type
 * (see furniture-knowledge/categories.js).
 */
import { GENERATION_TARGETS } from "../fsl/enums.js";

export const FURNITURE_TYPE = "bookcase";

/**
 * min/max = structurally impossible outside this range (hard error).
 * standardMin/standardMax = still valid, but unusual enough to warn about.
 * default = applied when allow_defaults is true and the user didn't say.
 */
export const DIMENSION_RULES = Object.freeze({
  width_mm: { min: 300, max: 4000, standardMin: 600, standardMax: 2400, default: 1200 },
  height_mm: { min: 300, max: 3000, standardMin: 900, standardMax: 2400, default: 2000 },
  depth_mm: { min: 200, max: 600, standardMin: 250, standardMax: 400, default: 350 },
});

export const DEFAULT_MATERIALS = Object.freeze({
  body: { material: "mdf", thickness_mm: 18, finish: "oak_matte" },
  facades: { material: "mdf", thickness_mm: 18, finish: "oak_matte" },
  back_panel: { material: "hdf", thickness_mm: 6, finish: "oak" },
});

export const DEFAULT_STYLE = Object.freeze({
  theme: "scandinavian",
  primary_color: "oak",
  secondary_color: null,
  finish: "matte",
  door_style: "flat_panel",
  handle_style: "minimal",
});

/** Components a bookcase concept may legitimately contain. */
export const ALLOWED_COMPONENTS = Object.freeze([
  "side_panel",
  "top_panel",
  "bottom_panel",
  "back_panel",
  "divider",
  "shelf",
  "open_shelf",
  "hinged_door",
  "drawer",
  "handle",
  "internal_led",
  "plinth",
  "end_panel",
  "filler_panel",
]);

export const COMPONENT_RULES = Object.freeze({
  // A shelf spanning more than this without a divider/support is prone to
  // sagging under book weight — a real, if approximate, joinery concern.
  shelf: { maxSpanMm: 900 },
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
 * Bookcase-specific semantic warnings beyond plain range checks — shelf
 * span vs sag risk, given the requested width and how many vertical
 * dividers/columns the shelves are actually broken into. Returns
 * `createWarning`-shaped plain objects (kept dependency-free here; the
 * validator wraps them).
 */
export function semanticWarnings({ dimensions, components = [] }) {
  const warnings = [];
  const width = dimensions?.width_mm;
  const dividerCount = components.filter((c) => c.type === "divider").reduce((sum, c) => sum + (c.quantity || 0), 0);
  const hasShelves = components.some((c) => c.type === "shelf" || c.type === "open_shelf");

  if (Number.isFinite(width) && hasShelves) {
    const columns = dividerCount + 1;
    const span = width / columns;
    if (span > COMPONENT_RULES.shelf.maxSpanMm) {
      warnings.push({
        code: "UNUSUAL_SHELF_SPAN",
        field: "components",
        message: `At ${columns} column(s) across ${width}mm, each shelf would span ~${Math.round(span)}mm — beyond the recommended ${COMPONENT_RULES.shelf.maxSpanMm}mm before sagging becomes likely under book weight. Consider an extra divider.`,
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
// universal joinery standard.

const DEFAULT_QUANTITY_BY_TYPE = Object.freeze({
  shelf: 4,
  open_shelf: 4,
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
  shelf: "body",
  open_shelf: "body",
  side_panel: "body",
  top_panel: "body",
  bottom_panel: "body",
  divider: "body",
  plinth: "body",
  end_panel: "body",
  filler_panel: "body",
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
