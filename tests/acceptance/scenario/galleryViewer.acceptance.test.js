/**
 * SIMULATED / MOCKED / LOCAL — Projects concept gallery (34f80a7) + asset
 * viewer v2 (7eaa414) acceptance, in-process, against the PROPOSED contract
 * (docs/creative/SCENARIO_3D_API_CONTRACT.md §2.4–§2.5).
 *
 * Pattern: tests/projects/creativeContract.test.js. What is REAL here:
 *   - api/creative.js + creativeService + scenarioClient + memory store, over
 *     HTTP on 127.0.0.1 (support/apiHarness.js);
 *   - Asset Engineer's createCreativeAssetSource (the /api/creative resolver);
 *   - Asset Engineer's mountAssetViewer v2 with real three 0.166 + the real
 *     GLTFLoader (tests/assetViewer/helpers/mountHarness.js; only the GPU
 *     renderer and OrbitControls are fakes);
 *   - Projects Engineer's mountConceptGallery, in the gallery's own fake DOM.
 * What is MOCKED: the Scenario provider and its CDN (support/fixtureProvider.js,
 * serving tests/fixtures/scenario/textured-cube.glb). No Scenario network, no
 * paid call, no hosted DB, no secrets. LIVE: NOT RUN.
 *
 * Neither the gallery nor the viewer is attached to any page at 485f8a6, so
 * this is component-level acceptance, not a product demo.
 *
 * Follow-up: verified on a throwaway merge of candidate ce3626a + grok/projects-assets
 * 53f4384 (which already contains grok/asset-viewer b34e259 = viewer v2.1). G1/G2 are
 * fixed there and the v2.1 retry/notice rules are adopted, so these tests assert the
 * FIXED behaviour and are EXPECTED to fail on ce3626a alone (viewer 7eaa414, gallery
 * 34f80a7). Viewer-only v2.1 checks: viewerV21.acceptance.test.js.
 */
import { createHash } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createCreativeAssetSource } from "../../../src/lib/assetViewer/index.js";
import { mountConceptGallery, SUBMISSION_UNKNOWN_WARNING } from "../../../src/lib/projects/conceptGallery/index.js";
import { byAttr, byClass, byTag, allAttributeValues, createFakeDocument } from "../../projects/fakeDom.js";
import { CONCEPT_NOTICE } from "../../../src/lib/creative/creativeService.js";
import { mountForTest } from "../../assetViewer/helpers/mountHarness.js";
import { installImageBitmapShim } from "../../assetViewer/helpers/fixtures.js";
import { startFixtureProvider, CDN_HOST } from "./support/fixtureProvider.js";
import { applyEnv, fixtureEnv, makeClock, resetStore, restoreEnv, startApi, store, PNG } from "./support/apiHarness.js";

const CUBE_SHA256 = "7760387b6369181213eb1d54f7bd393bb83c47214f8010482a6deecdbb12b49c"; // tests/fixtures/scenario/manifest.json
const MSG = {
  notReady: "This concept's file isn't ready yet. We're checking its status again.",
  unavailable: "This file is no longer available. The generation service has removed it and FurniAI has no stored copy.",
  integrity: "This concept's record failed an integrity check, so it can't be opened or downloaded.",
  displayFailed: "The 3D view couldn't show this file. Downloading it may still work.",
  serverAsset: "FurniAI couldn't get this file right now. Try again in a moment.",
};

let api, fx, shim;
const clock = makeClock(vi);
const storageWrites = [];
const fakeStorage = (name) => ({ setItem: (k, v) => storageWrites.push({ name, k, v }), getItem: () => null, removeItem: () => {} });

beforeAll(async () => {
  api = await startApi();
  fx = await startFixtureProvider();
  shim = installImageBitmapShim();
  globalThis.localStorage = fakeStorage("localStorage");
  globalThis.sessionStorage = fakeStorage("sessionStorage");
});
afterAll(async () => {
  shim.restore();
  delete globalThis.localStorage;
  delete globalThis.sessionStorage;
  await api.close();
  await fx.close();
});
const mounted = [];
beforeEach(() => { fx.reset(); applyEnv(fixtureEnv(fx.baseUrl)); resetStore(); clock.on(); storageWrites.length = 0; });
afterEach(() => {
  for (const m of mounted.splice(0)) m.g.destroy();
  clock.off();
  restoreEnv();
  expect(storageWrites, "nothing (least of all a url) is persisted client-side").toEqual([]);
});

// ------------------------------------------------------------------ helpers
/** Real macrotask turns (Date is faked, so no Date-based deadline). */
async function until(pred, what = "condition", turns = 1500) {
  for (let i = 0; i < turns && !pred(); i++) await new Promise((r) => setTimeout(r, 4));
  expect(pred(), `timed out waiting for ${what}`).toBe(true);
}
const sha = (buf) => createHash("sha256").update(buf).digest("hex");

async function succeededJob(user = "user-a", key = "gallery-00000001") {
  const ref = (await api.upload(PNG, { user })).body.reference.referenceId;
  const s = await api.submit(ref, key, { user });
  expect(s.status).toBe(202);
  const p = await api.job(s.body.job.jobId, { user });
  expect(p.body.job.status).toBe("succeeded");
  return s.body.job.jobId;
}

/**
 * Mount the REAL gallery with the REAL creative source and the REAL viewer v2.
 * The only test plumbing: the list client (no product list client exists —
 * CONCEPT_GALLERY.md §10 Q1), and the viewer's CDN fetch, which maps the
 * MOCKED cdn.fixture.invalid host onto the fixture server.
 */
