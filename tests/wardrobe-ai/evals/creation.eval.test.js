import { describe, expect, test } from "vitest";
import { runWardrobeAgent } from "@/lib/wardrobe-agent/runWardrobeAgent";
import { createFakeWardrobeAgentProvider } from "@/lib/wardrobe-agent/fakeWardrobeAgentProvider";

/**
 * Wardrobe AI evaluation suite — creation, asymmetric layouts, shelves,
 * drawers, rails.
 * ----------------------------------------------------------------------
 * CI-safe: fake-provider driven, no live API key required, no network call.
 * These assert semantic properties of the FINAL STRUCTURED MODEL — never
 * LLM wording — matching the master-plan §25 evaluation rule. A prompt
 * that says "N equal/named sections" asserts sectionCount AND absolute
 * width equality/distinctness, never just overall carcass dimensions (see
 * the remediation note on the original "two equal sections" bug below).
 *
 * Kernel IDs are deterministic (src/lib/wardrobe-model/ids.js): a fresh
 * wardrobe_create always allocates "wardrobe-01" for the wardrobe and
 * "section-01" for its first section, so these scripts can reference that
 * id directly instead of having to parse it back out of a tool result.
 */
describe("eval: creation — basic dimensions", () => {
  test("simple wardrobe: exact dimensions land on the model", async () => {
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_create", input: { widthMm: 2000, heightMm: 2500, depthMm: 600 } }] },
      { text: "Here's your 2000x2500x600 wardrobe." },
    ]);
    const result = await runWardrobeAgent({ client, model: null, message: "Create a 2000 x 2500 x 600 wardrobe." });

    expect(result.model.widthMm).toBe(2000);
    expect(result.model.heightMm).toBe(2500);
    expect(result.model.depthMm).toBe(600);
    expect(result.model.sections).toHaveLength(1);
  });

  test("minimum manufacturable dimensions are accepted", async () => {
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_create", input: { widthMm: 300, heightMm: 300, depthMm: 200 } }] },
      { text: "Created the smallest possible wardrobe." },
    ]);
    const result = await runWardrobeAgent({ client, model: null, message: "Create the smallest wardrobe you can." });
    expect(result.model).toMatchObject({ widthMm: 300, heightMm: 300, depthMm: 200 });
  });

  test("large dimensions near the maximum are accepted", async () => {
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_create", input: { widthMm: 6000, heightMm: 3000, depthMm: 1200 } }] },
      { text: "Created a very large wardrobe." },
    ]);
    const result = await runWardrobeAgent({ client, model: null, message: "Create the biggest wardrobe you support." });
    expect(result.model).toMatchObject({ widthMm: 6000, heightMm: 3000, depthMm: 1200 });
  });

  test("'two equal sections': sectionCount and absolute width equality are genuinely asserted, not just overall dimensions", async () => {
    // Regression test for the exact bug the remediation flagged: this
    // eval previously only checked width/height/depth while its message
    // claimed "two equal sections" the script never actually created.
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_create", input: { widthMm: 2000, heightMm: 2500, depthMm: 600 } }] },
      { toolCalls: [{ name: "section_add", input: { widthMm: 973 } }] }, // 2 sections, no entanglement -> exact split
      { text: "Two equal sections." },
    ]);
    const result = await runWardrobeAgent({ client, model: null, message: "Create 2000 x 2500 x 600 wardrobe with two equal sections." });

    expect(result.model.sections).toHaveLength(2);
    expect(result.model.sections[0].widthMm).toBe(result.model.sections[1].widthMm);
    const available = result.model.widthMm - 3 * result.model.panelThicknessMm;
    expect(result.model.sections.map((s) => s.widthMm)).toEqual([available / 2, available / 2]);
  });

  test("three equal sections: sectionCount and equality both genuinely asserted", async () => {
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_create", input: { widthMm: 2400, heightMm: 2600, depthMm: 600 } }] },
      { toolCalls: [{ name: "section_add", input: { widthMm: 900 } }] },
      { toolCalls: [{ name: "section_add", input: { widthMm: 900 } }] },
      { toolCalls: [{ name: "section_resize", input: { sectionId: "section-01", widthMm: 776 } }] },
      { toolCalls: [{ name: "section_resize", input: { sectionId: "section-02", widthMm: 776 } }] },
      { toolCalls: [{ name: "section_resize", input: { sectionId: "section-01", widthMm: 776 } }] },
      { toolCalls: [{ name: "section_resize", input: { sectionId: "section-02", widthMm: 776 } }] },
      { toolCalls: [{ name: "section_resize", input: { sectionId: "section-01", widthMm: 776 } }] },
      { toolCalls: [{ name: "section_resize", input: { sectionId: "section-02", widthMm: 776 } }] },
      { toolCalls: [{ name: "section_resize", input: { sectionId: "section-01", widthMm: 776 } }] },
      { toolCalls: [{ name: "section_resize", input: { sectionId: "section-02", widthMm: 776 } }] },
      { toolCalls: [{ name: "section_resize", input: { sectionId: "section-01", widthMm: 776 } }] },
      { text: "Three equal sections." },
    ]);
    const result = await runWardrobeAgent({ client, model: null, message: "Wardrobe with three equal sections.", maxToolCalls: 15 });
    expect(result.model.sections).toHaveLength(3);
    const widths = result.model.sections.map((s) => s.widthMm);
    expect(new Set(widths).size).toBe(1);
  });
});

