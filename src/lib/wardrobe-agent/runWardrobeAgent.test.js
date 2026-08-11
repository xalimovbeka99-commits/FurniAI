import { describe, expect, test } from "vitest";
import { runWardrobeAgent } from "./runWardrobeAgent.js";
import { createFakeWardrobeAgentProvider } from "./fakeWardrobeAgentProvider.js";

describe("runWardrobeAgent — tool-calling loop", () => {
  test("a single tool call followed by final text ends the loop and returns the new model", async () => {
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_create", input: { widthMm: 2400, heightMm: 2600, depthMm: 600 } }] },
      { text: "Created a 2400x2600x600 wardrobe." },
    ]);
    const result = await runWardrobeAgent({ client, model: null, message: "Create a wardrobe" });

    expect(result.model).toBeTruthy();
    expect(result.model.widthMm).toBe(2400);
    expect(result.assistantMessage).toBe("Created a 2400x2600x600 wardrobe.");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].result.success).toBe(true);
  });

  test("multiple tool_use blocks in a single response all execute in order against the running model", async () => {
    const before = {
      id: "wardrobe-01", revision: 1, widthMm: 2400, heightMm: 2600, depthMm: 600, panelThicknessMm: 18,
      sections: [{ id: "section-01", widthMm: 2364, components: [] }], idCounters: { wardrobe: 1, section: 1 },
    };
    const client = createFakeWardrobeAgentProvider([
      {
        toolCalls: [
          { name: "component_add", input: { sectionId: "section-01", type: "SHELF", positionMm: 0 } },
          { name: "component_add", input: { sectionId: "section-01", type: "SHELF", positionMm: 300 } },
        ],
      },
      { text: "Added two shelves." },
    ]);
    const result = await runWardrobeAgent({ client, model: before, message: "Add two shelves" });

    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls.every((c) => c.result.success)).toBe(true);
    expect(result.model.sections[0].components).toHaveLength(2);
    // the second call's model came from the first call's committed result,
    // not from `before` again — revision advanced by 2, not 1.
    expect(result.model.revision).toBe(before.revision + 2);
  });

  test("multi-turn continuity: the SAME model is mutated across turns, never regenerated from scratch", async () => {
    const createClient = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_create", input: { widthMm: 2400, heightMm: 2600, depthMm: 600 } }] },
      { text: "Created." },
    ]);
    const turn1 = await runWardrobeAgent({ client: createClient, model: null, message: "Create a 2400x2600x600 wardrobe" });
    const wardrobeId = turn1.model.id;
    const sectionId = turn1.model.sections[0].id;

    const resizeClient = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_resize", input: { widthMm: 3000 } }] },
      { text: "Resized." },
    ]);
    const turn2 = await runWardrobeAgent({ client: resizeClient, model: turn1.model, message: "Make it 3000mm wide" });

    expect(turn2.toolCalls[0].result.success).toBe(true);
    expect(turn2.model.id).toBe(wardrobeId); // same wardrobe, not a fresh one
    expect(turn2.model.revision).toBe(turn1.model.revision + 1);
    expect(turn2.model.sections[0].id).toBe(sectionId); // the section persisted across turns too
  });

  test("hallucination trap: an unsupported request is refused, not faked, and the model is unchanged", async () => {
    const client = createFakeWardrobeAgentProvider([
      { text: "A rotating carousel section isn't supported yet — I can add a hanging rail or shelves instead." },
    ]);
    const before = { id: "wardrobe-01", revision: 3, widthMm: 2400, heightMm: 2600, depthMm: 600, panelThicknessMm: 18, sections: [], idCounters: { wardrobe: 1 } };
    const result = await runWardrobeAgent({ client, model: before, message: "Add a rotating carousel section" });

    expect(result.toolCalls).toHaveLength(0);
    expect(result.model).toEqual(before);
    expect(result.assistantMessage.toLowerCase()).toContain("supported");
  });

  test("a failed tool call is reported back to the model as an error and the model does not change", async () => {
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "section_resize", input: { sectionId: "does-not-exist", widthMm: 700 } }] },
      { text: "I couldn't find that section." },
    ]);
    const before = { id: "wardrobe-01", revision: 1, widthMm: 2400, heightMm: 2600, depthMm: 600, panelThicknessMm: 18, sections: [{ id: "section-01", widthMm: 2364, components: [] }], idCounters: { wardrobe: 1, section: 1 } };
    const result = await runWardrobeAgent({ client, model: before, message: "Resize a section that does not exist" });

    expect(result.toolCalls[0].result.success).toBe(false);
    expect(result.model).toEqual(before);
  });

  test("an unknown tool name from the provider is rejected cleanly, never executed as geometry", async () => {
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_paint_directly", input: { color: "red" } }] },
      { text: "That isn't something I can do." },
    ]);
    const result = await runWardrobeAgent({ client, model: null, message: "Paint it red" });
    expect(result.toolCalls[0].result).toMatchObject({ success: false, error: "TOOL_NOT_AVAILABLE" });
  });

  test("the tool-call trace records name, input, and result for every call — full auditability", async () => {
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_create", input: { widthMm: 2400, heightMm: 2600, depthMm: 600 } }] },
      { text: "Created." },
    ]);
    const result = await runWardrobeAgent({ client, model: null, message: "Create a wardrobe" });
    expect(result.toolCalls[0]).toMatchObject({
      name: "wardrobe_create",
      input: { widthMm: 2400, heightMm: 2600, depthMm: 600 },
      result: expect.objectContaining({ success: true }),
    });
  });

  test("a runaway tool-call script is bounded by maxToolCalls, never loops forever", async () => {
    const client = createFakeWardrobeAgentProvider(() => ({
      content: [{ type: "tool_use", id: "loop", name: "wardrobe_resize", input: { widthMm: 2400 } }],
    }));
    const before = { id: "wardrobe-01", revision: 1, widthMm: 2400, heightMm: 2600, depthMm: 600, panelThicknessMm: 18, sections: [{ id: "section-01", widthMm: 2364, components: [] }], idCounters: { wardrobe: 1, section: 1 } };
    const result = await runWardrobeAgent({ client, model: before, message: "loop forever", maxToolCalls: 3 });
    expect(result.toolCalls.length).toBe(3);
  });
});
