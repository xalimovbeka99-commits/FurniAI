/**
 * FIXTURE DATA demo for the concept gallery, contract revision 2.
 *
 * Jobs and errors are Claude's own SIMULATED fixture pack (3946b53, copied
 * unmodified to tests/projects/fixtures/rev2/). The 3D file is the SYNTHETIC
 * grey box from that pack, served by serve.mjs. Nothing here talks to
 * /api/creative or Scenario; no paid call is possible.
 *   node docs/m3/projects/demo/serve.mjs  ->  http://127.0.0.1:5178/docs/m3/projects/demo/
 */
import { mountConceptGallery } from "../../../../src/lib/projects/conceptGallery/index.js";
import { createFakeCreativeJobsClient } from "../../../../tests/projects/fixtures/fakeCreativeJobsClient.js";
import { createFixtureFetch } from "../../../../tests/projects/fixtures/fixtureFetch.js";
// Asset Engineer's real source and viewer, used by the DEMO (the gallery module never imports them).
import { createCreativeAssetSource, mountAssetViewer } from "../../../../src/lib/assetViewer/index.js";
import * as F from "../../../../tests/projects/fixtures/contractFixtures.js";

const FX = "/tests/projects/fixtures/rev2/";
const load = async (name) => (await (await fetch(FX + name)).json());
const names = [
  "jobs.list.200.json", "asset.200.json", "error.missing-auth.401.json", "error.not-configured.503.json",
  "error.provider-rate-limited.429.json", "error.provider-insufficient-credits.402.json", "error.asset-not-ready.409.json",
  "error.asset-unavailable.410.json", "error.provider-unavailable.submission-unknown.502.json",
];
const P = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await load(n)])));
const LIST = P["jobs.list.200.json"].response.jobs;
const pick = (status, code) => LIST.find((j) => j.status === status && (!code || j.error?.code === code));
/** A fixture error file as the rejection a client would throw ({ status, code, message, details }). */
const fxErr = (name) => {
  const f = P[name];
  return { status: f._fixture.httpStatus, code: f.response.code, message: f.response.error, details: f.response.details };
};
const throwing = (e) => () => {
  throw e;
};
const never = () => new Promise(() => {});

// Fixture dates are one fixed instant; spread them so the cards differ (FIXTURE).
const at = (m) => new Date(Date.UTC(2026, 9, 4, 6, m)).toISOString();
const dated = (j, m) => ({ ...j, createdAt: at(m), updatedAt: at(m + 2), completedAt: j.completedAt ? at(m + 2) : null });
const ok = dated(pick("succeeded"), 50);
const proc = dated(pick("processing"), 58);
const unk = dated(pick("submission_unknown"), 30);
const failed = ["PROVIDER_GENERATION_FAILED", "PROVIDER_REJECTED_REQUEST", "PROVIDER_RATE_LIMITED", "PROVIDER_INSUFFICIENT_CREDITS"].map((c, i) => dated(pick("failed", c), 40 - i * 3));
const subm = { ...proc, jobId: "00000000-0000-4000-8000-0000000000a1", status: "submitting", submittedAt: null, providerStatus: null, createdAt: at(59), updatedAt: at(59), usage: { ...proc.usage, billingOutcome: "not_submitted" } };
const rev1 = { ...ok, jobId: "00000000-0000-4000-8000-0000000000a2", createdAt: at(10), updatedAt: at(12), usage: { estimatedCost: 12, reportedCost: 12, unit: "provider_cost_units" } };
const LONG = "model_fixture-very-long-configured-model-identifier-for-layout-checks-0123456789";
const long = {
  ...ok,
  jobId: "00000000-0000-4000-8000-0000000000a3",
  model: LONG,
  provider: "scenario-provider-name-that-is-long-on-purpose",
  concept: { ...ok.concept, notice: `${ok.concept.notice}\nSecond line of a long server notice, kept verbatim with its line break (FIXTURE).` },
};
const longFail = dated({ ...pick("failed", "PROVIDER_GENERATION_FAILED"), jobId: "00000000-0000-4000-8000-0000000000a4", error: { code: "SOME_FUTURE_CODE", message: "A long provider reason, sixty-plus characters, wraps cleanly at 390px without overflow (FIXTURE)." } }, 5);

let n = 0;
const GLB = "/tests/projects/fixtures/rev2/SYNTHETIC-box-not-scenario-generated.glb";
// Claude's asset.200.json with its placeholder address swapped for the locally served SYNTHETIC box (fixture README says to).
const okAsset = ({ jobId, index }) => {
  const a = P["asset.200.json"].response.asset;
  return { ok: true, asset: { ...a, jobId, index, url: `${location.origin}${GLB}?resolve=${++n}`, resolvedAt: new Date().toISOString() } };
};
let tooBusy = 0;

