/**
 * openaiChatAdapter — makes an OpenAI client speak FurniAI's normalized
 * multi-turn tool-calling wire format (Step 6).
 * ----------------------------------------------------------------------
 * runWardrobeAgent.js (and the sales agent) only depend on:
 *
 *   client.messages.create(
 *     { model, max_tokens, system, tools, tool_choice, messages },
 *     { signal }
 *   ) -> Promise<{ content: [{type:"text",text} | {type:"tool_use",id,name,input}] }>
 *
 * That shape is documented as FurniAI's own normalized agent-turn format —
 * it happens to be Anthropic's native response shape, which is why
 * anthropicChatClient.js can hand back the real SDK client with zero
 * translation. This file is the OTHER implementation of the same contract:
 * it translates every call into OpenAI's Chat Completions request shape,
 * calls the real `openai` SDK, and translates the response back — so the
 * agent loop, the eight deterministic Wardrobe tools, and the Wardrobe
 * Model never see an OpenAI-shaped object.
 *
 *   Anthropic reasoning  \
 *                         >--  same normalized shape  -->  same Wardrobe Tools
 *   OpenAI reasoning     /
 *
 * Not a general-purpose OpenAI wrapper — only the request/response shapes
 * runWardrobeAgent.js and the sales agent actually send are translated.
 */
import OpenAI from "openai";
import { classifySdkError, ProviderError, PROVIDER_ERROR_CODES } from "./errors.js";

const DEFAULT_MODEL = "gpt-5.6-luna";

/** Anthropic tool schema ({name, description, input_schema}) -> OpenAI
 * function-tool schema ({type:"function", function:{name, description,
 * parameters}}). Reuses the JSON schema verbatim — no translation needed,
 * both providers speak plain JSON Schema for tool parameters. */
function toOpenAITools(anthropicTools) {
  if (!Array.isArray(anthropicTools) || anthropicTools.length === 0) return undefined;
  return anthropicTools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));
}

/** One Anthropic-shaped message -> zero or more OpenAI-shaped messages.
 * Anthropic packs a whole turn (text + several tool_use, or several
 * tool_result) into ONE message with an array `content`; OpenAI wants one
 * assistant message with a `tool_calls` array, but each tool RESULT as its
 * own separate `role:"tool"` message. */
function anthropicMessageToOpenAI(message) {
  const { role, content } = message;

  if (typeof content === "string") {
    return [{ role, content }];
  }
  if (!Array.isArray(content)) return [];

  if (role === "assistant") {
    const textParts = content.filter((b) => b.type === "text").map((b) => b.text);
    const toolUseBlocks = content.filter((b) => b.type === "tool_use");
    const out = { role: "assistant", content: textParts.length > 0 ? textParts.join("\n") : null };
    if (toolUseBlocks.length > 0) {
      out.tool_calls = toolUseBlocks.map((b) => ({
        id: b.id,
        type: "function",
        function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
      }));
    }
    return [out];
  }

  // role === "user": either tool_result blocks (agent-loop turn) or plain
  // text blocks (rare, but handled for robustness).
  const toolResults = content.filter((b) => b.type === "tool_result");
  if (toolResults.length > 0) {
    return toolResults.map((b) => ({
      role: "tool",
      tool_call_id: b.tool_use_id,
      content: typeof b.content === "string" ? b.content : JSON.stringify(b.content),
    }));
  }
  const text = content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  return [{ role: "user", content: text }];
}

function toOpenAIMessages(system, anthropicMessages) {
  const out = [];
  if (system) out.push({ role: "system", content: system });
  for (const m of anthropicMessages) out.push(...anthropicMessageToOpenAI(m));
  return out;
}

/** OpenAI's `choices[0].message` -> FurniAI's normalized `{content: [...]}`. */
function fromOpenAIResponse(resp) {
  const message = resp?.choices?.[0]?.message;
  const blocks = [];
  if (message?.content) blocks.push({ type: "text", text: message.content });
  for (const call of message?.tool_calls || []) {
    if (call.type !== "function") continue;
    let input = {};
    try {
      input = JSON.parse(call.function.arguments || "{}");
    } catch {
      input = {}; // malformed tool-call JSON surfaces as an empty-input tool call; the deterministic tool layer rejects it on validation, same as any other bad input
    }
    blocks.push({ type: "tool_use", id: call.id, name: call.function.name, input });
  }
  return { content: blocks };
}

/**
 * @param {{ apiKey?: string, model?: string }} [config]
 * @returns {{ messages: { create: (params: object, opts?: { signal?: AbortSignal }) => Promise<object> } }}
 */
export function createOpenAIChatClient({ apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL || DEFAULT_MODEL } = {}) {
  if (!apiKey) {
    throw new ProviderError(PROVIDER_ERROR_CODES.MISSING_API_KEY, "OPENAI_API_KEY is not configured on the server.", { provider: "openai" });
  }
  const openai = new OpenAI({ apiKey });

  return {
    messages: {
      async create(params, opts = {}) {
        try {
          const resp = await openai.chat.completions.create(
            {
              model, // the incoming Anthropic-style `params.model` is ignored — this client always uses its own configured OpenAI model
              max_completion_tokens: params.max_tokens,
              messages: toOpenAIMessages(params.system, params.messages || []),
              ...(toOpenAITools(params.tools) ? { tools: toOpenAITools(params.tools), tool_choice: "auto" } : {}),
            },
            { signal: opts.signal }
          );
          return fromOpenAIResponse(resp);
        } catch (err) {
          throw classifySdkError(err, "openai");
        }
      },
    },
  };
}
