/**
 * What a saved revision is allowed to CONTAIN.
 *
 * WHY THIS FILE EXISTS
 *
 * `designService.test.js` proves the rules of the protocol — who may save,
 * in what order, with what fingerprint. `concurrency.test.js` proves the
 * protocol survives two writers and a retry. Neither asks the question those
 * both assume has already been answered: **is the thing being stored
 * internally consistent?**
 *
 * The fingerprint is computed FROM the submitted FurniSpec, so it proves the
 * spec was transmitted intact. It proves nothing about whether the spec is
 * valid, whether the PartGraph describes that spec, or whether the
 * provenance belongs to either of them. A revision that passes every existing
 * check can still be a valid spec bolted to a different design's geometry —
 * and once saved it is immutable, reopened as authoritative, and exported.
 *
 * Four concerns from code review, each reproduced here before it was fixed.
 *
 * Evidence class: B — real service, real validators and real compiler, store
 * in memory. No network.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { previewDraftWardrobe } from "../conversation/pipeline.js";
import { fingerprintFurniSpec } from "../conversation/approval.js";
import { createMemoryStore } from "./memoryStore.js";
import { createDesignService } from "./designService.js";
import { PERSISTENCE_ERROR } from "./errors.js";

const OWNER = "user-a";

/** A genuinely valid design, built by the authoritative pipeline. */
function design({ description, specId, revision = 1 }) {
  const d = previewDraftWardrobe({ description, specId, revision });
  expect(d.validation.valid, "precondition: the fixture design is valid").toBe(true);
  return d;
}

const DESIGN_A = () =>
  design({ description: "A wardrobe 1800 mm wide, 2400 mm high and 600 mm deep", specId: "spec-A" });
const DESIGN_B = () =>
  design({ description: "A wardrobe 2400 mm wide, 2400 mm high and 600 mm deep", specId: "spec-B" });

function payloadFrom(d) {
  return {
    furniSpec: d.spec,
    partGraph: d.partGraph,
    fingerprint: fingerprintFurniSpec(d.spec),
    origins: d.origins ?? {},
    validationStatus: "ACCEPTED",
  };
}

describe("a malformed FurniSpec is refused even when its fingerprint is correct", () => {
  let service;
  let designId;
  beforeEach(async () => {
    service = createDesignService({ store: createMemoryStore() });
    designId = (await service.createDesign({ userId: OWNER, name: "W" })).designId;
  });

  it("refuses a spec whose bays no longer add up, fingerprinted correctly", async () => {
    // The fingerprint is computed FROM the spec, so tampering with the spec
    // and re-fingerprinting produces a perfectly consistent pair. That pair
    // said nothing about validity, and the shape check only looked for
    // `envelope` and `specId` — it never ran the authoritative validator.
    const a = DESIGN_A();
    const broken = structuredClone(a.spec);
    broken.envelope.widthMm = 2000; // bays and doors still describe 1800

    const err = await service
      .saveRevision({
        userId: OWNER,
        designId,
        revision: 1,
        furniSpec: broken,
        partGraph: a.partGraph,
        fingerprint: fingerprintFurniSpec(broken), // correct for the broken spec
        validationStatus: "ACCEPTED",
      })
      .catch((e) => e);

    expect(err.code).toBe(PERSISTENCE_ERROR.INVALID_FURNISPEC);
    expect(err.status).toBe(400);
  });

  it("names what the validator objected to, rather than a bare refusal", async () => {
    const a = DESIGN_A();
    const broken = structuredClone(a.spec);
    broken.envelope.heightMm = 9999;

    const err = await service
      .saveRevision({
        userId: OWNER, designId, revision: 1,
        furniSpec: broken, partGraph: a.partGraph,
        fingerprint: fingerprintFurniSpec(broken),
      })
      .catch((e) => e);

    expect(err.code).toBe(PERSISTENCE_ERROR.INVALID_FURNISPEC);
    expect(Array.isArray(err.details?.errors), "the caller needs to know WHAT was wrong").toBe(true);
    expect(err.details.errors.length).toBeGreaterThan(0);
  });

  it("still accepts a spec the validator approves", async () => {
    const a = DESIGN_A();
    await expect(
      service.saveRevision({ userId: OWNER, designId, revision: 1, ...payloadFrom(a) })
    ).resolves.toMatchObject({ ok: true, revision: 1 });
  });
});

