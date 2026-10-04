/**
 * FIXTURE DATA demo for the concept gallery. Uses the scripted fake client
 * from tests/projects/fixtures; nothing here talks to /api/creative or
 * Scenario. Serve the repo root: node docs/m3/projects/demo/serve.mjs
 */
import { mountConceptGallery } from "../../../../src/lib/projects/conceptGallery/index.js";
import { createFakeCreativeJobsClient } from "../../../../tests/projects/fixtures/fakeCreativeJobsClient.js";
import { createFixtureFetch } from "../../../../tests/projects/fixtures/fixtureFetch.js";
// Asset Engineer's real source, used by the DEMO over a fixture fetch (the gallery module never imports it).
import { createCreativeAssetSource } from "../../../../src/lib/assetViewer/creativeAsset.js";
import * as F from "../../../../tests/projects/fixtures/contractFixtures.js";

const never = () => new Promise(() => {});
const T = (m) => `2026-10-04T0${Math.floor(m / 60) + 6}:${String(m % 60).padStart(2, "0")}:00.000Z`;

const ok = F.succeededJob({ createdAt: T(50), updatedAt: T(53), completedAt: T(53) });
const two = F.succeededJob({ createdAt: T(20), updatedAt: T(24), completedAt: T(24), outputs: [F.glbOutput(0), { index: 1, format: "fbx", mimeType: null }] });
const proc = F.jobView({ status: "processing", createdAt: T(58), updatedAt: T(59), providerProgress: 0.5 });
const subm = F.jobView({ status: "submitting", providerStatus: null, submittedAt: null, createdAt: T(59), updatedAt: T(59) });
const fail = F.failedJob({ createdAt: T(40), updatedAt: T(41), completedAt: T(41) });
const unk = F.unknownJob({ createdAt: T(30), updatedAt: T(31), completedAt: T(31) });

const throwing = (e) => () => {
  throw e;
};
let n = 0;
const okAsset = ({ jobId, index }) => ({ ok: true, asset: { ...F.assetView({ jobId, outputs: [F.glbOutput(index)] }, index), url: `https://cdn.fixture.invalid/${jobId}/${index}.glb?n=${++n}` } });

export const SCENARIOS = {
  loading: { label: "Loading", listJobs: never },
  empty: { label: "Empty", listJobs: () => F.listBody([]) },
  list: { label: "List (mixed statuses)", listJobs: () => F.listBody([subm, proc, ok, fail, unk, two]), getJob: never, getAssetUrl: okAsset },
  polling: {
    label: "Polling (non-terminal jobs)",
    listJobs: () => F.listBody([subm, proc]),
    getJob: ({ jobId }) => F.jobBody({ ...(jobId === proc.jobId ? proc : subm), updatedAt: new Date().toISOString() }, { ok: true }),
  },
  failed: { label: "Failed job", listJobs: () => F.listBody([fail]) },
  submission_unknown: { label: "Submission unknown", listJobs: () => F.listBody([unk]) },
  signed_out: { label: "Signed out (401)", listJobs: throwing(F.errorFor("MISSING_AUTH")) },
  network: { label: "Network error", listJobs: throwing(new TypeError("Failed to fetch")) },
  server_5xx: { label: "Server error (5xx)", listJobs: throwing(F.errorFor("INTERNAL")) },
  not_configured: { label: "Not configured (503)", listJobs: throwing(F.errorFor("CREATIVE_STORE_NOT_CONFIGURED")) },
  asset_not_ready: {
    label: "Asset: 409 ASSET_NOT_READY",
    listJobs: () => F.listBody([ok]),
    getJob: () => F.jobBody(ok),
    getAssetUrl: throwing(F.errorFor("ASSET_NOT_READY")),
    click: "download",
  },
  asset_unavailable: { label: "Asset: 410 ASSET_UNAVAILABLE", listJobs: () => F.listBody([ok]), getAssetUrl: throwing(F.errorFor("ASSET_UNAVAILABLE")), click: "download" },
  integrity: {
    label: "Integrity: 409 RECORD_INTEGRITY_FAILED",
    listJobs: () => F.listBody([ok, proc]),
    getJob: throwing(F.errorFor("RECORD_INTEGRITY_FAILED")),
    getAssetUrl: throwing(F.errorFor("RECORD_INTEGRITY_FAILED")),
    click: "download",
    pollIntervalMs: 3000,
  },
};

const select = document.getElementById("state");
const log = document.getElementById("log");
for (const [id, s] of Object.entries(SCENARIOS)) select.appendChild(new Option(s.label, id));
let gallery = null;

function mount(id) {
  if (gallery) gallery.destroy();
  log.textContent = "";
  const s = SCENARIOS[id] || SCENARIOS.list;
  const client = createFakeCreativeJobsClient({ listJobs: s.listJobs });
  const creativeSource = createCreativeAssetSource({
    fetchImpl: createFixtureFetch({ getJob: s.getJob || never, getAssetUrl: s.getAssetUrl || never }, client.calls),
    getAuthToken: () => "fixture-token",
  });
  gallery = mountConceptGallery(document.getElementById("gallery"), {
    client,
    getAccessToken: () => "fixture-token",
    creativeSource,
    pollIntervalMs: s.pollIntervalMs || 4000,
    onOpenConcept: async (req) => {
      // FIXTURE: no mountAssetViewer is injected here (it needs THREE + WebGL); the hook still gets a resolver, never a URL.
      try {
        await req.resolveUrl();
        log.textContent = `onOpenConcept({ jobId: ${req.jobId}, index: ${req.index}, format: ${req.format} }) → resolveUrl() called (getAssetUrl calls so far: ${client.count("getAssetUrl")}). FIXTURE: no viewer is mounted in this demo.`;
      } catch (e) {
        log.textContent = `resolveUrl() rejected: ${e.code}`;
      }
    },
    startDownload: ({ filename }) => {
      log.textContent = `FIXTURE: would download ${filename} from a freshly resolved address (getAssetUrl calls so far: ${client.count("getAssetUrl")}).`;
    },
  });
  window.__gallery = gallery;
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
