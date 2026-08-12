import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAnthropicChatClient } from "./anthropicChatClient.js";

const createMock = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({ messages: { create: createMock } })),
}));

describe("createAnthropicChatClient", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("throws MISSING_API_KEY immediately if no key is configured", () => {
    expect(() => createAnthropicChatClient({ apiKey: "" })).toThrow(expect.objectContaining({ code: "MISSING_API_KEY" }));
  });

  it("is a pure passthrough to the real Anthropic SDK — same shape in, same shape out, no translation", async () => {
    createMock.mockResolvedValueOnce({ content: [{ type: "text", text: "hi" }] });
    const client = createAnthropicChatClient({ apiKey: "k" });
    const params = { max_tokens: 10, system: "s", messages: [{ role: "user", content: "hello" }] };
    const resp = await client.messages.create(params);
    expect(resp).toEqual({ content: [{ type: "text", text: "hi" }] });
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ max_tokens: 10, system: "s" }), undefined);
  });

  it("honors an explicit model on the call params over the client's configured default", async () => {
    createMock.mockResolvedValueOnce({ content: [] });
    const client = createAnthropicChatClient({ apiKey: "k", model: "claude-opus-4-8" });
    await client.messages.create({ model: "claude-sonnet-4-6", max_tokens: 10, messages: [] });
    expect(createMock.mock.calls[0][0].model).toBe("claude-sonnet-4-6");
  });

  it("falls back to the client's configured model when the call omits one", async () => {
    createMock.mockResolvedValueOnce({ content: [] });
    const client = createAnthropicChatClient({ apiKey: "k", model: "claude-opus-4-8" });
    await client.messages.create({ max_tokens: 10, messages: [] });
    expect(createMock.mock.calls[0][0].model).toBe("claude-opus-4-8");
  });

  it("does NOT catch/reclassify errors — leaves AbortError raw so runWardrobeAgent's own timeout handling still works", async () => {
    const abortErr = Object.assign(new Error("aborted"), { name: "AbortError" });
    createMock.mockRejectedValueOnce(abortErr);
    const client = createAnthropicChatClient({ apiKey: "k" });
    const rejection = await client.messages.create({ max_tokens: 10, messages: [] }).catch((e) => e);
    expect(rejection).toBe(abortErr); // identity preserved — not wrapped into a ProviderError
    expect(rejection.name).toBe("AbortError");
  });
});
