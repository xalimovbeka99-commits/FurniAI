/**
 * Adversarial conversational boundary + negative multi-turn fuzzing for DRAWER_BANK.
 * Hermetic: fakeWardrobeAgentProvider only (no live LLM).
 *
 * Fail-closed (design unchanged, revision +0):
 *   1. Over-stack: "Add 8 drawers to middle section" → INSUFFICIENT_VERTICAL_CLEARANCE
 *   2. Missing section: "Add drawers to bay 4" on 2-bay → clear error, no crash
 *   3. Negative qty: "Add -2 drawers" → INVALID_INPUT
 *
 * Multi-turn:
 *   1. Add 3 drawers to bay 1 (success, revision +1)
 *   2. Resize width 2400→2600 mm (success, revision +1)
 *   3. Undo last action (restore prior snapshot per draftPreview Undo contract)
 *
 * model.id invariant across the sequence; revision +1 only on valid commits.
 */
import { describe, expect, test } from "vitest";
import { runWardrobeAgent } from "@/lib/wardrobe-agent/runWardrobeAgent.js";
import { createFakeWardrobeAgentProvider } from "@/lib/wardrobe-agent/fakeWardrobeAgentProvider.js";
import { findTool } from "@/lib/wardrobe-tools/tools.js";

function createNBay(bayCount, dims = { widthMm: 2400, heightMm: 2600, depthMm: 600 }) {
  let model = findTool("wardrobe_create").run(null, dims).model;
  for (let i = 1; i < bayCount; i++) {
    model = findTool("section_add").run(model, { widthMm: 700 }).model;
  }
  return model;
}

function snapshot(model) {
  return structuredClone(model);
}

describe("eval: DRAWER_BANK fail-closed conversational boundaries", () => {
  test('over-stack: "Add 8 drawers to middle section" → INSUFFICIENT_VERTICAL_CLEARANCE; revision +0', async () => {
    // Short carcass: 8 rows * 180 = 1440 > interior (~764). Prefer clearance code.
    let model = createNBay(3, { widthMm: 2400, heightMm: 800, depthMm: 600 });
    const mid = model.sections[Math.floor(model.sections.length / 2)];
    const before = snapshot(model);

    const client = createFakeWardrobeAgentProvider([
      {
        toolCalls: [
          {
            name: "component_add",
            input: { sectionId: mid.id, type: "DRAWER_BANK", rows: 8, positionMm: 0 },
          },
        ],
      },
      { text: "Eight drawers will not fit — insufficient vertical clearance." },
    ]);

    const result = await runWardrobeAgent({
      client,
      model,
      message: "Add 8 drawers to middle section",
    });

    expect(result.toolCalls[0].result.success).toBe(false);
    expect(result.toolCalls[0].result.error).toBe("INSUFFICIENT_VERTICAL_CLEARANCE");
    expect(result.model.revision).toBe(before.revision);
    expect(result.model.id).toBe(before.id);
    expect(result.model.sections.every((s) => !s.components.some((c) => c.type === "DRAWER_BANK"))).toBe(
      true
    );
  });

  test('missing section: "Add drawers to bay 4" on a 2-bay wardrobe → clear error; revision +0', async () => {
    const model = createNBay(2, { widthMm: 1800, heightMm: 2600, depthMm: 600 });
    expect(model.sections).toHaveLength(2);
    const before = snapshot(model);

    const client = createFakeWardrobeAgentProvider([
      {
        toolCalls: [
          {
            name: "component_add",
            input: { sectionId: "bay-4", type: "DRAWER_BANK", rows: 3, positionMm: 0 },
          },
        ],
      },
      { text: "This wardrobe only has 2 bays — there is no bay 4." },
    ]);

    const result = await runWardrobeAgent({
      client,
      model,
      message: "Add drawers to bay 4",
    });

    expect(result.toolCalls[0].result.success).toBe(false);
    expect(result.toolCalls[0].result.error).toBe("SECTION_NOT_FOUND");
    expect(result.model.revision).toBe(before.revision);
    expect(result.model.id).toBe(before.id);
    expect(result.model.sections).toHaveLength(2);
  });

  test('negative qty: "Add -2 drawers" → INVALID_INPUT; revision +0', async () => {
    const model = createNBay(2, { widthMm: 1800, heightMm: 2600, depthMm: 600 });
    const before = snapshot(model);
    const sectionId = model.sections[0].id;

    const client = createFakeWardrobeAgentProvider([
      {
        toolCalls: [
          {
            name: "component_add",
            input: { sectionId, type: "DRAWER_BANK", rows: -2, positionMm: 0 },
          },
        ],
      },
      { text: "A negative drawer count is not valid." },
    ]);

    const result = await runWardrobeAgent({
      client,
      model,
      message: "Add -2 drawers",
    });

    expect(result.toolCalls[0].result.success).toBe(false);
    expect(result.toolCalls[0].result.error).toBe("INVALID_INPUT");
    expect(result.model.revision).toBe(before.revision);
    expect(result.model.id).toBe(before.id);
    expect(result.model.sections.every((s) => s.components.length === 0)).toBe(true);
  });
});

