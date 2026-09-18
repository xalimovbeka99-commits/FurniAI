/**
 * anthropicChatClient — the Anthropic implementation of FurniAI's
 * normalized multi-turn tool-calling contract (see openaiChatAdapter.js's
 * doc comment for the full shape). No translation needed: the real
 * `@anthropic-ai/sdk` client already exposes exactly
 * `.messages.create(params, {signal}) -> {content: [...]}`, which is what
 * that normalized contract was modeled on.
 *
 * Deliberately a thin passthrough with NO error classification here:
 * runWardrobeAgent.js's own `callOnce` already owns timeout handling
 * (its own AbortController -> `AgentTimeoutError`) and lets every other
 * SDK error propagate raw. Wrapping/reclassifying errors at this layer
 * would shadow that `err.name === "AbortError"` check before it ever runs.
 * providerRouter.js's isRetriableProviderFailure() classifies whatever
 * comes out the other end (AgentTimeoutError, or a raw Anthropic SDK
 * error) itself — see errors.js.
 */
import Anthropic from "@anthropic-ai/sdk";
import { ProviderError, PROVIDER_ERROR_CODES } from "./errors.js";

/**
 * Verified 2026-09-11 against the official model list at
 * platform.claude.com/docs/en/models/overview, which names
 * claude-fable-5-1, claude-opus-5, claude-sonnet-5 and
 * claude-haiku-4-5-20251001. The previous default "claude-sonnet-4-6" is not
 * a model Anthropic publishes and never was — there is no Sonnet 4.6.
 *
 * This was corrected from the documented model list, NOT inferred from an API
 * rejection: a 401 means the credential was refused before the model id is
 * ever considered, so a rejected key is no evidence at all about the model.
 */
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5";
const DEFAULT_MODEL = DEFAULT_ANTHROPIC_MODEL;

/**
 * @param {{ apiKey?: string, model?: string }} [config]
 * @returns {{ messages: { create: (params: object, opts?: { signal?: AbortSignal }) => Promise<object> } }}
 */
export function createAnthropicChatClient({ apiKey = process.env.ANTHROPIC_API_KEY, model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL } = {}) {
  if (!apiKey) {
    throw new ProviderError(PROVIDER_ERROR_CODES.MISSING_API_KEY, "ANTHROPIC_API_KEY is not configured on the server.", { provider: "anthropic" });
  }
  const anthropic = new Anthropic({ apiKey });

  return {
    messages: {
      // `params.model` is honored when the caller sets one (e.g.
      // runWardrobeAgent.js's own default); otherwise this client's
      // configured model applies.
      create: (params, opts) => anthropic.messages.create({ ...params, model: params.model || model }, opts),
    },
  };
}
