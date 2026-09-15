/**
 * Synthetic contract assertions for future DRAWER_* PartGraph roles.
 *
 * Locked policies (awaiting Claude Code integ/part-graph-compiler):
 *   - Ball-bearing: exactly 12.7 mm per side
 *   - Concealed undermount: 21 mm total reduction
 *   - Perimeter reveal: flag < 1.5 mm
 *   - Bottom thickness: minimum 6 mm
 *
 * Does not invent PART_ROLES members. Golden PartGraph remains ASPIRATIONAL
 * for drawers until the compiler emits DRAWER_FRONT / SIDE_L / SIDE_R / BACK / BOTTOM.
 */
import { describe, expect, it } from "vitest";
import fixture from "../../src/lib/furnispec/goldenWardrobe.fixture.json";
import { buildStructuralPartGraph } from "../../src/lib/partgraph/buildStructuralPartGraph.js";
import { PART_ROLES } from "../../src/lib/partgraph/schema.js";
import {
  FUTURE_DRAWER_ROLES,
  DRAWER_PACK_POLICY,
  auditBallBearingSideClearance,
  auditConcealedUndermountReduction,
  auditPerimeterReveal,
  auditDrawerBottomThickness,
  auditDrawerPack,
} from "../../src/lib/partgraph/drawerPackContract.js";

function syntheticDrawerParts({
  bayLeft = 18,
  bayRight = 582,
  clearancePerSide = 12.7,
  frontReveal = 1.5,
  bottomThickness = 6,
  aperture = { minXMm: 18, maxXMm: 582, minYMm: 100, maxYMm: 300 },
} = {}) {
  const boxMinX = bayLeft + clearancePerSide;
  const boxMaxX = bayRight - clearancePerSide;
  return {
    parts: [
      {
        id: "DRW_FRONT_01",
        role: FUTURE_DRAWER_ROLES.DRAWER_FRONT,
        minXMm: aperture.minXMm + frontReveal,
        maxXMm: aperture.maxXMm - frontReveal,
        minYMm: aperture.minYMm + frontReveal,
        maxYMm: aperture.maxYMm - frontReveal,
      },
      {
        id: "DRW_SIDE_L_01",
        role: FUTURE_DRAWER_ROLES.DRAWER_SIDE_L,
        placement: { minXMm: boxMinX, maxXMm: boxMinX + 16 },
      },
      {
        id: "DRW_SIDE_R_01",
        role: FUTURE_DRAWER_ROLES.DRAWER_SIDE_R,
        placement: { minXMm: boxMaxX - 16, maxXMm: boxMaxX },
      },
      {
        id: "DRW_BACK_01",
        role: FUTURE_DRAWER_ROLES.DRAWER_BACK,
      },
      {
        id: "DRW_BOTTOM_01",
        role: FUTURE_DRAWER_ROLES.DRAWER_BOTTOM,
        finished: { thicknessMm: bottomThickness },
      },
    ],
    bay: {
      leftInnerMm: bayLeft,
      rightInnerMm: bayRight,
      clearWidthMm: bayRight - bayLeft,
    },
    aperture,
    box: { minXMm: boxMinX, maxXMm: boxMaxX, widthMm: boxMaxX - boxMinX },
  };
}

