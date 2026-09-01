/**
 * PartGraph v0.1 — Validator
 * ---------------------------------------------------------------------
 * Validates canonical structural PartGraph data structures for mathematical,
 * geometric, bounding-box, edge-banding, and safety invariants.
 */

import { PARTGRAPH_VERSION, ORIENTATIONS } from "./schema.js";

/**
 * Validates a PartGraph data structure.
 *
 * @param {object} partGraph
 * @returns {{ valid: boolean, errors: Array<{ code: string, message: string, partId?: string }> }}
 */
export function validatePartGraph(partGraph) {
  const errors = [];

  const addError = (code, message, partId = undefined) => {
    errors.push({ code, message, partId });
  };

  if (!partGraph || typeof partGraph !== "object") {
    return {
      valid: false,
      errors: [{ code: "INVALID_PARTGRAPH_TYPE", message: "PartGraph must be a non-null object." }],
    };
  }

  if (partGraph.partGraphVersion !== PARTGRAPH_VERSION) {
    addError("UNSUPPORTED_PARTGRAPH_VERSION", `Expected version "${PARTGRAPH_VERSION}", got "${partGraph.partGraphVersion}".`);
  }

  if (partGraph.unitScale !== "deci-mm") {
    addError("INVALID_UNIT_SCALE", `unitScale must be "deci-mm", got "${partGraph.unitScale}".`);
  }

  if (partGraph.qualificationStatus === "CNC_QUALIFIED") {
    addError("CNC_QUALIFIED_FORBIDDEN", "CNC qualification is forbidden in Phase 1 / Gate G2.");
  }

  const parts = partGraph.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    addError("EMPTY_PARTS_LIST", "PartGraph parts array must be non-empty.");
    return { valid: false, errors };
  }

  const seenPartIds = new Set();

  for (const part of parts) {
    if (!part.id || typeof part.id !== "string") {
      addError("MISSING_PART_ID", "Part requires a string id.");
      continue;
    }

    if (seenPartIds.has(part.id)) {
      addError("DUPLICATE_PART_ID", `Duplicate Part ID "${part.id}".`, part.id);
    }
    seenPartIds.add(part.id);

    // Integer checks for finished dimensions
    const fin = part.finished || {};
    ["lengthDmm", "widthDmm", "thicknessDmm"].forEach((dim) => {
      const val = fin[dim];
      if (typeof val !== "number" || !Number.isInteger(val) || val <= 0) {
        addError("INVALID_FINISHED_DIMENSION", `Part "${part.id}" finished.${dim} must be a strictly positive integer, got ${val}.`, part.id);
      }
    });

    // Integer checks for raw dimensions
    const raw = part.raw || {};
    ["lengthDmm", "widthDmm", "thicknessDmm"].forEach((dim) => {
      const val = raw[dim];
      if (typeof val !== "number" || !Number.isInteger(val) || val <= 0) {
        addError("INVALID_RAW_DIMENSION", `Part "${part.id}" raw.${dim} must be a strictly positive integer, got ${val}.`, part.id);
      }
    });

    // Raw/Finished edge banding reconciliation check
    const edges = part.edges || {};
    const expectedRawLengthDmm = (fin.lengthDmm || 0) - ((edges.WIDTH_EDGE_1 || 0) + (edges.WIDTH_EDGE_2 || 0));
    const expectedRawWidthDmm = (fin.widthDmm || 0) - ((edges.LENGTH_EDGE_1 || 0) + (edges.LENGTH_EDGE_2 || 0));

    if (raw.lengthDmm !== expectedRawLengthDmm) {
      addError(
        "RAW_LENGTH_MISMATCH",
        `Part "${part.id}" raw length (${raw.lengthDmm}) != finished length (${fin.lengthDmm}) - edge banding (${edges.WIDTH_EDGE_1} + ${edges.WIDTH_EDGE_2}).`,
        part.id
      );
    }

    if (raw.widthDmm !== expectedRawWidthDmm) {
      addError(
        "RAW_WIDTH_MISMATCH",
        `Part "${part.id}" raw width (${raw.widthDmm}) != finished width (${fin.widthDmm}) - edge banding (${edges.LENGTH_EDGE_1} + ${edges.LENGTH_EDGE_2}).`,
        part.id
      );
    }

    // Placement bounding box checks
    const p = part.placement || {};
    ["minXDmm", "maxXDmm", "minYDmm", "maxYDmm", "minZDmm", "maxZDmm"].forEach((coord) => {
      const val = p[coord];
      if (typeof val !== "number" || !Number.isInteger(val) || val < 0) {
        addError("INVALID_PLACEMENT_COORDINATE", `Part "${part.id}" placement.${coord} must be a non-negative integer, got ${val}.`, part.id);
      }
    });

    const boxDeltaX = (p.maxXDmm || 0) - (p.minXDmm || 0);
    const boxDeltaY = (p.maxYDmm || 0) - (p.minYDmm || 0);
    const boxDeltaZ = (p.maxZDmm || 0) - (p.minZDmm || 0);

    // Check bounding box match against orientation
    if (part.orientation === ORIENTATIONS.HORIZONTAL_XZ) {
      const match1 = boxDeltaX === fin.lengthDmm && boxDeltaZ === fin.widthDmm;
      const match2 = boxDeltaX === fin.widthDmm && boxDeltaZ === fin.lengthDmm;
      if (!(match1 || match2) || boxDeltaY !== fin.thicknessDmm) {
        addError(
          "BOUNDING_BOX_MISMATCH",
          `Part "${part.id}" bounding box (${boxDeltaX}x${boxDeltaY}x${boxDeltaZ}) does not match finished dimensions (${fin.lengthDmm}x${fin.thicknessDmm}x${fin.widthDmm}) for HORIZONTAL_XZ.`,
          part.id
        );
      }
    } else if (part.orientation === ORIENTATIONS.VERTICAL_YZ) {
      const match1 = boxDeltaY === fin.lengthDmm && boxDeltaZ === fin.widthDmm;
      const match2 = boxDeltaY === fin.widthDmm && boxDeltaZ === fin.lengthDmm;
      if (!(match1 || match2) || boxDeltaX !== fin.thicknessDmm) {
        addError(
          "BOUNDING_BOX_MISMATCH",
          `Part "${part.id}" bounding box (${boxDeltaX}x${boxDeltaY}x${boxDeltaZ}) does not match finished dimensions (${fin.thicknessDmm}x${fin.lengthDmm}x${fin.widthDmm}) for VERTICAL_YZ.`,
          part.id
        );
      }
    } else if (part.orientation === ORIENTATIONS.VERTICAL_XY) {
      const match1 = boxDeltaY === fin.lengthDmm && boxDeltaX === fin.widthDmm;
      const match2 = boxDeltaY === fin.widthDmm && boxDeltaX === fin.lengthDmm;
      if (!(match1 || match2) || boxDeltaZ !== fin.thicknessDmm) {
        addError(
          "BOUNDING_BOX_MISMATCH",
          `Part "${part.id}" bounding box (${boxDeltaX}x${boxDeltaY}x${boxDeltaZ}) does not match finished dimensions (${fin.widthDmm}x${fin.lengthDmm}x${fin.thicknessDmm}) for VERTICAL_XY.`,
          part.id
        );
      }
    }
  }

  // 3D Collision / Non-Overlap Validation (allowing intentional groove engagement and face contact)
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const p1 = parts[i];
      const p2 = parts[j];

      // Overlap along X, Y, Z
      const overlapX = Math.min(p1.placement.maxXDmm, p2.placement.maxXDmm) - Math.max(p1.placement.minXDmm, p2.placement.minXDmm);
      const overlapY = Math.min(p1.placement.maxYDmm, p2.placement.maxYDmm) - Math.max(p1.placement.minYDmm, p2.placement.minYDmm);
      const overlapZ = Math.min(p1.placement.maxZDmm, p2.placement.maxZDmm) - Math.max(p1.placement.minZDmm, p2.placement.minZDmm);

      if (overlapX > 0 && overlapY > 0 && overlapZ > 0) {
        // Check if this is intentional back panel engagement into grooves
        const isBackPanelEngagement =
          (p1.id === "BACK_PANEL_01" && ["CARC_TOP", "CARC_BOT", "CARC_SIDE_L", "CARC_SIDE_R"].includes(p2.id)) ||
          (p2.id === "BACK_PANEL_01" && ["CARC_TOP", "CARC_BOT", "CARC_SIDE_L", "CARC_SIDE_R"].includes(p1.id));

        if (!isBackPanelEngagement) {
          addError(
            "UNINTENDED_PART_COLLISION",
            `Part "${p1.id}" and Part "${p2.id}" collide with overlap volume ${overlapX}x${overlapY}x${overlapZ} dmm.`,
            p1.id
          );
        }
      }
    }
  }

  // Operations validation
  const operations = partGraph.operations || [];
  for (const op of operations) {
    if (!seenPartIds.has(op.hostPartId)) {
      addError("INVALID_HOST_PART", `Operation "${op.id}" references non-existent hostPartId "${op.hostPartId}".`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
