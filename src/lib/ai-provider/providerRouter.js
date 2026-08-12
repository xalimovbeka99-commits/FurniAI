/**
 * providerRouter — the piece that makes FurniAI provider-independent.
 * ----------------------------------------------------------------------
 *
 *   User -> FurniAI AI Service -> Provider Router -> {Anthropic, OpenAI}
 *                                       |
 *                                       v
 *                          FurniAI deterministic tools
 *
 * This file knows nothing about furniture, wardrobes, or FSL — it is a
 * generic "try providers in priority order, fail over on provider-level
 * problems only, never hide a real FurniAI error" executor. The two
 * concrete uses (FSL extraction in extractionRouter.js, multi-turn tool
 * chat in chatRouter.js) both build on callWithFailover below.
 */
import { AllProvidersUnavailableError, isRetriableProviderFailure, errorCodeOf } from "./errors.js";

export const KNOWN_PROVIDERS = Object.freeze(["anthropic", "openai"]);
const DEFAULT_ORDER = Object.freeze(["anthropic", "openai"]);

/**
 * Reads AI_PROVIDER_ORDER (comma-separated, e.g. "anthropic,openai" or
 * "openai,anthropic") so priority can be changed from Vercel environment
 * variables without editing code. Unknown tokens are dropped; duplicates
 * are collapsed to their first occurrence; an empty/invalid value falls
 * back to the default order.
 */
export function resolveProviderOrder(envValue = process.env.AI_PROVIDER_ORDER) {
  if (!envValue || typeof envValue !== "string") return [...DEFAULT_ORDER];
  const seen = new Set();
  const order = [];
  for (const token of envValue.split(",")) {
    const name = token.trim().toLowerCase();
    if (KNOWN_PROVIDERS.includes(name) && !seen.has(name)) {
      seen.add(name);
      order.push(name);
    }
  }
  return order.length > 0 ? order : [...DEFAULT_ORDER];
}

/** Server-side-only metadata, safe to log or return in a debug field —
 * never a key, header, or raw provider payload. See Step 9 of the mission. */
function safeAttemptSummary(attempts) {
  return attempts.map((a) => ({ provider: a.provider, outcome: a.outcome, errorCode: a.errorCode ?? null, latencyMs: a.latencyMs ?? null }));
}

function defaultObserve(event) {
  // Structured, secret-free logging — same convention as
  // furnitureGenerationService.js's log(). Swap for the project's real
  // logger later; this is the only call site providerRouter.js uses.
  console.log(JSON.stringify({ event: "ai_provider_call", ...event, at: new Date().toISOString() }));
}

/**
 * Runs `providers[name].run()` for each `name` in `order`, in sequence,
 * skipping unconfigured providers and failing over to the next one only
 * when the thrown error is provider-level-retriable (see
 * isRetriableProviderFailure). A non-retriable error (a real FurniAI
 * engineering/validation error) propagates immediately, on the FIRST
 * provider that produces it — failover must never hide that kind of bug.
 *
 * @param {{
 *   order: string[],
 *   providers: Record<string, { available: boolean, run: () => Promise<any> }>,
 *   observe?: (event: object) => void,
 *   operation?: string,
 * }} args
 * @returns {Promise<{ result: any, provider: string, attempted: Array }>}
 */
export async function callWithFailover({ order, providers, observe = defaultObserve, operation = "unknown" }) {
  const providerRequested = order[0] ?? null;
  const attempts = [];

  for (const name of order) {
    const entry = providers[name];
    if (!entry) continue;
    if (!entry.available) {
      attempts.push({ provider: name, outcome: "skipped_unconfigured" });
      continue;
    }

    const startedAt = Date.now();
    try {
      const result = await entry.run();
      const latencyMs = Date.now() - startedAt;
      attempts.push({ provider: name, outcome: "success", latencyMs });
      observe({
        operation,
        provider_requested: providerRequested,
        provider_used: name,
        fallback_occurred: name !== providerRequested,
        fallback_reason_code: name !== providerRequested ? attempts.find((a) => a.outcome === "failed_retriable")?.errorCode ?? null : null,
        latency_ms: latencyMs,
        attempts: safeAttemptSummary(attempts),
      });
      return { result, provider: name, attempted: attempts };
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      if (!isRetriableProviderFailure(err)) {
        attempts.push({ provider: name, outcome: "failed_fatal", errorCode: errorCodeOf(err), latencyMs });
        observe({
          operation,
          provider_requested: providerRequested,
          provider_used: null,
          fallback_occurred: false,
          fallback_reason_code: null,
          fatal: true,
          latency_ms: latencyMs,
          attempts: safeAttemptSummary(attempts),
        });
        throw err; // a real FurniAI error — never hidden behind a provider switch
      }
      attempts.push({ provider: name, outcome: "failed_retriable", errorCode: errorCodeOf(err), latencyMs });
      // fall through to the next candidate in `order`
    }
  }

  observe({
    operation,
    provider_requested: providerRequested,
    provider_used: null,
    fallback_occurred: attempts.filter((a) => a.outcome !== "skipped_unconfigured").length > 1,
    fallback_reason_code: [...attempts].reverse().find((a) => a.errorCode)?.errorCode ?? null,
    latency_ms: null,
    attempts: safeAttemptSummary(attempts),
    all_failed: true,
  });
  throw new AllProvidersUnavailableError("No AI provider is currently available.", { attempted: attempts });
}
