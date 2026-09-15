/**
 * Drawer-pack contract audits (aspirational until Claude lands DRAWER_* roles).
 *
 * Target roles (compiler contract — not in PART_ROLES v0.1 yet):
 *   DRAWER_FRONT, DRAWER_SIDE_L, DRAWER_SIDE_R, DRAWER_BACK, DRAWER_BOTTOM
 *
 * Policies (BEK adversarial QA, 2026-09-15):
 *   - Ball-bearing slides: exactly 12.7 mm clearance per side
 *   - Concealed undermount: 21 mm total width reduction (box clear width)
 *   - Perimeter reveal: flag any drawer front < 1.5 mm vs neighbour facades/gables
 *   - Bottom panel thickness: minimum 6 mm
 *
 * CNC / drilling remain BLOCKED. These helpers do not invent PART_ROLES members.
 */
export const FUTURE_DRAWER_ROLES = Object.freeze({
  DRAWER_FRONT: "DRAWER_FRONT",
  DRAWER_SIDE_L: "DRAWER_SIDE_L",
  DRAWER_SIDE_R: "DRAWER_SIDE_R",
  DRAWER_BACK: "DRAWER_BACK",
  DRAWER_BOTTOM: "DRAWER_BOTTOM",
});

export const DRAWER_PACK_POLICY = Object.freeze({
  BALL_BEARING_SIDE_CLEARANCE_MM: 12.7,
  CONCEALED_UNDERMOUNT_TOTAL_REDUCTION_MM: 21,
  MIN_PERIMETER_REVEAL_MM: 1.5,
  MIN_BOTTOM_THICKNESS_MM: 6,
});

/**
 * Side runner clearance for standard ball-bearing slides.
 * Expects exactly 12.7 mm per side between box outer faces and bay inner faces.
 * @param {{ minXMm: number, maxXMm: number }} box
 * @param {{ leftInnerMm: number, rightInnerMm: number }} bay
 * @param {{ toleranceMm?: number }} [opts]
 */
export function auditBallBearingSideClearance(box, bay, { toleranceMm = 0.05 } = {}) {
  const errors = [];
  const left = box.minXMm - bay.leftInnerMm;
  const right = bay.rightInnerMm - box.maxXMm;
  const target = DRAWER_PACK_POLICY.BALL_BEARING_SIDE_CLEARANCE_MM;
  if (Math.abs(left - target) > toleranceMm) {
    errors.push({
      code: "DRAWER_BALL_BEARING_CLEARANCE_LEFT",
      message: `left clearance ${left} mm != ${target} mm (±${toleranceMm})`,
      expectedMm: target,
      actualMm: left,
    });
  }
  if (Math.abs(right - target) > toleranceMm) {
    errors.push({
      code: "DRAWER_BALL_BEARING_CLEARANCE_RIGHT",
      message: `right clearance ${right} mm != ${target} mm (±${toleranceMm})`,
      expectedMm: target,
      actualMm: right,
    });
  }
  return {
    valid: errors.length === 0,
    errors,
    clearances: { leftMm: left, rightMm: right, totalReductionMm: left + right },
  };
}

/**
 * Concealed undermount: drawer box width must be bay clear width − 21 mm total.
 * @param {{ widthMm: number }} box
 * @param {{ clearWidthMm: number }} bay
 * @param {{ toleranceMm?: number }} [opts]
 */
export function auditConcealedUndermountReduction(box, bay, { toleranceMm = 0.05 } = {}) {
  const errors = [];
  const reduction = bay.clearWidthMm - box.widthMm;
  const target = DRAWER_PACK_POLICY.CONCEALED_UNDERMOUNT_TOTAL_REDUCTION_MM;
  if (Math.abs(reduction - target) > toleranceMm) {
    errors.push({
      code: "DRAWER_UNDERMOUNT_REDUCTION_MISMATCH",
      message: `total reduction ${reduction} mm != ${target} mm (±${toleranceMm})`,
      expectedMm: target,
      actualMm: reduction,
    });
  }
  return {
    valid: errors.length === 0,
    errors,
    reductionMm: reduction,
  };
}

/**
 * Perimeter reveal vs neighbour facades / gables. Flag any edge < 1.5 mm.
 * @param {{ minXMm: number, maxXMm: number, minYMm: number, maxYMm: number }} front
 * @param {{ minXMm: number, maxXMm: number, minYMm: number, maxYMm: number }} aperture
 */
