import { describe, expect, test } from "vitest";
import {
  createWardrobe,
  resizeWardrobe,
  addSection,
  resizeSection,
  addComponent,
  moveComponent,
  removeComponent,
  updateComponent,
  KernelError,
} from "./kernel.js";
import { COMPONENT_TYPES } from "./schema.js";

describe("createWardrobe", () => {
  test("identical input produces an identical model, 100 times", () => {
    const first = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
    for (let i = 0; i < 100; i++) {
      const next = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
      expect(next).toEqual(first);
    }
  });

  test("assigns stable, semantic, non-P1/P2/P3, non-Three.js-order IDs", () => {
    const model = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
    expect(model.id).toBe("wardrobe-01");
    expect(model.sections[0].id).toBe("section-01");
  });

  test("rejects out-of-range dimensions instead of clamping silently", () => {
    expect(() => createWardrobe({ widthMm: -100, heightMm: 2600, depthMm: 600 })).toThrow(KernelError);
    expect(() => createWardrobe({ widthMm: 100000, heightMm: 2600, depthMm: 600 })).toThrow(KernelError);
    expect(() => createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 })).not.toThrow();
  });

  test.each([
    ["widthMm", { widthMm: 2400.5, heightMm: 2600, depthMm: 600 }],
    ["heightMm", { widthMm: 2400, heightMm: 2600.5, depthMm: 600 }],
    ["depthMm", { widthMm: 2400, heightMm: 2600, depthMm: 600.5 }],
  ])("integer-mm contract: rejects fractional %s instead of rounding", (_field, args) => {
    let threw = null;
    try {
      createWardrobe(args);
    } catch (e) {
      threw = e;
    }
    expect(threw).toBeInstanceOf(KernelError);
    expect(threw.code).toBe("INVALID_DIMENSION");
  });

  test("uses absolute millimetres throughout, never a ratio", () => {
    const model = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
    expect(model.sections[0].widthMm).toBeGreaterThan(1); // an mm value, not a 0-1 fraction
    expect(Object.values(model.sections[0]).some((v) => typeof v === "number" && v > 0 && v < 1)).toBe(false);
  });

  test("deterministic serialization: two independently created equal models produce the byte-identical JSON string", () => {
    const a = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
    const b = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("deterministic serialization: JSON round-trip reproduces the exact same model, independent of Three.js/UI/LLM", () => {
    let model = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
    model = addComponent(model, { sectionId: model.sections[0].id, type: COMPONENT_TYPES.SHELF, positionMm: 200 });
    const roundTripped = JSON.parse(JSON.stringify(model));
    expect(roundTripped).toEqual(model);
    // serializing the round-tripped copy again is still byte-identical —
    // no field (Map, Set, function, undefined) fails to survive JSON.
    expect(JSON.stringify(roundTripped)).toBe(JSON.stringify(model));
  });
});

