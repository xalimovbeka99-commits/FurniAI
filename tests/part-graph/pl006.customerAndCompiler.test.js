/**
 * PL-006 independent proof under documented emitDrawerBankParts construction:
 *   BACK = W − slideDeduction(21) − 2×sideT(15) = W − 51
 *
 * W=50 → BACK −1; W=51 → BACK 0; W=52 → BACK +1 (arithmetic only, not manufacturability).
 *
 * Customer entry points and direct compiler inputs are proven SEPARATELY.
 * Note: minSectionWidthMm=250, so W=50/51 sections are not creatable via normal
 * section resize; kernel/tool gates are exercised on synthetic section widths
 * that mirror the construction-floor cases.
 */
import { describe, expect, it } from "vitest";
import { addComponent } from "../../src/lib/wardrobe-model/kernel.js";
import { COMPONENT_TYPES, DEFAULTS } from "../../src/lib/wardrobe-model/schema.js";
import { findTool } from "../../src/lib/wardrobe-tools/tools.js";
import { emitDrawerBankParts } from "../../src/lib/partgraph/emitDrawerBankParts.js";
import { adaptWardrobeModelToFurniSpec } from "../../src/lib/partgraph/wardrobeModelAdapter.js";
import { buildStructuralPartGraph } from "../../src/lib/partgraph/buildStructuralPartGraph.js";
import { generateShopDrawingsSVG } from "../../src/lib/drawing/projectionEngine.js";
import { compileCabinetDxfPackage } from "../../src/lib/production/dxfCompiler.js";
import { generateCutListCsv, compileNestingManifest } from "../../src/lib/production/nestingCompiler.js";

const FLOOR = DEFAULTS.minDrawerBayClearWidthMm; // 51

function synthModel(sectionWidthMm) {
  return {
    id: "w-pl006",
    revision: 7,
    widthMm: 900,
    heightMm: 2100,
    depthMm: 600,
    panelThicknessMm: 18,
    sections: [{ id: "sec-01", widthMm: sectionWidthMm, components: [] }],
    idCounters: { wardrobe: 1, section: 1, component: 0 },
  };
}

function emitAt(W) {
  return emitDrawerBankParts({
    comp: { id: "drawer-bank-l1", rows: 1, heightMm: 180, offsetFromBottomMm: 0 },
    bay: { index: 0, minXDmm: 180, maxXDmm: 180 + W * 10, clearWidthDmm: W * 10 },
    yBotTopDmm: 1000,
    zCarcassFrontDmm: 200,
    carcassDepthMm: 580,
    matCarcass: "MEL_WHITE_18",
    matFront: "MEL_WHITE_18",
    edgeFrontDmm: 10,
    edgeRearDmm: 0,
    toDeciMm: (mm) => Math.round(mm * 10),
  });
}

describe("PL-006 construction arithmetic (documented settings)", () => {
  it("floor is 21+15+15=51; W=50/51/52 BACK expectations", () => {
    expect(FLOOR).toBe(51);
    expect(50 - 21 - 30).toBe(-1);
    expect(51 - 21 - 30).toBe(0);
    expect(52 - 21 - 30).toBe(1);
  });
});

