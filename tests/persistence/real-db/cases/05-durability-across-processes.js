/**
 * Case 5 — Durability across independent processes.
 * Procedure §5.1. Shared tables visible to a new process; empty memory is not.
 * SIMULATED: shared fake tables. REAL-DB: second HTTP client (redeploy still manual).
 * NOT production code.
 */
import { createAssert } from "../helpers/assert.js";
import { makePayload } from "../helpers/payloads.js";
import { catchErr, PERSISTENCE_ERROR } from "../helpers/simulatedBackend.js";

export const meta = {
  id: "05",
  title: "Durability across independent processes",
  procedureSection: "§5.1 Durability (independent process)",
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
      name: `${label} durability`,
    });
    world.track(created.designId);
    const p1 = makePayload({ revision: 1, expectedPreviousRevision: null });
    await svc.saveRevision({
      userId: world.USER_A,
      designId: created.designId,
      ...p1,
    });

    // (a) SQL-visible row
    const row = await world.sqlGetRevision(created.designId, 1);
    a.ok(!!row, "SQL row exists for revision 1");
    a.equal(row.fingerprint, p1.fingerprint, "SQL fingerprint matches API");
    evidence.push(`${label}: sql row present fingerprint=${row.fingerprint?.slice(0, 18)}…`);

    // (b) Independent process sharing durable store
    const proc2 = world.independentProcess(world.USER_A);
    const fromProc2 = await proc2.getRevision({
      userId: world.USER_A,
      designId: created.designId,
      revision: 1,
    });
    a.equal(fromProc2.fingerprint, p1.fingerprint, "independent process reads same revision");
    evidence.push(`${label}: independent process reopen ok`);

    // Contrast: empty in-memory store cannot see it
    const empty = world.freshEmptyMemoryProcess(world.USER_A);
    const miss = await empty
      .getRevision({ userId: world.USER_A, designId: created.designId, revision: 1 })
      .then(
        () => null,
        catchErr
      );
    a.ok(miss, "empty memory cannot see prior write");
    a.equal(miss.code, PERSISTENCE_ERROR.MISSING_DESIGN, "empty memory → MISSING_DESIGN");
    evidence.push(`${label}: empty-memory contrast → MISSING_DESIGN (proves Map is not durable)`);

    // Repeat reads (intermittent 404 = fail)
    for (let i = 0; i < 5; i++) {
      const r = await proc2.getRevision({
        userId: world.USER_A,
        designId: created.designId,
        revision: 1,
      });
      a.equal(r.fingerprint, p1.fingerprint, `repeat read ${i}`);
    }
  } else {
    const { http } = ctx;
    const created = await http.createDesign("A", "durability");
    const designId = created.body.designId;
    const p1 = makePayload({ revision: 1, expectedPreviousRevision: null });
    const saved = await http.saveRevision("A", designId, p1);
    a.ok(saved.ok, "save ok");
    // Second client instance ≈ independent process from harness POV
    const { createHttpClient } = await import("../helpers/httpClient.js");
    const http2 = createHttpClient(ctx.httpConfig);
    let okReads = 0;
    for (let i = 0; i < 5; i++) {
      const r = await http2.getRevision("A", designId, 1);
      if (r.ok && r.body?.fingerprint === p1.fingerprint) okReads += 1;
      else a.ok(false, `read ${i} failed status=${r.status} code=${r.code}`);
    }
    a.equal(okReads, 5, "5/5 independent-client reads succeeded");
    evidence.push(
      `${label}: 5/5 reads ok via second HTTP client; full redeploy check still manual per §5.1(c)`
    );
  }
  return { status: "PASS", evidence };
}
