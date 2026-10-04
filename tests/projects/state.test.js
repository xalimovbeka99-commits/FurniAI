import { describe, expect, it } from "vitest";
import { initialState, normalizeJob, reduce, hasPollableJobs, snapshot } from "../../src/lib/projects/conceptGallery/state.js";
import { classifyError, ERROR_KIND, isRetryableAssetError } from "../../src/lib/projects/conceptGallery/errors.js";
import { clampPollInterval } from "../../src/lib/projects/conceptGallery/mountConceptGallery.js";
import { isNonTerminal, isViewableFormat } from "../../src/lib/projects/conceptGallery/contract.js";
import { errorFor, jobView, networkError, succeededJob, unknownJob, failedJob } from "./fixtures/contractFixtures.js";

describe("concept gallery state", () => {
  it("terminal vs non-terminal follows the contract table", () => {
    expect(["submitting", "processing"].every(isNonTerminal)).toBe(true);
    expect(["succeeded", "failed", "submission_unknown", "weird"].some(isNonTerminal)).toBe(false);
  });

  it("only glb/gltf are viewable; null and other formats are download-only", () => {
    expect(isViewableFormat("glb")).toBe(true);
    expect(isViewableFormat("GLTF")).toBe(true);
    for (const f of [null, "fbx", "obj", "usdz", "stl", "ply", "zip", ""]) expect(isViewableFormat(f)).toBe(false);
  });

  it("normalizeJob keeps contract fields and never invents thumbnail, prompt, dimensions or designId", () => {
    const j = normalizeJob({ ...jobView(), thumbnailUrl: "x", designId: "d", dimensions: { w: 1 }, prompt: "p" });
    for (const k of ["thumbnailUrl", "designId", "dimensions", "prompt"]) expect(j).not.toHaveProperty(k);
    expect(normalizeJob({ status: "processing" })).toBeNull();
  });

  it("ignores an older job view (out-of-order poll answers)", () => {
    const j = jobView({ updatedAt: "2026-10-04T07:10:05.000Z" });
    let s = reduce(initialState(), { type: "LIST_OK", jobs: [j] });
    s = reduce(s, { type: "JOB_OK", job: { ...j, status: "succeeded", outputs: [{ index: 0, format: "glb", mimeType: null }], updatedAt: "2026-10-04T07:11:00.000Z" } });
    s = reduce(s, { type: "JOB_OK", job: { ...j, status: "processing", updatedAt: "2026-10-04T07:10:30.000Z" } });
    expect(s.jobs[0].status).toBe("succeeded");
  });

  it("an invalid list body is a list error, not an empty gallery", () => {
    const s = reduce(initialState(), { type: "LIST_OK", jobs: undefined });
    expect(s.list).toBe("error");
    expect(s.error.code).toBe("INVALID_RESPONSE");
  });

  it("refresh:{ok:false} marks the check delayed and keeps the job pollable", () => {
    const j = jobView();
    let s = reduce(initialState(), { type: "LIST_OK", jobs: [j] });
    s = reduce(s, { type: "JOB_OK", job: j, refresh: { ok: false, code: "PROVIDER_UNAVAILABLE" } });
    expect(s.checkDelayed[j.jobId]).toBe("PROVIDER_UNAVAILABLE");
    expect(hasPollableJobs(s)).toBe(true);
  });

  it("terminal and integrity-failed jobs are not pollable", () => {
    const p = jobView();
    let s = reduce(initialState(), { type: "LIST_OK", jobs: [succeededJob(), failedJob(), unknownJob(), p] });
    expect(hasPollableJobs(s)).toBe(true);
    s = reduce(s, { type: "JOB_ERR", jobId: p.jobId, error: { kind: "integrity", code: "RECORD_INTEGRITY_FAILED" } });
    expect(hasPollableJobs(s)).toBe(false);
  });

  it("snapshot is deep-frozen", () => {
    const s = snapshot(reduce(initialState(), { type: "LIST_OK", jobs: [jobView()] }));
    expect(Object.isFrozen(s.jobs[0])).toBe(true);
  });

  it("classifies by code, not by message text", () => {
    expect(classifyError({ status: 409, code: "ASSET_NOT_READY", message: "integrity" }).kind).toBe(ERROR_KIND.ASSET_NOT_READY);
    expect(classifyError({ status: 409, code: "RECORD_INTEGRITY_FAILED", message: "not ready" }).kind).toBe(ERROR_KIND.INTEGRITY);
    expect(classifyError(errorFor("ASSET_UNAVAILABLE")).kind).toBe(ERROR_KIND.ASSET_UNAVAILABLE);
    expect(classifyError(errorFor("MISSING_AUTH")).kind).toBe(ERROR_KIND.SIGNED_OUT);
    expect(classifyError({ status: 401 }).kind).toBe(ERROR_KIND.SIGNED_OUT);
    expect(classifyError(networkError()).kind).toBe(ERROR_KIND.NETWORK);
    expect(classifyError(errorFor("INTERNAL")).kind).toBe(ERROR_KIND.SERVER);
    expect(classifyError(errorFor("PROVIDER_UNAVAILABLE")).kind).toBe(ERROR_KIND.SERVER);
    expect(classifyError(errorFor("CREATIVE_STORE_NOT_CONFIGURED")).kind).toBe(ERROR_KIND.NOT_CONFIGURED);
    expect(classifyError({ status: 503, code: "AUTH_UNAVAILABLE" }).kind).toBe(ERROR_KIND.SERVER);
    expect(classifyError(errorFor("MISSING_JOB")).kind).toBe(ERROR_KIND.NOT_FOUND);
  });

  it("only transient asset failures are retried", () => {
    expect(isRetryableAssetError(classifyError(networkError()))).toBe(true);
    expect(isRetryableAssetError(classifyError(errorFor("PROVIDER_UNAVAILABLE")))).toBe(true);
    for (const c of ["ASSET_NOT_READY", "ASSET_UNAVAILABLE", "RECORD_INTEGRITY_FAILED", "MISSING_AUTH", "MISSING_JOB"]) {
      expect(isRetryableAssetError(classifyError(errorFor(c)))).toBe(false);
    }
  });

  it("poll interval is clamped to the contract's 3-5 s", () => {
    expect(clampPollInterval(100)).toBe(3000);
    expect(clampPollInterval(4000)).toBe(4000);
    expect(clampPollInterval(60000)).toBe(5000);
    expect(clampPollInterval("x")).toBe(4000);
  });
});
