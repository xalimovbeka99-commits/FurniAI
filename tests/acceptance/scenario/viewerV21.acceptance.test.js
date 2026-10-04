/**
 * SIMULATED / MOCKED / LOCAL — independent acceptance of asset viewer v2.1
 * (grok/asset-viewer b34e259: V1–V6) against the PROPOSED contract
 * (docs/creative/SCENARIO_3D_API_CONTRACT.md §2.5 "if a load fails, call it
 * again once"; §4 error codes) and the REAL /api/creative handler.
 *
 * Written by Grok QA from the contract + the Integration brief, not from the
 * Asset Engineer's own tests (tests/assetViewer/creativeRetry.test.js). REAL:
 * api/creative.js + creativeService + scenarioClient + memory store over HTTP
 * (support/apiHarness.js), createCreativeAssetSource, mountAssetViewer v2.1 with
 * real three + GLTFLoader (only the GPU renderer / OrbitControls are fakes).
 * MOCKED: the Scenario provider + CDN (support/fixtureProvider.js). Some answers
 * the real handler cannot be made to give locally (a transport failure, a bare
 * 403, a malformed 2xx) are injected at the /api/creative fetch boundary; each
 * test says which. No Scenario network, no paid call, no hosted DB. LIVE: NOT RUN.
 */
import { createHash } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createCreativeAssetSource, ERROR_MESSAGE } from "../../../src/lib/assetViewer/index.js";
import { DEFAULT_CONCEPT_NOTICE, isRetryableResolveError } from "../../../src/lib/assetViewer/creativeAsset.js";
import { CONCEPT_NOTICE } from "../../../src/lib/creative/creativeService.js";
import { mountForTest } from "../../assetViewer/helpers/mountHarness.js";
import { installImageBitmapShim } from "../../assetViewer/helpers/fixtures.js";
import { startFixtureProvider, CDN_HOST } from "./support/fixtureProvider.js";
import { applyEnv, fixtureEnv, makeClock, resetStore, restoreEnv, startApi, store, PNG } from "./support/apiHarness.js";

const CUBE_SHA256 = "7760387b6369181213eb1d54f7bd393bb83c47214f8010482a6deecdbb12b49c"; // tests/fixtures/scenario/manifest.json
let api, fx, shim;
const clock = makeClock(vi);
beforeAll(async () => { api = await startApi(); fx = await startFixtureProvider(); shim = installImageBitmapShim(); });
afterAll(async () => { shim.restore(); await api.close(); await fx.close(); });
const mounted = [];
beforeEach(() => { fx.reset(); applyEnv(fixtureEnv(fx.baseUrl)); resetStore(); clock.on(); });
afterEach(() => { for (const t of mounted.splice(0)) t.viewer.dispose(); clock.off(); restoreEnv(); });

const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function succeededJob(user = "user-a", key = "viewer-v21-0001") {
  const ref = (await api.upload(PNG, { user })).body.reference.referenceId;
  const s = await api.submit(ref, key, { user });
  expect(s.status).toBe(202);
  expect((await api.job(s.body.job.jobId, { user })).body.job.status).toBe("succeeded");
  return s.body.job.jobId;
}

/**
 * The real resolver over the real handler. `inject` is a queue consumed by
 * /api/creative asset calls: undefined → pass through; a function → its Response
 * (or throw) replaces the network; "real:<mode>" → set the MOCKED provider's
 * assetMode for this call only (the real handler then answers).
 * `rewrite(body)` may edit a real 200 asset body (used only for the notice tests).
 */
