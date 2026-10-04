/**
 * SIMULATED / LOCAL — job-row tampering against contract §3.7:
 *   "Rows are HMAC-signed by the server; a row edited around the API is
 *    refused, so a caller cannot point a job at someone else's Scenario asset."
 *
 * Everything runs through the REAL api/creative.js handler and service, with
 * Claude's own stand-in (src/lib/creative/scenarioStandIn.js) as the provider,
 * except the poll race (needs per-call delays → tests/…/fixtureProvider.js).
 *
 * Editing `store()._raw.jobs` stands for what the migration lets every signed-in
 * owner do straight through PostgREST with their own token:
 *   supabase/migrations/2026-10-04_creative_generation.sql:70-75
 *   ("Owners can insert / update their creative jobs"). tamperingSupabase.test.js
 * repeats the decisive cases end-to-end through that PostgREST surface.
 *
 * Naming:
 *   KNOWN_DEFECT …        it.fails — asserts the CONTRACT. Passes today because
 *                         the assertion throws; flips to a failure when fixed
 *                         (then change it.fails → it).
 *   CURRENT_BEHAVIOUR …   it — pins today's wrong answer so a KNOWN_DEFECT cannot
 *                         "pass" for an unrelated reason. Delete when fixed.
 *   GUARD …               it — protection that already holds. Must stay green.
 */
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startScenarioStandIn } from "../../../src/lib/creative/scenarioStandIn.js";
import { startFixtureProvider } from "./support/fixtureProvider.js";
import { applyEnv, fixtureEnv, PNG, PNG2, resetStore, restoreEnv, startApi, store } from "./support/apiHarness.js";

let api;
let sim;
beforeAll(async () => { api = await startApi(); });
afterAll(() => api.close());
beforeEach(async () => {
  sim = await startScenarioStandIn();
  applyEnv(fixtureEnv(sim.baseUrl));
  resetStore();
});
afterEach(async () => { await sim.close(); restoreEnv(); });

const raw = (jobId) => store()._raw.jobs.get(jobId);
async function processingJob(user = "user-a", key = "click-00000001", bytes = PNG) {
  const ref = (await api.upload(bytes, { user })).body.reference.referenceId;
  const s = await api.submit(ref, key, { user });
  expect(s.status).toBe(202);
  return { ref, jobId: s.body.job.jobId };
}
async function succeededJob(user = "user-a", key = "click-00000001", bytes = PNG) {
  const j = await processingJob(user, key, bytes);
  const p = await api.job(j.jobId, { user });
  expect(p.body.job.status).toBe("succeeded");
  return j;
}
const INTEGRITY = { status: 409, code: "RECORD_INTEGRITY_FAILED" };
const answer = (r) => ({ status: r.status, code: r.body?.code });

