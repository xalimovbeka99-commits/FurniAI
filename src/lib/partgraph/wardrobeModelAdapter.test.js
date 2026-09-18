/**
 * WardrobeModel -> FurniSpec adapter.
 *
 * The point of the adapter is that it does NOT add a second compiler. So the
 * load-bearing test is the end-to-end one: a WardrobeModel goes in, and the
 * existing `buildStructuralPartGraph` produces the same carcass numbers it
 * produces from a hand-written FurniSpec. Everything else here is about what
 * the adapter refuses rather than approximates.
 *
 * Evidence class: A (unit only).
 */
import { describe, it, expect } from "vitest";
import {
  adaptWardrobeModelToFurniSpec,
  adapterDiagnostics,
  adapterRuleIds,
  railKindFor,
  AdapterError,
  ADAPTER_VERSION,
  DEFAULT_SHELF_KIND,
} from "./wardrobeModelAdapter.js";
import { buildStructuralPartGraph } from "./buildStructuralPartGraph.js";
import { validatePartGraph } from "./validatePartGraph.js";
import { validateFurniSpec } from "../furnispec/validate.js";
import { RULE_PROVENANCE, WARDROBE_RULES } from "../rules/wardrobeRuleCatalog.js";

/**
 * A model shaped like the Golden Wardrobe: 1800 x 2400 x 600 over two sections.
 * 1800 - 2*18 (sides) - 1*18 (divider) = 1746, so 873 per section — the same
 * closure the wardrobe-model validator enforces and FurniSpec expects.
 */
function goldenShapedModel(overrides = {}) {
  return {
    id: "wardrobe-01",
    revision: 3,
    widthMm: 1800,
    heightMm: 2400,
    depthMm: 600,
    panelThicknessMm: 18,
    plinthHeightMm: 100,
    sections: [
      {
        id: "section-01",
        widthMm: 873,
        components: [
          { id: "shelf-01", type: "SHELF", positionMm: 1930, heightMm: 18 },
          { id: "rail-01", type: "HANGING_RAIL", positionMm: 1400, heightMm: 40 },
          { id: "door-01", type: "DOOR", positionMm: 0, heightMm: 2264, leaves: 2, hingeSide: "left" },
        ],
      },
      {
        id: "section-02",
        widthMm: 873,
        components: [
          { id: "shelf-02", type: "SHELF", positionMm: 1930, heightMm: 18 },
          { id: "rail-02", type: "HANGING_RAIL", positionMm: 900, heightMm: 40 },
          { id: "door-02", type: "DOOR", positionMm: 0, heightMm: 2264, leaves: 2, hingeSide: "right" },
        ],
      },
    ],
    idCounters: {},
    ...overrides,
  };
}

describe("one compiler, reached from the other stack", () => {
  it("produces a FurniSpec the existing validator accepts", () => {
    const spec = adaptWardrobeModelToFurniSpec(goldenShapedModel());
    expect(validateFurniSpec(spec).valid).toBe(true);
  });

  it("compiles through buildStructuralPartGraph to a valid PartGraph", () => {
    const graph = buildStructuralPartGraph(adaptWardrobeModelToFurniSpec(goldenShapedModel()));
    expect(validatePartGraph(graph).valid).toBe(true);
    expect(graph.parts.length).toBeGreaterThan(0);
  });

  it("reproduces the golden carcass closure exactly", () => {
    const spec = adaptWardrobeModelToFurniSpec(goldenShapedModel());
    // carcass height = envelope - plinth; depth = envelope - door - bumper gap.
    expect(spec.carcass.heightMm).toBe(2300);
    expect(spec.carcass.depthMm).toBe(580);
    expect(spec.doors.finishedWidthMm).toBe(447.5);
    expect(spec.doors.finishedHeightMm).toBe(2296);
    expect(spec.doors.count).toBe(4);
  });

  it("preserves the model id and increments the revision", () => {
    const model = goldenShapedModel();
    const spec = adaptWardrobeModelToFurniSpec(model);
    expect(spec.specId).toBe("wardrobe-01");
    expect(spec.revision).toBe(4);
    expect(spec.adapter).toMatchObject({ version: ADAPTER_VERSION, sourceModelRevision: 3 });
  });

  it("does not mutate the model it was given", () => {
    const model = goldenShapedModel();
    const before = JSON.stringify(model);
    adaptWardrobeModelToFurniSpec(model);
    expect(JSON.stringify(model)).toBe(before);
  });

  it("maps every section to a bay, keeping clear widths", () => {
    const spec = adaptWardrobeModelToFurniSpec(goldenShapedModel());
    expect(spec.bays).toHaveLength(2);
    expect(spec.bays.map((b) => b.clearWidthMm)).toEqual([873, 873]);
    expect(spec.bays.map((b) => b.id)).toEqual(["section-01", "section-02"]);
  });
});

