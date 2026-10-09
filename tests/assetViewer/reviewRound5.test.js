/**
 * Review round 5 (v3 follow-up), each finding pinned test-first:
 *   1. FORBIDDEN wording: no sign-in talk at all; 401 keeps its sign-in prompt.
 *   2. INT-403: a 403 on Open surfaces exactly ONE role=alert and ONE announcement in the
 *      viewer, one `error` event / onError, and `error.pageWide: true` so a host can close
 *      its panel or show it page-wide.
 *   3. AV3-D2: autoRetry on + a file broken on both attempts -> PARSE_FAILED, no Download
 *      (not a valid supported asset).
 *   5. retry() is a no-op with a clear result when the state offers no retry.
 * SIMULATED stand-in and synthetic fixtures only; nothing LIVE.
 */
import { describe, expect, it } from "vitest";
import { AssetViewerError, ERROR_MESSAGE, toErrorRecord } from "../../src/lib/assetViewer/index.js";
import { mountCreative } from "./helpers/creativeHarness.js";
import { createFakeFetch, fixtureArrayBuffer } from "./helpers/fixtures.js";
import { mountForTest } from "./helpers/mountHarness.js";

const shown = (n) => n.style.display !== "none";
const LIVE_ROLES = new Set(["alert", "status", "log", "marquee", "timer"]);

/** Every element under `node` (depth first). */
function all(node, out = []) {
  out.push(node);
  for (const c of node.children || []) all(c, out);
  return out;
}

describe("finding 1: FORBIDDEN wording (integration lead + QE INT-403)", () => {
  it("403 says only that access is blocked: no sign-in wording of any kind", () => {
    expect(ERROR_MESSAGE.FORBIDDEN).toBe("This account doesn't have permission to open this 3D concept.");
    expect(ERROR_MESSAGE.FORBIDDEN).not.toMatch(/sign(ing|ed)?[\s-]*(in|out)|log(ging)?[\s-]*in|account again/i);
    expect(ERROR_MESSAGE.FORBIDDEN).toMatch(/permission/);
  });

  it("401 keeps its sign-in prompt", () => {
    expect(ERROR_MESSAGE.SIGN_IN_REQUIRED).toMatch(/please sign in/i);
  });

  it("the overlay text after a 403 on Open has no sign-in wording", async () => {
    const t = mountCreative();
    t.sim.failNext({ resource: "asset", status: 403, code: "UNAUTHORIZED" });
    await t.viewer.load({ jobId: "sim-glb-chair", index: 0, format: "glb" });
    const text = all(t.container).filter((n) => n.style && n.tagName !== "STYLE" && shown(n)).map((n) => n.textContent).join(" | ");
    expect(text).toContain(ERROR_MESSAGE.FORBIDDEN);
    expect(text).not.toMatch(/sign(ing)?[\s-]*in/i);
    t.viewer.dispose();
  });
});

