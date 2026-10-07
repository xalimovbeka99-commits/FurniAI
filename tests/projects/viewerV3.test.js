/**
 * Follow-up to AE viewer v3 (1bb8b59, autoRetry option, default off) and AE's confirmation that
 * 403 FORBIDDEN is page-wide (SIMULATED fixtures; the viewer is the fake handle in
 * fixtures/fakeViewer.js, the creative source is the real one).
 *
 * (a) The gallery passes autoRetry:false EXPLICITLY at mount and on every load(), and a viewer
 *     that ignores unknown options (v2.1) still works.
 * (b) 403 is page-wide like signed-out, but WITHOUT any sign-in prompt; 401 keeps its prompt.
 */
import { describe, expect, it } from "vitest";
import { byAttr, byTag, flush } from "./fakeDom.js";
import { setup, button, card, panel } from "./helpers.js";
import { LIST_MESSAGES, ERROR_KIND } from "../../src/lib/projects/conceptGallery/errors.js";
import { assetBody, jobBody, listBody, succeededJob } from "./fixtures/contractFixtures.js";
import { fakeViewerFactory, v2Like } from "./fixtures/fakeViewer.js";

const SIGN_IN = /sign(ing)?[\s-]*in/i;

function viewerSetup(behaviour, handlers = {}, extra = {}) {
  const job = succeededJob();
  const mountAssetViewer = fakeViewerFactory(behaviour);
  const ctx = setup(
    { listJobs: () => listBody([job]), getJob: () => jobBody(job), getAssetUrl: ({ index }) => assetBody(job, index), ...handlers },
    { mountAssetViewer, viewerOptions: { three: "THREE-from-host" }, startDownload: () => {}, ...extra },
  );
  return { ...ctx, job, mountAssetViewer };
}

function expectNoSignInPrompt(root) {
  const actions = [...byTag(root, "button"), ...byTag(root, "a")];
  expect(actions.filter((n) => SIGN_IN.test(n.textContent))).toEqual([]);
  expect(byTag(root, "a").filter((n) => /sign|login|auth/i.test(n.getAttribute("href") || ""))).toEqual([]);
  expect(root.textContent).not.toMatch(SIGN_IN);
}

describe("viewer v3: autoRetry:false is passed explicitly", () => {
  it("the injected viewer factory receives autoRetry:false at mount, even if viewerOptions says true", async () => {
    const { root, mountAssetViewer } = viewerSetup(v2Like([]), {}, { viewerOptions: { three: "THREE-from-host", autoRetry: true } });
    await flush();
    button(root, "open").click();
    await flush();
    expect(mountAssetViewer.made).toHaveLength(1);
    expect(mountAssetViewer.made[0].opts).toMatchObject({ autoRetry: false, renderConceptNotice: false, three: "THREE-from-host" });
  });

  it("every load() call receives autoRetry:false, including the one from 'Try opening again'", async () => {
    let first = true;
    const behaviour = async () => {
      if (first) {
        first = false;
        return { ok: false, error: { code: "RESOLVE_FAILED", status: 502, serverCode: "PROVIDER_UNAVAILABLE" } };
      }
      return { ok: true };
    };
    const { root, mountAssetViewer } = viewerSetup(behaviour);
    await flush();
    button(root, "open").click();
    await flush();
    const v = mountAssetViewer.made[0];
    expect(v.loads).toHaveLength(1);
    expect(v.loads[0]).toMatchObject({ autoRetry: false });
    const retry = button(root, "retry-asset");
    expect(retry).not.toBeNull();
    retry.click();
    await flush();
    expect(v.loads).toHaveLength(2);
    expect(v.loads.every((ref) => ref.autoRetry === false)).toBe(true);
  });

  it("an older viewer that ignores unknown options still opens the concept", async () => {
    const made = [];
    // v2.1-style handle: reads only the fields it knows and never looks at autoRetry.
    const olderViewer = (el, { creativeSource }) => {
      const v = {
        loads: [],
        async load({ jobId, index }) {
          v.loads.push({ jobId, index });
          await creativeSource.resolve(jobId, index);
          return { ok: true };
        },
        getState: () => ({ concept: null }),
        dispose() {},
      };
      made.push(v);
      return v;
    };
    const { root, client, job } = viewerSetup(null, {}, { mountAssetViewer: olderViewer });
    await flush();
    button(root, "open").click();
    await flush();
    expect(made).toHaveLength(1);
    expect(made[0].loads).toEqual([{ jobId: job.jobId, index: 0 }]);
    expect(client.count("getAssetUrl")).toBe(1);
    expect(byAttr(root, "data-viewer-status")[0].textContent).toBe("");
  });
});

describe("403 FORBIDDEN is page-wide, with no sign-in prompt (AE confirmed)", () => {
  const forbidden = () => {
    throw { status: 403, code: "UNAUTHORIZED", message: "Signed in but not allowed." };
  };

  it("list 403: permission panel, no sign-in button, link or text, no Try again", async () => {
    const { root, gallery } = viewerSetup(v2Like([]), { listJobs: forbidden });
    await flush();
    expect(gallery.getState()).toMatchObject({ list: "error", error: { kind: ERROR_KIND.FORBIDDEN } });
    expect(panel(root).getAttribute("data-panel")).toBe("forbidden");
    expect(root.textContent).toContain(LIST_MESSAGES[ERROR_KIND.FORBIDDEN]);
    expect(button(root, "retry")).toBeNull();
    expectNoSignInPrompt(root);
  });

  it("403 from Open or Download goes page-wide the same way, still without a sign-in prompt", async () => {
    for (const action of ["open", "download"]) {
      const { root, gallery, job } = viewerSetup(v2Like([]), { getAssetUrl: forbidden });
      await flush();
      button(root, action).click();
      await flush();
      expect(gallery.getState()).toMatchObject({ list: "error", error: { kind: ERROR_KIND.FORBIDDEN } });
      expect(card(root, job.jobId)).toBeNull();
      expect(byAttr(root, "data-panel", "forbidden")).toHaveLength(1);
      expectNoSignInPrompt(root);
    }
  });

  it("401 keeps its sign-in prompt (contrast)", async () => {
    const { root, gallery } = viewerSetup(v2Like([]), {
      listJobs: () => {
        throw { status: 401, code: "MISSING_AUTH", message: "Sign in." };
      },
    });
    await flush();
    expect(gallery.getState().error.kind).toBe(ERROR_KIND.SIGNED_OUT);
    expect(panel(root).getAttribute("data-panel")).toBe("signed_out");
    expect(root.textContent).toContain("Sign in to see your 3D concepts.");
  });
});
