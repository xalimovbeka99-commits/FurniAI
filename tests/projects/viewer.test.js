/**
 * Open goes through an INJECTED mountAssetViewer (Asset Engineer's v2,
 * src/lib/assetViewer/mountAssetViewer.js at 42c3fa6). The fake below follows
 * that handle's contract for creative refs: load({ jobId, index, format })
 * calls options.creativeSource.resolve() itself and resolves
 * { ok, error?, superseded?, downloadOnly? }; dispose(). The real viewer
 * needs THREE + WebGL, so it is not mounted here; its own suites cover it.
 */
import { describe, expect, it } from "vitest";
import { byAttr, deferred, flush } from "./fakeDom.js";
import { setup, button } from "./helpers.js";
import { assetBody, errorFor, jobBody, listBody, succeededJob, CONCEPT } from "./fixtures/contractFixtures.js";

function fakeViewerFactory(behaviour = async () => ({ ok: true })) {
  const made = [];
  const factory = (el, opts) => {
    const v = {
      el,
      opts,
      loads: [],
      urls: [],
      disposed: false,
      async load(ref) {
        v.loads.push(ref);
        return behaviour(v, ref, opts.creativeSource);
      },
      dispose() {
        v.disposed = true;
      },
    };
    made.push(v);
    return v;
  };
  factory.made = made;
  return factory;
}

/** Mimics v2 creativeFlow: resolve -> display; on a display failure re-resolve once and retry once. */
const v2Like = (displayResults) => async (v, ref, source) => {
  for (let attempt = 0; attempt < 2; attempt++) {
    let d;
    try {
      d = await source.resolve(ref.jobId, ref.index);
    } catch (e) {
      return { ok: false, error: { code: e.code, serverCode: e.serverCode, status: e.status } };
    }
    v.urls.push(d.url);
    const r = displayResults.length ? displayResults.shift() : "ok";
    if (r === "ok") return { ok: true };
  }
  return { ok: false, error: { code: "ASSET_DISPLAY_FAILED" } };
};

function viewerSetup(behaviour, handlers = {}, extra = {}) {
  const job = succeededJob();
  const mountAssetViewer = fakeViewerFactory(behaviour);
  const ctx = setup(
    { listJobs: () => listBody([job]), getJob: () => jobBody(job), getAssetUrl: ({ index }) => assetBody(job, index), ...handlers },
    { mountAssetViewer, viewerOptions: { three: "THREE-from-host" }, ...extra },
  );
  return { ...ctx, job, mountAssetViewer };
}

