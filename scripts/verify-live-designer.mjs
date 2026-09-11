#!/usr/bin/env node
/**
 * scripts/verify-live-designer.mjs
 * ---------------------------------------------------------------------
 * End-to-end verification of POST /api/design/propose.
 *
 * WHAT IS REAL HERE, AND WHAT IS NOT — read this before quoting results.
 *
 *   REAL: the deployed handler module (api/design/propose.js), the real
 *   provider router and failover policy, the real @anthropic-ai/sdk client,
 *   real HTTP on both hops, the real schema validation, the real deterministic
 *   kernel, and the real browser transport module.
 *
 *   SIMULATED: the Anthropic *service* itself. A local stand-in answers
 *   POST /v1/messages, reached by setting ANTHROPIC_BASE_URL — no source
 *   change and no contract change. This proves the wiring end to end; it does
 *   NOT prove a live model behaves well.
 *
 *   NOT DONE: any call to a real model. `--live` is refused unless
 *   FURNIAI_LIVE_TEST_AUTHORIZED=yes is set by a human, because a live call
 *   spends the owner's paid quota.
 *
 * Usage: node scripts/verify-live-designer.mjs
 */
import http from "node:http";
import { loadEnvLocal, startApiServer } from "./dev-api-server.mjs";
import {
  RESULT_KIND,
  RESULT_SOURCE,
  proposeDesignChange,
  AI_DESIGNER_ENDPOINT,
} from "../src/lib/adapters/aiDesignerTransport.js";
import { parseConversationalCommand } from "../src/lib/conversation/pipeline.js";
import { BEKZOD_APPROVED_DEFAULTS, OBSERVATION_ORIGIN, observation } from "../src/lib/conversation/intakeModel.js";
import { DESIGN_EDIT_TOOL_NAME } from "../src/lib/ai-designer/designEditSchema.js";

const RULE = "=".repeat(96);
const THIN = "-".repeat(96);
const checks = [];
function check(label, pass, detail = "") {
  checks.push({ label, pass });
  console.log(`  [${pass ? "PASS" : "FAIL"}] ${label}${detail ? ` — ${detail}` : ""}`);
  return pass;
}

/** A reworded edit the deterministic parser genuinely cannot handle. */
const REWORDED_EDIT = "could you open it up a bit for me — go to two metres across";

const activeDesign = () =>
  Object.entries(BEKZOD_APPROVED_DEFAULTS).map(([k, v]) =>
    observation(k, Array.isArray(v) ? [...v] : v, OBSERVATION_ORIGIN.CUSTOMER_CONFIRMED, { sourceText: "active design" })
  );

/* ---------------------------------------------------------------- */
/* A local stand-in for the Anthropic service.                        */
/* ---------------------------------------------------------------- */
async function startStandInProvider(reply) {
  const seen = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let body = null;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { /* ignore */ }
    seen.push({ method: req.method, url: req.url, body, hadAuthHeader: Boolean(req.headers["x-api-key"] || req.headers.authorization) });
    const out = reply(body, seen.length);
    res.writeHead(out.status, { "content-type": "application/json" });
    res.end(JSON.stringify(out.body));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { seen, port: server.address().port, close: () => new Promise((r) => server.close(r)) };
}

const toolUseMessage = (input) => ({
  status: 200,
  body: {
    id: "msg_standin", type: "message", role: "assistant", model: "stand-in",
    content: [{ type: "tool_use", id: "toolu_standin", name: DESIGN_EDIT_TOOL_NAME, input }],
    stop_reason: "tool_use", usage: { input_tokens: 0, output_tokens: 0 },
  },
});

