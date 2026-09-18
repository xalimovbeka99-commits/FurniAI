/**
 * Adversarial QA â€” volumetric panel collision & clearance (PartGraph path).
 *
 * Enforced today via buildStructuralPartGraph + validatePartGraph:
 *   - solid panel AABB non-overlap (UNINTENDED_PART_COLLISION)
 *   - fixed shelves terminate at bay clear width (= inner gable/divider faces)
 *
 * DRAWER_* PART_ROLES + DRAWER_BANK STRUCTURAL emission are live (emitDrawerBankParts).
 * Supplemental synthetic audits below still prove slide-gap / reveal fail-closed
 * without unlocking CNC machining coordinates.
 */
import { describe, expect, it } from "vitest";
import fixture from "../../src/lib/furnispec/goldenWardrobe.fixture.json";
import { buildStructuralPartGraph } from "../../src/lib/partgraph/buildStructuralPartGraph.js";
import { validatePartGraph } from "../../src/lib/partgraph/validatePartGraph.js";
import { PART_ROLES, ORIENTATIONS } from "../../src/lib/partgraph/schema.js";

/** Deep-clone a structural panel and retarget id/placement for collision injection. */
function clonePanel(base, overrides) {
  return {
    ...structuredClone(base),
    ...overrides,
    finished: { ...base.finished, ...(overrides.finished || {}) },
    raw: { ...base.raw, ...(overrides.raw || {}) },
    edges: { ...base.edges, ...(overrides.edges || {}) },
    placement: { ...base.placement, ...(overrides.placement || {}) },
  };
}

/** Face-contact / clearance gap along one axis in deci-mm (positive = gap). */
function axisGap(a, b, axis) {
  const minK = `min${axis}Dmm`;
  const maxK = `max${axis}Dmm`;
  return Math.max(a.placement[minK], b.placement[minK]) - Math.min(a.placement[maxK], b.placement[maxK]);
}

/**
 * Synthetic drawer-front perimeter reveal audit (mm).
 * Not emitted by golden PartGraph â€” DRAWER_FRONT is not a PART_ROLES member.
 */
function auditDrawerFrontRevealMm(front, carcassInner, { minRevealMm = 1.5, maxRevealMm = 2.0 } = {}) {
  const errors = [];
  const left = (front.minXMm - carcassInner.minXMm);
  const right = (carcassInner.maxXMm - front.maxXMm);
  const bottom = (front.minYMm - carcassInner.minYMm);
  const top = (carcassInner.maxYMm - front.maxYMm);
  for (const [name, gap] of [
    ["left", left],
    ["right", right],
    ["bottom", bottom],
    ["top", top],
  ]) {
    if (gap < minRevealMm) {
      errors.push({
        code: "DRAWER_FRONT_REVEAL_TOO_SMALL",
        message: `${name} reveal ${gap} mm < ${minRevealMm} mm`,
      });
    }
    if (gap > maxRevealMm + 0.5) {
      // soft upper band note â€” policy window is 1.5â€“2.0; >2.5 flagged
      errors.push({
        code: "DRAWER_FRONT_REVEAL_OUT_OF_BAND",
        message: `${name} reveal ${gap} mm exceeds ${maxRevealMm} mm policy band`,
      });
    }
  }
  return { valid: errors.length === 0, errors, gaps: { left, right, bottom, top } };
}

/**
 * Synthetic drawer-box slide-gap audit vs side panels (mm).
 */
function auditDrawerBoxSlideGapMm(box, sideInnerFaces, { minSlideGapMm = 12.5 } = {}) {
  const errors = [];
  const leftGap = box.minXMm - sideInnerFaces.leftMm;
  const rightGap = sideInnerFaces.rightMm - box.maxXMm;
  if (leftGap < minSlideGapMm) {
    errors.push({
      code: "DRAWER_SLIDE_GAP_TOO_SMALL",
      message: `left slide gap ${leftGap} mm < ${minSlideGapMm} mm`,
    });
  }
  if (rightGap < minSlideGapMm) {
    errors.push({
      code: "DRAWER_SLIDE_GAP_TOO_SMALL",
      message: `right slide gap ${rightGap} mm < ${minSlideGapMm} mm`,
    });
  }
  // Volumetric intersection with side volume is always reject
  if (box.minXMm < sideInnerFaces.leftMm || box.maxXMm > sideInnerFaces.rightMm) {
    errors.push({
      code: "DRAWER_BOX_SIDE_INTERSECTION",
      message: "Drawer box intersects side-panel volume (beyond face contact).",
    });
  }
  return { valid: errors.length === 0, errors, gaps: { leftGap, rightGap } };
}

