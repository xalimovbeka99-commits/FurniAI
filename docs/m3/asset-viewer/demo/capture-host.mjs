#!/usr/bin/env node
/**
 * DEMO-ONLY evidence capture for the v3 HOST page (host.html). Writes
 * docs/m3/asset-viewer/evidence/v3/<NN>-<state>-<CLASS>-<desktop|mobile>.png
 * at 1440x900 and 390x844, plus capture-results.json. CLASS is the evidence
 * taxonomy label (SYNTHETIC-MOCKED | SIMULATED); nothing is LIVE.
 *
 *   node docs/m3/asset-viewer/demo/capture-host.mjs   (starts serve.mjs on 4328)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startDemoServer } from "./serve.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../evidence/v3");
const PORT = Number(process.env.CAPTURE_PORT || 4328);
export const SHOTS = [
  ["01", "loaded", "loaded", "SYNTHETIC-MOCKED", "ready"],
  ["02", "textured", "textured", "SYNTHETIC-MOCKED", "ready"],
  ["03", "texture-missing", "texture-missing", "SYNTHETIC-MOCKED", "ready"],
  ["04", "loading", "loading", "SIMULATED", "loading"],
  ["05", "invalid&file=bad-magic", "invalid-bad-magic", "SYNTHETIC-MOCKED", "error"],
  ["06", "invalid&file=html-as", "invalid-html-as-glb", "SYNTHETIC-MOCKED", "error"],
  ["07", "invalid&file=truncated", "invalid-truncated", "SYNTHETIC-MOCKED", "error"],
  ["08", "invalid&file=no-mesh", "invalid-no-mesh", "SYNTHETIC-MOCKED", "error"],
  ["09", "unavailable&http=404", "unavailable-404", "SIMULATED", "error"],
  ["10", "unavailable&http=410", "unavailable-410", "SIMULATED", "error"],
  ["11", "unavailable&http=403", "unavailable-403-expired", "SIMULATED", "error"],
  ["11b", "unavailable&http=cors", "unavailable-cors-blocked", "SIMULATED", "error"],
  ["12", "webgl&webgl=none", "webgl-no-context", "SIMULATED", "error"],
  ["13", "webgl&webgl=throw", "webgl-throws", "SIMULATED", "error"],
  ["14", "webgl&webgl=lost", "webgl-context-lost", "SIMULATED", "error"],
  ["15", "replace", "after-replace", "SYNTHETIC-MOCKED", "ready"],
  ["16", "job&job=succeeded", "job-succeeded", "SIMULATED", "ready"],
  ["17", "job&job=submission-unknown", "job-submission-unknown", "SIMULATED", "error"],
  ["18", "forbidden", "forbidden", "SIMULATED", "error"],
  ["19", "idle", "idle", "SIMULATED", "idle"],
];
const VIEWPORTS = [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const server = await startDemoServer(PORT);
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const results = [];
  try {
    for (const [nn, q, name, cls, expect] of SHOTS) {
      for (const [vp, size] of VIEWPORTS) {
        const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1, hasTouch: vp === "mobile", isMobile: vp === "mobile" });
        const page = await ctx.newPage();
        await page.goto(`http://127.0.0.1:${PORT}/docs/m3/asset-viewer/demo/host.html?state=${q}`);
        await page.waitForFunction(
          ([want, isReplace, isLost]) => {
            const h = window.__host;
            if (!h || !h.handle) return false;
            const s = h.handle.getState().status;
            if (isReplace) return h.events.filter((e) => e === "ready").length >= 2;
            if (isLost) return h.events.some((e) => e === "error:WEBGL_CONTEXT_LOST");
            return s === want;
          },
          [expect, q === "replace", q === "webgl&webgl=lost"],
          { timeout: 20000 },
        );
        await page.waitForTimeout(400); // let the frame settle
        const info = await page.evaluate(() => {
          const s = window.__host.handle.getState();
          return {
            status: s.status,
            error: s.error && { code: s.error.code, reason: s.error.reason || null, message: s.error.message },
            banner: document.getElementById("sim-banner").innerText,
            overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            download: (() => {
              const b = document.querySelector("[data-av-download]");
              return Boolean(b && b.offsetParent);
            })(),
          };
        });
        const file = `${nn}-${name}-${cls}-${vp}.png`;
        await page.screenshot({ path: join(OUT, file), fullPage: false });
        results.push({ file, state: q, class: cls, viewport: size, ...info });
        console.log(file, info.status, info.error ? info.error.code : "", "overflowX", info.overflowX, "download", info.download);
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
    if (server.closeAllConnections) server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
  writeFileSync(join(OUT, "capture-results.json"), `${JSON.stringify(results, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
  process.exit(0); // the second (no-CORS) origin may still hold keep-alive sockets
}