export const SCENARIOS = {
  loading: { label: "Loading", listJobs: never },
  empty: { label: "Empty", listJobs: () => ({ ok: true, jobs: [] }) },
  list: { label: "List: Claude's rev 2 fixture (7 jobs)", listJobs: () => ({ ok: true, jobs: [proc, ok, unk, ...failed] }), getJob: never, getAssetUrl: okAsset },
  billing: { label: "Billing outcomes (not_submitted / unconfirmed / reported / rev 1)", listJobs: () => ({ ok: true, jobs: [subm, proc, ok, rev1] }), getJob: never, getAssetUrl: okAsset },
  polling: {
    label: "Polling (submitting + processing)",
    listJobs: () => ({ ok: true, jobs: [subm, proc] }),
    getJob: ({ jobId }) => ({ ok: true, job: { ...(jobId === proc.jobId ? proc : subm), updatedAt: new Date().toISOString() }, refresh: { ok: true } }),
  },
  failed: { label: "Failed (rev 2 provider codes)", listJobs: () => ({ ok: true, jobs: failed }) },
  submission_unknown: { label: "Submission unknown (may have been charged)", listJobs: () => ({ ok: true, jobs: [unk] }) },
  signed_out: { label: "Signed out (401 MISSING_AUTH)", listJobs: throwing(fxErr("error.missing-auth.401.json")) },
  // No 403 in Claude's pack (the contract has only 401); the persistence layer can answer 403 UNAUTHORIZED. Synthetic.
  forbidden: { label: "Not allowed (403, page-wide)", listJobs: throwing({ status: 403, code: "UNAUTHORIZED", message: "Signed in but not allowed." }) },
  network: { label: "Network error", listJobs: throwing(new TypeError("Failed to fetch")) },
  server_5xx: { label: "Server error (5xx)", listJobs: throwing(F.errorFor("INTERNAL")) },
  rate_limited: { label: "Busy (429 PROVIDER_RATE_LIMITED)", listJobs: throwing(fxErr("error.provider-rate-limited.429.json")) },
  provider_refused: { label: "Provider refused (402 PROVIDER_INSUFFICIENT_CREDITS)", listJobs: throwing(fxErr("error.provider-insufficient-credits.402.json")) },
  not_configured: { label: "Unavailable (503 not configured)", listJobs: throwing(fxErr("error.not-configured.503.json")) },
  malformed: { label: "Malformed list answer", listJobs: () => ({ ok: true }) },
  asset_not_ready: { label: "Download: 409 ASSET_NOT_READY", listJobs: () => ({ ok: true, jobs: [ok] }), getJob: () => ({ ok: true, job: ok, refresh: { ok: true } }), getAssetUrl: throwing(fxErr("error.asset-not-ready.409.json")), click: "download" },
  asset_unavailable: { label: "Download: 410 ASSET_UNAVAILABLE (expired link)", listJobs: () => ({ ok: true, jobs: [ok] }), getAssetUrl: throwing(fxErr("error.asset-unavailable.410.json")), click: "download" },
  asset_rate_limited: { label: "Download: 429 twice (one ~1 s retry)", listJobs: () => ({ ok: true, jobs: [ok] }), getAssetUrl: () => { tooBusy++; throw fxErr("error.provider-rate-limited.429.json"); }, click: "download" },
  integrity: {
    label: "Integrity: 409 RECORD_INTEGRITY_FAILED",
    listJobs: () => ({ ok: true, jobs: [ok, proc] }),
    getJob: throwing(F.errorFor("RECORD_INTEGRITY_FAILED")),
    getAssetUrl: throwing(F.errorFor("RECORD_INTEGRITY_FAILED")),
    click: "download",
    pollIntervalMs: 3000,
  },
  open: { label: "Open: 3D view of the SYNTHETIC box", listJobs: () => ({ ok: true, jobs: [ok] }), getJob: never, getAssetUrl: okAsset, click: "open" },
  download: { label: "Download: fresh address, real file", listJobs: () => ({ ok: true, jobs: [ok] }), getJob: never, getAssetUrl: okAsset, click: "download" },
  long: { label: "Long content (60+ chars)", listJobs: () => ({ ok: true, jobs: [long, longFail] }), getJob: never, getAssetUrl: okAsset },
};

async function viewerEnv() {
  const three = await import("three");
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");
  const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
  return { three, deps: { GLTFLoader, OrbitControls, RoomEnvironment } };
}

const select = document.getElementById("state");
const log = document.getElementById("log");
for (const [id, s] of Object.entries(SCENARIOS)) select.appendChild(new Option(s.label, id));
let gallery = null;

async function mount(id) {
  if (gallery) gallery.destroy();
  log.textContent = "";
  tooBusy = 0;
  const s = SCENARIOS[id] || SCENARIOS.list;
  const client = createFakeCreativeJobsClient({ listJobs: s.listJobs });
  const creativeSource = createCreativeAssetSource({
    fetchImpl: createFixtureFetch({ getJob: s.getJob || never, getAssetUrl: s.getAssetUrl || never }, client.calls),
    getAuthToken: () => "fixture-token",
  });
  const env = await viewerEnv(); // AE's real viewer in every state (three from node_modules)
  gallery = mountConceptGallery(document.getElementById("gallery"), {
    client,
    getAccessToken: () => "fixture-token",
    creativeSource,
    pollIntervalMs: s.pollIntervalMs || 4000,
    mountAssetViewer,
    viewerOptions: { three: env.three, deps: env.deps },
    // A real download of the freshly resolved (local, SYNTHETIC) file; the address is used once and dropped.
    startDownload: ({ url, filename }) => {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      log.textContent = `FIXTURE: downloaded ${filename} (the SYNTHETIC box, not a Scenario output) from a freshly resolved local address. getAssetUrl calls: ${client.count("getAssetUrl")}.`;
    },
  });
  window.__gallery = gallery;
  window.__calls = () => client.calls.map((c) => c.method);
  if (s.click) {
    const t = setInterval(() => {
      const b = document.querySelector(`[data-action="${s.click}"]`);
      if (b) {
        clearInterval(t);
        b.click();
      }
    }, 50);
  }
}

const initial = new URLSearchParams(location.search).get("state") || "list";
select.value = SCENARIOS[initial] ? initial : "list";
select.addEventListener("change", () => {
  history.replaceState(null, "", `?state=${select.value}`);
  mount(select.value);
});
mount(select.value);