// =========================================================================
describe("GUARD — fields the HMAC covers are refused (creativeService.js:55)", () => {
  it("GUARD outputs[].assetId pointed at another asset → 409 on asset AND status, no provider asset call", async () => {
    const { jobId } = await succeededJob();
    raw(jobId).outputs = [{ assetId: "asset_out_someone_else", format: "glb", mimeType: null }];
    const before = sim.state.calls.asset;
    expect(answer(await api.asset(jobId))).toEqual(INTEGRITY);
    expect(answer(await api.job(jobId))).toEqual(INTEGRITY);
    expect(sim.state.calls.asset).toBe(before);
  });

  it("GUARD providerJobId pointed at another provider job → 409, no provider status call", async () => {
    const { jobId } = await processingJob();
    raw(jobId).providerJobId = "job_sim_belonging_to_b";
    const before = sim.state.calls.job;
    expect(answer(await api.job(jobId))).toEqual(INTEGRITY);
    expect(sim.state.calls.job).toBe(before);
  });

  it("GUARD owner/userId reassigned: the new 'owner' gets 409, the real owner gets 404", async () => {
    const { jobId } = await succeededJob("user-a");
    raw(jobId).userId = "user-b";
    expect(answer(await api.job(jobId, { user: "user-b" }))).toEqual(INTEGRITY);
    expect(answer(await api.asset(jobId, 0, { user: "user-b" }))).toEqual(INTEGRITY);
    expect((await api.job(jobId, { user: "user-a" })).status).toBe(404);
  });

  it("GUARD referenceId / modelId / jobId edited → 409", async () => {
    for (const edit of [(r) => { r.referenceId = randomUUID(); }, (r) => { r.modelId = "model_other"; }, (r) => { r.jobId = randomUUID(); }]) {
      resetStore();
      const { jobId } = await succeededJob();
      edit(raw(jobId));
      expect(answer(await api.job(jobId))).toEqual(INTEGRITY);
      expect(answer(await api.asset(jobId))).toEqual(INTEGRITY);
    }
  });

  it("GUARD another user's signed row replayed: re-owned → 409; verbatim → 404 identical to nonexistent", async () => {
    const b = await succeededJob("user-b", "click-bbbbbbbb", PNG2);
    const copyKey = randomUUID();
    store()._raw.jobs.set(copyKey, { ...structuredClone(raw(b.jobId)), userId: "user-a" });
    expect(answer(await api.job(copyKey, { user: "user-a" }))).toEqual(INTEGRITY);
    expect(answer(await api.asset(copyKey, 0, { user: "user-a" }))).toEqual(INTEGRITY);
    const verbatimKey = randomUUID();
    store()._raw.jobs.set(verbatimKey, structuredClone(raw(b.jobId)));
    const theirs = await api.job(verbatimKey, { user: "user-a" });
    const none = await api.job(randomUUID(), { user: "user-a" });
    expect(theirs.status).toBe(404);
    expect(theirs.text).toBe(none.text);
  });

  it("GUARD signature stripped / blanked / truncated / random / borrowed → 409 on status, asset and replay", async () => {
    const other = await succeededJob("user-a", "click-other001", PNG2);
    const sigs = [undefined, "", null, "0", "a".repeat(63), "f".repeat(64), raw(other.jobId).sig];
    for (const sig of sigs) {
      const { jobId, ref } = await succeededJob("user-a", `click-${Math.random().toString(36).slice(2, 12)}`, Buffer.concat([PNG, Buffer.from(String(Math.random()))]));
      const key = raw(jobId).idempotencyKey;
      if (sig === undefined) delete raw(jobId).sig; else raw(jobId).sig = sig;
      expect(answer(await api.job(jobId)), `sig=${String(sig).slice(0, 8)}`).toEqual(INTEGRITY);
      expect(answer(await api.asset(jobId))).toEqual(INTEGRITY);
      expect(answer(await api.submit(ref, key))).toEqual(INTEGRITY);
    }
  });

  it("GUARD rows swapped between two jobs (providerJobId + outputs + sig moved across) → both refused", async () => {
    const a = await succeededJob("user-a", "click-swap0001", PNG);
    const b = await succeededJob("user-a", "click-swap0002", PNG2);
    const ra = raw(a.jobId), rb = raw(b.jobId);
    const pick = (r) => ({ providerJobId: r.providerJobId, outputs: r.outputs, sig: r.sig });
    const [pa, pb] = [pick(ra), pick(rb)];
    Object.assign(ra, pb);
    Object.assign(rb, pa);
    expect(answer(await api.asset(a.jobId))).toEqual(INTEGRITY);
    expect(answer(await api.asset(b.jobId))).toEqual(INTEGRITY);
  });

  it("GUARD a tampered row is hidden from the list (silently — see ambiguity A6)", async () => {
    const { jobId } = await succeededJob();
    raw(jobId).sig = "x";
    expect((await api.list()).body.jobs).toEqual([]);
  });
});

