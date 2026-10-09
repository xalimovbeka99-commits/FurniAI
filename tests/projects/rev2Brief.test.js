/**
 * Bekzod's 7 Oct brief, rev 2 alignment. SYNTHETIC/MOCKED data only: Claude's SIMULATED rev 2
 * fixture pack and in-memory fakes; no /api/creative deployment, no Scenario, no paid call.
 *
 * Covers: the thin jobs client, reload restoring jobs from the server list, error vs empty,
 * NO automatic retries (request counts), 429, budget, provider unavailable, every billingOutcome
 * and PRIOR_SUBMISSION_UNKNOWN wording, concept vs design separation, Open/Download only when
 * a result is available, and reference thumbnails.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { allAttributeValues, byAttr, byClass, byTag, createFakeDocument, flush } from "./fakeDom.js";
import { setup, card, cards, button, panel } from "./helpers.js";
import { mountConceptGallery } from "../../src/lib/projects/conceptGallery/index.js";
import { createCreativeJobsClient, studioAccessToken } from "../../src/lib/projects/conceptGallery/jobsClient.js";
import { describeSubmitResponse, SUBMIT_BILLING_TEXT } from "../../src/lib/projects/conceptGallery/submitOutcome.js";
import { BILLING_TEXT, ERROR_KIND, LIST_MESSAGES, PRIOR_SUBMISSION_UNKNOWN_CARD_NOTE, PRIOR_SUBMISSION_UNKNOWN_MESSAGE } from "../../src/lib/projects/conceptGallery/errors.js";
import { glbOutput, jobView, succeededJob, failedJob, unknownJob, networkError, errorFor } from "./fixtures/contractFixtures.js";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "rev2");
const fx = (name) => JSON.parse(readFileSync(join(DIR, name), "utf8"));
const body = (name) => fx(name).response;
const fixtureError = (name) => {
  const f = fx(name);
  return { status: f._fixture.httpStatus, code: f.response.code, message: f.response.error, details: f.response.details };
};
const LIST = body("jobs.list.200.json").jobs;
const FREE_CLAIM = /no charge|not charged|free of charge|\bfree\b|nothing (was|is|will be) charged|wasn't charged|won't be charged|without charge|didn't cost|cost nothing/i;

/** A Response-like for the jobs client tests. */
const res = (status, obj) => ({ ok: status >= 200 && status < 300, status, text: async () => (obj === undefined ? "" : typeof obj === "string" ? obj : JSON.stringify(obj)) });

