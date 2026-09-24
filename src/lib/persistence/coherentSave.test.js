/**
 * A saved revision must be ONE coherent design — decided by the authoritative
 * compiler, not by a handful of identity fields.
 *
 * WHAT WAS STILL OPEN AFTER saveConsistency.test.js
 *
 * `assertSpecGraphConsistency` compared three things: `sourceSpecId`,
 * `sourceRevision` and `summary.envelope`. Each comparison ran only when the
 * field was PRESENT, and none of them looked at a single part. So:
 *
 *   - a PartGraph with the right identity and envelope but different panels
 *     (a shelf 10 mm short, a missing divider) was stored as the geometry of
 *     that FurniSpec;
 *   - another design's PartGraph with its identity fields relabelled passed;
 *   - a FurniSpec that validates but that the compiler turns into an INVALID
 *     PartGraph (a 30 mm groove in an 18 mm panel) was stored alongside a
 *     doctored graph that looked fine.
 *
 * Each of those produced an immutable revision whose reopened spec and
 * exported cutting list describe different furniture.
 *
 * THE RULE NOW
 *
 * The server recompiles the submitted FurniSpec with buildStructuralPartGraph
 * — the same pure, deterministic compiler the pipeline uses — and the
 * submitted PartGraph must equal it canonically. It is never substituted:
 * the caller's graph is stored byte-for-byte, or the save is refused.
 *
 * A refusal changes nothing: no revision row, no history change, the design's
 * latest revision is what it was.
 *
 * Evidence class: B — real service, real validators, real compiler, store in
 * memory. No network. Every `FAILED BEFORE` test below was run against
 * 71e72b6 and failed there.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { previewDraftWardrobe } from "../conversation/pipeline.js";
import { fingerprintFurniSpec } from "../conversation/approval.js";
import { buildStructuralPartGraph } from "../partgraph/buildStructuralPartGraph.js";
import { createMemoryStore } from "./memoryStore.js";
import { createDesignService } from "./designService.js";
import { PERSISTENCE_ERROR } from "./errors.js";

const OWNER = "user-a";

function design({ description, specId, revision = 1 }) {
  const d = previewDraftWardrobe({ description, specId, revision });
  expect(d.validation.valid, "precondition: the fixture design is valid").toBe(true);
  return d;
}
const DESIGN_A = () =>
  design({ description: "A wardrobe 1800 mm wide, 2400 mm high and 600 mm deep", specId: "spec-A" });
const DESIGN_B = () =>
  design({ description: "A wardrobe 2400 mm wide, 2400 mm high and 600 mm deep", specId: "spec-B" });

/** A store that records every write attempt, so "nothing was written" is observed, not assumed. */
function recordingStore() {
  const inner = createMemoryStore();
  const appends = [];
  return {
    appends,
    store: {
      ...inner,
      async appendRevision(row) {
        appends.push(row.revision);
        return inner.appendRevision(row);
      },
    },
  };
}

async function history(service, designId) {
  const list = await service.listRevisions({ userId: OWNER, designId });
  return list.revisions.map((r) => `${r.revision}:${r.fingerprint}`);
}

