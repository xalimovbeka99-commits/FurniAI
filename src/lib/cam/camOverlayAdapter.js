/**
 * src/lib/cam/camOverlayAdapter.js
 * =====================================================================
 * M3 Runtime Bridge Adapter: Neutral Operations IR -> Viewport 3D Overlays
 *
 * Ingests Grok's neutral operations IR (compileNeutralOperations) and
 * transforms them into 3D world-space toolpath trajectories, kerf ribbons,
 * clamp safety meshes, and simulation steps for CamOverlayLayer and CamSimulationBar.
 *
 * CONTRACT MAPPINGS:
 * - OUTLINE_CONTOUR -> camCutFeedTrajectories (solid cyan lines with kerf ribbon metadata)
 * - Rapid Transits  -> camRapidTrajectories (amber dashed lines at Z_safe = +25 mm)
 * - POCKET_GROOVE   -> camGrooveTrajectories (neon lime groove line paths)
 * - BORE_SYSTEM_32  -> drill target positions with status set to GATED/BLOCKED
 * - Kerf Ribbons    -> Dynamic flat ribbon mesh using cutterDiameterMm / toolDiameterMm
 */

import { OPERATION_TYPES } from "./neutralOperations.js";
import { fromDeciMm } from "../furnispec/units.js";
import { DMM_TO_THREE } from "../adapters/partGraphToThree.js";

export const MM_TO_THREE = 0.001; // 1 mm = 0.001 Three.js metres
export const DEFAULT_CLEARANCE_Z_MM = 25.0; // 25 mm clearance plane
export const DEFAULT_CUTTER_DIAMETER_MM = 6.0; // Standard 6.0 mm compression endmill
export const DEFAULT_GROOVE_WIDTH_MM = 6.0;   // 6.0 mm back panel groove
export const DEFAULT_FEED_MM_MIN = 12000;      // 12 m/min cutting feed
export const DEFAULT_RAPID_MM_MIN = 30000;     // 30 m/min rapid transit
export const DEFAULT_PLUNGE_MM_MIN = 3000;     // 3 m/min plunge

