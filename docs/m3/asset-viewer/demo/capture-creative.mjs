#!/usr/bin/env node
/**
 * DEMO-ONLY evidence capture for the /api/creative contract, against the
 * SIMULATED stand-in in serve.mjs (fixtures only; NOT a Scenario
 * demonstration). Headless Chromium (Playwright, SwiftShader WebGL), three
 * 0.166. Writes ../evidence/creative/*.png, a webm and creative-results.json.
 *
 *   node docs/m3/asset-viewer/demo/capture-creative.mjs
 */
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { startDemoServer } from "./serve.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../evidence/creative");
const PORT = 4321;
const PAGE = `http://127.0.0.1:${PORT}/docs/m3/asset-viewer/demo/creative.html?three=r166`;
const ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
const VIEWPORT = { width: 1180, height: 760 };
const VIDEO_TMP = join(OUT, ".video-tmp");

rmSync(OUT, { recursive: true, force: true });
mkdirSync(VIDEO_TMP, { recursive: true });
const server = await startDemoServer(PORT);
const browser = await chromium.launch({ args: ARGS });
const context = await browser.newContext({ viewport: VIEWPORT, acceptDownloads: true, recordVideo: { dir: VIDEO_TMP, size: VIEWPORT } });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

const results = {
  simulated: true,
  label: "SIMULATED /api/creative stand-in · fixtures only · not a Scenario result",
  capturedAt: new Date().toISOString(),
  chromium: browser.version(),
  launchArgs: ARGS,
  page: PAGE,
  steps: {},
};

await page.goto(PAGE);
await page.waitForFunction(() => window.__demo && window.__demo.ready, null, { timeout: 20000 });
results.webgl = await page.evaluate(() => {
  const c = document.createElement("canvas");
  const g = c.getContext("webgl2") || c.getContext("webgl");
  const ext = g && g.getExtension("WEBGL_debug_renderer_info");
  return g ? { version: g.getParameter(g.VERSION), renderer: ext ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER) } : null;
});

const settle = (ms = 700) => page.waitForTimeout(ms);
const simLog = () => page.evaluate(() => fetch("/__sim/log").then((r) => r.json()));
const overlay = () =>
  page.evaluate(() => {
    const q = (a) => document.querySelector(`#viewer [${a}]`);
    const vis = (n) => Boolean(n && n.style.display !== "none" && n.textContent);
    return {
      concept: vis(q("data-av-concept")) ? q("data-av-concept").textContent : null,
      status: vis(q("data-av-status")) ? q("data-av-status").textContent : null,
      scale: vis(q("data-av-scale")) ? q("data-av-scale").textContent : null,
      downloadButton: q("data-av-download") ? q("data-av-download").style.display !== "none" : false,
      simulatedBanner: document.querySelector(".sim").textContent,
      watermark: document.querySelector(".watermark").textContent,
    };
  });
const brief = (s) => ({ status: s.status, phase: s.phase, source: s.source, job: s.job, asset: s.asset, concept: s.concept, actions: s.actions, attempts: s.attempts, error: s.error, model: s.model && { meshCount: s.model.meshCount, proportions: s.model.proportions, scale: s.model.scale } });
const cam = () =>
  page.evaluate(() => {
    const d = __demo.viewer._debug();
    return { distance: +d.camera.position.distanceTo(d.controls.target).toFixed(4), position: d.camera.position.toArray().map((v) => +v.toFixed(3)) };
  });
const pixels = () =>
  page.evaluate(() => {
    const d = __demo.viewer._debug();
    d.renderer.render(d.scene, d.camera);
    const gl = d.renderer.getContext();
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let n = 0;
    for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i] - px[0]) + Math.abs(px[i + 1] - px[1]) + Math.abs(px[i + 2] - px[2]) > 30) n++;
    return { width: w, height: h, modelPixelRatio: +(n / (w * h)).toFixed(4) };
  });
const assetResolves = async () => (await simLog()).log.filter((e) => e.kind === "api" && e.resource === "asset").length;
const cdnLog = async () => (await simLog()).log.filter((e) => e.kind === "cdn");

async function step(name, fn) {
  const before = (await simLog()).log.length;
  const extra = (await fn()) || {};
  await settle();
  const file = `${name}.png`;
  await page.screenshot({ path: join(OUT, file) });
  const after = (await simLog()).log;
  results.steps[name] = { screenshot: file, state: brief(await page.evaluate(() => __demo.getState())), overlay: await overlay(), serverCalls: after.slice(before), ...extra };
  console.log(`${name}: ${results.steps[name].state.status}${results.steps[name].state.error ? ` ${results.steps[name].state.error.code}` : ""}`);
}
const act = (name) => page.evaluate((n) => __demo.act(n), name);
const startAct = (name) => page.evaluate((n) => { window.__p = __demo.act(n); }, name);

await act("reset");

