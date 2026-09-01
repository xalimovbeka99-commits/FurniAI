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
