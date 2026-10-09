/**
 * AE viewer v3.1 (22bf5bb, INT-403): a FORBIDDEN record carries pageWide:true in getState().error,
 * the "error" event and onError (and load()'s result). SIMULATED fixtures.
 *
 * For each channel the gallery must dispose the viewer, close its panel, show the page-wide 403
 * panel, and the PAGE must end up with exactly ONE permission announcement: the viewer's own alert
 * goes with the viewer, and the gallery writes the permission text into a live region exactly once
 * (counted on every appendChild into a role=alert/status or aria-live node inside the gallery).
 *
 * The flag alone must be enough: the stand-in uses an unknown code ("ACCESS_BLOCKED") unless noted.
 * The last test drives the REAL viewer in src/lib/assetViewer through AE's harness (v2.1 on this
 * branch; v3.1 22bf5bb on the throwaway merge, where it also checks pageWide:true is really sent).
 */
import { afterEach, describe, expect, it } from "vitest";
import { mountForTest } from "../assetViewer/helpers/mountHarness.js";
import { ERROR_MESSAGE } from "../../src/lib/assetViewer/errors.js";
import { byAttr, flush } from "./fakeDom.js";
import { setup, button, announcer } from "./helpers.js";
import { ERROR_KIND, isPageWideViewerRecord, classifyError } from "../../src/lib/projects/conceptGallery/errors.js";
import { assetBody, jobBody, listBody, succeededJob } from "./fixtures/contractFixtures.js";

const PERMISSION = /permission/i;
const SIGN_IN = /sign(ing)?[\s-]*in/i;
const VIEWER_TEXT = "This account doesn't have permission to open this 3D concept.";

async function settle(turns = 30) {
  for (let i = 0; i < turns; i++) await new Promise((r) => setTimeout(r, 0));
  await flush();
}

/** Counts permission-text writes into live regions inside `root` (excludes the viewer's own DOM). */
function countLiveWrites(root) {
  const proto = Object.getPrototypeOf(root);
  const original = proto.appendChild;
  const writes = [];
  const isLive = (n) => n && typeof n.getAttribute === "function" && (/^(alert|status)$/.test(n.getAttribute("role") || "") || n.hasAttribute("aria-live"));
  const inViewer = (n) => {
    for (let p = n; p; p = p.parentNode) if (p.hasAttribute && p.hasAttribute("data-fake-viewer")) return true;
    return false;
  };
  const inRoot = (n) => {
    for (let p = n; p; p = p.parentNode) if (p === root) return true;
    return false;
  };
  proto.appendChild = function (child) {
    const out = original.call(this, child);
    if (inRoot(this) && !inViewer(this)) {
      const text = child.textContent || "";
      if (PERMISSION.test(text) && (isLive(child) || isLive(this))) writes.push(text);
    }
    return out;
  };
  writes.restore = () => {
    proto.appendChild = original;
  };
  return writes;
}

let restore = null;
afterEach(() => {
  if (restore) restore();
  restore = null;
});

/**
 * A v3.1-shaped stand-in. It announces its own alert (role=alert inside its element) when it
 * reports the refusal, and removes it on dispose, like the real overlay.
 */
function channelViewer(channel, { code = "ACCESS_BLOCKED", pageWide = true } = {}) {
  const made = [];
  const factory = (el, opts) => {
    const listeners = { error: [], statechange: [] };
    const rec = { code, message: VIEWER_TEXT, ...(pageWide ? { pageWide: true } : {}) };
    let state = { status: "idle", error: null, concept: null };
    let alertNode = null;
    const box = el.ownerDocument.createElement("div");
    box.setAttribute("data-fake-viewer", "");
    el.appendChild(box);
    const v = {
      opts,
      disposed: false,
      loads: 0,
      on(event, cb) {
        listeners[event]?.push(cb);
        return () => {};
      },
      getState: () => JSON.parse(JSON.stringify(state)),
      dispose() {
        v.disposed = true;
        state = { status: "disposed", error: null, concept: null };
        if (box.parentNode) box.parentNode.removeChild(box);
      },
      announce() {
        alertNode = el.ownerDocument.createElement("p");
        alertNode.setAttribute("role", "alert");
        alertNode.textContent = VIEWER_TEXT;
        box.appendChild(alertNode);
      },
      fail(which) {
        v.announce();
        state = { status: "error", error: rec, concept: null };
        if (which.includes("statechange")) listeners.statechange.forEach((cb) => cb(v.getState()));
        if (which.includes("event")) listeners.error.forEach((cb) => cb({ ...rec }));
        if (which.includes("onError") && opts.onError) opts.onError({ ...rec });
      },
      async load() {
        v.loads++;
        if (channel === "load-result") {
          v.fail([]);
          return { ok: false, error: { ...rec } };
        }
        if (channel === "getState") {
          v.fail([]);
          const { pageWide: _drop, ...bare } = rec;
          return { ok: false, error: bare }; // only getState().error carries the flag
        }
        if (channel === "all") {
          v.fail(["statechange", "event", "onError"]);
          return { ok: false, error: { ...rec } };
        }
        state = { status: "ready", error: null, concept: null };
        // onError / event / statechange: the viewer fails later on its own (after load settled).
        setTimeout(() => v.fail([channel]), 0);
        return { ok: true };
      },
    };
    made.push(v);
    return v;
  };
  factory.made = made;
  return factory;
}

function open(mountAssetViewer, extra = {}) {
  const job = succeededJob();
  const ctx = setup({ listJobs: () => listBody([job]), getJob: () => jobBody(job), getAssetUrl: ({ index }) => assetBody(job, index) }, { mountAssetViewer, ...extra });
  return ctx;
}