function viewerOn({ user = "user-a", inject = [], rewrite, options = {} } = {}) {
  const calls = [];
  const apiFetch = async (url, init = {}) => {
    const u = new URL(String(url));
    const call = { resource: u.searchParams.get("resource"), jobId: u.searchParams.get("jobId"), cache: init.cache };
    calls.push(call);
    const step = call.resource === "asset" ? inject.shift() : undefined;
    if (typeof step === "function") {
      call.injected = true;
      try { const r = await step(); call.status = r.status; return r; } catch (e) { call.status = "network"; throw e; }
    }
    if (typeof step === "string" && step.startsWith("real:")) fx.state.assetMode = step.slice(5);
    const res = await fetch(url, init);
    fx.state.assetMode = "ok";
    call.status = res.status;
    if (rewrite && call.resource === "asset" && res.ok) {
      const body = await res.json();
      return json(res.status, rewrite(body));
    }
    return res;
  };
  const source = createCreativeAssetSource({ fetchImpl: apiFetch, getAuthToken: () => `test:${user}`, baseUrl: api.url });
  const cdn = [];
  const cdnFetch = async (url, init) => {
    const e = { url: String(url) };
    cdn.push(e);
    expect(e.url.startsWith(`${CDN_HOST}/`)).toBe(true);
    const res = await fetch(fx.cdnLocalUrl(e.url), { signal: init?.signal });
    e.status = res.status;
    if (res.ok) e.sha256 = sha(Buffer.from(await res.clone().arrayBuffer()));
    return res;
  };
  const t = mountForTest({ options: { creativeSource: source, fetch: cdnFetch, ...options } });
  mounted.push(t);
  const assetCalls = () => calls.filter((c) => c.resource === "asset");
  return { t, viewer: t.viewer, source, calls, assetCalls, cdn, overlay: (a) => t.container.find(a) };
}

// Failure kinds that MUST get exactly one fresh re-resolve (contract §2.5 + Integration brief V1/V5).
const network = () => { throw new TypeError("fetch failed"); };
const RETRYABLE = [
  { name: "network error (fetch rejects)", step: network, code: "RESOLVE_FAILED", cause: "network" },
  { name: "real 502 PROVIDER_UNAVAILABLE (provider asset lookup 500)", step: "real:http500", code: "PROVIDER_UNAVAILABLE", status: 502, cause: "http" },
  { name: "real 429 PROVIDER_RATE_LIMITED (provider asset lookup 429)", step: "real:http429", code: "PROVIDER_UNAVAILABLE", status: 429, cause: "http" },
  { name: "injected 503 with no code (proxy page)", step: () => new Response("<html>503</html>", { status: 503 }), code: "SERVICE_UNAVAILABLE", status: 503, cause: "http" },
  { name: "injected 500 INTERNAL (unknown server code)", step: () => json(500, { ok: false, code: "INTERNAL", error: "boom" }), code: "RESOLVE_FAILED", status: 500, cause: "http" },
];
// 4xx (and not-configured 503) answers a second identical GET cannot change: never retried.
const NOT_RETRIED = [
  { name: "real 404 MISSING_JOB (unknown jobId)", jobId: "00000000-0000-4000-8000-000000000000", code: "CONCEPT_NOT_FOUND", status: 404 },
  { name: "real 410 ASSET_UNAVAILABLE", step: "real:gone404", code: "ASSET_UNAVAILABLE", status: 410 },
  { name: "real 409 ASSET_NOT_READY", prep: (jobId) => { store()._raw.jobs.get(jobId).status = "processing"; }, code: "ASSET_NOT_READY", status: 409 },
  { name: "real 409 RECORD_INTEGRITY_FAILED", prep: (jobId) => { store()._raw.jobs.get(jobId).outputs = [{ assetId: "asset_someone_else", format: "glb" }]; }, code: "RECORD_INTEGRITY_FAILED", status: 409 },
  { name: "injected 401 MISSING_AUTH", step: () => json(401, { ok: false, code: "MISSING_AUTH" }), code: "SIGN_IN_REQUIRED", status: 401 },
  { name: "injected 403 UNAUTHORIZED", step: () => json(403, { ok: false, code: "UNAUTHORIZED" }), code: "FORBIDDEN", status: 403 },
  { name: "injected bare 403 (no body)", step: () => new Response("", { status: 403 }), code: "FORBIDDEN", status: 403 },
  { name: "injected 402 PROVIDER_INSUFFICIENT_CREDITS", step: () => json(402, { ok: false, code: "PROVIDER_INSUFFICIENT_CREDITS" }), code: "PROVIDER_UNAVAILABLE", status: 402 },
  { name: "injected 400 BAD_REQUEST", step: () => json(400, { ok: false, code: "BAD_REQUEST" }), code: "INVALID_ASSET", status: 400 },
  { name: "injected 503 CREATIVE_NOT_CONFIGURED", step: () => json(503, { ok: false, code: "CREATIVE_NOT_CONFIGURED" }), code: "CONCEPTS_NOT_CONFIGURED", status: 503 },
];

