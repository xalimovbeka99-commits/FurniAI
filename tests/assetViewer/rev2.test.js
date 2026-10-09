/**
 * Claude rev 2 (/api/creative) facts as they reach the viewer. Everything here
 * is SIMULATED: the rev 2 fixture pack in docs/creative/fixtures (read-only,
 * generatedByScenario:false) drives a real viewer core. Nothing is Scenario output.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  BILLING_OUTCOMES,
  createCreativeAssetSource,
  DEMO_ASSET_LABEL,
  describeBillingOutcome,
  ERROR_CODE,
  ERROR_MESSAGE,
  isRetryableResolveError,
  mapCreativeError,
  normalizeBilling,
  normalizeConcept,
  RATE_LIMIT_RETRY_DELAY_MS,
  retryDelayForResolveError,
} from "../../src/lib/assetViewer/index.js";
import { createInstantTimers } from "./helpers/creativeHarness.js";
import { createFakeFetch } from "./helpers/fixtures.js";
import { mountForTest } from "./helpers/mountHarness.js";

const REV2 = join(process.cwd(), "docs", "creative", "fixtures");
const GLB_NAME = "SYNTHETIC-box-not-scenario-generated.glb";
const GLB_SHA256 = "e2bec10b7995124700de3c8d73b9219671f6e9ebd90c124aa18f482636403b71";
const fixture = (name) => JSON.parse(readFileSync(join(REV2, name), "utf8"));
const glbBytes = () => {
  const b = readFileSync(join(REV2, GLB_NAME)); // read-only; never copied or rewritten
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
const glbMtime = statSync(join(REV2, GLB_NAME)).mtimeMs;

afterEach(() => {
  expect(statSync(join(REV2, GLB_NAME)).mtimeMs).toBe(glbMtime);
});

/** /api/creative backed by the rev 2 fixture pack, plus a CDN serving the synthetic GLB. */
function fixtureBackend(jobFixture = "job.succeeded.200.json") {
  const calls = [];
  const apiFetch = async (url) => {
    calls.push(String(url));
    const u = new URL(String(url), "https://app.test");
    const name = u.searchParams.get("resource") === "asset" ? "asset.200.json" : jobFixture;
    const f = fixture(name);
    return { ok: f._fixture.httpStatus < 400, status: f._fixture.httpStatus, json: async () => f.response };
  };
  const source = createCreativeAssetSource({ fetchImpl: apiFetch, getAuthToken: () => "sim-token" });
  const cdn = createFakeFetch({ [`https://fixtures.invalid/${GLB_NAME}`]: { bytes: glbBytes() } });
  return { calls, source, cdn };
}

describe("rev 2 synthetic fixture, loaded from docs/creative/fixtures", () => {
  it("is the expected file (sha256) and labels itself synthetic", () => {
    const bytes = readFileSync(join(REV2, GLB_NAME));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(GLB_SHA256);
    const jsonLen = bytes.readUInt32LE(12);
    const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLen).toString("utf8"));
    expect(gltf.extras).toMatchObject({ synthetic: true, generatedByScenario: false });
  });

  it("loads, shows the demonstration label (from the file itself) and relative proportions 0.50 : 1.00 : 0.30", async () => {
    const t = mountForTest();
    const r = await t.viewer.load({ arrayBuffer: glbBytes(), filename: GLB_NAME });
    expect(r.ok).toBe(true);
    const s = t.viewer.getState();
    expect(s.status).toBe("ready");
    expect(s.demo).toEqual({ label: DEMO_ASSET_LABEL, source: "file" });
    expect(s.model.proportions.ratioLabel).toBe("W:H:D 0.50 : 1.00 : 0.30");
    expect(s.model.meshCount).toBe(1);
    const demo = t.container.find("data-av-demo");
    expect(demo.textContent).toBe(DEMO_ASSET_LABEL);
    expect(demo.style.display).toBe("");
    expect(demo.getAttribute("role")).toBe("note");
    expect(t.container.find("data-av-scale").textContent).toMatch(/^Relative scale, not measured · W:H:D 0\.50 : 1\.00 : 0\.30$/);
    // clear() drops the label with the asset
    t.viewer.clear();
    expect(t.viewer.getState().demo).toBeNull();
    expect(demo.style.display).toBe("none");
    t.viewer.dispose();
  });

  it("a host flag labels any asset as a demonstration (custom text allowed)", async () => {
    const t = mountForTest();
    await t.viewer.load({ arrayBuffer: glbBytes(), demonstration: "SIMULATED fixture" });
    expect(t.viewer.getState().demo).toEqual({ label: "SIMULATED fixture", source: "host" });
    t.viewer.dispose();
  });

  it("the rev 2 fixture pack drives showJob end to end: asset.200 -> fixtures.invalid GLB -> ready, billing from the server", async () => {
    const b = fixtureBackend();
    const t = mountForTest({ options: { creativeSource: b.source, fetch: b.cdn } });
    const job = fixture("job.succeeded.200.json").response.job;
    const r = await t.viewer.showJob(job);
    expect(r.ok).toBe(true);
    const s = t.viewer.getState();
    expect(s).toMatchObject({
      status: "ready",
      source: "creative",
      job: { jobId: job.jobId, index: 0, status: "succeeded", referenceId: job.sourceReferenceId, billing: { outcome: "reported", source: "server" } },
      demo: { label: DEMO_ASSET_LABEL, source: "file" },
      attempts: { resolve: 1, display: 1 },
    });
    expect(b.calls).toHaveLength(1);
    expect(b.cdn.calls.map((c) => c.url)).toEqual([`https://fixtures.invalid/${GLB_NAME}`]);
    expect(JSON.stringify(s)).not.toContain("fixtures.invalid");
    t.viewer.dispose();
  });

  it("job.submission-unknown: honest SUBMISSION_UNKNOWN, charge 'unconfirmed', no resolve, no fetch, no retry offered", async () => {
    const b = fixtureBackend("job.submission-unknown.200.json");
    const t = mountForTest({ options: { creativeSource: b.source, fetch: b.cdn } });
    const job = fixture("job.submission-unknown.200.json").response.job;
    const r = await t.viewer.showJob(job);
    expect(r.ok).toBe(false);
    const s = t.viewer.getState();
    expect(s.error).toMatchObject({ code: "SUBMISSION_UNKNOWN", chargeMayHaveOccurred: true, autoRetry: false, billingOutcome: "unconfirmed", serverCode: "PROVIDER_UNAVAILABLE" });
    expect(s.job.billing).toEqual({ outcome: "unconfirmed", source: "server" });
    expect(s.canRetry).toBe(false);
    expect(t.container.find("data-av-retry").style.display).toBe("none");
    expect(t.container.find("data-av-status").textContent).toBe(ERROR_MESSAGE.SUBMISSION_UNKNOWN);
    expect(b.calls).toEqual([]);
    expect(b.cdn.calls).toEqual([]);
    expect(await t.viewer.retry()).toMatchObject({ ok: false, retried: false }); // no retry offered: a no-op, nothing is sent
    expect(b.calls).toEqual([]);
    t.viewer.dispose();
  });
});

