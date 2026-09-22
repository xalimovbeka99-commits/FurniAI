/**
 * Durability and the production auth gate.
 *
 * WHY THIS FILE EXISTS
 *
 * `designService.test.js` proves the SERVICE rules — ownership, stale
 * revision, fingerprint, validation — against `createMemoryStore()`. Those
 * rules were correct. Two things underneath them were not, and neither could
 * fail in a test that only ever uses the in-memory store in a single process:
 *
 *   1. The deployed handlers served every request from
 *      `getSharedMemoryStore()` — a module-level Map. On Vercel that is
 *      per-instance and per-lifetime, so a saved design is absent from the
 *      next request whenever a different instance answers. "Durable
 *      save/reopen by design ID" was not durable at all, and the failure mode
 *      is the worst kind: intermittent, and indistinguishable from a design
 *      that never existed.
 *
 *   2. `FURNIAI_PERSISTENCE_TEST_AUTH=yes` turned `Bearer test:<anyUserId>`
 *      into a valid identity. The only thing keeping it out of production was
 *      a comment saying not to enable it.
 *
 * Evidence class: B — real store implementation and real handler wiring, with
 * PostgREST stubbed at the HTTP boundary. No credentials, no network.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fixture from "../furnispec/goldenWardrobe.fixture.json";
import { buildStructuralPartGraph } from "../partgraph/buildStructuralPartGraph.js";
import { fingerprintFurniSpec } from "../conversation/approval.js";
import { createSupabaseDesignStore } from "./supabaseStore.js";
import { createDesignService } from "./designService.js";
import { testAuthBypassAllowed } from "./auth.js";
import { getService } from "./http.js";
import { PERSISTENCE_ERROR } from "./errors.js";

const URL_BASE = "https://project.supabase.co";
const ANON = "anon-key-not-a-secret-in-this-test";
const TOKEN = "caller-jwt";

function validPayload(overrides = {}) {
  const furniSpec = {
    ...structuredClone(fixture),
    specId: overrides.specId || fixture.specId || "persist-spec-1",
    revision: overrides.revision || 1,
  };
  return {
    furniSpec,
    partGraph: buildStructuralPartGraph(furniSpec),
    fingerprint: fingerprintFurniSpec(furniSpec),
    origins: { "envelope.widthMm": "CUSTOMER_STATED" },
    validationStatus: "ACCEPTED",
  };
}

/** A PostgREST stub that records what was sent and answers from fixed rows. */
function restStub(routes) {
  const calls = [];
  const impl = vi.fn(async (url, init = {}) => {
    calls.push({ url, method: init.method || "GET", headers: init.headers || {}, body: init.body });
    for (const [match, respond] of routes) {
      if (url.includes(match)) return respond(url, init);
    }
    return { ok: true, status: 200, json: async () => [] };
  });
  return { impl, calls };
}

const ok = (rows, status = 200) => () => ({ ok: true, status, json: async () => rows });
const fail = (status) => () => ({ ok: false, status, json: async () => ({ message: "refused" }) });

describe("the deployed store is durable, not a per-instance Map", () => {
  const ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...ENV };
  });

  it("refuses to serve a DEPLOYED environment from the in-memory store", () => {
    process.env = { ...ENV, VERCEL_ENV: "preview", SUPABASE_URL: "", SUPABASE_ANON_KEY: "" };
    // Previously this returned a service backed by a module-level Map and
    // reported success for saves that would vanish.
    expect(() => getService({ accessToken: TOKEN })).toThrowError(/not configured/i);
    try {
      getService({ accessToken: TOKEN });
    } catch (err) {
      expect(err.code).toBe(PERSISTENCE_ERROR.BAD_REQUEST);
      expect(err.status).toBe(503);
      expect(err.message).toMatch(/Nothing was saved/i);
    }
  });

  it("refuses a production environment the same way", () => {
    process.env = { ...ENV, NODE_ENV: "production", SUPABASE_URL: "", SUPABASE_ANON_KEY: "" };
    expect(() => getService({ accessToken: TOKEN })).toThrowError(/not configured/i);
  });

  it("uses the durable store when a deployment IS configured", () => {
    process.env = { ...ENV, VERCEL_ENV: "preview", SUPABASE_URL: URL_BASE, SUPABASE_ANON_KEY: ANON };
    expect(() => getService({ accessToken: TOKEN })).not.toThrow();
  });

  it("still allows the in-memory store for local development", () => {
    process.env = { ...ENV, SUPABASE_URL: "", SUPABASE_ANON_KEY: "" };
    delete process.env.VERCEL_ENV;
    process.env.NODE_ENV = "test";
    expect(() => getService({ accessToken: null })).not.toThrow();
  });
});

