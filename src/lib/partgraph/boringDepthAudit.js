/**
 * PartGraph boring / drilling depth audit (fail-closed, pure).
 * ---------------------------------------------------------------------
 * Inspects operations[] descriptions for BORE / DRILL / HINGE_CUP /
 * SHELF_PIN / CAM style machining. Does NOT unlock CNC or emit
 * production coordinates — production PartGraph still blocks hardware
 * drilling. This helper proves unsafe synthetic machining descriptions
 * fail closed before any factory profile exists.
 */

const DRILL_LIKE = new Set([
  "BORE",
  "DRILL",
  "BLIND_BORE",
  "HINGE_CUP",
  "SHELF_PIN",
  "CAM",
  "MINIFIX_CAM",
  "LINE_BORE",
  "SHELF_SUPPORT_BORE",
]);

const GROOVE_LIKE = new Set(["BACK_GROOVE", "GROOVE"]);

/**
 * @param {Array<object>} operations
 * @param {{ panelThicknessMm?: number, doorThicknessMm?: number }} [opts]
 * @returns {{ valid: boolean, errors: Array<{ code: string, message: string, opId?: string }> }}
 */
export function auditBoringDepths(operations, opts = {}) {
  const panelThicknessMm = opts.panelThicknessMm ?? 18;
  const doorThicknessMm = opts.doorThicknessMm ?? 18;
  const blindMaxMm = panelThicknessMm - 3;
  const errors = [];

  const add = (code, message, opId) => {
    errors.push({ code, message, opId });
  };

  if (!Array.isArray(operations)) {
    return {
      valid: false,
      errors: [{ code: "INVALID_OPERATIONS", message: "operations must be an array" }],
    };
  }

  const grooves = [];
  const camsAndPins = [];

  for (const op of operations) {
    if (!op || typeof op !== "object") {
      add("INVALID_OPERATION", "Operation entry must be an object");
      continue;
    }
    const type = String(op.type || op.kind || "").toUpperCase();
    const opId = op.id || type || "unknown";
    const depthMm = Number(op.depthMm);
    const diameterMm = Number(op.diameterMm);

    if (GROOVE_LIKE.has(type)) {
      grooves.push(op);
      continue;
    }

    if (!DRILL_LIKE.has(type)) {
      continue;
    }

    if (type === "BORE" || type === "DRILL" || type === "BLIND_BORE") {
      if (!Number.isFinite(depthMm) || depthMm <= 0) {
        add(
          "INVALID_BORE_DEPTH",
          `Blind bore "${opId}" has non-positive or non-finite depthMm=${op.depthMm}`,
          opId
        );
      } else if (depthMm > blindMaxMm) {
        add(
          "BLIND_BORE_DEPTH_EXCEEDED",
          `Blind bore "${opId}" depth ${depthMm} mm exceeds max ${blindMaxMm} mm (panelThickness ${panelThicknessMm} - 3).`,
          opId
        );
      }
    }

    if (type === "SHELF_PIN" || type === "LINE_BORE" || type === "SHELF_SUPPORT_BORE") {
      camsAndPins.push(op);
      if (Number.isFinite(diameterMm) && diameterMm !== 5) {
        add(
          "SHELF_PIN_DIAMETER_REJECTED",
          `Shelf pin "${opId}" diameter ${diameterMm} mm must be Ø5 mm.`,
          opId
        );
      }
      if (!Number.isFinite(depthMm) || depthMm <= 0) {
        add(
          "INVALID_SHELF_PIN_DEPTH",
          `Shelf pin "${opId}" has invalid depthMm=${op.depthMm}`,
          opId
        );
      } else if (panelThicknessMm === 18 && depthMm > 13) {
        add(
          "SHELF_PIN_DEPTH_EXCEEDED",
          `Shelf pin "${opId}" depth ${depthMm} mm exceeds 13 mm max in 18 mm panel.`,
          opId
        );
      } else if (depthMm > blindMaxMm) {
        add(
          "SHELF_PIN_DEPTH_EXCEEDED",
          `Shelf pin "${opId}" depth ${depthMm} mm exceeds blind max ${blindMaxMm} mm.`,
          opId
        );
      }
    }

    if (type === "HINGE_CUP") {
      if (Number.isFinite(diameterMm) && diameterMm !== 35) {
        add(
          "HINGE_CUP_DIAMETER_REJECTED",
          `Hinge cup "${opId}" diameter ${diameterMm} mm must be Ø35 mm.`,
          opId
        );
      }
      if (!Number.isFinite(depthMm) || depthMm <= 0) {
        add(
          "INVALID_HINGE_CUP_DEPTH",
          `Hinge cup "${opId}" has invalid depthMm=${op.depthMm}`,
          opId
        );
      } else if (doorThicknessMm === 18 && depthMm > 12.5) {
        add(
          "HINGE_CUP_DEPTH_EXCEEDED",
          `Hinge cup "${opId}" depth ${depthMm} mm exceeds 12.5 mm max in 18 mm door.`,
          opId
        );
      }
    }

    if (type === "CAM" || type === "MINIFIX_CAM") {
      camsAndPins.push(op);
      if (!Number.isFinite(depthMm) || depthMm <= 0) {
        add("INVALID_CAM_DEPTH", `Cam "${opId}" has invalid depthMm=${op.depthMm}`, opId);
      } else if (depthMm > blindMaxMm) {
        add(
          "CAM_DEPTH_EXCEEDED",
          `Cam "${opId}" depth ${depthMm} mm exceeds blind max ${blindMaxMm} mm.`,
          opId
        );
      }
    }
  }

  for (const groove of grooves) {
    for (const other of camsAndPins) {
      if (intersectsGrooveAndBore(groove, other)) {
        add(
          "REJECTED",
          `Back groove "${groove.id || "GROOVE"}" intersects drilling "${other.id || other.type}" — refuse conflicting machining.`,
          groove.id || other.id
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Conservative conflict detector for synthetic ops.
 * Explicit flags always reject; same-host groove+bore without positions fail closed.
 */
function intersectsGrooveAndBore(groove, bore) {
  if (bore.conflictsWithGroove === true || bore.intersectGroove === true) {
    return true;
  }
  const sameHost =
    groove.hostPartId &&
    bore.hostPartId &&
    String(groove.hostPartId) === String(bore.hostPartId);
  if (!sameHost) return false;

  const gp = groove.positionMm || groove.spanMm;
  const bp = bore.positionMm;
  if (!gp || !bp) {
    return true;
  }

  const gMin = Number(gp.min ?? gp.y ?? gp.z ?? NaN);
  const gMax = Number(
    gp.max ?? (Number.isFinite(gMin) ? gMin + Number(groove.widthMm || (groove.widthDmm || 70) / 10 || 7) : NaN)
  );
  const bCenter = Number(bp.y ?? bp.z ?? bp.x ?? NaN);
  const bRadius = Number(bore.diameterMm || 5) / 2;
  if (![gMin, gMax, bCenter].every(Number.isFinite)) {
    return true;
  }
  return bCenter + bRadius > gMin && bCenter - bRadius < gMax;
}
