#!/usr/bin/env node
/**
 * Independent browser / parser acceptance checklist driver for integ/part-graph-compiler.
 * Docs-only companion: does not refresh fingerprint pins or unlock CNC.
 *
 * Usage: node scripts/integ/browser-acceptance-checklist.mjs [--run-vitest] [--run-f1] [--run-r3f]
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const TIP_EXPECT = "c48e108ab779a5b4fe36c8600f1dac38376d74c0";
const args = new Set(process.argv.slice(2));

function sh(cmd, inherit = true) {
  const r = spawnSync(cmd, { shell: true, cwd: ROOT, encoding: "utf8", stdio: inherit ? "inherit" : "pipe" });
  return r.status ?? 1;
}

function headSha() {
  const r = spawnSync("git rev-parse HEAD", { shell: true, cwd: ROOT, encoding: "utf8" });
  return (r.stdout || "").trim();
}

function normalizedSha256(content) {
  return createHash("sha256").update(content.replace(/\r\n/g, "\n")).digest("hex");
}

console.log("=== FurniAI browser acceptance checklist ===");
console.log("cwd:", ROOT);
const sha = headSha();
console.log("HEAD:", sha);
if (sha !== TIP_EXPECT) {
  console.warn(`WARN: expected tip ${TIP_EXPECT}; continuing on current HEAD.`);
}

const pinPath = resolve(ROOT, "tests/wardrobe-production/fixtures/phase1-protected-surfaces.json");
if (existsSync(pinPath)) {
  const pins = JSON.parse(readFileSync(pinPath, "utf8"));
  console.log("\n--- Phase 1 protected hashes (document only; no refresh) ---");
  for (const [rel, expected] of Object.entries(pins.files)) {
    const got = normalizedSha256(readFileSync(resolve(ROOT, rel), "utf8"));
    console.log(got === expected ? "MATCH " : "MISMATCH", rel);
    if (got !== expected) {
      console.log("  expected", expected);
      console.log("  received", got);
    }
  }
}

console.log("\n--- Surface map ---");
console.log("PARSER-ONLY: wardrobe-ai Vitest, production DXF/nesting Vitest, golden demos");
console.log("BROWSER:     test:browser:f1 (static legacy), test:browser:r3f (Next build)");
console.log("KNOWN FAIL:  static Add drawers F1 journey (hardware refusal) while parser DRAWER_BANK PASS");
console.log("REMOTE:      Vercel preview for tip requires SSO — do not claim green without login");

let failed = 0;
if (args.has("--run-vitest")) {
  console.log("\n--- Running parser suites ---");
  failed |= sh("npx vitest run tests/wardrobe-ai/ tests/production/");
}
if (args.has("--run-f1")) {
  console.log("\n--- Building legacy + F1 Playwright ---");
  failed |= sh("npm run build:legacy");
  failed |= sh("npx playwright install chromium");
  failed |= sh("npm run test:browser:f1");
}
if (args.has("--run-r3f")) {
  console.log("\n--- Building Next + R3F Playwright ---");
  failed |= sh("npm run build");
  failed |= sh("npx playwright install chromium");
  failed |= sh("npm run test:browser:r3f");
}

if (![...args].some((a) => a.startsWith("--run"))) {
  console.log("\nDry run only. Pass --run-vitest / --run-f1 / --run-r3f to execute.");
}

process.exit(failed ? 1 : 0);