describe("row-level security is enforced by Postgres, not only by our code", () => {
  it("sends the CALLER's token on every query, so RLS applies", async () => {
    const { impl, calls } = restStub([["wardrobe_designs", ok([])]]);
    const store = createSupabaseDesignStore({
      url: URL_BASE,
      anonKey: ANON,
      accessToken: TOKEN,
      fetchImpl: impl,
    });

    await store.listDesigns("user-a");

    expect(calls).toHaveLength(1);
    expect(calls[0].headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(calls[0].headers.apikey).toBe(ANON);
  });

  it("never reads or sends a service-role key, which would bypass RLS entirely", async () => {
    const { impl, calls } = restStub([["wardrobe_designs", ok([])]]);
    const store = createSupabaseDesignStore({
      url: URL_BASE,
      anonKey: ANON,
      accessToken: TOKEN,
      fetchImpl: impl,
    });
    await store.listDesigns("user-a");
    const sent = JSON.stringify(calls);
    expect(sent).not.toMatch(/service_role|SERVICE_ROLE|service-role/i);
  });

  it("turns a Postgres RLS refusal into UNAUTHORIZED, not a 500", async () => {
    const { impl } = restStub([["wardrobe_revisions", fail(403)]]);
    const store = createSupabaseDesignStore({
      url: URL_BASE,
      anonKey: ANON,
      accessToken: TOKEN,
      fetchImpl: impl,
    });

    await expect(store.getRevision("design-a", 1)).rejects.toMatchObject({
      code: PERSISTENCE_ERROR.UNAUTHORIZED,
      status: 403,
    });
  });

  it("refuses to construct without a caller token rather than falling back", () => {
    expect(() =>
      createSupabaseDesignStore({ url: URL_BASE, anonKey: ANON, accessToken: null })
    ).toThrowError();
  });
});

describe("a saved revision is immutable at the database, not only by convention", () => {
  it("maps the unique(design_id, revision) violation to CONFLICT_REVISION", async () => {
    const { impl } = restStub([["wardrobe_revisions", fail(409)]]);
    const store = createSupabaseDesignStore({
      url: URL_BASE,
      anonKey: ANON,
      accessToken: TOKEN,
      fetchImpl: impl,
    });
    const p = validPayload();

    await expect(
      store.appendRevision({
        designId: "design-a",
        revision: 1,
        fingerprint: p.fingerprint,
        furniSpec: p.furniSpec,
        partGraph: p.partGraph,
      })
    ).rejects.toMatchObject({ code: PERSISTENCE_ERROR.CONFLICT_REVISION, status: 409 });
  });

  it("writes no credential-shaped field into a revision row", async () => {
    const { impl, calls } = restStub([
      ["wardrobe_revisions", ok([{ design_id: "d", revision: 1, fingerprint: "f", furnispec: {}, part_graph: {}, created_at: "now" }], 201)],
      ["wardrobe_designs", ok([], 204)],
    ]);
    const store = createSupabaseDesignStore({
      url: URL_BASE,
      anonKey: ANON,
      accessToken: TOKEN,
      fetchImpl: impl,
    });
    const p = validPayload();

    await store.appendRevision({
      designId: "design-a",
      revision: 1,
      fingerprint: p.fingerprint,
      furniSpec: p.furniSpec,
      partGraph: p.partGraph,
      origins: p.origins,
      validationStatus: "ACCEPTED",
    });

    const insert = calls.find((c) => c.method === "POST");
    expect(insert.body).not.toMatch(/sk-ant|API_KEY|authorization|service_role/i);
  });
});

describe("identity survives a real round trip through the durable store", () => {
  it("preserves specId, revision, fingerprint, FurniSpec and PartGraph", async () => {
    const p = validPayload();
    const stored = {
      design_id: "design-a",
      revision: 1,
      fingerprint: p.fingerprint,
      furnispec: p.furniSpec,
      part_graph: p.partGraph,
      origins: p.origins,
      validation_status: "ACCEPTED",
      created_at: "2026-09-22T00:00:00.000Z",
    };
    const { impl } = restStub([
      ["wardrobe_designs?id=eq.", ok([{ id: "design-a", owner_user_id: "user-a", name: "W", created_at: "x", updated_at: "y" }])],
      ["wardrobe_revisions", ok([stored])],
    ]);
    const service = createDesignService({
      store: createSupabaseDesignStore({ url: URL_BASE, anonKey: ANON, accessToken: TOKEN, fetchImpl: impl }),
    });

    const reopened = await service.getRevision({ userId: "user-a", designId: "design-a", revision: 1 });

    expect(reopened.revision).toBe(1);
    expect(reopened.fingerprint).toBe(p.fingerprint);
    expect(reopened.furniSpec.specId).toBe(p.furniSpec.specId);
    expect(reopened.partGraph.parts.length).toBe(p.partGraph.parts.length);
    expect(reopened.validationStatus).toBe("ACCEPTED");
    // The fingerprint must still describe the FurniSpec that came back.
    expect(fingerprintFurniSpec(reopened.furniSpec)).toBe(reopened.fingerprint);
  });

  it("rejects a cross-user reopen before the database is even asked", async () => {
    const { impl } = restStub([
      ["wardrobe_designs?id=eq.", ok([{ id: "design-a", owner_user_id: "user-a", name: "W", created_at: "x", updated_at: "y" }])],
    ]);
    const service = createDesignService({
      store: createSupabaseDesignStore({ url: URL_BASE, anonKey: ANON, accessToken: TOKEN, fetchImpl: impl }),
    });

    await expect(
      service.getRevision({ userId: "user-b", designId: "design-a", revision: 1 })
    ).rejects.toMatchObject({ code: PERSISTENCE_ERROR.UNAUTHORIZED });
  });
});

describe("the test auth bypass cannot reach a deployed environment", () => {
  const BASE = { FURNIAI_PERSISTENCE_TEST_AUTH: "yes" };

  it("is allowed only on a developer machine with the flag explicitly set", () => {
    expect(testAuthBypassAllowed({ ...BASE, NODE_ENV: "test" })).toBe(true);
  });

  it("is OFF without the explicit flag", () => {
    expect(testAuthBypassAllowed({ NODE_ENV: "test" })).toBe(false);
    expect(testAuthBypassAllowed({ FURNIAI_PERSISTENCE_TEST_AUTH: "true", NODE_ENV: "test" })).toBe(false);
    expect(testAuthBypassAllowed({ FURNIAI_PERSISTENCE_TEST_AUTH: "1", NODE_ENV: "test" })).toBe(false);
  });

  it("is OFF in production even when the flag is set", () => {
    expect(testAuthBypassAllowed({ ...BASE, NODE_ENV: "production" })).toBe(false);
  });

  it.each([["production"], ["preview"], ["development"]])(
    "is OFF on a Vercel %s deployment even when the flag is set",
    (vercelEnv) => {
      expect(testAuthBypassAllowed({ ...BASE, VERCEL_ENV: vercelEnv })).toBe(false);
    }
  );

  it("cannot be re-opened from the Vercel dashboard by setting the flag", () => {
    // The whole point: the flag is reachable from the dashboard, the
    // deployment markers are not forgeable by configuration.
    expect(
      testAuthBypassAllowed({
        FURNIAI_PERSISTENCE_TEST_AUTH: "yes",
        NODE_ENV: "production",
        VERCEL_ENV: "production",
      })
    ).toBe(false);
  });
});
