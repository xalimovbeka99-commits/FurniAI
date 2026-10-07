/**
 * v2.1 hardening (V1, V5, V6) against the SIMULATED /api/creative stand-in
 * (fixtures only, not Scenario). Signed addresses are single use, so any
 * reuse of a url fails these tests.
 *
 * V1  load(): ONE re-resolve on a retryable resolve failure (network, 5xx, 429);
 *     never on 401/403/404/409/410, ASSET_NOT_READY, integrity, malformed, *_NOT_CONFIGURED.
 * V5  download(): the same rule, a fresh url every time, and download({ jobId, index }).
 * V6  renderConceptNotice:false hides only the overlay's notice; state still carries it.
 *
 * v3: retries are OPT-IN (autoRetry, default false; Bekzod's rule: retries only when the
 * user starts them). This file pins the opt-in autoRetry:true behaviour (= v2.1), so every
 * viewer here is mounted with autoRetry:true. The default is pinned in autoRetry.test.js.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCreativeAssetSource, DEFAULT_CONCEPT_NOTICE, ERROR_MESSAGE } from "../../src/lib/assetViewer/index.js";
import { SIM_CONCEPT, SIM_TOKEN } from "./helpers/creativeStandIn.js";
import { clickedAnchors, mountCreative as mountCreativeDefault } from "./helpers/creativeHarness.js";
import { mountForTest as mountForTestDefault } from "./helpers/mountHarness.js";
import { installImageBitmapShim } from "./helpers/fixtures.js";

let shim;
beforeAll(() => (shim = installImageBitmapShim()));
afterAll(() => shim.restore());

const optIn = (o = {}) => ({ ...o, options: { autoRetry: true, ...(o.options || {}) } });
const mountCreative = (o) => mountCreativeDefault(optIn(o));
const mountForTest = (o) => mountForTestDefault(optIn(o));

const assetCalls = (t) => t.sim.count("api", "asset");

/** A viewer whose /api/creative fetch throws a network error for the first `failures` asset calls. */
function mountWithNetworkBlips(failures) {
  const t = mountCreative();
  let left = failures;
  const apiFetch = (url, init) => {
    if (String(url).includes("resource=asset") && left > 0) {
      left -= 1;
      return Promise.reject(new TypeError("Failed to fetch"));
    }
    return t.sim.fetch(url, init);
  };
  const source = createCreativeAssetSource({ fetchImpl: apiFetch, getAuthToken: () => SIM_TOKEN });
  const cdn = [];
  const u = mountForTest({ options: { fetch: (url, i) => (cdn.push(String(url)), t.sim.fetch(url, i)), creativeSource: source } });
  return { t, u, cdn, attemptsMade: () => failures - left };
}

