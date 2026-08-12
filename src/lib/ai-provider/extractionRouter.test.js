import { describe, it, expect, vi, beforeEach } from "vitest";
import { createExtractionAiProvider } from "./extractionRouter.js";
import { EXTRACT_TOOL_NAME } from "./extractionSchema.js";

const anthropicCreateMock = vi.fn();
const openaiCreateMock = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({ messages: { create: anthropicCreateMock } })),
}));
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({ chat: { completions: { create: openaiCreateMock } } })),
}));

function anthropicToolResponse(input) {
  return { content: [{ type: "tool_use", name: EXTRACT_TOOL_NAME, id: "t1", input }] };
}
function openaiToolResponse(input) {
  return { choices: [{ message: { content: null, tool_calls: [{ id: "c1", type: "function", function: { name: EXTRACT_TOOL_NAME, arguments: JSON.stringify(input) } }] } }] };
}

describe("createExtractionAiProvider (FSL extraction, provider-independent)", () => {
  beforeEach(() => {
    anthropicCreateMock.mockReset();
    openaiCreateMock.mockReset();
  });

  it("Anthropic available and healthy: extracts via Anthropic, OpenAI is never called", async () => {
    anthropicCreateMock.mockResolvedValueOnce(anthropicToolResponse({ furniture_type: "wardrobe", dimensions: {}, components: [], explicit_fields: [] }));
    const provider = createExtractionAiProvider({ order: ["anthropic", "openai"], anthropicApiKey: "a-key", openaiApiKey: "o-key" });

    const result = await provider.extractRequirements("a wardrobe");
    expect(result.furniture_type).toBe("wardrobe");
    expect(anthropicCreateMock).toHaveBeenCalledTimes(1);
    expect(openaiCreateMock).not.toHaveBeenCalled();
  });

  it("Anthropic fails with a retriable provider error (missing/invalid key style failure): fails over to OpenAI, which succeeds", async () => {
    anthropicCreateMock.mockRejectedValue({ status: 401, message: "invalid api key" });
    openaiCreateMock.mockResolvedValueOnce(openaiToolResponse({ furniture_type: "kitchen", dimensions: {}, components: [], explicit_fields: [] }));
    const provider = createExtractionAiProvider({ order: ["anthropic", "openai"], anthropicApiKey: "a-key", openaiApiKey: "o-key" });

    const result = await provider.extractRequirements("a kitchen");
    expect(result.furniture_type).toBe("kitchen");
  });

  it("OpenAI listed first: extracts via OpenAI, Anthropic is never called", async () => {
    openaiCreateMock.mockResolvedValueOnce(openaiToolResponse({ furniture_type: "sideboard", dimensions: {}, components: [], explicit_fields: [] }));
    const provider = createExtractionAiProvider({ order: ["openai", "anthropic"], anthropicApiKey: "a-key", openaiApiKey: "o-key" });

    const result = await provider.extractRequirements("a sideboard");
    expect(result.furniture_type).toBe("sideboard");
    expect(anthropicCreateMock).not.toHaveBeenCalled();
  });

  it("only one provider configured (the other has no key at all): still operates correctly", async () => {
    anthropicCreateMock.mockResolvedValueOnce(anthropicToolResponse({ furniture_type: "bookcase", dimensions: {}, components: [], explicit_fields: [] }));
    const provider = createExtractionAiProvider({ order: ["anthropic", "openai"], anthropicApiKey: "a-key", openaiApiKey: undefined });

    const result = await provider.extractRequirements("a bookcase");
    expect(result.furniture_type).toBe("bookcase");
    expect(openaiCreateMock).not.toHaveBeenCalled();
  });

  it("both unavailable (no keys at all): rejects with AI_PROVIDER_UNAVAILABLE, matching the FSL error contract", async () => {
    const provider = createExtractionAiProvider({ order: ["anthropic", "openai"], anthropicApiKey: undefined, openaiApiKey: undefined });
    await expect(provider.extractRequirements("a wardrobe")).rejects.toMatchObject({ name: "FslError", code: "AI_PROVIDER_UNAVAILABLE" });
    expect(anthropicCreateMock).not.toHaveBeenCalled();
    expect(openaiCreateMock).not.toHaveBeenCalled();
  });

  it("both configured but both time out: rejects with AI_PROVIDER_UNAVAILABLE after trying both", async () => {
    anthropicCreateMock.mockImplementation(() => Promise.reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    openaiCreateMock.mockImplementation(() => Promise.reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    const provider = createExtractionAiProvider({ order: ["anthropic", "openai"], anthropicApiKey: "a-key", openaiApiKey: "o-key", timeoutMs: 5 });

    await expect(provider.extractRequirements("a wardrobe")).rejects.toMatchObject({ code: "AI_PROVIDER_UNAVAILABLE" });
    expect(anthropicCreateMock).toHaveBeenCalledTimes(1);
    expect(openaiCreateMock).toHaveBeenCalledTimes(1);
  });

  it("a genuinely malformed/ambiguous response (STRUCTURED_OUTPUT_ERROR from the FIRST provider) is NOT retried on the second provider", async () => {
    anthropicCreateMock.mockResolvedValue({ content: [{ type: "text", text: "no tool call" }] }); // both repair attempts fail
    const provider = createExtractionAiProvider({ order: ["anthropic", "openai"], anthropicApiKey: "a-key", openaiApiKey: "o-key" });

    await expect(provider.extractRequirements("an ambiguous request")).rejects.toMatchObject({ code: "STRUCTURED_OUTPUT_ERROR" });
    expect(anthropicCreateMock).toHaveBeenCalledTimes(2); // Anthropic's own one bounded repair attempt
    expect(openaiCreateMock).not.toHaveBeenCalled(); // never escalated to a second provider
  });

  // ---- Codex "PR #4 Required Corrections" — Blocker 1, exact scenario matrix ----
  describe("Blocker 1 exact scenario matrix (router level, not just unit classification)", () => {
    it("HTTP 400 (malformed provider request — an integration defect) does NOT cause fallback to the second provider", async () => {
      anthropicCreateMock.mockRejectedValue({ status: 400, message: "invalid request: unknown parameter" });
      const provider = createExtractionAiProvider({ order: ["anthropic", "openai"], anthropicApiKey: "a-key", openaiApiKey: "o-key" });

      const rejection = await provider.extractRequirements("a wardrobe").catch((e) => e);
      expect(rejection.code).toBe("AI_PROVIDER_REQUEST_ERROR");
      expect(openaiCreateMock).not.toHaveBeenCalled(); // no fallback
    });

    it("an unknown/unrecognized SDK failure does NOT cause fallback to the second provider", async () => {
      anthropicCreateMock.mockRejectedValue(new Error("some error shape neither SDK ever actually throws"));
      const provider = createExtractionAiProvider({ order: ["anthropic", "openai"], anthropicApiKey: "a-key", openaiApiKey: "o-key" });

      const rejection = await provider.extractRequirements("a wardrobe").catch((e) => e);
      expect(rejection.code).toBe("AI_PROVIDER_REQUEST_ERROR");
      expect(openaiCreateMock).not.toHaveBeenCalled(); // no fallback
    });

    it("HTTP 429 (rate limit) DOES cause fallback to the second provider", async () => {
      anthropicCreateMock.mockRejectedValue({ status: 429, message: "rate limited" });
      openaiCreateMock.mockResolvedValueOnce(openaiToolResponse({ furniture_type: "wardrobe", dimensions: {}, components: [], explicit_fields: [] }));
      const provider = createExtractionAiProvider({ order: ["anthropic", "openai"], anthropicApiKey: "a-key", openaiApiKey: "o-key" });

      const result = await provider.extractRequirements("a wardrobe");
      expect(result.furniture_type).toBe("wardrobe");
      expect(openaiCreateMock).toHaveBeenCalledTimes(1);
    });

    it("HTTP 500/502/503 (transient provider server error) DOES cause fallback to the second provider", async () => {
      for (const status of [500, 502, 503]) {
        anthropicCreateMock.mockReset();
        openaiCreateMock.mockReset();
        anthropicCreateMock.mockRejectedValue({ status, message: "server error" });
        openaiCreateMock.mockResolvedValueOnce(openaiToolResponse({ furniture_type: "wardrobe", dimensions: {}, components: [], explicit_fields: [] }));
        const provider = createExtractionAiProvider({ order: ["anthropic", "openai"], anthropicApiKey: "a-key", openaiApiKey: "o-key" });

        const result = await provider.extractRequirements("a wardrobe");
        expect(result.furniture_type).toBe("wardrobe");
        expect(openaiCreateMock).toHaveBeenCalledTimes(1);
      }
    });

    it("timeout/network-unavailable DOES cause fallback to the second provider", async () => {
      anthropicCreateMock.mockImplementation(() => Promise.reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      openaiCreateMock.mockResolvedValueOnce(openaiToolResponse({ furniture_type: "wardrobe", dimensions: {}, components: [], explicit_fields: [] }));
      const provider = createExtractionAiProvider({ order: ["anthropic", "openai"], anthropicApiKey: "a-key", openaiApiKey: "o-key", timeoutMs: 5 });

      const result = await provider.extractRequirements("a wardrobe");
      expect(result.furniture_type).toBe("wardrobe");
      expect(openaiCreateMock).toHaveBeenCalledTimes(1);
    });
  });
});
