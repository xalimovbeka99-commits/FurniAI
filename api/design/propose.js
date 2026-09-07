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
      return send(res, 503, {
        ok: false,
        code: "AI_PROVIDER_UNAVAILABLE",
        error: "The FurniAI designer is not available right now. Your design is unchanged — you can keep editing it directly.",
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
