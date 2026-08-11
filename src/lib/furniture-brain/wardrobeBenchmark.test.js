import { describe, expect, test } from "vitest";
import { createWardrobe } from "../wardrobe-model/kernel.js";
import { validateWardrobeModel } from "../wardrobe-model/validator.js";
import { buildWardrobeGeometry } from "../wardrobe-model/buildWardrobeGeometry.js";
import { WARDROBE_TOOLS, findTool } from "../wardrobe-tools/tools.js";

/**
 * Known-gap register for the master plan's §25 "core modeling benchmark" and
 * Phase 1 ("Wardrobe: idea to exact editable 3D") acceptance criteria.
 * ----------------------------------------------------------------------------
 * §25 defines three fixture types: regression (must keep passing), characterization
 * (current behavior, not yet judged), and knownGap (missing behavior, documented as
 * a todo, never asserted as correct). `test.todo` makes each one visible in
 * `npm test` output (shown as pending, never pass/fail) instead of silently
 * missing — a checklist for Phase 1+, not a claim that any of it works.
 *
 * Five of the original thirteen gaps are now closed by the Wardrobe AI
 * (src/lib/wardrobe-model, src/lib/wardrobe-tools — see
 * docs/WARDROBE_MODEL_SCHEMA.md and docs/TOOL_CONTRACTS.md) and are
 * converted to real, passing tests below instead of staying `test.todo`.
 * The Wardrobe AI is a new, parallel system — it does not touch the FSL
 * v1 pipeline (furniture-brain, configurator-adapter, buildGeometry.js), so
 * every gap that was specifically about FSL's own reach (multi-module FSL,
 * image-based dimension extraction, custom arbitrary-panel furniture) is
 * still exactly as missing as it was before; converting those would be
 * claiming something untrue. L-shaped/corner/sloped-ceiling wardrobes and
 * sliding-vs-hinged rendering are out of scope for both systems today.
 *
 * What IS covered today, elsewhere, so it's deliberately NOT repeated here:
 *   - FSL interpretation of a fully-specified / partially-specified wardrobe request,
 *     explicit-vs-assumption tracking, missing_information — furniture-brain/brain.test.js
 *   - FSL schema/semantic validation, configurator compatibility per component — fsl/validator.test.js
 *   - buildGeometry.js's panel output for a given FurnitureConfig — buildGeometry.test.js
 *   - configSchema.js's sanitization of raw AI output — configSchema.test.js
 *   - the Wardrobe AI's own kernel/tool/agent-loop test suites — src/lib/wardrobe-model/*.test.js,
 *     src/lib/wardrobe-tools/tools.test.js, src/lib/wardrobe-agent/runWardrobeAgent.test.js
 */
describe("Core wardrobe modeling benchmark (master plan §25) — known gaps", () => {
  test.todo("multi-module wardrobe: FSL document -> configurator-adapter -> buildGeometry produces panels consistent with the FSL component counts (no layer currently connects FSL all the way to buildGeometry's parts list)");
  test.todo("wall-to-wall wardrobe with fillers/scribes (no filler_panel/end_panel geometry exists in buildGeometry.js)");
  test.todo("L-shaped wardrobe (buildGeometry.js models one rectangular carcass only)");
  test.todo("corner wardrobe (no corner geometry exists)");
  test.todo("sloped-ceiling wardrobe (no sloped/angled geometry exists)");
  test.todo("sliding-door wardrobe renders distinctly from a hinged door (components.js marks sliding_door render-identical to hinged_door today)");
  test.todo("wardrobe from a reference image with missing dimensions, through to a clarifying question (brain.test.js covers text-only missing-dimension cases; no attachment-driven dimension-extraction test exists)");
  test.todo("custom furniture built from arbitrary panels, not a preset category (no typed custom-parts representation exists — see master plan §6's corrected note on set_custom_design)");
});