/** Tool SKU catalog mapping by operation type */
export const CAM_TOOL_SKUS = Object.freeze({
  OUTLINE_CONTOUR: "SKU_TOOL_COMPRESSION_6MM",
  POCKET_GROOVE: "SKU_TOOL_MORTISE_GROOVE_6MM",
  BORE_SYSTEM_32: "SKU_TOOL_BORING_PIN_5MM",
  DEFAULT: "SKU_TOOL_GENERIC_ROUTER",
});

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
    return {
      x: maxX + zM,
      y: minY + xM,
      z: minZ + yM,
    };
  } else if (thicknessAxis === "y") {
    // Horizontal shelf, top, bottom panel (XZ plane)
    return {
      x: minX + xM,
      y: maxY + zM,
      z: minZ + yM,
    };
  } else {
    // Front/back vertical panel (XY plane)
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

    const cutterDia = op.toolDiameterMm ?? op.cutterDiameterMm ?? DEFAULT_CUTTER_DIAMETER_MM;
    const toolSku = op.toolSku || CAM_TOOL_SKUS.OUTLINE_CONTOUR;
    const depths = Array.isArray(op.stepDownDepthsMm) && op.stepDownDepthsMm.length
      ? op.stepDownDepthsMm
      : [op.panelThicknessMm || 18.0];

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
      feedRate: options.rapidMmMin ?? DEFAULT_RAPID_MM_MIN,
      zDepthMm: clearanceZMm,
      cutterDiameterMm: cutterDia,
      kerfMm: cutterDia,
      toolSku,
      status: op.status,
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
      feedRate: options.plungeMmMin ?? DEFAULT_PLUNGE_MM_MIN,
      zDepthMm: -finalDepthMm,
      cutterDiameterMm: cutterDia,
      kerfMm: cutterDia,
      toolSku,
      status: op.status,
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
        feedRate: options.feedMmMin ?? DEFAULT_FEED_MM_MIN,
        zDepthMm: -finalDepthMm,
        cutterDiameterMm: cutterDia,
        kerfMm: cutterDia,
        toolSku,
        status: op.status,
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
      feedRate: options.rapidMmMin ?? DEFAULT_RAPID_MM_MIN,
      zDepthMm: clearanceZMm,
      cutterDiameterMm: cutterDia,
      kerfMm: cutterDia,
      toolSku,
      status: op.status,
      opId: op.id,
      hostPartId: part.id,
      description: `Retract to clearance (${op.id})`,
    });
  } else if (op.type === OPERATION_TYPES.POCKET_GROOVE) {
    const startMm = op.startMm || [0, 10];
    const endMm = op.endMm || [100, 10];
    const widthMm = op.widthMm || DEFAULT_GROOVE_WIDTH_MM;
    const depthMm = op.depthMm || 8.0;
    const toolSku = op.toolSku || CAM_TOOL_SKUS.POCKET_GROOVE;

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
      feedRate: options.rapidMmMin ?? DEFAULT_RAPID_MM_MIN,
      zDepthMm: clearanceZMm,
      cutterDiameterMm: widthMm,
      kerfMm: widthMm,
      toolSku,
      status: op.status,
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
      feedRate: options.plungeMmMin ?? DEFAULT_PLUNGE_MM_MIN,
      zDepthMm: -depthMm,
      cutterDiameterMm: widthMm,
      kerfMm: widthMm,
      toolSku,
      status: op.status,
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
      toolSku,
      status: op.status,
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
      feedRate: options.rapidMmMin ?? DEFAULT_RAPID_MM_MIN,
      zDepthMm: clearanceZMm,
      cutterDiameterMm: widthMm,
      kerfMm: widthMm,
      toolSku,
      status: op.status,
      opId: op.id,
      hostPartId: part.id,
      description: `Retract groove (${op.id})`,
    });
  } else if (op.type === OPERATION_TYPES.BORE_SYSTEM_32) {
    const dia = op.diameterMm || 5.0;
    const depth = op.depthMm || 13.0;
    const toolSku = op.toolSku || CAM_TOOL_SKUS.BORE_SYSTEM_32;
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
      feedRate: options.rapidMmMin ?? DEFAULT_RAPID_MM_MIN,
      zDepthMm: clearanceZMm,
      cutterDiameterMm: dia,
      kerfMm: dia,
      toolSku,
      status: "GATED/BLOCKED",
      opId: op.id,
      hostPartId: part.id,
      description: `Rapid to System 32 bore (${op.id}) [GATED/BLOCKED]`,
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
      toolSku,
      status: "GATED/BLOCKED",
      opId: op.id,
      hostPartId: part.id,
      description: `Bore Ø${dia}mm x ${depth}mm (${op.id}) [GATED/BLOCKED]`,
    });

    trajectories.push({
      type: "G00",
      category: "RAPID",
      from: pBore,
      to: pClear,
      isCutting: false,
      feedRate: options.rapidMmMin ?? DEFAULT_RAPID_MM_MIN,
      zDepthMm: clearanceZMm,
      cutterDiameterMm: dia,
      kerfMm: dia,
      toolSku,
      status: "GATED/BLOCKED",
      opId: op.id,
      hostPartId: part.id,
      description: `Retract bore (${op.id})`,
    });
  }

  return trajectories;
}

/**
 * Pure adapter function ingesting Grok's neutral operations[] and emitting
 * the exact categorized props and simulation sequences consumed by
 * CamOverlayLayer.jsx and CamSimulationBar.jsx.
 *
 * @param {Array<object>|object} operationsOrIr - operations[] array or compiled neutral IR
 * @param {object} [options]
 * @param {object} [options.partGraph] - Optional host PartGraph for 3D placement mapping
 * @param {number} [options.clearanceZMm] - Rapid clearance Z height (default: 25.0 mm)
 * @returns {{
 *   operations: Array<object>,
 *   camCutFeedTrajectories: Array<object>,
 *   camRapidTrajectories: Array<object>,
 *   camGrooveTrajectories: Array<object>,
 *   drillMarkers: Array<object>,
 *   kerfRibbons: Array<object>,
 *   stepSequences: Array<object>,
 *   totalOps: number,
 *   toolSkus: string[]
 * }}
 */