describe("thin creative-jobs client (src/lib/projects; not a fork of AG's DesignsApiClient)", () => {
  it("one GET per call with AG's bearer convention, existing endpoints only, never /api/designs", async () => {
    const seen = [];
    const fetchImpl = async (url, init) => (seen.push({ url, init }), res(200, { ok: true, jobs: [] }));
    const c = createCreativeJobsClient({ fetchImpl });
    await c.listJobs({ accessToken: " tok " });
    await c.getJob({ jobId: "a/b", accessToken: "tok" }).catch(() => {});
    await c.getConfig({ accessToken: "tok" });
    expect(seen.map((s) => s.url)).toEqual(["/api/creative?resource=jobs", "/api/creative?resource=jobs&jobId=a%2Fb", "/api/creative?resource=config"]);
    for (const s of seen) {
      expect(s.init).toMatchObject({ method: "GET", cache: "no-store", headers: { Authorization: "Bearer tok", Accept: "application/json" } });
      expect(s.url).not.toMatch(/\/api\/designs/);
    }
  });

  it.each([
    [401, { ok: false, code: "MISSING_AUTH", error: "x" }, { status: 401, code: "MISSING_AUTH" }],
    [403, { ok: false, code: "UNAUTHORIZED", error: "x" }, { status: 403, code: "UNAUTHORIZED" }],
    [429, { ok: false, code: "PROVIDER_RATE_LIMITED", error: "x", details: { billingOutcome: "unconfirmed" } }, { status: 429, code: "PROVIDER_RATE_LIMITED", details: { billingOutcome: "unconfirmed" } }],
    [503, { ok: false, code: "CREATIVE_NOT_CONFIGURED", error: "x" }, { status: 503, code: "CREATIVE_NOT_CONFIGURED" }],
    [502, "<html>bad gateway</html>", { status: 502, code: null }],
    [200, { ok: true }, { status: 200, code: "INVALID_RESPONSE" }],
    [200, "not json", { status: 200, code: "INVALID_RESPONSE" }],
  ])("HTTP %i -> rejects once with the classifiable shape, no second fetch", async (status, payload, expected) => {
    let n = 0;
    const c = createCreativeJobsClient({ fetchImpl: async () => (n++, res(status, payload)) });
    await expect(c.listJobs({ accessToken: "t" })).rejects.toMatchObject(expected);
    expect(n).toBe(1);
  });

  it("network failure -> { status:null, code:NETWORK }; abort passes through; no token -> 401 without a fetch", async () => {
    let n = 0;
    const down = createCreativeJobsClient({ fetchImpl: async () => (n++, Promise.reject(new TypeError("Failed to fetch"))) });
    await expect(down.listJobs({ accessToken: "t" })).rejects.toEqual({ status: null, code: "NETWORK", message: "Could not reach FurniAI." });
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    const aborted = createCreativeJobsClient({ fetchImpl: async () => Promise.reject(abort) });
    await expect(aborted.listJobs({ accessToken: "t" })).rejects.toBe(abort);
    await expect(down.listJobs({ accessToken: "" })).rejects.toMatchObject({ status: 401, code: "MISSING_AUTH" });
    expect(n).toBe(1);
  });

  it("studioAccessToken() reuses AG's page helper getStudioAccessToken (asked every call), null without it", async () => {
    let calls = 0;
    const page = { getStudioAccessToken: async () => (calls++, "ag-token") };
    expect(await studioAccessToken(page)).toBe("ag-token");
    expect(await studioAccessToken(page)).toBe("ag-token");
    expect(calls).toBe(2);
    expect(await studioAccessToken({})).toBeNull();
    expect(await studioAccessToken({ getStudioAccessToken: () => "  " })).toBeNull();
  });
});

