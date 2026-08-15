/**
 * chatRouter — the provider-independent chat/tool-calling entry point used
 * by both the Wardrobe AI agent loop (Step 6) and the sales agent (Step 8).
 * ----------------------------------------------------------------------
 * Unlike extractionRouter.js (which fails over per single request),
 * chatRouter retries the WHOLE caller-supplied operation on the next
 * provider — safe because neither runWardrobeAgent() nor the sales agent
 * mutates anything outside their own return value until they succeed, so a
 * failed attempt on provider A leaves nothing for provider B to collide
 * with. This also means a multi-turn Wardrobe AI conversation that starts
 * failing over won't leave the tool-call/model state half-updated on one
 * provider and half on another.
 */
import { createAnthropicChatClient } from "./anthropicChatClient.js";
import { createOpenAIChatClient } from "./openaiChatAdapter.js";
import { callWithFailover, resolveProviderOrder } from "./providerRouter.js";

/**
 * @param {{
 *   order?: string[],
 *   anthropicApiKey?: string, anthropicModel?: string,
 *   openaiApiKey?: string, openaiModel?: string,
 *   observe?: (event: object) => void,
 *   operation?: string,
 * }} [config]
 */
export function createChatProviderRouter({
  order = resolveProviderOrder(),
  anthropicApiKey = process.env.ANTHROPIC_API_KEY,
  anthropicModel = undefined,
  openaiApiKey = process.env.OPENAI_API_KEY,
  openaiModel = undefined,
  observe = undefined,
  operation = "chat",
} = {}) {
  return {
    /**
     * @param {(client: object, providerName: string) => Promise<any>} operationFn
     * @returns {Promise<{ result: any, provider: string, attempted: Array }>}
     */
    run(operationFn) {
      const providers = {
        anthropic: {
          available: Boolean(anthropicApiKey),
          run: () => operationFn(createAnthropicChatClient({ apiKey: anthropicApiKey, ...(anthropicModel ? { model: anthropicModel } : {}) }), "anthropic"),
        },
        openai: {
          available: Boolean(openaiApiKey),
          run: () => operationFn(createOpenAIChatClient({ apiKey: openaiApiKey, ...(openaiModel ? { model: openaiModel } : {}) }), "openai"),
        },
      };
      return callWithFailover({ order, providers, observe, operation });
    },
  };
}

/** Whether the current request may see which provider served it (Step 9:
 * "may return a safe debug/provider field in development or founder-preview
 * mode"). Never exposed to normal production customers by default. */
export function shouldExposeProviderDebugInfo() {
  return process.env.NODE_ENV !== "production" || process.env.FURNIAI_FOUNDER_PREVIEW === "true";
}
