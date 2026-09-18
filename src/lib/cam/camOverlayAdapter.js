/**
 * src/lib/cam/camOverlayAdapter.js
 * =====================================================================
 * M3 Runtime Bridge Adapter: Neutral Operations IR -> Viewport 3D Overlays
 *
 * Ingests Grok's neutral operations IR (compileNeutralOperations) and
 * transforms them into 3D world-space toolpath trajectories, kerf ribbons,
 * and clamp safety meshes consumed by CamOverlayLayer.jsx and CamSimulationBar.jsx.
 *
 * CONTRACT MAPPINGS:
 * - OUTLINE_CONTOUR -> camCutFeedTrajectories (solid cyan lines, G01)
 * - Rapid Transits  -> camRapidTrajectories (dashed amber lines, G00)
 * - POCKET_GROOVE   -> camGrooveTrajectories (neon lime lines, G01)
 * - BORE_SYSTEM_32  -> vertical plunge/retract bores (gated / dry-run)
 * - Kerf Ribbons    -> Dynamic flat ribbon mesh using cutterDiameterMm / toolDiameterMm
 */

import { OPERATION_TYPES } from "./neutralOperations.js";
import { fromDeciMm } from "../furnispec/units.js";
import { DMM_TO_THREE } from "../adapters/partGraphToThree.js";

export const MM_TO_THREE = 0.001; // 1 mm = 0.001 Three.js metres
export const DEFAULT_CLEARANCE_Z_MM = 25.0; // 25 mm clearance plane

/**
 * Maps a 2D part-local coordinate [xMm, yMm, zDepthMm] to 3D world space (metres)
 * based on the host part's placement bounding box and dominant axes.
 *
 * @param {object} part - PartGraph part
 * @param {[number, number, number?]} localCoords - [xMm, yMm, zDepthMm] in part-local mm
 * @returns {{ x: number, y: number, z: number }}
 */
export function mapPartLocalToWorld(part, [xMm, yMm, zDepthMm = 0]) {
  if (!part || !part.placement) {
    return { x: xMm * MM_TO_THREE, y: yMm * MM_TO_THREE, z: zDepthMm * MM_TO_THREE };
  }

  const b = part.placement.boundingDmm || part.placement;
  const minX = (b.minXDmm ?? 0) * DMM_TO_THREE;
  const maxX = (b.maxXDmm ?? 0) * DMM_TO_THREE;
  const minY = (b.minYDmm ?? 0) * DMM_TO_THREE;
  const maxY = (b.maxYDmm ?? 0) * DMM_TO_THREE;
  const minZ = (b.minZDmm ?? 0) * DMM_TO_THREE;
  const maxZ = (b.maxZDmm ?? 0) * DMM_TO_THREE;

  const dx = maxX - minX;
  const dy = maxY - minY;
  const dz = maxZ - minZ;

  // Identify thin axis (panel thickness direction)
  let thicknessAxis = "z";
  if (dx <= dy && dx <= dz) thicknessAxis = "x";
  else if (dy <= dx && dy <= dz) thicknessAxis = "y";

  const xM = xMm * MM_TO_THREE;
  const yM = yMm * MM_TO_THREE;
  const zM = zDepthMm * MM_TO_THREE;

  if (thicknessAxis === "x") {
    // Vertical side or divider panel (YZ plane)
    // Part X (length) runs along Y; Part Y (width) runs along Z; thickness along X
    return {
      x: maxX + zM,
      y: minY + xM,
      z: minZ + yM,
    };
  } else if (thicknessAxis === "y") {
    // Horizontal shelf, top, bottom panel (XZ plane)
    // Part X (length) runs along X; Part Y (width) runs along Z; thickness along Y
    return {
      x: minX + xM,
      y: maxY + zM,
      z: minZ + yM,
    };
  } else {
    // Front/back vertical panel (XY plane)
    // Part X (length) runs along X; Part Y (width) runs along Y; thickness along Z
    return {
      x: minX + xM,
      y: minY + yM,
      z: maxZ + zM,
    };
  }
}

/**
 * Transforms a single neutral operation into a sequence of discrete 3D
 * toolpath segments (G00 rapids, G01 cutting feeds, kerf ribbons).
 *
 * @param {object} op - Neutral operation
 * @param {object} part - Host part from PartGraph
 * @param {object} [options]
 * @returns {Array<object>} Array of display operations for 3D overlay
 */
