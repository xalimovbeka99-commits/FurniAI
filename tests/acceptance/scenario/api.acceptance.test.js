/**
 * SIMULATED / MOCKED / LOCAL — Scenario 3D API acceptance against the PROPOSED
 * contract (docs/creative/SCENARIO_3D_API_CONTRACT.md), driven through the REAL
 * api/creative.js handler over HTTP, with the provider replaced at its HTTP
 * boundary by support/fixtureProvider.js (protocol-identical to Claude's
 * scenarioStandIn.js, plus a byte-serving CDN). No real Scenario call, no paid
 * model, no hosted DB. LIVE: NOT RUN.
 */
import { createHash, randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startFixtureProvider, loadFixture } from "./support/fixtureProvider.js";
import { applyEnv, fixtureEnv, makeClock, POLL_GAP_MS, resetStore, restoreEnv, startApi, store, PNG, PNG2, JPEG, WEBP, GIF, SVG, PDF, HTML, BMP, HEIC } from "./support/apiHarness.js";
import { createConceptClient, TERMINAL } from "./support/conceptClient.js";
import { inspectGlb } from "./support/glbInspector.js";
import { buildAllFixtures } from "../../fixtures/scenario/generate-fixtures.mjs";

let api, fx;
const clock = makeClock(vi);
beforeAll(async () => { api = await startApi(); fx = await startFixtureProvider(); });
afterAll(async () => { await api.close(); await fx.close(); });
beforeEach(() => { fx.reset(); applyEnv(fixtureEnv(fx.baseUrl)); resetStore(); clock.on(); });
afterEach(() => { clock.off(); restoreEnv(); });

const calls = () => ({ ...fx.state.calls });
const paid = () => fx.state.calls.generate;
const client = (user = "user-a") => createConceptClient({ apiUrl: api.url, authHeader: `Bearer test:${user}`, fetchAsset: (u) => fetch(fx.cdnLocalUrl(u)) });
async function ref(bytes = PNG, user = "user-a") {
  const r = await api.upload(bytes, { user });
  expect([200, 201]).toContain(r.status);
  return r.body.reference.referenceId;
}
async function succeeded(user = "user-a", key = "click-00000001", bytes = PNG) {
  const referenceId = await ref(bytes, user);
  const s = await api.submit(referenceId, key, { user });
  expect(s.status).toBe(202);
  const p = await api.job(s.body.job.jobId, { user });
  expect(p.body.job.status).toBe("succeeded");
  return { referenceId, jobId: s.body.job.jobId };
}

