// Screenshots of every SYNTHETIC/MOCKED demo state (contract rev 2), desktop 1440x900 and mobile
// 390x844 (replica-build viewports). Evidence label SYNTHETIC/MOCKED is in every file name and in
// the demo banner at the top of every image. Not LIVE, not a Scenario demo.
// Fails on any page error, console error, 5xx, non-local request, horizontal overflow or browser storage use.
//   node docs/m3/projects/demo/capture.mjs            -> writes to a temp folder
//   node docs/m3/projects/demo/capture.mjs --update   -> writes docs/m3/projects/artifacts/rev2/{desktop,mobile}/
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startServer } from "./serve.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const out = process.argv.includes("--update") ? resolve(here, "../artifacts/rev2") : join(tmpdir(), "concept-gallery-shots-rev2");
const GLB = resolve(here, "../../../../tests/projects/fixtures/rev2/SYNTHETIC-box-not-scenario-generated.glb");
const sha = (b) => createHash("sha256").update(b).digest("hex");

export const STATES = [
  ["01-loading", "loading"], ["02-empty", "empty"], ["03-list-rev2-fixture", "list"], ["04-billing-outcomes", "billing"],
  ["05-polling", "polling"], ["06-polling-paused-429", "poll_paused"], ["07-failed-provider-codes", "failed"],
  ["08-submission-unknown", "submission_unknown"], ["09-signed-out-401", "signed_out"], ["10-forbidden-403-page-wide", "forbidden"],
  ["11-network-error", "network"], ["12-server-5xx", "server_5xx"], ["13-rate-limited-429", "rate_limited"],
  ["14-provider-refused-402", "provider_refused"], ["15-provider-unavailable-502", "provider_unavailable"],
  ["16-not-configured-503", "not_configured"], ["17-generation-unavailable-budget", "unavailable"], ["18-malformed", "malformed"],
  ["19-asset-not-ready-409", "asset_not_ready"], ["20-asset-unavailable-410", "asset_unavailable"],
  ["21-asset-rate-limited-429-try-again", "asset_rate_limited"], ["22-asset-provider-unavailable-502", "asset_provider_unavailable"],
  ["23-integrity-409", "integrity"], ["24-open-3d-view", "open"], ["25-download", "download"],
  ["26-reference-thumbnails", "thumbnails"], ["27-long-content", "long"], ["28-after-reload-restored", "reload"],
];
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };

async function settle(page, state) {
  if (state === "loading") return page.waitForSelector('[data-panel="loading"]');
  await page.waitForFunction(() => window.__gallery && window.__gallery.getState().list !== "loading");
  if (state.startsWith("asset_")) await page.waitForSelector("[data-asset-error]", { timeout: 8000 });
  if (state === "poll_paused") await page.waitForSelector("[data-poll-paused]", { timeout: 8000 });
  if (state === "thumbnails") await page.waitForFunction(() => [...document.images].length > 0 && [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  if (state === "unavailable" || state === "list") await page.waitForSelector("[data-availability]");
  if (state === "integrity") await page.waitForFunction(() => document.querySelectorAll("[data-job-error]").length === 2, null, { timeout: 8000 });
  if (state === "polling") await page.waitForFunction(() => document.querySelector(".fcg-live").textContent.length > 0);
  if (state === "open") {
    await page.waitForSelector("[data-viewer-panel] canvas", { timeout: 15000 });
    await page.waitForFunction(() => !document.querySelector("[data-viewer-panel] [aria-busy='true']") && !document.querySelector("[data-viewer-status][data-code]"), null, { timeout: 15000 });
    await page.waitForTimeout(1500); // let the fit + first frames render
  }
  if (state === "download") await page.waitForFunction(() => document.getElementById("log").textContent.includes("downloaded"), null, { timeout: 8000 });
}

const server = await startServer(0);
const origin = `http://127.0.0.1:${server.address().port}`;
const base = `${origin}/docs/m3/projects/demo/`;
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const errors = [];
const notes = [];
let count = 0;
try {
  for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
    mkdirSync(join(out, vpName), { recursive: true });
    for (const [name, state] of STATES) {
      const ctx = await browser.newContext({ viewport, locale: "en-GB", timezoneId: "Asia/Dubai", reducedMotion: "reduce", acceptDownloads: true });
      const page = await ctx.newPage();
      const tag = `${vpName}/${name}`;
      page.on("pageerror", (e) => errors.push(`${tag}: pageerror ${e.message}`));
      page.on("console", (m) => m.type() === "error" && errors.push(`${tag}: console ${m.text()}`));
      page.on("request", (r) => !r.url().startsWith(origin) && errors.push(`${tag}: unexpected request ${r.url()}`));
      page.on("response", (r) => r.status() >= 500 && errors.push(`${tag}: ${r.status()} ${r.url()}`));
      const dl = state === "download" ? page.waitForEvent("download", { timeout: 10000 }) : null;
      if (state === "reload") {
        // MOCKED server-side job: load, let one status check run, then a REAL reload restores it.
        const sid = `capture-${vpName}`;
        await fetch(`${origin}/__mock-api/${sid}/reset?after=99`, { method: "POST" });
        await page.goto(`${base}?state=reload&sid=${sid}`);
        await page.waitForFunction(() => window.__gallery && window.__gallery.getState().list === "ready");
        await page.reload();
        await page.waitForFunction(() => window.__gallery && window.__gallery.getState().list === "ready" && window.__gallery.getState().polling);
        await page.waitForFunction(() => document.querySelector(".fcg-live").textContent.length > 0);
      } else {
        await page.goto(`${base}?state=${state}`);
        await settle(page, state);
      }
      if (dl) {
        const d = await dl;
        const file = join(tmpdir(), `fcg-dl-${vpName}.glb`);
        await d.saveAs(file);
        if (sha(readFileSync(file)) !== sha(readFileSync(GLB))) errors.push(`${tag}: downloaded bytes differ from the SYNTHETIC GLB`);
        else notes.push(`${tag}: download ${d.suggestedFilename()} = SYNTHETIC GLB (sha256 ${sha(readFileSync(GLB)).slice(0, 12)}…)`);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 0) errors.push(`${tag}: horizontal overflow ${overflow}px`);
      const stored = await page.evaluate(() => localStorage.length + sessionStorage.length);
      if (stored) errors.push(`${tag}: browser storage used (${stored} keys)`);
      await page.screenshot({ path: join(out, vpName, `${name}.SYNTHETIC.png`), fullPage: true });
      count++;
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
for (const n of notes) console.log(n);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`wrote ${count} screenshots to ${out}`);
