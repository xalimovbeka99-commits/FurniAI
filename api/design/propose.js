/**
 * POST /api/design/propose
 * ----------------------------------------------------------------------
 * Transport only. The genuinely-deployed entry point for the live design
 * conversation on the framework-null static site: `vercel.json` sets
 * framework null with outputDirectory "dist", and Vercel serves this root
 * `api/` directory as Serverless Functions independently of that static
 * output (verified in production: GET /api/chat and GET /api/wardrobe/chat
 * both answer 405, so root api/*.js is served).
 *
 * Reuses the existing provider stack — createChatProviderRouter, the
 * AI_PROVIDER_ORDER failover policy, the normalized chat clients — rather
 * than adding a second AI system. Provider credentials stay server-side and
 * are never echoed in a response.
 *
 * Returns PROPOSED design edits only. No geometry, no approval, no CNC.
 */
import {
  createChatProviderRouter,
  shouldExposeProviderDebugInfo,
  AllProvidersUnavailableError,
  redactErrorForLogging,
} from "../../src/lib/ai-provider/index.js";
import { MESSAGE_MAX_LENGTH, proposeDesignEdit } from "../../src/lib/ai-designer/proposeDesignEdit.js";

/**
 * Name the provider failure precisely for the operator, while the customer
 * keeps one calm sentence.
 *
 * "Unavailable" used to cover six unrelated conditions, and the most common
 * one in practice — a key the provider actively rejected — is the one it
 * described worst. An operator paged for an "outage" that is really a revoked
 * credential loses the time it takes to discover that nothing is down.
 *
 * `attempted` entries come from `callWithFailover`:
 * `{ provider, outcome, errorCode, latencyMs }`. Providers that were skipped
 * because they have no key are not failures — if every provider was skipped,
 * nothing was configured at all.
 *
 * @param {Array<{provider?: string, outcome?: string, errorCode?: string|null}>} attempted
 * @returns {{ code: string, status: number, customerError: string, operatorNote: string }}
 */
export function classifyUnavailable(attempted = []) {
  const tried = (Array.isArray(attempted) ? attempted : []).filter(
    (a) => a && a.outcome !== "skipped_unconfigured"
  );
  const codes = new Set(tried.map((a) => a.errorCode).filter(Boolean));

  const customerUnavailable =
    "The FurniAI designer is not available right now. Your design is unchanged — you can keep editing it directly.";

  if (tried.length === 0) {
    return {
      code: "AI_PROVIDER_NOT_CONFIGURED",
      status: 503,
      customerError: customerUnavailable,
      operatorNote:
        "No AI provider was attempted because none has credentials configured. Set ANTHROPIC_API_KEY and/or OPENAI_API_KEY server-side. This is a configuration gap, not an outage.",
    };
  }

  if (codes.size > 0 && [...codes].every((c) => c === "AUTH_ERROR" || c === "MISSING_API_KEY")) {
    return {
      code: "AI_PROVIDER_AUTH_REJECTED",
      status: 503,
      customerError: customerUnavailable,
      operatorNote:
        "Every configured provider rejected the credentials (AUTH_ERROR/MISSING_API_KEY). The provider is reachable and answering — this is not an outage. Replace the API key. Note that a rejected key says nothing about whether the configured model id is valid.",
    };
  }

  if (codes.has("QUOTA_EXCEEDED")) {
    return {
      code: "AI_PROVIDER_QUOTA",
      status: 503,
      customerError: customerUnavailable,
      operatorNote:
        "A provider reported QUOTA_EXCEEDED. Billing or usage limits need attention; retrying will not help until they are raised.",
    };
  }

  if (codes.has("RATE_LIMITED")) {
    return {
      code: "AI_PROVIDER_RATE_LIMITED",
      status: 503,
      customerError:
        "The FurniAI designer is busy right now. Your design is unchanged — please try again in a moment.",
      operatorNote:
        "A provider reported RATE_LIMITED. This is transient; retrying after a short delay is appropriate.",
    };
  }

  if (codes.size > 0 && [...codes].every((c) => c === "TIMEOUT")) {
    return {
      code: "AI_PROVIDER_TIMEOUT",
      status: 504,
      customerError: "The FurniAI designer did not respond in time. Your design is unchanged.",
      operatorNote: "Every attempted provider timed out. Check network egress and provider status.",
    };
  }

  if (codes.has("UNAVAILABLE") || codes.has("SERVER_ERROR")) {
    return {
      code: "AI_PROVIDER_UNAVAILABLE",
      status: 503,
      customerError: customerUnavailable,
      operatorNote:
        "A provider was unreachable or returned a server-side error. This is the genuine outage case.",
    };
  }

  return {
    code: "AI_PROVIDER_UNAVAILABLE",
    status: 503,
    customerError: customerUnavailable,
    operatorNote: `No provider succeeded. Observed error codes: ${[...codes].join(", ") || "none reported"}.`,
  };
}

