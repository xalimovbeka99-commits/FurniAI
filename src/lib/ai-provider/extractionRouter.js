/**
 * extractionRouter — the provider-independent `extractRequirements`
 * FurnitureBrain actually gets (Step 7). Same interface as
 * createAnthropicProvider/createOpenAIProvider alone
 * (`{ extractRequirements(message, attachments) }`), so
 * furniture-brain/brain.js and everything above it needs zero changes —
 * it already only knows about this one method.
 */
import { createAnthropicProvider } from "./anthropicProvider.js";
import { createOpenAIProvider } from "./openaiProvider.js";
import { callWithFailover, resolveProviderOrder } from "./providerRouter.js";
import { FslError, ERROR_CODES } from "../fsl/errors.js";
import { AllProvidersUnavailableError } from "./errors.js";

/**
 * @param {{
 *   order?: string[],
 *   anthropicApiKey?: string, anthropicModel?: string,
 *   openaiApiKey?: string, openaiModel?: string,
 *   timeoutMs?: number,
 *   observe?: (event: object) => void,
 * }} [config]
 */
export function createExtractionAiProvider({
  order = resolveProviderOrder(),
  anthropicApiKey = process.env.ANTHROPIC_API_KEY,
  anthropicModel = undefined,
  openaiApiKey = process.env.OPENAI_API_KEY,
  openaiModel = undefined,
  timeoutMs = undefined,
  observe = undefined,
} = {}) {
  return {
    async extractRequirements(message, attachments = []) {
      const providers = {
        anthropic: {
          available: Boolean(anthropicApiKey),
          run: () => createAnthropicProvider({ apiKey: anthropicApiKey, ...(anthropicModel ? { model: anthropicModel } : {}), ...(timeoutMs ? { timeoutMs } : {}) }).extractRequirements(message, attachments),
        },
        openai: {
          available: Boolean(openaiApiKey),
          run: () => createOpenAIProvider({ apiKey: openaiApiKey, ...(openaiModel ? { model: openaiModel } : {}), ...(timeoutMs ? { timeoutMs } : {}) }).extractRequirements(message, attachments),
        },
      };

      try {
        const { result } = await callWithFailover({ order, providers, observe, operation: "fsl_extraction" });
        return result;
      } catch (err) {
        if (err instanceof AllProvidersUnavailableError) {
          throw new FslError(ERROR_CODES.AI_PROVIDER_UNAVAILABLE, "No AI provider is currently available.");
        }
        throw err; // already an FslError from whichever provider produced it — preserve its code
      }
    },
  };
}
