/**
 * Case 2 — Two-user isolation on every endpoint.
 * Procedure §5.2. Expect MISSING_DESIGN / 404 (not 403).
 * NOT production code.
 */
import { createAssert } from "../helpers/assert.js";
import { makePayload } from "../helpers/payloads.js";
import { catchErr, PERSISTENCE_ERROR } from "../helpers/simulatedBackend.js";

export const meta = {
  id: "02",
  title: "Two-user isolation",
  procedureSection: "§5.2 Cross-user isolation",
};

export async function run(ctx) {
  const evidence = [];
  const a = createAssert(evidence);
  const label = ctx.mode === "simulated" ? "SIMULATED" : "REAL-DB";

  if (ctx.mode === "simulated") {
    const { world } = ctx;
    const asA = world.asA();
    const created = await asA.createDesign({ userId: world.USER_A, name: `${label} isolation` });
    world.track(created.designId);
    await asA.saveRevision({
      userId: world.USER_A,
      designId: created.designId,
      ...makePayload({ revision: 1, expectedPreviousRevision: null }),
    });
    const before = await world.sqlCountRevisions(created.designId);
    const asB = world.asB();

    for (const [name, fn] of [
      ["getDesign", () => asB.getDesign({ userId: world.USER_B, designId: created.designId })],
      ["listRevisions", () => asB.listRevisions({ userId: world.USER_B, designId: created.designId })],
      ["getRevision", () => asB.getRevision({ userId: world.USER_B, designId: created.designId, revision: 1 })],
      [
        "saveRevision",
        () =>
          asB.saveRevision({
            userId: world.USER_B,
            designId: created.designId,
            ...makePayload({ revision: 2, finish: "painted", expectedPreviousRevision: 1 }),
          }),
      ],
    ]) {
      const err = await fn().then(
        () => null,
        (e) => catchErr(e)
      );
      a.ok(err, `${name} refused`);
      a.equal(err.code, PERSISTENCE_ERROR.MISSING_DESIGN, `${name}: MISSING_DESIGN`);
      a.equal(err.status, 404, `${name}: 404 not 403`);
      evidence.push(`${label}: B ${name} → ${err.status} ${err.code}`);
    }

    a.equal(await world.sqlCountRevisions(created.designId), before, "B write inserted no row");
    const listB = await asB.listDesigns({ userId: world.USER_B });
    a.ok(
      !(listB.designs || []).some((d) => d.designId === created.designId),
      "B list excludes A's design"
    );

    const fakeId = "00000000-0000-4000-8000-000000000000";
    const missing = await asB.getDesign({ userId: world.USER_B, designId: fakeId }).then(
      () => null,
      catchErr
    );
    const hidden = await asB.getDesign({ userId: world.USER_B, designId: created.designId }).then(
      () => null,
      catchErr
    );
    a.equal(missing?.code, hidden?.code, "fabricated vs A's id: same code");
    a.equal(missing?.status, hidden?.status, "fabricated vs A's id: same status");
  } else {
    const { http } = ctx;
    const created = await http.createDesign("A", "isolation");
    a.ok(created.ok, "A create");
    const designId = created.body.designId;
    await http.saveRevision(
      "A",
      designId,
      makePayload({ revision: 1, expectedPreviousRevision: null })
    );
    for (const [name, res] of [
      ["getDesign", await http.getDesign("B", designId)],
      ["listRevisions", await http.listRevisions("B", designId)],
      ["getRevision", await http.getRevision("B", designId, 1)],
      [
        "saveRevision",
        await http.saveRevision(
          "B",
          designId,
          makePayload({ revision: 2, finish: "painted", expectedPreviousRevision: 1 })
        ),
      ],
    ]) {
      a.equal(res.status, 404, `B ${name} → 404`);
      const code = res.code || res.body?.code;
      a.equal(code, "MISSING_DESIGN", `B ${name} → MISSING_DESIGN`);
      evidence.push(`${label}: B ${name} → ${res.status} ${code}`);
    }
    const list = await http.listDesigns("B");
    a.ok(
      !(list.body?.designs || []).some((d) => d.designId === designId),
      "B list excludes A"
    );
  }
  return { status: "PASS", evidence };
}
