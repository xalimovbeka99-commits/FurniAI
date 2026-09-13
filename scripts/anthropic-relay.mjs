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
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Resolve the curl binary used to forward a request.
 *
 * Production: system `curl`.
 * Tests: set ANTHROPIC_RELAY_CURL_STUB to an absolute Node script path. On
 * Windows, `execFile("curl")` ignores a PATH-shadowing `curl.cmd` and always
 * launches System32\curl.exe, so PATH stubbing alone cannot exercise the
 * concurrency harness. Invoking `node <stub> …args` keeps execFile (no shell)
 * and works on every platform.
 */
function curlInvocation(forwardArgs) {
  const stub = process.env.ANTHROPIC_RELAY_CURL_STUB;
  if (stub) {
    return { command: process.execPath, args: [stub, ...forwardArgs] };
  }
  return { command: "curl", args: forwardArgs };
}

export async function startAnthropicRelay() {
  const dir = mkdtempSync(path.join(tmpdir(), "fa-relay-"));
  const calls = [];
  let requestCounter = 0;
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    // One file pair per request. These were previously fixed names in a shared
    // directory, so two concurrent requests raced: the second overwrote the
    // first's body and headers between write and curl exec, and request A
    // could be sent to the API carrying request B's payload. Unique names
    // remove the race; both files are removed in the callback below.
    const reqId = `${process.pid.toString(36)}-${Date.now().toString(36)}-${(requestCounter += 1).toString(36)}-${randomUUID().slice(0, 8)}`;
    const bodyFile = path.join(dir, `body-${reqId}.json`);
    const cfgFile = path.join(dir, `curl-${reqId}.cfg`);
    writeFileSync(bodyFile, body);

    const headerLines = [];
    for (const [name, value] of Object.entries(req.headers)) {
      if (["host", "content-length", "connection", "accept-encoding"].includes(name.toLowerCase())) continue;
      headerLines.push(`header = "${name}: ${String(value).replace(/"/g, '\\"')}"`);
    }
    writeFileSync(cfgFile, headerLines.join("\n") + "\n", { mode: 0o600 });

    const url = `https://api.anthropic.com${req.url}`;
    const started = Date.now();
    const forwardArgs = [
      "-s", "-S", "--max-time", "90", "-X", req.method, "--config", cfgFile,
      "--data-binary", `@${bodyFile}`, "-w", "\n%{http_code}", url,
    ];
    const { command, args } = curlInvocation(forwardArgs);
    execFile(command, args,
      { maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
        // Per-request files are dead the moment curl returns, either way.
        try { rmSync(bodyFile, { force: true }); } catch {}
        try { rmSync(cfgFile, { force: true }); } catch {}
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
    /** Absolute path of this relay's private temp directory (test visibility). */
    dir,
    calls,
    close: () => new Promise((r) => server.close(() => { rmSync(dir, { recursive: true, force: true }); r(); })),
    closeSync: () => {
      try { server.close(); } catch {}
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    },
  };
}
