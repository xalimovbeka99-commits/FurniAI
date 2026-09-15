/**
 * Adversarial conversational boundary + negative multi-turn fuzzing for DRAWER_BANK.
 *
 * Hermetic: scripted fakeWardrobeAgentProvider only (no live LLM / API keys).
 * Mirrors stateDrift.revision + drawerBank.wiring + editing.eval patterns.
 *
 * Impossible / fail-closed:
 *   1. Over-stacking "Add 10 drawers" → INSUFFICIENT_VERTICAL_CLEARANCE
 *   2. Missing target "bay 5" on 3-bay → SECTION_NOT_FOUND, no crash
 *   3. Tight bay (clear width < undermount 21 + L/R box sides 15+15) →
 *      INSUFFICIENT_BAY_WIDTH_FOR_DRAWERS
 *
 * Rapid multi-turn: add drawers → shelves → Undo → resize width;
 * revision +1 only on successful commits; model.id stable; Undo restores
 * pre-shelves snapshot (same contract as draftPreview undo stack tests).
 */
import { describe, expect, test } from "vitest";
import { runWardrobeAgent } from "@/lib/wardrobe-agent/runWardrobeAgent.js";
import { createFakeWardrobeAgentProvider } from "@/lib/wardrobe-agent/fakeWardrobeAgentProvider.js";
import { findTool } from "@/lib/wardrobe-tools/tools.js";
import { DEFAULTS } from "@/lib/wardrobe-model/schema.js";

function createThreeBay({ widthMm = 2400, heightMm = 2600, depthMm = 600 } = {}) {
  let model = findTool("wardrobe_create").run(null, { widthMm, heightMm, depthMm }).model;
  model = findTool("section_add").run(model, { widthMm: 750 }).model;
  model = findTool("section_add").run(model, { widthMm: 750 }).model;
  return model;
}

function leftSection(model) {
  return model.sections[0];
}

function middleSection(model) {
  return model.sections[Math.floor(model.sections.length / 2)];
}

function snapshot(model) {
  return structuredClone(model);
}

