/**
 * Quality Engineer's review of e62020f (merged with AE viewer v3 1bb8b59), 9 Oct 2026.
 * SIMULATED fixtures. INT-403 runs against Asset Engineer's REAL mountAssetViewer (imported here,
 * in a test only; the gallery source never imports it) through AE's own test harness, so the
 * viewer under test is whatever src/lib/assetViewer holds: v2.1 on this branch, v3 on the
 * candidate merge with 1bb8b59 (both were run; see CONCEPT_GALLERY.md §10).
 *
 * INT-403  any page-wide 401/403 disposes and closes the viewer; ONE announced permission alert.
 * PJ-1     Try again only where a retry can help.
 * name     downloads are saved as furniai-concept-<jobId>-<index>.<fmt|bin>, never the provider's name.
 * A11Y-tap controls are at least 44 x 44 px.
 * PJ-I     billing wording never implies no charge; Sign in button only with a host hook.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountForTest } from "../assetViewer/helpers/mountHarness.js";
import { byAttr, flush } from "./fakeDom.js";
import { setup, button, card, panel, announcer } from "./helpers.js";
import { BILLING_TEXT, ERROR_KIND, LIST_MESSAGES, USER_RETRY_KINDS } from "../../src/lib/projects/conceptGallery/errors.js";
import { conceptFilename, downloadFilename } from "../../src/lib/projects/conceptGallery/mountConceptGallery.js";
import { CONCEPT_GALLERY_CSS } from "../../src/lib/projects/conceptGallery/styles.js";
import { assetBody, errorFor, jobBody, jobView, listBody, networkError, succeededJob } from "./fixtures/contractFixtures.js";
import { fakeViewerFactory, v2Like } from "./fixtures/fakeViewer.js";

const SIGN_IN = /sign(ing)?[\s-]*in/i;
const FORBIDDEN_403 = () => ({ status: 403, code: "FORBIDDEN", message: "Not allowed" });
const permissionAlerts = (root) => byAttr(root, "role", "alert").filter((n) => /permission/.test(n.textContent));

async function settle(turns = 40) {
  for (let i = 0; i < turns; i++) await new Promise((r) => setTimeout(r, 0));
  await flush();
}

/** The REAL viewer (AE's harness: real three + GLTFLoader, fake GPU). Records each mount. */
function realViewerFactory() {
  const made = [];
  const factory = (_el, opts) => {
    const t = mountForTest({ options: opts });
    const dispose = t.viewer.dispose.bind(t.viewer);
    t.disposed = false;
    t.viewer.dispose = () => {
      t.disposed = true;
      return dispose();
    };
    made.push(t);
    return t.viewer;
  };
  factory.made = made;
  return factory;
}

