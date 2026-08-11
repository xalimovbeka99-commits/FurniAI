/**
 * client — the real Anthropic client for runWardrobeAgent.js.
 * ---------------------------------------------------------------------
 * Just an `Anthropic` SDK instance: it already exposes
 * `.messages.create(...)`, the exact shape runWardrobeAgent.js expects (and
 * the exact shape fakeWardrobeAgentProvider.js mimics for tests). No
 * wrapping needed, same SDK/env var already used in
 * src/lib/ai-provider/anthropicProvider.js.
 */
import Anthropic from "@anthropic-ai/sdk";

export class WardrobeAgentConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "WardrobeAgentConfigError";
  }
}

export function createAnthropicWardrobeClient({ apiKey = process.env.ANTHROPIC_API_KEY } = {}) {
  if (!apiKey) {
    throw new WardrobeAgentConfigError("ANTHROPIC_API_KEY is not configured on the server.");
  }
  return new Anthropic({ apiKey });
}