describe("eval: DRAWER_BANK adversarial conversational — impossible / fail-closed", () => {
  test("over-stacking: Add 10 drawers to the left bay → INSUFFICIENT_VERTICAL_CLEARANCE; revision unchanged", async () => {
    // Short carcass so even max rows (8) exceed interior height. Customer asks
    // for 10; agent scripts rows:8 (kernel max) which still fails closed on
    // vertical clearance (preferred code). rows:10 alone is OUT_OF_RANGE.
    let model = createThreeBay({ heightMm: 800 });
    const left = leftSection(model);
    // Pack low shelves so shelf-shift path also cannot absorb a tall bank.
    for (const positionMm of [40, 140, 240, 340]) {
      const added = findTool("component_add").run(model, {
        sectionId: left.id,
        type: "SHELF",
        positionMm,
      });
      expect(added.success).toBe(true);
      model = added.model;
    }

    const before = snapshot(model);
    const client = createFakeWardrobeAgentProvider([
      {
        toolCalls: [
          {
            name: "component_add",
            input: { sectionId: left.id, type: "DRAWER_BANK", rows: 8, positionMm: 0 },
          },
        ],
      },
      { text: "I can't fit that many drawers in the left bay — not enough vertical clearance." },
    ]);

    const result = await runWardrobeAgent({
      client,
      model,
      message: "Add 10 drawers to the left bay",
    });

    expect(result.toolCalls[0].result.success).toBe(false);
    expect(result.toolCalls[0].result.error).toBe("INSUFFICIENT_VERTICAL_CLEARANCE");
    expect(result.model.revision).toBe(before.revision);
    expect(result.model.id).toBe(before.id);
    expect(result.model.sections[0].components.some((c) => c.type === "DRAWER_BANK")).toBe(false);
    expect(result.model.sections[0].components.filter((c) => c.type === "SHELF")).toHaveLength(
      before.sections[0].components.filter((c) => c.type === "SHELF").length
    );
  });

  test("missing target: Add drawers to bay 5 on a 3-bay wardrobe → clear error, no crash, revision unchanged", async () => {
    const model = createThreeBay();
    expect(model.sections).toHaveLength(3);
    const before = snapshot(model);

    const client = createFakeWardrobeAgentProvider([
      {
        toolCalls: [
          {
            name: "component_add",
            input: { sectionId: "bay-5", type: "DRAWER_BANK", rows: 3, positionMm: 0 },
          },
        ],
      },
      { text: "This wardrobe only has 3 bays — there is no bay 5." },
    ]);

    const result = await runWardrobeAgent({
      client,
      model,
      message: "Add drawers to bay 5",
    });

    expect(result.toolCalls[0].result.success).toBe(false);
    expect(result.toolCalls[0].result.error).toBe("SECTION_NOT_FOUND");
    expect(result.model.revision).toBe(before.revision);
    expect(result.model.id).toBe(before.id);
    expect(result.model.sections).toHaveLength(3);
    expect(
      result.model.sections.every((s) => !s.components.some((c) => c.type === "DRAWER_BANK"))
    ).toBe(true);
  });

  test("tight bay: drawers into clear width below undermount+side-wall floor → fail-closed; model unchanged", async () => {
    expect(DEFAULTS.minDrawerBayClearWidthMm).toBe(51); // 21 + 15 + 15

    let model = createThreeBay();
    const left = leftSection(model);
    // Adversarial mutation: bay narrower than construction floor (tools cannot
    // resize below minSectionWidthMm=250, which still clears 51mm).
    const tightWidth = DEFAULTS.minDrawerBayClearWidthMm - 11; // 40mm
    model = {
      ...model,
      sections: model.sections.map((s, i) =>
        i === 0 ? { ...s, widthMm: tightWidth } : s
      ),
    };
    const before = snapshot(model);

    const client = createFakeWardrobeAgentProvider([
      {
        toolCalls: [
          {
            name: "component_add",
            input: { sectionId: left.id, type: "DRAWER_BANK", rows: 3, positionMm: 0 },
          },
        ],
      },
      { text: "That bay is too narrow for undermount drawers." },
    ]);

    const result = await runWardrobeAgent({
      client,
      model,
      message: "Add drawers to the left bay",
    });

    expect(result.toolCalls[0].result.success).toBe(false);
    expect(result.toolCalls[0].result.error).toBe("INSUFFICIENT_BAY_WIDTH_FOR_DRAWERS");
    expect(result.model.revision).toBe(before.revision);
    expect(result.model.id).toBe(before.id);
    expect(result.model.sections[0].widthMm).toBe(tightWidth);
    expect(result.model.sections[0].components.some((c) => c.type === "DRAWER_BANK")).toBe(false);
  });
});

