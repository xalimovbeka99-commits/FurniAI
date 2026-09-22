/**
 * In-memory durable store for pilot tests and local runs without Supabase.
 * Revisions are append-only; updates/deletes of revision rows are not supported.
 */

import { randomUUID } from "node:crypto";

export function createMemoryStore() {
  /** @type {Map<string, object>} */
  const designs = new Map();
  /** @type {Map<string, object[]>} designId -> revisions ascending */
  const revisions = new Map();

  return {
    kind: "memory",

    async createDesign({ ownerUserId, name, designId }) {
      const id = designId || randomUUID();
      const now = new Date().toISOString();
      const row = {
        designId: id,
        ownerUserId,
        name: name || "Untitled wardrobe",
        createdAt: now,
        updatedAt: now,
      };
      designs.set(id, row);
      revisions.set(id, []);
      return { ...row };
    },

    async getDesign(designId) {
      const row = designs.get(designId);
      return row ? { ...row } : null;
    },

    async listDesigns(ownerUserId) {
      return [...designs.values()]
        .filter((d) => d.ownerUserId === ownerUserId)
        .map((d) => ({ ...d }))
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    },

    async listRevisions(designId) {
      const list = revisions.get(designId) || [];
      return list.map((r) => ({ ...r, furniSpec: structuredClone(r.furniSpec), partGraph: structuredClone(r.partGraph), origins: structuredClone(r.origins) }));
    },

    async getRevision(designId, revision) {
      const list = revisions.get(designId) || [];
      const row = list.find((r) => r.revision === revision);
      if (!row) return null;
      return {
        ...row,
        furniSpec: structuredClone(row.furniSpec),
        partGraph: structuredClone(row.partGraph),
        origins: row.origins ? structuredClone(row.origins) : null,
      };
    },

    async getLatestRevision(designId) {
      const list = revisions.get(designId) || [];
      if (list.length === 0) return null;
      return this.getRevision(designId, list[list.length - 1].revision);
    },

    /**
     * Append an immutable revision. Caller enforces conflict checks.
     */
    async appendRevision(row) {
      const list = revisions.get(row.designId);
      if (!list) throw new Error("design missing in store");
      list.push({
        ...row,
        furniSpec: structuredClone(row.furniSpec),
        partGraph: structuredClone(row.partGraph),
        origins: row.origins ? structuredClone(row.origins) : null,
        createdAt: row.createdAt || new Date().toISOString(),
      });
      const design = designs.get(row.designId);
      if (design) {
        design.updatedAt = new Date().toISOString();
      }
      return this.getRevision(row.designId, row.revision);
    },
  };
}

/** Process-wide default for tests when no store is injected. */
let shared;
export function getSharedMemoryStore() {
  if (!shared) shared = createMemoryStore();
  return shared;
}

export function resetSharedMemoryStore() {
  shared = createMemoryStore();
  return shared;
}
