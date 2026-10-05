/**
 * In-memory creative store — local runs and tests ONLY. A module-level Map is
 * per-instance on Vercel, so http.js refuses to use it when deployed.
 */
export const ACTIVE_STATUSES = Object.freeze(["submitting", "processing"]);

export function createMemoryCreativeStore() {
  const references = new Map();
  const jobs = new Map();
  const clone = (v) => (v ? structuredClone(v) : null);
  return {
    kind: "memory",
    async insertReference(ref) { references.set(ref.referenceId, clone(ref)); return clone(ref); },
    async getReference(userId, referenceId) {
      const r = references.get(referenceId);
      return r && r.userId === userId ? clone(r) : null;
    },
    async findReferenceBySha(userId, sha256) {
      for (const r of references.values()) if (r.userId === userId && r.sha256 === sha256) return clone(r);
      return null;
    },
    /** Atomic: one job per (user, idempotencyKey); one ACTIVE job per (user, reference). */
    async reserveJob(job) {
      for (const j of jobs.values()) {
        if (j.userId !== job.userId) continue;
        if (j.idempotencyKey === job.idempotencyKey) return { created: false, conflict: "key", job: clone(j) };
      }
      for (const j of jobs.values()) {
        if (j.userId === job.userId && j.referenceId === job.referenceId && ACTIVE_STATUSES.includes(j.status)) {
          return { created: false, conflict: "active", job: clone(j) };
        }
      }
      jobs.set(job.jobId, clone(job));
      return { created: true, job: clone(job) };
    },
    async findJobByKey(userId, idempotencyKey) {
      for (const j of jobs.values()) if (j.userId === userId && j.idempotencyKey === idempotencyKey) return clone(j);
      return null;
    },
    async getJob(userId, jobId) {
      const j = jobs.get(jobId);
      return j && j.userId === userId ? clone(j) : null;
    },
    async listJobs(userId) {
      return [...jobs.values()].filter((j) => j.userId === userId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map(clone);
    },
    async listJobsForReference(userId, referenceId) {
      return [...jobs.values()].filter((j) => j.userId === userId && j.referenceId === referenceId).map(clone);
    },
    /** Compare-and-swap: applies only if the stored version is `expectedVersion`. */
    async updateJob(userId, jobId, expectedVersion, patch) {
      const j = jobs.get(jobId);
      if (!j || j.userId !== userId || j.version !== expectedVersion) return null;
      Object.assign(j, clone(patch));
      return clone(j);
    },
    /** test helper */
    _raw: { references, jobs },
  };
}

let shared = null;
export function getSharedMemoryCreativeStore() {
  if (!shared) shared = createMemoryCreativeStore();
  return shared;
}
