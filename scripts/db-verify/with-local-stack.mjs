#!/usr/bin/env node
/**
 * scripts/db-verify/with-local-stack.mjs
 * ---------------------------------------------------------------------
 * Runs ANY command against a throwaway real PostgreSQL + PostgREST + the real
 * /api/designs handlers, then deletes everything. It exists so the two
 * persistence harnesses share one database setup instead of each growing its
 * own:
 *
 *   node scripts/db-verify/with-local-stack.mjs -- \
 *        node scripts/persistence/run-real-db-harness.mjs --real-db   # Grok's
 *
 * The child receives, in its ENVIRONMENT only (never printed, never written):
 *   PERSISTENCE_REAL_DB=1, FURNIAI_TEST_URL (the API process),
 *   SUPABASE_URL + SUPABASE_ANON_KEY (local gateway shim), TOKEN_A, TOKEN_B
 *   (two distinct users), and FURNIAI_DB_TEST_* equivalents.
 *
 * Same limits as `verify-persistence-db.mjs --local`: PostgreSQL, PostgREST,
 * RLS and the committed migration are real; GoTrue is a JWT shim. It proves
 * nothing about a hosted Supabase project. Must run as a non-root user with
 * initdb/postgres/psql and a postgrest binary available.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startLocalStack } from "./local-stack.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sep = process.argv.indexOf("--");
const cmd = sep >= 0 ? process.argv.slice(sep + 1) : [];
if (cmd.length === 0) {
  process.stderr.write("usage: with-local-stack.mjs -- <command> [args...]\n");
  process.exit(2);
}

const stack = await startLocalStack({
  root: ROOT,
  migration: path.join(ROOT, "supabase/migrations/2026-09-22_wardrobe_design_persistence.sql"),
});
const secrets = [stack.tokens.A, stack.tokens.B];
const scrub = (s) => secrets.reduce((acc, t) => acc.split(t).join("«redacted»"), String(s));

const api = spawn(process.execPath, [path.join(ROOT, "scripts/db-verify/api-server.mjs")], {
  env: { PATH: process.env.PATH, SUPABASE_URL: stack.supabaseUrl, SUPABASE_ANON_KEY: stack.anonKey, NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"],
});
const port = await new Promise((resolve, reject) => {
  let buf = "";
  const t = setTimeout(() => reject(new Error("api-server did not start")), 20000);
  api.stdout.on("data", (d) => {
    buf += d;
    const m = /READY (\d+)/.exec(buf);
    if (m) { clearTimeout(t); resolve(Number(m[1])); }
  });
  api.once("exit", (c) => reject(new Error(`api-server exited early (${c})`)));
});

process.stdout.write(
  `with-local-stack: PostgreSQL ${stack.versions.postgres}, ${stack.versions.postgrest}, API 127.0.0.1:${port} (tokens withheld)\n`
);

const childEnv = {
  ...process.env,
  PERSISTENCE_REAL_DB: "1",
  FURNIAI_TEST_URL: `http://127.0.0.1:${port}`,
  SUPABASE_URL: stack.supabaseUrl,
  SUPABASE_ANON_KEY: stack.anonKey,
  TOKEN_A: stack.tokens.A,
  TOKEN_B: stack.tokens.B,
  FURNIAI_DB_TEST_SUPABASE_URL: stack.supabaseUrl,
  FURNIAI_DB_TEST_ANON_KEY: stack.anonKey,
  FURNIAI_DB_TEST_TOKEN_A: stack.tokens.A,
  FURNIAI_DB_TEST_TOKEN_B: stack.tokens.B,
};
delete childEnv.SUPABASE_SERVICE_ROLE_KEY;
delete childEnv.VERCEL_ENV;

let code = 1;
try {
  const child = spawn(cmd[0], cmd.slice(1), { env: childEnv, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (d) => process.stdout.write(scrub(d)));
  child.stderr.on("data", (d) => process.stderr.write(scrub(d)));
  code = await new Promise((r) => child.once("exit", (c) => r(c ?? 1)));
} finally {
  api.kill("SIGTERM");
  await new Promise((r) => (api.exitCode !== null ? r() : api.once("exit", r)));
  await stack.stop();
  process.stdout.write("with-local-stack: cluster, PostgREST and data directory deleted.\n");
}
process.exit(code);
