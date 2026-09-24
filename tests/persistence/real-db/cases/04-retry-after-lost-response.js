/**
 * Case 4 — Retry after lost response (idempotent replay).
 * Procedure §5.4. Same body → idempotentReplay; different body → STALE_REVISION.
 * NOT production code.
 */
import { createAssert } from "../helpers/assert.js";
import { makePayload } from "../helpers/payloads.js";
import { catchErr, PERSISTENCE_ERROR } from "../helpers/simulatedBackend.js";

export const meta = {
  id: "04",
  title: "Retry after lost response",
  procedureSection: "§5.4 Idempotent retry",
};

export async function run(ctx) {
  const evidence = [];
  const a = createAssert(evidence);
  const label = ctx.mode === "simulated" ? "SIMULATED" : "REAL-DB";

  if (ctx.mode === "simulated") {
    const { world } = ctx;
    const svc = world.asA();
    const created = await svc.createDesign({ userId: world.USER_A, name: `${label} retry` });
    world.track(created.designId);
    await svc.saveRevision({
      userId: world.USER_A,
      designId: created.designId,
      ...makePayload({ revision: 1, expectedPreviousRevision: null }),
    });

    const body = makePayload({ revision: 2, finish: "painted", expectedPreviousRevision: 1 });
    const first = await svc.saveRevision({
      userId: world.USER_A,
      designId: created.designId,
      ...body,
    });
    a.ok(first.ok !== false, "first save ok");
    a.ok(!first.idempotentReplay, "first save is not a replay");

    const replay = await svc.saveRevision({
      userId: world.USER_A,
      designId: created.designId,
      ...body,
    });
    a.equal(replay.idempotentReplay, true, "byte-identical retry → idempotentReplay");
    a.equal(replay.fingerprint, first.fingerprint, "replay fingerprint unchanged");
    a.equal(await world.sqlCountRevisions(created.designId), 2, "replay inserts no new row");
    evidence.push(`${label}: idempotentReplay=true; sql rows=2`);

    const different = makePayload({
      revision: 2,
      finish: "veneer",
      expectedPreviousRevision: 1,
    });
    const err = await svc
      .saveRevision({ userId: world.USER_A, designId: created.designId, ...different })
      .then(
        () => null,
        catchErr
      );
    a.ok(err, "different body under same revision refused");
    a.equal(err.code, PERSISTENCE_ERROR.STALE_REVISION, "different body → STALE_REVISION");
    const row = await world.sqlGetRevision(created.designId, 2);
    a.equal(row?.furnispec?.finishType, "painted", "stored finishType still painted");
  } else {
    const { http } = ctx;
    const created = await http.createDesign("A", "retry");
    const designId = created.body.designId;
    await http.saveRevision(
      "A",
      designId,
      makePayload({ revision: 1, expectedPreviousRevision: null })
    );
    const body = makePayload({ revision: 2, finish: "painted", expectedPreviousRevision: 1 });
    const first = await http.saveRevision("A", designId, body);
    a.ok(first.ok && first.status === 201, "first save 201");
    const replay = await http.saveRevision("A", designId, body);
    a.ok(replay.ok && (replay.status === 200 || replay.idempotentReplay), "replay 200");
    a.ok(
      replay.idempotentReplay || replay.body?.idempotentReplay,
      "idempotentReplay flag"
    );
    evidence.push(`${label}: first=${first.status} replay=${replay.status}`);
    const different = await http.saveRevision(
      "A",
      designId,
      makePayload({ revision: 2, finish: "veneer", expectedPreviousRevision: 1 })
    );
    a.ok(!different.ok, "different body refused");
    a.equal(different.code || different.body?.code, "STALE_REVISION", "STALE_REVISION");
  }
  return { status: "PASS", evidence };
}