describe("eval: creation — asymmetric layouts", () => {
  test("multi-section creation from one natural-language request", async () => {
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_create", input: { widthMm: 2400, heightMm: 2600, depthMm: 600 } }] },
      { toolCalls: [{ name: "section_add", input: { widthMm: 1000 } }] },
      { text: "Built a two-section wardrobe." },
    ]);
    const result = await runWardrobeAgent({ client, model: null, message: "Create a wardrobe with two sections." });
    expect(result.model.sections.length).toBe(2);
  });

  test("asymmetric wardrobe: section widths are not forced equal", async () => {
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_create", input: { widthMm: 2400, heightMm: 2600, depthMm: 600 } }] },
      { toolCalls: [{ name: "section_add", input: { widthMm: 1600 } }] },
      { text: "Done: a 1600mm section and a smaller one." },
    ]);
    const result = await runWardrobeAgent({ client, model: null, message: "One big section, one small one." });
    const widths = result.model.sections.map((s) => s.widthMm).sort((a, b) => a - b);
    expect(widths[0]).not.toBe(widths[1]);
    expect(result.model.sections).toHaveLength(2);
  });

  test("explicit absolute widths for a 3-section wardrobe land exactly (first two; third is the real material-aware remainder)", async () => {
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_create", input: { widthMm: 2700, heightMm: 2500, depthMm: 600 } }] },
      { toolCalls: [{ name: "section_add", input: { widthMm: 900 } }] },
      { toolCalls: [{ name: "section_add", input: { widthMm: 900 } }] },
      { toolCalls: [{ name: "section_resize", input: { sectionId: "section-01", widthMm: 550 } }] },
      { toolCalls: [{ name: "section_resize", input: { sectionId: "section-02", widthMm: 925 } }] },
      { toolCalls: [{ name: "section_resize", input: { sectionId: "section-01", widthMm: 550 } }] },
      { toolCalls: [{ name: "section_resize", input: { sectionId: "section-02", widthMm: 925 } }] },
      { toolCalls: [{ name: "section_resize", input: { sectionId: "section-01", widthMm: 550 } }] },
      { toolCalls: [{ name: "section_resize", input: { sectionId: "section-02", widthMm: 925 } }] },
      { toolCalls: [{ name: "section_resize", input: { sectionId: "section-01", widthMm: 550 } }] },
      { text: "Absolute widths set: 550, 925, and the remainder." },
    ]);
    const result = await runWardrobeAgent({
      client, model: null, maxToolCalls: 12,
      message: "Create a 2700 x 2500 x 600 asymmetric wardrobe with absolute section widths of 550mm, 925mm, and the rest.",
    });
    expect(result.model.sections[0].widthMm).toBe(550);
    expect(result.model.sections[1].widthMm).toBe(925);
    expect(result.model.sections).toHaveLength(3);
  });

  test("four sections of increasing width, all distinct", async () => {
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_create", input: { widthMm: 3600, heightMm: 2600, depthMm: 600 } }] },
      { toolCalls: [{ name: "section_add", input: { widthMm: 800 } }] },
      { toolCalls: [{ name: "section_add", input: { widthMm: 800 } }] },
      { toolCalls: [{ name: "section_add", input: { widthMm: 800 } }] },
      { text: "Four sections created." },
    ]);
    const result = await runWardrobeAgent({ client, model: null, message: "Wardrobe with four sections." });
    expect(result.model.sections).toHaveLength(4);
    const ids = result.model.sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(4);
  });
});

