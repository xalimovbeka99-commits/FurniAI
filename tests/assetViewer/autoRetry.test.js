/**
 * Retries happen only when the USER starts them (Bekzod's rule, integration
 * lead 2026-10-07). `autoRetry` defaults to FALSE: no silent re-resolve on a
 * resolve failure, no re-resolve + retry on a display failure (incl. an expired
 * url), no 429 pause-and-retry, on load and on download. The error is shown with
 * a focusable Try again whose click re-runs the request with a FRESH resolve.
 * autoRetry:true (mount option, or per call) restores the v2.1 single retry,
 * which creativeRetry.test.js / creativeViewer.test.js keep pinning.
 * Everything here is SIMULATED (/api/creative stand-in, fixtures only).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createCreativeAssetSource, mount } from "../../src/lib/assetViewer/index.js";
import { createInstantTimers, mountCreative } from "./helpers/creativeHarness.js";
import { SIM_TOKEN } from "./helpers/creativeStandIn.js";
import { createFakeDocument } from "./helpers/fakeDom.js";
import { createFakeOrbitControlsClass, createFakeRenderer } from "./helpers/fakeRenderer.js";
import { installImageBitmapShim } from "./helpers/fixtures.js";
import { mountForTest } from "./helpers/mountHarness.js";

let shim;
beforeAll(() => (shim = installImageBitmapShim()));
afterAll(() => shim.restore());

const REF = { jobId: "sim-glb-chair", index: 0, format: "glb" };
const assetCalls = (t) => t.sim.count("api", "asset");
const shown = (n) => n.style.display !== "none";
const tryAgain = (t) => t.container.find("data-av-retry");

/** Try again must be a real, visible, focusable button. */
function expectTryAgainOffered(t) {
  const b = tryAgain(t);
  expect(b.tagName).toBe("BUTTON");
  expect(b.getAttribute("type")).toBe("button");
  expect(b.textContent).toBe("Try again");
  expect(shown(b)).toBe(true);
  expect(b.disabled).not.toBe(true);
  expect(t.viewer.getState().canRetry).toBe(true);
  expect(t.container.find("data-av-status").getAttribute("role")).toBe("alert");
}

async function clickTryAgain(t) {
  tryAgain(t).dispatch("click");
  // the click re-runs load(); wait until it settles
  for (let i = 0; i < 200 && t.viewer.getState().status === "loading"; i++) await new Promise((r) => setImmediate(r));
}

