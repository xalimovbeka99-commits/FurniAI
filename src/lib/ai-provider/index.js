/**
 * AI Provider Adapter — the replaceable boundary (Section 4).
 * ----------------------------------------------------------------------
 * FurnitureBrain depends only on this shape:
 *
 *   interface FurnitureAIProvider {
 *     extractRequirements(message: string, attachments?: Attachment[]): Promise<ExtractionResult>
 *   }
 *
 * Attachment = { kind: "image" | "document", mediaType: string, data: string (base64) }
 * — photos, hand drawings, or a PDF the user attached (Pillar 1: multi-
 * channel input). Optional; omit or pass [] for text-only requests.
 *
 * ExtractionResult is defined by ./extractionSchema.js's tool schema, not
 * by FSL — see promptTemplate.js and anthropicProvider.js for why the
 * model's job is narrow extraction, not FSL assembly. Swapping to OpenAI/
 * Gemini/etc. means writing one new file that satisfies this same shape;
 * nothing in furniture-brain or above needs to change.
 */
export { createAnthropicProvider } from "./anthropicProvider.js";
export { createOpenAIProvider } from "./openaiProvider.js";
export { createExtractionAiProvider } from "./extractionRouter.js";
export { createFakeProvider } from "./fakeProvider.js";
export { PROMPT_VERSION, buildSystemPrompt } from "./promptTemplate.js";
export { resolveProviderOrder, callWithFailover, KNOWN_PROVIDERS } from "./providerRouter.js";
export { ProviderError, PROVIDER_ERROR_CODES, AllProvidersUnavailableError, isRetriableProviderFailure, classifySdkError, toFslProviderError, redactErrorForLogging } from "./errors.js";
export { createAnthropicChatClient } from "./anthropicChatClient.js";
export { createOpenAIChatClient } from "./openaiChatAdapter.js";
export { createChatProviderRouter, shouldExposeProviderDebugInfo } from "./chatRouter.js";
