/**
 * Job objects from GET ?resource=jobs&jobId= (SIMULATED stand-in, fixtures
 * only, not Scenario): status handling, no percentages, submission_unknown,
 * polling cadence, never branching on providerStatus.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ERROR_MESSAGE } from "../../src/lib/assetViewer/index.js";
import { SIM_CONCEPT } from "./helpers/creativeStandIn.js";
import { createInstantTimers, mountCreative } from "./helpers/creativeHarness.js";
import { installImageBitmapShim } from "./helpers/fixtures.js";

let shim;
beforeAll(() => (shim = installImageBitmapShim()));
afterAll(() => shim.restore());

const baseJob = (over = {}) => ({
  jobId: "sim-glb-chair",
  status: "succeeded",
  provider: "simulated-stand-in",
  providerStatus: "sim-success",
  providerProgress: null,
  outputs: [{ index: 0, format: "glb", mimeType: "model/gltf-binary" }],
  error: null,
  concept: { ...SIM_CONCEPT },
  ...over,
});
const statusText = (t) => t.container.find("data-av-status").textContent;
const conceptText = (t) => t.container.find("data-av-concept").textContent;

describe("showJob / load({ job })", () => {
  it.each(["submitting", "processing"])("%s -> loading, no percentage even when providerProgress is a number", async (status) => {
    const t = mountCreative();
    const r = await t.viewer.showJob(baseJob({ jobId: "sim-processing", status, outputs: [], providerProgress: 0.37, providerStatus: "IN_PROGRESS 37%" }));
    expect(r).toMatchObject({ ok: false, pending: true, terminal: false });
    const s = t.viewer.getState();
    expect(s).toMatchObject({ status: "loading", phase: `job-${status}`, progress: null, job: { jobId: "sim-processing", status }, concept: { notice: SIM_CONCEPT.notice } });
    const text = statusText(t);
    expect(text).toBe(status === "submitting" ? "Sending your image to the 3D generation service…" : "Generating 3D concept… This can take a few minutes.");
    expect(text).not.toMatch(/%|37|0\.37/);
    expect(JSON.stringify(s)).not.toMatch(/0\.37|37%|IN_PROGRESS/);
    expect(conceptText(t)).toBe(SIM_CONCEPT.notice);
    expect(t.apiCalls).toHaveLength(0);
    t.viewer.dispose();
  });

  it("succeeded -> picks outputs[0] (or the requested index), resolves and shows it", async () => {
    const t = mountCreative();
    const r = await t.viewer.load({ job: baseJob() });
    expect(r.ok).toBe(true);
    expect(t.viewer.getState()).toMatchObject({ status: "ready", job: { jobId: "sim-glb-chair", index: 0, status: "succeeded", outputCount: 1 } });
    const two = baseJob({
      jobId: "sim-two-outputs",
      outputs: [
        { index: 0, format: "glb", mimeType: null },
        { index: 1, format: "glb", mimeType: null },
      ],
    });
    await t.viewer.showJob(two, { index: 1 });
    expect(t.viewer.getState()).toMatchObject({ status: "ready", job: { index: 1, outputCount: 2 }, model: { meshCount: 5 } });
    expect(t.apiCalls.at(-1).url).toContain("index=1");
    t.viewer.dispose();
  });

  it("succeeded with no outputs, or an absent index -> ASSET_NOT_READY (not viewable)", async () => {
    const t = mountCreative();
    await t.viewer.showJob(baseJob({ outputs: [] }));
    expect(t.viewer.getState().error.code).toBe("ASSET_NOT_READY");
    await t.viewer.showJob(baseJob(), { index: 3 });
    expect(t.viewer.getState().error.code).toBe("ASSET_NOT_READY");
    expect(t.apiCalls).toHaveLength(0);
    t.viewer.dispose();
  });

  it("succeeded fbx / null-format output -> download-only straight from the job (no resolve until download)", async () => {
    const t = mountCreative();
    await t.viewer.showJob(baseJob({ jobId: "sim-fbx", outputs: [{ index: 0, format: "fbx", mimeType: "application/octet-stream" }] }));
    expect(t.viewer.getState()).toMatchObject({ status: "download-only", asset: { format: "fbx" }, concept: { notice: SIM_CONCEPT.notice } });
    await t.viewer.showJob(baseJob({ jobId: "sim-null-format", outputs: [{ index: 0, format: null, mimeType: null }] }));
    expect(t.viewer.getState()).toMatchObject({ status: "download-only", asset: { format: null } });
    expect(t.apiCalls).toHaveLength(0);
    const d = await t.viewer.download();
    expect(d).toMatchObject({ ok: true, filename: "furniai-concept-sim-null-format-0.bin" });
    expect(t.apiCalls).toHaveLength(1);
    t.viewer.dispose();
  });

  it("failed -> GENERATION_FAILED showing job.error.message (sanitised), server code kept", async () => {
    const t = mountCreative();
    await t.viewer.showJob(baseJob({ jobId: "sim-failed", status: "failed", outputs: [], error: { code: "PROVIDER_GENERATION_FAILED", message: "The 3D generation\nservice reported a failure." } }));
    expect(t.viewer.getState().error).toMatchObject({ code: "GENERATION_FAILED", serverCode: "PROVIDER_GENERATION_FAILED", jobStatus: "failed", message: "The 3D generation service reported a failure." });
    expect(statusText(t)).toBe("The 3D generation service reported a failure.");
    await t.viewer.showJob(baseJob({ status: "failed", outputs: [], error: { code: "X", message: "see https://internal.example/trace" } }));
    expect(t.viewer.getState().error.message).toBe(ERROR_MESSAGE.GENERATION_FAILED);
    await t.viewer.showJob(baseJob({ status: "failed", outputs: [], error: null }));
    expect(t.viewer.getState().error.message).toBe(ERROR_MESSAGE.GENERATION_FAILED);
    t.viewer.dispose();
  });

  it("submission_unknown -> says it may have been charged, never retried automatically, no further calls", async () => {
    const t = mountCreative();
    const job = baseJob({
      jobId: "sim-submission-unknown",
      status: "submission_unknown",
      outputs: [],
      error: { code: "PROVIDER_UNAVAILABLE", message: "The request was sent but no answer arrived. It is not known whether a generation started or was charged." },
    });
    const r = await t.viewer.showJob(job);
    expect(r.ok).toBe(false);
    const e = t.viewer.getState().error;
    expect(e).toMatchObject({ code: "SUBMISSION_UNKNOWN", chargeMayHaveOccurred: true, autoRetry: false, serverCode: "PROVIDER_UNAVAILABLE", jobStatus: "submission_unknown" });
    expect(e.message).toMatch(/may have been charged/);
    expect(e.message).toMatch(/will not be retried automatically/);
    expect(statusText(t)).toBe(e.message);
    expect(t.viewer.getState().actions).toMatchObject({ view: false, download: false });
    await new Promise((r) => setTimeout(r, 20));
    expect(t.apiCalls).toHaveLength(0);
    expect(t.errors).toHaveLength(1);
    t.viewer.dispose();
  });

  it("unknown status -> JOB_STATUS_UNKNOWN; invalid job -> INVALID_ASSET", async () => {
    const t = mountCreative();
    await t.viewer.showJob(baseJob({ status: "queued_somewhere" }));
    expect(t.viewer.getState().error.code).toBe("JOB_STATUS_UNKNOWN");
    await t.viewer.showJob({ status: "succeeded" });
    expect(t.viewer.getState().error.code).toBe("INVALID_ASSET");
    t.viewer.dispose();
  });

  it("providerStatus is never branched on: same status, wildly different providerStatus -> same outcome", async () => {
    const outcomes = [];
    for (const providerStatus of ["sim-success", "failed", "in_progress", "success", null]) {
      const t = mountCreative();
      await t.viewer.showJob(baseJob({ jobId: "sim-processing", status: "processing", outputs: [], providerStatus, providerProgress: 99 }));
      const s = t.viewer.getState();
      outcomes.push([s.status, s.phase, statusText(t)].join("|"));
      t.viewer.dispose();
    }
    expect(new Set(outcomes).size).toBe(1);
  });
});

describe("watchJob(jobId): polls every 3-5 s while non-terminal", () => {
  it("processing -> (refresh.ok:false ignored) -> succeeded -> ready; delays clamped to 3-5 s", async () => {
    const timers = createInstantTimers();
    const t = mountCreative({ options: { setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout } });
    const r = await t.viewer.watchJob("sim-processing", { intervalMs: 50 });
    expect(r.ok).toBe(true);
    expect(t.sim.count("api", "jobs")).toBe(3);
    expect(timers.delays).toEqual([3000, 3000]);
    const phases = t.states.map((s) => s.phase);
    expect(phases).toContain("job-checking");
    expect(phases).toContain("job-processing");
    expect(t.viewer.getState()).toMatchObject({ status: "ready", job: { jobId: "sim-processing", status: "succeeded" } });
    for (const s of t.states) expect(JSON.stringify(s)).not.toMatch(/0\.37|sim-in-progress/);
    t.viewer.dispose();
  });

  it("default interval 4 s, upper clamp 5 s", async () => {
    const a = createInstantTimers();
    const t = mountCreative({ options: { setTimeout: a.setTimeout } });
    await t.viewer.watchJob("sim-processing");
    expect(a.delays).toEqual([4000, 4000]);
    const b = createInstantTimers();
    const u = mountCreative({ options: { setTimeout: b.setTimeout } });
    await u.viewer.watchJob("sim-processing", { intervalMs: 60000 });
    expect(b.delays).toEqual([5000, 5000]);
    t.viewer.dispose();
    u.viewer.dispose();
  });

  it("terminal states stop polling: submission_unknown is reported once and never re-polled", async () => {
    const timers = createInstantTimers();
    const t = mountCreative({ options: { setTimeout: timers.setTimeout } });
    await t.viewer.watchJob("sim-submission-unknown");
    expect(t.viewer.getState().error.code).toBe("SUBMISSION_UNKNOWN");
    expect(t.sim.count("api", "jobs")).toBe(1);
    expect(timers.delays).toEqual([]);
    await t.viewer.watchJob("sim-failed");
    expect(t.viewer.getState().error.code).toBe("GENERATION_FAILED");
    t.viewer.dispose();
  });

  it("clear() during polling stops it (pending sleep cancelled, resolves superseded)", async () => {
    let fire = null;
    const t = mountCreative({
      options: {
        setTimeout: (fn) => {
          fire = fn;
          return 1;
        },
        clearTimeout: () => {},
      },
    });
    const p = t.viewer.watchJob("sim-submitting");
    await new Promise((r) => setTimeout(r, 10));
    expect(t.viewer.getState().phase).toBe("job-submitting");
    t.viewer.clear();
    expect((await p).superseded).toBe(true);
    const n = t.sim.count("api", "jobs");
    if (fire) fire();
    await new Promise((r) => setTimeout(r, 10));
    expect(t.sim.count("api", "jobs")).toBe(n);
    expect(t.viewer.getState().status).toBe("idle");
    t.viewer.dispose();
  });

  it("missing job / status-check error -> mapped error, polling stops", async () => {
    const t = mountCreative({ options: { setTimeout: createInstantTimers().setTimeout } });
    await t.viewer.watchJob("nope");
    expect(t.viewer.getState().error.code).toBe("CONCEPT_NOT_FOUND");
    t.sim.failNext({ resource: "jobs", status: 503, code: "CREATIVE_STORE_NOT_CONFIGURED" });
    await t.viewer.watchJob("sim-glb-chair");
    expect(t.viewer.getState().error.code).toBe("CONCEPTS_NOT_CONFIGURED");
    t.viewer.dispose();
  });
});
