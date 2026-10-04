import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mountForTest } from "./helpers/mountHarness.js";
import { createFakeFetch, fixtureArrayBuffer, installImageBitmapShim } from "./helpers/fixtures.js";
import { downloadFilename, filenameFromUrl, glbAdapter, gltfJsonAdapter } from "../../src/lib/assetViewer/index.js";

let shim;
beforeAll(() => (shim = installImageBitmapShim()));
afterAll(() => shim.restore());

const sha = (ab) => createHash("sha256").update(new Uint8Array(ab)).digest("hex");

describe("download(): original bytes, right name and mime, no conversion", () => {
  it("GLB from bytes -> model/gltf-binary, same sha256, own copy", async () => {
    const t = mountForTest();
    const input = fixtureArrayBuffer("chair-textured.glb");
    await t.viewer.load({ arrayBuffer: input, filename: "chair-textured.glb" });
    const d = t.viewer.download();
    expect(d).toMatchObject({ format: "glb", mime: "model/gltf-binary", filename: "chair-textured.glb", byteLength: input.byteLength, url: null });
    expect(sha(d.bytes)).toBe(sha(input));
    expect(d.blob.type).toBe("model/gltf-binary");
    expect(sha(await d.blob.arrayBuffer())).toBe(sha(input));
    new Uint8Array(d.bytes)[0] = 0; // mutating the handed-out copy must not corrupt the viewer's
    expect(sha(t.viewer.download().bytes)).toBe(sha(input));
    t.viewer.dispose();
  });

  it("URL source: filename from the path (query stripped), original URL handed back", async () => {
    const bytes = fixtureArrayBuffer("table-untextured.glb");
    const url = "https://storage.example/gen/7f3a/My%20Table.glb?X-Amz-Signature=abc&X-Amz-Expires=600";
    const fetch = createFakeFetch({ "https://storage.example/gen/7f3a/My%20Table.glb": { bytes } });
    const t = mountForTest({ options: { fetch } });
    await t.viewer.load({ url });
    const d = t.viewer.download();
    expect(d).toMatchObject({ filename: "My Table.glb", mime: "model/gltf-binary", url });
    expect(sha(d.bytes)).toBe(sha(bytes));
    t.viewer.dispose();
  });

  it("glTF JSON content -> model/gltf+json and .gltf even when declared as .glb", async () => {
    const json = new TextEncoder().encode(
      JSON.stringify({
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ mesh: 0 }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
        accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 0] }],
        bufferViews: [{ buffer: 0, byteLength: 36 }],
        buffers: [{ byteLength: 36, uri: "data:application/octet-stream;base64," + Buffer.from(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer).toString("base64") }],
      }),
    ).buffer;
    // three's FileLoader decodes data: URIs and builds a ProgressEvent, which node lacks.
    const hadPE = "ProgressEvent" in globalThis;
    if (!hadPE) globalThis.ProgressEvent = class ProgressEvent extends Event {};
    const t = mountForTest();
    await t.viewer.load({ arrayBuffer: json, filename: "tri.glb" });
    if (!hadPE) delete globalThis.ProgressEvent;
    expect(t.viewer.getState().status).toBe("ready");
    expect(t.viewer.download()).toMatchObject({ format: "gltf", mime: "model/gltf+json", filename: "tri.gltf" });
    t.viewer.dispose();
  });

  it("returns null unless a model is ready (idle, loading, error, disposed)", async () => {
    const t = mountForTest();
    expect(t.viewer.download()).toBeNull();
    const p = t.viewer.load({ arrayBuffer: fixtureArrayBuffer("chair-textured.glb") });
    expect(t.viewer.download()).toBeNull();
    await p;
    expect(t.viewer.download()).not.toBeNull();
    await t.viewer.load({ arrayBuffer: fixtureArrayBuffer("corrupt.glb") });
    expect(t.viewer.download()).toBeNull();
    await t.viewer.load({ arrayBuffer: fixtureArrayBuffer("chair-textured.glb") });
    t.viewer.dispose();
    expect(t.viewer.download()).toBeNull();
  });

  it("save:true clicks a temporary <a download> and revokes the object URL", async () => {
    const t = mountForTest();
    await t.viewer.load({ arrayBuffer: fixtureArrayBuffer("chair-textured.glb"), filename: "chair" });
    const d = t.viewer.download({ save: true });
    const a = t.doc.created.find((e) => e.tagName === "A");
    expect(a.clicks).toBe(1);
    expect(a.download).toBe("chair.glb");
    expect(a.parentNode).toBeNull();
    expect(t.win.URL.created[0].blob.type).toBe(d.mime);
    await new Promise((r) => setTimeout(r, 5));
    expect(t.win.URL.revoked).toEqual([a.href]);
    t.viewer.dispose();
  });

  it("filename helpers", () => {
    expect(downloadFilename(null, glbAdapter)).toBe("generated-model.glb");
    expect(downloadFilename("chair", glbAdapter)).toBe("chair.glb");
    expect(downloadFilename("chair.bin", glbAdapter)).toBe("chair.glb");
    expect(downloadFilename("chair.GLB", glbAdapter)).toBe("chair.GLB");
    expect(downloadFilename("a/b:c.glb", glbAdapter)).toBe("a_b_c.glb");
    expect(downloadFilename("x.glb", gltfJsonAdapter)).toBe("x.gltf");
    expect(filenameFromUrl("https://x/y/z.glb?sig=1#f")).toBe("z.glb");
    expect(filenameFromUrl("https://x/y/")).toBeNull();
    expect(filenameFromUrl("blob:https://x/uuid")).toBeNull();
    expect(filenameFromUrl("data:model/gltf-binary;base64,AAAA")).toBeNull();
  });
});
