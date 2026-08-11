import { describe, expect, test } from "vitest";
import { WARDROBE_TOOLS, findTool } from "./tools.js";
import { toAnthropicTools } from "./toAnthropicTools.js";

const TOOL_NAMES = [
  "wardrobe_create",
  "wardrobe_resize",
  "section_add",
  "section_resize",
  "component_add",
  "component_move",
  "component_remove",
  "component_update",
];

function run(name, model, input) {
  return findTool(name).run(model, input);
}

describe("tool registry", () => {
  test("all 8 approved tools exist and every tool has a name/description/schema/run", () => {
    expect(WARDROBE_TOOLS.map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort());
    for (const t of WARDROBE_TOOLS) {
      expect(typeof t.name).toBe("string");
      expect(typeof t.description).toBe("string");
      expect(t.inputSchema.type).toBe("object");
      expect(typeof t.run).toBe("function");
    }
  });

  test("toAnthropicTools maps every tool to Anthropic's {name, description, input_schema} shape", () => {
    const mapped = toAnthropicTools();
    expect(mapped).toHaveLength(WARDROBE_TOOLS.length);
    for (const t of mapped) {
      expect(t).toHaveProperty("name");
      expect(t).toHaveProperty("description");
      expect(t).toHaveProperty("input_schema");
      expect(t.input_schema).toHaveProperty("type", "object");
    }
  });

  test("every one of the 8 schemas declares additionalProperties: false, including nested object properties", () => {
    for (const t of WARDROBE_TOOLS) {
      expect(t.inputSchema.additionalProperties).toBe(false);
      for (const sub of Object.values(t.inputSchema.properties || {})) {
        if (sub.type === "object") expect(sub.additionalProperties).toBe(false);
      }
    }
  });
});

describe("strict schema enforcement — unknown/forbidden arguments are rejected at execution time", () => {
  test.each(TOOL_NAMES)("%s rejects an arbitrary unknown property", (name) => {
    const result = run(name, null, { totallyUnrecognizedField: "x" });
    expect(result).toMatchObject({ success: false, error: "INVALID_TOOL_ARGUMENTS" });
    expect(result.model).toBeUndefined();
  });

  test("component_add rejects raw Three.js-style coordinates disguised as arguments", () => {
    const model = run("wardrobe_create", null, { widthMm: 2400, heightMm: 2600, depthMm: 600 }).model;
    const result = run("component_add", model, {
      sectionId: model.sections[0].id,
      type: "SHELF",
      threeJsPosition: [0.1, 0.7, -0.2],
    });
    expect(result).toMatchObject({ success: false, error: "INVALID_TOOL_ARGUMENTS" });
  });

  test("component_add rejects bare x/y/z fields, not just threeJsPosition", () => {
    const model = run("wardrobe_create", null, { widthMm: 2400, heightMm: 2600, depthMm: 600 }).model;
    const result = run("component_add", model, { sectionId: model.sections[0].id, type: "SHELF", x: 0.1, y: 0.7, z: -0.2 });
    expect(result).toMatchObject({ success: false, error: "INVALID_TOOL_ARGUMENTS" });
  });

  test("component_update rejects an unknown property inside the nested properties object", () => {
    let model = run("wardrobe_create", null, { widthMm: 2400, heightMm: 2600, depthMm: 600 }).model;
    model = run("component_add", model, { sectionId: model.sections[0].id, type: "DRAWER_BANK", rows: 3, positionMm: 0 }).model;
    const componentId = model.sections[0].components[0].id;
    const result = run("component_update", model, { componentId, properties: { rows: 4, mesh: "bogus" } });
    expect(result).toMatchObject({ success: false, error: "INVALID_TOOL_ARGUMENTS" });
  });

  test("missing a required argument is rejected before the kernel ever runs", () => {
    const result = run("wardrobe_create", null, { widthMm: 2400, heightMm: 2600 });
    expect(result).toMatchObject({ success: false, error: "INVALID_TOOL_ARGUMENTS" });
  });
});

describe("integer-millimetre contract at the tool layer", () => {
  test("wardrobe_create rejects fractional widthMm/heightMm/depthMm", () => {
    expect(run("wardrobe_create", null, { widthMm: 2400.5, heightMm: 2600, depthMm: 600 })).toMatchObject({
      success: false,
      error: "INVALID_DIMENSION",
    });
  });

  test("section_add rejects a fractional widthMm", () => {
    const model = run("wardrobe_create", null, { widthMm: 2400, heightMm: 2600, depthMm: 600 }).model;
    expect(run("section_add", model, { widthMm: 700.5 })).toMatchObject({ success: false, error: "INVALID_DIMENSION" });
  });

  test("section_resize rejects a fractional widthMm", () => {
    let model = run("wardrobe_create", null, { widthMm: 2400, heightMm: 2600, depthMm: 600 }).model;
    model = run("section_add", model, { widthMm: 900 }).model;
    expect(run("section_resize", model, { sectionId: model.sections[0].id, widthMm: 700.5 })).toMatchObject({
      success: false,
      error: "INVALID_DIMENSION",
    });
  });

  test("component_move rejects a fractional deltaMm instead of rounding it", () => {
    let model = run("wardrobe_create", null, { widthMm: 900, heightMm: 2600, depthMm: 600 }).model;
    const added = run("component_add", model, { sectionId: model.sections[0].id, type: "SHELF", positionMm: 100 });
    expect(run("component_move", added.model, { componentId: added.componentId, axis: "z", deltaMm: 125.5 })).toMatchObject({
      success: false,
      error: "INVALID_DIMENSION",
    });
  });
});

