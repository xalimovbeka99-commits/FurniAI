import { describe, it, expect, vi, beforeEach } from "vitest";
import { createOpenAIProvider } from "./openaiProvider.js";
import { EXTRACT_TOOL_NAME } from "./extractionSchema.js";

const createMock = vi.fn();
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({ chat: { completions: { create: createMock } } })),
}));

function toolCallResponse(input) {
  return {
    choices: [
      {
        message: {
          content: null,
          tool_calls: [{ id: "call_1", type: "function", function: { name: EXTRACT_TOOL_NAME, arguments: JSON.stringify(input) } }],
        },
      },
    ],
  };
}

function textOnlyResponse(text) {
  return { choices: [{ message: { content: text, tool_calls: [] } }] };
}

describe("createOpenAIProvider", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("throws AI_PROVIDER_ERROR immediately if no API key is configured", () => {
    expect(() => createOpenAIProvider({ apiKey: "" })).toThrow(expect.objectContaining({ code: "AI_PROVIDER_ERROR" }));
  });

  it("returns a normalized extraction identical in shape to the Anthropic provider's output", async () => {
    createMock.mockResolvedValueOnce(
      toolCallResponse({ furniture_type: "wardrobe", dimensions: { width_mm: 2400 }, components: [], explicit_fields: ["furniture_type"] })
    );
    const provider = createOpenAIProvider({ apiKey: "test-key" });
    const result = await provider.extractRequirements("a 2400mm wardrobe");
    expect(result.furniture_type).toBe("wardrobe");
    expect(result.dimensions).toEqual({ width_mm: 2400, height_mm: null, depth_mm: null });
    expect(result.components).toEqual([]);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("attempts exactly one repair when the first response has no valid tool call, then succeeds", async () => {
    createMock.mockResolvedValueOnce(textOnlyResponse("sorry, I won't call the tool")).mockResolvedValueOnce(
      toolCallResponse({ furniture_type: "kitchen", dimensions: {}, components: [], explicit_fields: ["furniture_type"] })
    );

    const provider = createOpenAIProvider({ apiKey: "test-key" });
    const result = await provider.extractRequirements("a kitchen");
    expect(result.furniture_type).toBe("kitchen");
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("fails safely with STRUCTURED_OUTPUT_ERROR when both attempts are malformed — never exposes raw provider output", async () => {
    createMock.mockResolvedValue(textOnlyResponse("still no tool call"));
    const provider = createOpenAIProvider({ apiKey: "test-key" });
    await expect(provider.extractRequirements("a wardrobe")).rejects.toMatchObject({ code: "STRUCTURED_OUTPUT_ERROR" });
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("treats malformed tool-call JSON the same as a missing tool call (triggers the bounded repair, then fails safely)", async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: EXTRACT_TOOL_NAME, arguments: "{not valid json" } }] } }],
    });
    const provider = createOpenAIProvider({ apiKey: "test-key" });
    await expect(provider.extractRequirements("a wardrobe")).rejects.toMatchObject({ code: "STRUCTURED_OUTPUT_ERROR" });
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("maps an aborted/timed-out call to AI_PROVIDER_TIMEOUT", async () => {
    createMock.mockImplementation(() => {
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      return Promise.reject(err);
    });
    const provider = createOpenAIProvider({ apiKey: "test-key", timeoutMs: 5 });
    await expect(provider.extractRequirements("a wardrobe")).rejects.toMatchObject({ code: "AI_PROVIDER_TIMEOUT" });
  });

  it("maps any other provider failure to a generic AI_PROVIDER_ERROR without leaking the raw error", async () => {
    createMock.mockRejectedValue(new Error("connection reset by peer at 10.0.0.5:443"));
    const provider = createOpenAIProvider({ apiKey: "test-key" });
    const rejection = await provider.extractRequirements("a wardrobe").catch((e) => e);
    expect(rejection.code).toBe("AI_PROVIDER_ERROR");
    expect(rejection.message).not.toContain("10.0.0.5");
  });

  it("maps a 429 rate-limit response to AI_PROVIDER_ERROR (a retriable provider-level failure the router can fail over on)", async () => {
    createMock.mockRejectedValue({ status: 429, message: "rate limited" });
    const provider = createOpenAIProvider({ apiKey: "test-key" });
    await expect(provider.extractRequirements("a wardrobe")).rejects.toMatchObject({ code: "AI_PROVIDER_ERROR" });
  });

  it("sends image attachments as image_url data URIs alongside a trailing text block", async () => {
    createMock.mockResolvedValueOnce(toolCallResponse({ furniture_type: "wardrobe", dimensions: {}, components: [], explicit_fields: [] }));
    const provider = createOpenAIProvider({ apiKey: "test-key" });
    await provider.extractRequirements("a wardrobe like this photo", [{ kind: "image", mediaType: "image/png", data: "iVBORw0KGgo=" }]);

    const content = createMock.mock.calls[0][0].messages.at(-1).content;
    expect(content).toEqual([
      { type: "image_url", image_url: { url: "data:image/png;base64,iVBORw0KGgo=" } },
      { type: "text", text: "a wardrobe like this photo" },
    ]);
  });

  it("describes a PDF attachment as a text note instead of silently dropping it (documented gap vs. Anthropic's native PDF support)", async () => {
    createMock.mockResolvedValueOnce(toolCallResponse({ furniture_type: "wardrobe", dimensions: {}, components: [], explicit_fields: [] }));
    const provider = createOpenAIProvider({ apiKey: "test-key" });
    await provider.extractRequirements("a wardrobe from this spec sheet", [{ kind: "document", mediaType: "application/pdf", data: "JVBERi0xLjQ=" }]);

    const content = createMock.mock.calls[0][0].messages.at(-1).content;
    expect(content[0].type).toBe("text");
    expect(content[0].text).toMatch(/pdf/i);
  });

  it("falls back to a default caption when message is empty but attachments carry the request", async () => {
    createMock.mockResolvedValueOnce(toolCallResponse({ furniture_type: "wardrobe", dimensions: {}, components: [], explicit_fields: [] }));
    const provider = createOpenAIProvider({ apiKey: "test-key" });
    await provider.extractRequirements("", [{ kind: "image", mediaType: "image/jpeg", data: "abc=" }]);

    const content = createMock.mock.calls[0][0].messages.at(-1).content;
    const textBlock = content.find((b) => b.type === "text");
    expect(textBlock.text.length).toBeGreaterThan(0);
  });

  it("forces the extraction tool via tool_choice, same as the Anthropic provider forces tool_choice", async () => {
    createMock.mockResolvedValueOnce(toolCallResponse({ furniture_type: "wardrobe", dimensions: {}, components: [], explicit_fields: [] }));
    const provider = createOpenAIProvider({ apiKey: "test-key" });
    await provider.extractRequirements("a wardrobe");
    const call = createMock.mock.calls[0][0];
    expect(call.tool_choice).toEqual({ type: "function", function: { name: EXTRACT_TOOL_NAME } });
    expect(call.tools[0].function.name).toBe(EXTRACT_TOOL_NAME);
  });
});