describe("V1: load() re-resolves ONCE on a retryable resolve failure", () => {
  it.each([
    [503, "STORAGE_UNAVAILABLE"],
    [503, "AUTH_UNAVAILABLE"],
    [502, "PROVIDER_UNAVAILABLE"],
    [502, "PROVIDER_UNEXPECTED_RESPONSE"],
    [429, "PROVIDER_RATE_LIMITED"],
    [500, "INTERNAL"],
  ])("one %i %s, then success -> ready after exactly 2 resolves and 1 mesh fetch", async (status, code) => {
    const t = mountCreative();
    t.sim.failNext({ resource: "asset", status, code });
    const r = await t.viewer.load({ jobId: "sim-glb-chair", index: 0, format: "glb" });
    expect(r.ok).toBe(true);
    expect(assetCalls(t)).toBe(2);
    expect(t.cdnCalls).toHaveLength(1);
    expect(t.viewer.getState()).toMatchObject({ status: "ready", attempts: { resolve: 2, display: 1 }, error: null, concept: { notice: SIM_CONCEPT.notice } });
    expect(t.states.some((s) => s.phase === "retrying")).toBe(true);
    expect(t.errors).toEqual([]);
    expect(t.tokenCalls.n).toBe(2); // a fresh token for the retry too
    t.viewer.dispose();
  });

  it("a network error on resolve (RESOLVE_FAILED, cause network) is retried once -> ready", async () => {
    const { t, u, cdn, attemptsMade } = mountWithNetworkBlips(1);
    const r = await u.viewer.load({ jobId: "sim-glb-chair", index: 0 });
    expect(r.ok).toBe(true);
    expect(attemptsMade()).toBe(1);
    expect(t.sim.count("api", "asset")).toBe(1); // the blip never reached the stand-in
    expect(cdn).toHaveLength(1);
    expect(u.viewer.getState()).toMatchObject({ status: "ready", attempts: { resolve: 2, display: 1 } });
    u.viewer.dispose();
    t.viewer.dispose();
  });

  it("two network errors -> RESOLVE_FAILED after exactly 2 attempts (no third), cause network, attempts in the record", async () => {
    const { t, u, cdn, attemptsMade } = mountWithNetworkBlips(5);
    const r = await u.viewer.load({ jobId: "sim-glb-chair", index: 0 });
    expect(r.ok).toBe(false);
    expect(attemptsMade()).toBe(2);
    expect(cdn).toHaveLength(0);
    expect(u.viewer.getState()).toMatchObject({
      status: "error",
      error: { code: "RESOLVE_FAILED", message: ERROR_MESSAGE.RESOLVE_FAILED, details: { cause: "network", retryable: true }, attempts: { resolve: 2, display: 0 } },
      attempts: { resolve: 2, display: 0 },
      actions: { download: false },
    });
    expect(u.errors).toHaveLength(1);
    u.viewer.dispose();
    t.viewer.dispose();
  });

  it("two 429s -> PROVIDER_UNAVAILABLE after exactly 2 resolves", async () => {
    const t = mountCreative();
    for (let i = 0; i < 3; i++) t.sim.failNext({ resource: "asset", status: 429, code: "PROVIDER_RATE_LIMITED" });
    await t.viewer.load({ jobId: "sim-glb-chair", index: 0 });
    expect(assetCalls(t)).toBe(2);
    expect(t.viewer.getState().error).toMatchObject({ code: "PROVIDER_UNAVAILABLE", status: 429, serverCode: "PROVIDER_RATE_LIMITED", attempts: { resolve: 2, display: 0 } });
    expect(t.cdnCalls).toHaveLength(0);
    expect(t.errors).toHaveLength(1);
    t.viewer.dispose();
  });

  it.each([
    [401, "MISSING_AUTH", "SIGN_IN_REQUIRED"],
    [403, "UNAUTHORIZED", "FORBIDDEN"],
    [404, "MISSING_JOB", "CONCEPT_NOT_FOUND"],
    [409, "ASSET_NOT_READY", "ASSET_NOT_READY"],
    [409, "RECORD_INTEGRITY_FAILED", "RECORD_INTEGRITY_FAILED"],
    [410, "ASSET_UNAVAILABLE", "ASSET_UNAVAILABLE"],
    [402, "PROVIDER_INSUFFICIENT_CREDITS", "PROVIDER_UNAVAILABLE"],
    [503, "CREATIVE_NOT_CONFIGURED", "CONCEPTS_NOT_CONFIGURED"],
    [400, "BAD_REQUEST", "INVALID_ASSET"],
  ])("NOT retried: %i %s -> %s after 1 resolve", async (status, code, viewerCode) => {
    const t = mountCreative();
    t.sim.failNext({ resource: "asset", status, code });
    await t.viewer.load({ jobId: "sim-glb-chair", index: 0 });
    expect(assetCalls(t)).toBe(1);
    expect(t.viewer.getState().error).toMatchObject({ code: viewerCode, status, details: { cause: "http", retryable: false } });
    expect(t.states.some((s) => s.phase === "retrying")).toBe(false);
    t.viewer.dispose();
  });

  it("NOT retried: a malformed 200 body -> RESOLVE_MALFORMED after 1 resolve", async () => {
    let n = 0;
    const source = createCreativeAssetSource({
      fetchImpl: async () => (n++, new Response(JSON.stringify({ ok: true, asset: { jobId: "j", index: 0, format: "glb" } }), { status: 200 })),
      getAuthToken: () => "t",
    });
    const u = mountForTest({ options: { creativeSource: source } });
    await u.viewer.load({ jobId: "j", index: 0 });
    expect(n).toBe(1);
    expect(u.viewer.getState().error).toMatchObject({ code: "RESOLVE_MALFORMED", message: ERROR_MESSAGE.RESOLVE_MALFORMED, details: { cause: "malformed", retryable: false } });
    expect(u.container.find("data-av-concept").textContent).toBe(DEFAULT_CONCEPT_NOTICE);
    u.viewer.dispose();
  });

  it("NOT retried: no token (SIGN_IN_REQUIRED before any request)", async () => {
    const t = mountCreative({ getAuthToken: () => null });
    await t.viewer.load({ jobId: "sim-glb-chair", index: 0 });
    expect(t.apiCalls).toHaveLength(0);
    expect(t.viewer.getState()).toMatchObject({ error: { code: "SIGN_IN_REQUIRED" }, attempts: { resolve: 1 } });
    t.viewer.dispose();
  });

  it("independent budgets: 503 on resolve, then an expired first address -> 3 resolves, 2 distinct fetches, ready", async () => {
    const t = mountCreative();
    t.sim.failNext({ resource: "asset", status: 503, code: "STORAGE_UNAVAILABLE" });
    const r = await t.viewer.load({ jobId: "sim-expired-url", index: 0, format: "glb" });
    expect(r.ok).toBe(true);
    expect(assetCalls(t)).toBe(3);
    const urls = t.cdnCalls.map((c) => c.url);
    expect(urls).toHaveLength(2);
    expect(urls[0]).not.toBe(urls[1]);
    expect(t.viewer.getState()).toMatchObject({ status: "ready", attempts: { resolve: 3, display: 2 } });
    t.viewer.dispose();
  });

  it("the re-resolve of a display retry is not itself retried (bounded: 2 resolves, 1 fetch)", async () => {
    const t = mountCreative();
    let n = 0;
    const src = {
      resolve: async (...a) => {
        n += 1;
        if (n === 2) t.sim.failNext({ resource: "asset", status: 503, code: "STORAGE_UNAVAILABLE" });
        return t.source.resolve(...a);
      },
    };
    const cdn = [];
    const u = mountForTest({ options: { fetch: (url, i) => (cdn.push(url), t.sim.fetch(url, i)), creativeSource: src } });
    await u.viewer.load({ jobId: "sim-corrupt", index: 0 });
    expect(n).toBe(2);
    expect(cdn).toHaveLength(1);
    expect(u.viewer.getState().error).toMatchObject({ code: "SERVICE_UNAVAILABLE", status: 503 });
    u.viewer.dispose();
    t.viewer.dispose();
  });

  it("a newer load started during the resolve retry supersedes it: no onError, no stale state", async () => {
    const t = mountCreative();
    let q = null;
    let n = 0;
    const src = {
      resolve: async (jobId, ...rest) => {
        n += 1;
        if (n === 1) t.sim.failNext({ resource: "asset", status: 503, code: "STORAGE_UNAVAILABLE" });
        if (n === 2) q = u.viewer.load({ jobId: "sim-glb-table", index: 0 }); // arrives while the retry is in flight
        return t.source.resolve(jobId, ...rest);
      },
    };
    const u = mountForTest({ options: { fetch: t.sim.fetch, creativeSource: src } });
    const p = await u.viewer.load({ jobId: "sim-glb-chair", index: 0 });
    expect(p.superseded).toBe(true);
    expect((await q).ok).toBe(true);
    expect(n).toBe(3);
    expect(u.viewer.getState()).toMatchObject({ status: "ready", job: { jobId: "sim-glb-table" }, attempts: { resolve: 1, display: 1 } });
    expect(u.errors).toEqual([]);
    u.viewer.dispose();
    t.viewer.dispose();
  });
});