describe("INT-403: page-wide 401/403 closes the viewer; exactly one permission alert", () => {
  it("REAL viewer: a 403 on Open disposes the viewer, removes its panel, ONE permission alert, no sign-in wording", async () => {
    const job = succeededJob();
    const mountAssetViewer = realViewerFactory();
    const viewerErrors = [];
    const { root, client, gallery } = setup(
      { listJobs: () => listBody([job]), getJob: () => jobBody(job), getAssetUrl: () => Promise.reject(FORBIDDEN_403()) },
      { mountAssetViewer, viewerOptions: { onError: (e) => viewerErrors.push(e.code) } },
    );
    await flush();
    button(root, "open").click();
    await settle();
    expect(mountAssetViewer.made).toHaveLength(1);
    const t = mountAssetViewer.made[0];
    expect(viewerErrors).toContain("FORBIDDEN"); // the real viewer did report FORBIDDEN (host onError still called)
    expect(t.disposed).toBe(true);
    expect(byAttr(root, "data-viewer-panel")).toHaveLength(0);
    expect(gallery.getState()).toMatchObject({ list: "error", error: { kind: ERROR_KIND.FORBIDDEN } });
    expect(permissionAlerts(root)).toHaveLength(1);
    expect(announcer(root).textContent).toBe("");
    expect(root.textContent).not.toMatch(SIGN_IN);
    expect(client.count("getAssetUrl")).toBe(1); // one user click, one resolve (autoRetry:false)
    expect(t.viewer.getState().status === "disposed" || t.disposed).toBe(true);
  });

  it("REAL viewer: a 401 on Open is page-wide too (viewer closed, sign-in text, no duplicate alert)", async () => {
    const job = succeededJob();
    const mountAssetViewer = realViewerFactory();
    const { root, gallery } = setup(
      { listJobs: () => listBody([job]), getJob: () => jobBody(job), getAssetUrl: () => Promise.reject(errorFor("MISSING_AUTH")) },
      { mountAssetViewer },
    );
    await flush();
    button(root, "open").click();
    await settle();
    expect(mountAssetViewer.made[0].disposed).toBe(true);
    expect(byAttr(root, "data-viewer-panel")).toHaveLength(0);
    expect(gallery.getState().error.kind).toBe(ERROR_KIND.SIGNED_OUT);
    expect(byAttr(root, "role", "alert").filter((n) => n.textContent.trim())).toHaveLength(1);
  });

  it("the viewer reporting FORBIDDEN on its own (e.g. its Try again) through onError also goes page-wide, after the host's onError", async () => {
    const job = succeededJob();
    const mountAssetViewer = fakeViewerFactory(v2Like([]));
    const hostErrors = [];
    const { root, gallery } = setup(
      { listJobs: () => listBody([job]), getJob: () => jobBody(job), getAssetUrl: ({ index }) => assetBody(job, index) },
      { mountAssetViewer, viewerOptions: { onError: (e) => hostErrors.push(e.code) } },
    );
    await flush();
    button(root, "open").click();
    await flush();
    const v = mountAssetViewer.made[0];
    expect(byAttr(root, "data-viewer-panel")).toHaveLength(1);
    v.opts.onError({ code: "FORBIDDEN", status: 403, serverCode: "FORBIDDEN" }); // what v3 emits after its own retry
    await settle();
    expect(hostErrors).toEqual(["FORBIDDEN"]);
    expect(v.disposed).toBe(true);
    expect(byAttr(root, "data-viewer-panel")).toHaveLength(0);
    expect(gallery.getState().error.kind).toBe(ERROR_KIND.FORBIDDEN);
    expect(permissionAlerts(root)).toHaveLength(1);
  });

  it("a non-page-wide viewer error through onError leaves the viewer alone", async () => {
    const job = succeededJob();
    const mountAssetViewer = fakeViewerFactory(v2Like([]));
    const { root } = setup({ listJobs: () => listBody([job]), getJob: () => jobBody(job), getAssetUrl: ({ index }) => assetBody(job, index) }, { mountAssetViewer });
    await flush();
    button(root, "open").click();
    await flush();
    mountAssetViewer.made[0].opts.onError({ code: "FETCH_FAILED", status: 503 });
    await settle();
    expect(mountAssetViewer.made[0].disposed).toBe(false);
    expect(byAttr(root, "data-viewer-panel")).toHaveLength(1);
  });

  it.each([
    ["Download", "download"],
    ["a status check", "poll"],
    ["a list refresh", "refresh"],
  ])("a 403 from %s while the viewer is open closes it and leaves ONE permission alert", async (_, path) => {
    const ok = succeededJob();
    const proc = jobView();
    let forbid = false;
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const mountAssetViewer = fakeViewerFactory(v2Like([]));
    const { root, gallery } = setup(
      {
        listJobs: () => {
          if (forbid && path === "refresh") throw FORBIDDEN_403();
          return listBody([ok, proc]);
        },
        getJob: ({ jobId }) => {
          if (forbid && path === "poll" && jobId === proc.jobId) throw FORBIDDEN_403();
          return jobBody(jobId === ok.jobId ? ok : proc);
        },
        getAssetUrl: ({ index }) => {
          if (forbid && path === "download") throw FORBIDDEN_403();
          return assetBody(ok, index);
        },
      },
      { mountAssetViewer, startDownload: () => {}, pollIntervalMs: 3000 },
    );
    await flush();
    button(card(root, ok.jobId), "open").click();
    await flush();
    expect(byAttr(root, "data-viewer-panel")).toHaveLength(1);
    forbid = true;
    if (path === "download") button(card(root, ok.jobId), "download").click();
    if (path === "refresh") button(root, "refresh").click();
    try {
      await vi.advanceTimersByTimeAsync(path === "poll" ? 5000 : 0);
      await flush();
    } finally {
      vi.useRealTimers();
    }
    expect(gallery.getState()).toMatchObject({ list: "error", error: { kind: ERROR_KIND.FORBIDDEN } });
    expect(mountAssetViewer.made[0].disposed).toBe(true);
    expect(byAttr(root, "data-viewer-panel")).toHaveLength(0);
    expect(permissionAlerts(root)).toHaveLength(1);
    expect(root.textContent).not.toMatch(SIGN_IN);
  });
});