describe("a FurniSpec and a PartGraph from different designs are refused", () => {
  let service;
  let designId;
  beforeEach(async () => {
    service = createDesignService({ store: createMemoryStore() });
    designId = (await service.createDesign({ userId: OWNER, name: "W" })).designId;
  });

  it("refuses design A's spec carrying design B's geometry", async () => {
    // Both are individually valid and both pass their own validators. Stored
    // together they are a lie: the customer reopens 1800 mm and exports a
    // 2400 mm cutting list.
    const a = DESIGN_A();
    const b = DESIGN_B();

    const err = await service
      .saveRevision({
        userId: OWNER, designId, revision: 1,
        furniSpec: a.spec,
        partGraph: b.partGraph, // wrong design
        fingerprint: fingerprintFurniSpec(a.spec),
      })
      .catch((e) => e);

    expect(err.code).toBe(PERSISTENCE_ERROR.INVALID_PARTGRAPH);
    expect(err.message).toMatch(/does not describe|mismatch/i);
  });

  it("refuses a PartGraph whose envelope disagrees with the spec", async () => {
    const a = DESIGN_A();
    const b = DESIGN_B();
    // Same specId, so an id check alone would pass — only the dimensions differ.
    const disguised = structuredClone(b.partGraph);
    disguised.sourceSpecId = a.spec.specId;
    disguised.sourceRevision = a.spec.revision;

    const err = await service
      .saveRevision({
        userId: OWNER, designId, revision: 1,
        furniSpec: a.spec, partGraph: disguised,
        fingerprint: fingerprintFurniSpec(a.spec),
      })
      .catch((e) => e);

    expect(err.code).toBe(PERSISTENCE_ERROR.INVALID_PARTGRAPH);
    expect(err.details?.envelope, "the caller needs to see which dimension disagreed").toBeTruthy();
  });

  it("refuses a PartGraph built from a different revision of the same spec", async () => {
    const a = DESIGN_A();
    const stale = structuredClone(a.partGraph);
    stale.sourceRevision = 99;

    const err = await service
      .saveRevision({
        userId: OWNER, designId, revision: 1,
        furniSpec: a.spec, partGraph: stale,
        fingerprint: fingerprintFurniSpec(a.spec),
      })
      .catch((e) => e);

    expect(err.code).toBe(PERSISTENCE_ERROR.INVALID_PARTGRAPH);
  });
});

describe("an unsupported component is refused even in a structurally valid PartGraph", () => {
  let service;
  let designId;
  beforeEach(async () => {
    service = createDesignService({ store: createMemoryStore() });
    designId = (await service.createDesign({ userId: OWNER, name: "W" })).designId;
  });

  it("refuses a graph whose ledger records an UNSUPPORTED outcome", async () => {
    // The compiler records components it could not represent in
    // `componentOutcomes` and counts them in `summary.unsupportedComponents`,
    // while the graph itself still validates — that is the point of a
    // diagnostic graph. Saving one stores a design that is missing parts of
    // what the customer asked for, with nothing in the record saying so.
    const a = DESIGN_A();
    const diagnostic = structuredClone(a.partGraph);
    diagnostic.componentOutcomes = [
      ...(diagnostic.componentOutcomes ?? []),
      {
        componentId: "c-99",
        componentType: "SLIDING_DOOR",
        bayIndex: 0,
        outcome: "UNSUPPORTED",
        diagnosticCode: "M2-OMIT-SLIDING",
        reason: "Sliding doors are not represented by the kernel.",
      },
    ];
    diagnostic.summary = {
      ...diagnostic.summary,
      unsupportedComponents: (diagnostic.summary.unsupportedComponents ?? 0) + 1,
    };

    const err = await service
      .saveRevision({
        userId: OWNER, designId, revision: 1,
        furniSpec: a.spec, partGraph: diagnostic,
        fingerprint: fingerprintFurniSpec(a.spec),
      })
      .catch((e) => e);

    expect(err.code).toBe(PERSISTENCE_ERROR.UNSUPPORTED_COMPONENT);
    expect(err.status).toBe(400);
    expect(err.details?.unsupported?.length, "name what could not be represented").toBeGreaterThan(0);
  });

  it("accepts a graph whose ledger records no unsupported component", async () => {
    const a = DESIGN_A();
    expect(a.partGraph.summary.unsupportedComponents ?? 0).toBe(0);
    await expect(
      service.saveRevision({ userId: OWNER, designId, revision: 1, ...payloadFrom(a) })
    ).resolves.toMatchObject({ ok: true });
  });
});

