import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mountForTest, THREE, GLTFLoader } from "./helpers/mountHarness.js";
import { fixtureArrayBuffer, installImageBitmapShim } from "./helpers/fixtures.js";
import { createFakeDocument, createManualRaf, FakeResizeObserver } from "./helpers/fakeDom.js";
import { createFakeOrbitControlsClass, createFakeRenderer } from "./helpers/fakeRenderer.js";
import { collectResources, disposeObject3D, mountAssetViewer } from "../../src/lib/assetViewer/index.js";

let shim;
beforeAll(() => (shim = installImageBitmapShim()));
afterAll(() => shim.restore());

const chair = () => ({ arrayBuffer: fixtureArrayBuffer("chair-textured.glb"), filename: "chair-textured.glb" });
const table = () => ({ arrayBuffer: fixtureArrayBuffer("table-untextured.glb"), filename: "table-untextured.glb" });

function spyDispose(resources) {
  const calls = new Map();
  for (const set of [resources.geometries, resources.materials, resources.textures]) {
    for (const r of set) {
      calls.set(r, 0);
      r.addEventListener("dispose", () => calls.set(r, calls.get(r) + 1));
    }
  }
  return calls;
}

describe("GPU disposal (renderer.info.memory semantics)", () => {
  it("replace: counts drop to the new model only; every old resource disposed exactly once", async () => {
    const t = mountForTest();
    await t.viewer.load(chair());
    expect(t.render()).toEqual({ geometries: 1, textures: 1 });
    const oldRes = collectResources(t.viewer._debug().model);
    expect(oldRes.textures.size).toBe(1);
    const calls = spyDispose(oldRes);
    const bitmap = [...oldRes.textures][0].image;

    await t.viewer.load(table());
    expect(t.render()).toEqual({ geometries: 1, textures: 0 });
    expect([...calls.values()].every((n) => n === 1)).toBe(true);
    expect(calls.size).toBe(3); // 1 geometry + 1 material + 1 texture
    expect(bitmap.closed).toBe(true); // decoded ImageBitmap released

    await t.viewer.load(chair());
    expect(t.render()).toEqual({ geometries: 1, textures: 1 });
    t.viewer.clear();
    expect(t.render()).toEqual({ geometries: 0, textures: 0 });
    t.viewer.dispose();
  });

  it("dispose(): model, controls, renderer (+ context), resize observer, rAF, DOM and listeners released", async () => {
    const raf = createManualRaf();
    const t = mountForTest({ raf });
    await t.viewer.load(chair());
    raf.flush();
    const renderer = t.renderer;
    expect(renderer.info.memory).toEqual({ geometries: 1, textures: 1 });
    const controls = t.OrbitControls.instances.at(-1);
    const ro = FakeResizeObserver.instances.at(-1);
    expect(ro.observed).toHaveLength(1);
    let disposeEvents = 0;
    t.viewer.on("dispose", () => disposeEvents++);
    t.viewer.fitToView(); // schedules a frame that dispose must cancel
    expect(raf.pending).toBe(1);

    t.viewer.dispose();
    expect(renderer.info.memory).toEqual({ geometries: 0, textures: 0 });
    expect(renderer.calls.dispose).toBe(1);
    expect(renderer.calls.forceContextLoss).toBe(1);
    expect(controls.disposed).toBe(1);
    expect(controls.listeners.change.size).toBe(0);
    expect(ro.disconnected).toBe(true);
    expect(raf.pending).toBe(0);
    expect(raf.cancelled).toHaveLength(1);
    expect(t.container.children).toHaveLength(0);
    expect(disposeEvents).toBe(1);
    expect(t.viewer._debug()).toMatchObject({ renderer: null, controls: null, model: null });
    // listeners were cleared: a later dispose() emits nothing
    t.viewer.dispose();
    expect(disposeEvents).toBe(1);
  });

  it("environment PMREM render target is disposed, along with the generator and the RoomEnvironment scene", async () => {
    const created = [];
    class FakePMREM {
      constructor() {
        this.disposed = 0;
        created.push(this);
      }
      fromScene() {
        const texture = new THREE.Texture();
        this.rt = { texture, disposed: 0, dispose() {
          this.disposed++;
          texture.dispose();
        } };
        return this.rt;
      }
      dispose() {
        this.disposed++;
      }
    }
    let roomDisposed = 0;
    class FakeRoom extends THREE.Scene {
      dispose() {
        roomDisposed++;
      }
    }
    const t = mountForTest({ three: { ...THREE, PMREMGenerator: FakePMREM }, deps: { GLTFLoader, RoomEnvironment: FakeRoom } });
    expect(t.viewer.getState().capabilities.environment).toBe("room-pmrem");
    expect(created[0].disposed).toBe(1); // generator released right after baking
    expect(roomDisposed).toBe(1);
    await t.viewer.load(chair());
    expect(t.render()).toEqual({ geometries: 1, textures: 2 }); // model texture + env map
    t.viewer.clear();
    expect(t.render()).toEqual({ geometries: 0, textures: 1 }); // env map stays while mounted
    const renderer = t.renderer;
    t.viewer.dispose();
    expect(created[0].rt.disposed).toBe(1);
    expect(renderer.info.memory).toEqual({ geometries: 0, textures: 0 });
  });

  it("window resize listener fallback is removed on dispose when ResizeObserver is unavailable", () => {
    const { doc, win, container } = createFakeDocument();
    delete win.ResizeObserver;
    const added = [];
    const removed = [];
    win.addEventListener = (type, fn) => added.push([type, fn]);
    win.removeEventListener = (type, fn) => removed.push([type, fn]);
    const viewer = mountAssetViewer(container, {
      three: THREE,
      deps: { GLTFLoader, OrbitControls: createFakeOrbitControlsClass(THREE) },
      createRenderer: () => createFakeRenderer(doc),
    });
    expect(added.map((a) => a[0])).toEqual(["resize"]);
    viewer.dispose();
    expect(removed).toEqual(added);
  });

  it("disposeObject3D reaches every texture slot, multi-materials, ShaderMaterial uniforms and skeletons", () => {
    const slots = ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap", "envMap", "lightMap", "bumpMap", "displacementMap"];
    const std = new THREE.MeshStandardMaterial();
    slots.forEach((s) => (std[s] = new THREE.Texture()));
    const phys = new THREE.MeshPhysicalMaterial({ clearcoatMap: new THREE.Texture(), sheenColorMap: new THREE.Texture(), transmissionMap: new THREE.Texture() });
    const shader = new THREE.ShaderMaterial({ uniforms: { a: { value: new THREE.Texture() }, arr: { value: [new THREE.Texture(), new THREE.Texture()] } } });
    const g1 = new THREE.BoxGeometry();
    const root = new THREE.Group();
    root.add(new THREE.Mesh(g1, [std, phys]));
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), shader));
    const bone = new THREE.Bone();
    const skinned = new THREE.SkinnedMesh(new THREE.BoxGeometry(), std);
    skinned.add(bone);
    const skeleton = new THREE.Skeleton([bone]);
    let skelDisposed = 0;
    skeleton.dispose = () => skelDisposed++;
    skinned.bind(skeleton);
    root.add(skinned);
    const parent = new THREE.Scene().add(root);
    const all = collectResources(root);
    const calls = spyDispose(all);
    const counts = disposeObject3D(root);
    expect(counts).toMatchObject({ geometries: 3, materials: 3, textures: 11 + 3 + 3, skeletons: 1 });
    expect([...calls.values()].every((n) => n === 1)).toBe(true);
    expect(skelDisposed).toBe(1);
    expect(parent.children).toHaveLength(0);
  });
});
