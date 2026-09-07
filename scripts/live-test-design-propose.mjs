#!/usr/bin/env node
/**
 * ONE BOUNDED LIVE TEST of POST /api/design/propose against the real provider.
 * Authorized by Bekzod on 2026-09-07 for at most 3 attempts, local only.
 * Prints REDACTED evidence: no API key, no raw provider payload, no headers.
 */
import { loadEnvLocal, startApiServer } from "./dev-api-server.mjs";
import { proposeDesignChange, RESULT_KIND, RESULT_SOURCE } from "../src/lib/adapters/aiDesignerTransport.js";
import { BEKZOD_APPROVED_DEFAULTS, OBSERVATION_ORIGIN, observation } from "../src/lib/conversation/intakeModel.js";
import { parseConversationalCommand } from "../src/lib/conversation/pipeline.js";

const MAX_ATTEMPTS = 3;
const MESSAGE = "could you open it up a bit for me — go to two metres across";
const RULE = "=".repeat(92);

if (process.env.FURNIAI_LIVE_TEST_AUTHORIZED !== "yes") {
  console.error("Refusing: FURNIAI_LIVE_TEST_AUTHORIZED=yes is required (a live call spends the owner's quota).");
  process.exit(2);
}

loadEnvLocal();
// ANTHROPIC_BASE_URL may point at the sandbox relay (see anthropic-relay.mjs).

const active = Object.entries(BEKZOD_APPROVED_DEFAULTS).map(([k, v]) =>
  observation(k, Array.isArray(v) ? [...v] : v, OBSERVATION_ORIGIN.CUSTOMER_CONFIRMED, { sourceText: "active design" })
);

console.log(RULE);
console.log("FurniAI — BOUNDED LIVE TEST · POST /api/design/propose · real provider");
console.log(RULE);
console.log(`provider configured : ANTHROPIC_API_KEY ${process.env.ANTHROPIC_API_KEY ? "present" : "ABSENT"} (value never read)`);
console.log(`model requested     : ${process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6 (client default, ANTHROPIC_MODEL unset)"}`);
console.log(`provider order      : ${process.env.AI_PROVIDER_ORDER || "anthropic,openai (default)"}`);
console.log(`base URL            : ${process.env.ANTHROPIC_BASE_URL ? process.env.ANTHROPIC_BASE_URL + " (sandbox relay -> real api.anthropic.com)" : "direct api.anthropic.com"}`);
console.log(`customer message    : "${MESSAGE}"`);
console.log(`deterministic parser: ${parseConversationalCommand(MESSAGE, {}) === null ? "returns null — the model is genuinely required" : "HANDLES IT — not a valid live test"}`);
console.log(`attempt budget      : ${MAX_ATTEMPTS}`);

const api = await startApiServer({ routes: ["api/design/propose.js"], port: 0 });
const endpoint = `http://127.0.0.1:${api.port}/api/design/propose`;

let result = null;
let attempts = 0;
const started = Date.now();
for (; attempts < MAX_ATTEMPTS; ) {
  attempts += 1;
  console.log(`\n--- attempt ${attempts}/${MAX_ATTEMPTS} ---`);
  const t0 = Date.now();
  result = await proposeDesignChange({
    message: MESSAGE, currentObservations: active, specId: "furnispec-live-test-01", revision: 1, endpoint,
  });
  console.log(`  latency        : ${Date.now() - t0} ms`);
  console.log(`  ok / kind      : ${result.ok} / ${result.kind}`);
  console.log(`  source         : ${result.source}`);
  if (result.assistantReply) console.log(`  model reply    : "${result.assistantReply}"`);
  if (result.error) console.log(`  error          : ${result.error}`);
  if (result.ok || result.kind === RESULT_KIND.DESIGNER_UNAVAILABLE) break;
}
await api.close();

console.log("\n" + "-".repeat(92));
console.log("REDACTED EVIDENCE");
console.log("-".repeat(92));
console.log(`attempts used        : ${attempts} of ${MAX_ATTEMPTS}   total ${Date.now() - started} ms`);
console.log(`result source        : ${result?.source} (${RESULT_SOURCE.MODEL} means a real model turn produced it)`);
console.log(`result kind          : ${result?.kind}`);
if (result?.ok && result.spec) {
  console.log(`spec width           : ${result.spec.envelope.widthMm} mm   (was ${BEKZOD_APPROVED_DEFAULTS["envelope.widthMm"]} mm)`);
  console.log(`spec height/depth    : ${result.spec.envelope.heightMm} / ${result.spec.envelope.depthMm} mm  (unchanged: ${result.spec.envelope.heightMm === 2400 && result.spec.envelope.depthMm === 600})`);
  console.log(`finish / bays / doors: ${result.spec.finishType} / ${result.spec.bays.length} / ${result.spec.doors.count}`);
  console.log(`specId / revision    : ${result.spec.specId} / ${result.spec.revision}`);
  console.log(`FurniSpec valid      : ${result.validation?.valid} (${result.validation?.errors.length ?? "?"} errors)`);
  console.log(`PartGraph            : ${result.partGraph?.summary.totalStructuralParts} parts, valid=${result.partGraphValidation?.valid}`);
  console.log(`spec status          : ${result.spec.status}`);
  console.log(`CNC qualification    : ${result.spec.qualificationStatus}`);
  console.log(`drilling policy      : ${result.spec.machiningPolicy.drilling}  (operations: ${result.safety?.drillingOperationCount})`);
  console.log(`approval state       : ${result.safety?.approvalState}`);
  if (result.rejected?.length) console.log(`validation rejected  : ${result.rejected.map((r) => r.code).join(", ")}`);
}
const dump = JSON.stringify(result ?? {});
console.log(`no secret in result  : ${!/sk-ant|x-api-key|authorization/i.test(dump)}`);
console.log("\n" + RULE);
const live = result?.source === RESULT_SOURCE.MODEL && result?.ok === true;
console.log(`LIVE MODEL TEST: ${live ? "SUCCESS — a real model produced a validated design edit" : result?.kind === RESULT_KIND.DESIGNER_UNAVAILABLE ? "BLOCKED — provider unreachable, see error above" : "INCONCLUSIVE"}`);
console.log(RULE);
process.exit(live ? 0 : 1);