export function auditPerimeterReveal(front, aperture) {
  const errors = [];
  const min = DRAWER_PACK_POLICY.MIN_PERIMETER_REVEAL_MM;
  const gaps = {
    left: front.minXMm - aperture.minXMm,
    right: aperture.maxXMm - front.maxXMm,
    bottom: front.minYMm - aperture.minYMm,
    top: aperture.maxYMm - front.maxYMm,
  };
  for (const [edge, gap] of Object.entries(gaps)) {
    if (gap < min) {
      errors.push({
        code: "DRAWER_FRONT_REVEAL_TOO_SMALL",
        message: `${edge} reveal ${gap} mm < ${min} mm`,
        edge,
        actualMm: gap,
        minMm: min,
      });
    }
  }
  return { valid: errors.length === 0, errors, gaps };
}

/**
 * Drawer bottom panel thickness ≥ 6 mm.
 * @param {{ thicknessMm: number, role?: string }} bottom
 */
export function auditDrawerBottomThickness(bottom) {
  const errors = [];
  const min = DRAWER_PACK_POLICY.MIN_BOTTOM_THICKNESS_MM;
  if (!(bottom.thicknessMm >= min)) {
    errors.push({
      code: "DRAWER_BOTTOM_TOO_THIN",
      message: `bottom thickness ${bottom.thicknessMm} mm < ${min} mm`,
      actualMm: bottom.thicknessMm,
      minMm: min,
    });
  }
  return { valid: errors.length === 0, errors };
}

/**
 * When a PartGraph (or synthetic pack) exposes FUTURE_DRAWER_ROLES, run all
 * drawer-pack audits. Missing roles → ASPIRATIONAL skip payload (not a pass).
 * @param {{ parts: Array<{ role: string, finished?: { thicknessMm?: number }, placement?: object, raw?: object }> }} graph
 * @param {{ bay?: object, aperture?: object, slideFamily?: 'ball-bearing'|'concealed-undermount' }} ctx
 */
export function auditDrawerPack(graph, ctx = {}) {
  const byRole = Object.fromEntries(
    (graph.parts || [])
      .filter((p) => Object.values(FUTURE_DRAWER_ROLES).includes(p.role))
      .map((p) => [p.role, p]),
  );
  const present = Object.keys(byRole);
  const expected = Object.values(FUTURE_DRAWER_ROLES);
  const missing = expected.filter((r) => !present.includes(r));
  if (missing.length) {
    return {
      status: "ASPIRATIONAL",
      reason: "DRAWER_* roles not present on PartGraph",
      missingRoles: missing,
      presentRoles: present,
      valid: null,
      errors: [],
    };
  }

  const errors = [];
  const sideL = byRole.DRAWER_SIDE_L;
  const sideR = byRole.DRAWER_SIDE_R;
  const bottom = byRole.DRAWER_BOTTOM;
  const front = byRole.DRAWER_FRONT;

  const box = ctx.box || {
    minXMm: sideL.placement?.minXMm ?? sideL.minXMm,
    maxXMm: sideR.placement?.maxXMm ?? sideR.maxXMm,
    widthMm:
      (sideR.placement?.maxXMm ?? sideR.maxXMm) -
      (sideL.placement?.minXMm ?? sideL.minXMm),
  };

  const slideFamily = ctx.slideFamily || "ball-bearing";
  if (slideFamily === "ball-bearing" && ctx.bay) {
    const r = auditBallBearingSideClearance(box, ctx.bay);
    errors.push(...r.errors);
  }
  if (slideFamily === "concealed-undermount" && ctx.bay) {
    const r = auditConcealedUndermountReduction(
      { widthMm: box.widthMm },
      { clearWidthMm: ctx.bay.clearWidthMm ?? ctx.bay.rightInnerMm - ctx.bay.leftInnerMm },
    );
    errors.push(...r.errors);
  }

  if (ctx.aperture && front) {
    const frontRect = {
      minXMm: front.placement?.minXMm ?? front.minXMm,
      maxXMm: front.placement?.maxXMm ?? front.maxXMm,
      minYMm: front.placement?.minYMm ?? front.minYMm,
      maxYMm: front.placement?.maxYMm ?? front.maxYMm,
    };
    const r = auditPerimeterReveal(frontRect, ctx.aperture);
    errors.push(...r.errors);
  }

  const thicknessMm =
    bottom.finished?.thicknessMm ??
    bottom.thicknessMm ??
    bottom.raw?.thicknessMm;
  const rBottom = auditDrawerBottomThickness({ thicknessMm, role: bottom.role });
  errors.push(...rBottom.errors);

  return {
    status: "ENFORCED_SYNTHETIC",
    valid: errors.length === 0,
    errors,
    presentRoles: present,
  };
}
