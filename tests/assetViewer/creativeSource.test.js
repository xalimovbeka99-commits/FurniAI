/**
 * createCreativeAssetSource against the SIMULATED /api/creative stand-in
 * (fixtures only, not Scenario) and hand-built error bodies.
 */
import { describe, expect, it } from "vitest";
import {
  createCreativeAssetSource,
  creativeFilename,
  DEFAULT_CONCEPT_NOTICE,
  ERROR_MESSAGE,
  isRetryableResolveError,
  mapCreativeError,
  normalizeConcept,
  normalizeCreativeFormat,
  safeJobMessage,
} from "../../src/lib/assetViewer/index.js";
import { createCreativeStandIn, SIM_CONCEPT } from "./helpers/creativeStandIn.js";
import { simFiles } from "./helpers/creativeHarness.js";

function jsonFetch(status, body) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    return new Response(body === undefined ? "<html>proxy error</html>" : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
  fn.calls = calls;
  return fn;
}

describe("createCreativeAssetSource.resolve", () => {
  it("GET ?resource=asset&jobId=&index= with a fresh Bearer token on every call; distinct urls, nothing cached", async () => {
    const sim = createCreativeStandIn({ files: simFiles() });
    const seen = [];
    let tokenN = 0;
    const src = createCreativeAssetSource({
      fetchImpl: (url, init) => {
        seen.push({ url, init });
        return sim.fetch(url, init);
      },
      getAuthToken: async () => {
        tokenN += 1;
        return "sim-token";
      },
    });
    const a = await src.resolve("sim-glb-chair", 0);
    const b = await src.resolve("sim-glb-chair", 0);
    expect(seen).toHaveLength(2);
    expect(tokenN).toBe(2);
    for (const s of seen) {
      expect(s.url).toBe("/api/creative?resource=asset&jobId=sim-glb-chair&index=0");
      expect(s.init.headers.Authorization).toBe("Bearer sim-token");
      expect(s.init.cache).toBe("no-store");
      expect(s.init.method).toBe("GET");
    }
    expect(a.url).not.toBe(b.url);
    expect(a).toMatchObject({
      jobId: "sim-glb-chair",
      index: 0,
      format: "glb",
      mimeType: "model/gltf-binary",
      filename: "furniai-concept-sim-glb-chair-0.glb",
      expiresAt: null,
      expiryKnown: false,
      durableCopy: false,
      concept: { ...SIM_CONCEPT, noticeSource: "server" },
    });
    expect(Object.isFrozen(src)).toBe(true);
    expect(Object.keys(src).sort()).toEqual(["baseUrl", "getJob", "kind", "resolve"]);
  });

  it("no token -> SIGN_IN_REQUIRED without sending a request; a throwing getAuthToken too", async () => {
    const f = jsonFetch(200, {});
    for (const getAuthToken of [() => null, () => "", async () => undefined, () => {
      throw new Error("session store broken");
    }]) {
      const src = createCreativeAssetSource({ fetchImpl: f, getAuthToken });
      await expect(src.resolve("j1", 0)).rejects.toMatchObject({ code: "SIGN_IN_REQUIRED", message: ERROR_MESSAGE.SIGN_IN_REQUIRED });
    }
    expect(f.calls).toHaveLength(0);
  });

  it("rejects bad jobId/index before any request", async () => {
    const f = jsonFetch(200, {});
    const src = createCreativeAssetSource({ fetchImpl: f, getAuthToken: () => "t" });
    await expect(src.resolve("", 0)).rejects.toMatchObject({ code: "INVALID_ASSET" });
    await expect(src.resolve("j", -1)).rejects.toMatchObject({ code: "INVALID_ASSET" });
    await expect(src.resolve("j", 1.5)).rejects.toMatchObject({ code: "INVALID_ASSET" });
    expect(f.calls).toHaveLength(0);
  });

  it("custom baseUrl; index defaults to 0", async () => {
    const f = jsonFetch(200, { ok: true, asset: { jobId: "j", index: 0, url: "https://x.invalid/a.glb", format: "GLB", concept: SIM_CONCEPT } });
    const src = createCreativeAssetSource({ fetchImpl: f, getAuthToken: () => "t", baseUrl: "https://app.example/api/creative" });
    const d = await src.resolve("j");
    expect(f.calls[0].url).toBe("https://app.example/api/creative?resource=asset&jobId=j&index=0");
    expect(d.format).toBe("glb");
  });

  it("malformed ok bodies -> RESOLVE_MALFORMED, cause 'malformed', not retryable (no url, non-http url, other job, non-JSON 200)", async () => {
    const bodies = [
      { ok: true, asset: { jobId: "j", index: 0, format: "glb" } },
      { ok: true, asset: { jobId: "j", index: 0, url: "javascript:alert(1)", format: "glb" } },
      { ok: true, asset: { jobId: "other", index: 0, url: "https://x.invalid/a.glb" } },
      { ok: true, asset: { jobId: "j", index: 3, url: "https://x.invalid/a.glb" } },
      { ok: true },
      { ok: false, code: "MISSING_JOB" }, // an error body behind a 200 is not an answer either
      undefined,
    ];
    for (const b of bodies) {
      const src = createCreativeAssetSource({ fetchImpl: jsonFetch(200, b), getAuthToken: () => "t" });
      const e = await src.resolve("j", 0).catch((x) => x);
      expect(e).toMatchObject({ code: "RESOLVE_MALFORMED", message: ERROR_MESSAGE.RESOLVE_MALFORMED, details: { cause: "malformed", retryable: false } });
      expect(isRetryableResolveError(e)).toBe(false);
    }
    const g = createCreativeAssetSource({ fetchImpl: jsonFetch(200, { ok: true }), getAuthToken: () => "t" });
    await expect(g.getJob("j")).rejects.toMatchObject({ code: "RESOLVE_MALFORMED", details: { cause: "malformed" } });
  });

  it("network error -> RESOLVE_FAILED, cause 'network', retryable, with any address redacted from detail", async () => {
    const src = createCreativeAssetSource({
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch https://cdn.example/secret?X-Sig=abc");
      },
      getAuthToken: () => "t",
    });
    const e = await src.resolve("j", 0).catch((x) => x);
    expect(e.code).toBe("RESOLVE_FAILED");
    expect(e.details).toEqual({ cause: "network", retryable: true });
    expect(isRetryableResolveError(e)).toBe(true);
    expect(e.detail).not.toMatch(/https?:|X-Sig/);
  });
});