// ===================================================================== upload
describe("§2.2 reference upload", () => {
  it("config advertises exactly the contract's accepted types and 3 MiB limit", async () => {
    const r = await api.call("GET", "resource=config");
    expect(r.status).toBe(200);
    expect(r.body.reference).toEqual({ acceptedTypes: ["image/png", "image/jpeg", "image/webp"], maxBytes: 3145728 });
    expect(r.headers["cache-control"]).toBe("no-store");
    expect(r.text).not.toContain("fixture-secret-not-real");
  });

  it("PNG, JPEG and WebP are accepted by their bytes → 201, one provider upload each, no provider id leaked", async () => {
    for (const [bytes, type] of [[PNG, "image/png"], [JPEG, "image/jpeg"], [WEBP, "image/webp"]]) {
      const r = await api.upload(bytes, { name: "photo.bin" });
      expect(r.status, type).toBe(201);
      expect(r.body).toMatchObject({ ok: true, reused: false, reference: { contentType: type, bytes: bytes.length } });
      expect(r.body.reference.referenceId).toMatch(/^[0-9a-f-]{36}$/);
      expect(r.text).not.toContain("asset_ref_");
    }
    expect(fx.state.calls.upload).toBe(3);
  });

  it("the same bytes again → 200 reused:true, same referenceId, no second provider upload", async () => {
    const a = await api.upload(PNG);
    const b = await api.upload(PNG, { name: "renamed.png" });
    expect(b.status).toBe(200);
    expect(b.body.reused).toBe(true);
    expect(b.body.reference.referenceId).toBe(a.body.reference.referenceId);
    expect(fx.state.calls.upload).toBe(1);
  });

  it("GIF, SVG, PDF, HTML, BMP, HEIC → 415 UNSUPPORTED_FILE_TYPE, even when declared/named as PNG; zero provider calls", async () => {
    for (const [name, bytes] of Object.entries({ GIF, SVG, PDF, HTML, BMP, HEIC })) {
      const r = await api.upload(bytes, { name: `${name}.png`, contentType: "image/png" });
      expect(r.status, name).toBe(415);
      expect(r.body.code).toBe("UNSUPPORTED_FILE_TYPE");
      const r2 = await api.upload(bytes, { name: `${name}.png` });
      expect(r2.status, `${name} undeclared`).toBe(415);
    }
    expect(fx.state.calls.upload).toBe(0);
  });

  it("declared type that contradicts the bytes → 415", async () => {
    const r = await api.upload(PNG, { contentType: "image/jpeg" });
    expect(r.status).toBe(415);
    expect(r.body.details).toMatchObject({ detected: "image/png" });
  });

  it("exactly 3 MiB is accepted; 3 MiB + 1 byte → 413 FILE_TOO_LARGE with no provider call", async () => {
    const atLimit = Buffer.concat([PNG.subarray(0, 8), Buffer.alloc(3145728 - 8, 1)]);
    const over = Buffer.concat([atLimit, Buffer.from([1])]);
    const r1 = await api.upload(atLimit);
    expect(r1.status).toBe(201);
    expect(r1.body.reference.bytes).toBe(3145728);
    const r2 = await api.upload(over);
    expect(r2.status).toBe(413);
    expect(r2.body).toMatchObject({ code: "FILE_TOO_LARGE", details: { maxBytes: 3145728 } });
    expect(fx.state.calls.upload).toBe(1);
  });

  it("empty, non-base64, data: URL, missing body → 400 BAD_REQUEST", async () => {
    for (const body of [{ dataBase64: "" }, { dataBase64: "@@@@" }, { dataBase64: `data:image/png;base64,${PNG.toString("base64")}` }, {}, [], "null"]) {
      const r = await api.call("POST", "resource=references", { body });
      expect(r.status, JSON.stringify(body).slice(0, 30)).toBe(400);
    }
    expect(fx.state.calls.upload).toBe(0);
  });

  it("unauthenticated → 401 on every resource, zero provider calls", async () => {
    for (const [m, qs] of [["GET", "resource=config"], ["POST", "resource=references"], ["POST", "resource=jobs"], ["GET", "resource=jobs"], ["GET", "resource=asset&jobId=x"]]) {
      expect((await api.call(m, qs, { auth: false, body: m === "POST" ? {} : undefined })).status, qs).toBe(401);
    }
    expect(Object.values(calls()).every((n) => n === 0)).toBe(true);
  });
});