describe("V5: download() re-resolves fresh, retries once, accepts an explicit reference", () => {
  it("transient 503 on download -> one more fresh resolve -> ok; never the display url", async () => {
    const t = mountCreative();
    await t.viewer.load({ jobId: "sim-glb-chair", index: 0 });
    const displayUrl = t.cdnCalls[0].url;
    t.sim.failNext({ resource: "asset", status: 503, code: "STORAGE_UNAVAILABLE" });
    const d = await t.viewer.download({ save: true });
    expect(d).toMatchObject({ ok: true, freshlyResolved: true, attempts: { resolve: 2 }, jobId: "sim-glb-chair", index: 0, concept: { notice: SIM_CONCEPT.notice } });
    expect(d.url).not.toBe(displayUrl);
    expect(assetCalls(t)).toBe(3);
    const a = clickedAnchors(t.doc);
    expect(a).toHaveLength(1);
    expect(a[0].href).toBe(d.url);
    expect((await t.sim.fetch(d.url)).status).toBe(200); // fresh and unused until now
    expect(t.viewer.getState()).toMatchObject({ status: "ready", attempts: { resolve: 1, display: 1 } }); // download leaves state alone
    t.viewer.dispose();
  });

  it("network error on download is retried once; two of them -> { ok:false, RESOLVE_FAILED, attempts 2 }, nothing clicked", async () => {
    const one = mountWithNetworkBlips(0);
    await one.u.viewer.load({ jobId: "sim-fbx", index: 0, format: "fbx" });
    one.t.sim.failNext({ resource: "asset", status: 502, code: "PROVIDER_UNAVAILABLE" });
    expect(await one.u.viewer.download()).toMatchObject({ ok: true, attempts: { resolve: 2 } });
    one.u.viewer.dispose();
    one.t.viewer.dispose();

    const two = mountWithNetworkBlips(2);
    await two.u.viewer.load({ jobId: "sim-fbx", index: 0, format: "fbx" }); // download-only: no resolve yet
    const d = await two.u.viewer.download({ save: true });
    expect(two.attemptsMade()).toBe(2);
    expect(d).toMatchObject({ ok: false, attempts: { resolve: 2 }, error: { code: "RESOLVE_FAILED", details: { cause: "network" }, attempts: { resolve: 2 } } });
    expect(clickedAnchors(two.u.doc)).toHaveLength(0);
    expect(two.u.viewer.getState().status).toBe("download-only");
    two.u.viewer.dispose();
    two.t.viewer.dispose();
  });

  it.each([
    [410, "ASSET_UNAVAILABLE", "ASSET_UNAVAILABLE"],
    [403, "UNAUTHORIZED", "FORBIDDEN"],
    [409, "RECORD_INTEGRITY_FAILED", "RECORD_INTEGRITY_FAILED"],
  ])("download: %i %s is NOT retried -> %s after 1 resolve", async (status, code, viewerCode) => {
    const t = mountCreative();
    await t.viewer.load({ jobId: "sim-fbx", index: 0, format: "fbx" });
    t.sim.failNext({ resource: "asset", status, code });
    const d = await t.viewer.download({ save: true });
    expect(d).toMatchObject({ ok: false, attempts: { resolve: 1 }, error: { code: viewerCode, status } });
    expect(assetCalls(t)).toBe(1);
    expect(clickedAnchors(t.doc)).toHaveLength(0);
    t.viewer.dispose();
  });

  it("download({ jobId, index }) downloads another item without touching the one on screen", async () => {
    const t = mountCreative();
    await t.viewer.load({ jobId: "sim-glb-chair", index: 0 });
    const before = t.viewer.getState();
    const d = await t.viewer.download({ jobId: "sim-two-outputs", index: 1, save: true });
    expect(d).toMatchObject({ ok: true, jobId: "sim-two-outputs", index: 1, format: "glb", filename: "furniai-concept-sim-two-outputs-1.glb", concept: { notice: SIM_CONCEPT.notice }, attempts: { resolve: 1 } });
    expect(d.url).toMatch(/table-untextured\.glb/);
    expect(t.apiCalls.at(-1).url).toBe("/api/creative?resource=asset&jobId=sim-two-outputs&index=1");
    const a = clickedAnchors(t.doc);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ href: d.url, download: d.filename });
    const after = t.viewer.getState();
    expect(after).toEqual(before); // status, job, asset, model, concept, attempts unchanged
    // the displayed item is still the default target
    const cur = await t.viewer.download();
    expect(cur).toMatchObject({ ok: true, jobId: "sim-glb-chair", index: 0 });
    t.viewer.dispose();
  });

  it("download({ jobId }) works from idle and from an error state; index defaults to 0; every call resolves afresh", async () => {
    const t = mountCreative();
    expect(t.viewer.download()).toBeNull(); // nothing current, no ref
    const d1 = await t.viewer.download({ jobId: "sim-fbx" });
    const d2 = await t.viewer.download({ jobId: "sim-fbx", index: 0 });
    expect(d1).toMatchObject({ ok: true, jobId: "sim-fbx", index: 0, format: "fbx" });
    expect(d1.url).not.toBe(d2.url);
    expect(assetCalls(t)).toBe(2);
    expect(t.viewer.getState().status).toBe("idle");
    await t.viewer.load({ jobId: "sim-gone", index: 0 });
    expect(t.viewer.download()).toBeNull(); // the failed item itself is not downloadable
    expect(await t.viewer.download({ jobId: "sim-glb-table", index: 0 })).toMatchObject({ ok: true, jobId: "sim-glb-table" });
    expect(t.viewer.getState()).toMatchObject({ status: "error", error: { code: "ASSET_UNAVAILABLE" } });
    t.viewer.dispose();
    expect(t.viewer.download({ jobId: "sim-fbx" })).toBeNull(); // disposed
  });

  it("download({ jobId }) without a creativeSource -> { ok:false, MISSING_DEPENDENCY }; a bad jobId -> INVALID_ASSET", async () => {
    const u = mountForTest();
    expect(await u.viewer.download({ jobId: "x" })).toMatchObject({ ok: false, error: { code: "MISSING_DEPENDENCY" } });
    u.viewer.dispose();
    const t = mountCreative();
    expect(await t.viewer.download({ jobId: "" })).toMatchObject({ ok: false, error: { code: "INVALID_ASSET" }, attempts: { resolve: 1 } });
    expect(await t.viewer.download({ jobId: "sim-fbx", index: -1 })).toMatchObject({ ok: false, error: { code: "INVALID_ASSET" } });
    expect(t.apiCalls).toHaveLength(0);
    t.viewer.dispose();
  });

  it("no url from a download leaks into state, events or errors", async () => {
    const t = mountCreative();
    await t.viewer.load({ jobId: "sim-glb-chair", index: 0 });
    const d = await t.viewer.download({ jobId: "sim-fbx" });
    for (const b of [JSON.stringify(t.viewer.getState()), ...t.states.map((s) => JSON.stringify(s)), JSON.stringify(t.errors)]) {
      expect(b).not.toContain(d.url);
      expect(b).not.toMatch(/X-Sim-Signature|cdn\.sim\.invalid/);
    }
    t.viewer.dispose();
  });
});