describe("Drawer-pack contract (awaiting DRAWER_* roles)", () => {
  it("golden PartGraph still has zero DRAWER_* roles (ASPIRATIONAL gate)", () => {
    const graph = buildStructuralPartGraph(fixture);
    const drawerish = graph.parts.filter((p) => String(p.role).startsWith("DRAWER_"));
    expect(drawerish).toEqual([]);
    for (const role of Object.values(FUTURE_DRAWER_ROLES)) {
      expect(Object.values(PART_ROLES)).not.toContain(role);
    }
    const pack = auditDrawerPack(graph);
    expect(pack.status).toBe("ASPIRATIONAL");
    expect(pack.missingRoles).toEqual(
      expect.arrayContaining(Object.values(FUTURE_DRAWER_ROLES)),
    );
  });

  it("ball-bearing: exactly 12.7 mm per side PASSES", () => {
    const pack = syntheticDrawerParts({ clearancePerSide: 12.7 });
    const result = auditBallBearingSideClearance(pack.box, pack.bay);
    expect(result.valid).toBe(true);
    expect(result.clearances.leftMm).toBeCloseTo(DRAWER_PACK_POLICY.BALL_BEARING_SIDE_CLEARANCE_MM, 5);
    expect(result.clearances.rightMm).toBeCloseTo(DRAWER_PACK_POLICY.BALL_BEARING_SIDE_CLEARANCE_MM, 5);
  });

  it("ball-bearing: 12.5 mm per side is REJECTED (too tight vs 12.7)", () => {
    const pack = syntheticDrawerParts({ clearancePerSide: 12.5 });
    const result = auditBallBearingSideClearance(pack.box, pack.bay);
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.code)).toEqual(
      expect.arrayContaining([
        "DRAWER_BALL_BEARING_CLEARANCE_LEFT",
        "DRAWER_BALL_BEARING_CLEARANCE_RIGHT",
      ]),
    );
  });

  it("concealed undermount: 21 mm total reduction PASSES", () => {
    const clearWidthMm = 564;
    const result = auditConcealedUndermountReduction(
      { widthMm: clearWidthMm - 21 },
      { clearWidthMm },
    );
    expect(result.valid).toBe(true);
    expect(result.reductionMm).toBe(
      DRAWER_PACK_POLICY.CONCEALED_UNDERMOUNT_TOTAL_REDUCTION_MM,
    );
  });

  it("concealed undermount: wrong total reduction is REJECTED", () => {
    const result = auditConcealedUndermountReduction(
      { widthMm: 550 },
      { clearWidthMm: 564 },
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe("DRAWER_UNDERMOUNT_REDUCTION_MISMATCH");
  });

  it("perimeter reveal: < 1.5 mm is REJECTED", () => {
    const aperture = { minXMm: 0, maxXMm: 400, minYMm: 0, maxYMm: 200 };
    const front = {
      minXMm: 1.0,
      maxXMm: 398.5,
      minYMm: 1.5,
      maxYMm: 198.5,
    };
    const result = auditPerimeterReveal(front, aperture);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.edge === "left" && e.code === "DRAWER_FRONT_REVEAL_TOO_SMALL")).toBe(
      true,
    );
  });

  it("perimeter reveal: exactly 1.5 mm on all edges PASSES", () => {
    const aperture = { minXMm: 0, maxXMm: 400, minYMm: 0, maxYMm: 200 };
    const front = {
      minXMm: 1.5,
      maxXMm: 398.5,
      minYMm: 1.5,
      maxYMm: 198.5,
    };
    const result = auditPerimeterReveal(front, aperture);
    expect(result.valid).toBe(true);
  });

  it("bottom thickness: 6 mm PASSES; 5 mm REJECTED", () => {
    expect(auditDrawerBottomThickness({ thicknessMm: 6 }).valid).toBe(true);
    const thin = auditDrawerBottomThickness({ thicknessMm: 5 });
    expect(thin.valid).toBe(false);
    expect(thin.errors[0].code).toBe("DRAWER_BOTTOM_TOO_THIN");
  });

  it("full synthetic pack with all five roles ENFORCES ball-bearing + reveal + bottom", () => {
    const syn = syntheticDrawerParts({
      clearancePerSide: 12.7,
      frontReveal: 1.5,
      bottomThickness: 6,
    });
    const result = auditDrawerPack(
      { parts: syn.parts },
      {
        bay: syn.bay,
        aperture: syn.aperture,
        box: syn.box,
        slideFamily: "ball-bearing",
      },
    );
    expect(result.status).toBe("ENFORCED_SYNTHETIC");
    expect(result.valid).toBe(true);
    expect(result.presentRoles).toHaveLength(5);
  });

  it("full synthetic pack REJECTS thin bottom under load policy", () => {
    const syn = syntheticDrawerParts({ bottomThickness: 5 });
    const result = auditDrawerPack(
      { parts: syn.parts },
      {
        bay: syn.bay,
        aperture: syn.aperture,
        box: syn.box,
        slideFamily: "ball-bearing",
      },
    );
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain("DRAWER_BOTTOM_TOO_THIN");
  });
});
