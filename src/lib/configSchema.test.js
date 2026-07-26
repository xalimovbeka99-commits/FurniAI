import { describe, it, expect } from "vitest";
import { validateConfig, configToolSchema } from "./configSchema.js";
import { FURNITURE_TYPES, MATERIALS, HANDLE_STYLES, DOOR_TYPES, LED_LIGHTING, DEFAULT_FURNITURE_TYPE } from "./knowledgeBase.js";

// Characterization tests (master plan §25/§27 Phase 0) for the safety gate between
// AI output and the builder — see this file's own header comment ("never let raw
// model output drive geometry"). Pinning current sanitization behavior before
// Phase 1 builds on it.

describe("validateConfig — defaults with no raw input", () => {
  it("falls back entirely to the default wardrobe template", () => {
    const { config, warnings } = validateConfig({});
    expect(config.type).toBe(DEFAULT_FURNITURE_TYPE);
    expect(config.material).toBe("oak");
    expect(warnings).toEqual(["No valid modules from AI — kept template layout"]);
  });

  it("does not warn about type/material when the AI simply omitted them", () => {
    const { warnings } = validateConfig({});
    expect(warnings.some((w) => w.includes("Unknown type"))).toBe(false);
    expect(warnings.some((w) => w.includes("Unknown material"))).toBe(false);
  });
});

describe("validateConfig — unknown enum values degrade to a safe default with a warning", () => {
  it("falls back an unrecognized type to the default and warns", () => {
    const { config, warnings } = validateConfig({ type: "spaceship" });
    expect(config.type).toBe(DEFAULT_FURNITURE_TYPE);
    expect(warnings).toContainEqual(expect.stringContaining('Unknown type "spaceship"'));
  });

  it("falls back an unrecognized material to the template's material and warns", () => {
    const { config, warnings } = validateConfig({ type: "wardrobe", material: "unobtainium" });
    expect(config.material).toBe("oak"); // wardrobe template's default material
    expect(warnings).toContainEqual(expect.stringContaining('Unknown material "unobtainium"'));
  });

  it("falls back an unrecognized handleStyle/doorType/ledLighting to the template's value", () => {
    const { config } = validateConfig({ handleStyle: "diamond_encrusted", doorType: "solid_gold", ledLighting: "laser" });
    const base = validateConfig({}).config;
    expect(config.handleStyle).toBe(base.handleStyle);
    expect(config.doorType).toBe(base.doorType);
    expect(config.ledLighting).toBe(base.ledLighting);
  });
});

describe("validateConfig — dimensions are always clamped, never trusted raw", () => {
  it("clamps an absurdly large width to the manufacturable maximum", () => {
    const { config } = validateConfig({ dimensions: { width: 999 } });
    expect(config.dimensions.width).toBe(6.0);
  });

  it("keeps the template default for a dimension the AI didn't provide", () => {
    const { config } = validateConfig({ type: "wardrobe", dimensions: { width: 2.5 } });
    expect(config.dimensions.width).toBe(2.5);
    expect(config.dimensions.height).toBe(FURNITURE_TYPES.wardrobe.defaults.height);
    expect(config.dimensions.depth).toBe(FURNITURE_TYPES.wardrobe.defaults.depth);
  });
});

describe("validateConfig — module cleaning", () => {
  it("uses the AI's modules when a non-empty array is given, normalised and count-clamped", () => {
    const { config } = validateConfig({
      modules: [
        { kind: "door", widthRatio: 1, doorCount: 99 }, // doorCount clamped to max 4
        { kind: "drawerBank", widthRatio: 1, drawerRows: 0 }, // drawerRows clamped to min 1
      ],
    });
    expect(config.modules).toHaveLength(2);
    expect(config.modules[0].doorCount).toBe(4);
    expect(config.modules[1].drawerRows).toBe(1);
    const total = config.modules.reduce((s, m) => s + m.widthRatio, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("falls back to the template's modules and warns when the AI gives an empty array", () => {
    const { config, warnings } = validateConfig({ type: "wardrobe", modules: [] });
    expect(config.modules).toEqual(validateConfig({ type: "wardrobe" }).config.modules);
    expect(warnings).toContainEqual("No valid modules from AI — kept template layout");
  });

  it("does not warn about missing modules when the source is a template", () => {
    const { warnings } = validateConfig({ type: "wardrobe", modules: [] }, { source: "template" });
    expect(warnings.some((w) => w.includes("modules"))).toBe(false);
  });

  it("defaults an unrecognized module kind to 'door'", () => {
    const { config } = validateConfig({ modules: [{ kind: "spaceship_engine", widthRatio: 1 }] });
    expect(config.modules[0].kind).toBe("door");
  });

  it("caps the AI to at most 8 modules", () => {
    const raw = Array.from({ length: 20 }, () => ({ kind: "door", widthRatio: 1 }));
    const { config } = validateConfig({ modules: raw });
    expect(config.modules).toHaveLength(8);
  });
});

describe("validateConfig — style and assumptions are bounded, not trusted raw", () => {
  it("truncates an overlong style string to 40 characters", () => {
    const { config } = validateConfig({ style: "x".repeat(200) });
    expect(config.style).toHaveLength(40);
  });

  it("caps assumptions to 6 entries and stringifies them", () => {
    const { config } = validateConfig({ assumptions: [1, 2, 3, 4, 5, 6, 7, 8], modules: [{ kind: "door", widthRatio: 1 }] });
    expect(config.ai.assumptions).toHaveLength(6);
    expect(config.ai.assumptions.every((a) => typeof a === "string")).toBe(true);
  });

  it("records the requested provenance source", () => {
    const { config } = validateConfig({}, { source: "vision" });
    expect(config.ai.source).toBe("vision");
  });
});

describe("configToolSchema", () => {
  it("requires type and modules, and enumerates from the same catalogs configSchema validates against", () => {
    const schema = configToolSchema();
    expect(schema.required).toEqual(["type", "modules"]);
    expect(schema.properties.type.enum).toEqual(Object.keys(FURNITURE_TYPES));
    expect(schema.properties.material.enum).toEqual(Object.keys(MATERIALS));
    expect(schema.properties.handleStyle.enum).toEqual(Object.keys(HANDLE_STYLES));
    expect(schema.properties.doorType.enum).toEqual(Object.keys(DOOR_TYPES));
    expect(schema.properties.ledLighting.enum).toEqual(Object.keys(LED_LIGHTING));
  });
});
