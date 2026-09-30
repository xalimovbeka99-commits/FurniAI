/**
 * Contract: the three GET endpoints My Designs reads, and the refusals it
 * classifies, answered by the REAL api/designs/* handlers in-process.
 *
 * Store:  the process-wide in-memory store (getSharedMemoryStore), reset per
 *         test — the store http.js selects for local runs without Supabase.
 * Auth:   the local test bypass `Bearer test:<userId>`, which the repo allows
 *         only with FURNIAI_PERSISTENCE_TEST_AUTH=yes AND NODE_ENV!=production
 *         AND no VERCEL_ENV (src/lib/persistence/auth.js). No real token, no
 *         real DB, no network, no secrets.
 * Evidence class: LOCAL in-process handlers + memory store (not a real DB).
 *
 * Pattern follows src/lib/persistence/truthfulErrors.test.js.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import designsIndex from "../../../api/designs/index.js";
import designById from "../../../api/designs/[designId].js";
import designRevisions from "../../../api/designs/[designId]/revisions.js";
import designRevision from "../../../api/designs/[designId]/revisions/[revision].js";
import { resetSharedMemoryStore, getSharedMemoryStore } from "../../../src/lib/persistence/memoryStore.js";
import fixture from "../../../src/lib/furnispec/goldenWardrobe.fixture.json";
import { buildStructuralPartGraph } from "../../../src/lib/partgraph/buildStructuralPartGraph.js";
import { fingerprintFurniSpec } from "../../../src/lib/conversation/approval.js";
import {
  LIST_BODY_KEYS,
  DESIGN_LIST_ITEM_KEYS,
  GET_DESIGN_BODY_KEYS,
  DESIGN_SUMMARY_KEYS,
  LATEST_REVISION_KEYS,
  REVISION_BODY_KEYS,
  ERROR_BODY_KEYS,
  ERROR_BODY_KEYS_WITH_DETAILS,
} from "./shapes.js";
import {
  parseDesignList,
  parseDesignForOpen,
  parseRevisionForOpen,
  classifyError,
  ERROR_KIND,
} from "../../../src/lib/designs/myDesigns/state.js";

const ENV = { ...process.env };
const OWNER = "contract-owner-a";
const INTRUDER = "contract-intruder-b";
const UNKNOWN_ID = "5d1f2c3b-0000-4000-8000-000000000000";

beforeEach(() => {
  process.env = { ...ENV, FURNIAI_PERSISTENCE_TEST_AUTH: "yes", NODE_ENV: "test", SUPABASE_URL: "", SUPABASE_ANON_KEY: "" };
  delete process.env.VERCEL_ENV;
  resetSharedMemoryStore();
});
afterEach(() => {
  process.env = { ...ENV };
});

function req({ method = "GET", auth, query = {}, body } = {}) {
  const payload = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
  return {
    method,
    headers: auth ? { authorization: auth } : {},
    query,
    async *[Symbol.asyncIterator]() {
      yield* payload;
    },
  };
}
function res() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(k, v) { this.headers[k] = v; },
    end(b) { this.body = b; },
    get json() { return JSON.parse(this.body); },
  };
}
const as = (userId) => `Bearer test:${userId}`;
const keys = (o) => Object.keys(o).sort();

async function call(handler, opts) {
  const r = res();
  await handler(req(opts), r);
  return r;
}

function revisionBody(revision, expectedPreviousRevision) {
  const furniSpec = { ...structuredClone(fixture), specId: fixture.specId || "contract-spec-1", revision };
  return {
    revision,
    expectedPreviousRevision,
    fingerprint: fingerprintFurniSpec(furniSpec),
    furniSpec,
    partGraph: buildStructuralPartGraph(furniSpec),
    origins: { "envelope.widthMm": "CUSTOMER_STATED" },
    validationStatus: "ACCEPTED",
  };
}

async function createDesign(userId, name) {
  const r = await call(designsIndex, { method: "POST", auth: as(userId), body: { name } });
  expect(r.statusCode).toBe(201);
  return r.json;
}
async function saveRevision(userId, designId, revision, expectedPreviousRevision) {
  return call(designRevisions, {
    method: "POST",
    auth: as(userId),
    query: { designId },
    body: revisionBody(revision, expectedPreviousRevision),
  });
}
function expectErrorBody(r, status, code) {
  expect(r.statusCode).toBe(status);
  const b = r.json;
  expect(b.ok).toBe(false);
  expect(b.code).toBe(code);
  expect(typeof b.error).toBe("string");
  expect([ERROR_BODY_KEYS, ERROR_BODY_KEYS_WITH_DETAILS]).toContainEqual(keys(b));
  expect(r.headers["content-type"]).toMatch(/application\/json/);
  return b;
}

describe("GET /api/designs — list", () => {
  it("401 MISSING_AUTH without Authorization (and with a non-Bearer or empty one)", async () => {
    expectErrorBody(await call(designsIndex, {}), 401, "MISSING_AUTH");
    expectErrorBody(await call(designsIndex, { auth: "Basic abc" }), 401, "MISSING_AUTH");
    expectErrorBody(await call(designsIndex, { auth: "Bearer " }), 401, "MISSING_AUTH");
  });

  it("200 { ok, designs: [] } for a caller with no designs", async () => {
    const r = await call(designsIndex, { auth: as(OWNER) });
    expect(r.statusCode).toBe(200);
    expect(r.json).toEqual({ ok: true, designs: [] });
    expect(r.headers["cache-control"]).toBe("no-store");
  });

  it("200 list: exact item keys, server-assigned ids, only the caller's own, updatedAt descending", async () => {
    const a = await createDesign(OWNER, "First");
    await new Promise((r) => setTimeout(r, 5));
    const b = await createDesign(OWNER, "Second");
    await createDesign(INTRUDER, "Not yours");
    const r = await call(designsIndex, { auth: as(OWNER) });
    expect(r.statusCode).toBe(200);
    expect(keys(r.json)).toEqual(LIST_BODY_KEYS);
    expect(r.json.designs.length).toBe(2);
    for (const d of r.json.designs) {
      expect(keys(d)).toEqual(DESIGN_LIST_ITEM_KEYS);
      expect(d.ownerUserId).toBe(OWNER);
      expect(d.designId).toMatch(/^[0-9a-f-]{36}$/);
    }
    expect(r.json.designs.map((d) => d.designId)).toEqual([b.designId, a.designId]);
    // the module's parser accepts it verbatim
    expect(parseDesignList(r.json).map((d) => d.designId)).toEqual([b.designId, a.designId]);
  });

  it("saving a revision bumps updatedAt, so the saved design sorts first", async () => {
    const a = await createDesign(OWNER, "Older");
    await new Promise((r) => setTimeout(r, 5));
    const b = await createDesign(OWNER, "Newer");
    await new Promise((r) => setTimeout(r, 5));
    expect((await saveRevision(OWNER, a.designId, 1, null)).statusCode).toBe(201);
    const r = await call(designsIndex, { auth: as(OWNER) });
    expect(r.json.designs.map((d) => d.designId)).toEqual([a.designId, b.designId]);
  });

  it("405 for an unsupported verb", async () => {
    const r = await call(designsIndex, { method: "DELETE", auth: as(OWNER) });
    expectErrorBody(r, 405, "METHOD_NOT_ALLOWED");
  });
});

describe("GET /api/designs/:designId — summary + latestRevision", () => {
  it("200 with latestRevision: null for a never-saved design (module: NO_REVISION)", async () => {
    const d = await createDesign(OWNER, "Shell");
    const r = await call(designById, { auth: as(OWNER), query: { designId: d.designId } });
    expect(r.statusCode).toBe(200);
    expect(keys(r.json)).toEqual(GET_DESIGN_BODY_KEYS);
    expect(keys(r.json.design)).toEqual(DESIGN_SUMMARY_KEYS);
    expect(r.json.latestRevision).toBeNull();
    let kind = null;
    try { parseDesignForOpen(r.json, d.designId); } catch (e) { kind = e.kind; }
    expect(kind).toBe(ERROR_KIND.NO_REVISION);
  });

  it("200 with latestRevision metadata (no PartGraph) after saves; latest = highest revision", async () => {
    const d = await createDesign(OWNER, "Saved");
    expect((await saveRevision(OWNER, d.designId, 1, null)).statusCode).toBe(201);
    expect((await saveRevision(OWNER, d.designId, 2, 1)).statusCode).toBe(201);
    const r = await call(designById, { auth: as(OWNER), query: { designId: d.designId } });
    expect(r.statusCode).toBe(200);
    expect(keys(r.json.latestRevision)).toEqual(LATEST_REVISION_KEYS);
    expect(r.json.latestRevision.revision).toBe(2);
    expect(r.json.design).toMatchObject({ designId: d.designId, name: "Saved", ownerUserId: OWNER });
    expect(r.json).not.toHaveProperty("partGraph");
    expect(parseDesignForOpen(r.json, d.designId)).toEqual({ designId: d.designId, name: "Saved", revision: 2 });
  });

  it("404 MISSING_DESIGN — another owner's design and a nonexistent one answer byte-identically", async () => {
    const d = await createDesign(OWNER, "Mine");
    await saveRevision(OWNER, d.designId, 1, null);
    const hidden = await call(designById, { auth: as(INTRUDER), query: { designId: d.designId } });
    const missing = await call(designById, { auth: as(INTRUDER), query: { designId: UNKNOWN_ID } });
    const malformed = await call(designById, { auth: as(INTRUDER), query: { designId: "not-a-uuid" } });
    expectErrorBody(hidden, 404, "MISSING_DESIGN");
    expect(hidden.body).toBe(missing.body);
    expect(hidden.body).toBe(malformed.body);
    expect(classifyError({ status: hidden.statusCode, code: hidden.json.code }, "open").kind).toBe(ERROR_KIND.NOT_FOUND);
  });

  it("401 MISSING_AUTH without a token (the only 'sign in' signal)", async () => {
    const d = await createDesign(OWNER, "Mine");
    const r = await call(designById, { query: { designId: d.designId } });
    expectErrorBody(r, 401, "MISSING_AUTH");
    expect(classifyError({ status: r.statusCode, code: r.json.code }, "open").kind).toBe(ERROR_KIND.SIGNED_OUT);
  });

  it("405 for POST", async () => {
    expectErrorBody(await call(designById, { method: "POST", auth: as(OWNER), query: { designId: UNKNOWN_ID } }), 405, "METHOD_NOT_ALLOWED");
  });
});

describe("GET /api/designs/:designId/revisions/:revision — reopen", () => {
  it("200 with the exact body keys; designId and revision echo the request", async () => {
    const d = await createDesign(OWNER, "Reopen me");
    await saveRevision(OWNER, d.designId, 1, null);
    const r = await call(designRevision, { auth: as(OWNER), query: { designId: d.designId, revision: "1" } });
    expect(r.statusCode).toBe(200);
    expect(keys(r.json)).toEqual(REVISION_BODY_KEYS);
    expect(r.json.designId).toBe(d.designId);
    expect(r.json.revision).toBe(1); // a number, even though the route param is a string
    // NOTE: the real prefix is "fs256:"; DESIGN_PERSISTENCE_API.md's examples say "sha256:…".
    // The module treats the fingerprint as opaque, so it pins equality, not a prefix.
    expect(r.json.fingerprint).toBe(revisionBody(1, null).fingerprint);
    expect(typeof r.json.fingerprint).toBe("string");
    expect(r.json.partGraph.parts.length).toBeGreaterThan(0);
    const rec = parseRevisionForOpen(r.json, d.designId, 1);
    expect(rec.fingerprint).toBe(r.json.fingerprint);
  });

  it("full open path the module performs: GET design → latestRevision → GET that revision", async () => {
    const d = await createDesign(OWNER, "Two revs");
    await saveRevision(OWNER, d.designId, 1, null);
    await saveRevision(OWNER, d.designId, 2, 1);
    const g = await call(designById, { auth: as(OWNER), query: { designId: d.designId } });
    const target = parseDesignForOpen(g.json, d.designId);
    const r = await call(designRevision, { auth: as(OWNER), query: { designId: target.designId, revision: String(target.revision) } });
    const rec = parseRevisionForOpen(r.json, target.designId, target.revision);
    expect({ designId: rec.designId, revision: rec.revision, name: target.name }).toEqual({ designId: d.designId, revision: 2, name: "Two revs" });
  });

  it("404 MISSING_DESIGN for an unknown revision of an owned design", async () => {
    const d = await createDesign(OWNER, "x");
    await saveRevision(OWNER, d.designId, 1, null);
    expectErrorBody(await call(designRevision, { auth: as(OWNER), query: { designId: d.designId, revision: "9" } }), 404, "MISSING_DESIGN");
  });

  it("404 MISSING_DESIGN for another owner's revision — same body as a nonexistent design", async () => {
    const d = await createDesign(OWNER, "x");
    await saveRevision(OWNER, d.designId, 1, null);
    const hidden = await call(designRevision, { auth: as(INTRUDER), query: { designId: d.designId, revision: "1" } });
    const missing = await call(designRevision, { auth: as(INTRUDER), query: { designId: UNKNOWN_ID, revision: "1" } });
    expectErrorBody(hidden, 404, "MISSING_DESIGN");
    expect(hidden.body).toBe(missing.body);
  });

  it("401 MISSING_AUTH without a token", async () => {
    expectErrorBody(await call(designRevision, { query: { designId: UNKNOWN_ID, revision: "1" } }), 401, "MISSING_AUTH");
  });

  it("400 BAD_REQUEST for a non-integer revision on an owned design", async () => {
    const d = await createDesign(OWNER, "x");
    expectErrorBody(await call(designRevision, { auth: as(OWNER), query: { designId: d.designId, revision: "abc" } }), 400, "BAD_REQUEST");
    expectErrorBody(await call(designRevision, { auth: as(OWNER), query: { designId: d.designId, revision: "0" } }), 400, "BAD_REQUEST");
  });

  it("409 REVISION_INTEGRITY_FAILED for a stored row that no longer verifies (module: INTEGRITY)", async () => {
    const d = await createDesign(OWNER, "Tampered");
    const body = revisionBody(1, null);
    // Simulate the RLS-permitted direct insert the service did not check:
    // write straight into the store with a fingerprint that does not match.
    await getSharedMemoryStore().appendRevision({
      designId: d.designId,
      revision: 1,
      fingerprint: "sha256:0000",
      furniSpec: body.furniSpec,
      partGraph: body.partGraph,
      origins: null,
      validationStatus: "ACCEPTED",
      createdAt: new Date().toISOString(),
    });
    const r = await call(designRevision, { auth: as(OWNER), query: { designId: d.designId, revision: "1" } });
    const b = expectErrorBody(r, 409, "REVISION_INTEGRITY_FAILED");
    expect(b.details).toEqual({ revision: 1, reason: "FINGERPRINT_MISMATCH" });
    expect(r.body).not.toContain("partGraph");
    expect(classifyError({ status: 409, code: b.code }, "open").kind).toBe(ERROR_KIND.INTEGRITY);
  });
});

describe("STALE_REVISION 409 (save path) — pinned so the module never mistakes it for a read answer", () => {
  it("expectedPreviousRevision behind latest → 409 STALE_REVISION with details.latestRevision", async () => {
    const d = await createDesign(OWNER, "x");
    await saveRevision(OWNER, d.designId, 1, null);
    await saveRevision(OWNER, d.designId, 2, 1);
    const r = await saveRevision(OWNER, d.designId, 2, 1 /* stale view: latest is 2 */);
    // identical body to an existing revision is an idempotent replay, not stale
    expect(r.statusCode).toBe(200);
    expect(r.json.idempotentReplay).toBe(true);

    const stale = await saveRevision(OWNER, d.designId, 3, 1);
    const b = expectErrorBody(stale, 409, "STALE_REVISION");
    expect(b.details).toMatchObject({ latestRevision: 2, expectedPreviousRevision: 1 });
  });

  it("claiming history on an empty design → 409 STALE_REVISION, latestRevision: null", async () => {
    const d = await createDesign(OWNER, "x");
    const b = expectErrorBody(await saveRevision(OWNER, d.designId, 1, 1), 409, "STALE_REVISION");
    expect(b.details.latestRevision).toBeNull();
  });

  it("a read after a refused save is unchanged (list/get still show the last good revision)", async () => {
    const d = await createDesign(OWNER, "x");
    await saveRevision(OWNER, d.designId, 1, null);
    await saveRevision(OWNER, d.designId, 3, 0);
    const g = await call(designById, { auth: as(OWNER), query: { designId: d.designId } });
    expect(g.json.latestRevision.revision).toBe(1);
  });
});

describe("design ids are server-assigned (the module never supplies one)", () => {
  it("POST /api/designs with a client designId is 400 BAD_REQUEST", async () => {
    const r = await call(designsIndex, { method: "POST", auth: as(OWNER), body: { name: "x", designId: UNKNOWN_ID } });
    expectErrorBody(r, 400, "BAD_REQUEST");
  });
});
