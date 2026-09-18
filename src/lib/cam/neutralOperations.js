/**
 * M3.1 — Neutral CAM operations IR
 * =====================================================================
 * Consumes a validated PartGraph and emits controller-agnostic machining
 * primitives. Posts (Homag .mpr / Biesse .cix / G-code) consume this IR only.
 *
 * SAFETY:
 * - Every operation is STATUS: DRY_RUN_ONLY until a signed machine profile
 *   is supplied to an authenticated export path.
 * - Raw machine export without a profile key throws UNAUTHENTICATED_MACHINE_PROFILE.
 * - Does NOT lift System 32 CNC qualification or emit machineOutput/toolPath.
 * - Bare CNC_QUALIFIED graphs remain refused (same character as system32Boring).
 */

import { fromDeciMm } from "../furnispec/units.js";
import { validatePartGraph } from "../partgraph/validatePartGraph.js";

export const CAM_IR_VERSION = "neutral-ops/0.1";

export const OPERATION_TYPES = Object.freeze({
  OUTLINE_CONTOUR: "OUTLINE_CONTOUR",
  BORE_SYSTEM_32: "BORE_SYSTEM_32",
  POCKET_GROOVE: "POCKET_GROOVE",
});

/** Face references for bore / groove placement (kernel vocabulary). */
export const CAM_FACES = Object.freeze({
  TOP: "TOP",
  BOTTOM: "BOTTOM",
  EDGE: "EDGE",
});

export const OP_STATUS = Object.freeze({
  DRY_RUN_ONLY: "DRY_RUN_ONLY",
});

export const UNAUTHENTICATED_MACHINE_PROFILE = "UNAUTHENTICATED_MACHINE_PROFILE";

/** Default contour tool / step-down until a machine profile overrides. */
export const DEFAULT_OUTLINE_TOOL_DIAMETER_MM = 6.0;
export const DEFAULT_OUTLINE_STEP_DOWN_MM = 3.0;

/** Back-panel / drawer-bottom groove width (mm). */
export const BACK_GROOVE_WIDTH_MM = 6.0;
export const BACK_GROOVE_DEPTH_MM = 8.0;

/** System 32 semantic defaults (coordinates remain dry-run only). */
export const SYSTEM32_BORE_DIAMETER_MM = 5.0;
export const SYSTEM32_BORE_DEPTH_MM = 13.0;

const SIDE_HOST_ROLES = new Set([
  "SIDE_PANEL_LEFT",
  "SIDE_PANEL_RIGHT",
  "DIVIDER_PANEL",
]);

const GROOVE_HOST_ROLES = new Set([
  "BACK_PANEL",
  "DRAWER_BOTTOM",
  "SIDE_PANEL_LEFT",
  "SIDE_PANEL_RIGHT",
  "DIVIDER_PANEL",
  "TOP_PANEL",
  "BOTTOM_PANEL",
]);

/**
 * @param {unknown} profileKey
 * @returns {boolean}
 */
export function isAuthenticatedMachineProfile(profileKey) {
  if (profileKey == null) return false;
  if (typeof profileKey === "string") return profileKey.trim().length > 0;
  if (typeof profileKey === "object") {
    const id = profileKey.id ?? profileKey.profileId ?? profileKey.key;
    return typeof id === "string" && id.trim().length > 0 && profileKey.signed === true;
  }
  return false;
}

/**
 * Refuse raw machine export without a signed profile key.
 * @param {unknown} profileKey
 */
export function assertAuthenticatedMachineProfile(profileKey) {
  if (isAuthenticatedMachineProfile(profileKey)) return;
  const err = new Error(
    "Raw CAM export refused: no signed machine profile key. Operations remain DRY_RUN_ONLY."
  );
  err.code = UNAUTHENTICATED_MACHINE_PROFILE;
  throw err;
}

/**
 * Closed rectangle polyline in part-local mm (lower-left origin, X along length).
 * First vertex == last vertex.
 * @param {number} lengthMm
 * @param {number} widthMm
 * @returns {Array<[number, number]>}
 */