describe("eval: DRAWER_BANK rapid multi-turn sequential edits + Undo", () => {
  test("add 3 drawers → 2 shelves → Undo → resize 2400→2700; revision/id/Undo contract", async () => {
    let model = createThreeBay({ widthMm: 2400 });
    const furnitureId = model.id;
    let conversation = [];
    const undoStack = [];

    // ---- Turn 1: Add 3 drawers to middle bay (success, +1) ----
    {
      const mid = middleSection(model);
      const beforeRev = model.revision;
      undoStack.push(snapshot(model));
      const client = createFakeWardrobeAgentProvider([
        {
          toolCalls: [
            {
              name: "component_add",
              input: { sectionId: mid.id, type: "DRAWER_BANK", rows: 3, positionMm: 0 },
            },
          ],
        },
        { text: "Added three drawers in the middle bay." },
      ]);
      const result = await runWardrobeAgent({
        client,
        model,
        conversation,
        message: "Add 3 drawers to the middle bay",
      });
      expect(result.toolCalls[0].result.success).toBe(true);
      model = result.model;
      conversation = result.conversation;
      expect(model.id).toBe(furnitureId);
      expect(model.revision).toBe(beforeRev + 1);
      expect(middleSection(model).components.some((c) => c.type === "DRAWER_BANK" && c.rows === 3)).toBe(
        true
      );
    }

    const afterDrawers = snapshot(model);

    // ---- Turn 2: Add 2 shelves above drawers (success, +2 commits this turn) ----
    {
      const mid = middleSection(model);
      const bank = mid.components.find((c) => c.type === "DRAWER_BANK");
      expect(bank).toBeTruthy();
      const shelf1Pos = bank.positionMm + bank.heightMm + DEFAULTS.minShelfClearanceMm;
      const shelf2Pos = shelf1Pos + DEFAULTS.shelfZoneMm + DEFAULTS.minShelfClearanceMm;
      const beforeRev = model.revision;
      undoStack.push(snapshot(model));
      const client = createFakeWardrobeAgentProvider([
        {
          toolCalls: [
            { name: "component_add", input: { sectionId: mid.id, type: "SHELF", positionMm: shelf1Pos } },
            { name: "component_add", input: { sectionId: mid.id, type: "SHELF", positionMm: shelf2Pos } },
          ],
        },
        { text: "Added two shelves above the drawers." },
      ]);
      const result = await runWardrobeAgent({
        client,
        model,
        conversation,
        message: "Add 2 shelves above drawers",
        maxToolCalls: 10,
      });
      expect(result.toolCalls.every((c) => c.result.success)).toBe(true);
      model = result.model;
      conversation = result.conversation;
      expect(model.id).toBe(furnitureId);
      // One successful tool commit each → +2 this turn (same as stateDrift semantics)
      expect(model.revision).toBe(beforeRev + 2);
      expect(middleSection(model).components.filter((c) => c.type === "SHELF")).toHaveLength(2);
      expect(middleSection(model).components.some((c) => c.type === "DRAWER_BANK" && c.rows === 3)).toBe(
        true
      );
    }

    // ---- Turn 3: Undo last turn → restore pre-shelves (afterDrawers) ----
    {
      expect(undoStack.length).toBeGreaterThanOrEqual(1);
      const restored = undoStack.pop();
      expect(restored.id).toBe(furnitureId);
      expect(restored.revision).toBe(afterDrawers.revision);
      expect(middleSection(restored).components.filter((c) => c.type === "SHELF")).toHaveLength(0);
      expect(
        middleSection(restored).components.some((c) => c.type === "DRAWER_BANK" && c.rows === 3)
      ).toBe(true);
      model = restored;
      // Conversation continuity after Undo: keep prior transcript; model rolled back.
    }

    // ---- Turn 4: Resize wardrobe width 2400 → 2700 (success, +1) ----
    {
      const beforeRev = model.revision;
      const client = createFakeWardrobeAgentProvider([
        { toolCalls: [{ name: "wardrobe_resize", input: { widthMm: 2700 } }] },
        { text: "Widened the wardrobe to 2700 mm." },
      ]);
      const result = await runWardrobeAgent({
        client,
        model,
        conversation,
        message: "Resize wardrobe width 2400 to 2700 mm",
      });
      expect(result.toolCalls[0].result.success).toBe(true);
      model = result.model;
      expect(model.id).toBe(furnitureId);
      expect(model.revision).toBe(beforeRev + 1);
      expect(model.widthMm).toBe(2700);
      expect(middleSection(model).components.some((c) => c.type === "DRAWER_BANK" && c.rows === 3)).toBe(
        true
      );
      expect(middleSection(model).components.filter((c) => c.type === "SHELF")).toHaveLength(0);
    }

    // Final identity assertions
    expect(model.id).toBe(furnitureId);
    expect(model.sections).toHaveLength(3);
    expect(model.widthMm).toBe(2700);
  });

  test("rejected turn does not bump revision (sanity adjacent to multi-turn)", async () => {
    const model = createThreeBay();
    const before = snapshot(model);
    const client = createFakeWardrobeAgentProvider([
      {
        toolCalls: [
          {
            name: "component_add",
            input: { sectionId: "no-such-bay", type: "DRAWER_BANK", rows: 2, positionMm: 0 },
          },
        ],
      },
      { text: "Could not find that bay." },
    ]);
    const result = await runWardrobeAgent({
      client,
      model,
      message: "Add 2 drawers to a bay that does not exist",
    });
    expect(result.toolCalls[0].result.success).toBe(false);
    expect(result.model.revision).toBe(before.revision);
    expect(result.model.id).toBe(before.id);
  });
});
