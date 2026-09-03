import { describe, expect, it } from "vitest";
import fixture from "../furnispec/goldenWardrobe.fixture.json";
import narrowFixture from "../furnispec/fixtures/narrowWardrobe.fixture.json";
import wideFixture from "../furnispec/fixtures/wideWardrobe.fixture.json";
import heightFixture from "../furnispec/fixtures/heightMutation.fixture.json";
import shelfFixture from "../furnispec/fixtures/shelfMutation.fixture.json";

import { buildStructuralPartGraph } from "./buildStructuralPartGraph.js";
import { serializeCanonicalPartGraph } from "./serializePartGraph.js";
import { validatePartGraph } from "./validatePartGraph.js";
import { validateFurniSpec } from "../furnispec/validate.js";

describe("Gate G2.2-R1 — Generalized Deterministic PartGraph Kernel Suite", () => {
  it("1. proves the Golden FurniSpec produces exactly 19 structural parts", () => {
    const partGraph = buildStructuralPartGraph(fixture);
    expect(partGraph.parts).toHaveLength(19);
  });

  it("2. proves every generated Part ID is globally unique", () => {
    const partGraph = buildStructuralPartGraph(fixture);
    const ids = partGraph.parts.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(19);
  });

  it("3. proves every canonical PartGraph numerical field is an integer deci-mm", () => {
    const partGraph = buildStructuralPartGraph(fixture);
    for (const p of partGraph.parts) {
      expect(Number.isInteger(p.finished.lengthDmm)).toBe(true);
      expect(Number.isInteger(p.finished.widthDmm)).toBe(true);
      expect(Number.isInteger(p.finished.thicknessDmm)).toBe(true);
      expect(Number.isInteger(p.raw.lengthDmm)).toBe(true);
      expect(Number.isInteger(p.raw.widthDmm)).toBe(true);
      expect(Number.isInteger(p.raw.thicknessDmm)).toBe(true);
      expect(Number.isInteger(p.placement.minXDmm)).toBe(true);
      expect(Number.isInteger(p.placement.maxXDmm)).toBe(true);
      expect(Number.isInteger(p.placement.minYDmm)).toBe(true);
      expect(Number.isInteger(p.placement.maxYDmm)).toBe(true);
      expect(Number.isInteger(p.placement.minZDmm)).toBe(true);
      expect(Number.isInteger(p.placement.maxZDmm)).toBe(true);
    }
  });

  it("4. proves each door width is exactly 4475 deci-mm (447.5 mm)", () => {
    const partGraph = buildStructuralPartGraph(fixture);
    const doors = partGraph.parts.filter((p) => p.role === "DOOR_PANEL");
    expect(doors).toHaveLength(4);
    for (const door of doors) {
      expect(door.finished.widthDmm).toBe(4475);
    }
  });

  it("5. proves the same FurniSpec produces byte-identical PartGraph across 100 runs", () => {
    const baseline = serializeCanonicalPartGraph(buildStructuralPartGraph(fixture));
    for (let i = 0; i < 100; i++) {
      const current = serializeCanonicalPartGraph(buildStructuralPartGraph(fixture));
      expect(current).toBe(baseline);
    }
  });

  it("6. proves the input FurniSpec is not mutated during kernel execution", () => {
    const clone = JSON.parse(JSON.stringify(fixture));
    buildStructuralPartGraph(clone);
    expect(clone).toEqual(fixture);
  });

  it("7. proves output part ordering is strictly stable and matches Golden Wardrobe IDs", () => {
    const expectedPartIds = [
      "CARC_TOP",
      "CARC_BOT",
      "CARC_SIDE_L",
      "CARC_SIDE_R",
      "CARC_DIV_01",
      "SHELF_FIX_L1",
      "SHELF_FIX_R1",
      "SHELF_ADJ_R2",
      "SHELF_ADJ_R3",
      "BACK_PANEL_01",
      "DOOR_01",
      "DOOR_02",
      "DOOR_03",
      "DOOR_04",
      "PLINTH_FRONT",
      "PLINTH_REAR",
      "PLINTH_SIDE_L",
      "PLINTH_SIDE_R",
      "PLINTH_CROSS_C",
    ];
    const partGraph = buildStructuralPartGraph(fixture);
    expect(partGraph.parts.map((p) => p.id)).toEqual(expectedPartIds);
  });

  it("8. proves exact width closure: 180 + 8730 + 180 + 8730 + 180 = 18000 dmm", () => {
    const partGraph = buildStructuralPartGraph(fixture);
    const top = partGraph.parts.find((p) => p.id === "CARC_TOP");
    expect(top.finished.lengthDmm).toBe(18000);
  });

  it("9. proves exact height closure: 1000 + 180 + 22640 + 180 = 24000 dmm", () => {
    const partGraph = buildStructuralPartGraph(fixture);
    const top = partGraph.parts.find((p) => p.id === "CARC_TOP");
    expect(top.placement.maxYDmm).toBe(24000);
  });

  it("10. proves exact depth closure: 180 + 20 + 5800 = 6000 dmm", () => {
    const partGraph = buildStructuralPartGraph(fixture);
    const top = partGraph.parts.find((p) => p.id === "CARC_TOP");
    expect(top.placement.maxZDmm).toBe(6000);
  });

  it("11. proves door gaps are exact (20 dmm)", () => {
    const partGraph = buildStructuralPartGraph(fixture);
    const d1 = partGraph.parts.find((p) => p.id === "DOOR_01");
    const d2 = partGraph.parts.find((p) => p.id === "DOOR_02");
    expect(d1.placement.minXDmm).toBe(20);
    expect(d2.placement.minXDmm - d1.placement.maxXDmm).toBe(20);
  });

  it("12. proves both bays are exactly 8730 deci-mm", () => {
    const partGraph = buildStructuralPartGraph(fixture);
    const shelfL = partGraph.parts.find((p) => p.id === "SHELF_FIX_L1");
    const shelfR = partGraph.parts.find((p) => p.id === "SHELF_FIX_R1");
    expect(shelfL.finished.lengthDmm).toBe(8730);
    expect(shelfR.finished.lengthDmm).toBe(8730);
  });

  it("13. proves all raw-to-finished edge calculations reconcile", () => {
    const partGraph = buildStructuralPartGraph(fixture);
    const valResult = validatePartGraph(partGraph);
    expect(valResult.valid).toBe(true);
    expect(valResult.errors).toEqual([]);
  });

  it("14. proves bounding-box dimensions match finished sizes for all orientations", () => {
    const partGraph = buildStructuralPartGraph(fixture);
    for (const p of partGraph.parts) {
      const dx = p.placement.maxXDmm - p.placement.minXDmm;
      const dy = p.placement.maxYDmm - p.placement.minYDmm;
      const dz = p.placement.maxZDmm - p.placement.minZDmm;

      if (p.orientation === "HORIZONTAL_XZ") {
        const match1 = dx === p.finished.lengthDmm && dz === p.finished.widthDmm;
        const match2 = dz === p.finished.lengthDmm && dx === p.finished.widthDmm;
        expect(match1 || match2).toBe(true);
        expect(dy).toBe(p.finished.thicknessDmm);
      } else if (p.orientation === "VERTICAL_YZ") {
        const match1 = dy === p.finished.lengthDmm && dz === p.finished.widthDmm;
        const match2 = dz === p.finished.lengthDmm && dy === p.finished.widthDmm;
        expect(match1 || match2).toBe(true);
        expect(dx).toBe(p.finished.thicknessDmm);
      } else if (p.orientation === "VERTICAL_XY") {
        const match1 = dy === p.finished.lengthDmm && dx === p.finished.widthDmm;
        const match2 = dx === p.finished.lengthDmm && dy === p.finished.widthDmm;
        expect(match1 || match2).toBe(true);
        expect(dz).toBe(p.finished.thicknessDmm);
      }
    }
  });

  it("15. proves plinth side-inset assumption produces a warning", () => {
    const partGraph = buildStructuralPartGraph(fixture);
    expect(partGraph.warnings).toHaveLength(1);
    expect(partGraph.warnings[0].code).toBe("PLINTH_SIDE_INSET_ASSUMPTION");
  });

  it("16. proves hardware drilling machining is absent from structural operations", () => {
    const partGraph = buildStructuralPartGraph(fixture);
    expect(partGraph.operations).toHaveLength(4);
    for (const op of partGraph.operations) {
      expect(op.type).toBe("BACK_GROOVE");
      expect(op.status).toBe("APPROVED");
    }
  });

  it("17. proves CNC qualification is strictly false", () => {
    const partGraph = buildStructuralPartGraph(fixture);
    expect(partGraph.qualificationStatus).toBe("WORKSHOP_REVIEW_NOT_CNC_QUALIFIED");
    expect(partGraph.qualificationStatus).not.toBe("CNC_QUALIFIED");
  });

  it("18. proves narrow 1-bay 2-door wardrobe generates 0 dividers and 12 parts", () => {
    const partGraph = buildStructuralPartGraph(narrowFixture);
    expect(partGraph.parts).toHaveLength(12);
    expect(partGraph.parts.filter((p) => p.role === "DIVIDER_PANEL")).toHaveLength(0);
    expect(partGraph.parts.filter((p) => p.role === "DOOR_PANEL")).toHaveLength(2);
    const val = validatePartGraph(partGraph);
    expect(val.valid).toBe(true);
  });

  it("19. proves wide 3-bay 6-door wardrobe generates 2 dividers, 6 doors, and 2 plinth stretchers", () => {
    const partGraph = buildStructuralPartGraph(wideFixture);
    expect(partGraph.parts).toHaveLength(23);
    expect(partGraph.parts.filter((p) => p.role === "DIVIDER_PANEL")).toHaveLength(2);
    expect(partGraph.parts.filter((p) => p.role === "DOOR_PANEL")).toHaveLength(6);
    expect(partGraph.parts.filter((p) => p.role === "PLINTH_CROSS_STRETCHER")).toHaveLength(2);
    const val = validatePartGraph(partGraph);
    expect(val.valid).toBe(true);
  });

  it("20. proves height mutation (2100mm) recalculates all dependent Y coordinates", () => {
    const partGraph = buildStructuralPartGraph(heightFixture);
    const top = partGraph.parts.find((p) => p.id === "CARC_TOP");
    expect(top.placement.maxYDmm).toBe(21000);
    const sideL = partGraph.parts.find((p) => p.id === "CARC_SIDE_L");
    expect(sideL.finished.lengthDmm).toBe(19640); // 2000 - 36 = 1964mm
    const doors = partGraph.parts.filter((p) => p.role === "DOOR_PANEL");
    for (const d of doors) {
      expect(d.finished.lengthDmm).toBe(19960); // 2000 - 4 = 1996mm
    }
  });

  it("21. proves moving one shelf (shelf mutation) changes only that shelf", () => {
    const baseline = buildStructuralPartGraph(fixture);
    const mutated = buildStructuralPartGraph(shelfFixture);

    const baseAdj2 = baseline.parts.find((p) => p.id === "SHELF_ADJ_R2");
    const mutAdj2 = mutated.parts.find((p) => p.id === "SHELF_ADJ_R2");

    // In mutated, clearOpeningAboveMm is 400.0 instead of 350.0 (50mm lower: 6280 -> 5780)
    expect(mutAdj2.placement.minYDmm).toBe(baseAdj2.placement.minYDmm - 500);

    // Verify all other parts remain identical in placement and dimensions
    for (const p of baseline.parts) {
      if (p.id !== "SHELF_ADJ_R2") {
        const mutPart = mutated.parts.find((mp) => mp.id === p.id);
        expect(mutPart.placement).toEqual(p.placement);
        expect(mutPart.finished).toEqual(p.finished);
      }
    }
  });

  it("22. proves changing depth changes dependent Z coordinates correctly", () => {
    const depthSpec = {
      ...JSON.parse(JSON.stringify(fixture)),
      envelope: { ...fixture.envelope, depthMm: 700.0 },
      carcass: { ...fixture.carcass, depthMm: 680.0 },
    };
    const partGraph = buildStructuralPartGraph(depthSpec);
    const top = partGraph.parts.find((p) => p.id === "CARC_TOP");
    expect(top.placement.maxZDmm).toBe(7000);
    const sideL = partGraph.parts.find((p) => p.id === "CARC_SIDE_L");
    expect(sideL.finished.widthDmm).toBe(6800);
  });

  it("23. proves invalid inputs fail with structured errors containing { code, message, path }", () => {
    // A. Width mismatch
    const badWidth = { ...JSON.parse(JSON.stringify(fixture)), envelope: { ...fixture.envelope, widthMm: 1900.0 } };
    const resA = validateFurniSpec(badWidth);
    expect(resA.valid).toBe(false);
    expect(resA.errors.some((e) => e.code === "WIDTH_MISMATCH" && e.path === "envelope.widthMm")).toBe(true);

    // B. Sub-0.1-mm precision
    const badPrec = { ...JSON.parse(JSON.stringify(fixture)), envelope: { ...fixture.envelope, widthMm: 1800.25 } };
    const resB = validateFurniSpec(badPrec);
    expect(resB.valid).toBe(false);
    expect(resB.errors.some((e) => e.code === "UNSUPPORTED_DIMENSION_PRECISION")).toBe(true);

    // C. Shelf depth exceeds carcass
    const badShelfDepth = JSON.parse(JSON.stringify(fixture));
    badShelfDepth.bays[0].components[0].depthMm = 900.0;
    const resC = validateFurniSpec(badShelfDepth);
    expect(resC.valid).toBe(false);
    expect(resC.errors.some((e) => e.code === "SHELF_DEPTH_EXCEEDS_CARCASS")).toBe(true);

    // D. Duplicate component ID
    const dupComp = JSON.parse(JSON.stringify(fixture));
    dupComp.bays[1].components[0].id = dupComp.bays[0].components[0].id;
    const resD = validateFurniSpec(dupComp);
    expect(resD.valid).toBe(false);
    expect(resD.errors.some((e) => e.code === "DUPLICATE_ID")).toBe(true);

    // E. Door height mismatch
    const badDoorH = JSON.parse(JSON.stringify(fixture));
    badDoorH.doors.finishedHeightMm = 2200.0;
    const resE = validateFurniSpec(badDoorH);
    expect(resE.valid).toBe(false);
    expect(resE.errors.some((e) => e.code === "DOOR_HEIGHT_MISMATCH")).toBe(true);
  });
});
