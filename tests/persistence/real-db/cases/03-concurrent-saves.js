/**
 * Case 3 — Concurrent saves from the same prior revision.
 * Procedure §5.3. Exactly one winner; loser STALE_REVISION; one row per revision.
 * NOT production code.
 */
import { createAssert } from "../helpers/assert.js";
import { makePayload } from "../helpers/payloads.js";
import { catchErr, PERSISTENCE_ERROR } from "../helpers/simulatedBackend.js";

export const meta = {
  id: "03",
  title: "Concurrent saves from same prior revision",
  procedureSection: "§5.3 Concurrency",
};

export async function run(ctx) {
  const evidence = [];
  const a = createAssert(evidence);
  const label = ctx.mode === "simulated" ? "SIMULATED" : "REAL-DB";
  const races = ctx.mode === "simulated" ? 5 : 3;
  let raced = 0;

  for (let i = 0; i < races; i++) {
    if (ctx.mode === "simulated") {
      const { world } = ctx;
      const svc = world.asA();
      const created = await svc.createDesign({
        userId: world.USER_A,
        name: `${label} concurrent-${i}`,
      });
      world.track(created.designId);
      await svc.saveRevision({
        userId: world.USER_A,
        designId: created.designId,
        ...makePayload({ revision: 1, expectedPreviousRevision: null }),
      });

      let release;
      const bothReady = new Promise((r) => (release = r));
      let seen = 0;
      world.pgA.hooks.beforeInsert = async ({ table }) => {
        if (table !== "wardrobe_revisions") return;
        seen += 1;
        if (seen === 1) await bothReady;
        if (seen === 2) release();
      };

      const painted = makePayload({ revision: 2, finish: "painted", expectedPreviousRevision: 1 });
      const veneer = makePayload({ revision: 2, finish: "veneer", expectedPreviousRevision: 1 });
      const [ra, rb] = await Promise.all([
        svc
          .saveRevision({ userId: world.USER_A, designId: created.designId, ...painted })
          .then((v) => ({ ok: true, v }), (e) => ({ ok: false, e: catchErr(e) })),
        svc
          .saveRevision({ userId: world.USER_A, designId: created.designId, ...veneer })
          .then((v) => ({ ok: true, v }), (e) => ({ ok: false, e: catchErr(e) })),
      ]);
      world.pgA.hooks.beforeInsert = null;

      const wins = [ra, rb].filter((r) => r.ok);
      const losses = [ra, rb].filter((r) => !r.ok);
      a.equal(wins.length, 1, `run ${i}: one winner`);
      a.equal(losses.length, 1, `run ${i}: one loser`);
      a.equal(
        losses[0].e.code,
        PERSISTENCE_ERROR.STALE_REVISION,
        `run ${i}: loser STALE_REVISION`
      );
      a.equal(await world.sqlCountRevisions(created.designId), 2, `run ${i}: exactly 2 rows`);
      if (seen >= 2) raced += 1;
    } else {
      const { http } = ctx;
      const created = await http.createDesign("A", `concurrent-${i}`);
      const designId = created.body.designId;
      await http.saveRevision(
        "A",
        designId,
        makePayload({ revision: 1, expectedPreviousRevision: null })
      );
      const [ra, rb] = await Promise.all([
        http.saveRevision(
          "A",
          designId,
          makePayload({ revision: 2, finish: "painted", expectedPreviousRevision: 1 })
        ),
        http.saveRevision(
          "A",
          designId,
          makePayload({ revision: 2, finish: "veneer", expectedPreviousRevision: 1 })
        ),
      ]);
      const wins = [ra, rb].filter((r) => r.ok);
      const losses = [ra, rb].filter((r) => !r.ok);
      a.equal(wins.length, 1, `run ${i}: one winner`);
      a.equal(losses.length, 1, `run ${i}: one loser`);
      a.equal(losses[0].code || losses[0].body?.code, "STALE_REVISION", `run ${i}: STALE`);
      if (wins.length === 1) raced += 1;
    }
  }

  evidence.push(`${label}: runs=${races} raced=${raced}`);
  a.ok(raced === races, "every run produced a real race/decision");
  return { status: "PASS", evidence };
}
