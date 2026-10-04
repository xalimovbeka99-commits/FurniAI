#!/usr/bin/env node
/**
 * scripts/live-workflow-acceptance.mjs — ONE bounded live AI turn inside the
 * customer workflow, with persistence and export identity checked after it.
 *
 *   FURNIAI_LIVE_TEST_AUTHORIZED=yes ANTHROPIC_API_KEY=… \
 *     node scripts/live-workflow-acceptance.mjs [--relay] [--max-requests 3]
 *
 * Optional, to persist in a real database instead of the in-process store:
 *   node scripts/db-verify/with-local-stack.mjs -- node scripts/live-workflow-acceptance.mjs …
 *
 * Flow: description → deterministic validated draft → ONE live AI edit through
 * the real transport and the real /api/design/propose handler → accepted edit
 * compiled by the kernel → save → reopen → restoreEditableDesign → cut list and
 * drawings from the reopened design compared byte-for-byte with the accepted ones.
 *
 * Bounds: exactly one proposeDesignChange; the provider SDK may retry that
 * request itself, so every outbound request is counted at the relay (--relay)
 * and the run REFUSES to start a request past --max-requests (default 3).
 * Prints no key, no header, no raw provider payload.
 */
import { startApiServer } from "./dev-api-server.mjs";
import { startAnthropicRelay } from "./anthropic-relay.mjs";
import { proposeDesignChange, RESULT_SOURCE } from "../src/lib/adapters/aiDesignerTransport.js";
import { previewDraftWardrobe, parseConversationalCommand } from "../src/lib/conversation/pipeline.js";
import { fingerprintFurniSpec } from "../src/lib/conversation/approval.js";
import { restoreEditableDesign } from "../src/lib/conversation/reopenDesign.js";
import { buildStructuralPartGraph } from "../src/lib/partgraph/buildStructuralPartGraph.js";
import { validatePartGraph } from "../src/lib/partgraph/validatePartGraph.js";
import { serializeCanonicalJson } from "../src/lib/furnispec/normalize.js";
import { buildConstraintReport } from "../src/lib/rules/constraintReport.js";
import { generateCutListCsv } from "../src/lib/production/nestingCompiler.js";
import { generateShopDrawingsSVG } from "../src/lib/drawing/projectionEngine.js";
import { createMemoryStore } from "../src/lib/persistence/memoryStore.js";
import { createDesignService } from "../src/lib/persistence/designService.js";

const argv = process.argv.slice(2);
const opt = (n, d) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : d);
const MAX_REQUESTS = Math.min(3, Math.max(1, Number(opt("--max-requests", 3))));
const MESSAGE = "could you open it up a bit for me — go to two metres across";
const canon = (v) => serializeCanonicalJson(v);
const out = (k, v) => console.log(`${k.padEnd(34)}: ${v}`);

if (process.env.FURNIAI_LIVE_TEST_AUTHORIZED !== "yes") {
  console.error("REFUSED: FURNIAI_LIVE_TEST_AUTHORIZED=yes is required (a live call spends the owner's quota).");
  process.exit(2);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("REFUSED: ANTHROPIC_API_KEY is not in this process's environment.");
  process.exit(2);
}
if (parseConversationalCommand(MESSAGE, {}) !== null) {
  console.error("REFUSED: the deterministic parser handles this message; it would not test the model.");
  process.exit(2);
}

let relay = null;
if (argv.includes("--relay")) {
  relay = await startAnthropicRelay();
  process.env.ANTHROPIC_BASE_URL = relay.baseUrl;
}
const { DEFAULT_ANTHROPIC_MODEL } = await import("../src/lib/ai-provider/anthropicChatClient.js");

console.log("=".repeat(92));
console.log("FurniAI — LIVE AI TURN IN THE CUSTOMER WORKFLOW (bounded)");
console.log("=".repeat(92));
out("date (UTC)", new Date().toISOString());
out("model requested", process.env.ANTHROPIC_MODEL || `${DEFAULT_ANTHROPIC_MODEL} (client default)`);
out("provider order", process.env.AI_PROVIDER_ORDER || "anthropic,openai (default)");
out("transport to provider", relay ? "local relay → api.anthropic.com (requests counted)" : "direct");
out("request ceiling", MAX_REQUESTS);

// 1. Description → validated draft (deterministic path, unchanged).
const draft = previewDraftWardrobe({
  description: "A wardrobe 1800 mm wide, 2400 mm high and 600 mm deep",
  specId: "furnispec-live-workflow-01",
  revision: 1,
});
out("draft", `${draft.stage}, valid=${draft.validation?.valid}, width ${draft.spec?.envelope?.widthMm} mm`);

