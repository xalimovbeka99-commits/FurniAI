import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test, vi } from "vitest";
import wardrobeChatHandler from "../../../api/wardrobe/chat.js";
import { findTool } from "@/lib/wardrobe-tools/tools.js";

const require = createRequire(import.meta.url);
const {
  LegacyBuilderAdapterError,
  mmToCm,
  wardrobeModelToLegacyConfiguration,
  applyWardrobeModelToBuilder,
} = require("../../../legacy-builder-adapter.js");

function modelFixture({ revision = 4, widthMm = 2400, sections = 3 } = {}) {
  const panelThicknessMm = 18;
  const available = widthMm - (sections + 1) * panelThicknessMm;
  const baseWidth = Math.floor(available / sections);
  const widths = Array.from({ length: sections }, (_, index) =>
    index === sections - 1 ? available - baseWidth * (sections - 1) : baseWidth
  );
  return {
    id: "wardrobe-01",
    revision,
    widthMm,
    heightMm: 2600,
    depthMm: 600,
    panelThicknessMm,
    sections: widths.map((sectionWidth, index) => ({
      id: `section-0${index + 1}`,
      widthMm: sectionWidth,
      components:
        index === 1
          ? [
              { id: "drawer-bank-01", type: "DRAWER_BANK", positionMm: 0, heightMm: 720, rows: 4 },
              { id: "shelf-01", type: "SHELF", positionMm: 900, heightMm: 18 },
            ]
          : [],
    })),
  };
}

