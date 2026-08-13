/**
 * POST /api/wardrobe/chat
 * ----------------------------------------------------------------------
 * The one HTTP entry point for the Wardrobe AI tool-calling loop
 * (Milestone 6). New, additive route — does not touch or replace
 * /api/v1/furniture/generate. Transport only: parse, run the agent, map
 * the result to a response. All furniture/model logic lives in
 * src/lib/wardrobe-agent + src/lib/wardrobe-tools + src/lib/wardrobe-model.
 *
 * Imports are relative, and responses use the plain Web `Response`
 * constructor instead of `NextResponse`, on purpose: this module is also
 * loaded directly (outside the Next.js build) by the framework-null static
 * site's api/wardrobe/chat.js transport, which bundles with a plain Node/
 * esbuild resolver that understands neither the `@/` path alias nor
 * `next/server` (Next 14's package.json declares no `./server` export
 * subpath for consumers outside its own toolchain). A Route Handler only
 * needs to return a standard Response — NextResponse's extra helpers
 * (cookies/rewrites/redirects) are never used here, so nothing is lost.
 */
import { runWardrobeAgent } from "../../../../lib/wardrobe-agent/runWardrobeAgent.js";
import { createAnthropicWardrobeClient, WardrobeAgentConfigError } from "../../../../lib/wardrobe-agent/client.js";

const MESSAGE_MAX_LENGTH = 2000;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function errorResponse(status, code, error) {
  return jsonResponse({ ok: false, code, error }, status);
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
  if (body.model !== undefined && body.model !== null && (typeof body.model !== "object" || Array.isArray(body.model))) {
    return { error: "`model` must be an object or null." };
  }
  if (body.conversation !== undefined && !Array.isArray(body.conversation)) {
    return { error: "`conversation` must be an array." };
  }
  return {
    request: {
      message: body.message.trim(),
      model: body.model ?? null,
      conversation: body.conversation ?? [],
    },
  };
}

export async function POST(req) {
  let rawBody;
  try {
    rawBody = await req.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const { request, error } = validateBody(rawBody);
  if (error) {
    return errorResponse(400, "INVALID_REQUEST", error);
  }

  let client;
  try {
    client = createAnthropicWardrobeClient();
  } catch (err) {
    if (err instanceof WardrobeAgentConfigError) {
      return errorResponse(503, "AI_PROVIDER_UNAVAILABLE", "The Wardrobe AI is not available right now.");
    }
    throw err;
  }

  try {
    const result = await runWardrobeAgent({ client, ...request });
    return jsonResponse({
      ok: true,
      model: result.model,
      revision: result.revision,
      assistantMessage: result.assistantMessage,
      toolCalls: result.toolCalls.map((c) => ({ name: c.name, input: c.input, result: c.result })),
      conversation: result.conversation,
    });
  } catch (err) {
    if (err?.name === "AgentTimeoutError") {
      return errorResponse(504, "AI_PROVIDER_TIMEOUT", "The Wardrobe AI did not respond in time.");
    }
    console.error("wardrobe agent route error:", err);
    return errorResponse(500, "WARDROBE_AGENT_ERROR", "Something went wrong running the Wardrobe AI.");
  }
}
