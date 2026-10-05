/**
 * SIMULATED EVIDENCE. Every test here runs FurniAI's real handler, service,
 * client and HTTP against scenarioStandIn.js — a local stand-in. No request
 * leaves the machine; nothing is billed; none of this is evidence about the
 * real Scenario API.
 */
import http from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import handler from "../../../api/creative.js";
import { startScenarioStandIn } from "./scenarioStandIn.js";
import { getSharedMemoryCreativeStore } from "./memoryStore.js";
import { validateReferenceUpload, MAX_REFERENCE_BYTES } from "./referenceUpload.js";
import { readScenarioConfig } from "./scenarioConfig.js";
import { createSupabaseCreativeStore } from "./supabaseStore.js";

import { PNG, JPEG, WEBP } from "./testImages.js";
import { crc32 } from "node:zlib";
/** Signature bytes only — what the first version of these tests wrongly used as "an image". */
const PNG_SIGNATURE_ONLY = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]);
const JPEG_SIGNATURE_ONLY = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 3)]);
const b64 = (buf) => buf.toString("base64");

const ENV_KEYS = ["SCENARIO_API_KEY", "SCENARIO_API_SECRET", "SCENARIO_API_BASE_URL", "SCENARIO_3D_MODEL_ID", "SCENARIO_3D_IMAGE_PARAM", "SCENARIO_3D_IMAGE_PARAM_IS_ARRAY", "SCENARIO_3D_EXTRA_PARAMS_JSON", "SCENARIO_STATUS_SUCCESS", "SCENARIO_STATUS_FAILURE", "SCENARIO_LIVE_GENERATION_ENABLED", "SCENARIO_MAX_COST_PER_JOB", "SCENARIO_ASSET_UPLOAD_DATA_URL", "CREATIVE_RECORD_SIGNING_KEY", "FURNIAI_PERSISTENCE_TEST_AUTH", "VERCEL_ENV", "SUPABASE_URL", "SUPABASE_ANON_KEY"];
const SECRET = "sim-secret-value-do-not-leak";

let sim;
let api;
let apiUrl;
const saved = {};

beforeAll(async () => {
  api = http.createServer((req, res) => handler(req, res));
  await new Promise((r) => api.listen(0, "127.0.0.1", r));
  apiUrl = `http://127.0.0.1:${api.address().port}/api/creative`;
});
afterAll(() => new Promise((r) => api.close(r)));

beforeEach(async () => {
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  sim = await startScenarioStandIn();
  Object.assign(process.env, {
    FURNIAI_PERSISTENCE_TEST_AUTH: "yes",
    SCENARIO_API_KEY: "sim-key",
    SCENARIO_API_SECRET: SECRET,
    SCENARIO_API_BASE_URL: sim.baseUrl,
    SCENARIO_3D_MODEL_ID: "model_sim-img23d",
    SCENARIO_3D_IMAGE_PARAM: "image",
    SCENARIO_3D_IMAGE_PARAM_IS_ARRAY: "yes",
    SCENARIO_STATUS_SUCCESS: "sim-done",
    SCENARIO_STATUS_FAILURE: "sim-failed",
    SCENARIO_LIVE_GENERATION_ENABLED: "yes",
    SCENARIO_MAX_COST_PER_JOB: "20",
  });
  const s = getSharedMemoryCreativeStore();
  s._raw.references.clear();
  s._raw.jobs.clear();
});
afterEach(async () => {
  await sim.close();
  for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
});

