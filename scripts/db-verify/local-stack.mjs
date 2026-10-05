/**
 * scripts/db-verify/local-stack.mjs
 * ---------------------------------------------------------------------
 * A throwaway, fully local stand-in for the Supabase pieces the persistence
 * path uses:
 *
 *   REAL:      PostgreSQL (initdb'd into a temp dir), PostgREST, the
 *              migration file exactly as committed, RLS, the unique
 *              constraint, uuid columns, transaction isolation.
 *   STAND-IN:  GoTrue. A 40-line HTTP shim answers GET /auth/v1/user by
 *              verifying an HS256 JWT with the same secret PostgREST uses.
 *              It proves nothing about Supabase Auth; it only lets the real
 *              handlers resolve a caller the way they do in production.
 *
 * Nothing here touches the network beyond 127.0.0.1, nothing outlives
 * `stop()`, and no credential used here exists anywhere else — the JWT secret
 * is generated per run and discarded.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

export function mintJwt(secret, claims) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...claims }));
  const sig = b64url(createHmac("sha256", secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

function verifyJwt(secret, token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  const expect = b64url(createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest());
  if (expect !== parts[2]) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    if (claims.exp && claims.exp < Date.now() / 1000) return null;
    return claims;
  } catch {
    return null;
  }
}

export async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function findBin(name, envVar) {
  if (process.env[envVar]) return process.env[envVar];
  const candidates = [];
  if (name !== "postgrest") {
    for (const v of ["17", "16", "15", "14"]) candidates.push(`/usr/lib/postgresql/${v}/bin/${name}`);
  } else {
    candidates.push("/opt/postgrest/postgrest");
  }
  for (const c of candidates) if (existsSync(c)) return c;
  const which = spawnSync("sh", ["-c", `command -v ${name}`], { encoding: "utf8" });
  if (which.status === 0 && which.stdout.trim()) return which.stdout.trim();
  throw new Error(`Cannot find ${name}. Set ${envVar} to its path.`);
}

async function waitFor(check, { timeoutMs = 20000, what = "service" } = {}) {
  const start = Date.now();
  let lastErr;
  while (Date.now() - start < timeoutMs) {
    try {
      if (await check()) return;
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`${what} did not become ready in ${timeoutMs} ms${lastErr ? `: ${lastErr.message}` : ""}`);
}

/**
 * @param {{ root: string, migration: string, extraMigrations?: string[], log?: (s: string) => void }} opts
 */
