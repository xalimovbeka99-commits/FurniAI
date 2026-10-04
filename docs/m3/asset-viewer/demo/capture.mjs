#!/usr/bin/env node
/**
 * DEMO-ONLY evidence capture: starts serve.mjs, drives the demo in headless
 * Chromium (Playwright, SwiftShader WebGL) for BOTH three modes, and writes
 * screenshots, a webm, and capture-results.json to ../evidence/.
 *
 *   node docs/m3/asset-viewer/demo/capture.mjs [--no-video]
 */
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { startDemoServer } from "./serve.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../evidence");
const PORT = 4319;
const BASE = `http://127.0.0.1:${PORT}/docs/m3/asset-viewer/demo/`;
const ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
const VIEWPORT = { width: 1100, height: 640 };
const withVideo = !process.argv.includes("--no-video");

mkdirSync(OUT, { recursive: true });
const server = await startDemoServer(PORT);
const browser = await chromium.launch({ args: ARGS });
const results = { capturedAt: new Date().toISOString(), chromium: browser.version(), launchArgs: ARGS, modes: {} };

const settle = (page, ms = 700) => page.waitForTimeout(ms);
const cam = (page) =>
  page.evaluate(() => {
    const d = __demo.viewer._debug();
    return { position: d.camera.position.toArray().map((v) => +v.toFixed(4)), target: d.controls.target.toArray().map((v) => +v.toFixed(4)), distance: +d.camera.position.distanceTo(d.controls.target).toFixed(4), near: +d.camera.near.toFixed(5), far: +d.camera.far.toFixed(3) };
  });
const brief = (s) => ({ status: s.status, phase: s.phase, progress: s.progress, error: s.error, asset: s.asset, model: s.model });

async function open(context, mode) {
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  await page.goto(`${BASE}?three=${mode}`);
  await page.waitForFunction(() => window.__demo && window.__demo.ready, null, { timeout: 20000 });
  return { page, consoleErrors };
}

async function orbit(page, dx, dy) {
  const box = await page.locator("#viewer canvas").boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy + dy, { steps: 20 });
  await page.mouse.up();
}

async function zoom(page, deltaY, times) {
  const box = await page.locator("#viewer canvas").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < times; i++) {
    await page.mouse.wheel(0, deltaY);
    await page.waitForTimeout(60);
  }
}

