/**
 * Interim host interface (integration lead 2026-10-07):
 *   FurniAssetViewer.mount(containerEl, { THREE, ...opts }) -> handle with dispose().
 * Plus the navigation safety nets (host dispose is primary; `signal` and
 * window "pagehide" are backups) and an allocation-vs-disposal ledger across
 * load -> replace -> navigate.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mount } from "../../src/lib/assetViewer/index.js";
import * as entry from "../../src/lib/assetViewer/entry.js";
import { createFakeDocument, createManualRaf, FakeResizeObserver } from "./helpers/fakeDom.js";
import { createFakeOrbitControlsClass, createFakeRenderer } from "./helpers/fakeRenderer.js";
import { createFakeFetch, deferred, fixtureArrayBuffer, installImageBitmapShim } from "./helpers/fixtures.js";

let shim;
beforeAll(() => (shim = installImageBitmapShim()));
afterAll(() => shim.restore());

const chair = () => ({ arrayBuffer: fixtureArrayBuffer("chair-textured.glb"), filename: "chair-textured.glb" });
const table = () => ({ arrayBuffer: fixtureArrayBuffer("table-untextured.glb"), filename: "table-untextured.glb" });

/** What a host page has: window.THREE (namespace) with the r128-style examples globals hung on it. */
function hostThree(extra = {}) {
  const Orbit = createFakeOrbitControlsClass(THREE);
  return { ns: { ...THREE, GLTFLoader, OrbitControls: Orbit, ...extra }, Orbit };
}

function env(opts = {}) {
  const raf = opts.raf === false ? null : createManualRaf();
  const { doc, win, container } = createFakeDocument({ raf, resizeObserver: opts.resizeObserver });
  const renderers = [];
  const createRenderer = () => {
    const r = createFakeRenderer(doc);
    renderers.push(r);
    return r;
  };
  return { doc, win, container, raf, renderers, createRenderer };
}

/** Ledger: every geometry/material/texture the viewer ever showed, and how many times each was disposed. */
function ledger() {
  const seen = new Map();
  return {
    track(root, extra = []) {
      const add = (r) => {
        if (!r || seen.has(r)) return;
        seen.set(r, 0);
        r.addEventListener("dispose", () => seen.set(r, seen.get(r) + 1));
      };
      root.traverse((o) => {
        add(o.geometry);
        for (const m of [].concat(o.material || [])) {
          add(m);
          for (const v of Object.values(m)) if (v && v.isTexture) add(v);
        }
      });
      extra.forEach(add);
    },
    get allocated() {
      return seen.size;
    },
    get disposedOnce() {
      return [...seen.values()].filter((n) => n === 1).length;
    },
    get leaked() {
      return [...seen.values()].filter((n) => n === 0).length;
    },
    get doubleDisposed() {
      return [...seen.values()].filter((n) => n > 1).length;
    },
  };
}

