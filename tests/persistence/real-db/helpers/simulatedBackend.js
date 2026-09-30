/**
 * In-process simulated backend. READ-only imports from src/lib/persistence.
 * Label every result SIMULATED. Does NOT prove Postgres durability.
 * NOT production code.
 */
import { createFakePostgrest } from "../../../../src/lib/persistence/fakePostgrest.js";
import { createSupabaseDesignStore } from "../../../../src/lib/persistence/supabaseStore.js";
import { createDesignService } from "../../../../src/lib/persistence/designService.js";
import { PERSISTENCE_ERROR } from "../../../../src/lib/persistence/errors.js";

const URL_BASE = "https://harness-simulated.supabase.invalid";
const ANON = "harness-anon-not-a-secret";

export const USER_A = "harness-user-a";
export const USER_B = "harness-user-b";
export { PERSISTENCE_ERROR };

function serviceFor(pg, accessToken) {
  return createDesignService({
    store: createSupabaseDesignStore({
      url: URL_BASE,
      anonKey: ANON,
      accessToken,
      fetchImpl: pg.fetchImpl,
    }),
  });
}

export function createSimulatedWorld() {
  const pgA = createFakePostgrest({ rlsOwner: USER_A });
  const pgB = createFakePostgrest({ rlsOwner: USER_B });
  pgB.tables.wardrobe_designs = pgA.tables.wardrobe_designs;
  pgB.tables.wardrobe_revisions = pgA.tables.wardrobe_revisions;
  const tracked = [];

  return {
    mode: "simulated",
    label: "SIMULATED",
    pgA,
    pgB,
    USER_A,
    USER_B,
    asA: () => serviceFor(pgA, "token-a"),
    asB: () => serviceFor(pgB, "token-b"),
    independentProcess(userId = USER_A) {
      const pg = createFakePostgrest({ rlsOwner: userId });
      pg.tables.wardrobe_designs = pgA.tables.wardrobe_designs;
      pg.tables.wardrobe_revisions = pgA.tables.wardrobe_revisions;
      return serviceFor(pg, userId === USER_A ? "token-a-p2" : "token-b-p2");
    },
    freshEmptyMemoryProcess(userId = USER_A) {
      return serviceFor(createFakePostgrest({ rlsOwner: userId }), "token-empty");
    },
    track(designId) {
      tracked.push(designId);
    },
    async sqlCountRevisions(designId) {
      return pgA.tables.wardrobe_revisions.filter((r) => r.design_id === designId).length;
    },
    async sqlGetRevision(designId, revision) {
      return pgA.tables.wardrobe_revisions.find(
        (r) => r.design_id === designId && Number(r.revision) === Number(revision)
      );
    },
    async cleanup() {
      for (const id of tracked) {
        const d = pgA.tables.wardrobe_designs.filter((x) => x.id !== id);
        const r = pgA.tables.wardrobe_revisions.filter((x) => x.design_id !== id);
        pgA.tables.wardrobe_designs.length = 0;
        pgA.tables.wardrobe_revisions.length = 0;
        pgA.tables.wardrobe_designs.push(...d);
        pgA.tables.wardrobe_revisions.push(...r);
      }
      pgB.tables.wardrobe_designs = pgA.tables.wardrobe_designs;
      pgB.tables.wardrobe_revisions = pgA.tables.wardrobe_revisions;
      tracked.length = 0;
    },
  };
}

export function catchErr(err) {
  return {
    ok: false,
    code: err?.code || "INTERNAL",
    status: err?.status || 500,
    message: err?.message,
    details: err?.details,
  };
}
