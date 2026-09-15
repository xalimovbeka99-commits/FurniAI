/**
 * Drawer-pack contract audits.
 *
 * Roles (in PART_ROLES):
 *   DRAWER_FRONT, DRAWER_SIDE_L, DRAWER_SIDE_R, DRAWER_BACK, DRAWER_BOTTOM
 *
 * Policies (BEK rulings 2026-09-15):
 *   - Ball-bearing slides: exactly 12.7 mm clearance per side
 *   - Concealed undermount: exactly 21.0 mm total width reduction
 *   - Perimeter reveal: exactly 2.0 mm all sides
 *   - Bottom panel thickness: minimum 6.0 mm
 *
 * CNC / drilling remain BLOCKED.
 */
import { PART_ROLES } from "./schema.js";

export const FUTURE_DRAWER_ROLES = Object.freeze({
  DRAWER_FRONT: PART_ROLES.DRAWER_FRONT,
  DRAWER_SIDE_L: PART_ROLES.DRAWER_SIDE_L,
  DRAWER_SIDE_R: PART_ROLES.DRAWER_SIDE_R,
  DRAWER_BACK: PART_ROLES.DRAWER_BACK,
  DRAWER_BOTTOM: PART_ROLES.DRAWER_BOTTOM,
});

export const DRAWER_PACK_POLICY = Object.freeze({
  BALL_BEARING_SIDE_CLEARANCE_MM: 12.7,
  CONCEALED_UNDERMOUNT_TOTAL_REDUCTION_MM: 21.0,
  PERIMETER_REVEAL_MM: 2.0,
  /** @deprecated use PERIMETER_REVEAL_MM — kept as alias during transition */
  MIN_PERIMETER_REVEAL_MM: 2.0,
  MIN_BOTTOM_THICKNESS_MM: 6.0,
});

/**
 * Side runner clearance for standard ball-bearing slides.
 * Expects exactly 12.7 mm per side between box outer faces and bay inner faces.
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
 * Concealed undermount: drawer box width must be bay clear width − 21.0 mm total.
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
 * Perimeter reveal vs neighbour facades / gables. Exactly 2.0 mm on every edge.
 */
export function auditPerimeterReveal(front, aperture, { toleranceMm = 0.05 } = {}) {
  const errors = [];
  const target = DRAWER_PACK_POLICY.PERIMETER_REVEAL_MM;
  const gaps = {
    left: front.minXMm - aperture.minXMm,
    right: aperture.maxXMm - front.maxXMm,
    bottom: front.minYMm - aperture.minYMm,
    top: aperture.maxYMm - front.maxYMm,
  };
  for (const [edge, gap] of Object.entries(gaps)) {
    if (Math.abs(gap - target) > toleranceMm) {
      errors.push({
        code: "DRAWER_FRONT_REVEAL_MISMATCH",
        message: `${edge} reveal ${gap} mm != ${target} mm (±${toleranceMm})`,
        edge,
        actualMm: gap,
        expectedMm: target,
      });
    }
  }
  return { valid: errors.length === 0, errors, gaps };
}

/**
 * Drawer bottom panel thickness ≥ 6.0 mm.
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

function dmmToMm(v) {
  return typeof v === "number" ? v / 10 : undefined;
}

function readCoord(part, keyMm, keyDmm) {
  if (part == null) return undefined;
  if (part[keyMm] != null) return part[keyMm];
  if (part.placement?.[keyMm] != null) return part.placement[keyMm];
  if (part.placement?.[keyDmm] != null) return dmmToMm(part.placement[keyDmm]);
  return undefined;
}

/**
 * When a PartGraph (or synthetic pack) exposes DRAWER_* roles, run all
 * drawer-pack audits. Missing roles → ASPIRATIONAL skip payload (not a pass).
 * Real PartGraph (deci-mm / partGraphVersion) → ENFORCED; synthetic → ENFORCED_SYNTHETIC.
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
    minXMm: readCoord(sideL, "minXMm", "minXDmm"),
    maxXMm: readCoord(sideR, "maxXMm", "maxXDmm"),
    widthMm:
      readCoord(sideR, "maxXMm", "maxXDmm") - readCoord(sideL, "minXMm", "minXDmm"),
  };

  const slideFamily = ctx.slideFamily || "concealed-undermount";
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
      minXMm: readCoord(front, "minXMm", "minXDmm"),
      maxXMm: readCoord(front, "maxXMm", "maxXDmm"),
      minYMm: readCoord(front, "minYMm", "minYDmm"),
      maxYMm: readCoord(front, "maxYMm", "maxYDmm"),
    };
    const r = auditPerimeterReveal(frontRect, ctx.aperture);
    errors.push(...r.errors);
  }

  const thicknessMm =
    bottom.finished?.thicknessMm ??
    (bottom.finished?.thicknessDmm != null ? dmmToMm(bottom.finished.thicknessDmm) : undefined) ??
    bottom.thicknessMm ??
    (bottom.raw?.thicknessDmm != null ? dmmToMm(bottom.raw.thicknessDmm) : undefined) ??
    bottom.raw?.thicknessMm;
  const rBottom = auditDrawerBottomThickness({ thicknessMm, role: bottom.role });
  errors.push(...rBottom.errors);

  const isRealGraph = Boolean(graph.partGraphVersion || graph.unitScale === "deci-mm");
  return {
    status: isRealGraph ? "ENFORCED" : "ENFORCED_SYNTHETIC",
    valid: errors.length === 0,
    errors,
    presentRoles: present,
  };
}
