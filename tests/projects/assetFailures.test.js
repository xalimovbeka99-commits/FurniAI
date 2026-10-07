/**
 * What an Open or Download failure does to the card (QE defects G1 and G2 on 34f80a7).
 *
 * G1: 409 RECORD_INTEGRITY_FAILED (and 404 MISSING_JOB) from the asset call is about the job
 *     record, so the card becomes job-errored exactly like the polling path: badge
 *     "Integrity check failed" / "Not found", no Open, no Download. 410 ASSET_UNAVAILABLE stays
 *     per-file: the record is intact and the server status is still succeeded.
 * G2: a server, network or configuration failure on Open never suggests Download (Download
 *     would fail the same way). Only a display failure does.
 */
import { describe, expect, it } from "vitest";
import { byAttr, byClass, flush } from "./fakeDom.js";
import { announcer, button, card, setup } from "./helpers.js";
import { assetBody, errorFor, glbOutput, jobBody, listBody, networkError, succeededJob } from "./fixtures/contractFixtures.js";
import { fakeViewerFactory, v2Like } from "./fixtures/fakeViewer.js";
import { ASSET_MESSAGES, DISPLAY_FAILED_MESSAGE, ERROR_KIND } from "../../src/lib/projects/conceptGallery/errors.js";

const thrower = (code) => () => {
  throw errorFor(code);
};
const badge = (scope) => byClass(scope, "fcg-badge-text")[0].textContent;

/** One succeeded job; asset answers come from `asset(index, callNo)`. */
function gallerySetup(asset, { viewer = false, job = succeededJob(), ...extra } = {}) {
  let n = 0;
  const opened = [];
  const downloads = [];
  const mountAssetViewer = viewer ? fakeViewerFactory(v2Like([])) : undefined;
  const ctx = setup(
    {
      listJobs: () => listBody([job]),
      getJob: () => jobBody(job),
      getAssetUrl: ({ index }) => {
        const r = asset(index, n++);
        if (r instanceof Error || (r && r.code && r.status)) throw r;
        return r || assetBody(job, index);
      },
    },
    {
      ...(viewer ? { mountAssetViewer } : { onOpenConcept: (req) => opened.push(req) }),
      startDownload: (d) => downloads.push(d),
      ...extra,
    },
  );
  return { ...ctx, job, opened, downloads, mountAssetViewer };
}

function expectIntegrityLocked(root, jobId) {
  const c = card(root, jobId);
  expect(badge(c)).toBe("Integrity check failed");
  expect(byClass(c, "fcg-badge")[0].getAttribute("data-error")).toBe(ERROR_KIND.INTEGRITY);
  expect(c.getAttribute("data-status")).toBe("succeeded"); // the server's status is not rewritten
  expect(button(c, "open")).toBeNull();
  expect(button(c, "download")).toBeNull();
  expect(byAttr(c, "data-job-error", "RECORD_INTEGRITY_FAILED")[0].textContent).toMatch(/failed an integrity check/);
}

