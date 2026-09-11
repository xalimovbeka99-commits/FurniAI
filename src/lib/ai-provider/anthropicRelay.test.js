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
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { startAnthropicRelay } from "../../../scripts/anthropic-relay.mjs";

let stubDir;
let originalPath;

beforeAll(() => {
  // A stub `curl` that understands the two flags the relay uses and replies
  // with the body file's contents plus the trailing status code the relay
  // parses. A small sleep widens the window the real bug lived in.
  stubDir = mkdtempSync(path.join(tmpdir(), "fa-curlstub-"));
  const stub = path.join(stubDir, "curl");
  writeFileSync(
    stub,
    [
      "#!/bin/sh",
      "body=''",
      "while [ $# -gt 0 ]; do",
      "  case \"$1\" in",
      "    --data-binary) body=$(printf '%s' \"$2\" | sed 's/^@//'); shift 2 ;;",
      "    *) shift ;;",
      "  esac",
      "done",
      "sleep 0.05",
      "cat \"$body\"",
      "printf '\\n200'",
      "",
    ].join("\n"),
    { mode: 0o755 }
  );
  chmodSync(stub, 0o755);
  originalPath = process.env.PATH;
  process.env.PATH = `${stubDir}:${originalPath}`;
});

afterAll(() => {
  process.env.PATH = originalPath;
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
      // The relay's directory is internal; reach it via the same tmp prefix.
      const relayDirs = readdirSync(tmpdir()).filter((d) => d.startsWith("fa-relay-"));
      const leftovers = relayDirs.flatMap((d) => {
        try {
          return readdirSync(path.join(tmpdir(), d));
        } catch {
          return [];
        }
      });
      expect(leftovers).toEqual([]);
    } finally {
      await relay.close();
    }
  }, 30000);
});
