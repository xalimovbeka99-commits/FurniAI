import { describe, expect, it, vi } from "vitest";
import { DESIGN_EDIT_TOOL_NAME } from "./designEditSchema.js";
import { ModelProposalError, proposeDesignEdit } from "./proposeDesignEdit.js";

function fakeClient(content) {
  return { messages: { create: vi.fn(async () => ({ content })) } };
}
const toolUse = (input) => [{ type: "tool_use", name: DESIGN_EDIT_TOOL_NAME, input }];

describe("one live-model design turn", () => {
  it("imports no SDK and reads no environment variable", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("./proposeDesignEdit.js", import.meta.url), "utf8");
    expect(source).not.toMatch(/@anthropic-ai|from "openai"|process\.env/);
  });

  it("sends the tool and the active design, and returns validated edits", async () => {
    const client = fakeClient(toolUse({ edits: [{ key: "envelope.widthMm", value: 2000 }], reply: "Widened." }));
    const result = await proposeDesignEdit({
      client,
      message: "can you take it out to two metres across",
      currentFacts: { "envelope.widthMm": 1800, bayCount: 2 },
    });

    const call = client.messages.create.mock.calls[0][0];
    expect(call.tools[0].name).toBe(DESIGN_EDIT_TOOL_NAME);
    expect(call.system).toContain("envelope.widthMm: 1800");
    expect(call.system).toContain("NEVER produce panel sizes");
    expect(result.edits).toEqual([{ key: "envelope.widthMm", value: 2000, sourceText: null }]);
    expect(result.usedTool).toBe(true);
  });

  it("treats prose without a tool call as no design change", async () => {
    const client = fakeClient([{ type: "text", text: "Sure, what width did you have in mind?" }]);
    const result = await proposeDesignEdit({ client, message: "make it nicer" });
    expect(result.usedTool).toBe(false);
    expect(result.edits).toEqual([]);
    expect(result.reply).toContain("width");
  });

  it("passes a model's forbidden key through validation, not through to the caller", async () => {
    const client = fakeClient(toolUse({ edits: [{ key: "partGraph", value: { parts: [] } }], reply: "Built it." }));
    const result = await proposeDesignEdit({ client, message: "build it" });
    expect(result.edits).toEqual([]);
    expect(result.errors[0].code).toBe("FORBIDDEN_KEY");
  });

  it("refuses a bad client or an empty message", async () => {
    await expect(proposeDesignEdit({ client: {}, message: "hi" })).rejects.toThrow(ModelProposalError);
    await expect(proposeDesignEdit({ client: fakeClient([]), message: "  " })).rejects.toThrow(ModelProposalError);
  });

  it("caps conversation history it forwards", async () => {
    const client = fakeClient(toolUse({ edits: [], reply: "ok" }));
    const conversation = new Array(60).fill({ role: "user", content: "x" });
    await proposeDesignEdit({ client, message: "hello", conversation });
    expect(client.messages.create.mock.calls[0][0].messages.length).toBeLessThanOrEqual(21);
  });
});