describe("mount(containerEl, { THREE, ...opts })", () => {
  it("is exported by the public entry (the IIFE's window.FurniAssetViewer.mount)", () => {
    expect(entry.mount).toBe(mount);
    expect(typeof entry.mount).toBe("function");
  });

  it("maps THREE -> three and takes GLTFLoader / OrbitControls from THREE.* (r128 examples globals)", async () => {
    const e = env();
    const { ns, Orbit } = hostThree();
    const h = mount(e.container, { THREE: ns, createRenderer: e.createRenderer });
    expect(Orbit.instances.at(-1).object.isPerspectiveCamera).toBe(true);
    const r = await h.load(chair());
    expect(r.ok).toBe(true);
    expect(h.getState().status).toBe("ready");
    // the scene is built from the host's namespace (THREE.Scene), not from any import
    expect(h._debug().scene).toBeInstanceOf(ns.Scene);
    h.dispose();
  });

  it("explicit deps win over THREE.* globals", async () => {
    const e = env();
    const { ns } = hostThree();
    const Mine = createFakeOrbitControlsClass(THREE);
    const h = mount(e.container, { THREE: ns, deps: { OrbitControls: Mine }, createRenderer: e.createRenderer });
    expect(Mine.instances).toHaveLength(1);
    expect(h._debug().controls).toBe(Mine.instances[0]);
    h.dispose();
  });

  it("missing THREE (or not a three namespace) -> a clear TypeError, code MISSING_DEPENDENCY, nothing mounted", () => {
    for (const bad of [undefined, null, {}, { Scene: 1 }, "THREE"]) {
      const e = env();
      let err;
      try {
        mount(e.container, { THREE: bad, createRenderer: e.createRenderer });
      } catch (x) {
        err = x;
      }
      expect(err).toBeInstanceOf(TypeError);
      expect(err.code).toBe("MISSING_DEPENDENCY");
      expect(err.message).toMatch(/mount\(containerEl, \{ THREE \}\)/);
      expect(err.message).toMatch(/never imports or bundles three/);
      expect(e.container.children).toHaveLength(0);
      expect(e.renderers).toHaveLength(0);
    }
    expect(() => mount(env().container)).toThrow(/THREE is missing/);
  });

  it("THREE without GLTFLoader -> mounts, but loading reports MISSING_DEPENDENCY honestly (no crash)", async () => {
    const e = env();
    const ns = { ...THREE, OrbitControls: createFakeOrbitControlsClass(THREE) };
    const h = mount(e.container, { THREE: ns, createRenderer: e.createRenderer });
    const r = await h.load(chair());
    expect(r.ok).toBe(false);
    expect(r.error.code).toBe("MISSING_DEPENDENCY");
    expect(h.download()).toBeNull();
    h.dispose();
  });

  it("defaults downloadButton to 'always' (the viewer's own Download, offered once a valid asset is held)", async () => {
    const e = env();
    const h = mount(e.container, { THREE: hostThree().ns, createRenderer: e.createRenderer });
    const btn = e.container.find("data-av-download");
    expect(btn.style.display).toBe("none"); // nothing held yet
    await h.load(chair());
    expect(btn.style.display).not.toBe("none");
    expect(btn.getAttribute("aria-label") || btn.textContent).toMatch(/download/i);
    h.dispose();
  });

  it("works with a plain URL and no Scenario / creative source at all", async () => {
    const e = env();
    const fetch = createFakeFetch({ "https://cdn.example/chair.glb": { bytes: fixtureArrayBuffer("chair-textured.glb") } });
    const h = mount(e.container, { THREE: hostThree().ns, createRenderer: e.createRenderer, fetch, asset: { url: "https://cdn.example/chair.glb" } });
    await new Promise((r) => h.on("statechange", (s) => s.status === "ready" && r()));
    expect(h.getState().model.meshCount).toBeGreaterThan(0);
    expect(fetch.calls).toHaveLength(1);
    h.dispose();
  });

  it("dispose() is idempotent: GPU released once, one dispose event, later calls are no-ops", async () => {
    const e = env();
    const h = mount(e.container, { THREE: hostThree().ns, createRenderer: e.createRenderer });
    await h.load(chair());
    let events = 0;
    h.on("dispose", () => events++);
    h.dispose();
    h.dispose();
    h.dispose();
    const r = e.renderers[0];
    expect(r.calls).toMatchObject({ dispose: 1, forceContextLoss: 1 });
    expect(r.info.memory).toEqual({ geometries: 0, textures: 0 });
    expect(events).toBe(1);
    expect(h.getState().status).toBe("disposed");
    expect((await h.load(table())).error.code).toBe("VIEWER_DISPOSED");
  });

  it("dispose() then navigate (pagehide) / abort: nothing runs twice, no listener is left on window or signal", async () => {
    const e = env();
    const ac = new AbortController();
    let sigListeners = 0;
    const add = ac.signal.addEventListener.bind(ac.signal);
    const rm = ac.signal.removeEventListener.bind(ac.signal);
    ac.signal.addEventListener = (t, f, o) => (sigListeners++, add(t, f, o));
    ac.signal.removeEventListener = (t, f, o) => (sigListeners--, rm(t, f, o));
    const h = mount(e.container, { THREE: hostThree().ns, createRenderer: e.createRenderer, signal: ac.signal });
    await h.load(chair());
    expect(e.win.listenerCount).toBe(1); // pagehide only (ResizeObserver present)
    expect(sigListeners).toBe(1);
    h.dispose();
    expect(e.win.listenerCount).toBe(0);
    expect(sigListeners).toBe(0);
    e.win.dispatch("pagehide");
    ac.abort();
    expect(e.renderers[0].calls).toMatchObject({ dispose: 1, forceContextLoss: 1 });
    expect(e.raf.pending).toBe(0);
  });
});

