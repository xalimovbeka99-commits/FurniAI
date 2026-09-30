import { describe, expect, it, vi } from "vitest";
import {
  createDesignsApiClient,
  mapDesignsApiError,
  DesignsApiError,
  DESIGNS_API_ERROR,
} from "./designsApiClient.js";

describe("mapDesignsApiError", () => {
  it("prefers server code and customer-safe error text", () => {
    const err = mapDesignsApiError(409, {
      ok: false,
      code: "STALE_REVISION",
      error: "Expected previous revision 2.",
      details: { concurrent: true },
    });
    expect(err).toBeInstanceOf(DesignsApiError);
    expect(err.code).toBe(DESIGNS_API_ERROR.STALE_REVISION);
    expect(err.status).toBe(409);
    expect(err.message).toBe("Expected previous revision 2.");
    expect(err.details).toEqual({ concurrent: true });
  });

  it("maps bare HTTP statuses when body has no code", () => {
    expect(mapDesignsApiError(401, null).code).toBe(DESIGNS_API_ERROR.MISSING_AUTH);
    expect(mapDesignsApiError(404, {}).code).toBe(DESIGNS_API_ERROR.MISSING_DESIGN);
    expect(mapDesignsApiError(503, { error: "down" }).code).toBe(
      DESIGNS_API_ERROR.STORAGE_UNAVAILABLE
    );
    expect(mapDesignsApiError(503, { error: "down" }).message).toBe("down");
  });
});

describe("createDesignsApiClient request shaping", () => {
  it("POSTs createDesign with Bearer token and JSON name", async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      expect(url).toBe("/api/designs");
      expect(init.method).toBe("POST");
      expect(init.headers.Authorization).toBe("Bearer tok-abc");
      expect(init.headers["Content-Type"]).toBe("application/json");
      expect(JSON.parse(init.body)).toEqual({ name: "Bedroom wardrobe" });
      return {
        ok: true,
        status: 201,
        text: async () =>
          JSON.stringify({
            ok: true,
            designId: "d1",
            name: "Bedroom wardrobe",
            latestRevision: null,
          }),
      };
    });
    const client = createDesignsApiClient({ fetchImpl });
    const out = await client.createDesign({ name: "Bedroom wardrobe", token: "tok-abc" });
    expect(out.designId).toBe("d1");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("POSTs saveAcceptedRevision with expectedPreviousRevision and ACCEPTED status", async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      expect(url).toBe("/api/designs/d1/revisions");
      expect(init.method).toBe("POST");
      const body = JSON.parse(init.body);
      expect(body).toEqual({
        revision: 2,
        expectedPreviousRevision: 1,
        fingerprint: "fs256:abc",
        furniSpec: { specId: "s1", revision: 2 },
        partGraph: { parts: [] },
        origins: { "envelope.widthMm": "CUSTOMER_STATED" },
        validationStatus: "ACCEPTED",
      });
      return {
        ok: true,
        status: 201,
        text: async () =>
          JSON.stringify({ ok: true, designId: "d1", revision: 2 }),
      };
    });
    const client = createDesignsApiClient({ fetchImpl });
    await client.saveAcceptedRevision({
      designId: "d1",
      revision: 2,
      expectedPreviousRevision: 1,
      fingerprint: "fs256:abc",
      furniSpec: { specId: "s1", revision: 2 },
      partGraph: { parts: [] },
      origins: { "envelope.widthMm": "CUSTOMER_STATED" },
      token: "tok",
    });
  });

  it("sends expectedPreviousRevision null for first revision", async () => {
    const fetchImpl = vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body);
      expect(body.revision).toBe(1);
      expect(body.expectedPreviousRevision).toBeNull();
      return {
        ok: true,
        status: 201,
        text: async () => JSON.stringify({ ok: true, revision: 1 }),
      };
    });
    const client = createDesignsApiClient({ fetchImpl });
    await client.saveAcceptedRevision({
      designId: "d1",
      revision: 1,
      expectedPreviousRevision: null,
      fingerprint: "fs256:x",
      furniSpec: {},
      partGraph: {},
      token: "tok",
    });
  });

  it("GETs revision and design with auth header only", async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      expect(init.method).toBe("GET");
      expect(init.headers.Authorization).toBe("Bearer tok");
      expect(init.body).toBeUndefined();
      expect(init.headers["Content-Type"]).toBeUndefined();
      if (url.endsWith("/revisions/3")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({ ok: true, designId: "d1", revision: 3, furniSpec: {} }),
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            ok: true,
            design: { designId: "d1" },
            latestRevision: { revision: 3 },
          }),
      };
    });
    const client = createDesignsApiClient({ fetchImpl });
    const rev = await client.getRevision({ designId: "d1", revision: 3, token: "tok" });
    expect(rev.revision).toBe(3);
    const design = await client.getDesign({ designId: "d1", token: "tok" });
    expect(design.latestRevision.revision).toBe(3);
  });

  it("throws DesignsApiError on fail-closed response without rolling network success", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 409,
      text: async () =>
        JSON.stringify({
          ok: false,
          code: "FINGERPRINT_MISMATCH",
          error: "Fingerprint did not match.",
          details: { expectedFingerprint: "fs256:good" },
        }),
    }));
    const client = createDesignsApiClient({ fetchImpl });
    await expect(
      client.createDesign({ name: "x", token: "tok" })
    ).rejects.toMatchObject({
      name: "DesignsApiError",
      code: "FINGERPRINT_MISMATCH",
      status: 409,
    });
  });

  it("refuses missing token before fetch", async () => {
    const fetchImpl = vi.fn();
    const client = createDesignsApiClient({ fetchImpl });
    await expect(client.listDesigns({ token: "" })).rejects.toMatchObject({
      code: DESIGNS_API_ERROR.MISSING_AUTH,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
