import { describe, expect, it, vi, beforeEach } from "vitest";
import { callWithFailover, resolveProviderOrder, KNOWN_PROVIDERS } from "./providerRouter.js";
import { AllProvidersUnavailableError, ProviderError, PROVIDER_ERROR_CODES } from "./errors.js";
import { FslError, ERROR_CODES } from "../fsl/errors.js";

describe("resolveProviderOrder", () => {
  it("defaults to anthropic,openai when no env value is set", () => {
    expect(resolveProviderOrder(undefined)).toEqual(["anthropic", "openai"]);
    expect(resolveProviderOrder("")).toEqual(["anthropic", "openai"]);
  });

  it("respects AI_PROVIDER_ORDER=openai,anthropic (Step 4)", () => {
    expect(resolveProviderOrder("openai,anthropic")).toEqual(["openai", "anthropic"]);
  });

  it("respects AI_PROVIDER_ORDER=anthropic,openai explicitly", () => {
    expect(resolveProviderOrder("anthropic,openai")).toEqual(["anthropic", "openai"]);
  });

  it("is whitespace- and case-insensitive", () => {
    expect(resolveProviderOrder(" OpenAI , Anthropic ")).toEqual(["openai", "anthropic"]);
  });

  it("drops unknown tokens and de-duplicates, keeping first occurrence", () => {
    expect(resolveProviderOrder("openai,bogus,openai,anthropic")).toEqual(["openai", "anthropic"]);
  });

  it("falls back to the default order when every token is invalid", () => {
    expect(resolveProviderOrder("bogus,also-bogus")).toEqual(["anthropic", "openai"]);
  });

  it("supports a single-provider order (only one provider configured)", () => {
    expect(resolveProviderOrder("openai")).toEqual(["openai"]);
  });

  it("KNOWN_PROVIDERS lists exactly anthropic and openai", () => {
    expect(KNOWN_PROVIDERS).toEqual(["anthropic", "openai"]);
  });
});

