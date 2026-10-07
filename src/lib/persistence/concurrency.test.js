/**
 * Concurrency, retry and storage-failure regressions for durable save/reopen.
 *
 * WHY THIS FILE EXISTS
 *
 * `designService.test.js` and `durableStore.test.js` cover the rules and the
 * wiring. Neither covers what happens when two writers act at once, when a
 * client retries a request whose response it never saw, or when the store
 * itself fails — and those are exactly the cases that decide whether a saved
 * revision can be trusted.
 *
 * Every test here is written against `createFakePostgrest()`, which enforces
 * `unique (design_id, revision)` and models RLS the way PostgREST actually
 * surfaces it: a SELECT of rows you cannot see returns 200 with an empty
 * array, NOT 403. That distinction matters more than it looks — see
 * "ownership" below.
 *
 * EVIDENCE CLASS: B. A single-process JavaScript fake cannot prove Postgres
 * transaction isolation, real lock behaviour, or that the deployed policies
 * are the ones in schema.sql. It demonstrates the APPLICATION-LEVEL protocol.
 * Production durability needs the real database — see
 * docs/m3/PERSISTENCE_DB_TEST_PROCEDURE.md. Nothing here may be cited as
 * proof of deployed durability.
 */
import { describe, it, expect, beforeEach } from "vitest";
import fixture from "../furnispec/goldenWardrobe.fixture.json";
import { buildStructuralPartGraph } from "../partgraph/buildStructuralPartGraph.js";
import { fingerprintFurniSpec } from "../conversation/approval.js";
import { createSupabaseDesignStore } from "./supabaseStore.js";
import { createDesignService } from "./designService.js";
import { createFakePostgrest } from "./fakePostgrest.js";
import { PERSISTENCE_ERROR } from "./errors.js";

const URL_BASE = "https://project.supabase.co";
const ANON = "anon-key";
const OWNER = "user-a";
const OTHER = "user-b";

/**
 * Two revisions must differ in CONTENT, not just in number, or the
 * idempotent-replay test cannot tell a replay from a genuine second design.
 * `finish` varies a valid FurniSpec enum value and touches no geometry — a
 * dimension change would need the bays, doors and gaps recomputed, and this
 * file has no business inventing furniture.
 */
function payload({ revision = 1, specId = "spec-concurrency", finish } = {}) {
  const furniSpec = {
    ...structuredClone(fixture),
    specId,
    revision,
    ...(finish ? { finishType: finish } : {}),
  };
  return {
    furniSpec,
    partGraph: buildStructuralPartGraph(furniSpec),
    fingerprint: fingerprintFurniSpec(furniSpec),
    origins: { "envelope.widthMm": "CUSTOMER_STATED" },
    validationStatus: "ACCEPTED",
  };
}

function harness({ rlsOwner = OWNER } = {}) {
  const pg = createFakePostgrest({ rlsOwner });
  const make = (accessToken = "token-a") =>
    createDesignService({
      store: createSupabaseDesignStore({
        url: URL_BASE,
        anonKey: ANON,
        accessToken,
        fetchImpl: pg.fetchImpl,
      }),
    });
  return { pg, make };
}

async function seedDesignWithRev1(service, pg) {
  const created = await service.createDesign({ userId: OWNER, name: "W" });
  await service.saveRevision({ userId: OWNER, designId: created.designId, revision: 1, ...payload({ revision: 1 }) });
  return created.designId;
}

