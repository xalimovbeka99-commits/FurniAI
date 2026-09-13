/**
 * Targeted fail-closed physical rules promoted from aspirational adversarial QA.
 */
import { describe, expect, test } from "vitest";
import { createWardrobe, addComponent, addSection } from "@/lib/wardrobe-model/kernel.js";
import { validateWardrobeModel } from "@/lib/wardrobe-model/validator.js";
import { COMPONENT_TYPES, DEFAULTS } from "@/lib/wardrobe-model/schema.js";
import { findTool } from "@/lib/wardrobe-tools/tools.js";

function run(toolName, model, args) {
  return findTool(toolName).run(model, args);
}

describe("fail-closed physical rules", () => {
  test("panel thickness > 50mm → INVALID_DIMENSION", () => {
    const model = { ...createWardrobe({ widthMm: 900, heightMm: 2600, depthMm: 600 }), panelThicknessMm: 51 };
    const issues = validateWardrobeModel(model);
    expect(issues.some((i) => i.code === "INVALID_DIMENSION")).toBe(true);
  });

  test("panel thickness 50mm remains valid (envelope ceiling)", () => {
    const base = createWardrobe({ widthMm: 900, heightMm: 2600, depthMm: 600 });
    // Keep section widths consistent with thicker panels.
    const panelThicknessMm = 50;
    const widthMm = 900;
    const available = widthMm - 2 * panelThicknessMm;
    const model = {
      ...base,
      widthMm,
      panelThicknessMm,
      sections: [{ ...base.sections[0], widthMm: available }],
    };
    expect(validateWardrobeModel(model)).toEqual([]);
  });

  test("unsupported shelf span > 1200mm without partition", () => {
    const created = run("wardrobe_create", null, { widthMm: 1237, heightMm: 2600, depthMm: 600 });
    expect(created.success).toBe(true);
    expect(created.model.sections[0].widthMm).toBeGreaterThan(DEFAULTS.maxUnsupportedShelfSpanMm);
    const added = run("component_add", created.model, {
      sectionId: created.model.sections[0].id,
      type: "SHELF",
      positionMm: 900,
    });
    expect(added.success).toBe(false);
    expect(added.error).toBe("UNSUPPORTED_SHELF_SPAN");
  });

  test("partitioned bays <= 1200mm may carry shelves", () => {
    // 2400 outer with three equal-ish bays keeps each span under 1200.
    let model = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
    model = addSection(model, { widthMm: 700 });
    model = addSection(model, { widthMm: 700 });
    expect(model.sections.every((s) => s.widthMm <= DEFAULTS.maxUnsupportedShelfSpanMm)).toBe(true);
    const viaTools = run("component_add", model, {
      sectionId: model.sections[0].id,
      type: "SHELF",
      positionMm: 900,
    });
    expect(viaTools.success).toBe(true);
  });

  test("hanging clearance < 800mm → INSUFFICIENT_HANGING_CLEARANCE", () => {
    const created = run("wardrobe_create", null, { widthMm: 900, heightMm: 2600, depthMm: 600 });
    const added = run("component_add", created.model, {
      sectionId: created.model.sections[0].id,
      type: "HANGING_RAIL",
      positionMm: 200,
    });
    expect(added.success).toBe(false);
    expect(added.error).toBe("INSUFFICIENT_HANGING_CLEARANCE");
  });

  test("hanging clearance >= 800mm is accepted", () => {
    const created = run("wardrobe_create", null, { widthMm: 900, heightMm: 2600, depthMm: 600 });
    const added = run("component_add", created.model, {
      sectionId: created.model.sections[0].id,
      type: "HANGING_RAIL",
      positionMm: 1600,
    });
    expect(added.success).toBe(true);
  });

  test("shallow bay with hanging rod → INSUFFICIENT_DEPTH_FOR_HANGING", () => {
    const created = run("wardrobe_create", null, { widthMm: 900, heightMm: 2500, depthMm: 250 });
    expect(created.success).toBe(true);
    const added = run("component_add", created.model, {
      sectionId: created.model.sections[0].id,
      type: "HANGING_RAIL",
      positionMm: 1600,
    });
    expect(added.success).toBe(false);
    expect(added.error).toBe("INSUFFICIENT_DEPTH_FOR_HANGING");
  });

  test("shallow bay without hanging rod remains allowed", () => {
    const created = run("wardrobe_create", null, { widthMm: 900, heightMm: 2500, depthMm: 250 });
    expect(created.success).toBe(true);
    const shelf = run("component_add", created.model, {
      sectionId: created.model.sections[0].id,
      type: "SHELF",
      positionMm: 900,
    });
    expect(shelf.success).toBe(true);
  });

  test("shelf clear spacing < 60mm rejected; 60 and 99 allowed", () => {
    const created = run("wardrobe_create", null, { widthMm: 900, heightMm: 2600, depthMm: 600 });
    const first = run("component_add", created.model, {
      sectionId: created.model.sections[0].id,
      type: "SHELF",
      positionMm: 500,
    });
    expect(first.success).toBe(true);

    const tooClose = run("component_add", first.model, {
      sectionId: first.model.sections[0].id,
      type: "SHELF",
      positionMm: 550, // clear gap ~32mm
    });
    expect(tooClose.success).toBe(false);
    expect(tooClose.error).toBe("INSUFFICIENT_SHELF_CLEARANCE");

    const at60 = run("component_add", first.model, {
      sectionId: first.model.sections[0].id,
      type: "SHELF",
      positionMm: 578, // clear gap 60
    });
    expect(at60.success).toBe(true);

    const base2 = run("wardrobe_create", null, { widthMm: 900, heightMm: 2600, depthMm: 600 });
    const s1 = run("component_add", base2.model, {
      sectionId: base2.model.sections[0].id,
      type: "SHELF",
      positionMm: 500,
    });
    const at99 = run("component_add", s1.model, {
      sectionId: s1.model.sections[0].id,
      type: "SHELF",
      positionMm: 617, // clear gap 99
    });
    expect(at99.success).toBe(true);
  });

  test("bay width 300 remains allowed", () => {
    const created = run("wardrobe_create", null, { widthMm: 300, heightMm: 2500, depthMm: 600 });
    expect(created.success).toBe(true);
  });


  test("rejected physical ops leave previous valid design byte-identical", () => {
    const created = run("wardrobe_create", null, { widthMm: 900, heightMm: 2600, depthMm: 600 });
    expect(created.success).toBe(true);
    const before = JSON.stringify(created.model);

    const badRail = run("component_add", created.model, {
      sectionId: created.model.sections[0].id,
      type: "HANGING_RAIL",
      positionMm: 200,
    });
    expect(badRail.success).toBe(false);
    expect(JSON.stringify(created.model)).toBe(before);

    const first = run("component_add", created.model, {
      sectionId: created.model.sections[0].id,
      type: "SHELF",
      positionMm: 500,
    });
    expect(first.success).toBe(true);
    const afterShelf = JSON.stringify(first.model);

    const tooClose = run("component_add", first.model, {
      sectionId: first.model.sections[0].id,
      type: "SHELF",
      positionMm: 550,
    });
    expect(tooClose.success).toBe(false);
    expect(JSON.stringify(first.model)).toBe(afterShelf);
  });
});
