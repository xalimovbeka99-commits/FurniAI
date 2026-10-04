// TEST HARNESS — NOT PRODUCT UI. Drives the real /api/creative handlers through
// the PROPOSED contract: upload → submit (key per click) → poll → view (fresh
// address, re-call once) → download (fresh address) → reopen from the job list.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createConceptClient, TERMINAL } from "/support/conceptClient.js";

const qs = new URLSearchParams(location.search);
const USER = qs.get("user") || "user-a";
const POLL_MS = Number(qs.get("poll") || 4000); // contract: 3–5 s; tests shorten it
const $ = (id) => document.getElementById(id);
const client = createConceptClient({ apiUrl: "/api/creative", authHeader: `Bearer test:${USER}` });
const H = (window.__harness = { stats: client.stats, viewUrls: [], events: [], polls: 0, generateClicks: 0, loaderErrors: 0 });
const log = (e) => H.events.push({ t: Math.round(performance.now()), ...e });

let referenceId = null;
let currentJob = null;
let pollTimer = null;

function show(el, text) { el.textContent = text; el.hidden = !text; }
function setStatus(s) { $("status").textContent = s; document.body.dataset.status = s; }

$("upload").addEventListener("click", async () => {
  const f = $("reference").files[0];
  if (!f) return show($("upload-status"), "Choose an image first.");
  const buf = new Uint8Array(await f.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  const r = await client.upload(f.name, btoa(bin));
  if (r.status === 200 || r.status === 201) {
    referenceId = r.body.reference.referenceId;
    $("upload-status").textContent = `Reference ready (${r.body.reused ? "reused" : "new"}).`;
    document.body.dataset.reference = "ready";
  } else {
    $("upload-status").textContent = `Upload refused: ${r.body?.code} — ${r.body?.error}`;
    document.body.dataset.reference = "refused";
  }
});

// The button is deliberately NOT disabled while a job runs: the harness must
// show what the SERVER does with rapid repeat clicks (one key per click).
$("generate").addEventListener("click", async () => {
  H.generateClicks++;
  if (!referenceId) return show($("error"), "Upload a reference first.");
  const key = crypto.randomUUID();
  log({ kind: "generate-click", key });
  const r = await client.submit(referenceId, key);
  if (r.status === 202 || r.status === 200) return track(r.body.job);
  if (r.status === 409 && r.body.code === "DUPLICATE_ACTIVE_JOB") {
    show($("info"), "A concept is already being generated from this image — nothing new was submitted.");
    if (!currentJob) track({ jobId: r.body.details.jobId, status: "processing" });
    return;
  }
  if (r.body?.details?.jobStatus === "submission_unknown") return track({ jobId: r.body.details.jobId, status: "submission_unknown", error: { message: r.body.error } });
  if (r.body?.details?.jobId) return track({ jobId: r.body.details.jobId, status: r.body.details.jobStatus || "failed", error: { message: r.body.error } });
  show($("error"), `${r.body?.code}: ${r.body?.error}`);
});

function track(job) {
  currentJob = job;
  $("job-id").textContent = job.jobId;
  render(job);
  if (!TERMINAL.includes(job.status)) schedulePoll();
}

function schedulePoll() {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(async () => {
    H.polls++;
    const r = await client.poll(currentJob.jobId);
    if (r.status !== 200) { show($("error"), `${r.body?.code}: ${r.body?.error}`); setStatus("error"); return; }
    currentJob = r.body.job;
    render(currentJob);
    if (!TERMINAL.includes(currentJob.status)) schedulePoll(); // terminal → stop. Never resubmit.
  }, POLL_MS);
}

function render(job) {
  setStatus(job.status);
  show($("warning"), "");
  show($("error"), "");
  if (job.status === "submission_unknown") {
    show($("warning"), "We sent this generation but never got an answer. It may have been charged. It was NOT retried automatically — check before generating again.");
  } else if (job.status === "failed") {
    show($("error"), `Generation failed: ${job.error?.message || "unknown reason"}`);
  } else if (job.status === "succeeded") {
    show($("notice"), job.concept?.notice || "");
    $("view").disabled = false;
    $("download").disabled = false;
    viewConcept();
  }
}

// ---------------------------------------------------------------- view leg
async function viewConcept() {
  show($("asset-error"), "");
  $("view-info").textContent = "loading…";
  document.body.dataset.view = "loading";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = await client.resolve(currentJob.jobId, 0); // fresh address every time
    if (r.status !== 200) return assetRefused(r);
    H.viewUrls.push(r.body.asset.url);
    if (!["glb", "gltf"].includes(r.body.asset.format)) { $("view-info").textContent = "Download-only format."; return; }
    try {
      const gltf = await new GLTFLoader().loadAsync(r.body.asset.url);
      let meshes = 0;
      let textures = 0;
      gltf.scene.traverse((o) => { if (o.isMesh) { meshes++; if (o.material?.map) textures++; } });
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const size = box.getSize(new THREE.Vector3());
      $("view-info").textContent = `Loaded: ${meshes} mesh(es), ${textures} textured.`;
      Object.assign(document.body.dataset, { view: "ok", meshes: String(meshes), textures: String(textures), bbox: [size.x, size.y, size.z].map((v) => v.toFixed(3)).join(","), viewAttempts: String(attempt) });
      tryRender(gltf.scene, box);
      return;
    } catch (e) {
      H.loaderErrors++;
      log({ kind: "loader-error", attempt, message: String(e?.message || e) });
      if (attempt === 2) {
        document.body.dataset.view = "failed";
        $("view-info").textContent = "";
        show($("asset-error"), "The 3D concept could not be loaded (tried a fresh address twice).");
        return;
      }
    }
  }
}

