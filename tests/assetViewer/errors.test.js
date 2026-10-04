import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mountForTest, THREE } from "./helpers/mountHarness.js";
import { createFakeFetch, fixtureArrayBuffer, installImageBitmapShim } from "./helpers/fixtures.js";
import { ERROR_CODE, ERROR_MESSAGE, mountAssetViewer } from "../../src/lib/assetViewer/index.js";
import { createFakeDocument } from "./helpers/fakeDom.js";

let shim;
beforeAll(() => (shim = installImageBitmapShim()));
afterAll(() => shim.restore());

async function expectError(t, asset, code) {
  const res = await t.viewer.load(asset);
  expect(res.ok).toBe(false);
  expect(res.error.code).toBe(code);
  const s = t.viewer.getState();
  expect(s.status).toBe("error");
  expect(s.error.code).toBe(code);
  expect(s.error.message).toBe(ERROR_MESSAGE[code]);
  expect(s.model).toBeNull();
  expect(t.errors.at(-1)).toMatchObject({ code, message: ERROR_MESSAGE[code] });
  expect(t.container.find("data-av-status").textContent).toBe(ERROR_MESSAGE[code]);
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
    const err = await expectError(t, { arrayBuffer: fixtureArrayBuffer("corrupt.glb"), filename: "corrupt.glb" }, "PARSE_FAILED");
    expect(err.detail).toBeTruthy();
    t.viewer.dispose();
  });

  it("garbage bytes named .glb -> PARSE_FAILED (hint says glb, content is not)", async () => {
    const t = mountForTest();
    await expectError(t, { arrayBuffer: new TextEncoder().encode("not a model at all").buffer, filename: "x.glb" }, "PARSE_FAILED");
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

  it("HTTP failure and network failure -> FETCH_FAILED (status kept for logs)", async () => {
    const fetch = createFakeFetch({ "https://cdn.example/expired.glb": { status: 403, statusText: "Forbidden" }, "https://cdn.example/down.glb": { networkError: true } });
    const t = mountForTest({ options: { fetch } });
    const e1 = await expectError(t, { url: "https://cdn.example/expired.glb?X-Amz-Expires=1" }, "FETCH_FAILED");
    expect(e1.status).toBe(403);
    await expectError(t, { url: "https://cdn.example/down.glb" }, "FETCH_FAILED");
    await expectError(t, { url: "https://cdn.example/missing.glb" }, "FETCH_FAILED");
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
    await expectError(t, { arrayBuffer: fixtureArrayBuffer("corrupt.glb") }, "PARSE_FAILED");
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
