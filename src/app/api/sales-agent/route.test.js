import { describe, it, expect, vi, beforeEach } from "vitest";

const runSalesAgent = vi.fn();
vi.mock("@/lib/salesAgent", () => ({ runSalesAgent }));

// Real redactErrorForLogging/ProviderError come through unmocked so this
// file exercises the ACTUAL security-relevant redaction logic.
const { ProviderError: RealProviderError } = await vi.importActual("@/lib/ai-provider");

const { POST } = await import("./route.js");

function req(body) {
  return { json: async () => body };
}
async function post(body) {
  const res = await POST(req(body));
  return { status: res.status, body: await res.json() };
}

describe("POST /api/sales-agent", () => {
  beforeEach(() => {
    runSalesAgent.mockReset();
  });

  it("rejects a request with no messages array", async () => {
    const { status } = await post({});
    expect(status).toBe(400);
    expect(runSalesAgent).not.toHaveBeenCalled();
  });

  it("returns the agent reply on success", async () => {
    runSalesAgent.mockResolvedValueOnce({ reply: "Hello!" });
    const { status, body } = await post({ messages: [{ role: "user", content: "hi" }] });
    expect(status).toBe(200);
    expect(body.reply).toBe("Hello!");
  });

  it("maps the AI_PROVIDER_UNAVAILABLE sentinel error to 503", async () => {
    runSalesAgent.mockRejectedValueOnce(new Error("AI_PROVIDER_UNAVAILABLE"));
    const { status } = await post({ messages: [{ role: "user", content: "hi" }] });
    expect(status).toBe(503);
  });

  it("REGRESSION (Codex finding #2): logs a redacted error, never the raw error/cause, on an unexpected failure", async () => {
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const secret = "sk-ant-should-never-be-logged";
      const err = new RealProviderError("UNKNOWN", "safe redacted message", { cause: new Error(`Authorization: Bearer ${secret}`) });
      runSalesAgent.mockRejectedValueOnce(err);

      const { status } = await post({ messages: [{ role: "user", content: "hi" }] });

      expect(status).toBe(500);
      expect(logSpy).toHaveBeenCalledWith("sales-agent error:", { name: "ProviderError", code: "UNKNOWN", message: "safe redacted message" });
      expect(JSON.stringify(logSpy.mock.calls)).not.toContain(secret);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("FINAL SECURITY FIX (Codex) — untrusted-message regression: a raw/unrecognized error with the secret DIRECTLY in .message is never logged or returned", async () => {
    const MARKER = "SECRET_SHOULD_NEVER_APPEAR";
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const rawSdkError = new Error(`Authorization: Bearer ${MARKER}`);
      runSalesAgent.mockRejectedValueOnce(rawSdkError);

      const { status, body } = await post({ messages: [{ role: "user", content: "hi" }] });

      expect(status).toBe(500);
      expect(logSpy).toHaveBeenCalledWith("sales-agent error:", { name: "Error", code: "UNKNOWN_ERROR", message: "An internal AI provider error occurred." });
      expect(JSON.stringify(logSpy.mock.calls)).not.toContain(MARKER);
      expect(JSON.stringify(body)).not.toContain(MARKER);
    } finally {
      logSpy.mockRestore();
    }
  });
});