describe("concept gallery: Open/Download failures on the card (G1)", () => {
  it("Download → 409 RECORD_INTEGRITY_FAILED: card leaves Ready, Open and Download are gone, nothing retried or re-checked", async () => {
    const { root, client, job, downloads } = gallerySetup(() => errorFor("RECORD_INTEGRITY_FAILED"));
    await flush();
    expect(badge(card(root, job.jobId))).toBe("Ready");
    button(root, "download").click();
    await flush();
    expectIntegrityLocked(root, job.jobId);
    expect(client.count("getAssetUrl")).toBe(1);
    expect(client.count("getJob")).toBe(0);
    expect(downloads).toHaveLength(0);
    expect(announcer(root).textContent).toBe(ASSET_MESSAGES[ERROR_KIND.INTEGRITY]);
  });

  it("Open (injected viewer) → 409 RECORD_INTEGRITY_FAILED: panel says why, card is locked like the polling path", async () => {
    const { root, client, job, mountAssetViewer } = gallerySetup(() => errorFor("RECORD_INTEGRITY_FAILED"), { viewer: true });
    await flush();
    button(root, "open").click();
    await flush();
    const status = byAttr(root, "data-viewer-status")[0];
    expect(status.getAttribute("data-code")).toBe("RECORD_INTEGRITY_FAILED");
    expect(status.textContent).toBe(ASSET_MESSAGES[ERROR_KIND.INTEGRITY]);
    expectIntegrityLocked(root, job.jobId);
    expect(mountAssetViewer.made[0].loads).toHaveLength(1);
    expect(client.count("getAssetUrl")).toBe(1);
  });

  it("Open (onOpenConcept hand-off) → resolveUrl() 409 RECORD_INTEGRITY_FAILED locks the card too", async () => {
    const { root, job, opened } = gallerySetup(() => errorFor("RECORD_INTEGRITY_FAILED"));
    await flush();
    button(root, "open").click();
    await expect(opened[0].resolveUrl()).rejects.toMatchObject({ code: "RECORD_INTEGRITY_FAILED", kind: "integrity" });
    await flush();
    expectIntegrityLocked(root, job.jobId);
  });

  it("the lock survives a refresh that still lists the row, and goes when the server drops it", async () => {
    const job = succeededJob();
    let rows = [job];
    const { root, gallery } = setup(
      { listJobs: () => listBody(rows), getJob: () => jobBody(job), getAssetUrl: thrower("RECORD_INTEGRITY_FAILED") },
      { startDownload: () => {} },
    );
    await flush();
    button(root, "download").click();
    await flush();
    expectIntegrityLocked(root, job.jobId);
    await gallery.refresh();
    await flush();
    expectIntegrityLocked(root, job.jobId);
    rows = [];
    await gallery.refresh();
    await flush();
    expect(card(root, job.jobId)).toBeNull();
  });

  it("an integrity failure on one output locks the whole card (it is the record, not the file)", async () => {
    const job = succeededJob({ outputs: [glbOutput(0), glbOutput(1)] });
    const { root } = gallerySetup((index) => (index === 1 ? errorFor("RECORD_INTEGRITY_FAILED") : null), { job });
    await flush();
    expect(byAttr(root, "data-action", "download")).toHaveLength(2);
    byAttr(byAttr(root, "data-output-index", "1")[0], "data-action", "download")[0].click();
    await flush();
    expectIntegrityLocked(root, job.jobId);
    expect(byAttr(root, "data-action", "open")).toHaveLength(0);
  });

  it("404 MISSING_JOB on Download: card shows Not found with no Open/Download (same as the polling path)", async () => {
    const { root, job, client } = gallerySetup(() => errorFor("MISSING_JOB"));
    await flush();
    button(root, "download").click();
    await flush();
    const c = card(root, job.jobId);
    expect(badge(c)).toBe("Not found");
    expect(button(c, "open")).toBeNull();
    expect(button(c, "download")).toBeNull();
    expect(byAttr(c, "data-job-error", "MISSING_JOB")).toHaveLength(1);
    expect(client.count("getAssetUrl")).toBe(1);
  });

  it("410 ASSET_UNAVAILABLE stays per-file: card keeps Ready, the message sits on that file, nothing is retried by itself", async () => {
    const { root, job, client, downloads } = gallerySetup(() => errorFor("ASSET_UNAVAILABLE"), { viewer: true });
    await flush();
    button(root, "open").click();
    await flush();
    const c = card(root, job.jobId);
    expect(badge(c)).toBe("Ready");
    expect(byAttr(c, "data-job-error")).toHaveLength(0);
    expect(byAttr(c, "data-asset-error", "ASSET_UNAVAILABLE")[0].textContent).toBe(ASSET_MESSAGES[ERROR_KIND.ASSET_UNAVAILABLE]);
    expect(client.count("getAssetUrl")).toBe(1);
    expect(client.count("getJob")).toBe(0);
    // A user-initiated Download is still one honest asset call (no automatic retry).
    button(c, "download").click();
    await flush();
    expect(client.count("getAssetUrl")).toBe(2);
    expect(downloads).toHaveLength(0);
    expect(badge(card(root, job.jobId))).toBe("Ready");
  });

  it("410 on one output leaves the other output usable", async () => {
    const job = succeededJob({ outputs: [glbOutput(0), glbOutput(1)] });
    const { root, downloads } = gallerySetup((index) => (index === 0 ? errorFor("ASSET_UNAVAILABLE") : null), { job });
    await flush();
    const out = (i) => byAttr(root, "data-output-index", String(i))[0];
    byAttr(out(0), "data-action", "download")[0].click();
    await flush();
    expect(byAttr(out(0), "data-asset-error", "ASSET_UNAVAILABLE")).toHaveLength(1);
    byAttr(out(1), "data-action", "download")[0].click();
    await flush();
    expect(downloads).toHaveLength(1);
  });

  it("a failure that lands after destroy() changes nothing", async () => {
    let release;
    const gate = new Promise((r) => (release = r));
    const job = succeededJob();
    const { root, gallery } = setup(
      {
        listJobs: () => listBody([job]),
        getJob: () => jobBody(job),
        getAssetUrl: async () => {
          await gate;
          throw errorFor("RECORD_INTEGRITY_FAILED");
        },
      },
      { startDownload: () => {} },
    );
    await flush();
    button(root, "download").click();
    await flush();
    gallery.destroy();
    release();
    await flush();
    expect(gallery.getState().jobErrors).toEqual({});
  });
});

