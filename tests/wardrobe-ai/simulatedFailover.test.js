import { describe, expect, test, vi, beforeEach } from "vitest";
import { runWardrobeAgent } from "@/lib/wardrobe-agent/runWardrobeAgent";
import { createChatProviderRouter } from "@/lib/ai-provider";

/**
 * Mission Step 12 — simulated failover test.
 * ----------------------------------------------------------------------
 *   Anthropic unavailable
 *     |
 *     v
 *   OpenAI selected
 *     |
 *     v
 *   same FurniAI tools work
 *
 * No real credentials are consumed: Anthropic is made "unavailable" two
 * ways (genuinely unconfigured, and configured-but-erroring), OpenAI is a
 * scripted mock at the `openai` module boundary — the same mocking
 * technique every provider test in this repo uses — and the assertions
 * prove the SAME deterministic Wardrobe tools produced the SAME kind of
 * WardrobeModel that the Anthropic-served manual acceptance test does.
 */
const anthropicCreateMock = vi.fn();
const openaiCreateMock = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({ messages: { create: anthropicCreateMock } })),
}));
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({ chat: { completions: { create: openaiCreateMock } } })),
}));

function openAiToolTurn(name, input, id = "call_1") {
  return { choices: [{ message: { content: null, tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(input) } }] } }] };
}
function openAiTextTurn(text) {
  return { choices: [{ message: { content: text, tool_calls: [] } }] };
}

describe("Step 12 — simulated failover: Anthropic unavailable -> OpenAI selected -> same tools work", () => {
  beforeEach(() => {
    anthropicCreateMock.mockReset();
    openaiCreateMock.mockReset();
  });

  test("Anthropic genuinely unconfigured (no key at all): the router selects OpenAI without ever touching the Anthropic SDK", async () => {
    openaiCreateMock
      .mockResolvedValueOnce(openAiToolTurn("wardrobe_create", { widthMm: 2400, heightMm: 2600, depthMm: 600 }))
      .mockResolvedValueOnce(openAiTextTurn("Created your wardrobe."));

    const router = createChatProviderRouter({ order: ["anthropic", "openai"], anthropicApiKey: undefined, openaiApiKey: "sk-openai-test" });
    const { result, provider, attempted } = await router.run((client) => runWardrobeAgent({ client, model: null, message: "Create a 2400x2600x600 wardrobe." }));

    expect(provider).toBe("openai");
    expect(attempted[0]).toEqual({ provider: "anthropic", outcome: "skipped_unconfigured" });
    expect(anthropicCreateMock).not.toHaveBeenCalled();

    // Same deterministic tools, same kind of WardrobeModel as the
    // Anthropic-served path in manualAcceptance.test.js.
    expect(result.model.widthMm).toBe(2400);
    expect(result.model.heightMm).toBe(2600);
    expect(result.model.depthMm).toBe(600);
    expect(result.model.id).toBe("wardrobe-01");
    expect(result.revision).toBe(1);
    expect(result.toolCalls[0].result.success).toBe(true);
  });

  test("Anthropic configured but failing (simulated outage — HTTP 500): fails over to OpenAI mid-request, which completes the SAME wardrobe creation", async () => {
    anthropicCreateMock.mockRejectedValueOnce({ status: 500, message: "Anthropic is down for this simulated test" });
    openaiCreateMock
      .mockResolvedValueOnce(openAiToolTurn("wardrobe_create", { widthMm: 900, heightMm: 2400, depthMm: 580 }))
      .mockResolvedValueOnce(openAiTextTurn("Created your wardrobe using the backup provider."));

    const router = createChatProviderRouter({ order: ["anthropic", "openai"], anthropicApiKey: "sk-ant-configured-but-down", openaiApiKey: "sk-openai-test" });
    const { result, provider, attempted } = await router.run((client) => runWardrobeAgent({ client, model: null, message: "Create a 900x2400x580 wardrobe." }));

    expect(provider).toBe("openai");
    expect(attempted).toEqual([
      { provider: "anthropic", outcome: "failed_retriable", errorCode: "SERVER_ERROR", latencyMs: expect.any(Number) },
      { provider: "openai", outcome: "success", latencyMs: expect.any(Number) },
    ]);
    expect(anthropicCreateMock).toHaveBeenCalledTimes(1);

    expect(result.model.widthMm).toBe(900);
    expect(result.model.id).toBe("wardrobe-01"); // the real kernel allocated a fresh, valid, stable id regardless of which provider drove it
    expect(result.toolCalls[0].result.success).toBe(true);
    expect(result.assistantMessage).toContain("backup provider");
  });

  test("a full create-then-edit conversation completes entirely on the fallback provider (OpenAI) after Anthropic fails on the FIRST turn", async () => {
    anthropicCreateMock.mockRejectedValue({ status: 401, message: "invalid api key" }); // Anthropic stays down for both turns in this scenario
    openaiCreateMock
      .mockResolvedValueOnce(openAiToolTurn("wardrobe_create", { widthMm: 1800, heightMm: 2400, depthMm: 600 }))
      .mockResolvedValueOnce(openAiTextTurn("Created a two-part wardrobe."))
      .mockResolvedValueOnce(openAiToolTurn("section_add", { widthMm: 700 }))
      .mockResolvedValueOnce(openAiTextTurn("Added a second section."));

    const router1 = createChatProviderRouter({ order: ["anthropic", "openai"], anthropicApiKey: "sk-ant-down", openaiApiKey: "sk-openai-test" });
    const turn1 = await router1.run((client) => runWardrobeAgent({ client, model: null, message: "Create a 1800x2400x600 wardrobe." }));
    expect(turn1.provider).toBe("openai");

    const router2 = createChatProviderRouter({ order: ["anthropic", "openai"], anthropicApiKey: "sk-ant-down", openaiApiKey: "sk-openai-test" });
    const turn2 = await router2.run((client) =>
      runWardrobeAgent({ client, model: turn1.result.model, conversation: turn1.result.conversation, message: "Add a 700mm section." })
    );

    expect(turn2.provider).toBe("openai");
    expect(turn2.result.model.id).toBe(turn1.result.model.id); // same wardrobe across both turns, both served by the fallback
    expect(turn2.result.model.sections).toHaveLength(2);
  });
});