describe("finding 2: INT-403, exactly one alert / one announcement, page-wide in state and event", () => {
  async function forbiddenOnOpen({ autoRetry = false, via = "load" } = {}) {
    const t = mountCreative({ options: { autoRetry } });
    // record from here on: the overlay nodes already exist, so patch them in place
    const writes = [];
    for (const n of all(t.container)) {
      if (!n.setAttribute) continue;
      let text = n.textContent;
      Object.defineProperty(n, "textContent", {
        get: () => text,
        set: (v) => {
          text = String(v);
          const role = n.getAttribute("role");
          const live = n.getAttribute("aria-live");
          if (text && (LIVE_ROLES.has(role) || (live && live !== "off"))) writes.push({ text, role, live });
        },
      });
    }
    const events = [];
    t.viewer.on("error", (e) => events.push(e));
    t.sim.failNext({ resource: "asset", status: 403, code: "FORBIDDEN" });
    if (via === "job") await t.viewer.load({ job: { jobId: "sim-glb-chair", status: "succeeded", outputs: [{ index: 0, format: "glb" }] } });
    else await t.viewer.load({ jobId: "sim-glb-chair", index: 0, format: "glb" });
    return { t, writes, events };
  }

  for (const autoRetry of [false, true]) {
    for (const via of ["load", "job"]) {
      it(`autoRetry:${autoRetry}, Open via ${via}: ONE visible role=alert, ONE announcement of it, no second live region`, async () => {
        const { t, writes, events } = await forbiddenOnOpen({ autoRetry, via });
        const nodes = all(t.container).filter((n) => n.getAttribute);
        const alerts = nodes.filter((n) => n.getAttribute("role") === "alert");
        expect(alerts).toHaveLength(1);
        expect(shown(alerts[0])).toBe(true);
        expect(alerts[0].textContent).toBe(ERROR_MESSAGE.FORBIDDEN);
        // role=alert is already assertive; a second aria-live on it (or anywhere) would be a duplicate live region
        expect(alerts[0].getAttribute("aria-live")).toBeNull();
        const liveVisible = nodes.filter((n) => shown(n) && (LIVE_ROLES.has(n.getAttribute("role")) || n.getAttribute("aria-live")));
        expect(liveVisible).toEqual(alerts);
        // announcements: the forbidden text is written into a live region exactly once
        const forb = writes.filter((w) => w.text === ERROR_MESSAGE.FORBIDDEN);
        expect(forb).toHaveLength(1);
        expect(forb[0].role).toBe("alert");
        expect(writes.filter((w) => w.role === "alert")).toHaveLength(1);
        // events: one `error` event, one onError, one statechange that carries the error
        expect(events).toHaveLength(1);
        expect(t.errors).toHaveLength(1);
        expect(t.states.filter((s) => s.error && s.error.code === "FORBIDDEN")).toHaveLength(1);
        // nothing else offered, nothing retried
        expect(shown(t.container.find("data-av-retry"))).toBe(false);
        expect(shown(t.container.find("data-av-download"))).toBe(false);
        expect(t.sim.count("api", "asset")).toBe(1);
        t.viewer.dispose();
      });
    }
  }

  it("state and event say it is page-wide (error.pageWide), so a host can close the panel / elevate it", async () => {
    const { t, events } = await forbiddenOnOpen();
    const s = t.viewer.getState();
    expect(s).toMatchObject({ status: "error", canRetry: false, error: { code: "FORBIDDEN", status: 403, pageWide: true } });
    expect(events[0]).toMatchObject({ code: "FORBIDDEN", pageWide: true });
    expect(t.errors[0]).toMatchObject({ code: "FORBIDDEN", pageWide: true });
    // the host closes the panel: dispose removes the alert with the viewer root (no stale panel, no leftover alert)
    t.viewer.dispose();
    expect(all(t.container).filter((n) => n.getAttribute && n.getAttribute("role") === "alert")).toHaveLength(0);
  });

  it("only FORBIDDEN is page-wide (401, 404, 410, 5xx are not)", () => {
    expect(toErrorRecord(new AssetViewerError("FORBIDDEN")).pageWide).toBe(true);
    // a FORBIDDEN error from the separate creative bundle (its own class copy) is recognised too
    expect(toErrorRecord({ name: "AssetViewerError", code: "FORBIDDEN", message: ERROR_MESSAGE.FORBIDDEN }).pageWide).toBe(true);
    for (const c of ["SIGN_IN_REQUIRED", "CONCEPT_NOT_FOUND", "ASSET_UNAVAILABLE", "SERVICE_UNAVAILABLE", "FETCH_FAILED", "PARSE_FAILED"]) {
      expect(toErrorRecord(new AssetViewerError(c)).pageWide).toBeUndefined();
    }
  });

  it("a later retry() call while FORBIDDEN is shown does not re-request or re-announce", async () => {
    const { t, writes, events } = await forbiddenOnOpen();
    const r = await t.viewer.retry();
    expect(r).toMatchObject({ ok: false, retried: false });
    expect(t.sim.count("api", "asset")).toBe(1);
    expect(writes.filter((w) => w.role === "alert")).toHaveLength(1);
    expect(events).toHaveLength(1);
    t.viewer.dispose();
  });
});

