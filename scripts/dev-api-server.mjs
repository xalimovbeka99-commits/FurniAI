#!/usr/bin/env node
/**
 * scripts/dev-api-server.mjs
 * ---------------------------------------------------------------------
 * Local server that actually RUNS the deployed Vercel Serverless Functions
 * under api/, rather than serving static files. scripts/static-server.js is
 * static-only and scripts/dev-server.js mounts /api/chat alone, so neither
 * can exercise POST /api/design/propose.
 *
 * This mirrors what Vercel does for a framework:null project: every
 * `api/**|*.js` module's default export is mounted at its path, with a
 * minimal Vercel-compatible (req, res) shim.
 *
 * Usage:  node scripts/dev-api-server.mjs [--port 8787] [--routes api/design/propose.js]
 * Reads .env.local for provider credentials. Never prints a credential.
 */
import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function loadEnvLocal(root = ROOT) {
  const file = path.join(root, ".env.local");
  if (!existsSync(file)) return { loaded: false, keys: [] };
  const keys = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const [, key, rawValue] = m;
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (value === "") continue;
    if (process.env[key] === undefined) process.env[key] = value;
    keys.push(key); // names only — never values
  }
  return { loaded: true, keys };
}

/** Minimal Vercel-compatible response shim over a node ServerResponse. */
function makeRes(res) {
  const shim = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(obj) { return this.send(JSON.stringify(obj)); },
    send(body) {
      res.writeHead(this.statusCode, { "content-type": "application/json", ...this.headers });
      res.end(typeof body === "string" ? body : JSON.stringify(body));
      return this;
    },
  };
  return shim;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return raw; }
}

/**
 * @param {{routes?: string[], port?: number, root?: string}} options
 * @returns {Promise<{server: http.Server, port: number, mounted: string[], close: () => Promise<void>}>}
 */
export async function startApiServer({ routes = ["api/design/propose.js"], port = 0, root = ROOT } = {}) {
  const handlers = new Map();
  for (const relative of routes) {
    const modulePath = path.join(root, relative);
    if (!existsSync(modulePath)) throw new Error(`No such API function: ${relative}`);
    const mod = await import(pathToFileURL(modulePath).href);
    if (typeof mod.default !== "function") throw new Error(`${relative} has no default export handler.`);
    const route = "/" + relative.replace(/\.js$/, "").replace(/\\/g, "/");
    handlers.set(route, mod.default);
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const handler = handlers.get(url.pathname);
    if (!handler) {
      res.writeHead(404, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ok: false, code: "NOT_FOUND", error: `No API function at ${url.pathname}` }));
    }
    req.body = req.method === "POST" ? await readBody(req) : undefined;
    req.query = Object.fromEntries(url.searchParams);
    try {
      await handler(req, makeRes(res));
    } catch (err) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, code: "HANDLER_THREW", error: String(err?.message ?? err) }));
    }
  });

  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return {
    server,
    port: server.address().port,
    mounted: [...handlers.keys()],
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

// CLI
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const argv = process.argv.slice(2);
  const portArg = argv.indexOf("--port");
  const routesArg = argv.indexOf("--routes");
  const env = loadEnvLocal();
  const { port, mounted } = await startApiServer({
    port: portArg >= 0 ? Number(argv[portArg + 1]) : Number(process.env.PORT || 8787),
    routes: routesArg >= 0 ? argv[routesArg + 1].split(",") : undefined,
  });
  console.log(`dev-api-server listening on http://127.0.0.1:${port}`);
  console.log(`mounted: ${mounted.join(", ")}`);
  console.log(`.env.local: ${env.loaded ? `loaded, defines ${env.keys.length} key(s) (names withheld)` : "not present"}`);
}
