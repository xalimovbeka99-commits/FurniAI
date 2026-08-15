import { describe, expect, test, vi, beforeEach } from "vitest";
import { runWardrobeAgent } from "@/lib/wardrobe-agent/runWardrobeAgent";
import { buildWardrobeGeometry } from "@/lib/wardrobe-model/buildWardrobeGeometry";
import { validateWardrobeModel } from "@/lib/wardrobe-model/validator";
import { createChatProviderRouter } from "@/lib/ai-provider";

/**
 * Mission Step 11 — the exact real manual acceptance test, run against the
 * REAL production stack: createChatProviderRouter -> the real
 * anthropicChatClient wrapper -> the real @anthropic-ai/sdk constructor and
 * call site -> runWardrobeAgent -> the real eight deterministic tools ->
 * the real kernel/validator -> the real buildWardrobeGeometry adapter.
 *
 * Only the network hop is mocked (at the @anthropic-ai/sdk module
 * boundary, the same technique every other provider test in this repo
 * uses) — this environment has no ANTHROPIC_API_KEY/OPENAI_API_KEY
 * configured, so this is the honest way to exercise "request reaches an AI
 * provider" end-to-end without spending real API credits or requiring a
 * key that isn't available here. See tests/wardrobe-ai/evals/live.eval.test.js
 * for the real-network version, gated behind an actual key.
 *
 * The scripted tool calls below are exactly what a correctly-behaving
 * model should produce for the mission's literal prompt — this proves the
 * MECHANISM (routing, tool execution, model mutation, validation, geometry
 * export) is correct, the same way every other fake-provider eval in this
 * suite does; it does not by itself prove a live model picks these tool
 * calls unprompted (that's what live.eval.test.js is for).
 */
const createMock = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({ messages: { create: createMock } })),
}));

function toolTurn(...toolCalls) {
  return { content: toolCalls.map((c, i) => ({ type: "tool_use", id: `acc_${c.name}_${i}`, name: c.name, input: c.input })) };
}
function textTurn(text) {
  return { content: [{ type: "text", text }] };
}

