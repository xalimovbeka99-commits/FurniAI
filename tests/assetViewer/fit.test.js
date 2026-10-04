import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mountForTest } from "./helpers/mountHarness.js";
import { fixtureArrayBuffer, installImageBitmapShim } from "./helpers/fixtures.js";
import { computeFit, DEFAULT_VIEW_DIRECTION } from "../../src/lib/assetViewer/index.js";

let shim;
beforeAll(() => (shim = installImageBitmapShim()));
afterAll(() => shim.restore());

const deg = (d) => (d * Math.PI) / 180;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe("computeFit (pure math)", () => {
  it("landscape: the vertical FOV is the limit and the sphere exactly fills it (with margin)", () => {
    const f = computeFit({ center: [1, 2, 3], radius: 2, fovDeg: 40, aspect: 16 / 9, margin: 1 });
    expect(f.halfFovRad).toBeCloseTo(deg(20), 10);
    expect(f.distance * Math.sin(deg(20))).toBeCloseTo(2, 10); // tangent to the view cone
    expect(dist(f.position, f.target)).toBeCloseTo(f.distance, 10);
    expect(f.target).toEqual([1, 2, 3]);
  });

  it("portrait: the horizontal FOV becomes the limit", () => {
    const aspect = 0.5;
    const f = computeFit({ center: [0, 0, 0], radius: 1, fovDeg: 40, aspect, margin: 1 });
    const hHalf = Math.atan(Math.tan(deg(20)) * aspect);
    expect(f.halfFovRad).toBeCloseTo(hHalf, 10);
    expect(f.distance).toBeCloseTo(1 / Math.sin(hHalf), 10);
    expect(f.distance).toBeGreaterThan(computeFit({ center: [0, 0, 0], radius: 1, fovDeg: 40, aspect: 2, margin: 1 }).distance);
  });

  it("near/far bracket the whole model at every allowed orbit distance; limits scale with radius", () => {
    for (const radius of [0.001, 0.5, 1, 350]) {
      const f = computeFit({ center: [0, 0, 0], radius, fovDeg: 40, aspect: 1.3 });
      expect(f.near).toBeGreaterThan(0);
      expect(f.near).toBeLessThan(f.minDistance - radius * 0.5);
      expect(f.far).toBeGreaterThanOrEqual(f.maxDistance + radius);
      expect(f.minDistance).toBeLessThan(f.distance);
      expect(f.maxDistance).toBeGreaterThan(f.distance);
      expect(f.minDistance / radius).toBeCloseTo(0.9, 10);
      expect(f.far / f.near).toBeLessThan(1e5); // keeps depth precision sane
    }
  });

  it("keeps the requested direction; falls back to the default for a zero vector; rejects bad radius", () => {
    const f = computeFit({ center: [0, 0, 0], radius: 1, fovDeg: 40, aspect: 1, direction: [0, 0, 5] });
    expect(f.position[0]).toBeCloseTo(0, 10);
    expect(f.position[1]).toBeCloseTo(0, 10);
    expect(f.position[2]).toBeCloseTo(f.distance, 10);
    const g = computeFit({ center: [0, 0, 0], radius: 1, fovDeg: 40, aspect: 1, direction: [0, 0, 0] });
    const n = Math.hypot(...DEFAULT_VIEW_DIRECTION);
    expect(g.position[0] / g.distance).toBeCloseTo(DEFAULT_VIEW_DIRECTION[0] / n, 10);
    expect(() => computeFit({ center: [0, 0, 0], radius: 0, fovDeg: 40, aspect: 1 })).toThrow(RangeError);
    expect(() => computeFit({ center: [0, 0, 0], radius: NaN, fovDeg: 40, aspect: 1 })).toThrow(RangeError);
  });
});

describe("viewer camera after load / orbit / fitToView", () => {
  it("frames the loaded model's bounding sphere and configures orbit limits", async () => {
    const t = mountForTest({ width: 800, height: 600 });
    await t.viewer.load({ arrayBuffer: fixtureArrayBuffer("chair-textured.glb") });
    const { camera, controls, model } = t.viewer._debug();
    expect(camera.aspect).toBeCloseTo(800 / 600, 10);
    expect(controls.enableDamping).toBe(true);
    const box = new (await import("three")).Box3().setFromObject(model);
    const sphere = box.getBoundingSphere(new (await import("three")).Sphere());
    expect(controls.target.toArray()).toEqual(sphere.center.toArray());
    const expected = computeFit({ center: sphere.center.toArray(), radius: sphere.radius, fovDeg: camera.fov, aspect: camera.aspect });
    expect(camera.position.toArray().map((v) => +v.toFixed(9))).toEqual(expected.position.map((v) => +v.toFixed(9)));
    expect(camera.near).toBeCloseTo(expected.near, 12);
    expect(camera.far).toBeCloseTo(expected.far, 12);
    expect(controls.minDistance).toBeCloseTo(expected.minDistance, 12);
    expect(controls.maxDistance).toBeCloseTo(expected.maxDistance, 12);
    t.viewer.dispose();
  });

  it("fitToView after orbit + zoom restores the fit distance but keeps the user's viewing direction", async () => {
    const t = mountForTest();
    await t.viewer.load({ arrayBuffer: fixtureArrayBuffer("table-untextured.glb") });
    const { camera, controls } = t.viewer._debug();
    const fitDistance = camera.position.distanceTo(controls.target);
    controls.orbit(Math.PI / 2);
    controls.dolly(3.5);
    const dirBefore = camera.position.clone().sub(controls.target).normalize();
    expect(camera.position.distanceTo(controls.target)).toBeCloseTo(fitDistance * 3.5, 6);
    const f = t.viewer.fitToView();
    expect(f.distance).toBeCloseTo(fitDistance, 9);
    expect(camera.position.distanceTo(controls.target)).toBeCloseTo(fitDistance, 9);
    const dirAfter = camera.position.clone().sub(controls.target).normalize();
    expect(dirAfter.angleTo(dirBefore)).toBeLessThan(1e-9);
    t.viewer.dispose();
  });

  it("fitToView with no model is a no-op returning null", () => {
    const t = mountForTest();
    expect(t.viewer.fitToView()).toBeNull();
    t.viewer.dispose();
  });
});
