/**
 * MOCKED (fake Supabase auth + PostgREST, see support/fakeSupabase.js) / LOCAL.
 *
 * The same tampering defects as tampering.test.js, but reached the way a real
 * signed-in customer could reach them once the migration is applied: with
 * their OWN access token and the public anon key, straight through PostgREST,
 * which the migration's RLS allows (owners may INSERT and UPDATE their own
 * creative_jobs rows — supabase/migrations/2026-10-04_creative_generation.sql:70-75).
 * The API side is the real handler on its durable-store path
 * (http.js:19-24 → supabaseStore.js). Not a database; not evidence about Postgres.
 */
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startScenarioStandIn } from "../../../src/lib/creative/scenarioStandIn.js";
import { startFakeSupabase } from "./support/fakeSupabase.js";
import { applyEnv, fixtureEnv, PNG, PNG2, restoreEnv, startApi } from "./support/apiHarness.js";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const tok = (u) => `fixture-token:${u}`;

let api, sim, sb;
beforeAll(async () => { api = await startApi(); });
afterAll(() => api.close());
beforeEach(async () => {
  sim = await startScenarioStandIn();
  sb = await startFakeSupabase();
  const env = fixtureEnv(sim.baseUrl, {
    SUPABASE_URL: sb.origin,
    SUPABASE_ANON_KEY: "fixture-anon-not-real",
    CREATIVE_RECORD_SIGNING_KEY: "test-hmac-secret-not-real-padded-to-32-chars",
  });
  delete env.FURNIAI_PERSISTENCE_TEST_AUTH;
  applyEnv(env);
});
afterEach(async () => { await sim.close(); await sb.close(); restoreEnv(); });

const as = (u) => ({ auth: false, headers: { authorization: `Bearer ${tok(u)}` } });
const INTEGRITY = { status: 409, code: "RECORD_INTEGRITY_FAILED" };
const answer = (r) => ({ status: r.status, code: r.body?.code });

async function processing(u, key, bytes = PNG) {
  const up = await api.upload(bytes, as(u));
  expect(up.status).toBe(201);
  const ref = up.body.reference.referenceId;
  const s = await api.submit(ref, key, as(u));
  expect(s.status).toBe(202);
  return { ref, jobId: s.body.job.jobId };
}

describe("durable-store path sanity (MOCKED PostgREST)", () => {
  it("GUARD the API really uses the fake PostgREST with the caller's token, and RLS blocks cross-user writes", async () => {
    const { jobId } = await processing(A, "click-00000001");
    expect(sb.tables.creative_jobs).toHaveLength(1);
    expect(sb.calls.some((c) => c.path.startsWith("/rest/v1/creative_jobs") && c.uid === A)).toBe(true);
    const crossUser = await sb.rest(tok(B), "PATCH", `creative_jobs?id=eq.${jobId}`, { status: "failed" });
    expect(crossUser.body).toEqual([]); // RLS: B sees and updates nothing
    expect(sb.tables.creative_jobs[0].status).toBe("processing");
    const userBread = await api.job(jobId, as(B));
    expect(userBread.status).toBe(404);
  });
});

describe("D1c end-to-end: the owner PATCHes status through PostgREST", () => {
  async function attack() {
    const { ref, jobId } = await processing(A, "click-00000001");
    const patch = await sb.rest(tok(A), "PATCH", `creative_jobs?id=eq.${jobId}`, { status: "failed" });
    expect(patch.status).toBe(200); // the migration's RLS allows it
    return { patch, second: await api.submit(ref, "click-00000002", as(A)) };
  }
  it.fails("KNOWN_DEFECT D1c-e2e a status the owner wrote via PostgREST must not unlock a second paid generation", async () => {
    const { second } = await attack();
    expect(second.status).toBe(409);
    expect(sim.state.calls.generate).toBe(1);
  });
  it("CURRENT_BEHAVIOUR D1c-e2e: 202 and a second paid call (two active Scenario jobs for one reference)", async () => {
    const { second } = await attack();
    expect(second.status).toBe(202);
    expect(sim.state.calls.generate).toBe(2);
  });
});

describe("D2 end-to-end: forge a row via PostgREST, have the API re-sign it, read another user's asset", () => {
  async function attack() {
    const victim = await processing(B, "click-victim01", PNG2);
    await api.job(victim.jobId, as(B));
    const victimAsset = sb.tables.creative_jobs.find((r) => r.id === victim.jobId).outputs[0].assetId;
    const ref = (await api.upload(PNG, as(A))).body.reference.referenceId;
    const forgedId = randomUUID();
    const ins = await sb.rest(tok(A), "POST", "creative_jobs", {
      id: forgedId, owner_user_id: A, idempotency_key: "forged-key-0001", reference_id: ref, provider: "scenario", model_id: "model_fixture-img23d",
      status: "submitting", outputs: [{ assetId: victimAsset, format: "glb", mimeType: null }], sig: "junk",
      created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
    });
    expect(ins.status).toBe(201); // the migration's insert policy allows it
    const before = answer(await api.job(forgedId, as(A)));
    const submit = await api.submit(ref, "click-launder01", as(A));
    const after = answer(await api.job(forgedId, as(A)));
    const flip = await sb.rest(tok(A), "PATCH", `creative_jobs?id=eq.${forgedId}`, { status: "succeeded" });
    expect(flip.status).toBe(200);
    const asset = await api.asset(forgedId, 0, as(A));
    return { victimAsset, before, submit, after, asset };
  }
  it.fails("KNOWN_DEFECT D2-e2e a forged row must never become valid, and user A must never get user B's asset", async () => {
    const r = await attack();
    expect(r.before).toEqual(INTEGRITY);
    expect(r.after).toEqual(INTEGRITY);
    expect(r.asset.text).not.toContain(r.victimAsset);
  });
  it("CURRENT_BEHAVIOUR D2-e2e: 409 → (one submit later) 200 → asset route hands user A the URL of user B's asset", async () => {
    const r = await attack();
    expect(r.before).toEqual(INTEGRITY);
    expect(r.submit.status).toBe(202);
    expect(r.after.status).toBe(200);
    expect(r.asset.status).toBe(200);
    expect(r.asset.body.asset.url).toContain(r.victimAsset);
  });
});

describe("D5 reference insert conflicts are ignored on the durable path (supabaseStore.js:52-55)", () => {
  async function doubleUpload() {
    const [a, b] = await Promise.all([api.upload(PNG, as(A)), api.upload(PNG, as(A))]);
    const ids = [a, b].map((r) => r.body.reference.referenceId);
    const submits = [];
    for (const [i, id] of ids.entries()) submits.push(await api.submit(id, `click-dbl-up-${i}0`, as(A)));
    return { a, b, ids, submits };
  }
  it.fails("KNOWN_DEFECT D5 two identical uploads at once (double-click) must both yield a usable referenceId", async () => {
    const r = await doubleUpload();
    expect(sb.tables.creative_references).toHaveLength(1);
    for (const s of r.submits) expect(s.status).not.toBe(404);
  });
  it("CURRENT_BEHAVIOUR D5: both answer 201 with different ids, one id was never stored → 404 MISSING_REFERENCE; 2 provider uploads", async () => {
    const r = await doubleUpload();
    expect([r.a.status, r.b.status]).toEqual([201, 201]);
    expect(new Set(r.ids).size).toBe(2);
    expect(sb.tables.creative_references).toHaveLength(1);
    expect(r.submits.map((s) => s.status).sort()).toEqual([202, 404]);
    expect(sim.state.calls.upload).toBe(2);
  });
});
