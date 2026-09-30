#!/usr/bin/env node
/**
 * scripts/db-verify/api-server.mjs
 * ---------------------------------------------------------------------
 * ONE independent OS process serving the real /api/designs* handlers, for
 * scripts/verify-persistence-db.mjs. Each instance is spawned fresh, with
 * its own module graph — so its own copy of the in-memory store Map — which
 * is what makes "saved by process 1, reopened by process 2" a genuine test
 * of durability rather than of a shared module.
 *
 * GET /__server-identity returns { pid, bootId, store } so the harness can
 * PROVE the two processes are different, instead of assuming it from a wait.
 * This route exists only in this test server; nothing deployed has it.
 *
 * Configuration comes from the environment the harness sets. It never reads
 * .env.local and never prints a credential.
 */
import http from "node:http";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const load = async (rel) => (await import(pathToFileURL(path.join(ROOT, rel)).href)).default;

const handlers = {
  index: await load("api/designs/index.js"),
  design: await load("api/designs/[designId].js"),
  revisions: await load("api/designs/[designId]/revisions.js"),
  revision: await load("api/designs/[designId]/revisions/[revision].js"),
};
const { supabasePersistenceConfigured } = await import(
  pathToFileURL(path.join(ROOT, "src/lib/persistence/supabaseStore.js")).href
);

const bootId = randomUUID();

function route(pathname) {
  const seg = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (seg[0] !== "api" || seg[1] !== "designs") return null;
  if (seg.length === 2) return { h: handlers.index, query: {} };
  if (seg.length === 3) return { h: handlers.design, query: { designId: seg[2] } };
  if (seg.length === 4 && seg[3] === "revisions") return { h: handlers.revisions, query: { designId: seg[2] } };
  if (seg.length === 5 && seg[3] === "revisions") return { h: handlers.revision, query: { designId: seg[2], revision: seg[4] } };
  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (url.pathname === "/__server-identity") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(
      JSON.stringify({ pid: process.pid, bootId, store: supabasePersistenceConfigured() ? "supabase" : "memory" })
    );
  }
  const r = route(url.pathname);
  if (!r) {
    res.writeHead(404, { "content-type": "application/json" });
    return res.end(JSON.stringify({ ok: false, code: "NO_ROUTE" }));
  }
  req.query = { ...Object.fromEntries(url.searchParams), ...r.query };
  try {
    await r.h(req, res);
  } catch {
    if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, code: "HANDLER_THREW" }));
  }
});

server.listen(Number(process.env.PORT || 0), "127.0.0.1", () => {
  process.stdout.write(`READY ${server.address().port}\n`);
});
process.on("SIGTERM", () => server.close(() => process.exit(0)));
