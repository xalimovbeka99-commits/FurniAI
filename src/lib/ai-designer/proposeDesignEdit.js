/**
 * FurniAI — one live-model turn that proposes design edits.
 * ---------------------------------------------------------------------
 * Provider-independent by construction: `client` is anything satisfying
 * FurniAI's normalized chat-client contract
 * (`client.messages.create({...}, {signal}) -> {content:[...]}`) — the real
 * Anthropic client, the OpenAI adapter, or a deterministic fake. This module
 * imports no SDK, reads no environment variable and makes no HTTP decision.
 *
 * It returns PROPOSALS ONLY. Nothing here builds geometry.
 */

import { DESIGN_EDIT_TOOL_NAME, designEditToolSchema, validateModelProposal } from "./designEditSchema.js";
import { buildDesignSystemPrompt, DESIGN_PROMPT_VERSION } from "./systemPrompt.js";

export const MESSAGE_MAX_LENGTH = 2000;
export const MAX_CONVERSATION_TURNS = 20;

export class ModelProposalError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = "ModelProposalError";
    this.code = code;
    this.details = details;
  }
}

function describeCurrentDesign(currentFacts) {
  const keys = Object.keys(currentFacts ?? {});
  if (keys.length === 0) return "The customer has no active design yet.";
  const lines = keys.sort().map((k) => `  ${k}: ${JSON.stringify(currentFacts[k])}`);
  return ["The customer's ACTIVE design (change only what they ask to change):", ...lines].join("\n");
}

/**
 * @param {object} args
 * @param {object} args.client normalized chat client
 * @param {string} args.message the customer's words
 * @param {Record<string, any>} [args.currentFacts] the active design's intake facts
 * @param {Array<{role:string, content:any}>} [args.conversation] prior turns
 * @param {number} [args.currentBayCount]
 * @param {AbortSignal} [args.signal]
 * @returns {Promise<{edits:Array, unsupported:Array, reply:string, errors:Array, promptVersion:string, usedTool:boolean}>}
 */
export async function proposeDesignEdit({
  client,
  message,
  currentFacts = {},
  conversation = [],
  currentBayCount = 2,
  signal = undefined,
}) {
  if (!client?.messages?.create) throw new ModelProposalError("INVALID_CLIENT", "A normalized chat client is required.");
  if (typeof message !== "string" || message.trim() === "") {
    throw new ModelProposalError("INVALID_MESSAGE", "`message` must be a non-empty string.");
  }

  const trimmedConversation = conversation.slice(-MAX_CONVERSATION_TURNS);

  const response = await client.messages.create(
    {
      system: `${buildDesignSystemPrompt()}\n\n${describeCurrentDesign(currentFacts)}`,
      messages: [...trimmedConversation, { role: "user", content: message.trim() }],
      tools: [designEditToolSchema()],
      max_tokens: 1024,
    },
    signal ? { signal } : undefined
  );

  const content = Array.isArray(response?.content) ? response.content : [];
  const toolUse = content.find((b) => b?.type === "tool_use" && b?.name === DESIGN_EDIT_TOOL_NAME);

  if (!toolUse) {
    // The model answered in prose instead of proposing. That is not a design
    // change, and it is never treated as one.
    const text = content
      .filter((b) => b?.type === "text" && typeof b.text === "string")
      .map((b) => b.text.trim())
      .join(" ")
      .trim();
    return {
      edits: [],
      unsupported: [],
      reply: text || "I did not understand that as a change to the design. Could you say it another way?",
      errors: [],
      promptVersion: DESIGN_PROMPT_VERSION,
      usedTool: false,
    };
  }

  const validated = validateModelProposal(toolUse.input, { currentBayCount });

  return {
    edits: validated.edits,
    unsupported: validated.unsupported,
    reply: validated.reply || "",
    errors: validated.errors,
    promptVersion: DESIGN_PROMPT_VERSION,
    usedTool: true,
  };
}
