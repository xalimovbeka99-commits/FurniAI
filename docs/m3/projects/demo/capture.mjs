// Screenshots of every FIXTURE demo state plus one at mobile width.
//   node docs/m3/projects/demo/capture.mjs            -> writes to a temp folder
//   node docs/m3/projects/demo/capture.mjs --update   -> writes docs/m3/projects/artifacts/
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startServer } from "./serve.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const out = process.argv.includes("--update") ? resolve(here, "../artifacts") : join(tmpdir(), "concept-gallery-shots");
mkdirSync(out, { recursive: true });

const STATES = [
  ["01-loading", "loading"], ["02-empty", "empty"], ["03-list", "list"], ["04-polling", "polling"], ["05-failed", "failed"],
  ["06-submission-unknown", "submission_unknown"], ["07-signed-out-401", "signed_out"], ["08-network", "network"],
  ["09-server-5xx", "server_5xx"], ["10-not-configured-503", "not_configured"], ["11-asset-not-ready-409", "asset_not_ready"],
  ["12-asset-unavailable-410", "asset_unavailable"], ["13-integrity-409", "integrity"],
];

const server = await startServer(0);
const base = `http://127.0.0.1:${server.address().port}/docs/m3/projects/demo/`;
const browser = await chromium.launch();
const errors = [];
try {
  const shoot = async (name, state, viewport, settle) => {
    const ctx = await browser.newContext({ viewport, locale: "en-GB", timezoneId: "Asia/Dubai", reducedMotion: "reduce" });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
    page.on("request", (r) => {
      if (!r.url().startsWith(base.slice(0, base.indexOf("/docs")))) errors.push(`${name}: unexpected request ${r.url()}`);
    });
    await page.goto(`${base}?state=${state}`);
    await settle(page);
    await page.screenshot({ path: join(out, `${name}.png`), fullPage: true });
    await ctx.close();
  };
  const desktop = { width: 1200, height: 800 };
  for (const [name, state] of STATES) {
    await shoot(name, state, desktop, async (page) => {
      if (state === "loading") return page.waitForSelector('[data-panel="loading"]');
      await page.waitForFunction(() => window.__gallery && window.__gallery.getState().list !== "loading");
      if (state.startsWith("asset_")) await page.waitForSelector("[data-asset-error]");
      // Download on the Ready card and the poll on the processing card both end job-errored (QE G1).
      if (state === "integrity") await page.waitForFunction(() => document.querySelectorAll("[data-job-error]").length === 2, null, { timeout: 8000 });
      if (state === "polling") await page.waitForFunction(() => document.querySelector(".fcg-live").textContent.length > 0);
    });
  }
  await shoot("14-mobile-list-390", "list", { width: 390, height: 844 }, (page) => page.waitForFunction(() => window.__gallery.getState().list === "ready"));
} finally {
  await browser.close();
  server.close();
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`wrote ${STATES.length + 1} screenshots to ${out}`);