export function closedOutlinePolylineMm(lengthMm, widthMm) {
  const L = Number(lengthMm);
  const W = Number(widthMm);
  return [
    [0, 0],
    [L, 0],
    [L, W],
    [0, W],
    [0, 0],
  ];
}

function panelFinishedMm(part) {
  const fin = part.finished || {};
  const raw = part.raw || {};
  const lengthMm = fromDeciMm(fin.lengthDmm ?? raw.lengthDmm ?? 0);
  const widthMm = fromDeciMm(fin.widthDmm ?? raw.widthDmm ?? 0);
  const thicknessMm = fromDeciMm(fin.thicknessDmm ?? raw.thicknessDmm ?? 0);
  return { lengthMm, widthMm, thicknessMm };
}

function assertRenderableGraph(partGraph) {
  if (!partGraph || typeof partGraph !== "object" || !Array.isArray(partGraph.parts)) {
    throw new Error("compileNeutralOperations requires a PartGraph object with parts[].");
  }
  if (partGraph.qualificationStatus === "CNC_QUALIFIED") {
    throw new Error(
      "Refusing to compile neutral CAM IR against a bare CNC_QUALIFIED PartGraph (use per-machine profile qualification)."
    );
  }
  const result = validatePartGraph(partGraph);
  if (!result.valid) {
    const reported = (result.errors || []).slice(0, 3);
    throw new Error(
      "compileNeutralOperations refuses an invalid PartGraph: " +
        reported.map((e) => `[${e.code}] ${e.message}`).join(" ")
    );
  }
}

/**
 * Build OUTLINE_CONTOUR ops for rectangular panels.
 * @param {object} part
 * @param {number} index
 */
function emitOutline(part, index) {
  const { lengthMm, widthMm, thicknessMm } = panelFinishedMm(part);
  if (!(lengthMm > 0) || !(widthMm > 0)) return null;
  const path = closedOutlinePolylineMm(lengthMm, widthMm);
  const stepDownMm = DEFAULT_OUTLINE_STEP_DOWN_MM;
  const steps = Math.max(1, Math.ceil(thicknessMm / stepDownMm));
  const stepDownDepthsMm = Array.from({ length: steps }, (_, i) =>
    Math.min(stepDownMm * (i + 1), thicknessMm)
  );
  return {
    id: `OUTLINE_${String(index + 1).padStart(3, "0")}`,
    hostPartId: part.id,
    type: OPERATION_TYPES.OUTLINE_CONTOUR,
    status: OP_STATUS.DRY_RUN_ONLY,
    face: CAM_FACES.TOP,
    toolDiameterMm: DEFAULT_OUTLINE_TOOL_DIAMETER_MM,
    stepDownMm,
    stepDownDepthsMm,
    pathMm: path,
    closed: true,
    panelThicknessMm: thicknessMm,
    machineOutput: null,
    toolPath: null,
    sourceRuleIds: ["CAM-NEUTRAL-OUTLINE"],
  };
}

/**
 * Semantic System 32 bore placeholders — centers stay null until SKU + profile.
 * @param {object} part
 * @param {number} index
 */
function emitSystem32Bore(part, index) {
  if (!SIDE_HOST_ROLES.has(String(part.role || ""))) return null;
  return {
    id: `BORE32_${String(index + 1).padStart(3, "0")}`,
    hostPartId: part.id,
    type: OPERATION_TYPES.BORE_SYSTEM_32,
    status: OP_STATUS.DRY_RUN_ONLY,
    face: CAM_FACES.EDGE,
    centerMm: null,
    depthMm: SYSTEM32_BORE_DEPTH_MM,
    diameterMm: SYSTEM32_BORE_DIAMETER_MM,
    note: "Coordinates withheld: System 32 remains BLOCKED_PENDING_HARDWARE_APPROVAL until pin SKU + signed machine profile.",
    hardwareGate: "BLOCKED_PENDING_HARDWARE_APPROVAL",
    machineOutput: null,
    toolPath: null,
    sourceRuleIds: ["WR-009", "CAM-NEUTRAL-BORE32"],
  };
}

/**
 * 6 mm groove primitive for back-panel / drawer-bottom capture slots.
 * @param {object} part
 * @param {number} index
 */
