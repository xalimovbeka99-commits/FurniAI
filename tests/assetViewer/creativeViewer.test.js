/**
 * Viewer x /api/creative contract, end to end against the SIMULATED stand-in
 * (fixtures only, not Scenario). Signed addresses are single use, so any
 * reuse of a url fails these tests.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_CONCEPT_NOTICE, ERROR_MESSAGE, RELATIVE_SCALE_LABEL } from "../../src/lib/assetViewer/index.js";
import { SIM_CONCEPT } from "./helpers/creativeStandIn.js";
import { clickedAnchors, mountCreative } from "./helpers/creativeHarness.js";
import { fixtureArrayBuffer, installImageBitmapShim } from "./helpers/fixtures.js";

let shim;
beforeAll(() => (shim = installImageBitmapShim()));
afterAll(() => shim.restore());

// Storage spies: the viewer must never persist anything (urls least of all).
const storageWrites = [];
const fakeStorage = (name) => ({
  setItem: (k, v) => storageWrites.push({ name, k, v }),
  getItem: () => null,
  removeItem: () => {},
});
beforeAll(() => {
  globalThis.localStorage = fakeStorage("localStorage");
  globalThis.sessionStorage = fakeStorage("sessionStorage");
});
afterAll(() => {
  delete globalThis.localStorage;
  delete globalThis.sessionStorage;
});
afterEach(() => expect(storageWrites).toEqual([]));

const urlsIn = (calls) => calls.map((c) => c.url);
const overlayText = (t) => ({
  concept: t.container.find("data-av-concept"),
  status: t.container.find("data-av-status"),
  scale: t.container.find("data-av-scale"),
  button: t.container.find("data-av-download"),
});
function expectNoUrlAnywhere(t, urls) {
  const blobs = [JSON.stringify(t.viewer.getState()), ...t.states.map((s) => JSON.stringify(s)), JSON.stringify(t.errors)];
  for (const b of blobs) {
    for (const u of urls) expect(b).not.toContain(u);
    expect(b).not.toMatch(/X-Sim-Signature|cdn\.sim\.invalid|cors-blocked/);
  }
}

describe("load({ jobId, index, format }) -> resolve -> load GLB", () => {
  it("resolves once, fetches the signed url once, shows the model with the concept notice", async () => {
    const t = mountCreative();
    const r = await t.viewer.load({ jobId: "sim-glb-chair", index: 0, format: "glb" });
    expect(r.ok).toBe(true);
    expect(t.sim.count("api", "asset")).toBe(1);
    expect(t.cdnCalls).toHaveLength(1);
    expect(t.cdnCalls[0].init.credentials).toBe("omit");
    const s = t.viewer.getState();
    expect(s).toMatchObject({
      status: "ready",
      source: "creative",
      job: { jobId: "sim-glb-chair", index: 0 },
      asset: { source: "creative", format: "glb", mime: "model/gltf-binary", filename: "furniai-concept-sim-glb-chair-0.glb" },
      concept: { ...SIM_CONCEPT, noticeSource: "server" },
      actions: { view: true, download: true, openInBuilder: false, export: false, production: false },
      attempts: { resolve: 1, display: 1 },
      error: null,
    });
    expect(s.model.meshCount).toBe(6);
    expect(s.model.scale.label).toBe(RELATIVE_SCALE_LABEL);
    const o = overlayText(t);
    expect(o.concept.textContent).toBe(SIM_CONCEPT.notice);
    expect(o.concept.style.display).toBe("block");
    expect(o.scale.textContent).toContain(RELATIVE_SCALE_LABEL);
    expect(o.button.style.display).toBe("none");
    expectNoUrlAnywhere(t, urlsIn(t.cdnCalls));
    t.viewer.dispose();
  });

  it("every load resolves afresh (count calls, distinct urls, Bearer on each)", async () => {
    const t = mountCreative();
    for (let i = 0; i < 3; i++) expect((await t.viewer.load({ jobId: "sim-glb-chair", index: 0 })).ok).toBe(true);
    expect(t.sim.count("api", "asset")).toBe(3);
    expect(t.tokenCalls.n).toBe(3);
    expect(t.apiCalls.every((c) => c.init.headers.Authorization === "Bearer sim-token")).toBe(true);
    const urls = urlsIn(t.cdnCalls);
    expect(urls).toHaveLength(3);
    expect(new Set(urls).size).toBe(3);
    t.viewer.dispose();
  });

  it("the url is never in getState(), events, current, errors or storage", async () => {
    const t = mountCreative();
    await t.viewer.load({ jobId: "sim-glb-table", index: 0 });
    await t.viewer.download();
    await t.viewer.load({ jobId: "sim-expired-url", index: 0 });
    await t.viewer.load({ jobId: "sim-corrupt", index: 0 });
    expectNoUrlAnywhere(t, urlsIn(t.cdnCalls));
    expect(storageWrites).toEqual([]);
    t.viewer.dispose();
  });

  it("job output format wins only until resolve: resolved 'zip' -> download-only, no mesh fetch", async () => {
    const t = mountCreative();
    const r = await t.viewer.load({ jobId: "sim-resolves-zip", index: 0, format: "glb" });
    expect(r).toMatchObject({ ok: true, downloadOnly: true });
    expect(t.viewer.getState()).toMatchObject({ status: "download-only", asset: { format: "zip" } });
    expect(t.cdnCalls).toHaveLength(0);
    t.viewer.dispose();
  });
});

describe("failure after resolve: ONE fresh resolve + ONE retry, then an honest error", () => {
  it("expired first address -> re-resolve -> success (2 resolves, 2 distinct addresses)", async () => {
    const t = mountCreative();
    const r = await t.viewer.load({ jobId: "sim-expired-url", index: 0, format: "glb" });
    expect(r.ok).toBe(true);
    expect(t.sim.count("api", "asset")).toBe(2);
    const urls = urlsIn(t.cdnCalls);
    expect(urls).toHaveLength(2);
    expect(urls[0]).not.toBe(urls[1]);
    expect(t.viewer.getState()).toMatchObject({ status: "ready", attempts: { resolve: 2, display: 2 } });
    expect(t.states.some((s) => s.phase === "retrying")).toBe(true);
    expect(t.errors).toEqual([]);
    t.viewer.dispose();
  });

  it("damaged mesh -> retry once -> ASSET_DISPLAY_FAILED, download still offered", async () => {
    const t = mountCreative();
    const r = await t.viewer.load({ jobId: "sim-corrupt", index: 0, format: "glb" });
    expect(r.ok).toBe(false);
    expect(t.sim.count("api", "asset")).toBe(2);
    expect(t.cdnCalls).toHaveLength(2);
    const s = t.viewer.getState();
    expect(s).toMatchObject({
      status: "error",
      error: { code: "ASSET_DISPLAY_FAILED", message: ERROR_MESSAGE.ASSET_DISPLAY_FAILED, downloadAvailable: true, attempts: { resolve: 2, display: 2 } },
      actions: { download: true, view: false, openInBuilder: false },
      concept: { notice: SIM_CONCEPT.notice },
    });
    expect(s.error.message).toMatch(/couldn't be displayed here\. Downloading it may still work\./);
    expect(t.errors).toHaveLength(1);
    const o = overlayText(t);
    expect(o.concept.textContent).toBe(SIM_CONCEPT.notice);
    expect(o.button.style.display).toBe("inline-block");
    t.viewer.dispose();
  });

  it("blocked cross-origin fetch (U7 CORS) -> retry once -> ASSET_DISPLAY_FAILED; download works with a fresh url", async () => {
    const t = mountCreative();
    await t.viewer.load({ jobId: "sim-cors", index: 0, format: "glb" });
    expect(t.viewer.getState().error.code).toBe("ASSET_DISPLAY_FAILED");
    expect(t.sim.count("api", "asset")).toBe(2);
    const before = urlsIn(t.cdnCalls);
    const d = await t.viewer.download({ save: true });
    expect(d).toMatchObject({ ok: true, freshlyResolved: true, filename: "furniai-concept-sim-cors-0.glb" });
    expect(t.sim.count("api", "asset")).toBe(3);
    expect(before).not.toContain(d.url);
    const a = clickedAnchors(t.doc);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ href: d.url, download: d.filename, rel: "noopener noreferrer", target: "_blank" });
    expect(a[0].parentNode).toBeNull();
    t.viewer.dispose();
  });

  it("if the re-resolve itself fails, that mapped error is reported (no second mesh attempt)", async () => {
    const t = mountCreative();
    let n = 0;
    const src = {
      resolve: async (...args) => {
        n += 1;
        if (n === 2) t.sim.job("sim-corrupt").asset = "gone"; // provider dropped it between the two calls
        return t.source.resolve(...args);
      },
    };
    const { mountForTest } = await import("./helpers/mountHarness.js");
    const cdn = [];
    const u = mountForTest({ options: { fetch: (url, i) => (cdn.push(url), t.sim.fetch(url, i)), creativeSource: src } });
    await u.viewer.load({ jobId: "sim-corrupt", index: 0 });
    expect(u.viewer.getState().error).toMatchObject({ code: "ASSET_UNAVAILABLE", serverCode: "ASSET_UNAVAILABLE", status: 410 });
    expect(n).toBe(2);
    expect(cdn).toHaveLength(1);
    u.viewer.dispose();
    t.viewer.dispose();
  });

  it("EMPTY_SCENE / size limit are not retried", async () => {
    const t = mountCreative({ options: { maxBytes: 100 } });
    await t.viewer.load({ jobId: "sim-glb-chair", index: 0 });
    expect(t.viewer.getState().error).toMatchObject({ code: "FILE_TOO_LARGE", downloadAvailable: true });
    expect(t.sim.count("api", "asset")).toBe(1);
    t.viewer.dispose();
  });
});

describe("resolve errors -> distinct viewer codes, concept notice still shown", () => {
  it.each([
    ["sim-gone", "ASSET_UNAVAILABLE", 410, 1],
    ["sim-integrity", "RECORD_INTEGRITY_FAILED", 409, 1],
    ["sim-processing", "ASSET_NOT_READY", 409, 1],
    ["sim-provider-down", "PROVIDER_UNAVAILABLE", 502, 2], // v2.1 (V1): a 502 is re-resolved ONCE, then reported
    ["no-such-job", "CONCEPT_NOT_FOUND", 404, 1],
  ])("%s -> %s", async (jobId, code, status, resolves) => {
    const t = mountCreative();
    const r = await t.viewer.load({ jobId, index: 0, format: "glb" });
    expect(r.ok).toBe(false);
    expect(t.viewer.getState()).toMatchObject({ status: "error", error: { code, status, message: ERROR_MESSAGE[code] }, actions: { download: false } });
    expect(t.cdnCalls).toHaveLength(0);
    expect(t.sim.count("api", "asset")).toBe(resolves); // non-retryable: final at once; retryable: exactly one more resolve
    const o = overlayText(t);
    expect(o.status.textContent).toBe(ERROR_MESSAGE[code]);
    expect(o.concept.textContent).toBe(DEFAULT_CONCEPT_NOTICE); // server never sent a concept for this load
    expect(o.button.style.display).toBe("none");
    expect(t.viewer.download()).toBeNull();
    t.viewer.dispose();
  });

  it("401 MISSING_AUTH (expired token) -> SIGN_IN_REQUIRED; no token -> no request at all", async () => {
    const t = mountCreative({ token: "stale" });
    await t.viewer.load({ jobId: "sim-glb-chair", index: 0 });
    expect(t.viewer.getState().error).toMatchObject({ code: "SIGN_IN_REQUIRED", serverCode: "MISSING_AUTH", status: 401 });
    t.viewer.dispose();
    const u = mountCreative({ getAuthToken: () => null });
    await u.viewer.load({ jobId: "sim-glb-chair", index: 0 });
    expect(u.viewer.getState().error.code).toBe("SIGN_IN_REQUIRED");
    expect(u.apiCalls).toHaveLength(0);
    u.viewer.dispose();
  });

  it("503s: AUTH_UNAVAILABLE, PERSISTENCE_NOT_CONFIGURED, STORAGE_UNAVAILABLE map to distinct codes", async () => {
    const t = mountCreative();
    const seen = [];
    const calls = [];
    // Transient 503s are re-resolved once (so they must fail twice to be reported); *_NOT_CONFIGURED is not retried.
    for (const [code, times] of [["AUTH_UNAVAILABLE", 2], ["PERSISTENCE_NOT_CONFIGURED", 1], ["STORAGE_UNAVAILABLE", 2], ["CREATIVE_NOT_CONFIGURED", 1]]) {
      for (let i = 0; i < times; i++) t.sim.failNext({ resource: "asset", status: 503, code });
      const before = t.sim.count("api", "asset");
      await t.viewer.load({ jobId: "sim-glb-chair", index: 0 });
      seen.push(t.viewer.getState().error.code);
      calls.push(t.sim.count("api", "asset") - before);
    }
    expect(seen).toEqual(["SIGN_IN_UNAVAILABLE", "CONCEPTS_NOT_CONFIGURED", "SERVICE_UNAVAILABLE", "CONCEPTS_NOT_CONFIGURED"]);
    expect(calls).toEqual([2, 1, 2, 1]);
    t.viewer.dispose();
  });

  it("no creativeSource -> MISSING_DEPENDENCY", async () => {
    const { mountForTest } = await import("./helpers/mountHarness.js");
    const t = mountForTest();
    const r = await t.viewer.load({ jobId: "x", index: 0 });
    expect(r.error.code).toBe("MISSING_DEPENDENCY");
    t.viewer.dispose();
  });
});

describe("download-only: anything but glb/gltf", () => {
  it.each(["fbx", "obj", "usdz", "stl", "ply", "zip", null, "blend"])("job format %s -> download-only without resolving or fetching", async (format) => {
    const t = mountCreative();
    const r = await t.viewer.load({ jobId: "sim-fbx", index: 0, format });
    expect(r).toMatchObject({ ok: true, downloadOnly: true });
    const s = t.viewer.getState();
    expect(s).toMatchObject({ status: "download-only", model: null, error: null, actions: { view: false, download: true, openInBuilder: false, export: false, production: false } });
    expect(s.asset.format).toBe(format === "blend" ? null : format);
    expect(t.apiCalls).toHaveLength(0);
    expect(t.cdnCalls).toHaveLength(0);
    const o = overlayText(t);
    expect(o.concept.textContent.length).toBeGreaterThan(20);
    expect(o.status.textContent).toMatch(/Preview isn't available for (\w+ files|this file type)\. You can still download the file\./);
    expect(o.button.style.display).toBe("inline-block");
    t.viewer.dispose();
  });

  it("format unknown up front -> resolve tells: fbx -> download-only, server concept shown; download resolves again", async () => {
    const t = mountCreative();
    await t.viewer.load({ jobId: "sim-fbx", index: 0 });
    expect(t.viewer.getState()).toMatchObject({ status: "download-only", asset: { format: "fbx", filename: "furniai-concept-sim-fbx-0.fbx" }, concept: { noticeSource: "server" } });
    expect(overlayText(t).status.textContent).toBe("Preview isn't available for FBX files. You can still download the file.");
    expect(t.sim.count("api", "asset")).toBe(1);
    expect(t.cdnCalls).toHaveLength(0);
    const d1 = await t.viewer.download();
    const d2 = await t.viewer.download();
    expect(t.sim.count("api", "asset")).toBe(3);
    expect(d1.url).not.toBe(d2.url);
    expect(d1).toMatchObject({ ok: true, format: "fbx", filename: "furniai-concept-sim-fbx-0.fbx", mime: "application/octet-stream" });
    t.viewer.dispose();
  });

  it("null format (unrecognised) -> download-only with a .bin name", async () => {
    const t = mountCreative();
    await t.viewer.load({ jobId: "sim-null-format", index: 0 });
    expect(t.viewer.getState()).toMatchObject({ status: "download-only", asset: { format: null, filename: "furniai-concept-sim-null-format-0.bin" } });
    expect(overlayText(t).status.textContent).toBe("Preview isn't available for this file type. You can still download the file.");
    t.viewer.dispose();
  });

  it("built-in Download button re-resolves and clicks a fresh address", async () => {
    const t = mountCreative();
    await t.viewer.load({ jobId: "sim-fbx", index: 0, format: "fbx" });
    const btn = overlayText(t).button;
    for (const fn of btn.listeners.click) fn();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const a = clickedAnchors(t.doc);
    expect(a).toHaveLength(1);
    expect(a[0].href).toMatch(/^https:\/\/cdn\.sim\.invalid\/sim-asset\/t\d{4}\/simulated-download-only\.fbx\?/);
    expect(t.sim.count("api", "asset")).toBe(1);
    expectNoUrlAnywhere(t, [a[0].href]);
    t.viewer.dispose();
  });
});

describe("download() for a displayed concept always re-resolves", () => {
  it("fresh url per download, never the one used for display; single-use addresses prove it", async () => {
    const t = mountCreative();
    await t.viewer.load({ jobId: "sim-glb-chair", index: 0 });
    const displayUrl = t.cdnCalls[0].url;
    const d1 = await t.viewer.download();
    const d2 = await t.viewer.download({ save: true });
    expect(t.sim.count("api", "asset")).toBe(3);
    expect(new Set([displayUrl, d1.url, d2.url]).size).toBe(3);
    // the display address was already used once: reusing it would fail
    expect((await t.sim.fetch(displayUrl)).status).toBe(403);
    // the fresh one works (once)
    expect((await t.sim.fetch(d2.url)).status).toBe(200);
    expect((await t.sim.fetch(d2.url)).status).toBe(403);
    expect(d1).toMatchObject({ ok: true, jobId: "sim-glb-chair", index: 0, format: "glb", mime: "model/gltf-binary", filename: "furniai-concept-sim-glb-chair-0.glb", concept: { notice: SIM_CONCEPT.notice } });
    expect(t.viewer.getState().status).toBe("ready");
    t.viewer.dispose();
  });

  it("download resolve failure -> { ok:false, error }, viewer state unchanged", async () => {
    const t = mountCreative();
    await t.viewer.load({ jobId: "sim-glb-chair", index: 0 });
    t.sim.job("sim-glb-chair").asset = "gone";
    const d = await t.viewer.download({ save: true });
    expect(d).toMatchObject({ ok: false, error: { code: "ASSET_UNAVAILABLE" } });
    expect(clickedAnchors(t.doc)).toHaveLength(0);
    expect(t.viewer.getState().status).toBe("ready");
    t.viewer.dispose();
  });
});

describe("concept honesty: notice always, no dimensions, no builder/export/production", () => {
  it("no dimension or millimetre/metre values anywhere in state, for every concept state", async () => {
    const t = mountCreative();
    for (const ref of [{ jobId: "sim-glb-chair" }, { jobId: "sim-fbx" }, { jobId: "sim-gone" }, { jobId: "sim-corrupt" }]) {
      await t.viewer.load({ ...ref, index: 0 });
    }
    for (const s of t.states) {
      const j = JSON.stringify(s);
      expect(j).not.toMatch(/"(width|height|depth|dimensions|widthMm|heightMm|depthMm)"\s*:/i);
      expect(j).not.toMatch(/\d\s*(mm|cm)\b|\bmillimet|\bcentimet/i);
      if (s.source === "creative" && s.status !== "idle") {
        expect(s.concept.notice.length).toBeGreaterThan(20);
        expect(s.concept.dimensionsVerified).toBe(false);
        if (s.actions) expect(s.actions).toMatchObject({ openInBuilder: false, export: false, production: false });
      }
    }
    t.viewer.dispose();
  });

  it("a server concept claiming dimensionsVerified:true still gets relative scale only", async () => {
    const t = mountCreative();
    const resolve = t.source.resolve;
    const src = { resolve: async (...a) => ({ ...(await resolve(...a)), concept: { ...SIM_CONCEPT, dimensionsVerified: true, noticeSource: "server" } }) };
    const { mountForTest } = await import("./helpers/mountHarness.js");
    const u = mountForTest({ options: { fetch: t.sim.fetch, creativeSource: src } });
    await u.viewer.load({ jobId: "sim-glb-chair", index: 0 });
    const s = u.viewer.getState();
    expect(s.concept.dimensionsVerified).toBe(true); // reported as sent...
    expect(s.model.scale).toMatchObject({ kind: "inferred-relative", label: RELATIVE_SCALE_LABEL }); // ...never acted on
    expect(s.actions).toMatchObject({ openInBuilder: false, export: false, production: false });
    u.viewer.dispose();
    t.viewer.dispose();
  });

  it("a concept without notice gets the strict default notice", async () => {
    const t = mountCreative();
    const resolve = t.source.resolve;
    const src = { resolve: async (...a) => ({ ...(await resolve(...a)), concept: { kind: "visual_concept", notice: DEFAULT_CONCEPT_NOTICE, noticeSource: "viewer-default" } }) };
    const { mountForTest } = await import("./helpers/mountHarness.js");
    const u = mountForTest({ options: { fetch: t.sim.fetch, creativeSource: src } });
    await u.viewer.load({ jobId: "sim-glb-chair", index: 0 });
    expect(u.container.find("data-av-concept").textContent).toBe(DEFAULT_CONCEPT_NOTICE);
    u.viewer.dispose();
    t.viewer.dispose();
  });
});

describe("v2.1: server notice verbatim (V3), 403 is FORBIDDEN not signed-out (V4)", () => {
  it("V3: the server's concept.notice is rendered verbatim, not the viewer's own text", async () => {
    const t = mountCreative();
    const serverNotice = "SIMULATED server wording (test only):  AI-generated visual concept,  not a FurniAI design. No verified measurements.";
    const resolve = t.source.resolve;
    // Wrap the real adapter so normalizeConcept runs on the server text exactly as the HTTP path would.
    const { normalizeConcept } = await import("../../src/lib/assetViewer/index.js");
    const src = { resolve: async (...a) => ({ ...(await resolve(...a)), concept: normalizeConcept({ ...SIM_CONCEPT, notice: serverNotice }) }) };
    const { mountForTest } = await import("./helpers/mountHarness.js");
    const u = mountForTest({ options: { fetch: t.sim.fetch, creativeSource: src } });
    await u.viewer.load({ jobId: "sim-glb-chair", index: 0 });
    expect(u.viewer.getState().concept).toMatchObject({ notice: serverNotice, noticeSource: "server" });
    const node = u.container.find("data-av-concept");
    expect(node.textContent).toBe(serverNotice);
    expect(node.textContent).not.toBe(DEFAULT_CONCEPT_NOTICE);
    u.viewer.dispose();
    t.viewer.dispose();
  });

  it("V3: through the HTTP adapter, the stand-in's verbatim CONCEPT_NOTICE reaches the overlay unchanged", async () => {
    const t = mountCreative();
    await t.viewer.load({ jobId: "sim-fbx", index: 0 });
    expect(overlayText(t).concept.textContent).toBe(SIM_CONCEPT.notice);
    expect(t.viewer.getState().concept.noticeSource).toBe("server");
    t.viewer.dispose();
  });

  it("V4: HTTP 403 (UNAUTHORIZED / FORBIDDEN / no code) -> FORBIDDEN state with an honest message, never 'please sign in'", async () => {
    for (const forced of [{ status: 403, code: "UNAUTHORIZED" }, { status: 403, code: "FORBIDDEN" }]) {
      const t = mountCreative();
      t.sim.failNext({ resource: "asset", ...forced });
      const r = await t.viewer.load({ jobId: "sim-glb-chair", index: 0, format: "glb" });
      expect(r.ok).toBe(false);
      expect(t.viewer.getState()).toMatchObject({
        status: "error",
        error: { code: "FORBIDDEN", status: 403, serverCode: forced.code, message: ERROR_MESSAGE.FORBIDDEN, details: { cause: "http", retryable: false } },
        actions: { download: false },
      });
      expect(t.sim.count("api", "asset")).toBe(1); // not retried
      const o = overlayText(t);
      expect(o.status.textContent).toBe(ERROR_MESSAGE.FORBIDDEN);
      expect(o.status.textContent).not.toMatch(/please sign in/i);
      expect(o.concept.textContent).toBe(DEFAULT_CONCEPT_NOTICE);
      t.viewer.dispose();
    }
    // A bare 403 from a proxy (no JSON code) is FORBIDDEN too; a 401 stays SIGN_IN_REQUIRED.
    const { mountForTest } = await import("./helpers/mountHarness.js");
    const { createCreativeAssetSource } = await import("../../src/lib/assetViewer/index.js");
    for (const [status, code] of [[403, "FORBIDDEN"], [401, "SIGN_IN_REQUIRED"]]) {
      const source = createCreativeAssetSource({ fetchImpl: async () => new Response("<html>denied</html>", { status }), getAuthToken: () => "t" });
      const u = mountForTest({ options: { creativeSource: source } });
      await u.viewer.load({ jobId: "j", index: 0 });
      expect(u.viewer.getState().error).toMatchObject({ code, status, message: ERROR_MESSAGE[code] });
      u.viewer.dispose();
    }
  });
});

describe("old descriptor path ({ url | arrayBuffer | blob }) unchanged", () => {
  it("arrayBuffer fixture loads, sync download with bytes, no concept, no creative fields", async () => {
    const t = mountCreative();
    const r = await t.viewer.load({ arrayBuffer: fixtureArrayBuffer("chair-textured.glb"), filename: "chair.glb" });
    expect(r.ok).toBe(true);
    const s = t.viewer.getState();
    expect(s).toMatchObject({ status: "ready", source: "local", concept: null, job: null, actions: null });
    expect(t.container.find("data-av-concept").style.display).toBe("none");
    const d = t.viewer.download();
    expect(d.byteLength).toBeGreaterThan(1000);
    expect(t.apiCalls).toHaveLength(0);
    t.viewer.dispose();
  });

  it("a local fixture may carry a concept: notice shown", async () => {
    const t = mountCreative();
    await t.viewer.load({ arrayBuffer: fixtureArrayBuffer("table-untextured.glb"), filename: "t.glb", concept: SIM_CONCEPT });
    expect(t.container.find("data-av-concept").textContent).toBe(SIM_CONCEPT.notice);
    t.viewer.dispose();
  });

  it("superseding a creative load with a local one discards the creative result", async () => {
    const t = mountCreative();
    const p = t.viewer.load({ jobId: "sim-glb-chair", index: 0 });
    const q = t.viewer.load({ arrayBuffer: fixtureArrayBuffer("table-untextured.glb"), filename: "t.glb" });
    expect((await p).superseded).toBe(true);
    expect((await q).ok).toBe(true);
    expect(t.viewer.getState()).toMatchObject({ source: "local", concept: null, model: { meshCount: 5 } });
    t.viewer.dispose();
  });
});

describe("static guarantees", () => {
  const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "lib", "assetViewer");
  const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
  it("no storage APIs in the viewer source (url can't be persisted)", () => {
    for (const f of walk(SRC).filter((p) => p.endsWith(".js") && !p.endsWith(".test.js"))) {
      const code = readFileSync(f, "utf8");
      expect(code, f).not.toMatch(/\b(localStorage|sessionStorage|indexedDB|caches\.open|document\.cookie)\b/);
    }
  });
  it("viewer never branches on providerStatus/providerProgress", () => {
    for (const f of walk(SRC).filter((p) => p.endsWith(".js") && !p.endsWith(".test.js"))) {
      const code = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(code, f).not.toMatch(/providerStatus|providerProgress/);
    }
  });
});