describe("result shapes align with the documented tool contract (docs/TOOL_CONTRACTS.md)", () => {
  test("wardrobe_resize returns wardrobeId, oldDimensionsMm, and newDimensionsMm", () => {
    const model = run("wardrobe_create", null, { widthMm: 2400, heightMm: 2600, depthMm: 600 }).model;
    const result = run("wardrobe_resize", model, { widthMm: 3000 });
    expect(result).toMatchObject({
      success: true,
      wardrobeId: model.id,
      oldDimensionsMm: { widthMm: 2400, heightMm: 2600, depthMm: 600 },
      newDimensionsMm: { widthMm: 3000, heightMm: 2600, depthMm: 600 },
    });
  });

  test("section_resize returns sectionId, oldWidthMm, and newWidthMm", () => {
    let model = run("wardrobe_create", null, { widthMm: 2400, heightMm: 2600, depthMm: 600 }).model;
    model = run("section_add", model, { widthMm: 900 }).model;
    const sectionId = model.sections[0].id;
    const oldWidthMm = model.sections[0].widthMm;
    const result = run("section_resize", model, { sectionId, widthMm: 700 });
    expect(result).toMatchObject({ success: true, sectionId, oldWidthMm, newWidthMm: 700 });
  });

  test("component_move and component_remove both echo componentId in the result", () => {
    let model = run("wardrobe_create", null, { widthMm: 900, heightMm: 2600, depthMm: 600 }).model;
    const added = run("component_add", model, { sectionId: model.sections[0].id, type: "SHELF", positionMm: 0 });
    const moved = run("component_move", added.model, { componentId: added.componentId, axis: "z", deltaMm: 10 });
    expect(moved).toMatchObject({ success: true, componentId: added.componentId });
    const removed = run("component_remove", moved.model, { componentId: added.componentId });
    expect(removed).toMatchObject({ success: true, componentId: added.componentId });
  });

  test("component_update returns componentId, oldProperties, and newProperties", () => {
    let model = run("wardrobe_create", null, { widthMm: 900, heightMm: 2600, depthMm: 600 }).model;
    const added = run("component_add", model, { sectionId: model.sections[0].id, type: "DRAWER_BANK", rows: 3, positionMm: 0 });
    const result = run("component_update", added.model, { componentId: added.componentId, properties: { rows: 5 } });
    expect(result).toMatchObject({
      success: true,
      componentId: added.componentId,
      oldProperties: { rows: 3 },
      newProperties: { rows: 5 },
    });
  });
});

describe("wardrobe_create contract", () => {
  test("exact input produces an exact, deterministic model", () => {
    const a = run("wardrobe_create", null, { widthMm: 2400, heightMm: 2600, depthMm: 600 });
    const b = run("wardrobe_create", null, { widthMm: 2400, heightMm: 2600, depthMm: 600 });
    expect(a.success).toBe(true);
    expect(a.model).toEqual(b.model);
    expect(a.model.widthMm).toBe(2400);
    expect(a.model.sections).toHaveLength(1);
  });

  test("invalid dimensions return a structured failure, not a thrown exception", () => {
    const result = run("wardrobe_create", null, { widthMm: -1, heightMm: 2600, depthMm: 600 });
    expect(result).toEqual(
      expect.objectContaining({ success: false, error: expect.any(String) })
    );
    expect(result.model).toBeUndefined();
  });
});

describe("component_move contract", () => {
  test("starting Z 900, delta +120, gives exactly 1020 — not approximately", () => {
    const created = run("wardrobe_create", null, { widthMm: 900, heightMm: 2600, depthMm: 600 });
    const added = run("component_add", created.model, {
      sectionId: created.model.sections[0].id,
      type: "SHELF",
      positionMm: 900,
    });
    const moved = run("component_move", added.model, { componentId: added.componentId, axis: "z", deltaMm: 120 });
    expect(moved).toMatchObject({ success: true, oldZ: 900, newZ: 1020 });
    expect(moved.model.sections[0].components[0].positionMm).toBe(1020);
    expect(moved.revision).toBe(added.model.revision + 1);
  });

  test("axis other than 'z' returns NOT_IMPLEMENTED, model state is unchanged", () => {
    const created = run("wardrobe_create", null, { widthMm: 900, heightMm: 2600, depthMm: 600 });
    const added = run("component_add", created.model, { sectionId: created.model.sections[0].id, type: "SHELF", positionMm: 0 });
    const result = run("component_move", added.model, { componentId: added.componentId, axis: "x", deltaMm: 50 });
    expect(result.success).toBe(false);
    expect(result.error).toBe("NOT_IMPLEMENTED");
    expect(result.model).toBeUndefined();
  });
});

