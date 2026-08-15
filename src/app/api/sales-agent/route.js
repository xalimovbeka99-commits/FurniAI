/**
 * POST /api/sales-agent
 * Body: { messages: [{ role: "user"|"assistant", content: string }, ...] }
 * Returns: { reply }
 *
 * Stateless: the client sends the full conversation each time. Persist it
 * client-side (or later in your DB) and replay it here.
 */
import { NextResponse } from "next/server";
import { runSalesAgent } from "@/lib/salesAgent";
import { redactErrorForLogging } from "@/lib/ai-provider";

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = Array.isArray(body?.messages) ? body.messages : null;
  if (!messages || messages.length === 0) {
    return NextResponse.json(
      { error: "Body must include a non-empty `messages` array" },
      { status: 400 }
    );
  }

  try {
    const result = await runSalesAgent({ messages });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err?.message === "AI_PROVIDER_UNAVAILABLE") {
      return NextResponse.json({ error: "The sales agent is not available right now." }, { status: 503 });
    }
    // Log a redacted summary, never the raw error — a ProviderError's
    // .cause can wrap the raw SDK error (headers, request bodies), and
    // Node's console.error prints .cause unconditionally even when it's
    // non-enumerable. See ai-provider/errors.js's redactErrorForLogging.
    console.error("sales-agent error:", redactErrorForLogging(err));
    return NextResponse.json({ error: "Agent failed" }, { status: 500 });
  }
}