describe("PJ-1: Try again only where a retry can help", () => {
  it("the retry set is exactly network, 5xx, 429, provider unavailable and not ready", () => {
    expect([...USER_RETRY_KINDS].sort()).toEqual(["asset_not_ready", "network", "provider_unavailable", "rate_limited", "server"]);
  });

  it.each([
    ["network", () => networkError(), true],
    ["5xx", () => errorFor("INTERNAL"), true],
    ["429", () => ({ status: 429, code: "PROVIDER_RATE_LIMITED" }), true],
    ["502 provider unavailable", () => errorFor("PROVIDER_UNAVAILABLE"), true],
    ["503 not configured", () => errorFor("CREATIVE_STORE_NOT_CONFIGURED"), false],
    ["402 provider refused", () => ({ status: 402, code: "PROVIDER_INSUFFICIENT_CREDITS" }), false],
    ["400 request", () => ({ status: 400, code: "BAD_REQUEST" }), false],
    ["404", () => errorFor("MISSING_JOB"), false],
    ["409 integrity", () => errorFor("RECORD_INTEGRITY_FAILED"), false],
    ["malformed list", () => null, false],
    ["401", () => errorFor("MISSING_AUTH"), false],
    ["403", () => FORBIDDEN_403(), false],
  ])("list %s: Try again offered = %s; the header Refresh always stays", async (_, err, offered) => {
    const { root } = setup({
      listJobs: () => {
        const e = err();
        if (e === null) return { ok: true };
        throw e;
      },
    });
    await flush();
    expect(panel(root)).not.toBeNull();
    expect(Boolean(button(panel(root), "retry"))).toBe(offered);
    expect(button(root, "refresh")).not.toBeNull();
  });

  it("Open via the viewer: malformed, provider-refused and bad files get no 'Try opening again'; 5xx and dead links do", async () => {
    for (const [error, offered] of [
      [{ code: "RESOLVE_MALFORMED" }, false],
      [{ code: "RESOLVE_FAILED", status: 402, serverCode: "PROVIDER_INSUFFICIENT_CREDITS" }, false],
      [{ code: "RESOLVE_FAILED", status: 502, serverCode: "PROVIDER_UNAVAILABLE" }, true],
      // display failures: a fresh resolve (new address) can fix a dead/expired link or a lost context...
      [{ code: "FETCH_FAILED", status: 403 }, true],
      [{ code: "ASSET_DISPLAY_FAILED" }, true],
      [{ code: "WEBGL_CONTEXT_LOST" }, true],
      // ...but not a damaged, empty, unsupported or too-large file
      [{ code: "PARSE_FAILED" }, false],
      [{ code: "EMPTY_SCENE" }, false],
      [{ code: "UNSUPPORTED_FORMAT" }, false],
    ]) {
      const job = succeededJob();
      const mountAssetViewer = fakeViewerFactory(async () => ({ ok: false, error }));
      const { root } = setup({ listJobs: () => listBody([job]), getJob: () => jobBody(job), getAssetUrl: ({ index }) => assetBody(job, index) }, { mountAssetViewer });
      await flush();
      button(root, "open").click();
      await flush();
      expect(Boolean(button(root, "retry-asset")), JSON.stringify(error)).toBe(offered);
    }
  });
});