describe("concept gallery: honest server-side messages (G2)", () => {
  const openWith = async (asset) => {
    const ctx = gallerySetup(asset, { viewer: true });
    await flush();
    button(ctx.root, "open").click();
    await flush();
    return { ...ctx, status: byAttr(ctx.root, "data-viewer-status")[0] };
  };

  it.each([
    ["502 PROVIDER_UNAVAILABLE", () => errorFor("PROVIDER_UNAVAILABLE"), ERROR_KIND.PROVIDER_UNAVAILABLE],
    ["500 INTERNAL", () => errorFor("INTERNAL"), ERROR_KIND.SERVER],
    ["a network failure", () => networkError(), ERROR_KIND.NETWORK],
    ["503 CREATIVE_STORE_NOT_CONFIGURED", () => errorFor("CREATIVE_STORE_NOT_CONFIGURED"), ERROR_KIND.NOT_CONFIGURED],
  ])("Open → %s: the panel and card say what happened and never suggest Download", async (_, failure, kind) => {
    const { root, job, status } = await openWith(failure);
    expect(status.textContent).toBe(ASSET_MESSAGES[kind]);
    expect(status.textContent).not.toMatch(/download/i);
    expect(status.textContent).not.toBe(DISPLAY_FAILED_MESSAGE);
    expect(announcer(root).textContent).toBe(ASSET_MESSAGES[kind]);
    const c = card(root, job.jobId);
    expect(byAttr(c, "data-asset-error")[0].textContent).toBe(ASSET_MESSAGES[kind]);
    expect(badge(c)).toBe("Ready"); // transient: the card is not locked
    expect(button(c, "open").disabled).toBe(false);
  });

  it("Open 5xx keeps the server's code on the panel for support, but not its text", async () => {
    const { status } = await openWith(() => errorFor("PROVIDER_UNAVAILABLE"));
    expect(status.getAttribute("data-code")).toBe("PROVIDER_UNAVAILABLE");
    expect(status.textContent).not.toMatch(/generation service is unavailable/);
  });

  it("only a display failure suggests Download", async () => {
    const job = succeededJob();
    const { root } = setup(
      { listJobs: () => listBody([job]), getJob: () => jobBody(job), getAssetUrl: ({ index }) => assetBody(job, index) },
      { mountAssetViewer: fakeViewerFactory(v2Like(["fail", "fail"])) },
    );
    await flush();
    button(root, "open").click();
    await flush();
    expect(byAttr(root, "data-viewer-status")[0].textContent).toBe(DISPLAY_FAILED_MESSAGE);
  });

  it("Download 5xx: ONE call (no automatic retry), the server message, no mention of Open or Download", async () => {
    const { root, client, downloads } = gallerySetup(() => errorFor("INTERNAL"));
    await flush();
    button(root, "download").click();
    await flush();
    expect(client.count("getAssetUrl")).toBe(1);
    expect(downloads).toHaveLength(0);
    const msg = byAttr(root, "data-asset-error", "INTERNAL")[0].textContent;
    expect(msg).toBe(ASSET_MESSAGES[ERROR_KIND.SERVER]);
    expect(msg).not.toMatch(/download|open/i);
  });

  it("no server, network or configuration message points at the other button", () => {
    for (const kind of [ERROR_KIND.SERVER, ERROR_KIND.NETWORK, ERROR_KIND.NOT_CONFIGURED, ERROR_KIND.REQUEST, ERROR_KIND.PROVIDER_UNAVAILABLE, ERROR_KIND.RATE_LIMITED]) {
      expect(ASSET_MESSAGES[kind]).not.toMatch(/download|open/i);
    }
    expect(ASSET_MESSAGES[ERROR_KIND.SERVER]).toMatch(/right now/);
    expect(ASSET_MESSAGES[ERROR_KIND.SERVER]).toMatch(/try again/i);
  });
});
