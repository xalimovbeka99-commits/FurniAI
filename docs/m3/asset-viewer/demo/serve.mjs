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
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildR128Compat } from "./r128-compat.mjs";

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

export async function startDemoServer(port = 4318) {
  const prevCwd = process.cwd();
  process.chdir(ROOT);
  const compat = await buildR128Compat();
  process.chdir(prevCwd);

  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    let p = decodeURIComponent(url.pathname);
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
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const port = Number(process.argv[2] || 4318);
  await startDemoServer(port);
  console.log(`asset-viewer demo: http://127.0.0.1:${port}/docs/m3/asset-viewer/demo/?three=r166  (or ?three=r128)`);
}