describe("idempotent equivalence covers every persisted field, not the spec alone", () => {
  let service;
  let designId;
  beforeEach(async () => {
    service = createDesignService({ store: createMemoryStore() });
    designId = (await service.createDesign({ userId: OWNER, name: "W" })).designId;
  });

  it("treats a byte-identical resend as the replay it is", async () => {
    const a = DESIGN_A();
    const body = payloadFrom(a);
    const first = await service.saveRevision({ userId: OWNER, designId, revision: 1, ...body });
    const replay = await service.saveRevision({ userId: OWNER, designId, revision: 1, ...body });

    expect(replay.idempotentReplay).toBe(true);
    expect(replay.fingerprint).toBe(first.fingerprint);
  });

  it("refuses a 'replay' carrying a DIFFERENT PartGraph under the same spec fingerprint", async () => {
    // The fingerprint covers the FurniSpec only. Two requests can agree on it
    // and disagree about the geometry actually being stored. Reporting the
    // second as an exact save of the first is a false statement about what is
    // in the database.
    const a = DESIGN_A();
    await service.saveRevision({ userId: OWNER, designId, revision: 1, ...payloadFrom(a) });

    const tampered = structuredClone(a.partGraph);
    tampered.parts = tampered.parts.slice(0, -1); // one panel short

    const err = await service
      .saveRevision({
        userId: OWNER, designId, revision: 1,
        furniSpec: a.spec, partGraph: tampered,
        fingerprint: fingerprintFurniSpec(a.spec), // identical
      })
      .catch((e) => e);

    expect(err, "a differing body must not be reported as an exact save").toBeInstanceOf(Error);
    expect(err.code).not.toBe(undefined);
    expect(err.idempotentReplay).toBeUndefined();
  });

  it("refuses a 'replay' whose provenance differs", async () => {
    const a = DESIGN_A();
    await service.saveRevision({
      userId: OWNER, designId, revision: 1, ...payloadFrom(a),
      origins: { "envelope.widthMm": "CUSTOMER_STATED" },
    });

    const err = await service
      .saveRevision({
        userId: OWNER, designId, revision: 1,
        furniSpec: a.spec, partGraph: a.partGraph,
        fingerprint: fingerprintFurniSpec(a.spec),
        origins: { "envelope.widthMm": "GOLDEN_DEFAULT" }, // different provenance
      })
      .catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.idempotentReplay).toBeUndefined();
  });

  it("refuses a 'replay' whose validationStatus differs", async () => {
    const a = DESIGN_A();
    await service.saveRevision({ userId: OWNER, designId, revision: 1, ...payloadFrom(a) });

    const err = await service
      .saveRevision({
        userId: OWNER, designId, revision: 1,
        ...payloadFrom(a),
        validationStatus: "PROVISIONAL",
      })
      .catch((e) => e);

    expect(err).toBeInstanceOf(Error);
  });

  it("stores exactly the geometry it was given, never a recompiled substitute", async () => {
    // "Do not silently replace supplied geometry while reporting an exact
    // save." If the server ever recompiles, the stored PartGraph must still
    // be the caller's — or the save must be refused. It may not quietly
    // differ from what the caller believes it stored.
    const a = DESIGN_A();
    await service.saveRevision({ userId: OWNER, designId, revision: 1, ...payloadFrom(a) });
    const reopened = await service.getRevision({ userId: OWNER, designId, revision: 1 });

    expect(JSON.stringify(reopened.partGraph)).toBe(JSON.stringify(a.partGraph));
    expect(JSON.stringify(reopened.furniSpec)).toBe(JSON.stringify(a.spec));
  });
});

describe("another owner's design is indistinguishable from one that does not exist", () => {
  it("answers identically for a real design owned by someone else and a fabricated id", async () => {
    // The point is not merely that both are refused — it is that the two
    // refusals are BYTE-IDENTICAL. Any difference in code, status or message
    // is an existence oracle: anyone holding an id learns whether it is real.
    const service = createDesignService({ store: createMemoryStore() });
    const ownersDesign = (await service.createDesign({ userId: OWNER, name: "A" })).designId;
    await service.saveRevision({ userId: OWNER, designId: ownersDesign, revision: 1, ...payloadFrom(DESIGN_A()) });

    const probe = async (designId) => {
      const results = [];
      for (const call of [
        () => service.getDesign({ userId: "user-b", designId }),
        () => service.listRevisions({ userId: "user-b", designId }),
        () => service.getRevision({ userId: "user-b", designId, revision: 1 }),
      ]) {
        const e = await call().catch((x) => x);
        results.push({ code: e.code, status: e.status, message: e.message });
      }
      return results;
    };

    const real = await probe(ownersDesign);
    const fake = await probe("00000000-0000-4000-8000-000000000000");

    expect(JSON.stringify(real)).toBe(JSON.stringify(fake));
    for (const r of real) {
      expect(r.code).toBe(PERSISTENCE_ERROR.MISSING_DESIGN);
      expect(r.status).toBe(404);
    }
  });

  it("refuses a cross-owner WRITE with the same 404, writing nothing", async () => {
    const store = createMemoryStore();
    const service = createDesignService({ store });
    const ownersDesign = (await service.createDesign({ userId: OWNER, name: "A" })).designId;
    await service.saveRevision({ userId: OWNER, designId: ownersDesign, revision: 1, ...payloadFrom(DESIGN_A()) });
    const before = (await store.listRevisions(ownersDesign)).length;

    const err = await service
      .saveRevision({
        userId: "user-b", designId: ownersDesign, revision: 2,
        expectedPreviousRevision: 1, ...payloadFrom(DESIGN_A()),
      })
      .catch((e) => e);

    expect(err.code).toBe(PERSISTENCE_ERROR.MISSING_DESIGN);
    expect(err.status).toBe(404);
    expect((await store.listRevisions(ownersDesign)).length).toBe(before);
  });
});