describe("callWithFailover", () => {
  const order = ["anthropic", "openai"];
  let observe;

  beforeEach(() => {
    observe = vi.fn();
  });

  it("Anthropic available and healthy: succeeds on Anthropic, OpenAI is never called", async () => {
    const anthropicRun = vi.fn().mockResolvedValue("anthropic-result");
    const openaiRun = vi.fn().mockResolvedValue("openai-result");
    const { result, provider, attempted } = await callWithFailover({
      order,
      providers: { anthropic: { available: true, run: anthropicRun }, openai: { available: true, run: openaiRun } },
      observe,
    });

    expect(result).toBe("anthropic-result");
    expect(provider).toBe("anthropic");
    expect(anthropicRun).toHaveBeenCalledTimes(1);
    expect(openaiRun).not.toHaveBeenCalled();
    expect(attempted).toEqual([{ provider: "anthropic", outcome: "success", latencyMs: expect.any(Number) }]);
  });

  it("Anthropic fails with a retriable provider error: fails over to OpenAI, which succeeds", async () => {
    const anthropicRun = vi.fn().mockRejectedValue(new ProviderError(PROVIDER_ERROR_CODES.RATE_LIMITED, "rate limited"));
    const openaiRun = vi.fn().mockResolvedValue("openai-result");
    const { result, provider } = await callWithFailover({
      order,
      providers: { anthropic: { available: true, run: anthropicRun }, openai: { available: true, run: openaiRun } },
      observe,
    });

    expect(result).toBe("openai-result");
    expect(provider).toBe("openai");
    expect(anthropicRun).toHaveBeenCalledTimes(1);
    expect(openaiRun).toHaveBeenCalledTimes(1);

    const finalEvent = observe.mock.calls.at(-1)[0];
    expect(finalEvent.provider_requested).toBe("anthropic");
    expect(finalEvent.provider_used).toBe("openai");
    expect(finalEvent.fallback_occurred).toBe(true);
    expect(finalEvent.fallback_reason_code).toBe("RATE_LIMITED");
  });

  it("OpenAI listed first (AI_PROVIDER_ORDER=openai,anthropic): succeeds on OpenAI, Anthropic is never called", async () => {
    const anthropicRun = vi.fn().mockResolvedValue("anthropic-result");
    const openaiRun = vi.fn().mockResolvedValue("openai-result");
    const { result, provider } = await callWithFailover({
      order: ["openai", "anthropic"],
      providers: { anthropic: { available: true, run: anthropicRun }, openai: { available: true, run: openaiRun } },
      observe,
    });

    expect(result).toBe("openai-result");
    expect(provider).toBe("openai");
    expect(openaiRun).toHaveBeenCalledTimes(1);
    expect(anthropicRun).not.toHaveBeenCalled();
  });

  it("both providers unavailable (unconfigured): throws AllProvidersUnavailableError without calling either run()", async () => {
    const anthropicRun = vi.fn();
    const openaiRun = vi.fn();
    await expect(
      callWithFailover({
        order,
        providers: { anthropic: { available: false, run: anthropicRun }, openai: { available: false, run: openaiRun } },
        observe,
      })
    ).rejects.toBeInstanceOf(AllProvidersUnavailableError);

    expect(anthropicRun).not.toHaveBeenCalled();
    expect(openaiRun).not.toHaveBeenCalled();
  });

  it("both providers configured but both fail retriably: throws AllProvidersUnavailableError (AI_PROVIDER_UNAVAILABLE) after trying both", async () => {
    const anthropicRun = vi.fn().mockRejectedValue(new ProviderError(PROVIDER_ERROR_CODES.SERVER_ERROR, "down"));
    const openaiRun = vi.fn().mockRejectedValue(new ProviderError(PROVIDER_ERROR_CODES.TIMEOUT, "timed out"));
    const rejection = await callWithFailover({
      order,
      providers: { anthropic: { available: true, run: anthropicRun }, openai: { available: true, run: openaiRun } },
      observe,
    }).catch((e) => e);

    expect(rejection).toBeInstanceOf(AllProvidersUnavailableError);
    expect(rejection.code).toBe("AI_PROVIDER_UNAVAILABLE");
    expect(anthropicRun).toHaveBeenCalledTimes(1);
    expect(openaiRun).toHaveBeenCalledTimes(1);
  });

  it("only one provider configured: operates on that provider alone, succeeding without ever consulting the other", async () => {
    const openaiRun = vi.fn().mockResolvedValue("openai-only-result");
    const { result, provider } = await callWithFailover({
      order,
      providers: { anthropic: { available: false, run: vi.fn() }, openai: { available: true, run: openaiRun } },
      observe,
    });
    expect(result).toBe("openai-only-result");
    expect(provider).toBe("openai");
  });

  describe("no incorrect failover — a real FurniAI error is never hidden behind a provider switch", () => {
    it("a deterministic FSL validation error (e.g. INVALID_FSL) propagates immediately; OpenAI is never tried", async () => {
      const validationError = new FslError(ERROR_CODES.INVALID_FSL, "the model produced an invalid FSL document");
      const anthropicRun = vi.fn().mockRejectedValue(validationError);
      const openaiRun = vi.fn();

      const rejection = await callWithFailover({
        order,
        providers: { anthropic: { available: true, run: anthropicRun }, openai: { available: true, run: openaiRun } },
        observe,
      }).catch((e) => e);

      expect(rejection).toBe(validationError); // the exact same error, not wrapped or replaced
      expect(openaiRun).not.toHaveBeenCalled();
    });

    it("an unsupported-furniture-operation error propagates immediately, no failover attempted", async () => {
      const err = new FslError(ERROR_CODES.UNSUPPORTED_FURNITURE_TYPE, "not supported");
      const anthropicRun = vi.fn().mockRejectedValue(err);
      const openaiRun = vi.fn();
      await expect(
        callWithFailover({ order, providers: { anthropic: { available: true, run: anthropicRun }, openai: { available: true, run: openaiRun } }, observe })
      ).rejects.toBe(err);
      expect(openaiRun).not.toHaveBeenCalled();
    });

    it("a genuine application bug (plain Error, not a provider/FSL error) propagates immediately, no failover attempted", async () => {
      const bug = new TypeError("cannot read properties of undefined (reading 'sections')");
      const anthropicRun = vi.fn().mockRejectedValue(bug);
      const openaiRun = vi.fn();
      await expect(
        callWithFailover({ order, providers: { anthropic: { available: true, run: anthropicRun }, openai: { available: true, run: openaiRun } }, observe })
      ).rejects.toBe(bug);
      expect(openaiRun).not.toHaveBeenCalled();
    });

    it("a malformed-request error (caller's own bad input) propagates immediately, no failover attempted", async () => {
      const err = new FslError(ERROR_CODES.EMPTY_MESSAGE, "message must not be empty");
      const anthropicRun = vi.fn().mockRejectedValue(err);
      const openaiRun = vi.fn();
      await expect(
        callWithFailover({ order, providers: { anthropic: { available: true, run: anthropicRun }, openai: { available: true, run: openaiRun } }, observe })
      ).rejects.toBe(err);
      expect(openaiRun).not.toHaveBeenCalled();
    });
  });

  describe("secrets never appear in observability output", () => {
    it("the observe() event never contains an API key, header, or raw provider payload", async () => {
      const secret = "sk-ant-super-secret-value-should-never-leak";
      const err = new ProviderError(PROVIDER_ERROR_CODES.AUTH_ERROR, "The AI provider rejected the request credentials.", {
        provider: "anthropic",
        cause: new Error(`Authorization: Bearer ${secret}`),
      });
      const anthropicRun = vi.fn().mockRejectedValue(err);
      const openaiRun = vi.fn().mockResolvedValue("ok");

      await callWithFailover({ order, providers: { anthropic: { available: true, run: anthropicRun }, openai: { available: true, run: openaiRun } }, observe });

      const serialized = JSON.stringify(observe.mock.calls);
      expect(serialized).not.toContain(secret);
      expect(serialized).not.toContain("Authorization");
      expect(serialized).not.toContain("Bearer");
    });

    it("the default console-based observer never logs a secret either", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const secret = "sk-openai-do-not-log-me";
      const err = new ProviderError(PROVIDER_ERROR_CODES.AUTH_ERROR, "rejected", { provider: "openai", cause: new Error(secret) });
      try {
        await callWithFailover({
          order,
          providers: { anthropic: { available: true, run: vi.fn().mockRejectedValue(err) }, openai: { available: true, run: vi.fn().mockResolvedValue("ok") } },
          // no `observe` override — exercises the default console logger
        });
        const logged = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
        expect(logged).not.toContain(secret);
      } finally {
        logSpy.mockRestore();
      }
    });
  });

  it("records latency_ms as a number for a successful call", async () => {
    const { attempted } = await callWithFailover({
      order,
      providers: { anthropic: { available: true, run: () => new Promise((resolve) => setTimeout(() => resolve("ok"), 5)) }, openai: { available: true, run: vi.fn() } },
      observe,
    });
    expect(attempted[0].latencyMs).toBeGreaterThanOrEqual(0);
  });
});