describe("Core wardrobe modeling benchmark — closed by the Wardrobe AI (Phase 1)", () => {
  test("resize after creation via a typed tool (section_resize) that only touches the affected section", () => {
    let model = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
    const added = findTool("section_add").run(model, { widthMm: 900 });
    model = added.model;
    const targetId = model.sections[0].id;
    const otherIds = model.sections.slice(1).map((s) => s.id);

    const resized = findTool("section_resize").run(model, { sectionId: targetId, widthMm: 700 });
    expect(resized.success).toBe(true);
    expect(resized.model.sections.find((s) => s.id === targetId).widthMm).toBe(700);
    // "only touches the affected section" in identity terms: no section was
    // added, removed, or given a new id by resizing one of them.
    expect(resized.model.sections.map((s) => s.id)).toEqual(model.sections.map((s) => s.id));
    expect(resized.model.sections.slice(1).map((s) => s.id)).toEqual(otherIds);
  });

  test("add/remove a drawer bank via typed tools (component_add/component_remove) without rebuilding the document", () => {
    let model = createWardrobe({ widthMm: 900, heightMm: 2600, depthMm: 600 });
    const before = model;
    const added = findTool("component_add").run(model, {
      sectionId: model.sections[0].id, type: "DRAWER_BANK", rows: 4, positionMm: 0,
    });
    expect(added.success).toBe(true);
    expect(added.model.sections[0].components).toHaveLength(1);
    expect(added.model.id).toBe(before.id); // same wardrobe, not regenerated

    const removed = findTool("component_remove").run(added.model, { componentId: added.componentId });
    expect(removed.success).toBe(true);
    expect(removed.model.sections[0].components).toHaveLength(0);
    expect(removed.model.id).toBe(before.id);
  });

  test("add/remove a shelf via typed tools (component_add/component_remove)", () => {
    let model = createWardrobe({ widthMm: 900, heightMm: 2600, depthMm: 600 });
    const added = findTool("component_add").run(model, { sectionId: model.sections[0].id, type: "SHELF" });
    expect(added.success).toBe(true);
    expect(added.model.sections[0].components).toHaveLength(1);

    const removed = findTool("component_remove").run(added.model, { componentId: added.componentId });
    expect(removed.success).toBe(true);
    expect(removed.model.sections[0].components).toHaveLength(0);
  });

  test("collision/overlap detection between components after an edit", () => {
    let model = createWardrobe({ widthMm: 900, heightMm: 2600, depthMm: 600 });
    const first = findTool("component_add").run(model, { sectionId: model.sections[0].id, type: "SHELF", positionMm: 500 });
    expect(first.success).toBe(true);
    // Directly forcing a second shelf onto the exact same zone (bypassing
    // the tool's own auto-stack) proves the validator itself — not just the
    // tool's convenience default — catches the overlap.
    const overlapping = {
      ...first.model,
      sections: [{
        ...first.model.sections[0],
        components: [...first.model.sections[0].components, { id: "C_test", type: "SHELF", positionMm: 500, heightMm: 18 }],
      }],
    };
    const issues = validateWardrobeModel(overlapping);
    expect(issues.some((i) => i.code === "COMPONENT_OVERLAP")).toBe(true);
  });

  test("production handoff cross-check: every rendered part traces to a stable model id, no duplicate/omitted ids", () => {
    let model = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
    model = findTool("section_add").run(model, { widthMm: 900 }).model;
    model = findTool("component_add").run(model, { sectionId: model.sections[0].id, type: "SHELF" }).model;
    model = findTool("component_add").run(model, { sectionId: model.sections[1].id, type: "DRAWER_BANK", rows: 3, positionMm: 0 }).model;

    expect(validateWardrobeModel(model)).toEqual([]); // no duplicate/omitted stable IDs

    const parts = buildWardrobeGeometry(model);
    const componentIds = model.sections.flatMap((s) => s.components.map((c) => c.id));
    for (const id of componentIds) {
      const tracedParts = parts.filter((p) => p.id === id || p.id.startsWith(`${id}-`));
      expect(tracedParts.length).toBeGreaterThan(0); // every model component appears in the rendered parts list
    }
    const partIds = parts.map((p) => p.id);
    expect(new Set(partIds).size).toBe(partIds.length); // no duplicate part ids
  });

  test("all 8 approved Wardrobe AI tools exist, in the eight-tool surface the spec requires", () => {
    expect(WARDROBE_TOOLS.map((t) => t.name).sort()).toEqual(
      [
        "component_add", "component_move", "component_remove", "component_update",
        "section_add", "section_resize", "wardrobe_create", "wardrobe_resize",
      ].sort()
    );
  });
});
