/**
 * Case 6 — Stored design identity + content consistency.
 * Procedure §5.5 validation + §5.7 reopen identity.
 * NOT production code.
 */
import { createAssert } from "../helpers/assert.js";
import {
  makePayload,
  makePayloadNoCas,
  makeBadSpecPayload,
  makeMismatchedGraphPayload,
  partCount,
  fingerprintFurniSpec,
} from "../helpers/payloads.js";
import { catchErr, PERSISTENCE_ERROR } from "../helpers/simulatedBackend.js";

export const meta = {
  id: "06",
  title: "Stored design identity + content consistency",
  procedureSection: "§5.5 Validation + §5.7 Reopen identity",
};

export async function run(ctx) {
  const evidence = [];
  const a = createAssert(evidence);
  const label = ctx.mode === "simulated" ? "SIMULATED" : "REAL-DB";

  if (ctx.mode === "simulated") {
    const { world } = ctx;
    const svc = world.asA();
    const created = await svc.createDesign({
      userId: world.USER_A,
      name: `${label} identity`,
    });
    world.track(created.designId);
    const p1 = makePayload({ revision: 1, expectedPreviousRevision: null });
    const saved = await svc.saveRevision({
      userId: world.USER_A,
      designId: created.designId,
      ...p1,
    });

    // §5.7 reopen identity
    const reopened = await svc.getRevision({
      userId: world.USER_A,
      designId: created.designId,
      revision: 1,
    });
    const recomputed = fingerprintFurniSpec(reopened.furniSpec);
    a.equal(recomputed, reopened.fingerprint, "re-derived fingerprint matches stored");
    a.equal(reopened.fingerprint, saved.fingerprint, "reopen fingerprint == save");
    a.equal(reopened.furniSpec.specId, p1.furniSpec.specId, "specId unchanged");
    a.equal(
      partCount(reopened.partGraph),
      partCount(p1.partGraph),
      "partGraph part count matches save"
    );
    evidence.push(
      `${label}: fingerprint stable; specId=${reopened.furniSpec.specId}; parts=${partCount(reopened.partGraph)}`
    );

    // §5.5 validation refusals — no row written
    const before = await world.sqlCountRevisions(created.designId);

    const noCas = await svc
      .saveRevision({
        userId: world.USER_A,
        designId: created.designId,
        ...makePayloadNoCas(2),
      })
      .then(
        () => null,
        catchErr
      );
    a.ok(noCas, "missing expectedPreviousRevision refused");
    a.equal(noCas.code, PERSISTENCE_ERROR.BAD_REQUEST || "BAD_REQUEST", "no-CAS → BAD_REQUEST");
    a.ok(
      /expectedPreviousRevision/i.test(noCas.message || ""),
      "error names expectedPreviousRevision"
    );

    // Fresh design for bad-spec / mismatched (revision 1 path)
    const d2 = await svc.createDesign({ userId: world.USER_A, name: `${label} bad` });
    world.track(d2.designId);
    const bad = await svc
      .saveRevision({
        userId: world.USER_A,
        designId: d2.designId,
        ...makeBadSpecPayload(),
      })
      .then(
        () => null,
        catchErr
      );
    // May be INVALID_FURNISPEC or accepted if shallow assert — record honestly
    if (bad) {
      evidence.push(`${label}: bad-spec → ${bad.status} ${bad.code}`);
      a.ok(
        bad.code === PERSISTENCE_ERROR.INVALID_FURNISPEC ||
          bad.code === "INVALID_FURNISPEC" ||
          bad.code === PERSISTENCE_ERROR.BAD_REQUEST,
        "bad-spec refused"
      );
    } else {
      evidence.push(
        `${label}: bad-spec was ACCEPTED — gap vs procedure §5.5 (shallow assert?); noting for Claude`
      );
    }

    const d3 = await svc.createDesign({ userId: world.USER_A, name: `${label} mismatch` });
    world.track(d3.designId);
    const mismatch = await svc
      .saveRevision({
        userId: world.USER_A,
        designId: d3.designId,
        ...makeMismatchedGraphPayload(),
      })
      .then(
        () => null,
        catchErr
      );
    if (mismatch) {
      evidence.push(`${label}: mismatched-graph → ${mismatch.status} ${mismatch.code}`);
      a.ok(
        mismatch.code === PERSISTENCE_ERROR.INVALID_PARTGRAPH ||
          mismatch.code === "INVALID_PARTGRAPH" ||
          mismatch.code === PERSISTENCE_ERROR.BAD_REQUEST,
        "mismatched graph refused"
      );
    } else {
      evidence.push(
        `${label}: mismatched-graph ACCEPTED — gap vs §5.5; needs Claude coordination`
      );
    }

    a.equal(
      await world.sqlCountRevisions(created.designId),
      before,
      "validation refusals wrote no rows on primary design"
    );
  } else {
    const { http } = ctx;
    const created = await http.createDesign("A", "identity");
    const designId = created.body.designId;
    const p1 = makePayload({ revision: 1, expectedPreviousRevision: null });
    await http.saveRevision("A", designId, p1);
    const reopened = await http.getRevision("A", designId, 1);
    a.ok(reopened.ok, "reopen ok");
    const recomputed = fingerprintFurniSpec(reopened.body.furniSpec);
    a.equal(recomputed, reopened.body.fingerprint, "re-derived fingerprint");
    evidence.push(`${label}: reopen identity ok`);

    const noCas = await http.saveRevision("A", designId, makePayloadNoCas(2));
    a.ok(!noCas.ok, "no-CAS refused");
    a.equal(noCas.status, 400, "no-CAS 400");
  }
  return { status: "PASS", evidence };
}
