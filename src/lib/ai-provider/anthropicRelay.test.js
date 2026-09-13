/**
 * Relay concurrency.
 *
 * The relay wrote each request's body and curl config to FIXED filenames in a
 * shared temp directory. Two concurrent requests raced: the second overwrote
 * the first between `writeFileSync` and `execFile`, so a request could be sent
 * to the API carrying a different request's payload. Nothing in the response
 * would look wrong — you would simply get an answer to someone else's question.
 *
 * This test drives concurrent requests through the real relay with `curl`
 * replaced by a stub that echoes back the body it was handed, and asserts each
 * response matches its own request.
 *
 * Harness notes (Windows + Unix):
 * - The stub is a Node script selected via ANTHROPIC_RELAY_CURL_STUB. On
 *   Windows, `execFile("curl")` ignores a PATH-shadowing curl.cmd and always
 *   launches System32\curl.exe, so PATH stubbing alone cannot open the race
 *   window this test exists to catch.
 * - Cleanup asserts only against THIS relay's `dir` — scanning every
 *   fa-relay-* under tmpdir() is a test-isolation trap (stale body.json /
 *   curl.cfg from older fixed-name runs).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { startAnthropicRelay } from "../../../scripts/anthropic-relay.mjs";

let stubDir;
let originalStubEnv;

beforeAll(() => {
  stubDir = mkdtempSync(path.join(tmpdir(), "fa-curlstub-"));
  const stubJs = path.join(stubDir, "curl-stub.js");
  writeFileSync(
    stubJs,
    [
      "const fs = require('fs');",
      "let bodyPath = '';",
      "const argv = process.argv.slice(2);",
      "for (let i = 0; i < argv.length; i++) {",
      "  if (argv[i] === '--data-binary' && argv[i + 1]) {",
      "    bodyPath = String(argv[i + 1]).replace(/^@/, '');",
      "    i++;",
      "  }",
      "}",
      "const start = Date.now();",
      "while (Date.now() - start < 50) { /* busy-wait ~50ms like the sh sleep */ }",
      "if (!bodyPath) { process.stderr.write('curl-stub: missing --data-binary'); process.exit(1); }",
      "process.stdout.write(fs.readFileSync(bodyPath));",
      "process.stdout.write('\\n200');",
      "",
    ].join("\n"),
    { mode: 0o755 }
  );
  chmodSync(stubJs, 0o755);
  originalStubEnv = process.env.ANTHROPIC_RELAY_CURL_STUB;
  process.env.ANTHROPIC_RELAY_CURL_STUB = stubJs;
});

afterAll(() => {
  if (originalStubEnv === undefined) delete process.env.ANTHROPIC_RELAY_CURL_STUB;
  else process.env.ANTHROPIC_RELAY_CURL_STUB = originalStubEnv;
  rmSync(stubDir, { recursive: true, force: true });
});

async function post(baseUrl, payload) {
  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-test-marker": payload.marker },
    body: JSON.stringify(payload),
  });
  return res.json();
}

describe("anthropic relay", () => {
  it("does not let concurrent requests overwrite each other's temporary files", async () => {
    const relay = await startAnthropicRelay();
    try {
      const payloads = Array.from({ length: 12 }, (_, i) => ({
        marker: `req-${i}`,
        nonce: `${i}`.repeat(8),
      }));

      const responses = await Promise.all(payloads.map((p) => post(relay.baseUrl, p)));

      // Each response must echo its OWN request. Under the old fixed-filename
      // scheme this fails: responses duplicate whichever body landed last.
      responses.forEach((body, i) => {
        expect(body.marker, `response ${i} carried the wrong request body`).toBe(payloads[i].marker);
        expect(body.nonce).toBe(payloads[i].nonce);
      });

      // And every marker appears exactly once — no request answered twice.
      const markers = responses.map((r) => r.marker).sort();
      expect(new Set(markers).size).toBe(payloads.length);
    } finally {
      await relay.close();
    }
  }, 30000);

  it("removes each request's temporary files once curl returns", async () => {
    const relay = await startAnthropicRelay();
    try {
      await Promise.all(
        Array.from({ length: 5 }, (_, i) => post(relay.baseUrl, { marker: `cleanup-${i}`, nonce: "x" }))
      );
      // Scope to THIS relay's directory only. Scanning every fa-relay-* under
      // tmpdir() is a test-isolation trap: stale dirs from older fixed-name
      // runs (body.json / curl.cfg) falsely fail a correct implementation.
      const leftovers = readdirSync(relay.dir);
      expect(leftovers).toEqual([]);
    } finally {
      await relay.close();
    }
  }, 30000);
});
