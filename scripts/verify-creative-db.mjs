#!/usr/bin/env node
/**
 * scripts/verify-creative-db.mjs — generation-record write authority, on a
 * REAL PostgreSQL + PostgREST (throwaway local cluster; see
 * scripts/db-verify/local-stack.mjs for what is real and what is a stand-in).
 *
 *   node scripts/verify-creative-db.mjs
 *       Applies the committed migration and runs D1–D8 through the real
 *       /api/creative handler, the real store and PostgREST. The Scenario
 *       side is the local SIMULATED stand-in: no provider is contacted and
 *       nothing is billed.
 *
 *   node scripts/verify-creative-db.mjs --reproduce <old-migration.sql>
 *       Applies a DIFFERENT migration (e.g. `git show 7f42f95:supabase/
 *       migrations/2026-10-04_creative_generation.sql > /tmp/old.sql`) and
 *       shows whether an owner can flip their own running job to `failed`
 *       straight through PostgREST. Exit 0 = the defect reproduces.
 *
 * Must run as a non-root user (PostgreSQL refuses root). Needs initdb,
 * postgres, psql and PostgREST (POSTGREST_BIN or /opt/postgrest/postgrest).
 * Proves PostgreSQL / PostgREST / RLS / privileges / trigger behaviour. It
 * does NOT prove Supabase Auth or a hosted project.
 */
import http from "node:http";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { startLocalStack } from "./db-verify/local-stack.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const reproduce = argv.includes("--reproduce") ? argv[argv.indexOf("--reproduce") + 1] : null;
const CREATIVE_SQL = path.join(ROOT, "supabase/migrations/2026-10-04_creative_generation.sql");