// ===================================================================== submit + lifecycle
describe("§2.3–§2.4 submit and status lifecycle", () => {
  it("submit → 202 replayed:false, status processing, one cost preview + ONE paid call, concept notice present", async () => {
    const r = await api.submit(await ref());
    expect(r.status).toBe(202);
    expect(r.body).toMatchObject({ ok: true, replayed: false, job: { status: "processing", provider: "scenario", model: "model_fixture-img23d", outputs: [], usage: { estimatedCost: 12, unit: "provider_cost_units" }, storage: { durableCopy: false } } });
    expect(r.body.job.concept).toMatchObject({ kind: "visual_concept", editable: false, dimensionsVerified: false, partsSeparable: false, manufacturable: false });
    expect(r.body.job.concept.notice).toMatch(/AI-generated visual concept/);
    for (const k of ["designId", "furniSpec", "partGraph", "dimensions", "providerJobId", "assetId"]) expect(JSON.stringify(r.body)).not.toContain(`"${k}"`);
    expect(calls()).toMatchObject({ dryRun: 1, generate: 1 });
  });

  it("bad key / missing reference / unknown reference → 400 / 400 / 404, zero paid calls", async () => {
    const id = await ref();
    for (const k of [undefined, "", "short", "has space!x", "x".repeat(129)]) expect((await api.call("POST", "resource=jobs", { body: { referenceId: id, idempotencyKey: k } })).status).toBe(400);
    expect((await api.call("POST", "resource=jobs", { body: { idempotencyKey: "click-00000001" } })).status).toBe(400);
    const unknown = await api.submit(randomUUID());
    expect(unknown).toMatchObject({ status: 404, body: { code: "MISSING_REFERENCE" } });
    expect(paid()).toBe(0);
  });

  it("walks every non-error state: submitting → processing → processing(progress) → succeeded", async () => {
    fx.state.generateMode = "hold";
    fx.state.pollsUntilDone = 2;
    const id = await ref();
    const pending = api.submit(id);
    await waitFor(() => fx.state.held.length === 1);
    const listed = (await api.list()).body.jobs;
    expect(listed).toHaveLength(1);
    expect(listed[0].status).toBe("submitting");
    const jobId = listed[0].jobId;
    expect((await api.job(jobId)).body.job.status).toBe("submitting");
    expect(fx.state.calls.job).toBe(0); // nothing to ask the provider yet
    fx.state.generateMode = "ok";
    fx.releaseHeld("ok");
    const s = await pending;
    expect(s.status).toBe(202);
    expect(s.body.job.status).toBe("processing");
    const p1 = await api.job(jobId);
    expect(p1.body).toMatchObject({ job: { status: "processing", providerStatus: "sim-running", providerProgress: 0.5, outputs: [] }, refresh: { ok: true } });
    clock.advance(POLL_GAP_MS);
    const p2 = await api.job(jobId);
    expect(p2.body.job).toMatchObject({ status: "succeeded", outputs: [{ index: 0, format: "glb", mimeType: null }], error: null });
    expect(p2.body.job.completedAt).toBeTruthy();
  });

  it("failed: provider failure → status failed with PROVIDER_GENERATION_FAILED; terminal, no further provider calls", async () => {
    fx.state.outcome = "failure";
    const jobId = (await api.submit(await ref())).body.job.jobId;
    const p = await api.job(jobId);
    expect(p.body.job).toMatchObject({ status: "failed", error: { code: "PROVIDER_GENERATION_FAILED", message: "simulated generation failure" } });
    const before = calls();
    for (let i = 0; i < 5; i++) { clock.advance(POLL_GAP_MS); expect((await api.job(jobId)).body.job.status).toBe("failed"); }
    expect(calls()).toEqual(before);
  });

  it("'done' with no asset → failed PROVIDER_UNEXPECTED_RESPONSE (never succeeded with 0 outputs)", async () => {
    fx.state.outcome = "success-no-assets";
    const jobId = (await api.submit(await ref())).body.job.jobId;
    expect((await api.job(jobId)).body.job).toMatchObject({ status: "failed", outputs: [], error: { code: "PROVIDER_UNEXPECTED_RESPONSE" } });
  });

  it("status-check outage → refresh.ok:false, job unchanged (keep polling)", async () => {
    const jobId = (await api.submit(await ref())).body.job.jobId;
    fx.state.jobMode = "http500";
    const p = await api.job(jobId);
    expect(p.status).toBe(200);
    expect(p.body).toMatchObject({ job: { status: "processing" }, refresh: { ok: false, code: "PROVIDER_UNAVAILABLE" } });
  });

  it("polling is throttled server-side: 8 sequential polls inside 2 s → 1 provider status call", async () => {
    fx.state.pollsUntilDone = 99;
    const jobId = (await api.submit(await ref())).body.job.jobId;
    for (let i = 0; i < 8; i++) await api.job(jobId);
    expect(fx.state.calls.job).toBe(1);
    clock.advance(POLL_GAP_MS);
    await api.job(jobId);
    expect(fx.state.calls.job).toBe(2);
  });

  // D6: the throttle is check-then-act (creativeService.js:170-178 reads
  // lastPolledAt, calls the provider, writes later). Claude's own test is
  // titled "a burst makes one provider status call" but asserts <= 3
  // (src/lib/creative/creative.test.js:171-179).
  it.fails("KNOWN_DEFECT D6 a CONCURRENT burst of 8 polls must still make at most 1 provider status call (§2.4 'at most once per 2 s per job')", async () => {
    fx.state.pollsUntilDone = 99;
    const jobId = (await api.submit(await ref())).body.job.jobId;
    await Promise.all(Array.from({ length: 8 }, () => api.job(jobId)));
    expect(fx.state.calls.job).toBe(1);
  });
  it("CURRENT_BEHAVIOUR D6: a concurrent burst makes more than one provider status call", async () => {
    fx.state.pollsUntilDone = 99;
    const jobId = (await api.submit(await ref())).body.job.jobId;
    await Promise.all(Array.from({ length: 8 }, () => api.job(jobId)));
    expect(fx.state.calls.job).toBeGreaterThan(1);
  });

  it("succeeded is terminal: further polls make no provider status call", async () => {
    const { jobId } = await succeeded();
    const before = fx.state.calls.job;
    for (let i = 0; i < 3; i++) { clock.advance(POLL_GAP_MS); await api.job(jobId); }
    expect(fx.state.calls.job).toBe(before);
  });
});

