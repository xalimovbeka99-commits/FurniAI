/**
 * Every refusal must name the real cause, and hidden and nonexistent designs
 * must be indistinguishable.
 *
 * Each FAILED BEFORE case was run against 71e72b6 and failed there:
 *
 *   1. A deployment without a durable store told a SIGNED-IN customer to sign
 *      in (401 MISSING_AUTH). resolveCaller checked the Supabase configuration
 *      before getService could say "not configured", so the truthful 503 in
 *      http.js was unreachable on exactly the environments it was written for
 *      — Preview and Production today. And when it was reached, it carried
 *      code BAD_REQUEST on a 503.
 *   2. An auth-provider outage (network error or 5xx from /auth/v1/user) was
 *      also reported as 401 "Sign in is required" — an outage presented as
 *      the customer's mistake.
 *   3. A malformed design id reached PostgREST, which rejects a bad uuid with
 *      400 (22P02). The store turned that into 502 STORAGE_UNAVAILABLE while
 *      the in-memory store answered 404 — a divergence, and an outage report
 *      for a typo.
 *   4. POST /api/designs accepted a client-chosen designId. The primary key is
 *      global, so creating with ANOTHER customer's id answered 409
 *      CONFLICT_DESIGN — an existence oracle that bypasses the 404 rule.
 *
 * Evidence class: B — real handlers and store; PostgREST and the auth
 * endpoint are stubbed at the HTTP boundary. No network.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import designsIndex from "../../../api/designs/index.js";
import designById from "../../../api/designs/[designId].js";
import { createDesignService } from "./designService.js";
import { createMemoryStore } from "./memoryStore.js";
import { createSupabaseDesignStore } from "./supabaseStore.js";
import { createFakePostgrest } from "./fakePostgrest.js";
import { resolveCaller } from "./auth.js";
import { getService } from "./http.js";
import { PERSISTENCE_ERROR } from "./errors.js";

const URL_BASE = "https://project.supabase.co";
const ANON = "anon-key-not-a-secret-in-this-test";
const OWNER = "7a1c0c38-3a2b-4a64-9f55-1f1d7f0b0a01";
const OTHER = "0b3b7e0e-1d5e-4c9e-8f0e-2b2a4c6d8e02";

const ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ENV };
  vi.restoreAllMocks();
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

describe("a deployment without a durable store says so — to a signed-in customer", () => {
  it("FAILED BEFORE — answers 503 PERSISTENCE_NOT_CONFIGURED, not 401 'sign in'", async () => {
    process.env = { ...ENV, VERCEL_ENV: "preview", NODE_ENV: "production", SUPABASE_URL: "", SUPABASE_ANON_KEY: "" };
    const r = res();
    await designsIndex(req({ auth: "Bearer a-real-looking-session-token" }), r);
    expect(r.statusCode).toBe(503);
    expect(r.json.code).toBe(PERSISTENCE_ERROR.PERSISTENCE_NOT_CONFIGURED);
    expect(r.json.error).not.toMatch(/sign in/i);
  });

  it("CONTROL — with no credentials at all it is still 401", async () => {
    process.env = { ...ENV, VERCEL_ENV: "preview", NODE_ENV: "production", SUPABASE_URL: "", SUPABASE_ANON_KEY: "" };
    const r = res();
    await designsIndex(req({}), r);
    expect(r.statusCode).toBe(401);
    expect(r.json.code).toBe(PERSISTENCE_ERROR.MISSING_AUTH);
  });

  it("FAILED BEFORE — getService's own refusal carries a 5xx code on its 503", () => {
    process.env = { ...ENV, VERCEL_ENV: "preview", SUPABASE_URL: "", SUPABASE_ANON_KEY: "" };
    const err = (() => { try { getService({ accessToken: "t" }); } catch (e) { return e; } })();
    expect(err.status).toBe(503);
    expect(err.code).toBe(PERSISTENCE_ERROR.PERSISTENCE_NOT_CONFIGURED);
  });

  it("the not-configured body leaks no configuration detail", async () => {
    process.env = { ...ENV, VERCEL_ENV: "preview", NODE_ENV: "production", SUPABASE_URL: "", SUPABASE_ANON_KEY: "" };
    const r = res();
    await designsIndex(req({ auth: "Bearer t" }), r);
    expect(r.body).not.toMatch(/SUPABASE|ANON|URL|key/i);
  });
});

describe("an auth-provider outage is an outage, not a sign-in failure", () => {
  const configured = () => {
    process.env = { ...ENV, SUPABASE_URL: URL_BASE, SUPABASE_ANON_KEY: ANON };
  };

  it("FAILED BEFORE — network failure reaching /auth/v1/user is 503 AUTH_UNAVAILABLE", async () => {
    configured();
    const err = await resolveCaller(
      { headers: { authorization: "Bearer t" } },
      { fetchImpl: async () => { throw new TypeError("fetch failed"); } }
    ).catch((e) => e);
    expect(err.status).toBe(503);
    expect(err.code).toBe(PERSISTENCE_ERROR.AUTH_UNAVAILABLE);
  });

  it("FAILED BEFORE — a 5xx from the auth provider is 503 AUTH_UNAVAILABLE", async () => {
    configured();
    const err = await resolveCaller(
      { headers: { authorization: "Bearer t" } },
      { fetchImpl: async () => ({ ok: false, status: 502, json: async () => ({}) }) }
    ).catch((e) => e);
    expect(err.status).toBe(503);
    expect(err.code).toBe(PERSISTENCE_ERROR.AUTH_UNAVAILABLE);
  });

  it("CONTROL — a token the provider REJECTS is still 401 MISSING_AUTH", async () => {
    configured();
    for (const status of [401, 403]) {
      const err = await resolveCaller(
        { headers: { authorization: "Bearer expired" } },
        { fetchImpl: async () => ({ ok: false, status, json: async () => ({}) }) }
      ).catch((e) => e);
      expect(err.status).toBe(401);
      expect(err.code).toBe(PERSISTENCE_ERROR.MISSING_AUTH);
    }
  });
});

describe("a malformed design id is 'not found', on both stores, byte-identically", () => {
  async function refusal(service, designId) {
    const err = await service.getDesign({ userId: OWNER, designId }).catch((e) => e);
    return { status: err.status, code: err.code, message: err.message };
  }

  it("FAILED BEFORE — the durable store answers 404, not a 502 storage outage", async () => {
    const pg = createFakePostgrest({ rlsOwner: OWNER });
    const service = createDesignService({
      store: createSupabaseDesignStore({ url: URL_BASE, anonKey: ANON, accessToken: "t", fetchImpl: pg.fetchImpl }),
    });
    const nonexistent = await refusal(service, "5d1f2c3b-0000-4000-8000-000000000000");
    for (const bad of ["not-a-uuid", "1", "' or 1=1 --", "../designs"]) {
      expect(await refusal(service, bad)).toEqual(nonexistent);
    }
    expect(nonexistent).toMatchObject({ status: 404, code: PERSISTENCE_ERROR.MISSING_DESIGN });
  });

  it("the memory store gives the identical answer", async () => {
    const service = createDesignService({ store: createMemoryStore() });
    const r = await refusal(service, "not-a-uuid");
    expect(r).toMatchObject({ status: 404, code: PERSISTENCE_ERROR.MISSING_DESIGN, message: "That design was not found." });
  });

  it("no malformed id is ever sent to PostgREST", async () => {
    const pg = createFakePostgrest({ rlsOwner: OWNER });
    const service = createDesignService({
      store: createSupabaseDesignStore({ url: URL_BASE, anonKey: ANON, accessToken: "t", fetchImpl: pg.fetchImpl }),
    });
    await refusal(service, "not-a-uuid");
    expect(pg.calls.filter((c) => c.path.includes("not-a-uuid"))).toEqual([]);
  });
});

describe("design ids are assigned by the server", () => {
  it("FAILED BEFORE — a client-chosen designId is refused, so no create can probe another customer's id", async () => {
    // Owner creates a design; OTHER tries to create one with the same id.
    const pg = createFakePostgrest({ rlsOwner: OWNER });
    const asOwner = createDesignService({
      store: createSupabaseDesignStore({ url: URL_BASE, anonKey: ANON, accessToken: "t", fetchImpl: pg.fetchImpl }),
    });
    const { designId } = await asOwner.createDesign({ userId: OWNER, name: "mine" });

    const asOther = createDesignService({
      store: createSupabaseDesignStore({ url: URL_BASE, anonKey: ANON, accessToken: "t", fetchImpl: pg.fetchImpl }),
    });
    const probeTaken = await asOther.createDesign({ userId: OTHER, designId, name: "probe" }).catch((e) => e);
    const probeFree = await asOther
      .createDesign({ userId: OTHER, designId: "5d1f2c3b-0000-4000-8000-000000000000", name: "probe" })
      .catch((e) => e);

    expect(probeTaken.code).toBe(PERSISTENCE_ERROR.BAD_REQUEST);
    expect({ s: probeTaken.status, c: probeTaken.code, m: probeTaken.message }).toEqual({
      s: probeFree.status, c: probeFree.code, m: probeFree.message,
    });
    expect(pg.tables.wardrobe_designs.length).toBe(1);
  });

  it("the handler refuses it before touching the store", async () => {
    process.env = { ...ENV, FURNIAI_PERSISTENCE_TEST_AUTH: "yes", NODE_ENV: "test", SUPABASE_URL: "", SUPABASE_ANON_KEY: "" };
    delete process.env.VERCEL_ENV;
    const r = res();
    await designsIndex(req({ method: "POST", auth: "Bearer test:u1", body: { name: "x", designId: "abc" } }), r);
    expect(r.statusCode).toBe(400);
    expect(r.json.code).toBe(PERSISTENCE_ERROR.BAD_REQUEST);
  });

  it("CONTROL — creating without a designId still works and returns a uuid", async () => {
    const service = createDesignService({ store: createMemoryStore() });
    const out = await service.createDesign({ userId: OWNER, name: "x" });
    expect(out.designId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("CONTROL — GET /api/designs/:id through the handler: hidden and nonexistent answer the same", async () => {
    process.env = { ...ENV, FURNIAI_PERSISTENCE_TEST_AUTH: "yes", NODE_ENV: "test", SUPABASE_URL: "", SUPABASE_ANON_KEY: "" };
    delete process.env.VERCEL_ENV;
    const c = res();
    await designsIndex(req({ method: "POST", auth: "Bearer test:owner-x", body: { name: "x" } }), c);
    const id = c.json.designId;
    const hidden = res();
    await designById(req({ auth: "Bearer test:intruder-y", query: { designId: id } }), hidden);
    const missing = res();
    await designById(req({ auth: "Bearer test:intruder-y", query: { designId: "5d1f2c3b-0000-4000-8000-000000000000" } }), missing);
    expect(hidden.statusCode).toBe(404);
    expect(hidden.body).toBe(missing.body);
  });
});

describe("a save that fails on an unreachable store says the design was not saved", () => {
  it("FAILED BEFORE — even when the failing call is the ownership READ the save makes first", async () => {
    const store = createSupabaseDesignStore({
      url: URL_BASE, anonKey: ANON, accessToken: "t",
      fetchImpl: async () => { throw new TypeError("fetch failed"); },
    });
    const service = createDesignService({ store });
    const err = await service
      .saveRevision({ userId: OWNER, designId: "5d1f2c3b-0000-4000-8000-000000000000", revision: 1 })
      .catch((e) => e);
    expect(err.code).toBe(PERSISTENCE_ERROR.STORAGE_UNAVAILABLE);
    expect(err.status).toBe(503);
    expect(err.message).toMatch(/not saved/i);
  });

  it("CONTROL — a failing READ request still does not claim anything was 'not saved'", async () => {
    const store = createSupabaseDesignStore({
      url: URL_BASE, anonKey: ANON, accessToken: "t",
      fetchImpl: async () => { throw new TypeError("fetch failed"); },
    });
    const service = createDesignService({ store });
    const err = await service
      .getDesign({ userId: OWNER, designId: "5d1f2c3b-0000-4000-8000-000000000000" })
      .catch((e) => e);
    expect(err.code).toBe(PERSISTENCE_ERROR.STORAGE_UNAVAILABLE);
    expect(err.message).not.toMatch(/saved/i);
  });
});
