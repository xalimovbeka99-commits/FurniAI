#!/usr/bin/env node
/**
 * scripts/scenario-discover.mjs — read what THIS Scenario account actually
 * supports, so configuration comes from the provider and not from a guess.
 *
 *   node scripts/scenario-discover.mjs model <modelId>
 *       GET /models/{id}. Read-only. Prints the model's declared inputs.
 *
 *   node scripts/scenario-discover.mjs estimate <modelId> <image-file> <imageParam> --upload-ok [--array] [--data-url]
 *       UPLOADS THE IMAGE to the Scenario account as an asset (POST /assets) —
 *       it leaves your machine and stays in that account — then asks for a
 *       cost preview (?dryRun=true). Starts NO generation. Prints the raw
 *       preview. Refuses to run without --upload-ok. Whether Scenario charges
 *       for storing an uploaded asset is not known to this script.
 *
 *   node scripts/scenario-discover.mjs job <providerJobId>
 *       GET /jobs/{id}. Read-only. Prints the raw job (status word, asset ids).
 *
 * There is deliberately no command here that starts a generation.
 * Reads SCENARIO_API_KEY / SCENARIO_API_SECRET from the environment or
 * .env.local. Never prints a credential.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { loadEnvLocal } from "./dev-api-server.mjs";
import { readScenarioConfig } from "../src/lib/creative/scenarioConfig.js";
import { createScenarioClient } from "../src/lib/creative/scenarioClient.js";
import { validateReferenceUpload } from "../src/lib/creative/referenceUpload.js";

loadEnvLocal();
const [cmd, ...args] = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const pos = args.filter((a) => !a.startsWith("--"));
const show = (label, v) => console.log(`\n== ${label}\n${JSON.stringify(v, null, 2)}`);

function fail(msg) { console.error(msg); process.exit(2); }

const base = readScenarioConfig();
if (!base.credentialsConfigured) fail("SCENARIO_API_KEY / SCENARIO_API_SECRET are not set (environment or .env.local). Nothing was called.");

try {
  if (cmd === "model" && pos[0]) {
    const raw = await createScenarioClient(base).getModel(pos[0]);
    show(`GET /models/${pos[0]} (raw)`, raw);
  } else if (cmd === "job" && pos[0]) {
    const res = await fetch(`${base.baseUrl}/jobs/${encodeURIComponent(pos[0])}`, { headers: { authorization: "Basic " + Buffer.from(`${base.apiKey}:${base.apiSecret}`).toString("base64") } });
    show(`GET /jobs/${pos[0]} → HTTP ${res.status} (raw)`, await res.json().catch(() => null));
  } else if (cmd === "estimate" && pos.length >= 3) {
    const [modelId, file, imageParam] = pos;
    if (!flags.has("--upload-ok")) fail(`"estimate" UPLOADS ${path.basename(file)} to the Scenario account before asking for the cost preview.\nNothing was called. Re-run with --upload-ok to allow the upload. No generation is started either way.`);
    console.log(`NOTE: uploading ${path.basename(file)} to the Scenario account now (POST /assets). No generation will be started.`);
    const cfg = { ...base, modelId, uploadAsDataUrl: flags.has("--data-url") };
    const client = createScenarioClient(cfg);
    const ref = validateReferenceUpload({ name: path.basename(file), dataBase64: readFileSync(file).toString("base64") });
    console.log(`reference: ${ref.name} ${ref.contentType} ${ref.bytes} bytes sha256=${ref.sha256}`);
    const { assetId } = await client.uploadAsset(ref);
    console.log(`uploaded as provider asset ${assetId}`);
    const est = await client.estimateCost({ [imageParam]: flags.has("--array") ? [assetId] : assetId });
    show("dry-run cost preview (raw) — NO generation was started", est.raw);
    console.log(`\ncost read by FurniAI: ${est.cost}`);
  } else {
    fail("usage: scenario-discover.mjs model <modelId> | estimate <modelId> <image> <imageParam> --upload-ok [--array] [--data-url] | job <providerJobId>");
  }
} catch (err) {
  console.error(`\n${err.code ?? "ERROR"}: ${err.message}`);
  if (err.details) console.error(JSON.stringify(err.details, null, 2));
  process.exit(1);
}
