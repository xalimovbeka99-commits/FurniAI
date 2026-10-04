/**
 * Fixture-shape test. Pins the fixtures to SCENARIO_3D_API_CONTRACT.md
 * (PROPOSED) §2.4/§2.5/§5. Self-contained: it does not import or need
 * Claude's backend ref. The one-off check against the real handler at
 * 7f42f956 is described in docs/m3/projects/CONCEPT_GALLERY.md.
 */
import { describe, expect, it } from "vitest";
import {
  ASSET_VIEW_KEYS, CONCEPT, CONCEPT_KEYS, ERROR_RESPONSES, JOB_VIEW_KEYS, OUTPUT_KEYS, STATUSES, STORAGE_KEYS, USAGE_KEYS,
  assetBody, failedJob, jobBody, jobView, listBody, succeededJob, unknownJob,
} from "./fixtures/contractFixtures.js";
import { JOB_STATUS } from "../../src/lib/projects/conceptGallery/contract.js";

const sorted = (o) => Object.keys(o).sort();
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/;

function expectJobView(j) {
  expect(sorted(j)).toEqual([...JOB_VIEW_KEYS].sort());
  expect(STATUSES).toContain(j.status);
  expect(typeof j.jobId).toBe("string");
  expect(sorted(j.usage)).toEqual([...USAGE_KEYS].sort());
  expect(j.usage.unit).toBe("provider_cost_units");
  expect(j.storage).toEqual({ durableCopy: false, reason: "ASSET_STORAGE_NOT_CONFIGURED" });
  expect(sorted(j.concept)).toEqual([...CONCEPT_KEYS].sort());
  expect(j.concept).toEqual(CONCEPT);
  for (const o of j.outputs) expect(sorted(o)).toEqual([...OUTPUT_KEYS].sort());
  j.outputs.forEach((o, i) => expect(o.index).toBe(i));
  expect(j.createdAt).toMatch(ISO);
  expect(j.updatedAt).toMatch(ISO);
  for (const k of ["submittedAt", "completedAt"]) if (j[k] !== null) expect(j[k]).toMatch(ISO);
  if (j.error !== null) expect(sorted(j.error)).toEqual(["code", "message"]);
  if (j.providerProgress !== null) expect(typeof j.providerProgress).toBe("number");
  // Not in the contract, so never in a fixture.
  for (const k of ["thumbnail", "thumbnailUrl", "prompt", "designId", "dimensions", "referenceUrl"]) expect(j).not.toHaveProperty(k);
}

describe("fixtures match the creative contract", () => {
  it("the gallery's status list is exactly the contract's", () => {
    expect(Object.values(JOB_STATUS).sort()).toEqual([...STATUSES].sort());
  });

  it("job views (every status)", () => {
    const jobs = [jobView(), jobView({ status: "submitting", submittedAt: null }), succeededJob(), failedJob(), unknownJob()];
    jobs.forEach(expectJobView);
    expect(succeededJob().outputs.length).toBeGreaterThan(0);
    expect(failedJob().error.code).toBeTruthy();
  });

  it("list body { ok, jobs } and single job body { ok, job, refresh? }", () => {
    expect(sorted(listBody([]))).toEqual(["jobs", "ok"]);
    expect(sorted(jobBody(jobView()))).toEqual(["job", "ok"]);
    expect(jobBody(jobView(), { ok: false, code: "PROVIDER_UNAVAILABLE" }).refresh).toEqual({ ok: false, code: "PROVIDER_UNAVAILABLE" });
  });

  it("asset body", () => {
    const j = succeededJob();
    const b = assetBody(j, 0);
    expect(sorted(b)).toEqual(["asset", "ok"]);
    expect(sorted(b.asset)).toEqual([...ASSET_VIEW_KEYS].sort());
    expect(b.asset).toMatchObject({ jobId: j.jobId, index: 0, expiresAt: null, expiryKnown: false, durableCopy: false, concept: CONCEPT });
    expect(b.asset.url).toMatch(/^https:\/\//);
    expect(b.asset.resolvedAt).toMatch(ISO);
  });

  it("error bodies { ok:false, code, error, details? } with the contract's statuses", () => {
    const expected = {
      MISSING_AUTH: 401, ASSET_NOT_READY: 409, ASSET_UNAVAILABLE: 410, RECORD_INTEGRITY_FAILED: 409,
      MISSING_JOB: 404, INTERNAL: 500, PROVIDER_UNAVAILABLE: 502, CREATIVE_STORE_NOT_CONFIGURED: 503,
    };
    for (const [code, { status, body }] of Object.entries(ERROR_RESPONSES)) {
      expect(status).toBe(expected[code]);
      expect(body.ok).toBe(false);
      expect(body.code).toBe(code);
      expect(typeof body.error).toBe("string");
      expect(sorted(body).filter((k) => !["ok", "code", "error", "details"].includes(k))).toEqual([]);
    }
    expect(ERROR_RESPONSES.ASSET_NOT_READY.body.details).toEqual({ jobStatus: "processing" });
    expect(ERROR_RESPONSES.ASSET_UNAVAILABLE.body.details).toEqual({ durableCopy: false });
  });
});