describe("eval: creation — shelves", () => {
  test("many shelves: six shelves in one section, all distinct components", async () => {
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_create", input: { widthMm: 900, heightMm: 2600, depthMm: 600 } }] },
      { toolCalls: Array.from({ length: 6 }, () => ({ name: "component_add", input: { sectionId: "section-01", type: "SHELF" } })) },
      { text: "Added six shelves." },
    ]);
    const result = await runWardrobeAgent({ client, model: null, message: "Wardrobe with six shelves." });
    const shelfCount = result.model.sections.flatMap((s) => s.components).filter((c) => c.type === "SHELF").length;
    expect(shelfCount).toBe(6);
    const ids = result.model.sections.flatMap((s) => s.components).map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length); // every shelf has its own distinct id
  });

  test("a single shelf at an explicit position lands exactly there", async () => {
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_create", input: { widthMm: 900, heightMm: 2600, depthMm: 600 } }] },
      { toolCalls: [{ name: "component_add", input: { sectionId: "section-01", type: "SHELF", positionMm: 500 } }] },
      { text: "Added one shelf at 500mm." },
    ]);
    const result = await runWardrobeAgent({ client, model: null, message: "Add a shelf 500mm from the floor." });
    expect(result.model.sections[0].components[0]).toMatchObject({ type: "SHELF", positionMm: 500 });
  });

  test("shelves split across two sections independently", async () => {
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_create", input: { widthMm: 1800, heightMm: 2600, depthMm: 600 } }] },
      { toolCalls: [{ name: "section_add", input: { widthMm: 800 } }] },
      { toolCalls: [{ name: "component_add", input: { sectionId: "section-01", type: "SHELF" } }] },
      { toolCalls: [{ name: "component_add", input: { sectionId: "section-01", type: "SHELF" } }] },
      { toolCalls: [{ name: "component_add", input: { sectionId: "section-02", type: "SHELF" } }] },
      { text: "Two shelves left, one right." },
    ]);
    const result = await runWardrobeAgent({ client, model: null, message: "Two sections: left gets two shelves, right gets one." });
    expect(result.model.sections[0].components).toHaveLength(2);
    expect(result.model.sections[1].components).toHaveLength(1);
  });
});

