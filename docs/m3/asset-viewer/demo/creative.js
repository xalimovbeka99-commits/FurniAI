/**
 * DEMO-ONLY page for the /api/creative contract against the SIMULATED
 * stand-in in serve.mjs. Fixtures only; nothing here is a Scenario result.
 * Shows how a host would wire the viewer: inject THREE + loaders, pass a
 * creativeSource with a token getter, and let the viewer resolve.
 */
import { createCreativeAssetSource, mountAssetViewer } from "/src/lib/assetViewer/index.js";

const params = new URLSearchParams(location.search);
const mode = params.get("three") === "r128" ? "r128" : "r166";

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
    return { three: window.THREE, deps: { GLTFLoader: compat.GLTFLoader, OrbitControls: compat.OrbitControls, RoomEnvironment: compat.RoomEnvironment }, label: "window.THREE r128 + three-stdlib (demo shim)" };
  }
  const three = await import("three");
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");
  const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
  return { three, deps: { GLTFLoader, OrbitControls, RoomEnvironment }, label: "three 0.166 (node_modules)" };
}

const $ = (s) => document.querySelector(s);
const log = [];
function addLog(line) {
  log.unshift(`${new Date().toISOString().slice(11, 19)} ${line}`);
  log.length = Math.min(log.length, 6);
  $("#log").textContent = log.join("\n");
}
const calls = [];
function addCall(line) {
  calls.unshift(line);
  calls.length = Math.min(calls.length, 8);
  $("#calls").textContent = calls.join("\n");
}
/** Signed addresses are shown by their single-use token only (t0001…), never in full. */
const tokenOf = (u) => {
  const m = /\/__simcdn\/(t\d{4})\//.exec(String(u));
  return m ? m[1] : "?";
};

// Host-side fetch wrappers, only so the page can display the calls.
const apiFetch = async (url, init) => {
  const res = await fetch(url, init);
  const q = new URL(url, location.href).searchParams;
  let extra = "";
  try {
    const b = await res.clone().json();
    extra = b.ok ? (b.asset ? ` → signed ${tokenOf(b.asset.url)} (${b.asset.format ?? "null"})` : b.job ? ` → status ${b.job.status}` : "") : ` → ${b.code}`;
  } catch {
    /* not JSON */
  }
  addCall(`API ${q.get("resource")} ${q.get("jobId")}${q.has("index") ? `#${q.get("index")}` : ""} [Bearer] ${res.status}${extra}`);
  return res;
};
const cdnFetch = async (url, init) => {
  try {
    const res = await fetch(url, init);
    addCall(`GET signed ${tokenOf(url)} ${res.status}${res.status === 403 ? " (single-use address already used/expired)" : ""}`);
    return res;
  } catch (e) {
    addCall(`GET signed ${tokenOf(url)} blocked (${e.message}) — no CORS header`);
    throw e;
  }
};

const env = await loadThree();
$("#mode").textContent = `mode=${mode} · ${env.label}`;

const source = createCreativeAssetSource({ fetchImpl: apiFetch, getAuthToken: async () => "sim-token" });
let viewer = null;
function refresh() {
  const s = viewer.getState();
  const view = { status: s.status, phase: s.phase, source: s.source, job: s.job, asset: s.asset, concept: s.concept, actions: s.actions, attempts: s.attempts, error: s.error, model: s.model && { meshCount: s.model.meshCount, proportions: s.model.proportions, scale: s.model.scale } };
  $("#state").textContent = JSON.stringify(view, null, 1);
}
function mount() {
  viewer = mountAssetViewer($("#viewer"), {
    three: env.three,
    deps: env.deps,
    fetch: cdnFetch,
    creativeSource: source,
    onError: (e) => addLog(`onError ${e.code}${e.serverCode ? ` (server ${e.serverCode})` : ""}`),
  });
  viewer.on("statechange", (s) => {
    addLog(`state ${s.status}${s.phase ? `:${s.phase}` : ""}`);
    refresh();
  });
  refresh();
}
mount();

const JOBS = {
  processing: "sim-processing",
  submitting: "sim-submitting",
  glb: "sim-glb-chair",
  table: "sim-glb-table",
  expired: "sim-expired-url",
  gone: "sim-gone",
  integrity: "sim-integrity",
  cors: "sim-cors",
  fbx: "sim-fbx",
  nullfmt: "sim-null-format",
  unknown: "sim-submission-unknown",
  failed: "sim-failed",
};

async function act(name) {
  if (name === "fit") {
    viewer.fitToView();
    addLog("fitToView()");
    return null;
  }
  if (name === "clear") return viewer.clear();
  if (name === "reset") {
    await fetch("/__sim/reset");
    calls.length = 0;
    $("#calls").textContent = "";
    addLog("stand-in reset");
    return null;
  }
  if (name === "download") {
    const p = viewer.download({ save: true });
    if (!p) {
      addLog("download: nothing to download");
      return null;
    }
    const d = await p;
    addLog(d.ok ? `download ${d.filename} via fresh ${tokenOf(d.url)}` : `download failed ${d.error.code}`);
    return d.ok ? { ok: true, filename: d.filename, token: tokenOf(d.url), freshlyResolved: d.freshlyResolved } : d;
  }
  const jobId = JOBS[name];
  // Polling jobs go through watchJob (3 s cadence); terminal ones too, so the page is honest about what it asks.
  const r = await viewer.watchJob(jobId, { intervalMs: 3000 });
  refresh();
  return r && { ok: r.ok, downloadOnly: r.downloadOnly || false, status: viewer.getState().status };
}

document.querySelectorAll("button[data-act]").forEach((b) => b.addEventListener("click", () => act(b.dataset.act)));

window.__demo = {
  mode,
  act,
  calls,
  getState: () => viewer.getState(),
  get viewer() {
    return viewer;
  },
  simulated: true,
  ready: true,
};
addLog(`mounted (${mode}) · SIMULATED stand-in`);
