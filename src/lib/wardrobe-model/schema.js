/**
 * schema — shared constants and shape documentation for WardrobeModel.
 * ---------------------------------------------------------------------
 * See docs/WARDROBE_MODEL_SCHEMA.md for the full narrative spec. This file
 * holds only what code needs to import: the component-type enum and the
 * manufacturable-range defaults every kernel/validator function reads from.
 *
 * Integer-millimetre contract: every `*Mm` field below is an exact integer.
 * kernel.js's `assertIntegerMm` rejects fractional input (e.g. 700.5)
 * outright — Phase 1 never silently rounds a canonical dimension/position.
 *
 * @typedef {Object} WardrobeComponent
 * @property {string} id            stable, allocated once, never reassigned
 * @property {"SHELF"|"DRAWER_BANK"|"HANGING_RAIL"|"DOOR"} type
 * @property {number} positionMm    integer mm, height from the section's
 *   interior floor (SHELF, HANGING_RAIL, DRAWER_BANK); unused for DOOR,
 *   which spans the whole section as a front, not one interior height zone.
 * @property {number} heightMm      integer mm, the zone this component
 *   occupies (SHELF/HANGING_RAIL: a nominal thin zone; DRAWER_BANK: rows *
 *   row height; DOOR: the section's full interior height, informational only)
 * @property {number} [rows]        DRAWER_BANK only, integer 1-8
 * @property {number} [leaves]      DOOR only, integer 1-4
 * @property {"left"|"right"} [hingeSide] DOOR only
 *
 * @typedef {Object} WardrobeSection
 * @property {string} id            stable, allocated once
 * @property {number} widthMm       integer mm, absolute width, not a ratio
 * @property {WardrobeComponent[]} components
 *
 * @typedef {Object} WardrobeModel
 * @property {string} id
 * @property {number} revision      starts at 1, incremented by the tool
 *   layer (src/lib/wardrobe-tools/tools.js) on every successful mutation —
 *   kernel.js itself never touches this field.
 * @property {number} widthMm       integer mm
 * @property {number} heightMm      integer mm
 * @property {number} depthMm       integer mm
 * @property {number} panelThicknessMm
 * @property {WardrobeSection[]} sections
 * @property {Record<string, number>} idCounters   one counter per entity
 *   type ("wardrobe", "section", "SHELF", ...) — see ids.js. IDs read
 *   `wardrobe-01`, `section-01`, `shelf-01`, `drawer-bank-01`; each type's
 *   counter is independent of the others'.
 *
 * Section-to-section dividers and their part geometry are derived on demand
 * in buildWardrobeGeometry.js from section adjacency — they are not stored
 * on the model, so there is nothing here that can drift out of sync with
 * `sections`.
 */

// The single source for panel thickness on the JS side of this repo:
// furnitureConfig.js's PANEL_THICKNESS (metres, used by buildGeometry.js).
// Nothing in src/lib/wardrobe-model may hard-code "18" independently of it —
// see docs/KNOWN_LIMITATIONS.md for the still-open cross-language gap
// (this constant is not yet generated from production-engine/standards.py).
import { PANEL_THICKNESS } from "../furnitureConfig.js";

const PANEL_THICKNESS_MM = PANEL_THICKNESS * 1000;

export const COMPONENT_TYPES = Object.freeze({
  SHELF: "SHELF",
  DRAWER_BANK: "DRAWER_BANK",
  HANGING_RAIL: "HANGING_RAIL",
  DIVIDER: "DIVIDER",
  DOOR: "DOOR",
});

/** Component types `component_add` can actually create in Phase 1.
 * DIVIDER is a real enum value (matches the tool's documented input) but is
 * structural, generated automatically between adjacent sections — see
 * docs/KNOWN_LIMITATIONS.md. */
export const ADDABLE_COMPONENT_TYPES = Object.freeze([
  COMPONENT_TYPES.SHELF,
  COMPONENT_TYPES.DRAWER_BANK,
  COMPONENT_TYPES.HANGING_RAIL,
  COMPONENT_TYPES.DOOR,
]);

/** Component types that occupy a stackable interior height zone and must
 * not overlap each other within a section. DOOR is excluded: a door is a
 * front panel over the whole section, not a competing interior zone. */
export const ZONE_COMPONENT_TYPES = Object.freeze([
  COMPONENT_TYPES.SHELF,
  COMPONENT_TYPES.DRAWER_BANK,
  COMPONENT_TYPES.HANGING_RAIL,
]);

export const DEFAULTS = Object.freeze({
  panelThicknessMm: PANEL_THICKNESS_MM,

  minWardrobeWidthMm: 300,
  maxWardrobeWidthMm: 6000,
  minWardrobeHeightMm: 300,
  maxWardrobeHeightMm: 3000,
  minWardrobeDepthMm: 200,
  maxWardrobeDepthMm: 1200,

  minSectionWidthMm: 250,

  shelfZoneMm: PANEL_THICKNESS_MM, // a shelf's own nominal zone height (= panel thickness)
  railZoneMm: 40,                  // hanging-rail bar + clearance
  drawerRowHeightMm: 180, // one drawer row's nominal height

  minDrawerRows: 1,
  maxDrawerRows: 8,
  minDoorLeaves: 1,
  maxDoorLeaves: 4,
});

/** The one zone-height a given component type occupies, given its own fields. */
export function zoneHeightMm(type, fields = {}) {
  switch (type) {
    case COMPONENT_TYPES.SHELF:
      return DEFAULTS.shelfZoneMm;
    case COMPONENT_TYPES.HANGING_RAIL:
      return DEFAULTS.railZoneMm;
    case COMPONENT_TYPES.DRAWER_BANK: {
      const rows = fields.rows ?? 3;
      return rows * DEFAULTS.drawerRowHeightMm;
    }
    default:
      return 0;
  }
}
