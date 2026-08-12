import { describe, it, expect, vi, beforeEach } from "vitest";
import { createOpenAIChatClient } from "./openaiChatAdapter.js";
import { runWardrobeAgent } from "../wardrobe-agent/runWardrobeAgent.js";

const createMock = vi.fn();
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({ chat: { completions: { create: createMock } } })),
}));

function openAiToolCall(id, name, input) {
  return { id, type: "function", function: { name, arguments: JSON.stringify(input) } };
}

describe("createOpenAIChatClient", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("throws MISSING_API_KEY immediately if no key is configured", () => {
    expect(() => createOpenAIChatClient({ apiKey: "" })).toThrow(expect.objectContaining({ code: "MISSING_API_KEY" }));
  });

  it("translates system + tools + a plain user message into OpenAI's request shape", async () => {
    createMock.mockResolvedValueOnce({ choices: [{ message: { content: "hi", tool_calls: [] } }] });
    const client = createOpenAIChatClient({ apiKey: "k" });
    await client.messages.create({
      model: "claude-sonnet-4-6", // must be ignored — this client always uses its own configured model
      max_tokens: 500,
      system: "You are the Wardrobe AI.",
      tools: [{ name: "wardrobe_create", description: "Create a wardrobe.", input_schema: { type: "object", properties: {} } }],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: "Create a wardrobe." }],
    });

    const call = createMock.mock.calls[0][0];
    expect(call.model).not.toBe("claude-sonnet-4-6");
    expect(call.max_completion_tokens).toBe(500);
    expect(call.messages[0]).toEqual({ role: "system", content: "You are the Wardrobe AI." });
    expect(call.messages[1]).toEqual({ role: "user", content: "Create a wardrobe." });
    expect(call.tools).toEqual([{ type: "function", function: { name: "wardrobe_create", description: "Create a wardrobe.", parameters: { type: "object", properties: {} } } }]);
    expect(call.tool_choice).toBe("auto");
  });

  it("translates an OpenAI tool_calls response into FurniAI's normalized tool_use content blocks", async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: null, tool_calls: [openAiToolCall("call_abc", "wardrobe_create", { widthMm: 2400, heightMm: 2600, depthMm: 600 })] } }],
    });
    const client = createOpenAIChatClient({ apiKey: "k" });
    const resp = await client.messages.create({ max_tokens: 500, system: "s", tools: [], messages: [{ role: "user", content: "hi" }] });
    expect(resp).toEqual({ content: [{ type: "tool_use", id: "call_abc", name: "wardrobe_create", input: { widthMm: 2400, heightMm: 2600, depthMm: 600 } }] });
  });

  it("translates a text-only OpenAI response into a normalized text block", async () => {
    createMock.mockResolvedValueOnce({ choices: [{ message: { content: "Created your wardrobe.", tool_calls: [] } }] });
    const client = createOpenAIChatClient({ apiKey: "k" });
    const resp = await client.messages.create({ max_tokens: 500, system: "s", messages: [{ role: "user", content: "hi" }] });
    expect(resp).toEqual({ content: [{ type: "text", text: "Created your wardrobe." }] });
  });

  it("round-trips an assistant tool_use turn + a user tool_result turn into OpenAI's assistant/tool message pair", async () => {
    createMock.mockResolvedValueOnce({ choices: [{ message: { content: "done", tool_calls: [] } }] });
    const client = createOpenAIChatClient({ apiKey: "k" });
    await client.messages.create({
      max_tokens: 500,
      system: "s",
      messages: [
        { role: "user", content: "Create a wardrobe." },
        { role: "assistant", content: [{ type: "tool_use", id: "call_abc", name: "wardrobe_create", input: { widthMm: 2400 } }] },
        { role: "user", content: [{ type: "tool_result", tool_use_id: "call_abc", content: JSON.stringify({ success: true }), is_error: false }] },
      ],
    });

    const call = createMock.mock.calls[0][0];
    const assistantMsg = call.messages.find((m) => m.role === "assistant");
    const toolMsg = call.messages.find((m) => m.role === "tool");
    expect(assistantMsg.tool_calls).toEqual([{ id: "call_abc", type: "function", function: { name: "wardrobe_create", arguments: JSON.stringify({ widthMm: 2400 }) } }]);
    expect(toolMsg).toEqual({ role: "tool", tool_call_id: "call_abc", content: JSON.stringify({ success: true }) });
  });

  it("classifies a raw SDK failure into a provider-neutral ProviderError", async () => {
    createMock.mockRejectedValueOnce({ status: 429, message: "rate limited" });
    const client = createOpenAIChatClient({ apiKey: "k" });
    const rejection = await client.messages.create({ max_tokens: 10, messages: [] }).catch((e) => e);
    expect(rejection.name).toBe("ProviderError");
    expect(rejection.code).toBe("RATE_LIMITED");
    expect(rejection.retriable).toBe(true);
  });
});

describe("runWardrobeAgent driven entirely through the OpenAI adapter", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("creates a wardrobe via the real deterministic tools — same tools, same WardrobeModel as the Anthropic path", async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: null, tool_calls: [openAiToolCall("call_1", "wardrobe_create", { widthMm: 2400, heightMm: 2600, depthMm: 600 })] } }],
    });
    createMock.mockResolvedValueOnce({ choices: [{ message: { content: "Created a 2400x2600x600 wardrobe.", tool_calls: [] } }] });

    const client = createOpenAIChatClient({ apiKey: "k" });
    const result = await runWardrobeAgent({ client, model: null, message: "Create a 2400x2600x600 wardrobe." });

    expect(result.model).toBeTruthy();
    expect(result.model.widthMm).toBe(2400);
    expect(result.model.heightMm).toBe(2600);
    expect(result.model.depthMm).toBe(600);
    expect(result.model.id).toBe("wardrobe-01"); // same kernel-allocated stable ID scheme, unaffected by which provider called the tool
    expect(result.revision).toBe(1);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].result.success).toBe(true);
    expect(result.assistantMessage).toBe("Created a 2400x2600x600 wardrobe.");
  });

  it("a deterministic tool rejection (invalid dimension) is reported back to the model as a tool_result, not thrown — same behavior as the Anthropic path", async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: null, tool_calls: [openAiToolCall("call_1", "wardrobe_create", { widthMm: 2400.5, heightMm: 2600, depthMm: 600 })] } }],
    });
    createMock.mockResolvedValueOnce({ choices: [{ message: { content: "I need a whole millimetre value.", tool_calls: [] } }] });

    const client = createOpenAIChatClient({ apiKey: "k" });
    const result = await runWardrobeAgent({ client, model: null, message: "Create a 2400.5mm wide wardrobe." });

    expect(result.model).toBeNull(); // nothing committed
    expect(result.toolCalls[0].result.success).toBe(false);
    expect(result.toolCalls[0].result.error).toBe("INVALID_DIMENSION");
  });
});
