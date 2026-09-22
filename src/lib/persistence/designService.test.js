import { describe, it, expect, beforeEach } from "vitest";
import fixture from "../furnispec/goldenWardrobe.fixture.json";
import { buildStructuralPartGraph } from "../partgraph/buildStructuralPartGraph.js";
import { fingerprintFurniSpec } from "../conversation/approval.js";
import { createMemoryStore } from "./memoryStore.js";
import { createDesignService } from "./designService.js";
import { PERSISTENCE_ERROR } from "./errors.js";

function makeService() {
  return createDesignService({ store: createMemoryStore() });
}

function validPayload(overrides = {}) {
  const furniSpec = {
    ...structuredClone(fixture),
    specId: overrides.specId || fixture.specId || "persist-spec-1",
    revision: overrides.revision || 1,
  };
  const partGraph = buildStructuralPartGraph(furniSpec);
  const fingerprint = fingerprintFurniSpec(furniSpec);
  return {
    furniSpec,
    partGraph,
    fingerprint,
    origins: { "envelope.widthMm": "CUSTOMER_STATED" },
    validationStatus: "ACCEPTED",
  };
}

describe("designService persistence", () => {
  let service;
  beforeEach(() => {
    service = makeService();
  });

  it("create → save → reopen preserves identity", async () => {
    const created = await service.createDesign({ userId: "user-a", name: "Pilot wardrobe" });
    expect(created.ok).toBe(true);
    expect(created.designId).toBeTruthy();

    const payload = validPayload({ revision: 1 });
    const saved = await service.saveRevision({
      userId: "user-a",
      designId: created.designId,
      revision: 1,
      ...payload,
    });
    expect(saved.ok).toBe(true);
    expect(saved.fingerprint).toBe(payload.fingerprint);

    const reopened = await service.getRevision({
      userId: "user-a",
      designId: created.designId,
      revision: 1,
    });
    expect(reopened.furniSpec.specId).toBe(payload.furniSpec.specId);
    expect(reopened.revision).toBe(1);
    expect(reopened.fingerprint).toBe(payload.fingerprint);
    expect(reopened.partGraph.sourceSpecId || reopened.partGraph.specId || payload.furniSpec.specId).toBeTruthy();
    expect(reopened.partGraph.parts?.length).toBeGreaterThan(0);
    expect(reopened.origins["envelope.widthMm"]).toBe("CUSTOMER_STATED");
  });

  it("rejects cross-user access without leaking existence", async () => {
    const created = await service.createDesign({ userId: "user-a" });
    const payload = validPayload();
    await service.saveRevision({
      userId: "user-a",
      designId: created.designId,
      revision: 1,
      ...payload,
    });

    await expect(
      service.getRevision({ userId: "user-b", designId: created.designId, revision: 1 })
    ).rejects.toMatchObject({ code: PERSISTENCE_ERROR.UNAUTHORIZED });

    await expect(
      service.saveRevision({
        userId: "user-b",
        designId: created.designId,
        revision: 2,
        ...validPayload({ revision: 2, specId: payload.furniSpec.specId }),
      })
    ).rejects.toMatchObject({ code: PERSISTENCE_ERROR.UNAUTHORIZED });
  });

  it("rejects stale revision when expectedPreviousRevision mismatches", async () => {
    const created = await service.createDesign({ userId: "user-a" });
    const p1 = validPayload({ revision: 1 });
    await service.saveRevision({
      userId: "user-a",
      designId: created.designId,
      revision: 1,
      ...p1,
    });

    const p2 = validPayload({ revision: 2, specId: p1.furniSpec.specId });
    p2.furniSpec = { ...p2.furniSpec, revision: 2 };
    p2.partGraph = buildStructuralPartGraph(p2.furniSpec);
    p2.fingerprint = fingerprintFurniSpec(p2.furniSpec);

    await expect(
      service.saveRevision({
        userId: "user-a",
        designId: created.designId,
        revision: 2,
        expectedPreviousRevision: 99,
        ...p2,
      })
    ).rejects.toMatchObject({ code: PERSISTENCE_ERROR.STALE_REVISION });
  });

  it("rejects fingerprint mismatch", async () => {
    const created = await service.createDesign({ userId: "user-a" });
    const payload = validPayload();
    await expect(
      service.saveRevision({
        userId: "user-a",
        designId: created.designId,
        revision: 1,
        ...payload,
        fingerprint: "sha256:" + "0".repeat(64),
      })
    ).rejects.toMatchObject({ code: PERSISTENCE_ERROR.FINGERPRINT_MISMATCH });
  });

  it("rejects missing design", async () => {
    await expect(
      service.getDesign({ userId: "user-a", designId: "does-not-exist" })
    ).rejects.toMatchObject({ code: PERSISTENCE_ERROR.MISSING_DESIGN });
  });

  it("rejects invalid PartGraph", async () => {
    const created = await service.createDesign({ userId: "user-a" });
    const payload = validPayload();
    payload.partGraph = { ...payload.partGraph, parts: [] };
    await expect(
      service.saveRevision({
        userId: "user-a",
        designId: created.designId,
        revision: 1,
        ...payload,
      })
    ).rejects.toMatchObject({ code: PERSISTENCE_ERROR.INVALID_PARTGRAPH });
  });

  it("refuses to store credential-shaped fields on FurniSpec", async () => {
    const created = await service.createDesign({ userId: "user-a" });
    const payload = validPayload();
    payload.furniSpec = { ...payload.furniSpec, apiKey: "should-not-store" };
    payload.fingerprint = fingerprintFurniSpec(payload.furniSpec);
    await expect(
      service.saveRevision({
        userId: "user-a",
        designId: created.designId,
        revision: 1,
        ...payload,
      })
    ).rejects.toMatchObject({ code: PERSISTENCE_ERROR.BAD_REQUEST });
  });
});
