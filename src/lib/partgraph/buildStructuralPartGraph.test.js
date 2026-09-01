import { describe, expect, it } from "vitest";
import fixture from "../furnispec/goldenWardrobe.fixture.json";
import { buildStructuralPartGraph } from "./buildStructuralPartGraph.js";
import { serializeCanonicalPartGraph } from "./serializePartGraph.js";
import { validatePartGraph } from "./validatePartGraph.js";

describe("Gate G2.2 — Deterministic Structural PartGraph Kernel Suite", () => {
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

  it("7. proves output part ordering is strictly stable", () => {
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

  it("18. proves invalid FurniSpec generates no PartGraph and throws an error", () => {
    const badSpec = { ...fixture, envelope: { ...fixture.envelope, widthMm: 9999 } };
    expect(() => buildStructuralPartGraph(badSpec)).toThrow();
  });

  it("19. proves unsupported decimal precision is rejected", () => {
    const badPrecisionSpec = JSON.parse(JSON.stringify(fixture));
    badPrecisionSpec.envelope.widthMm = 1800.55; // 2 decimal places
    expect(() => buildStructuralPartGraph(badPrecisionSpec)).toThrow();
  });

  it("20. proves alternative supported width (1200mm) recalculates parts without Golden-ID hardcoding", () => {
    // 1200mm 2-bay wardrobe: 2 bays of (1200 - 3*18)/2 = 573mm, 2 doors of (1200 - 3*2)/2 = 597mm
    const altSpec = {
      ...JSON.parse(JSON.stringify(fixture)),
      specId: "furnispec-custom-1200",
      envelope: {
        widthMm: 1200.0,
        heightMm: 2400.0,
        depthMm: 600.0,
      },
      bays: [
        {
          id: "bay-01",
          index: 0,
          clearWidthMm: 573.0,
          components: [],
        },
        {
          id: "bay-02",
          index: 1,
          clearWidthMm: 573.0,
          components: [],
        },
      ],
      doors: {
        count: 2,
        thicknessMm: 18.0,
        bumperGapMm: 2.0,
        finishedWidthMm: 597.0,
        finishedHeightMm: 2296.0,
        reveals: {
          topMm: 2.0,
          bottomMm: 2.0,
          leftMm: 2.0,
          rightMm: 2.0,
          interDoorMm: 2.0,
        },
      },
    };

    const altPartGraph = buildStructuralPartGraph(altSpec);
    expect(altPartGraph.parts).toHaveLength(17); // 2 fewer doors
    const top = altPartGraph.parts.find((p) => p.id === "CARC_TOP");
    expect(top.finished.lengthDmm).toBe(12000); // 1200.0 mm
    const d1 = altPartGraph.parts.find((p) => p.id === "DOOR_01");
    expect(d1.finished.widthDmm).toBe(5970); // 597.0 mm
  });
});
