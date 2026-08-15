/**
 * WhatsApp webhook
 *   GET  /api/whatsapp/webhook  -> Meta verification handshake
 *   POST /api/whatsapp/webhook  -> inbound customer message -> Sales Agent -> reply
 *
 * Conversation memory is kept in-process (a Map). That's fine for an MVP on a
 * single instance. When you scale to multiple instances, swap this Map for a
 * shared store (Redis or a `conversations` table) — the interface is tiny, so
 * the change is contained to the two helper functions below.
 */
import { NextResponse } from "next/server";
import { parseInbound, sendText, verifyWebhook } from "@/lib/whatsapp";
import { runSalesAgent } from "@/lib/salesAgent";
import { redactErrorForLogging } from "@/lib/ai-provider";

// --- minimal in-memory conversation store ---------------------------------
const conversations = new Map(); // phone -> [{role, content}, ...]
const MAX_TURNS = 20;

function getHistory(phone) {
  return conversations.get(phone) || [];
}
function pushTurn(phone, role, content) {
  const hist = getHistory(phone);
  hist.push({ role, content });
  conversations.set(phone, hist.slice(-MAX_TURNS));
}

// --- GET: verification ------------------------------------------------------
export async function GET(req) {
  const challenge = verifyWebhook(new URL(req.url).searchParams);
  if (challenge) return new Response(challenge, { status: 200 });
  return new Response("Forbidden", { status: 403 });
}

// --- POST: inbound message --------------------------------------------------
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true }); // always 200 so Meta doesn't retry-storm
  }

  const inbound = parseInbound(body);
  if (!inbound) return NextResponse.json({ ok: true });

  // Respond to Meta immediately; do the slow work without blocking the ack.
  handleMessage(inbound).catch((err) => console.error("whatsapp handler:", redactErrorForLogging(err)));
  return NextResponse.json({ ok: true });
}

async function handleMessage({ from, text }) {
  pushTurn(from, "user", text);
  try {
    const { reply } = await runSalesAgent({ messages: getHistory(from) });
    pushTurn(from, "assistant", reply);
    await sendText(from, reply);
  } catch (err) {
    console.error("sales agent / send error:", redactErrorForLogging(err));
    await sendText(from, "Sorry — something went wrong on our side. Please try again in a moment.").catch(() => {});
  }
}
