import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAnthropicProvider } from "./anthropicProvider.js";
import { EXTRACT_TOOL_NAME } from "./extractionSchema.js";

const createMock = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({ messages: { create: createMock } })),
}));

function toolUseResponse(input) {
  return { content: [{ type: "tool_use", name: EXTRACT_TOOL_NAME, id: "tool_1", input }] };
}

describe("createAnthropicProvider", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("throws AI_PROVIDER_ERROR immediately if no API key is configured", () => {
    expect(() => createAnthropicProvider({ apiKey: "" })).toThrow(expect.objectContaining({ code: "AI_PROVIDER_ERROR" }));
  });

  it("returns a normalized extraction on a clean tool_use response", async () => {
    createMock.mockResolvedValueOnce(
      toolUseResponse({ furniture_type: "wardrobe", dimensions: { width_mm: 2400 }, components: [], explicit_fields: ["furniture_type"] })
    );
    const provider = createAnthropicProvider({ apiKey: "test-key" });
    const result = await provider.extractRequirements("a 2400mm wardrobe");
    expect(result.furniture_type).toBe("wardrobe");
    expect(result.dimensions).toEqual({ width_mm: 2400, height_mm: null, depth_mm: null });
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("attempts exactly one repair when the first response has no valid tool_use block, then succeeds", async () => {
    createMock
      .mockResolvedValueOnce({ content: [{ type: "text", text: "sorry, I won't call the tool" }] })
      .mockResolvedValueOnce(toolUseResponse({ furniture_type: "kitchen", dimensions: {}, components: [], explicit_fields: ["furniture_type"] }));

    const provider = createAnthropicProvider({ apiKey: "test-key" });
    const result = await provider.extractRequirements("a kitchen");
    expect(result.furniture_type).toBe("kitchen");
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("fails safely with STRUCTURED_OUTPUT_ERROR when both attempts are malformed — never exposes raw provider output", async () => {
    createMock.mockResolvedValue({ content: [{ type: "text", text: "still no tool call" }] });
    const provider = createAnthropicProvider({ apiKey: "test-key" });
    await expect(provider.extractRequirements("a wardrobe")).rejects.toMatchObject({ code: "STRUCTURED_OUTPUT_ERROR" });
    expect(createMock).toHaveBeenCalledTimes(2); // one call + exactly one bounded repair, never unbounded retries
  });

  it("maps an aborted/timed-out call to AI_PROVIDER_TIMEOUT", async () => {
    createMock.mockImplementation(() => {
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      return Promise.reject(err);
    });
    const provider = createAnthropicProvider({ apiKey: "test-key", timeoutMs: 5 });
    await expect(provider.extractRequirements("a wardrobe")).rejects.toMatchObject({ code: "AI_PROVIDER_TIMEOUT" });
  });

  it("maps a genuinely unrecognized/unclassifiable failure to the NON-retriable AI_PROVIDER_REQUEST_ERROR, not AI_PROVIDER_ERROR — never leaks the raw error", async () => {
    createMock.mockRejectedValue(new Error("connection reset by peer at 10.0.0.5:443"));
    const provider = createAnthropicProvider({ apiKey: "test-key" });
    const rejection = await provider.extractRequirements("a wardrobe").catch((e) => e);
    expect(rejection.code).toBe("AI_PROVIDER_REQUEST_ERROR");
    expect(rejection.message).not.toContain("10.0.0.5");
  });

  it("maps a transient provider-availability failure (HTTP 5xx) to the retriable AI_PROVIDER_ERROR — the router fails over on this", async () => {
    createMock.mockRejectedValue({ status: 503, message: "service unavailable" });
    const provider = createAnthropicProvider({ apiKey: "test-key" });
    const rejection = await provider.extractRequirements("a wardrobe").catch((e) => e);
    expect(rejection.code).toBe("AI_PROVIDER_ERROR");
  });

  it("maps a client-error-style failure (HTTP 400 — a malformed request WE built) to the NON-retriable AI_PROVIDER_REQUEST_ERROR — never silently failed over to the other provider", async () => {
    createMock.mockRejectedValue({ status: 400, message: "invalid request: unknown parameter" });
    const provider = createAnthropicProvider({ apiKey: "test-key" });
    const rejection = await provider.extractRequirements("a wardrobe").catch((e) => e);
    expect(rejection.code).toBe("AI_PROVIDER_REQUEST_ERROR");
  });

  it("sends attachments as image/document content blocks alongside a trailing text block", async () => {
    createMock.mockResolvedValueOnce(toolUseResponse({ furniture_type: "wardrobe", dimensions: {}, components: [], explicit_fields: [] }));
    const provider = createAnthropicProvider({ apiKey: "test-key" });
    await provider.extractRequirements("a wardrobe like this photo", [
      { kind: "image", mediaType: "image/png", data: "iVBORw0KGgo=" },
      { kind: "document", mediaType: "application/pdf", data: "JVBERi0xLjQ=" },
    ]);

    const content = createMock.mock.calls[0][0].messages[0].content;
    expect(content).toEqual([
      { type: "image", source: { type: "base64", media_type: "image/png", data: "iVBORw0KGgo=" } },
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: "JVBERi0xLjQ=" } },
      { type: "text", text: "a wardrobe like this photo" },
    ]);
  });

  it("falls back to a default caption when message is empty but attachments carry the request", async () => {
    createMock.mockResolvedValueOnce(toolUseResponse({ furniture_type: "wardrobe", dimensions: {}, components: [], explicit_fields: [] }));
    const provider = createAnthropicProvider({ apiKey: "test-key" });
    await provider.extractRequirements("", [{ kind: "image", mediaType: "image/jpeg", data: "abc=" }]);

    const content = createMock.mock.calls[0][0].messages[0].content;
    const textBlock = content.find((b) => b.type === "text");
    expect(textBlock.text.length).toBeGreaterThan(0);
  });
});