const results = [];
function check(id, name, ok, detail = "") {
  results.push({ id, name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${name}${detail ? `\n        ${detail}` : ""}`);
}

const stack = await startLocalStack({
  root: ROOT,
  migration: path.join(ROOT, "supabase/migrations/2026-09-22_wardrobe_design_persistence.sql"),
  extraMigrations: [reproduce || CREATIVE_SQL],
  log: (s) => console.log(`  [stack] ${s}`),
});
console.log(`  [stack] PostgreSQL ${stack.versions.postgres}, ${stack.versions.postgrest}`);
console.log(`  [stack] creative migration: ${reproduce ? `${reproduce} (REPRODUCTION — not the committed file)` : "as committed"}\n`);

const rest = (token, method, pathAndQuery, body) =>
  fetch(`${stack.supabaseUrl}/rest/v1/${pathAndQuery}`, {
    method,
    headers: { apikey: stack.anonKey, ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json", prefer: "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, rows: await r.json().catch(() => null) }));
const sqlStatus = (id) => stack.sql(`select status from public.creative_jobs where id = '${id}'`);

let exitCode = 0;
try {
  if (reproduce) {
    // A running job, written the way the server would have written it.
    const refId = randomUUID();
    const jobId = randomUUID();
    const cols = stack.sql("select string_agg(column_name, ',') from information_schema.columns where table_schema='public' and table_name='creative_references'");
    const hasDims = cols.includes("width");
    stack.sql(`insert into public.creative_references (id, owner_user_id, name, content_type, bytes, sha256, ${hasDims ? "width, height, validation, " : ""}provider, provider_asset_id, sig) values ('${refId}', '${stack.users.A}', 'r.png', 'image/png', 10, 'abc', ${hasDims ? "64, 48, 'decoded', " : ""}'scenario', 'asset_1', 'sig')`);
    stack.sql(`insert into public.creative_jobs (id, owner_user_id, idempotency_key, reference_id, provider, model_id, status, provider_job_id, sig) values ('${jobId}', '${stack.users.A}', 'click-0001', '${refId}', 'scenario', 'm', 'processing', 'job_1', 'sig-written-by-server')`);
    const r = await rest(stack.tokens.A, "PATCH", `creative_jobs?id=eq.${jobId}`, { status: "failed" });
    const after = sqlStatus(jobId);
    const sig = stack.sql(`select sig from public.creative_jobs where id = '${jobId}'`);
    console.log(`owner PATCH status=failed with the owner's own token → HTTP ${r.status}; stored status is now "${after}"; sig still "${sig}"`);
    const reproduced = after === "failed";
    check("R1", "DEFECT REPRODUCES: an owner can mark their own running job failed, signature untouched", reproduced);
    if (reproduced) {
      const active = stack.sql(`select count(*) from public.creative_jobs where reference_id='${refId}' and status in ('submitting','processing')`);
      check("R2", "…after which the one-active-job index no longer sees a running job for that reference", active === "0", `active rows for the reference: ${active}`);
    }
    exitCode = reproduced ? 0 : 1;
  } else {
    const { startScenarioStandIn } = await import("../src/lib/creative/scenarioStandIn.js");
    const { PNG, JPEG } = await import("../src/lib/creative/testImages.js");
    const sim = await startScenarioStandIn();
    Object.assign(process.env, {
      SUPABASE_URL: stack.supabaseUrl, SUPABASE_ANON_KEY: stack.anonKey, SUPABASE_SERVICE_ROLE_KEY: stack.serviceRoleKey,
      CREATIVE_RECORD_SIGNING_KEY: "local-verification-signing-key-0123456789abcdef",
      SCENARIO_API_KEY: "sim-key", SCENARIO_API_SECRET: "sim-secret", SCENARIO_API_BASE_URL: sim.baseUrl,
      SCENARIO_3D_MODEL_ID: "model_sim-img23d", SCENARIO_3D_IMAGE_PARAM: "image", SCENARIO_3D_IMAGE_PARAM_IS_ARRAY: "yes",
      SCENARIO_STATUS_SUCCESS: "sim-done", SCENARIO_STATUS_FAILURE: "sim-failed",
      SCENARIO_LIVE_GENERATION_ENABLED: "yes", SCENARIO_MAX_COST_PER_JOB: "20",
    });
    delete process.env.FURNIAI_PERSISTENCE_TEST_AUTH;
    const { default: handler } = await import("../api/creative.js");
    const api = http.createServer((req, res) => handler(req, res));
    await new Promise((r) => api.listen(0, "127.0.0.1", r));
    const apiUrl = `http://127.0.0.1:${api.address().port}/api/creative`;
    const call = async (token, method, qs, body) => {
      const r = await fetch(`${apiUrl}?${qs}`, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      return { status: r.status, body: await r.json() };
    };
    const A = stack.tokens.A;
    const B = stack.tokens.B;

    // D1 — the whole journey on a real database; signatures survive timestamptz / jsonb / double round-trips.
    sim.state.pollsUntilDone = 2;
    const up = await call(A, "POST", "resource=references", { name: "w.png", dataBase64: PNG.toString("base64") });
    const refId = up.body.reference?.referenceId;
    const sub = await call(A, "POST", "resource=jobs", { referenceId: refId, idempotencyKey: "click-0001" });
    const jobId = sub.body.job?.jobId;
    const p1 = await call(A, "GET", `resource=jobs&jobId=${jobId}`);
    check("D1a", "upload → submit → status on PostgreSQL; the stored row verifies after a round-trip", up.status === 201 && sub.status === 202 && p1.status === 200 && p1.body.job?.status === "processing", `upload ${up.status}, submit ${sub.status}, poll ${p1.status} ${p1.body.code ?? p1.body.job?.status}`);

    // D2 — THE REPORTED DEFECT.
    const patch = await rest(A, "PATCH", `creative_jobs?id=eq.${jobId}`, { status: "failed" });
    const afterPatch = sqlStatus(jobId);
    check("D2a", "owner PATCH status=failed straight to PostgREST changes nothing", afterPatch === "processing" && (patch.status >= 400 || (Array.isArray(patch.rows) && patch.rows.length === 0)), `HTTP ${patch.status}; stored status "${afterPatch}"`);
    const before = sim.state.calls.generate;
    const second = await call(A, "POST", "resource=jobs", { referenceId: refId, idempotencyKey: "click-0002" });
    check("D2b", "a new idempotency key for the same reference is refused; no second paid call", second.status === 409 && second.body.code === "DUPLICATE_ACTIVE_JOB" && sim.state.calls.generate === before, `HTTP ${second.status} ${second.body.code}; paid calls ${sim.state.calls.generate}`);

    // D3 — no owner write of any kind, on either table.
    const forged = await rest(A, "POST", "creative_jobs", { id: randomUUID(), owner_user_id: stack.users.A, idempotency_key: "forged-0001", reference_id: refId, provider: "scenario", model_id: "m", status: "failed", sig: "x" });
    const del = await rest(A, "DELETE", `creative_jobs?id=eq.${jobId}`);
    const moved = await rest(A, "PATCH", `creative_jobs?id=eq.${jobId}`, { idempotency_key: "freed-0001" });
    const refPatch = await rest(A, "PATCH", `creative_references?id=eq.${refId}`, { provider_asset_id: "asset_of_someone_else" });
    const refIns = await rest(A, "POST", "creative_references", { id: randomUUID(), owner_user_id: stack.users.A, name: "x", content_type: "image/png", bytes: 1, sha256: "zz", width: 64, height: 64, validation: "decoded", provider: "scenario", provider_asset_id: "a", sig: "x" });
    const counts = stack.sql(`select (select count(*) from public.creative_jobs) || ',' || (select count(*) from public.creative_references) || ',' || (select idempotency_key from public.creative_jobs where id='${jobId}') || ',' || (select provider_asset_id from public.creative_references where id='${refId}')`);
    check("D3", "owner INSERT / DELETE / key-edit on jobs and INSERT / UPDATE on references are all refused", counts === "1,1,click-0001,asset_ref_1", `insert ${forged.status}, delete ${del.status}, key edit ${moved.status}, ref update ${refPatch.status}, ref insert ${refIns.status}; rows now: ${counts}`);

    // D4 — isolation.
    const bRows = await rest(B, "GET", `creative_jobs?id=eq.${jobId}`);
    const anonRows = await rest(null, "GET", `creative_jobs?id=eq.${jobId}`);
    const bApi = await call(B, "GET", `resource=jobs&jobId=${jobId}`);
    const aRows = await rest(A, "GET", `creative_jobs?id=eq.${jobId}`);
    check("D4", "another user and an anonymous caller read nothing; the owner reads their row", aRows.rows?.length === 1 && (bRows.rows?.length ?? 0) === 0 && !(anonRows.rows?.length > 0) && bApi.status === 404, `owner ${aRows.rows?.length} row, B ${bRows.status}/${bRows.rows?.length ?? "-"}, anon ${anonRows.status}, API as B ${bApi.status}`);

    // D1b — finish the journey.
    await new Promise((r) => setTimeout(r, 2100));
    const p2 = await call(A, "GET", `resource=jobs&jobId=${jobId}`);
    const asset = await call(A, "GET", `resource=asset&jobId=${jobId}`);
    check("D1b", "poll → succeeded → asset address, records still verifying", p2.body.job?.status === "succeeded" && p2.body.job?.outputs?.[0]?.format === "glb" && asset.status === 200, `status ${p2.body.job?.status ?? p2.body.code}, asset ${asset.status}`);

    // D5 — concurrent different-key submissions: the database's partial unique index decides.
    const up2 = await call(A, "POST", "resource=references", { name: "w.jpg", dataBase64: JPEG.toString("base64") });
    const ref2 = up2.body.reference.referenceId;
    const g0 = sim.state.calls.generate;
    sim.state.pollsUntilDone = 99;
    const burst = await Promise.all(Array.from({ length: 8 }, (_, i) => call(A, "POST", "resource=jobs", { referenceId: ref2, idempotencyKey: `burst-000${i}` })));
    const accepted = burst.filter((r) => r.status === 202).length;
    const dup = burst.filter((r) => r.body.code === "DUPLICATE_ACTIVE_JOB").length;
    check("D5", "8 simultaneous submissions, 8 different keys, one reference → exactly 1 paid call", sim.state.calls.generate - g0 === 1 && accepted === 1 && dup === 7, `paid calls ${sim.state.calls.generate - g0}, accepted ${accepted}, DUPLICATE_ACTIVE_JOB ${dup}`);
    const same = await Promise.all(Array.from({ length: 8 }, () => call(A, "POST", "resource=jobs", { referenceId: ref2, idempotencyKey: "burst-0000" })));
    check("D5b", "8 replays of an existing key → no paid call, one job id", sim.state.calls.generate - g0 === 1 && new Set(same.map((r) => r.body.job?.jobId)).size === 1);

    // D6 — the guard trigger binds the SERVER credential too.
    const S = stack.serviceRoleKey;
    const ver = Number(stack.sql(`select version from public.creative_jobs where id='${jobId}'`));
    const rollback = await rest(S, "PATCH", `creative_jobs?id=eq.${jobId}`, { status: "processing", version: ver + 1 });
    const skip = await rest(S, "PATCH", `creative_jobs?id=eq.${burst.find((r) => r.status === 202).body.job.jobId}`, { version: 99 });
    const ident = await rest(S, "PATCH", `creative_jobs?id=eq.${burst.find((r) => r.status === 202).body.job.jobId}`, { reference_id: refId, version: 3 });
    check("D6", "even the server credential cannot roll a finished job back, skip a version or re-point a job", sqlStatus(jobId) === "succeeded" && rollback.status >= 400 && skip.status >= 400 && ident.status >= 400, `rollback ${rollback.status}, version skip ${skip.status}, re-point ${ident.status}`);

    // D7 — compare-and-swap.
    const running = burst.find((r) => r.status === 202).body.job.jobId;
    const stale = await rest(S, "PATCH", `creative_jobs?id=eq.${running}&version=eq.1`, { status: "failed", version: 2 });
    check("D7", "a stale-version write matches no row", Array.isArray(stale.rows) && stale.rows.length === 0 && sqlStatus(running) === "processing", `rows affected ${stale.rows?.length}`);

    // D8 — privileges, read from the catalog rather than inferred.
    const privs = stack.sql("select string_agg(grantee || ':' || privilege_type, ' ' order by grantee, privilege_type) from information_schema.role_table_grants where table_schema='public' and table_name in ('creative_jobs','creative_references') and grantee in ('anon','authenticated')");
    const policies = stack.sql("select string_agg(tablename || ':' || cmd, ' ' order by tablename, cmd) from pg_policies where schemaname='public' and tablename in ('creative_jobs','creative_references')");
    check("D8", "catalog: anon has no privilege, authenticated has SELECT only, the only policies are SELECT", privs === "authenticated:SELECT authenticated:SELECT" && policies === "creative_jobs:SELECT creative_references:SELECT", `grants: ${privs}; policies: ${policies}`);

    await new Promise((r) => api.close(r));
    await sim.close();
    exitCode = results.every((r) => r.ok) ? 0 : 1;
  }
} catch (err) {
  console.error("\nHARNESS ERROR:", err.message);
  console.error(JSON.stringify(stack.diagnostics(), null, 2));
  exitCode = 2;
} finally {
  await stack.stop();
}
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed${reproduce ? " (reproduction run)" : ""}. Scenario side: SIMULATED. Database: real PostgreSQL + PostgREST, local.`);
process.exit(exitCode);