describe("V1 load(): exactly ONE fresh re-resolve on a transient resolve failure (network, 5xx, 429)", () => {
  for (const k of RETRYABLE) {
    it(`${k.name}: fail → re-resolve → shown; fail twice → error after exactly 2 resolves, no CDN fetch`, async () => {
      const jobId = await succeededJob();
      const a = viewerOn({ inject: [k.step] });
      const r1 = await a.viewer.load({ jobId, index: 0, format: "glb" });
      expect(r1.ok).toBe(true);
      const s1 = a.viewer.getState();
      expect(s1.status).toBe("ready");
      expect(s1.attempts).toEqual({ resolve: 2, display: 1 });
      expect(a.assetCalls().map((c) => c.cache)).toEqual(["no-store", "no-store"]);
      expect(a.assetCalls()[1].status).toBe(200);
      expect(a.t.states.some((s) => s.phase === "retrying"), "a 'retrying' phase is published").toBe(true);
      expect(a.cdn).toHaveLength(1);
      expect(a.cdn[0].sha256).toBe(CUBE_SHA256);

      const b = viewerOn({ inject: [k.step, k.step] });
      const r2 = await b.viewer.load({ jobId, index: 0, format: "glb" });
      expect(r2.ok).toBe(false);
      const s2 = b.viewer.getState();
      expect(s2.status).toBe("error");
      expect(s2.model).toBeNull();
      expect(b.assetCalls(), "no third resolve").toHaveLength(2);
      expect(b.cdn).toHaveLength(0);
      expect(s2.error.code).toBe(k.code);
      expect(s2.attempts.resolve).toBe(2);
      expect(s2.actions.download, "nothing resolved, so nothing to download").toBe(false);
      if (k.status) expect(s2.error.status).toBe(k.status);
    });
  }
});

describe("V5 download(): exactly ONE fresh re-resolve on the same transient failures; viewer state untouched", () => {
  for (const k of RETRYABLE) {
    it(`${k.name}: fail → re-resolve → fresh address; fail twice → ok:false after exactly 2 resolves`, async () => {
      const jobId = await succeededJob();
      const a = viewerOn({ inject: [k.step] });
      const d1 = await a.viewer.download({ jobId, index: 0 });
      expect(d1).toMatchObject({ ok: true, jobId, index: 0, format: "glb", freshlyResolved: true, attempts: { resolve: 2 } });
      expect(d1.url.startsWith(`${CDN_HOST}/`)).toBe(true);
      expect(fx.state.issuedUrls).toContain(d1.url);
      expect(a.assetCalls()).toHaveLength(2);
      expect(a.viewer.getState().status, "a download never changes what is on screen").toBe("idle");

      const b = viewerOn({ inject: [k.step, k.step] });
      const d2 = await b.viewer.download({ jobId, index: 0 });
      expect(d2.ok).toBe(false);
      expect(d2.attempts).toEqual({ resolve: 2 });
      expect(d2.error.code).toBe(k.code);
      expect(JSON.stringify(d2)).not.toMatch(/cdn\.fixture\.invalid|sig=/);
      expect(b.assetCalls()).toHaveLength(2);
      expect(b.cdn).toHaveLength(0);
    });
  }
});

describe("V1/V5: NO retry on 4xx (and not-configured) answers — load and download each make exactly one call", () => {
  for (const k of NOT_RETRIED) {
    it(`${k.name} → ${k.code}, 1 resolve for load, 1 for download`, async () => {
      const real = await succeededJob();
      if (k.prep) k.prep(real);
      const jobId = k.jobId || real;
      const a = viewerOn({ inject: [k.step, k.step] });
      const r = await a.viewer.load({ jobId, index: 0, format: "glb" });
      expect(r.ok).toBe(false);
      const s = a.viewer.getState();
      expect(s.error.code).toBe(k.code);
      expect(s.error.status).toBe(k.status);
      expect(s.attempts.resolve).toBe(1);
      expect(a.t.states.some((x) => x.phase === "retrying")).toBe(false);
      expect(a.overlay("data-av-status").textContent).toBe(ERROR_MESSAGE[k.code]);
      expect(a.cdn).toHaveLength(0);
      const b = viewerOn({ inject: [k.step, k.step] });
      const d = await b.viewer.download({ jobId, index: 0 });
      expect(d).toMatchObject({ ok: false, attempts: { resolve: 1 }, error: { code: k.code } });
      expect(a.assetCalls().length + b.assetCalls().length).toBe(2);
    });
  }
});

