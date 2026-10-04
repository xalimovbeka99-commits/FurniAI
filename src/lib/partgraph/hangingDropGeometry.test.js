/**
 * Hanging-drop / carcass consistency — reproduced on 55998dd, fixed 2026-09-30.
 *
 * On 55998dd every case marked "FAILED BEFORE" validated, compiled, passed
 * validatePartGraph and could be saved: a 5000 mm drop in a 2300 mm carcass,
 * a rail below the carcass bottom, a non-numeric or sub-0.1 mm drop, and a
 * 1200 mm-high draft whose adjustable shelves sat at Y −572 mm.
 *
 * Datum (WARDROBE_RULEBOOK_V0.1 §E): rail centre → upper face of the next
 * structural part below it in the bay (carcass bottom if none). Golden: long
 * bay 1914.0 − 118.0 = 1796.0 mm; short bay 1914.0 − 1014.0 = 900.0 mm.
 * No practical minimum is introduced — only "the declared drop must exist".
 */
import { describe, expect, it } from "vitest";
import golden from "../furnispec/goldenWardrobe.fixture.json";
import { validateFurniSpec } from "../furnispec/validate.js";
import { buildStructuralPartGraph } from "./buildStructuralPartGraph.js";
import { validatePartGraph } from "./validatePartGraph.js";
import { serializeCanonicalPartGraph } from "./serializePartGraph.js";
import { HANGING_DROP_ERROR, HangingDropGeometryError } from "./hangingDropGeometry.js";
import {
  previewDraftWardrobe,
  applyConversationalEdit,
  PIPELINE_STAGE,
} from "../conversation/pipeline.js";
import { fingerprintFurniSpec } from "../conversation/approval.js";
import { createMemoryStore } from "../persistence/memoryStore.js";
import { createDesignService } from "../persistence/designService.js";
import { PERSISTENCE_ERROR } from "../persistence/errors.js";

const clone = (o) => structuredClone(o);
const railLong = (s) => s.bays[0].components.find((c) => c.id === "rail-long-l1");
const railShort = (s) => s.bays[1].components.find((c) => c.id === "rail-short-r1");

function compileError(spec) {
  try {
    buildStructuralPartGraph(spec);
    return null;
  } catch (err) {
    return err;
  }
}

describe("golden geometry is unchanged by the check", () => {
  it("still compiles, validates, and reports the rulebook drops exactly", () => {
    const graph = buildStructuralPartGraph(clone(golden));
    expect(validatePartGraph(graph).valid).toBe(true);
    const rails = graph.previews.filter((p) => p.kind === "HANGING_RAIL");
    expect(rails.map((r) => r.centerYDmm)).toEqual([19140, 19140]);
  });

  it("the canonical golden PartGraph is byte-identical with or without a declared drop (the target is not geometry)", () => {
    const without = clone(golden);
    delete railLong(without).targetClearDropMm;
    delete railShort(without).targetClearDropMm;
    // The ledger records the component, so compare geometry, not the whole graph.
    const a = buildStructuralPartGraph(clone(golden));
    const b = buildStructuralPartGraph(without);
    expect(JSON.stringify(a.parts)).toBe(JSON.stringify(b.parts));
    expect(JSON.stringify(a.previews)).toBe(JSON.stringify(b.previews));
    expect(serializeCanonicalPartGraph(a)).toBe(serializeCanonicalPartGraph(buildStructuralPartGraph(clone(golden))));
  });
});

