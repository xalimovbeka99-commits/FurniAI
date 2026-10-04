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
 * A retryable resolve failure (network, 5xx, 429; isRetryableResolveError)
 * is re-resolved ONCE, on load and on download alike.
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
import {
  creativeFilename,
  isRetryableResolveError,
  isViewableFormat,
  MIME_BY_FORMAT,
  normalizeConcept,
  normalizeCreativeFormat,
  redactUrls,
  safeJobMessage,
} from "./creativeAsset.js";

export const STATUS = Object.freeze({
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
  DISPOSED: "disposed",
  /** A concept whose format the viewer does not display (fbx/obj/usdz/stl/ply/zip/null): download offered. */
  DOWNLOAD_ONLY: "download-only",
});

export const EVENTS = Object.freeze(["statechange", "progress", "ready", "error", "dispose"]);

/** Extensions we know about but deliberately do not load yet (fail before fetching). */
export const KNOWN_UNSUPPORTED_EXTENSIONS = Object.freeze([
  "obj", "fbx", "usdz", "usd", "usda", "usdc", "stl", "3mf", "ply", "dae", "blend", "step", "stp", "3ds", "max",
]);

const DEP_KEYS = ["GLTFLoader", "OrbitControls", "RoomEnvironment"];

/** Display failures after a successful resolve that justify ONE fresh resolve + retry (expired url, CORS, truncated body). */
const RETRYABLE_DISPLAY_CODES = new Set(["FETCH_FAILED", "PARSE_FAILED", "UNSUPPORTED_FORMAT"]);

const NO_CREATIVE = Object.freeze({ concept: null, job: null, actions: null, attempts: null });

/** What a host may offer for a concept. Builder/export/production are never allowed (contract §1 UI rule). */
function creativeActions({ view = false, download = false } = {}) {
  return { view, download, openInBuilder: false, export: false, production: false };
}

