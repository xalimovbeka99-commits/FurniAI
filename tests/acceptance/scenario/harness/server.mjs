/**
 * TEST HARNESS SERVER — NOT PRODUCT CODE. LOCAL / SIMULATED only.
 *
 * One local port (default 4417, never the shared 4173) serving:
 *   /api/creative         the REAL api/creative.js handler (memory store, test auth)
 *   /                     the test-only harness page (harness/index.html)
 *   /support/*            the test-side contract client + GLB inspector
 *   /vendor/three/*       three's ES build + addons straight from node_modules
 *   /src/lib/assetViewer/* the REAL asset viewer (Asset Engineer), unmodified
 *   /__cdn/*              proxy to the MOCKED CDN (Playwright maps
 *                         https://cdn.fixture.invalid/** here with page.route)
 *   /__fixture/*          test control: reset / set provider knobs / read counts
 *
 * The provider is support/fixtureProvider.js on an ephemeral 127.0.0.1 port.
 * Credentials are placeholders. Nothing here can reach Scenario.
 */
import http from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { startFixtureProvider } from "../support/fixtureProvider.js";
import { applyEnv, fixtureEnv, resetStore, store } from "../support/apiHarness.js";
import handler from "../../../../api/creative.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const PORT = Number(process.env.SCENARIO_HARNESS_PORT || 4417);
if (PORT === 4173) throw new Error("refusing the shared port 4173");

const fx = await startFixtureProvider();
applyEnv(fixtureEnv(fx.baseUrl));
let apiRequests = { config: 0, references: 0, jobsPost: 0, jobsGet: 0, asset: 0 };

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".json": "application/json" };
const STATIC = [
  ["/support/", join(HERE, "../support/")],
  ["/vendor/three/addons/", join(ROOT, "node_modules/three/examples/jsm/")],
  ["/vendor/three/", join(ROOT, "node_modules/three/build/")],
  ["/fixtures/", join(ROOT, "tests/fixtures/scenario/")],
  // the Asset Engineer's real viewer module (src/lib/assetViewer/**), served as-is
  ["/src/lib/assetViewer/", join(ROOT, "src/lib/assetViewer/")],
  ["/", join(HERE, "/")],
];

async function serveStatic(pathname, res) {
  for (const [prefix, dir] of STATIC) {
    if (!pathname.startsWith(prefix)) continue;
    const rel = pathname.slice(prefix.length) || "index.html";
    const file = normalize(join(dir, rel));
    if (!file.startsWith(normalize(dir))) break;
    try {
      const data = await readFile(file);
      res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      return res.end(data);
    } catch { /* try next */ }
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}
const json = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(obj)); };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://local");
  const p = url.pathname;
  try {
    if (p === "/api/creative") {
      const r = url.searchParams.get("resource");
      if (r === "jobs") apiRequests[req.method === "POST" ? "jobsPost" : "jobsGet"]++;
      else if (r in apiRequests) apiRequests[r]++;
      return handler(req, res);
    }
    if (p.startsWith("/__cdn/")) {
      const upstream = await fetch(`${fx.origin}/cdn/${p.slice("/__cdn/".length)}${url.search}`, { method: req.method });
      const buf = Buffer.from(await upstream.arrayBuffer());
      const headers = {};
      upstream.headers.forEach((v, k) => { if (!["content-length", "connection", "transfer-encoding", "keep-alive"].includes(k)) headers[k] = v; });
      res.writeHead(upstream.status, headers);
      return res.end(buf);
    }
    if (p === "/__fixture/state") {
      const jobs = [...store()._raw.jobs.values()].map((j) => ({ jobId: j.jobId, userId: j.userId, status: j.status }));
      return json(res, 200, { provider: { calls: fx.state.calls, issuedUrls: fx.state.issuedUrls, held: fx.state.held.length }, api: apiRequests, jobs });
    }
    if (p === "/__fixture/reset" && req.method === "POST") {
      fx.reset(await readBody(req));
      resetStore();
      apiRequests = { config: 0, references: 0, jobsPost: 0, jobsGet: 0, asset: 0 };
      return json(res, 200, { ok: true });
    }
    if (p === "/__fixture/set" && req.method === "POST") {
      Object.assign(fx.state, await readBody(req));
      return json(res, 200, { ok: true });
    }
    if (p === "/__fixture/revoke" && req.method === "POST") { fx.revokeIssued(); return json(res, 200, { ok: true }); }
    if (p === "/__fixture/release" && req.method === "POST") { return json(res, 200, { released: fx.releaseHeld((await readBody(req)).mode || "ok") }); }
    if (p === "/" || p === "/index.html") return serveStatic("/index.html", res);
    return serveStatic(p, res);
  } catch (err) {
    json(res, 500, { error: String(err?.message || err) });
  }
});
server.listen(PORT, "127.0.0.1", () => {
  console.log(`[scenario-harness] TEST HARNESS on http://127.0.0.1:${PORT}/ (provider stand-in ${fx.origin}) — SIMULATED, no Scenario calls`);
});
const stop = () => { server.close(); fx.close().finally(() => process.exit(0)); };
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
