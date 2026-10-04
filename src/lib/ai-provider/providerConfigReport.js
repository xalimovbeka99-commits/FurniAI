/**
 * What the AI designer WOULD do in this runtime, decided from configuration
 * alone — no provider is contacted, nothing is billed, no credential value
 * leaves this function.
 *
 * WHY
 *
 * Preview and Production both answer `503 AI_PROVIDER_NOT_CONFIGURED`, which
 * the router returns only when every provider was skipped because
 * `Boolean(process.env.<KEY>)` was false inside the function. The Vercel
 * dashboard nevertheless lists ANTHROPIC_API_KEY / OPENAI_API_KEY rows for
 * "Production and Preview". Those two facts are compatible in more than one
 * way, and they call for different fixes:
 *
 *   absent  — the variable is not in this function's environment at all
 *             (different Vercel project, wrong environment scope, or no
 *             redeploy since it was added);
 *   empty   — it is present with an empty/whitespace value (a row saved
 *             without a value).
 *
 * `Boolean("")` and `Boolean(undefined)` are both false, so the router cannot
 * tell them apart. This report can, without revealing anything but the state.
 *
 * "configured" never means "works": a present key can still be rejected.
 * Only a real call proves that, and a real call needs authorization.
 */
import { resolveProviderOrder } from "./providerRouter.js";
import { DEFAULT_ANTHROPIC_MODEL } from "./anthropicChatClient.js";

function stateOf(value) {
  if (value === undefined || value === null) return "absent";
  if (typeof value !== "string" || value === "") return "empty";
  // Boolean("   ") is TRUE, so the router WILL attempt a whitespace-only key
  // (and the provider will reject it). Name it rather than calling it empty.
  if (value.trim() === "") return "whitespace-only";
  return "configured";
}

function keyShape(value, pattern) {
  if (stateOf(value) !== "configured") return null;
  const v = value.trim();
  if (v !== value) return "has-surrounding-whitespace";
  if (/^["'].*["']$/.test(v)) return "wrapped-in-quotes";
  return pattern.test(v) ? "expected-prefix" : "unexpected-prefix";
}

/**
 * @param {Record<string, string|undefined>} env
 * @returns {object} safe to return to an operator; contains no credential material
 */
/**
 * The Supabase project that issues the Studio's sign-in tokens. It is public
 * (it ships in index.html with the anon key). /api/designs verifies a token
 * against SUPABASE_URL, so if SUPABASE_URL names ANY other project every
 * signed-in save answers 401 MISSING_AUTH. Override per deployment with
 * FURNIAI_FRONTEND_AUTH_PROJECT_REF when the Studio is pointed elsewhere.
 */
export const STUDIO_AUTH_PROJECT_REF = "upavdjmovubblowrxncp";

/** "<ref>" from https://<ref>.supabase.co — a public identifier, never a key. */
export function supabaseProjectRef(url) {
  if (typeof url !== "string" || !url.trim()) return null;
  try {
    const host = new URL(url.trim()).hostname;
    const m = /^([a-z0-9]{20})\.supabase\.(co|in)$/.exec(host);
    return m ? m[1] : `non-supabase-host:${host}`;
  } catch {
    return "unparseable-url";
  }
}

export function describeProviderConfig(env = process.env) {
  const anthropic = {
    state: stateOf(env.ANTHROPIC_API_KEY),
    shape: keyShape(env.ANTHROPIC_API_KEY, /^sk-ant-/),
    model: stateOf(env.ANTHROPIC_MODEL) === "configured" ? env.ANTHROPIC_MODEL.trim() : DEFAULT_ANTHROPIC_MODEL,
    modelSource: stateOf(env.ANTHROPIC_MODEL) === "configured" ? "ANTHROPIC_MODEL" : "built-in default",
  };
  const openai = {
    state: stateOf(env.OPENAI_API_KEY),
    shape: keyShape(env.OPENAI_API_KEY, /^sk-/),
    modelSource: stateOf(env.OPENAI_MODEL) === "configured" ? "OPENAI_MODEL" : "built-in default",
  };
  const order = resolveProviderOrder(env.AI_PROVIDER_ORDER);
  // The router's own test is Boolean(key) — mirror it exactly, not our nicer states.
  const wouldAttempt = order.filter((name) => Boolean(env[name === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY"]));

  const supabase = {
    SUPABASE_URL: stateOf(env.SUPABASE_URL),
    SUPABASE_ANON_KEY: stateOf(env.SUPABASE_ANON_KEY),
    // The prefixed names are read by nothing in this repository.
    prefixedOnly:
      stateOf(env.SUPABASE_URL) !== "configured" &&
      (stateOf(env.NEXT_PUBLIC_SUPABASE_URL) === "configured" || stateOf(env.NEXT_PUBLIC_SUPABASE_ANON_KEY) === "configured"),
    projectRef: supabaseProjectRef(env.SUPABASE_URL),
    studioAuthProjectRef:
      stateOf(env.FURNIAI_FRONTEND_AUTH_PROJECT_REF) === "configured"
        ? env.FURNIAI_FRONTEND_AUTH_PROJECT_REF.trim()
        : STUDIO_AUTH_PROJECT_REF,
  };
  // null = cannot tell (no SUPABASE_URL). false = every Studio sign-in token
  // will be refused by /api/designs on this deployment.
  supabase.acceptsStudioSignIn = supabase.projectRef === null ? null : supabase.projectRef === supabase.studioAuthProjectRef;

  let verdict;
  if (wouldAttempt.length === 0) {
    const states = [anthropic.state, openai.state];
    verdict = states.includes("empty")
      ? "NOT_CONFIGURED_EMPTY_VALUE"
      : "NOT_CONFIGURED_ABSENT";
  } else {
    verdict = "CONFIGURED_UNVERIFIED";
  }

  return {
    runtime: { vercelEnv: env.VERCEL_ENV ?? null, nodeEnv: env.NODE_ENV ?? null },
    providers: { anthropic, openai },
    order,
    wouldAttempt,
    verdict,
    meaning: {
      NOT_CONFIGURED_ABSENT:
        "No provider key is in this function's environment. Check the variable exists in THIS Vercel project, is scoped to THIS environment (Preview vs Production), and that a redeploy happened after it was added.",
      NOT_CONFIGURED_EMPTY_VALUE:
        "A provider key variable exists here but its value is empty. Re-enter the value in the dashboard, save, and redeploy.",
      CONFIGURED_UNVERIFIED:
        "A key is present. That does not prove it is valid, funded, or allowed to use the configured model — only an authorized live call proves that.",
    }[verdict],
    persistence: { configured: supabase.SUPABASE_URL === "configured" && supabase.SUPABASE_ANON_KEY === "configured", ...supabase },
    founderPreview: env.FURNIAI_FOUNDER_PREVIEW === "true",
    liveCallMade: false,
  };
}
