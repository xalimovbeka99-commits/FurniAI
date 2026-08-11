import { describe, expect, test } from "vitest";
import { buildWardrobeGeometry } from "./buildWardrobeGeometry.js";
import { validateGeometry } from "../buildGeometry.js";
import { createWardrobe, addComponent, addSection } from "./kernel.js";
import { COMPONENT_TYPES } from "./schema.js";

function threeSectionWardrobeWithComponents() {
  // addSection proportionally shrinks existing sections to make room for
  // each new one (see kernel.js) — exact widths don't matter for this file,
  // only that the three sections exist and sum to the wardrobe width.
  let model = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
  const leftId = model.sections[0].id;
  model = addSection(model, { widthMm: 1000, afterSectionId: leftId });
  const centerId = model._newSectionId;
  model = addSection(model, { widthMm: 800, afterSectionId: centerId });
  const rightId = model._newSectionId;

  for (let i = 0; i < 6; i++) {
    model = addComponent(model, { sectionId: leftId, type: COMPONENT_TYPES.SHELF });
  }
  model = addComponent(model, { sectionId: centerId, type: COMPONENT_TYPES.HANGING_RAIL, positionMm: 100 });
  model = addComponent(model, { sectionId: centerId, type: COMPONENT_TYPES.HANGING_RAIL, positionMm: 1300 });
  model = addComponent(model, { sectionId: rightId, type: COMPONENT_TYPES.DRAWER_BANK, rows: 4, positionMm: 0 });
  model = addComponent(model, { sectionId: rightId, type: COMPONENT_TYPES.HANGING_RAIL });
  return model;
}

describe("buildWardrobeGeometry", () => {
  test("every part has a finite, positive, in-envelope size and position", () => {
    const model = threeSectionWardrobeWithComponents();
    const parts = buildWardrobeGeometry(model);
    const config = { dimensions: { width: model.widthMm / 1000, height: model.heightMm / 1000, depth: model.depthMm / 1000 } };
    expect(validateGeometry(parts, config)).toEqual([]);
  });

  test("carcass and divider parts get deterministic structural IDs, not counters", () => {
    const model = threeSectionWardrobeWithComponents();
    const parts = buildWardrobeGeometry(model);
    const ids = parts.map((p) => p.id);
    expect(ids).toContain("carcass-side-left");
    expect(ids).toContain("carcass-side-right");
    expect(ids).toContain("carcass-top");
    expect(ids).toContain("carcass-bottom");
    expect(ids).toContain("carcass-back");
    expect(ids.filter((id) => id.startsWith("divider-"))).toHaveLength(2);
  });

  test("every shelf/rail component ID appears on exactly one rendered part", () => {
    const model = threeSectionWardrobeWithComponents();
    const parts = buildWardrobeGeometry(model);
    const partIds = new Set(parts.map((p) => p.id));
    for (const section of model.sections) {
      for (const component of section.components) {
        if (component.type === COMPONENT_TYPES.SHELF || component.type === COMPONENT_TYPES.HANGING_RAIL) {
          expect(partIds.has(component.id)).toBe(true);
        }
      }
    }
  });

  test("a 4-row drawer bank produces exactly 4 traceable drawerFront parts named C<id>-row1..4", () => {
    const model = threeSectionWardrobeWithComponents();
    const bank = model.sections.flatMap((s) => s.components).find((c) => c.type === COMPONENT_TYPES.DRAWER_BANK);
    const parts = buildWardrobeGeometry(model);
    const rows = parts.filter((p) => p.id.startsWith(`${bank.id}-row`));
    expect(rows).toHaveLength(4);
    expect(rows.every((p) => p.role === "drawerFront")).toBe(true);
  });

  test("running geometry generation twice on the same model produces identical output", () => {
    const model = threeSectionWardrobeWithComponents();
    expect(buildWardrobeGeometry(model)).toEqual(buildWardrobeGeometry(model));
  });

  test("no viewer-only part exists without a corresponding model component or fixed structural role", () => {
    const model = threeSectionWardrobeWithComponents();
    const parts = buildWardrobeGeometry(model);
    const structuralRoles = new Set(["side", "top", "bottom", "back", "divider"]);
    const componentIds = new Set(model.sections.flatMap((s) => s.components.map((c) => c.id)));
    for (const part of parts) {
      if (structuralRoles.has(part.role)) continue;
      const baseId = part.id.replace(/-row\d+$/, "").replace(/-leaf\d+$/, "");
      expect(componentIds.has(baseId)).toBe(true);
    }
  });
});