describe("canonical Wardrobe Model to legacy Builder adapter", () => {
  test("converts integer millimetres to the legacy centimetre state in one place", () => {
    expect(mmToCm(2400, "widthMm")).toBe(240);
    expect(mmToCm(2600, "heightMm")).toBe(260);
    expect(mmToCm(600, "depthMm")).toBe(60);
    expect(() => mmToCm(600.5, "depthMm")).toThrow(LegacyBuilderAdapterError);
  });

  test("maps dimensions, sections, shelves, and drawers without flattening the middle section", () => {
    const configuration = wardrobeModelToLegacyConfiguration(modelFixture(), {
      name: "Glass Wardrobe",
      mat: "oak",
      doorType: "glass",
      handle: "gold",
      led: "warm",
      basePrice: 18500,
    });

    expect(configuration).toMatchObject({
      type: "wardrobe", w: 240, h: 260, d: 60, sections: 3,
      shelves: 1, drawers: 4,
      canonicalWardrobeId: "wardrobe-01", canonicalRevision: 4,
      mat: "oak", doorType: "glass", handle: "gold", led: "warm", basePrice: 18500,
    });
    expect(configuration.sectionLayouts).toEqual([
      { sectionId: "section-01", shelves: 0, drawers: 0 },
      { sectionId: "section-02", shelves: 1, drawers: 4 },
      { sectionId: "section-03", shelves: 0, drawers: 0 },
    ]);
  });

  test("applies through the stable Builder API and invokes its existing rebuild path", () => {
    const builder = {
      cfg: { mat: "walnut", doorType: "mirror", handle: "black", led: "cool" },
      applyConfiguration: vi.fn(function (configuration) { this.cfg = configuration; this.build(); return this.cfg; }),
      build: vi.fn(),
    };
    const applied = applyWardrobeModelToBuilder(builder, modelFixture());
    expect(builder.applyConfiguration).toHaveBeenCalledOnce();
    expect(builder.build).toHaveBeenCalledOnce();
    expect(applied).toMatchObject({ mat: "walnut", doorType: "mirror", handle: "black", led: "cool" });
  });

  test("successive revisions preserve wardrobe identity and unrelated appearance state", () => {
    const current = { mat: "sage", doorType: "solid", handle: "push", led: "off", cameraBookmark: { x: 1 } };
    const first = wardrobeModelToLegacyConfiguration(modelFixture({ revision: 4 }), current);
    const edited = modelFixture({ revision: 5, widthMm: 2800 });
    edited.sections[1].components[0] = { ...edited.sections[1].components[0], rows: 3, heightMm: 540 };
    const second = wardrobeModelToLegacyConfiguration(edited, first);
    expect(second.canonicalWardrobeId).toBe(first.canonicalWardrobeId);
    expect(second.canonicalRevision).toBe(5);
    expect(second.w).toBe(280);
    expect(second.sectionLayouts[1]).toMatchObject({ drawers: 3, shelves: 1 });
    expect(second).toMatchObject(current);
  });

  test("deterministic create and repeated edits reach the bridge as one wardrobe", () => {
    let result = findTool("wardrobe_create").run(null, { widthMm: 2400, heightMm: 2600, depthMm: 600 });
    let model = result.model;
    model = findTool("section_add").run(model, { widthMm: 700 }).model;
    model = findTool("section_add").run(model, { widthMm: 700 }).model;
    const wardrobeId = model.id;
    const middleSectionId = model.sections[1].id;

    result = findTool("component_add").run(model, { sectionId: middleSectionId, type: "DRAWER_BANK", rows: 4, positionMm: 0 });
    expect(result.success).toBe(true);
    model = result.model;
    const fourDrawerRevision = model.revision;
    const drawerId = result.componentId;

    result = findTool("component_update").run(model, { componentId: drawerId, properties: { rows: 3 } });
    expect(result.success).toBe(true);
    model = result.model;
    result = findTool("component_add").run(model, { sectionId: middleSectionId, type: "SHELF", positionMm: 700 });
    expect(result.success).toBe(true);
    model = result.model;
    result = findTool("wardrobe_resize").run(model, { widthMm: 2800 });
    expect(result.success).toBe(true);
    model = result.model;

    const configuration = wardrobeModelToLegacyConfiguration(model, { mat: "oak", doorType: "glass", handle: "gold", led: "warm" });
    expect(model.id).toBe(wardrobeId);
    expect(model.revision).toBeGreaterThan(fourDrawerRevision);
    expect(configuration).toMatchObject({ w: 280, h: 260, d: 60, sections: 3, canonicalWardrobeId: wardrobeId, canonicalRevision: model.revision });
    expect(configuration.sectionLayouts[1]).toMatchObject({ sectionId: middleSectionId, drawers: 3, shelves: 1 });
  });

  test("rejects invalid, out-of-range, lossy, and unsupported canonical input", () => {
    expect(() => wardrobeModelToLegacyConfiguration({ ...modelFixture(), widthMm: 2400.5 }, {})).toThrowError(/integer/);
    expect(() => wardrobeModelToLegacyConfiguration({ ...modelFixture(), widthMm: 6000 }, {})).toThrowError(/between 1200 and 3600/);

    const unsupported = modelFixture();
    unsupported.sections[0].components.push({ id: "carousel-01", type: "ROTATING_CAROUSEL", positionMm: 0, heightMm: 100 });
    expect(() => wardrobeModelToLegacyConfiguration(unsupported, {})).toThrowError(/cannot be represented/);

    const lossy = modelFixture();
    lossy.sections[1].components.push({ id: "drawer-bank-02", type: "DRAWER_BANK", positionMm: 1000, heightMm: 180, rows: 1 });
    expect(() => wardrobeModelToLegacyConfiguration(lossy, {})).toThrowError(/multiple drawer banks/);
  });

  test("bridge source contains no executable-code or coordinate path from AI output", () => {
    const adapterSource = readFileSync(resolve(process.cwd(), "legacy-builder-adapter.js"), "utf8");
    const legacySource = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    const transportSource = readFileSync(resolve(process.cwd(), "api/wardrobe/chat.js"), "utf8");
    expect(adapterSource).not.toMatch(/\beval\s*\(|\bFunction\s*\(/);
    expect(adapterSource).not.toMatch(/threeJs|position\.(?:x|y|z)|coordinates/i);
    expect(legacySource).toContain("applyWardrobeModel(model)");
    expect(legacySource).toContain("this.build();return this.cfg");
    expect(legacySource).toContain("new THREE.WebGLRenderer");
    for (const signature of [
      "buildWardrobe()", "buildWalkinL()", "buildWalkinU()", "buildKitchen()", "buildVanity()",
      "makeDoor(", "makeDrawer(", "setupOrbit()", "toggle-doors", "toggle-drawers",
      "doorType", "handle", "led", "MATKEYS",
    ]) expect(legacySource).toContain(signature);
    expect(transportSource).toContain('from "../../src/app/api/wardrobe/chat/route.js"');
    expect(transportSource).not.toMatch(/ANTHROPIC_API_KEY|OPENAI_API_KEY|createAnthropic|createOpenAI/);
  });
});

describe("framework-null wardrobe chat transport", () => {
  function responseRecorder() {
    return {
      statusCode: null, headers: {}, body: null,
      setHeader(name, value) { this.headers[name] = value; },
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
      send(body) { this.body = body; return this; },
    };
  }

  test("rejects non-POST methods before the canonical route", async () => {
    const res = responseRecorder();
    await wardrobeChatHandler({ method: "GET" }, res);
    expect(res.statusCode).toBe(405);
    expect(res.body).toMatchObject({ ok: false, code: "METHOD_NOT_ALLOWED" });
  });

  test("delegates request validation to the canonical wardrobe route", async () => {
    const res = responseRecorder();
    await wardrobeChatHandler({ method: "POST", body: { message: "" } }, res);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
  });
});
