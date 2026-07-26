/**
 * configSchema — the safety gate between the AI and the builder.
 * --------------------------------------------------------------
 * The research was emphatic: never let raw model output drive geometry. Every
 * field is validated against the catalog, every dimension is clamped to a
 * manufacturable range, every count is coerced to a sane integer, and module
 * ratios are renormalised. Anything the model gets wrong degrades to a safe
 * default instead of producing an unbuildable (or NaN) model.
 *
 * Input:  a partial/raw config object (from Claude) + the resolved type default
 * Output: a clean, valid FurnitureConfig ready for loadConfig()
 */
import {
  FURNITURE_TYPES, DEFAULT_FURNITURE_TYPE,
  MATERIALS, DEFAULT_MATERIAL,
  HANDLE_STYLES, DOOR_TYPES, LED_LIGHTING,
} from "./knowledgeBase.js";
import { createDefaultConfig, clampDimension, normaliseModules } from "./furnitureConfig.js";

const MODULE_KINDS = ["door", "drawerBank", "openShelf"];

const intIn = (v, min, max, fallback) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};
const oneOf = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);

function cleanModule(raw = {}) {
  const kind = oneOf(raw.kind, MODULE_KINDS, "door");
  return {
    kind,
    widthRatio: Number.isFinite(Number(raw.widthRatio)) ? Math.max(0.05, Number(raw.widthRatio)) : 0.25,
    doorCount: kind === "door" ? intIn(raw.doorCount, 1, 4, 1) : 0,
    drawerRows: kind === "drawerBank" ? intIn(raw.drawerRows, 1, 6, 3) : 0,
    shelfCount: kind === "door" || kind === "openShelf" ? intIn(raw.shelfCount, 0, 8, 2) : 0,
    hingeSide: oneOf(raw.hingeSide, ["left", "right"], "left"),
    slideType: oneOf(raw.slideType, ["hinged", "sliding"], "hinged"),
  };
}

/**
 * @param {object} raw       parameters proposed by the AI
 * @param {object} [opts]
 * @param {string} [opts.source]  provenance tag: "text" | "vision" | "template"
 * @returns {{ config: object, warnings: string[] }}
 */
export function validateConfig(raw = {}, { source = "text" } = {}) {
  const warnings = [];

  const type = FURNITURE_TYPES[raw.type] ? raw.type : DEFAULT_FURNITURE_TYPE;
  if (raw.type && type !== raw.type) warnings.push(`Unknown type "${raw.type}" → ${type}`);

  // Start from the known-good template for this type, then overlay AI values.
  const base = createDefaultConfig(type);

  const material = MATERIALS[raw.material] ? raw.material : base.material;
  if (raw.material && material !== raw.material) warnings.push(`Unknown material "${raw.material}" → ${material}`);

  const dimsIn = raw.dimensions || {};
  const dimensions = {
    width: clampDimension("width", dimsIn.width ?? base.dimensions.width),
    height: clampDimension("height", dimsIn.height ?? base.dimensions.height),
    depth: clampDimension("depth", dimsIn.depth ?? base.dimensions.depth),
  };

  // Modules: use AI's if it gave a non-empty array, else keep the template's.
  let modules;
  if (Array.isArray(raw.modules) && raw.modules.length > 0) {
    modules = normaliseModules(raw.modules.slice(0, 8).map(cleanModule));
  } else {
    modules = base.modules;
    if (source !== "template") warnings.push("No valid modules from AI — kept template layout");
  }

  const config = {
    ...base,
    type,
    style: typeof raw.style === "string" ? raw.style.slice(0, 40) : base.style,
    material,
    handleStyle: oneOf(raw.handleStyle, Object.keys(HANDLE_STYLES), base.handleStyle),
    doorType: oneOf(raw.doorType, Object.keys(DOOR_TYPES), base.doorType),
    ledLighting: oneOf(raw.ledLighting, Object.keys(LED_LIGHTING), base.ledLighting),
    hasPlinth: typeof raw.hasPlinth === "boolean" ? raw.hasPlinth : base.hasPlinth,
    dimensions,
    modules,
    ai: {
      source,
      confidence: Number.isFinite(Number(raw.confidence)) ? Number(raw.confidence) : null,
      assumptions: Array.isArray(raw.assumptions) ? raw.assumptions.slice(0, 6).map(String) : [],
    },
  };

  return { config, warnings };
}

/** JSON schema for the AI tool call — mirrors the editable parts of the config. */
export function configToolSchema() {
  return {
    type: "object",
    properties: {
      type: { type: "string", enum: Object.keys(FURNITURE_TYPES) },
      style: { type: "string", description: "e.g. modern, classic, handleless, minimalist" },
      material: { type: "string", enum: Object.keys(MATERIALS), description: "closest matching material/colour" },
      handleStyle: { type: "string", enum: Object.keys(HANDLE_STYLES) },
      doorType: { type: "string", enum: Object.keys(DOOR_TYPES) },
      ledLighting: { type: "string", enum: Object.keys(LED_LIGHTING) },
      hasPlinth: { type: "boolean" },
      dimensions: {
        type: "object",
        description: "Approximate size in METRES. Use typical sizes for this furniture type; do not measure from any image.",
        properties: {
          width: { type: "number" },
          height: { type: "number" },
          depth: { type: "number" },
        },
      },
      modules: {
        type: "array",
        description: "Vertical sections left→right. widthRatio is each section's share of total width (they will be normalised).",
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: MODULE_KINDS },
            widthRatio: { type: "number" },
            doorCount: { type: "integer" },
            drawerRows: { type: "integer" },
            shelfCount: { type: "integer" },
            hingeSide: { type: "string", enum: ["left", "right"] },
            slideType: { type: "string", enum: ["hinged", "sliding"] },
          },
          required: ["kind", "widthRatio"],
        },
      },
      confidence: { type: "number", description: "0–1, your confidence in this configuration" },
      assumptions: { type: "array", items: { type: "string" }, description: "anything you guessed" },
    },
    required: ["type", "modules"],
  };
}
