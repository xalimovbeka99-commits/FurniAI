import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const runMock = vi.fn();
const createChatProviderRouter = vi.fn(() => ({ run: runMock }));

class FakeAllProvidersUnavailableError extends Error {
  constructor() {
    super("No AI provider is currently available.");
    this.name = "AllProvidersUnavailableError";
    this.code = "AI_PROVIDER_UNAVAILABLE";
  }
}

vi.mock("@/lib/ai-provider", () => ({
  createChatProviderRouter,
  shouldExposeProviderDebugInfo: () => true,
  AllProvidersUnavailableError: FakeAllProvidersUnavailableError,
  redactErrorForLogging: (err) => ({ name: err?.name ?? "Error", code: err?.code ?? null, message: err?.message ?? String(err) }),
}));

const { POST } = await import("./route.js");

function req(body) {
  return { json: async () => body };
}

async function post(body) {
  const res = await POST(req(body));
  return { status: res.status, body: await res.json() };
}

describe("POST /api/wardrobe/chat", () => {
  beforeEach(() => {
    runMock.mockReset();
    createChatProviderRouter.mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects an empty message", async () => {
    const { status, body } = await post({ message: "" });
    expect(status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(runMock).not.toHaveBeenCalled();
  });

  it("on success, returns the agent result plus safe provider debug metadata (dev/founder-preview mode)", async () => {
    runMock.mockResolvedValueOnce({
      result: { model: { id: "wardrobe-01", revision: 1 }, revision: 1, assistantMessage: "Created it.", toolCalls: [], conversation: [] },
      provider: "openai",
      attempted: [
        { provider: "anthropic", outcome: "failed_retriable" },
        { provider: "openai", outcome: "success" },
      ],
    });

    const { status, body } = await post({ message: "Create a wardrobe." });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.model.id).toBe("wardrobe-01");
    expect(body.provider).toBe("openai");
    expect(body.fallback).toBe(true); // more than one non-skipped attempt
  });

  it("does not report fallback:true when the first provider served the request", async () => {
    runMock.mockResolvedValueOnce({
      result: { model: { id: "wardrobe-01", revision: 1 }, revision: 1, assistantMessage: "ok", toolCalls: [], conversation: [] },
      provider: "anthropic",
      attempted: [{ provider: "anthropic", outcome: "success" }],
    });
    const { body } = await post({ message: "Create a wardrobe." });
    expect(body.provider).toBe("anthropic");
    expect(body.fallback).toBe(false);
  });

  it("maps AllProvidersUnavailableError to 503 AI_PROVIDER_UNAVAILABLE", async () => {
    runMock.mockRejectedValueOnce(new FakeAllProvidersUnavailableError());
    const { status, body } = await post({ message: "Create a wardrobe." });
    expect(status).toBe(503);
    expect(body.code).toBe("AI_PROVIDER_UNAVAILABLE");
  });

  it("maps an AgentTimeoutError leaking through unclassified to 504 AI_PROVIDER_TIMEOUT", async () => {
    runMock.mockRejectedValueOnce(Object.assign(new Error("timed out"), { name: "AgentTimeoutError" }));
    const { status, body } = await post({ message: "Create a wardrobe." });
    expect(status).toBe(504);
    expect(body.code).toBe("AI_PROVIDER_TIMEOUT");
  });

  it("maps any other unexpected error to a generic 500 without leaking internals", async () => {
    runMock.mockRejectedValueOnce(new Error("some internal stack trace with sensitive details"));
    const { status, body } = await post({ message: "Create a wardrobe." });
    expect(status).toBe(500);
    expect(body.code).toBe("WARDROBE_AGENT_ERROR");
    expect(JSON.stringify(body)).not.toContain("sensitive details");
  });

  it("REGRESSION (Codex finding #2): logs a redacted error, never the raw error object, when the caught error carries a secret-bearing cause", async () => {
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const secret = "sk-ant-real-secret-should-never-be-logged";
      const providerErr = Object.assign(new Error("safe redacted message"), {
        name: "ProviderError",
        code: "UNKNOWN",
        cause: new Error(`Authorization: Bearer ${secret}`),
      });
      runMock.mockRejectedValueOnce(providerErr);

      await post({ message: "Create a wardrobe." });

      expect(logSpy).toHaveBeenCalledWith("wardrobe agent route error:", { name: "ProviderError", code: "UNKNOWN", message: "safe redacted message" });
      // the raw error/cause object itself must never be one of the logged arguments
      for (const call of logSpy.mock.calls) {
        for (const arg of call) {
          expect(arg).not.toBe(providerErr);
          expect(arg).not.toBe(providerErr.cause);
        }
      }
      expect(JSON.stringify(logSpy.mock.calls)).not.toContain(secret);
    } finally {
      logSpy.mockRestore();
    }
  });
});
