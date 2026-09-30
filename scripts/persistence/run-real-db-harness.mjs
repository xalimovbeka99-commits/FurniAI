#!/usr/bin/env node
/**
 * Persistence real-DB / simulated harness entrypoint.
 * Modes: --simulated (default) | --real-db
 * NOT production code. Does not modify src/lib/persistence.
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, gateRealDb, redactSecrets } from "../../tests/persistence/real-db/helpers/env.js";
import { formatReport, writeReport } from "../../tests/persistence/real-db/helpers/report.js";
import { createSimulatedWorld } from "../../tests/persistence/real-db/helpers/simulatedBackend.js";
import { createHttpClient } from "../../tests/persistence/real-db/helpers/httpClient.js";
import { AssertError } from "../../tests/persistence/real-db/helpers/assert.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const casesDir = path.join(root, "tests/persistence/real-db/cases");

const CASE_FILES = [
  "01-auth-create-save-reopen.js",
  "02-two-user-isolation.js",
  "03-concurrent-saves.js",
  "04-retry-after-lost-response.js",
  "05-durability-across-processes.js",
  "06-identity-content-consistency.js",
];

async function loadCases() {
  const out = [];
  for (const file of CASE_FILES) {
    const mod = await import(pathToFileURL(path.join(casesDir, file)).href);
    out.push({ file, meta: mod.meta, run: mod.run });
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const startedAt = new Date().toISOString();
  const notes = [];
  const results = [];

  let ctx;
  if (args.mode === "real-db") {
    const gate = gateRealDb();
    if (!gate.ok) {
      notes.push(`REAL-DB ${gate.reason}`);
      if (gate.missing?.length) notes.push(`Missing: ${gate.missing.join(", ")}`);
      if (gate.refuse?.length) notes.push(`Refuse: ${gate.refuse.join(", ")}`);
      for (const file of CASE_FILES) {
        results.push({
          id: file.slice(0, 2),
          title: file,
          procedureSection: "—",
          status: "BLOCKED",
          evidence: [gate.reason],
          error: null,
        });
      }
      const finishedAt = new Date().toISOString();
      const md = formatReport({ mode: "real-db", startedAt, finishedAt, results, notes });
      const reportPath =
        args.reportPath ||
        path.join(root, "tests/persistence/real-db/reports/real-db-blocked.md");
      writeReport(reportPath, md);
      console.log(redactSecrets(md));
      console.log(`\nReport: ${reportPath}`);
      process.exitCode = 2;
      return;
    }
    const http = createHttpClient({
      testUrl: gate.config.testUrl,
      tokenA: gate.config.tokenA,
      tokenB: gate.config.tokenB,
      designPrefix: gate.config.designPrefix,
    });
    ctx = {
      mode: "real-db",
      http,
      httpConfig: {
        testUrl: gate.config.testUrl,
        tokenA: gate.config.tokenA,
        tokenB: gate.config.tokenB,
        designPrefix: gate.config.designPrefix,
      },
    };
    notes.push(`REAL-DB target ${gate.config.testUrl.replace(/https?:\/\//, "")}`);
  } else {
    const world = createSimulatedWorld();
    ctx = { mode: "simulated", world };
    notes.push("SIMULATED via createFakePostgrest — not proof of Postgres durability");
  }

  const cases = await loadCases();
  for (const c of cases) {
    const started = Date.now();
    try {
      const out = await c.run(ctx);
      results.push({
        id: c.meta.id,
        title: c.meta.title,
        procedureSection: c.meta.procedureSection,
        status: out.status || "PASS",
        evidence: out.evidence || [],
        error: null,
        ms: Date.now() - started,
      });
      console.log(`[${out.status || "PASS"}] ${c.meta.id} ${c.meta.title}`);
    } catch (err) {
      const evidence = err instanceof AssertError ? err.evidence : [];
      evidence.push(redactSecrets(err.message || String(err)));
      results.push({
        id: c.meta.id,
        title: c.meta.title,
        procedureSection: c.meta.procedureSection,
        status: "FAIL",
        evidence,
        error: redactSecrets(err.stack || err.message || String(err)),
        ms: Date.now() - started,
      });
      console.log(`[FAIL] ${c.meta.id} ${c.meta.title}: ${redactSecrets(err.message)}`);
    }
  }

  if (ctx.world?.cleanup) await ctx.world.cleanup();
  if (ctx.http?.cleanup) await ctx.http.cleanup();

  const finishedAt = new Date().toISOString();
  const md = formatReport({ mode: args.mode, startedAt, finishedAt, results, notes });
  const defaultReport =
    args.mode === "real-db"
      ? path.join(root, "tests/persistence/real-db/reports/real-db-latest.md")
      : path.join(root, "tests/persistence/real-db/reports/simulated-latest.md");
  const reportPath = args.reportPath || defaultReport;
  writeReport(reportPath, md);
  console.log(`\nReport: ${reportPath}`);

  const failed = results.some((r) => r.status === "FAIL");
  const blocked = results.every((r) => r.status === "BLOCKED");
  process.exitCode = failed ? 1 : blocked ? 2 : 0;
}

main().catch((err) => {
  console.error(redactSecrets(err.stack || String(err)));
  process.exitCode = 1;
});