// 2. ONE live AI-assisted edit through the real transport + real route.
const api = await startApiServer({ routes: ["api/design/propose.js"], port: 0 });
let result = null;
const t0 = Date.now();
try {
  if (relay && relay.calls.length >= MAX_REQUESTS) throw new Error("request ceiling reached before the call");
  result = await proposeDesignChange({
    message: MESSAGE,
    currentObservations: draft.observations,
    specId: draft.spec.specId,
    revision: draft.spec.revision,
    endpoint: `http://127.0.0.1:${api.port}/api/design/propose`,
  });
} finally {
  await api.close();
}
out("live turn latency", `${Date.now() - t0} ms`);
if (relay) out("outbound provider requests", `${relay.calls.length} (statuses ${relay.calls.map((c) => c.status).join(",") || "none"})`);
out("result ok / kind / source", `${result?.ok} / ${result?.kind} / ${result?.source}`);
if (result?.assistantReply) out("model reply (customer text)", JSON.stringify(result.assistantReply));
if (result?.error) out("error (customer text)", JSON.stringify(result.error));
const secretFree = !/sk-ant|x-api-key|authorization/i.test(JSON.stringify(result ?? {}));
out("no secret in result", secretFree);

const live = result?.ok === true && result?.source === RESULT_SOURCE.MODEL;
if (!live) {
  if (relay) await relay.close();
  console.log(`\nLIVE AI TURN: NOT ACCEPTED — ${result?.kind ?? "no result"}. Nothing below was run.`);
  process.exit(1);
}

// 3. The accepted edit is kernel geometry, not model output.
const accepted = result;
const compiledSame = canon(buildStructuralPartGraph(accepted.spec)) === canon(accepted.partGraph);
out("edited envelope", `${accepted.spec.envelope.widthMm} × ${accepted.spec.envelope.heightMm} × ${accepted.spec.envelope.depthMm} mm`);
out("PartGraph = compiler(spec)", compiledSame);
out("PartGraph valid", validatePartGraph(accepted.partGraph).valid);
const cr = buildConstraintReport({ spec: accepted.spec, partGraph: accepted.partGraph });
out("constraint report", `${cr.status}; blocking ${cr.blockingViolations.length}, advisory ${cr.advisoryWarnings.length}, approved ${cr.approvedRules.length}, provisional ${cr.provisionalRules.length}`);
out("not qualified", `drilling ${cr.notQualified.hardwareDrilling}; STEP ${cr.notQualified.stepExport}; ${cr.notQualified.cncQualification}`);

// 4. Save → reopen (real database when run under with-local-stack).
const DRAW = { date: "2026-09-30" };
const csv = generateCutListCsv(accepted.partGraph);
const svg = generateShopDrawingsSVG(accepted.partGraph, DRAW);
const body = {
  revision: 1, expectedPreviousRevision: null, fingerprint: fingerprintFurniSpec(accepted.spec),
  furniSpec: accepted.spec, partGraph: accepted.partGraph, origins: accepted.origins ?? {}, validationStatus: "ACCEPTED",
};
let reopenedPayload;
let store;
if (process.env.FURNIAI_TEST_URL && process.env.TOKEN_A) {
  store = "real PostgreSQL via /api/designs (local stack, JWT shim)";
  const base = process.env.FURNIAI_TEST_URL;
  const h = { authorization: `Bearer ${process.env.TOKEN_A}`, "content-type": "application/json" };
  const created = await (await fetch(`${base}/api/designs`, { method: "POST", headers: h, body: JSON.stringify({ name: "live-workflow" }) })).json();
  const saved = await fetch(`${base}/api/designs/${created.designId}/revisions`, { method: "POST", headers: h, body: JSON.stringify(body) });
  out("save", `${saved.status}`);
  reopenedPayload = await (await fetch(`${base}/api/designs/${created.designId}/revisions/1`, { headers: h })).json();
} else {
  store = "in-process design service (memory store)";
  const svc = createDesignService({ store: createMemoryStore() });
  const { designId } = await svc.createDesign({ userId: "live", name: "live-workflow" });
  await svc.saveRevision({ userId: "live", designId, ...body });
  reopenedPayload = await svc.getRevision({ userId: "live", designId, revision: 1 });
}
out("persistence used", store);
const restored = restoreEditableDesign({
  furniSpec: reopenedPayload.furniSpec, partGraph: reopenedPayload.partGraph,
  origins: reopenedPayload.origins, storedRevision: reopenedPayload.revision,
});
const same = {
  fingerprint: reopenedPayload.fingerprint === body.fingerprint,
  spec: canon(restored.state.spec) === canon(accepted.spec),
  partGraph: canon(restored.state.partGraph) === canon(accepted.partGraph),
  cutList: generateCutListCsv(restored.state.partGraph) === csv,
  drawings: generateShopDrawingsSVG(restored.state.partGraph, DRAW) === svg,
};
out("reopened editable", `${restored.editable}${restored.reason ? ` (${restored.reason})` : ""}`);
out("saved = reopened = exports", JSON.stringify(same));
if (relay) {
  out("outbound provider requests (final)", relay.calls.length);
  await relay.close();
}
const pass = compiledSame && Object.values(same).every(Boolean) && restored.editable && secretFree;
console.log("\n" + "=".repeat(92));
console.log(`LIVE WORKFLOW: ${pass ? "PASS — a real model edit became a saved, reopened design with identical exports" : "FAIL"}`);
console.log("=".repeat(92));
process.exit(pass ? 0 : 1);