describe("the PartGraph must be what the compiler makes of THIS FurniSpec", () => {
  let service;
  let rec;
  let designId;
  beforeEach(async () => {
    rec = recordingStore();
    service = createDesignService({ store: rec.store });
    designId = (await service.createDesign({ userId: OWNER, name: "W" })).designId;
  });

  async function refusedWithoutWriting(body) {
    const before = await history(service, designId);
    const err = await service
      .saveRevision({ userId: OWNER, designId, revision: 1, validationStatus: "ACCEPTED", ...body })
      .catch((e) => e);
    expect(err, "must be refused").toBeInstanceOf(Error);
    expect(err.status).toBe(400);
    expect(rec.appends, "no revision write may be attempted").toEqual([]);
    expect(await history(service, designId), "history unchanged").toEqual(before);
    return err;
  }

  it("FAILED BEFORE — refuses a graph with the right identity and envelope but a panel of the wrong size", async () => {
    const a = DESIGN_A();
    const tampered = structuredClone(a.partGraph);
    const shelf = tampered.parts.find((p) => p.role === "FIXED_SHELF");
    shelf.finished.lengthDmm -= 100; // 10 mm short; sourceSpecId, revision, envelope untouched
    shelf.raw.lengthDmm -= 100;
    shelf.placement.maxXDmm -= 100; // internally consistent, so validatePartGraph accepts it

    const err = await refusedWithoutWriting({
      furniSpec: a.spec,
      partGraph: tampered,
      fingerprint: fingerprintFurniSpec(a.spec),
    });
    expect(err.code).toBe(PERSISTENCE_ERROR.INVALID_PARTGRAPH);
    expect(err.details?.compiledMismatch?.parts).toContain(shelf.id);
  });

  it("FAILED BEFORE — refuses another design's graph relabelled with this design's identity and envelope", async () => {
    const a = DESIGN_A();
    const b = DESIGN_B();
    const relabelled = structuredClone(b.partGraph);
    relabelled.sourceSpecId = a.partGraph.sourceSpecId;
    relabelled.sourceRevision = a.partGraph.sourceRevision;
    relabelled.summary.envelope = { ...a.partGraph.summary.envelope };

    const err = await refusedWithoutWriting({
      furniSpec: a.spec,
      partGraph: relabelled,
      fingerprint: fingerprintFurniSpec(a.spec),
    });
    expect(err.code).toBe(PERSISTENCE_ERROR.INVALID_PARTGRAPH);
  });

  it("FAILED BEFORE — refuses a graph with its identity fields stripped, instead of skipping the checks", async () => {
    const a = DESIGN_A();
    const b = DESIGN_B();
    const anonymous = structuredClone(b.partGraph);
    delete anonymous.sourceSpecId;
    delete anonymous.sourceRevision;
    delete anonymous.summary.envelope;

    const err = await refusedWithoutWriting({
      furniSpec: a.spec,
      partGraph: anonymous,
      fingerprint: fingerprintFurniSpec(a.spec),
    });
    expect([PERSISTENCE_ERROR.INVALID_PARTGRAPH]).toContain(err.code);
  });

  it("FAILED BEFORE — refuses a spec the validator passes but the compiler turns into invalid geometry", async () => {
    // A 30 mm groove in an 18 mm panel. validateFurniSpec accepts it; the
    // compiler's PartGraph fails validatePartGraph. The caller submits the
    // healthy graph from before the edit, which carries matching identity and
    // envelope — so the three-field check had nothing to object to.
    const a = DESIGN_A();
    const spec = structuredClone(a.spec);
    spec.carcass.grooveDepthMm = 30;

    const err = await refusedWithoutWriting({
      furniSpec: spec,
      partGraph: a.partGraph,
      fingerprint: fingerprintFurniSpec(spec),
    });
    expect([PERSISTENCE_ERROR.INVALID_FURNISPEC, PERSISTENCE_ERROR.INVALID_PARTGRAPH]).toContain(err.code);
    expect(err.details?.compiledGraphInvalid ?? err.details?.compiledMismatch).toBeTruthy();
  });

  it("refuses a malformed FurniSpec with a correctly computed fingerprint", async () => {
    const a = DESIGN_A();
    const broken = structuredClone(a.spec);
    broken.bays[0].clearWidthMm = 900; // no longer sums to the envelope
    const err = await refusedWithoutWriting({
      furniSpec: broken,
      partGraph: a.partGraph,
      fingerprint: fingerprintFurniSpec(broken),
    });
    expect(err.code).toBe(PERSISTENCE_ERROR.INVALID_FURNISPEC);
  });

  it("refuses non-physical dimensions before any write", async () => {
    for (const mutate of [
      (s) => { s.envelope.widthMm = -1800; },
      (s) => { s.doors.thicknessMm = 0; },
      (s) => { s.envelope.heightMm = "2400"; },
      (s) => { s.envelope.depthMm = null; },
    ]) {
      const a = DESIGN_A();
      const spec = structuredClone(a.spec);
      mutate(spec);
      const err = await refusedWithoutWriting({
        furniSpec: spec,
        partGraph: a.partGraph,
        fingerprint: fingerprintFurniSpec(spec),
      });
      expect(err.code).toBe(PERSISTENCE_ERROR.INVALID_FURNISPEC);
    }
  });

  it("CONTROL — accepts the compiler's own graph, and stores the caller's bytes unchanged", async () => {
    const a = DESIGN_A();
    expect(JSON.stringify(buildStructuralPartGraph(a.spec))).toBe(JSON.stringify(a.partGraph));
    const saved = await service.saveRevision({
      userId: OWNER, designId, revision: 1,
      furniSpec: a.spec, partGraph: a.partGraph,
      fingerprint: fingerprintFurniSpec(a.spec), validationStatus: "ACCEPTED",
    });
    expect(saved.ok).toBe(true);
    const reopened = await service.getRevision({ userId: OWNER, designId, revision: 1 });
    expect(JSON.stringify(reopened.partGraph)).toBe(JSON.stringify(a.partGraph));
  });

  it("CONTROL — key order does not matter; the comparison is canonical", async () => {
    const a = DESIGN_A();
    const reordered = Object.fromEntries(Object.entries(structuredClone(a.partGraph)).reverse());
    const saved = await service.saveRevision({
      userId: OWNER, designId, revision: 1,
      furniSpec: a.spec, partGraph: reordered,
      fingerprint: fingerprintFurniSpec(a.spec), validationStatus: "ACCEPTED",
    });
    expect(saved.ok).toBe(true);
  });
});

