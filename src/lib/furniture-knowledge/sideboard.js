/**
 * Furniture knowledge — SIDEBOARD.
 * ----------------------------------------------------------------------
 * Every number here is a CONFIGURABLE APPLICATION RULE for FurniAI's
 * concept stage — not a building code or a hardware spec. Tune freely;
 * nothing outside this file needs to change when you do (validator.js and
 * furnitureBrain.js only ever read through this module's exported
 * functions). Modelled on officeCabinet.js — see that file's header for
 * the pattern this follows. Deliberately independent: no shared base with
 * wardrobe/kitchen/bookcase/officeCabinet.js, matching the 2026-07-22
 * decision that each category file is its own thing, not a shortcut.
 *
 * Note (fsl-v1.md / furniture-knowledge audit, 2026-07-23): `sideboard`
 * maps onto `/builder`'s `cabinet` configurator type, whose existing
 * `knowledgeBase.js` default is 1800mm tall — a tall storage-cabinet
 * height, wrong for what a sideboard actually is (a low, wide piece with
 * a flat display/serving top, typically 750-900mm tall). Before this file
 * existed, `genericCategory.js` inherited that 1800mm default for
 * `sideboard` too. This dedicated file corrects that, the same way
 * `officeCabinet.js` corrected the inherited 750mm desk-height default it
 * had. `clampDimension()` in `furnitureConfig.js` allows heights down to
 * 300mm, so 800mm was always safely renderable — the 1800mm value was an
 * unexamined fallback, not a hard limit.
 *
 * `furnitureConfig.js`'s `defaultModules("cabinet")` (two plain hinged
 * doors, no drawers) is a separate, `/builder`-side layout default that
 * doesn't really match a typical sideboard either — deliberately NOT
 * touched here, same as officeCabinet.js didn't touch `office`'s module
 * layout. That's geometry-layer work, out of scope for a knowledge file.
 */
import { GENERATION_TARGETS } from "../fsl/enums.js";

export const FURNITURE_TYPE = "sideboard";

/**
 * min/max = structurally impossible outside this range (hard error).
 * standardMin/standardMax = still valid, but unusual enough to warn about.
 * default = applied when allow_defaults is true and the user didn't say.
 */
export const DIMENSION_RULES = Object.freeze({
  width_mm: { min: 600, max: 3000, standardMin: 1200, standardMax: 2000, default: 1600 },
  height_mm: { min: 400, max: 1300, standardMin: 750, standardMax: 900, default: 800 },
  depth_mm: { min: 300, max: 600, standardMin: 400, standardMax: 500, default: 450 },
});

// `laminate` is already a MATERIAL_TYPES enum value (fsl/enums.js) — used
// directly here as the closest supported facade finish to a
// laminate/MDF-style front, not a new material category.
export const DEFAULT_MATERIALS = Object.freeze({
  body: { material: "particle_board", thickness_mm: 18, finish: "walnut" },
  facades: { material: "laminate", thickness_mm: 18, finish: "walnut" },
  back_panel: { material: "hdf", thickness_mm: 6, finish: "grey" },
});

export const DEFAULT_STYLE = Object.freeze({
  theme: "contemporary",
  primary_color: "walnut",
  secondary_color: null,
  finish: "satin",
  door_style: "flat_panel",
  handle_style: "bar",
});

/**
 * Components a sideboard concept may legitimately contain. Includes `leg`
 * (very common on sideboards — a display/serving piece is often raised on
 * legs rather than a plinth) even though `furniture-knowledge/components.js`
 * marks `leg` as configurator-unsupported today: that's a real, typical
 * component for this category, not something to silently drop from the
 * vocabulary. It has no default quantity/properties below (see "Component
 * defaults" section) — it only ever appears if the user's request actually
 * mentions it, and the validator's compatibility check will correctly mark
 * the resulting document `partially_supported`.
 *
 * Excludes `hanging_rail` (never applicable) and `mirror` (not a typical
 * sideboard front for v1 — mirrored sideboards exist but are a stylistic
 * niche, same conservative call officeCabinet.js made).
 */
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
  "leg",
  "internal_led",
  "end_panel",
  "filler_panel",
]);

export const COMPONENT_RULES = Object.freeze({
  // A sideboard drawer run sits across the top of the piece — wider than a
  // filing drawer, but still narrow enough below this that it stops being
  // a usable single drawer.
  drawer: { minWidthMm: 300, maxWidthMm: 700 },
  maxDrawersPerColumn: 4,
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
 * Sideboard-specific semantic warnings beyond plain range checks — drawer
 * width vs a usable single-run range. Returns `createWarning`-shaped plain
 * objects (kept dependency-free here; the validator wraps them).
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
        code: "SIDEBOARD_DRAWER_TOO_NARROW",
        field: "components",
        message: `At ${totalDrawers} drawer(s) across ${width}mm, each drawer would be ~${Math.round(perDrawerWidth)}mm — narrower than the recommended ${COMPONENT_RULES.drawer.minWidthMm}mm minimum for a usable sideboard drawer. Consider fewer drawers.`,
        severity: "warning",
      });
    } else if (perDrawerWidth > COMPONENT_RULES.drawer.maxWidthMm) {
      warnings.push({
        code: "SIDEBOARD_DRAWER_TOO_WIDE",
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
// Simple, documented v1 placeholders, same spirit as officeCabinet.js — not
// a universal sideboard standard. `leg` is deliberately absent from all
// three maps below: it only gets a quantity/properties/material at all when
// the user's request already includes it, never as a spontaneous addition.

const DEFAULT_QUANTITY_BY_TYPE = Object.freeze({
  shelf: 2,
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
  leg: "body",
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