async function call(method, qs, { body, user = "user-a", auth = true } = {}) {
  const res = await fetch(`${apiUrl}?${qs}`, {
    method,
    headers: { ...(auth ? { authorization: `Bearer test:${user}` } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: JSON.parse(text), text };
}
const upload = (buf = PNG, opts) => call("POST", "resource=references", { body: { name: "wardrobe.png", dataBase64: b64(buf) }, ...opts });
const submit = (referenceId, idempotencyKey = "key-00000001", opts) => call("POST", "resource=jobs", { body: { referenceId, idempotencyKey }, ...opts });
const poll = (jobId, opts) => call("GET", `resource=jobs&jobId=${jobId}`, opts);
const settle = () => new Promise((r) => setTimeout(r, 2100));

describe("reference upload", () => {
  it("accepts PNG/JPEG by content, hands it to the provider once, and returns no provider id", async () => {
    const r = await upload(PNG);
    expect(r.status).toBe(201);
    expect(r.body.reference).toMatchObject({ contentType: "image/png", bytes: PNG.length, name: "wardrobe.png", width: 64, height: 48, validation: "decoded" });
    expect(r.body.reference.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(r.text).not.toContain("asset_ref_");
    expect(sim.state.calls.upload).toBe(1);
    expect(sim.state.lastUploadBody.image).toBe(b64(PNG));
    expect((await upload(JPEG)).body.reference).toMatchObject({ contentType: "image/jpeg", width: 64, height: 48, validation: "structure" });
    expect((await upload(WEBP)).body.reference).toMatchObject({ contentType: "image/webp", width: 64, height: 48, validation: "structure" });
  });

  it("signature-like bytes are NOT an image: a correct magic number with no decodable content is refused", async () => {
    for (const fake of [PNG_SIGNATURE_ONLY, JPEG_SIGNATURE_ONLY]) {
      const r = await upload(fake);
      expect(r.status).toBe(422);
      expect(r.body.code).toBe("INVALID_IMAGE");
    }
    expect(sim.state.calls.upload).toBe(0);
  });

  it("PNG is decoded in full: truncation, a corrupt checksum, corrupt pixel data and trailing data are each refused", () => {
    const refuse = (buf, re) => expect(() => validateReferenceUpload({ dataBase64: b64(buf) })).toThrow(expect.objectContaining({ code: "INVALID_IMAGE", message: expect.stringMatching(re) }));
    refuse(PNG.subarray(0, PNG.length - 20), /truncated/);
    const flipped = Buffer.from(PNG); flipped[PNG.indexOf("IDAT") + 10] ^= 0xff;
    refuse(flipped, /checksum/);
    // Valid chunk checksums around a compressed stream that is not valid: only a real inflate catches this.
    const at = PNG.indexOf("IDAT"); const len = PNG.readUInt32BE(at - 4);
    const garbage = Buffer.from(PNG); garbage.fill(0x55, at + 4, at + 4 + len);
    garbage.writeUInt32BE(crc32(garbage.subarray(at, at + 4 + len)), at + 4 + len);
    refuse(garbage, /decompressed|dimensions|corrupt/);
    refuse(Buffer.concat([PNG, Buffer.from("extra")]), /after the end/);
  });

  it("JPEG and WebP are checked structurally only — a truncated file is refused, and the result says `structure`", () => {
    for (const buf of [JPEG.subarray(0, JPEG.length - 30), WEBP.subarray(0, WEBP.length - 30)]) {
      expect(() => validateReferenceUpload({ dataBase64: b64(buf) })).toThrow(expect.objectContaining({ code: "INVALID_IMAGE" }));
    }
    expect(validateReferenceUpload({ dataBase64: b64(JPEG) }).validation).toBe("structure");
  });

  it("refuses images outside the accepted dimensions (header says 1×1)", () => {
    const tiny = Buffer.from(PNG); const ih = tiny.indexOf("IHDR");
    tiny.writeUInt32BE(1, ih + 4); tiny.writeUInt32BE(1, ih + 8);
    tiny.writeUInt32BE(crc32(tiny.subarray(ih, ih + 17)), ih + 17);
    expect(() => validateReferenceUpload({ dataBase64: b64(tiny) })).toThrow(expect.objectContaining({ code: "INVALID_IMAGE" }));
  });

  it("re-uploading identical bytes reuses the reference without a second provider upload", async () => {
    const a = await upload(PNG);
    const b = await upload(PNG);
    expect(b.status).toBe(200);
    expect(b.body.reused).toBe(true);
    expect(b.body.reference.referenceId).toBe(a.body.reference.referenceId);
    expect(sim.state.calls.upload).toBe(1);
  });

  it("refuses by magic number, not by declared type or extension", async () => {
    const fake = await call("POST", "resource=references", { body: { name: "x.png", contentType: "image/png", dataBase64: b64(Buffer.from("<svg onload=alert(1)>".padEnd(64))) } });
    expect(fake.status).toBe(415);
    expect(fake.body.code).toBe("UNSUPPORTED_FILE_TYPE");
    const mismatch = await call("POST", "resource=references", { body: { name: "x.jpg", contentType: "image/jpeg", dataBase64: b64(PNG) } });
    expect(mismatch.status).toBe(415);
    expect(sim.state.calls.upload).toBe(0);
  });

  it("refuses oversize, empty, non-base64 and data: URL bodies before any provider call", () => {
    const big = Buffer.concat([PNG, Buffer.alloc(MAX_REFERENCE_BYTES)]); // size is checked before content
    expect(() => validateReferenceUpload({ dataBase64: b64(big) })).toThrow(expect.objectContaining({ code: "FILE_TOO_LARGE", status: 413 }));
    expect(() => validateReferenceUpload({ dataBase64: "" })).toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    expect(() => validateReferenceUpload({ dataBase64: "data:image/png;base64," + b64(PNG) })).toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    expect(() => validateReferenceUpload({ dataBase64: 42 })).toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
  });

  it("sanitises the file name", () => {
    expect(validateReferenceUpload({ name: "../../etc/pass<wd>.exe", dataBase64: b64(PNG) }).name).toBe("passwd.png");
  });
});

describe("auth and isolation", () => {
  it("requires sign-in on every resource", async () => {
    for (const [m, qs] of [["GET", "resource=config"], ["POST", "resource=references"], ["POST", "resource=jobs"], ["GET", "resource=jobs"], ["GET", "resource=asset&jobId=x"]]) {
      const r = await call(m, qs, { auth: false, body: m === "POST" ? {} : undefined });
      expect(r.status, `${m} ${qs}`).toBe(401);
    }
    expect(Object.values(sim.state.calls).every((n) => n === 0)).toBe(true);
  });

  it("another user's reference, job and asset answer exactly like nonexistent ones", async () => {
    const ref = (await upload()).body.reference.referenceId;
    const job = (await submit(ref)).body.job.jobId;
    expect((await submit(ref, "key-00000002", { user: "user-b" })).body.code).toBe("MISSING_REFERENCE");
    const theirs = await poll(job, { user: "user-b" });
    const none = await poll("00000000-0000-4000-8000-000000000000", { user: "user-b" });
    expect(theirs.status).toBe(404);
    expect(theirs.text).toBe(none.text);
    expect((await call("GET", `resource=asset&jobId=${job}`, { user: "user-b" })).status).toBe(404);
    expect((await call("GET", "resource=jobs", { user: "user-b" })).body.jobs).toEqual([]);
  });
});

describe("submission, status and result", () => {
  it("upload → submit → poll → asset: the full simulated journey", async () => {
    sim.state.pollsUntilDone = 2;
    const ref = (await upload()).body.reference.referenceId;
    const s = await submit(ref);
    expect(s.status).toBe(202);
    expect(s.body.replayed).toBe(false);
    const job = s.body.job;
    expect(job).toMatchObject({ status: "processing", provider: "scenario", model: "model_sim-img23d", sourceReferenceId: ref, providerStatus: "sim-running", outputs: [] });
    expect(job.usage).toEqual({ estimatedCost: 12, reportedCost: null, unit: "provider_cost_units", billingOutcome: "unconfirmed" });
    expect(job.submittedAt).toBeTruthy();
    expect(sim.state.lastGenerateBody).toEqual({ image: ["asset_ref_1"] });
    expect(sim.state.lastAuth).toBe("Basic " + Buffer.from(`sim-key:${SECRET}`).toString("base64"));

    const p1 = await poll(job.jobId);
    expect(p1.body.job).toMatchObject({ status: "processing", providerStatus: "sim-running", providerProgress: 0.5 });
    expect((await call("GET", `resource=asset&jobId=${job.jobId}`)).body.code).toBe("ASSET_NOT_READY");

    await settle();
    const p2 = await poll(job.jobId);
    expect(p2.body.job).toMatchObject({ status: "succeeded", providerStatus: "sim-done", outputs: [{ index: 0, format: "glb" }] });
    expect(p2.body.job.usage).toMatchObject({ reportedCost: 12, billingOutcome: "reported" });
    expect(p2.body.job.completedAt).toBeTruthy();
    expect(p2.body.job.storage).toEqual({ durableCopy: false, reason: "ASSET_STORAGE_NOT_CONFIGURED" });

    const a = await call("GET", `resource=asset&jobId=${job.jobId}`);
    expect(a.status).toBe(200);
    expect(a.body.asset).toMatchObject({ format: "glb", expiresAt: null, expiryKnown: false, durableCopy: false });
    expect(a.body.asset.url).toMatch(/^https:\/\/cdn\.sim\.invalid\/asset_out_job_sim_1\.glb/);
    expect(sim.state.calls.generate).toBe(1);
  }, 15000);

  it("status polls are throttled: a burst makes one provider status call", async () => {
    sim.state.pollsUntilDone = 99;
    const job = (await submit((await upload()).body.reference.referenceId)).body.job.jobId;
    await Promise.all([poll(job), poll(job), poll(job)]);
    await poll(job);
    expect(sim.state.calls.job).toBeLessThanOrEqual(3);
    await poll(job); await poll(job);
    expect(sim.state.calls.job).toBeLessThanOrEqual(3);
  });

  it("an unrecognised provider status stays `processing` and is passed through verbatim", async () => {
    sim.state.statusWords.success = "some-new-word";
    const job = (await submit((await upload()).body.reference.referenceId)).body.job.jobId;
    const p = await poll(job);
    expect(p.body.job).toMatchObject({ status: "processing", providerStatus: "some-new-word", outputs: [] });
  });

  it("the format is what the returned asset shows; unknown stays null", async () => {
    sim.state.assetExtension = "bin";
    const job = (await submit((await upload()).body.reference.referenceId)).body.job.jobId;
    expect((await poll(job)).body.job.outputs).toEqual([{ index: 0, format: null, mimeType: null }]);
  });

  it("a provider-reported failure becomes `failed` with the provider's reason", async () => {
    sim.state.outcome = "failure";
    const job = (await submit((await upload()).body.reference.referenceId)).body.job.jobId;
    const p = await poll(job);
    expect(p.body.job).toMatchObject({ status: "failed", providerStatus: "sim-failed", error: { code: "PROVIDER_GENERATION_FAILED", message: "simulated generation failure" } });
  });

  it("a failed status check does not fail the job", async () => {
    const job = (await submit((await upload()).body.reference.referenceId)).body.job.jobId;
    sim.state.jobs.clear(); // provider now answers 404 for the job
    const p = await poll(job);
    expect(p.status).toBe(200);
    expect(p.body.job.status).toBe("processing");
    expect(p.body.refresh).toEqual({ ok: false, code: "PROVIDER_REJECTED_REQUEST" });
  });

  it("every job view states that it is a concept, not an editable or measured design", async () => {
    const job = (await submit((await upload()).body.reference.referenceId)).body.job;
    expect(job.concept).toMatchObject({ kind: "visual_concept", editable: false, dimensionsVerified: false, partsSeparable: false, manufacturable: false });
    for (const k of ["furniSpec", "partGraph", "designId", "dimensions"]) expect(job).not.toHaveProperty(k);
  });
});

describe("duplicate submissions and repeated billing", () => {
  it("the same idempotency key replays the job with no provider call at all", async () => {
    const ref = (await upload()).body.reference.referenceId;
    const a = await submit(ref, "click-0001");
    const before = { ...sim.state.calls };
    const b = await submit(ref, "click-0001");
    expect(b.status).toBe(200);
    expect(b.body.replayed).toBe(true);
    expect(b.body.job.jobId).toBe(a.body.job.jobId);
    expect(sim.state.calls).toEqual(before);
  });

  it("ten simultaneous identical submissions make exactly one paid call", async () => {
    const ref = (await upload()).body.reference.referenceId;
    const all = await Promise.all(Array.from({ length: 10 }, () => submit(ref, "click-0001")));
    expect(sim.state.calls.generate).toBe(1);
    expect(new Set(all.map((r) => r.body.job?.jobId)).size).toBe(1);
    expect(all.filter((r) => r.status === 202)).toHaveLength(1);
  });

  it("ten simultaneous submissions with DIFFERENT keys for one reference make exactly one paid call", async () => {
    const ref = (await upload()).body.reference.referenceId;
    const all = await Promise.all(Array.from({ length: 10 }, (_, i) => submit(ref, `click-000${i}`)));
    expect(sim.state.calls.generate).toBe(1);
    const dup = all.filter((r) => r.status === 409);
    expect(dup).toHaveLength(9);
    expect(dup.every((r) => r.body.code === "DUPLICATE_ACTIVE_JOB" && r.body.details.jobId)).toBe(true);
  });

  it("a key reused for a different reference is refused, not replayed", async () => {
    const r1 = (await upload(PNG)).body.reference.referenceId;
    const r2 = (await upload(JPEG)).body.reference.referenceId;
    await submit(r1, "click-0001");
    const again = await submit(r2, "click-0001");
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("IDEMPOTENCY_KEY_REUSED");
    expect(sim.state.calls.generate).toBe(1);
  });

  it("after a job finishes, a new key may generate again — a deliberate second purchase", async () => {
    const ref = (await upload()).body.reference.referenceId;
    const j = (await submit(ref, "click-0001")).body.job.jobId;
    await poll(j);
    expect((await submit(ref, "click-0002")).status).toBe(202);
    expect(sim.state.calls.generate).toBe(2);
  });

  it("a malformed or missing idempotency key is refused before any provider call", async () => {
    const ref = (await upload()).body.reference.referenceId;
    for (const k of [null, "", "short", "has space 123", "x".repeat(129)]) {
      expect((await submit(ref, k)).status).toBe(400);
    }
    expect(sim.state.calls.dryRun + sim.state.calls.generate).toBe(0);
  });
});

describe("spend controls", () => {
  const cases = [
    ["generation switched off", () => delete process.env.SCENARIO_LIVE_GENERATION_ENABLED, 503, "CREATIVE_GENERATION_DISABLED"],
    ["switch set to something other than yes", () => (process.env.SCENARIO_LIVE_GENERATION_ENABLED = "true"), 503, "CREATIVE_GENERATION_DISABLED"],
    ["no spend cap", () => delete process.env.SCENARIO_MAX_COST_PER_JOB, 503, "CREATIVE_NOT_CONFIGURED"],
    ["a non-numeric cap", () => (process.env.SCENARIO_MAX_COST_PER_JOB = "lots"), 503, "CREATIVE_NOT_CONFIGURED"],
    ["no model id", () => delete process.env.SCENARIO_3D_MODEL_ID, 503, "CREATIVE_NOT_CONFIGURED"],
    ["no image-input name", () => delete process.env.SCENARIO_3D_IMAGE_PARAM, 503, "CREATIVE_NOT_CONFIGURED"],
    ["no verified status words", () => delete process.env.SCENARIO_STATUS_SUCCESS, 503, "CREATIVE_NOT_CONFIGURED"],
  ];
  for (const [name, mutate, status, code] of cases) {
    it(`${name} → ${code}, zero paid calls`, async () => {
      const ref = (await upload()).body.reference.referenceId;
      mutate();
      const r = await submit(ref);
      expect(r.status).toBe(status);
      expect(r.body.code).toBe(code);
      expect(sim.state.calls.generate).toBe(0);
    });
  }

  it("a cost preview above the cap refuses, and does not consume the idempotency key", async () => {
    const ref = (await upload()).body.reference.referenceId;
    sim.state.cost = 21;
    const r = await submit(ref, "click-0001");
    expect(r.status).toBe(402);
    expect(r.body).toMatchObject({ code: "COST_CAP_EXCEEDED", details: { estimatedCost: 21, maxCostPerJob: 20 } });
    expect(sim.state.calls.generate).toBe(0);
    sim.state.cost = 20;
    expect((await submit(ref, "click-0001")).status).toBe(202);
  });

  it("an unreadable cost preview refuses rather than assuming a cost", async () => {
    const ref = (await upload()).body.reference.referenceId;
    sim.state.costField = "none";
    const r = await submit(ref);
    expect(r.body.code).toBe("COST_UNVERIFIED");
    expect(sim.state.calls.generate).toBe(0);
  });

  it("there is no default model id, input name or status vocabulary", () => {
    const cfg = readScenarioConfig({ SCENARIO_API_KEY: "k", SCENARIO_API_SECRET: "s" });
    expect(cfg.configured).toBe(false);
    expect(cfg.missing).toEqual(["SCENARIO_3D_MODEL_ID", "SCENARIO_3D_IMAGE_PARAM", "SCENARIO_STATUS_SUCCESS", "SCENARIO_STATUS_FAILURE"]);
    expect(cfg.modelId).toBe("");
  });
});

describe("provider failures", () => {
  const refuse = (code, body) => async (_req, res) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); return true; };

  it("insufficient credits (402) → PROVIDER_INSUFFICIENT_CREDITS, job failed, not retried", async () => {
    const ref = (await upload()).body.reference.referenceId;
    sim.state.onGenerate = refuse(402, { message: "Payment required" });
    const r = await submit(ref, "click-0001");
    expect(r.status).toBe(402);
    expect(r.body).toMatchObject({ code: "PROVIDER_INSUFFICIENT_CREDITS", details: { jobStatus: "failed", outcomeUnknown: false } });
    expect(sim.state.calls.generate).toBe(1);
    const again = await submit(ref, "click-0001");
    expect(again.body).toMatchObject({ replayed: true, job: { status: "failed", error: { code: "PROVIDER_INSUFFICIENT_CREDITS" } } });
    expect(sim.state.calls.generate).toBe(1);
  });

  it("insufficient credits worded under another 4xx is still recognised", async () => {
    const ref = (await upload()).body.reference.referenceId;
    sim.state.onGenerate = refuse(400, { message: "Not enough creative units to run this model" });
    expect((await submit(ref)).body.code).toBe("PROVIDER_INSUFFICIENT_CREDITS");
  });

  it("rejected credentials → PROVIDER_AUTH_REJECTED, and the secret never appears in any response", async () => {
    const ref = (await upload()).body.reference.referenceId;
    sim.state.authOk = false;
    const r = await submit(ref);
    expect(r.status).toBe(502);
    expect(r.body.code).toBe("PROVIDER_AUTH_REJECTED");
    const cfg = await call("GET", "resource=config");
    for (const t of [r.text, cfg.text]) { expect(t).not.toContain(SECRET); expect(t).not.toContain("sim-key"); expect(t).not.toContain("Basic "); }
  });

  it("rate limit → PROVIDER_RATE_LIMITED, one call, no retry", async () => {
    const ref = (await upload()).body.reference.referenceId;
    sim.state.onGenerate = refuse(429, { message: "slow down" });
    const r = await submit(ref);
    expect(r.status).toBe(429);
    expect(sim.state.calls.generate).toBe(1);
  });

  it("a 5xx on the paid call → submission_unknown: never resubmitted, and says it may have been charged", async () => {
    const ref = (await upload()).body.reference.referenceId;
    sim.state.onGenerate = refuse(503, { message: "upstream" });
    const r = await submit(ref, "click-0001");
    expect(r.status).toBe(502);
    expect(r.body).toMatchObject({ code: "PROVIDER_UNAVAILABLE", details: { jobStatus: "submission_unknown", outcomeUnknown: true } });
    expect(r.body.error).toMatch(/not known whether/);
    sim.state.onGenerate = null;
    const again = await submit(ref, "click-0001");
    expect(again.body).toMatchObject({ replayed: true, job: { status: "submission_unknown" } });
    expect(sim.state.calls.generate).toBe(1);
  });

  it("after submission_unknown, generating again needs an explicit acknowledgement that a charge may already exist", async () => {
    const ref = (await upload()).body.reference.referenceId;
    sim.state.onGenerate = refuse(503, { message: "upstream" });
    await submit(ref, "click-0001");
    sim.state.onGenerate = null;
    const blocked = await submit(ref, "click-0002");
    expect(blocked.status).toBe(409);
    expect(blocked.body).toMatchObject({ code: "PRIOR_SUBMISSION_UNKNOWN", details: { jobId: expect.any(String) } });
    expect(sim.state.calls.generate).toBe(1);
    const acked = await call("POST", "resource=jobs", { body: { referenceId: ref, idempotencyKey: "click-0002", acknowledgeUnknownCharge: true } });
    expect(acked.status).toBe(202);
    expect(sim.state.calls.generate).toBe(2);
  });

  it("no provider error is ever described as free: refused paid calls are `unconfirmed`, never 'nothing was generated'", async () => {
    const ref = (await upload()).body.reference.referenceId;
    const seen = [];
    for (const [i, [code, body]] of [[402, { message: "Payment required" }], [429, { message: "slow" }], [400, { message: "bad input" }], [503, { message: "upstream" }]].entries()) {
      sim.state.onGenerate = refuse(code, body);
      const r = await call("POST", "resource=jobs", { body: { referenceId: ref, idempotencyKey: `click-100${i}`, acknowledgeUnknownCharge: true } });
      seen.push(r);
      expect(r.body.details.billingOutcome).toBe("unconfirmed");
      const stored = (await poll(r.body.details.jobId)).body.job;
      expect(stored.usage.billingOutcome).toBe("unconfirmed");
      expect(stored.error.message).toMatch(/not confirmed|not known/);
    }
    for (const r of seen) expect(r.text).not.toMatch(/nothing was generated|no charge|not charged|free/i);
  });

  it("a dropped connection on the paid call → submission_unknown, one call", async () => {
    const ref = (await upload()).body.reference.referenceId;
    sim.state.onGenerate = async (req) => { req.socket.destroy(); return true; };
    const r = await submit(ref);
    expect(r.body.details).toMatchObject({ jobStatus: "submission_unknown", outcomeUnknown: true });
    expect(sim.state.calls.generate).toBe(1);
  });

  it("an accepted request with no job id → submission_unknown (fail closed on an unknown shape)", async () => {
    const ref = (await upload()).body.reference.referenceId;
    sim.state.onGenerate = refuse(200, { accepted: true });
    const r = await submit(ref);
    expect(r.body).toMatchObject({ code: "PROVIDER_UNEXPECTED_RESPONSE", details: { jobStatus: "submission_unknown" } });
  });

  it("provider unreachable at upload → PROVIDER_UNAVAILABLE and no reference is recorded", async () => {
    await sim.close();
    const r = await upload();
    expect(r.status).toBe(502);
    expect(r.body.code).toBe("PROVIDER_UNAVAILABLE");
    expect(getSharedMemoryCreativeStore()._raw.references.size).toBe(0);
    sim = await startScenarioStandIn();
  });
});

describe("asset addresses", () => {
  it("each request resolves a fresh address from the provider; none is stored", async () => {
    const job = (await submit((await upload()).body.reference.referenceId)).body.job.jobId;
    await poll(job);
    const a1 = (await call("GET", `resource=asset&jobId=${job}`)).body.asset.url;
    const a2 = (await call("GET", `resource=asset&jobId=${job}`)).body.asset.url;
    expect(a1).not.toBe(a2);
    const stored = JSON.stringify([...getSharedMemoryCreativeStore()._raw.jobs.values()]);
    expect(stored).not.toContain("https://");
  });

  it("an asset the provider no longer holds → 410 ASSET_UNAVAILABLE, stating there is no stored copy", async () => {
    const job = (await submit((await upload()).body.reference.referenceId)).body.job.jobId;
    await poll(job);
    sim.state.assetGone = true;
    const r = await call("GET", `resource=asset&jobId=${job}`);
    expect(r.status).toBe(410);
    expect(r.body).toMatchObject({ code: "ASSET_UNAVAILABLE", details: { durableCopy: false } });
  });

  it("bad index → 400; index beyond the outputs → ASSET_NOT_READY", async () => {
    const job = (await submit((await upload()).body.reference.referenceId)).body.job.jobId;
    await poll(job);
    expect((await call("GET", `resource=asset&jobId=${job}&index=-1`)).status).toBe(400);
    expect((await call("GET", `resource=asset&jobId=${job}&index=5`)).body.code).toBe("ASSET_NOT_READY");
  });
});

describe("stored-record integrity", () => {
  // REGRESSION (intake on 7f42f95): `status` was not covered by the signature,
  // so a running row flipped to `failed` was accepted and a new key bought a
  // second generation for the same reference.
  it("a running row flipped to failed (signature untouched) is refused, and a new key does NOT submit again", async () => {
    const ref = (await upload()).body.reference.referenceId;
    const job = (await submit(ref, "click-0001")).body.job.jobId;
    getSharedMemoryCreativeStore()._raw.jobs.get(job).status = "failed";
    const again = await submit(ref, "click-0002");
    expect(sim.state.calls.generate).toBe(1);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("RECORD_INTEGRITY_FAILED");
    expect((await poll(job)).body.code).toBe("RECORD_INTEGRITY_FAILED");
  });
  const TAMPER = {
    status: (r) => (r.status = "succeeded"),
    idempotencyKey: (r) => (r.idempotencyKey = "freed-key-0001"),
    referenceId: (r) => (r.referenceId = "00000000-0000-4000-8000-000000000009"),
    modelId: (r) => (r.modelId = "model_cheaper"),
    providerJobId: (r) => (r.providerJobId = "job_of_someone_else"),
    version: (r) => (r.version += 1),
    estimatedCost: (r) => (r.estimatedCost = 0),
    reportedCost: (r) => (r.reportedCost = 0),
    error: (r) => (r.error = { code: "X", message: "y" }),
    createdAt: (r) => (r.createdAt = "2020-01-01T00:00:00.000Z"),
    submittedAt: (r) => (r.submittedAt = null),
    completedAt: (r) => (r.completedAt = "2026-10-04T00:00:00.000Z"),
    providerStatus: (r) => (r.providerStatus = "sim-done"),
    outputs: (r) => (r.outputs = [{ assetId: "asset_x", format: "glb", mimeType: null }]),
  };
  for (const [field, mutate] of Object.entries(TAMPER)) {
    it(`every stored job field is authenticated: an edited \`${field}\` is refused and unlocks nothing`, async () => {
      const ref = (await upload()).body.reference.referenceId;
      const job = (await submit(ref, "click-0001")).body.job.jobId;
      mutate(getSharedMemoryCreativeStore()._raw.jobs.get(job));
      const before = { ...sim.state.calls };
      expect((await poll(job)).body.code).toBe("RECORD_INTEGRITY_FAILED");
      expect((await call("GET", `resource=asset&jobId=${job}`)).body.code).toBe("RECORD_INTEGRITY_FAILED");
      const again = await submit(ref, "click-0002");
      // referenceId moved the row out from under its reference: the signature
      // cannot see that (the row is simply absent for this reference). That
      // case is closed by database write authority — verify-creative-db.mjs.
      if (field !== "referenceId") expect(again.body.code).toBe("RECORD_INTEGRITY_FAILED");
      if (field !== "referenceId") expect(sim.state.calls).toEqual(before);
      expect((await call("GET", "resource=jobs")).body.jobs.map((j) => j.jobId)).not.toContain(job);
    });
  }

  it("the signed field list covers every column the store persists", async () => {
    const { JOB_FIELDS } = await import("./creativeService.js");
    await submit((await upload()).body.reference.referenceId);
    const row = [...getSharedMemoryCreativeStore()._raw.jobs.values()][0];
    expect(Object.keys(row).filter((k) => k !== "sig").sort()).toEqual([...JOB_FIELDS].sort());
  });

  it("replaying an OLDER validly-signed state never unlocks a generation: it can only look still-running", async () => {
    const ref = (await upload()).body.reference.referenceId;
    const job = (await submit(ref, "click-0001")).body.job.jobId;
    const raw = getSharedMemoryCreativeStore()._raw.jobs;
    const older = structuredClone(raw.get(job)); // signed `processing`, version 2
    sim.state.outcome = "failure";
    expect((await poll(job)).body.job.status).toBe("failed");
    raw.set(job, older); // roll the row back
    const again = await submit(ref, "click-0002");
    expect(again.body.code).toBe("DUPLICATE_ACTIVE_JOB");
    expect(sim.state.calls.generate).toBe(1);
  });

  it("a stale writer cannot overwrite a newer row (compare-and-swap on version)", async () => {
    const store = getSharedMemoryCreativeStore();
    const job = (await submit((await upload()).body.reference.referenceId)).body.job.jobId;
    const row = store._raw.jobs.get(job);
    expect(row.version).toBe(2);
    expect(await store.updateJob(row.userId, job, 1, { status: "failed", version: 2 })).toBeNull();
    expect(store._raw.jobs.get(job).status).toBe("processing");
  });

  it("an edited reference row is refused on re-upload too, with no second provider upload", async () => {
    const ref = (await upload()).body.reference.referenceId;
    getSharedMemoryCreativeStore()._raw.references.get(ref).bytes = 1;
    const r = await upload();
    expect(r.body.code).toBe("RECORD_INTEGRITY_FAILED");
    expect(sim.state.calls.upload).toBe(1);
  });

  it("a job row altered around the API (forged provider job or asset) is refused, with no provider call", async () => {
    const job = (await submit((await upload()).body.reference.referenceId)).body.job.jobId;
    await poll(job);
    const row = getSharedMemoryCreativeStore()._raw.jobs.get(job);
    row.outputs = [{ assetId: "asset_belonging_to_someone_else", format: "glb" }];
    const before = sim.state.calls.asset;
    const r = await call("GET", `resource=asset&jobId=${job}`);
    expect(r.status).toBe(409);
    expect(r.body.code).toBe("RECORD_INTEGRITY_FAILED");
    expect(sim.state.calls.asset).toBe(before);
    expect((await poll(job)).body.code).toBe("RECORD_INTEGRITY_FAILED");
  });

  it("a reference row pointed at another provider asset is refused before the cost preview", async () => {
    const ref = (await upload()).body.reference.referenceId;
    getSharedMemoryCreativeStore()._raw.references.get(ref).providerAssetId = "asset_not_mine";
    const r = await submit(ref);
    expect(r.body.code).toBe("RECORD_INTEGRITY_FAILED");
    expect(sim.state.calls.dryRun + sim.state.calls.generate).toBe(0);
  });
});

describe("deployment and routing", () => {
  it("a deployed environment without a durable store fails closed before any provider call", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.SUPABASE_URL = "";
    const r = await call("GET", "resource=config");
    // On Vercel the test-auth bypass is unreachable and Supabase is absent.
    expect(r.status).toBe(503);
    expect(Object.values(sim.state.calls).every((n) => n === 0)).toBe(true);
  });

  it("config reports availability with names only", async () => {
    delete process.env.SCENARIO_API_SECRET;
    const r = await call("GET", "resource=config");
    expect(r.body).toMatchObject({ ok: true, provider: "scenario", configured: false, missing: ["SCENARIO_API_SECRET"], modelId: "model_sim-img23d", liveGenerationEnabled: true, maxCostPerJob: 20 });
    expect(r.body.reference).toEqual({ acceptedTypes: ["image/png", "image/jpeg", "image/webp"], maxBytes: MAX_REFERENCE_BYTES });
  });

  it("unknown resource → 404, wrong method → 405, malformed JSON → 400", async () => {
    expect((await call("GET", "resource=nope")).status).toBe(404);
    expect((await call("DELETE", "resource=jobs")).status).toBe(405);
    expect((await call("POST", "resource=jobs", { body: "{not json" })).status).toBe(400);
  });
});

describe("durable store adapter (fake PostgREST — not a database)", () => {
  function fakeRest() {
    const rows = [];
    const calls = [];
    const fetchImpl = async (url, init) => {
      const u = new URL(url);
      calls.push({ method: init.method, path: u.pathname + u.search, auth: init.headers.authorization, apikey: init.headers.apikey });
      const ok = (data) => ({ ok: true, status: 200, text: async () => JSON.stringify(data) });
      if (init.method === "POST") {
        const row = JSON.parse(init.body);
        if (rows.some((r) => r.owner_user_id === row.owner_user_id && r.idempotency_key === row.idempotency_key)) return { ok: false, status: 409, text: async () => "{}" };
        rows.push(row);
        return ok([row]);
      }
      const key = u.searchParams.get("idempotency_key")?.replace("eq.", "");
      return ok(rows.filter((r) => !key || r.idempotency_key === key));
    };
    return { fetchImpl, rows, calls };
  }
  const job = { jobId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222", idempotencyKey: "click-0001", referenceId: "33333333-3333-4333-8333-333333333333", provider: "scenario", modelId: "m", status: "submitting", outputs: [], sig: "s", createdAt: "2026-10-04T00:00:00.000Z" };

  it("reads as the caller, writes with the server credential, and maps a unique violation to a key replay", async () => {
    const f = fakeRest();
    const store = createSupabaseCreativeStore({ url: "https://x.supabase.co", anonKey: "anon", accessToken: "user-jwt", serviceRoleKey: "server-key", fetchImpl: f.fetchImpl });
    expect((await store.reserveJob(job)).created).toBe(true);
    const second = await store.reserveJob({ ...job, jobId: "44444444-4444-4444-8444-444444444444" });
    expect(second).toMatchObject({ created: false, conflict: "key", job: { jobId: job.jobId, idempotencyKey: "click-0001" } });
    expect(f.rows).toHaveLength(1);
    expect(f.rows[0]).toMatchObject({ owner_user_id: job.userId, idempotency_key: "click-0001", reference_id: job.referenceId });
    for (const c of f.calls) {
      if (c.method === "GET") expect(c).toMatchObject({ auth: "Bearer user-jwt", apikey: "anon" });
      else expect(c).toMatchObject({ auth: "Bearer server-key", apikey: "server-key" });
    }
    expect(f.calls.some((c) => c.method === "GET")).toBe(true);
  });

  it("refuses to exist without a server write credential — it never falls back to writing as the caller", () => {
    expect(() => createSupabaseCreativeStore({ url: "https://x.supabase.co", anonKey: "anon", accessToken: "user-jwt" })).toThrow(expect.objectContaining({ code: "CREATIVE_STORE_NOT_CONFIGURED" }));
  });

  it("a malformed id is answered as absent without a query", async () => {
    const f = fakeRest();
    const store = createSupabaseCreativeStore({ url: "https://x.supabase.co", anonKey: "anon", accessToken: "t", serviceRoleKey: "k", fetchImpl: f.fetchImpl });
    expect(await store.getJob(job.userId, "not-a-uuid")).toBeNull();
    expect(f.calls).toHaveLength(0);
  });
});