function mountGallery({ user = "user-a", onApiResponse, networkFail, injectAsset } = {}) {
  const apiCalls = [];
  const apiFetch = async (url, init = {}) => {
    const u = new URL(String(url));
    const call = { method: (init.method || "GET").toUpperCase(), resource: u.searchParams.get("resource"), jobId: u.searchParams.get("jobId"), cache: init.cache, auth: init.headers?.Authorization || init.headers?.authorization };
    apiCalls.push(call);
    // Injected transport failure (the real handler cannot produce one): networkFail.asset = N → next N asset calls reject.
    if (networkFail && call.resource === "asset" && networkFail.asset > 0) { networkFail.asset--; call.status = "network"; throw new TypeError("fetch failed"); }
    // Injected answer the real handler cannot give locally (a malformed 2xx, a 403): injectAsset() → Response | undefined (pass through).
    const injected = injectAsset && call.resource === "asset" ? injectAsset(call) : undefined;
    if (injected) { call.status = injected.status; call.injected = true; return injected; }
    const res = await fetch(url, init);
    call.status = res.status;
    if (onApiResponse) await onApiResponse(call);
    return res;
  };
  const source = createCreativeAssetSource({ fetchImpl: apiFetch, getAuthToken: () => `test:${user}`, baseUrl: api.url });
  const cdn = [];
  const cdnFetch = async (url, init) => {
    const entry = { url: String(url), credentials: init?.credentials };
    cdn.push(entry);
    expect(entry.url.startsWith(`${CDN_HOST}/`), "the viewer fetches only the address the resolver returned").toBe(true);
    const res = await fetch(fx.cdnLocalUrl(entry.url), { signal: init?.signal });
    entry.status = res.status;
    if (res.ok) entry.sha256 = sha(Buffer.from(await res.clone().arrayBuffer()));
    return res;
  };
  const viewers = [];
  const mountAssetViewer = (_el, opts) => {
    const t = mountForTest({ options: { ...opts, fetch: cdnFetch } });
    const dispose = t.viewer.dispose.bind(t.viewer);
    t.disposed = false;
    t.viewer.dispose = () => { t.disposed = true; return dispose(); };
    viewers.push(t);
    return t.viewer;
  };
  const listClient = {
    async listJobs({ accessToken, signal }) {
      apiCalls.push({ method: "GET", resource: "jobs", jobId: null, list: true });
      const res = await fetch(`${api.url}?resource=jobs`, { headers: { Authorization: `Bearer ${accessToken}` }, signal });
      const body = await res.json();
      if (!res.ok || !body?.ok) throw { status: res.status, code: body?.code, message: body?.error, details: body?.details };
      return body;
    },
  };
  const doc = createFakeDocument();
  const root = doc.createElement("div");
  doc.body.appendChild(root);
  const downloads = [];
  const g = mountConceptGallery(root, {
    client: listClient,
    getAccessToken: () => `test:${user}`,
    creativeSource: source,
    mountAssetViewer,
    viewerOptions: {},
    pollIntervalMs: 3000,
    startDownload: (d) => downloads.push(d),
  });
  const m = {
    g, doc, root, source, apiCalls, cdn, viewers, downloads,
    card: (jobId) => byAttr(root, "data-job-id", jobId).find((n) => n.tagName === "ARTICLE") || null,
    button: (scope, action) => byAttr(scope, "data-action", action)[0] || null,
    assetCalls: () => apiCalls.filter((c) => c.resource === "asset"),
    jobCalls: () => apiCalls.filter((c) => c.resource === "jobs" && c.jobId),
    viewer: () => viewers[viewers.length - 1],
    panel: () => byAttr(root, "data-viewer-panel")[0] || null,
    viewerStatus: () => byAttr(root, "data-viewer-status")[0] || null,
  };
  mounted.push(m);
  return m;
}
async function ready(m) { await until(() => m.g.getState().list === "ready", "gallery list ready"); }
async function openAndSettle(m, jobId) {
  const prev = m.viewer();
  const before = prev ? prev.states.length : 0;
  m.button(m.card(jobId), "open").click();
  await until(() => m.g.getState().assets[`${jobId}:0`] === undefined || m.g.getState().assets[`${jobId}:0`].phase === "error", "open settled");
  await until(() => m.viewer() && (m.viewer() !== prev || m.viewer().states.length > before) && ["ready", "error", "download-only"].includes(m.viewer().viewer.getState().status), "viewer settled");
  return m.viewer().viewer.getState();
}
/** One comparable snapshot of a card (DOM + gallery state). null when the card is absent. */
function cardSummary(m, jobId) {
  const c = m.card(jobId);
  if (!c) return null;
  return {
    status: c.getAttribute("data-status"),
    badge: byClass(c, "fcg-badge-text")[0].textContent,
    badgeError: byClass(c, "fcg-badge")[0].getAttribute("data-error"),
    jobError: byAttr(c, "data-job-error").map((n) => [n.getAttribute("data-job-error"), n.textContent]),
    buttons: byTag(c, "button").map((b) => b.getAttribute("data-action")),
    assetError: byAttr(c, "data-asset-error").map((n) => n.getAttribute("data-asset-error")),
    jobErrorState: m.g.getState().jobErrors[jobId] ?? null,
    spinner: byClass(c, "fcg-spinner").length,
  };
}
const INTEGRITY_TEXT = "This concept's record failed an integrity check. It is not used and is no longer updated.";
function expectIntegrityLocked(m, jobId) {
  const c = cardSummary(m, jobId);
  expect(c.badge).toBe("Integrity check failed");
  expect(c.badgeError).toBe("integrity");
  expect(c.jobError).toEqual([["RECORD_INTEGRITY_FAILED", INTEGRITY_TEXT]]);
  expect(c.buttons, "neither Open nor Download is offered").toEqual([]);
  expect(m.button(m.card(jobId), "open")).toBeNull();
  expect(m.button(m.card(jobId), "download")).toBeNull();
  expect(c.jobErrorState).toEqual({ kind: "integrity", code: "RECORD_INTEGRITY_FAILED" });
  expect(c.spinner).toBe(0);
  return c;
}
const forgeOutputs = (jobId) => { const raw = store()._raw.jobs.get(jobId); const orig = raw.outputs; raw.outputs = [{ assetId: "asset_someone_else", format: "glb" }]; return () => { raw.outputs = orig; }; };