describe("adversarial / invariant inputs — every one is REJECTED, never silently fixed", () => {
  const created = () => run("wardrobe_create", null, { widthMm: 2400, heightMm: 2600, depthMm: 600 }).model;

  test("negative width", () => {
    expect(run("wardrobe_resize", created(), { widthMm: -100 }).success).toBe(false);
  });

  test("zero height", () => {
    const model = created();
    // wardrobe_resize only rejects out-of-range, not zero specifically at the
    // schema boundary — exercise the boundary explicitly to prove it's real.
    expect(run("wardrobe_resize", model, { heightMm: 0 }).success).toBe(false);
  });

  test("section wider than the wardrobe", () => {
    expect(run("section_add", created(), { widthMm: 50000 }).success).toBe(false);
  });

  test("a new section that would squeeze the existing one below the manufacturable minimum is rejected", () => {
    const model = created();
    const withSection = run("section_add", model, { widthMm: 2200 });
    expect(withSection.success).toBe(false);
  });

  test("shelf positioned outside the carcass", () => {
    const model = created();
    const result = run("component_add", model, { sectionId: model.sections[0].id, type: "SHELF", positionMm: 999999 });
    expect(result.success).toBe(false);
  });

  test("15 overlapping shelves — the 15th attempt to stack on the same spot is still geometrically valid (auto-stack), but an explicit forced overlap is rejected", () => {
    let model = created();
    for (let i = 0; i < 15; i++) {
      const r = run("component_add", model, { sectionId: model.sections[0].id, type: "SHELF", positionMm: 500 });
      if (i === 0) {
        expect(r.success).toBe(true);
        model = r.model;
      } else {
        expect(r.success).toBe(false);
        expect(r.error).toBe("COMPONENT_OVERLAP");
      }
    }
  });

  test("door with an invalid leaves count", () => {
    const model = created();
    const result = run("component_add", model, { sectionId: model.sections[0].id, type: "DOOR", leaves: 99 });
    expect(result.success).toBe(false);
  });

  test("component_add with type DIVIDER returns NOT_IMPLEMENTED — dividers are structural, not addable", () => {
    const model = created();
    const result = run("component_add", model, { sectionId: model.sections[0].id, type: "DIVIDER" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("NOT_IMPLEMENTED");
  });

  test("unknown component type is rejected outright", () => {
    const model = created();
    const result = run("component_add", model, { sectionId: model.sections[0].id, type: "SPACESHIP_HATCH" });
    expect(result.success).toBe(false);
  });

  test("moving/removing/updating a component that does not exist fails cleanly", () => {
    const model = created();
    expect(run("component_move", model, { componentId: "does-not-exist", axis: "z", deltaMm: 1 }).success).toBe(false);
    expect(run("component_remove", model, { componentId: "does-not-exist" }).success).toBe(false);
    expect(run("component_update", model, { componentId: "does-not-exist", properties: { rows: 2 } }).success).toBe(false);
  });

  test("a failed operation returns no model — callers keep the model they had", () => {
    const model = created();
    const result = run("section_resize", model, { sectionId: "bogus", widthMm: 500 });
    expect(result.success).toBe(false);
    expect(result.model).toBeUndefined();
  });
});

describe("full sequence: create -> add sections -> add components -> resize -> move -> remove", () => {
  test("matches the Definition of Done narrative end to end with structured results throughout", () => {
    let step = run("wardrobe_create", null, { widthMm: 2400, heightMm: 2600, depthMm: 600 });
    expect(step.success).toBe(true);
    let model = step.model;
    const leftId = model.sections[0].id;

    step = run("section_add", model, { widthMm: 1000, afterSectionId: leftId });
    expect(step.success).toBe(true);
    model = step.model;
    const centerId = step.sectionId;

    step = run("section_add", model, { widthMm: 800, afterSectionId: centerId });
    expect(step.success).toBe(true);
    model = step.model;

    for (let i = 0; i < 6; i++) {
      step = run("component_add", model, { sectionId: leftId, type: "SHELF" });
      expect(step.success).toBe(true);
      model = step.model;
    }

    step = run("section_resize", model, { sectionId: leftId, widthMm: 700 });
    expect(step.success).toBe(true);
    expect(step.model.sections.find((s) => s.id === leftId).widthMm).toBe(700);
    model = step.model;

    const thirdShelf = model.sections.find((s) => s.id === leftId).components[2];
    step = run("component_move", model, { componentId: thirdShelf.id, axis: "z", deltaMm: 125 });
    expect(step.success).toBe(true);
    expect(step.newZ).toBe(thirdShelf.positionMm + 125);
    model = step.model;

    const firstShelfId = model.sections.find((s) => s.id === leftId).components[0].id;
    step = run("component_remove", model, { componentId: firstShelfId });
    expect(step.success).toBe(true);
    expect(model.sections.find((s) => s.id === leftId).components.some((c) => c.id === firstShelfId)).toBe(true);
    model = step.model;
    expect(model.sections.find((s) => s.id === leftId).components.some((c) => c.id === firstShelfId)).toBe(false);
  });
});
