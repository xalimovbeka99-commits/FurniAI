/**
 * State-drift & revision-mutation sequence (wardrobe-agent / tool path).
 *
 * Identity field under test: WardrobeModel.id (stable across successful edits).
 * Revision: bumps by +1 on every successful tool commit (tools.js commit()).
 * A single customer "turn" may therefore advance revision by more than 1 if
 * the agent issues multiple successful tools in that turn — asserted as
 * actual semantics, not an idealized 1→5 counter of turns alone.
 *
 * Drawer steps are marked drawerStep:true. DRAWER_BANK is STRUCTURAL on both the wardrobe-tools path and the PartGraph customer path (CNC stays blocked).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { runWardrobeAgent } from "@/lib/wardrobe-agent/runWardrobeAgent.js";
import { createFakeWardrobeAgentProvider } from "@/lib/wardrobe-agent/fakeWardrobeAgentProvider.js";

const fixture = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures", "state-drift-revision.json"), "utf8")
);

function middleSection(model) {
  const idx = Math.floor(model.sections.length / 2);
  return model.sections[idx];
}

describe("state drift & revision mutation (5-step sequence)", () => {
  test("fixture documents five turns with drawer steps marked", () => {
    expect(fixture.scenario.turns).toHaveLength(5);
    expect(fixture.scenario.turns.filter((t) => t.drawerStep).map((t) => t.turn)).toEqual([2, 5]);
    expect(fixture.identityField).toBe("model.id");
  });

  test("stable model.id, revision advances only on success, panels do not reset", async () => {
    let model = null;
    let furnitureId = null;
    let panelThicknessMm = null;
    const revisionTrace = [];

    // ---- Turn 1: create 2400x2600x600 with 3 sections ----
    {
      const client = createFakeWardrobeAgentProvider([
        {
          toolCalls: [
            { name: "wardrobe_create", input: { widthMm: 2400, heightMm: 2600, depthMm: 600 } },
            { name: "section_add", input: { widthMm: 750 } },
            { name: "section_add", input: { widthMm: 750 } },
          ],
        },
        { text: "Created a 2400×2600×600 mm three-section wardrobe." },
      ]);
      const result = await runWardrobeAgent({
        client,
        model: null,
        message: fixture.scenario.turns[0].prompt,
        maxToolCalls: 10,
      });
      expect(result.toolCalls.every((c) => c.result.success)).toBe(true);
      model = result.model;
      furnitureId = model.id;
      panelThicknessMm = model.panelThicknessMm;
      expect(model.sections).toHaveLength(3);
      expect(model).toMatchObject({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
      expect(model.revision).toBeGreaterThanOrEqual(1);
      revisionTrace.push({ turn: 1, revision: model.revision, success: true });
    }

    // ---- Turn 2: 4 drawers middle (DRAWER_BANK rows:4) ----
    {
      const mid = middleSection(model);
      const beforeRev = model.revision;
      const client = createFakeWardrobeAgentProvider([
        {
          toolCalls: [
            { name: "component_add", input: { sectionId: mid.id, type: "DRAWER_BANK", rows: 4, positionMm: 0 } },
          ],
        },
        { text: "Added four drawers in the middle section." },
      ]);
      const result = await runWardrobeAgent({
        client,
        model,
        message: fixture.scenario.turns[1].prompt,
      });
      expect(result.toolCalls[0].result.success).toBe(true);
      model = result.model;
      expect(model.id).toBe(furnitureId);
      expect(model.revision).toBe(beforeRev + 1);
      const bank = middleSection(model).components.find((c) => c.type === "DRAWER_BANK");
      expect(bank?.rows).toBe(4);
      expect(model.panelThicknessMm).toBe(panelThicknessMm);
      revisionTrace.push({ turn: 2, revision: model.revision, success: true, drawerStep: true });
    }

    // ---- Turn 3: depth → 650 ----
    {
      const beforeRev = model.revision;
      const client = createFakeWardrobeAgentProvider([
        { toolCalls: [{ name: "wardrobe_resize", input: { depthMm: 650 } }] },
        { text: "Depth is now 650 mm." },
      ]);
      const result = await runWardrobeAgent({
        client,
        model,
        message: fixture.scenario.turns[2].prompt,
      });
      expect(result.toolCalls[0].result.success).toBe(true);
      model = result.model;
      expect(model.id).toBe(furnitureId);
      expect(model.revision).toBe(beforeRev + 1);
      expect(model.depthMm).toBe(650);
      expect(model.widthMm).toBe(2400);
      expect(model.heightMm).toBe(2600);
      expect(model.panelThicknessMm).toBe(panelThicknessMm);
      // Drawer bank must survive a depth-only resize
      expect(middleSection(model).components.some((c) => c.type === "DRAWER_BANK" && c.rows === 4)).toBe(true);
      revisionTrace.push({ turn: 3, revision: model.revision, success: true });
    }

    // ---- Turn 4: non-standard material (fail closed) ----
    {
      const before = structuredClone(model);
      const client = createFakeWardrobeAgentProvider([
        { toolCalls: [{ name: "set_material_holographic_carbon", input: { material: "holographic-carbon-fibre" } }] },
        { text: "That material tool is not available." },
      ]);
      const result = await runWardrobeAgent({
        client,
        model,
        message: fixture.scenario.turns[3].prompt,
      });
      expect(result.toolCalls[0].result).toMatchObject({
        success: false,
        error: "TOOL_NOT_AVAILABLE",
      });
      expect(result.model.id).toBe(furnitureId);
      expect(result.model.revision).toBe(before.revision);
      expect(result.model.depthMm).toBe(650);
      expect(result.model.panelThicknessMm).toBe(panelThicknessMm);
      model = result.model;
      revisionTrace.push({ turn: 4, revision: model.revision, success: false });
    }

    // ---- Turn 5: middle → 2 drawers + 2 shelves ----
    {
      const beforeRev = model.revision;
      const mid = middleSection(model);
      const bank = mid.components.find((c) => c.type === "DRAWER_BANK");
      expect(bank).toBeTruthy();
      const client = createFakeWardrobeAgentProvider([
        {
          toolCalls: [
            { name: "component_remove", input: { componentId: bank.id } },
            { name: "component_add", input: { sectionId: mid.id, type: "DRAWER_BANK", rows: 2, positionMm: 0 } },
            { name: "component_add", input: { sectionId: mid.id, type: "SHELF", positionMm: 500 } },
            { name: "component_add", input: { sectionId: mid.id, type: "SHELF", positionMm: 900 } },
          ],
        },
        { text: "Middle section now has 2 drawers and 2 shelves." },
      ]);
      const result = await runWardrobeAgent({
        client,
        model,
        message: fixture.scenario.turns[4].prompt,
        maxToolCalls: 10,
      });
      expect(result.toolCalls.every((c) => c.result.success)).toBe(true);
      model = result.model;
      expect(model.id).toBe(furnitureId);
      expect(model.revision).toBe(beforeRev + 4); // four successful commits this turn
      const midAfter = middleSection(model);
      expect(midAfter.components.filter((c) => c.type === "DRAWER_BANK")).toHaveLength(1);
      expect(midAfter.components.find((c) => c.type === "DRAWER_BANK").rows).toBe(2);
      expect(midAfter.components.filter((c) => c.type === "SHELF")).toHaveLength(2);
      expect(model.depthMm).toBe(650);
      expect(model.panelThicknessMm).toBe(panelThicknessMm);
      revisionTrace.push({ turn: 5, revision: model.revision, success: true, drawerStep: true });
    }

    // Final identity / envelope assertions
    expect(model.id).toBe(furnitureId);
    expect(model.sections).toHaveLength(3);
    expect(model.widthMm).toBe(2400);
    expect(model.heightMm).toBe(2600);
    expect(model.depthMm).toBe(650);
    expect(model.panelThicknessMm).toBe(panelThicknessMm);
    // Turn 4 did not advance; successful turns did
    expect(revisionTrace[3].revision).toBe(revisionTrace[2].revision);
    expect(revisionTrace[4].revision).toBeGreaterThan(revisionTrace[3].revision);
  });
});
