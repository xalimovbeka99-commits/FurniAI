/**
 * v3 viewer states: malformed vs unavailable files, Retry, WebGL failure and
 * context loss, view controls / keyboard, resize re-fit, and a lifecycle
 * allocation-vs-release count. Real three.js scene graph + GLTFLoader; only
 * the GPU and pointer controls are fakes (helpers/fakeRenderer.js).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { AssetViewerError, defaultCreateRenderer, ERROR_MESSAGE, INVALID_FILE_MESSAGE, KEYBOARD_HELP, mapCreativeError, normalizeConcept } from "../../src/lib/assetViewer/index.js";
import { FakeResizeObserver } from "./helpers/fakeDom.js";
import { createFakeFetch, fixtureArrayBuffer } from "./helpers/fixtures.js";
import { mountForTest } from "./helpers/mountHarness.js";

const SCENARIO = join(process.cwd(), "tests", "fixtures", "scenario");
const REV2_GLB = join(process.cwd(), "docs", "creative", "fixtures", "SYNTHETIC-box-not-scenario-generated.glb");
const ab = (path) => {
  const b = readFileSync(path);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
const box = () => ab(REV2_GLB);
const el = (t, attr) => t.container.find(attr);
const shown = (node) => node.style.display !== "none";

describe("malformed files: honest code, no Retry, no Download", () => {
  const CASES = [
    // .glb name, wrong bytes: the glb adapter (picked by extension) refuses to parse them
    ["bad-magic.glb", "PARSE_FAILED", "bad-magic"],
    ["html-as.glb", "PARSE_FAILED", "html"],
    ["truncated.glb", "PARSE_FAILED", "truncated"],
    ["no-mesh.glb", "EMPTY_SCENE", "no-mesh"],
  ];
  for (const [file, code, reason] of CASES) {
    it(`${file} -> ${code} (${reason}), with that honest message`, async () => {
      const fetch = createFakeFetch({ [`https://cdn.test/${file}`]: { bytes: ab(join(SCENARIO, file)) } });
      const t = mountForTest({ options: { fetch } });
      const r = await t.viewer.load({ url: `https://cdn.test/${file}` });
      expect(r.ok).toBe(false);
      const s = t.viewer.getState();
      const message = INVALID_FILE_MESSAGE[reason];
      expect(s).toMatchObject({ status: "error", error: { code, reason, message }, canRetry: false, model: null });
      expect(s.error.downloadAvailable).toBeUndefined();
      expect(el(t, "data-av-status").textContent).toBe(message);
      expect(el(t, "data-av-status").getAttribute("role")).toBe("alert");
      expect(shown(el(t, "data-av-retry"))).toBe(false);
      expect(shown(el(t, "data-av-download"))).toBe(false);
      expect(t.viewer.download()).toBeNull();
      t.viewer.dispose();
    });
  }

  it("creative path: malformed twice (after one fresh resolve) -> that code, nothing offered", async () => {
    let n = 0;
    const src = {
      async resolve(jobId) {
        n += 1;
        return { jobId, index: 0, url: `https://cdn.test/t${n}.glb`, format: "glb", mimeType: null, filename: "f.glb", concept: normalizeConcept(null) };
      },
    };
    const bytes = ab(join(SCENARIO, "truncated.glb"));
    const fetch = createFakeFetch({ "*": { bytes } });
    const t = mountForTest({ options: { autoRetry: true, fetch, creativeSource: src } });
    const r = await t.viewer.load({ jobId: "j", index: 0, format: "glb" });
    expect(r.error).toMatchObject({ code: "PARSE_FAILED", attempts: { resolve: 2, display: 2 } });
    expect(t.viewer.getState().actions.download).toBe(false);
    expect(shown(el(t, "data-av-download"))).toBe(false);
    expect(await t.viewer.download()).toBeNull();
    t.viewer.dispose();
  });
});

describe("unavailable files: 404 / 410 are final, a network failure offers Retry", () => {
  for (const status of [404, 410]) {
    it(`HTTP ${status} -> FETCH_FAILED, no Retry`, async () => {
      const t = mountForTest({ options: { fetch: createFakeFetch({ "https://cdn.test/a.glb": { status } }) } });
      await t.viewer.load({ url: "https://cdn.test/a.glb" });
      expect(t.viewer.getState()).toMatchObject({ status: "error", error: { code: "FETCH_FAILED", status }, canRetry: false });
      expect(shown(el(t, "data-av-retry"))).toBe(false);
      expect(shown(el(t, "data-av-download"))).toBe(false);
      t.viewer.dispose();
    });
  }

  it("network error -> Retry shown; retry() loads again and succeeds", async () => {
    const routes = { "https://cdn.test/a.glb": { networkError: true } };
    const fetch = createFakeFetch(routes);
    const t = mountForTest({ options: { fetch } });
    await t.viewer.load({ url: "https://cdn.test/a.glb" });
    expect(t.viewer.getState()).toMatchObject({ status: "error", error: { code: "FETCH_FAILED" }, canRetry: true });
    const retry = el(t, "data-av-retry");
    expect(shown(retry)).toBe(true);
    expect(retry.textContent).toBe("Try again");
    routes["https://cdn.test/a.glb"] = { bytes: box() };
    expect((await t.viewer.retry()).ok).toBe(true);
    expect(t.viewer.getState().status).toBe("ready");
    expect(shown(retry)).toBe(false);
    expect(fetch.calls).toHaveLength(2);
    t.viewer.dispose();
  });

  it("the overlay Retry button calls retry()", async () => {
    const routes = { "https://cdn.test/a.glb": { networkError: true } };
    const t = mountForTest({ options: { fetch: createFakeFetch(routes) } });
    await t.viewer.load({ url: "https://cdn.test/a.glb" });
    routes["https://cdn.test/a.glb"] = { bytes: box() };
    const states = [];
    t.viewer.on("ready", (s) => states.push(s.status));
    el(t, "data-av-retry").dispatch("click");
    await vi.waitFor(() => expect(states).toEqual(["ready"]));
    t.viewer.dispose();
  });
});

describe("WebGL unavailable", () => {
  const fakeDoc = (getContext) => ({ createElement: () => ({ getContext }) });

  it("defaultCreateRenderer: no context -> WEBGL_UNAVAILABLE (no-context); three's constructor is never called", () => {
    const WebGLRenderer = vi.fn();
    let err = null;
    try {
      defaultCreateRenderer({ REVISION: "166", WebGLRenderer }, fakeDoc(() => null));
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AssetViewerError);
    expect(err).toMatchObject({ code: "WEBGL_UNAVAILABLE", webglReason: "no-context" });
    expect(WebGLRenderer).not.toHaveBeenCalled();
  });

  it("defaultCreateRenderer: r128 may fall back to WebGL1 and hands three the context it made", () => {
    const asked = [];
    const ctx = { fake: "webgl1" };
    class WebGLRenderer {
      constructor(o) {
        this.o = o;
      }
    }
    const r = defaultCreateRenderer({ REVISION: "128", WebGLRenderer }, fakeDoc((kind) => (asked.push(kind), kind === "webgl" ? ctx : null)));
    expect(asked).toEqual(["webgl2", "webgl"]);
    expect(r.o).toMatchObject({ context: ctx, alpha: true, antialias: true });
    const asked2 = [];
    expect(() => defaultCreateRenderer({ REVISION: "166", WebGLRenderer }, fakeDoc((k) => (asked2.push(k), null)))).toThrow(AssetViewerError);
    expect(asked2).toEqual(["webgl2"]);
  });

  for (const [what, createRenderer, reason] of [
    ["createRenderer throws", () => { throw new Error("Error creating WebGL context."); }, "renderer-threw"],
    ["no context", () => { throw new AssetViewerError("WEBGL_UNAVAILABLE", "no WebGL context", { webglReason: "no-context" }); }, "no-context"],
  ]) {
    it(`${what}: the file is still fetched + validated, then an honest error WITH download`, async () => {
      const fetch = createFakeFetch({ "https://cdn.test/box.glb": { bytes: box() } });
      const t = mountForTest({ createRenderer, options: { fetch } });
      expect(t.viewer.getState()).toMatchObject({ status: "error", error: { code: "WEBGL_UNAVAILABLE" }, webgl: { available: false, reason } });
      const r = await t.viewer.load({ url: "https://cdn.test/box.glb" });
      expect(r.ok).toBe(false);
      const s = t.viewer.getState();
      expect(s).toMatchObject({ status: "error", error: { code: "WEBGL_UNAVAILABLE", webglReason: reason, downloadAvailable: true }, actions: { download: true }, model: null });
      expect(el(t, "data-av-status").textContent).toBe(ERROR_MESSAGE.WEBGL_UNAVAILABLE);
      expect(shown(el(t, "data-av-download"))).toBe(true);
      const d = t.viewer.download();
      expect(d).toMatchObject({ format: "glb", byteLength: box().byteLength });
      t.viewer.dispose();
    });
  }

  it("no WebGL + malformed file: the malformed code wins and nothing is offered", async () => {
    const fetch = createFakeFetch({ "https://cdn.test/t.glb": { bytes: ab(join(SCENARIO, "truncated.glb")) } });
    const t = mountForTest({ createRenderer: () => null, options: { fetch } });
    await t.viewer.load({ url: "https://cdn.test/t.glb" });
    expect(t.viewer.getState().error.code).toBe("PARSE_FAILED");
    expect(t.viewer.download()).toBeNull();
    t.viewer.dispose();
  });
});

describe("WebGL context lost / restored", () => {
  it("lost while showing -> WEBGL_CONTEXT_LOST, rendering stops, download + Retry offered; restored + retry -> ready", async () => {
    const t = mountForTest();
    await t.viewer.load({ arrayBuffer: box() });
    const canvas = t.renderer.domElement;
    const frames = t.renderer.info.render.frames;
    canvas.dispatch("webglcontextlost");
    const s = t.viewer.getState();
    expect(s).toMatchObject({ status: "error", error: { code: "WEBGL_CONTEXT_LOST", downloadAvailable: true }, canRetry: true, webgl: { available: false, reason: "context-lost" } });
    expect(el(t, "data-av-status").textContent).toBe(ERROR_MESSAGE.WEBGL_CONTEXT_LOST);
    expect(shown(el(t, "data-av-download"))).toBe(true);
    expect(shown(el(t, "data-av-retry"))).toBe(true);
    expect(t.viewer.download()).toMatchObject({ format: "glb" });
    expect(t.renderer.info.render.frames).toBe(frames);
    // retry before restore -> same honest error (no render on a dead context)
    await t.viewer.retry();
    expect(t.viewer.getState().error.code).toBe("WEBGL_CONTEXT_LOST");
    canvas.dispatch("webglcontextrestored");
    expect(t.viewer.getState().webgl).toEqual({ available: true, reason: null });
    expect((await t.viewer.retry()).ok).toBe(true);
    expect(t.viewer.getState().status).toBe("ready");
    t.viewer.dispose();
  });
});

describe("view controls, keyboard, resize", () => {
  const camDir = (t) => {
    const d = t.viewer._debug();
    return d.camera.position.clone().sub(d.controls.target);
  };
  const azimuth = (t) => new THREE.Spherical().setFromVector3(camDir(t)).theta;

  it("canvas is focusable, named, described by the keyboard help", async () => {
    const t = mountForTest();
    const canvas = t.renderer.domElement;
    expect(canvas.attributes).toMatchObject({ tabindex: "0", role: "img", "aria-label": "Interactive 3D preview" });
    const help = t.doc.created.find((e) => e.id === canvas.getAttribute("aria-describedby"));
    expect(help.textContent).toBe(KEYBOARD_HELP);
    expect(help.hidden).toBe(true);
    t.viewer.dispose();
  });

  it("orbit / zoom (clamped) / resetView / fitToView", async () => {
    const t = mountForTest();
    await t.viewer.load({ arrayBuffer: box() });
    const start = camDir(t);
    t.viewer.orbit(Math.PI / 2, 0);
    const turned = camDir(t);
    expect(turned.length()).toBeCloseTo(start.length(), 6);
    expect(turned.angleTo(start)).toBeGreaterThan(1);
    const before = camDir(t).length();
    t.viewer.zoom(0.8);
    expect(camDir(t).length()).toBeCloseTo(before * 0.8, 6);
    for (let i = 0; i < 50; i++) t.viewer.zoom(0.5);
    const c = t.viewer._debug().controls;
    expect(camDir(t).length()).toBeCloseTo(c.minDistance, 6);
    for (let i = 0; i < 50; i++) t.viewer.zoom(2);
    expect(camDir(t).length()).toBeCloseTo(c.maxDistance, 6);
    t.viewer.resetView();
    expect(camDir(t).angleTo(start)).toBeLessThan(1e-6);
    expect(camDir(t).length()).toBeCloseTo(start.length(), 6);
    t.viewer.dispose();
  });

  it("keyboard on the canvas: arrows rotate, +/- zoom, 0 resets; modifiers and non-ready states are ignored", async () => {
    const t = mountForTest();
    const canvas = t.renderer.domElement;
    expect(canvas.dispatch("keydown", { key: "ArrowLeft" }).defaultPrevented).toBe(false); // idle: ignored
    await t.viewer.load({ arrayBuffer: box() });
    const start = camDir(t);
    const a0 = azimuth(t);
    const e = canvas.dispatch("keydown", { key: "ArrowLeft" });
    expect(e.defaultPrevented).toBe(true);
    expect(azimuth(t) - a0).toBeCloseTo(-Math.PI / 12, 6);
    expect(canvas.dispatch("keydown", { key: "ArrowLeft", ctrlKey: true }).defaultPrevented).toBe(false);
    const d0 = camDir(t).length();
    canvas.dispatch("keydown", { key: "+" });
    expect(camDir(t).length()).toBeLessThan(d0);
    canvas.dispatch("keydown", { key: "-" });
    canvas.dispatch("keydown", { key: "-" });
    expect(camDir(t).length()).toBeGreaterThan(d0);
    canvas.dispatch("keydown", { key: "0" });
    expect(camDir(t).angleTo(start)).toBeLessThan(1e-6);
    expect(canvas.dispatch("keydown", { key: "x" }).defaultPrevented).toBe(false);
    t.viewer.dispose();
  });

  it("overlay control buttons: a labelled group, enabled only while a model is shown", async () => {
    const t = mountForTest();
    const group = el(t, "data-av-controls");
    expect(group.attributes).toMatchObject({ role: "group", "aria-label": "3D view controls" });
    expect(shown(group)).toBe(false);
    await t.viewer.load({ arrayBuffer: box() });
    expect(shown(group)).toBe(true);
    const buttons = group.children;
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual(["Rotate left", "Rotate right", "Zoom in", "Zoom out", "Reset view", "Fit to view"]);
    expect(buttons.every((b) => !b.disabled && b.getAttribute("type") === "button")).toBe(true);
    const start = camDir(t);
    const a0 = azimuth(t);
    buttons[1].dispatch("click");
    expect(azimuth(t) - a0).toBeCloseTo(Math.PI / 12, 6);
    buttons[4].dispatch("click");
    expect(camDir(t).angleTo(start)).toBeLessThan(1e-6);
    t.viewer.clear();
    expect(shown(group)).toBe(false);
    expect(buttons.every((b) => b.disabled)).toBe(true);
    t.viewer.dispose();
  });

  it("resize (e.g. a phone rotating) re-fits with the new aspect, keeping view direction and zoom ratio", async () => {
    FakeResizeObserver.instances.length = 0;
    const t = mountForTest({ width: 390, height: 844 });
    await t.viewer.load({ arrayBuffer: box() });
    t.viewer.orbit(0.4, 0);
    t.viewer.zoom(1.25);
    const dir = camDir(t).normalize();
    const cam = t.viewer._debug().camera;
    expect(cam.aspect).toBeCloseTo(390 / 844, 6);
    const ro = FakeResizeObserver.instances.at(-1);
    const fitDistance = () => t.viewer._debug().lastFit.distance;
    const dist0 = camDir(t).length();
    const fit0 = fitDistance();
    expect(t.viewer.getView().zoomRatio).toBeCloseTo(dist0 / fit0, 6);
    t.container.clientWidth = 844;
    t.container.clientHeight = 390;
    ro.cb([]);
    expect(cam.aspect).toBeCloseTo(844 / 390, 6);
    expect(t.renderer.calls.setSize.at(-1)).toEqual([844, 390]);
    expect(camDir(t).normalize().angleTo(dir)).toBeLessThan(1e-6);
    // landscape needs less distance to fit, and the user's zoom-out ratio is kept relative to the new fit
    const fit1 = fitDistance();
    expect(fit1).toBeLessThan(fit0);
    expect(camDir(t).length() / fit1).toBeCloseTo(dist0 / fit0, 6);
    expect(t.viewer.getView().zoomRatio).toBeCloseTo(dist0 / fit0, 6);
    t.viewer.dispose();
  });
});

describe("lifecycle: everything allocated is released", () => {
  it("load -> replace -> context lost -> dispose: models, listeners, observers, frames, context all released", async () => {
    FakeResizeObserver.instances.length = 0;
    const raf = (() => {
      let id = 0;
      const live = new Set();
      return { live, request: () => (live.add(++id), id), cancel: (i) => live.delete(i) };
    })();
    let canvasListenersAtContextLoss = null;
    const t = mountForTest({ raf });
    const canvas = t.renderer.domElement;
    const realLoss = t.renderer.forceContextLoss.bind(t.renderer);
    t.renderer.forceContextLoss = () => {
      canvasListenersAtContextLoss = canvas.listenerCount;
      realLoss();
    };
    const roots = [];
    t.viewer.on("ready", () => roots.push(t.viewer._debug().model));
    await t.viewer.load({ arrayBuffer: box() });
    t.render();
    await t.viewer.load({ arrayBuffer: fixtureArrayBuffer("table-untextured.glb") });
    t.render();
    expect(roots).toHaveLength(2);
    const disposed = [];
    roots.forEach((r) => r.traverse((o) => o.geometry && o.geometry.addEventListener("dispose", () => disposed.push(o.geometry))));
    canvas.dispatch("webglcontextlost");
    const controls = t.viewer._debug().controls;
    expect(canvas.listenerCount).toBe(3); // keydown, webglcontextlost, webglcontextrestored
    t.viewer.dispose();
    expect(canvasListenersAtContextLoss).toBe(0); // removed BEFORE forceContextLoss()
    expect(canvas.listenerCount).toBe(0);
    expect(Object.values(controls.listeners).every((s) => s.size === 0)).toBe(true);
    expect(controls.disposed).toBe(1);
    expect(FakeResizeObserver.instances.every((o) => o.disconnected)).toBe(true);
    expect(raf.live.size).toBe(0);
    expect(t.renderer.calls).toMatchObject({ dispose: 1, forceContextLoss: 1 });
    expect(t.renderer.info.memory).toEqual({ geometries: 0, textures: 0 });
    expect(t.container.children).toEqual([]);
    expect(t.win.listenerCount).toBe(0);
    // every overlay button listener is gone too
    const buttons = t.doc.created.filter((e) => e.tagName === "BUTTON");
    expect(buttons.length).toBeGreaterThan(6);
    expect(buttons.every((b) => b.listenerCount === 0)).toBe(true);
  });

  it("without ResizeObserver: window resize + pagehide are the only window listeners, both removed", async () => {
    const t = mountForTest({ resizeObserver: false });
    expect(t.win.listenerCount).toBe(2);
    t.win.dispatch("resize");
    t.viewer.dispose();
    expect(t.win.listenerCount).toBe(0);
  });
});

describe("Retry is offered only where another attempt can help", () => {
  it("retryable resolve error (503) after the viewer's own retry -> canRetry; 404 MISSING_JOB -> not", async () => {
    for (const [status, code, can] of [[503, "STORAGE_UNAVAILABLE", true], [404, "MISSING_JOB", false]]) {
      const src = { resolve: async () => { throw mapCreativeError(status, { ok: false, code }); } };
      const t = mountForTest({ options: { creativeSource: src, rateLimitRetryDelayMs: 0 } });
      await t.viewer.load({ jobId: "j", index: 0, format: "glb" });
      expect(t.viewer.getState().canRetry, code).toBe(can);
      expect(shown(el(t, "data-av-retry")), code).toBe(can);
      t.viewer.dispose();
    }
  });
});
