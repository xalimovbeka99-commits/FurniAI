/**
 * Open goes through an INJECTED mountAssetViewer (Asset Engineer's v2.1,
 * src/lib/assetViewer/mountAssetViewer.js at b34e259). The fake in fixtures/fakeViewer.js follows
 * that handle's contract for creative refs: load({ jobId, index, format })
 * calls options.creativeSource.resolve() itself and resolves
 * { ok, error?, superseded?, downloadOnly? }; getState(); dispose(). The real viewer
 * needs THREE + WebGL, so it is not mounted here; its own suites cover it.
 */
import { describe, expect, it } from "vitest";
import { byAttr, byClass, deferred, flush } from "./fakeDom.js";
import { setup, button, card } from "./helpers.js";
import { ASSET_MESSAGES, ERROR_KIND } from "../../src/lib/projects/conceptGallery/errors.js";
import { FALLBACK_CONCEPT_NOTICE } from "../../src/lib/projects/conceptGallery/contract.js";
import { assetBody, errorFor, jobBody, listBody, succeededJob, CONCEPT } from "./fixtures/contractFixtures.js";
import { fakeViewerFactory, v2Like } from "./fixtures/fakeViewer.js";

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

  // ---- v2.1 (b34e259) -------------------------------------------------------
  it("v2.1: always mounts the viewer with renderConceptNotice:false, even if viewerOptions says otherwise", async () => {
    const { root, mountAssetViewer } = viewerSetup(v2Like([]), {}, { viewerOptions: { three: "THREE-from-host", renderConceptNotice: true } });
    await flush();
    button(root, "open").click();
    await flush();
    expect(mountAssetViewer.made[0].opts).toMatchObject({ renderConceptNotice: false, three: "THREE-from-host" });
  });

  it("v2.1: the panel always shows the notice, then the server's text from this resolve, verbatim", async () => {
    const serverNotice = "  AI-generated visual concept.\n  Line two, kept as sent.  ";
    const { root, job } = viewerSetup(v2Like([]), {
      getAssetUrl: ({ index }) => assetBody(job, index, { concept: { ...CONCEPT, notice: serverNotice } }),
    });
    await flush();
    button(root, "open").click();
    const notice = () => byAttr(byAttr(root, "data-viewer-panel")[0], "data-concept-notice")[0].textContent;
    expect(notice()).toBe(job.concept.notice); // before any answer: the job's notice
    await flush();
    expect(notice()).toBe(serverNotice); // not trimmed or collapsed
  });

  it("v2.1: the notice stays in the panel when Open fails before any server answer", async () => {
    const job = succeededJob({ concept: null });
    const { root } = setup(
      { listJobs: () => listBody([job]), getJob: () => jobBody(job), getAssetUrl: () => Promise.reject(errorFor("ASSET_UNAVAILABLE")) },
      { mountAssetViewer: fakeViewerFactory(v2Like([])) },
    );
    await flush();
    button(root, "open").click();
    await flush();
    const panelEl = byAttr(root, "data-viewer-panel")[0];
    expect(byAttr(panelEl, "data-viewer-status")[0].getAttribute("data-code")).toBe("ASSET_UNAVAILABLE");
    expect(byAttr(panelEl, "data-concept-notice")[0].textContent).toBe(FALLBACK_CONCEPT_NOTICE);
  });

  it("v2.1 (V1, AE's own re-resolve — question AE-1): the gallery adds no call; after failure only 'Try opening again' runs it again", async () => {
    let n = 0;
    const once = viewerSetup(v2Like([]), {
      getAssetUrl: ({ index }) => {
        if (n++ === 0) throw errorFor("PROVIDER_UNAVAILABLE");
        return assetBody(once.job, index);
      },
    });
    await flush();
    button(once.root, "open").click();
    await flush();
    expect(once.client.count("getAssetUrl")).toBe(2);
    expect(byAttr(once.root, "data-viewer-status")[0].textContent).toBe("");

    const twice = viewerSetup(v2Like([]), { getAssetUrl: () => Promise.reject(errorFor("PROVIDER_UNAVAILABLE")) });
    await flush();
    button(twice.root, "open").click();
    await flush();
    expect(twice.client.count("getAssetUrl")).toBe(2); // both inside AE's viewer.load (v2.1 V1), none from the gallery
    const status = byAttr(twice.root, "data-viewer-status")[0];
    expect(status.textContent).toBe(ASSET_MESSAGES[ERROR_KIND.PROVIDER_UNAVAILABLE]);
    expect(status.textContent).not.toMatch(/download/i);
    await new Promise((r) => setTimeout(r, 30));
    await flush();
    expect(twice.client.count("getAssetUrl")).toBe(2); // nothing by itself
    const again = button(twice.root, "retry-asset");
    expect(again.textContent).toBe("Try opening again");
    again.click();
    await flush();
    expect(twice.client.count("getAssetUrl")).toBe(4); // one user click = one more viewer.load
  });

  it("v2.1 (V2): a malformed resolve answer on Open is never retried and never suggests Download", async () => {
    const { root, client, job } = viewerSetup(v2Like([]), { getAssetUrl: () => ({ ok: true, asset: { jobId: "someone-else", index: 0 } }) });
    await flush();
    button(root, "open").click();
    await flush();
    expect(client.count("getAssetUrl")).toBe(1);
    const status = byAttr(root, "data-viewer-status")[0];
    expect(status.getAttribute("data-code")).toBe("RESOLVE_MALFORMED");
    expect(status.textContent).toBe(ASSET_MESSAGES[ERROR_KIND.MALFORMED]);
    expect(button(card(root, job.jobId), "open")).not.toBeNull(); // not a record problem: no lock
  });

  it("AE Q15 / INT-403: a 403 on Open is FORBIDDEN, page-wide: the viewer closes, the list becomes the ONE permission panel, no sign-in prompt", async () => {
    const { root, client, gallery, mountAssetViewer } = viewerSetup(v2Like([]), {
      getAssetUrl: () => Promise.reject({ status: 403, code: "UNAUTHORIZED", message: "Not allowed." }),
    });
    await flush();
    button(root, "open").click();
    await flush();
    expect(client.count("getAssetUrl")).toBe(1);
    // INT-403: the viewer is disposed and its panel closed; only the page-wide panel speaks.
    expect(byAttr(root, "data-viewer-panel")).toHaveLength(0);
    expect(mountAssetViewer.made[0].disposed).toBe(true);
    expect(byAttr(root, "role", "alert").filter((n) => /permission/.test(n.textContent))).toHaveLength(1);
    expect(gallery.getState()).toMatchObject({ list: "error", error: { kind: "forbidden" } });
    expect(byAttr(root, "data-panel", "forbidden")).toHaveLength(1);
    expect(byAttr(root, "data-action", "open")).toHaveLength(0);
    expect(root.textContent).not.toMatch(/Sign in/);
  });

  it("replica-test BUG-003: Close 3D view hands focus back to the Open button that opened it", async () => {
    const { root, doc } = viewerSetup(v2Like([]));
    await flush();
    button(root, "open").click();
    await flush();
    button(root, "close-viewer").click();
    await flush();
    expect(byAttr(root, "data-viewer-panel")).toHaveLength(0);
    expect(doc.activeElement).toBe(button(root, "open"));
  });
});
