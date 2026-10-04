#!/usr/bin/env node
/**
 * scripts/live-accept-preview.mjs — BOUNDED live acceptance of the AI designer
 * on a deployed PREVIEW. Prepared 2026-09-30; NOT RUN.
 *
 *   node scripts/live-accept-preview.mjs --preview https://<preview-host> [--confirm-host <host>]
 *        → zero-cost: GET /api/design/health only, prints the configuration verdict.
 *
 *   FURNIAI_LIVE_TEST_AUTHORIZED=yes node scripts/live-accept-preview.mjs \
 *        --preview https://<preview-host> --confirm-host <host> --live [--max-calls 3]
 *        → at most --max-calls (hard ceiling 5) POSTs to /api/design/propose.
 *
 * Refuses: without --preview; a host that does not look like a Vercel preview
 * (…-git-…/…-<hash>-….vercel.app) unless typed again as --confirm-host; a
 * health answer that is 404 (Production answers 404) or not
 * CONFIGURED_UNVERIFIED; --live without FURNIAI_LIVE_TEST_AUTHORIZED=yes.
 * Prints status, code, edit keys and latency only — never a response body,
 * header, key, or provider payload.
 */
const argv = process.argv.slice(2);
const opt = (n) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : undefined);
const has = (n) => argv.includes(n);

const HARD_CEILING = 5;
const CASES = [
  { id: "supported-width", message: "could you make it 2000 mm wide please", expect: "edits" },
  { id: "unsupported-sliding", message: "can the doors be sliding doors instead", expect: "unsupported-or-no-edits" },
  { id: "ambiguous", message: "make it a bit nicer", expect: "no-geometry-without-clear-intent" },
];

function fail(msg, code = 2) {
  process.stderr.write(`REFUSED: ${msg}\n`);
  process.exit(code);
}

const preview = opt("--preview");
if (!preview) fail("--preview <https://…> is required");
let url;
try { url = new URL(preview); } catch { fail("--preview is not a URL"); }
if (url.protocol !== "https:") fail("--preview must be https");
const looksPreview = /\.vercel\.app$/.test(url.hostname) && /-git-|-[a-z0-9]{9}-/.test(url.hostname);
if (!looksPreview && opt("--confirm-host") !== url.hostname) {
  fail(`${url.hostname} does not look like a Vercel preview; retype it with --confirm-host to proceed`);
}

const base = `${url.protocol}//${url.host}`;
const health = await fetch(`${base}/api/design/health`, { headers: { accept: "application/json" } });
if (health.status === 404) fail("health is 404 — Production, or a deployment without /api/design/health");
if (!health.ok) fail(`health answered ${health.status}`);
const h = await health.json();
const summary = {
  vercelEnv: h.runtime?.vercelEnv,
  verdict: h.verdict,
  order: h.order,
  wouldAttempt: h.wouldAttempt,
  anthropic: { state: h.providers?.anthropic?.state, shape: h.providers?.anthropic?.shape, model: h.providers?.anthropic?.model },
  openai: { state: h.providers?.openai?.state, shape: h.providers?.openai?.shape },
  persistence: {
    configured: h.persistence?.configured,
    projectRef: h.persistence?.projectRef,
    acceptsStudioSignIn: h.persistence?.acceptsStudioSignIn,
  },
};
process.stdout.write(`health ${base}\n${JSON.stringify(summary, null, 2)}\n`);
if (h.runtime?.vercelEnv === "production") fail("deployment reports VERCEL_ENV=production");
if (!has("--live")) {
  process.stdout.write("zero-cost check complete; no provider call made.\n");
  process.exit(0);
}

if (process.env.FURNIAI_LIVE_TEST_AUTHORIZED !== "yes") fail("--live needs FURNIAI_LIVE_TEST_AUTHORIZED=yes (paid calls)");
if (h.verdict !== "CONFIGURED_UNVERIFIED") fail(`verdict is ${h.verdict}; a live call would not reach a provider`);
const maxCalls = Math.min(HARD_CEILING, Math.max(1, Number(opt("--max-calls") ?? 3)));

let calls = 0;
for (const c of CASES) {
  if (calls >= maxCalls) break;
  calls += 1;
  const t0 = Date.now();
  let status = 0;
  let out = {};
  try {
    const r = await fetch(`${base}/api/design/propose`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: c.message, currentFacts: {}, conversation: [] }),
    });
    status = r.status;
    const b = await r.json().catch(() => ({}));
    out = {
      ok: b.ok === true,
      code: b.code ?? null,
      editKeys: Array.isArray(b.edits) ? b.edits.map((e) => e?.key).filter(Boolean) : [],
      unsupported: Array.isArray(b.unsupported) ? b.unsupported.length : 0,
      providerFieldPresent: Object.prototype.hasOwnProperty.call(b, "provider"),
    };
  } catch (err) {
    out = { transportError: err?.name || "Error" };
  }
  process.stdout.write(`${JSON.stringify({ case: c.id, expect: c.expect, status, ms: Date.now() - t0, ...out })}\n`);
}
process.stdout.write(`live calls made: ${calls} (ceiling ${maxCalls}). Record provider-side token usage from the provider dashboard.\n`);