describe("reload: the server's job list restores state; browser storage is never used", () => {
  let touched;
  beforeEach(() => {
    touched = [];
    function spyStore(name) {
      const handler = {
        get(_target, key) {
          touched.push(`${name}.${String(key)}`);
          return () => null;
        },
      };
      return new Proxy({}, handler);
    }
    vi.stubGlobal("localStorage", spyStore("localStorage"));
    vi.stubGlobal("sessionStorage", spyStore("sessionStorage"));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("a remount (page reload) rebuilds every card from GET ?resource=jobs and resumes polling the unfinished job", async () => {
    // The "server": one record that outlives the page.
    const server = { job: jobView({ jobId: "job-reload", status: "processing" }), getJobCalls: 0, listCalls: 0 };
    const done = succeededJob({ jobId: "job-done" });
    const handlers = {
      listJobs: () => (server.listCalls++, { ok: true, jobs: [server.job, done] }),
      getJob: () => (server.getJobCalls++, { ok: true, job: server.job, refresh: { ok: true } }),
    };
    const first = setup(handlers, { pollIntervalMs: 3000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(first.gallery.getState().jobs.map((j) => [j.jobId, j.status])).toEqual([["job-reload", "processing"], ["job-done", "succeeded"]]);
    first.gallery.destroy(); // the page goes away mid-generation

    // Server progresses while no page is open.
    server.job = { ...server.job, updatedAt: "2026-10-04T08:00:00.000Z" };
    const second = setup(handlers, { pollIntervalMs: 3000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(server.listCalls).toBe(2);
    expect(second.gallery.getState().jobs.map((j) => [j.jobId, j.status])).toEqual([["job-reload", "processing"], ["job-done", "succeeded"]]);
    expect(second.gallery.getState().polling).toBe(true); // unfinished job resumes polling
    const before = server.getJobCalls;
    server.job = succeededJob({ jobId: "job-reload", updatedAt: "2026-10-04T09:00:00.000Z" });
    await vi.advanceTimersByTimeAsync(3000);
    expect(server.getJobCalls).toBe(before + 1);
    expect(byClass(card(second.root, "job-reload"), "fcg-badge-text")[0].textContent).toBe("Ready");
    expect(second.gallery.getState().polling).toBe(false); // terminal: stops
    await vi.advanceTimersByTimeAsync(60000);
    expect(server.getJobCalls).toBe(before + 1);
    expect(touched).toEqual([]); // no localStorage / sessionStorage read or write
    second.gallery.destroy();
  });

  it("destroy() stops polling for good", async () => {
    const p = jobView();
    let n = 0;
    const { gallery } = setup({ listJobs: () => ({ ok: true, jobs: [p] }), getJob: () => (n++, { ok: true, job: p }) });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(4000);
    expect(n).toBe(1);
    gallery.destroy();
    await vi.advanceTimersByTimeAsync(60000);
    expect(n).toBe(1);
  });
});

describe("error vs empty: a failed request never looks like an empty gallery", () => {
  it("empty: neutral dashed panel, no alert role, no Try again, says the server has none", async () => {
    const { root } = setup({ listJobs: () => ({ ok: true, jobs: [] }) });
    await flush();
    const p = panel(root);
    expect(p.getAttribute("data-panel")).toBe("empty");
    expect(p.getAttribute("role")).toBeNull();
    expect(p.textContent).toMatch(/^No 3D concepts yet\. The server has none for this account/);
    expect(byAttr(p, "data-not-empty")).toHaveLength(0);
    expect(button(root, "retry")).toBeNull();
  });

  it.each([
    ["network", () => networkError(), ERROR_KIND.NETWORK, true],
    ["5xx", () => errorFor("INTERNAL"), ERROR_KIND.SERVER, true],
    ["429", () => fixtureError("error.provider-rate-limited.429.json"), ERROR_KIND.RATE_LIMITED, true],
    ["502 provider unavailable", () => fixtureError("error.provider-unavailable.submission-unknown.502.json"), ERROR_KIND.PROVIDER_UNAVAILABLE, true],
    ["malformed", () => null, ERROR_KIND.MALFORMED, false],
  ])("%s: alert panel that says 'this doesn't mean you have none'; Try again only where it can help (QE PJ-1)", async (_, err, kind, retry) => {
    const { root } = setup({ listJobs: () => { const e = err(); if (e === null) return { ok: true }; throw e; } });
    await flush();
    const p = panel(root);
    expect(p.getAttribute("data-panel")).toBe(kind);
    expect(p.getAttribute("role")).toBe("alert");
    expect(byAttr(p, "data-not-empty")[0].textContent).toBe("Your concepts couldn't be loaded. This doesn't mean you have none.");
    expect(byClass(p, "fcg-panel-text")[0].textContent).toBe(LIST_MESSAGES[kind]);
    expect(p.textContent).not.toMatch(/No 3D concepts yet/);
    if (retry) expect(button(root, "retry")).not.toBeNull();
    else expect(button(root, "retry")).toBeNull();
  });

  it("401 and page-wide 403: own panels, no 'Try again', no cards, not the empty text", async () => {
    for (const [e, kind] of [[fixtureError("error.missing-auth.401.json"), "signed_out"], [{ status: 403, code: "UNAUTHORIZED" }, "forbidden"]]) {
      const { root } = setup({ listJobs: () => Promise.reject(e) });
      await flush();
      expect(panel(root).getAttribute("data-panel")).toBe(kind);
      expect(button(root, "retry")).toBeNull();
      expect(cards(root)).toHaveLength(0);
      expect(root.textContent).not.toMatch(/No 3D concepts yet/);
    }
  });

  it("unavailable deployment (503 not configured / generation disabled): own wording", async () => {
    for (const f of ["error.not-configured.503.json", "error.generation-disabled.503.json"]) {
      const { root } = setup({ listJobs: () => Promise.reject(fixtureError(f)) });
      await flush();
      expect(panel(root).getAttribute("data-panel")).toBe("not_configured");
      expect(panel(root).textContent).toMatch(/aren't available on this deployment/);
    }
  });
});

describe("no automatic retries: request counts", () => {
  afterEach(() => vi.useRealTimers());

  it.each([
    ["network", () => networkError()],
    ["5xx", () => errorFor("INTERNAL")],
    ["429", () => fixtureError("error.provider-rate-limited.429.json")],
    ["502 provider unavailable", () => fixtureError("error.provider-unavailable.submission-unknown.502.json")],
  ])("list %s: exactly 1 GET for 10 minutes; each 'Try again' click adds exactly 1", async (_, err) => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const { root, client } = setup({ listJobs: () => Promise.reject(err()) });
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(client.count("listJobs")).toBe(1);
    button(root, "retry").click();
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(client.count("listJobs")).toBe(2);
  });

  it("Open and Download: one resolve per click, never a second by themselves", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const job = succeededJob();
    const { root, client } = setup(
      { listJobs: () => ({ ok: true, jobs: [job] }), getJob: () => new Promise(() => {}), getAssetUrl: () => { throw errorFor("INTERNAL"); } },
      { onOpenConcept: (req) => req.resolveUrl().catch(() => {}), startDownload: () => {} },
    );
    await vi.advanceTimersByTimeAsync(0);
    button(root, "download").click();
    await vi.advanceTimersByTimeAsync(60000);
    expect(client.count("getAssetUrl")).toBe(1);
    button(root, "open").click();
    await vi.advanceTimersByTimeAsync(60000);
    expect(client.count("getAssetUrl")).toBe(2);
    expect(byAttr(root, "data-action", "retry-asset")).toHaveLength(1);
  });
});

describe("budget, 429, provider unavailable: truthful wording", () => {
  it("config not ready (no budget cap, switched off, not set up): 'unavailable' note; the list still shows", async () => {
    const { root } = setup({ listJobs: () => ({ ok: true, jobs: [succeededJob()] }) });
    await flush();
    // the default fake client has no getConfig: no availability line at all (nothing is guessed)
    expect(byAttr(root, "data-availability")).toHaveLength(0);

    const withConfig = (cfg) => {
      const doc = createFakeDocument();
      const r = doc.createElement("div");
      doc.body.appendChild(r);
      const client = { listJobs: async () => ({ ok: true, jobs: [succeededJob()] }), getConfig: cfg, getJob: () => new Promise(() => {}) };
      mountConceptGallery(r, { client, getAccessToken: () => "t" });
      return r;
    };
    const off = withConfig(async () => body("config.not-ready.200.json"));
    await flush();
    const n = byAttr(off, "data-availability", "off")[0];
    expect(n.textContent).toBe("Generating new concepts is unavailable: it isn't set up on this deployment; it's switched off; no per-concept budget is set. Your existing concepts are still listed.");
    expect(cards(off)).toHaveLength(1);

    const ready = withConfig(async () => body("config.ready.200.json"));
    await flush();
    expect(byAttr(ready, "data-availability", "ready")[0].textContent).toBe("Generating new concepts is available. Budget limit per concept: 20 provider units (unit unverified).");

    let cfgCalls = 0;
    const failing = withConfig(async () => (cfgCalls++, Promise.reject({ status: 503, code: "CREATIVE_NOT_CONFIGURED" })));
    await flush();
    expect(byAttr(failing, "data-availability", "unknown")).toHaveLength(1);
    await new Promise((r) => setTimeout(r, 30));
    expect(cfgCalls).toBe(1); // not retried
  });

  it("POST 402 COST_CAP_EXCEEDED (budget): its own sentence with the numbers; 'No paid request was sent'", () => {
    const d = describeSubmitResponse(402, body("error.cost-cap-exceeded.402.json"));
    expect(d).toMatchObject({ outcome: "budget", code: "COST_CAP_EXCEEDED", billingOutcome: "not_submitted", retry: "none", needsAcknowledgement: false });
    expect(d.message).toBe("This concept would cost more than the per-concept budget set for FurniAI (estimate 21, limit 20, both in provider units, unit unverified), so it wasn't generated.");
    expect(d.billingText).toBe(SUBMIT_BILLING_TEXT.not_submitted);
  });

  it("POST 429 PROVIDER_RATE_LIMITED: sent and refused, billing unconfirmed, a user retry only", () => {
    const d = describeSubmitResponse(429, body("error.provider-rate-limited.429.json"));
    expect(d).toMatchObject({ outcome: "rate_limited", billingOutcome: "unconfirmed", retry: "user", jobId: "00000000-0000-4000-8000-000000000007" });
    expect(d.billingText).toMatch(/isn't confirmed/);
    expect(d.message).toMatch(/another attempt is a new paid request/);
  });

  it("POST 502 PROVIDER_UNAVAILABLE: 'may have been charged', not retried", () => {
    const d = describeSubmitResponse(502, body("error.provider-unavailable.submission-unknown.502.json"));
    expect(d).toMatchObject({ outcome: "provider_unavailable", billingOutcome: "unconfirmed", retry: "none" });
    expect(d.billingText).toBe("The paid request was sent and no answer came back. It may have been charged.");
  });

  it.each([
    ["error.cost-unverified.502.json", "refused_not_sent", "user"],
    ["error.generation-disabled.503.json", "unavailable", "none"],
    ["error.not-configured.503.json", "unavailable", "none"],
    ["error.duplicate-active-job.409.json", "refused_not_sent", "none"],
    ["error.idempotency-key-reused.409.json", "refused_not_sent", "none"],
    ["error.missing-reference.404.json", "refused_not_sent", "none"],
    ["error.provider-insufficient-credits.402.json", "provider_refused", "none"],
    ["error.provider-auth-rejected.502.json", "provider_refused", "none"],
    ["error.provider-rejected-request.502.json", "provider_refused", "none"],
    ["error.missing-auth.401.json", "signed_out", "none"],
  ])("POST %s -> %s (retry: %s), never a free claim", (file, outcome, retry) => {
    const d = describeSubmitResponse(fx(file)._fixture.httpStatus, body(file));
    expect(d).toMatchObject({ outcome, retry });
    expect(`${d.message} ${d.billingText}`).not.toMatch(FREE_CLAIM);
  });

  it("POST network failure / unknown 5xx: billing unknown, resend with the SAME idempotency key only, on request", () => {
    for (const d of [describeSubmitResponse(null, null), describeSubmitResponse(500, { ok: false, code: "INTERNAL", error: "x" })]) {
      expect(d).toMatchObject({ billingOutcome: "unknown", retry: "user", resendSameKeyOnly: true });
      expect(d.billingText).toBe("It isn't known whether the paid request was sent. It may have been charged.");
    }
  });

  it("POST 202 / 200 replayed: billing from the job view", () => {
    expect(describeSubmitResponse(202, body("job.submitted.202.json"))).toMatchObject({ outcome: "submitted", billingOutcome: "unconfirmed", billingText: BILLING_TEXT.unconfirmedPending });
    expect(describeSubmitResponse(200, body("job.replayed.200.json")).outcome).toBe("replayed");
  });
});

describe("billingOutcome and PRIOR_SUBMISSION_UNKNOWN wording", () => {
  const usage = (billingOutcome, reportedCost = null) => ({ estimatedCost: 12, reportedCost, unit: "provider_cost_units", ...(billingOutcome ? { billingOutcome } : {}) });
  it.each([
    ["not_submitted", jobView({ jobId: "b1", status: "submitting", usage: usage("not_submitted") }), BILLING_TEXT.not_submitted],
    ["unconfirmed (running)", jobView({ jobId: "b2", usage: usage("unconfirmed") }), BILLING_TEXT.unconfirmedPending],
    ["unconfirmed (failed)", failedJob({ jobId: "b3", usage: usage("unconfirmed") }), BILLING_TEXT.unconfirmed],
    ["unconfirmed (submission_unknown)", unknownJob({ jobId: "b4", usage: usage("unconfirmed") }), BILLING_TEXT.unconfirmed],
    ["reported with cost", succeededJob({ jobId: "b5", usage: usage("reported", 12) }), "Cost reported by the generation service: 12 provider units (unit unverified)."],
    ["reported, no amount", succeededJob({ jobId: "b6", usage: usage("reported", null) }), BILLING_TEXT.reportedNoCost],
    ["missing (rev 1 server)", { ...succeededJob({ jobId: "b7" }), usage: usage(null, 12) }, BILLING_TEXT.missing],
    ["unknown value", { ...succeededJob({ jobId: "b8" }), usage: usage("free") }, BILLING_TEXT.missing],
  ])("%s -> its own line; never 'no charge'", async (_, job, text) => {
    const { root } = setup({ listJobs: () => ({ ok: true, jobs: [job] }), getJob: () => new Promise(() => {}) });
    await flush();
    const line = byAttr(card(root, job.jobId), "data-billing")[0];
    expect(line.textContent).toBe(text);
    expect(root.textContent).not.toMatch(FREE_CLAIM);
  });

  it("unconfirmed is never rendered as free, even when the old text would have said 'Charged? no'", () => {
    for (const t of [BILLING_TEXT.unconfirmed, BILLING_TEXT.unconfirmedPending]) expect(t).toMatch(/charged|reported/i);
    expect(BILLING_TEXT.unconfirmed).toMatch(/may have been charged/);
  });

  it("PRIOR_SUBMISSION_UNKNOWN (409): asks for a deliberate acknowledgement via acknowledgeUnknownCharge, says it may have been charged", () => {
    const d = describeSubmitResponse(409, body("error.prior-submission-unknown.409.json"));
    expect(d).toMatchObject({ outcome: "needs_acknowledgement", needsAcknowledgement: true, acknowledgeField: "acknowledgeUnknownCharge", billingOutcome: "not_submitted", jobId: "00000000-0000-4000-8000-000000000011" });
    expect(d.message).toBe(PRIOR_SUBMISSION_UNKNOWN_MESSAGE);
    expect(d.message).toMatch(/may have been charged/);
    expect(d.message).toMatch(/charged a second time/);
    expect(d.message).not.toMatch(FREE_CLAIM);
  });

  it("a submission_unknown card says generating again from that reference needs confirmation", async () => {
    const u = unknownJob();
    const { root } = setup({ listJobs: () => ({ ok: true, jobs: [u] }) });
    await flush();
    const c = card(root, u.jobId);
    expect(byAttr(c, "data-submission-unknown")[0].textContent).toMatch(/^May have been charged\./);
    expect(byAttr(c, "data-prior-submission-unknown")[0].textContent).toBe(PRIOR_SUBMISSION_UNKNOWN_CARD_NOTE);
    expect(byTag(c, "button")).toHaveLength(0); // no retry / resubmit control at all
  });
});

describe("concepts stay distinct from AG's dimensioned designs", () => {
  it("every card: visible 'Concept' label, data-kind=concept, concept.notice, no dimensions, no designId, no Studio link", async () => {
    const jobs = LIST.map((j) => ({ ...j, designId: "design-xyz", dimensions: { widthMm: 2400 } }));
    const { root } = setup({ listJobs: () => ({ ok: true, jobs }), getJob: () => new Promise(() => {}) });
    await flush();
    expect(cards(root)).toHaveLength(7);
    for (const c of cards(root)) {
      expect(c.getAttribute("data-kind")).toBe("concept");
      expect(byAttr(c, "data-kind-label", "concept")[0].textContent).toBe("Concept");
      expect(byAttr(c, "data-concept-notice")[0].textContent.length).toBeGreaterThan(20);
      expect(c.textContent).not.toMatch(/\bmm\b|2400|width|height|depth|dimension/i);
    }
    expect(allAttributeValues(root).join(" ")).not.toMatch(/design-xyz|designId|#\/build/);
    expect(byTag(root, "a")).toHaveLength(0);
    expect(byAttr(root, "data-concept-intro")[0].textContent).toMatch(/not dimensioned designs/);
  });

  it("the gallery never touches AG's DesignsApiClient global or /api/designs", async () => {
    const trap = new Proxy({}, { get: () => { throw new Error("DesignsApiClient touched"); } });
    vi.stubGlobal("DesignsApiClient", trap);
    try {
      const urls = [];
      const client = createCreativeJobsClient({ fetchImpl: async (u) => (urls.push(u), res(200, { ok: true, jobs: [succeededJob()] })) });
      const doc = createFakeDocument();
      const r = doc.createElement("div");
      doc.body.appendChild(r);
      const g = mountConceptGallery(r, { client, getAccessToken: () => "t" });
      await flush();
      expect(g.getState().list).toBe("ready");
      expect(urls.every((u) => u.startsWith("/api/creative?"))).toBe(true);
      g.destroy();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("Open / Download only when a result is available", () => {
  it.each([
    ["submitting", jobView({ jobId: "s1", status: "submitting" }), 0, 0, "Not yet"],
    ["processing", jobView({ jobId: "s2" }), 0, 0, "Not yet"],
    ["failed", failedJob({ jobId: "s3" }), 0, 0, "None"],
    ["submission_unknown", unknownJob({ jobId: "s4" }), 0, 0, "None"],
    ["succeeded glb", succeededJob({ jobId: "s5" }), 1, 1, "Available (GLB)"],
    ["succeeded fbx (download only)", succeededJob({ jobId: "s6", outputs: [{ index: 0, format: "fbx", mimeType: null }] }), 0, 1, "Available (FBX)"],
    ["succeeded, no outputs", succeededJob({ jobId: "s7", outputs: [] }), 0, 0, "Not available"],
    ["succeeded, two files", succeededJob({ jobId: "s8", outputs: [glbOutput(0), glbOutput(1)] }), 2, 2, "Available (2 files: GLB, GLB)"],
  ])("%s: %i Open, %i Download, Result '%s'", async (_, job, opens, downloads, result) => {
    const { root } = setup({ listJobs: () => ({ ok: true, jobs: [job] }), getJob: () => new Promise(() => {}) }, { onOpenConcept: () => {}, startDownload: () => {} });
    await flush();
    const c = card(root, job.jobId);
    expect(byAttr(c, "data-action", "open")).toHaveLength(opens);
    expect(byAttr(c, "data-action", "download")).toHaveLength(downloads);
    expect(byAttr(c, "data-result")[0].textContent).toBe(result);
  });

  it("a job-level failure (integrity) removes Open/Download and says 'Not available'", async () => {
    const job = succeededJob({ jobId: "s9" });
    const { root } = setup(
      { listJobs: () => ({ ok: true, jobs: [job] }), getJob: () => new Promise(() => {}), getAssetUrl: () => { throw errorFor("RECORD_INTEGRITY_FAILED"); } },
      { startDownload: () => {} },
    );
    await flush();
    button(root, "download").click();
    await flush();
    const c = card(root, job.jobId);
    expect(byAttr(c, "data-action", "download")).toHaveLength(0);
    expect(byAttr(c, "data-result")[0].textContent).toBe("Not available");
  });
});

describe("reference thumbnail (host-injected; the contract has no field)", () => {
  it("shows the reference image when the resolver gives one, labelled as the reference; URL never in state", async () => {
    const job = succeededJob({ sourceReferenceId: "ref-1" });
    const asked = [];
    const { root, gallery } = setup(
      { listJobs: () => ({ ok: true, jobs: [job] }), getJob: () => new Promise(() => {}) },
      { resolveReferenceThumbnail: async ({ referenceId, jobId }) => (asked.push([referenceId, jobId]), "https://thumbs.fixture.invalid/ref-1.png") },
    );
    await flush();
    expect(asked).toEqual([["ref-1", job.jobId]]);
    const img = byTag(card(root, job.jobId), "img")[0];
    expect(img.getAttribute("src")).toBe("https://thumbs.fixture.invalid/ref-1.png");
    expect(img.getAttribute("alt")).toBe("Reference image this concept was made from");
    expect(JSON.stringify(gallery.getState())).not.toMatch(/thumbs\.fixture/);
    // a broken image falls back to the placeholder; nothing is asked again
    for (const fn of img.listeners.get("error")) fn({ type: "error" });
    await flush();
    expect(byTag(card(root, job.jobId), "img")).toHaveLength(0);
    expect(byAttr(card(root, job.jobId), "data-thumbnail", "none")).toHaveLength(1);
    expect(asked).toHaveLength(1);
  });

  it("no resolver, null, a rejection or a non-image address: the neutral placeholder, asked once", async () => {
    for (const resolver of [undefined, async () => null, async () => Promise.reject(new Error("x")), async () => "javascript:alert(1)"]) {
      let n = 0;
      const job = succeededJob({ sourceReferenceId: "ref-2" });
      const { root } = setup(
        { listJobs: () => ({ ok: true, jobs: [job] }), getJob: () => new Promise(() => {}) },
        resolver ? { resolveReferenceThumbnail: (a) => (n++, resolver(a)) } : {},
      );
      await flush();
      expect(byTag(root, "img")).toHaveLength(0);
      expect(byAttr(root, "data-thumbnail", "none")).toHaveLength(1);
      expect(n).toBe(resolver ? 1 : 0);
    }
  });
});

describe("list cap", () => {
  it("50 jobs (the server's maximum): says older ones aren't listed (no pagination in the contract)", async () => {
    const jobs = Array.from({ length: 50 }, (_, i) => failedJob({ jobId: `cap-${i}` }));
    const { root, gallery } = setup({ listJobs: () => ({ ok: true, jobs }) });
    await flush();
    expect(gallery.getState().truncated).toBe(true);
    expect(byAttr(root, "data-truncated")[0].textContent).toBe("Showing your newest 50 concepts. Older ones aren't listed here yet.");
  });
});