describe("error mapping switches on `code`, not message text or bare status", () => {
  const cases = [
    [401, "MISSING_AUTH", "SIGN_IN_REQUIRED"],
    [403, "UNAUTHORIZED", "FORBIDDEN"],
    [403, "FORBIDDEN", "FORBIDDEN"],
    [503, "AUTH_UNAVAILABLE", "SIGN_IN_UNAVAILABLE"],
    [503, "PERSISTENCE_NOT_CONFIGURED", "CONCEPTS_NOT_CONFIGURED"],
    [503, "CREATIVE_NOT_CONFIGURED", "CONCEPTS_NOT_CONFIGURED"],
    [503, "CREATIVE_STORE_NOT_CONFIGURED", "CONCEPTS_NOT_CONFIGURED"],
    [503, "CREATIVE_GENERATION_DISABLED", "CONCEPTS_NOT_CONFIGURED"],
    [503, "STORAGE_UNAVAILABLE", "SERVICE_UNAVAILABLE"],
    [404, "MISSING_JOB", "CONCEPT_NOT_FOUND"],
    [409, "ASSET_NOT_READY", "ASSET_NOT_READY"],
    [409, "RECORD_INTEGRITY_FAILED", "RECORD_INTEGRITY_FAILED"],
    [410, "ASSET_UNAVAILABLE", "ASSET_UNAVAILABLE"],
    [400, "BAD_REQUEST", "INVALID_ASSET"],
    [502, "PROVIDER_UNAVAILABLE", "PROVIDER_UNAVAILABLE"],
    [502, "PROVIDER_AUTH_REJECTED", "PROVIDER_UNAVAILABLE"],
    [502, "PROVIDER_UNEXPECTED_RESPONSE", "PROVIDER_UNAVAILABLE"],
    [502, "PROVIDER_REJECTED_REQUEST", "PROVIDER_UNAVAILABLE"],
    [429, "PROVIDER_RATE_LIMITED", "PROVIDER_UNAVAILABLE"],
    [402, "PROVIDER_INSUFFICIENT_CREDITS", "PROVIDER_UNAVAILABLE"],
    [500, "INTERNAL", "RESOLVE_FAILED"],
    [418, "SOMETHING_NEW", "RESOLVE_FAILED"],
  ];
  it.each(cases)("HTTP %i %s -> %s, customer-safe message, server code kept for logs", async (status, code, viewerCode) => {
    // Message text deliberately misleading: mapping must not read it.
    const body = { ok: false, code, error: "Sign in is required to save or open a design.", details: { jobStatus: "processing" } };
    const src = createCreativeAssetSource({ fetchImpl: jsonFetch(status, body), getAuthToken: () => "t" });
    const e = await src.resolve("j", 0).catch((x) => x);
    expect(e.code).toBe(viewerCode);
    expect(e.serverCode).toBe(code);
    expect(e.status).toBe(status);
    expect(e.message).toBe(ERROR_MESSAGE[viewerCode]);
    expect(e.message).not.toContain(code);
    expect(e.message).not.toMatch(/design|three|gltf|webgl|undefined|null/i);
    expect(e.jobStatus).toBe("processing");
    expect(e.details).toEqual({ cause: "http", retryable: RETRYABLE.has(code) });
  });

  // The viewer's default resolve-retry rule (V1): network, 5xx and 429 only, minus states a retry can't change.
  const RETRYABLE = new Set([
    "AUTH_UNAVAILABLE",
    "STORAGE_UNAVAILABLE",
    "PROVIDER_UNAVAILABLE",
    "PROVIDER_AUTH_REJECTED",
    "PROVIDER_UNEXPECTED_RESPONSE",
    "PROVIDER_REJECTED_REQUEST",
    "PROVIDER_RATE_LIMITED",
    "INTERNAL",
  ]);

  it("isRetryableResolveError: retry network/5xx/429; never 401/402/403/404/409/410, not-configured, malformed or abort", () => {
    expect(isRetryableResolveError(mapCreativeError(502, null))).toBe(true);
    expect(isRetryableResolveError(mapCreativeError(503, null))).toBe(true);
    expect(isRetryableResolveError(mapCreativeError(429, null))).toBe(true);
    for (const st of [400, 401, 402, 403, 404, 409, 410, 418]) expect(isRetryableResolveError(mapCreativeError(st, null)), String(st)).toBe(false);
    expect(isRetryableResolveError(mapCreativeError(503, { code: "CREATIVE_NOT_CONFIGURED" }))).toBe(false);
    expect(isRetryableResolveError(mapCreativeError(500, { code: "RECORD_INTEGRITY_FAILED" }))).toBe(false); // the code wins over a wrong status
    const abort = new Error("aborted");
    abort.name = "AbortError";
    for (const x of [abort, null, undefined, "x", new Error("plain"), { code: "SIGN_IN_REQUIRED" }]) expect(isRetryableResolveError(x)).toBe(false);
    // a custom source without details.cause: the HTTP status decides
    expect(isRetryableResolveError({ code: "SERVICE_UNAVAILABLE", status: 503 })).toBe(true);
    expect(isRetryableResolveError({ code: "ASSET_UNAVAILABLE", status: 410 })).toBe(false);
  });

  it("403 is never 'signed out': FORBIDDEN with an honest message, distinct from 401 (V4)", async () => {
    for (const body of [{ ok: false, code: "UNAUTHORIZED", error: "x" }, { ok: false, code: "FORBIDDEN" }, null]) {
      const src = createCreativeAssetSource({ fetchImpl: jsonFetch(403, body === null ? undefined : body), getAuthToken: () => "t" });
      const e = await src.resolve("j", 0).catch((x) => x);
      expect(e).toMatchObject({ code: "FORBIDDEN", status: 403, message: ERROR_MESSAGE.FORBIDDEN, details: { cause: "http", retryable: false } });
      expect(e.message).not.toBe(ERROR_MESSAGE.SIGN_IN_REQUIRED);
      expect(e.message).not.toMatch(/please sign in/i);
    }
    expect(mapCreativeError(401, null).code).toBe("SIGN_IN_REQUIRED");
  });

  it("the two 409s are told apart by code", () => {
    expect(mapCreativeError(409, { code: "ASSET_NOT_READY" }).code).toBe("ASSET_NOT_READY");
    expect(mapCreativeError(409, { code: "RECORD_INTEGRITY_FAILED" }).code).toBe("RECORD_INTEGRITY_FAILED");
  });

  it("no code at all (proxy/HTML error page) falls back to HTTP status class", () => {
    expect(mapCreativeError(401, null).code).toBe("SIGN_IN_REQUIRED");
    expect(mapCreativeError(403, null).code).toBe("FORBIDDEN");
    expect(mapCreativeError(404, null).code).toBe("CONCEPT_NOT_FOUND");
    expect(mapCreativeError(410, {}).code).toBe("ASSET_UNAVAILABLE");
    expect(mapCreativeError(503, null).code).toBe("SERVICE_UNAVAILABLE");
    expect(mapCreativeError(502, null).code).toBe("SERVICE_UNAVAILABLE");
    expect(mapCreativeError(409, null).code).toBe("RESOLVE_FAILED");
  });

  it("against the stand-in: unknown job, wrong token, integrity, gone, not ready, out-of-range index", async () => {
    const sim = createCreativeStandIn({ files: simFiles() });
    const good = createCreativeAssetSource({ fetchImpl: sim.fetch, getAuthToken: () => "sim-token" });
    const bad = createCreativeAssetSource({ fetchImpl: sim.fetch, getAuthToken: () => "expired-token" });
    await expect(good.resolve("nope", 0)).rejects.toMatchObject({ code: "CONCEPT_NOT_FOUND", serverCode: "MISSING_JOB", status: 404 });
    await expect(bad.resolve("sim-glb-chair", 0)).rejects.toMatchObject({ code: "SIGN_IN_REQUIRED", serverCode: "MISSING_AUTH", status: 401 });
    await expect(good.resolve("sim-integrity", 0)).rejects.toMatchObject({ code: "RECORD_INTEGRITY_FAILED", status: 409 });
    await expect(good.resolve("sim-gone", 0)).rejects.toMatchObject({ code: "ASSET_UNAVAILABLE", status: 410 });
    await expect(good.resolve("sim-processing", 0)).rejects.toMatchObject({ code: "ASSET_NOT_READY", jobStatus: "processing" });
    await expect(good.resolve("sim-glb-chair", 5)).rejects.toMatchObject({ code: "ASSET_NOT_READY", jobStatus: "succeeded" });
    sim.failNext({ resource: "asset", status: 503, code: "AUTH_UNAVAILABLE" });
    await expect(good.resolve("sim-glb-chair", 0)).rejects.toMatchObject({ code: "SIGN_IN_UNAVAILABLE" });
    sim.failNext({ resource: "asset", status: 503, code: "PERSISTENCE_NOT_CONFIGURED" });
    await expect(good.resolve("sim-glb-chair", 0)).rejects.toMatchObject({ code: "CONCEPTS_NOT_CONFIGURED" });
  });
});

