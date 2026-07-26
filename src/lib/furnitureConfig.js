/**
 * FurnitureConfig — the single source of truth for a piece of furniture.
 * ---------------------------------------------------------------------
 * One plain object flows through the whole app:
 *
 *     AI / gallery  ->  FurnitureConfig  ->  Zustand store
 *                                              |-> 3D model (buildGeometry)
 *                                              |-> cut list / export
 *                                              |-> price (pricing.js)
 *
 * Dimensions are in METRES (Three.js world units = metres).
 * Modules are described by PROPORTION (widthRatio), not absolute size, so the
 * layout re-flows correctly when the user changes the overall width. This is
 * the key decision from the research: never store AI-guessed absolute sizes —
 * store ratios + counts, snap real dimensions to manufacturable defaults.
 */

import { FURNITURE_TYPES, DEFAULT_FURNITURE_TYPE, DEFAULT_MATERIAL } from "./knowledgeBase.js";

export const PANEL_THICKNESS = 0.018; // 18mm carcass panel
export const BACK_THICKNESS = 0.005;  // 5mm back panel

/** A single module is one vertical "bay" of the piece, left to right. */
function makeModule(kind, widthRatio, extra = {}) {
  return {
    kind,                 // "door" | "drawerBank" | "openShelf"
    widthRatio,           // share of total internal width (all modules sum to 1)
    doorCount: 0,
    drawerRows: 0,
    shelfCount: 0,
    hingeSide: "left",    // "left" | "right" (doors)
    slideType: "hinged",  // "hinged" | "sliding"
    ...extra,
  };
}

/**
 * Sensible default module layout per furniture type. The AI step later just
 * overrides this (counts, ratios, kinds) — it never has to build from nothing.
 */
function defaultModules(typeKey) {
  switch (typeKey) {
    case "wardrobe":
      return [
        makeModule("door", 0.33, { doorCount: 1, shelfCount: 4, hingeSide: "left" }),
        makeModule("door", 0.34, { doorCount: 1, shelfCount: 2 }),
        makeModule("drawerBank", 0.33, { drawerRows: 3, hingeSide: "right" }),
      ];
    case "kitchen":
      return [
        makeModule("door", 0.25, { doorCount: 1, shelfCount: 2 }),
        makeModule("drawerBank", 0.25, { drawerRows: 3 }),
        makeModule("door", 0.2, { doorCount: 1, shelfCount: 2 }),
        makeModule("door", 0.3, { doorCount: 2, shelfCount: 2 }),
      ];
    case "cabinet":
      return [
        makeModule("door", 0.5, { doorCount: 1, shelfCount: 2, hingeSide: "left" }),
        makeModule("door", 0.5, { doorCount: 1, shelfCount: 2, hingeSide: "right" }),
      ];
    case "shelves":
      return [makeModule("openShelf", 1.0, { shelfCount: 5 })];
    case "office":
      return [
        makeModule("drawerBank", 0.4, { drawerRows: 3 }),
        makeModule("openShelf", 0.6, { shelfCount: 0 }),
      ];
    case "dressing_table":
      return [
        makeModule("drawerBank", 0.5, { drawerRows: 3 }),
        makeModule("openShelf", 0.5, { shelfCount: 1 }),
      ];
    case "bed":
    case "table":
    default:
      return [makeModule("openShelf", 1.0, { shelfCount: 0 })];
  }
}

/**
 * Build a complete, valid default config for a furniture type.
 * Dimensions come straight from the manufacturable defaults in knowledgeBase.
 */
export function createDefaultConfig(typeKey = DEFAULT_FURNITURE_TYPE) {
  const type = FURNITURE_TYPES[typeKey] ? typeKey : DEFAULT_FURNITURE_TYPE;
  const d = FURNITURE_TYPES[type].defaults;

  return {
    type,
    style: "modern",
    material: DEFAULT_MATERIAL,
    handleStyle: "silver_knob",
    doorType: "solid_panel",
    ledLighting: "off",
    hasPlinth: type === "wardrobe" || type === "kitchen" || type === "cabinet",
    plinthHeight: 0.1,
    dimensions: { width: d.width, height: d.height, depth: d.depth },
    modules: defaultModules(type),
    // provenance — filled in by the AI step (Stage 2/3); UI can disclose it
    ai: { source: "default", confidence: 1, assumptions: [] },
  };
}

/** Normalise module width ratios so they always sum to 1. */
export function normaliseModules(modules) {
  const total = modules.reduce((s, m) => s + (m.widthRatio || 0), 0) || 1;
  return modules.map((m) => ({ ...m, widthRatio: (m.widthRatio || 0) / total }));
}

/** Clamp a dimension to a manufacturable range (metres). */
export function clampDimension(axis, value) {
  const ranges = {
    width: [0.3, 6.0],
    height: [0.3, 3.0],
    depth: [0.2, 1.2],
  };
  const [min, max] = ranges[axis] || [0.1, 6.0];
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