// =========================================================================
describe("GUARD — client-supplied status / ids in the request are ignored", () => {
  it("GUARD POST jobs with status/jobId/providerJobId/outputs/userId in the body: server values win", async () => {
    const ref = (await api.upload(PNG)).body.reference.referenceId;
    const forgedId = randomUUID();
    const r = await api.submit(ref, "click-body0001", { extraBody: { jobId: forgedId, status: "succeeded", providerJobId: "job_sim_x", outputs: [{ assetId: "asset_x" }], userId: "user-b", sig: "x" } });
    expect(r.status).toBe(202);
    expect(r.body.job.jobId).not.toBe(forgedId);
    expect(r.body.job.status).toBe("processing");
    const row = raw(r.body.job.jobId);
    expect(row).toMatchObject({ userId: "user-a", providerJobId: "job_sim_1", outputs: [] });
    expect((await api.asset(r.body.job.jobId)).body.code).toBe("ASSET_NOT_READY");
  });

  it("GUARD GET with &status= / &userId= / &assetId= / &url= in the query: ignored", async () => {
    const { jobId } = await processingJob();
    sim.state.pollsUntilDone = 99;
    const s = await api.job(jobId, { extraQs: "&status=succeeded&userId=user-b" });
    expect(s.body.job.status).toBe("processing");
    const a = await api.call("GET", `resource=asset&jobId=${jobId}&index=0&assetId=asset_x&url=https://evil.invalid/x.glb&status=succeeded`);
    expect(a.body.code).toBe("ASSET_NOT_READY");
  });

  it("GUARD POST references with referenceId/userId/providerAssetId in the body: ignored", async () => {
    const forged = randomUUID();
    const r = await api.call("POST", "resource=references", { body: { name: "a.png", dataBase64: PNG.toString("base64"), referenceId: forged, userId: "user-b", providerAssetId: "asset_x", sha256: "0".repeat(64) } });
    expect(r.status).toBe(201);
    expect(r.body.reference.referenceId).not.toBe(forged);
    const row = store()._raw.references.get(r.body.reference.referenceId);
    expect(row).toMatchObject({ userId: "user-a", providerAssetId: "asset_ref_1" });
  });
});

