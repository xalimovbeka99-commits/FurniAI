import { describe, expect, it } from "vitest";
import fixture from "./goldenWardrobe.fixture.json";
import { normalizeFurniSpec, serializeCanonicalJson } from "./normalize.js";

describe("FurniSpec v0.1 Normalizer & Canonical Serializer", () => {
  it("normalizes and serializes identically across 100 consecutive runs", () => {
    const baselineJson = serializeCanonicalJson(fixture);
    expect(typeof baselineJson).toBe("string");
    expect(baselineJson.length).toBeGreaterThan(0);

    for (let i = 0; i < 100; i++) {
      const runJson = serializeCanonicalJson(fixture);
      expect(runJson).toBe(baselineJson);
    }
  });

  it("sorts object keys alphabetically at all nesting levels", () => {
    const unordered = {
      z: 1,
      a: 2,
      m: {
        y: 10,
        b: 20,
      },
    };
    const normalized = normalizeFurniSpec(unordered);
    expect(Object.keys(normalized)).toEqual(["a", "m", "z"]);
    expect(Object.keys(normalized.m)).toEqual(["b", "y"]);
  });

  it("preserves exact fractional 0.1mm values without rounding drift", () => {
    const sample = {
      doorWidth: 447.5,
      reveals: 2.0,
      depth: 600.0,
    };
    const normalized = normalizeFurniSpec(sample);
    expect(normalized.doorWidth).toBe(447.5);
    expect(normalized.reveals).toBe(2.0);
  });
});
