import { describe, expect, it } from "vitest";
import { createDefaultConfig } from "./furnitureConfig.js";
import {
  assertProductionGeometry,
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

  it("assertProductionGeometry / buildCutList / pack throw GEOMETRY_VALIDATION_FAILED for negative panel thickness", () => {
    const config = createDefaultConfig("wardrobe");
    const badParts = [
      {
        id: "NEG-THK",
        role: "side",
        size: [ -0.018, 2.0, 0.6 ],
        position: [0, 1.0, 0],
        material: config.material,
      },
    ];
    expect(() => assertProductionGeometry(config, badParts)).toThrow(ProductionPreviewError);
    try {
      assertProductionGeometry(config, badParts);
    } catch (err) {
      expect(err).toBeInstanceOf(ProductionPreviewError);
      expect(err.code).toBe("GEOMETRY_VALIDATION_FAILED");
      expect(err.issues.some((i) => i.code === "NON_POSITIVE_PART_SIZE")).toBe(true);
    }
    // Zero-thickness synonym also rejects:
    const zeroThk = [{ id: "Z", role: "shelf", size: [0.8, 0, 0.5], position: [0, 1, 0], material: config.material }];
    expect(() => assertProductionGeometry(config, zeroThk)).toThrow(ProductionPreviewError);
  });

  it("buildCutList / assertProductionGeometry throw GEOMETRY_VALIDATION_FAILED for NaN coordinates", () => {
    const config = createDefaultConfig("wardrobe");
    const nanParts = [
      {
        id: "NAN-COORD",
        role: "top",
        size: [1.0, 0.018, 0.6],
        position: [Number.NaN, 2.0, 0],
        material: config.material,
      },
    ];
    expect(() => assertProductionGeometry(config, nanParts)).toThrow(ProductionPreviewError);
    try {
      assertProductionGeometry(config, nanParts);
    } catch (err) {
      expect(err.code).toBe("GEOMETRY_VALIDATION_FAILED");
      expect(err.issues.some((i) => i.code === "NON_FINITE_GEOMETRY")).toBe(true);
    }
    config.dimensions = { width: 1.8, height: Number.NaN, depth: 0.6 };
    expect(() => buildCutList(config)).toThrow(ProductionPreviewError);
    expect(() => buildProductionPack({ orderId: "NAN-DIM", config })).toThrow(ProductionPreviewError);
  });

  it("buildCutList / pack builders throw GEOMETRY_VALIDATION_FAILED for zero dimensions", () => {
    const config = createDefaultConfig("wardrobe");
    config.dimensions = { width: 0, height: 2.4, depth: 0.6 };
    expect(() => buildCutList(config)).toThrow(ProductionPreviewError);
    try {
      buildCutList(config);
    } catch (err) {
      expect(err).toBeInstanceOf(ProductionPreviewError);
      expect(err.code).toBe("GEOMETRY_VALIDATION_FAILED");
    }
    expect(() => buildProductionPack({ orderId: "ZERO-W", config })).toThrow(ProductionPreviewError);
    expect(() => cutListToCSV("ZERO-W", config)).toThrow(ProductionPreviewError);

    const zeroPart = [
      {
        id: "ZERO-SIZE",
        role: "door",
        size: [0, 2.0, 0.018],
        position: [0, 1.0, 0.3],
        material: config.material,
      },
    ];
    const cfg2 = createDefaultConfig("wardrobe");
    expect(() => assertProductionGeometry(cfg2, zeroPart)).toThrow(ProductionPreviewError);
    try {
      assertProductionGeometry(cfg2, zeroPart);
    } catch (err) {
      expect(err.code).toBe("GEOMETRY_VALIDATION_FAILED");
      expect(err.issues.some((i) => i.code === "NON_POSITIVE_PART_SIZE")).toBe(true);
    }
  });
});
