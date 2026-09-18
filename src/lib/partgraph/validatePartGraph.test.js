import { describe, expect, it } from "vitest";
import fixture from "../furnispec/goldenWardrobe.fixture.json";
import { buildStructuralPartGraph } from "./buildStructuralPartGraph.js";
import { validatePartGraph } from "./validatePartGraph.js";

describe("PartGraph v0.1 Validator Suite", () => {
  it("validates a well-formed PartGraph with zero errors", () => {
    const partGraph = buildStructuralPartGraph(fixture);
    const result = validatePartGraph(partGraph);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects non-object or null input", () => {
    expect(validatePartGraph(null).valid).toBe(false);
    expect(validatePartGraph("not an object").valid).toBe(false);
  });

  it("rejects a part whose role is not a declared PART_ROLES member", () => {
    // Before this guard any string passed. A typo'd or unwired role produced a
    // PartGraph that validated cleanly and then rendered nothing — a wardrobe
    // silently missing a panel. Roles are the kernel/adapter contract, so an
    // undeclared one is a validation failure.
    const partGraph = buildStructuralPartGraph(fixture);
    // NB: this used to read "DRAWER_FRONT", which became a declared role when
    // the 2026-09-15 runner ruling let drawers compile. The sentinel has to be
    // a role that is still undeclared, or the test proves nothing.
    partGraph.parts[0].role = "DRAWER_RUNNER_BRACKET"; // plausible, but not declared
    const result = validatePartGraph(partGraph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "INVALID_PART_ROLE")).toBe(true);
  });

  it("rejects a missing or non-string role", () => {
    for (const bad of [undefined, null, 42, {}]) {
      const partGraph = buildStructuralPartGraph(fixture);
      partGraph.parts[0].role = bad;
      const result = validatePartGraph(partGraph);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "INVALID_PART_ROLE")).toBe(true);
    }
  });

  it("accepts every role the kernel actually emits", () => {
    const partGraph = buildStructuralPartGraph(fixture);
    const result = validatePartGraph(partGraph);
    expect(result.errors.filter((e) => e.code === "INVALID_PART_ROLE")).toEqual([]);
    expect(new Set(partGraph.parts.map((p) => p.role)).size).toBeGreaterThan(1);
  });

  it("rejects duplicate Part IDs", () => {
    const partGraph = buildStructuralPartGraph(fixture);
    partGraph.parts.push({ ...partGraph.parts[0] });
    const result = validatePartGraph(partGraph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "DUPLICATE_PART_ID")).toBe(true);
  });

  it("rejects raw/finished edge banding mismatches", () => {
    const partGraph = buildStructuralPartGraph(fixture);
    const top = partGraph.parts.find((p) => p.id === "CARC_TOP");
    top.raw.lengthDmm = 99999;
    const result = validatePartGraph(partGraph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "RAW_LENGTH_MISMATCH")).toBe(true);
  });

  it("rejects bounding box dimension mismatches", () => {
    const partGraph = buildStructuralPartGraph(fixture);
    const top = partGraph.parts.find((p) => p.id === "CARC_TOP");
    top.placement.maxXDmm = 99999;
    const result = validatePartGraph(partGraph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "BOUNDING_BOX_MISMATCH")).toBe(true);
  });

  it("rejects CNC_QUALIFIED status", () => {
    const partGraph = buildStructuralPartGraph(fixture);
    partGraph.qualificationStatus = "CNC_QUALIFIED";
    const result = validatePartGraph(partGraph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "CNC_QUALIFIED_FORBIDDEN")).toBe(true);
  });
});