// =========================================================================
// D1 — `status` (and every other field the routes act on except the ids) is
// outside the HMAC: creativeService.js:55
//   jobSig = mac(["job", jobId, userId, referenceId, modelId, providerJobId, outputs.map(o => o.assetId)])
// The status route (getJob, :165-183), the asset route (getAssetLink, :191-212)
// and the billing guard (reserveJob over status, memoryStore.js:29 /
// migration :61-63; settleStale over createdAt, :74-82) all trust unsigned fields.
// =========================================================================
describe("D1 job status is not signed — status forgery is accepted", () => {
  it.fails("KNOWN_DEFECT D1a status edited processing→succeeded must be refused (409 RECORD_INTEGRITY_FAILED)", async () => {
    const { jobId } = await processingJob();
    raw(jobId).status = "succeeded";
    expect(answer(await api.job(jobId))).toEqual(INTEGRITY);
  });
  it("CURRENT_BEHAVIOUR D1a: 200 status 'succeeded' with 0 outputs (contract §2.4: succeeded ⇒ ≥1 output)", async () => {
    const { jobId } = await processingJob();
    raw(jobId).status = "succeeded";
    const r = await api.job(jobId);
    expect(r.status).toBe(200);
    expect(r.body.job).toMatchObject({ status: "succeeded", outputs: [] });
  });

  it.fails("KNOWN_DEFECT D1b status downgraded succeeded→processing must be refused with no provider call", async () => {
    const { jobId } = await succeededJob();
    Object.assign(raw(jobId), { status: "processing", lastPolledAt: null }); // both unsigned
    const before = sim.state.calls.job;
    expect(answer(await api.job(jobId))).toEqual(INTEGRITY);
    expect(sim.state.calls.job).toBe(before);
  });
  it("CURRENT_BEHAVIOUR D1b: 200, and the server re-polls the provider for a finished job", async () => {
    const { jobId } = await succeededJob();
    Object.assign(raw(jobId), { status: "processing", lastPolledAt: null }); // both unsigned
    const before = sim.state.calls.job;
    const r = await api.job(jobId);
    expect(r.status).toBe(200);
    expect(sim.state.calls.job).toBe(before + 1);
  });

  it.fails("KNOWN_DEFECT D1c BILLING: active job edited processing→failed must NOT unlock a second paid generation", async () => {
    const { ref, jobId } = await processingJob();
    raw(jobId).status = "failed";
    const second = await api.submit(ref, "click-00000002");
    expect(second.status).toBe(409);
    expect(["DUPLICATE_ACTIVE_JOB", "RECORD_INTEGRITY_FAILED"]).toContain(second.body.code);
    expect(sim.state.calls.generate).toBe(1);
  });
  it("CURRENT_BEHAVIOUR D1c: 202, a second PAID call while the first is still running at the provider", async () => {
    const { ref, jobId } = await processingJob();
    raw(jobId).status = "failed";
    const second = await api.submit(ref, "click-00000002");
    expect(second.status).toBe(202);
    expect(sim.state.calls.generate).toBe(2);
    // and the user can put the first one back: two active paid jobs for one reference,
    // both still carrying valid signatures
    raw(jobId).status = "processing";
    sim.state.pollsUntilDone = 99;
    expect((await api.job(jobId)).body.job.status).toBe("processing");
    expect((await api.job(second.body.job.jobId)).body.job.status).toBe("processing");
    const active = [...store()._raw.jobs.values()].filter((j) => ["submitting", "processing"].includes(j.status));
    expect(active).toHaveLength(2);
  });

  it.fails("KNOWN_DEFECT D1d submitting row with createdAt pushed into the past must NOT release the active slot (second paid call)", async () => {
    const held = [];
    sim.state.onGenerate = (_req, res) => { held.push(res); return true; };
    const ref = (await api.upload(PNG)).body.reference.referenceId;
    const first = api.submit(ref, "click-00000001");
    try {
      await waitFor(() => sim.state.calls.generate === 1);
      const row = [...store()._raw.jobs.values()][0];
      expect(row.status).toBe("submitting");
      row.createdAt = "2026-01-01T00:00:00.000Z";
      sim.state.onGenerate = null;
      const second = await api.submit(ref, "click-00000002");
      expect(second.status).toBe(409);
      expect(sim.state.calls.generate).toBe(1);
    } finally {
      for (const res of held) res.socket?.destroy();
      await first.catch(() => {});
    }
  });
  it("CURRENT_BEHAVIOUR D1d: the in-flight job is relabelled submission_unknown and a second paid call is made", async () => {
    const held = [];
    sim.state.onGenerate = (_req, res) => { held.push(res); return true; };
    const ref = (await api.upload(PNG)).body.reference.referenceId;
    const first = api.submit(ref, "click-00000001");
    try {
      await waitFor(() => sim.state.calls.generate === 1);
      const row = [...store()._raw.jobs.values()][0];
      row.createdAt = "2026-01-01T00:00:00.000Z";
      sim.state.onGenerate = null;
      const second = await api.submit(ref, "click-00000002");
      expect(second.status).toBe(202);
      expect(sim.state.calls.generate).toBe(2);
      expect(row.jobId && raw(row.jobId).status).toBe("submission_unknown");
    } finally {
      for (const res of held) res.socket?.destroy();
      await first.catch(() => {});
    }
  });

  it.fails("KNOWN_DEFECT D1e submission_unknown edited→failed must be refused (the 'may have been charged' warning must not be erasable)", async () => {
    sim.state.onGenerate = (_req, res) => { res.writeHead(503); res.end("{}"); return true; };
    const ref = (await api.upload(PNG)).body.reference.referenceId;
    const r = await api.submit(ref);
    const jobId = r.body.details.jobId;
    expect(raw(jobId).status).toBe("submission_unknown");
    raw(jobId).status = "failed";
    raw(jobId).error = { code: "PROVIDER_GENERATION_FAILED", message: "Nothing was charged." };
    expect(answer(await api.job(jobId))).toEqual(INTEGRITY);
  });
  it("CURRENT_BEHAVIOUR D1e: 200 status 'failed' with the forged 'Nothing was charged.' message", async () => {
    sim.state.onGenerate = (_req, res) => { res.writeHead(503); res.end("{}"); return true; };
    const ref = (await api.upload(PNG)).body.reference.referenceId;
    const jobId = (await api.submit(ref)).body.details.jobId;
    raw(jobId).status = "failed";
    raw(jobId).error = { code: "PROVIDER_GENERATION_FAILED", message: "Nothing was charged." };
    const r = await api.job(jobId);
    expect(r.status).toBe(200);
    expect(r.body.job).toMatchObject({ status: "failed", error: { message: "Nothing was charged." } });
  });

  it.fails("KNOWN_DEFECT D1f idempotencyKey edited: the original key must still never cause a second paid call", async () => {
    const { ref, jobId } = await succeededJob("user-a", "click-00000001");
    raw(jobId).idempotencyKey = "click-renamed01";
    const again = await api.submit(ref, "click-00000001");
    expect(again.status === 200 || again.body?.code === "RECORD_INTEGRITY_FAILED").toBe(true);
    expect(sim.state.calls.generate).toBe(1);
  });
  it("CURRENT_BEHAVIOUR D1f: the same click key now answers 202 and a second paid call is made (§3.1 one job per key)", async () => {
    const { ref, jobId } = await succeededJob("user-a", "click-00000001");
    raw(jobId).idempotencyKey = "click-renamed01";
    const again = await api.submit(ref, "click-00000001");
    expect(again.status).toBe(202);
    expect(sim.state.calls.generate).toBe(2);
  });

  // Every other stored field the routes return or act on, also unsigned.
  // §3.7 says "a row edited around the API is refused" — any edit.
  const COVERAGE = [
    ["status", (r) => { r.status = "failed"; }],
    ["idempotencyKey", (r) => { r.idempotencyKey = "click-zzzzzzzz"; }],
    ["error", (r) => { r.error = { code: "X", message: "Call +000 000 to claim a refund" }; }],
    ["outputs[0].format", (r) => { r.outputs[0].format = "fbx"; }],
    ["outputs[0].mimeType", (r) => { r.outputs[0].mimeType = "text/html"; }],
    ["estimatedCost", (r) => { r.estimatedCost = 0; }],
    ["reportedCost", (r) => { r.reportedCost = 0; }],
    ["providerStatus", (r) => { r.providerStatus = "forged"; }],
    ["providerProgress", (r) => { r.providerProgress = 99; }],
    ["createdAt", (r) => { r.createdAt = "2020-01-01T00:00:00.000Z"; }],
    ["submittedAt", (r) => { r.submittedAt = "2020-01-01T00:00:00.000Z"; }],
    ["completedAt", (r) => { r.completedAt = null; }],
    ["lastPolledAt", (r) => { r.lastPolledAt = "2099-01-01T00:00:00.000Z"; }],
  ];
  for (const [field, edit] of COVERAGE) {
    it.fails(`KNOWN_DEFECT D1-coverage ${field} edited on a succeeded job must be refused (409)`, async () => {
      const { jobId } = await succeededJob();
      edit(raw(jobId));
      expect(answer(await api.job(jobId))).toEqual(INTEGRITY);
    });
  }
  it("CURRENT_BEHAVIOUR D1-coverage: every one of those edits is served back with 200", async () => {
    for (const [field, edit] of COVERAGE) {
      resetStore();
      const { jobId } = await succeededJob();
      edit(raw(jobId));
      expect((await api.job(jobId)).status, field).toBe(200);
    }
  });
});

