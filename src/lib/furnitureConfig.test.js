import { describe, it, expect } from "vitest";
import { createDefaultConfig, normaliseModules, clampDimension, PANEL_THICKNESS, BACK_THICKNESS } from "./furnitureConfig.js";
import { FURNITURE_TYPES, DEFAULT_FURNITURE_TYPE } from "./knowledgeBase.js";

// Characterization tests (master plan §25/§27 Phase 0): pin down furnitureConfig.js's
// current behavior before Phase 1 (wardrobe idea -> exact editable 3D) builds on it.
// Not a judgment that every value here is "correct" furniture design — just a
// regression net so Phase 1 changes don't silently alter existing /builder behavior.

describe("createDefaultConfig", () => {
  it("builds a config whose dimensions match the type's knowledgeBase defaults", () => {
    for (const type of Object.keys(FURNITURE_TYPES)) {
      const config = createDefaultConfig(type);
      const d = FURNITURE_TYPES[type].defaults;
      expect(config.type).toBe(type);
      expect(config.dimensions).toEqual({ width: d.width, height: d.height, depth: d.depth });
    }
  });

  it("falls back to DEFAULT_FURNITURE_TYPE for an unrecognized type", () => {
    const config = createDefaultConfig("not_a_real_type");
    expect(config.type).toBe(DEFAULT_FURNITURE_TYPE);
  });

  it("defaults to DEFAULT_FURNITURE_TYPE when called with no argument", () => {
    const config = createDefaultConfig();
    expect(config.type).toBe(DEFAULT_FURNITURE_TYPE);
  });

  it("sets hasPlinth true only for wardrobe/kitchen/cabinet", () => {
    const expected = { wardrobe: true, kitchen: true, office: false, bed: false, cabinet: true, shelves: false, table: false, dressing_table: false };
    for (const [type, expectedPlinth] of Object.entries(expected)) {
      expect(createDefaultConfig(type).hasPlinth).toBe(expectedPlinth);
    }
  });

  it("gives every default config's modules array widthRatios summing to 1", () => {
    for (const type of Object.keys(FURNITURE_TYPES)) {
      const total = createDefaultConfig(type).modules.reduce((s, m) => s + m.widthRatio, 0);
      expect(total).toBeCloseTo(1, 10);
    }
  });

  it("stamps provenance as an untouched default (source: default, confidence: 1, no assumptions)", () => {
    const config = createDefaultConfig("wardrobe");
    expect(config.ai).toEqual({ source: "default", confidence: 1, assumptions: [] });
  });

  it("gives the wardrobe default three modules in order: door, door, drawer bank", () => {
    // Pinning today's exact layout — this is what a "no dimensions given" wardrobe
    // request renders as via /builder today (see buildGeometry.test.js for the
    // resulting panel layout this produces).
    const modules = createDefaultConfig("wardrobe").modules;
    expect(modules.map((m) => m.kind)).toEqual(["door", "door", "drawerBank"]);
  });
});

describe("normaliseModules", () => {
  it("rescales arbitrary widthRatios to sum to 1", () => {
    const modules = normaliseModules([{ widthRatio: 1 }, { widthRatio: 1 }, { widthRatio: 2 }]);
    expect(modules.map((m) => m.widthRatio)).toEqual([0.25, 0.25, 0.5]);
  });

  it("leaves already-normalised ratios unchanged", () => {
    const modules = normaliseModules([{ widthRatio: 0.3 }, { widthRatio: 0.7 }]);
    expect(modules[0].widthRatio).toBeCloseTo(0.3, 10);
    expect(modules[1].widthRatio).toBeCloseTo(0.7, 10);
  });

  it("treats a zero/missing total as 1 rather than dividing by zero", () => {
    const modules = normaliseModules([{ widthRatio: 0 }, {}]);
    expect(modules.every((m) => Number.isFinite(m.widthRatio))).toBe(true);
  });

  it("preserves the other module fields untouched", () => {
    const modules = normaliseModules([{ widthRatio: 1, kind: "door", doorCount: 2 }]);
    expect(modules[0]).toMatchObject({ kind: "door", doorCount: 2 });
  });
});

describe("clampDimension", () => {
  it("clamps width/height/depth to their documented manufacturable ranges", () => {
    expect(clampDimension("width", 0.01)).toBe(0.3);
    expect(clampDimension("width", 100)).toBe(6.0);
    expect(clampDimension("height", 0.01)).toBe(0.3);
    expect(clampDimension("height", 100)).toBe(3.0);
    expect(clampDimension("depth", 0.01)).toBe(0.2);
    expect(clampDimension("depth", 100)).toBe(1.2);
  });

  it("passes through an in-range value unchanged", () => {
    expect(clampDimension("width", 2.4)).toBe(2.4);
  });

  it("falls back to the axis minimum for a non-finite value", () => {
    expect(clampDimension("width", NaN)).toBe(0.3);
    expect(clampDimension("width", undefined)).toBe(0.3);
    expect(clampDimension("width", "not a number")).toBe(0.3);
  });

  it("uses the generic [0.1, 6.0] range for an unrecognized axis", () => {
    expect(clampDimension("diagonal", 0.01)).toBe(0.1);
    expect(clampDimension("diagonal", 100)).toBe(6.0);
  });
});

describe("panel thickness constants", () => {
  it("matches the master plan's MVP default (18mm structural, 5mm back)", () => {
    expect(PANEL_THICKNESS).toBe(0.018);
    expect(BACK_THICKNESS).toBe(0.005);
  });
});
