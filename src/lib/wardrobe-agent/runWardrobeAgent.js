/**
 * runWardrobeAgent — the multi-turn tool-calling loop (Milestone 6).
 * ---------------------------------------------------------------------
 * Replaces the "LLM returns full configuration/coordinates" pattern with:
 *
 *   prompt -> LLM reasoning -> tool call -> tool result -> LLM sees result
 *          -> next tool -> ... -> finished model
 *
 * `client` is anything shaped like the @anthropic-ai/sdk `Anthropic`
 * instance already used in src/lib/ai-provider/anthropicProvider.js
 * (`client.messages.create({...}, {signal})`), or the deterministic
 * fakeWardrobeAgentProvider.js used in tests — the loop does not care which.
 *
 * The LLM never touches the model directly: every tool_use block is
 * executed through src/lib/wardrobe-tools/tools.js, which is the only
 * thing allowed to produce a new WardrobeModel. A failed tool call is
 * reported back to the model as a tool_result (is_error: true); the model
 * carried forward to the next iteration is only ever updated on success.
 */
import { findTool } from "../wardrobe-tools/tools.js";
import { toAnthropicTools } from "../wardrobe-tools/toAnthropicTools.js";
import { buildWardrobeSystemPrompt, summarizeModelForPrompt } from "./systemPrompt.js";

const DEFAULT_MODEL_NAME = "claude-sonnet-4-6";
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_TOOL_CALLS = 10;

class AgentTimeoutError extends Error {
  constructor() {
    super("The AI provider did not respond in time.");
    this.name = "AgentTimeoutError";
  }
}

async function callOnce(client, { system, tools, messages, model, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await client.messages.create(
      { model, max_tokens: 1024, system, tools, tool_choice: { type: "auto" }, messages },
      { signal: controller.signal }
    );
  } catch (err) {
    if (err?.name === "AbortError") throw new AgentTimeoutError();
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/** What the LLM is shown for a tool result — the outcome and the facts it
 * needs (new ids, old/new values, error codes), not the whole model; the
 * model itself is not the LLM's concern (see buildWardrobeGeometry.js). */
function toolResultForModel(result) {
  const { model, ...visible } = result;
  if (model) {
    visible.wardrobeSummary = {
      revision: model.revision,
      sectionCount: model.sections.length,
      componentCount: model.sections.reduce((sum, s) => sum + s.components.length, 0),
    };
  }
  return visible;
}

/**
 * @param {{
 *   client: object,
 *   model: import('../wardrobe-model/schema.js').WardrobeModel | null,
 *   conversation?: Array<{role: string, content: any}>,
 *   message: string,
 *   maxToolCalls?: number,
 *   timeoutMs?: number,
 *   modelName?: string,
 * }} args
 * @returns {Promise<{
 *   model: object | null,
 *   revision: number | null,
 *   assistantMessage: string,
 *   toolCalls: Array<{name: string, input: object, result: object}>,
 *   conversation: Array<{role: string, content: any}>,
 * }>}
 */
export async function runWardrobeAgent({
  client,
  model = null,
  conversation = [],
  message,
  maxToolCalls = DEFAULT_MAX_TOOL_CALLS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  modelName = DEFAULT_MODEL_NAME,
}) {
  let currentModel = model;
  const messages = [
    ...conversation,
    { role: "user", content: `Current wardrobe state:\n${summarizeModelForPrompt(currentModel)}\n\nCustomer: ${message}` },
  ];
  const toolCalls = [];
  let assistantMessage = "";
  let iterations = 0;

  while (iterations < maxToolCalls) {
    iterations++;
    const response = await callOnce(client, {
      system: buildWardrobeSystemPrompt(),
      tools: toAnthropicTools(),
      messages,
      model: modelName,
      timeoutMs,
    });

    const content = response?.content || [];
    const toolUseBlocks = content.filter((b) => b.type === "tool_use");
    const text = content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (text) assistantMessage = text;

    messages.push({ role: "assistant", content });

    if (toolUseBlocks.length === 0) break; // model produced a final answer, no further tool calls this turn

    const toolResultBlocks = [];
    for (const block of toolUseBlocks) {
      const tool = findTool(block.name);
      const result = tool
        ? tool.run(currentModel, block.input)
        : { success: false, error: "TOOL_NOT_AVAILABLE", message: `No tool named "${block.name}".` };

      if (result.success) currentModel = result.model;
      toolCalls.push({ name: block.name, input: block.input, result });

      toolResultBlocks.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(toolResultForModel(result)),
        is_error: !result.success,
      });
    }
    messages.push({ role: "user", content: toolResultBlocks });
  }

  return {
    model: currentModel,
    revision: currentModel?.revision ?? null,
    assistantMessage,
    toolCalls,
    conversation: messages,
  };
}