describe("finding 3: AV3-D2, broken on both attempts with autoRetry -> PARSE_FAILED, Download hidden", () => {
  it("autoRetry:true, damaged on both fetches: PARSE_FAILED, not ASSET_DISPLAY_FAILED; no Download anywhere; no Try again", async () => {
    const t = mountCreative({ options: { autoRetry: true } });
    const r = await t.viewer.load({ jobId: "sim-corrupt", index: 0, format: "glb" });
    expect(r.ok).toBe(false);
    expect(t.sim.count("api", "asset")).toBe(2);
    const s = t.viewer.getState();
    expect(s.error.code).toBe("PARSE_FAILED");
    expect(s.error.downloadAvailable).toBeUndefined();
    expect(s).toMatchObject({ canRetry: false, actions: { download: false } });
    expect(shown(t.container.find("data-av-download"))).toBe(false);
    expect(shown(t.container.find("data-av-retry"))).toBe(false);
    expect(shown(t.container.find("data-av-kind"))).toBe(false);
    expect(await t.viewer.download()).toBeNull(); // the current item is not offered
    t.viewer.dispose();
  });

  it("contrast: a blocked (CORS) address on both attempts is ASSET_DISPLAY_FAILED and keeps Download (the stored file may be valid)", async () => {
    const t = mountCreative({ options: { autoRetry: true } });
    await t.viewer.load({ jobId: "sim-cors", index: 0, format: "glb" });
    const s = t.viewer.getState();
    expect(s.error).toMatchObject({ code: "ASSET_DISPLAY_FAILED", downloadAvailable: true });
    expect(shown(t.container.find("data-av-download"))).toBe(true);
    t.viewer.dispose();
  });
});

describe("finding 5: retry() when no retry is offered", () => {
  const notOffered = (r) => expect(r).toMatchObject({ ok: false, retried: false, state: expect.objectContaining({ canRetry: false }) });

  it("idle (nothing loaded): a no-op with a clear result", async () => {
    const t = mountForTest();
    const p = t.viewer.retry();
    expect(typeof p.then).toBe("function"); // always a Promise, like load()
    notOffered(await p);
    expect(t.viewer.getState().status).toBe("idle");
    t.viewer.dispose();
  });

  it("ready: no reload, no state change", async () => {
    const fetch = createFakeFetch({ "https://cdn.test/a.glb": { bytes: fixtureArrayBuffer("table-untextured.glb") } });
    const t = mountForTest({ options: { fetch } });
    await t.viewer.load({ url: "https://cdn.test/a.glb" });
    const n = t.states.length;
    notOffered(await t.viewer.retry());
    expect(fetch.calls).toHaveLength(1);
    expect(t.states.length).toBe(n);
    expect(t.viewer.getState().status).toBe("ready");
    t.viewer.dispose();
  });

  it("an error that offers no retry (404): nothing re-fetched, nothing re-announced", async () => {
    const fetch = createFakeFetch({ "https://cdn.test/a.glb": { status: 404 } });
    const t = mountForTest({ options: { fetch } });
    await t.viewer.load({ url: "https://cdn.test/a.glb" });
    const n = t.states.length;
    notOffered(await t.viewer.retry());
    expect(fetch.calls).toHaveLength(1);
    expect(t.states.length).toBe(n);
    expect(t.errors).toHaveLength(1);
    t.viewer.dispose();
  });

  it("job submission_unknown: retry() does not re-show or re-send anything", async () => {
    const t = mountCreative();
    await t.viewer.showJob({ jobId: "j-unknown", status: "submission_unknown" });
    const n = t.states.length;
    notOffered(await t.viewer.retry());
    expect(t.states.length).toBe(n);
    expect(t.apiCalls).toHaveLength(0);
    t.viewer.dispose();
  });

  it("after dispose: no-op with a clear result (never throws)", async () => {
    const t = mountForTest();
    t.viewer.dispose();
    const r = await t.viewer.retry();
    expect(r).toMatchObject({ ok: false, retried: false });
  });

  it("where retry IS offered (network error) it still re-runs the load", async () => {
    const routes = { "https://cdn.test/a.glb": { networkError: true } };
    const fetch = createFakeFetch(routes);
    const t = mountForTest({ options: { fetch } });
    await t.viewer.load({ url: "https://cdn.test/a.glb" });
    expect(t.viewer.getState().canRetry).toBe(true);
    routes["https://cdn.test/a.glb"] = { bytes: fixtureArrayBuffer("table-untextured.glb") };
    expect((await t.viewer.retry()).ok).toBe(true);
    expect(fetch.calls).toHaveLength(2);
    t.viewer.dispose();
  });
});