// =========================================================================
// D2 — signature LAUNDERING. On the submit path an ACTIVE-conflict row is
// passed to settleStale() without a signature check (creativeService.js:135-138),
// and settleStale → update() re-signs it with the server key (:74-82 → :61-66).
// A forged row therefore comes out validly signed — including a foreign
// outputs[].assetId — and D1 (status unsigned) lets the owner flip it to
// 'succeeded'. Result: the asset route resolves someone else's provider asset,
// exactly what §3.7 promises cannot happen.
// =========================================================================
describe("D2 a forged row is re-signed by the server (signature laundering via settleStale)", () => {
  async function launder() {
    const victim = await succeededJob("user-b", "click-victim01", PNG2);
    const victimAsset = raw(victim.jobId).outputs[0].assetId; // stands for an id the attacker learned elsewhere
    const ref = (await api.upload(PNG, { user: "user-a" })).body.reference.referenceId;
    const forgedId = randomUUID();
    store()._raw.jobs.set(forgedId, {
      jobId: forgedId, userId: "user-a", idempotencyKey: "forged-key-0001", referenceId: ref, provider: "scenario", modelId: "model_fixture-img23d",
      status: "submitting", providerJobId: null, providerStatus: null, providerProgress: null,
      outputs: [{ assetId: victimAsset, format: "glb", mimeType: null }],
      estimatedCost: 0, reportedCost: null, error: null,
      createdAt: "2026-01-01T00:00:00.000Z", submittedAt: null, completedAt: null, updatedAt: "2026-01-01T00:00:00.000Z", lastPolledAt: null,
      sig: "forged-not-a-real-signature",
    });
    const refusedBefore = answer(await api.job(forgedId, { user: "user-a" }));
    const submit = await api.submit(ref, "click-launder01", { user: "user-a" });
    const afterSubmit = answer(await api.job(forgedId, { user: "user-a" }));
    raw(forgedId).status = "succeeded"; // D1: unsigned
    const asset = await api.asset(forgedId, 0, { user: "user-a" });
    return { victimAsset, refusedBefore, submit, afterSubmit, asset };
  }

  it.fails("KNOWN_DEFECT D2 a forged row must stay refused after the submit path touches it; a foreign asset must never resolve", async () => {
    const r = await launder();
    expect(r.refusedBefore).toEqual(INTEGRITY);
    expect(r.afterSubmit).toEqual(INTEGRITY);
    expect(answer(r.asset)).toEqual(INTEGRITY);
    expect(r.asset.text).not.toContain(r.victimAsset);
  });
  it("CURRENT_BEHAVIOUR D2: refused before (409) → validly signed after one submit (200) → asset route returns user B's asset URL to user A", async () => {
    const r = await launder();
    expect(r.refusedBefore).toEqual(INTEGRITY);
    expect(r.submit.status).toBe(202); // and a paid call was made on top
    expect(r.afterSubmit).toEqual({ status: 200, code: undefined });
    expect(r.asset.status).toBe(200);
    expect(r.asset.body.asset.url).toContain(r.victimAsset);
  });
});