describe("billingOutcome", () => {
  it("server value wins; anything unknown is 'unconfirmed' (never free)", () => {
    for (const o of BILLING_OUTCOMES) expect(normalizeBilling({ usage: { billingOutcome: o } })).toEqual({ outcome: o, source: "server" });
    expect(normalizeBilling({ usage: { billingOutcome: "free" } })).toEqual({ outcome: "unconfirmed", source: "server" });
  });

  it("rev 1 records (no billingOutcome) are derived conservatively", () => {
    expect(normalizeBilling({ status: "succeeded", usage: { reportedCost: 0 } })).toEqual({ outcome: "reported", source: "derived" });
    expect(normalizeBilling({ status: "submitting", usage: { reportedCost: null } })).toEqual({ outcome: "not_submitted", source: "derived" });
    expect(normalizeBilling({ status: "failed", usage: {} })).toEqual({ outcome: "unconfirmed", source: "derived" });
    expect(normalizeBilling(null)).toEqual({ outcome: "unconfirmed", source: "derived" });
  });

  it("the 'unconfirmed' wording says it is not free; unknown values read as unconfirmed", () => {
    expect(describeBillingOutcome("unconfirmed")).toMatch(/does not mean it was free/);
    expect(describeBillingOutcome("whatever")).toBe(describeBillingOutcome("unconfirmed"));
  });

  it("every job fixture in the pack carries a server billingOutcome the viewer understands", () => {
    const jobs = readdirSync(REV2).filter((f) => /^job\..*\.json$/.test(f));
    expect(jobs.length).toBeGreaterThan(3);
    for (const f of jobs) {
      const j = fixture(f).response.job;
      if (!j) continue;
      expect(normalizeBilling(j).source, f).toBe("server");
    }
  });
});

