/**
 * Proves the core runs against the repo's own legacy three r128 namespace
 * (vendor-three-r128.min.js, read-only) — the one the static Studio page
 * exposes as window.THREE — using r128's encoding-based colour management.
 * GLTFLoader for r128 is NOT vendored in the repo, so here a custom adapter
 * builds r128 meshes; the real r128 + GLTFLoader path runs in the browser demo.
 */
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { createFakeDocument } from "./helpers/fakeDom.js";
import { createFakeOrbitControlsClass, createFakeRenderer } from "./helpers/fakeRenderer.js";
import { configureRendererOutput, isTextureSRGB, markTextureSRGB, mountAssetViewer } from "../../src/lib/assetViewer/index.js";
import * as THREE166 from "three";

const require = createRequire(import.meta.url);
const R128 = require("../../vendor-three-r128.min.js");

describe("legacy three r128 compatibility (feature-detected colour management)", () => {
  it("is really r128 and has no colorSpace API", () => {
    expect(R128.REVISION).toBe("128");
    expect("colorSpace" in new R128.Texture()).toBe(false);
    expect(R128.SRGBColorSpace).toBeUndefined();
  });

  it("markTextureSRGB uses texture.encoding on r128 and texture.colorSpace on r166", () => {
    const t128 = new R128.Texture();
    expect(markTextureSRGB(R128, t128)).toBe(true);
    expect(t128.encoding).toBe(R128.sRGBEncoding);
    expect(isTextureSRGB(R128, t128)).toBe(true);
    expect(markTextureSRGB(R128, t128)).toBe(false); // idempotent
    const t166 = new THREE166.Texture();
    markTextureSRGB(THREE166, t166);
    expect(t166.colorSpace).toBe("srgb");
    expect(t166.encoding).toBeUndefined();
  });

  it("configureRendererOutput: outputEncoding on r128-like renderers, outputColorSpace on r152+", () => {
    const legacy = { outputEncoding: 3000 };
    configureRendererOutput(R128, legacy);
    expect(legacy.outputEncoding).toBe(R128.sRGBEncoding);
    expect("outputColorSpace" in legacy).toBe(false);
    const modern = { outputColorSpace: "srgb-linear" };
    configureRendererOutput(THREE166, modern);
    expect(modern.outputColorSpace).toBe("srgb");
  });

  it("full load -> ready -> replace -> dispose cycle with window.THREE = r128", async () => {
    const { doc, container } = createFakeDocument();
    let renderer;
    const tex = () => {
      const t = new R128.Texture();
      t.image = { width: 1, height: 1 };
      return t; // left in LINEAR on purpose: the viewer must fix colour slots
    };
    const chairAdapter = {
      id: "r128-box",
      mime: "application/x-test",
      extensions: ["box"],
      load: async (_bytes, { three }) => {
        const mat = new three.MeshStandardMaterial({ map: tex(), emissiveMap: tex(), normalMap: tex() });
        const g = new three.Group();
        g.add(new three.Mesh(new three.BoxGeometry(0.46, 0.04, 0.46), mat));
        const back = new three.Mesh(new three.BoxGeometry(0.46, 0.52, 0.04), mat);
        back.position.set(0, 0.28, -0.21);
        g.add(back);
        return { root: g };
      },
    };
    const viewer = mountAssetViewer(container, {
      three: R128,
      deps: { OrbitControls: createFakeOrbitControlsClass(R128) },
      adapters: [chairAdapter],
      createRenderer: () => (renderer = createFakeRenderer(doc, { revision: 128 })),
    });
    expect(viewer.getState().capabilities).toMatchObject({ threeRevision: 128, colorManagement: "encoding" });
    expect(renderer.outputEncoding).toBe(R128.sRGBEncoding);
    const res = await viewer.load({ arrayBuffer: new ArrayBuffer(1), format: "r128-box" });
    expect(res.ok).toBe(true);
    const mat = viewer._debug().model.children[0].material;
    expect(mat.map.encoding).toBe(R128.sRGBEncoding);
    expect(mat.emissiveMap.encoding).toBe(R128.sRGBEncoding);
    expect(mat.normalMap.encoding).toBe(R128.LinearEncoding); // data texture stays linear
    expect(viewer.getState().model).toMatchObject({ colorTextures: 2, colorTexturesSRGB: 2, meshCount: 2 });
    const d = viewer._debug();
    renderer.render(d.scene, d.camera);
    expect(renderer.info.memory).toEqual({ geometries: 2, textures: 3 });
    await viewer.load({ arrayBuffer: new ArrayBuffer(1), format: "r128-box" });
    renderer.render(d.scene, d.camera);
    expect(renderer.info.memory).toEqual({ geometries: 2, textures: 3 });
    viewer.dispose();
    expect(renderer.info.memory).toEqual({ geometries: 0, textures: 0 });
  });
});
