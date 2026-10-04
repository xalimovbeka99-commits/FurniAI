/**
 * Framework-free generated-model viewer.
 *
 *   const viewer = mountAssetViewer(el, {
 *     three: window.THREE,                         // REQUIRED: injected THREE namespace (r128 .. r16x)
 *     deps: { GLTFLoader, OrbitControls, RoomEnvironment? },  // injected classes
 *     asset: { url, filename? },                   // optional initial load (PROVISIONAL descriptor)
 *     onError: (err) => {},                        // { code, message, detail }
 *   });
 *   await viewer.load({ arrayBuffer, filename: "chair.glb" });
 *   viewer.dispose();
 *
 * This file must NEVER import "three": the static Studio page already has
 * window.THREE (r128) and a second copy would break instanceof checks and
 * double the payload. Everything three-related arrives through options.
 *
 * State machine:  idle -> loading(fetching -> parsing) -> ready | error
 *                 any  -> idle (clear)      any -> disposed (dispose)
 * A newer load()/clear()/dispose() supersedes an in-flight load: its fetch
 * is aborted and, if parsing already produced a scene, that scene is
 * disposed and never shown. Superseded loads resolve { ok:false, superseded:true }
 * and never trigger onError.
 */
import { AssetViewerError, ERROR_CODE, toErrorRecord } from "./errors.js";
import { downloadFilename, extensionOf, normalizeAsset } from "./descriptor.js";
import { createAdapterRegistry } from "./adapters/registry.js";
import { DEFAULT_ADAPTERS } from "./adapters/gltf.js";
import {
  colorManagementMode,
  configureRendererOutput,
  enforceColorTexturesSRGB,
  lightIntensityScale,
  threeRevision,
} from "./colorSpace.js";
import { collectResources, disposeObject3D } from "./dispose.js";
import { computeFit, DEFAULT_VIEW_DIRECTION } from "./fit.js";
import { describeScale, relativeProportions } from "./scale.js";
import { DEFAULT_MAX_BYTES, fetchBytes, isAbortError, readBlob } from "./fetchBytes.js";
import { createOverlay } from "./overlay.js";

export const STATUS = Object.freeze({
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
  DISPOSED: "disposed",
});

export const EVENTS = Object.freeze(["statechange", "progress", "ready", "error", "dispose"]);

/** Extensions we know about but deliberately do not load yet (fail before fetching). */
export const KNOWN_UNSUPPORTED_EXTENSIONS = Object.freeze([
  "obj", "fbx", "usdz", "usd", "usda", "usdc", "stl", "3mf", "ply", "dae", "blend", "step", "stp", "3ds", "max",
]);

const DEP_KEYS = ["GLTFLoader", "OrbitControls", "RoomEnvironment"];

function defaultCreateRenderer(three) {
  const renderer = new three.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  if (typeof renderer.getContext === "function" && !renderer.getContext()) {
    throw new Error("WebGL context unavailable");
  }
  return renderer;
}

