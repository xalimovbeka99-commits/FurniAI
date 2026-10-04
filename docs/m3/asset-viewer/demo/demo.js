/**
 * DEMO-ONLY page script. Shows how a host page injects THREE + loader
 * classes into mountAssetViewer. The viewer module itself never imports three.
 */
import { mountAssetViewer } from "/src/lib/assetViewer/index.js";

const params = new URLSearchParams(location.search);
const mode = params.get("three") === "r128" ? "r128" : "r166";
const FIX = "/tests/assetViewer/fixtures/";
const ASSETS = {
  chair: { url: `${FIX}chair-textured.glb` },
  "chair-slow": { url: `/__slow${FIX}chair-textured.glb?ms=${params.get("slowMs") || 2500}`, filename: "chair-textured.glb" },
  table: { url: `${FIX}table-untextured.glb` },
  corrupt: { url: `${FIX}corrupt.glb` },
  empty: { url: `${FIX}empty-scene.gltf` },
  unsupported: { url: "/generated/chair.obj" },
};

async function loadThree() {
  if (mode === "r128") {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "/vendor-three-r128.min.js";
      s.onload = resolve;
      s.onerror = () => reject(new Error("vendor-three-r128.min.js failed to load"));
      document.head.appendChild(s);
    });
    const compat = await import("/__demo/r128-compat.js");
    return { three: window.THREE, deps: { GLTFLoader: compat.GLTFLoader, OrbitControls: compat.OrbitControls, RoomEnvironment: compat.RoomEnvironment }, label: "window.THREE r128 (vendor-three-r128.min.js) + three-stdlib loaders (demo shim)" };
  }
  const three = await import("three");
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");
  const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
  return { three, deps: { GLTFLoader, OrbitControls, RoomEnvironment }, label: "three 0.166 (node_modules) + three/examples/jsm loaders" };
}

const $ = (s) => document.querySelector(s);
const log = [];
function addLog(line) {
  log.unshift(`${new Date().toISOString().slice(11, 23)} ${line}`);
  log.length = Math.min(log.length, 14);
  $("#log").textContent = log.join("\n");
}

const env = await loadThree();
$("#mode").textContent = `mode=${mode} · ${env.label} · THREE.REVISION ${env.three.REVISION}`;
let viewer = null;
let shown = null;

function memory() {
  const d = viewer && viewer._debug();
  return d && d.renderer ? { ...d.renderer.info.memory } : null;
}
function refresh() {
  const s = viewer.getState();
  const view = { status: s.status, phase: s.phase, progress: s.progress, error: s.error, asset: s.asset, model: s.model, capabilities: s.capabilities };
  $("#state").textContent = JSON.stringify(view, null, 1);
  $("#memory").textContent = JSON.stringify(memory());
}

function mount() {
  viewer = mountAssetViewer($("#viewer"), {
    three: env.three,
    deps: env.deps,
    onError: (e) => addLog(`onError ${e.code}: ${e.message}${e.detail ? ` [${e.detail}]` : ""}`),
  });
  viewer.on("statechange", (s) => {
    addLog(`state ${s.status}${s.phase ? `:${s.phase}` : ""}${s.progress && s.progress.ratio != null ? ` ${Math.round(s.progress.ratio * 100)}%` : ""}`);
    refresh();
  });
  viewer.on("ready", () => setTimeout(refresh, 50));
  refresh();
}
mount();

async function act(name) {
  switch (name) {
    case "fit":
      viewer.fitToView();
      addLog("fitToView()");
      break;
    case "clear":
      viewer.clear();
      shown = null;
      break;
    case "download": {
      const d = viewer.download({ save: true });
      addLog(d ? `download ${d.filename} ${d.mime} ${d.byteLength} B (original bytes)` : "download: nothing ready");
      break;
    }
    case "remount":
      viewer.dispose();
      addLog("dispose()");
      mount();
      shown = null;
      break;
    case "replace":
      return act(shown === "chair" ? "table" : "chair");
    case "race": {
      const a = viewer.load(ASSETS["chair-slow"]);
      await new Promise((r) => setTimeout(r, 300));
      const b = viewer.load(ASSETS.table);
      const [ra, rb] = await Promise.all([a, b]);
      addLog(`race: first ${ra.superseded ? "superseded" : ra.ok}, second ok=${rb.ok}`);
      shown = "table";
      break;
    }
    default: {
      const res = await viewer.load(ASSETS[name]);
      if (res.ok) shown = name.startsWith("chair") ? "chair" : name;
      return res;
    }
  }
  refresh();
  return null;
}

document.querySelectorAll("button[data-act]").forEach((b) => b.addEventListener("click", () => act(b.dataset.act)));

/** Renders once and reads the drawing buffer back: proves real GPU pixels. */
function samplePixels() {
  const d = viewer._debug();
  if (!d.renderer) return null;
  d.renderer.render(d.scene, d.camera);
  const gl = d.renderer.getContext();
  const w = gl.drawingBufferWidth;
  const h = gl.drawingBufferHeight;
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const bg = [px[0], px[1], px[2]];
  let model = 0;
  const sum = [0, 0, 0];
  for (let i = 0; i < px.length; i += 4) {
    const diff = Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2]);
    if (diff > 30) {
      model++;
      sum[0] += px[i];
      sum[1] += px[i + 1];
      sum[2] += px[i + 2];
    }
  }
  return { width: w, height: h, background: bg, modelPixelRatio: +(model / (w * h)).toFixed(4), modelAvgRGB: model ? sum.map((v) => Math.round(v / model)) : null };
}

function textureColorInfo() {
  const d = viewer._debug();
  if (!d.model) return null;
  const out = [];
  d.model.traverse((o) => {
    if (o.isMesh && o.material && o.material.map && !out.length) {
      const t = o.material.map;
      out.push({ colorSpace: t.colorSpace, encoding: t.encoding, imageType: t.image && t.image.constructor && t.image.constructor.name });
    }
  });
  const r = d.renderer;
  return { map: out[0] || null, rendererOutput: r ? { outputColorSpace: r.outputColorSpace, outputEncoding: r.outputEncoding } : null };
}

window.__demo = { mode, act, memory, samplePixels, textureColorInfo, getState: () => viewer.getState(), get viewer() { return viewer; }, ready: true };
addLog(`mounted (${mode})`);