const permissionNodes = (doc) => byAttr(doc.body, "role", "alert").concat(byAttr(doc.body, "role", "status")).filter((n) => PERMISSION.test(n.textContent));

describe("AE v3.1 pageWide:true on each channel → viewer closed, page-wide 403, ONE permission announcement", () => {
  it("classifies pageWide:true as FORBIDDEN whatever the code; 401-shaped stays signed out", () => {
    expect(isPageWideViewerRecord({ pageWide: true })).toBe(true);
    expect(isPageWideViewerRecord({ code: "FORBIDDEN" })).toBe(false);
    expect(classifyError({ name: "AssetViewerError", code: "ACCESS_BLOCKED", pageWide: true }).kind).toBe(ERROR_KIND.FORBIDDEN);
    expect(classifyError({ name: "AssetViewerError", code: "SIGN_IN_REQUIRED", status: 401, pageWide: true }).kind).toBe(ERROR_KIND.SIGNED_OUT);
    expect(classifyError({ name: "AssetViewerError", code: "ACCESS_BLOCKED" }).kind).toBe(ERROR_KIND.REQUEST);
  });

  it.each([["load-result"], ["getState"], ["onError"], ["event"], ["statechange"], ["all"]])("channel %s", async (channel) => {
    const mountAssetViewer = channelViewer(channel);
    const hostErrors = [];
    const { root, gallery } = open(mountAssetViewer, { viewerOptions: { onError: (e) => hostErrors.push(e) } });
    await flush();
    const writes = countLiveWrites(root);
    restore = writes.restore;
    button(root, "open").click();
    await settle();
    const v = mountAssetViewer.made[0];
    expect(v.disposed).toBe(true);
    expect(byAttr(root, "data-viewer-panel")).toHaveLength(0);
    expect(byAttr(root, "data-fake-viewer")).toHaveLength(0); // the viewer's own alert left with it
    expect(gallery.getState()).toMatchObject({ list: "error", error: { kind: ERROR_KIND.FORBIDDEN } });
    expect(writes).toHaveLength(1); // the gallery announced the refusal exactly once
    expect(permissionNodes(root.ownerDocument)).toHaveLength(1); // and the page ends with one
    expect(announcer(root).textContent).toBe("");
    expect(root.textContent).not.toMatch(SIGN_IN);
    expect(v.loads).toBe(1);
    if (channel === "onError" || channel === "all") expect(hostErrors.map((e) => e.pageWide)).toEqual([true]); // host's onError still runs
  });

  it("further page-wide reports after the panel is shown don't announce again", async () => {
    const mountAssetViewer = channelViewer("all");
    const { root } = open(mountAssetViewer);
    await flush();
    const writes = countLiveWrites(root);
    restore = writes.restore;
    button(root, "open").click();
    await settle();
    const v = mountAssetViewer.made[0];
    v.fail(["statechange", "event", "onError"]); // a disposed viewer firing late
    await settle();
    expect(writes).toHaveLength(1);
    expect(permissionNodes(root.ownerDocument)).toHaveLength(1);
  });

  it("without pageWide an unknown viewer error stays in the viewer (control)", async () => {
    const mountAssetViewer = channelViewer("event", { pageWide: false });
    const { root, gallery } = open(mountAssetViewer);
    await flush();
    button(root, "open").click();
    await settle();
    expect(mountAssetViewer.made[0].disposed).toBe(false);
    expect(byAttr(root, "data-viewer-panel")).toHaveLength(1);
    expect(gallery.getState().list).not.toBe("error");
  });

  it("REAL viewer: a 403 on Open → disposed, panel closed, gallery announces once; v3.1 sends pageWide:true", async () => {
    const job = succeededJob();
    const made = [];
    const mountAssetViewer = (_el, opts) => {
      const t = mountForTest({ options: opts });
      const dispose = t.viewer.dispose.bind(t.viewer);
      t.disposed = false;
      t.events = [];
      t.states = [];
      t.viewer.on("error", (r) => t.events.push(r));
      t.viewer.on("statechange", (s) => s.error && t.states.push(s.error));
      t.viewer.dispose = () => {
        t.disposed = true;
        return dispose();
      };
      made.push(t);
      return t.viewer;
    };
    const onErrors = [];
    const { root, gallery } = setup(
      { listJobs: () => listBody([job]), getJob: () => jobBody(job), getAssetUrl: () => Promise.reject({ status: 403, code: "FORBIDDEN", message: "Not allowed" }) },
      { mountAssetViewer, viewerOptions: { onError: (e) => onErrors.push(e) } },
    );
    await flush();
    const writes = countLiveWrites(root);
    restore = writes.restore;
    button(root, "open").click();
    await settle(40);
    const t = made[0];
    expect(t.disposed).toBe(true);
    expect(byAttr(root, "data-viewer-panel")).toHaveLength(0);
    expect(gallery.getState().error.kind).toBe(ERROR_KIND.FORBIDDEN);
    expect(writes).toHaveLength(1);
    expect(permissionNodes(root.ownerDocument)).toHaveLength(1);
    const v31 = !/Signing in/.test(ERROR_MESSAGE.FORBIDDEN); // v3.1 dropped the sign-in wording with pageWide
    if (v31) {
      expect(onErrors.some((r) => r.code === "FORBIDDEN" && r.pageWide === true)).toBe(true);
      expect(t.events.some((r) => r.pageWide === true)).toBe(true);
      expect(t.states.some((r) => r.pageWide === true)).toBe(true);
    }
  });
});