function withTimeout(promise, ms) {
  if (!ms || !(ms > 0)) return promise;
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new AssetViewerError("PARSE_FAILED", `parser did not finish within ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function mountAssetViewer(el, options = {}) {
  if (!el || typeof el.appendChild !== "function") {
    throw new TypeError("mountAssetViewer(el, options): el must be a DOM element");
  }
  const three = options.three;
  const deps = { ...(options.deps || {}) };
  for (const k of DEP_KEYS) if (options[k] && !deps[k]) deps[k] = options[k];
  const registry = options.registry || createAdapterRegistry(options.adapters || DEFAULT_ADAPTERS);
  const doc = el.ownerDocument || globalThis.document;
  const win = (doc && doc.defaultView) || globalThis;
  const raf = options.requestAnimationFrame || (win.requestAnimationFrame ? win.requestAnimationFrame.bind(win) : null);
  const caf = options.cancelAnimationFrame || (win.cancelAnimationFrame ? win.cancelAnimationFrame.bind(win) : null);
  const fetchImpl = options.fetch || (typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : null);
  const maxBytes = options.maxBytes === undefined ? DEFAULT_MAX_BYTES : options.maxBytes;
  const fov = options.fov || 40;
  const onError = typeof options.onError === "function" ? options.onError : null;
  // A loader that never calls back (e.g. a broken polyfill) must not leave the UI stuck in "loading".
  const parseTimeoutMs = options.parseTimeoutMs === undefined ? 120000 : options.parseTimeoutMs;

  const listeners = new Map(EVENTS.map((e) => [e, new Set()]));
  let state = {
    status: STATUS.IDLE,
    loadId: 0,
    phase: null,
    progress: null,
    asset: null,
    model: null,
    error: null,
    capabilities: null,
  };
  let seq = 0;
  let pending = null; // { id, abort }
  let disposed = false;
  let fatal = null;

  let renderer = null;
  let scene = null;
  let camera = null;
  let controls = null;
  let lights = [];
  let envTarget = null;
  let model = null; // currently displayed Object3D
  let bounds = null; // { center:[x,y,z], radius, size:{x,y,z} }
  let current = null; // { adapter, bytes, desc } of the displayed model (for download)
  let rafId = null;
  let resizeObserver = null;
  let resizeListener = null;
  let controlsListener = null;

  // ---- DOM root (we never restyle the host element) ----
  const root = doc.createElement("div");
  root.setAttribute("data-asset-viewer", "");
  root.setAttribute("aria-label", "3D model preview");
  root.style.cssText = "position:relative;width:100%;height:100%;min-height:160px;overflow:hidden;";
  el.appendChild(root);
  const overlay = options.ui === false ? null : createOverlay(doc, root);

  function emit(event, payload) {
    for (const cb of [...listeners.get(event)]) {
      try {
        cb(payload);
      } catch (e) {
        if (globalThis.console) console.error("[assetViewer] listener for", event, "threw", e);
      }
    }
  }

  function snapshot() {
    return JSON.parse(JSON.stringify(state));
  }

  function setState(patch) {
    state = { ...state, ...patch };
    if (overlay) overlay.update(state);
    emit("statechange", snapshot());
  }

  function reportError(rec) {
    emit("error", rec);
    if (onError) {
      try {
        onError(rec);
      } catch (e) {
        if (globalThis.console) console.error("[assetViewer] onError threw", e);
      }
    }
  }

  // ---- three setup ----
  if (!three || typeof three.Scene !== "function" || typeof three.PerspectiveCamera !== "function") {
    fatal = new AssetViewerError("MISSING_DEPENDENCY", "options.three (the THREE namespace) is required");
  } else {
    try {
      renderer = (options.createRenderer || defaultCreateRenderer)(three);
    } catch (e) {
      fatal = new AssetViewerError("WEBGL_UNAVAILABLE", e && e.message ? e.message : String(e));
    }
  }
  if (!fatal) {
    try {
      setupScene();
    } catch (e) {
      fatal = new AssetViewerError("WEBGL_UNAVAILABLE", `scene setup failed: ${e && e.message ? e.message : e}`);
    }
  }

  function setupScene() {
    scene = new three.Scene();
    camera = new three.PerspectiveCamera(fov, 1, 0.01, 100);
    camera.position.set(...DEFAULT_VIEW_DIRECTION);
    configureRendererOutput(three, renderer);
    if (typeof renderer.setPixelRatio === "function") renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, 2));
    const canvas = renderer.domElement;
    if (canvas && canvas.style) canvas.style.cssText = "display:block;width:100%;height:100%;outline:none;";
    if (canvas) root.insertBefore ? root.insertBefore(canvas, root.firstChild || null) : root.appendChild(canvas);

    if (options.background !== null) {
      scene.background = new three.Color(options.background === undefined ? 0xf3f1ed : options.background);
    }

    // Neutral lighting: hemisphere + key directional. Optional RoomEnvironment PMREM
    // (generated procedurally on the GPU — no network fetch for env maps).
    const k = lightIntensityScale(three, renderer);
    let envKind = "lights-only";
    if (options.environment !== "none" && deps.RoomEnvironment && typeof three.PMREMGenerator === "function") {
      let pmrem = null;
      let room = null;
      try {
        pmrem = new three.PMREMGenerator(renderer);
        room = new deps.RoomEnvironment(renderer);
        envTarget = pmrem.fromScene(room, 0.04);
        scene.environment = envTarget.texture;
        envKind = "room-pmrem";
      } catch {
        envTarget = null;
      } finally {
        if (room) {
          // r128's Scene.prototype.dispose is a "has been removed" stub that only logs.
          const own = typeof room.dispose === "function" && room.dispose !== three.Scene.prototype.dispose;
          if (own) room.dispose();
          else disposeObject3D(room);
        }
        if (pmrem) pmrem.dispose();
      }
    }
    const envDim = envKind === "room-pmrem" ? 0.5 : 1;
    const hemi = new three.HemisphereLight(0xffffff, 0x8a8278, 0.65 * k * envDim);
    const key = new three.DirectionalLight(0xffffff, 0.9 * k * envDim);
    key.position.set(3, 5, 4);
    lights = [hemi, key];
    lights.forEach((l) => scene.add(l));

    if (deps.OrbitControls) {
      controls = new deps.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.screenSpacePanning = true;
      controlsListener = () => requestRender();
      if (typeof controls.addEventListener === "function") controls.addEventListener("change", controlsListener);
    }

    resize();
    if (typeof win.ResizeObserver === "function") {
      resizeObserver = new win.ResizeObserver(() => resize());
      resizeObserver.observe(root);
    } else if (typeof win.addEventListener === "function") {
      resizeListener = () => resize();
      win.addEventListener("resize", resizeListener);
    }

    state.capabilities = {
      threeRevision: threeRevision(three),
      colorManagement: colorManagementMode(three),
      controls: Boolean(controls),
      environment: envKind,
      formats: registry.list().map((a) => a.id),
    };
  }

  function resize() {
    if (!renderer || disposed) return;
    const w = root.clientWidth || el.clientWidth || 300;
    const h = root.clientHeight || el.clientHeight || 150;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    requestRender();
  }

  function renderFrame() {
    rafId = null;
    if (disposed || !renderer) return;
    if (controls && typeof controls.update === "function") controls.update();
    renderer.render(scene, camera);
  }

  function requestRender() {
    if (disposed || !renderer) return;
    if (!raf) {
      renderFrame();
      return;
    }
    if (rafId == null) rafId = raf(renderFrame);
  }

  // ---- model lifecycle ----
  function removeModel() {
    if (model) {
      disposeObject3D(model);
      model = null;
    }
    bounds = null;
    current = null;
  }

  function supersede() {
    seq++;
    if (pending && pending.abort) {
      try {
        pending.abort();
      } catch {
        /* ignore */
      }
    }
    pending = null;
  }

  function inspect(obj) {
    let meshCount = 0;
    let triangleCount = 0;
    obj.traverse((o) => {
      const g = o.geometry;
      const pos = g && g.attributes && g.attributes.position;
      if ((o.isMesh || o.isPoints || o.isLine) && pos && pos.count > 0) {
        meshCount++;
        if (o.isMesh) triangleCount += Math.floor((g.index ? g.index.count : pos.count) / 3);
      }
    });
    const res = collectResources(obj);
    return { meshCount, triangleCount, materialCount: res.materials.size, textureCount: res.textures.size };
  }

  function applyFit(direction) {
    const f = computeFit({ center: bounds.center, radius: bounds.radius, fovDeg: camera.fov, aspect: camera.aspect, direction });
    camera.position.set(...f.position);
    camera.near = f.near;
    camera.far = f.far;
    camera.updateProjectionMatrix();
    if (controls) {
      if (controls.target && typeof controls.target.set === "function") controls.target.set(...f.target);
      controls.minDistance = f.minDistance;
      controls.maxDistance = f.maxDistance;
      if (typeof controls.update === "function") controls.update();
    } else if (typeof camera.lookAt === "function") {
      camera.lookAt(...f.target);
    }
    const key = lights[1];
    if (key) key.position.set(bounds.center[0] + bounds.radius * 3, bounds.center[1] + bounds.radius * 5, bounds.center[2] + bounds.radius * 4);
    requestRender();
    return f;
  }

  const superseded = () => ({ ok: false, superseded: true, state: snapshot() });

  async function load(asset) {
    if (disposed) {
      return { ok: false, error: toErrorRecord(new AssetViewerError("VIEWER_DISPOSED")), state: snapshot() };
    }
    if (fatal) return { ok: false, error: toErrorRecord(fatal), state: snapshot() };

    supersede();
    const id = seq;
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    pending = { id, abort: ctrl ? () => ctrl.abort() : null };
    const stale = () => disposed || id !== seq;
    let parsedRoot = null;

    setState({ status: STATUS.LOADING, loadId: id, phase: "fetching", progress: null, error: null });
    try {
      const desc = normalizeAsset(asset);
      let explicit = null;
      if (desc.format) {
        explicit = registry.get(desc.format);
        if (!explicit) {
          throw new AssetViewerError("UNSUPPORTED_FORMAT", `format "${desc.format}" is not registered (have: ${registry.list().map((a) => a.id).join(", ")})`);
        }
      }
      const ext = extensionOf(desc.filename);
      const hinted = explicit || registry.byMime(desc.mime) || registry.byExtension(ext);
      if (!hinted && ext && KNOWN_UNSUPPORTED_EXTENSIONS.includes(ext)) {
        throw new AssetViewerError("UNSUPPORTED_FORMAT", `".${ext}" files are not supported yet`);
      }

      let bytes;
      if (desc.source === "arrayBuffer") {
        bytes = desc.bytes;
        if (maxBytes && bytes.byteLength > maxBytes) {
          throw new AssetViewerError("FILE_TOO_LARGE", `${bytes.byteLength} bytes > limit ${maxBytes}`);
        }
      } else if (desc.source === "blob") {
        bytes = await readBlob(desc.blob, { maxBytes });
      } else {
        bytes = await fetchBytes(desc.url, {
          fetchImpl,
          signal: ctrl ? ctrl.signal : undefined,
          maxBytes,
          credentials: options.fetchCredentials || "omit",
          onProgress: (p) => {
            if (stale()) return;
            setState({ progress: p });
            emit("progress", { ...p, loadId: id });
          },
        });
      }
      if (stale()) return superseded();

      // Content sniff wins over hints (storage often serves application/octet-stream).
      const head = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 16384));
      const adapter = registry.sniff(head) || hinted;
      if (!adapter) {
        throw new AssetViewerError("UNSUPPORTED_FORMAT", `unrecognised content${desc.mime ? ` (${desc.mime})` : ""}${ext ? ` (.${ext})` : ""}`);
      }
      const missing = (adapter.requires || []).filter((k) => !deps[k]);
      if (missing.length) {
        throw new AssetViewerError("MISSING_DEPENDENCY", `the ${adapter.id} adapter needs deps.${missing.join(", deps.")}`);
      }
      setState({
        phase: "parsing",
        asset: { source: desc.source, format: adapter.id, mime: adapter.mime, filename: downloadFilename(desc.filename, adapter), byteLength: bytes.byteLength },
      });

      let parsed;
      try {
        const resourcePath = desc.url && !desc.url.startsWith("data:") && !desc.url.startsWith("blob:") ? desc.url.split(/[?#]/)[0].replace(/[^/]*$/, "") : "";
        parsed = await withTimeout(adapter.load(bytes, { three, deps, resourcePath }), parseTimeoutMs);
      } catch (e) {
        if (stale()) return superseded();
        throw e instanceof AssetViewerError ? e : new AssetViewerError("PARSE_FAILED", e && e.message ? e.message : String(e));
      }
      parsedRoot = (parsed && parsed.root) || null;
      if (stale()) {
        disposeObject3D(parsedRoot);
        return superseded();
      }
      if (!parsedRoot || typeof parsedRoot.traverse !== "function") {
        throw new AssetViewerError("EMPTY_SCENE", "adapter returned no scene");
      }
      const stats = inspect(parsedRoot);
      if (stats.meshCount === 0) throw new AssetViewerError("EMPTY_SCENE", "scene contains no renderable geometry");
      parsedRoot.updateMatrixWorld(true);
      const box = new three.Box3().setFromObject(parsedRoot);
      const size = box.getSize(new three.Vector3());
      const sphere = box.getBoundingSphere(new three.Sphere());
      if (box.isEmpty() || !Number.isFinite(sphere.radius) || !(sphere.radius > 0)) {
        throw new AssetViewerError("EMPTY_SCENE", "scene bounds are empty or degenerate");
      }
      const color = enforceColorTexturesSRGB(three, parsedRoot);

      // Swap: the previous model's GPU resources are released here.
      removeModel();
      model = parsedRoot;
      parsedRoot = null;
      scene.add(model);
      bounds = { center: sphere.center.toArray(), radius: sphere.radius, size: { x: size.x, y: size.y, z: size.z } };
      current = { adapter, bytes, desc };
      pending = null;
      applyFit(DEFAULT_VIEW_DIRECTION);

      setState({
        status: STATUS.READY,
        phase: null,
        progress: state.progress ? { ...state.progress, ratio: 1 } : null,
        model: {
          ...stats,
          ...color,
          animations: parsed.info && parsed.info.animations ? parsed.info.animations : 0,
          warnings: stats.textureCount === 0 && parsed.info && parsed.info.declaredTextures > 0 ? ["TEXTURES_NOT_LOADED"] : [],
          proportions: relativeProportions(size),
          scale: describeScale({ hasScaleMetadata: desc.hasScaleMetadata }),
        },
      });
      emit("ready", snapshot());
      return { ok: true, state: snapshot() };
    } catch (err) {
      if (parsedRoot) disposeObject3D(parsedRoot);
      if (stale() || isAbortError(err)) return superseded();
      pending = null;
      const rec = toErrorRecord(err);
      removeModel(); // never leave a stale model on screen under an error
      requestRender();
      setState({ status: STATUS.ERROR, phase: null, progress: null, model: null, error: rec });
      reportError(rec);
      return { ok: false, error: rec, state: snapshot() };
    }
  }

  function clear() {
    if (disposed) return;
    supersede();
    removeModel();
    requestRender();
    if (fatal) return;
    setState({ status: STATUS.IDLE, loadId: seq, phase: null, progress: null, asset: null, model: null, error: null });
  }

  function fitToView() {
    if (disposed || !model || !bounds) return null;
    const dir = [
      camera.position.x - (controls && controls.target ? controls.target.x : bounds.center[0]),
      camera.position.y - (controls && controls.target ? controls.target.y : bounds.center[1]),
      camera.position.z - (controls && controls.target ? controls.target.z : bounds.center[2]),
    ];
    return applyFit(dir);
  }

  function on(event, cb) {
    if (!listeners.has(event)) throw new TypeError(`unknown asset viewer event "${event}" (have: ${EVENTS.join(", ")})`);
    if (typeof cb !== "function") throw new TypeError("listener must be a function");
    listeners.get(event).add(cb);
    return () => listeners.get(event).delete(cb);
  }

  /**
   * Hands back the ORIGINAL bytes (no re-export/conversion) with a filename
   * and mime matching the detected format. `{ save: true }` additionally
   * triggers a browser download via a temporary object URL.
   */
  function download({ save = false } = {}) {
    if (disposed || state.status !== STATUS.READY || !current) return null;
    const { adapter, bytes, desc } = current;
    const payload = {
      format: adapter.id,
      mime: adapter.mime,
      filename: downloadFilename(desc.filename, adapter),
      byteLength: bytes.byteLength,
      bytes: bytes.slice(0),
      url: desc.url,
      blob: typeof Blob === "function" ? new Blob([bytes], { type: adapter.mime }) : null,
    };
    if (save && payload.blob && win.URL && typeof win.URL.createObjectURL === "function") {
      const href = win.URL.createObjectURL(payload.blob);
      const a = doc.createElement("a");
      a.href = href;
      a.download = payload.filename;
      a.rel = "noopener";
      a.style.display = "none";
      root.appendChild(a);
      a.click();
      root.removeChild(a);
      setTimeout(() => win.URL.revokeObjectURL(href), 0);
    }
    return payload;
  }

  function dispose() {
    if (disposed) return;
    supersede();
    removeModel();
    disposed = true;
    if (rafId != null && caf) caf(rafId);
    rafId = null;
    if (resizeObserver) resizeObserver.disconnect();
    if (resizeListener && typeof win.removeEventListener === "function") win.removeEventListener("resize", resizeListener);
    resizeObserver = null;
    resizeListener = null;
    if (controls) {
      if (controlsListener && typeof controls.removeEventListener === "function") controls.removeEventListener("change", controlsListener);
      if (typeof controls.dispose === "function") controls.dispose();
      controls = null;
    }
    for (const l of lights) {
      if (l.parent) l.parent.remove(l);
      if (typeof l.dispose === "function") l.dispose();
    }
    lights = [];
    if (envTarget) {
      envTarget.dispose();
      envTarget = null;
    }
    if (scene) {
      scene.environment = null;
      scene.background = null;
    }
    if (renderer) {
      if (typeof renderer.dispose === "function") renderer.dispose();
      if (typeof renderer.forceContextLoss === "function") {
        try {
          renderer.forceContextLoss();
        } catch {
          /* context already gone */
        }
      }
      const canvas = renderer.domElement;
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      renderer = null;
    }
    if (overlay) overlay.dispose();
    if (root.parentNode) root.parentNode.removeChild(root);
    state = { ...state, status: STATUS.DISPOSED, phase: null, progress: null, model: null, loadId: seq };
    emit("statechange", snapshot());
    emit("dispose", snapshot());
    listeners.forEach((set) => set.clear());
  }

  const handle = {
    load,
    clear,
    fitToView,
    getState: snapshot,
    on,
    download,
    dispose,
    /** Test/diagnostic hook: live renderer + scene graph handles. Not part of the contract. */
    _debug: () => ({ renderer, scene, camera, controls, model, envTarget }),
  };

  if (fatal) {
    const rec = toErrorRecord(fatal);
    setState({ status: STATUS.ERROR, error: rec });
    const fire = () => !disposed && reportError(rec);
    if (typeof queueMicrotask === "function") queueMicrotask(fire);
    else Promise.resolve().then(fire);
  } else {
    if (overlay) overlay.update(state);
    if (options.asset) load(options.asset);
  }
  return handle;
}

export { ERROR_CODE };
