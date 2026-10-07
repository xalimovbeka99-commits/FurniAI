// Screenshots of every FIXTURE demo state (contract rev 2), desktop 1440x900 and mobile 390x844
// (replica-build viewports). Fails on any page error, console error, 5xx or non-local request.
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
  ["05-polling", "polling"], ["06-failed-provider-codes", "failed"], ["07-submission-unknown", "submission_unknown"],
  ["08-signed-out-401", "signed_out"], ["09-forbidden-403", "forbidden"], ["10-network", "network"], ["11-server-5xx", "server_5xx"],
  ["12-rate-limited-429", "rate_limited"], ["13-provider-refused-402", "provider_refused"], ["14-not-configured-503", "not_configured"],
  ["15-malformed", "malformed"], ["16-asset-not-ready-409", "asset_not_ready"], ["17-asset-unavailable-410", "asset_unavailable"],
  ["18-asset-rate-limited-429", "asset_rate_limited"], ["19-integrity-409", "integrity"], ["20-open-3d-view", "open"],
  ["21-download", "download"], ["22-long-content", "long"],
];
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };

async function settle(page, state) {
  if (state === "loading") return page.waitForSelector('[data-panel="loading"]');
  await page.waitForFunction(() => window.__gallery && window.__gallery.getState().list !== "loading");
  if (state.startsWith("asset_")) await page.waitForSelector("[data-asset-error]", { timeout: 8000 });
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
      await page.goto(`${base}?state=${state}`);
      await settle(page, state);
      if (dl) {
        const d = await dl;
        const file = join(tmpdir(), `fcg-dl-${vpName}.glb`);
        await d.saveAs(file);
        if (sha(readFileSync(file)) !== sha(readFileSync(GLB))) errors.push(`${tag}: downloaded bytes differ from the SYNTHETIC GLB`);
        else notes.push(`${tag}: download ${d.suggestedFilename()} = SYNTHETIC GLB (sha256 ${sha(readFileSync(GLB)).slice(0, 12)}…)`);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 0) errors.push(`${tag}: horizontal overflow ${overflow}px`);
      await page.screenshot({ path: join(out, vpName, `${name}.png`), fullPage: true });
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