// =========================================================================
// D3 — status-poll write-back with a stale signature. update() signs
// {...rowAsReadBeforeTheProviderCall, ...patch} but the store applies only the
// patch to the CURRENT row (creativeService.js:61-66; memoryStore.js:47-52;
// supabaseStore.js:83-86 — unconditional PATCH, no version/updated_at check).
// Two overlapping polls: the fast one writes 'succeeded' + outputs; the slow
// one then writes progress fields with a signature computed over outputs:[].
// The row is now permanently RECORD_INTEGRITY_FAILED — a paid result is lost.
// =========================================================================
describe("D3 overlapping status polls brick a succeeded job (stale signature written back)", () => {
  let fx;
  beforeEach(async () => {
    fx = await startFixtureProvider({ pollsUntilDone: 2, jobDelaysMs: [400, 0] });
    applyEnv(fixtureEnv(fx.baseUrl));
  });
  afterEach(() => fx.close());

  async function race() {
    const ref = (await api.upload(PNG)).body.reference.referenceId;
    const jobId = (await api.submit(ref)).body.job.jobId;
    const slow = api.job(jobId); // reaches the provider first → "running", answered after 400 ms
    await waitFor(() => fx.state.calls.job === 1);
    const fast = await api.job(jobId); // reaches it second → "done" at once
    await slow;
    return { jobId, fast, after: await api.job(jobId), asset: await api.asset(jobId) };
  }

  it.fails("KNOWN_DEFECT D3 after two overlapping polls the succeeded job must still be readable and downloadable", async () => {
    const r = await race();
    expect(r.fast.body.job.status).toBe("succeeded");
    expect(r.after.status).toBe(200);
    expect(r.after.body.job.status).toBe("succeeded");
    expect(r.asset.status).toBe(200);
  });
  it("CURRENT_BEHAVIOUR D3: the fast poll says succeeded, then every read answers 409 RECORD_INTEGRITY_FAILED", async () => {
    const r = await race();
    expect(r.fast.body.job.status).toBe("succeeded");
    expect(answer(r.after)).toEqual(INTEGRITY);
    expect(answer(r.asset)).toEqual(INTEGRITY);
    expect(fx.state.calls.generate).toBe(1); // it was paid for
  });
  it("GUARD overlapping polls that BOTH see 'done' leave a consistent, readable row", async () => {
    fx.reset({ pollsUntilDone: 1, jobDelaysMs: [400, 0] });
    const ref = (await api.upload(PNG)).body.reference.referenceId;
    const jobId = (await api.submit(ref)).body.job.jobId;
    const slow = api.job(jobId);
    await waitFor(() => fx.state.calls.job === 1);
    await api.job(jobId);
    await slow;
    const after = await api.job(jobId);
    expect(after.status).toBe(200);
    expect(after.body.job.status).toBe("succeeded");
  });
});

async function waitFor(pred, ms = 3000) {
  const t0 = Date.now();
  while (!pred()) {
    if (Date.now() - t0 > ms) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, 10));
  }
}
