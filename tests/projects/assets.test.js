import { describe, expect, it } from "vitest";
import { byAttr, byClass, deferred, flush } from "./fakeDom.js";
import { setup, card, button, announcer } from "./helpers.js";
import { ASSET_MESSAGES, ERROR_KIND, JOB_MESSAGES } from "../../src/lib/projects/conceptGallery/errors.js";
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

  it("no automatic retry: a transient failure makes ONE call and shows 'Try download again'; only the click resolves again", async () => {
    let n = 0;
    const { root, client, downloads } = succeededSetup((j) => ({ index }) => {
      if (n++ === 0) throw networkError();
      return assetBody(j, index);
    });
    await flush();
    button(root, "download").click();
    await flush();
    await new Promise((r) => setTimeout(r, 30)); // nothing fires by itself
    expect(client.count("getAssetUrl")).toBe(1);
    expect(downloads).toHaveLength(0);
    const again = button(root, "retry-asset");
    expect(again.textContent).toBe("Try download again");
    expect(again.getAttribute("data-retry-for")).toBe("download");
    again.click();
    await flush();
    expect(client.count("getAssetUrl")).toBe(2);
    expect(downloads).toHaveLength(1);
    expect(byAttr(root, "data-asset-error")).toHaveLength(0);
  });

  it("502 PROVIDER_UNAVAILABLE on Download: one call, the provider-unavailable wording, a visible Try again", async () => {
    const { root, client, downloads } = succeededSetup(() => () => {
      throw errorFor("PROVIDER_UNAVAILABLE");
    });
    await flush();
    button(root, "download").click();
    await flush();
    expect(client.count("getAssetUrl")).toBe(1);
    expect(downloads).toHaveLength(0);
    expect(byAttr(root, "data-asset-error", "PROVIDER_UNAVAILABLE")[0].textContent).toBe(ASSET_MESSAGES[ERROR_KIND.PROVIDER_UNAVAILABLE]);
    expect(button(root, "retry-asset")).not.toBeNull();
  });

  it("an asset body without a url is never downloaded and never retried (v2.1 RESOLVE_MALFORMED)", async () => {
    const { root, client, downloads } = succeededSetup((j) => () => ({ ok: true, asset: { jobId: j.jobId, index: 0 } }));
    await flush();
    button(root, "download").click();
    await flush();
    expect(downloads).toHaveLength(0);
    // One call: the gallery never retries by itself (v2.1 answers RESOLVE_MALFORMED).
    expect(client.count("getAssetUrl")).toBe(1);
    const msg = byAttr(root, "data-asset-error", "RESOLVE_MALFORMED")[0].textContent;
    expect(msg).toMatch(/couldn't read/);
    expect(msg).not.toMatch(/try again/i);
  });

  // ---- Retry policy (7 Oct): ONE call per click, "Try again" only where trying again can help ----
  const RETRY_TABLE = [
    ["a network failure", () => networkError(), true],
    ["500 INTERNAL", () => errorFor("INTERNAL"), true],
    ["502 PROVIDER_UNAVAILABLE", () => errorFor("PROVIDER_UNAVAILABLE"), true],
    ["429 PROVIDER_RATE_LIMITED", () => ({ status: 429, code: "PROVIDER_RATE_LIMITED" }), true],
    ["503 STORAGE_UNAVAILABLE", () => ({ status: 503, code: "STORAGE_UNAVAILABLE" }), true],
    ["400 BAD_REQUEST", () => ({ status: 400, code: "BAD_REQUEST" }), false],
    ["a malformed body", (j) => ({ ok: true, asset: { jobId: j.jobId, index: 0 } }), false],
    ["503 CREATIVE_STORE_NOT_CONFIGURED", () => errorFor("CREATIVE_STORE_NOT_CONFIGURED"), false],
    ["401 MISSING_AUTH", () => errorFor("MISSING_AUTH"), false],
    ["403 UNAUTHORIZED", () => ({ status: 403, code: "UNAUTHORIZED" }), false],
    ["404 MISSING_JOB", () => errorFor("MISSING_JOB"), false],
    ["409 ASSET_NOT_READY", () => errorFor("ASSET_NOT_READY"), true],
    ["409 RECORD_INTEGRITY_FAILED", () => errorFor("RECORD_INTEGRITY_FAILED"), false],
    ["410 ASSET_UNAVAILABLE", () => errorFor("ASSET_UNAVAILABLE"), false],
  ];

  it.each(RETRY_TABLE)("Download after %s: exactly 1 asset call, nothing automatic; 'Try again' offered = %s", async (_, failure, offered) => {
    const job = succeededJob();
    const answer = () => {
      const r = failure(job);
      if (r instanceof Error || r.status) throw r;
      return r;
    };
    const downloads = [];
    const { root, client } = setup(
      { listJobs: () => listBody([job]), getJob: () => jobBody(job), getAssetUrl: answer },
      { startDownload: (d) => downloads.push(d) },
    );
    await flush();
    button(root, "download").click();
    await flush();
    await new Promise((r) => setTimeout(r, 30));
    await flush();
    expect(client.count("getAssetUrl")).toBe(1);
    expect(downloads).toHaveLength(0);
    expect(button(root, "retry-asset") !== null).toBe(offered);
    if (offered) {
      button(root, "retry-asset").click();
      await flush();
      expect(client.count("getAssetUrl")).toBe(2); // one more call per click, never more
    }
  });

  it("each click is one fresh resolve that is never stored", async () => {
    let n = 0;
    const urls = [];
    const { root, client, downloads, gallery } = succeededSetup((j) => ({ index }) => {
      if (n++ % 2 === 0) throw errorFor("INTERNAL");
      const b = assetBody(j, index);
      urls.push(b.asset.url);
      return b;
    });
    await flush();
    button(root, "download").click(); // fails
    await flush();
    button(root, "retry-asset").click(); // user asks again: works
    await flush();
    button(root, "download").click(); // fails
    await flush();
    button(root, "retry-asset").click(); // works
    await flush();
    expect(client.count("getAssetUrl")).toBe(4);
    expect(downloads.map((d) => d.url)).toEqual(urls);
    expect(new Set(urls).size).toBe(2);
    expect(JSON.stringify(gallery.getState())).not.toContain("cdn.fixture.invalid");
  });

  it("AE Q15: 403 on Download is page-wide (no retry, not 'sign in'); Refresh brings the list back", async () => {
    let forbidden = true;
    const job = succeededJob();
    const { root, client, gallery } = setup(
      {
        listJobs: () => listBody([job]),
        getJob: () => jobBody(job),
        getAssetUrl: ({ index }) => {
          if (forbidden) throw { status: 403, code: "UNAUTHORIZED", message: "Signed in but not allowed." };
          return assetBody(job, index);
        },
      },
      { startDownload: () => {} },
    );
    await flush();
    button(root, "download").click();
    await flush();
    expect(client.count("getAssetUrl")).toBe(1);
    expect(gallery.getState()).toMatchObject({ list: "error", error: { kind: "forbidden", code: "UNAUTHORIZED" } });
    expect(card(root, job.jobId)).toBeNull();
    expect(byAttr(root, "data-panel", "forbidden")).toHaveLength(1);
    // INT-403: the page-wide panel is the ONE announced message; the announcer stays empty.
    expect(announcer(root).textContent).toBe("");
    expect(byAttr(root, "role", "alert").filter((n) => /permission/.test(n.textContent))).toHaveLength(1);
    expect(root.textContent).not.toMatch(/sign(ing)?[\s-]*in/i);
    forbidden = false;
    button(root, "refresh").click();
    await flush();
    expect(button(card(root, job.jobId), "download")).not.toBeNull();
  });
});
