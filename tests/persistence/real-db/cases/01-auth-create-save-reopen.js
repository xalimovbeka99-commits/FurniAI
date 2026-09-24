/**
 * Case 1 — Authenticated create / save / reopen.
 * Procedure §5.1 (create/save/GET) + DESIGN_PERSISTENCE_API.
 * NOT production code.
 */
import { createAssert } from "../helpers/assert.js";
import { makePayload } from "../helpers/payloads.js";
import { catchErr } from "../helpers/simulatedBackend.js";

export const meta = {
  id: "01",
  title: "Authenticated create/save/reopen",
  procedureSection: "§5.1 create/save/GET + API reopen",
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
      name: `${label} create-save-reopen`,
    });
    world.track(created.designId);
    a.ok(!!created.designId, "create returns designId");
    evidence.push(`${label}: designId=${created.designId}`);

    const p1 = makePayload({ revision: 1, expectedPreviousRevision: null });
    const saved = await svc.saveRevision({
      userId: world.USER_A,
      designId: created.designId,
      ...p1,
    });
    a.equal(saved.revision, 1, "save revision 1");
    a.equal(saved.fingerprint, p1.fingerprint, "save fingerprint");

    const reopened = await svc.getRevision({
      userId: world.USER_A,
      designId: created.designId,
      revision: 1,
    });
    a.equal(reopened.fingerprint, p1.fingerprint, "reopen fingerprint matches");
    a.equal(reopened.furniSpec?.specId, p1.furniSpec.specId, "reopen preserves specId");
    a.equal(await world.sqlCountRevisions(created.designId), 1, "SQL row count = 1");
  } else {
    const { http } = ctx;
    const created = await http.createDesign("A", "create-save-reopen");
    a.ok(created.ok && created.body?.designId, "HTTP create ok");
    const designId = created.body.designId;
    evidence.push(`${label}: designId=${designId}`);
    const p1 = makePayload({ revision: 1, expectedPreviousRevision: null });
    const saved = await http.saveRevision("A", designId, p1);
    a.ok(saved.ok && saved.status === 201, "HTTP save 201");
    const reopened = await http.getRevision("A", designId, 1);
    a.ok(reopened.ok, "HTTP reopen ok");
    a.equal(reopened.body?.fingerprint, p1.fingerprint, "reopen fingerprint");
  }
  return { status: "PASS", evidence };
}
