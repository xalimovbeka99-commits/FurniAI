/**
 * TEST / DEMO ONLY — a stand-in for Antigravity's `createDesignsApiClient()`.
 *
 * It is not an HTTP client and is never bundled into the Studio (entry.js does
 * not import it). It implements exactly the three methods My Designs consumes
 * — listDesigns / getDesign / getRevision — and answers with the response
 * bodies of docs/m3/DESIGN_PERSISTENCE_API.md §4, whose key sets are pinned
 * against the real handlers by tests/contract/designs-api/. Failures are
 * thrown as DesignsApiError-like objects carrying `status` and `code`.
 *
 * Seed values (design ids, revisions) stand in for SERVER-ASSIGNED values;
 * the module under test receives them only through these responses.
 */

export class FakeDesignsApiError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, code?: string, details?: object }} [opts]
   */
  constructor(message, opts = {}) {
    super(message);
    this.name = "DesignsApiError";
    this.status = opts.status ?? 0;
    this.code = opts.code ?? null;
    if (opts.details) this.details = opts.details;
  }
}

/** Server error bodies, mirrored from src/lib/persistence/errors.js + auth.js. */
export const fakeErrors = Object.freeze({
  missingAuth: () => new FakeDesignsApiError("Sign in is required to save or open a design.", { status: 401, code: "MISSING_AUTH" }),
  notFound: () => new FakeDesignsApiError("That design was not found.", { status: 404, code: "MISSING_DESIGN" }),
  revisionNotFound: () => new FakeDesignsApiError("That revision was not found for this design.", { status: 404, code: "MISSING_DESIGN" }),
  integrity: (revision = 1) =>
    new FakeDesignsApiError("This saved revision failed its integrity check and was not opened. Nothing was changed.", {
      status: 409, code: "REVISION_INTEGRITY_FAILED", details: { revision, reason: "FINGERPRINT_MISMATCH" },
    }),
  storageUnavailable: () => new FakeDesignsApiError("The design store could not be reached.", { status: 503, code: "STORAGE_UNAVAILABLE" }),
  notConfigured: () =>
    new FakeDesignsApiError("Design saving is not configured on this deployment. Nothing was saved.", { status: 503, code: "PERSISTENCE_NOT_CONFIGURED" }),
  internal: () => new FakeDesignsApiError("Could not complete the design persistence request.", { status: 500, code: "INTERNAL" }),
  /** No HTTP answer at all. Real clients may surface this as status 0 / NETWORK_ERROR or a raw TypeError. */
  network: () => new FakeDesignsApiError("Failed to fetch", { status: 0, code: "NETWORK_ERROR" }),
});

/**
 * @typedef {{ designId: string, ownerUserId?: string, name: string, createdAt: string, updatedAt: string }} FakeDesign
 * @typedef {{ revision: number, fingerprint: string, specId?: string|null, validationStatus?: string, createdAt: string, furniSpec?: object, partGraph?: object, origins?: object|null }} FakeRevision
 */

/**
 * @param {{
 *   designs?: FakeDesign[],
 *   revisions?: Record<string, FakeRevision[]>,
 *   fail?: { listDesigns?: Error|(() => Error), getDesign?: Error|((id: string) => Error|null), getRevision?: Error|((id: string, rev: number) => Error|null) },
 *   gate?: (method: string, args: unknown[]) => (Promise<void>|void),
 *   delayMs?: number,
 * }} [seed]
 */
