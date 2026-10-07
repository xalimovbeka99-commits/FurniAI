import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flush } from "./fakeDom.js";
import { setup, card, live, button } from "./helpers.js";
import { byClass, byAttr } from "./fakeDom.js";
import { errorFor, jobBody, jobView, listBody, networkError, succeededJob, failedJob, unknownJob } from "./fixtures/contractFixtures.js";


const tick = async (ms) => {
  await vi.advanceTimersByTimeAsync(ms);
  await flush();
};

describe("concept gallery: polling", () => {
  // Scoped here (not file level) so fake timers never leak into other suites in a shared run.
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it("polls getJob for each non-terminal job every interval, and stops when all are terminal", async () => {
    const p = jobView({ status: "processing" });
    const s = jobView({ status: "submitting" });
    const done = succeededJob();
    let round = 0;
    const { root, client, gallery } = setup({
      listJobs: () => listBody([p, s, done]),
      getJob: ({ jobId }) => {
        const j = jobId === p.jobId ? p : s;
        if (round >= 2) return jobBody(succeededJob({ jobId, updatedAt: "2026-10-04T07:15:00.000Z" }));
        return jobBody({ ...j, status: "processing", updatedAt: "2026-10-04T07:10:10.000Z" }, { ok: true });
      },
    });
    await flush();
    expect(gallery.getState().polling).toBe(true);
    expect(live(root).textContent).toBe("Checking 2 concepts for updates…");
    expect(client.count("getJob")).toBe(0);
    await tick(3999);
    expect(client.count("getJob")).toBe(0);
    await tick(1);
    expect(client.calls.filter((c) => c.method === "getJob").map((c) => c.args.jobId).sort()).toEqual([p.jobId, s.jobId].sort());
    expect(client.calls.every((c) => c.args.accessToken === "test-token")).toBe(true);
    round = 2;
    await tick(4000);
    expect(client.count("getJob")).toBe(4);
    expect(byClass(card(root, p.jobId), "fcg-badge-text")[0].textContent).toBe("Ready");
    expect(gallery.getState().polling).toBe(false);
    expect(live(root).textContent).toBe("");
    await tick(20000);
    expect(client.count("getJob")).toBe(4);
    expect(client.count("listJobs")).toBe(1);
  });

  it("does not poll terminal jobs (succeeded, failed, submission_unknown) at all", async () => {
    const { client, gallery } = setup({ listJobs: () => listBody([succeededJob(), failedJob(), unknownJob()]), getJob: () => jobBody(jobView()) });
    await flush();
    await tick(20000);
    expect(client.count("getJob")).toBe(0);
    expect(gallery.getState().polling).toBe(false);
  });

  it("submission_unknown reached while polling is terminal: polling stops, nothing is retried", async () => {
    const p = jobView();
    const { root, client } = setup({
      listJobs: () => listBody([p]),
      getJob: () => jobBody(unknownJob({ jobId: p.jobId, updatedAt: "2026-10-04T07:20:00.000Z" })),
    });
    await flush();
    await tick(4000);
    expect(byAttr(card(root, p.jobId), "data-submission-unknown")).toHaveLength(1);
    await tick(30000);
    expect(client.count("getJob")).toBe(1);
    expect(client.count("listJobs")).toBe(1);
  });

  it("honours pollIntervalMs inside 3-5 s", async () => {
    const p = jobView();
    const { client } = setup({ listJobs: () => listBody([p]), getJob: () => jobBody(p) }, { pollIntervalMs: 3000 });
    await flush();
    await tick(3000);
    expect(client.count("getJob")).toBe(1);
    await tick(3000);
    expect(client.count("getJob")).toBe(2);
  });

  it("stops on destroy (no further calls, timer cleared)", async () => {
    const p = jobView();
    const { client, gallery } = setup({ listJobs: () => listBody([p]), getJob: () => jobBody(p) });
    await flush();
    gallery.destroy();
    await tick(30000);
    expect(client.count("getJob")).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("pauses while the page is hidden and resumes immediately when visible", async () => {
    const p = jobView();
    const { doc, client, gallery } = setup({ listJobs: () => listBody([p]), getJob: () => jobBody(p) });
    await flush();
    doc.setHidden(true);
    expect(gallery.getState().polling).toBe(false);
    await tick(30000);
    expect(client.count("getJob")).toBe(0);
    doc.setHidden(false);
    await tick(0);
    expect(client.count("getJob")).toBe(1);
    expect(gallery.getState().polling).toBe(true);
  });

  it("failed status checks stay inside 3–5 s (no backoff), pause after 3 in a row, and only 'Check status again' resumes", async () => {
    const p = jobView();
    let fail = 3;
    const { root, client, gallery } = setup({
      listJobs: () => listBody([p]),
      getJob: () => {
        if (fail-- > 0) throw fail === 1 ? errorFor("INTERNAL") : networkError();
        return jobBody(p);
      },
    });
    await flush();
    await tick(4000); // fail 1 -> next check at 5 s (the window's top), not a growing backoff
    expect(gallery.getState()).toMatchObject({ pollFailures: 1, nextPollDelayMs: 5000, pollPaused: null });
    expect(live(root).textContent).toBe("The last status check didn't go through. Checking again in 5 s.");
    await tick(4999);
    expect(client.count("getJob")).toBe(1);
    await tick(1); // fail 2
    expect(gallery.getState()).toMatchObject({ pollFailures: 2, nextPollDelayMs: 5000 });
    await tick(5000); // fail 3 -> paused
    expect(client.count("getJob")).toBe(3);
    expect(gallery.getState()).toMatchObject({ polling: false, pollPaused: { kind: "network" } }); // the last failed round decides the wording
    expect(byAttr(root, "data-poll-paused")[0].textContent).toMatch(/paused after 3 failed attempts/);
    expect(live(root).textContent).toBe("Status checks paused.");
    await tick(120000); // nothing by itself, however long
    expect(client.count("getJob")).toBe(3);
    button(root, "resume-polling").click(); // the user asks
    await tick(0);
    expect(client.count("getJob")).toBe(4);
    expect(gallery.getState()).toMatchObject({ pollFailures: 0, pollPaused: null, nextPollDelayMs: 4000 });
    expect(byClass(card(root, p.jobId), "fcg-badge-text")[0].textContent).toBe("Generating");
  });

  it("429 on a status check pauses polling at once (busy means ask less), with a visible 'Check status again'", async () => {
    const p = jobView();
    const { root, client, gallery } = setup({ listJobs: () => listBody([p]), getJob: () => Promise.reject({ status: 429, code: "PROVIDER_RATE_LIMITED" }) });
    await flush();
    await tick(4000);
    expect(client.count("getJob")).toBe(1);
    expect(gallery.getState().pollPaused).toEqual({ kind: "rate_limited", code: "PROVIDER_RATE_LIMITED" });
    expect(byAttr(root, "data-poll-paused")[0].textContent).toMatch(/paused because FurniAI is busy/);
    await tick(60000);
    expect(client.count("getJob")).toBe(1);
    expect(button(root, "resume-polling")).not.toBeNull();
  });

  it("refresh:{ok:false} keeps polling at the normal interval and says the check is delayed", async () => {
    const p = jobView();
    const { root, client, gallery } = setup({ listJobs: () => listBody([p]), getJob: () => jobBody(p, { ok: false, code: "PROVIDER_RATE_LIMITED" }) });
    await flush();
    await tick(4000);
    expect(byAttr(card(root, p.jobId), "data-check-delayed")).toHaveLength(1);
    expect(gallery.getState().nextPollDelayMs).toBe(4000);
    await tick(4000);
    expect(client.count("getJob")).toBe(2);
  });

  it("401 while polling switches to signed-out and stops", async () => {
    const p = jobView();
    const { root, client, gallery } = setup({
      listJobs: () => listBody([p]),
      getJob: () => {
        throw errorFor("MISSING_AUTH");
      },
    });
    await flush();
    await tick(4000);
    expect(gallery.getState().error.kind).toBe("signed_out");
    expect(byAttr(root, "data-panel", "signed_out")).toHaveLength(1);
    await tick(30000);
    expect(client.count("getJob")).toBe(1);
  });

  it("409 RECORD_INTEGRITY_FAILED on one job marks that card and stops polling only it", async () => {
    const bad = jobView();
    const ok = jobView();
    const { root, client } = setup({
      listJobs: () => listBody([bad, ok]),
      getJob: ({ jobId }) => {
        if (jobId === bad.jobId) throw errorFor("RECORD_INTEGRITY_FAILED");
        return jobBody(ok);
      },
    });
    await flush();
    await tick(4000);
    expect(byAttr(card(root, bad.jobId), "data-job-error", "RECORD_INTEGRITY_FAILED")[0].textContent).toMatch(/integrity check/);
    expect(byClass(card(root, bad.jobId), "fcg-badge-text")[0].textContent).toBe("Integrity check failed");
    expect(byClass(card(root, bad.jobId), "fcg-spinner")).toHaveLength(0);
    await tick(4000);
    const polled = client.calls.filter((c) => c.method === "getJob").map((c) => c.args.jobId);
    expect(polled.filter((id) => id === bad.jobId)).toHaveLength(1);
    expect(polled.filter((id) => id === ok.jobId)).toHaveLength(2);
  });

  it("AE Q15: 403 on a poll is page-wide (account/session), like signed-out: permission panel, polling stops, not 'sign in'", async () => {
    const bad = jobView();
    const ok = jobView();
    const { root, client, gallery } = setup({
      listJobs: () => listBody([bad, ok]),
      getJob: ({ jobId }) => {
        if (jobId === bad.jobId) throw { status: 403, code: "UNAUTHORIZED", message: "no" };
        return jobBody(ok);
      },
    });
    await flush();
    await tick(4000);
    expect(gallery.getState()).toMatchObject({ list: "error", polling: false, error: { kind: "forbidden", code: "UNAUTHORIZED" } });
    expect(card(root, bad.jobId)).toBeNull();
    expect(byAttr(root, "data-panel", "forbidden")).toHaveLength(1);
    expect(root.textContent).not.toMatch(/Sign in/);
    const before = client.calls.filter((c) => c.method === "getJob").length;
    await tick(30000);
    expect(client.calls.filter((c) => c.method === "getJob").length).toBe(before);
  });

  it("a poll round answered after a refresh is discarded (stale guard)", async () => {
    const p = jobView();
    let release;
    const { root, gallery } = setup({
      listJobs: () => listBody([p]),
      getJob: () => new Promise((r) => (release = () => r(jobBody(failedJob({ jobId: p.jobId, updatedAt: "2026-10-04T08:00:00.000Z" }))))),
    });
    await flush();
    await tick(4000);
    gallery.refresh();
    await flush();
    release();
    await flush();
    expect(byClass(card(root, p.jobId), "fcg-badge-text")[0].textContent).toBe("Generating");
  });

  it("without a creative source, polling uses client.getJob with the gallery's token", async () => {
    const p = jobView();
    const { client } = setup({ listJobs: () => listBody([p]), getJob: () => jobBody(p) }, { noSource: true });
    await flush();
    await tick(4000);
    const c = client.calls.filter((x) => x.method === "getJob");
    expect(c).toHaveLength(1);
    expect(c[0].args).toMatchObject({ jobId: p.jobId, accessToken: "test-token" });
  });
});
