/**
 * Real AI provider adapter — OpenAI via the official `openai` SDK. Mirrors
 * anthropicProvider.js's contract exactly: same `extractRequirements(message,
 * attachments)` interface, same normalized return shape, same FslError codes
 * (AI_PROVIDER_ERROR / AI_PROVIDER_TIMEOUT / STRUCTURED_OUTPUT_ERROR) — so
 * FurnitureBrain and everything above it cannot tell which provider answered
 * (Step 7: "Its structured extraction contract must remain the same from the
 * FurniAI Brain's perspective. There is ONE FurniAI contract.").
 *
 * Structured output is forced the OpenAI-native way: a single `function`
 * tool plus `tool_choice` pinned to it (the direct equivalent of Anthropic's
 * forced `tool_choice: {type:"tool", name}`), reusing the exact same JSON
 * schema from extractionSchema.js — one schema, two providers.
 *
 * Known gap (documented, not silently papered over): OpenAI's Chat
 * Completions API accepts image attachments as `image_url` data URIs but has
 * no equivalent inline-PDF content block the way Anthropic's `document`
 * type does. A PDF attachment is described to the model in text instead of
 * embedded — see `attachmentToContent` below — which is strictly weaker
 * than Anthropic's native PDF reading. This only matters when OpenAI is
 * actually serving the request (primary down, or OPENAI_MODEL first in
 * AI_PROVIDER_ORDER); it does not affect the default anthropic-first order.
 */
import OpenAI from "openai";
import { FslError, ERROR_CODES } from "../fsl/errors.js";
import { extractionToolSchema, EXTRACT_TOOL_NAME } from "./extractionSchema.js";
import { buildSystemPrompt } from "./promptTemplate.js";
import { classifySdkError } from "./errors.js";

const DEFAULT_MODEL = "gpt-5.6-luna";
const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_ATTACHMENT_CAPTION = "Describe the furniture shown in the attached file(s) and extract its requirements.";

function emptyExtraction() {
  return {
    furniture_type: null,
    project_name: null,
    description: null,
    dimensions: { width_mm: null, height_mm: null, depth_mm: null },
    style: { theme: null, primary_color: null, secondary_color: null, finish: null, door_style: null, handle_style: null },
    materials: { body: null, facades: null, back_panel: null },
    components: [],
    features_mentioned: [],
    explicit_fields: [],
    ambiguities: [],
  };
}

/** Same normalization as anthropicProvider.js — identical output shape
 * regardless of which provider produced the raw tool arguments. */
function normalizeExtraction(raw) {
  const base = emptyExtraction();
  return {
    ...base,
    ...raw,
    dimensions: { ...base.dimensions, ...(raw.dimensions || {}) },
    style: { ...base.style, ...(raw.style || {}) },
    materials: { ...base.materials, ...(raw.materials || {}) },
    components: Array.isArray(raw.components) ? raw.components : [],
    features_mentioned: Array.isArray(raw.features_mentioned) ? raw.features_mentioned : [],
    explicit_fields: Array.isArray(raw.explicit_fields) ? raw.explicit_fields : [],
    ambiguities: Array.isArray(raw.ambiguities) ? raw.ambiguities : [],
  };
}

function extractToolInput(resp) {
  const call = resp?.choices?.[0]?.message?.tool_calls?.find((c) => c.type === "function" && c.function?.name === EXTRACT_TOOL_NAME);
  if (!call) return null;
  try {
    const parsed = JSON.parse(call.function.arguments);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null; // malformed JSON is treated exactly like "no tool call" — triggers the one repair attempt
  }
}

/** Image attachments become `image_url` data URIs (OpenAI's native vision
 * input). PDFs have no inline-content equivalent in Chat Completions — see
 * the file-level doc comment — so they're surfaced as a text note instead
 * of silently dropped. */
function attachmentToContent({ kind, mediaType, data }) {
  if (kind === "document") {
    return { type: "text", text: `[The user attached a ${mediaType} document that this provider cannot read inline. Extract only from the text message and ask the user to describe the document's contents if the message alone is insufficient.]` };
  }
  return { type: "image_url", image_url: { url: `data:${mediaType};base64,${data}` } };
}

function buildUserContent(message, attachments, extraText = null) {
  const blocks = (attachments || []).map(attachmentToContent);
  const text = message && message.trim().length > 0 ? message : DEFAULT_ATTACHMENT_CAPTION;
  blocks.push({ type: "text", text: extraText ? `${text}\n\n${extraText}` : text });
  return blocks;
}

function functionToolFromSchema() {
  const schema = extractionToolSchema();
  return {
    type: "function",
    function: {
      name: schema.name,
      description: schema.description,
      parameters: schema.input_schema,
    },
  };
}

/**
 * @param {{ apiKey?: string, model?: string, timeoutMs?: number }} [config]
 * @returns {{ extractRequirements: (message: string, attachments?: Array) => Promise<object> }}
 */
export function createOpenAIProvider({ apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL || DEFAULT_MODEL, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!apiKey) {
    throw new FslError(ERROR_CODES.AI_PROVIDER_ERROR, "OPENAI_API_KEY is not configured on the server.");
  }
  const openai = new OpenAI({ apiKey });
  const tool = functionToolFromSchema();

  async function callOnce(userContent) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await openai.chat.completions.create(
        {
          model,
          max_tokens: 1024,
          messages: [
            { role: "system", content: buildSystemPrompt() },
            { role: "user", content: userContent },
          ],
          tools: [tool],
          tool_choice: { type: "function", function: { name: EXTRACT_TOOL_NAME } },
        },
        { signal: controller.signal }
      );
    } catch (err) {
      const classified = classifySdkError(err, "openai");
      throw new FslError(
        classified.code === "TIMEOUT" ? ERROR_CODES.AI_PROVIDER_TIMEOUT : ERROR_CODES.AI_PROVIDER_ERROR,
        classified.code === "TIMEOUT" ? "The AI provider did not respond in time." : "The AI provider request failed."
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async extractRequirements(message, attachments = []) {
      let resp = await callOnce(buildUserContent(message, attachments));
      let input = extractToolInput(resp);

      if (!input) {
        // Same bounded-repair rule as anthropicProvider.js: exactly one retry.
        resp = await callOnce(
          buildUserContent(
            message,
            attachments,
            `[system: your previous reply did not include a valid ${EXTRACT_TOOL_NAME} tool call with well-formed arguments — call the tool again with valid arguments and nothing else]`
          )
        );
        input = extractToolInput(resp);
      }

      if (!input) {
        throw new FslError(ERROR_CODES.STRUCTURED_OUTPUT_ERROR, "The AI provider did not return a valid structured response.");
      }
      return normalizeExtraction(input);
    },
  };
}