// ===================================================================== submission_unknown
describe("§2.4 / §3.6 submission_unknown — terminal, possibly charged, never auto-retried", () => {
  for (const mode of ["http500", "drop", "nojobid"]) {
    it(`paid call ${mode} → 502 outcomeUnknown + submission_unknown; then ZERO provider calls through replay and polling`, async () => {
      fx.state.generateMode = mode;
      const id = await ref();
      const r = await api.submit(id, "click-unknown01");
      expect(r.status).toBe(502);
      expect(r.body.details).toMatchObject({ outcomeUnknown: true, jobStatus: "submission_unknown" });
      expect(r.body.error).toMatch(/charged/i);
      const jobId = r.body.details.jobId;
      expect(paid()).toBe(1);
      fx.state.generateMode = "ok";
      const after = calls();
      const replay = await api.submit(id, "click-unknown01");
      expect(replay).toMatchObject({ status: 200, body: { replayed: true, job: { jobId, status: "submission_unknown" } } });
      for (let i = 0; i < 6; i++) {
        clock.advance(POLL_GAP_MS);
        const p = await api.job(jobId);
        expect(p.body.job.status).toBe("submission_unknown");
        // the UI-facing body carries the "may have been charged" message
        expect(p.body.job.error.message).toMatch(/not known whether a generation started or was charged/);
        expect(TERMINAL).toContain(p.body.job.status);
      }
      expect(calls()).toEqual(after); // provider call count 0 after submission_unknown
    });
  }

  it("a submission that never answered (held > 120 s) settles to submission_unknown on the next read, with no provider call", async () => {
    fx.state.generateMode = "hold";
    const id = await ref();
    const pending = api.submit(id);
    await waitFor(() => fx.state.held.length === 1);
    const jobId = (await api.list()).body.jobs[0].jobId;
    clock.advance(121_000);
    const before = calls();
    const p = await api.job(jobId);
    expect(p.body.job).toMatchObject({ status: "submission_unknown", error: { code: "PROVIDER_UNAVAILABLE" } });
    expect(calls()).toEqual(before);
    fx.releaseHeld("drop");
    await pending;
    expect(paid()).toBe(1);
  });

  it("non-billable refusals (402 credits, 429) are `failed`, not submission_unknown, and say nothing was generated", async () => {
    for (const [mode, code] of [["http402", "PROVIDER_INSUFFICIENT_CREDITS"], ["http429", "PROVIDER_RATE_LIMITED"]]) {
      resetStore();
      fx.state.generateMode = mode;
      const r = await api.submit(await ref(), `click-${mode}00`);
      expect(r.body).toMatchObject({ code, details: { outcomeUnknown: false, jobStatus: "failed" } });
    }
  });
});

