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
 * /api/creative (PROPOSED contract, AI visual concepts): pass
 * `creativeSource: createCreativeAssetSource({ fetchImpl, getAuthToken })`, then
 *   await viewer.load({ jobId, index: 0, format: "glb" });  // resolve -> load
 *   await viewer.load({ job });                             // job object from ?resource=jobs
 *   await viewer.watchJob(jobId);                           // poll 3-5 s until terminal
 *   await viewer.download({ save: true });                  // re-resolves a FRESH url first
 *   await viewer.download({ jobId, index: 1, save: true });  // any item, not just the one on screen
 * The resolved url is never kept in state, in `current`, or in storage.
 * Retries happen only when the user starts them: `autoRetry` (mount option,
 * per call load(ref, { autoRetry }) / download({ ..., autoRetry })) defaults
 * to FALSE, so a failure is shown at once with a focusable Try again, whose
 * click re-runs the load with a fresh resolve. autoRetry:true restores v2.1:
 * a retryable resolve failure (network, 5xx, 429) is re-resolved ONCE (429
 * after `rateLimitRetryDelayMs`, default 1000) and a display failure gets one
 * fresh resolve + retry, on load and download alike.
 * `renderConceptNotice: false` hides the overlay's concept notice for a host
 * that renders it itself; getState().concept.notice still carries the text
 * and the host must then ALWAYS show it.
 *
 * This file must NEVER import "three": the static Studio page already has
 * window.THREE (r128) and a second copy would break instanceof checks and
 * double the payload. Everything three-related arrives through options.
 *
 * State machine:  idle -> loading(fetching -> parsing) -> ready | error
 *   creative:     idle -> loading(job-checking | job-submitting | job-processing
 *                   -> resolving [-> retrying(resolve)] -> fetching -> parsing
 *                   [-> retrying -> fetching -> parsing])
 *                   -> ready | download-only | error
 *                 any  -> idle (clear)      any -> disposed (dispose)
 * v3 (contract rev 2 + brief criteria 1-6):
 *   viewer.orbit(dAzimuthRad, dPolarRad) / zoom(factor) / resetView() / fitToView()
 *     (also on-screen controls and canvas keys: arrows, + / -, 0, F);
 *     a container resize (incl. phone orientation change) re-fits, keeping the view direction and zoom ratio.
 *   viewer.retry()   re-runs the last load/showJob/watchJob (offered only for transient failures).
 *   The viewer never POSTs, never resubmits and never sets acknowledgeUnknownCharge: after a
 *     409 PRIOR_SUBMISSION_UNKNOWN the host may showJob()/watchJob() error.relatedJobId, which
 *     renders SUBMISSION_UNKNOWN ("may have been charged; not retried automatically").
 *   No WebGL (no context, context creation throws) or context lost: an honest message; the file is
 *     still fetched and validated, and Download is offered only if it is a valid, supported asset.
 *   autoRetry:true only: a 429 resolve failure is retried once after `rateLimitRetryDelayMs` (default 1000).
 *   `asset.demonstration: true | "label"` (or a GLB that labels itself synthetic) shows a
 *     demonstration-asset label.
 *   Navigation / unmount: the host calls dispose() (idempotent). Safety nets: `signal`
 *     (AbortSignal: aborting it disposes), `disposeOnPageHide` (default true: window
 *     "pagehide" disposes), and the frame loop stops while the viewer's root is not
 *     connected to the document (isConnected checked once per frame; resumes on re-attach).
 *   viewer.getView() -> { distance, fitDistance, zoomRatio, azimuth, polar } | null (JSON-safe).
 * A newer load()/clear()/dispose() supersedes an in-flight load: its fetch
 * is aborted and, if parsing already produced a scene, that scene is
 * disposed and never shown. Superseded loads resolve { ok:false, superseded:true }
 * and never trigger onError.
 */
import { AssetViewerError, ERROR_CODE, INVALID_FILE_MESSAGE, isViewerError, toErrorRecord } from "./errors.js";
import { invalidFileReason } from "./validate.js";
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
import { createOverlay, DEMO_ASSET_LABEL } from "./overlay.js";
import { SCENE, token } from "./tokens.js";
import {
  creativeFilename,
  isRetryableResolveError,
  isViewableFormat,
  MIME_BY_FORMAT,
  normalizeBilling,
  normalizeConcept,
  normalizeCreativeFormat,
  RATE_LIMIT_RETRY_DELAY_MS,
  redactUrls,
  retryDelayForResolveError,
  safeJobMessage,
} from "./creativeAsset.js";

export const STATUS = /* @__PURE__ */ Object.freeze({
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
  DISPOSED: "disposed",
  /** A concept whose format the viewer does not display (fbx/obj/usdz/stl/ply/zip/null): download offered. */
  DOWNLOAD_ONLY: "download-only",
});

export const EVENTS = /* @__PURE__ */ Object.freeze(["statechange", "progress", "ready", "error", "dispose"]);

/** Extensions we know about but deliberately do not load yet (fail before fetching). */
export const KNOWN_UNSUPPORTED_EXTENSIONS = /* @__PURE__ */ Object.freeze([
  "obj", "fbx", "usdz", "usd", "usda", "usdc", "stl", "3mf", "ply", "dae", "blend", "step", "stp", "3ds", "max",
]);

const DEP_KEYS = ["GLTFLoader", "OrbitControls", "RoomEnvironment"];

/** Display failures after a successful resolve that justify ONE fresh resolve + retry (expired url, CORS, truncated body). */
const RETRYABLE_DISPLAY_CODES = new Set(["FETCH_FAILED", "PARSE_FAILED", "UNSUPPORTED_FORMAT"]);

/** Malformed content: retrying the same bytes cannot help and the file is not offered for download. */
const MALFORMED_CODES = new Set(["PARSE_FAILED", "EMPTY_SCENE", "UNSUPPORTED_FORMAT"]);

const NO_CREATIVE = /* @__PURE__ */ Object.freeze({ concept: null, job: null, actions: null, attempts: null });