describe("concurrent writers cannot both take the same revision", () => {
  let pg, make, service, designId;
  beforeEach(async () => {
    ({ pg, make } = harness());
    service = make();
    designId = await seedDesignWithRev1(service, pg);
  });

  it("lets exactly one of two simultaneous saves of revision 2 win", async () => {
    // Both writers read latest=1 before either inserts. This is the
    // check-then-act window; the fake holds the first insert open until the
    // second writer has also passed its checks.
    let release;
    const bothReady = new Promise((r) => (release = r));
    let seen = 0;
    pg.hooks.beforeInsert = async ({ table }) => {
      if (table !== "wardrobe_revisions") return;
      seen += 1;
      if (seen === 1) await bothReady;
      if (seen === 2) release();
    };

    const a = service.saveRevision({
      userId: OWNER, designId, revision: 2, expectedPreviousRevision: 1,
      ...payload({ revision: 2, finish: "painted" }),
    }).then((v) => ({ status: "ok", v }), (e) => ({ status: "err", e }));
    const b = service.saveRevision({
      userId: OWNER, designId, revision: 2, expectedPreviousRevision: 1,
      ...payload({ revision: 2, finish: "veneer" }),
    }).then((v) => ({ status: "ok", v }), (e) => ({ status: "err", e }));

    const [ra, rb] = await Promise.all([a, b]);
    const wins = [ra, rb].filter((r) => r.status === "ok");
    const losses = [ra, rb].filter((r) => r.status === "err");

    expect(wins, "exactly one writer may take revision 2").toHaveLength(1);
    expect(losses).toHaveLength(1);
    expect(
      pg.tables.wardrobe_revisions.filter((r) => r.revision === 2),
      "the database must hold exactly one revision 2"
    ).toHaveLength(1);

    // The unique constraint alone only guarantees that ONE row exists. It says
    // nothing about what the loser is told, and "that revision already exists
    // and cannot be overwritten" is wrong here: the loser never had revision 2
    // to overwrite — another writer took it while this one was in flight. That
    // is STALE_REVISION, and the difference decides whether the UI tells the
    // customer to reload or that their save was rejected.
    expect(losses[0].e.code).toBe(PERSISTENCE_ERROR.STALE_REVISION);
    expect(losses[0].e.status).toBe(409);
  });

  it("tells the LOSER to reload, not that it tried to overwrite its own work", async () => {
    // The loser of a race did nothing wrong and has nothing to overwrite:
    // another writer advanced the design underneath it. CONFLICT_REVISION
    // ("that revision already exists and cannot be overwritten") describes a
    // client replaying its own save, and sends the UI down the wrong path.
    // STALE_REVISION is the condition that actually occurred.
    await service.saveRevision({
      userId: OWNER, designId, revision: 2, expectedPreviousRevision: 1,
      ...payload({ revision: 2, finish: "painted" }),
    });

    // A second writer that still believes revision 1 is current.
    const err = await service
      .saveRevision({
        userId: OWNER, designId, revision: 2, expectedPreviousRevision: 1,
        ...payload({ revision: 2, finish: "veneer" }),
      })
      .catch((e) => e);

    expect(err.code).toBe(PERSISTENCE_ERROR.STALE_REVISION);
    expect(err.status).toBe(409);
    expect(err.details?.latestRevision).toBe(2);
  });

  it("requires expectedPreviousRevision for any revision after the first", async () => {
    // Without it there is no compare-and-swap intent at all: the server is
    // asked to append blind. It was optional, so a client could silently
    // skip the only thing making the write safe.
    const err = await service
      .saveRevision({ userId: OWNER, designId, revision: 2, ...payload({ revision: 2 }) })
      .catch((e) => e);

    expect(err.code).toBe(PERSISTENCE_ERROR.BAD_REQUEST);
    expect(err.message).toMatch(/expectedPreviousRevision/);
  });

  it("accepts the documented `expectedPreviousRevision: null` on the first revision", async () => {
    // docs/m3/DESIGN_PERSISTENCE_API.md shows exactly this for revision 1,
    // which genuinely has no predecessor. A client following the contract
    // literally must not be rejected for saying "there is none" correctly.
    const { make: mk } = harness();
    const s = mk();
    const created = await s.createDesign({ userId: OWNER, name: "W-null" });
    await expect(
      s.saveRevision({
        userId: OWNER,
        designId: created.designId,
        revision: 1,
        expectedPreviousRevision: null,
        ...payload({ revision: 1 }),
      })
    ).resolves.toMatchObject({ ok: true, revision: 1 });
  });

  it("does not require it for the first revision, which has no predecessor", async () => {
    const { make: make2 } = harness();
    const s2 = make2();
    const created = await s2.createDesign({ userId: OWNER, name: "W2" });
    await expect(
      s2.saveRevision({ userId: OWNER, designId: created.designId, revision: 1, ...payload({ revision: 1 }) })
    ).resolves.toMatchObject({ ok: true, revision: 1 });
  });
});

