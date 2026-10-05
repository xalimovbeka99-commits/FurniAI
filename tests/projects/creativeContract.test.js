/**
 * In-process contract check: the REAL api/creative.js handler (Claude's
 * backend, contract revision 2 as merged into integ/scenario-candidate at
 * f472aef from 3946b53) with a STAND-IN provider fetch and the memory store.
 * FIXTURES ONLY.
 *
 * No Scenario network, no paid call: globalThis.fetch is replaced for the
 * whole file by an in-memory provider stand-in that throws for any host other
 * than scenario.stand-in.invalid, SCENARIO_API_BASE_URL always points there,
 * and the handler is called with fake req/res objects (no sockets).
 *
 * Checks (1) the gallery fixtures against the real response shapes and error
 * codes, and (2) the gallery end-to-end with Asset Engineer's real
 * createCreativeAssetSource over the in-process handler.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../api/creative.js";
import { getSharedMemoryCreativeStore } from "../../src/lib/creative/memoryStore.js";
import { createCreativeAssetSource } from "../../src/lib/assetViewer/index.js";
import { mountConceptGallery } from "../../src/lib/projects/conceptGallery/index.js";
import * as F from "./fixtures/contractFixtures.js";
import { byAttr, createFakeDocument } from "./fakeDom.js";
// Rev 2 validates the whole image (a bare PNG signature is 422 INVALID_IMAGE): Claude's SYNTHETIC 64×48 drawing.
import { PNG } from "../../src/lib/creative/testImages.js";

const STAND_IN = "https://scenario.stand-in.invalid/v1";
const ENV = {
  FURNIAI_PERSISTENCE_TEST_AUTH: "yes",
  SCENARIO_API_KEY: "stand-in-key",
  SCENARIO_API_SECRET: "stand-in-secret",
  SCENARIO_API_BASE_URL: STAND_IN,
  SCENARIO_3D_MODEL_ID: "model_standin-img23d",
  SCENARIO_3D_IMAGE_PARAM: "image",
  SCENARIO_3D_IMAGE_PARAM_IS_ARRAY: "yes",
  SCENARIO_STATUS_SUCCESS: "standin-done",
  SCENARIO_STATUS_FAILURE: "standin-failed",
  SCENARIO_LIVE_GENERATION_ENABLED: "yes",
  SCENARIO_MAX_COST_PER_JOB: "20",
};
const CLEAR = ["VERCEL_ENV", "SUPABASE_URL", "SUPABASE_ANON_KEY", "CREATIVE_RECORD_SIGNING_KEY", "SCENARIO_3D_EXTRA_PARAMS_JSON", "SCENARIO_ASSET_UPLOAD_DATA_URL"];
const saved = {};

// ---- in-memory provider stand-in (shapes as in src/lib/creative/scenarioStandIn.js) ----
const provider = { calls: { upload: 0, dryRun: 0, generate: 0, job: 0, asset: 0, model: 0, blocked: [] } };
function resetProvider() {
  Object.assign(provider, { pollsUntilDone: 1, outcome: "success", assetGone: false, dropGenerate: false, jobs: new Map() });
  provider.calls = { upload: 0, dryRun: 0, generate: 0, job: 0, asset: 0, model: 0, blocked: [] };
}
const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

async function providerFetch(input, init = {}) {
  const url = new URL(typeof input === "string" ? input : input.url);
  if (url.origin !== new URL(STAND_IN).origin) {
    provider.calls.blocked.push(url.host);
    throw new Error(`blocked: no network outside the stand-in (${url.host})`);
  }
  const p = url.pathname;
  const m = (init.method || "GET").toUpperCase();
  if (m === "POST" && p === "/v1/assets") return provider.calls.upload++, json(200, { asset: { id: `asset_ref_${provider.calls.upload}` } });
  if (m === "GET" && p.startsWith("/v1/models/")) return provider.calls.model++, json(200, { model: { id: p.split("/").pop(), capabilities: ["img23d"] } });
  if (m === "POST" && p.startsWith("/v1/generate/custom/")) {
    if (url.searchParams.get("dryRun") === "true") return provider.calls.dryRun++, json(200, { billing: { cost: 12 } });
    provider.calls.generate++;
    if (provider.dropGenerate) throw new TypeError("stand-in: connection dropped");
    const jobId = `job_standin_${provider.calls.generate}`;
    provider.jobs.set(jobId, { polls: 0 });
    return json(200, { job: { jobId, status: "standin-running" } });
  }
  if (m === "GET" && p.startsWith("/v1/jobs/")) {
    provider.calls.job++;
    const jobId = p.split("/").pop();
    const j = provider.jobs.get(jobId);
    if (!j) return json(404, { message: "job not found" });
    j.polls++;
    if (j.polls < provider.pollsUntilDone) return json(200, { job: { jobId, status: "standin-running", progress: 0.5 } });
    if (provider.outcome === "failure") return json(200, { job: { jobId, status: "standin-failed", error: "stand-in generation failure" } });
    return json(200, { job: { jobId, status: "standin-done", metadata: { assetIds: [`asset_out_${jobId}`] }, billing: { cost: 12 } } });
  }
  if (m === "GET" && p.startsWith("/v1/assets/")) {
    provider.calls.asset++;
    if (provider.assetGone) return json(404, { message: "asset not found" });
    const id = p.split("/").pop();
    return json(200, { asset: { id, url: `https://cdn.stand-in.invalid/${id}.glb?n=${provider.calls.asset}` } });
  }
  return json(404, { message: "no such route" });
}

// ---- call the real handler in-process ----
async function callHandler(method, pathAndQuery, { headers = {}, body } = {}) {
  const url = new URL(pathAndQuery, "http://in-process.invalid");
  const req = { method, url: url.pathname + url.search, headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])), body };
  let status = 200;
  let text = "";
  const res = {
    setHeader() {},
    getHeader() {},
    set statusCode(v) {
      status = v;
    },
    get statusCode() {
      return status;
    },
    end(chunk) {
      text = chunk ? String(chunk) : "";
    },
  };
  await handler(req, res);
  return { status, body: text ? JSON.parse(text) : null };
}
const call = (method, qs, { user = "user-a", auth = true, body } = {}) =>
  callHandler(method, `/api/creative?${qs}`, { headers: auth ? { authorization: `Bearer test:${user}` } : {}, body });

/** In-process fetch for createCreativeAssetSource and the list adapter. */
async function apiFetch(input, init = {}) {
  const { status, body } = await callHandler((init.method || "GET").toUpperCase(), String(input), { headers: init.headers || {} });
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

let k = 0;
async function newJob() {
  const ref = (await call("POST", "resource=references", { body: { name: "w.png", dataBase64: PNG.toString("base64") } })).body.reference.referenceId;
  return call("POST", "resource=jobs", { body: { referenceId: ref, idempotencyKey: `contract-${String(++k).padStart(6, "0")}` } });
}
/** Passes the server's 2 s per-job provider-check throttle without waiting. */
const skipThrottle = () => vi.setSystemTime(new Date(Date.now() + 2100));

const sorted = (o) => Object.keys(o).sort();
const typeMap = (o) => Object.fromEntries(Object.entries(o).map(([key, v]) => [key, v === null ? "null" : Array.isArray(v) ? "array" : typeof v]));
function expectSameShape(real, fixture) {
  expect(sorted(real)).toEqual(sorted(fixture));
  const rt = typeMap(real);
  for (const [key, t] of Object.entries(typeMap(fixture))) if (rt[key] !== "null" && t !== "null") expect([key, rt[key]]).toEqual([key, t]);
}
function expectErrorBody(r, status, code) {
  expect(r.status).toBe(status);
  expect(r.body.ok).toBe(false);
  expect(r.body.code).toBe(code);
  expect(typeof r.body.error).toBe("string");
  expect(sorted(r.body).filter((x) => !["ok", "code", "error", "details"].includes(x))).toEqual([]);
}

describe("creative contract, in-process (scoped stubs)", () => {
  beforeAll(() => {
    for (const key of [...Object.keys(ENV), ...CLEAR]) saved[key] = process.env[key];
    for (const key of CLEAR) delete process.env[key];
    Object.assign(process.env, ENV);
    vi.stubGlobal("fetch", providerFetch);
  });
  afterAll(() => {
    vi.unstubAllGlobals();
    for (const [key, v] of Object.entries(saved)) if (v === undefined) delete process.env[key];
    else process.env[key] = v;
  });
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    resetProvider();
    const s = getSharedMemoryCreativeStore();
    s._raw.references.clear();
    s._raw.jobs.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    expect(provider.calls.blocked).toEqual([]); // nothing tried to leave the stand-in
  });

  describe("contract check: fixtures vs the real /api/creative handler (stand-in provider)", () => {
    it("jobs list, processing → succeeded job, outputs, fresh asset views", async () => {
      provider.pollsUntilDone = 2;
      const sub = await newJob();
      expect(sub.status).toBe(202);
      const jobId = sub.body.job.jobId;
      const list = await call("GET", "resource=jobs");
      expect(sorted(list.body)).toEqual(sorted(F.listBody([])));
      expectSameShape(list.body.jobs[0], F.jobView());
      expect(list.body.jobs[0].concept).toEqual(F.CONCEPT);
      expect(list.body.jobs[0].storage).toEqual(F.jobView().storage);
      expect(sorted(list.body.jobs[0].usage)).toEqual([...F.USAGE_KEYS].sort());
      expect(list.body.jobs[0].usage.billingOutcome).toBe("unconfirmed"); // sent, no cost reported yet (rev 2 §2.4)

      expectErrorBody(await call("GET", `resource=asset&jobId=${jobId}&index=0`), 409, "ASSET_NOT_READY");

      skipThrottle();
      const p1 = await call("GET", `resource=jobs&jobId=${jobId}`);
      expect(sorted(p1.body)).toEqual(["job", "ok", "refresh"]);
      expect(p1.body.refresh).toEqual({ ok: true });
      expect(p1.body.job.status).toBe("processing");
      expect(typeof p1.body.job.providerProgress).toBe("number"); // present, and never rendered by the gallery
      expectSameShape(p1.body.job, F.jobView());
      skipThrottle();
      const p2 = await call("GET", `resource=jobs&jobId=${jobId}`);
      expect(p2.body.job.status).toBe("succeeded");
      expectSameShape(p2.body.job, F.succeededJob());
      expect(p2.body.job.usage).toMatchObject({ billingOutcome: "reported", reportedCost: 12 });
      for (const o of p2.body.job.outputs) expect(sorted(o)).toEqual([...F.OUTPUT_KEYS].sort());

      const a1 = await call("GET", `resource=asset&jobId=${jobId}&index=0`);
      const a2 = await call("GET", `resource=asset&jobId=${jobId}&index=0`);
      expect(sorted(a1.body)).toEqual(["asset", "ok"]);
      expectSameShape(a1.body.asset, F.assetView(F.succeededJob(), 0));
      expect(a1.body.asset).toMatchObject({ expiresAt: null, expiryKnown: false, durableCopy: false, concept: F.CONCEPT });
      expect(a1.body.asset.url).not.toBe(a2.body.asset.url);

      provider.assetGone = true;
      const gone = await call("GET", `resource=asset&jobId=${jobId}&index=0`);
      expectErrorBody(gone, 410, "ASSET_UNAVAILABLE");
      expect(gone.body.details).toEqual(F.ERROR_RESPONSES.ASSET_UNAVAILABLE.body.details);
    });

    it("the list reads the store only; getJob is the call that refreshes", async () => {
      const jobId = (await newJob()).body.job.jobId;
      skipThrottle();
      const before = provider.calls.job;
      const list = await call("GET", "resource=jobs");
      expect(provider.calls.job).toBe(before);
      expect(list.body.jobs.find((j) => j.jobId === jobId).status).toBe("processing");
      expect((await call("GET", `resource=jobs&jobId=${jobId}`)).body.job.status).toBe("succeeded");
      expect(provider.calls.job).toBe(before + 1);
    });

    it("failed and submission_unknown job views", async () => {
      provider.outcome = "failure";
      const failedId = (await newJob()).body.job.jobId;
      skipThrottle();
      const f = await call("GET", `resource=jobs&jobId=${failedId}`);
      expect(f.body.job.status).toBe("failed");
      expectSameShape(f.body.job, F.failedJob());
      expect(sorted(f.body.job.error)).toEqual(["code", "message"]);
      expect(f.body.job.error.code).toBe("PROVIDER_GENERATION_FAILED");
      expect(f.body.job.usage.billingOutcome).toBe("unconfirmed"); // failed is NOT free (rev 2 §4)

      getSharedMemoryCreativeStore()._raw.jobs.clear();
      provider.dropGenerate = true;
      const generatesBefore = provider.calls.generate;
      const u = await newJob();
      expect(u.body.details).toMatchObject({ jobStatus: "submission_unknown", outcomeUnknown: true });
      const j = (await call("GET", "resource=jobs")).body.jobs[0];
      expect(j.status).toBe("submission_unknown");
      expectSameShape(j, F.unknownJob());
      expect(j.usage.billingOutcome).toBe("unconfirmed");
      expect(provider.calls.generate).toBe(generatesBefore + 1); // one paid call, never resubmitted
    });

    it("409 RECORD_INTEGRITY_FAILED on asset and getJob; the list drops the row", async () => {
      const jobId = (await newJob()).body.job.jobId;
      skipThrottle();
      await call("GET", `resource=jobs&jobId=${jobId}`);
      getSharedMemoryCreativeStore()._raw.jobs.get(jobId).outputs = [{ assetId: "asset_someone_else", format: "glb" }];
      expectErrorBody(await call("GET", `resource=asset&jobId=${jobId}&index=0`), 409, "RECORD_INTEGRITY_FAILED");
      expectErrorBody(await call("GET", `resource=jobs&jobId=${jobId}`), 409, "RECORD_INTEGRITY_FAILED");
      expect((await call("GET", "resource=jobs")).body.jobs.find((j) => j.jobId === jobId)).toBeUndefined();
    });

    it("401 MISSING_AUTH and 404 MISSING_JOB", async () => {
      expectErrorBody(await call("GET", "resource=jobs", { auth: false }), 401, "MISSING_AUTH");
      expectErrorBody(await call("GET", "resource=jobs&jobId=00000000-0000-4000-8000-000000000000"), 404, "MISSING_JOB");
      expectErrorBody(await call("GET", "resource=asset&jobId=00000000-0000-4000-8000-000000000000&index=0"), 404, "MISSING_JOB");
    });
  });

  /** Lets in-process Response bodies settle (they need real macrotask turns; setImmediate is not faked). */
  async function until(pred, what = "condition", turns = 400) {
    for (let i = 0; i < turns && !pred(); i++) await new Promise((r) => setImmediate(r));
    expect(pred(), `timed out waiting for ${what}`).toBe(true);
  }

  /** Test-only list adapter: the one call createCreativeAssetSource does not cover. */
  function listClient({ omitAuth = false } = {}) {
    return {
      async listJobs({ accessToken }) {
        const res = await apiFetch("/api/creative?resource=jobs", { headers: omitAuth ? {} : { Authorization: `Bearer ${accessToken}` } });
        const body = await res.json();
        if (!res.ok || !body?.ok) throw { status: res.status, code: body?.code, message: body?.error, details: body?.details };
        return body;
      },
    };
  }

  describe("contract check: the gallery on the real handler with Asset Engineer's real source", () => {
    it("lists, polls processing → succeeded, fresh URL per download, maps 410, and 401 signed-out", async () => {
      vi.useRealTimers(); // re-install: the beforeEach clock fakes Date only
      vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
      const jobId = (await newJob()).body.job.jobId;
      const doc = createFakeDocument();
      const root = doc.createElement("div");
      doc.body.appendChild(root);
      const downloads = [];
      const creativeSource = createCreativeAssetSource({ fetchImpl: apiFetch, getAuthToken: () => "test:user-a" });
      const g = mountConceptGallery(root, {
        client: listClient(),
        getAccessToken: () => "test:user-a",
        creativeSource,
        pollIntervalMs: 3000,
        startDownload: (d) => downloads.push(d),
      });
      await until(() => g.getState().list === "ready", "list ready");
      expect(g.getState()).toMatchObject({ list: "ready", polling: true });
      expect(g.getState().jobs[0]).toMatchObject({ jobId, status: "processing" });
      await vi.advanceTimersByTimeAsync(3000);
      await until(() => g.getState().jobs[0].status === "succeeded", "polled to succeeded");
      expect(g.getState().polling).toBe(false);
      expect(byAttr(byAttr(root, "data-job-id", jobId)[0], "data-concept-notice")[0].textContent).toBe(F.CONCEPT.notice);

      byAttr(root, "data-action", "download")[0].click();
      await until(() => downloads.length === 1);
      byAttr(root, "data-action", "download")[0].click();
      await until(() => downloads.length === 2);
      expect(downloads).toHaveLength(2);
      expect(downloads[0].url).not.toBe(downloads[1].url);
      expect(downloads[0].filename).toBe(`furniai-concept-${jobId}-0.glb`);
      expect(JSON.stringify(g.getState())).not.toContain("cdn.stand-in.invalid");

      provider.assetGone = true;
      byAttr(root, "data-action", "download")[0].click();
      await until(() => byAttr(root, "data-asset-error", "ASSET_UNAVAILABLE").length === 1);
      g.destroy();

      const root2 = createFakeDocument().createElement("div");
      const g2 = mountConceptGallery(root2, { client: listClient({ omitAuth: true }), getAccessToken: () => "x", creativeSource });
      await until(() => g2.getState().list === "error", "401 list");
      expect(g2.getState().error).toMatchObject({ kind: "signed_out", code: "MISSING_AUTH", status: 401 });
      g2.destroy();

      // A real (non-test) bearer without Supabase on this box: the handler answers 503 PERSISTENCE_NOT_CONFIGURED.
      const root3 = createFakeDocument().createElement("div");
      const g3 = mountConceptGallery(root3, { client: listClient(), getAccessToken: () => "not-a-test-token", creativeSource });
      await until(() => g3.getState().list === "error", "503 list");
      expect(g3.getState().error).toMatchObject({ kind: "not_configured", code: "PERSISTENCE_NOT_CONFIGURED", status: 503 });
      g3.destroy();
    });
  });
});
