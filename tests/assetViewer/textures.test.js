/**
 * Criterion 1: real GLB meshes with their textures applied; a missing or
 * undecodable texture degrades to an honest note, never a crash. Fixtures are
 * QE's deterministic synthetic GLBs (tests/fixtures/scenario, read-only).
 * Node has no image decoder, so a strict stand-in decodes only bytes that
 * start with a PNG signature (as a browser would refuse anything else).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { TEXTURE_NOTE } from "../../src/lib/assetViewer/overlay.js";
import { mountForTest } from "./helpers/mountHarness.js";

const DIR = join(process.cwd(), "tests", "fixtures", "scenario");
const ab = (name) => {
  const b = readFileSync(join(DIR, name));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
let prev;
let errSpy;
beforeAll(() => {
  prev = { self: globalThis.self, cib: globalThis.createImageBitmap };
  globalThis.self = globalThis;
  globalThis.createImageBitmap = async (blob) => {
    const u8 = new Uint8Array(await blob.arrayBuffer());
    if (!PNG_SIG.every((b, i) => u8[i] === b)) throw new Error("The source image could not be decoded.");
    const v = new DataView(u8.buffer);
    return { width: v.getUint32(16), height: v.getUint32(20), close() {} };
  };
  // GLTFLoader console.errors a texture it cannot load; that is the case under test.
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterAll(() => {
  errSpy.mockRestore();
  if (prev.self === undefined) delete globalThis.self;
  else globalThis.self = prev.self;
  if (prev.cib === undefined) delete globalThis.createImageBitmap;
  else globalThis.createImageBitmap = prev.cib;
});

const shown = (n) => n.style.display !== "none";

describe("textures", () => {
  it("textured-cube.glb: the embedded PNG is applied as the colour map (sRGB), no note", async () => {
    const t = mountForTest();
    const r = await t.viewer.load({ arrayBuffer: ab("textured-cube.glb"), filename: "textured-cube.glb" });
    expect(r.ok).toBe(true);
    const m = t.viewer.getState().model;
    expect(m.textures).toEqual({ declared: 1, loaded: 1 });
    expect(m.colorTexturesSRGB).toBe(1);
    expect(m.warnings).toEqual([]);
    let map = null;
    t.viewer._debug().model.traverse((o) => o.material && o.material.map && (map = o.material.map));
    expect(map && map.image && map.image.width).toBeGreaterThan(0);
    expect(shown(t.container.find("data-av-note"))).toBe(false);
    expect(t.render().textures).toBe(1);
    t.viewer.dispose();
  });

  for (const name of ["corrupt-texture.glb", "missing-texture.glb"]) {
    it(`${name}: the mesh still shows; TEXTURES_NOT_LOADED + a visible honest note (role=note); download still offered`, async () => {
      const t = mountForTest({ options: { downloadButton: "always" } });
      const r = await t.viewer.load({ arrayBuffer: ab(name), filename: name });
      expect(r.ok).toBe(true);
      const s = t.viewer.getState();
      expect(s.status).toBe("ready");
      expect(s.model.meshCount).toBe(1);
      expect(s.model.textures).toEqual({ declared: 1, loaded: 0 });
      expect(s.model.warnings).toEqual(["TEXTURES_NOT_LOADED"]);
      const note = t.container.find("data-av-note");
      expect(note.getAttribute("role")).toBe("note");
      expect(note.textContent).toBe(TEXTURE_NOTE);
      expect(shown(note)).toBe(true);
      expect(shown(t.container.find("data-av-download"))).toBe(true);
      expect(t.viewer.download()).toMatchObject({ format: "glb", byteLength: ab(name).byteLength });
      // the note goes with the model
      await t.viewer.load({ arrayBuffer: ab("textured-cube.glb") });
      expect(shown(note)).toBe(false);
      t.viewer.dispose();
    });
  }
});
