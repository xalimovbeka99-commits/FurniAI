import { describe, expect, test } from "vitest";
import { validateWardrobeModel } from "./validator.js";
import { createWardrobe, addComponent, addSection } from "./kernel.js";
import { COMPONENT_TYPES } from "./schema.js";

describe("validateWardrobeModel", () => {
  test("a freshly created wardrobe is valid", () => {
    const model = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
    expect(validateWardrobeModel(model)).toEqual([]);
  });

  test("a wardrobe with a well-placed shelf is valid", () => {
    let model = createWardrobe({ widthMm: 900, heightMm: 2600, depthMm: 600 });
    model = addComponent(model, { sectionId: model.sections[0].id, type: COMPONENT_TYPES.SHELF, positionMm: 900 });
    expect(validateWardrobeModel(model)).toEqual([]);
  });

  test.each([
    ["negative width", { widthMm: -100 }],
    ["zero height", { heightMm: 0 }],
  ])("rejects %s", (_name, overrides) => {
    const model = { ...createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 }), ...overrides };
    const issues = validateWardrobeModel(model);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].code).toBe("INVALID_DIMENSION");
  });

  test("section wider than wardrobe is rejected", () => {
    const model = createWardrobe({ widthMm: 900, heightMm: 2600, depthMm: 600 });
    const broken = { ...model, sections: [{ ...model.sections[0], widthMm: 5000 }] };
    const issues = validateWardrobeModel(broken);
    expect(issues.some((i) => i.code === "SECTION_WIDTH_MISMATCH")).toBe(true);
  });

  test("a shelf positioned outside the interior height is rejected", () => {
    let model = createWardrobe({ widthMm: 900, heightMm: 2600, depthMm: 600 });
    model = addComponent(model, { sectionId: model.sections[0].id, type: COMPONENT_TYPES.SHELF, positionMm: 100 });
    const broken = {
      ...model,
      sections: [{ ...model.sections[0], components: [{ ...model.sections[0].components[0], positionMm: 999999 }] }],
    };
    const issues = validateWardrobeModel(broken);
    expect(issues.some((i) => i.code === "COMPONENT_OUTSIDE_SECTION")).toBe(true);
  });

  test("15 overlapping shelves in one section are all reported as overlapping", () => {
    let model = createWardrobe({ widthMm: 900, heightMm: 2600, depthMm: 600 });
    const sectionId = model.sections[0].id;
    for (let i = 0; i < 15; i++) {
      // deliberately place every shelf at the same position — a direct stack
      model = addComponent(model, { sectionId, type: COMPONENT_TYPES.SHELF, positionMm: 500 });
    }
    const issues = validateWardrobeModel(model);
    const overlaps = issues.filter((i) => i.code === "COMPONENT_OVERLAP");
    expect(overlaps.length).toBeGreaterThan(0);
  });

  test("a door does not count as a zone overlap against a shelf behind it", () => {
    let model = createWardrobe({ widthMm: 900, heightMm: 2600, depthMm: 600 });
    const sectionId = model.sections[0].id;
    model = addComponent(model, { sectionId, type: COMPONENT_TYPES.SHELF, positionMm: 500 });
    model = addComponent(model, { sectionId, type: COMPONENT_TYPES.DOOR });
    expect(validateWardrobeModel(model)).toEqual([]);
  });

  test("duplicate IDs across sections are rejected", () => {
    let model = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
    model = addSection(model, { widthMm: 900 });
    const broken = {
      ...model,
      sections: [model.sections[0], { ...model.sections[1], id: model.sections[0].id }],
    };
    const issues = validateWardrobeModel(broken);
    expect(issues.some((i) => i.code === "DUPLICATE_ID")).toBe(true);
  });
});
