import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createChatProviderRouter, shouldExposeProviderDebugInfo } from "./chatRouter.js";
import { AllProvidersUnavailableError } from "./errors.js";

const anthropicCreateMock = vi.fn();
const openaiCreateMock = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({ messages: { create: anthropicCreateMock } })),
}));
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({ chat: { completions: { create: openaiCreateMock } } })),
}));

describe("createChatProviderRouter", () => {
  beforeEach(() => {
    anthropicCreateMock.mockReset();
    openaiCreateMock.mockReset();
  });

  it("Anthropic configured and healthy: runs the operation once against the Anthropic client, OpenAI client never constructed/called", async () => {
    const router = createChatProviderRouter({ order: ["anthropic", "openai"], anthropicApiKey: "a-key", openaiApiKey: "o-key" });
    const operationFn = vi.fn(async (client, providerName) => {
      expect(providerName).toBe("anthropic");
      return client.messages.create({ max_tokens: 10, messages: [{ role: "user", content: "hi" }] });
    });
    anthropicCreateMock.mockResolvedValueOnce({ content: [{ type: "text", text: "ok" }] });

    const { result, provider } = await router.run(operationFn);
    expect(provider).toBe("anthropic");
    expect(result).toEqual({ content: [{ type: "text", text: "ok" }] });
    expect(operationFn).toHaveBeenCalledTimes(1);
    expect(openaiCreateMock).not.toHaveBeenCalled();
  });

  it("Anthropic fails with a retriable provider error mid-operation: retries the WHOLE operation on OpenAI", async () => {
    const router = createChatProviderRouter({ order: ["anthropic", "openai"], anthropicApiKey: "a-key", openaiApiKey: "o-key" });
    let attempt = 0;
    const operationFn = vi.fn(async (client) => {
      attempt += 1;
      return client.messages.create({ max_tokens: 10, messages: [{ role: "user", content: "hi" }] });
    });
    anthropicCreateMock.mockRejectedValueOnce({ status: 500, message: "server error" });
    openaiCreateMock.mockResolvedValueOnce({ choices: [{ message: { content: "ok from openai", tool_calls: [] } }] });

    const { result, provider } = await router.run(operationFn);
    expect(provider).toBe("openai");
    expect(result).toEqual({ content: [{ type: "text", text: "ok from openai" }] });
    expect(attempt).toBe(2); // the operation itself ran once per provider attempted
  });

  it("only OpenAI configured: operates on OpenAI alone without ever constructing an Anthropic client", async () => {
    const router = createChatProviderRouter({ order: ["anthropic", "openai"], anthropicApiKey: undefined, openaiApiKey: "o-key" });
    openaiCreateMock.mockResolvedValueOnce({ choices: [{ message: { content: "ok", tool_calls: [] } }] });
    const { provider } = await router.run((client) => client.messages.create({ max_tokens: 10, messages: [] }));
    expect(provider).toBe("openai");
    expect(anthropicCreateMock).not.toHaveBeenCalled();
  });

  it("neither provider configured: throws AllProvidersUnavailableError without calling the operation", async () => {
    const router = createChatProviderRouter({ order: ["anthropic", "openai"], anthropicApiKey: undefined, openaiApiKey: undefined });
    const operationFn = vi.fn();
    await expect(router.run(operationFn)).rejects.toBeInstanceOf(AllProvidersUnavailableError);
    expect(operationFn).not.toHaveBeenCalled();
  });

  it("a deterministic FurniAI error thrown by the operation (e.g. a tool/model bug) propagates immediately, no failover", async () => {
    const router = createChatProviderRouter({ order: ["anthropic", "openai"], anthropicApiKey: "a-key", openaiApiKey: "o-key" });
    const bug = new Error("deterministic wardrobe kernel bug — not a provider problem");
    const operationFn = vi.fn().mockRejectedValue(bug);
    await expect(router.run(operationFn)).rejects.toBe(bug);
    expect(operationFn).toHaveBeenCalledTimes(1); // never retried on the second provider
  });

  it("AI_PROVIDER_ORDER=openai,anthropic: OpenAI is tried first", async () => {
    const router = createChatProviderRouter({ order: ["openai", "anthropic"], anthropicApiKey: "a-key", openaiApiKey: "o-key" });
    openaiCreateMock.mockResolvedValueOnce({ choices: [{ message: { content: "ok", tool_calls: [] } }] });
    const { provider } = await router.run((client) => client.messages.create({ max_tokens: 10, messages: [] }));
    expect(provider).toBe("openai");
    expect(anthropicCreateMock).not.toHaveBeenCalled();
  });

  // ---- Codex "PR #4 Required Corrections" — Blocker 1, chat-side parity ----
  it("HTTP 400 from the Anthropic client (an integration defect) does NOT cause fallback to OpenAI on the chat path", async () => {
    const router = createChatProviderRouter({ order: ["anthropic", "openai"], anthropicApiKey: "a-key", openaiApiKey: "o-key" });
    anthropicCreateMock.mockRejectedValueOnce({ status: 400, message: "invalid request" });
    const rejection = await router.run((client) => client.messages.create({ max_tokens: 10, messages: [] })).catch((e) => e);
    expect(rejection.status).toBe(400); // propagated raw, unclassified — anthropicChatClient.js is a deliberate passthrough
    expect(openaiCreateMock).not.toHaveBeenCalled();
  });

  it("an unknown/unrecognized failure from the Anthropic client does NOT cause fallback to OpenAI on the chat path", async () => {
    const router = createChatProviderRouter({ order: ["anthropic", "openai"], anthropicApiKey: "a-key", openaiApiKey: "o-key" });
    const bug = new Error("some shape neither SDK ever throws");
    anthropicCreateMock.mockRejectedValueOnce(bug);
    await expect(router.run((client) => client.messages.create({ max_tokens: 10, messages: [] }))).rejects.toBe(bug);
    expect(openaiCreateMock).not.toHaveBeenCalled();
  });
});

describe("shouldExposeProviderDebugInfo", () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("is true outside production by default", () => {
    process.env.NODE_ENV = "test";
    delete process.env.FURNIAI_FOUNDER_PREVIEW;
    expect(shouldExposeProviderDebugInfo()).toBe(true);
  });

  it("is false in production unless FURNIAI_FOUNDER_PREVIEW=true", () => {
    process.env.NODE_ENV = "production";
    delete process.env.FURNIAI_FOUNDER_PREVIEW;
    expect(shouldExposeProviderDebugInfo()).toBe(false);
  });

  it("is true in production when FURNIAI_FOUNDER_PREVIEW=true", () => {
    process.env.NODE_ENV = "production";
    process.env.FURNIAI_FOUNDER_PREVIEW = "true";
    expect(shouldExposeProviderDebugInfo()).toBe(true);
  });
});
