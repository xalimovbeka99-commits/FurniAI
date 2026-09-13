import { describe, expect, it } from "vitest";
import { createDefaultConfig } from "./furnitureConfig.js";
import {
  buildCutList,
  buildDrillingSpec,
  buildProductionPack,
  cutListToCSV,
  PRODUCTION_CAPABILITIES,
  ProductionPreviewError,
} from "./production.js";

describe("production capability honesty", () => {
  it("never presents generic drilling guidance as machine-ready instructions", () => {
    const notes = buildDrillingSpec(createDefaultConfig("wardrobe"));
    expect(notes.join(" ")).toContain("exact hinge SKU");
    expect(notes.join(" ")).toContain("blocked");
    expect(notes.join(" ")).not.toMatch(/12\.5mm|confirmat/i);
  });

  it("blocks manufacturing release until factory-specific capabilities are validated", () => {
    const pack = buildProductionPack({
      orderId: "TEST-001",
      config: createDefaultConfig("wardrobe"),
    });

    expect(pack.capabilityStatus).toEqual(PRODUCTION_CAPABILITIES);
    expect(pack.manufacturingRelease.allowed).toBe(false);
    expect(pack.manufacturingRelease.blockers.length).toBeGreaterThan(0);
    expect(pack.geometryValidation).toEqual([]);
    expect(pack.cutList.length).toBeGreaterThan(0);
  });
});

describe("production preview fail-closed geometry gate", () => {
  it("aborts cut-list emission when geometry validation fails (NaN envelope)", () => {
    const config = createDefaultConfig("wardrobe");
    config.dimensions = { width: Number.NaN, height: 2.4, depth: 0.6 };
    expect(() => buildCutList(config)).toThrow(ProductionPreviewError);
    try {
      buildCutList(config);
    } catch (err) {
      expect(err).toBeInstanceOf(ProductionPreviewError);
      expect(err.code).toBe("GEOMETRY_VALIDATION_FAILED");
      expect(err.issues.length).toBeGreaterThan(0);
      expect(err.issues[0].code).toBe("NON_FINITE_GEOMETRY");
    }
  });

  it("aborts production pack and CSV when geometry is partially mutated / invalid", () => {
    const config = createDefaultConfig("wardrobe");
    config.dimensions = { width: -1, height: 2.4, depth: 0.6 };
    expect(() => buildProductionPack({ orderId: "BAD-001", config })).toThrow(ProductionPreviewError);
    expect(() => cutListToCSV("BAD-001", config)).toThrow(ProductionPreviewError);
  });

  it("still emits a blocked preview pack for a valid default wardrobe", () => {
    const pack = buildProductionPack({
      orderId: "OK-001",
      config: createDefaultConfig("wardrobe"),
    });
    expect(pack.manufacturingRelease.allowed).toBe(false);
    expect(pack.capabilityStatus.nesting).toBe("unsupported");
    expect(pack.capabilityStatus.cnc).toBe("unsupported");
  });
});
