#!/usr/bin/env node
/**
 * DEMO-ONLY static server for docs/m3/asset-viewer/demo (repo root as web
 * root, so the page imports the real src/lib/assetViewer/*.js unbundled).
 *
 *   node docs/m3/asset-viewer/demo/serve.mjs [port]     (default 4318)
 *   open http://127.0.0.1:4318/docs/m3/asset-viewer/demo/?three=r166
 *        http://127.0.0.1:4318/docs/m3/asset-viewer/demo/?three=r128
 *
 * Extra routes (never part of the product):
 *   /__demo/r128-compat.js   three-stdlib loaders rewired to window.THREE (see r128-compat.mjs)
 *   /__slow/<path>?ms=N      streams <path> in 12 chunks over ~N ms (to show loading/progress)
 *   /__status/<code>/<name>  answers that HTTP status (SIMULATED 403 expired link / 404 / 410 / 5xx)
 *   /__demo/asset-viewer.js            esbuild IIFE of src/lib/assetViewer/entry.js (window.FurniAssetViewer)
 *   /__demo/asset-viewer-creative.js   IIFE of entry.creative.js (window.FurniAssetViewerCreative, optional)
 *   /__demo/r128-globals.js            three-stdlib loaders hung on window.THREE (stands in for r128 examples/js)
 *
 * host.html (the interim HOST page, FurniAssetViewer.mount) also uses:
 *   /__rev2/api/creative?resource=jobs|asset&jobId=…  SIMULATED rev 2 backend answering with the
 *       docs/creative/fixtures pack (read-only); the asset url points at the SYNTHETIC box GLB
 *
 * SIMULATED /api/creative stand-in (fixtures only, NOT Scenario; see
 * tests/assetViewer/helpers/creativeStandIn.js), for creative.html:
 *   /api/creative?resource=jobs|asset&jobId=&index=   contract-shaped JSON, needs "Bearer sim-token"
 *   /__simcdn/<token>/<file>?X-Sim-Signature=…        single-use signed fixture address
 *   http://127.0.0.1:<port+1>/__simcdn/…              same, but WITHOUT CORS headers (U7 simulation)
 *   /__sim/reset                                      fresh stand-in state (counters, job progress)
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { buildR128Compat, buildR128Globals } from "./r128-compat.mjs";
import { createCreativeStandIn } from "../../../../tests/assetViewer/helpers/creativeStandIn.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
};

const FIXTURES = join(ROOT, "tests", "assetViewer", "fixtures");
function simFiles() {
  const read = (n) => readFileSync(join(FIXTURES, n));
  const placeholder = read("simulated-download-only.fbx");
  return {
    "chair-textured.glb": read("chair-textured.glb"),
    "table-untextured.glb": read("table-untextured.glb"),
    "corrupt.glb": read("corrupt.glb"),
    "simulated-download-only.fbx": placeholder,
    "simulated-asset.bin": placeholder,
    "simulated-download-only.zip": placeholder,
  };
}

function sendCdn(res, r, { cors }) {
  const headers = { ...r.headers, "cache-control": "no-store", "x-furniai-simulated": "signed fixture address; not Scenario" };
  if (cors) headers["access-control-allow-origin"] = "*";
  res.writeHead(r.status, headers);
  res.end(r.bytes);
}

export async function startDemoServer(port = 4318) {
  const prevCwd = process.cwd();
  process.chdir(ROOT);
  const compat = await buildR128Compat();
  const r128Globals = await buildR128Globals();
  process.chdir(prevCwd);
  // Built per request so the page always runs the current source (never cached).
  const iife = async (file, globalName) =>
    (await esbuild({ entryPoints: [join(ROOT, "src/lib/assetViewer", file)], bundle: true, format: "iife", globalName, write: false, logLevel: "silent" })).outputFiles[0].text;
  const REV2 = join(ROOT, "docs", "creative", "fixtures");
  const REV2_GLB = "SYNTHETIC-box-not-scenario-generated.glb";
  const REV2_JOBS = {
    succeeded: "job.succeeded.200.json",
    processing: "job.processing.200.json",
    failed: "job.failed.200.json",
    "submission-unknown": "job.submission-unknown.200.json",
  };
  const rev2Count = { jobs: 0, asset: 0 };
  const rev2Api = (url) => {
    const q = url.searchParams;
    rev2Count[q.get("resource") === "asset" ? "asset" : "jobs"]++;
    const job = q.get("jobId") || "";
    let name;
    if (job === "forbidden") return { status: 403, body: { ok: false, code: "FORBIDDEN", error: "SIMULATED infrastructure 403" } };
    if (q.get("resource") === "asset") name = "asset.200.json";
    else name = Object.values(REV2_JOBS).find((f) => JSON.parse(readFileSync(join(REV2, f), "utf8")).response.job.jobId === job) || "error.missing-job.404.json";
    const f = JSON.parse(readFileSync(join(REV2, name), "utf8"));
    const body = f.response;
    if (body.asset && body.asset.url) body.asset.url = `http://127.0.0.1:${port}/docs/creative/fixtures/${REV2_GLB}`;
    return { status: f._fixture.httpStatus, body };
  };

  const makeStandIn = () =>
    createCreativeStandIn({
      files: simFiles(),
      cdnBase: `http://127.0.0.1:${port}/__simcdn`,
      blockedCdnBase: `http://127.0.0.1:${port + 1}/__simcdn`,
    });
  let sim = makeStandIn();

  // Second origin: serves the same signed addresses but sends no CORS header,
  // which is what an unverified provider CDN might do (contract U7).
  const blocked = createServer((req, res) => {
    const p = new URL(req.url, "http://x").pathname;
    if (!p.startsWith("/__simcdn/")) return res.writeHead(404).end("not found");
    sendCdn(res, sim.handleCdn(p.slice("/__simcdn".length)), { cors: false });
  });

  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    let p = decodeURIComponent(url.pathname);
    if (p === "/api/creative") {
      const r = sim.handleApi(req.method, req.url, req.headers);
      res.writeHead(r.status, r.headers);
      res.end(JSON.stringify(r.body));
      return;
    }
    if (p.startsWith("/__simcdn/")) {
      sendCdn(res, sim.handleCdn(url.pathname.slice("/__simcdn".length)), { cors: true });
      return;
    }
    if (p === "/__sim/reset") {
      sim = makeStandIn();
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify({ ok: true, simulated: true, label: sim.label }));
      return;
    }
    if (p === "/__sim/log") {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify({ simulated: true, log: sim.log }));
      return;
    }
    if (p === "/__rev2/api/creative") {
      const r = rev2Api(url);
      res.writeHead(r.status, { "content-type": MIME[".json"], "cache-control": "no-store", "x-furniai-simulated": "rev 2 fixture pack; not Scenario" });
      res.end(JSON.stringify(r.body));
      return;
    }
    if (p === "/__rev2/log") {
      res.writeHead(200, { "content-type": MIME[".json"], "cache-control": "no-store" });
      res.end(JSON.stringify({ simulated: true, calls: rev2Count }));
      return;
    }
    if (p === "/__rev2/jobs") {
      const out = {};
      for (const [k, f] of Object.entries(REV2_JOBS)) out[k] = JSON.parse(readFileSync(join(REV2, f), "utf8")).response.job;
      res.writeHead(200, { "content-type": MIME[".json"], "cache-control": "no-store" });
      res.end(JSON.stringify(out));
      return;
    }
    const st = /^\/__status\/(\d{3})\//.exec(p);
    if (st) {
      res.writeHead(Number(st[1]), { "content-type": "text/plain", "cache-control": "no-store", "x-furniai-simulated": "status route" });
      res.end(`SIMULATED ${st[1]}`);
      return;
    }
    if (p === "/__demo/asset-viewer.js" || p === "/__demo/asset-viewer-creative.js") {
      const creative = p.includes("creative");
      iife(creative ? "entry.creative.js" : "entry.js", creative ? "FurniAssetViewerCreative" : "FurniAssetViewer").then(
        (code) => {
          res.writeHead(200, { "content-type": MIME[".js"], "cache-control": "no-store" });
          res.end(code);
        },
        (e) => res.writeHead(500, { "content-type": "text/plain" }).end(String(e && e.message)),
      );
      return;
    }
    if (p === "/__demo/r128-globals.js") {
      res.writeHead(200, { "content-type": MIME[".js"], "cache-control": "no-store" });
      res.end(r128Globals);
      return;
    }
    if (p === "/__demo/r128-compat.js") {
      res.writeHead(200, { "content-type": MIME[".js"], "cache-control": "no-store" });
      res.end(compat);
      return;
    }
    let slowMs = 0;
    if (p.startsWith("/__slow/")) {
      slowMs = Math.max(0, Number(url.searchParams.get("ms") || 2000));
      p = p.slice("/__slow".length);
    }
    if (p.endsWith("/")) p += "index.html";
    const file = normalize(join(ROOT, p));
    if (!file.startsWith(ROOT) || file.includes(`${ROOT}/.git`)) {
      res.writeHead(403).end("forbidden");
      return;
    }
    if (!existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { "content-type": "text/plain" }).end("not found");
      return;
    }
    const type = MIME[extname(file)] || "application/octet-stream";
    if (!slowMs) {
      res.writeHead(200, { "content-type": type, "content-length": statSync(file).size, "cache-control": "no-store" });
      createReadStream(file).pipe(res);
      return;
    }
    const bytes = readFileSync(file);
    res.writeHead(200, { "content-type": type, "content-length": bytes.length, "cache-control": "no-store" });
    const parts = 12;
    const size = Math.ceil(bytes.length / parts);
    let i = 0;
    const tick = () => {
      if (i >= bytes.length) return res.end();
      res.write(bytes.subarray(i, i + size));
      i += size;
      setTimeout(tick, slowMs / parts);
    };
    tick();
  });
  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  await new Promise((r) => blocked.listen(port + 1, "127.0.0.1", r));
  server.on("close", () => blocked.close());
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const port = Number(process.argv[2] || 4318);
  await startDemoServer(port);
  console.log(`asset-viewer demo: http://127.0.0.1:${port}/docs/m3/asset-viewer/demo/?three=r166  (or ?three=r128)`);
  console.log(`HOST page (FurniAssetViewer.mount + window.THREE r128): http://127.0.0.1:${port}/docs/m3/asset-viewer/demo/host.html?state=loaded`);
  console.log(`SIMULATED /api/creative demo: http://127.0.0.1:${port}/docs/m3/asset-viewer/demo/creative.html  (fixtures only, not Scenario)`);
}
