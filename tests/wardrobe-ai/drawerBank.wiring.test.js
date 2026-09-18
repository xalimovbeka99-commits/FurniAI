/**
 * DRAWER_BANK conversational + tool-path wiring.
 * - component_add DRAWER_BANK shifts overlapping low shelves or fails closed
 *   with INSUFFICIENT_VERTICAL_CLEARANCE.
 * - NL "Add drawers" maps to DRAWER_BANK_WITH_SHORT_HANGING → STRUCTURAL DRAWER_*.
 */
import { describe, expect, test } from "vitest";
import { findTool } from "@/lib/wardrobe-tools/tools.js";
import { runWardrobeAgent } from "@/lib/wardrobe-agent/runWardrobeAgent.js";
import { createFakeWardrobeAgentProvider } from "@/lib/wardrobe-agent/fakeWardrobeAgentProvider.js";
import { adaptWardrobeModelToFurniSpec } from "@/lib/partgraph/wardrobeModelAdapter.js";
import { buildStructuralPartGraph } from "@/lib/partgraph/buildStructuralPartGraph.js";
import { validatePartGraph } from "@/lib/partgraph/validatePartGraph.js";
import {
  applyConversationalEdit,
  previewDraftWardrobe,
  parseConversationalCommand,
  PIPELINE_STAGE,
} from "@/lib/conversation/pipeline.js";
import { COMPONENT_TYPES } from "@/lib/furnispec/schema.js";

function createModel(dims = { widthMm: 900, heightMm: 2600, depthMm: 600 }) {
  return findTool("wardrobe_create").run(null, dims).model;
}

