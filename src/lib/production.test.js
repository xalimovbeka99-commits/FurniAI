import { describe, expect, it } from "vitest";
import { createDefaultConfig } from "./furnitureConfig.js";
import { buildDrillingSpec, buildProductionPack, PRODUCTION_CAPABILITIES } from "./production.js";

describe("production capability honesty", () => {
  it("never presents generic drilling guidance as machine-ready instructions", () => {
    const notes = buildDrillingSpec(createDefaultConfig("wardrobe"));
    expect(notes.join(" ")).toContain("exact hinge SKU");
    expect(notes.join(" ")).toContain("blocked");
    expect(notes.join(" ")).not.toMatch(/Ø35|12\.5mm|confirmat Ø4\.5/i);
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
  });
});