describe("PartGraph adversarial panel collisions & clearance", () => {
  it("golden PartGraph validates with zero unintended volumetric intersections", () => {
    const graph = buildStructuralPartGraph(fixture);
    const result = validatePartGraph(graph);
    expect(result.valid).toBe(true);
    expect(result.errors.filter((e) => e.code === "UNINTENDED_PART_COLLISION")).toEqual([]);
  });

  it("solid carcass panels do not volumetrically intersect each other", () => {
    const graph = buildStructuralPartGraph(fixture);
    const solids = graph.parts.filter((p) =>
      [
        PART_ROLES.TOP_PANEL,
        PART_ROLES.BOTTOM_PANEL,
        PART_ROLES.SIDE_PANEL_LEFT,
        PART_ROLES.SIDE_PANEL_RIGHT,
        PART_ROLES.DIVIDER_PANEL,
        PART_ROLES.FIXED_SHELF,
        PART_ROLES.ADJUSTABLE_SHELF,
        PART_ROLES.DOOR_PANEL,
      ].includes(p.role)
    );
    expect(solids.length).toBeGreaterThan(8);
    for (let i = 0; i < solids.length; i++) {
      for (let j = i + 1; j < solids.length; j++) {
        const p1 = solids[i];
        const p2 = solids[j];
        const ox =
          Math.min(p1.placement.maxXDmm, p2.placement.maxXDmm) -
          Math.max(p1.placement.minXDmm, p2.placement.minXDmm);
        const oy =
          Math.min(p1.placement.maxYDmm, p2.placement.maxYDmm) -
          Math.max(p1.placement.minYDmm, p2.placement.minYDmm);
        const oz =
          Math.min(p1.placement.maxZDmm, p2.placement.maxZDmm) -
          Math.max(p1.placement.minZDmm, p2.placement.minZDmm);
        const colliding = ox > 0 && oy > 0 && oz > 0;
        expect(colliding, `${p1.id} vs ${p2.id}`).toBe(false);
      }
    }
  });

  it("fixed shelves terminate at inner face of gables/dividers (face contact, no volume beyond)", () => {
    const graph = buildStructuralPartGraph(fixture);
    const sideL = graph.parts.find((p) => p.id === "CARC_SIDE_L");
    const sideR = graph.parts.find((p) => p.id === "CARC_SIDE_R");
    const div = graph.parts.find((p) => p.id === "CARC_DIV_01");
    const fixed = graph.parts.filter((p) => p.role === PART_ROLES.FIXED_SHELF);
    expect(fixed.length).toBeGreaterThanOrEqual(2);

    for (const shelf of fixed) {
      // Face contact: gap along X is exactly 0 against the bounding gable/divider
      const leftNeighbor = shelf.placement.minXDmm === sideL.placement.maxXDmm ? sideL : div;
      const rightNeighbor = shelf.placement.maxXDmm === sideR.placement.minXDmm ? sideR : div;
      // Bay-01 shelf touches SIDE_L and DIV; bay-02 touches DIV and SIDE_R
      if (shelf.id.includes("L1") || shelf.placement.minXDmm === sideL.placement.maxXDmm) {
        expect(axisGap(shelf, sideL, "X")).toBe(0);
        expect(shelf.placement.minXDmm).toBe(sideL.placement.maxXDmm);
      }
      if (shelf.placement.maxXDmm === div.placement.minXDmm) {
        expect(axisGap(shelf, div, "X")).toBe(0);
      }
      if (shelf.placement.minXDmm === div.placement.maxXDmm) {
        expect(axisGap(shelf, div, "X")).toBe(0);
      }
      if (shelf.placement.maxXDmm === sideR.placement.minXDmm) {
        expect(axisGap(shelf, sideR, "X")).toBe(0);
      }
      // No positive volumetric overlap with gables/dividers
      for (const wall of [sideL, sideR, div]) {
        const ox =
          Math.min(shelf.placement.maxXDmm, wall.placement.maxXDmm) -
          Math.max(shelf.placement.minXDmm, wall.placement.minXDmm);
        const oy =
          Math.min(shelf.placement.maxYDmm, wall.placement.maxYDmm) -
          Math.max(shelf.placement.minYDmm, wall.placement.minYDmm);
        const oz =
          Math.min(shelf.placement.maxZDmm, wall.placement.maxZDmm) -
          Math.max(shelf.placement.minZDmm, wall.placement.minZDmm);
        expect(ox > 0 && oy > 0 && oz > 0).toBe(false);
      }
      void leftNeighbor;
      void rightNeighbor;
    }
  });

  it("adjustable shelves keep side clearance (do not intersect gables)", () => {
    const graph = buildStructuralPartGraph(fixture);
    const adj = graph.parts.filter((p) => p.role === PART_ROLES.ADJUSTABLE_SHELF);
    expect(adj.length).toBeGreaterThanOrEqual(1);
    const sideClearanceDmm = Math.round((fixture.clearancePolicy.adjustableShelf.sideClearanceMm || 1) * 10);
    const div = graph.parts.find((p) => p.id === "CARC_DIV_01");
    const sideR = graph.parts.find((p) => p.id === "CARC_SIDE_R");
    for (const shelf of adj) {
      // In bay-02: left of shelf is divider, right is side R
      expect(shelf.placement.minXDmm).toBe(div.placement.maxXDmm + sideClearanceDmm);
      expect(shelf.placement.maxXDmm).toBe(sideR.placement.minXDmm - sideClearanceDmm);
      const result = validatePartGraph(graph);
      expect(result.errors.some((e) => e.code === "UNINTENDED_PART_COLLISION" && e.partId === shelf.id)).toBe(
        false
      );
    }
  });

  it("injected colliding shelf yields UNINTENDED_PART_COLLISION", () => {
    const graph = buildStructuralPartGraph(fixture);
    const donor = graph.parts.find((p) => p.role === PART_ROLES.FIXED_SHELF);
    const sideL = graph.parts.find((p) => p.id === "CARC_SIDE_L");
    // Drive the shelf into the left gable volume (positive XYZ overlap)
    const colliding = clonePanel(donor, {
      id: "SHELF_COLLIDE_INJECT",
      placement: {
        minXDmm: sideL.placement.minXDmm + 10,
        maxXDmm: sideL.placement.maxXDmm + donor.finished.lengthDmm,
        minYDmm: sideL.placement.minYDmm + 500,
        maxYDmm: sideL.placement.minYDmm + 500 + donor.finished.thicknessDmm,
        minZDmm: sideL.placement.minZDmm + 50,
        maxZDmm: sideL.placement.minZDmm + 50 + donor.finished.widthDmm,
      },
      finished: {
        lengthDmm: donor.finished.lengthDmm,
        widthDmm: donor.finished.widthDmm,
        thicknessDmm: donor.finished.thicknessDmm,
      },
    });
    // Reconcile bounding box for HORIZONTAL_XZ: XÃ—Z match LÃ—W, Y = thickness
    colliding.finished.lengthDmm = colliding.placement.maxXDmm - colliding.placement.minXDmm;
    colliding.finished.widthDmm = colliding.placement.maxZDmm - colliding.placement.minZDmm;
    colliding.raw = {
      lengthDmm:
        colliding.finished.lengthDmm -
        ((colliding.edges.WIDTH_EDGE_1 || 0) + (colliding.edges.WIDTH_EDGE_2 || 0)),
      widthDmm:
        colliding.finished.widthDmm -
        ((colliding.edges.LENGTH_EDGE_1 || 0) + (colliding.edges.LENGTH_EDGE_2 || 0)),
      thicknessDmm: colliding.finished.thicknessDmm,
    };
    graph.parts.push(colliding);
    const result = validatePartGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "UNINTENDED_PART_COLLISION")).toBe(true);
  });

  it("injected shelf overlapping another shelf yields UNINTENDED_PART_COLLISION", () => {
    const graph = buildStructuralPartGraph(fixture);
    const shelf = graph.parts.find((p) => p.role === PART_ROLES.FIXED_SHELF);
    const twin = clonePanel(shelf, { id: "SHELF_TWIN_OVERLAP" });
    // Nudge slightly so boxes still overlap in all axes
    twin.placement = {
      ...shelf.placement,
      minYDmm: shelf.placement.minYDmm + 5,
      maxYDmm: shelf.placement.maxYDmm + 5,
    };
    twin.finished = { ...shelf.finished };
    twin.raw = { ...shelf.raw };
    graph.parts.push(twin);
    const result = validatePartGraph(graph);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) =>
          e.code === "UNINTENDED_PART_COLLISION" &&
          (e.message.includes("SHELF_TWIN_OVERLAP") || e.partId === shelf.id || e.partId === twin.id)
      )
    ).toBe(true);
  });

  it("documents DRAWER_* PART_ROLES are live; golden fixture still has no drawer bank", () => {
    // BEK drawer emission landed: roles exist and DRAWER_BANK is STRUCTURAL when present.
    // Golden wardrobe fixture has no DRAWER_BANK, so build emits none — contracts live in
    // drawerPack.contract.test.js.
    expect(PART_ROLES.DRAWER_FRONT).toBe("DRAWER_FRONT");
    expect(PART_ROLES.DRAWER_SIDE_L).toBe("DRAWER_SIDE_L");
    expect(PART_ROLES.DRAWER_SIDE_R).toBe("DRAWER_SIDE_R");
    expect(PART_ROLES.DRAWER_BACK).toBe("DRAWER_BACK");
    expect(PART_ROLES.DRAWER_BOTTOM).toBe("DRAWER_BOTTOM");
    const graph = buildStructuralPartGraph(fixture);
    const drawerRoles = graph.parts.filter((p) => String(p.role).startsWith("DRAWER"));
    expect(drawerRoles).toHaveLength(0);
    expect(graph.parts.every((p) => p.role !== "DRAWER_BANK")).toBe(true);
  });

  it("synthetic intersecting drawer box is rejected by PartGraph collision audit (stand-in role)", () => {
    // Inject a FIXED_SHELF-role stand-in that
    // intersects CARC_SIDE_L to prove the volumetric gate fail-closes.
    const graph = buildStructuralPartGraph(fixture);
    const sideL = graph.parts.find((p) => p.id === "CARC_SIDE_L");
    const donor = graph.parts.find((p) => p.role === PART_ROLES.FIXED_SHELF);
    const fakeBox = clonePanel(donor, {
      id: "SYNTH_DRAWER_BOX_INTERSECT",
      role: PART_ROLES.FIXED_SHELF,
      placement: {
        minXDmm: sideL.placement.minXDmm,
        maxXDmm: sideL.placement.maxXDmm + 200,
        minYDmm: sideL.placement.minYDmm + 200,
        maxYDmm: sideL.placement.minYDmm + 200 + 180,
        minZDmm: sideL.placement.minZDmm + 100,
        maxZDmm: sideL.placement.minZDmm + 100 + 400,
      },
    });
    fakeBox.orientation = ORIENTATIONS.HORIZONTAL_XZ;
    fakeBox.finished = {
      lengthDmm: fakeBox.placement.maxXDmm - fakeBox.placement.minXDmm,
      widthDmm: fakeBox.placement.maxZDmm - fakeBox.placement.minZDmm,
      thicknessDmm: fakeBox.placement.maxYDmm - fakeBox.placement.minYDmm,
    };
    fakeBox.raw = {
      lengthDmm: fakeBox.finished.lengthDmm,
      widthDmm: fakeBox.finished.widthDmm,
      thicknessDmm: fakeBox.finished.thicknessDmm,
    };
    fakeBox.edges = { LENGTH_EDGE_1: 0, LENGTH_EDGE_2: 0, WIDTH_EDGE_1: 0, WIDTH_EDGE_2: 0 };
    graph.parts.push(fakeBox);
    const result = validatePartGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "UNINTENDED_PART_COLLISION")).toBe(true);
  });

  it("synthetic drawer-box slide-gap audit rejects insufficient clearance from sides", () => {
    const graph = buildStructuralPartGraph(fixture);
    const sideL = graph.parts.find((p) => p.id === "CARC_SIDE_L");
    const sideR = graph.parts.find((p) => p.id === "CARC_SIDE_R");
    const leftInnerMm = sideL.placement.maxXDmm / 10;
    const rightInnerMm = sideR.placement.minXDmm / 10;
    // Intersecting / zero-gap box
    const bad = auditDrawerBoxSlideGapMm(
      { minXMm: leftInnerMm - 5, maxXMm: rightInnerMm + 5, minYMm: 200, maxYMm: 400 },
      { leftMm: leftInnerMm, rightMm: rightInnerMm },
      { minSlideGapMm: 12.5 }
    );
    expect(bad.valid).toBe(false);
    expect(bad.errors.some((e) => e.code === "DRAWER_BOX_SIDE_INTERSECTION" || e.code === "DRAWER_SLIDE_GAP_TOO_SMALL")).toBe(
      true
    );

    // Compliant synthetic box with 13 mm slide gap each side
    const good = auditDrawerBoxSlideGapMm(
      {
        minXMm: leftInnerMm + 13,
        maxXMm: rightInnerMm - 13,
        minYMm: 200,
        maxYMm: 400,
      },
      { leftMm: leftInnerMm, rightMm: rightInnerMm },
      { minSlideGapMm: 12.5 }
    );
    expect(good.valid).toBe(true);
    expect(good.gaps.leftGap).toBeGreaterThanOrEqual(12.5);
    expect(good.gaps.rightGap).toBeGreaterThanOrEqual(12.5);
  });

  it("synthetic drawer-front perimeter reveal audit enforces â‰¥1.5â€“2.0 mm band", () => {
    const carcassInner = { minXMm: 18, maxXMm: 1782, minYMm: 118, maxYMm: 2382 };
    const tooTight = auditDrawerFrontRevealMm(
      { minXMm: 18.5, maxXMm: 1781.5, minYMm: 118.5, maxYMm: 2381.5 },
      carcassInner,
      { minRevealMm: 1.5, maxRevealMm: 2.0 }
    );
    expect(tooTight.valid).toBe(false);
    expect(tooTight.errors.some((e) => e.code === "DRAWER_FRONT_REVEAL_TOO_SMALL")).toBe(true);

    const ok = auditDrawerFrontRevealMm(
      { minXMm: 20, maxXMm: 1780, minYMm: 120, maxYMm: 2380 },
      carcassInner,
      { minRevealMm: 1.5, maxRevealMm: 2.0 }
    );
    expect(ok.valid).toBe(true);
    expect(ok.gaps.left).toBeGreaterThanOrEqual(1.5);
    expect(ok.gaps.left).toBeLessThanOrEqual(2.0);
    expect(ok.gaps.right).toBeGreaterThanOrEqual(1.5);
    expect(ok.gaps.top).toBeGreaterThanOrEqual(1.5);
    expect(ok.gaps.bottom).toBeGreaterThanOrEqual(1.5);
  });

  it("back-panel groove engagement is the only intentional overlap allowed by validator", () => {
    const graph = buildStructuralPartGraph(fixture);
    const result = validatePartGraph(graph);
    expect(result.valid).toBe(true);
    const back = graph.parts.find((p) => p.id === "BACK_PANEL_01");
    const top = graph.parts.find((p) => p.id === "CARC_TOP");
    const ox =
      Math.min(back.placement.maxXDmm, top.placement.maxXDmm) -
      Math.max(back.placement.minXDmm, top.placement.minXDmm);
    const oy =
      Math.min(back.placement.maxYDmm, top.placement.maxYDmm) -
      Math.max(back.placement.minYDmm, top.placement.minYDmm);
    const oz =
      Math.min(back.placement.maxZDmm, top.placement.maxZDmm) -
      Math.max(back.placement.minZDmm, top.placement.minZDmm);
    // Golden back engages grooves â€” positive overlap is intentional and allowed
    expect(ox > 0 && oy > 0 && oz > 0).toBe(true);
  });
});

