import { describe, expect, it } from "vitest";
import goldenFixture from "../furnispec/goldenWardrobe.fixture.json";
import { validateFurniSpec } from "../furnispec/validate.js";
import { serializeCanonicalJson } from "../furnispec/normalize.js";
import { buildStructuralPartGraph } from "../partgraph/buildStructuralPartGraph.js";
import { AssemblyBlockedError, assembleFurniSpec } from "./assembleFurniSpec.js";
import { GAP_KIND, GAP_SEVERITY, gap } from "./intakeModel.js";

const FACTS = {
  "envelope.widthMm": 1800.0,
  "envelope.heightMm": 2400.0,
  "envelope.depthMm": 600.0,
  "plinth.heightMm": 100.0,
  bayCount: 2,
  doorCount: 4,
  finishType: "melamine",
  bayLayouts: ["LONG_HANGING", "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES"],
};

const ARGS = { facts: FACTS, gaps: [], specId: "furnispec-ai-alpha-test-01", revision: 1, status: "APPROVED" };

function structuralKey(part) {
  return JSON.stringify([
    part.role,
    part.quantity,
    part.materialCode,
    part.finished,
    part.raw,
    part.placement,
    part.orientation,
    part.grainDirection,
    part.edges,
    part.status,
  ]);
}

describe("FurniSpec assembler (trust boundary)", () => {
  it("refuses to assemble while a blocking gap stands", () => {
    const blocking = [gap("bayCount", GAP_KIND.MISSING_REQUIRED_FACT, GAP_SEVERITY.BLOCKING)];
    expect(() => assembleFurniSpec({ ...ARGS, gaps: blocking })).toThrow(AssemblyBlockedError);
  });

  it("requires an explicit specId, revision and status — nothing defaults", () => {
    expect(() => assembleFurniSpec({ ...ARGS, specId: "" })).toThrow(/explicit specId/);
    expect(() => assembleFurniSpec({ ...ARGS, revision: 0 })).toThrow(/explicit integer revision/);
    expect(() => assembleFurniSpec({ ...ARGS, status: undefined })).toThrow(/explicit status/);
    expect(() => assembleFurniSpec({ ...ARGS, status: "CNC_QUALIFIED" })).toThrow(/explicit status/);
  });

  it("produces a spec that passes FurniSpec validation with zero errors", () => {
    const { spec } = assembleFurniSpec(ARGS);
    const result = validateFurniSpec(spec);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("hard-wires CNC qualification off and hardware drilling blocked", () => {
    const hostile = {
      ...ARGS,
      facts: {
        ...FACTS,
        qualificationStatus: "CNC_QUALIFIED",
        machiningPolicy: { backGroove: "APPROVED", drilling: "APPROVED" },
        hardware: { hinges: { status: "APPROVED" } },
      },
    };
    const { spec } = assembleFurniSpec(hostile);
    expect(spec.qualificationStatus).toBe("WORKSHOP_REVIEW_NOT_CNC_QUALIFIED");
    expect(spec.machiningPolicy.drilling).toBe("BLOCKED_PENDING_HARDWARE_APPROVAL");
    expect(spec.hardware.hinges.status).toBe("BLOCKED_PENDING_HARDWARE_APPROVAL");
    expect(spec.hardware.shelfPins.status).toBe("BLOCKED_PENDING_HARDWARE_APPROVAL");
    expect(spec.hardware.joinery.status).toBe("BLOCKED_PENDING_HARDWARE_APPROVAL");
    expect(validateFurniSpec(spec).valid).toBe(true);
  });

  it("closes width, height, depth and door arithmetic exactly", () => {
    const { spec } = assembleFurniSpec(ARGS);
    const sides = (spec.bays.length + 1) * spec.carcass.panelThicknessMm;
    const baysWidth = spec.bays.reduce((sum, b) => sum + b.clearWidthMm, 0);
    expect(sides + baysWidth).toBe(spec.envelope.widthMm);
    expect(spec.plinth.heightMm + spec.carcass.heightMm).toBe(spec.envelope.heightMm);
    expect(spec.carcass.depthMm + spec.doors.thicknessMm + spec.doors.bumperGapMm).toBe(spec.envelope.depthMm);
    const doorZone =
      spec.doors.count * spec.doors.finishedWidthMm +
      spec.doors.reveals.leftMm +
      spec.doors.reveals.rightMm +
      (spec.doors.count - 1) * spec.doors.reveals.interDoorMm;
    expect(doorZone).toBe(spec.envelope.widthMm);
  });

  it("records a rule ID and a formula for every derivation", () => {
    const { derivations } = assembleFurniSpec(ARGS);
    expect(derivations.length).toBeGreaterThan(0);
    for (const d of derivations) {
      expect(typeof d.path).toBe("string");
      expect(typeof d.value).toBe("number");
      expect(typeof d.formula).toBe("string");
      expect(Array.isArray(d.ruleIds)).toBe(true);
    }
    const paths = derivations.map((d) => d.path);
    expect(paths).toContain("carcass.heightMm");
    expect(paths).toContain("bays[].clearWidthMm");
    expect(paths).toContain("doors.finishedWidthMm");
  });

  it("reproduces the Bekzod-approved Golden Wardrobe geometry part for part", () => {
    const { spec } = assembleFurniSpec(ARGS);
    const mine = buildStructuralPartGraph(spec).parts.map(structuralKey).sort();
    const golden = buildStructuralPartGraph(goldenFixture).parts.map(structuralKey).sort();
    expect(mine).toHaveLength(19);
    expect(mine).toEqual(golden);
  });

  it("is byte-stable across repeated assembly", () => {
    const baseline = serializeCanonicalJson(assembleFurniSpec(ARGS).spec);
    for (let i = 0; i < 25; i += 1) {
      expect(serializeCanonicalJson(assembleFurniSpec(ARGS).spec)).toBe(baseline);
    }
  });

  it("throws rather than rounding when a bay derivation does not close", () => {
    expect(() => assembleFurniSpec({ ...ARGS, facts: { ...FACTS, "envelope.widthMm": 1800.1 } })).toThrow(
      /Bay clear width does not close exactly/
    );
  });

  it("throws rather than rounding when a door derivation does not close", () => {
    expect(() => assembleFurniSpec({ ...ARGS, facts: { ...FACTS, doorCount: 3 } })).toThrow(
      /Door finished width does not close exactly/
    );
  });

  it("refuses a finish with no approved material", () => {
    expect(() => assembleFurniSpec({ ...ARGS, facts: { ...FACTS, finishType: "veneer" } })).toThrow(
      /No Bekzod-approved material record/
    );
  });
});
