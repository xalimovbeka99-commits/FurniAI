import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mountForTest, THREE } from "./helpers/mountHarness.js";
import { createFakeFetch, fixtureArrayBuffer, installImageBitmapShim } from "./helpers/fixtures.js";
import { ERROR_CODE, ERROR_MESSAGE, FETCH_FAILED_MESSAGE, INVALID_FILE_MESSAGE, mountAssetViewer } from "../../src/lib/assetViewer/index.js";
import { createFakeDocument } from "./helpers/fakeDom.js";

let shim;
beforeAll(() => (shim = installImageBitmapShim()));
afterAll(() => shim.restore());

/** v3: `reason` picks the honest sub-message (FETCH_FAILED_MESSAGE / INVALID_FILE_MESSAGE); none = the code's own. */
async function expectError(t, asset, code, reason) {
  const res = await t.viewer.load(asset);
  expect(res.ok).toBe(false);
  expect(res.error.code).toBe(code);
  const s = t.viewer.getState();
  expect(s.status).toBe("error");
  expect(s.error.code).toBe(code);
  const msg = reason ? (code === "FETCH_FAILED" ? FETCH_FAILED_MESSAGE : INVALID_FILE_MESSAGE)[reason] : ERROR_MESSAGE[code];
  expect(msg).toBeTruthy();
  if (reason) expect(s.error.reason).toBe(reason);
  expect(s.error.message).toBe(msg);
  expect(s.model).toBeNull();
  expect(t.errors.at(-1)).toMatchObject({ code, message: msg });
  expect(t.container.find("data-av-status").textContent).toBe(msg);
  return s.error;
}