// ===================================================================== duplicate clicks
describe("§2.3 / §3 duplicate clicks", () => {
  it("same key again → 200 replayed:true, same job, ZERO extra provider calls (not even a cost preview)", async () => {
    const id = await ref();
    const a = await api.submit(id, "click-dup00001");
    const before = calls();
    const b = await api.submit(id, "click-dup00001");
    expect(b).toMatchObject({ status: 200, body: { replayed: true, job: { jobId: a.body.job.jobId } } });
    expect(calls()).toEqual(before);
  });

  it("10 concurrent identical clicks (same key) → exactly 1 paid call, 1×202 and 9×200 replayed, one jobId", async () => {
    const id = await ref();
    const all = await Promise.all(Array.from({ length: 10 }, () => api.submit(id, "click-burst001")));
    expect(paid()).toBe(1);
    expect(all.filter((r) => r.status === 202)).toHaveLength(1);
    expect(all.filter((r) => r.status === 200 && r.body.replayed === true)).toHaveLength(9);
    expect(new Set(all.map((r) => r.body.job.jobId)).size).toBe(1);
  });

  it("10 concurrent clicks each with its own key (per-click keys, double/triple clicks) → 1 paid call, 9×409 DUPLICATE_ACTIVE_JOB naming the winner", async () => {
    const id = await ref();
    const all = await Promise.all(Array.from({ length: 10 }, (_, i) => api.submit(id, `click-multi-${i}0`)));
    expect(paid()).toBe(1);
    const winner = all.find((r) => r.status === 202);
    const losers = all.filter((r) => r.status === 409);
    expect(losers).toHaveLength(9);
    for (const l of losers) expect(l.body).toMatchObject({ code: "DUPLICATE_ACTIVE_JOB", details: { jobId: winner.body.job.jobId } });
  });

  it("another key while a job is active → 409 DUPLICATE_ACTIVE_JOB, nothing submitted", async () => {
    fx.state.pollsUntilDone = 99;
    const id = await ref();
    const a = await api.submit(id, "click-active01");
    const b = await api.submit(id, "click-active02");
    expect(b).toMatchObject({ status: 409, body: { code: "DUPLICATE_ACTIVE_JOB", details: { jobId: a.body.job.jobId } } });
    expect(paid()).toBe(1);
  });

  it("same key with a different body (different reference) → 409 IDEMPOTENCY_KEY_REUSED, zero extra calls", async () => {
    const r1 = await ref(PNG), r2 = await ref(PNG2);
    await api.submit(r1, "click-reuse001");
    const before = calls();
    const again = await api.submit(r2, "click-reuse001");
    expect(again).toMatchObject({ status: 409, body: { code: "IDEMPOTENCY_KEY_REUSED" } });
    expect(calls()).toEqual(before);
  });

  it("after a terminal result a NEW key may generate again (a deliberate second purchase); the old key still replays", async () => {
    const { referenceId, jobId } = await succeeded();
    expect((await api.submit(referenceId, "click-00000002")).status).toBe(202);
    expect(paid()).toBe(2);
    expect((await api.submit(referenceId, "click-00000001")).body).toMatchObject({ replayed: true, job: { jobId } });
    expect(paid()).toBe(2);
  });
});