function emitPocketGroove(part, index) {
  const role = String(part.role || "");
  // Grooves live primarily on carcass sides/top/bottom that receive the back,
  // and on drawer sides that capture bottoms. Emit for known host roles when
  // thickness supports a groove.
  const { lengthMm, widthMm, thicknessMm } = panelFinishedMm(part);
  if (!(thicknessMm >= 15) && role !== "BACK_PANEL" && role !== "DRAWER_BOTTOM") {
    // Side/top hosts typically >=15mm; skip thin panels that are the insert itself
    if (!["SIDE_PANEL_LEFT", "SIDE_PANEL_RIGHT", "DIVIDER_PANEL", "TOP_PANEL", "BOTTOM_PANEL"].includes(role)) {
      return null;
    }
  }
  if (!GROOVE_HOST_ROLES.has(role)) return null;
  if (role === "BACK_PANEL" || role === "DRAWER_BOTTOM") return null; // groove is in the host, not the insert

  const startMm = [0, Math.min(10, widthMm / 2)];
  const endMm = [lengthMm, Math.min(10, widthMm / 2)];
  return {
    id: `GROOVE_${String(index + 1).padStart(3, "0")}`,
    hostPartId: part.id,
    type: OPERATION_TYPES.POCKET_GROOVE,
    status: OP_STATUS.DRY_RUN_ONLY,
    face: CAM_FACES.BOTTOM,
    widthMm: BACK_GROOVE_WIDTH_MM,
    depthMm: Math.min(BACK_GROOVE_DEPTH_MM, Math.max(0, thicknessMm - 5)),
    startMm,
    endMm,
    machineOutput: null,
    toolPath: null,
    sourceRuleIds: ["GF-BACK-GROOVE", "CAM-NEUTRAL-GROOVE"],
  };
}

/**
 * Compile neutral CAM IR from a validated PartGraph.
 *
 * @param {object} partGraph
 * @param {{ machineProfile?: unknown }} [options]
 * @returns {object}
 */
export function compileNeutralOperations(partGraph, options = {}) {
  assertRenderableGraph(partGraph);

  const operations = [];
  let outlineIdx = 0;
  let boreIdx = 0;
  let grooveIdx = 0;

  for (const part of partGraph.parts) {
    if (!part || typeof part !== "object") continue;
    const outline = emitOutline(part, outlineIdx);
    if (outline) {
      operations.push(outline);
      outlineIdx += 1;
    }
    const bore = emitSystem32Bore(part, boreIdx);
    if (bore) {
      operations.push(bore);
      boreIdx += 1;
    }
    const groove = emitPocketGroove(part, grooveIdx);
    if (groove) {
      operations.push(groove);
      grooveIdx += 1;
    }
  }

  const profilePresent = isAuthenticatedMachineProfile(options.machineProfile);
  return {
    irVersion: CAM_IR_VERSION,
    sourceSpecId: partGraph.sourceSpecId ?? null,
    qualificationStatus: partGraph.qualificationStatus ?? "WORKSHOP_REVIEW_NOT_CNC_QUALIFIED",
    machineProfileAuthenticated: profilePresent,
    operations,
    counts: {
      outline: outlineIdx,
      boreSystem32: boreIdx,
      pocketGroove: grooveIdx,
      total: operations.length,
    },
    assumptions: [
      "All operations are DRY_RUN_ONLY until a signed machine profile is registered.",
      "System 32 bore centers remain null pending hardware SKU approval.",
      "Post-processors must call assertAuthenticatedMachineProfile before emitting .mpr/.cix/.nc.",
    ],
  };
}

/**
 * Authenticated export gate: returns IR only when a signed profile is present.
 * Without a profile, throws UNAUTHENTICATED_MACHINE_PROFILE.
 *
 * @param {object} partGraph
 * @param {unknown} machineProfile
 */
export function exportNeutralOperationsForMachine(partGraph, machineProfile) {
  assertAuthenticatedMachineProfile(machineProfile);
  return compileNeutralOperations(partGraph, { machineProfile });
}