describe("V6: renderConceptNotice:false (host renders the notice)", () => {
  it("overlay hides its notice in every state, but getState()/events still carry the server notice", async () => {
    const t = mountCreative({ options: { renderConceptNotice: false } });
    const node = t.container.find("data-av-concept");
    for (const ref of [{ jobId: "sim-glb-chair" }, { jobId: "sim-fbx" }, { jobId: "sim-corrupt" }]) {
      await t.viewer.load({ ...ref, index: 0 });
      expect(node.style.display).toBe("none");
      expect(node.textContent).toBe("");
      expect(t.viewer.getState().concept).toMatchObject({ notice: SIM_CONCEPT.notice, noticeSource: "server" });
    }
    await t.viewer.load({ jobId: "sim-gone", index: 0 }); // error before any server concept: the fallback text is still exposed
    expect(t.viewer.getState().concept.notice).toBe(DEFAULT_CONCEPT_NOTICE);
    expect(node.style.display).toBe("none");
    for (const s of t.states.filter((x) => x.source === "creative" && x.status !== "idle")) expect(s.concept.notice.length).toBeGreaterThan(20);
    expect(t.container.find("data-av-status").textContent).toBe(ERROR_MESSAGE.ASSET_UNAVAILABLE); // the rest of the overlay still works
    t.viewer.dispose();
  });

  it("default (renderConceptNotice omitted or true) still shows exactly one copy, verbatim", async () => {
    for (const options of [{}, { renderConceptNotice: true }]) {
      const t = mountCreative({ options });
      await t.viewer.load({ jobId: "sim-glb-chair", index: 0 });
      const nodes = t.doc.created.filter((e) => e.attributes && "data-av-concept" in e.attributes);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].textContent).toBe(SIM_CONCEPT.notice);
      expect(nodes[0].style.display).toBe("");
      t.viewer.dispose();
    }
  });
});