describe("V2 RESOLVE_FAILED vs RESOLVE_MALFORMED", () => {
  it("a transport failure is RESOLVE_FAILED with details.cause 'network', retryable", async () => {
    const jobId = await succeededJob();
    const a = viewerOn({ inject: [network] });
    const err = await a.source.resolve(jobId, 0).catch((e) => e);
    expect(err).toMatchObject({ code: "RESOLVE_FAILED", details: { cause: "network", retryable: true } });
    expect(isRetryableResolveError(err)).toBe(true);
  });

  const MALFORMED = [
    ["200 that is not JSON", () => new Response("<html>ok</html>", { status: 200 })],
    ["200 {ok:false}", () => json(200, { ok: false })],
    ["200 ok:true without asset", () => json(200, { ok: true })],
    ["200 asset without url", (jobId) => json(200, { ok: true, asset: { jobId, index: 0, format: "glb" } })],
    ["200 asset with a non-http url", (jobId) => json(200, { ok: true, asset: { jobId, index: 0, format: "glb", url: "javascript:alert(1)" } })],
    ["200 asset for a different job", () => json(200, { ok: true, asset: { jobId: "11111111-1111-4111-8111-111111111111", index: 0, format: "glb", url: `${CDN_HOST}/x.glb` } })],
    ["200 asset for a different index", (jobId) => json(200, { ok: true, asset: { jobId, index: 1, format: "glb", url: `${CDN_HOST}/x.glb` } })],
  ];
  for (const [name, mk] of MALFORMED) {
    it(`${name} → RESOLVE_MALFORMED (cause 'malformed'), never retried by load or download, no CDN fetch`, async () => {
      const jobId = await succeededJob();
      const step = () => mk(jobId);
      const a = viewerOn({ inject: [step, step, step] });
      const err = await a.source.resolve(jobId, 0).catch((e) => e);
      expect(err).toMatchObject({ code: "RESOLVE_MALFORMED", details: { cause: "malformed", retryable: false } });
      expect(err.code).not.toBe("RESOLVE_FAILED");
      const r = await a.viewer.load({ jobId, index: 0, format: "glb" });
      expect(r.ok).toBe(false);
      expect(a.viewer.getState().error.code).toBe("RESOLVE_MALFORMED");
      expect(a.overlay("data-av-status").textContent).toBe(ERROR_MESSAGE.RESOLVE_MALFORMED);
      const d = await a.viewer.download({ jobId, index: 0 });
      expect(d).toMatchObject({ ok: false, attempts: { resolve: 1 }, error: { code: "RESOLVE_MALFORMED" } });
      expect(a.assetCalls(), "1 direct + 1 load + 1 download").toHaveLength(3);
      expect(a.cdn).toHaveLength(0);
    });
  }

  it("FINDING (not network-only): an unknown server code (500 INTERNAL) is also RESOLVE_FAILED, with cause 'http' — the code alone does not mean 'network'", async () => {
    const jobId = await succeededJob();
    const a = viewerOn({ inject: [() => json(500, { ok: false, code: "INTERNAL" })] });
    const err = await a.source.resolve(jobId, 0).catch((e) => e);
    expect(err).toMatchObject({ code: "RESOLVE_FAILED", status: 500, serverCode: "INTERNAL", details: { cause: "http", retryable: true } });
  });
});

describe("V3 403 is FORBIDDEN (signed in, not allowed) — never 'please sign in'", () => {
  for (const [name, step] of [["403 code UNAUTHORIZED", () => json(403, { ok: false, code: "UNAUTHORIZED", error: "not allowed" })], ["bare 403, no body", () => new Response(null, { status: 403 })], ["403 HTML page", () => new Response("<html>Forbidden</html>", { status: 403 })]]) {
    it(`${name} → FORBIDDEN with the FORBIDDEN message`, async () => {
      const jobId = await succeededJob();
      const a = viewerOn({ inject: [step, step] });
      const err = await a.source.resolve(jobId, 0).catch((e) => e);
      expect(err).toMatchObject({ code: "FORBIDDEN", status: 403, details: { cause: "http", retryable: false } });
      await a.viewer.load({ jobId, index: 0, format: "glb" });
      expect(a.viewer.getState().error.code).toBe("FORBIDDEN");
      expect(a.overlay("data-av-status").textContent).toBe(ERROR_MESSAGE.FORBIDDEN);
      expect(a.overlay("data-av-status").textContent).not.toMatch(/sign in to/i);
    });
  }
  it("401 (signed out) is still SIGN_IN_REQUIRED, so the two are distinguishable", async () => {
    const jobId = await succeededJob();
    const a = viewerOn({ inject: [() => new Response(null, { status: 401 })] });
    await expect(a.source.resolve(jobId, 0)).rejects.toMatchObject({ code: "SIGN_IN_REQUIRED", status: 401 });
  });
});