// ===================================================================== assets
describe("§2.5 asset link — readiness, expiry, integrity, freshness", () => {
  it("409 ASSET_NOT_READY in submitting, processing, failed and submission_unknown", async () => {
    // processing
    fx.state.pollsUntilDone = 99;
    const p = (await api.submit(await ref(PNG), "click-nr-proc1")).body.job.jobId;
    expect((await api.asset(p)).body).toMatchObject({ code: "ASSET_NOT_READY", details: { jobStatus: "processing" } });
    // failed
    fx.reset({ outcome: "failure" });
    const f = (await api.submit(await ref(PNG2), "click-nr-fail1")).body.job.jobId;
    await api.job(f);
    expect((await api.asset(f)).body).toMatchObject({ code: "ASSET_NOT_READY", details: { jobStatus: "failed" } });
    // submission_unknown
    fx.reset({ generateMode: "http500" });
    const u = (await api.submit(await ref(JPEG), "click-nr-unkn1")).body.details.jobId;
    expect((await api.asset(u)).body).toMatchObject({ code: "ASSET_NOT_READY", details: { jobStatus: "submission_unknown" } });
    // submitting
    fx.reset({ generateMode: "hold" });
    const pending = api.submit(await ref(WEBP), "click-nr-subm1");
    await waitFor(() => fx.state.held.length === 1);
    const s = (await api.list()).body.jobs.find((j) => j.status === "submitting").jobId;
    const r = await api.asset(s);
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ code: "ASSET_NOT_READY", details: { jobStatus: "submitting" } });
    fx.releaseHeld("drop");
    await pending;
  });

  it("410 ASSET_UNAVAILABLE when the provider no longer has it (404), stating there is no durable copy", async () => {
    const { jobId } = await succeeded();
    fx.state.assetMode = "gone404";
    const r = await api.asset(jobId);
    expect(r).toMatchObject({ status: 410, body: { code: "ASSET_UNAVAILABLE", details: { durableCopy: false } } });
  });

  it.fails("KNOWN_DEFECT D4 provider answering 410 Gone for the asset must map to 410 ASSET_UNAVAILABLE", async () => {
    const { jobId } = await succeeded();
    fx.state.assetMode = "gone410";
    expect((await api.asset(jobId)).status).toBe(410);
  });
  it("CURRENT_BEHAVIOUR D4: provider 410 Gone → 502 PROVIDER_REJECTED_REQUEST", async () => {
    const { jobId } = await succeeded();
    fx.state.assetMode = "gone410";
    expect((await api.asset(jobId)).body).toMatchObject({ code: "PROVIDER_REJECTED_REQUEST" });
  });

  it("409 RECORD_INTEGRITY_FAILED for a tampered row, with no provider call", async () => {
    const { jobId } = await succeeded();
    store()._raw.jobs.get(jobId).outputs[0].assetId = "asset_out_other";
    const before = fx.state.calls.asset;
    expect((await api.asset(jobId)).body.code).toBe("RECORD_INTEGRITY_FAILED");
    expect(fx.state.calls.asset).toBe(before);
  });

  it("a fresh address on EVERY call: 2 calls → 2 provider lookups, 2 different signed URLs, nothing stored, no-store", async () => {
    const { jobId } = await succeeded();
    const before = fx.state.calls.asset;
    const a = await api.asset(jobId);
    const b = await api.asset(jobId);
    expect(fx.state.calls.asset - before).toBe(2);
    expect(a.body.asset.url).not.toBe(b.body.asset.url);
    expect(a.body.asset).toMatchObject({ jobId, index: 0, format: "glb", expiresAt: null, expiryKnown: false, durableCopy: false });
    expect(a.body.asset.concept.kind).toBe("visual_concept");
    expect(a.headers["cache-control"]).toBe("no-store");
    expect(JSON.stringify([...store()._raw.jobs.values()])).not.toMatch(/https:|cdn\.fixture/);
  });

  it("the server never retries a failed provider lookup itself: 5xx → 502, exactly one provider call", async () => {
    const { jobId } = await succeeded();
    fx.state.assetMode = "http500";
    const before = fx.state.calls.asset;
    expect((await api.asset(jobId)).body.code).toBe("PROVIDER_UNAVAILABLE");
    expect(fx.state.calls.asset - before).toBe(1);
  });

  it("contract client: a URL that fails to load is re-resolved EXACTLY once, and the second URL works", async () => {
    const { jobId } = await succeeded();
    fx.state.cdnFailNext = 1;
    const c = client();
    const r = await c.loadAssetBytes(jobId);
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(2);
    expect(c.stats).toMatchObject({ resolve: 2, assetFetch: 2 });
  });

  it("contract client: if the re-resolved URL also fails it stops after exactly 2 resolves (no retry storm)", async () => {
    const { jobId } = await succeeded();
    fx.state.cdnFailNext = 50;
    const c = client();
    const before = fx.state.calls.asset;
    const r = await c.loadAssetBytes(jobId);
    expect(r).toMatchObject({ ok: false, code: "ASSET_LOAD_FAILED", status: 403, attempts: 2 });
    expect(fx.state.calls.asset - before).toBe(2);
    expect(fx.state.calls.cdn).toBe(2);
  });

  it("an address resolved earlier and kept (i.e. cached) fails once expired; resolving fresh works", async () => {
    const { jobId } = await succeeded();
    const old = (await api.asset(jobId)).body.asset.url;
    fx.revokeIssued(); // the CDN expires everything issued so far
    expect((await fetch(fx.cdnLocalUrl(old))).status).toBe(403);
    const r = await client().loadAssetBytes(jobId);
    expect(r).toMatchObject({ ok: true, attempts: 1 });
  });

  it("410 is an answer, not a load failure: the client does not re-call", async () => {
    const { jobId } = await succeeded();
    fx.state.assetMode = "gone404";
    const c = client();
    expect(await c.loadAssetBytes(jobId)).toMatchObject({ ok: false, code: "ASSET_UNAVAILABLE", status: 410, attempts: 1 });
    expect(c.stats.resolve).toBe(1);
  });
});