function send(res, status, body) {
  res.setHeader("content-type", "application/json");
  return res.status(status).json(body);
}

function validateBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Request body must be a JSON object." };
  }
  if (typeof body.message !== "string" || body.message.trim().length === 0) {
    return { error: "`message` is required and must be a non-empty string." };
  }
  if (body.message.length > MESSAGE_MAX_LENGTH) {
    return { error: `\`message\` must be ${MESSAGE_MAX_LENGTH} characters or fewer.` };
  }
  if (body.currentFacts !== undefined && (typeof body.currentFacts !== "object" || body.currentFacts === null || Array.isArray(body.currentFacts))) {
    return { error: "`currentFacts` must be an object." };
  }
  if (body.conversation !== undefined && !Array.isArray(body.conversation)) {
    return { error: "`conversation` must be an array." };
  }
  return {
    request: {
      message: body.message.trim(),
      currentFacts: body.currentFacts ?? {},
      conversation: body.conversation ?? [],
      currentBayCount: Number.isInteger(body.currentBayCount) && body.currentBayCount > 0 ? body.currentBayCount : 2,
    },
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { ok: false, code: "METHOD_NOT_ALLOWED", error: "Only POST is supported." });
  }

  let parsedBody = req.body;
  if (typeof parsedBody === "string") {
    try {
      parsedBody = JSON.parse(parsedBody);
    } catch {
      return send(res, 400, { ok: false, code: "INVALID_JSON", error: "Request body must be valid JSON." });
    }
  }

  const { request, error } = validateBody(parsedBody);
  if (error) return send(res, 400, { ok: false, code: "INVALID_REQUEST", error });

  const router = createChatProviderRouter({ operation: "design_propose" });

  try {
    const { result, provider, attempted } = await router.run((client) => proposeDesignEdit({ client, ...request }));

    return send(res, 200, {
      ok: true,
      edits: result.edits,
      unsupported: result.unsupported,
      reply: result.reply,
      rejected: result.errors,
      promptVersion: result.promptVersion,
      ...(shouldExposeProviderDebugInfo()
        ? { provider, fallback: attempted.filter((a) => a.outcome !== "skipped_unconfigured").length > 1 }
        : {}),
    });
  } catch (err) {
    if (err instanceof AllProvidersUnavailableError) {
      const classified = classifyUnavailable(err.attempted);
      // The operator note goes to the server log only. The customer gets one
      // sentence and no provider names, codes or credentials.
      console.error(`design propose unavailable [${classified.code}]: ${classified.operatorNote}`);
      // `code` is safe to return: it names a class of failure, not a secret.
      // `operatorNote` is NOT returned under any flag — it names environment
      // variables and remediation steps, and the verification harness rightly
      // rejects a response body that mentions an API key at all.
      return send(res, classified.status, {
        ok: false,
        code: classified.code,
        error: classified.customerError,
      });
    }
    if (err?.name === "AbortError" || err?.name === "AgentTimeoutError") {
      return send(res, 504, {
        ok: false,
        code: "AI_PROVIDER_TIMEOUT",
        error: "The FurniAI designer did not respond in time. Your design is unchanged.",
      });
    }
    console.error("design propose route error:", redactErrorForLogging(err));
    return send(res, 500, {
      ok: false,
      code: "DESIGN_PROPOSE_ERROR",
      error: "Something went wrong talking to the FurniAI designer. Your design is unchanged.",
    });
  }
}