describe("error codes", () => {
  it("every code has a customer-safe message that does not leak the code", () => {
    for (const code of Object.values(ERROR_CODE)) {
      expect(ERROR_MESSAGE[code]).toMatch(/\w/);
      expect(ERROR_MESSAGE[code]).not.toContain(code);
      expect(ERROR_MESSAGE[code]).not.toMatch(/three|gltf|webgl_|undefined|null/i);
    }
  });

  it("corrupt GLB -> PARSE_FAILED (with developer detail)", async () => {
    const t = mountForTest();
    const err = await expectError(t, { arrayBuffer: fixtureArrayBuffer("corrupt.glb"), filename: "corrupt.glb" }, "PARSE_FAILED", "truncated");
    expect(err.detail).toBeTruthy();
    t.viewer.dispose();
  });

  it("garbage bytes named .glb -> PARSE_FAILED (hint says glb, content is not)", async () => {
    const t = mountForTest();
    await expectError(t, { arrayBuffer: new TextEncoder().encode("not a model at all").buffer, filename: "x.glb" }, "PARSE_FAILED", "bad-magic");
    t.viewer.dispose();
  });

  it("valid glTF with an empty scene -> EMPTY_SCENE", async () => {
    const t = mountForTest();
    await expectError(t, { arrayBuffer: fixtureArrayBuffer("empty-scene.gltf"), filename: "empty-scene.gltf" }, "EMPTY_SCENE");
    t.viewer.dispose();
  });

  it("adapter returning geometry with zero-size bounds -> EMPTY_SCENE and the root is disposed", async () => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
    let disposed = 0;
    geom.addEventListener("dispose", () => disposed++);
    const point = { id: "pt", mime: "application/x-pt", extensions: ["pt"], load: async () => ({ root: new THREE.Group().add(new THREE.Mesh(geom)) }) };
    const t = mountForTest({ options: { adapters: [point] } });
    await expectError(t, { arrayBuffer: new ArrayBuffer(4), format: "pt" }, "EMPTY_SCENE");
    expect(disposed).toBe(1);
    t.viewer.dispose();
  });

  it("unsupported extension (.obj/.fbx/.usdz) -> UNSUPPORTED_FORMAT without fetching", async () => {
    const fetch = createFakeFetch({ "*": { bytes: new ArrayBuffer(8) } });
    const t = mountForTest({ options: { fetch } });
    for (const name of ["chair.obj", "chair.fbx", "chair.usdz"]) {
      await expectError(t, { url: `https://cdn.example/${name}` }, "UNSUPPORTED_FORMAT");
    }
    expect(fetch.calls).toHaveLength(0);
    t.viewer.dispose();
  });

  it("explicit unregistered format -> UNSUPPORTED_FORMAT; unknown content -> UNSUPPORTED_FORMAT", async () => {
    const t = mountForTest();
    await expectError(t, { arrayBuffer: fixtureArrayBuffer("chair-textured.glb"), format: "fbx" }, "UNSUPPORTED_FORMAT");
    await expectError(t, { arrayBuffer: new TextEncoder().encode("hello").buffer, filename: "notes.txt" }, "UNSUPPORTED_FORMAT");
    await expectError(t, { arrayBuffer: new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer, mime: "image/png" }, "UNSUPPORTED_FORMAT");
    t.viewer.dispose();
  });

  it("HTTP failure and network failure -> FETCH_FAILED (status kept for logs; v3: an honest reason, never 'check your connection' for a dead link)", async () => {
    const fetch = createFakeFetch({
      "https://cdn.example/expired.glb": { status: 403, statusText: "Forbidden" },
      "https://cdn.example/down.glb": { networkError: true },
      "https://cdn.example/gone.glb": { status: 410 },
      "https://cdn.example/boom.glb": { status: 503 },
    });
    const t = mountForTest({ options: { fetch } });
    const e1 = await expectError(t, { url: "https://cdn.example/expired.glb?X-Amz-Expires=1" }, "FETCH_FAILED", "denied");
    expect(e1.status).toBe(403);
    await expectError(t, { url: "https://cdn.example/down.glb" }, "FETCH_FAILED", "network");
    expect(FETCH_FAILED_MESSAGE.network).toBe(ERROR_MESSAGE.FETCH_FAILED);
    await expectError(t, { url: "https://cdn.example/missing.glb" }, "FETCH_FAILED", "gone");
    await expectError(t, { url: "https://cdn.example/gone.glb" }, "FETCH_FAILED", "gone");
    await expectError(t, { url: "https://cdn.example/boom.glb" }, "FETCH_FAILED", "server");
    for (const m of [FETCH_FAILED_MESSAGE.gone, FETCH_FAILED_MESSAGE.denied]) expect(m).not.toMatch(/connection/i);
    t.viewer.dispose();
  });

  it("BUG-002: a transport error on a CROSS-ORIGIN link may be a CORS refusal -> reason 'cross-origin', never just 'check your connection'", async () => {
    const fetch = createFakeFetch({ "https://cdn.example/blocked.glb": { networkError: true }, "https://app.example/models/down.glb": { networkError: true } });
    const t = mountForTest({ options: { fetch } });
    t.win.location = { href: "https://app.example/studio/", origin: "https://app.example" };
    await expectError(t, { url: "https://cdn.example/blocked.glb" }, "FETCH_FAILED", "cross-origin");
    expect(FETCH_FAILED_MESSAGE["cross-origin"]).toMatch(/doesn't allow this page/);
    expect(t.viewer.getState().canRetry).toBe(true);
    // same origin: a transport error is a connection problem
    await expectError(t, { url: "/models/down.glb".replace(/^/, "https://app.example") }, "FETCH_FAILED", "network");
    t.viewer.dispose();
  });

  it("offline (navigator.onLine === false) + transport error -> FETCH_FAILED reason 'offline'", async () => {
    const fetch = createFakeFetch({ "https://cdn.example/down.glb": { networkError: true } });
    const t = mountForTest({ options: { fetch } });
    t.win.navigator = { onLine: false };
    await expectError(t, { url: "https://cdn.example/down.glb" }, "FETCH_FAILED", "offline");
    expect(t.viewer.getState().canRetry).toBe(true);
    t.viewer.dispose();
  });

  it("FILE_TOO_LARGE for bytes, blobs and streamed fetches over maxBytes", async () => {
    const bytes = fixtureArrayBuffer("chair-textured.glb");
    const fetch = createFakeFetch({ "https://cdn.example/a.glb": { bytes, chunks: 3 }, "https://cdn.example/b.glb": { bytes, chunks: 3, omitLength: true } });
    const t = mountForTest({ options: { fetch, maxBytes: 1000 } });
    await expectError(t, { arrayBuffer: bytes }, "FILE_TOO_LARGE");
    await expectError(t, { blob: new Blob([bytes]) }, "FILE_TOO_LARGE");
    await expectError(t, { url: "https://cdn.example/a.glb" }, "FILE_TOO_LARGE");
    await expectError(t, { url: "https://cdn.example/b.glb" }, "FILE_TOO_LARGE");
    t.viewer.dispose();
  });

  it("INVALID_ASSET for missing / multiple sources", async () => {
    const t = mountForTest();
    await expectError(t, null, "INVALID_ASSET");
    await expectError(t, {}, "INVALID_ASSET");
    await expectError(t, { url: "https://a/x.glb", arrayBuffer: new ArrayBuffer(1) }, "INVALID_ASSET");
    t.viewer.dispose();
  });

  it("an error replaces (and disposes) the previously shown model", async () => {
    const t = mountForTest();
    await t.viewer.load({ arrayBuffer: fixtureArrayBuffer("chair-textured.glb") });
    expect(t.render().geometries).toBe(1);
    await expectError(t, { arrayBuffer: fixtureArrayBuffer("corrupt.glb") }, "PARSE_FAILED", "truncated");
    expect(t.render()).toEqual({ geometries: 0, textures: 0 });
    expect(t.viewer.download()).toBeNull();
    // and the viewer recovers on the next good load
    expect((await t.viewer.load({ arrayBuffer: fixtureArrayBuffer("table-untextured.glb") })).ok).toBe(true);
    expect(t.viewer.getState().error).toBeNull();
    t.viewer.dispose();
  });

  it("missing GLTFLoader -> MISSING_DEPENDENCY at load time", async () => {
    const t = mountForTest({ deps: {} });
    await expectError(t, { arrayBuffer: fixtureArrayBuffer("chair-textured.glb") }, "MISSING_DEPENDENCY");
    expect(t.viewer.getState().capabilities.controls).toBe(false);
    t.viewer.dispose();
  });

  it("no THREE injected -> MISSING_DEPENDENCY, reported via onError asynchronously", async () => {
    const { container } = createFakeDocument();
    const errors = [];
    const viewer = mountAssetViewer(container, { onError: (e) => errors.push(e) });
    expect(viewer.getState().error.code).toBe("MISSING_DEPENDENCY");
    expect(errors).toEqual([]); // not synchronously, so the caller already holds the handle
    await Promise.resolve();
    expect(errors.map((e) => e.code)).toEqual(["MISSING_DEPENDENCY"]);
    const res = await viewer.load({ arrayBuffer: fixtureArrayBuffer("chair-textured.glb") });
    expect(res.error.code).toBe("MISSING_DEPENDENCY");
    viewer.dispose();
  });

  it("renderer creation failure -> WEBGL_UNAVAILABLE; load() refuses; dispose is safe", async () => {
    const t = mountForTest({
      createRenderer: () => {
        throw new Error("Error creating WebGL context.");
      },
    });
    expect(t.viewer.getState()).toMatchObject({ status: "error", error: { code: "WEBGL_UNAVAILABLE" } });
    await Promise.resolve();
    expect(t.errors.map((e) => e.code)).toEqual(["WEBGL_UNAVAILABLE"]);
    expect(t.container.find("data-av-status").textContent).toBe(ERROR_MESSAGE.WEBGL_UNAVAILABLE);
    const res = await t.viewer.load({ arrayBuffer: fixtureArrayBuffer("chair-textured.glb") });
    expect(res.error.code).toBe("WEBGL_UNAVAILABLE");
    t.viewer.dispose();
    expect(t.container.children).toHaveLength(0);
  });

  it("mount with a non-element throws a TypeError (programmer error)", () => {
    expect(() => mountAssetViewer(null, {})).toThrow(TypeError);
  });
});

describe("parser that never settles", () => {
  it("times out into PARSE_FAILED instead of hanging in 'loading'", async () => {
    const never = { id: "never", mime: "application/x-never", extensions: ["never"], load: () => new Promise(() => {}) };
    const t = mountForTest({ options: { adapters: [never], parseTimeoutMs: 20 } });
    const res = await t.viewer.load({ arrayBuffer: new ArrayBuffer(1), format: "never" });
    expect(res.error).toMatchObject({ code: "PARSE_FAILED", detail: "parser did not finish within 20 ms" });
    expect(t.viewer.getState().status).toBe("error");
    t.viewer.dispose();
  });
});
