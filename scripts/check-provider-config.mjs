#!/usr/bin/env node
/**
 * scripts/check-provider-config.mjs
 * ---------------------------------------------------------------------
 * Answers one question precisely: if the FurniAI designer is not working,
 * WHICH failure is it — configuration, network, authentication, quota,
 * model access, or an application error?
 *
 * "The FurniAI designer is not available right now" is the right thing to tell
 * a customer and useless to an operator. This tells the operator.
 *
 * Never prints a credential. Makes at most ONE 1-token probe, and only when a
 * key is present; a rejected key fails at 401 and costs nothing.
 *
 *   node scripts/check-provider-config.mjs
 *
 * Exit: 0 ok · 1 not configured · 2 auth · 3 quota/rate/outage ·
 *       4 model access · 5 network · 6 application error
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const RULE = "=".repeat(84);
const say = (k, v) => console.log(`  ${k.padEnd(22)}: ${v}`);
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

const envFile = path.join(ROOT, ".env.local");
const fromFile = [];
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, "");
    if (value === "") continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
    fromFile.push(m[1]);
  }
}

const key = process.env.ANTHROPIC_API_KEY || "";
const { DEFAULT_ANTHROPIC_MODEL } = await imp("src/lib/ai-provider/anthropicChatClient.js");
const model = process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;

console.log(RULE);
console.log("FurniAI — AI provider configuration check");
console.log(RULE);
say(".env.local", existsSync(envFile) ? `present (${fromFile.length} key(s): ${fromFile.join(", ")})` : "not present");
say("ANTHROPIC_API_KEY", key ? `configured — ${key.length} chars, prefix ${key.slice(0, 12)}…` : "ABSENT");
say("OPENAI_API_KEY", process.env.OPENAI_API_KEY ? "configured" : "absent");
say("AI_PROVIDER_ORDER", process.env.AI_PROVIDER_ORDER || "unset (default anthropic,openai)");
say("model the app will use", model + (process.env.ANTHROPIC_MODEL ? " (from ANTHROPIC_MODEL)" : " (built-in default)"));

function finish(verdict, code, action, relay) {
  if (relay) relay.close();
  console.log("\n" + RULE);
  console.log(`VERDICT: ${verdict}`);
  console.log(`ACTION : ${action}`);
  console.log(RULE);
  process.exit(code);
}

if (!key) {
  finish("NOT CONFIGURED — no Anthropic credential present", 1,
    "Set ANTHROPIC_API_KEY in .env.local locally and in the Vercel project. Until then /api/design/propose answers 503 AI_PROVIDER_NOT_CONFIGURED, which is correct behaviour, not a crash.");
}

console.log("\nprobing the provider with one 1-token request…");
const Anthropic = (await import("@anthropic-ai/sdk")).default;

async function attempt(baseURL) {
  const client = new Anthropic({ apiKey: key, maxRetries: 0, ...(baseURL ? { baseURL } : {}) });
  return client.messages.create({ model, max_tokens: 1, messages: [{ role: "user", content: "hi" }] });
}

let relay = null;
for (let pass = 0; pass < 2; pass += 1) {
  try {
    const r = await attempt(relay?.baseUrl);
    say("model answered", r.model);
    say("stop reason", r.stop_reason);
    finish(`OK — ${r.model} responded${relay ? " (via the local relay)" : ""}`, 0,
      "Provider access is healthy. Run `npm run verify:live-designer`, then the bounded live test.", relay);
  } catch (err) {
    const status = err?.status ?? null;
    const cause = String(err?.cause?.message ?? err?.message ?? "");

    // No HTTP response and it looks like DNS: this sandbox has no resolver for
    // node. Retry once through the curl relay before calling it a network fault.
    if (!status && /EAI_AGAIN|ENOTFOUND|getaddrinfo|Connection error|fetch failed/i.test(cause) && pass === 0 && !relay) {
      console.log("  no direct connection (looks like missing DNS) — retrying through the local curl relay…");
      relay = await (await imp("scripts/anthropic-relay.mjs")).startAnthropicRelay();
      continue;
    }

    const type = err?.error?.error?.type ?? "";
    const message = String(err?.error?.error?.message ?? err?.message ?? "").replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED]");
    say("HTTP status", status ?? "(none — no HTTP response received)");
    say("provider error type", type || "(none)");
    say("message", message.slice(0, 180));

    if (status === 401 || status === 403 || /authentication|permission/i.test(type)) {
      finish("AUTHENTICATION — a key IS configured and the provider rejected it", 2,
        "Replace ANTHROPIC_API_KEY with a currently-valid key from console.anthropic.com and confirm the org has credit. A key's FORMAT does not prove it is valid. This is not an outage.", relay);
    }
    if (status === 404 || /not_found/i.test(type)) {
      finish(`MODEL ACCESS — credential accepted, but "${model}" was rejected`, 4,
        "Set ANTHROPIC_MODEL to a model this account can use (platform.claude.com/docs/en/models/overview) in .env.local and in Vercel.", relay);
    }
    if (status === 429 || /rate_limit/i.test(type)) {
      finish("RATE LIMITED / QUOTA — throttled or out of credit", 3, "Check plan limits and billing at console.anthropic.com.", relay);
    }
    if (status && status >= 500) {
      finish("PROVIDER OUTAGE — the provider returned a server error", 3,
        "Retry later. The application handled this correctly by returning 503.", relay);
    }
    if (!status) {
      finish("NETWORK — no HTTP response was received at all", 5,
        "The request never reached the provider. Confirm with: curl -s -o /dev/null -w '%{http_code}' https://api.anthropic.com/ — if curl works but node does not, node has no DNS and needs scripts/anthropic-relay.mjs.", relay);
    }
    finish(`APPLICATION ERROR — unexpected ${err?.name ?? "Error"} (HTTP ${status})`, 6, "Not a provider problem; investigate the application.", relay);
  }
}