export function mapNeutralOperationsToOverlayProps(operationsOrIr, options = {}) {
  const operations = Array.isArray(operationsOrIr)
    ? operationsOrIr
    : (operationsOrIr?.operations || []);

  const partGraph = options.partGraph || null;
  const partsMap = new Map((partGraph?.parts || []).map((p) => [p.id, p]));
  const clearanceZMm = options.clearanceZMm ?? DEFAULT_CLEARANCE_Z_MM;

  const camCutFeedTrajectories = [];
  const camRapidTrajectories = [];
  const camGrooveTrajectories = [];
  const drillMarkers = [];
  const kerfRibbons = [];
  const stepSequences = [];
  const toolSkusSet = new Set();

  let prevRetractPosition = null;

  for (let opIdx = 0; opIdx < operations.length; opIdx++) {
    const op = operations[opIdx];
    const part = partsMap.get(op.hostPartId) || {
      id: op.hostPartId || `PART_${opIdx + 1}`,
      placement: {
        minXDmm: 0,
        maxXDmm: 10000,
        minYDmm: 0,
        maxYDmm: 10000,
        minZDmm: 0,
        maxZDmm: 180,
      },
      finished: { lengthDmm: 10000, widthDmm: 10000, thicknessDmm: 180 },
    };

    // 1. If this is BORE_SYSTEM_32, extract drill target marker with GATED/BLOCKED status
    if (op.type === OPERATION_TYPES.BORE_SYSTEM_32) {
      const center = op.centerMm || [
        fromDeciMm(part?.finished?.lengthDmm || 0) / 2,
        fromDeciMm(part?.finished?.widthDmm || 0) / 2,
      ];
      const dia = op.diameterMm || 5.0;
      const depth = op.depthMm || 13.0;
      const worldPos = mapPartLocalToWorld(part, [center[0], center[1], 0]);

      drillMarkers.push({
        id: op.id,
        hostPartId: op.hostPartId,
        status: "GATED/BLOCKED", // Explicitly GATED/BLOCKED per spec
        hardwareGate: op.hardwareGate || "BLOCKED_PENDING_HARDWARE_APPROVAL",
        diameterMm: dia,
        depthMm: depth,
        face: op.face || "EDGE",
        toolSku: CAM_TOOL_SKUS.BORE_SYSTEM_32,
        centerMm: center,
        worldPosition: worldPos,
      });
      toolSkusSet.add(CAM_TOOL_SKUS.BORE_SYSTEM_32);
    }

    // 2. Generate raw trajectories for the operation
    const opTrajectories = transformNeutralOpToTrajectory(op, part, options);
    if (opTrajectories.length === 0) continue;

    const opFirst = opTrajectories[0];
    const opLast = opTrajectories[opTrajectories.length - 1];

    // 3. Calculate rapid transit step between operations at Z_safe = +25 mm
    if (prevRetractPosition && opFirst.from) {
      const transitRapid = {
        type: "G00",
        category: "RAPID",
        from: prevRetractPosition,
        to: opFirst.from,
        isCutting: false,
        feedRate: options.rapidMmMin ?? DEFAULT_RAPID_MM_MIN,
        zDepthMm: clearanceZMm,
        cutterDiameterMm: op.toolDiameterMm || op.widthMm || DEFAULT_CUTTER_DIAMETER_MM,
        kerfMm: op.toolDiameterMm || op.widthMm || DEFAULT_CUTTER_DIAMETER_MM,
        toolSku: "RAPID_TRANSIT",
        status: "DRY_RUN_ONLY",
        opId: `TRANSIT_${opIdx}`,
        hostPartId: op.hostPartId,
        description: `Rapid transit to ${op.id} at Z_safe=+${clearanceZMm}mm`,
      };
      camRapidTrajectories.push(transitRapid);
      stepSequences.push(transitRapid);
    }

    // 4. Distribute trajectories into categorized channels
    for (const traj of opTrajectories) {
      stepSequences.push(traj);
      if (traj.toolSku) toolSkusSet.add(traj.toolSku);

      if (traj.category === "RAPID" || traj.type === "G00") {
        camRapidTrajectories.push(traj);
      } else if (traj.category === "GROOVE") {
        camGrooveTrajectories.push(traj);
        kerfRibbons.push({
          from: traj.from,
          to: traj.to,
          widthMm: traj.cutterDiameterMm || DEFAULT_GROOVE_WIDTH_MM,
          opId: traj.opId,
        });
      } else if (traj.category === "CONTOUR") {
        camCutFeedTrajectories.push(traj);
        kerfRibbons.push({
          from: traj.from,
          to: traj.to,
          widthMm: traj.cutterDiameterMm || DEFAULT_CUTTER_DIAMETER_MM,
          opId: traj.opId,
        });
      }
    }

    prevRetractPosition = opLast.to;
  }

  return {
    operations,
    camCutFeedTrajectories,
    camRapidTrajectories,
    camGrooveTrajectories,
    drillMarkers,
    kerfRibbons,
    stepSequences,
    totalOps: operations.length,
    toolSkus: Array.from(toolSkusSet),
  };
}

/**
 * Legacy compatibility alias for existing callers.
 */
export const adaptNeutralOperationsToOverlay = (neutralIr, partGraph, options = {}) => {
  const props = mapNeutralOperationsToOverlayProps(neutralIr, { ...options, partGraph });
  return props.stepSequences;
};
