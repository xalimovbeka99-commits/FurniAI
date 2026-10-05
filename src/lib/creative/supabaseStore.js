/**
 * Durable creative store over PostgREST (tables in
 * supabase/migrations/2026-10-04_creative_generation.sql — NOT APPLIED anywhere).
 *
 * WRITE AUTHORITY. These rows decide whether a paid generation may be
 * submitted, so the customer must not be able to write them. Unlike wardrobe
 * designs (which the owner legitimately authors and which are re-validated on
 * every read), a job row has no content the owner is entitled to change.
 *
 *   READS   run with the CALLER'S access token: row-level security returns
 *           only the caller's own rows.
 *   WRITES  run with the service-role key. The migration grants the
 *           `authenticated` and `anon` roles SELECT only and defines no
 *           INSERT/UPDATE/DELETE policy, so a caller's own token cannot
 *           create, edit, roll back or delete a row through PostgREST.
 *
 * The service-role key bypasses RLS, so every write below names the owner
 * explicitly, and this module touches no table but the two creative ones.
 * The key is read from the server environment and never returned or logged.
 */
import { CreativeError, CREATIVE_ERROR } from "./errors.js";

const REFS = "creative_references";
const JOBS = "creative_jobs";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const refToRow = (r) => ({ id: r.referenceId, owner_user_id: r.userId, name: r.name, content_type: r.contentType, bytes: r.bytes, sha256: r.sha256, width: r.width, height: r.height, validation: r.validation, provider: r.provider, provider_asset_id: r.providerAssetId, sig: r.sig, created_at: r.createdAt });
const rowToRef = (r) => r && ({ referenceId: r.id, userId: r.owner_user_id, name: r.name, contentType: r.content_type, bytes: r.bytes, sha256: r.sha256, width: r.width, height: r.height, validation: r.validation, provider: r.provider, providerAssetId: r.provider_asset_id, sig: r.sig, createdAt: r.created_at });

const JOB_COLUMNS = {
  jobId: "id", userId: "owner_user_id", idempotencyKey: "idempotency_key", referenceId: "reference_id", provider: "provider", modelId: "model_id",
  version: "version", status: "status", providerJobId: "provider_job_id", providerStatus: "provider_status", providerProgress: "provider_progress", outputs: "outputs",
  estimatedCost: "estimated_cost", reportedCost: "reported_cost", error: "error", sig: "sig",
  createdAt: "created_at", submittedAt: "submitted_at", completedAt: "completed_at", updatedAt: "updated_at", lastPolledAt: "last_polled_at",
};
const jobToRow = (j) => Object.fromEntries(Object.entries(j).filter(([k]) => JOB_COLUMNS[k]).map(([k, v]) => [JOB_COLUMNS[k], v]));
const rowToJob = (r) => r && Object.fromEntries(Object.entries(JOB_COLUMNS).map(([k, c]) => [k, r[c] ?? (k === "outputs" ? [] : null)]));

export function createSupabaseCreativeStore({ url, anonKey, accessToken, serviceRoleKey, fetchImpl = globalThis.fetch }) {
  if (!serviceRoleKey) throw new CreativeError(CREATIVE_ERROR.CREATIVE_STORE_NOT_CONFIGURED, "3D concept generation has nowhere durable to record jobs on this deployment.");
  const base = `${String(url).replace(/\/$/, "")}/rest/v1`;
  async function rest(method, path, { body, prefer } = {}) {
    const write = method !== "GET";
    let res;
    try {
      res = await fetchImpl(`${base}/${path}`, {
        method,
        headers: { apikey: write ? serviceRoleKey : anonKey, authorization: `Bearer ${write ? serviceRoleKey : accessToken}`, "content-type": "application/json", ...(prefer ? { prefer } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new CreativeError(CREATIVE_ERROR.STORAGE_UNAVAILABLE, "Generation records could not be reached. Please try again shortly.");
    }
    if (res.status === 409) return { conflict: true, rows: [] };
    if (!res.ok) throw new CreativeError(CREATIVE_ERROR.STORAGE_UNAVAILABLE, "Generation records could not be read or written. Please try again shortly.");
    const text = await res.text();
    return { conflict: false, rows: text ? JSON.parse(text) : [] };
  }
  const q = encodeURIComponent;
  const one = async (table, filter) => (await rest("GET", `${table}?${filter}&limit=1`)).rows[0] ?? null;

  const store = {
    kind: "supabase",
    async insertReference(ref) {
      const { rows } = await rest("POST", REFS, { body: refToRow(ref), prefer: "return=representation" });
      return rowToRef(rows[0]);
    },
    async getReference(userId, referenceId) {
      if (!UUID_RE.test(referenceId)) return null;
      return rowToRef(await one(REFS, `id=eq.${q(referenceId)}&owner_user_id=eq.${q(userId)}`));
    },
    async findReferenceBySha(userId, sha256) {
      return rowToRef(await one(REFS, `sha256=eq.${q(sha256)}&owner_user_id=eq.${q(userId)}`));
    },
    async reserveJob(job) {
      const r = await rest("POST", JOBS, { body: jobToRow(job), prefer: "return=representation" });
      if (!r.conflict) return { created: true, job: rowToJob(r.rows[0]) };
      // A unique index refused the insert. Which one decides the answer.
      const byKey = await store.findJobByKey(job.userId, job.idempotencyKey);
      if (byKey) return { created: false, conflict: "key", job: byKey };
      const active = rowToJob(await one(JOBS, `owner_user_id=eq.${q(job.userId)}&reference_id=eq.${q(job.referenceId)}&status=in.(submitting,processing)`));
      if (active) return { created: false, conflict: "active", job: active };
      throw new CreativeError(CREATIVE_ERROR.STORAGE_UNAVAILABLE, "The generation request could not be recorded. Nothing was submitted.");
    },
    async findJobByKey(userId, idempotencyKey) {
      return rowToJob(await one(JOBS, `owner_user_id=eq.${q(userId)}&idempotency_key=eq.${q(idempotencyKey)}`));
    },
    async getJob(userId, jobId) {
      if (!UUID_RE.test(jobId)) return null;
      return rowToJob(await one(JOBS, `id=eq.${q(jobId)}&owner_user_id=eq.${q(userId)}`));
    },
    async listJobs(userId) {
      return (await rest("GET", `${JOBS}?owner_user_id=eq.${q(userId)}&order=created_at.desc&limit=50`)).rows.map(rowToJob);
    },
    async listJobsForReference(userId, referenceId) {
      if (!UUID_RE.test(referenceId)) return [];
      return (await rest("GET", `${JOBS}?owner_user_id=eq.${q(userId)}&reference_id=eq.${q(referenceId)}&order=created_at.desc`)).rows.map(rowToJob);
    },
    /** Compare-and-swap on `version`; null when another writer got there first. */
    async updateJob(userId, jobId, expectedVersion, patch) {
      const r = await rest("PATCH", `${JOBS}?id=eq.${q(jobId)}&owner_user_id=eq.${q(userId)}&version=eq.${q(expectedVersion)}`, { body: jobToRow(patch), prefer: "return=representation" });
      return rowToJob(r.rows[0]) ?? null;
    },
  };
  return store;
}