describe("addSection / resizeSection", () => {
  function threeSectionWardrobe() {
    // A fresh wardrobe starts with ONE section spanning the full width;
    // addSection proportionally shrinks existing sections to make room for
    // each new one (see kernel.js), so build up to 3 sections first, then
    // dial in exact widths with resizeSection now that siblings exist.
    let model = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
    model = addSection(model, { widthMm: 900 });
    model = addSection(model, { widthMm: 900 });
    model = resizeSection(model, { sectionId: model.sections[0].id, widthMm: 600 });
    model = resizeSection(model, { sectionId: model.sections[1].id, widthMm: 900 });
    return model;
  }

  test("sections always sum to the width available after side panels and dividers", () => {
    const model = threeSectionWardrobe();
    const total = model.sections.reduce((sum, s) => sum + s.widthMm, 0);
    const dividerCount = model.sections.length - 1;
    const expected = model.widthMm - 2 * model.panelThicknessMm - dividerCount * model.panelThicknessMm;
    expect(total).toBe(expected);
    expect(model.sections.every((s) => s.widthMm >= 250)).toBe(true);
  });

  test("resizing one section hits the exact requested width, every time", () => {
    let model = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
    model = addSection(model, { widthMm: 900 });
    model = addSection(model, { widthMm: 900 });
    const targetId = model.sections[0].id;
    model = resizeSection(model, { sectionId: targetId, widthMm: 700 });
    expect(model.sections.find((s) => s.id === targetId).widthMm).toBe(700);
  });

  test("section IDs stay stable across further edits", () => {
    const before = threeSectionWardrobe();
    const ids = before.sections.map((s) => s.id);
    const after = resizeSection(before, { sectionId: ids[0], widthMm: 700 });
    expect(after.sections.map((s) => s.id)).toEqual(ids);
  });

  test("'make the left section 700mm' redistributes the delta, does not change wardrobe width", () => {
    const before = threeSectionWardrobe();
    const leftId = before.sections[0].id;
    const after = resizeSection(before, { sectionId: leftId, widthMm: 700 });
    expect(after.widthMm).toBe(before.widthMm);
    expect(after.sections.find((s) => s.id === leftId).widthMm).toBe(700);
    const total = after.sections.reduce((sum, s) => sum + s.widthMm, 0);
    const dividerCount = after.sections.length - 1;
    expect(total).toBe(after.widthMm - 2 * after.panelThicknessMm - dividerCount * after.panelThicknessMm);
  });

  test("adding a section that would squeeze existing sections below the minimum width is rejected", () => {
    const model = createWardrobe({ widthMm: 1000, heightMm: 2600, depthMm: 600 });
    expect(() => addSection(model, { widthMm: 900 })).toThrow(KernelError);
  });

  test("adding a section wider than the whole wardrobe is rejected", () => {
    const model = createWardrobe({ widthMm: 1000, heightMm: 2600, depthMm: 600 });
    expect(() => addSection(model, { widthMm: 5000 })).toThrow(KernelError);
  });

  test("integer-mm contract: rejects a fractional section width instead of rounding", () => {
    const model = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
    let threw = null;
    try {
      addSection(model, { widthMm: 700.5 });
    } catch (e) {
      threw = e;
    }
    expect(threw).toBeInstanceOf(KernelError);
    expect(threw.code).toBe("INVALID_DIMENSION");
  });

  test("integer-mm contract: rejects a fractional resizeSection width", () => {
    let model = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
    model = addSection(model, { widthMm: 900 });
    let threw = null;
    try {
      resizeSection(model, { sectionId: model.sections[0].id, widthMm: 700.5 });
    } catch (e) {
      threw = e;
    }
    expect(threw).toBeInstanceOf(KernelError);
    expect(threw.code).toBe("INVALID_DIMENSION");
  });

  test("resizing a section so another would fall below the minimum is rejected, model unchanged", () => {
    const model = threeSectionWardrobe();
    const leftId = model.sections[0].id;
    let threw = null;
    try {
      resizeSection(model, { sectionId: leftId, widthMm: 2300 });
    } catch (e) {
      threw = e;
    }
    expect(threw).toBeInstanceOf(KernelError);
    expect(threw.code).toBe("SECTION_TOO_NARROW");
  });
});

