/**
 * Furniture knowledge — OFFICE CABINET.
 * ----------------------------------------------------------------------
 * Every number here is a CONFIGURABLE APPLICATION RULE for FurniAI's
 * concept stage — not a building code or a hardware spec. Tune freely;
 * nothing outside this file needs to change when you do (validator.js and
 * furnitureBrain.js only ever read through this module's exported
 * functions). Modelled on wardrobe.js — see that file's header for the
 * pattern this follows.
 *
 * Note (fsl-v1.md): `office_cabinet` maps onto `/builder`'s `office`
 * configurator type, whose existing `knowledgeBase.js` default is
 * desk-height (750mm) — a pre-existing modelling quirk for a type that's
 * really meant to be a desk, not storage. Before this file existed,
 * `genericCategory.js` inherited that 750mm default for `office_cabinet`
 * too, which was wrong for what the name actually describes. This
 * dedicated file corrects that: an office_cabinet defaults to a tall
 * filing/storage cabinet, not a desk. `clampDimension()` in
 * `furnitureConfig.js` allows heights up to 3000mm, so this is safely
 * renderable — the old 750mm value was never a hard limit, just an
 * unexamined fallback.
 */
import { GENERATION_TARGETS } from "../fsl/enums.js";

export const FURNITURE_TYPE = "office_cabinet";

/**
 * min/max = structurally impossible outside this range (hard error).
 * standardMin/standardMax = still valid, but unusual enough to warn about.
 * default = applied when allow_defaults is true and the user didn't say.
 */
export const DIMENSION_RULES = Object.freeze({
  width_mm: { min: 300, max: 2400, standardMin: 600, standardMax: 1200, default: 900 },
  height_mm: { min: 300, max: 2200, standardMin: 720, standardMax: 2000, default: 1800 },
  depth_mm: { min: 300, max: 700, standardMin: 400, standardMax: 600, default: 450 },
});

export const DEFAULT_MATERIALS = Object.freeze({
  body: { material: "particle_board", thickness_mm: 18, finish: "grey_matte" },
  facades: { material: "laminate", thickness_mm: 18, finish: "grey_matte" },
  back_panel: { material: "hdf", thickness_mm: 6, finish: "grey" },
});

export const DEFAULT_STYLE = Object.freeze({
  theme: "contemporary",
  primary_color: "grey",
  secondary_color: null,
  finish: "matte",
  door_style: "flat_panel",
  handle_style: "bar",
});

/** Components an office_cabinet concept may legitimately contain. */
export const ALLOWED_COMPONENTS = Object.freeze([
  "side_panel",
  "top_panel",
  "bottom_panel",
  "back_panel",
  "divider",
  "shelf",
  "hinged_door",
  "sliding_door",
  "drawer",
  "handle",
  "plinth",
  "internal_led",
  "end_panel",
  "filler_panel",
]);

export const COMPONENT_RULES = Object.freeze({
  // Filing/storage drawers need enough width to actually take a folder or
  // ring binder — narrower than this and the drawer stops being useful
  // for its stated purpose, even though it's still structurally buildable.
  drawer: { minWidthMm: 300, maxWidthMm: 600 },
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
 * Office-cabinet-specific semantic warnings beyond plain range checks —
 * drawer width vs a usable filing range. Returns `createWarning`-shaped
 * plain objects (kept dependency-free here; the validator wraps them).
 */
export function semanticWarnings({ dimensions, components = [] }) {
  const warnings = [];
  const width = dimensions?.width_mm;
  const drawerComponents = components.filter((c) => c.type === "drawer");
  const totalDrawers = drawerComponents.reduce((sum, c) => sum + (c.quantity || 0), 0);

  if (Number.isFinite(width) && totalDrawers > 0) {
    const perDrawerWidth = width / totalDrawers;
    if (perDrawerWidth < COMPONENT_RULES.drawer.minWidthMm) {
      warnings.push({
        code: "FILING_DRAWER_TOO_NARROW",
        field: "components",
        message: `At ${totalDrawers} drawer(s) across ${width}mm, each drawer would be ~${Math.round(perDrawerWidth)}mm — narrower than the recommended ${COMPONENT_RULES.drawer.minWidthMm}mm minimum for filing/storage use. Consider fewer drawers.`,
        severity: "warning",
      });
    } else if (perDrawerWidth > COMPONENT_RULES.drawer.maxWidthMm) {
      warnings.push({
        code: "FILING_DRAWER_TOO_WIDE",
        field: "components",
        message: `At ${totalDrawers} drawer(s) across ${width}mm, each drawer would be ~${Math.round(perDrawerWidth)}mm — wider than the recommended ${COMPONENT_RULES.drawer.maxWidthMm}mm maximum for a single slide run. Consider more drawers.`,
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
// universal office-furniture standard.

const DEFAULT_QUANTITY_BY_TYPE = Object.freeze({
  shelf: 3,
  internal_led: 1,
});

const DEFAULT_PROPERTIES_BY_TYPE = Object.freeze({
  hinged_door: { soft_close: true },
  sliding_door: { soft_close: true },
  drawer: { soft_close: true },
  shelf: { adjustable: true },
});

const MATERIAL_REF_BY_TYPE = Object.freeze({
  hinged_door: "facades",
  sliding_door: "facades",
  drawer: "facades",
  handle: "facades",
  shelf: "body",
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
