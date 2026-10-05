import { describe, expect, it } from "vitest";
import { byAttr, byClass, byTag, deferred, flush, allAttributeValues } from "./fakeDom.js";
import { setup, cards, card, button, panel } from "./helpers.js";
import {
  CONCEPT, errorFor, failedJob, glbOutput, jobView, listBody, networkError, succeededJob, unknownJob,
} from "./fixtures/contractFixtures.js";
import { FALLBACK_CONCEPT_NOTICE, SUBMISSION_UNKNOWN_WARNING } from "../../src/lib/projects/conceptGallery/contract.js";

const listOf = (...jobs) => ({ listJobs: () => listBody(jobs), getJob: () => new Promise(() => {}) });

describe("concept gallery: list states", () => {
  it("loading: busy section, skeleton, screen-reader text", async () => {
    const d = deferred();
    const { root, gallery } = setup({ listJobs: () => d.promise });
    const section = byAttr(root, "data-concept-gallery")[0];
    expect(section.getAttribute("aria-busy")).toBe("true");
    expect(byAttr(root, "data-panel", "loading")).toHaveLength(1);
    expect(root.textContent).toContain("Loading your 3D concepts");
    expect(gallery.getState().list).toBe("loading");
    d.resolve(listBody([]));
    await flush();
    expect(section.getAttribute("aria-busy")).toBe("false");
  });

  it("empty", async () => {
    const { root, gallery } = setup(listOf());
    await flush();
    expect(panel(root).getAttribute("data-panel")).toBe("empty");
    expect(root.textContent).toContain("No 3D concepts yet");
    expect(gallery.getState()).toMatchObject({ list: "ready", jobs: [], polling: false });
  });

  it("list: newest-first order kept, id, text status badge, created/updated dates, reference, notice on every card", async () => {
    const a = succeededJob();
    const b = failedJob();
    const c = jobView({ status: "submitting", providerStatus: null, submittedAt: null });
    const { root } = setup(listOf(a, b, c));
    await flush();
    expect(cards(root).map((n) => n.getAttribute("data-job-id"))).toEqual([a.jobId, b.jobId, c.jobId]);
    const first = card(root, a.jobId);
    expect(byClass(first, "fcg-id")[0].textContent).toBe(a.jobId);
    expect(byClass(first, "fcg-badge-text")[0].textContent).toBe("Ready");
    expect(byClass(card(root, b.jobId), "fcg-badge-text")[0].textContent).toBe("Failed");
    expect(byClass(card(root, c.jobId), "fcg-badge-text")[0].textContent).toBe("Submitting");
    const times = byTag(first, "time").map((t) => t.getAttribute("datetime"));
    expect(times).toEqual([a.createdAt, a.updatedAt]);
    expect(first.textContent).toContain(`D(${a.createdAt})`);
    expect(first.textContent).toContain(a.sourceReferenceId);
    for (const n of cards(root)) expect(byAttr(n, "data-concept-notice")[0].textContent).toBe(CONCEPT.notice);
    expect(first.getAttribute("aria-labelledby")).toBe(byTag(first, "h3")[0].id);
  });

  it("no thumbnail image, no dimensions, no designId: a neutral placeholder tile", async () => {
    const a = succeededJob({ thumbnailUrl: "https://x.invalid/t.png", designId: "design-123", dimensions: { widthMm: 900 } });
    const { root } = setup(listOf(a));
    await flush();
    expect(byTag(root, "img")).toHaveLength(0);
    const tile = byClass(root, "fcg-tile")[0];
    expect(tile.getAttribute("aria-hidden")).toBe("true");
    const text = root.textContent;
    expect(text).not.toMatch(/design-123|900|mm\b|dimension/i);
    expect(allAttributeValues(root).join(" ")).not.toMatch(/design-123|t\.png|designId/);
    expect(byTag(root, "a")).toHaveLength(0);
  });

  it("failed job: own wording for a known rev 2 code (server text carries billing claims), no retry", async () => {
    const f = failedJob();
    const { root } = setup(listOf(f));
    await flush();
    const c = card(root, f.jobId);
    const p = byAttr(c, "data-failed", "PROVIDER_REJECTED_REQUEST")[0];
    expect(p.textContent).toBe("Generation failed. The generation service refused this request.");
    expect(p.textContent).not.toContain(f.error.message);
    expect(byTag(c, "button")).toHaveLength(0);
  });

  it("failed job with an unknown code or PROVIDER_GENERATION_FAILED shows the sanitised server message", async () => {
    const a = failedJob({ jobId: "fail-a", error: { code: "SOMETHING_NEW", message: "The provider\nsaid  no." } });
    const b = failedJob({ jobId: "fail-b", error: { code: "PROVIDER_GENERATION_FAILED", message: "simulated generation failure" } });
    const { root } = setup(listOf(a, b));
    await flush();
    expect(byAttr(card(root, "fail-a"), "data-failed")[0].textContent).toBe("Generation failed. The provider said no.");
    expect(byAttr(card(root, "fail-b"), "data-failed")[0].textContent).toBe("Generation failed. simulated generation failure");
  });

  it("submission_unknown: 'may have been charged; not retried' and no retry control", async () => {
    const u = unknownJob();
    const { root, gallery } = setup(listOf(u));
    await flush();
    const c = card(root, u.jobId);
    const w = byAttr(c, "data-submission-unknown")[0];
    expect(w.textContent).toContain("May have been charged.");
    expect(w.textContent).toContain(SUBMISSION_UNKNOWN_WARNING);
    expect(w.textContent).toMatch(/has not been retried/);
    expect(byTag(c, "button")).toHaveLength(0);
    expect(byClass(c, "fcg-badge-text")[0].textContent).toBe("Outcome unknown");
    expect(gallery.getState().polling).toBe(false);
  });

  it("signed out (no token): no API call, sign-in message, no retry button", async () => {
    const { root, client } = setup(listOf(), { getAccessToken: () => null });
    await flush();
    expect(client.count("listJobs")).toBe(0);
    expect(panel(root).getAttribute("data-panel")).toBe("signed_out");
    expect(root.textContent).toContain("Sign in to see your 3D concepts.");
    expect(button(root, "retry")).toBeNull();
  });

  it("signed out (401 MISSING_AUTH from the API)", async () => {
    const { root, gallery } = setup({
      listJobs: () => {
        throw errorFor("MISSING_AUTH");
      },
    });
    await flush();
    expect(panel(root).getAttribute("data-panel")).toBe("signed_out");
    expect(gallery.getState().error).toMatchObject({ kind: "signed_out", code: "MISSING_AUTH" });
  });

  it("v2.1: a 403 list answer is not signed out: a permission message, no sign-in prompt, no Try again", async () => {
    for (const err of [{ status: 403, code: "UNAUTHORIZED" }, { status: 403 }]) {
      const { root, gallery } = setup({
        listJobs: () => {
          throw err;
        },
      });
      await flush();
      expect(panel(root).getAttribute("data-panel")).toBe("forbidden");
      expect(gallery.getState().error.kind).toBe("forbidden");
      expect(root.textContent).toContain("This account doesn't have permission to see these 3D concepts.");
      expect(root.textContent).not.toContain("Sign in to see");
      expect(button(root, "retry")).toBeNull();
      expect(button(root, "refresh")).not.toBeNull(); // the header Refresh stays
    }
  });

  it("v2.1: the server's notice is shown verbatim on the card; a blank one falls back to the contract text", async () => {
    const verbatim = "  Server notice,\n  exactly as sent.  ";
    const a = succeededJob({ concept: { ...CONCEPT, notice: verbatim } });
    const b = succeededJob({ concept: { ...CONCEPT, notice: "   " } });
    const { root } = setup(listOf(a, b));
    await flush();
    expect(byAttr(card(root, a.jobId), "data-concept-notice")[0].textContent).toBe(verbatim);
    expect(byAttr(card(root, b.jobId), "data-concept-notice")[0].textContent).toBe(FALLBACK_CONCEPT_NOTICE);
  });

  it("network failure, then Try again recovers", async () => {
    let n = 0;
    const j = succeededJob();
    const { root, client } = setup({
      listJobs: () => {
        if (n++ === 0) throw networkError();
        return listBody([j]);
      },
    });
    await flush();
    expect(panel(root).getAttribute("data-panel")).toBe("network");
    expect(panel(root).getAttribute("role")).toBe("alert");
    button(root, "retry").click();
    await flush();
    expect(client.count("listJobs")).toBe(2);
    expect(cards(root)).toHaveLength(1);
  });

  it("5xx shows a server message with the code; message text from the server is not shown", async () => {
    const { root } = setup({
      listJobs: () => {
        throw { status: 500, code: "INTERNAL", message: "<b>stack trace</b>" };
      },
    });
    await flush();
    expect(panel(root).getAttribute("data-panel")).toBe("server");
    expect(panel(root).getAttribute("data-code")).toBe("INTERNAL");
    expect(root.textContent).not.toContain("stack trace");
    expect(button(root, "retry")).not.toBeNull();
  });

  it("503 CREATIVE_STORE_NOT_CONFIGURED is shown as not available on this deployment", async () => {
    const { root } = setup({
      listJobs: () => {
        throw errorFor("CREATIVE_STORE_NOT_CONFIGURED");
      },
    });
    await flush();
    expect(panel(root).getAttribute("data-panel")).toBe("not_configured");
  });

  it("escapes everything: hostile ids and messages stay text", async () => {
    const evil = '<img src=x onerror="alert(1)">';
    const f = failedJob({ jobId: evil, model: evil, error: { code: "X", message: evil } });
    const { root } = setup(listOf(f));
    await flush();
    expect(byTag(root, "img")).toHaveLength(0);
    expect(card(root, evil).textContent).toContain(evil);
  });

  it("providerProgress is never rendered (no percentage) and providerStatus is never shown or branched on", async () => {
    const weird = jobView({ status: "processing", providerStatus: "success", providerProgress: 0.42 });
    const big = jobView({ status: "processing", providerStatus: "sim-done", providerProgress: 87 });
    const done = succeededJob({ providerStatus: "failure", providerProgress: 55 });
    const { root } = setup(listOf(weird, big, done));
    await flush();
    const text = root.textContent;
    expect(text).not.toMatch(/%|0\.42|\b87\b|\b55\b/);
    expect(text).not.toMatch(/sim-done|\bsuccess\b|\bfailure\b/);
    expect(byClass(card(root, weird.jobId), "fcg-badge-text")[0].textContent).toBe("Generating");
    expect(byClass(card(root, done.jobId), "fcg-badge-text")[0].textContent).toBe("Ready");
    expect(byTag(root, "progress")).toHaveLength(0);
    expect(byAttr(card(root, weird.jobId), "data-action")).toHaveLength(0);
  });

  it("succeeded: viewable outputs get Open (with onOpenConcept) and Download; other formats are download-only", async () => {
    const j = succeededJob({ outputs: [glbOutput(0), { index: 1, format: "fbx", mimeType: null }, { index: 2, format: null, mimeType: null }] });
    const { root } = setup(listOf(j), { onOpenConcept: () => {} });
    await flush();
    const outs = byClass(card(root, j.jobId), "fcg-output");
    expect(outs.map((o) => byAttr(o, "data-action").map((b) => b.getAttribute("data-action")))).toEqual([
      ["open", "download"],
      ["download"],
      ["download"],
    ]);
    expect(outs[1].textContent).toContain("Download only");
    expect(card(root, j.jobId).textContent).toContain("3 files: GLB, FBX, Unknown format");
  });

  it("without onOpenConcept there is no Open button", async () => {
    const j = succeededJob();
    const { root } = setup(listOf(j));
    await flush();
    expect(button(root, "open")).toBeNull();
    expect(button(root, "download")).not.toBeNull();
  });

  it("stale list answers are ignored: an older refresh can't overwrite a newer one", async () => {
    const first = deferred();
    const second = deferred();
    const q = [first, second];
    const { root, gallery } = setup({ listJobs: () => q.shift().promise });
    gallery.refresh();
    const newer = succeededJob();
    second.resolve(listBody([newer]));
    await flush();
    first.resolve(listBody([failedJob(), failedJob()]));
    await flush();
    expect(cards(root).map((c) => c.getAttribute("data-job-id"))).toEqual([newer.jobId]);
  });

  it("destroy removes the DOM, the listener, and ignores late answers", async () => {
    const d = deferred();
    const { root, doc, gallery } = setup({ listJobs: () => d.promise });
    expect(doc.listenerCount("visibilitychange")).toBe(1);
    gallery.destroy();
    gallery.destroy();
    expect(root.childNodes).toHaveLength(0);
    expect(doc.listenerCount("visibilitychange")).toBe(0);
    d.resolve(listBody([succeededJob()]));
    await flush();
    expect(root.childNodes).toHaveLength(0);
    expect(gallery.getState().destroyed).toBe(true);
  });

  it("validates its options", () => {
    expect(() => setup({}, { client: {} })).toThrow(/client.listJobs/);
    expect(() => setup(listOf(), { getAccessToken: undefined })).toThrow(/getAccessToken/);
  });

  it("injects the token-based stylesheet once", async () => {
    const { doc, root, client } = setup(listOf());
    const { mountConceptGallery } = await import("../../src/lib/projects/conceptGallery/index.js");
    mountConceptGallery(root, { client, getAccessToken: () => "t" });
    const styles = byTag(doc.head, "style");
    expect(styles).toHaveLength(1);
    expect(styles[0].textContent).toContain("var(--status-error-bg,#fef2f2)");
    expect(styles[0].textContent).toContain("var(--font-mono,'Space Mono',monospace)");
  });
});