describe("V4 the concept notice is shown VERBATIM", () => {
  it("the real handler's notice reaches state and overlay byte-for-byte", async () => {
    const jobId = await succeededJob();
    const a = viewerOn();
    await a.viewer.load({ jobId, index: 0, format: "glb" });
    expect(a.viewer.getState().concept).toMatchObject({ notice: CONCEPT_NOTICE.notice, noticeSource: "server" });
    expect(a.overlay("data-av-concept").textContent).toBe(CONCEPT_NOTICE.notice);
  });

  it("a non-blank server notice is never trimmed, collapsed, truncated or rewritten (whitespace, newlines, 2 kB, markup-like text)", async () => {
    const odd = `  Concept only —\n\tnot   a manufacturable design.  <b>not html</b> ${"long ".repeat(400)}end  `;
    const jobId = await succeededJob();
    const a = viewerOn({ rewrite: (b) => ({ ...b, asset: { ...b.asset, concept: { ...b.asset.concept, notice: odd } } }) });
    await a.viewer.load({ jobId, index: 0, format: "glb" });
    expect(a.viewer.getState().concept.notice).toBe(odd);
    expect(a.overlay("data-av-concept").textContent).toBe(odd);
    const d = await a.viewer.download({ jobId, index: 0 });
    expect(d.concept.notice).toBe(odd);
  });

  for (const [name, concept] of [["blank notice", { notice: "   \n " }], ["no notice field", {}], ["no concept object", undefined]]) {
    it(`${name} → the viewer default, which equals the server's CONCEPT_NOTICE text (no drift)`, async () => {
      expect(DEFAULT_CONCEPT_NOTICE).toBe(CONCEPT_NOTICE.notice);
      const jobId = await succeededJob();
      const a = viewerOn({ rewrite: (b) => ({ ...b, asset: { ...b.asset, concept } }) });
      await a.viewer.load({ jobId, index: 0, format: "glb" });
      expect(a.viewer.getState().concept).toMatchObject({ notice: CONCEPT_NOTICE.notice, noticeSource: "viewer-default" });
      expect(a.overlay("data-av-concept").textContent).toBe(CONCEPT_NOTICE.notice);
    });
  }
});

describe("V6 renderConceptNotice", () => {
  for (const options of [{}, { renderConceptNotice: true }]) {
    it(`${JSON.stringify(options)}: the overlay shows the server notice (one copy)`, async () => {
      const jobId = await succeededJob();
      const a = viewerOn({ options });
      await a.viewer.load({ jobId, index: 0, format: "glb" });
      const node = a.overlay("data-av-concept");
      expect(node.textContent).toBe(CONCEPT_NOTICE.notice);
      expect(node.style.display).not.toBe("none");
      expect(node.getAttribute("data-av-concept-host-rendered")).toBeNull();
      expect(a.t.doc.created.filter((e) => e.attributes && "data-av-concept" in e.attributes)).toHaveLength(1);
    });
  }
  it("false: the overlay renders no notice (marked host-rendered) in ready AND error states, but getState() still carries it for the host", async () => {
    const jobId = await succeededJob();
    const a = viewerOn({ options: { renderConceptNotice: false }, inject: [undefined, () => json(410, { ok: false, code: "ASSET_UNAVAILABLE" })] });
    const node = a.overlay("data-av-concept");
    expect(node.getAttribute("data-av-concept-host-rendered")).toBe("");
    await a.viewer.load({ jobId, index: 0, format: "glb" });
    expect(a.viewer.getState().status).toBe("ready");
    expect(node.textContent).toBe("");
    expect(node.style.display).toBe("none");
    expect(a.viewer.getState().concept).toMatchObject({ notice: CONCEPT_NOTICE.notice, noticeSource: "server" });
    await a.viewer.load({ jobId, index: 0, format: "glb" });
    expect(a.viewer.getState().status).toBe("error");
    expect(node.textContent).toBe("");
    expect(a.overlay("data-av-status").textContent).toBe(ERROR_MESSAGE.ASSET_UNAVAILABLE);
    expect(a.viewer.getState().concept.notice).toBe(CONCEPT_NOTICE.notice);
  });
});