describe("concept gallery: injected asset viewer (v2)", () => {
  it("Open mounts the injected viewer with the injected source and loads a job-output reference, never a URL", async () => {
    const { root, client, job, mountAssetViewer, creativeSource } = viewerSetup(v2Like([]));
    await flush();
    button(root, "open").click();
    await flush();
    expect(mountAssetViewer.made).toHaveLength(1);
    const v = mountAssetViewer.made[0];
    expect(v.opts.three).toBe("THREE-from-host");
    expect(v.opts.creativeSource).toBe(creativeSource);
    expect(v.loads[0]).toMatchObject({ jobId: job.jobId, index: 0, format: "glb" });
    expect(v.loads[0].concept).toEqual(CONCEPT);
    expect(JSON.stringify(v.loads[0])).not.toMatch(/https?:/);
    const panel = byAttr(root, "data-viewer-panel")[0];
    expect(panel.getAttribute("data-job-id")).toBe(job.jobId);
    expect(byAttr(panel, "data-concept-notice")[0].textContent).toBe(CONCEPT.notice);
    button(root, "open").click();
    await flush();
    expect(mountAssetViewer.made).toHaveLength(1);
    expect(v.loads).toHaveLength(2);
    expect(v.urls[0]).not.toBe(v.urls[1]);
    expect(client.count("getAssetUrl")).toBe(2);
  });

  it("a display failure is retried by the viewer with one fresh resolve (the gallery adds no extra retry)", async () => {
    const { root, client, mountAssetViewer } = viewerSetup(v2Like(["fail", "ok"]));
    await flush();
    button(root, "open").click();
    await flush();
    expect(mountAssetViewer.made[0].loads).toHaveLength(1);
    expect(client.count("getAssetUrl")).toBe(2);
    expect(byAttr(root, "data-viewer-status")[0].textContent).toBe("");
  });

  it("ASSET_DISPLAY_FAILED after the viewer's retry: message, still downloadable", async () => {
    const { root } = viewerSetup(v2Like(["fail", "fail"]));
    await flush();
    button(root, "open").click();
    await flush();
    const status = byAttr(root, "data-viewer-status")[0];
    expect(status.getAttribute("data-code")).toBe("ASSET_DISPLAY_FAILED");
    expect(status.textContent).toMatch(/Downloading it may still work/);
    expect(button(root, "download").disabled).toBe(false);
  });

  it("410 ASSET_UNAVAILABLE from the viewer's resolve is shown in the panel and on the card", async () => {
    const { root } = viewerSetup(v2Like([]), {
      getAssetUrl: () => {
        throw errorFor("ASSET_UNAVAILABLE");
      },
    });
    await flush();
    button(root, "open").click();
    await flush();
    expect(byAttr(root, "data-viewer-status")[0].getAttribute("data-code")).toBe("ASSET_UNAVAILABLE");
    expect(byAttr(root, "data-asset-error", "ASSET_UNAVAILABLE")).toHaveLength(1);
  });

  it("409 RECORD_INTEGRITY_FAILED from the viewer maps by code", async () => {
    const { root } = viewerSetup(v2Like([]), {
      getAssetUrl: () => {
        throw errorFor("RECORD_INTEGRITY_FAILED");
      },
    });
    await flush();
    button(root, "open").click();
    await flush();
    expect(byAttr(root, "data-viewer-status")[0].textContent).toMatch(/integrity check/);
  });

  it("Open is busy while the viewer loads; closing mid-load ignores the late result", async () => {
    const d = deferred();
    const { root, mountAssetViewer } = viewerSetup(async () => d.promise);
    await flush();
    button(root, "open").click();
    await flush();
    expect(button(root, "open").getAttribute("aria-busy")).toBe("true");
    button(root, "close-viewer").click();
    expect(mountAssetViewer.made[0].disposed).toBe(true);
    d.resolve({ ok: false, error: { code: "FETCH_FAILED" } });
    await flush();
    expect(byAttr(root, "data-viewer-panel")).toHaveLength(0);
    expect(byAttr(root, "data-asset-error")).toHaveLength(0);
    expect(button(root, "open").disabled).toBe(false);
  });

  it("Close and destroy dispose the viewer", async () => {
    const { root, gallery, mountAssetViewer } = viewerSetup(v2Like([]));
    await flush();
    button(root, "open").click();
    await flush();
    button(root, "close-viewer").click();
    expect(mountAssetViewer.made[0].disposed).toBe(true);
    expect(byAttr(root, "data-viewer-panel")).toHaveLength(0);
    button(root, "open").click();
    await flush();
    expect(mountAssetViewer.made).toHaveLength(2);
    gallery.destroy();
    expect(mountAssetViewer.made[1].disposed).toBe(true);
  });

  it("a viewer factory that throws leaves the gallery working", async () => {
    const { root } = viewerSetup(null, {}, {
      mountAssetViewer: () => {
        throw new Error("no WebGL");
      },
    });
    await flush();
    button(root, "open").click();
    await flush();
    expect(byAttr(root, "data-viewer-panel")).toHaveLength(0);
    expect(byAttr(root, "data-announcer")[0].textContent).toMatch(/couldn't start/);
    expect(button(root, "download")).not.toBeNull();
  });

  it("Download goes through creativeSource.resolve(), not the viewer", async () => {
    const downloads = [];
    const { root, mountAssetViewer, client } = viewerSetup(v2Like([]), {}, { startDownload: (d) => downloads.push(d.url) });
    await flush();
    button(root, "download").click();
    await flush();
    expect(client.count("getAssetUrl")).toBe(1);
    expect(downloads).toHaveLength(1);
    expect(mountAssetViewer.made).toHaveLength(0);
  });
});
