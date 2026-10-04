import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mountForTest, THREE } from "./helpers/mountHarness.js";
import { createFakeFetch, deferred, fixtureArrayBuffer, installImageBitmapShim } from "./helpers/fixtures.js";

let shim;
beforeAll(() => (shim = installImageBitmapShim()));
afterAll(() => shim.restore());

function gatedRoute(bytes) {
  const gate = deferred();
  let signal = null;
  return {
    route: {
      bytes,
      gate: (s) => {
        signal = s;
        return new Promise((resolve, reject) => {
          gate.promise.then(resolve);
          s.addEventListener("abort", () => {
            const e = new Error("aborted");
            e.name = "AbortError";
            reject(e);
          });
        });
      },
    },
    release: () => gate.resolve(),
    get signal() {
      return signal;
    },
  };
}

/** Test adapter whose parse step is held open until release(). */
function heldAdapter() {
  const holds = [];
  const roots = [];
  return {
    adapter: {
      id: "held",
      mime: "application/x-held",
      extensions: ["held"],
      load: () => {
        const d = deferred();
        holds.push(d);
        return d.promise;
      },
    },
    holds,
    roots,
    makeRoot() {
      const g = new THREE.BoxGeometry(1, 2, 0.5);
      const m = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
      const calls = { geometry: 0, material: 0, texture: 0 };
      g.addEventListener("dispose", () => calls.geometry++);
      m.addEventListener("dispose", () => calls.material++);
      m.map.addEventListener("dispose", () => calls.texture++);
      const root = new THREE.Group().add(new THREE.Mesh(g, m));
      roots.push({ root, calls });
      return { root, calls };
    },
  };
}

describe("stale-load supersession", () => {
  it("a second load() aborts the first fetch; only the second result is shown; no onError", async () => {
    const a = gatedRoute(fixtureArrayBuffer("chair-textured.glb"));
    const fetch = createFakeFetch({
      "https://cdn.example/a.glb": a.route,
      "https://cdn.example/b.glb": { bytes: fixtureArrayBuffer("table-untextured.glb") },
    });
    const t = mountForTest({ options: { fetch } });
    const pA = t.viewer.load({ url: "https://cdn.example/a.glb" });
    await new Promise((r) => setTimeout(r, 0));
    const idA = t.viewer.getState().loadId;
    const pB = t.viewer.load({ url: "https://cdn.example/b.glb" });
    expect(a.signal.aborted).toBe(true);
    const [rA, rB] = await Promise.all([pA, pB]);
    expect(rA).toMatchObject({ ok: false, superseded: true });
    expect(rB.ok).toBe(true);
    const s = t.viewer.getState();
    expect(s.loadId).toBeGreaterThan(idA);
    expect(s.asset.filename).toBe("b.glb");
    expect(s.model.meshCount).toBe(5); // the table, not the chair
    expect(t.errors).toEqual([]);
    t.viewer.dispose();
  });

  it("a stale result that finishes parsing AFTER being superseded is disposed and never added", async () => {
    const h = heldAdapter();
    const t = mountForTest({ options: { adapters: [h.adapter] } });
    const p1 = t.viewer.load({ arrayBuffer: new ArrayBuffer(4), format: "held", filename: "one.held" });
    await new Promise((r) => setTimeout(r, 0));
    const p2 = t.viewer.load({ arrayBuffer: new ArrayBuffer(4), format: "held", filename: "two.held" });
    await new Promise((r) => setTimeout(r, 0));
    expect(h.holds).toHaveLength(2);
    // second finishes first
    const second = h.makeRoot();
    h.holds[1].resolve({ root: second.root });
    expect((await p2).ok).toBe(true);
    // first finishes late
    const first = h.makeRoot();
    h.holds[0].resolve({ root: first.root });
    expect(await p1).toMatchObject({ ok: false, superseded: true });
    expect(first.calls).toEqual({ geometry: 1, material: 1, texture: 1 });
    expect(first.root.parent).toBeNull();
    expect(second.calls).toEqual({ geometry: 0, material: 0, texture: 0 });
    expect(t.viewer._debug().model).toBe(second.root);
    expect(t.viewer.getState().asset.filename).toBe("two.held");
    t.viewer.dispose();
    expect(second.calls).toEqual({ geometry: 1, material: 1, texture: 1 });
  });

  it("a stale load that FAILS after being superseded does not flip the state to error", async () => {
    const h = heldAdapter();
    const t = mountForTest({ options: { adapters: [h.adapter] } });
    const p1 = t.viewer.load({ arrayBuffer: new ArrayBuffer(4), format: "held" });
    await new Promise((r) => setTimeout(r, 0));
    const p2 = t.viewer.load({ arrayBuffer: new ArrayBuffer(4), format: "held" });
    await new Promise((r) => setTimeout(r, 0));
    h.holds[1].resolve({ root: h.makeRoot().root });
    await p2;
    h.holds[0].reject(new Error("late parse failure"));
    expect(await p1).toMatchObject({ superseded: true });
    expect(t.viewer.getState().status).toBe("ready");
    expect(t.errors).toEqual([]);
    t.viewer.dispose();
  });

  it("clear() and dispose() during a load supersede it (result disposed, state stays idle/disposed)", async () => {
    const h = heldAdapter();
    const t = mountForTest({ options: { adapters: [h.adapter] } });
    const p1 = t.viewer.load({ arrayBuffer: new ArrayBuffer(4), format: "held" });
    await new Promise((r) => setTimeout(r, 0));
    t.viewer.clear();
    const r1 = h.makeRoot();
    h.holds[0].resolve({ root: r1.root });
    expect(await p1).toMatchObject({ superseded: true });
    expect(t.viewer.getState().status).toBe("idle");
    expect(r1.calls.geometry).toBe(1);

    const p2 = t.viewer.load({ arrayBuffer: new ArrayBuffer(4), format: "held" });
    await new Promise((r) => setTimeout(r, 0));
    t.viewer.dispose();
    const r2 = h.makeRoot();
    h.holds[1].resolve({ root: r2.root });
    expect(await p2).toMatchObject({ superseded: true });
    expect(t.viewer.getState().status).toBe("disposed");
    expect(r2.calls).toEqual({ geometry: 1, material: 1, texture: 1 });
  });

  it("rapid replace of real GLBs: last one wins and nothing from earlier loads leaks", async () => {
    const t = mountForTest();
    const names = ["chair-textured.glb", "table-untextured.glb", "chair-textured.glb", "table-untextured.glb"];
    const results = await Promise.all(names.map((n) => t.viewer.load({ arrayBuffer: fixtureArrayBuffer(n), filename: n })));
    expect(results.map((r) => r.ok)).toEqual([false, false, false, true]);
    expect(results.slice(0, 3).every((r) => r.superseded)).toBe(true);
    expect(t.render()).toEqual({ geometries: 1, textures: 0 }); // only the table (untextured)
    const sceneChildren = t.viewer._debug().scene.children.filter((c) => !c.isLight);
    expect(sceneChildren).toHaveLength(1);
    t.viewer.dispose();
  });
});
