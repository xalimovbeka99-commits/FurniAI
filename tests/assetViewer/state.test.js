import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mountForTest } from "./helpers/mountHarness.js";
import { createFakeFetch, fixtureArrayBuffer, installImageBitmapShim } from "./helpers/fixtures.js";
import { STATUS } from "../../src/lib/assetViewer/index.js";

let shim;
beforeAll(() => (shim = installImageBitmapShim()));
afterAll(() => shim.restore());

const statusTrail = (states) => states.map((s) => (s.phase ? `${s.status}:${s.phase}` : s.status));
const dedupe = (arr) => arr.filter((v, i) => v !== arr[i - 1]);

describe("asset viewer state machine", () => {
  it("starts idle with capabilities describing the injected three", () => {
    const t = mountForTest();
    const s = t.viewer.getState();
    expect(s.status).toBe(STATUS.IDLE);
    expect(s.capabilities).toMatchObject({ threeRevision: 166, colorManagement: "colorSpace", controls: true, environment: "lights-only" });
    expect(s.capabilities.formats).toEqual(["glb", "gltf"]);
    expect(t.container.find("data-av-status").textContent).toBe("No model loaded");
    t.viewer.dispose();
  });

  it("idle -> loading(fetching) -> loading(parsing) -> ready for arrayBuffer input", async () => {
    const t = mountForTest();
    const res = await t.viewer.load({ arrayBuffer: fixtureArrayBuffer("chair-textured.glb"), filename: "chair-textured.glb" });
    expect(res.ok).toBe(true);
    expect(dedupe(statusTrail(t.states))).toEqual(["loading:fetching", "loading:parsing", "ready"]);
    const s = t.viewer.getState();
    expect(s.status).toBe("ready");
    expect(s.error).toBeNull();
    expect(s.asset).toMatchObject({ source: "arrayBuffer", format: "glb", mime: "model/gltf-binary", filename: "chair-textured.glb" });
    expect(s.model).toMatchObject({ meshCount: 6, triangleCount: 72, materialCount: 1, textureCount: 1, colorTextures: 1, colorTexturesSRGB: 1 });
    expect(t.errors).toEqual([]);
    t.viewer.dispose();
  });

  it("reports streamed fetch progress for URL input and ends at ratio 1", async () => {
    const bytes = fixtureArrayBuffer("chair-textured.glb");
    const fetch = createFakeFetch({ "https://cdn.example/gen/chair.glb": { bytes, chunks: 4 } });
    const t = mountForTest({ options: { fetch } });
    const progress = [];
    t.viewer.on("progress", (p) => progress.push(p));
    const res = await t.viewer.load({ url: "https://cdn.example/gen/chair.glb?sig=abc&exp=1" });
    expect(res.ok).toBe(true);
    expect(fetch.calls[0].init.credentials).toBe("omit");
    expect(progress.length).toBeGreaterThanOrEqual(4);
    const ratios = progress.map((p) => p.ratio);
    expect(ratios[0]).toBe(0);
    expect(ratios.at(-1)).toBe(1);
    expect([...ratios].sort((a, b) => a - b)).toEqual(ratios);
    expect(progress.every((p) => p.total === bytes.byteLength)).toBe(true);
    expect(t.viewer.getState().asset.filename).toBe("chair.glb");
    t.viewer.dispose();
  });

  it("progress ratio is null (indeterminate) when content-length is unknown", async () => {
    const fetch = createFakeFetch({ "https://cdn.example/x.glb": { bytes: fixtureArrayBuffer("table-untextured.glb"), chunks: 2, omitLength: true } });
    const t = mountForTest({ options: { fetch } });
    const progress = [];
    t.viewer.on("progress", (p) => progress.push(p));
    await t.viewer.load({ url: "https://cdn.example/x.glb" });
    expect(progress.length).toBeGreaterThan(0);
    expect(progress.every((p) => p.ratio === null && p.total === null)).toBe(true);
    expect(t.viewer.getState().status).toBe("ready");
    t.viewer.dispose();
  });

  it("accepts a Blob/File source and the format is sniffed from content", async () => {
    const t = mountForTest();
    const blob = new Blob([fixtureArrayBuffer("table-untextured.glb")], { type: "application/octet-stream" });
    const res = await t.viewer.load({ blob });
    expect(res.ok).toBe(true);
    expect(t.viewer.getState().asset).toMatchObject({ source: "blob", format: "glb", filename: "generated-model.glb" });
    t.viewer.dispose();
  });

  it("initial options.asset loads on mount; clear() returns to idle; overlay follows state", async () => {
    const t = mountForTest({ options: { asset: { arrayBuffer: fixtureArrayBuffer("table-untextured.glb") } } });
    expect(t.viewer.getState().status).toBe("loading");
    // bytes are already in memory, so the fetching phase is instant and parsing shows
    expect(t.container.find("data-av-status").textContent).toBe("Preparing model…");
    await new Promise((r) => t.viewer.on("ready", r));
    expect(t.container.find("data-av-scale").textContent).toMatch(/^Relative scale, not measured · W:H:D /);
    t.viewer.clear();
    const s = t.viewer.getState();
    expect(s).toMatchObject({ status: "idle", model: null, asset: null, error: null });
    expect(t.container.find("data-av-scale").style.display).toBe("none");
    t.viewer.dispose();
  });

  it("listeners: unknown events are rejected, unsubscribe works, a throwing listener does not break loading", async () => {
    const t = mountForTest();
    expect(() => t.viewer.on("nope", () => {})).toThrow(/unknown asset viewer event/);
    let n = 0;
    const off = t.viewer.on("statechange", () => n++);
    off();
    const orig = console.error;
    console.error = () => {};
    t.viewer.on("ready", () => {
      throw new Error("bad listener");
    });
    const res = await t.viewer.load({ arrayBuffer: fixtureArrayBuffer("table-untextured.glb") });
    console.error = orig;
    expect(res.ok).toBe(true);
    expect(n).toBe(0);
    t.viewer.dispose();
  });

  it("dispose() moves to the terminal 'disposed' state and further load() is refused", async () => {
    const t = mountForTest();
    t.viewer.dispose();
    expect(t.viewer.getState().status).toBe("disposed");
    const res = await t.viewer.load({ arrayBuffer: fixtureArrayBuffer("table-untextured.glb") });
    expect(res).toMatchObject({ ok: false, error: { code: "VIEWER_DISPOSED" } });
    expect(t.viewer.getState().status).toBe("disposed");
    t.viewer.dispose(); // idempotent
  });
});

describe("silent texture failures become a visible warning", () => {
  it("model.warnings = ['TEXTURES_NOT_LOADED'] when the file declares textures but none arrived", async () => {
    const THREE = await import("three");
    const lossy = {
      id: "lossy",
      mime: "application/x-lossy",
      extensions: ["lossy"],
      // what GLTFLoader does when an embedded image cannot be decoded: console.error + model without map
      load: async () => ({ root: new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())), info: { declaredTextures: 1 } }),
    };
    const t = mountForTest({ options: { adapters: [lossy] } });
    await t.viewer.load({ arrayBuffer: new ArrayBuffer(1), format: "lossy" });
    expect(t.viewer.getState().model.warnings).toEqual(["TEXTURES_NOT_LOADED"]);
    t.viewer.dispose();
  });

  it("the real GLTFLoader path reports declaredTextures, so a decoded chair has no warning", async () => {
    const t = mountForTest();
    await t.viewer.load({ arrayBuffer: fixtureArrayBuffer("chair-textured.glb") });
    expect(t.viewer.getState().model).toMatchObject({ textureCount: 1, warnings: [] });
    t.viewer.dispose();
  });
});