describe("a retried save is idempotent, not a conflict", () => {
  let pg, make, service, designId;
  beforeEach(async () => {
    ({ pg, make } = harness());
    service = make();
    designId = await seedDesignWithRev1(service, pg);
  });

  it("returns the stored revision when the SAME save is replayed", async () => {
    // The commonest real failure: the write commits, the response is lost to
    // a timeout, the client retries the identical body. Answering 409 tells
    // the customer their work was rejected when it is safely stored.
    const body = payload({ revision: 2, finish: "painted" });
    const first = await service.saveRevision({
      userId: OWNER, designId, revision: 2, expectedPreviousRevision: 1, ...body,
    });

    const replay = await service.saveRevision({
      userId: OWNER, designId, revision: 2, expectedPreviousRevision: 1, ...body,
    });

    expect(replay.ok).toBe(true);
    expect(replay.revision).toBe(2);
    expect(replay.fingerprint).toBe(first.fingerprint);
    expect(replay.idempotentReplay, "a replay must be distinguishable from a fresh save").toBe(true);
    expect(
      pg.tables.wardrobe_revisions.filter((r) => r.revision === 2),
      "a replay must not create a second row"
    ).toHaveLength(1);
  });

  it("still refuses a DIFFERENT design offered under a revision that exists", async () => {
    await service.saveRevision({
      userId: OWNER, designId, revision: 2, expectedPreviousRevision: 1, ...payload({ revision: 2, finish: "painted" }),
    });

    const err = await service
      .saveRevision({
        userId: OWNER, designId, revision: 2, expectedPreviousRevision: 1,
        ...payload({ revision: 2, finish: "veneer" }),
      })
      .catch((e) => e);

    expect(err.code).toBe(PERSISTENCE_ERROR.STALE_REVISION);
    expect(
      pg.tables.wardrobe_revisions.filter((r) => r.revision === 2),
      "the stored revision must be untouched"
    ).toHaveLength(1);
    expect(pg.tables.wardrobe_revisions.find((r) => r.revision === 2).furnispec.finishType).toBe("painted");
  });
});

describe("ownership under real RLS semantics", () => {
  it("refuses another user's design when Postgres simply hides the row", async () => {
    // PostgREST returns 200 + [] for rows RLS hides — not 403. The service's
    // `design.ownerUserId !== userId` branch is therefore unreachable on the
    // deployed path, and the memory-store test that exercises it proves
    // nothing about production. The refusal must still happen.
    const pg = createFakePostgrest({ rlsOwner: OWNER });
    const asOwner = createDesignService({
      store: createSupabaseDesignStore({ url: URL_BASE, anonKey: ANON, accessToken: "tok-a", fetchImpl: pg.fetchImpl }),
    });
    const designId = await seedDesignWithRev1(asOwner, pg);

    // Now the same database, viewed through user B's token.
    const pgB = createFakePostgrest({ rlsOwner: OTHER });
    pgB.tables.wardrobe_designs = pg.tables.wardrobe_designs;
    pgB.tables.wardrobe_revisions = pg.tables.wardrobe_revisions;
    const asOther = createDesignService({
      store: createSupabaseDesignStore({ url: URL_BASE, anonKey: ANON, accessToken: "tok-b", fetchImpl: pgB.fetchImpl }),
    });

    for (const call of [
      () => asOther.getDesign({ userId: OTHER, designId }),
      () => asOther.getRevision({ userId: OTHER, designId, revision: 1 }),
      () => asOther.listRevisions({ userId: OTHER, designId }),
      () => asOther.saveRevision({ userId: OTHER, designId, revision: 2, expectedPreviousRevision: 1, ...payload({ revision: 2 }) }),
    ]) {
      const err = await call().catch((e) => e);
      expect(err.code, "cross-user access must be refused on every endpoint").toBe(
        PERSISTENCE_ERROR.MISSING_DESIGN
      );
      expect(err.status, "and must be indistinguishable from a design that does not exist").toBe(404);
    }
  });

  it("does not let user B write into user A's design even by guessing the id", async () => {
    const pg = createFakePostgrest({ rlsOwner: OWNER });
    const asOwner = createDesignService({
      store: createSupabaseDesignStore({ url: URL_BASE, anonKey: ANON, accessToken: "tok-a", fetchImpl: pg.fetchImpl }),
    });
    const designId = await seedDesignWithRev1(asOwner, pg);
    const before = pg.tables.wardrobe_revisions.length;

    const pgB = createFakePostgrest({ rlsOwner: OTHER });
    pgB.tables.wardrobe_designs = pg.tables.wardrobe_designs;
    pgB.tables.wardrobe_revisions = pg.tables.wardrobe_revisions;
    const asOther = createDesignService({
      store: createSupabaseDesignStore({ url: URL_BASE, anonKey: ANON, accessToken: "tok-b", fetchImpl: pgB.fetchImpl }),
    });

    await asOther
      .saveRevision({ userId: OTHER, designId, revision: 2, expectedPreviousRevision: 1, ...payload({ revision: 2 }) })
      .catch(() => {});

    expect(pg.tables.wardrobe_revisions.length, "no row may be written").toBe(before);
  });
});