describe("declared drop vs. compiled carcass (rail centre → next upper face)", () => {
  it("FAILED BEFORE — 5000 mm in a 2300 mm carcass is refused by the validator", () => {
    const s = clone(golden);
    railLong(s).targetClearDropMm = 5000;
    const v = validateFurniSpec(s);
    expect(v.valid).toBe(false);
    expect(v.errors.map((e) => e.code)).toContain("COMPONENT_OUTSIDE_BAY");
    expect(compileError(s)?.code).toBe("INVALID_FURNISPEC");
  });

  it("long bay: exactly the available 1796.0 mm compiles; 1796.1 mm does not", () => {
    const ok = clone(golden);
    railLong(ok).targetClearDropMm = 1796;
    expect(compileError(ok)).toBeNull();

    const over = clone(golden);
    railLong(over).targetClearDropMm = 1796.1;
    const err = compileError(over);
    expect(err).toBeInstanceOf(HangingDropGeometryError);
    expect(err.code).toBe(HANGING_DROP_ERROR.NOT_ACHIEVABLE);
    expect(err.details).toMatchObject({
      componentId: "rail-long-l1",
      bayIndex: 0,
      railCentreYMm: 1914,
      obstructionId: "CARCASS_BOTTOM",
      obstructionUpperFaceYMm: 118,
      achievableClearDropMm: 1796,
      targetClearDropMm: 1796.1,
    });
  });

  it("short bay: the drop is measured to the adjustable shelf below — 900.0 ok, 900.1 refused", () => {
    const ok = clone(golden);
    expect(railShort(ok).targetClearDropMm).toBe(900);
    expect(compileError(ok)).toBeNull();

    const over = clone(golden);
    railShort(over).targetClearDropMm = 900.1;
    const err = compileError(over);
    expect(err?.code).toBe(HANGING_DROP_ERROR.NOT_ACHIEVABLE);
    expect(err.details.obstructionId).toBe("SHELF_ADJ_R3");
    expect(err.details.achievableClearDropMm).toBe(900);
  });

  it("FAILED BEFORE — a drawer bank under a rail that still claims the golden 1400 mm is refused", () => {
    const s = clone(golden);
    s.bays[0].components.push({ id: "drawer-bank-l1", type: "DRAWER_BANK", offsetFromBottomMm: 0, rows: 4 });
    const err = compileError(s);
    expect(err?.code).toBe(HANGING_DROP_ERROR.NOT_ACHIEVABLE);
    expect(err.details.obstructionId).toMatch(/^DRAWER_BANK_L1_R04_/);
    expect(err.details.achievableClearDropMm).toBeLessThan(1400);
  });

  it("supported precision is 0.1 mm: a finer, non-numeric, zero or negative drop is a validation error", () => {
    for (const [value, code] of [
      [1400.05, "UNSUPPORTED_DIMENSION_PRECISION"],
      ["1400", "INVALID_DIMENSION"],
      [null, "INVALID_DIMENSION"],
      [0, "INVALID_DIMENSION"],
      [-5, "INVALID_DIMENSION"],
    ]) {
      const s = clone(golden);
      railLong(s).targetClearDropMm = value;
      const v = validateFurniSpec(s);
      expect(v.valid, `targetClearDropMm=${JSON.stringify(value)}`).toBe(false);
      expect(v.errors.map((e) => e.code)).toContain(code);
    }
  });

  it("a rail that declares no drop is not given one — only containment is checked", () => {
    const s = clone(golden);
    delete railLong(s).targetClearDropMm;
    expect(compileError(s)).toBeNull();
  });
});

describe("rail placement must be inside the bay", () => {
  it("FAILED BEFORE — a rail offset below the carcass bottom is refused", () => {
    const s = clone(golden);
    delete railLong(s).targetClearDropMm; // refused even with no declared drop
    railLong(s).offsetBelowShelfMm = 3000;
    const err = compileError(s);
    expect(err?.code).toBe(HANGING_DROP_ERROR.RAIL_OUTSIDE_BAY);
  });

  it("a rail whose centre passes through a shelf is refused", () => {
    const s = clone(golden);
    // Rail centre is 1914.0 = 118.0 + 1796.0 above the floor datum; a shelf
    // from 1790.0 mm above the bay floor spans 1908.0–1926.0.
    s.bays[0].components.push({ id: "shelf-fix-l9", type: "SHELF_FIXED", offsetFromBottomMm: 1790, thicknessMm: 18, depthMm: 560 });
    delete railLong(s).targetClearDropMm;
    const err = compileError(s);
    expect(err?.code).toBe(HANGING_DROP_ERROR.RAIL_INTERSECTS_PART);
    expect(err.details.partId).toBe("SHELF_FIX_L9");
  });
});