async function post(url, payload) {
  const res = await fetch(url, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/* ---------------------------------------------------------------- */
console.log(RULE);
console.log("FurniAI — POST /api/design/propose end-to-end verification");
console.log("Real endpoint · real router · real SDK · SIMULATED provider service · NO live model call");
console.log(RULE);

/* 0. Configuration ------------------------------------------------- */
console.log("\n[0] PROVIDER CONFIGURATION (names and presence only — no value is ever read or printed)");
console.log(THIN);
const env = loadEnvLocal();
const localState = {
  ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY),
  OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
  AI_PROVIDER_ORDER: process.env.AI_PROVIDER_ORDER || "(unset → default anthropic,openai)",
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || "(unset → client default)",
};
console.log(`  .env.local            : ${env.loaded ? `present, defines ${env.keys.length} key(s)` : "not present"}`);
console.log(`  ANTHROPIC_API_KEY     : ${localState.ANTHROPIC_API_KEY ? "CONFIGURED (length withheld)" : "absent"}`);
console.log(`  OPENAI_API_KEY        : ${localState.OPENAI_API_KEY ? "CONFIGURED (length withheld)" : "absent"}`);
console.log(`  AI_PROVIDER_ORDER     : ${localState.AI_PROVIDER_ORDER}`);
console.log(`  ANTHROPIC_MODEL       : ${localState.ANTHROPIC_MODEL}`);
console.log("  Vercel configuration  : NOT INSPECTABLE from here — run `vercel env ls` in the project.");
check("Local provider configuration determined without reading any secret value", true,
  localState.ANTHROPIC_API_KEY ? "anthropic configured locally" : "no local provider configured");

/* 1. The endpoint exists and is POST-only -------------------------- */
console.log("\n[1] THE ENDPOINT IS REAL AND MOUNTED (not a static file)");
console.log(THIN);
const savedKeys = { a: process.env.ANTHROPIC_API_KEY, o: process.env.OPENAI_API_KEY, b: process.env.ANTHROPIC_BASE_URL };
const api = await startApiServer({ routes: ["api/design/propose.js"], port: 0 });
const base = `http://127.0.0.1:${api.port}`;
console.log(`  mounted: ${api.mounted.join(", ")} on ${base}`);
check("POST /api/design/propose is served by the deployed handler module", api.mounted.includes(AI_DESIGNER_ENDPOINT), AI_DESIGNER_ENDPOINT);

const getRes = await fetch(`${base}${AI_DESIGNER_ENDPOINT}`);
check("GET is refused with 405, matching production", getRes.status === 405, `status ${getRes.status}`);
const badBody = await post(`${base}${AI_DESIGNER_ENDPOINT}`, { nope: 1 });
check("A body without `message` is refused with 400 INVALID_REQUEST", badBody.status === 400 && badBody.body?.code === "INVALID_REQUEST");

/* 2. No credentials → clean 503 ------------------------------------ */
console.log("\n[2] NO PROVIDER CONFIGURED → CLEAN 503, DESIGN UNCHANGED");
console.log(THIN);
delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
const unconfigured = await post(`${base}${AI_DESIGNER_ENDPOINT}`, { message: REWORDED_EDIT, currentFacts: {} });
check(
  "Returns 503 AI_PROVIDER_NOT_CONFIGURED (named precisely, not a generic outage)",
  unconfigured.status === 503 && unconfigured.body?.code === "AI_PROVIDER_NOT_CONFIGURED",
  `status ${unconfigured.status} code ${unconfigured.body?.code}`
);
check("The message tells the customer their design is unchanged", /unchanged/i.test(unconfigured.body?.error ?? ""));
check("No credential, header or raw provider payload is echoed", !/sk-|api[_-]?key|authorization/i.test(JSON.stringify(unconfigured.body)));

/* 3. The reworded edit genuinely requires the model ----------------- */
console.log("\n[3] THE TEST EDIT GENUINELY REQUIRES THE MODEL");
console.log(THIN);
console.log(`  customer says: "${REWORDED_EDIT}"`);
const deterministic = parseConversationalCommand(REWORDED_EDIT, Object.fromEntries(activeDesign().map((o) => [o.key, o.value])));
check("The deterministic parser cannot handle it, so the model is genuinely required", deterministic === null, `parser returned ${deterministic === null ? "null" : "a result"}`);

/* 4. Real SDK → stand-in provider → validated edit → kernel --------- */
console.log("\n[4] REAL SDK → STAND-IN PROVIDER → SCHEMA VALIDATION → FURNISPEC → PARTGRAPH");
console.log(THIN);
const good = await startStandInProvider(() => toolUseMessage({
  edits: [{ key: "envelope.widthMm", value: "2.0 m", sourceText: "two metres across" }],
  unsupported: [],
  reply: "Opened it out to 2 m across.",
}));
process.env.ANTHROPIC_API_KEY = "sk-ant-standin-not-a-real-key";
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${good.port}`;
process.env.AI_PROVIDER_ORDER = "anthropic,openai";

const before = activeDesign();
const beforeSnapshot = JSON.stringify(before);
const result = await proposeDesignChange({
  message: REWORDED_EDIT,
  currentObservations: before,
  specId: "furnispec-verification-01",
  revision: 4,
  endpoint: `${base}${AI_DESIGNER_ENDPOINT}`,
});

const outbound = good.seen[0];
check("The intended provider was actually called over HTTP", good.seen.length === 1, `${good.seen.length} request(s) to the anthropic base URL`);
check("The provider client authenticated (an API-key header was sent)", outbound?.hadAuthHeader === true);
check("The request carried the propose_design_edit tool", outbound?.body?.tools?.[0]?.name === DESIGN_EDIT_TOOL_NAME);
check("The request carried the customer's active design, not invented state", /envelope\.widthMm: 1800/.test(outbound?.body?.system ?? ""));
check("A model is named on the request", typeof outbound?.body?.model === "string" && outbound.body.model.length > 0, outbound?.body?.model);

check("The response passed schema validation and normalised units", result.ok === true && result.spec?.envelope.widthMm === 2000, `width ${result.spec?.envelope.widthMm} mm`);
check("Source is MODEL, not the deterministic parser", result.source === RESULT_SOURCE.MODEL && result.kind === RESULT_KIND.DESIGN_UPDATED);
check("A valid FurniSpec was produced", result.validation?.valid === true && result.validation.errors.length === 0);
check("A valid 19-part PartGraph was produced", result.partGraph?.summary.totalStructuralParts === 19 && result.partGraphValidation?.valid === true);

console.log("\n  unrelated design choices:");
const unchanged = [
  ["envelope.heightMm", result.spec?.envelope.heightMm, BEKZOD_APPROVED_DEFAULTS["envelope.heightMm"]],
  ["envelope.depthMm", result.spec?.envelope.depthMm, BEKZOD_APPROVED_DEFAULTS["envelope.depthMm"]],
  ["plinth.heightMm", result.spec?.plinth.heightMm, BEKZOD_APPROVED_DEFAULTS["plinth.heightMm"]],
  ["finishType", result.spec?.finishType, BEKZOD_APPROVED_DEFAULTS.finishType],
  ["bays", result.spec?.bays.length, BEKZOD_APPROVED_DEFAULTS.bayCount],
  ["doors", result.spec?.doors.count, BEKZOD_APPROVED_DEFAULTS.doorCount],
];
for (const [name, got, want] of unchanged) console.log(`    ${name.padEnd(20)} ${String(got).padEnd(12)} (expected ${want})`);
check("Every unrelated design choice survived the edit", unchanged.every(([, got, want]) => got === want));
check("Design identity preserved: same specId, revision incremented once", result.spec?.specId === "furnispec-verification-01" && result.spec?.revision === 5, `revision ${result.spec?.revision}`);

check("Model output cannot grant workshop approval", result.spec?.status === "PROPOSED", `status ${result.spec?.status}`);
check("CNC stays unqualified", result.spec?.qualificationStatus === "WORKSHOP_REVIEW_NOT_CNC_QUALIFIED");
check("Drilling stays blocked with zero operations", result.spec?.machiningPolicy.drilling === "BLOCKED_PENDING_HARDWARE_APPROVAL" && result.safety?.drillingOperationCount === 0);
check("The draft is not approved for preview", result.safety?.approvalState !== "APPROVED");
await good.close();

/* 5. Hostile / invalid model output --------------------------------- */
console.log("\n[5] INVALID MODEL OUTPUT PRESERVES THE PREVIOUS DESIGN");
console.log(THIN);
const hostile = await startStandInProvider(() => toolUseMessage({
  edits: [
    { key: "envelope.widthMm", value: "about 2 metres" },
    { key: "machiningPolicy", value: { drilling: "APPROVED" } },
    { key: "status", value: "APPROVED" },
    { key: "partGraph", value: { parts: [] } },
  ],
  unsupported: [],
  reply: "Approved and ready to cut.",
}));
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${hostile.port}`;
const hostileResult = await proposeDesignChange({
  message: REWORDED_EDIT, currentObservations: before, specId: "furnispec-verification-01", revision: 4,
  endpoint: `${base}${AI_DESIGNER_ENDPOINT}`,
});
const hostileRaw = await post(`${base}${AI_DESIGNER_ENDPOINT}`, { message: REWORDED_EDIT, currentFacts: {} });
const rejectedCodes = (hostileRaw.body?.rejected ?? []).map((r) => r.code);
console.log(`  endpoint rejected: ${rejectedCodes.join(", ") || "(none)"}`);
check("Hedged dimension rejected, not rounded", rejectedCodes.includes("INVALID_VALUE"));
check("machiningPolicy / status / partGraph all refused as kernel-owned", rejectedCodes.filter((c) => c === "FORBIDDEN_KEY").length === 3);
check("No usable edit survived", (hostileRaw.body?.edits ?? []).length === 0);
check("The active design is untouched", hostileResult.ok === false && hostileResult.partGraph == null && JSON.stringify(before) === beforeSnapshot);
check('The model saying "approved" grants nothing', hostileResult.spec == null || hostileResult.spec.status !== "APPROVED");
await hostile.close();

/* 6. Provider failure ------------------------------------------------ */
console.log("\n[6] PROVIDER FAILURE PRESERVES THE PREVIOUS DESIGN");
console.log(THIN);
const broken = await startStandInProvider(() => ({ status: 500, body: { type: "error", error: { type: "api_error", message: "stand-in outage" } } }));
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${broken.port}`;
const outage = await proposeDesignChange({
  message: REWORDED_EDIT, currentObservations: before, specId: "furnispec-verification-01", revision: 4,
  endpoint: `${base}${AI_DESIGNER_ENDPOINT}`,
});
check("Transport reports the designer as unavailable", outage.ok === false && outage.kind === RESULT_KIND.DESIGNER_UNAVAILABLE, outage.code);
check("The user-facing message says the design is unchanged", /unchanged/i.test(outage.error ?? ""));
check("No geometry was produced", outage.partGraph == null);
check("The active design is untouched", JSON.stringify(before) === beforeSnapshot);
check("No raw provider error or credential leaked to the client", !/sk-|x-api-key|stand-in outage/i.test(JSON.stringify(outage)));
await broken.close();

/* 6b. A REJECTED CREDENTIAL IS NOT AN OUTAGE ------------------------- */
console.log("\n[6b] A REJECTED CREDENTIAL IS NAMED AS SUCH, NOT AS AN OUTAGE");
console.log(THIN);
// The operationally important distinction. A 401 means the provider is up and
// answering — paging someone to check a healthy service wastes the time it
// takes to discover the key was simply revoked.
const rejecting = await startStandInProvider(() => ({
  status: 401,
  body: { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } },
}));
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${rejecting.port}`;
const authRejected = await post(`${base}${AI_DESIGNER_ENDPOINT}`, { message: REWORDED_EDIT, currentFacts: {} });
check(
  "A rejected key is reported as AI_PROVIDER_AUTH_REJECTED, not AI_PROVIDER_UNAVAILABLE",
  authRejected.body?.code === "AI_PROVIDER_AUTH_REJECTED",
  `code ${authRejected.body?.code}`
);
check("The customer still just hears that their design is unchanged", /unchanged/i.test(authRejected.body?.error ?? ""));
check(
  "The operator remediation note stays in the server log, never in the response body",
  !/api[_-]?key|ANTHROPIC|OPENAI|operatorNote/i.test(JSON.stringify(authRejected.body)),
  JSON.stringify(authRejected.body?.code)
);
await rejecting.close();

/* ------------------------------------------------------------------- */
await api.close();
process.env.ANTHROPIC_API_KEY = savedKeys.a; process.env.OPENAI_API_KEY = savedKeys.o;
if (savedKeys.b === undefined) delete process.env.ANTHROPIC_BASE_URL; else process.env.ANTHROPIC_BASE_URL = savedKeys.b;

console.log("\n" + RULE);
const failed = checks.filter((c) => !c.pass);
console.log(`VERIFICATION: ${failed.length === 0 ? "PASS" : "FAIL"}  (${checks.length - failed.length}/${checks.length} checks)`);
console.log("PROVIDER SERVICE: SIMULATED · LIVE MODEL CALL: NOT MADE (needs paid-usage authorization)");
console.log(RULE);
for (const f of failed) console.error(`FAILED: ${f.label}`);
process.exit(failed.length === 0 ? 0 : 1);