describe("getJob", () => {
  it("returns { job, refresh } with Bearer auth; maps errors", async () => {
    const sim = createCreativeStandIn({ files: simFiles() });
    const calls = [];
    const src = createCreativeAssetSource({ fetchImpl: (u, i) => (calls.push({ u, i }), sim.fetch(u, i)), getAuthToken: () => "sim-token" });
    const r = await src.getJob("sim-glb-chair");
    expect(calls[0].u).toBe("/api/creative?resource=jobs&jobId=sim-glb-chair");
    expect(calls[0].i.headers.Authorization).toBe("Bearer sim-token");
    expect(r.job).toMatchObject({ jobId: "sim-glb-chair", status: "succeeded", outputs: [{ index: 0, format: "glb" }] });
    expect(r.refresh).toEqual({ ok: true });
    await expect(src.getJob("missing")).rejects.toMatchObject({ code: "CONCEPT_NOT_FOUND" });
  });
});

describe("helpers", () => {
  it("normalizeConcept: server notice kept; missing/blank -> strict default; flags default false", () => {
    expect(normalizeConcept(SIM_CONCEPT)).toEqual({ ...SIM_CONCEPT, noticeSource: "server" });
    for (const c of [undefined, null, {}, { notice: "   " }, { notice: 42 }, "x"]) {
      const n = normalizeConcept(c);
      expect(n).toEqual({ kind: "visual_concept", editable: false, dimensionsVerified: false, partsSeparable: false, manufacturable: false, notice: DEFAULT_CONCEPT_NOTICE, noticeSource: "viewer-default" });
    }
    expect(DEFAULT_CONCEPT_NOTICE).toMatch(/AI-generated visual concept/);
    expect(DEFAULT_CONCEPT_NOTICE).toMatch(/no verified measurements/);
  });

  it("V3: the fallback notice is the server's CONCEPT_NOTICE text exactly (creativeService.js @ 7f42f95)", () => {
    expect(DEFAULT_CONCEPT_NOTICE).toBe(SIM_CONCEPT.notice);
    expect(DEFAULT_CONCEPT_NOTICE).toBe(
      "AI-generated visual concept. Not a FurniAI design: it has no verified measurements, no separately editable doors or panels, and cannot be manufactured from.",
    );
  });

  it("V3: a server notice is kept verbatim (no trimming, collapsing or truncation)", () => {
    const odd = `  Server wording v9:\n  AI concept,   NOT a design.  ${"x".repeat(700)} `;
    expect(normalizeConcept({ notice: odd })).toMatchObject({ notice: odd, noticeSource: "server" });
  });

  it("formats: only the backend's list, lower-cased; anything else is null", () => {
    expect(["glb", "GLTF", "fbx", "obj", "usdz", "stl", "ply", "zip"].map(normalizeCreativeFormat)).toEqual(["glb", "gltf", "fbx", "obj", "usdz", "stl", "ply", "zip"]);
    expect([null, undefined, "", "blend", "3mf", 7].map(normalizeCreativeFormat)).toEqual([null, null, null, null, null, null]);
  });

  it("filename derives from jobId/index/format, never from the provider address", () => {
    expect(creativeFilename("4f1c-uuid", 0, "glb")).toBe("furniai-concept-4f1c-uuid-0.glb");
    expect(creativeFilename("a/b\\c", 2, "fbx")).toBe("furniai-concept-a_b_c-2.fbx");
    expect(creativeFilename("j", 1, null)).toBe("furniai-concept-j-1.bin");
  });

  it("safeJobMessage: single line, <=300 chars, never echoes an address", () => {
    expect(safeJobMessage("  The generation\nfailed. ")).toBe("The generation failed.");
    expect(safeJobMessage("x".repeat(400))).toHaveLength(300);
    expect(safeJobMessage("see https://cdn.example/x")).toBeNull();
    expect(safeJobMessage("")).toBeNull();
    expect(safeJobMessage(null)).toBeNull();
  });
});