async function runMode(mode) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const { page, consoleErrors } = await open(context, mode);
  const r = { steps: {}, consoleErrors };
  const shot = async (name) => {
    const file = `${mode}-${name}.png`;
    await page.screenshot({ path: join(OUT, file) });
    return file;
  };
  r.webgl = await page.evaluate(() => {
    const c = document.createElement("canvas");
    const g = c.getContext("webgl2") || c.getContext("webgl");
    if (!g) return null;
    const ext = g.getExtension("WEBGL_debug_renderer_info");
    return { version: g.getParameter(g.VERSION), renderer: ext ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER) };
  });
  r.capabilities = await page.evaluate(() => __demo.getState().capabilities);

  // 1. loading (slow stream so the progress state is visible)
  await page.evaluate(() => {
    window.__p = __demo.act("chair-slow");
  });
  await page.waitForFunction(() => {
    const s = __demo.getState();
    return s.status === "loading" && s.progress && s.progress.ratio > 0.3 && s.progress.ratio < 0.9;
  });
  r.steps.loading = { screenshot: await shot("01-loading"), state: brief(await page.evaluate(() => __demo.getState())) };
  await page.evaluate(() => window.__p);
  await settle(page);

  // 2. textured model ready
  r.steps.texturedReady = {
    screenshot: await shot("02-textured-ready"),
    state: brief(await page.evaluate(() => __demo.getState())),
    memory: await page.evaluate(() => __demo.memory()),
    pixels: await page.evaluate(() => __demo.samplePixels()),
    color: await page.evaluate(() => __demo.textureColorInfo()),
    camera: await cam(page),
  };

  // 3. orbit (real pointer drag through OrbitControls, damping)
  await orbit(page, 260, 40);
  await settle(page, 900);
  r.steps.orbited = { screenshot: await shot("03-orbited"), camera: await cam(page) };

  // 4. zoom (wheel) — clamped by minDistance
  await zoom(page, -120, 5);
  await settle(page, 900);
  r.steps.zoomed = { screenshot: await shot("04-zoomed"), camera: await cam(page) };

  // 5. fit to view
  await page.evaluate(() => __demo.act("fit"));
  await settle(page, 900);
  r.steps.fit = { screenshot: await shot("05-fit"), camera: await cam(page) };

  // 6. replace with the untextured table
  await page.evaluate(() => __demo.act("replace"));
  await settle(page);
  r.steps.replaced = {
    screenshot: await shot("06-replaced-untextured"),
    state: brief(await page.evaluate(() => __demo.getState())),
    memory: await page.evaluate(() => __demo.memory()),
    pixels: await page.evaluate(() => __demo.samplePixels()),
  };

  // 7. error states
  await page.evaluate(() => __demo.act("corrupt"));
  await settle(page, 300);
  r.steps.errorCorrupt = { screenshot: await shot("07-error-corrupt"), state: brief(await page.evaluate(() => __demo.getState())), memory: await page.evaluate(() => __demo.memory()) };
  await page.evaluate(() => __demo.act("unsupported"));
  await settle(page, 300);
  r.steps.errorUnsupported = { state: brief(await page.evaluate(() => __demo.getState())) };
  await page.evaluate(() => __demo.act("empty"));
  await settle(page, 300);
  r.steps.errorEmpty = { state: brief(await page.evaluate(() => __demo.getState())) };

  // 8. supersede race: slow chair overtaken by the table
  await page.evaluate(() => __demo.act("race"));
  await settle(page, 300);
  r.steps.race = { state: brief(await page.evaluate(() => __demo.getState())), memory: await page.evaluate(() => __demo.memory()) };

  // 9. download hands back the original bytes
  r.steps.download = await page.evaluate(async () => {
    const d = __demo.viewer.download();
    const orig = new Uint8Array(await (await fetch("/tests/assetViewer/fixtures/table-untextured.glb")).arrayBuffer());
    const got = new Uint8Array(d.bytes);
    return { filename: d.filename, mime: d.mime, byteLength: d.byteLength, identicalToFixture: orig.length === got.length && orig.every((b, i) => b === got[i]) };
  });

  // 10. clear, then dispose with a model loaded: the real renderer's info.memory must drop to 0
  await page.evaluate(() => __demo.act("clear"));
  r.steps.clear = { memory: await page.evaluate(() => __demo.memory()), state: brief(await page.evaluate(() => __demo.getState())) };
  await page.evaluate(() => __demo.act("chair"));
  await settle(page, 300);
  r.steps.dispose = await page.evaluate(async () => {
    const old = __demo.viewer;
    const d = old._debug();
    const renderer = d.renderer;
    const gl = renderer.getContext();
    const before = { ...renderer.info.memory };
    const canvas = renderer.domElement;
    await __demo.act("remount");
    return {
      before,
      after: { ...renderer.info.memory },
      contextLost: gl.isContextLost(),
      canvasDetached: !canvas.isConnected,
      oldStatus: old.getState().status,
      remountedStatus: __demo.getState().status,
    };
  });
  await page.evaluate(() => __demo.act("chair"));
  await settle(page, 300);
  r.steps.afterRemount = { pixels: await page.evaluate(() => __demo.samplePixels()) };
  await context.close();
  return r;
}

async function recordVideo(mode) {
  const tmp = join(OUT, `.video-tmp-${mode}`);
  rmSync(tmp, { recursive: true, force: true });
  const context = await browser.newContext({ viewport: VIEWPORT, recordVideo: { dir: tmp, size: VIEWPORT } });
  const { page } = await open(context, mode);
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    window.__p = __demo.act("chair-slow");
  });
  await page.evaluate(() => window.__p);
  await page.waitForTimeout(800);
  await orbit(page, 300, 50);
  await page.waitForTimeout(1200);
  await zoom(page, -200, 10);
  await page.waitForTimeout(1000);
  await zoom(page, 300, 6);
  await page.waitForTimeout(800);
  await page.evaluate(() => __demo.act("fit"));
  await page.waitForTimeout(1000);
  await page.evaluate(() => __demo.act("replace"));
  await page.waitForTimeout(1200);
  await orbit(page, -200, -30);
  await page.waitForTimeout(1000);
  await page.evaluate(() => __demo.act("corrupt"));
  await page.waitForTimeout(1500);
  const video = page.video();
  await context.close();
  const file = `asset-viewer-${mode}.webm`;
  renameSync(await video.path(), join(OUT, file));
  rmSync(tmp, { recursive: true, force: true });
  return file;
}

try {
  for (const mode of ["r166", "r128"]) {
    results.modes[mode] = await runMode(mode);
    console.log(`${mode}: done`);
  }
  if (withVideo) results.video = await recordVideo("r166");
} finally {
  await browser.close();
  server.close();
}
writeFileSync(join(OUT, "capture-results.json"), JSON.stringify(results, null, 2) + "\n");
console.log(JSON.stringify(results, null, 2));