/** `{ jobId, index?, format? }` without url/arrayBuffer/blob = an /api/creative job-output reference. */
function isJobOutputRef(a) {
  return Boolean(a && typeof a === "object" && typeof a.jobId === "string" && a.url === undefined && a.arrayBuffer == null && a.blob == null);
}

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
  const creative = options.creativeSource || null;
  const setTimer = options.setTimeout || ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.clearTimeout || ((t) => clearTimeout(t));
  // A host that renders concept.notice itself turns the overlay's copy off; state still carries the text.
  const renderConceptNotice = options.renderConceptNotice !== false;

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
    ...NO_CREATIVE,
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
  // Displayed item, for download(): local -> { kind:"local", adapter, bytes, desc };
  // creative -> { kind:"creative", jobId, index, format, mimeType, filename, concept } (NO url, NO bytes).
  let current = null;
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
  const overlay =
    options.ui === false
      ? null
      : createOverlay(doc, root, {
          renderConceptNotice,
          onDownload: () => {
            const p = download({ save: true });
            if (p && typeof p.then === "function") p.catch(() => {});
          },
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
          signal: run.signal(),
          maxBytes,
          credentials: options.fetchCredentials || "omit",
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
        throw new AssetViewerError("MISSING_DEPENDENCY", `the ${adapter.id} adapter needs deps.${missing.join(", deps.")}`);
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
        throw e instanceof AssetViewerError ? e : new AssetViewerError("PARSE_FAILED", e && e.message ? e.message : String(e));
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
      if (stats.meshCount === 0) throw new AssetViewerError("EMPTY_SCENE", "scene contains no renderable geometry");
      parsedRoot.updateMatrixWorld(true);
      const box = new three.Box3().setFromObject(parsedRoot);
      const size = box.getSize(new three.Vector3());
      const sphere = box.getBoundingSphere(new three.Sphere());
      if (box.isEmpty() || !Number.isFinite(sphere.radius) || !(sphere.radius > 0)) {
        throw new AssetViewerError("EMPTY_SCENE", "scene bounds are empty or degenerate");
      }
      const color = enforceColorTexturesSRGB(three, parsedRoot);
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
        warnings: prep.stats.textureCount === 0 && prep.info.declaredTextures > 0 ? ["TEXTURES_NOT_LOADED"] : [],
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
    if (keep) current = keep; // creative item that can still be downloaded
    requestRender();
    setState({ status: STATUS.ERROR, phase: null, progress: null, model: null, error: rec, ...extraState });
    reportError(rec);
    return { ok: false, error: rec, state: snapshot() };
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
  async function load(asset) {
    const blocked = guard();
    if (blocked) return blocked;
    if (asset && typeof asset === "object" && asset.job && typeof asset.job === "object") return showJob(asset.job, { index: asset.index });
    if (isJobOutputRef(asset)) return loadCreativeRef(asset);

    const run = beginRun();
    const concept = asset && typeof asset === "object" && asset.concept ? normalizeConcept(asset.concept) : null;
    setState({ status: STATUS.LOADING, loadId: run.id, phase: "fetching", progress: null, error: null, source: "local", ...NO_CREATIVE, concept });
    try {
      const prep = await prepareMesh(asset, run);
      if (!prep) return superseded();
      return commitMesh(prep, { kind: "local", adapter: prep.adapter, bytes: prep.bytes, desc: prep.desc });
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
    return fail(new AssetViewerError("MISSING_DEPENDENCY", "options.creativeSource (createCreativeAssetSource(...)) is required for job references"), {
      loadId: run.id,
      source: "creative",
      ...NO_CREATIVE,
      concept: normalizeConcept(null),
    });
  }

  async function loadCreativeRef(ref) {
    const run = beginRun();
    if (!creative || typeof creative.resolve !== "function") return missingSource(run);
    const index = ref.index === undefined || ref.index === null ? 0 : ref.index;
    const jobInfo = { jobId: ref.jobId, index, status: null, outputCount: null };
    return creativeFlow(run, { jobId: ref.jobId, index, format: ref.format, mimeType: ref.mimeType, concept: ref.concept }, jobInfo);
  }

  /**
   * resolve [-> one more resolve on a retryable resolve failure]
   * -> (non glb/gltf: download-only) -> load mesh; on a fetch/parse failure
   * re-resolve ONCE and retry ONCE, then ASSET_DISPLAY_FAILED. The two retry
   * budgets are independent: at most 3 resolves and 2 mesh fetches per load.
   * The re-resolve of the display retry is not itself retried. The resolved
   * url lives only in local variables of this function.
   */
  async function creativeFlow(run, ref, jobInfo) {
    const { jobId, index } = ref;
    const attempts = { resolve: 0, display: 0 };
    let concept = normalizeConcept(ref.concept);
    const base = () => ({ loadId: run.id, source: "creative", job: { ...jobInfo }, concept, attempts: { ...attempts } });
    const failC = (err, downloadable, info) => {
      if (downloadable && err instanceof AssetViewerError) err.downloadAvailable = true;
      return fail(err, { ...base(), actions: creativeActions({ download: downloadable }) }, { keep: downloadable ? info : null, redact: true });
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
        if (run.stale() || isAbortError(e) || !isRetryableResolveError(e)) throw e;
        setState({ phase: "retrying", progress: null, ...base() });
        try {
          return await resolveFresh();
        } catch (e2) {
          if (e2 instanceof AssetViewerError) e2.attempts = { ...attempts };
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
      if (!RETRYABLE_DISPLAY_CODES.has(firstErr.code)) return failC(firstErr, true, info);
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
        const why = `first attempt ${firstErr.code}: ${firstErr.detail || ""}; retry after fresh resolve ${e2.code || "PARSE_FAILED"}: ${e2.detail || e2.message || ""}`;
        return failC(new AssetViewerError("ASSET_DISPLAY_FAILED", why, { attempts: { ...attempts } }), true, info);
      }
      d2 = null;
    }
    if (!prep) return superseded();
    return commitMesh(prep, info, { ...base(), actions: creativeActions({ view: true, download: true }) });
  }

  /** Render a job object from GET ?resource=jobs&jobId=. Never branches on providerStatus/providerProgress. */
  function showJob(job, { index } = {}) {
    const blocked = guard();
    if (blocked) return Promise.resolve(blocked);
    const run = beginRun();
    return applyJob(run, job, { index });
  }

  async function applyJob(run, job, { index } = {}) {
    if (!job || typeof job !== "object" || typeof job.jobId !== "string" || !job.jobId) {
      return fail(new AssetViewerError("INVALID_ASSET", "job object needs a jobId"), { loadId: run.id, source: "creative", ...NO_CREATIVE });
    }
    const outputs = Array.isArray(job.outputs) ? job.outputs.filter((o) => o && typeof o === "object") : [];
    const status = typeof job.status === "string" ? job.status : null;
    const concept = normalizeConcept(job.concept);
    const jobInfo = { jobId: job.jobId, index: null, status, outputCount: outputs.length };
    const base = { loadId: run.id, source: "creative", job: jobInfo, concept, attempts: null, actions: creativeActions({}) };
    const errExtra = { serverCode: job.error && typeof job.error.code === "string" ? job.error.code : null, jobStatus: status };

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
      return creativeFlow(run, ref, jobInfo);
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
  async function watchJob(jobId, { index, intervalMs = 4000 } = {}) {
    const blocked = guard();
    if (blocked) return blocked;
    const run = beginRun();
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
        await applyJob(run, job, { index });
        await run.sleep(wait);
        if (run.stale()) return superseded();
        continue;
      }
      return applyJob(run, job, { index });
    }
  }

  function clear() {
    if (disposed) return;
    supersede();
    removeModel();
    requestRender();
    if (fatal) return;
    setState({ status: STATUS.IDLE, loadId: seq, phase: null, progress: null, asset: null, model: null, error: null, source: null, ...NO_CREATIVE });
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
   * from, nor one from an earlier download) and, on a retryable resolve
   * failure, re-resolves ONCE more. Resolves to
   * { ok:true, url, filename, mime, format, jobId, index, resolvedAt, concept, attempts }
   * or { ok:false, error, attempts }. Viewer state is not changed by a download.
   */
  function download(opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    const save = o.save === true;
    if (disposed) return null;
    if (o.jobId !== undefined) return downloadRef(o, save);
    if (!current) return null;
    if (current.kind === "creative") {
      const allowed =
        state.status === STATUS.READY || state.status === STATUS.DOWNLOAD_ONLY || (state.status === STATUS.ERROR && state.actions && state.actions.download);
      return allowed ? downloadCreative(current, save) : null;
    }
    if (state.status !== STATUS.READY) return null;
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

  function downloadRef(ref, save) {
    if (!creative || typeof creative.resolve !== "function") {
      const e = new AssetViewerError("MISSING_DEPENDENCY", "options.creativeSource (createCreativeAssetSource(...)) is required to download a job reference");
      return Promise.resolve({ ok: false, error: toErrorRecord(e), attempts: { resolve: 0 } });
    }
    const index = ref.index === undefined || ref.index === null ? 0 : ref.index;
    return downloadCreative({ jobId: ref.jobId, index }, save);
  }

  async function downloadCreative(info, save) {
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
        // V5: same rule as load(): ONE fresh re-resolve on a retryable failure, never a cached url.
        if (disposed || !isRetryableResolveError(e)) throw e;
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
      const a = doc.createElement("a");
      a.href = d.url;
      a.download = d.filename;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.style.display = "none";
      root.appendChild(a);
      a.click();
      root.removeChild(a);
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
    showJob,
    watchJob,
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