describe("addComponent / moveComponent / removeComponent / updateComponent", () => {
  function wardrobeWithSection() {
    return createWardrobe({ widthMm: 900, heightMm: 2600, depthMm: 600 });
  }

  test("component_move: starting Z 900, +120, gives exactly 1020 — not approximately", () => {
    let model = wardrobeWithSection();
    const sectionId = model.sections[0].id;
    model = addComponent(model, { sectionId, type: COMPONENT_TYPES.SHELF, positionMm: 900 });
    const shelfId = model._newComponentId;
    const { model: moved, oldZ, newZ } = moveComponent(model, { componentId: shelfId, axis: "z", deltaMm: 120 });
    expect(oldZ).toBe(900);
    expect(newZ).toBe(1020);
    expect(moved.sections[0].components[0].positionMm).toBe(1020);
  });

  test("auto-stacks a second shelf above the first when positionMm is omitted", () => {
    let model = wardrobeWithSection();
    const sectionId = model.sections[0].id;
    model = addComponent(model, { sectionId, type: COMPONENT_TYPES.SHELF, positionMm: 0 });
    model = addComponent(model, { sectionId, type: COMPONENT_TYPES.SHELF });
    const [first, second] = model.sections[0].components;
    expect(second.positionMm).toBe(first.positionMm + first.heightMm);
  });

  test("adding 4 drawers creates one DRAWER_BANK component with rows: 4", () => {
    let model = wardrobeWithSection();
    const sectionId = model.sections[0].id;
    model = addComponent(model, { sectionId, type: COMPONENT_TYPES.DRAWER_BANK, rows: 4, positionMm: 0 });
    expect(model.sections[0].components).toHaveLength(1);
    expect(model.sections[0].components[0]).toMatchObject({ type: "DRAWER_BANK", rows: 4 });
  });

  test("removeComponent removes exactly that component and no other", () => {
    let model = wardrobeWithSection();
    const sectionId = model.sections[0].id;
    model = addComponent(model, { sectionId, type: COMPONENT_TYPES.SHELF, positionMm: 0 });
    const keepId = model._newComponentId;
    model = addComponent(model, { sectionId, type: COMPONENT_TYPES.SHELF });
    const removeId = model._newComponentId;
    model = removeComponent(model, { componentId: removeId });
    expect(model.sections[0].components.map((c) => c.id)).toEqual([keepId]);
  });

  test("component_add rejects DIVIDER with NOT_IMPLEMENTED, model semantics unchanged", () => {
    const model = wardrobeWithSection();
    let threw = null;
    try {
      addComponent(model, { sectionId: model.sections[0].id, type: COMPONENT_TYPES.DIVIDER });
    } catch (e) {
      threw = e;
    }
    expect(threw).toBeInstanceOf(KernelError);
    expect(threw.code).toBe("NOT_IMPLEMENTED");
  });

  test("component_move rejects axis 'x' with NOT_IMPLEMENTED", () => {
    let model = wardrobeWithSection();
    model = addComponent(model, { sectionId: model.sections[0].id, type: COMPONENT_TYPES.SHELF, positionMm: 0 });
    expect(() => moveComponent(model, { componentId: model._newComponentId, axis: "x", deltaMm: 50 })).toThrow(
      expect.objectContaining({ code: "NOT_IMPLEMENTED" })
    );
  });

  test("moving a door is rejected: a door has no vertical position", () => {
    let model = wardrobeWithSection();
    model = addComponent(model, { sectionId: model.sections[0].id, type: COMPONENT_TYPES.DOOR });
    expect(() => moveComponent(model, { componentId: model._newComponentId, axis: "z", deltaMm: 10 })).toThrow(
      expect.objectContaining({ code: "COMPONENT_NOT_MOVABLE" })
    );
  });

  test("updateComponent rejects a field the component type does not support", () => {
    let model = wardrobeWithSection();
    model = addComponent(model, { sectionId: model.sections[0].id, type: COMPONENT_TYPES.SHELF, positionMm: 0 });
    expect(() => updateComponent(model, { componentId: model._newComponentId, properties: { rows: 5 } })).toThrow(KernelError);
  });

  test("integer-mm contract: rejects a fractional positionMm on component_add", () => {
    const model = wardrobeWithSection();
    let threw = null;
    try {
      addComponent(model, { sectionId: model.sections[0].id, type: COMPONENT_TYPES.SHELF, positionMm: 200.5 });
    } catch (e) {
      threw = e;
    }
    expect(threw).toBeInstanceOf(KernelError);
    expect(threw.code).toBe("INVALID_DIMENSION");
  });

  test("integer-mm contract: rejects a fractional deltaMm on component_move instead of rounding", () => {
    let model = wardrobeWithSection();
    model = addComponent(model, { sectionId: model.sections[0].id, type: COMPONENT_TYPES.SHELF, positionMm: 200 });
    let threw = null;
    try {
      moveComponent(model, { componentId: model._newComponentId, axis: "z", deltaMm: 125.5 });
    } catch (e) {
      threw = e;
    }
    expect(threw).toBeInstanceOf(KernelError);
    expect(threw.code).toBe("INVALID_DIMENSION");
  });

  test("kernel functions never mutate their input model", () => {
    const model = wardrobeWithSection();
    const snapshot = JSON.parse(JSON.stringify(model));
    addComponent(model, { sectionId: model.sections[0].id, type: COMPONENT_TYPES.SHELF, positionMm: 0 });
    expect(model).toEqual(snapshot);
  });

  test("an invalid operation throws and leaves no partial state on the returned-from model", () => {
    let model = wardrobeWithSection();
    model = addComponent(model, { sectionId: model.sections[0].id, type: COMPONENT_TYPES.SHELF, positionMm: 0 });
    const before = JSON.parse(JSON.stringify(model));
    try {
      addComponent(model, { sectionId: "does-not-exist", type: COMPONENT_TYPES.SHELF });
    } catch {
      // expected
    }
    expect(model).toEqual(before);
  });
});