/** Canvas keys -> view actions (only while a model is shown). */
const KEYS = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", "+": "in", "=": "in", "-": "out", 0: "reset", f: "fit" };
const STEP = Math.PI / 12; // 15 degrees per click / key press
/** action -> [azimuth steps, polar steps, distance factor] */
const ACTIONS = { left: [-1, 0, 1], right: [1, 0, 1], up: [0, -1, 1], down: [0, 1, 1], in: [0, 0, 0.8], out: [0, 0, 1.25] };

/** A failure a user-initiated retry can plausibly fix (transport, 5xx, 429, CORS, a lost context). */
function canRetryError(rec) {
  const { code, status } = rec;
  if (code === "WEBGL_CONTEXT_LOST" || code === "ASSET_DISPLAY_FAILED") return true;
  if (code === "FETCH_FAILED") return !status || status === 408 || status === 429 || status >= 500;
  return isRetryableResolveError(rec);
}

/** What a host may offer for a concept. Builder/export/production are never allowed (contract §1 UI rule). */
function creativeActions({ view = false, download = false } = {}) {
  return { view, download, openInBuilder: false, export: false, production: false };
}

/** `{ jobId, index?, format? }` without url/arrayBuffer/blob = an /api/creative job-output reference. */
function isJobOutputRef(a) {
  return Boolean(a && typeof a === "object" && typeof a.jobId === "string" && a.url === undefined && a.arrayBuffer == null && a.blob == null);
}

/**
 * Creates the WebGL context ITSELF before handing it to three, so a browser
 * without WebGL gets a clean WEBGL_UNAVAILABLE (and no console error from
 * three's constructor). r163+ needs WebGL 2; older revisions may fall back
 * to WebGL 1. `webglReason`: "no-context" | "renderer-threw" (getContext or the WebGLRenderer constructor threw).
 */