describe("navigation safety nets", () => {
  it("window 'pagehide' disposes everything (host forgot dispose)", async () => {
    const e = env();
    const h = mount(e.container, { THREE: hostThree().ns, createRenderer: e.createRenderer });
    await h.load(chair());
    const ro = FakeResizeObserver.instances.at(-1);
    e.win.dispatch("pagehide");
    expect(h.getState().status).toBe("disposed");
    expect(e.renderers[0].calls).toMatchObject({ dispose: 1, forceContextLoss: 1 });
    expect(e.renderers[0].info.memory).toEqual({ geometries: 0, textures: 0 });
    expect(ro.disconnected).toBe(true);
    expect(e.win.listenerCount).toBe(0);
    expect(e.container.children).toHaveLength(0);
  });

  it("disposeOnPageHide:false leaves pagehide to the host", async () => {
    const e = env();
    const h = mount(e.container, { THREE: hostThree().ns, createRenderer: e.createRenderer, disposeOnPageHide: false });
    expect(e.win.listenerCount).toBe(0);
    e.win.dispatch("pagehide");
    expect(h.getState().status).not.toBe("disposed");
    h.dispose();
  });

  it("AbortSignal aborted mid-load: disposes, the in-flight load settles without showing a model, nothing leaks", async () => {
    const e = env();
    const gate = deferred();
    const fetch = createFakeFetch({ "https://cdn.example/slow.glb": { bytes: fixtureArrayBuffer("chair-textured.glb"), gate: () => gate.promise } });
    const ac = new AbortController();
    const h = mount(e.container, { THREE: hostThree().ns, createRenderer: e.createRenderer, fetch, signal: ac.signal });
    const p = h.load({ url: "https://cdn.example/slow.glb" });
    expect(h.getState().status).toBe("loading");
    ac.abort();
    gate.resolve();
    const r = await p;
    expect(r.ok).toBe(false);
    expect(h.getState().status).toBe("disposed");
    expect(h._debug().model).toBeNull();
    expect(fetch.calls[0].init.signal.aborted).toBe(true);
    expect(e.renderers[0].calls.forceContextLoss).toBe(1);
    expect(e.win.listenerCount).toBe(0);
  });

  it("an already-aborted signal disposes right after mount (the handle is still returned)", async () => {
    const e = env();
    const ac = new AbortController();
    ac.abort();
    const h = mount(e.container, { THREE: hostThree().ns, createRenderer: e.createRenderer, signal: ac.signal });
    expect(typeof h.dispose).toBe("function");
    await Promise.resolve();
    expect(h.getState().status).toBe("disposed");
    expect(e.win.listenerCount).toBe(0);
  });

  it("no rendering once the viewer's root is removed from the DOM (isConnected false); resumes when re-attached", async () => {
    const e = env();
    const h = mount(e.container, { THREE: hostThree().ns, createRenderer: e.createRenderer });
    await h.load(chair());
    e.raf.flush();
    const r = e.renderers[0];
    const root = e.container.children[0];
    root.isConnected = true;
    h.fitToView();
    e.raf.flush();
    const before = r.info.render.frames;
    root.isConnected = false; // host removed our node without calling dispose()
    h.fitToView();
    h.orbit(0.3, 0);
    e.raf.flush();
    expect(r.info.render.frames).toBe(before);
    expect(e.raf.pending).toBe(0);
    root.isConnected = true;
    h.fitToView();
    e.raf.flush();
    expect(r.info.render.frames).toBeGreaterThan(before);
    h.dispose();
  });

  it("allocation ledger: load -> replace -> replace -> pagehide disposes every resource exactly once", async () => {
    const e = env();
    const book = ledger();
    const h = mount(e.container, { THREE: hostThree().ns, createRenderer: e.createRenderer });
    for (const a of [chair(), table(), chair()]) {
      await h.load(a);
      e.raf.flush();
      const d = h._debug();
      book.track(d.model, [d.envTarget, d.envTarget && d.envTarget.texture]);
    }
    expect(book.allocated).toBeGreaterThan(6);
    // two replacements already released the first two models
    expect(book.leaked).toBeGreaterThan(0); // the current model is still live...
    e.win.dispatch("pagehide");
    expect(book.leaked).toBe(0); // ...until navigation
    expect(book.doubleDisposed).toBe(0);
    expect(book.disposedOnce).toBe(book.allocated);
    expect(e.renderers[0].info.memory).toEqual({ geometries: 0, textures: 0 });
  });
});