describe("eval: DRAWER_BANK multi-turn revision + Undo", () => {
  test("Add 3 drawers → resize 2400→2600 → Undo; model.id stable; revision +1 only on valid turns", async () => {
    let model = createNBay(3, { widthMm: 2400, heightMm: 2600, depthMm: 600 });
    const furnitureId = model.id;
    let conversation = [];
    const undoStack = [];

    // Turn 1: Add 3 drawers to bay 1
    {
      const bay1 = model.sections[0];
      const beforeRev = model.revision;
      undoStack.push(snapshot(model));
      const client = createFakeWardrobeAgentProvider([
        {
          toolCalls: [
            {
              name: "component_add",
              input: { sectionId: bay1.id, type: "DRAWER_BANK", rows: 3, positionMm: 0 },
            },
          ],
        },
        { text: "Added three drawers to bay 1." },
      ]);
      const result = await runWardrobeAgent({
        client,
        model,
        conversation,
        message: "Add 3 drawers to bay 1",
      });
      expect(result.toolCalls[0].result.success).toBe(true);
      model = result.model;
      conversation = result.conversation;
      expect(model.id).toBe(furnitureId);
      expect(model.revision).toBe(beforeRev + 1);
      expect(model.sections[0].components.some((c) => c.type === "DRAWER_BANK" && c.rows === 3)).toBe(
        true
      );
    }

    const afterDrawers = snapshot(model);

    // Turn 2: Resize width 2400 → 2600
    {
      const beforeRev = model.revision;
      undoStack.push(snapshot(model));
      const client = createFakeWardrobeAgentProvider([
        { toolCalls: [{ name: "wardrobe_resize", input: { widthMm: 2600 } }] },
        { text: "Widened the wardrobe to 2600 mm." },
      ]);
      const result = await runWardrobeAgent({
        client,
        model,
        conversation,
        message: "Resize wardrobe width from 2400 to 2600 mm",
      });
      expect(result.toolCalls[0].result.success).toBe(true);
      model = result.model;
      conversation = result.conversation;
      expect(model.id).toBe(furnitureId);
      expect(model.revision).toBe(beforeRev + 1);
      expect(model.widthMm).toBe(2600);
      expect(model.sections[0].components.some((c) => c.type === "DRAWER_BANK" && c.rows === 3)).toBe(
        true
      );
    }

    // Turn 3: Undo last action — restore pre-resize (draftPreview Undo contract:
    // pop snapshot; revision restored, not bumped).
    {
      expect(undoStack.length).toBeGreaterThanOrEqual(1);
      const restored = undoStack.pop();
      expect(restored.id).toBe(furnitureId);
      expect(restored.widthMm).toBe(2400);
      expect(restored.revision).toBe(afterDrawers.revision);
      expect(restored.sections[0].components.some((c) => c.type === "DRAWER_BANK" && c.rows === 3)).toBe(
        true
      );
      model = restored;
    }

    expect(model.id).toBe(furnitureId);
    expect(model.widthMm).toBe(2400);
    expect(model.revision).toBe(afterDrawers.revision);
    expect(model.sections[0].components.some((c) => c.type === "DRAWER_BANK" && c.rows === 3)).toBe(true);
  });
});
