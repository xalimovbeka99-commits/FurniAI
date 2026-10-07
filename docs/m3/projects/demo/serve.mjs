// Static server for the SYNTHETIC/MOCKED demo, rooted at the repo so /src and /tests resolve.
//   node docs/m3/projects/demo/serve.mjs [port]   -> http://127.0.0.1:<port>/docs/m3/projects/demo/
//
// It also answers a MOCKED stand-in of the existing /api/creative GET routes under
// /__mock-api/creative (never the real path, never a real backend), used only by the
// "reload" demo state so a real page reload can be tested: the job record lives in THIS
// process, not in the browser. It is not a storage service and ships nowhere.
// State is per session id <sid> (one per test project, so parallel runs don't share a job):
//   GET  /__mock-api/<sid>/creative?resource=jobs | jobs&jobId= | asset&jobId=&index= | config
//   POST /__mock-api/<sid>/reset?after=<n>   (the processing job succeeds after n status checks)
//   GET  /__mock-api/<sid>/stats             (request counters, for the e2e)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css",
  ".json": "application/json", ".glb": "model/gltf-binary", ".png": "image/png",
};
const FX = join(root, "tests/projects/fixtures/rev2");
const fx = (n) => JSON.parse(readFileSync(join(FX, n), "utf8")).response;

function createMockApi() {
  const list = fx("jobs.list.200.json").jobs;
  const processing = list.find((j) => j.status === "processing");
  const succeeded = list.find((j) => j.status === "succeeded");
  let m;
  const reset = (after = 2) => {
    m = { after, checks: 0, stats: { list: 0, getJob: 0, asset: 0, config: 0, unauthorized: 0 } };
  };
  reset();
  const jobNow = () => {
    const done = m.checks >= m.after;
    const t = new Date(Date.UTC(2026, 9, 4, 7, m.checks)).toISOString();
    return done
      ? { ...succeeded, jobId: processing.jobId, sourceReferenceId: processing.sourceReferenceId, createdAt: processing.createdAt, updatedAt: t, completedAt: t }
      : { ...processing, updatedAt: t };
  };
  return {
    reset,
    stats: () => ({ ...m.stats, checks: m.checks, after: m.after }),
    handle(url, headers, origin) {
      if ((headers.authorization || "") !== "Bearer mock-token") {
        m.stats.unauthorized++;
        return [401, { ok: false, code: "MISSING_AUTH", error: "Sign in required (MOCKED)." }];
      }
      const r = url.searchParams.get("resource");
      const jobId = url.searchParams.get("jobId");
      if (r === "config") return m.stats.config++, [200, fx("config.ready.200.json")];
      if (r === "jobs" && !jobId) return m.stats.list++, [200, { ok: true, jobs: [jobNow()] }];
      if (r === "jobs" && jobId === processing.jobId) {
        m.stats.getJob++;
        m.checks++;
        return [200, { ok: true, job: jobNow(), refresh: { ok: true } }];
      }
      if (r === "asset" && jobId === processing.jobId) {
        m.stats.asset++;
        if (m.checks < m.after) return [409, { ok: false, code: "ASSET_NOT_READY", error: "Not ready (MOCKED)." }];
        const a = fx("asset.200.json").asset;
        return [200, { ok: true, asset: { ...a, jobId, index: 0, url: `${origin}/tests/projects/fixtures/rev2/SYNTHETIC-box-not-scenario-generated.glb?n=${m.stats.asset}`, resolvedAt: new Date().toISOString() } }];
      }
      return [404, { ok: false, code: "MISSING_JOB", error: "Not found (MOCKED)." }];
    },
  };
}

export function startServer(port = 0) {
  const sessions = new Map();
  const apiFor = (sid) => {
    if (!sessions.has(sid)) sessions.set(sid, createMockApi());
    return sessions.get(sid);
  };
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, "http://x");
    const send = (status, obj) => res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }).end(JSON.stringify(obj));
    const mock = /^\/__mock-api\/([A-Za-z0-9_-]{1,64})\/(creative|reset|stats)$/.exec(u.pathname);
    if (mock) {
      const api = apiFor(mock[1]);
      if (mock[2] === "reset" && req.method === "POST") return api.reset(Number(u.searchParams.get("after") || 2)), send(200, { ok: true });
      if (mock[2] === "stats") return send(200, api.stats());
      if (mock[2] === "creative") {
        const [status, body] = api.handle(u, req.headers, `http://${req.headers.host}`);
        return send(status, body);
      }
    }
    const path = normalize(decodeURIComponent(u.pathname)).replace(/^([/\\])+/, "");
    const file = join(root, path.endsWith("/") || path === "" ? join(path, "index.html") : path);
    if (!file.startsWith(root)) return res.writeHead(403).end();
    try {
      const body = await readFile(file);
      res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      res.end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  return new Promise((r) => server.listen(port, "127.0.0.1", () => r(server)));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const s = await startServer(Number(process.argv[2] || 5178));
  console.log(`SYNTHETIC/MOCKED demo: http://127.0.0.1:${s.address().port}/docs/m3/projects/demo/`);
}
