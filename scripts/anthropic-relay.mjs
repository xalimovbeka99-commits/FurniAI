/**
 * SANDBOX-ONLY relay. The workspace VM has no DNS; outbound HTTPS works only
 * through the proxy, which curl honours natively and node-fetch (used by
 * @anthropic-ai/sdk) does not. This listens on 127.0.0.1 and forwards each
 * request to api.anthropic.com with curl, so the REAL SDK reaches the REAL
 * API. Nothing about the application changes — ANTHROPIC_BASE_URL is an
 * environment variable the SDK already supports.
 *
 * The API key is passed to curl through a config file, never through argv,
 * so it cannot appear in a process listing. It is never logged.
 */
import http from "node:http";
import { execFile } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export async function startAnthropicRelay() {
  const dir = mkdtempSync(path.join(tmpdir(), "fa-relay-"));
  const calls = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    const bodyFile = path.join(dir, "body.json");
    const cfgFile = path.join(dir, "curl.cfg");
    writeFileSync(bodyFile, body);

    const headerLines = [];
    for (const [name, value] of Object.entries(req.headers)) {
      if (["host", "content-length", "connection", "accept-encoding"].includes(name.toLowerCase())) continue;
      headerLines.push(`header = "${name}: ${String(value).replace(/"/g, '\\"')}"`);
    }
    writeFileSync(cfgFile, headerLines.join("\n") + "\n", { mode: 0o600 });

    const url = `https://api.anthropic.com${req.url}`;
    const started = Date.now();
    execFile("curl", ["-s", "-S", "--max-time", "90", "-X", req.method, "--config", cfgFile,
                      "--data-binary", `@${bodyFile}`, "-w", "\n%{http_code}", url],
      { maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
          calls.push({ status: 0, ms: Date.now() - started });
          res.writeHead(502, { "content-type": "application/json" });
          return res.end(JSON.stringify({ type: "error", error: { type: "relay_error", message: String(stderr || err.message).slice(0, 200) } }));
        }
        const idx = stdout.lastIndexOf("\n");
        const payload = stdout.slice(0, idx);
        const status = Number(stdout.slice(idx + 1).trim()) || 502;
        calls.push({ status, ms: Date.now() - started, path: req.url });
        res.writeHead(status, { "content-type": "application/json" });
        res.end(payload);
      });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  server.unref();
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    calls,
    close: () => new Promise((r) => server.close(() => { rmSync(dir, { recursive: true, force: true }); r(); })),
    closeSync: () => {
      try { server.close(); } catch {}
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    },
  };
}