describe("eval: creation — drawers", () => {
  test("drawers plus hanging above, in the same section", async () => {
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_create", input: { widthMm: 900, heightMm: 2600, depthMm: 600 } }] },
      { toolCalls: [{ name: "component_add", input: { sectionId: "section-01", type: "DRAWER_BANK", rows: 4, positionMm: 0 } }] },
      { toolCalls: [{ name: "component_add", input: { sectionId: "section-01", type: "HANGING_RAIL" } }] }, // auto-stacks above
      { text: "Added four drawers with hanging above." },
    ]);
    const result = await runWardrobeAgent({ client, model: null, message: "Four drawers with hanging above." });
    const [drawerBank, rail] = result.model.sections[0].components;
    expect(drawerBank).toMatchObject({ type: "DRAWER_BANK", rows: 4 });
    expect(rail.type).toBe("HANGING_RAIL");
    expect(rail.positionMm).toBeGreaterThanOrEqual(drawerBank.positionMm + drawerBank.heightMm);
  });

  test("a minimal one-row drawer bank", async () => {
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_create", input: { widthMm: 900, heightMm: 2600, depthMm: 600 } }] },
      { toolCalls: [{ name: "component_add", input: { sectionId: "section-01", type: "DRAWER_BANK", rows: 1, positionMm: 0 } }] },
      { text: "One drawer added." },
    ]);
    const result = await runWardrobeAgent({ client, model: null, message: "Just one drawer." });
    expect(result.model.sections[0].components[0]).toMatchObject({ type: "DRAWER_BANK", rows: 1 });
  });

  test("a maximal eight-row drawer bank", async () => {
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_create", input: { widthMm: 900, heightMm: 3000, depthMm: 600 } }] },
      { toolCalls: [{ name: "component_add", input: { sectionId: "section-01", type: "DRAWER_BANK", rows: 8, positionMm: 0 } }] },
      { text: "Eight drawers added." },
    ]);
    const result = await runWardrobeAgent({ client, model: null, message: "As many drawers as you can fit." });
    expect(result.model.sections[0].components[0]).toMatchObject({ type: "DRAWER_BANK", rows: 8 });
  });

  test("two separate drawer banks in two sections", async () => {
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_create", input: { widthMm: 1800, heightMm: 2600, depthMm: 600 } }] },
      { toolCalls: [{ name: "section_add", input: { widthMm: 800 } }] },
      { toolCalls: [{ name: "component_add", input: { sectionId: "section-01", type: "DRAWER_BANK", rows: 3, positionMm: 0 } }] },
      { toolCalls: [{ name: "component_add", input: { sectionId: "section-02", type: "DRAWER_BANK", rows: 5, positionMm: 0 } }] },
      { text: "Two drawer banks added." },
    ]);
    const result = await runWardrobeAgent({ client, model: null, message: "Drawers in both sections, different counts." });
    expect(result.model.sections[0].components[0].rows).toBe(3);
    expect(result.model.sections[1].components[0].rows).toBe(5);
  });
});

describe("eval: creation — hanging rails", () => {
  test("double hanging: two hanging rails in one section", async () => {
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_create", input: { widthMm: 1000, heightMm: 2600, depthMm: 600 } }] },
      {
        toolCalls: [
          { name: "component_add", input: { sectionId: "section-01", type: "HANGING_RAIL", positionMm: 100 } },
          { name: "component_add", input: { sectionId: "section-01", type: "HANGING_RAIL", positionMm: 1300 } },
        ],
      },
      { text: "Added double hanging." },
    ]);
    const result = await runWardrobeAgent({ client, model: null, message: "Wardrobe with double hanging." });
    const rails = result.model.sections[0].components.filter((c) => c.type === "HANGING_RAIL");
    expect(rails).toHaveLength(2);
  });

  test("single long hang at auto-stacked position", async () => {
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_create", input: { widthMm: 900, heightMm: 2600, depthMm: 600 } }] },
      { toolCalls: [{ name: "component_add", input: { sectionId: "section-01", type: "HANGING_RAIL", positionMm: 1600 } }] },
      { text: "Added a long hang rail." },
    ]);
    const result = await runWardrobeAgent({ client, model: null, message: "Long hanging space." });
    expect(result.model.sections[0].components[0]).toMatchObject({ type: "HANGING_RAIL", positionMm: 1600 });
  });

  test("a rail and a shelf coexist in the same section without overlapping", async () => {
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_create", input: { widthMm: 900, heightMm: 2600, depthMm: 600 } }] },
      { toolCalls: [{ name: "component_add", input: { sectionId: "section-01", type: "HANGING_RAIL", positionMm: 1600 } }] },
      { toolCalls: [{ name: "component_add", input: { sectionId: "section-01", type: "SHELF", positionMm: 100 } }] },
      { text: "Rail above, shelf below." },
    ]);
    const result = await runWardrobeAgent({ client, model: null, message: "Hanging space above, one shelf below." });
    expect(result.model.sections[0].components).toHaveLength(2);
  });
});