describe("default autoRetry:false: exactly one resolve, zero automatic retries", () => {
  it.each([
    [503, "STORAGE_UNAVAILABLE"],
    [502, "PROVIDER_UNAVAILABLE"],
    [500, "INTERNAL"],
    [429, "PROVIDER_RATE_LIMITED"],
  ])("%i %s on resolve -> error after 1 resolve, no pause, no 'retrying'; Try again -> fresh resolve -> ready", async (status, code) => {
    const timers = createInstantTimers();
    const t = mountCreative({ options: { setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout } });
    t.sim.failNext({ resource: "asset", status, code });
    const r = await t.viewer.load(REF);
    expect(r.ok).toBe(false);
    expect(assetCalls(t)).toBe(1);
    expect(t.cdnCalls).toHaveLength(0);
    expect(timers.delays).not.toContain(1000); // no 429 pause scheduled
    expect(t.states.some((s) => s.phase === "retrying")).toBe(false);
    expect(t.viewer.getState()).toMatchObject({ status: "error", attempts: { resolve: 1, display: 0 } });
    expect(t.errors).toHaveLength(1);
    expectTryAgainOffered(t);
    // the USER retries: a fresh resolve (new token, new signed address), then ready
    await clickTryAgain(t);
    expect(assetCalls(t)).toBe(2);
    expect(t.tokenCalls.n).toBe(2);
    expect(t.viewer.getState()).toMatchObject({ status: "ready", attempts: { resolve: 1, display: 1 } });
    expect(t.cdnCalls).toHaveLength(1);
    t.viewer.dispose();
  });

  it("network error on resolve -> RESOLVE_FAILED after 1 attempt; Try again -> fresh resolve", async () => {
    const t = mountCreative();
    let blips = 1;
    const src = createCreativeAssetSource({
      fetchImpl: (url, init) => (String(url).includes("resource=asset") && blips-- > 0 ? Promise.reject(new TypeError("Failed to fetch")) : t.sim.fetch(url, init)),
      getAuthToken: () => SIM_TOKEN,
    });
    const u = mountForTest({ options: { fetch: t.sim.fetch, creativeSource: src } });
    await u.viewer.load(REF);
    expect(u.viewer.getState().error).toMatchObject({ code: "RESOLVE_FAILED", details: { cause: "network" } });
    expect(u.viewer.getState().attempts).toEqual({ resolve: 1, display: 0 });
    expect(blips).toBe(0);
    expectTryAgainOffered(u);
    await clickTryAgain(u);
    expect(u.viewer.getState().status).toBe("ready");
    expect(t.sim.count("api", "asset")).toBe(1); // the blip never reached the stand-in
    u.viewer.dispose();
    t.viewer.dispose();
  });

  it("expired address on display -> NO silent re-resolve: FETCH_FAILED after 1 resolve + 1 fetch; Try again uses a NEW address", async () => {
    const t = mountCreative();
    await t.viewer.load({ jobId: "sim-expired-url", index: 0, format: "glb" });
    const s = t.viewer.getState();
    expect(s.status).toBe("error");
    expect(s.error.code).toBe("FETCH_FAILED");
    expect(s.attempts).toEqual({ resolve: 1, display: 1 });
    expect(assetCalls(t)).toBe(1);
    expect(t.cdnCalls).toHaveLength(1);
    expect(t.states.some((x) => x.phase === "retrying")).toBe(false);
    expectTryAgainOffered(t);
    const first = t.cdnCalls[0].url;
    await clickTryAgain(t);
    expect(t.viewer.getState().status).toBe("ready");
    expect(assetCalls(t)).toBe(2);
    expect(t.cdnCalls).toHaveLength(2);
    expect(t.cdnCalls[1].url).not.toBe(first);
    t.viewer.dispose();
  });

  it("damaged mesh on display -> PARSE_FAILED after 1 resolve + 1 fetch, nothing downloadable; Try again still offered (a fresh copy may be whole)", async () => {
    const t = mountCreative();
    await t.viewer.load({ jobId: "sim-corrupt", index: 0, format: "glb" });
    expect(t.viewer.getState()).toMatchObject({ status: "error", error: { code: "PARSE_FAILED" }, attempts: { resolve: 1, display: 1 }, actions: { download: false } });
    expect(t.cdnCalls).toHaveLength(1);
    expectTryAgainOffered(t);
    expect(shown(t.container.find("data-av-download"))).toBe(false);
    t.viewer.dispose();
  });

  it("showJob / load({ job }) (the Open path) follow the same default", async () => {
    const t = mountCreative();
    const job = { jobId: "sim-glb-chair", status: "succeeded", outputs: [{ index: 0, format: "glb" }] };
    t.sim.failNext({ resource: "asset", status: 503, code: "STORAGE_UNAVAILABLE" });
    await t.viewer.load({ job });
    expect(assetCalls(t)).toBe(1);
    expect(t.viewer.getState().status).toBe("error");
    expectTryAgainOffered(t);
    await clickTryAgain(t);
    expect(t.viewer.getState().status).toBe("ready");
    t.viewer.dispose();
  });

  it("mount() (host interface) has the same default", async () => {
    const t = mountCreative(); // just for the stand-in + source
    const { doc, container } = createFakeDocument();
    const h = mount(container, {
      THREE: { ...THREE, GLTFLoader, OrbitControls: createFakeOrbitControlsClass(THREE) },
      createRenderer: () => createFakeRenderer(doc),
      creativeSource: t.source,
      fetch: t.sim.fetch,
    });
    t.sim.failNext({ resource: "asset", status: 502, code: "PROVIDER_UNAVAILABLE" });
    await h.load(REF);
    expect(h.getState()).toMatchObject({ status: "error", canRetry: true, attempts: { resolve: 1 } });
    expect(assetCalls(t)).toBe(1);
    h.dispose();
    t.viewer.dispose();
  });
});