describe("component_add DRAWER_BANK shelf collision policy", () => {
  test("shifts overlapping low shelves above the drawer bank", () => {
    let model = createModel();
    const sectionId = model.sections[0].id;
    model = findTool("component_add").run(model, { sectionId, type: "SHELF", positionMm: 100 }).model;
    model = findTool("component_add").run(model, { sectionId, type: "SHELF", positionMm: 200 }).model;

    const result = findTool("component_add").run(model, {
      sectionId,
      type: "DRAWER_BANK",
      rows: 3,
      positionMm: 0,
    });

    expect(result.success).toBe(true);
    expect(result.shiftedShelves?.length).toBe(2);
    const bank = result.model.sections[0].components.find((c) => c.type === "DRAWER_BANK");
    expect(bank).toMatchObject({ rows: 3, positionMm: 0, heightMm: 540 });
    const shelves = result.model.sections[0].components
      .filter((c) => c.type === "SHELF")
      .sort((a, b) => a.positionMm - b.positionMm);
    expect(shelves[0].positionMm).toBeGreaterThanOrEqual(bank.positionMm + bank.heightMm + 60);
    expect(shelves[1].positionMm).toBeGreaterThan(shelves[0].positionMm);
  });

  test("returns INSUFFICIENT_VERTICAL_CLEARANCE when shelves cannot fit above the bank", () => {
    // Short carcass: interior = 650 - 36 = 614mm. Bank top+clearance+shelf = 540+60+18 = 618 > 614.
    let model = createModel({ widthMm: 900, heightMm: 650, depthMm: 600 });
    const sectionId = model.sections[0].id;
    model = findTool("component_add").run(model, { sectionId, type: "SHELF", positionMm: 50 }).model;
    const before = { revision: model.revision, components: model.sections[0].components.length };

    const result = findTool("component_add").run(model, {
      sectionId,
      type: "DRAWER_BANK",
      rows: 3,
      positionMm: 0,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("INSUFFICIENT_VERTICAL_CLEARANCE");
    expect(model.revision).toBe(before.revision);
    expect(model.sections[0].components).toHaveLength(before.components);
  });

  test("DRAWER_BANK tool result adapts to FurniSpec and emits STRUCTURAL DRAWER_* parts", () => {
    let model = createModel();
    const sectionId = model.sections[0].id;
    const added = findTool("component_add").run(model, {
      sectionId,
      type: "DRAWER_BANK",
      rows: 3,
      positionMm: 0,
    });
    expect(added.success).toBe(true);

    const furniSpec = adaptWardrobeModelToFurniSpec(added.model);
    expect(furniSpec.bays.some((b) => b.components.some((c) => c.type === COMPONENT_TYPES.DRAWER_BANK))).toBe(true);

    const graph = buildStructuralPartGraph(furniSpec);
    const drawerParts = graph.parts.filter((p) => String(p.role).startsWith("DRAWER_"));
    expect(drawerParts.length).toBeGreaterThan(0);
    expect(drawerParts.some((p) => p.role === "DRAWER_FRONT")).toBe(true);

    const validated = validatePartGraph(graph);
    expect(validated.errors.filter((e) => e.code === "UNINTENDED_PART_COLLISION")).toEqual([]);
  });
});

describe("runWardrobeAgent Add drawers tool path", () => {
  test("scripted Add drawers calls component_add DRAWER_BANK successfully", async () => {
    const seed = createModel();
    const sectionId = seed.sections[0].id;
    const client = createFakeWardrobeAgentProvider([
      {
        toolCalls: [
          { name: "component_add", input: { sectionId, type: "DRAWER_BANK", rows: 4, positionMm: 0 } },
        ],
      },
      { text: "Added four drawers." },
    ]);
    const result = await runWardrobeAgent({
      client,
      model: seed,
      message: "Add drawers",
    });
    expect(result.toolCalls[0].result.success).toBe(true);
    expect(result.model.sections[0].components.some((c) => c.type === "DRAWER_BANK" && c.rows === 4)).toBe(true);
    expect(result.assistantMessage).toMatch(/drawer/i);
  });
});

describe("conversational NL Add drawers → DRAWER_BANK layout", () => {
  test("parseConversationalCommand maps Add drawers on the left to drawer bay layout", () => {
    const parsed = parseConversationalCommand("Add drawers on the left", {
      bayCount: 2,
      bayLayouts: ["LONG_HANGING", "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES"],
    });
    expect(parsed.error).toBeUndefined();
    expect(parsed.changes.bayLayouts[0]).toBe("DRAWER_BANK_WITH_SHORT_HANGING");
    expect(parsed.changes.bayLayouts[1]).toBe("SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES");
    expect(parsed.assistantReply).toMatch(/drawer/i);
  });

  test("applyConversationalEdit emits STRUCTURAL DRAWER_* parts for Add drawers on the left", () => {
    const draft = previewDraftWardrobe({
      description: "Make me a wardrobe",
      specId: "spec-drawer-nl-01",
      revision: 1,
    });
    expect(draft.stage).toBe(PIPELINE_STAGE.DRAFT_PREVIEW);

    const result = applyConversationalEdit({
      currentObservations: draft.observations,
      commandText: "Add drawers on the left",
      specId: "spec-drawer-nl-01",
      revision: draft.spec.revision,
    });

    expect(result.ok).toBe(true);
    expect(result.kind).not.toBe("UNSUPPORTED");
    expect(result.spec.bays[0].components.some((c) => c.type === COMPONENT_TYPES.DRAWER_BANK)).toBe(true);
    const drawerParts = result.partGraph.parts.filter((p) => String(p.role).startsWith("DRAWER_"));
    expect(drawerParts.length).toBeGreaterThan(0);
    expect(result.assistantReply).toMatch(/drawer/i);
  });

  test("does not refuse drawers as unsupported anymore", () => {
    const parsed = parseConversationalCommand("Add drawers", {
      bayCount: 2,
      bayLayouts: ["LONG_HANGING", "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES"],
    });
    expect(parsed.unsupported).toBeUndefined();
    expect(parsed.changes?.bayLayouts?.some((l) => l === "DRAWER_BANK_WITH_SHORT_HANGING")).toBe(true);
  });
});
