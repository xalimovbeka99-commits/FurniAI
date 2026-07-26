/**
 * Furniture knowledge — generic fallback for every FSL type EXCEPT wardrobe
 * (Section 18: "start with one robust category, add minimal definitions for
 * the rest"). Deliberately shallow: wide structural bounds so validation
 * still catches nonsense, a rough concept default so `target: "concept"`
 * requests don't dead-end in clarification for every non-wardrobe type, and
 * no per-component rules (any COMPONENT_TYPES value is accepted structurally
 * — configurator-support is judged separately by components.js).
 *
 * Where a configurator mapping exists (categories.js), the default comes
 * straight from knowledgeBase.js's own FURNITURE_TYPES defaults, so a
 * "no dimensions given" concept and what `/builder` would actually build
 * never disagree. Two configurator-mapped types this file would otherwise
 * serve had a default shaped oddly for their FSL type — office_cabinet ->
 * "office" defaulting to desk height (750mm), sideboard -> "cabinet"
 * defaulting to 1800mm tall — both are a pre-existing knowledgeBase.js
 * modelling choice, not something invented here, and both now have a
 * dedicated knowledge file (officeCabinet.js, sideboard.js) that corrects
 * the default instead, so this fallback no longer actually serves either
 * type. Left documented here as a warning for the *next* type added to
 * CONFIGURATOR_TYPE_MAP: check knowledgeBase.js's default before assuming
 * this fallback's numbers are sensible for a new FSL type.
 */
import { FURNITURE_TYPES as CONFIGURATOR_FURNITURE_TYPES } from "../knowledgeBase.js";
import { configuratorTypeFor } from "./categories.js";

const GENERIC_BOUNDS = Object.freeze({
  width_mm: { min: 200, max: 8000 },
  height_mm: { min: 200, max: 3200 },
  depth_mm: { min: 150, max: 1200 },
});

/** Rough, clearly-labelled concept defaults for types with no configurator mapping. */
const STANDALONE_DEFAULTS_MM = Object.freeze({
  walk_in_closet: { width_mm: 3000, height_mm: 2400, depth_mm: 400 },
  tv_unit: { width_mm: 1800, height_mm: 500, depth_mm: 450 },
  shoe_cabinet: { width_mm: 900, height_mm: 1000, depth_mm: 350 },
  bathroom_vanity: { width_mm: 900, height_mm: 850, depth_mm: 460 },
  custom_cabinet: { width_mm: 900, height_mm: 900, depth_mm: 400 },
});

function defaultsForConfiguratorType(configuratorType) {
  const d = CONFIGURATOR_FURNITURE_TYPES[configuratorType]?.defaults;
  if (!d) return null;
  return { width_mm: Math.round(d.width * 1000), height_mm: Math.round(d.height * 1000), depth_mm: Math.round(d.depth * 1000) };
}

export function genericKnowledgeFor(fslType) {
  const configuratorType = configuratorTypeFor(fslType);
  const defaults = (configuratorType && defaultsForConfiguratorType(configuratorType)) || STANDALONE_DEFAULTS_MM[fslType] || {
    width_mm: 900,
    height_mm: 900,
    depth_mm: 400,
  };

  const dimensionRules = {};
  for (const axis of ["width_mm", "height_mm", "depth_mm"]) {
    const bounds = GENERIC_BOUNDS[axis];
    dimensionRules[axis] = { ...bounds, standardMin: bounds.min, standardMax: bounds.max, default: defaults[axis] };
  }

  return {
    furnitureType: fslType,
    dimensionRules,
    defaultMaterials: {
      body: { material: "mdf", thickness_mm: 18, finish: "unknown" },
      facades: { material: "mdf", thickness_mm: 18, finish: "unknown" },
      back_panel: { material: "hdf", thickness_mm: 6, finish: "unknown" },
    },
    defaultStyle: { theme: "modern", primary_color: null, secondary_color: null, finish: null, door_style: null, handle_style: null },
    allowedComponents: null, // null = no per-type restriction beyond the global COMPONENT_TYPES vocabulary
    semanticWarnings: () => [],
    // No dedicated component-default rules exist yet for non-wardrobe types
    // (Section 18's "start with one robust category") — quantity always
    // defaults to 1 and no properties/material_ref are assumed.
    defaultComponentQuantity: () => 1,
    defaultComponentProperties: () => ({}),
    defaultMaterialRefFor: () => null,
  };
}