describe("download name: always furniai-concept-<jobId>-<index>.<fmt|bin>", () => {
  const JOB = "00000000-0000-4000-8000-000000000005";

  it("conceptFilename sanitises the job id and format", () => {
    expect(conceptFilename(JOB, 0, "glb")).toBe(`furniai-concept-${JOB}-0.glb`);
    expect(conceptFilename("../../etc/passwd", 2, "GLB")).toBe("furniai-concept-_etc_passwd-2.glb");
    expect(conceptFilename("a b", -1, null)).toBe("furniai-concept-a_b-0.bin");
    expect(conceptFilename("x", 1, "../exe")).toBe("furniai-concept-x-1.exe");
    expect(conceptFilename("x".repeat(200), 0, "glb")).toBe(`furniai-concept-${"x".repeat(64)}-0.glb`);
  });

  it.each([
    ["the provider's name", "asset_out_job_fx_1.glb", `furniai-concept-${JOB}-0.glb`],
    ["a path", "../../asset.glb", `furniai-concept-${JOB}-0.glb`],
    ["another job's FurniAI name", "furniai-concept-other-job-0.glb", `furniai-concept-${JOB}-0.glb`],
    ["another output's FurniAI name", `furniai-concept-${JOB}-1.glb`, `furniai-concept-${JOB}-0.glb`],
    ["the same FurniAI name", `furniai-concept-${JOB}-0.glb`, `furniai-concept-${JOB}-0.glb`],
    ["nothing", undefined, `furniai-concept-${JOB}-0.glb`],
  ])("suggested %s -> %s", (_, suggested, expected) => {
    expect(downloadFilename(JOB, 0, "glb", suggested)).toBe(expected);
  });

  it("the injected startDownload gets the FurniAI name even when the source suggests the provider's", async () => {
    const job = succeededJob();
    const downloads = [];
    const { root } = setup(
      { listJobs: () => listBody([job]), getJob: () => jobBody(job), getAssetUrl: ({ index }) => assetBody(job, index, { filename: "asset_out_job_fx_1.glb" }) },
      { startDownload: (d) => downloads.push(d) },
    );
    await flush();
    button(root, "download").click();
    await flush();
    expect(downloads).toHaveLength(1);
    expect(downloads[0].filename).toBe(conceptFilename(job.jobId, 0, "glb"));
  });

  describe("default download (no startDownload injected)", () => {
    afterEach(() => vi.restoreAllMocks());

    function defaultSetup(fetchImpl) {
      const job = succeededJob();
      const ctx = setup({ listJobs: () => listBody([job]), getJob: () => jobBody(job), getAssetUrl: ({ index }) => assetBody(job, index, { filename: "asset_out_job_fx_1.glb" }) }, { fetchImpl });
      const links = [];
      const create = ctx.doc.createElement.bind(ctx.doc);
      ctx.doc.createElement = (tag) => {
        const n = create(tag);
        if (tag === "a") links.push(n);
        return n;
      };
      return { ...ctx, job, links };
    }

    it("a cross-origin file is read once and saved from a local blob under the FurniAI name; the blob is revoked", async () => {
      const created = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local-1");
      const revoked = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
      const calls = [];
      const fetchImpl = async (url, init) => {
        calls.push({ url, init });
        return { ok: true, blob: async () => new Blob(["SYNTHETIC"]) };
      };
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      try {
        const { root, job, links } = defaultSetup(fetchImpl);
        await vi.advanceTimersByTimeAsync(0);
        button(root, "download").click();
        await vi.advanceTimersByTimeAsync(0);
        expect(calls).toHaveLength(1);
        expect(calls[0].init).toMatchObject({ credentials: "omit", cache: "no-store" });
        expect(created).toHaveBeenCalledTimes(1);
        expect(links).toHaveLength(1);
        expect(links[0].getAttribute("href")).toBe("blob:local-1");
        expect(links[0].getAttribute("download")).toBe(conceptFilename(job.jobId, 0, "glb"));
        expect(links[0].parentNode).toBeNull(); // removed straight away
        await vi.advanceTimersByTimeAsync(10000);
        expect(revoked).toHaveBeenCalledWith("blob:local-1");
      } finally {
        vi.useRealTimers();
      }
    });

    it("if the browser won't let the page read it (CORS), it falls back to one plain link, still offering the FurniAI name", async () => {
      vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:never");
      const { root, job, links } = defaultSetup(async () => {
        throw new TypeError("Failed to fetch");
      });
      await flush();
      button(root, "download").click();
      await settle();
      expect(links).toHaveLength(1);
      expect(links[0].getAttribute("href")).toMatch(/^https?:/);
      expect(links[0].getAttribute("download")).toBe(conceptFilename(job.jobId, 0, "glb"));
    });
  });
});