export function defaultCreateRenderer(three, doc) {
  const canvas = doc.createElement("canvas");
  const attrs = { alpha: true, antialias: true, powerPreference: "high-performance" };
  // three r163+ is WebGL2-only; older builds (the r128 path) can fall back to WebGL1.
  const context = canvas.getContext("webgl2", attrs) || (threeRevision(three) < 163 ? canvas.getContext("webgl", attrs) : null);
  if (!context) throw new AssetViewerError("WEBGL_UNAVAILABLE", "no WebGL context", { webglReason: "no-context" });
  return new three.WebGLRenderer({ ...attrs, canvas, context }); // a throw here (or in getContext) -> "renderer-threw"
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
  const creative = options.creativeSource || null;
  const setTimer = options.setTimeout || ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.clearTimeout || ((t) => clearTimeout(t));
  // A host that renders concept.notice itself turns the overlay's copy off; state still carries the text.
  const renderConceptNotice = options.renderConceptNotice !== false;
  const rateLimitDelay = options.rateLimitRetryDelayMs === undefined ? RATE_LIMIT_RETRY_DELAY_MS : options.rateLimitRetryDelayMs;
  // Retries happen only when the USER starts them (Try again) unless the host opts in.
  const autoFor = (o) => (o && typeof o.autoRetry === "boolean" ? o.autoRetry : options.autoRetry === true);

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
    source: null, // "local" | "creative"
    canRetry: false,
    demo: null, // { label, source: "host" | "file" } when the asset is a demonstration / synthetic fixture
    webgl: { available: true, reason: null },
    ...NO_CREATIVE,
  };
  let seq = 0;
  let pending = null; // { id, abort }
  let disposed = false;
  let fatal = null; // no usable three: nothing can be done
  let webglError = null; // no WebGL: files are still fetched + validated, Download offered when valid
  let contextLost = false;
  let lastRequest = null; // () => Promise, for retry()
  let lastFit = null;
  let detachSafetyNets = null; // removes the signal / pagehide hooks

  let renderer = null;
  let scene = null;
  let camera = null;
  let controls = null;
  let lights = [];
  let envTarget = null;
  let model = null; // currently displayed Object3D
  let bounds = null; // { center:[x,y,z], radius, size:{x,y,z} }
  // Displayed item, for download(): local -> { kind:"local", adapter, bytes, desc };
  // creative -> { kind:"creative", jobId, index, format, mimeType, filename, concept } (NO url, NO bytes).
  let current = null;
  let rafId = null;
  let resizeObserver = null;
  let domListeners = []; // [target, type, fn]: canvas / window / controls, removed together

  // ---- DOM root (we never restyle the host element) ----
  const root = doc.createElement("div");
  root.setAttribute("data-asset-viewer", "");
  root.setAttribute("role", "region");
  root.setAttribute("aria-label", "3D model preview");
  root.style.cssText = `position:relative;width:100%;height:100%;min-height:${token("viewer-min-height")};overflow:hidden;`;
  el.appendChild(root);
  const overlay =
    options.ui === false
      ? null
      : createOverlay(doc, root, {
          renderConceptNotice,
          // true/"auto" (default): only where the model can't be shown but the file is valid
          // (download-only, no WebGL, context lost). "always": also while a model is shown.
          downloadButton: options.downloadButton === false ? false : options.downloadButton === "always" ? "always" : "auto",
          onDownload: () => {
            const p = download({ save: true });
            if (p && typeof p.then === "function") p.catch(() => {});
            return p;
          },
          onRetry: () => {
            const p = retry();
            if (p && typeof p.then === "function") p.catch(() => {});
          },
          onControl: (a) => control(a),
        });

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
    if (state.status !== STATUS.ERROR) state.canRetry = false;
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
      renderer = (options.createRenderer || defaultCreateRenderer)(three, doc);
      if (!renderer) throw new Error("createRenderer returned nothing");
    } catch (e) {
      webglError = isViewerError(e) ? e : new AssetViewerError("WEBGL_UNAVAILABLE", e && e.message ? e.message : String(e), { webglReason: "renderer-threw" });
    }
  }
  if (!fatal && !webglError) {
    try {
      setupScene();
    } catch (e) {
      webglError = new AssetViewerError("WEBGL_UNAVAILABLE", `scene setup failed: ${e && e.message ? e.message : e}`, { webglReason: "renderer-threw" });
      releaseGpu();
    }
  }
  if (webglError) state.webgl = { available: false, reason: webglError.webglReason };

  function listen(target, type, fn) {
    if (typeof target.addEventListener !== "function") return;
    target.addEventListener(type, fn);
    domListeners.push([target, type, fn]);
  }

  function setupScene() {
    scene = new three.Scene();
    camera = new three.PerspectiveCamera(fov, 1, 0.01, 100);
    camera.position.set(...DEFAULT_VIEW_DIRECTION);
    configureRendererOutput(three, renderer);
    if (typeof renderer.setPixelRatio === "function") renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, 2));
    const canvas = renderer.domElement;
    if (canvas) {
      if (canvas.style) canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none;";
      root.insertBefore ? root.insertBefore(canvas, root.firstChild || null) : root.appendChild(canvas);
      canvas.setAttribute("tabindex", "0");
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", "Interactive 3D preview");
      if (overlay) canvas.setAttribute("aria-describedby", overlay.helpId);
      listen(canvas, "keydown", (e) => {
        const a = KEYS[e.key];
        if (!a || e.altKey || e.ctrlKey || e.metaKey || state.status !== STATUS.READY) return;
        e.preventDefault();
        control(a);
      });
      // three's own handler preventDefault()s, so the browser may restore the context later.
      listen(canvas, "webglcontextlost", onContextLost);
      listen(canvas, "webglcontextrestored", onContextRestored);
    }

    if (options.background !== null) {
      scene.background = new three.Color(options.background === undefined ? SCENE.background : options.background);
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
    const hemi = new three.HemisphereLight(SCENE.sky, SCENE.ground, 0.65 * k * envDim);
    const key = new three.DirectionalLight(SCENE.key, 0.9 * k * envDim);
    key.position.set(3, 5, 4);
    lights = [hemi, key];
    lights.forEach((l) => scene.add(l));

    if (deps.OrbitControls) {
      controls = new deps.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.screenSpacePanning = true;
      listen(controls, "change", () => requestRender());
    }

    resize();
    if (typeof win.ResizeObserver === "function") {
      resizeObserver = new win.ResizeObserver(() => resize());
      resizeObserver.observe(root);
    } else listen(win, "resize", resize); // either one also fires on a phone orientation change

    state.capabilities = {
      threeRevision: threeRevision(three),
      colorManagement: colorManagementMode(three),
      controls: Boolean(controls),
      environment: envKind,
      formats: registry.list().map((a) => a.id),
    };
  }

  /** Container resized / orientation changed: new aspect, then re-fit keeping the view direction and zoom ratio. */
  function resize() {
    if (!renderer || disposed) return;
    const w = root.clientWidth || el.clientWidth || 300;
    const h = root.clientHeight || el.clientHeight || 150;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (model && bounds && lastFit) {
      const off = camera.position.clone().sub(target());
      applyFit(off.toArray(), off.length() / lastFit.distance);
    }
    requestRender();
  }

  function target() {
    return controls && controls.target ? controls.target : new three.Vector3(...bounds.center);
  }

  /**
   * Orbit by azimuth / polar angle (radians) and dolly by `factor` (< 1 in, > 1 out) around the
   * model centre. Distance is clamped to the fit's limits (never inside the model).
   */
  function move(dTheta, dPhi, factor) {
    if (disposed || !model || !bounds || !camera) return null;
    const t = target();
    const off = camera.position.clone().sub(t);
    const sph = new three.Spherical().setFromVector3(off);
    sph.theta += dTheta;
    sph.phi = Math.min(Math.PI - 0.05, Math.max(0.05, sph.phi + dPhi));
    sph.radius = Math.min(lastFit.maxDistance, Math.max(lastFit.minDistance, sph.radius * factor));
    camera.position.copy(t).add(off.setFromSpherical(sph));
    controls ? controls.update() : camera.lookAt(t);
    requestRender();
    return { distance: sph.radius };
  }
  const orbit = (dTheta = 0, dPhi = 0) => move(dTheta, dPhi, 1);
  const zoom = (factor) => (factor > 0 ? move(0, 0, factor) : null);

  function resetView() {
    if (disposed || !model || !bounds) return null;
    return applyFit(DEFAULT_VIEW_DIRECTION);
  }

  function control(action) {
    if (state.status !== STATUS.READY) return null;
    if (action === "reset") return resetView();
    if (action === "fit") return fitToView();
    const v = Object.hasOwn(ACTIONS, action) && ACTIONS[action];
    return v ? move(v[0] * STEP, v[1] * STEP, v[2]) : null;
  }

  /**
   * Context lost (GPU reset, too many contexts): the shown model's GPU
   * resources are released, the ORIGINAL item stays downloadable, and Retry
   * re-runs the load (it shows the model again once the browser restores the
   * context; three's own handler preventDefault()s so a restore can happen).
   */
  function onContextLost() {
    if (disposed || contextLost) return;
    contextLost = true;
    state.webgl = { available: false, reason: "context-lost" };
    if (rafId != null && caf) caf(rafId);
    rafId = null;
    // A load in flight ends in present()'s honest error instead.
    if (state.status === STATUS.READY) failNoGpu(current);
  }

  function onContextRestored() {
    contextLost = false;
    state.webgl = { available: true, reason: null };
  }

  /** Removed from the document (host navigated without dispose): stop drawing; ResizeObserver resumes on re-attach. */
  function crossOrigin(u) {
    try {
      return Boolean(win.location) && new URL(u, win.location.href).origin !== win.location.origin;
    } catch {
      return false;
    }
  }

  function detached() {
    return root.isConnected === false;
  }

  function renderFrame() {
    rafId = null;
    if (disposed || !renderer || contextLost || detached()) return;
    if (controls && typeof controls.update === "function") controls.update();
    renderer.render(scene, camera);
  }

  function requestRender() {
    if (disposed || !renderer || contextLost || detached()) return;
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
    lastFit = null;
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

  /** `ratio` keeps a user's zoom (current distance / fit distance) across a re-fit; 1 = fit exactly. */
  function applyFit(direction, ratio = 1) {
    const f = computeFit({ center: bounds.center, radius: bounds.radius, fovDeg: camera.fov, aspect: camera.aspect, direction });
    const k = Math.min(f.maxDistance, Math.max(f.minDistance, f.distance * (ratio > 0 && Number.isFinite(ratio) ? ratio : 1))) / f.distance;
    const c = bounds.center;
    camera.position.set(...f.position.map((p, i) => c[i] + (p - c[i]) * k));
    lastFit = f;
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

  // ---- run bookkeeping: one "run" per load()/showJob()/watchJob() ----
  function beginRun() {
    supersede();
    const id = seq;
    const ctrls = [];
    const sleepers = new Map(); // timer handle -> wake()
    const run = {
      id,
      stale: () => disposed || id !== seq,
      signal() {
        const c = typeof AbortController === "function" ? new AbortController() : null;
        if (c) ctrls.push(c);
        return c ? c.signal : undefined;
      },
      sleep(ms) {
        return new Promise((wake) => {
          const t = setTimer(() => {
            sleepers.delete(t);
            wake();
          }, ms);
          sleepers.set(t, wake);
        });
      },
    };
    pending = {
      id,
      abort() {
        ctrls.forEach((c) => c.abort());
        sleepers.forEach((wake, t) => {
          clearTimer(t);
          wake();
        });
        sleepers.clear();
      },
    };
    return run;
  }

  /**
   * Fetch/read + sniff + parse + validate, WITHOUT touching the displayed
   * model. Returns null when superseded; throws AssetViewerError otherwise.
   */
  async function prepareMesh(asset, run, labels = {}) {
    let parsedRoot = null;
    try {
      const desc = normalizeAsset(asset);
      let explicit = null;
      if (desc.format) {
        explicit = registry.get(desc.format);
        if (!explicit) {
          throw new AssetViewerError("UNSUPPORTED_FORMAT", `format "${desc.format}" is not registered`);
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
          signal: run.signal(),
          maxBytes,
          credentials: options.fetchCredentials || "omit",
          // A browser reports a CORS refusal exactly like a dropped connection: on a
          // cross-origin link say both (BUG-002) instead of only "check your connection".
          isOffline: () => (win.navigator && win.navigator.onLine === false) || (crossOrigin(desc.url) && "cross-origin"),
          onProgress: (p) => {
            if (run.stale()) return;
            setState({ progress: p });
            emit("progress", { ...p, loadId: run.id });
          },
        });
      }
      if (run.stale()) return null;

      // Content sniff wins over hints (storage often serves application/octet-stream).
      const head = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 16384));
      const adapter = registry.sniff(head) || hinted;
      if (!adapter) {
        throw new AssetViewerError("UNSUPPORTED_FORMAT", `unrecognised content${desc.mime ? ` (${desc.mime})` : ""}${ext ? ` (.${ext})` : ""}`);
      }
      const missing = (adapter.requires || []).filter((k) => !deps[k]);
      if (missing.length) {
        throw new AssetViewerError("MISSING_DEPENDENCY", `needs deps.${missing.join(", deps.")}`);
      }
      setState({
        phase: "parsing",
        asset: {
          source: labels.source || desc.source,
          format: adapter.id,
          mime: adapter.mime,
          filename: labels.filename || downloadFilename(desc.filename, adapter),
          byteLength: bytes.byteLength,
        },
      });

      let parsed;
      try {
        const resourcePath = desc.url && !desc.url.startsWith("data:") && !desc.url.startsWith("blob:") ? desc.url.split(/[?#]/)[0].replace(/[^/]*$/, "") : "";
        parsed = await withTimeout(adapter.load(bytes, { three, deps, resourcePath }), parseTimeoutMs);
      } catch (e) {
        if (run.stale()) return null;
        if (isViewerError(e) && e.code !== "PARSE_FAILED") throw e;
        // v3: say why (web page instead of a model, wrong magic, cut off) when the bytes show it.
        const reason = invalidFileReason(bytes, adapter.id);
        throw new AssetViewerError("PARSE_FAILED", e && (e.detail || e.message) ? e.detail || e.message : String(e), reason ? { reason, message: INVALID_FILE_MESSAGE[reason] } : {});
      }
      parsedRoot = (parsed && parsed.root) || null;
      if (run.stale()) {
        disposeObject3D(parsedRoot);
        return null;
      }
      if (!parsedRoot || typeof parsedRoot.traverse !== "function") {
        throw new AssetViewerError("EMPTY_SCENE", "adapter returned no scene");
      }
      const stats = inspect(parsedRoot);
      if (stats.meshCount === 0) throw new AssetViewerError("EMPTY_SCENE", "scene contains no renderable geometry", { reason: "no-mesh" });
      parsedRoot.updateMatrixWorld(true);
      const box = new three.Box3().setFromObject(parsedRoot);
      const size = box.getSize(new three.Vector3());
      const sphere = box.getBoundingSphere(new three.Sphere());
      if (box.isEmpty() || !Number.isFinite(sphere.radius) || !(sphere.radius > 0)) {
        throw new AssetViewerError("EMPTY_SCENE", "scene bounds are empty or degenerate");
      }
      const color = enforceColorTexturesSRGB(three, parsedRoot);
      if (parsed && parsed.info && parsed.info.synthetic && !state.demo && !run.stale()) setState({ demo: { label: DEMO_ASSET_LABEL, source: "file" } });
      const out = { root: parsedRoot, stats, color, size, sphere, info: (parsed && parsed.info) || {}, adapter, bytes, desc };
      parsedRoot = null;
      return out;
    } catch (err) {
      if (parsedRoot) disposeObject3D(parsedRoot);
      if (run.stale() || isAbortError(err)) return null;
      throw err;
    }
  }

  /** Swap the prepared scene in (the previous model's GPU resources are released here). */
  /** Valid, parsed asset: show it, or (no WebGL / context lost) say so honestly and keep it downloadable. */
  function present(prep, info, extraState = {}) {
    if (renderer && !contextLost) return commitMesh(prep, info, extraState);
    disposeObject3D(prep.root);
    return failNoGpu(info, extraState);
  }

  /** No usable GPU (never had WebGL, or the context was lost): honest error, download stays offered. */
  function failNoGpu(info, extraState) {
    const w = webglError || { code: "WEBGL_CONTEXT_LOST", detail: "webglcontextlost", webglReason: "context-lost" };
    const e = new AssetViewerError(w.code, w.detail, { webglReason: w.webglReason, downloadAvailable: true });
    return fail(e, { ...extraState, actions: creativeActions({ download: true }) }, { keep: info });
  }

  function commitMesh(prep, currentInfo, extraState = {}) {
    removeModel();
    model = prep.root;
    scene.add(model);
    const { size, sphere } = prep;
    bounds = { center: sphere.center.toArray(), radius: sphere.radius, size: { x: size.x, y: size.y, z: size.z } };
    current = currentInfo;
    pending = null;
    applyFit(DEFAULT_VIEW_DIRECTION);
    setState({
      status: STATUS.READY,
      phase: null,
      progress: state.progress ? { ...state.progress, ratio: 1 } : null,
      error: null,
      ...extraState,
      model: {
        ...prep.stats,
        ...prep.color,
        animations: prep.info.animations ? prep.info.animations : 0,
        // GLTFLoader drops a missing / undecodable image and still resolves: say so (overlay note), never crash.
        textures: { declared: prep.info.declaredTextures || 0, loaded: prep.stats.textureCount },
        warnings: prep.stats.textureCount < (prep.info.declaredTextures || 0) ? ["TEXTURES_NOT_LOADED"] : [],
        proportions: relativeProportions(size),
        // Always relative: a concept's dimensionsVerified flag is never used to claim real size.
        scale: describeScale({ hasScaleMetadata: Boolean(prep.desc && prep.desc.hasScaleMetadata) }),
      },
    });
    emit("ready", snapshot());
    return { ok: true, state: snapshot() };
  }

  function fail(err, extraState = {}, { keep = null, redact = false } = {}) {
    pending = null;
    const rec = toErrorRecord(err);
    if (redact) rec.detail = redactUrls(rec.detail);
    removeModel(); // never leave a stale model on screen under an error
    if (keep) current = keep; // item that can still be downloaded
    requestRender();
    setState({ status: STATUS.ERROR, phase: null, progress: null, model: null, error: rec, canRetry: Boolean(lastRequest) && canRetryError(rec), ...extraState });
    reportError(rec);
    return { ok: false, error: rec, state: snapshot() };
  }

  /** A run starts: forget the demonstration label of the previous asset; set the host's own label if given. */
  function demoFor(a) {
    const d = a && typeof a === "object" ? a.demonstration : null;
    return d ? { label: typeof d === "string" && d.trim() ? d : DEMO_ASSET_LABEL, source: "host" } : null;
  }

  function guard() {
    if (disposed) return { ok: false, error: toErrorRecord(new AssetViewerError("VIEWER_DISPOSED")), state: snapshot() };
    if (fatal) return { ok: false, error: toErrorRecord(fatal), state: snapshot() };
    return null;
  }

  /**
   * load(descriptor)            local/fixture path: { url | arrayBuffer | blob, ... }
   * load({ jobId, index, format? })  /api/creative job-output reference (needs options.creativeSource)
   * load({ job, index? })       a job object from GET ?resource=jobs&jobId=
   */
  async function load(asset, opts) {
    const blocked = guard();
    if (blocked) return blocked;
    if (asset && typeof asset === "object" && asset.job && typeof asset.job === "object") return showJob(asset.job, { index: asset.index, autoRetry: autoFor(opts) });
    lastRequest = () => load(asset, opts);
    if (isJobOutputRef(asset)) return loadCreativeRef(asset, autoFor(opts));

    const run = beginRun();
    const concept = asset && typeof asset === "object" && asset.concept ? normalizeConcept(asset.concept) : null;
    setState({ status: STATUS.LOADING, loadId: run.id, phase: "fetching", progress: null, error: null, source: "local", demo: demoFor(asset), ...NO_CREATIVE, concept });
    try {
      const prep = await prepareMesh(asset, run);
      if (!prep) return superseded();
      return present(prep, { kind: "local", adapter: prep.adapter, bytes: prep.bytes, desc: prep.desc });
    } catch (err) {
      if (run.stale() || isAbortError(err)) return superseded();
      return fail(err);
    }
  }

  // ---- /api/creative (AI visual concept) paths ----
  function creativeInfo(jobId, index, format, mimeType, concept) {
    return { kind: "creative", jobId, index, format, mimeType: mimeType || null, filename: creativeFilename(jobId, index, format), concept };
  }

  function enterDownloadOnly(info, extraState) {
    pending = null;
    removeModel();
    current = info;
    requestRender();
    setState({
      status: STATUS.DOWNLOAD_ONLY,
      phase: null,
      progress: null,
      model: null,
      error: null,
      ...extraState,
      asset: { source: "creative", format: info.format, mime: info.mimeType || MIME_BY_FORMAT[info.format] || "application/octet-stream", filename: info.filename, byteLength: null },
      concept: info.concept,
      actions: creativeActions({ download: true }),
    });
    return { ok: true, downloadOnly: true, state: snapshot() };
  }

  function missingSource(run) {
    return fail(new AssetViewerError("MISSING_DEPENDENCY", "options.creativeSource is required"), {
      loadId: run.id,
      source: "creative",
      ...NO_CREATIVE,
      concept: normalizeConcept(null),
    });
  }

  async function loadCreativeRef(ref, auto) {
    const run = beginRun();
    if (!creative || typeof creative.resolve !== "function") return missingSource(run);
    const index = ref.index === undefined || ref.index === null ? 0 : ref.index;
    const jobInfo = { jobId: ref.jobId, index, status: null, outputCount: null };
    state.demo = demoFor(ref);
    return creativeFlow(run, { jobId: ref.jobId, index, format: ref.format, mimeType: ref.mimeType, concept: ref.concept }, jobInfo, auto);
  }

  /**
   * resolve -> (non glb/gltf: download-only) -> load mesh. With auto=false (the
   * default) that is ALL: any failure is shown with Try again where a fresh
   * resolve could help. With auto=true: one more resolve on a retryable resolve
   * failure (429 after a pause), and on a fetch/parse failure re-resolve ONCE
   * and retry ONCE, then ASSET_DISPLAY_FAILED. The two retry
   * budgets are independent: at most 3 resolves and 2 mesh fetches per load.
   * The re-resolve of the display retry is not itself retried. The resolved
   * url lives only in local variables of this function.
   */
  async function creativeFlow(run, ref, jobInfo, auto) {
    const { jobId, index } = ref;
    const attempts = { resolve: 0, display: 0 };
    let concept = normalizeConcept(ref.concept);
    const base = () => ({ loadId: run.id, source: "creative", job: { ...jobInfo }, concept, attempts: { ...attempts } });
    const failC = (err, downloadable, info, extra) => {
      if (downloadable && isViewerError(err)) err.downloadAvailable = true;
      return fail(err, { ...base(), actions: creativeActions({ download: downloadable }), ...extra }, { keep: downloadable ? info : null, redact: true });
    };

    // The job already told us the format: anything but glb/gltf (incl. null = unrecognised)
    // is download-only and needs no address until the user actually downloads.
    if (ref.format !== undefined) {
      const known = normalizeCreativeFormat(ref.format);
      if (!isViewableFormat(known)) return enterDownloadOnly(creativeInfo(jobId, index, known, ref.mimeType, concept), base());
    }

    removeModel();
    requestRender();
    setState({ status: STATUS.LOADING, phase: "resolving", progress: null, error: null, model: null, asset: null, ...base(), actions: creativeActions({}) });

    const resolveFresh = async () => {
      attempts.resolve++;
      const d = await creative.resolve(jobId, index, { signal: run.signal() });
      concept = d.concept;
      return d;
    };
    // V1: a transient resolve failure (network, 5xx, 429) gets exactly ONE more resolve.
    // Never 401/403/404/409/410, ASSET_NOT_READY, integrity, malformed bodies or *_NOT_CONFIGURED.
    const resolveWithRetry = async () => {
      try {
        return await resolveFresh();
      } catch (e) {
        if (!auto || run.stale() || isAbortError(e) || !isRetryableResolveError(e)) throw e;
        setState({ phase: "retrying", progress: null, ...base() });
        const wait = retryDelayForResolveError(e, rateLimitDelay); // 429: short fixed pause first
        if (wait) await run.sleep(wait);
        if (run.stale()) throw e;
        try {
          return await resolveFresh();
        } catch (e2) {
          if (isViewerError(e2)) e2.attempts = { ...attempts };
          throw e2;
        }
      }
    };
    const display = (d) => {
      attempts.display++;
      setState({ phase: "fetching", progress: null, ...base() });
      return prepareMesh({ url: d.url, format: d.format, filename: d.filename }, run, { source: "creative", filename: d.filename });
    };

    let d;
    try {
      d = await resolveWithRetry();
    } catch (e) {
      if (run.stale() || isAbortError(e)) return superseded();
      return failC(e, false);
    }
    if (run.stale()) return superseded();
    if (!isViewableFormat(d.format)) return enterDownloadOnly(creativeInfo(jobId, index, d.format, d.mimeType, concept), base());

    let prep = null;
    let firstErr = null;
    try {
      prep = await display(d);
    } catch (e) {
      if (run.stale() || isAbortError(e)) return superseded();
      firstErr = e;
    }
    let info = creativeInfo(jobId, index, d.format, d.mimeType, concept);
    d = null; // drop the address as soon as it has been used once
    if (firstErr) {
      const dl = !MALFORMED_CODES.has(firstErr.code);
      if (!RETRYABLE_DISPLAY_CODES.has(firstErr.code)) return failC(firstErr, dl, info);
      // No silent retry: Try again (a fresh resolve) may fix an expired/blocked address or a cut-off body.
      if (!auto) return failC(firstErr, dl, info, { canRetry: true });
      setState({ phase: "retrying", progress: null, ...base() });
      let d2;
      try {
        d2 = await resolveFresh();
      } catch (e) {
        if (run.stale() || isAbortError(e)) return superseded();
        return failC(e, false);
      }
      if (run.stale()) return superseded();
      info = creativeInfo(jobId, index, d2.format, d2.mimeType, concept);
      if (!isViewableFormat(d2.format)) return enterDownloadOnly(info, base());
      try {
        prep = await display(d2);
      } catch (e2) {
        if (run.stale() || isAbortError(e2)) return superseded();
        // Malformed twice (bad magic, truncated, HTML, no mesh): not a valid asset, so no Download.
        if (MALFORMED_CODES.has(firstErr.code) && MALFORMED_CODES.has(e2.code)) {
          e2.attempts = { ...attempts };
          return failC(e2, false);
        }
        const why = `first attempt ${firstErr.code}: ${firstErr.detail || ""}; retry after fresh resolve ${e2.code || "PARSE_FAILED"}: ${e2.detail || e2.message || ""}`;
        return failC(new AssetViewerError("ASSET_DISPLAY_FAILED", why, { attempts: { ...attempts } }), true, info);
      }
      d2 = null;
    }
    if (!prep) return superseded();
    return present(prep, info, { ...base(), actions: creativeActions({ view: true, download: true }) });
  }

  /** Render a job object from GET ?resource=jobs&jobId=. Never branches on providerStatus/providerProgress. */
  function showJob(job, { index, autoRetry } = {}) {
    const blocked = guard();
    if (blocked) return Promise.resolve(blocked);
    lastRequest = () => showJob(job, { index, autoRetry });
    const run = beginRun();
    state.demo = null;
    return applyJob(run, job, { index, autoRetry });
  }

  async function applyJob(run, job, { index, autoRetry } = {}) {
    if (!job || typeof job !== "object" || typeof job.jobId !== "string" || !job.jobId) {
      return fail(new AssetViewerError("INVALID_ASSET", "job object needs a jobId"), { loadId: run.id, source: "creative", ...NO_CREATIVE });
    }
    const outputs = Array.isArray(job.outputs) ? job.outputs.filter((o) => o && typeof o === "object") : [];
    const status = typeof job.status === "string" ? job.status : null;
    const concept = normalizeConcept(job.concept);
    // rev 2: billingOutcome (rev 1: derived); one active job per REFERENCE, so the reference is reported too.
    const jobInfo = {
      jobId: job.jobId,
      index: null,
      status,
      outputCount: outputs.length,
      referenceId: typeof job.sourceReferenceId === "string" ? job.sourceReferenceId : null,
      billing: normalizeBilling(job),
    };
    const base = { loadId: run.id, source: "creative", job: jobInfo, concept, attempts: null, actions: creativeActions({}) };
    const errExtra = { serverCode: job.error && typeof job.error.code === "string" ? job.error.code : null, jobStatus: status, billingOutcome: jobInfo.billing.outcome };

    if (status === "submitting" || status === "processing") {
      removeModel();
      requestRender();
      // No percentage: providerProgress has an unverified scale (contract §2.4).
      setState({ status: STATUS.LOADING, phase: `job-${status}`, progress: null, error: null, model: null, asset: null, ...base });
      return { ok: false, pending: true, terminal: false, state: snapshot() };
    }
    if (status === "succeeded") {
      const want = index === undefined || index === null ? null : index;
      const out = want === null ? outputs[0] : outputs.find((o) => o.index === want);
      if (!out) {
        return fail(new AssetViewerError("ASSET_NOT_READY", want === null ? "job succeeded but lists no outputs" : `job has no output index ${want}`, errExtra), base);
      }
      jobInfo.index = Number.isInteger(out.index) && out.index >= 0 ? out.index : want === null ? 0 : want;
      const ref = { jobId: job.jobId, index: jobInfo.index, format: "format" in out ? out.format : undefined, mimeType: out.mimeType, concept: job.concept };
      return creativeFlow(run, ref, jobInfo, autoFor({ autoRetry }));
    }
    if (status === "failed") {
      const msg = safeJobMessage(job.error && job.error.message);
      return fail(new AssetViewerError("GENERATION_FAILED", `job failed: ${errExtra.serverCode || "no error code"}`, { ...errExtra, message: msg || undefined }), base, { redact: true });
    }
    if (status === "submission_unknown") {
      return fail(
        new AssetViewerError("SUBMISSION_UNKNOWN", `job submission_unknown: ${errExtra.serverCode || "no error code"}`, { ...errExtra, chargeMayHaveOccurred: true, autoRetry: false }),
        base,
      );
    }
    return fail(new AssetViewerError("JOB_STATUS_UNKNOWN", `unrecognised job status ${JSON.stringify(status)}`, errExtra), base);
  }

  /**
   * Polls GET ?resource=jobs&jobId= every 3-5 s while the job is
   * submitting/processing, then shows the terminal result. Superseded by any
   * later load/showJob/watchJob/clear/dispose. Never auto-retries a
   * generation; refresh.ok:false only means the status check failed.
   */
  async function watchJob(jobId, { index, intervalMs = 4000, autoRetry } = {}) {
    const blocked = guard();
    if (blocked) return blocked;
    lastRequest = () => watchJob(jobId, { index, intervalMs, autoRetry });
    const run = beginRun();
    state.demo = null;
    if (!creative || typeof creative.getJob !== "function") return missingSource(run);
    const wait = Math.min(5000, Math.max(3000, Number(intervalMs) || 4000));
    removeModel();
    requestRender();
    setState({
      status: STATUS.LOADING,
      loadId: run.id,
      phase: "job-checking",
      progress: null,
      error: null,
      model: null,
      asset: null,
      source: "creative",
      job: { jobId, index: index === undefined ? null : index, status: null, outputCount: null },
      concept: normalizeConcept(null),
      attempts: null,
      actions: creativeActions({}),
    });
    for (;;) {
      let res;
      try {
        res = await creative.getJob(jobId, { signal: run.signal() });
      } catch (e) {
        if (run.stale() || isAbortError(e)) return superseded();
        return fail(e, { source: "creative", concept: state.concept, job: state.job, actions: creativeActions({}) }, { redact: true });
      }
      if (run.stale()) return superseded();
      const job = res && res.job;
      if (job && (job.status === "submitting" || job.status === "processing")) {
        await applyJob(run, job, { index, autoRetry });
        await run.sleep(wait);
        if (run.stale()) return superseded();
        continue;
      }
      return applyJob(run, job, { index, autoRetry });
    }
  }

  function clear() {
    if (disposed) return;
    supersede();
    removeModel();
    lastRequest = null;
    requestRender();
    if (fatal) return;
    setState({ status: STATUS.IDLE, loadId: seq, phase: null, progress: null, asset: null, model: null, error: null, source: null, demo: null, ...NO_CREATIVE });
  }

  function fitToView() {
    if (disposed || !model || !bounds) return null;
    return applyFit(camera.position.clone().sub(target()).toArray());
  }

  /** Camera relative to the fitted view (for hosts, analytics and e2e checks). Angles in radians. */
  function getView() {
    if (disposed || !model || !bounds || !camera || !lastFit) return null;
    const off = camera.position.clone().sub(target());
    const sph = new three.Spherical().setFromVector3(off);
    return { distance: sph.radius, fitDistance: lastFit.distance, zoomRatio: sph.radius / lastFit.distance, azimuth: sph.theta, polar: sph.phi };
  }

  /** Re-runs the last load/showJob/watchJob (user-initiated; offered for transient failures only). */
  function retry() {
    return !disposed && lastRequest ? lastRequest() : null;
  }

  function on(event, cb) {
    if (!listeners.has(event)) throw new TypeError(`unknown asset viewer event "${event}" (have: ${EVENTS.join(", ")})`);
    if (typeof cb !== "function") throw new TypeError("listener must be a function");
    listeners.get(event).add(cb);
    return () => listeners.get(event).delete(cb);
  }

  /**
   * download({ save? })                current item.
   * download({ jobId, index?, save? }) explicit /api/creative reference: any
   *   item (e.g. another gallery tile), in any viewer state; needs
   *   options.creativeSource. Does not touch the displayed item or state.
   *
   * Local item: hands back the ORIGINAL bytes (no re-export/conversion) with a
   * filename and mime matching the detected format, synchronously.
   * `{ save: true }` additionally triggers a browser download via a temporary
   * object URL.
   *
   * Creative item (ready, download-only, or a display error that still
   * allows download) or explicit reference: returns a Promise. It ALWAYS
   * re-resolves a fresh url first (never reuses the one the mesh was loaded
   * from, nor one from an earlier download); only with autoRetry (option or
   * { autoRetry:true } here) a retryable resolve failure re-resolves ONCE more.
   * The viewer's Download button re-runs this on every click. Resolves to
   * { ok:true, url, filename, mime, format, jobId, index, resolvedAt, concept, attempts }
   * or { ok:false, error, attempts }. Viewer state is not changed by a download.
   */
  function download(opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    const save = o.save === true;
    if (disposed) return null;
    const auto = autoFor(o);
    if (o.jobId !== undefined) return downloadRef(o, save, auto);
    if (!current) return null;
    if (current.kind === "creative") {
      const allowed =
        state.status === STATUS.READY || state.status === STATUS.DOWNLOAD_ONLY || (state.status === STATUS.ERROR && state.actions && state.actions.download);
      return allowed ? downloadCreative(current, save, auto) : null;
    }
    // Ready, or an error that still holds a VALID file (no WebGL / context lost): never malformed, unavailable or loading.
    if (state.status !== STATUS.READY && !(state.status === STATUS.ERROR && state.actions && state.actions.download)) return null;
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
      clickLink({ href, download: payload.filename, rel: "noopener" });
      setTimeout(() => win.URL.revokeObjectURL(href), 0);
    }
    return payload;
  }

  function downloadRef(ref, save, auto) {
    if (!creative || typeof creative.resolve !== "function") {
      const e = new AssetViewerError("MISSING_DEPENDENCY", "options.creativeSource is required");
      return Promise.resolve({ ok: false, error: toErrorRecord(e), attempts: { resolve: 0 } });
    }
    const index = ref.index === undefined || ref.index === null ? 0 : ref.index;
    return downloadCreative({ jobId: ref.jobId, index }, save, auto);
  }

  async function downloadCreative(info, save, auto) {
    const attempts = { resolve: 0 };
    const resolveOnce = () => {
      attempts.resolve++;
      return creative.resolve(info.jobId, info.index);
    };
    let d;
    try {
      try {
        d = await resolveOnce();
      } catch (e) {
        // V5: same rule as load(): with autoRetry only, ONE fresh re-resolve on a retryable failure, never a cached url.
        if (!auto || disposed || !isRetryableResolveError(e)) throw e;
        const wait = retryDelayForResolveError(e, rateLimitDelay); // 429: short fixed pause first
        if (wait) await new Promise((r) => setTimer(r, wait));
        if (disposed) throw e;
        d = await resolveOnce();
      }
    } catch (e) {
      const rec = toErrorRecord(e);
      rec.detail = redactUrls(rec.detail);
      rec.attempts = { ...attempts };
      return { ok: false, error: rec, attempts: { ...attempts } };
    }
    if (disposed) return { ok: false, error: toErrorRecord(new AssetViewerError("VIEWER_DISPOSED")), attempts: { ...attempts } };
    const payload = {
      ok: true,
      jobId: d.jobId,
      index: d.index,
      url: d.url,
      format: d.format,
      mime: d.mimeType || MIME_BY_FORMAT[d.format] || "application/octet-stream",
      filename: d.filename,
      resolvedAt: d.resolvedAt,
      expiresAt: d.expiresAt,
      expiryKnown: d.expiryKnown,
      concept: d.concept,
      freshlyResolved: true,
      attempts: { ...attempts },
    };
    if (save) {
      // Navigation is not subject to CORS, so this can work even when display failed (U7).
      // Cross-origin addresses ignore `download`, so the provider may choose the file name.
      clickLink({ href: d.url, download: d.filename, target: "_blank", rel: "noopener noreferrer" });
    }
    return payload;
  }

  function clickLink(props) {
    const a = Object.assign(doc.createElement("a"), props);
    a.style.display = "none";
    root.appendChild(a);
    a.click();
    root.removeChild(a);
  }

  /** Every GPU / DOM / listener resource the renderer side holds (also used when scene setup fails half-way). */
  function releaseGpu() {
    if (rafId != null && caf) caf(rafId);
    rafId = null;
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = null;
    const canvas = renderer && renderer.domElement;
    // Listeners go BEFORE forceContextLoss(), whose webglcontextlost must not reach onContextLost.
    for (const [t, type, fn] of domListeners) t.removeEventListener(type, fn);
    domListeners = [];
    if (controls) {
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
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      renderer = null;
    }
  }

  function dispose() {
    if (disposed) return;
    supersede();
    removeModel();
    disposed = true;
    lastRequest = null;
    if (detachSafetyNets) detachSafetyNets();
    detachSafetyNets = null;
    releaseGpu();
    if (overlay) overlay.dispose();
    if (root.parentNode) root.parentNode.removeChild(root);
    state = { ...state, status: STATUS.DISPOSED, phase: null, progress: null, model: null, loadId: seq };
    emit("statechange", snapshot());
    emit("dispose", snapshot());
    listeners.forEach((set) => set.clear());
  }

  const handle = {
    load,
    showJob,
    watchJob,
    clear,
    fitToView,
    resetView,
    orbit,
    zoom,
    retry,
    getState: snapshot,
    getView,
    on,
    download,
    dispose,
    /** Test/diagnostic hook: live renderer + scene graph handles. Not part of the contract. */
    _debug: () => ({ renderer, scene, camera, controls, model, envTarget, lastFit }),
  };

  // ---- navigation safety nets (the host's own dispose() call is the primary path) ----
  // An already-aborted `signal` disposes right after mount returns (the handle is still returned).
  const offs = [];
  const hook = (t, type) => {
    const fn = () => dispose();
    t.addEventListener(type, fn);
    offs.push(() => t.removeEventListener(type, fn));
  };
  const sig = options.signal;
  if (sig && sig.aborted) Promise.resolve().then(dispose);
  else if (sig && sig.addEventListener) hook(sig, "abort");
  if (options.disposeOnPageHide !== false && win.addEventListener) hook(win, "pagehide");
  detachSafetyNets = () => offs.splice(0).forEach((f) => f());

  if (fatal || webglError) {
    const rec = toErrorRecord(fatal || webglError);
    setState({ status: STATUS.ERROR, error: rec });
    const fire = () => !disposed && reportError(rec);
    if (typeof queueMicrotask === "function") queueMicrotask(fire);
    else Promise.resolve().then(fire);
    // No WebGL: the file is still fetched + validated so a VALID one can be downloaded.
    if (!fatal && options.asset) Promise.resolve().then(() => !disposed && load(options.asset));
  } else {
    if (overlay) overlay.update(state);
    if (options.asset) load(options.asset);
  }
  return handle;
}

export { ERROR_CODE };
