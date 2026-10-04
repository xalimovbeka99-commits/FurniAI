import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mountForTest } from "./helpers/mountHarness.js";
import { fixtureArrayBuffer, installImageBitmapShim } from "./helpers/fixtures.js";
import { describeScale, relativeProportions, RELATIVE_SCALE_LABEL } from "../../src/lib/assetViewer/index.js";

let shim;
beforeAll(() => (shim = installImageBitmapShim()));
afterAll(() => shim.restore());

// Any metric/imperial unit token or "real size" wording.
const UNIT_RE = /(\d\s*(mm|cm|dm|m|km|in|inch|inches|ft|feet|")\b)|\b(millimet|centimet|meters?\b|metres?\b|inch|feet|real[ -]?size|actual size|true size)/i;

describe("scale honesty", () => {
  it("relativeProportions normalises to the largest extent and never carries units", () => {
    const p = relativeProportions({ x: 2, y: 1, z: 0.5 });
    expect(p).toEqual({ w: 1, h: 0.5, d: 0.25, normalizedTo: "largest-extent", ratioLabel: "W:H:D 1.00 : 0.50 : 0.25" });
    expect(relativeProportions({ x: 0, y: 0, z: 0 })).toBeNull();
    expect(describeScale()).toEqual({
      kind: "inferred-relative",
      units: null,
      label: RELATIVE_SCALE_LABEL,
      note: "Generated model — dimensions not measured",
      declaredScaleIgnored: false,
    });
  });

  it("chair fixture exposes only proportions + inferred-relative scale; nothing in state has units", async () => {
    const t = mountForTest();
    await t.viewer.load({ arrayBuffer: fixtureArrayBuffer("chair-textured.glb"), filename: "chair-textured.glb" });
    const s = t.viewer.getState();
    expect(s.model.proportions).toMatchObject({ w: 0.46, h: 1, d: 0.46 });
    expect(s.model.scale).toMatchObject({ kind: "inferred-relative", units: null, note: "Generated model — dimensions not measured" });
    const json = JSON.stringify(s);
    expect(json).not.toMatch(UNIT_RE);
    expect(Object.keys(s.model)).not.toEqual(expect.arrayContaining(["width", "height", "depth", "dimensions", "size", "sizeMm"]));
    const badge = t.container.find("data-av-scale").textContent;
    expect(badge).toBe("Relative scale, not measured · W:H:D 0.46 : 1.00 : 0.46");
    expect(badge).not.toMatch(UNIT_RE);
    t.viewer.dispose();
  });

  it("table fixture proportions", async () => {
    const t = mountForTest();
    await t.viewer.load({ arrayBuffer: fixtureArrayBuffer("table-untextured.glb") });
    expect(t.viewer.getState().model.proportions).toMatchObject({ w: 1, h: 0.58, d: 0.55 });
    t.viewer.dispose();
  });

  it("caller-supplied scale metadata (even claiming mm) is ignored and never echoed", async () => {
    const t = mountForTest();
    await t.viewer.load({
      arrayBuffer: fixtureArrayBuffer("chair-textured.glb"),
      scale: { units: "mm", width: 460, height: 1010, depth: 460, verified: true, source: "provider" },
    });
    const s = t.viewer.getState();
    expect(s.model.scale).toMatchObject({ kind: "inferred-relative", units: null, declaredScaleIgnored: true });
    const json = JSON.stringify(s);
    expect(json).not.toMatch(UNIT_RE);
    expect(json).not.toContain("460");
    expect(json).not.toContain("1010");
    t.viewer.dispose();
  });

  it("the viewer renders no dimension labels: the only overlay text nodes are status + scale badge", async () => {
    const t = mountForTest();
    await t.viewer.load({ arrayBuffer: fixtureArrayBuffer("table-untextured.glb") });
    const root = t.container.children[0];
    const texts = root.children.filter((c) => c.tagName === "DIV").map((c) => c.textContent);
    expect(texts).toHaveLength(2);
    texts.forEach((x) => expect(x).not.toMatch(UNIT_RE));
    // nothing but lights and the model in the scene (no sprites/text meshes for labels)
    const extra = t.viewer._debug().scene.children.filter((c) => !c.isLight && c !== t.viewer._debug().model);
    expect(extra).toEqual([]);
    t.viewer.dispose();
  });
});