describe("a retry under the same identity with different content is not a replay", () => {
  let service;
  let rec;
  let designId;
  let a;
  beforeEach(async () => {
    rec = recordingStore();
    service = createDesignService({ store: rec.store });
    designId = (await service.createDesign({ userId: OWNER, name: "W" })).designId;
    a = DESIGN_A();
    await service.saveRevision({
      userId: OWNER, designId, revision: 1,
      furniSpec: a.spec, partGraph: a.partGraph,
      fingerprint: fingerprintFurniSpec(a.spec), validationStatus: "ACCEPTED",
      origins: { "envelope.widthMm": "CUSTOMER_STATED" },
    });
    rec.appends.length = 0;
  });

  it("same revision + same fingerprint + different provenance: STALE_REVISION, stored row untouched", async () => {
    const stored = await service.getRevision({ userId: OWNER, designId, revision: 1 });
    const err = await service
      .saveRevision({
        userId: OWNER, designId, revision: 1,
        furniSpec: a.spec, partGraph: a.partGraph,
        fingerprint: fingerprintFurniSpec(a.spec), validationStatus: "ACCEPTED",
        origins: { "envelope.widthMm": "GOLDEN_DEFAULT" },
      })
      .catch((e) => e);
    expect(err.code).toBe(PERSISTENCE_ERROR.STALE_REVISION);
    expect(err.status).toBe(409);
    expect(err.idempotentReplay).toBeUndefined();
    expect(rec.appends).toEqual([]);
    const after = await service.getRevision({ userId: OWNER, designId, revision: 1 });
    expect(after).toEqual(stored);
  });

  it("same revision number, different (valid) design: STALE_REVISION, never a replay", async () => {
    const other = design({ description: "A wardrobe 2400 mm wide, 2400 mm high and 600 mm deep", specId: "spec-A" });
    const err = await service
      .saveRevision({
        userId: OWNER, designId, revision: 1,
        furniSpec: other.spec, partGraph: other.partGraph,
        fingerprint: fingerprintFurniSpec(other.spec), validationStatus: "ACCEPTED",
        origins: { "envelope.widthMm": "CUSTOMER_STATED" },
      })
      .catch((e) => e);
    expect(err.code).toBe(PERSISTENCE_ERROR.STALE_REVISION);
    expect(rec.appends).toEqual([]);
  });
});