describe("tap targets and wording", () => {
  it("every gallery button is at least 44 x 44 px (all widths: no media query overrides it)", () => {
    const rule = CONCEPT_GALLERY_CSS.match(/\.fcg-btn\{[^}]*\}/)[0];
    expect(rule).toMatch(/min-height:44px/);
    expect(rule).toMatch(/min-width:44px/);
    for (const m of CONCEPT_GALLERY_CSS.matchAll(/\.fcg-btn[^{]*\{[^}]*\}/g)) {
      expect(m[0]).not.toMatch(/min-height:(?!44px)/);
      expect(m[0]).not.toMatch(/(^|[;{])height:\s*\d/);
    }
  });

  it("billing: unconfirmed / unknown never say 'no cost'; they say the provider hasn't reported one and that it may be charged", () => {
    for (const t of [BILLING_TEXT.unconfirmed, BILLING_TEXT.unconfirmedPending, BILLING_TEXT.missing]) {
      expect(t).not.toMatch(/no cost/i);
      expect(t).toMatch(/may (have been|be) charged|isn't known whether it was charged/);
    }
    expect(BILLING_TEXT.unconfirmed).toMatch(/provider hasn't reported a cost/);
    expect(BILLING_TEXT.unconfirmedPending).toMatch(/provider hasn't reported a cost yet/);
    expect(BILLING_TEXT.reported(12, "provider_cost_units")).toBe("Cost reported by the generation service: 12 provider units (unit unverified).");
  });

  it("Sign in button: only on the 401 panel, only with a host onSignIn, and it calls the hook", async () => {
    let called = 0;
    const withHook = setup({ listJobs: () => Promise.reject(errorFor("MISSING_AUTH")) }, { onSignIn: () => called++ });
    await flush();
    expect(panel(withHook.root).textContent).toContain(LIST_MESSAGES[ERROR_KIND.SIGNED_OUT]);
    button(withHook.root, "sign-in").click();
    expect(called).toBe(1);

    const noHook = setup({ listJobs: () => Promise.reject(errorFor("MISSING_AUTH")) });
    await flush();
    expect(button(noHook.root, "sign-in")).toBeNull();
    expect(panel(noHook.root).textContent).toContain("Sign in to see your 3D concepts.");

    const forbidden = setup({ listJobs: () => Promise.reject(FORBIDDEN_403()) }, { onSignIn: () => called++ });
    await flush();
    expect(button(forbidden.root, "sign-in")).toBeNull();
    expect(forbidden.root.textContent).not.toMatch(SIGN_IN);
  });
});