describe("no number is invented", () => {
  it("cannot be argued into CNC qualification or unblocked drilling", () => {
    const spec = adaptWardrobeModelToFurniSpec(goldenShapedModel(), {
      // Neither is a parameter; passing them must change nothing.
      qualificationStatus: "CNC_QUALIFIED",
      machiningPolicy: { drilling: "APPROVED" },
    });
    expect(spec.qualificationStatus).toBe("WORKSHOP_REVIEW_NOT_CNC_QUALIFIED");
    expect(spec.machiningPolicy.drilling).toBe("BLOCKED_PENDING_HARDWARE_APPROVAL");
    expect(spec.hardware.shelfPins.status).toBe("BLOCKED_PENDING_HARDWARE_APPROVAL");
  });

  it("sources every construction constant from an approved rule", () => {
    for (const { key, ruleId } of adapterRuleIds()) {
      expect(ruleId, `${key} has no rule id`).toBeTruthy();
      expect(WARDROBE_RULES[key].provenance).not.toBe(RULE_PROVENANCE.REQUIRES_BEKZOD_RULING);
    }
  });

  it("classifies a rail against the two approved target drops, not a new number", () => {
    expect(railKindFor({ positionMm: 1400 })).toBe("HANGING_RAIL_LONG");
    expect(railKindFor({ positionMm: 900 })).toBe("HANGING_RAIL_SHORT");
    // The boundary is the midpoint of the two approved targets, so neither
    // figure is a threshold this adapter chose on its own.
    expect(railKindFor({ positionMm: 1200 })).toBe("HANGING_RAIL_LONG");
    expect(railKindFor({ positionMm: 1100 })).toBe("HANGING_RAIL_SHORT");
  });

  it("maps an ambiguous SHELF to the conservative fixed reading, and says so", () => {
    const spec = adaptWardrobeModelToFurniSpec(goldenShapedModel());
    expect(DEFAULT_SHELF_KIND).toBe("SHELF_FIXED");
    expect(spec.bays[0].components[0].type).toBe("SHELF_FIXED");
  });

  it("lets a caller that knows better override the shelf reading", () => {
    const spec = adaptWardrobeModelToFurniSpec(goldenShapedModel(), {
      shelfKindFor: () => "SHELF_ADJUSTABLE",
    });
    expect(spec.bays[0].components[0].type).toBe("SHELF_ADJUSTABLE");
  });
});

describe("it refuses rather than approximates", () => {
  it("will not guess a plinth height, which a WardrobeModel does not carry", () => {
    const model = goldenShapedModel();
    delete model.plinthHeightMm;
    const codes = adapterDiagnostics(model).map((d) => d.code);
    expect(codes).toContain("PLINTH_HEIGHT_NOT_SUPPLIED");
    expect(() => adaptWardrobeModelToFurniSpec(model)).toThrow(AdapterError);
  });

  it("accepts a plinth height passed as an option instead", () => {
    const model = goldenShapedModel();
    delete model.plinthHeightMm;
    const spec = adaptWardrobeModelToFurniSpec(model, { plinthHeightMm: 100 });
    expect(spec.plinth.heightMm).toBe(100);
  });

  it("names a component type it cannot express, rather than dropping it", () => {
    const model = goldenShapedModel();
    model.sections[0].components.push({ id: "mirror-01", type: "MIRROR", positionMm: 500, heightMm: 10 });
    const diagnostics = adapterDiagnostics(model);
    expect(diagnostics.some((d) => d.code === "UNMAPPABLE_COMPONENT_TYPE" && d.componentId === "mirror-01")).toBe(true);
    expect(() => adaptWardrobeModelToFurniSpec(model)).toThrow(/mirror-01/);
  });

  it("refuses a rail with no shelf above it to measure from", () => {
    const model = goldenShapedModel();
    model.sections[0].components = [
      { id: "rail-01", type: "HANGING_RAIL", positionMm: 1400, heightMm: 40 },
    ];
    expect(adapterDiagnostics(model).some((d) => d.code === "RAIL_HAS_NO_SHELF_ABOVE")).toBe(true);
  });

  it("refuses a drawer bank with no row count", () => {
    const model = goldenShapedModel();
    model.sections[0].components.push({ id: "drawer-01", type: "DRAWER_BANK", positionMm: 0, heightMm: 540 });
    expect(adapterDiagnostics(model).some((d) => d.code === "DRAWER_ROWS_MISSING")).toBe(true);
  });

  it("reports a model that is not a model at all", () => {
    expect(adapterDiagnostics(null)).toEqual([
      { code: "NOT_A_MODEL", message: "No WardrobeModel was supplied." },
    ]);
    expect(() => adaptWardrobeModelToFurniSpec(undefined)).toThrow(AdapterError);
  });

  it("surfaces a FurniSpec validation failure as an adapter failure, not a kernel one", () => {
    // Sections that do not close against the overall width: the spec the
    // adapter would emit is invalid, and it must say so itself.
    const model = goldenShapedModel();
    model.sections[0].widthMm = 500;
    let caught;
    try {
      adaptWardrobeModelToFurniSpec(model);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AdapterError);
    expect(caught.diagnostics.some((d) => d.code === "WIDTH_MISMATCH")).toBe(true);
  });

  it("says nothing is wrong when nothing is", () => {
    expect(adapterDiagnostics(goldenShapedModel())).toEqual([]);
  });
});