export async function startLocalStack({ root, migration, extraMigrations = [], log = () => {} }) {
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    throw new Error("PostgreSQL refuses to run as root. Run --local as an unprivileged user.");
  }
  const initdb = findBin("initdb", "PG_INITDB");
  const postgres = findBin("postgres", "PG_POSTGRES");
  const psql = findBin("psql", "PG_PSQL");
  const postgrest = findBin("postgrest", "POSTGREST_BIN");

  const dir = mkdtempSync(path.join(os.tmpdir(), "furniai-dbverify-"));
  const pgData = path.join(dir, "pgdata");
  const pgPort = await freePort();
  const restPort = await freePort();
  const shimPort = await freePort();
  const jwtSecret = randomBytes(32).toString("hex");
  const children = [];

  const init = spawnSync(initdb, ["-D", pgData, "-U", "postgres", "--auth=trust", "-E", "UTF8", "--locale=C"], { encoding: "utf8" });
  if (init.status !== 0) throw new Error(`initdb failed: ${init.stderr}`);
  log(`initdb: ${pgData}`);

  const pg = spawn(postgres, ["-D", pgData, "-p", String(pgPort), "-k", dir, "-c", "listen_addresses=127.0.0.1", "-c", "fsync=on"], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  children.push(pg);
  const pgErr = [];
  pg.stderr.on("data", (d) => pgErr.push(String(d)));

  const psqlRun = (sql, { user = "postgres", file = null } = {}) => {
    const args = ["-h", "127.0.0.1", "-p", String(pgPort), "-U", user, "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"];
    const r = spawnSync(psql, file ? [...args, "-f", file] : [...args, "-c", sql], { encoding: "utf8" });
    if (r.status !== 0) throw new Error(`psql failed: ${r.stderr}`);
    return r.stdout.trim();
  };
  await waitFor(() => { psqlRun("select 1"); return true; }, { what: "PostgreSQL" });
  const pgVersion = psqlRun("show server_version");
  log(`PostgreSQL ${pgVersion} on 127.0.0.1:${pgPort}`);

  psqlRun(null, { file: path.join(root, "scripts/db-verify/supabase-compat.sql") });
  psqlRun(null, { file: migration });
  for (const extra of extraMigrations) psqlRun(null, { file: extra });
  log(`applied: supabase-compat.sql (local stand-in), ${path.relative(root, migration)} (as committed)`);

  const confPath = path.join(dir, "postgrest.conf");
  writeFileSync(
    confPath,
    [
      `db-uri = "postgres://authenticator@127.0.0.1:${pgPort}/postgres"`,
      `db-schemas = "public"`,
      `db-anon-role = "anon"`,
      `jwt-secret = "${jwtSecret}"`,
      `server-host = "127.0.0.1"`,
      `server-port = ${restPort}`,
      `db-pool = 20`,
    ].join("\n") + "\n"
  );
  const rest = spawn(postgrest, [confPath], { stdio: ["ignore", "ignore", "pipe"] });
  children.push(rest);
  const restErr = [];
  rest.stderr.on("data", (d) => restErr.push(String(d)));
  await waitFor(async () => (await fetch(`http://127.0.0.1:${restPort}/`)).status < 500, { what: "PostgREST" });
  const restVersion = spawnSync(postgrest, ["--version"], { encoding: "utf8" }).stdout.trim();
  log(`${restVersion} on 127.0.0.1:${restPort}`);

  // The shim: /rest/v1/* -> PostgREST, /auth/v1/user -> JWT check.
  let restDown = false;
  const shim = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/auth/v1/user") {
      const token = String(req.headers.authorization || "").replace(/^Bearer\s+/, "");
      const claims = verifyJwt(jwtSecret, token);
      if (!claims?.sub) {
        res.writeHead(401, { "content-type": "application/json" });
        return res.end(JSON.stringify({ message: "invalid JWT" }));
      }
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ id: claims.sub, role: claims.role }));
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      if (restDown) {
        req.socket.destroy(); // the storage layer is unreachable
        return;
      }
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const headers = { ...req.headers };
      delete headers.host;
      delete headers.apikey; // Supabase's gateway consumes it; PostgREST ignores it
      const upstream = await fetch(`http://127.0.0.1:${restPort}${req.url.slice("/rest/v1".length)}`, {
        method: req.method,
        headers,
        body: chunks.length ? Buffer.concat(chunks) : undefined,
      });
      const buf = Buffer.from(await upstream.arrayBuffer());
      const out = {};
      upstream.headers.forEach((v, k) => { if (k !== "content-encoding" && k !== "transfer-encoding") out[k] = v; });
      res.writeHead(upstream.status, out);
      return res.end(buf);
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise((r) => shim.listen(shimPort, "127.0.0.1", r));

  const users = { A: randomUUID(), B: randomUUID() };
  psqlRun(`insert into auth.users(id, email) values ('${users.A}', 'a@local.test'), ('${users.B}', 'b@local.test')`);

  return {
    kind: "local",
    supabaseUrl: `http://127.0.0.1:${shimPort}`,
    anonKey: "local-anon-key-not-a-secret",
    users,
    tokens: {
      A: mintJwt(jwtSecret, { sub: users.A, role: "authenticated" }),
      B: mintJwt(jwtSecret, { sub: users.B, role: "authenticated" }),
    },
    // Only verify-creative-db.mjs uses this: the server-side write credential.
    serviceRoleKey: mintJwt(jwtSecret, { role: "service_role" }),
    versions: { postgres: pgVersion, postgrest: restVersion },
    sql: (s) => psqlRun(s),
    setRestDown(v) { restDown = Boolean(v); },
    async stop() {
      await new Promise((r) => shim.close(r));
      for (const c of children.reverse()) {
        c.kill("SIGTERM");
        await new Promise((r) => (c.exitCode !== null ? r() : c.once("exit", r)));
      }
      rmSync(dir, { recursive: true, force: true });
    },
    diagnostics: () => ({ postgres: pgErr.join("").slice(-2000), postgrest: restErr.join("").slice(-2000) }),
  };
}

export function readMigration(root) {
  return readFileSync(path.join(root, "supabase/migrations/2026-09-22_wardrobe_design_persistence.sql"), "utf8");
}
