#!/usr/bin/env node
/**
 * scripts/verify-persistence-db.mjs
 * ---------------------------------------------------------------------
 * EXECUTABLE verification of durable save/reopen against a REAL PostgreSQL,
 * through the REAL /api/designs handlers running as SEPARATE OS processes.
 *
 * Why this exists: every unit test runs against an in-process Map or
 * createFakePostgrest(). Those are single-process JavaScript. They cannot
 * show PostgreSQL isolation, the unique constraint deciding a genuine race,
 * RLS as actually deployed, PostgREST's real status codes, or a row surviving
 * the process that wrote it.
 *
 * MODES
 *
 *   --local
 *       Creates a throwaway PostgreSQL cluster + PostgREST on 127.0.0.1,
 *       applies supabase/migrations/2026-09-22_wardrobe_design_persistence.sql
 *       exactly as committed, runs everything, deletes it all. No external
 *       resource is created. Needs initdb/postgres/psql and a postgrest
 *       binary (see scripts/db-verify/local-stack.mjs), and a non-root user.
 *       GoTrue is replaced by a small JWT shim — this mode proves PostgreSQL,
 *       PostgREST and RLS behaviour, NOT Supabase Auth.
 *
 *   --target
 *       Runs the same checks against an APPROVED NON-PRODUCTION Supabase
 *       project whose migration has already been applied by a human. Needs:
 *         FURNIAI_DB_TEST_SUPABASE_URL         https://<ref>.supabase.co
 *         FURNIAI_DB_TEST_ANON_KEY
 *         FURNIAI_DB_TEST_TOKEN_A, FURNIAI_DB_TEST_TOKEN_B
 *                                              two DIFFERENT throwaway users
 *         FURNIAI_DB_TEST_CONFIRM_NONPRODUCTION  must equal the URL's host,
 *                                              typed out — a deliberate step
 *         FURNIAI_DB_TEST_PRODUCTION_HOSTS     optional, comma-separated; the
 *                                              run refuses if the URL matches
 *       It never applies a migration, never creates users, never uses a
 *       service-role key, and cannot delete what it creates (by design — see
 *       the report's TEARDOWN section).
 *
 * OPTIONS  --rounds N   competing-write rounds (default 20)
 *          --writers N  writers per round (default 6)
 *          --json FILE  also write the machine-readable report there
 *
 * Tokens are read from the environment and passed to child processes over
 * stdin or env only. They are never printed, logged or written to the report;
 * every line of output is scrubbed for them before it is written.
 */
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { previewDraftWardrobe } from "../src/lib/conversation/pipeline.js";
import { fingerprintFurniSpec } from "../src/lib/conversation/approval.js";
import { serializeCanonicalJson } from "../src/lib/furnispec/normalize.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : d);
const ROUNDS = Number(opt("--rounds", 20));
const WRITERS = Number(opt("--writers", 6));
const RUN_ID = randomUUID().slice(0, 8);

// ---------------------------------------------------------------- output
const secrets = [];
const scrub = (s) => secrets.reduce((acc, t) => (t && t.length > 8 ? acc.split(t).join("«redacted»") : acc), String(s));
const say = (s = "") => process.stdout.write(scrub(s) + "\n");
const results = [];
function record(id, title, verdict, evidence) {
  results.push({ id, title, verdict, evidence });
  say(`  ${verdict === "PASS" ? "PASS " : verdict === "FAIL" ? "FAIL " : verdict.padEnd(5)} ${id}  ${title}`);
  for (const line of [].concat(evidence || [])) say(`         ${line}`);
}
const digest = (v) => createHash("sha256").update(serializeCanonicalJson(v)).digest("hex").slice(0, 16);

// ---------------------------------------------------------------- payloads
const SPEC_ID = `furnispec-dbverify-${RUN_ID}`;
const DRAFT = previewDraftWardrobe({
  description: "A wardrobe 1800 mm wide, 2400 mm high and 600 mm deep",
  specId: SPEC_ID,
  revision: 1,
});
if (!DRAFT.validation?.valid) throw new Error("fixture design is not valid");