describe("PL-006 customer entry points (kernel + tool)", () => {
  it("kernel rejects W=50 and W=51; preserves model when thrown", () => {
    for (const W of [50, 51]) {
      const model = synthModel(W);
      const before = structuredClone(model);
      let threw = null;
      try {
        addComponent(model, {
          sectionId: "sec-01",
          type: COMPONENT_TYPES.DRAWER_BANK,
          rows: 2,
          positionMm: 0,
        });
      } catch (e) {
        threw = e;
      }
      expect(threw).toBeTruthy();
      expect(String(threw.code || threw.message)).toMatch(/INSUFFICIENT_BAY_WIDTH_FOR_DRAWERS|DRAWER_BACK stays strictly positive/);
      expect(model.revision).toBe(before.revision);
      expect(model.sections[0].components).toEqual(before.sections[0].components);
    }
  });

  it("kernel accepts W=52 (arithmetic-positive BACK only)", () => {
    const next = addComponent(synthModel(52), {
      sectionId: "sec-01",
      type: COMPONENT_TYPES.DRAWER_BANK,
      rows: 2,
      positionMm: 0,
    });
    expect(next.sections[0].components.some((c) => c.type === COMPONENT_TYPES.DRAWER_BANK)).toBe(
      true
    );
    expect(next.revision).toBeGreaterThanOrEqual(7);
  });

  it("component_add tool rejects W=51 without mutating revision / components", () => {
    const model = synthModel(51);
    const before = { revision: model.revision, n: model.sections[0].components.length };
    const result = findTool("component_add").run(model, {
      sectionId: "sec-01",
      type: "DRAWER_BANK",
      rows: 2,
      positionMm: 0,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("INSUFFICIENT_BAY_WIDTH_FOR_DRAWERS");
    expect(model.revision).toBe(before.revision);
    expect(model.sections[0].components).toHaveLength(before.n);
  });
});

describe("PL-006 direct compiler inputs (emitDrawerBankParts)", () => {
  it("refuses W=50 (negative BACK) and W=51 (zero BACK)", () => {
    expect(() => emitAt(50)).toThrow(/non-positive back width|DEGENERATE/);
    try { emitAt(51); expect.fail("should throw"); } catch (e) {
      expect(e.code).toBe("DEGENERATE_DRAWER_GEOMETRY");
      expect(String(e.message)).toMatch(/non-positive back width/);
    }
  });

  it("W=52 yields strictly positive BACK (1 mm arithmetic)", () => {
    const { panels } = emitAt(52);
    const back = panels.find((p) => p.role === "DRAWER_BACK");
    expect(back.widthDmm).toBe(10); // 1.0 mm
  });
});

describe("PL-006 end-to-end at reachable positive bay (W=250 min section)", () => {
  it("draft adapter + PartGraph + exporters accept positive BACK; status PROPOSED", () => {
    const next = addComponent(synthModel(250), {
      sectionId: "sec-01",
      type: COMPONENT_TYPES.DRAWER_BANK,
      rows: 2,
      positionMm: 0,
    });
    const spec = adaptWardrobeModelToFurniSpec(next);
    expect(spec.status).toBe("PROPOSED");
    expect(Array.isArray(spec.adapterAssumptions)).toBe(true);
    const graph = buildStructuralPartGraph(spec);
    const backs = graph.parts.filter((p) => p.role === "DRAWER_BACK");
    expect(backs.length).toBeGreaterThan(0);
    for (const b of backs) {
      const w = b.finished?.widthDmm ?? b.widthDmm;
      expect(w).toBeGreaterThan(0);
    }
    expect(() => generateShopDrawingsSVG(graph)).not.toThrow();
    expect(() => compileCabinetDxfPackage(graph)).not.toThrow();
    expect(() => generateCutListCsv(graph)).not.toThrow();
    expect(() => compileNestingManifest(graph)).not.toThrow();
  });
});

describe("atomic rejection — next supported edit still works", () => {
  it("after drawer reject (vertical clearance), adding a SHELF succeeds and advances revision", () => {
    // Same atomic contract as PL-006 width reject: prior design/revision unchanged,
    // then a supported edit applies. Uses reachable customer geometry (short carcass).
    let model = findTool("wardrobe_create").run(null, {
      widthMm: 900,
      heightMm: 650,
      depthMm: 600,
    }).model;
    const sectionId = model.sections[0].id;
    model = findTool("component_add").run(model, {
      sectionId,
      type: "SHELF",
      positionMm: 50,
    }).model;
    const before = {
      revision: model.revision,
      n: model.sections[0].components.length,
      ids: model.sections[0].components.map((c) => c.id),
    };
    const rejected = findTool("component_add").run(model, {
      sectionId,
      type: "DRAWER_BANK",
      rows: 3,
      positionMm: 0,
    });
    expect(rejected.success).toBe(false);
    expect(rejected.error).toBe("INSUFFICIENT_VERTICAL_CLEARANCE");
    expect(model.revision).toBe(before.revision);
    expect(model.sections[0].components).toHaveLength(before.n);
    expect(model.sections[0].components.map((c) => c.id)).toEqual(before.ids);

    const ok = findTool("component_add").run(model, {
      sectionId,
      type: "SHELF",
      positionMm: 500,
    });
    expect(ok.success).toBe(true);
    expect(ok.model.revision).toBeGreaterThan(before.revision);
    expect(ok.model.sections[0].components.filter((c) => c.type === "SHELF").length).toBe(2);
  });
});
