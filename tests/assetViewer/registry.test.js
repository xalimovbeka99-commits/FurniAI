import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GLTFLoader, mountForTest, THREE } from "./helpers/mountHarness.js";
import { fixtureArrayBuffer, fixtureBuffer, installImageBitmapShim } from "./helpers/fixtures.js";
import { createAdapterRegistry, DEFAULT_ADAPTERS, glbAdapter, isGlbBytes, isGltfJsonBytes, validateAdapter } from "../../src/lib/assetViewer/index.js";

let shim;
beforeAll(() => (shim = installImageBitmapShim()));
afterAll(() => shim.restore());

describe("format adapter registry", () => {
  it("default registry has exactly glTF binary + JSON with the agreed-working mimes", () => {
    const r = createAdapterRegistry(DEFAULT_ADAPTERS);
    expect(r.list().map((a) => [a.id, a.mime, a.extensions])).toEqual([
      ["glb", "model/gltf-binary", ["glb"]],
      ["gltf", "model/gltf+json", ["gltf"]],
    ]);
    expect(r.byMime("model/gltf-binary; charset=binary")).toBe(glbAdapter);
    expect(r.byMime("application/octet-stream")).toBeNull();
    expect(r.byExtension("glb")).toBe(glbAdapter);
    expect(r.byExtension("obj")).toBeNull();
  });

  it("sniffers recognise real fixture bytes and reject others", () => {
    const glb = new Uint8Array(fixtureBuffer("chair-textured.glb"));
    const gltf = new Uint8Array(fixtureBuffer("empty-scene.gltf"));
    expect(isGlbBytes(glb)).toBe(true);
    expect(isGlbBytes(gltf)).toBe(false);
    expect(isGltfJsonBytes(gltf)).toBe(true);
    expect(isGltfJsonBytes(new TextEncoder().encode('  {"foo": 1}'))).toBe(false);
    expect(isGltfJsonBytes(new TextEncoder().encode('\ufeff{"asset":{"version":"2.0"}}'))).toBe(true);
    expect(isGlbBytes(new Uint8Array(fixtureBuffer("corrupt.glb")))).toBe(true); // magic ok -> parser decides PARSE_FAILED
  });

  it("validateAdapter rejects incomplete adapters", () => {
    expect(() => validateAdapter({ id: "x" })).toThrow(/mime, extensions, load/);
    expect(() => validateAdapter({ id: "Bad Id", mime: "a/b", extensions: ["x"], load() {} })).toThrow(/id/);
    expect(() => createAdapterRegistry([{}])).toThrow(TypeError);
  });

  it("a new format can be plugged in without touching the viewer (example: a fake OBJ adapter)", async () => {
    let received = null;
    const objAdapter = {
      id: "obj",
      label: "Wavefront OBJ (TEST ONLY — not agreed)",
      mime: "model/obj",
      extensions: ["obj"],
      requires: ["OBJLoader"],
      sniff: (b) => new TextDecoder().decode(b.subarray(0, 2)) === "v ",
      load: async (bytes, ctx) => {
        received = { bytes, ctx };
        return { root: new ctx.three.Group().add(new ctx.three.Mesh(new ctx.three.BoxGeometry(2, 1, 1))) };
      },
    };
    const t = mountForTest({
      deps: { GLTFLoader, OBJLoader: class {} },
      options: { adapters: [...DEFAULT_ADAPTERS, objAdapter] },
    });
    const bytes = new TextEncoder().encode("v 0 0 0\n").buffer;
    const res = await t.viewer.load({ arrayBuffer: bytes, filename: "thing.obj" });
    expect(res.ok).toBe(true);
    expect(received.bytes).toBe(bytes);
    expect(received.ctx.three).toBe(THREE);
    expect(t.viewer.getState().asset).toMatchObject({ format: "obj", mime: "model/obj", filename: "thing.obj" });
    expect(t.viewer.download().mime).toBe("model/obj");
    expect(t.viewer.getState().capabilities.formats).toEqual(["glb", "gltf", "obj"]);
    // still the same viewer handling glb
    expect((await t.viewer.load({ arrayBuffer: fixtureArrayBuffer("chair-textured.glb") })).ok).toBe(true);
    t.viewer.dispose();
  });

  it("content sniff wins over a misleading mime/extension hint", async () => {
    const t = mountForTest();
    const res = await t.viewer.load({ arrayBuffer: fixtureArrayBuffer("table-untextured.glb"), filename: "download.bin", mime: "application/octet-stream" });
    expect(res.ok).toBe(true);
    expect(t.viewer.download().filename).toBe("download.glb");
    t.viewer.dispose();
  });
});