/** A save body built by the authoritative pipeline — nothing hand-written. */
function saveBody({ revision, expectedPreviousRevision, finishType, origins }) {
  const furniSpec = structuredClone(DRAFT.spec);
  furniSpec.revision = revision;
  if (finishType) furniSpec.finishType = finishType;
  const partGraph = structuredClone(DRAFT.partGraph);
  partGraph.sourceRevision = revision;
  return {
    revision,
    ...(expectedPreviousRevision === undefined ? {} : { expectedPreviousRevision }),
    fingerprint: fingerprintFurniSpec(furniSpec),
    furniSpec,
    partGraph,
    origins: origins ?? DRAFT.origins ?? {},
    validationStatus: "ACCEPTED",
  };
}

// ---------------------------------------------------------------- processes
const children = new Set();
async function startApiProcess(env) {
  const child = spawn(process.execPath, [path.join(ROOT, "scripts/db-verify/api-server.mjs")], {
    env: { PATH: process.env.PATH, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.add(child);
  child.on("exit", () => children.delete(child));
  const port = await new Promise((resolve, reject) => {
    let buf = "";
    const t = setTimeout(() => reject(new Error("api-server did not start")), 20000);
    child.stdout.on("data", (d) => {
      buf += d;
      const m = /READY (\d+)/.exec(buf);
      if (m) { clearTimeout(t); resolve(Number(m[1])); }
    });
    child.once("exit", (c) => reject(new Error(`api-server exited early (${c})`)));
  });
  const base = `http://127.0.0.1:${port}`;
  const identity = await (await fetch(`${base}/__server-identity`)).json();
  return { child, port, base, identity };
}
async function stopProcess(p) {
  if (p.child.exitCode !== null) return p.child.exitCode;
  p.child.kill("SIGTERM");
  return new Promise((r) => p.child.once("exit", (code, sig) => r(code ?? sig)));
}
const portRefuses = (port) =>
  new Promise((resolve) => {
    const s = net.connect(port, "127.0.0.1");
    s.once("connect", () => { s.destroy(); resolve(false); });
    s.once("error", (e) => resolve(e.code === "ECONNREFUSED"));
  });

// ---------------------------------------------------------------- http
async function api(base, token, method, p, body) {
  const res = await fetch(`${base}${p}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
}
async function rest(stack, token, method, p, body, prefer) {
  const res = await fetch(`${stack.supabaseUrl}/rest/v1/${p}`, {
    method,
    headers: {
      apikey: stack.anonKey,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* empty */ }
  return { status: res.status, json };
}
const revisionRows = async (stack, token, designId, revision) =>
  (await rest(stack, token, "GET", `wardrobe_revisions?design_id=eq.${designId}${revision ? `&revision=eq.${revision}` : ""}&select=revision,fingerprint,origins,part_graph,furnispec`)).json;

/** Forwards a request to the API and DROPS the response after it has been produced. */
async function responseDroppingProxy(targetPort) {
  const seen = { upstreamStatusLine: null };
  const srv = net.createServer((client) => {
    const upstream = net.connect(targetPort, "127.0.0.1");
    client.pipe(upstream);
    upstream.on("data", (d) => {
      if (!seen.upstreamStatusLine) seen.upstreamStatusLine = String(d).split("\r\n")[0];
      // swallow: the client never receives a byte of the answer
    });
    upstream.on("end", () => client.destroy());
    upstream.on("error", () => client.destroy());
    client.on("error", () => upstream.destroy());
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  return { port: srv.address().port, seen, close: () => new Promise((r) => srv.close(r)) };
}

// ---------------------------------------------------------------- stack
async function resolveStack() {
  if (flag("--local")) {
    const { startLocalStack } = await import("./db-verify/local-stack.mjs");
    return startLocalStack({
      root: ROOT,
      migration: path.join(ROOT, "supabase/migrations/2026-09-22_wardrobe_design_persistence.sql"),
      log: (s) => say(`  · ${s}`),
    });
  }
  if (flag("--target")) {
    const url = process.env.FURNIAI_DB_TEST_SUPABASE_URL || "";
    const anonKey = process.env.FURNIAI_DB_TEST_ANON_KEY || "";
    const A = process.env.FURNIAI_DB_TEST_TOKEN_A || "";
    const B = process.env.FURNIAI_DB_TEST_TOKEN_B || "";
    secrets.push(anonKey, A, B);
    let host;
    try { host = new URL(url).host; } catch { throw new Error("FURNIAI_DB_TEST_SUPABASE_URL is not a URL."); }
    if (!anonKey || !A || !B) throw new Error("Set FURNIAI_DB_TEST_ANON_KEY, FURNIAI_DB_TEST_TOKEN_A and FURNIAI_DB_TEST_TOKEN_B.");
    if (A === B) throw new Error("TOKEN_A and TOKEN_B are the same token. Isolation needs two users.");
    if (process.env.FURNIAI_DB_TEST_CONFIRM_NONPRODUCTION !== host) {
      throw new Error(`Refusing: set FURNIAI_DB_TEST_CONFIRM_NONPRODUCTION=${host} to confirm this is NOT production.`);
    }
    const forbidden = (process.env.FURNIAI_DB_TEST_PRODUCTION_HOSTS || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (forbidden.includes(host)) throw new Error(`Refusing: ${host} is listed in FURNIAI_DB_TEST_PRODUCTION_HOSTS.`);
    const who = async (t) => {
      const r = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, { headers: { apikey: anonKey, authorization: `Bearer ${t}` } });
      if (!r.ok) throw new Error(`A test token was rejected by ${host} (HTTP ${r.status}).`);
      return (await r.json()).id;
    };
    const users = { A: await who(A), B: await who(B) };
    if (users.A === users.B) throw new Error("Both tokens belong to the same user.");
    return {
      kind: "target", supabaseUrl: url.replace(/\/$/, ""), anonKey, users, tokens: { A, B },
      versions: { host }, sql: null, setRestDown: null, stop: async () => {},
    };
  }
  throw new Error("Choose --local or --target. See the header of this file.");
}

// ================================================================ main
const stack = await resolveStack();
secrets.push(stack.tokens.A, stack.tokens.B, stack.anonKey);
const created = [];
const durableEnv = { SUPABASE_URL: stack.supabaseUrl, SUPABASE_ANON_KEY: stack.anonKey, NODE_ENV: "production" };
say(`\nFurniAI persistence — real-database verification · run ${RUN_ID} · mode ${stack.kind}`);
say(`  versions: ${JSON.stringify(stack.versions)}`);
say(`  users: A=${stack.users.A.slice(0, 8)}…  B=${stack.users.B.slice(0, 8)}…  (tokens withheld)\n`);

let exitCode = 0;
try {
  const P = await startApiProcess(durableEnv);
  const { A, B } = stack.tokens;
  if (P.identity.store !== "supabase") throw new Error("api-server is not using the durable store");

  // ---- S0 schema facts (local mode can read the catalog directly) -------
  if (stack.sql) {
    const rls = stack.sql("select string_agg(relname||'='||relrowsecurity, ',' order by relname) from pg_class where relname in ('wardrobe_designs','wardrobe_revisions')");
    const pol = stack.sql("select string_agg(tablename||':'||cmd, ',' order by tablename, cmd) from pg_policies where tablename in ('wardrobe_designs','wardrobe_revisions')");
    const uq = stack.sql("select string_agg(pg_get_constraintdef(oid), ' | ') from pg_constraint where conrelid='public.wardrobe_revisions'::regclass and contype='u'");
    const ok = rls === "wardrobe_designs=true,wardrobe_revisions=true" && !/wardrobe_revisions:(UPDATE|DELETE)/.test(pol) && /UNIQUE \(design_id, revision\)/.test(uq);
    record("S0", "RLS on, revisions append-only, unique(design_id, revision) present", ok ? "PASS" : "FAIL", [`rls: ${rls}`, `policies: ${pol}`, `unique: ${uq}`]);
  } else {
    record("S0", "catalog inspection", "NOT RUN", "target mode has no SQL access; run the §1 queries in the SQL editor");
  }

  // ---- T1 two-user isolation ---------------------------------------------
  {
    const c = await api(P.base, A, "POST", "/api/designs", { name: `dbverify-${RUN_ID}-isolation` });
    const designId = c.json?.designId;
    created.push(designId);
    const s1 = await api(P.base, A, "POST", `/api/designs/${designId}/revisions`, saveBody({ revision: 1, expectedPreviousRevision: null }));
    const fake = randomUUID();
    const probes = [
      ["GET", ""], ["GET", "/revisions"], ["GET", "/revisions/1"],
      ["POST", "/revisions", saveBody({ revision: 2, expectedPreviousRevision: 1 })],
    ];
    const ev = [`A create ${c.status}, A save rev1 ${s1.status}`];
    let ok = c.status === 201 && s1.status === 201;
    for (const [m, p, body] of probes) {
      const hidden = await api(P.base, B, m, `/api/designs/${designId}${p}`, body);
      const missing = await api(P.base, B, m, `/api/designs/${fake}${p}`, body);
      const same = hidden.status === 404 && hidden.text === missing.text;
      ok &&= same;
      ev.push(`B ${m} ${p || "/"} -> ${hidden.status} ${hidden.json?.code}; identical to nonexistent: ${same}`);
    }
    const list = await api(P.base, B, "GET", "/api/designs");
    const leaked = (list.json?.designs || []).some((d) => d.designId === designId);
    ok &&= list.status === 200 && !leaked;
    ev.push(`B list contains A's design: ${leaked}`);
    // Postgres itself, not our code: B's token straight at PostgREST.
    const dSel = await rest(stack, B, "GET", `wardrobe_designs?id=eq.${designId}&select=id`);
    const rSel = await rest(stack, B, "GET", `wardrobe_revisions?design_id=eq.${designId}&select=revision`);
    const body2 = saveBody({ revision: 2 });
    const rIns = await rest(stack, B, "POST", "wardrobe_revisions", {
      design_id: designId, revision: 2, fingerprint: body2.fingerprint, furnispec: body2.furniSpec, part_graph: body2.partGraph,
    });
    const dUpd = await rest(stack, B, "PATCH", `wardrobe_designs?id=eq.${designId}`, { name: "taken over" }, "return=representation");
    const aRows = await revisionRows(stack, A, designId);
    const aDesign = (await rest(stack, A, "GET", `wardrobe_designs?id=eq.${designId}&select=name`)).json;
    ok &&= Array.isArray(dSel.json) && dSel.json.length === 0 && Array.isArray(rSel.json) && rSel.json.length === 0;
    ok &&= rIns.status === 403 || rIns.status === 401;
    ok &&= Array.isArray(dUpd.json) && dUpd.json.length === 0;
    ok &&= aRows.length === 1 && aDesign?.[0]?.name === `dbverify-${RUN_ID}-isolation`;
    ev.push(`PostgREST as B: select design ${dSel.status} rows=${dSel.json?.length}; select revisions rows=${rSel.json?.length}; insert revision ${rIns.status} ${rIns.json?.code ?? ""}; update design rows=${dUpd.json?.length}`);
    ev.push(`A afterwards: revision rows=${aRows.length}, name unchanged=${aDesign?.[0]?.name === `dbverify-${RUN_ID}-isolation`}`);
    record("T1", "two-user isolation — API AND PostgreSQL refuse B, hidden == nonexistent", ok ? "PASS" : "FAIL", ev);
  }

  // ---- T2 competing writes ----------------------------------------------
  {
    const c = await api(P.base, A, "POST", "/api/designs", { name: `dbverify-${RUN_ID}-race` });
    const designId = c.json?.designId;
    created.push(designId);
    await api(P.base, A, "POST", `/api/designs/${designId}/revisions`, saveBody({ revision: 1, expectedPreviousRevision: null }));
    const finishes = ["melamine", "painted", "veneer"];
    let ok = true;
    const tallies = [];
    let staleCount = 0, conflictCount = 0, concurrentStale = 0;
    for (let round = 0; round < ROUNDS; round++) {
      const prev = round + 1, next = round + 2;
      const startAt = Date.now() + 400;
      const outs = await Promise.all(
        Array.from({ length: WRITERS }, (_, w) =>
          new Promise((resolve) => {
            const child = spawn(process.execPath, [path.join(ROOT, "scripts/db-verify/race-worker.mjs")], { stdio: ["pipe", "pipe", "pipe"] });
            let buf = "", err = "";
            child.stdout.on("data", (d) => (buf += d));
            child.stderr.on("data", (d) => (err += d));
            child.on("exit", (code) => {
              try { resolve(JSON.parse(buf)); }
              catch { resolve({ worker: w, status: -1, workerExit: code, workerStderr: err.split("\n").filter((l) => !/Warning|MODULE_TYPELESS|Reparsing|trace-warnings|eliminate this/.test(l)).join(" ").slice(0, 300) }); }
            });
            child.stdin.end(JSON.stringify({
              worker: w, startAt, token: A, url: `${P.base}/api/designs/${designId}/revisions`,
              body: saveBody({ revision: next, expectedPreviousRevision: prev, finishType: finishes[w % 3], origins: { "dbverify.writer": `${round}-${w}` } }),
            }));
          })
        )
      );
      const winners = outs.filter((o) => o.status === 201);
      const losers = outs.filter((o) => o.status !== 201);
      const rows = await revisionRows(stack, A, designId, next);
      staleCount += losers.filter((o) => o.code === "STALE_REVISION").length;
      conflictCount += losers.filter((o) => o.code === "CONFLICT_REVISION").length;
      concurrentStale += losers.filter((o) => o.concurrent).length;
      const spread = Math.max(...outs.map((o) => o.sentAt)) - Math.min(...outs.map((o) => o.sentAt));
      const roundOk = winners.length === 1 && losers.every((o) => o.status === 409 && o.code === "STALE_REVISION") && rows.length === 1;
      if (!roundOk) ok = false;
      if (!roundOk) tallies.push(`BAD round ${round + 1} detail: ${JSON.stringify(losers.filter((o) => o.code !== "STALE_REVISION"))}`);
      tallies.push(`${roundOk ? "ok " : "BAD"} round ${round + 1}: 201×${winners.length}, 409 STALE×${losers.filter((o) => o.code === "STALE_REVISION").length}, other×${losers.filter((o) => o.code !== "STALE_REVISION").length}, rows(rev ${next})=${rows.length}, send spread ${spread} ms`);
    }
    record("T2", `competing writes — ${ROUNDS} rounds × ${WRITERS} separate processes, exactly one winner`, ok ? "PASS" : "FAIL", [
      ...tallies.filter((t) => t.startsWith("BAD")).slice(0, 10),
      `${tallies.filter((t) => t.startsWith("ok")).length}/${ROUNDS} rounds clean; losers STALE_REVISION=${staleCount} (of which decided by the unique constraint, details.concurrent=true: ${concurrentStale}); CONFLICT_REVISION=${conflictCount}`,
      tallies[0], tallies[tallies.length - 1],
    ]);
  }

  // ---- T3 lost-response retry -------------------------------------------
  {
    const c = await api(P.base, A, "POST", "/api/designs", { name: `dbverify-${RUN_ID}-lost-response` });
    const designId = c.json?.designId;
    created.push(designId);
    await api(P.base, A, "POST", `/api/designs/${designId}/revisions`, saveBody({ revision: 1, expectedPreviousRevision: null }));
    const body = saveBody({ revision: 2, expectedPreviousRevision: 1, finishType: "veneer" });
    const proxy = await responseDroppingProxy(P.port);
    let clientSaw;
    try {
      await fetch(`http://127.0.0.1:${proxy.port}/api/designs/${designId}/revisions`, {
        method: "POST", headers: { authorization: `Bearer ${A}`, "content-type": "application/json" }, body: JSON.stringify(body),
      });
      clientSaw = "a response (proxy failed to drop it)";
    } catch (e) {
      clientSaw = `no response (${e.cause?.code || e.name})`;
    }
    await proxy.close();
    const afterLoss = await revisionRows(stack, A, designId, 2);
    const retry = await api(P.base, A, "POST", `/api/designs/${designId}/revisions`, body);
    const afterRetry = await revisionRows(stack, A, designId, 2);
    const changed = saveBody({ revision: 2, expectedPreviousRevision: 1, finishType: "painted" });
    const changedRetry = await api(P.base, A, "POST", `/api/designs/${designId}/revisions`, changed);
    const afterChanged = await revisionRows(stack, A, designId, 2);
    const ok =
      clientSaw.startsWith("no response") && /^HTTP\/1\.1 201/.test(proxy.seen.upstreamStatusLine || "") &&
      afterLoss.length === 1 &&
      retry.status === 200 && retry.json?.idempotentReplay === true && afterRetry.length === 1 &&
      changedRetry.status === 409 && changedRetry.json?.code === "STALE_REVISION" &&
      afterChanged.length === 1 && afterChanged[0].fingerprint === body.fingerprint;
    record("T3", "lost response — committed once, identical retry is a replay, changed retry refused", ok ? "PASS" : "FAIL", [
      `server produced: ${proxy.seen.upstreamStatusLine}; client received: ${clientSaw}`,
      `rows for rev 2 after the lost response: ${afterLoss.length}`,
      `identical retry -> ${retry.status} idempotentReplay=${retry.json?.idempotentReplay}; rows ${afterRetry.length}`,
      `changed-content retry -> ${changedRetry.status} ${changedRetry.json?.code}; rows ${afterChanged.length}; stored fingerprint unchanged=${afterChanged[0]?.fingerprint === body.fingerprint}`,
    ]);
  }

  // ---- T4 durability across independent server processes ----------------
  {
    const P1 = await startApiProcess(durableEnv);
    const c = await api(P1.base, A, "POST", "/api/designs", { name: `dbverify-${RUN_ID}-durability` });
    const designId = c.json?.designId;
    created.push(designId);
    const body = saveBody({ revision: 1, expectedPreviousRevision: null });
    const s = await api(P1.base, A, "POST", `/api/designs/${designId}/revisions`, body);
    const exit1 = await stopProcess(P1);
    const refused = await portRefuses(P1.port);
    const P2 = await startApiProcess(durableEnv);
    const r = await api(P2.base, A, "GET", `/api/designs/${designId}/revisions/1`);
    const same =
      r.status === 200 && r.json?.fingerprint === body.fingerprint &&
      digest(r.json?.furniSpec) === digest(body.furniSpec) && digest(r.json?.partGraph) === digest(body.partGraph);
    await stopProcess(P2);

    // NEGATIVE CONTROL — the identical journey on the in-memory store MUST fail,
    // or this test cannot tell durable from not.
    const memEnv = { NODE_ENV: "test", FURNIAI_PERSISTENCE_TEST_AUTH: "yes" };
    const M1 = await startApiProcess(memEnv);
    const testUser = `Bearer-less-test-user-${RUN_ID}`;
    const mc = await api(M1.base, `test:${testUser}`, "POST", "/api/designs", { name: "control" });
    const ms = await api(M1.base, `test:${testUser}`, "POST", `/api/designs/${mc.json?.designId}/revisions`, body);
    const mSameProc = await api(M1.base, `test:${testUser}`, "GET", `/api/designs/${mc.json?.designId}/revisions/1`);
    await stopProcess(M1);
    const M2 = await startApiProcess(memEnv);
    const mr = await api(M2.base, `test:${testUser}`, "GET", `/api/designs/${mc.json?.designId}/revisions/1`);
    await stopProcess(M2);
    const controlDetects = ms.status === 201 && mSameProc.status === 200 && mr.status === 404;

    const independent = P1.identity.pid !== P2.identity.pid && P1.identity.bootId !== P2.identity.bootId && refused;
    record("T4", "durability — written by process 1, which is then gone; reopened by a different process 2", same && independent && controlDetects ? "PASS" : "FAIL", [
      `P1 pid ${P1.identity.pid} boot ${P1.identity.bootId.slice(0, 8)} store=${P1.identity.store}: create ${c.status}, save ${s.status}; exit ${exit1}; port now refuses connections: ${refused}`,
      `P2 pid ${P2.identity.pid} boot ${P2.identity.bootId.slice(0, 8)} store=${P2.identity.store}: reopen ${r.status}; fingerprint, FurniSpec and PartGraph identical: ${same}`,
      `negative control (memory store): same process reopen ${mSameProc.status}, fresh process reopen ${mr.status} — the test detects non-durability: ${controlDetects}`,
      "no fixed wait is used anywhere: independence is shown by pid, boot id and a refused port",
    ]);
  }

  // ---- T5 immutability at the database ----------------------------------
  {
    // Either a permission error, or a policy-filtered zero-row "success".
    const refusedOrNoop = (r) => r.status === 401 || r.status === 403 || (Array.isArray(r.json) && r.json.length === 0);
    const c = await api(P.base, A, "POST", "/api/designs", { name: `dbverify-${RUN_ID}-immutable` });
    const designId = c.json?.designId;
    created.push(designId);
    const body = saveBody({ revision: 1, expectedPreviousRevision: null });
    await api(P.base, A, "POST", `/api/designs/${designId}/revisions`, body);
    const upd = await rest(stack, A, "PATCH", `wardrobe_revisions?design_id=eq.${designId}`, { fingerprint: "tampered" }, "return=representation");
    const del = await rest(stack, A, "DELETE", `wardrobe_revisions?design_id=eq.${designId}`, undefined, "return=representation");
    const delDesign = await rest(stack, A, "DELETE", `wardrobe_designs?id=eq.${designId}`, undefined, "return=representation");
    const owner = await rest(stack, A, "PATCH", `wardrobe_designs?id=eq.${designId}`, { owner_user_id: stack.users.B }, "return=representation");
    const rows = await revisionRows(stack, A, designId);
    const ok =
      refusedOrNoop(upd) && refusedOrNoop(del) &&
      refusedOrNoop(delDesign) &&
      owner.status >= 400 &&
      rows.length === 1 && rows[0].fingerprint === body.fingerprint;
    record("T5", "immutability — the OWNER cannot update/delete a revision, delete the design, or give it away", ok ? "PASS" : "FAIL", [
      `owner PATCH revision -> ${upd.status}, rows affected ${upd.json?.length ?? "?"}`,
      `owner DELETE revision -> ${del.status}, rows affected ${del.json?.length ?? "?"}`,
      `owner DELETE design (would cascade to revisions) -> ${delDesign.status}, rows affected ${Array.isArray(delDesign.json) ? delDesign.json.length : delDesign.json?.code ?? "?"}`,
      `owner PATCH owner_user_id -> ${owner.status} ${owner.json?.code ?? ""}`,
      `revision rows afterwards ${rows.length}, fingerprint intact ${rows[0]?.fingerprint === body.fingerprint}`,
    ]);
  }

  // ---- T6 contract details that only a real database can confirm --------
  {
    const c = await api(P.base, A, "POST", "/api/designs", { name: `dbverify-${RUN_ID}-contract` });
    const designId = c.json?.designId;
    created.push(designId);
    await api(P.base, A, "POST", `/api/designs/${designId}/revisions`, saveBody({ revision: 1, expectedPreviousRevision: null }));
    const noCas = await api(P.base, A, "POST", `/api/designs/${designId}/revisions`, saveBody({ revision: 2 }));
    const bad = await api(P.base, A, "GET", "/api/designs/not-a-uuid");
    const missing = await api(P.base, A, "GET", `/api/designs/${randomUUID()}`);
    const rawBad = await rest(stack, A, "GET", "wardrobe_designs?id=eq.not-a-uuid&select=id");
    const clientId = await api(P.base, A, "POST", "/api/designs", { name: "x", designId: randomUUID() });
    // The store touches updated_at after a save; the narrowed column grant must still allow it.
    const row = (await rest(stack, A, "GET", `wardrobe_designs?id=eq.${designId}&select=created_at,updated_at`)).json?.[0];
    const touched = Boolean(row) && row.updated_at !== row.created_at;
    const ok =
      noCas.status === 400 && noCas.json?.code === "BAD_REQUEST" &&
      bad.status === 404 && bad.text === missing.text &&
      clientId.status === 400 && touched;
    record("T6", "contract — CAS mandatory, malformed id == nonexistent, client ids refused", ok ? "PASS" : "FAIL", [
      `save without expectedPreviousRevision -> ${noCas.status} ${noCas.json?.code}`,
      `GET /api/designs/not-a-uuid -> ${bad.status}; identical to a nonexistent uuid: ${bad.text === missing.text}`,
      `(PostgREST itself answers a malformed uuid filter with ${rawBad.status} ${rawBad.json?.code ?? ""} — which is why the store must not forward it)`,
      `create with a client-chosen designId -> ${clientId.status} ${clientId.json?.code}`,
      `design updated_at advanced after a save (column grant allows the store's touch): ${touched}`,
    ]);
  }

  // ---- T7 truthful failure reporting ------------------------------------
  if (stack.setRestDown) {
    const c = await api(P.base, A, "POST", "/api/designs", { name: `dbverify-${RUN_ID}-outage` });
    const designId = c.json?.designId;
    created.push(designId);
    stack.setRestDown(true);
    const read = await api(P.base, A, "GET", `/api/designs/${designId}`);
    const write = await api(P.base, A, "POST", `/api/designs/${designId}/revisions`, saveBody({ revision: 1, expectedPreviousRevision: null }));
    stack.setRestDown(false);
    const unconfigured = await startApiProcess({ NODE_ENV: "production", VERCEL_ENV: "preview" });
    const nc = await api(unconfigured.base, A, "GET", "/api/designs");
    await stopProcess(unconfigured);
    const ok =
      read.status === 503 && read.json?.code === "STORAGE_UNAVAILABLE" && !/not saved/i.test(read.json?.error || "") &&
      write.status === 503 && write.json?.code === "STORAGE_UNAVAILABLE" && /not saved/i.test(write.json?.error || "") &&
      nc.status === 503 && nc.json?.code === "PERSISTENCE_NOT_CONFIGURED";
    record("T7", "storage outage and missing configuration are reported as what they are", ok ? "PASS" : "FAIL", [
      `store unreachable: read -> ${read.status} ${read.json?.code} "${read.json?.error}"`,
      `store unreachable: save -> ${write.status} ${write.json?.code} "${write.json?.error}"`,
      `deployment without SUPABASE_URL, signed-in caller -> ${nc.status} ${nc.json?.code}`,
    ]);
  } else {
    record("T7", "storage outage reporting", "NOT RUN", "target mode cannot take a real Supabase project offline");
  }

  await stopProcess(P);
} catch (err) {
  exitCode = 2;
  say(`\nHARNESS ERROR: ${err?.message || err}`);
  if (stack.diagnostics) say(JSON.stringify(stack.diagnostics()).slice(0, 1500));
} finally {
  for (const c of children) c.kill("SIGTERM");
  await stack.stop();
}

const failed = results.filter((r) => r.verdict === "FAIL").length;
const notRun = results.filter((r) => r.verdict === "NOT RUN").length;
say(`\nSUMMARY  ${results.filter((r) => r.verdict === "PASS").length} pass · ${failed} fail · ${notRun} not run  (mode ${stack.kind})`);
if (stack.kind === "target") {
  say("TEARDOWN  these designs were created and CANNOT be deleted through the API or PostgREST by design.");
  say("          Remove them in the SQL editor of the non-production project:");
  say(`          delete from public.wardrobe_designs where id in (${created.filter(Boolean).map((d) => `'${d}'`).join(", ")});`);
} else {
  say("TEARDOWN  local cluster, PostgREST and data directory deleted.");
}
if (opt("--json")) writeFileSync(opt("--json"), scrub(JSON.stringify({ runId: RUN_ID, mode: stack.kind, versions: stack.versions, results }, null, 2)));
process.exit(exitCode || (failed ? 1 : 0));