export function createFakeDesignsApiClient(seed = {}) {
  const designs = (seed.designs || []).map((d) => ({ ownerUserId: "fake-owner", ...d }));
  const revisions = seed.revisions || {};
  const fail = seed.fail || {};
  /** @type {Array<{ method: string, args: unknown[] }>} */
  const calls = [];

  async function enter(method, args) {
    calls.push({ method, args });
    if (typeof seed.gate === "function") await seed.gate(method, args);
    else if (seed.delayMs) await new Promise((r) => setTimeout(r, seed.delayMs));
    const f = fail[method];
    const e = typeof f === "function" ? f(...args) : f;
    if (e) throw e;
  }

  return {
    calls,

    async listDesigns(options) {
      await enter("listDesigns", [options]);
      const rows = designs
        .map((d) => ({ designId: d.designId, ownerUserId: d.ownerUserId, name: d.name, createdAt: d.createdAt, updatedAt: d.updatedAt }))
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      return { ok: true, designs: rows };
    },

    async getDesign(designId, options) {
      await enter("getDesign", [designId, options]);
      const d = designs.find((x) => x.designId === designId);
      if (!d) throw fakeErrors.notFound();
      const list = revisions[designId] || [];
      const latest = list.length ? list[list.length - 1] : null;
      return {
        ok: true,
        design: { designId: d.designId, ownerUserId: d.ownerUserId, name: d.name, createdAt: d.createdAt, updatedAt: d.updatedAt },
        latestRevision: latest
          ? {
              revision: latest.revision,
              fingerprint: latest.fingerprint,
              specId: latest.specId ?? null,
              validationStatus: latest.validationStatus ?? "ACCEPTED",
              createdAt: latest.createdAt,
            }
          : null,
      };
    },

    async getRevision(designId, revision, options) {
      await enter("getRevision", [designId, revision, options]);
      if (!designs.some((x) => x.designId === designId)) throw fakeErrors.notFound();
      const row = (revisions[designId] || []).find((r) => r.revision === revision);
      if (!row) throw fakeErrors.revisionNotFound();
      return {
        ok: true,
        designId,
        revision: row.revision,
        fingerprint: row.fingerprint,
        furniSpec: row.furniSpec ?? { specId: row.specId ?? null },
        partGraph: row.partGraph ?? { parts: [] },
        origins: row.origins ?? null,
        validationStatus: row.validationStatus ?? "ACCEPTED",
        createdAt: row.createdAt,
      };
    },
  };
}

/** A small seed used by the demo page and several tests. */
export function demoSeed() {
  return {
    designs: [
      { designId: "3f7d2c1e-9a4b-4c7e-8f10-2b6a9d0e1c11", name: "Bedroom wardrobe", createdAt: "2026-09-20T08:00:00.000Z", updatedAt: "2026-09-28T17:30:00.000Z" },
      { designId: "8a2e6b90-1c3d-4e5f-9a7b-6c5d4e3f2a22", name: "Hallway closet", createdAt: "2026-09-18T10:00:00.000Z", updatedAt: "2026-09-25T09:15:00.000Z" },
      { designId: "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e33", name: "<img src=x onerror=alert(1)> Kids' room", createdAt: "2026-09-10T12:00:00.000Z", updatedAt: "2026-09-12T12:00:00.000Z" },
      { designId: "d4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f44", name: "Empty shell (never saved)", createdAt: "2026-09-05T12:00:00.000Z", updatedAt: "2026-09-05T12:00:00.000Z" },
    ],
    revisions: {
      "3f7d2c1e-9a4b-4c7e-8f10-2b6a9d0e1c11": [
        { revision: 1, fingerprint: "fs256:aaa1", specId: "furnispec-ai-wardrobe-1001", createdAt: "2026-09-20T08:05:00.000Z" },
        { revision: 2, fingerprint: "fs256:aaa2", specId: "furnispec-ai-wardrobe-1001", createdAt: "2026-09-28T17:30:00.000Z" },
      ],
      "8a2e6b90-1c3d-4e5f-9a7b-6c5d4e3f2a22": [
        { revision: 1, fingerprint: "fs256:bbb1", specId: "furnispec-ai-wardrobe-2002", createdAt: "2026-09-25T09:15:00.000Z" },
      ],
      "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e33": [
        { revision: 3, fingerprint: "fs256:ccc3", specId: "furnispec-ai-wardrobe-3003", createdAt: "2026-09-12T12:00:00.000Z" },
      ],
    },
  };
}