describe("autoRetry overrides", () => {
  it("per call: load(ref, { autoRetry:true }) on a default viewer -> the v2.1 single retry", async () => {
    const t = mountCreative();
    t.sim.failNext({ resource: "asset", status: 503, code: "STORAGE_UNAVAILABLE" });
    const r = await t.viewer.load(REF, { autoRetry: true });
    expect(r.ok).toBe(true);
    expect(assetCalls(t)).toBe(2);
    expect(t.states.some((s) => s.phase === "retrying")).toBe(true);
    t.viewer.dispose();
  });

  it("per call: load(ref, { autoRetry:false }) on an autoRetry:true viewer -> no retry", async () => {
    const t = mountCreative({ options: { autoRetry: true } });
    t.sim.failNext({ resource: "asset", status: 503, code: "STORAGE_UNAVAILABLE" });
    await t.viewer.load(REF, { autoRetry: false });
    expect(assetCalls(t)).toBe(1);
    expect(t.viewer.getState().status).toBe("error");
    t.viewer.dispose();
  });

  it("mount autoRetry:true: 429 -> waits 1000 ms -> one more resolve; expired address -> one re-resolve + retry", async () => {
    const timers = createInstantTimers();
    const t = mountCreative({ options: { autoRetry: true, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout } });
    t.sim.failNext({ resource: "asset", status: 429, code: "PROVIDER_RATE_LIMITED" });
    expect((await t.viewer.load(REF)).ok).toBe(true);
    expect(timers.delays).toContain(1000);
    expect(assetCalls(t)).toBe(2);
    const r = await t.viewer.load({ jobId: "sim-expired-url", index: 0, format: "glb" });
    expect(r.ok).toBe(true);
    expect(t.viewer.getState().attempts).toEqual({ resolve: 2, display: 2 });
    t.viewer.dispose();
  });
});

describe("download follows the same rule", () => {
  it("default: download({ jobId }) with a 503 -> { ok:false } after 1 resolve; nothing clicked", async () => {
    const t = mountCreative();
    t.sim.failNext({ resource: "asset", status: 503, code: "STORAGE_UNAVAILABLE" });
    const d = await t.viewer.download({ jobId: "sim-glb-chair", index: 0, save: true });
    expect(d).toMatchObject({ ok: false, attempts: { resolve: 1 } });
    expect(assetCalls(t)).toBe(1);
    expect(t.doc.created.filter((e) => e.tagName === "A" && e.clicks > 0)).toHaveLength(0);
    t.viewer.dispose();
  });

  it("default: a 429 on download is not paused-and-retried", async () => {
    const timers = createInstantTimers();
    const t = mountCreative({ options: { setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout } });
    t.sim.failNext({ resource: "asset", status: 429, code: "PROVIDER_RATE_LIMITED" });
    const d = await t.viewer.download({ jobId: "sim-glb-chair", index: 0 });
    expect(d).toMatchObject({ ok: false, attempts: { resolve: 1 } });
    expect(timers.delays).not.toContain(1000);
    t.viewer.dispose();
  });

  it("per call download({ ..., autoRetry:true }) -> one more fresh resolve -> ok", async () => {
    const t = mountCreative();
    t.sim.failNext({ resource: "asset", status: 503, code: "STORAGE_UNAVAILABLE" });
    const d = await t.viewer.download({ jobId: "sim-glb-chair", index: 0, autoRetry: true });
    expect(d).toMatchObject({ ok: true, freshlyResolved: true, attempts: { resolve: 2 } });
    t.viewer.dispose();
  });

  it("the user clicking Download again after a failed download does a fresh resolve (each click = one resolve)", async () => {
    const t = mountCreative();
    await t.viewer.load(REF);
    const btnLoads = assetCalls(t);
    t.sim.failNext({ resource: "asset", status: 503, code: "STORAGE_UNAVAILABLE" });
    const first = await t.viewer.download();
    expect(first).toMatchObject({ ok: false, attempts: { resolve: 1 } });
    const second = await t.viewer.download();
    expect(second).toMatchObject({ ok: true, freshlyResolved: true, attempts: { resolve: 1 } });
    expect(assetCalls(t)).toBe(btnLoads + 2);
    t.viewer.dispose();
  });
});