describe("compare-and-swap intent is checked even on an empty design", () => {
  it("FAILED BEFORE — refuses a first save that claims to build on a revision that does not exist", async () => {
    // expectedPreviousRevision: 3 on a design with no revisions means the
    // client believes it is building on history this design does not have —
    // a wrong design id, or a stale view. It was silently ignored.
    const rec = recordingStore();
    const service = createDesignService({ store: rec.store });
    const designId = (await service.createDesign({ userId: OWNER, name: "W" })).designId;
    const a = DESIGN_A();
    const err = await service
      .saveRevision({
        userId: OWNER, designId, revision: 1, expectedPreviousRevision: 3,
        furniSpec: a.spec, partGraph: a.partGraph,
        fingerprint: fingerprintFurniSpec(a.spec), validationStatus: "ACCEPTED",
      })
      .catch((e) => e);
    expect(err.code).toBe(PERSISTENCE_ERROR.STALE_REVISION);
    expect(err.details).toMatchObject({ latestRevision: null, expectedPreviousRevision: 3 });
    expect(rec.appends).toEqual([]);
  });
});

describe("reopen serves only a revision that still verifies", () => {
  // The store queries PostgREST with the caller's own token, and RLS lets an
  // owner INSERT into their own design. So a customer holding their session
  // token can write a revision directly to PostgREST, bypassing every check in
  // this service. They can only damage their own design — RLS still stops
  // them touching anyone else's — but reopen must not then serve that row as
  // authoritative geometry.
  async function withInjectedRow(mutate) {
    const store = createMemoryStore();
    const service = createDesignService({ store });
    const designId = (await service.createDesign({ userId: OWNER, name: "W" })).designId;
    const a = DESIGN_A();
    const row = {
      designId, revision: 1,
      fingerprint: fingerprintFurniSpec(a.spec),
      furniSpec: structuredClone(a.spec),
      partGraph: structuredClone(a.partGraph),
      origins: {}, validationStatus: "ACCEPTED",
      createdAt: new Date().toISOString(),
    };
    mutate(row, a);
    await store.appendRevision(row); // straight into the store, as a direct PostgREST write would
    return { service, designId };
  }

  it("FAILED BEFORE — refuses to reopen a row whose fingerprint does not match its spec", async () => {
    const { service, designId } = await withInjectedRow((row) => { row.furniSpec.finishType = "veneer"; });
    const err = await service.getRevision({ userId: OWNER, designId, revision: 1 }).catch((e) => e);
    expect(err, "reopen must be refused").toBeInstanceOf(Error);
    expect(err.code).toBe(PERSISTENCE_ERROR.REVISION_INTEGRITY_FAILED);
    expect(err.status).toBe(409);
    expect(err.furniSpec).toBeUndefined();
  });

  it("FAILED BEFORE — refuses to reopen a row whose graph is not the compiler's graph", async () => {
    const { service, designId } = await withInjectedRow((row) => { row.partGraph.parts.pop(); });
    const err = await service.getRevision({ userId: OWNER, designId, revision: 1 }).catch((e) => e);
    expect(err, "reopen must be refused").toBeInstanceOf(Error);
    expect(err.code).toBe(PERSISTENCE_ERROR.REVISION_INTEGRITY_FAILED);
  });

  it("CONTROL — a coherent stored row reopens normally", async () => {
    const { service, designId } = await withInjectedRow(() => {});
    const out = await service.getRevision({ userId: OWNER, designId, revision: 1 });
    expect(out.ok).toBe(true);
  });
});