function expectNoAddressAnywhere(m) {
  const urls = fx.state.issuedUrls;
  const blobs = [JSON.stringify(m.g.getState()), m.root.textContent, JSON.stringify(allAttributeValues(m.root)), ...m.viewers.map((t) => JSON.stringify(t.viewer.getState()))];
  for (const b of blobs) {
    for (const u of urls) expect(b).not.toContain(u);
    expect(b).not.toMatch(/cdn\.fixture\.invalid|sig=/);
  }
}

// ==================================================================== tests
describe("gallery + viewer v2 on the real /api/creative handler (SIMULATED provider, fixtures only)", () => {
  it("a succeeded job appears in the gallery with its real asset: GLB listed, placeholder tile (the contract has no thumbnail), and Open shows the exact fixture bytes through the viewer's /api/creative resolver", async () => {
    const jobId = await succeededJob();
    const serverJob = (await api.list()).body.jobs[0];
    const providerAssetBefore = fx.state.calls.asset; // the success poll itself looks the asset up once (format detection)
    const m = mountGallery();
    await ready(m);
    const card = m.card(jobId);
    expect(card).not.toBeNull();
    expect(card.getAttribute("data-status")).toBe("succeeded");
    expect(byClass(card, "fcg-badge-text")[0].textContent).toBe("Ready");
    expect(card.textContent).toContain("GLB");
    // Contract §2.4 has no thumbnail field: a neutral, aria-hidden placeholder, never an <img> or a url.
    const tile = byClass(card, "fcg-tile")[0];
    expect(tile.getAttribute("aria-hidden")).toBe("true");
    expect(byTag(m.root, "img")).toHaveLength(0);
    expect(byAttr(card, "data-concept-notice")[0].textContent).toBe(serverJob.concept.notice);
    expect(m.assetCalls(), "listing never pre-resolves an address").toHaveLength(0);
    expect(fx.state.calls.asset).toBe(providerAssetBefore);

    const s = await openAndSettle(m, jobId);
    expect(s.status).toBe("ready");
    expect(m.assetCalls()).toHaveLength(1);
    expect(m.assetCalls()[0]).toMatchObject({ method: "GET", cache: "no-store", status: 200, auth: "Bearer test:user-a" });
    expect(fx.state.calls.asset).toBe(providerAssetBefore + 1);
    expect(m.cdn).toHaveLength(1);
    expect(m.cdn[0]).toMatchObject({ status: 200, sha256: CUBE_SHA256, credentials: "omit" });
    expect(s).toMatchObject({
      source: "creative",
      job: { jobId, index: 0 },
      asset: { source: "creative", format: "glb", filename: `furniai-concept-${jobId}-0.glb` },
      actions: { view: true, download: true, openInBuilder: false, export: false, production: false },
      attempts: { resolve: 1, display: 1 },
      error: null,
    });
    expect(s.model.meshCount).toBeGreaterThan(0);
    expect(s.concept.notice).toBe(serverJob.concept.notice);
    // §1 UI rule: the notice is shown wherever the mesh is shown.
    expect(byAttr(m.panel(), "data-concept-notice")[0].textContent).toBe(serverJob.concept.notice);
    expect(m.panel().getAttribute("data-job-id")).toBe(jobId);
    expectNoAddressAnywhere(m);
  });

  it("a job generated while the gallery is open is polled (getJob, ~3 s) from processing to succeeded and becomes openable", async () => {
    const ref = (await api.upload(PNG)).body.reference.referenceId;
    const jobId = (await api.submit(ref, "gallery-poll-0001")).body.job.jobId;
    const m = mountGallery();
    await ready(m);
    expect(m.card(jobId).getAttribute("data-status")).toBe("processing");
    expect(m.button(m.card(jobId), "open"), "no Open while processing").toBeNull();
    expect(m.button(m.card(jobId), "download"), "no Download while processing").toBeNull();
    expect(m.g.getState().polling).toBe(true);
    await until(() => m.card(jobId)?.getAttribute("data-status") === "succeeded", "polled to succeeded", 2500);
    expect(m.jobCalls().length).toBeGreaterThanOrEqual(1);
    expect(m.g.getState().polling).toBe(false);
    expect((await openAndSettle(m, jobId)).status).toBe("ready");
  }, 20_000);

  it("resolved FRESH on every open and download, never cached: after every issued address is revoked the next Open still works; each call returns a new address", async () => {
    const jobId = await succeededJob();
    const m = mountGallery();
    await ready(m);
    expect((await openAndSettle(m, jobId)).status).toBe("ready");
    m.button(m.root, "close-viewer").click();
    expect(m.viewer().disposed).toBe(true);
    fx.revokeIssued(); // the first address is dead now; a cached url would fail the next open
    expect((await openAndSettle(m, jobId)).status).toBe("ready");
    expect(m.assetCalls()).toHaveLength(2);
    expect(m.cdn.map((c) => c.status)).toEqual([200, 200]);
    expect(new Set(m.cdn.map((c) => c.url)).size).toBe(2);

    m.button(m.card(jobId), "download").click();
    await until(() => m.downloads.length === 1);
    m.button(m.card(jobId), "download").click();
    await until(() => m.downloads.length === 2);
    expect(m.assetCalls()).toHaveLength(4);
    expect(m.assetCalls().every((c) => c.cache === "no-store")).toBe(true);
    const all = [...m.cdn.map((c) => c.url), ...m.downloads.map((d) => d.url)];
    expect(new Set(all).size).toBe(4);
    expect(m.downloads[0]).toMatchObject({ jobId, index: 0, format: "glb", filename: `furniai-concept-${jobId}-0.glb` });
    expectNoAddressAnywhere(m);
  });

  it("one retry on a failed load: a dead first address is re-resolved ONCE and shown; two dead addresses → ASSET_DISPLAY_FAILED after exactly 2 resolves, Download still offered", async () => {
    const jobId = await succeededJob();
    const m = mountGallery();
    await ready(m);
    fx.state.cdnFailNext = 1;
    const s1 = await openAndSettle(m, jobId);
    expect(s1.status).toBe("ready");
    expect(s1.attempts).toEqual({ resolve: 2, display: 2 });
    expect(m.assetCalls()).toHaveLength(2);
    expect(m.cdn.map((c) => c.status)).toEqual([403, 200]);

    fx.state.cdnFailNext = 2;
    const s2 = await openAndSettle(m, jobId);
    expect(s2.status).toBe("error");
    expect(s2.error.code).toBe("ASSET_DISPLAY_FAILED");
    expect(m.assetCalls(), "no third resolve").toHaveLength(4);
    expect(m.cdn.map((c) => c.status)).toEqual([403, 200, 403, 403]);
    expect(s2.model).toBeNull();
    expect(m.viewerStatus().textContent).toBe(MSG.displayFailed);
    const dl = m.button(m.card(jobId), "download");
    expect(dl).not.toBeNull();
    expect(dl.disabled).toBe(false);
  });

  it("one retry on a transient resolve failure for Download (502 → resolve once more); two in a row → honest server message, no download, no third call", async () => {
    const jobId = await succeededJob();
    let flipAfterFirst = true;
    const m = mountGallery({ onApiResponse: (c) => { if (c.resource === "asset" && c.status === 502 && flipAfterFirst) fx.state.assetMode = "ok"; } });
    await ready(m);
    fx.state.assetMode = "http500";
    m.button(m.card(jobId), "download").click();
    await until(() => m.downloads.length === 1, "download after one retry");
    expect(m.assetCalls().map((c) => c.status)).toEqual([502, 200]);

    flipAfterFirst = false;
    fx.state.assetMode = "http500";
    m.button(m.card(jobId), "download").click();
    await until(() => byAttr(m.card(jobId), "data-asset-error").length === 1, "download error shown");
    expect(m.assetCalls().map((c) => c.status)).toEqual([502, 200, 502, 502]);
    expect(m.downloads).toHaveLength(1);
    expect(byAttr(m.card(jobId), "data-asset-error")[0].textContent).toBe(MSG.serverAsset);
    expect(m.card(jobId).textContent).not.toContain("unavailable right now"); // server text is not shown
  });

  it("Open re-resolves ONCE on a transient resolve failure (contract §2.5 'if a load fails, call it again once'; V1): 502→200 is shown; 502,502 → honest server message (not 'Downloading it may still work'), exactly 2 resolves, the card stays Ready (per-file)", async () => {
    const jobId = await succeededJob();
    let flipAfterFirst = true;
    const m = mountGallery({ onApiResponse: (c) => { if (c.resource === "asset" && c.status === 502 && flipAfterFirst) fx.state.assetMode = "ok"; } });
    await ready(m);
    fx.state.assetMode = "http500";
    const s1 = await openAndSettle(m, jobId);
    expect(s1.status).toBe("ready");
    expect(s1.attempts).toEqual({ resolve: 2, display: 1 });
    expect(m.assetCalls().map((c) => c.status)).toEqual([502, 200]);
    expect(m.cdn.map((c) => c.sha256)).toEqual([CUBE_SHA256]);

    m.button(m.root, "close-viewer").click();
    flipAfterFirst = false;
    fx.state.assetMode = "http500";
    const s2 = await openAndSettle(m, jobId);
    expect(s2.status).toBe("error");
    expect(s2.error.code).toBe("PROVIDER_UNAVAILABLE");
    expect(m.assetCalls().map((c) => c.status), "no third resolve").toEqual([502, 200, 502, 502]);
    expect(m.cdn).toHaveLength(1);
    expect(m.viewerStatus().textContent).toBe(MSG.serverAsset);
    expect(m.viewerStatus().textContent).not.toContain("Downloading it may still work");
    expect(m.root.textContent).not.toContain("unavailable right now"); // the server's own text is not shown
    const c = cardSummary(m, jobId);
    expect(c).toMatchObject({ status: "succeeded", badge: "Ready", jobError: [], jobErrorState: null });
    expect(c.buttons).toEqual(expect.arrayContaining(["open", "download"]));
  });

  it("Download re-resolves ONCE on 429 and on a network failure too (V5 rule shared via isRetryableResolveError), and never on 403/404", async () => {
    const jobId = await succeededJob();
    let failNext = 0;
    const m = mountGallery({ onApiResponse: (c) => { if (c.resource === "asset" && c.status !== 200 && --failNext <= 0) fx.state.assetMode = "ok"; } });
    await ready(m);
    // 429: real handler (provider asset lookup rate-limited → 429 PROVIDER_RATE_LIMITED)
    failNext = 1; fx.state.assetMode = "http429";
    m.button(m.card(jobId), "download").click();
    await until(() => m.downloads.length === 1, "download after one 429 retry");
    expect(m.assetCalls().map((c) => c.status)).toEqual([429, 200]);
    failNext = 2; fx.state.assetMode = "http429";
    m.button(m.card(jobId), "download").click();
    await until(() => byAttr(m.card(jobId), "data-asset-error").length === 1, "429 twice → error");
    expect(m.assetCalls().map((c) => c.status)).toEqual([429, 200, 429, 429]);
    const err429 = byAttr(m.card(jobId), "data-asset-error")[0];
    expect(err429.getAttribute("data-asset-error")).toBe("PROVIDER_RATE_LIMITED");
    expect(err429.textContent).toMatch(/^FurniAI couldn't get this file/);
    expect(err429.textContent).not.toMatch(/rate-limiting|Nothing was generated|simulated|Downloading it may still work/); // no server text, no display-failure text
    expect(m.downloads).toHaveLength(1);
    expect(cardSummary(m, jobId)).toMatchObject({ status: "succeeded", badge: "Ready", jobErrorState: null });
    // network (injected at the /api/creative fetch boundary)
    const nf = { asset: 1 };
    const n = mountGallery({ networkFail: nf });
    await ready(n);
    n.button(n.card(jobId), "download").click();
    await until(() => n.downloads.length === 1, "download after one network retry");
    expect(n.assetCalls().map((c) => c.status)).toEqual(["network", 200]);
    nf.asset = 2;
    n.button(n.card(jobId), "download").click();
    await until(() => byAttr(n.card(jobId), "data-asset-error").length === 1, "network twice → error");
    expect(n.assetCalls().map((c) => c.status)).toEqual(["network", 200, "network", "network"]);
    expect(n.downloads).toHaveLength(1);
    expect(cardSummary(n, jobId)).toMatchObject({ status: "succeeded", badge: "Ready", jobErrorState: null });
    // 404: another user's (or a deleted) job → never retried
    const b = mountGallery({ user: "user-b" });
    await ready(b);
    await expect(b.source.resolve(jobId, 0)).rejects.toMatchObject({ code: "CONCEPT_NOT_FOUND", status: 404 });
    expect(b.assetCalls()).toHaveLength(1);
  });

  it("Open and Download NEVER retry a malformed 2xx (RESOLVE_MALFORMED) or a 4xx (403, 404 MISSING_JOB): exactly one /api/creative call each; malformed stays per-file, 403/404 lock the card (job-level) until the list says otherwise", async () => {
    const jobId = await succeededJob();
    const J = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    const cases = [
      { name: "200 without url", res: () => J(200, { ok: true, asset: { jobId, index: 0, format: "glb" } }), viewerCode: "RESOLVE_MALFORMED", text: "FurniAI sent a reply this page couldn't read", jobLevel: false },
      { name: "200 not JSON", res: () => new Response("<html>", { status: 200 }), viewerCode: "RESOLVE_MALFORMED", text: "FurniAI sent a reply this page couldn't read", jobLevel: false },
      { name: "403 UNAUTHORIZED", res: () => J(403, { ok: false, code: "UNAUTHORIZED" }), viewerCode: "FORBIDDEN", text: "permission", jobLevel: "Not allowed" },
      { name: "bare 403", res: () => new Response(null, { status: 403 }), viewerCode: "FORBIDDEN", text: "permission", jobLevel: "Not allowed" },
      { name: "404 MISSING_JOB", res: () => J(404, { ok: false, code: "MISSING_JOB" }), viewerCode: "CONCEPT_NOT_FOUND", jobLevel: true },
    ];
    const settleCard = async (m, what) => {
      await until(() => byAttr(m.card(jobId) || m.root, "data-asset-error").length === 1 || Boolean(m.g.getState().jobErrors[jobId]) || !m.card(jobId), what);
      await new Promise((r) => setTimeout(r, 30));
    };
    const expectCard = (m, k) => {
      const c = cardSummary(m, jobId);
      if (!c) return;
      if (k.jobLevel) {
        expect(c.buttons, `${k.name}: job-level → no actions`).toEqual([]);
        expect(c.jobErrorState, k.name).not.toBeNull();
        if (typeof k.jobLevel === "string") expect(c.badge, k.name).toBe(k.jobLevel);
        expect(c.jobError.map(([, t]) => t).join(" "), k.name).not.toMatch(/^Sign in/);
      } else {
        expect(c, `${k.name}: per-file, the job is not locked`).toMatchObject({ status: "succeeded", badge: "Ready", jobErrorState: null });
        expect(c.buttons).toEqual(expect.arrayContaining(["open", "download"]));
      }
    };
    for (const k of cases) {
      // Open first
      const o = mountGallery({ injectAsset: () => k.res() });
      await ready(o);
      const s = await openAndSettle(o, jobId);
      expect(s.status, k.name).toBe("error");
      expect(s.error.code, k.name).toBe(k.viewerCode);
      expect(s.attempts.resolve, `${k.name}: Open is not retried`).toBe(1);
      await settleCard(o, `${k.name}: open settled`);
      expect(o.assetCalls(), `${k.name}: one call for Open`).toHaveLength(1);
      expect(o.cdn).toHaveLength(0);
      if (k.text) expect(o.viewerStatus().textContent, k.name).toContain(k.text);
      expect(o.viewerStatus().textContent, k.name).not.toMatch(/Downloading it may still work|^Sign in/);
      expectCard(o, k);
      // Download first (a fresh gallery)
      const d = mountGallery({ injectAsset: () => k.res() });
      await ready(d);
      d.button(d.card(jobId), "download").click();
      await settleCard(d, `${k.name}: download settled`);
      expect(d.assetCalls(), `${k.name}: one call for Download`).toHaveLength(1);
      expect(d.downloads).toHaveLength(0);
      expectCard(d, k);
      for (const m of [o, d]) { m.g.destroy(); mounted.splice(mounted.indexOf(m), 1); }
    }
    // 403 is NOT sticky: a fresh list without the 403 shows the concept as Ready again (state.js clears forbidden on reload)
    const r = mountGallery();
    await ready(r);
    expect(cardSummary(r, jobId)).toMatchObject({ status: "succeeded", badge: "Ready", jobErrorState: null });
  });

  it("expired (410 ASSET_UNAVAILABLE): Open and Download say so honestly — no model, no download, no retry, no CDN fetch", async () => {
    const jobId = await succeededJob();
    const m = mountGallery();
    await ready(m);
    fx.state.assetMode = "gone404"; // the provider no longer holds it → the handler's 410 (provider 410 itself: KNOWN_DEFECT D4)
    const s = await openAndSettle(m, jobId);
    expect(s.status).toBe("error");
    expect(s.model).toBeNull();
    expect(m.assetCalls().map((c) => c.status)).toEqual([410]);
    expect(m.viewerStatus().textContent).toBe(MSG.unavailable);
    expect(m.viewerStatus().getAttribute("data-code")).toBe("ASSET_UNAVAILABLE");
    m.button(m.card(jobId), "download").click();
    await until(() => byAttr(m.card(jobId), "data-asset-error", "ASSET_UNAVAILABLE").length === 1);
    expect(byAttr(m.card(jobId), "data-asset-error")[0].textContent).toBe(MSG.unavailable);
    expect(m.assetCalls().map((c) => c.status)).toEqual([410, 410]);
    expect(m.downloads).toHaveLength(0);
    expect(m.cdn).toHaveLength(0);
    // §2.5: 410 is an answer about THIS asset (jobId+index) — per-file, the job itself stays succeeded.
    const c = cardSummary(m, jobId);
    expect(c).toMatchObject({ status: "succeeded", badge: "Ready", jobError: [], jobErrorState: null, assetError: ["ASSET_UNAVAILABLE"] });
    expect(c.buttons).toEqual(expect.arrayContaining(["open", "download"]));
  });

  it("not ready (409 ASSET_NOT_READY): honest message, no model, no retry of the address, the job is re-checked once and the card then shows Generating", async () => {
    const jobId = await succeededJob();
    const m = mountGallery();
    await ready(m);
    // The only way the real handler answers 409 ASSET_NOT_READY for a card the gallery holds as
    // succeeded is a non-monotonic server row; status is unsigned (KNOWN_DEFECT D1b), so flip it.
    store()._raw.jobs.get(jobId).status = "processing";
    const s = await openAndSettle(m, jobId);
    expect(s.status).toBe("error");
    expect(s.model).toBeNull();
    expect(m.assetCalls().map((c) => c.status)).toEqual([409]);
    expect(m.cdn).toHaveLength(0);
    expect(m.viewerStatus().textContent).toBe(MSG.notReady);
    expect(m.viewerStatus().getAttribute("data-code")).toBe("ASSET_NOT_READY");
    await until(() => m.card(jobId)?.getAttribute("data-status") === "processing", "re-checked job shown as processing");
    expect(m.jobCalls()).toHaveLength(1);
    expect(byClass(m.card(jobId), "fcg-badge-text")[0].textContent).toBe("Generating");
    expect(m.button(m.card(jobId), "open")).toBeNull();
  });

  it("RECORD_INTEGRITY_FAILED from Open is never rendered as a usable asset: no model, nothing fetched, the card loses BOTH actions, Refresh drops the row", async () => {
    const jobId = await succeededJob();
    const m = mountGallery();
    await ready(m);
    const providerAssetBefore = fx.state.calls.asset;
    forgeOutputs(jobId); // signed field → refused
    const s = await openAndSettle(m, jobId);
    expect(s.status).toBe("error");
    expect(s.model).toBeNull();
    expect(m.assetCalls().map((c) => c.status), "integrity is never retried").toEqual([409]);
    expect(fx.state.calls.asset, "refused before the provider is asked").toBe(providerAssetBefore);
    expect(m.cdn).toHaveLength(0);
    expect(m.viewerStatus().textContent).toBe(MSG.integrity);
    expect(m.viewerStatus().getAttribute("data-code")).toBe("RECORD_INTEGRITY_FAILED");
    await until(() => Boolean(m.g.getState().jobErrors[jobId]), "integrity job error");
    expectIntegrityLocked(m, jobId);
    expect(m.downloads).toHaveLength(0);
    await m.g.refresh();
    await ready(m);
    expect(m.card(jobId), "the list drops a row that fails integrity").toBeNull();
  });

  it("RECORD_INTEGRITY_FAILED from Download: nothing downloaded, one call, the card loses both actions, so a later Open is unreachable", async () => {
    const jobId = await succeededJob();
    const m = mountGallery();
    await ready(m);
    forgeOutputs(jobId);
    m.button(m.card(jobId), "download").click();
    await until(() => Boolean(m.g.getState().jobErrors[jobId]), "integrity job error");
    expect(m.downloads).toHaveLength(0);
    expect(m.assetCalls().map((c) => c.status)).toEqual([409]);
    expectIntegrityLocked(m, jobId);
    expect(byAttr(m.root, "data-announcer")[0].textContent).toBe(MSG.integrity);
    expect(m.viewers, "Open can no longer be reached").toHaveLength(0);
    await new Promise((r) => setTimeout(r, 50));
    expect(m.assetCalls()).toHaveLength(1);
  });

  it("integrity is server truth across refresh/remount: still-invalid row → dropped; restored row → back as Ready with Open/Download (NOT a sticky client lock; see evidence §findings re CONCEPT_GALLERY.md)", async () => {
    const jobId = await succeededJob();
    const m = mountGallery();
    await ready(m);
    const restore = forgeOutputs(jobId);
    m.button(m.card(jobId), "download").click();
    await until(() => Boolean(m.g.getState().jobErrors[jobId]), "integrity job error");
    await m.g.refresh();
    await ready(m);
    expect(m.card(jobId), "still invalid: refused by the list").toBeNull();
    const m3 = mountGallery();
    await ready(m3);
    expect(m3.card(jobId), "a fresh mount does not show it either").toBeNull();
    restore();
    await m.g.refresh();
    await ready(m);
    const back = cardSummary(m, jobId);
    expect(back).toMatchObject({ status: "succeeded", badge: "Ready", jobError: [], jobErrorState: null });
    expect(back.buttons).toEqual(expect.arrayContaining(["open", "download"]));
    const m2 = mountGallery();
    await ready(m2);
    expect(cardSummary(m2, jobId)).toMatchObject({ status: "succeeded", badge: "Ready", jobErrorState: null });
    expect((await openAndSettle(m2, jobId)).status).toBe("ready");
  });

  it("integrity found by the action path (Open) and by the poll path give the SAME card state (only data-status differs: server status)", async () => {
    const jobId = await succeededJob();
    const m = mountGallery();
    await ready(m);
    forgeOutputs(jobId);
    await openAndSettle(m, jobId);
    await until(() => Boolean(m.g.getState().jobErrors[jobId]), "action-path job error");
    const viaAction = expectIntegrityLocked(m, jobId);
    const ref = (await api.upload(PNG)).body.reference.referenceId;
    const pj = (await api.submit(ref, "gallery-integ-poll2")).body.job.jobId;
    const p = mountGallery();
    await ready(p);
    store()._raw.jobs.get(pj).providerJobId = "job_fx_forged";
    await until(() => Boolean(p.g.getState().jobErrors[pj]), "poll-path job error", 2500);
    const viaPoll = expectIntegrityLocked(p, pj);
    const { status: sa, ...restA } = viaAction;
    const { status: sp, ...restP } = viaPoll;
    expect(restP).toEqual(restA);
    expect([sa, sp]).toEqual(["succeeded", "processing"]);
  }, 20_000);

  it("RECORD_INTEGRITY_FAILED while polling: the badge says 'Integrity check failed', no Open/Download, polling for it stops", async () => {
    const ref = (await api.upload(PNG)).body.reference.referenceId;
    const jobId = (await api.submit(ref, "gallery-integ-001")).body.job.jobId;
    const m = mountGallery();
    await ready(m);
    store()._raw.jobs.get(jobId).providerJobId = "job_fx_forged";
    await until(() => byAttr(m.card(jobId), "data-job-error", "RECORD_INTEGRITY_FAILED").length === 1, "integrity job error", 2500);
    expect(byClass(m.card(jobId), "fcg-badge-text")[0].textContent).toBe("Integrity check failed");
    expect(m.button(m.card(jobId), "open")).toBeNull();
    expect(m.button(m.card(jobId), "download")).toBeNull();
    expect(m.g.getState().polling).toBe(false);
    expect(fx.state.calls.job, "a refused row never reaches the provider").toBe(0);
  }, 20_000);

  it("G1 FIXED (was KNOWN_DEFECT, fixed in grok/projects-assets 6d0adfd): after Open returns 409 RECORD_INTEGRITY_FAILED the card stops advertising the concept as Ready and offers neither Open nor Download", async () => {
    const jobId = await succeededJob();
    const m = mountGallery();
    await ready(m);
    forgeOutputs(jobId);
    await openAndSettle(m, jobId);
    await new Promise((r) => setTimeout(r, 50));
    expect(byClass(m.card(jobId), "fcg-badge-text")[0].textContent).not.toBe("Ready");
    expectIntegrityLocked(m, jobId);
  });

  it("V6 + gallery: the gallery mounts the viewer with renderConceptNotice:false, so the notice is shown ONCE in the viewer panel (from the server, verbatim) and the overlay copy is suppressed", async () => {
    const jobId = await succeededJob();
    const m = mountGallery();
    await ready(m);
    const s = await openAndSettle(m, jobId);
    expect(s.status).toBe("ready");
    const overlay = m.viewer().container.find("data-av-concept");
    expect(overlay.getAttribute("data-av-concept-host-rendered"), "viewer told the host renders the notice").toBe("");
    expect(overlay.textContent).toBe("");
    expect(s.concept.notice).toBe(CONCEPT_NOTICE.notice);
    const inPanel = byAttr(m.panel(), "data-concept-notice");
    expect(inPanel).toHaveLength(1);
    expect(inPanel[0].textContent).toBe(CONCEPT_NOTICE.notice);
    // after a viewer error the panel still carries the notice (the overlay never does)
    m.button(m.root, "close-viewer").click();
    fx.state.cdnFailNext = 2;
    expect((await openAndSettle(m, jobId)).status).toBe("error");
    expect(m.viewer().container.find("data-av-concept").textContent).toBe("");
    expect(byAttr(m.panel(), "data-concept-notice").map((n) => n.textContent)).toEqual([CONCEPT_NOTICE.notice]);
  });

  it("submission_unknown shows 'May have been charged' with NO button on the card; Refresh and time never resubmit, poll or call the provider", async () => {
    fx.state.generateMode = "drop";
    const ref = (await api.upload(PNG)).body.reference.referenceId;
    const sub = await api.submit(ref, "gallery-unknown-01");
    expect(sub.body.details).toMatchObject({ jobStatus: "submission_unknown", outcomeUnknown: true });
    const jobId = sub.body.details.jobId ?? (await api.list()).body.jobs[0].jobId;
    const providerBefore = { ...fx.state.calls };
    const m = mountGallery();
    await ready(m);
    const card = m.card(jobId);
    expect(card.getAttribute("data-status")).toBe("submission_unknown");
    const warn = byAttr(card, "data-submission-unknown")[0];
    expect(warn.textContent).toBe(`May have been charged. ${SUBMISSION_UNKNOWN_WARNING}`);
    expect(byTag(card, "button"), "no retry / resubmit / open / download control on the card").toHaveLength(0);
    expect(byAttr(m.root, "data-action").map((n) => n.getAttribute("data-action"))).toEqual(["refresh"]);
    expect(m.root.textContent).not.toMatch(/Try again|Retry|Resubmit|Generate/); // the warning's own "not been retried" prose is fine
    expect(m.g.getState().polling).toBe(false);
    m.button(m.root, "refresh").click();
    await ready(m);
    await new Promise((r) => setTimeout(r, 3300)); // a full poll interval
    expect(m.apiCalls.every((c) => c.method === "GET")).toBe(true);
    expect(m.jobCalls()).toHaveLength(0);
    expect(m.assetCalls()).toHaveLength(0);
    expect(fx.state.calls).toEqual(providerBefore);
    expect(fx.state.calls.generate).toBe(1);
  }, 20_000);

  it("owner isolation: user B's gallery never lists user A's concept, and B's resolver/viewer get 404 for A's jobId with no provider or CDN call", async () => {
    const aJob = await succeededJob("user-a");
    const b = mountGallery({ user: "user-b" });
    await ready(b);
    expect(b.card(aJob)).toBeNull();
    expect(b.g.getState().jobs).toEqual([]);
    expect(byAttr(b.root, "data-panel", "empty")).toHaveLength(1);
    const assetBefore = fx.state.calls.asset;
    await expect(b.source.resolve(aJob, 0)).rejects.toMatchObject({ serverCode: "MISSING_JOB", status: 404 });
    await expect(b.source.getJob(aJob)).rejects.toMatchObject({ serverCode: "MISSING_JOB", status: 404 });
    const t = mountForTest({ options: { creativeSource: b.source, fetch: () => { throw new Error("CDN must not be reached"); } } });
    const r = await t.viewer.load({ jobId: aJob, index: 0, format: "glb" });
    expect(r.ok).toBe(false);
    expect(t.viewer.getState().model).toBeNull();
    t.viewer.dispose();
    expect(fx.state.calls.asset).toBe(assetBefore);
    const a = mountGallery({ user: "user-a" });
    await ready(a);
    expect(a.card(aJob)).not.toBeNull();
  });

  it("reopen: after destroy() (viewer disposed) a newly mounted gallery lists the concept again from the server and Open resolves a NEW address; nothing was stored client-side", async () => {
    const jobId = await succeededJob();
    const m1 = mountGallery();
    await ready(m1);
    expect((await openAndSettle(m1, jobId)).status).toBe("ready");
    const firstUrl = m1.cdn[0].url;
    m1.g.destroy();
    expect(m1.viewer().disposed).toBe(true);
    expect(m1.root.childNodes).toHaveLength(0);
    fx.revokeIssued();
    const m2 = mountGallery();
    await ready(m2);
    expect(m2.card(jobId).getAttribute("data-status")).toBe("succeeded");
    expect((await openAndSettle(m2, jobId)).status).toBe("ready");
    expect(m2.cdn[0].url).not.toBe(firstUrl);
    expect(m2.cdn[0].sha256).toBe(CUBE_SHA256);
    // Save-to-project / link-to-design is not defined by the contract or the gallery: recorded as a GAP.
  });
});