// ===================================================================== download + file inspection
describe("download leg — the FILE is checked, not the click", () => {
  it("fixtures are deterministic: regenerating gives byte-identical files", () => {
    for (const [name, buf] of Object.entries(buildAllFixtures())) expect(loadFixture(name).equals(buf), name).toBe(true);
  });

  it("good GLB: model/gltf-binary, format glb, inspector passes (1 mesh, 24 positions, unit bbox, PNG texture), bytes intact", async () => {
    const { jobId } = await succeeded();
    const r = await client().loadAssetBytes(jobId);
    expect(r.ok).toBe(true);
    expect(r.contentType).toBe("model/gltf-binary");
    expect(r.asset.format).toBe("glb");
    const sha = createHash("sha256").update(r.bytes).digest("hex");
    expect(sha).toBe(createHash("sha256").update(loadFixture("textured-cube.glb")).digest("hex"));
    const ins = inspectGlb(r.bytes);
    expect(ins.errors).toEqual([]);
    expect(ins.info).toMatchObject({ version: 2, meshCount: 1, positionCount: 24, bbox: { min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] }, images: [{ detected: "image/png" }] });
  });

  const BAD = {
    truncated: ["LENGTH_MISMATCH"],
    "bad-magic": ["BAD_MAGIC"],
    "no-mesh": ["NO_MESH"],
    "missing-texture": ["NO_IMAGE", "TEXTURE_SOURCE_MISSING"],
    "corrupt-texture": ["IMAGE_BAD_MAGIC"],
    html: ["LOOKS_LIKE_HTML", "BAD_MAGIC"],
  };
  for (const [variant, expected] of Object.entries(BAD)) {
    it(`bad variant '${variant}': the API still says format "glb" (from the URL), the inspector rejects it (${expected.join(", ")})`, async () => {
      const { jobId } = await succeeded();
      fx.state.cdnVariant = variant;
      const r = await client().loadAssetBytes(jobId);
      expect(r.ok).toBe(true); // the HTTP leg "worked"…
      expect(r.asset.format).toBe("glb"); // …and the API cannot tell (see ambiguity A4)
      if (variant === "html") expect(r.contentType).toMatch(/^text\/html/);
      const ins = inspectGlb(r.bytes);
      expect(ins.ok).toBe(false);
      expect(ins.errors).toEqual(expected);
    });
  }
});

// ===================================================================== owner isolation
describe("owner isolation — another user's job, asset and reference answer exactly like nonexistent ones", () => {
  it("user B: job 404, asset 404, list empty, A's reference 404 — byte-identical to nonexistent", async () => {
    const { referenceId, jobId } = await succeeded("user-a");
    const ghost = randomUUID();
    const pairs = [
      [await api.job(jobId, { user: "user-b" }), await api.job(ghost, { user: "user-b" })],
      [await api.asset(jobId, 0, { user: "user-b" }), await api.asset(ghost, 0, { user: "user-b" })],
      [await api.submit(referenceId, "click-bbbbbbb1", { user: "user-b" }), await api.submit(ghost, "click-bbbbbbb2", { user: "user-b" })],
    ];
    for (const [theirs, none] of pairs) {
      expect(theirs.status).toBe(404);
      expect(theirs.text).toBe(none.text);
    }
    expect((await api.list({ user: "user-b" })).body.jobs).toEqual([]);
    expect(fx.state.calls.generate).toBe(1);
  });

  it("keys are per user: B reusing A's key on B's own reference gets B's own new job; A's job is untouched", async () => {
    const a = await succeeded("user-a", "click-shared01");
    const bRef = await ref(PNG, "user-b");
    const b = await api.submit(bRef, "click-shared01", { user: "user-b" });
    expect(b.status).toBe(202);
    expect(b.body.job.jobId).not.toBe(a.jobId);
    expect((await api.job(a.jobId)).body.job.status).toBe("succeeded");
  });

  it("B replaying A's key with A's reference gets 404 MISSING_REFERENCE, never A's job", async () => {
    const a = await succeeded("user-a", "click-shared02");
    const r = await api.submit(a.referenceId, "click-shared02", { user: "user-b" });
    expect(r.status).toBe(404);
    expect(r.text).not.toContain(a.jobId);
  });
});

async function waitFor(pred, ms = 3000) {
  const t0 = performance.now();
  while (!pred()) {
    if (performance.now() - t0 > ms) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, 10));
  }
}