// 1. processing (watchJob, 3 s cadence) -> captured while processing, then succeeded
await step("01-processing", async () => {
  await startAct("processing");
  await page.waitForFunction(() => __demo.getState().phase === "job-processing", null, { timeout: 10000 });
  const s = await page.evaluate(() => __demo.getState());
  return { noPercentage: !/%/.test((await overlay()).status || ""), statePhase: s.phase, progress: s.progress };
});
await step("02-processing-then-succeeded", async () => {
  await page.waitForFunction(() => __demo.getState().status === "ready", null, { timeout: 20000 });
  const jobs = (await simLog()).log.filter((e) => e.kind === "api" && e.resource === "jobs").length;
  return { jobPolls: jobs, pixels: await pixels() };
});

// 2. succeeded GLB with concept notice
await step("03-succeeded-glb-concept-notice", async () => {
  await act("glb");
  return { pixels: await pixels(), camera: await cam() };
});

// 3. orbit / zoom / fit
const box = await page.locator("#viewer canvas").boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;
await step("04a-orbit", async () => {
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 220, cy - 60, { steps: 20 });
  await page.mouse.up();
  return { camera: await cam() };
});
await step("04b-zoom", async () => {
  await page.mouse.move(cx, cy);
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(60);
  }
  return { camera: await cam() };
});
await step("04c-fit", async () => {
  await act("fit");
  return { camera: await cam() };
});

// 4. download always re-resolves a fresh address
await step("05-download-fresh-url", async () => {
  const resolvesBefore = await assetResolves();
  const cdnBefore = await cdnLog();
  const [dl, res] = await Promise.all([page.waitForEvent("download", { timeout: 10000 }), act("download")]);
  const resolvesAfter = await assetResolves();
  const cdnAfter = await cdnLog();
  return {
    download: res,
    suggestedFilename: dl.suggestedFilename(),
    assetResolvesBefore: resolvesBefore,
    assetResolvesAfter: resolvesAfter,
    displayToken: cdnBefore.filter((e) => e.status === 200).at(-1)?.token,
    downloadToken: cdnAfter.at(-1)?.token,
  };
});

// 5. expired url -> one fresh resolve -> success
await step("06-expired-url-reresolve", async () => {
  const before = await assetResolves();
  await act("expired");
  return { assetResolves: (await assetResolves()) - before, cdn: (await cdnLog()).slice(-2), pixels: await pixels() };
});

// 6. 410 ASSET_UNAVAILABLE
await step("07-asset-unavailable-410", async () => {
  await act("gone");
});

// 7. download-only (fbx), built-in Download button
await step("08-download-only-fbx", async () => {
  const before = (await cdnLog()).length;
  await act("fbx");
  const meshFetches = (await cdnLog()).length - before;
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 10000 }), page.click("#viewer [data-av-download]")]);
  return { meshFetchesBeforeDownload: meshFetches, builtInButtonDownload: dl.suggestedFilename() };
});

// 8. submission_unknown
await step("09-submission-unknown", async () => {
  await act("unknown");
});

// extras
await step("10-no-cors-address-display-failed", async () => {
  const before = await assetResolves();
  await act("cors");
  return { assetResolves: (await assetResolves()) - before, note: "second origin without Access-Control-Allow-Origin; the browser refuses the fetch (U7 simulation)" };
});
await step("11-unrecognised-format-download-only", async () => {
  await act("nullfmt");
});
await step("12-job-failed", async () => {
  await act("failed");
});
await step("13-record-integrity-failed", async () => {
  await act("integrity");
});
await step("14-submitting", async () => {
  await startAct("submitting");
  await page.waitForFunction(() => __demo.getState().phase === "job-submitting", null, { timeout: 10000 });
});
await act("clear");

// Every API call carried the Bearer token; no url ever in state.
const all = (await simLog()).log;
results.summary = {
  apiCalls: all.filter((e) => e.kind === "api").length,
  apiCallsWithoutAuth: all.filter((e) => e.kind === "api" && !e.auth).length,
  assetResolves: all.filter((e) => e.kind === "api" && e.resource === "asset").length,
  signedAddressRequests: all.filter((e) => e.kind === "cdn").length,
  signedAddress403: all.filter((e) => e.kind === "cdn" && e.status === 403).length,
  urlInAnyCapturedState: Object.values(results.steps).some((s) => /__simcdn|X-Sim-Signature/.test(JSON.stringify(s.state))),
  conceptNoticeInEveryConceptStep: Object.values(results.steps).every((s) => s.overlay.concept && s.overlay.concept.startsWith("AI-generated visual concept.")),
};
results.consoleErrors = consoleErrors;

const video = page.video();
await context.close();
const vfile = "creative-simulated-r166.webm";
renameSync(await video.path(), join(OUT, vfile));
rmSync(VIDEO_TMP, { recursive: true, force: true });
results.video = vfile;
writeFileSync(join(OUT, "creative-results.json"), JSON.stringify(results, null, 2) + "\n");
await browser.close();
server.close();
console.log(readdirSync(OUT).join("\n"));
console.log(JSON.stringify(results.summary));