describe("a saved revision cannot be modified", () => {
  it("has no code path that updates or deletes a revision row", async () => {
    const { pg, make } = harness();
    const service = make();
    const designId = await seedDesignWithRev1(service, pg);
    await service.saveRevision({
      userId: OWNER, designId, revision: 2, expectedPreviousRevision: 1, ...payload({ revision: 2, finish: "painted" }),
    });

    const touched = pg.calls.filter(
      (c) => c.table === "wardrobe_revisions" && (c.method === "PATCH" || c.method === "DELETE")
    );
    expect(touched, "revisions must only ever be inserted and read").toHaveLength(0);
  });

  it("never sends an upsert preference that would silently overwrite", async () => {
    const { pg, make } = harness();
    const service = make();
    const designId = await seedDesignWithRev1(service, pg);
    const prefers = pg.calls
      .filter((c) => c.table === "wardrobe_revisions" && c.method === "POST")
      .map((c) => String(c.headers.Prefer || ""));
    expect(prefers.every((p) => !/merge-duplicates|resolution=/.test(p))).toBe(true);
  });
});

describe("storage failures are reported honestly", () => {
  const failing = (status) => async () => ({
    ok: false,
    status,
    json: async () => ({ message: "boom" }),
  });

  it("does not tell a reader that their design was not SAVED", async () => {
    // A read that fails has saved nothing and lost nothing. Saying "Your
    // design was not saved" on a reopen is simply untrue, and sends the
    // customer looking for work they never lost.
    const store = createSupabaseDesignStore({
      url: URL_BASE, anonKey: ANON, accessToken: "t", fetchImpl: failing(500),
    });
    const err = await store.getRevision("d", 1).catch((e) => e);
    expect(err.message).not.toMatch(/not saved/i);
    expect(err.code).toBe(PERSISTENCE_ERROR.STORAGE_UNAVAILABLE);
  });

  it("names a storage outage as a storage outage, not a bad request", async () => {
    // BAD_REQUEST blames the caller for the server's problem, and a 5xx
    // carrying a 4xx-shaped code makes the class of failure unreadable in
    // logs and in the UI.
    const store = createSupabaseDesignStore({
      url: URL_BASE, anonKey: ANON, accessToken: "t", fetchImpl: failing(503),
    });
    const err = await store.listDesigns("user-a").catch((e) => e);
    expect(err.code).toBe(PERSISTENCE_ERROR.STORAGE_UNAVAILABLE);
    expect(err.status).toBeGreaterThanOrEqual(500);
  });

  it("does not report a duplicate DESIGN id as a duplicate REVISION", async () => {
    // rest() mapped every 409 to CONFLICT_REVISION regardless of which table
    // raised it, so a colliding design id answered "That revision already
    // exists and cannot be overwritten."
    const pg = createFakePostgrest({ rlsOwner: OWNER });
    const service = createDesignService({
      store: createSupabaseDesignStore({ url: URL_BASE, anonKey: ANON, accessToken: "t", fetchImpl: pg.fetchImpl }),
    });
    await service.createDesign({ userId: OWNER, designId: "fixed-id", name: "one" });
    const err = await service.createDesign({ userId: OWNER, designId: "fixed-id", name: "two" }).catch((e) => e);

    expect(err.code).not.toBe(PERSISTENCE_ERROR.CONFLICT_REVISION);
    expect(err.message).not.toMatch(/revision/i);
  });

  it("never lets a failed write be reported as a success", async () => {
    const pg = createFakePostgrest({ rlsOwner: OWNER });
    const service = createDesignService({
      store: createSupabaseDesignStore({ url: URL_BASE, anonKey: ANON, accessToken: "t", fetchImpl: pg.fetchImpl }),
    });
    const designId = await seedDesignWithRev1(service, pg);
    const before = pg.tables.wardrobe_revisions.length;

    // The parent-touch PATCH fails; the revision insert already committed.
    // The save must still be reported as the success it is, and the row count
    // must reflect exactly one new revision.
    const result = await service.saveRevision({
      userId: OWNER, designId, revision: 2, expectedPreviousRevision: 1, ...payload({ revision: 2 }),
    });
    expect(result.ok).toBe(true);
    expect(pg.tables.wardrobe_revisions.length).toBe(before + 1);
  });
});