describe("Step 11 — manual acceptance test (real stack, mocked network boundary)", () => {
  beforeEach(() => {
    createMock.mockReset();
    process.env.ANTHROPIC_API_KEY = "test-key-for-acceptance";
  });

  test("creates a 2400x2600x600 three-section wardrobe (long hanging / drawers+shelves / shelves+hanging), white finish is refused as unsupported — then a follow-up edit mutates the SAME wardrobe", async () => {
    // ---- Turn 1: "Create a 2400 mm wide, 2600 mm high and 600 mm deep
    // wardrobe. Use three sections. Left section: long hanging. Middle
    // section: four drawers with shelves above. Right section: shelves and
    // short hanging. White finish." ----
    createMock
      .mockResolvedValueOnce(toolTurn({ name: "wardrobe_create", input: { widthMm: 2400, heightMm: 2600, depthMm: 600 } }))
      .mockResolvedValueOnce(toolTurn({ name: "section_add", input: { widthMm: 700 } }, { name: "section_add", input: { widthMm: 700 } }))
      .mockResolvedValueOnce(
        toolTurn(
          { name: "component_add", input: { sectionId: "section-01", type: "HANGING_RAIL" } }, // left: long hanging
          { name: "component_add", input: { sectionId: "section-02", type: "DRAWER_BANK", rows: 4 } }, // middle: four drawers
          { name: "component_add", input: { sectionId: "section-02", type: "SHELF" } }, // middle: shelf above
          { name: "component_add", input: { sectionId: "section-03", type: "SHELF" } }, // right: shelves
          { name: "component_add", input: { sectionId: "section-03", type: "HANGING_RAIL" } } // right: (short) hanging
        )
      )
      .mockResolvedValueOnce(
        textTurn(
          "Created your 2400x2600x600mm wardrobe with three sections: a long hanging rail on the left, four drawers with a shelf above in the middle, and a shelf with a hanging rail on the right. Material/finish (white) isn't something I can set yet — that's not supported by the current tools."
        )
      );

    const router1 = createChatProviderRouter();
    const { result: turn1 } = await router1.run((client) =>
      runWardrobeAgent({
        client,
        model: null,
        message:
          "Create a 2400 mm wide, 2600 mm high and 600 mm deep wardrobe. Use three sections. Left section: long hanging. Middle section: four drawers with shelves above. Right section: shelves and short hanging. White finish.",
      })
    );

    // 1. Request reached an AI provider: the real Anthropic SDK constructor
    //    and .messages.create() were actually invoked by the real stack.
    expect(createMock).toHaveBeenCalled();

    // 2. The AI chose valid FurniAI wardrobe tools (not raw geometry/coordinates).
    const calledToolNames = turn1.toolCalls.map((c) => c.name);
    expect(calledToolNames).toEqual(
      expect.arrayContaining(["wardrobe_create", "section_add", "component_add"])
    );
    expect(turn1.toolCalls.every((c) => c.result.success)).toBe(true);

    // 3. A deterministic model was created by the real kernel — not invented text.
    expect(turn1.model).toBeTruthy();
    expect(turn1.model.widthMm).toBe(2400);
    expect(turn1.model.heightMm).toBe(2600);
    expect(turn1.model.depthMm).toBe(600);
    expect(turn1.model.sections).toHaveLength(3);

    // 4. The model has a revision (every successful tool call bumped it).
    expect(turn1.model.revision).toBeGreaterThan(0);

    // 5. The validator passes (or would report explicit warnings — here: passes cleanly).
    const validation = validateWardrobeModel(turn1.model);
    expect(validation.errors ?? []).toEqual([]);

    // 6. The 3D viewer receives the model: the real adapter produces real,
    //    traceable geometry parts for it — every section's structural
    //    panels plus every added component.
    const parts = buildWardrobeGeometry(turn1.model);
    expect(parts.length).toBeGreaterThan(0);
    expect(parts.every((p) => p.id && p.size && p.position)).toBe(true);
    // the model's own components (rail/drawer-bank/shelves) are traceable in the exported parts
    const partIds = parts.map((p) => p.id);
    for (const section of turn1.model.sections) {
      for (const component of section.components) {
        expect(partIds.some((id) => id === component.id || id.startsWith(`${component.id}-`))).toBe(true);
      }
    }

    // White finish was explicitly refused, not silently ignored or faked as a tool call.
    expect(turn1.assistantMessage.toLowerCase()).toMatch(/not.*support|isn't something i can set/);

    const wardrobeId = turn1.model.id;
    const middleSectionId = "section-02";
    const drawerBankId = turn1.toolCalls.find((c) => c.name === "component_add" && c.input.type === "DRAWER_BANK").result.componentId;

    // ---- Turn 2: "Change the middle section from four drawers to three
    // and add one shelf." ----
    createMock
      .mockResolvedValueOnce(
        toolTurn(
          { name: "component_update", input: { componentId: drawerBankId, properties: { rows: 3 } } },
          { name: "component_add", input: { sectionId: middleSectionId, type: "SHELF" } }
        )
      )
      .mockResolvedValueOnce(textTurn("Changed the middle section to three drawers and added another shelf."));

    const router2 = createChatProviderRouter();
    const { result: turn2 } = await router2.run((client) =>
      runWardrobeAgent({
        client,
        model: turn1.model,
        conversation: turn1.conversation,
        message: "Change the middle section from four drawers to three and add one shelf.",
      })
    );

    // EDITS the same wardrobe — does not recreate unrelated furniture.
    expect(turn2.model.id).toBe(wardrobeId);
    expect(turn2.model.sections).toHaveLength(3); // still the same three sections, not regenerated
    expect(turn2.model.revision).toBeGreaterThan(turn1.model.revision);

    const updatedDrawerBank = turn2.model.sections
      .flatMap((s) => s.components)
      .find((c) => c.id === drawerBankId);
    expect(updatedDrawerBank.rows).toBe(3);

    const middleShelves = turn2.model.sections.find((s) => s.id === middleSectionId).components.filter((c) => c.type === "SHELF");
    expect(middleShelves).toHaveLength(2); // the one from turn 1 plus the new one

    // The left and right sections are completely untouched by the middle-section edit.
    expect(turn2.model.sections[0]).toEqual(turn1.model.sections[0]);
    expect(turn2.model.sections[2]).toEqual(turn1.model.sections[2]);

    // The edited model still validates and still exports real geometry.
    expect((validateWardrobeModel(turn2.model).errors ?? [])).toEqual([]);
    expect(buildWardrobeGeometry(turn2.model).length).toBeGreaterThan(0);
  });
});