export function transformNeutralOpToTrajectory(op, part, options = {}) {
  const clearanceZMm = options.clearanceZMm ?? DEFAULT_CLEARANCE_Z_MM;
  const trajectories = [];

  if (!op || !part) return trajectories;

  if (op.type === OPERATION_TYPES.OUTLINE_CONTOUR) {
    const pathMm = op.pathMm || [];
    if (pathMm.length < 2) return trajectories;

    const cutterDia = op.toolDiameterMm ?? op.cutterDiameterMm ?? 6.0;
    const depths = Array.isArray(op.stepDownDepthsMm) && op.stepDownDepthsMm.length
      ? op.stepDownDepthsMm
      : [op.panelThicknessMm || 18.0];

    // For visualization performance, render the primary full-depth pass and entry/exit rapids
    const finalDepthMm = depths[depths.length - 1];
    const firstVertex = pathMm[0];

    // 1. Rapid move to clearance above start point
    const pApproachClearance = mapPartLocalToWorld(part, [firstVertex[0], firstVertex[1], clearanceZMm]);
    const pApproachPlunge = mapPartLocalToWorld(part, [firstVertex[0], firstVertex[1], -finalDepthMm]);

    trajectories.push({
      type: "G00",
      category: "RAPID",
      from: mapPartLocalToWorld(part, [firstVertex[0] - cutterDia, firstVertex[1] - cutterDia, clearanceZMm]),
      to: pApproachClearance,
      isCutting: false,
      feedRate: 30000,
      zDepthMm: clearanceZMm,
      cutterDiameterMm: cutterDia,
      kerfMm: cutterDia,
      opId: op.id,
      hostPartId: part.id,
      description: `Rapid approach (${op.id})`,
    });

    // 2. Plunge feed into material
    trajectories.push({
      type: "G01",
      category: "CONTOUR",
      from: pApproachClearance,
      to: pApproachPlunge,
      isCutting: true,
      feedRate: 3000,
      zDepthMm: -finalDepthMm,
      cutterDiameterMm: cutterDia,
      kerfMm: cutterDia,
      opId: op.id,
      hostPartId: part.id,
      description: `Plunge to depth -${finalDepthMm.toFixed(1)}mm (${op.id})`,
    });

    // 3. Perimeter contour legs
    let currWorld = pApproachPlunge;
    for (let i = 0; i < pathMm.length - 1; i++) {
      const nextWorld = mapPartLocalToWorld(part, [pathMm[i + 1][0], pathMm[i + 1][1], -finalDepthMm]);
      trajectories.push({
        type: "G01",
        category: "CONTOUR",
        from: currWorld,
        to: nextWorld,
        isCutting: true,
        feedRate: 12000,
        zDepthMm: -finalDepthMm,
        cutterDiameterMm: cutterDia,
        kerfMm: cutterDia,
        opId: op.id,
        hostPartId: part.id,
        description: `Contour cut leg ${i + 1}/${pathMm.length - 1} (${op.id})`,
      });
      currWorld = nextWorld;
    }

    // 4. Retract rapid back to clearance
    const pRetract = mapPartLocalToWorld(part, [pathMm[pathMm.length - 1][0], pathMm[pathMm.length - 1][1], clearanceZMm]);
    trajectories.push({
      type: "G00",
      category: "RAPID",
      from: currWorld,
      to: pRetract,
      isCutting: false,
      feedRate: 30000,
      zDepthMm: clearanceZMm,
      cutterDiameterMm: cutterDia,
      kerfMm: cutterDia,
      opId: op.id,
      hostPartId: part.id,
      description: `Retract to clearance (${op.id})`,
    });
  } else if (op.type === OPERATION_TYPES.POCKET_GROOVE) {
    const startMm = op.startMm || [0, 10];
    const endMm = op.endMm || [100, 10];
    const widthMm = op.widthMm || 6.0;
    const depthMm = op.depthMm || 8.0;

    const pClearanceStart = mapPartLocalToWorld(part, [startMm[0], startMm[1], clearanceZMm]);
    const pPlungeStart = mapPartLocalToWorld(part, [startMm[0], startMm[1], -depthMm]);
    const pCutEnd = mapPartLocalToWorld(part, [endMm[0], endMm[1], -depthMm]);
    const pClearanceEnd = mapPartLocalToWorld(part, [endMm[0], endMm[1], clearanceZMm]);

    // 1. Rapid to groove entry
    trajectories.push({
      type: "G00",
      category: "RAPID",
      from: pClearanceStart,
      to: pClearanceStart,
      isCutting: false,
      feedRate: 30000,
      zDepthMm: clearanceZMm,
      cutterDiameterMm: widthMm,
      kerfMm: widthMm,
      opId: op.id,
      hostPartId: part.id,
      description: `Rapid to groove start (${op.id})`,
    });

    // 2. Plunge feed
    trajectories.push({
      type: "G01",
      category: "GROOVE",
      from: pClearanceStart,
      to: pPlungeStart,
      isCutting: true,
      feedRate: 4000,
      zDepthMm: -depthMm,
      cutterDiameterMm: widthMm,
      kerfMm: widthMm,
      opId: op.id,
      hostPartId: part.id,
      description: `Plunge groove -${depthMm.toFixed(1)}mm (${op.id})`,
    });

    // 3. Groove cut vector (neon lime)
    trajectories.push({
      type: "G01",
      category: "GROOVE",
      from: pPlungeStart,
      to: pCutEnd,
      isCutting: true,
      feedRate: 9000,
      zDepthMm: -depthMm,
      cutterDiameterMm: widthMm,
      kerfMm: widthMm,
      opId: op.id,
      hostPartId: part.id,
      description: `Slot groove cut (${op.id})`,
    });

    // 4. Retract rapid
    trajectories.push({
      type: "G00",
      category: "RAPID",
      from: pCutEnd,
      to: pClearanceEnd,
      isCutting: false,
      feedRate: 30000,
      zDepthMm: clearanceZMm,
      cutterDiameterMm: widthMm,
      kerfMm: widthMm,
      opId: op.id,
      hostPartId: part.id,
      description: `Retract groove (${op.id})`,
    });
  } else if (op.type === OPERATION_TYPES.BORE_SYSTEM_32) {
    // If coordinates are withheld (dry run), emit semantic indicator at host center
    const dia = op.diameterMm || 5.0;
    const depth = op.depthMm || 13.0;
    const center = op.centerMm || [
      fromDeciMm(part.finished?.lengthDmm || 0) / 2,
      fromDeciMm(part.finished?.widthDmm || 0) / 2,
    ];

    const pClear = mapPartLocalToWorld(part, [center[0], center[1], clearanceZMm]);
    const pBore = mapPartLocalToWorld(part, [center[0], center[1], -depth]);

    trajectories.push({
      type: "G00",
      category: "RAPID",
      from: pClear,
      to: pClear,
      isCutting: false,
      feedRate: 30000,
      zDepthMm: clearanceZMm,
      cutterDiameterMm: dia,
      kerfMm: dia,
      opId: op.id,
      hostPartId: part.id,
      description: `Rapid to System 32 bore (${op.id})`,
    });

    trajectories.push({
      type: "G01",
      category: "BORE",
      from: pClear,
      to: pBore,
      isCutting: true,
      feedRate: 2000,
      zDepthMm: -depth,
      cutterDiameterMm: dia,
      kerfMm: dia,
      opId: op.id,
      hostPartId: part.id,
      description: `Bore Ø${dia}mm x ${depth}mm (${op.id}) [DRY_RUN]`,
    });

    trajectories.push({
      type: "G00",
      category: "RAPID",
      from: pBore,
      to: pClear,
      isCutting: false,
      feedRate: 30000,
      zDepthMm: clearanceZMm,
      cutterDiameterMm: dia,
      kerfMm: dia,
      opId: op.id,
      hostPartId: part.id,
      description: `Retract bore (${op.id})`,
    });
  }

  return trajectories;
}

/**
 * Main adapter bridge: Transforms neutral CAM IR into presentation operations
 * for CamOverlayLayer.jsx.
 *
 * @param {object} neutralIr - Output of compileNeutralOperations(partGraph)
 * @param {object} partGraph - Validated PartGraph
 * @param {object} [options]
 * @returns {Array<object>} Consolidated trajectory list
 */
export function adaptNeutralOperationsToOverlay(neutralIr, partGraph, options = {}) {
  if (!neutralIr || !Array.isArray(neutralIr.operations)) {
    return [];
  }

  const partsMap = new Map((partGraph?.parts || []).map((p) => [p.id, p]));
  const allTrajectories = [];

  for (const op of neutralIr.operations) {
    const part = partsMap.get(op.hostPartId);
    if (!part) continue;

    const opTrajectories = transformNeutralOpToTrajectory(op, part, options);
    allTrajectories.push(...opTrajectories);
  }

  return allTrajectories;
}