describe("customer drafts: refusal is a validation result, never a half-built design", () => {
  const draft = (h) =>
    previewDraftWardrobe({
      description: `A 1800 mm wide, ${h} mm high, 600 mm deep hinged wardrobe`,
      specId: "spec-drop",
      revision: 1,
    });

  it("FAILED BEFORE — a 1800 mm-high default draft put a shelf below the carcass bottom; now VALIDATION_FAILED", () => {
    const d = draft(1800);
    expect(d.stage).toBe(PIPELINE_STAGE.VALIDATION_FAILED);
    expect(d.partGraph).toBeNull();
    expect(d.proposal).toBeNull();
    expect(d.validation.valid).toBe(false);
    expect(d.validation.errors[0].code).toBe(HANGING_DROP_ERROR.INTERIOR_PART_OUTSIDE_BAY);
  });

  it("the boundary follows the geometry: 2003 mm refused (long drop 1399.0), 2004 mm previews (1400.0)", () => {
    const low = draft(2003);
    expect(low.stage).toBe(PIPELINE_STAGE.VALIDATION_FAILED);
    expect(low.validation.errors[0].code).toBe(HANGING_DROP_ERROR.NOT_ACHIEVABLE);
    expect(low.validation.errors[0].details.achievableClearDropMm).toBe(1399);
    const ok = draft(2004);
    expect(ok.stage).toBe(PIPELINE_STAGE.DRAFT_PREVIEW);
    expect(validatePartGraph(ok.partGraph).valid).toBe(true);
  });

  it("a conversational edit into an unbuildable height is refused and returns no geometry", () => {
    const d = draft(2400);
    expect(d.stage).toBe(PIPELINE_STAGE.DRAFT_PREVIEW);
    const before = serializeCanonicalPartGraph(d.partGraph);
    const edit = applyConversationalEdit({
      currentObservations: d.observations,
      commandText: "Make it 1900 mm high",
      specId: "spec-drop",
      revision: 1,
    });
    expect(edit.ok).toBe(false);
    expect(edit.partGraph).toBeUndefined();
    expect(edit.spec).toBeUndefined();
    // The caller's committed design is untouched (it was never passed by reference).
    expect(serializeCanonicalPartGraph(d.partGraph)).toBe(before);
  });
});

describe("persistence refuses the same designs, before any write", () => {
  const OWNER = "user-drop";

  it("a save of an unachievable drop is 400 INVALID_FURNISPEC naming the geometry; nothing is written", async () => {
    const store = createMemoryStore();
    let appends = 0;
    const service = createDesignService({
      store: { ...store, appendRevision: async (r) => { appends += 1; return store.appendRevision(r); } },
    });
    const { designId } = await service.createDesign({ userId: OWNER, name: "W" });

    const spec = clone(golden);
    delete railLong(spec).targetClearDropMm;
    const partGraph = buildStructuralPartGraph(spec); // the true geometry
    railLong(spec).targetClearDropMm = 1797; // ...claiming a drop it does not have

    const err = await service
      .saveRevision({
        userId: OWNER, designId, revision: 1,
        furniSpec: spec, partGraph, fingerprint: fingerprintFurniSpec(spec), validationStatus: "ACCEPTED",
      })
      .catch((e) => e);

    expect(err.code).toBe(PERSISTENCE_ERROR.INVALID_FURNISPEC);
    expect(err.status).toBe(400);
    expect(err.details.compileError).toBe(HANGING_DROP_ERROR.NOT_ACHIEVABLE);
    expect(err.details.geometry).toMatchObject({ componentId: "rail-long-l1", achievableClearDropMm: 1796 });
    expect(appends).toBe(0);
    expect((await service.listRevisions({ userId: OWNER, designId })).revisions).toEqual([]);
  });

  it("a row with an unachievable drop written straight to the store is refused on reopen", async () => {
    const store = createMemoryStore();
    const service = createDesignService({ store });
    const { designId } = await service.createDesign({ userId: OWNER, name: "W" });
    const spec = clone(golden);
    delete railLong(spec).targetClearDropMm;
    const partGraph = buildStructuralPartGraph(spec);
    railLong(spec).targetClearDropMm = 5000;
    await store.appendRevision({
      designId, revision: 1, fingerprint: fingerprintFurniSpec(spec),
      furniSpec: spec, partGraph, origins: {}, validationStatus: "ACCEPTED",
      createdAt: new Date().toISOString(),
    });
    const err = await service.getRevision({ userId: OWNER, designId, revision: 1 }).catch((e) => e);
    expect(err.code).toBe(PERSISTENCE_ERROR.REVISION_INTEGRITY_FAILED);
    expect(err.furniSpec).toBeUndefined();
  });
});
