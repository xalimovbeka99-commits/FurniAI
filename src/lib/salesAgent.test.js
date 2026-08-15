import { describe, it, expect, vi, beforeEach } from "vitest";

const runMock = vi.fn();
const createChatProviderRouter = vi.fn(() => ({ run: runMock }));
class FakeAllProvidersUnavailableError extends Error {
  constructor() {
    super("none available");
    this.name = "AllProvidersUnavailableError";
    this.code = "AI_PROVIDER_UNAVAILABLE";
  }
}
vi.mock("./ai-provider/index.js", () => ({ createChatProviderRouter, AllProvidersUnavailableError: FakeAllProvidersUnavailableError }));

const { runSalesAgent } = await import("./salesAgent.js");

describe("runSalesAgent", () => {
  beforeEach(() => {
    runMock.mockReset();
    createChatProviderRouter.mockClear();
  });

  it("uses an injected client directly, bypassing the provider router entirely (existing test-injection contract)", async () => {
    const client = { messages: { create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "Injected reply." }] }) } };
    const result = await runSalesAgent({ messages: [{ role: "user", content: "hi" }], client });
    expect(result.reply).toBe("Injected reply.");
    expect(createChatProviderRouter).not.toHaveBeenCalled();
  });

  it("without an injected client, routes through createChatProviderRouter and returns the serving provider", async () => {
    runMock.mockResolvedValueOnce({ result: "Hello from the router.", provider: "anthropic" });
    const result = await runSalesAgent({ messages: [{ role: "user", content: "hi" }] });
    expect(result.reply).toBe("Hello from the router.");
    expect(result.provider).toBe("anthropic");
  });

  it("maps AllProvidersUnavailableError to a stable AI_PROVIDER_UNAVAILABLE error the route can catch", async () => {
    runMock.mockRejectedValueOnce(new FakeAllProvidersUnavailableError());
    await expect(runSalesAgent({ messages: [{ role: "user", content: "hi" }] })).rejects.toMatchObject({ message: "AI_PROVIDER_UNAVAILABLE" });
  });

  it("a genuine bug propagates unchanged, not swallowed as a provider failure", async () => {
    const bug = new TypeError("not a provider problem");
    runMock.mockRejectedValueOnce(bug);
    await expect(runSalesAgent({ messages: [{ role: "user", content: "hi" }] })).rejects.toBe(bug);
  });
});