function assetRefused(r) {
  document.body.dataset.view = `refused-${r.status}`;
  $("view-info").textContent = "";
  const msg = r.body?.code === "ASSET_UNAVAILABLE" ? "This concept is no longer available from the generation service, and FurniAI kept no copy."
    : r.body?.code === "ASSET_NOT_READY" ? "This concept is not ready yet." : `${r.body?.code}: ${r.body?.error}`;
  show($("asset-error"), msg);
}

function tryRender(scene, box) {
  try {
    const canvas = $("canvas");
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
    renderer.setSize(canvas.clientWidth || 320, 220, false);
    const cam = new THREE.PerspectiveCamera(45, (canvas.clientWidth || 320) / 220, 0.01, 100);
    const c = box.getCenter(new THREE.Vector3());
    cam.position.set(c.x + 1.6, c.y + 1.2, c.z + 1.8);
    cam.lookAt(c);
    const s = new THREE.Scene();
    s.add(new THREE.AmbientLight(0xffffff, 2));
    s.add(scene);
    renderer.render(s, cam);
    document.body.dataset.rendered = "yes";
  } catch (e) {
    document.body.dataset.rendered = `no: ${e?.message || e}`;
  }
}

$("view").addEventListener("click", () => viewConcept());

// ------------------------------------------------------------ download leg
$("download").addEventListener("click", async () => {
  show($("asset-error"), "");
  const r = await client.loadAssetBytes(currentJob.jobId, 0); // fresh address, re-call once
  if (!r.ok) {
    document.body.dataset.download = `failed-${r.code}`;
    return r.status === 410 || r.code === "ASSET_UNAVAILABLE" ? assetRefused({ status: 410, body: { code: "ASSET_UNAVAILABLE" } }) : show($("asset-error"), `Download failed: ${r.code}`);
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([r.bytes], { type: r.contentType || "application/octet-stream" }));
  a.download = `furniai-concept-${currentJob.jobId.slice(0, 8)}.${r.asset.format || "bin"}`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  document.body.dataset.download = "ok";
  document.body.dataset.downloadContentType = r.contentType || "";
});

// ------------------------------------------------------- reopen (job list)
if (qs.get("reopen") === "1") {
  (async () => {
    const r = await client.list();
    const latest = r.body?.jobs?.find((j) => j.status === "succeeded");
    if (latest) track(latest);
  })();
}
document.body.dataset.ready = "yes";