describe("rev 2 error codes", () => {
  const map = (name) => {
    const f = fixture(name);
    return mapCreativeError(f._fixture.httpStatus, f.response);
  };

  it("409 PRIOR_SUBMISSION_UNKNOWN: names the earlier job, needs acknowledgement, never auto-retried", () => {
    const e = map("error.prior-submission-unknown.409.json");
    expect(e).toMatchObject({ code: "PRIOR_SUBMISSION_UNKNOWN", status: 409, relatedJobId: "00000000-0000-4000-8000-000000000011", chargeMayHaveOccurred: true, autoRetry: false, requiresAcknowledgement: true });
    expect(isRetryableResolveError(e)).toBe(false);
    expect(e.message).toBe(ERROR_MESSAGE.PRIOR_SUBMISSION_UNKNOWN);
  });

  it("409 DUPLICATE_ACTIVE_JOB: names the active job, not retryable", () => {
    const e = map("error.duplicate-active-job.409.json");
    expect(e).toMatchObject({ code: "DUPLICATE_ACTIVE_JOB", relatedJobId: "00000000-0000-4000-8000-000000000003" });
    expect(isRetryableResolveError(e)).toBe(false);
  });

  it("429 PROVIDER_RATE_LIMITED keeps billingOutcome + jobId; a retry waits RATE_LIMIT_RETRY_DELAY_MS", () => {
    const e = map("error.provider-rate-limited.429.json");
    expect(e).toMatchObject({ code: "PROVIDER_UNAVAILABLE", status: 429, billingOutcome: "unconfirmed", relatedJobId: "00000000-0000-4000-8000-000000000007" });
    expect(RATE_LIMIT_RETRY_DELAY_MS).toBe(1000);
    expect(retryDelayForResolveError(e)).toBe(1000);
    expect(retryDelayForResolveError(e, 0)).toBe(0);
    expect(retryDelayForResolveError({ status: 503 })).toBe(0);
  });

  it("every error fixture maps to a known viewer code whose message is the viewer's own (no server text, no URL)", () => {
    const files = readdirSync(REV2).filter((f) => f.startsWith("error."));
    expect(files.length).toBeGreaterThan(15);
    for (const f of files) {
      const e = map(f);
      expect(Object.keys(ERROR_CODE), f).toContain(e.code);
      expect(e.message, f).toBe(ERROR_MESSAGE[e.code]);
      expect(JSON.stringify(e), f).not.toMatch(/https?:\/\//);
    }
  });

  it("the source exposes isRetryable / retryDelayMs for hosts that retry themselves", () => {
    const { source } = fixtureBackend();
    const e = map("error.provider-rate-limited.429.json");
    expect(source.isRetryable).toBe(isRetryableResolveError);
    expect(source.retryDelayMs(e)).toBe(1000);
  });
});

// autoRetry:true (opt-in) behaviour; with the default nothing is retried (autoRetry.test.js).
describe("429 on resolve: one retry after the pause (injected timers), autoRetry:true", () => {
  const resolved = (jobId) => ({ jobId, index: 0, url: "https://cdn.test/box.glb", format: "glb", mimeType: null, filename: "x.glb", concept: normalizeConcept(null) });
  function flakySource(status, code = "RATE_LIMITED") {
    let n = 0;
    return {
      get calls() {
        return n;
      },
      async resolve(jobId) {
        n += 1;
        if (n === 1) throw mapCreativeError(status, { ok: false, code });
        return resolved(jobId);
      },
    };
  }

  it("load(): 429 -> waits 1000 ms -> fresh resolve -> ready", async () => {
    const timers = createInstantTimers();
    const src = flakySource(429);
    const t = mountForTest({ options: { autoRetry: true, creativeSource: src, fetch: createFakeFetch({ "https://cdn.test/box.glb": { bytes: glbBytes() } }), setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout } });
    const r = await t.viewer.load({ jobId: "job-429", index: 0, format: "glb" });
    expect(r.ok).toBe(true);
    expect(src.calls).toBe(2);
    expect(timers.delays).toEqual([1000]);
    t.viewer.dispose();
  });

  it("load(): 503 retries at once; rateLimitRetryDelayMs:0 disables the pause", async () => {
    for (const [status, opts] of [[503, {}], [429, { rateLimitRetryDelayMs: 0 }]]) {
      const timers = createInstantTimers();
      const src = flakySource(status);
      const t = mountForTest({ options: { autoRetry: true, creativeSource: src, fetch: createFakeFetch({ "https://cdn.test/box.glb": { bytes: glbBytes() } }), setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout, ...opts } });
      expect((await t.viewer.load({ jobId: "j", index: 0, format: "glb" })).ok).toBe(true);
      expect(timers.delays).toEqual([]);
      t.viewer.dispose();
    }
  });

  it("download({ jobId }): 429 -> waits 1000 ms -> one more resolve", async () => {
    const timers = createInstantTimers();
    const src = flakySource(429);
    const t = mountForTest({ options: { autoRetry: true, creativeSource: src, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout } });
    const r = await t.viewer.download({ jobId: "job-429", index: 0 });
    expect(r.ok).toBe(true);
    expect(r.attempts).toEqual({ resolve: 2 });
    expect(timers.delays).toEqual([1000]);
    t.viewer.dispose();
  });

  it("a never-retry code (PRIOR_SUBMISSION_UNKNOWN) is not retried and does not pause", async () => {
    const timers = createInstantTimers();
    const src = flakySource(409, "PRIOR_SUBMISSION_UNKNOWN");
    const t = mountForTest({ options: { autoRetry: true, creativeSource: src, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout } });
    const r = await t.viewer.load({ jobId: "j", index: 0, format: "glb" });
    expect(r.error.code).toBe("PRIOR_SUBMISSION_UNKNOWN");
    expect(src.calls).toBe(1);
    expect(timers.delays).toEqual([]);
    expect(t.viewer.getState().canRetry).toBe(false);
    t.viewer.dispose();
  });
});
