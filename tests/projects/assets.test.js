import { describe, expect, it } from "vitest";
import { byAttr, deferred, flush } from "./fakeDom.js";
import { setup, card, button, announcer } from "./helpers.js";
import { assetBody, errorFor, jobBody, listBody, networkError, succeededJob, CONCEPT, jobView } from "./fixtures/contractFixtures.js";

function succeededSetup(assetHandler, extra = {}) {
  const job = succeededJob();
  const opened = [];
  const downloads = [];
  const ctx = setup(
    { listJobs: () => listBody([job]), getJob: () => jobBody(job), getAssetUrl: assetHandler(job) },
    { onOpenConcept: (req) => opened.push(req), startDownload: (d) => downloads.push(d), ...extra },
  );
  return { ...ctx, job, opened, downloads };
}

describe("concept gallery: asset URLs", () => {
  it("Open hands the viewer a resolver, never a URL; every resolveUrl() is a new asset call", async () => {
    const { root, client, job, opened } = succeededSetup((j) => ({ index }) => assetBody(j, index));
    await flush();
    button(root, "open").click();
    expect(opened).toHaveLength(1);
    const req = opened[0];
    expect(Object.keys(req).sort()).toEqual(["format", "index", "jobId", "mimeType", "notice", "resolveUrl"]);
    expect(req).toMatchObject({ jobId: job.jobId, index: 0, format: "glb", notice: CONCEPT.notice });
    expect(JSON.stringify(req)).not.toMatch(/https?:/);
    expect(client.count("getAssetUrl")).toBe(0); // the viewer decides when to load
    const u1 = await req.resolveUrl();
    const u2 = await req.resolveUrl();
    expect(u1).not.toBe(u2);
    button(root, "open").click();
    await opened[1].resolveUrl();
    expect(client.count("getAssetUrl")).toBe(3);
    expect(client.calls.filter((c) => c.method === "getAssetUrl").every((c) => c.args.jobId === job.jobId && c.args.index === 0 && c.args.accessToken === "test-token")).toBe(true);
  });

  it("Download resolves a fresh URL on every click and never keeps it", async () => {
    const { root, client, gallery, downloads, job } = succeededSetup((j) => ({ index }) => assetBody(j, index));
    await flush();
    button(root, "download").click();
    await flush();
    button(root, "download").click();
    await flush();
    expect(client.count("getAssetUrl")).toBe(2);
    expect(downloads).toHaveLength(2);
    expect(downloads[0].url).not.toBe(downloads[1].url);
    expect(downloads[0].filename).toBe(`furniai-concept-${job.jobId}-0.glb`); // the source's own name
    const state = JSON.stringify(gallery.getState());
    expect(state).not.toMatch(/https?:|cdn\.fixture/);
    const attrs = byAttr(root, "href");
    expect(attrs).toHaveLength(0);
  });

  it("retries once on a transient failure, then succeeds", async () => {
    let n = 0;
    const { root, client, downloads } = succeededSetup((j) => ({ index }) => {
      if (n++ === 0) throw networkError();
      return assetBody(j, index);
    });
    await flush();
    button(root, "download").click();
    await flush();
    expect(client.count("getAssetUrl")).toBe(2);
    expect(downloads).toHaveLength(1);
    expect(byAttr(root, "data-asset-error")).toHaveLength(0);
  });

  it("retries only once: two transient failures show an error", async () => {
    const { root, client, downloads } = succeededSetup(() => () => {
      throw errorFor("PROVIDER_UNAVAILABLE");
    });
    await flush();
    button(root, "download").click();
    await flush();
    expect(client.count("getAssetUrl")).toBe(2);
    expect(downloads).toHaveLength(0);
    expect(byAttr(root, "data-asset-error", "PROVIDER_UNAVAILABLE")[0].textContent).toMatch(/couldn't get this file right now/);
  });

  it("410 ASSET_UNAVAILABLE: clear message, announced, no retry", async () => {
    const { root, client } = succeededSetup(() => () => {
      throw errorFor("ASSET_UNAVAILABLE");
    });
    await flush();
    button(root, "download").click();
    await flush();
    expect(client.count("getAssetUrl")).toBe(1);
    const msg = byAttr(root, "data-asset-error", "ASSET_UNAVAILABLE")[0].textContent;
    expect(msg).toMatch(/no longer available/);
    expect(msg).toMatch(/no stored copy/);
    expect(announcer(root).textContent).toBe(msg);
  });

  it("409 RECORD_INTEGRITY_FAILED on the asset: integrity message, no retry", async () => {
    const { root, client, opened } = succeededSetup(() => () => {
      throw errorFor("RECORD_INTEGRITY_FAILED");
    });
    await flush();
    button(root, "open").click();
    await expect(opened[0].resolveUrl()).rejects.toMatchObject({ name: "ConceptAssetError", code: "RECORD_INTEGRITY_FAILED", kind: "integrity" });
    await flush();
    expect(client.count("getAssetUrl")).toBe(1);
    // The record is refused, so the card becomes job-errored (no Open/Download); see assetFailures.test.js.
    expect(byAttr(root, "data-job-error", "RECORD_INTEGRITY_FAILED")[0].textContent).toMatch(/integrity check/);
    expect(button(root, "open")).toBeNull();
  });

  it("409 ASSET_NOT_READY: message, no retry, and the job's status is re-checked once", async () => {
    const job = succeededJob();
    const { root, client } = setup(
      {
        listJobs: () => listBody([job]),
        getJob: () => jobBody(jobView({ jobId: job.jobId, status: "processing", updatedAt: "2026-10-04T08:00:00.000Z" })),
        getAssetUrl: () => {
          throw errorFor("ASSET_NOT_READY");
        },
      },
      { startDownload: () => {} },
    );
    await flush();
    button(root, "download").click();
    await flush();
    expect(client.count("getAssetUrl")).toBe(1);
    expect(client.count("getJob")).toBe(1);
    expect(card(root, job.jobId).getAttribute("data-status")).toBe("processing");
  });

  it("buttons are busy (disabled, aria-busy, text) while the address is being fetched", async () => {
    const d = deferred();
    const { root } = succeededSetup(() => () => d.promise);
    await flush();
    button(root, "download").click();
    await flush();
    const b = button(root, "download");
    expect(b.disabled).toBe(true);
    expect(b.getAttribute("aria-busy")).toBe("true");
    expect(b.textContent).toBe("Getting file…");
    expect(button(root, "open").disabled).toBe(true);
    d.resolve(assetBody(succeededJob(), 0));
    await flush();
    expect(button(root, "download").disabled).toBe(false);
  });

  it("assetResolver is an alias for the injected creative source; its resolve() is called every time", async () => {
    const job = succeededJob();
    let calls = 0;
    const downloads = [];
    const { root } = setup(
      { listJobs: () => listBody([job]), getJob: () => jobBody(job) },
      {
        noSource: true,
        assetResolver: {
          resolve: async (jobId, index) => {
            calls++;
            return { jobId, index, url: `https://cdn.fixture.invalid/${jobId}/${index}/${calls}.glb`, format: "glb", filename: `furniai-concept-${jobId}-${index}.glb` };
          },
        },
        startDownload: (d) => downloads.push(d.url),
      },
    );
    await flush();
    button(root, "download").click();
    await flush();
    button(root, "download").click();
    await flush();
    expect(calls).toBe(2);
    expect(new Set(downloads).size).toBe(2);
  });

  it("without a creative source there is no Open or Download (no second URL resolver is built)", async () => {
    const job = succeededJob();
    const { root, client } = setup({ listJobs: () => listBody([job]), getJob: () => jobBody(job) }, { noSource: true, onOpenConcept: () => {} });
    await flush();
    expect(button(root, "open")).toBeNull();
    expect(button(root, "download")).toBeNull();
    expect(byAttr(root, "data-no-source")).toHaveLength(1);
    expect(client.count("getAssetUrl")).toBe(0);
  });

  it("an asset body without a url is never downloaded (source answers RESOLVE_FAILED; see open question)", async () => {
    const { root, client, downloads } = succeededSetup((j) => () => ({ ok: true, asset: { jobId: j.jobId, index: 0 } }));
    await flush();
    button(root, "download").click();
    await flush();
    expect(downloads).toHaveLength(0);
    // createCreativeAssetSource reports a malformed body and a network error with the same
    // status-less RESOLVE_FAILED, so the gallery's single transient retry also fires here.
    expect(client.count("getAssetUrl")).toBe(2);
    expect(byAttr(root, "data-asset-error")).toHaveLength(1);
  });
});
