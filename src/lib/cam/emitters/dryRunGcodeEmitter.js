/**
 * M3.2 — Dry-run ISO 6983 G-code emitter (SIMULATION ONLY)
 * =====================================================================
 * Consumes neutral `operations[]` from compileNeutralOperations.
 * Emits commented / dry-run G-code. NEVER claims live spindle authority.
 *
 * Gates:
 * - Output always carries DRY_RUN_SIMULATION_ONLY header.
 * - Machine-file write path requires signed profile via
 *   assertAuthenticatedMachineProfile (UNAUTHENTICATED_MACHINE_PROFILE).
 * - BORE_SYSTEM_32 with null centers / BLOCKED hardwareGate → comment-only
 *   block; no G81/G83 plunge cycles.
 */

import {
  OPERATION_TYPES,
  OP_STATUS,
  assertAuthenticatedMachineProfile,
  compileNeutralOperations,
} from "../neutralOperations.js";

export const DRY_RUN_WARNING =
  "; WARNING: DRY_RUN_SIMULATION_ONLY - NOT QUALIFIED FOR LIVE CNC SPINDLE";

export const GCODE_EMITTER_ID = "dry-run-gcode/0.1";

/** Default feed / rapid placeholders (mm/min) — profile may override later. */
export const DEFAULT_FEED_MM_MIN = 1200;
export const DEFAULT_RAPID_MM_MIN = 5000;
export const DEFAULT_PLUNGE_MM_MIN = 300;

/**
 * @typedef {object} DryRunGcodeOptions
 * @property {string} [programName]
 * @property {number} [feedMmMin]
 * @property {number} [rapidMmMin]
 * @property {string} [toolSku]  Bit SKU for M06 staging comments
 * @property {number} [toolNumber]
 */

/**
 * Safety preamble: metric, absolute, XY plane, cancel cutter comp.
 * @returns {string[]}
 */
export function buildSafetyHeader(programName = "FURNIAI_DRY_RUN") {
  return [
    DRY_RUN_WARNING,
    `; FurniAI ${GCODE_EMITTER_ID}`,
    `; Program: ${programName}`,
    `; Generated: dry-run simulation — spindle must remain OFF`,
    "G21", // metric
    "G90", // absolute
    "G17", // XY plane
    "G40", // cutter compensation cancel
    "G49", // cancel tool length offset
    "G80", // cancel canned cycles
    "M05", // spindle stop (explicit)
  ];
}

/**
 * Format a 2D point as X… Y… (Z omitted unless provided).
 * @param {number} x
 * @param {number} y
 * @param {number} [z]
 */
function xyz(x, y, z) {
  const parts = [`X${Number(x).toFixed(3)}`, `Y${Number(y).toFixed(3)}`];
  if (z != null && Number.isFinite(z)) parts.push(`Z${Number(z).toFixed(3)}`);
  return parts.join(" ");
}

/**
 * Emit outline contour as rapid to entry + linear segments (dry-run).
 * @param {object} op
 * @param {DryRunGcodeOptions} opts
 * @returns {string[]}
 */
function emitOutlineContour(op, opts) {
  const lines = [
    `; --- OUTLINE_CONTOUR ${op.id} host=${op.hostPartId} status=${op.status} ---`,
    `; toolDiameterMm=${op.toolDiameterMm} stepDowns=${(op.stepDownDepthsMm || []).join(",")}`,
  ];
  const path = Array.isArray(op.pathMm) ? op.pathMm : [];
  if (path.length < 2) {
    lines.push("; (empty path — skipped)");
    return lines;
  }
  const feed = opts.feedMmMin ?? DEFAULT_FEED_MM_MIN;
  const [x0, y0] = path[0];
  lines.push(`G00 ${xyz(x0, y0, 5)}`); // rapid above stock
  lines.push(`G01 ${xyz(x0, y0, 0)} F${opts.plungeMmMin ?? DEFAULT_PLUNGE_MM_MIN}`);
  for (let i = 1; i < path.length; i++) {
    const [x, y] = path[i];
    lines.push(`G01 ${xyz(x, y)} F${feed}`);
  }
  lines.push(`G00 ${xyz(x0, y0, 5)}`);
  return lines;
}

/**
 * System 32 / bore ops: comment-only when gated or centers null.
 * @param {object} op
 * @returns {string[]}
 */
function emitBoreSystem32(op) {
  const lines = [
    `; --- BORE_SYSTEM_32 ${op.id} host=${op.hostPartId} status=${op.status} ---`,
    `; diameterMm=${op.diameterMm} depthMm=${op.depthMm} face=${op.face}`,
    `; hardwareGate=${op.hardwareGate || "n/a"}`,
  ];
  const blocked =
    op.hardwareGate === "BLOCKED_PENDING_HARDWARE_APPROVAL" ||
    op.centerMm == null ||
    op.status === OP_STATUS.DRY_RUN_ONLY;

  if (blocked) {
    lines.push("; FAIL-CLOSED: no G81/G83 plunge emitted — coordinates gated / dry-run only");
    lines.push(`; centerMm=${op.centerMm == null ? "null" : JSON.stringify(op.centerMm)}`);
    return lines;
  }

  // Unreachable today while DRY_RUN_ONLY + null centers; kept for future profile path.
  const [cx, cy] = op.centerMm;
  lines.push(`G00 ${xyz(cx, cy, 5)}`);
  lines.push(`G81 ${xyz(cx, cy, -Math.abs(op.depthMm))} R2 F${DEFAULT_PLUNGE_MM_MIN}`);
  lines.push("G80");
  return lines;
}

/**
 * Pocket groove as G01 along start→end at depth (dry-run).
 * @param {object} op
 * @param {DryRunGcodeOptions} opts
 * @returns {string[]}
 */
function emitPocketGroove(op, opts) {
  const lines = [
    `; --- POCKET_GROOVE ${op.id} host=${op.hostPartId} status=${op.status} ---`,
    `; widthMm=${op.widthMm} depthMm=${op.depthMm}`,
  ];
  const start = op.startMm;
  const end = op.endMm;
  if (!Array.isArray(start) || !Array.isArray(end)) {
    lines.push("; (missing start/end — skipped)");
    return lines;
  }
  const feed = opts.feedMmMin ?? DEFAULT_FEED_MM_MIN;
  const z = -Math.abs(Number(op.depthMm) || 0);
  lines.push(`G00 ${xyz(start[0], start[1], 5)}`);
  lines.push(`G01 ${xyz(start[0], start[1], z)} F${opts.plungeMmMin ?? DEFAULT_PLUNGE_MM_MIN}`);
  lines.push(`G01 ${xyz(end[0], end[1], z)} F${feed}`);
  lines.push(`G00 ${xyz(end[0], end[1], 5)}`);
  return lines;
}

/**
 * Tool staging comment + M06 T-command (spindle stays OFF via M05 in header).
 * @param {DryRunGcodeOptions} opts
 * @returns {string[]}
 */
export function buildToolStaging(opts = {}) {
  const t = Number.isFinite(opts.toolNumber) ? opts.toolNumber : 1;
  const sku = opts.toolSku || "UNSPECIFIED_BIT";
  return [
    `; Tool staging: M06 T${t} SKU=${sku} (dry-run — do not load live spindle)`,
    `M06 T${t}`,
    "M05",
  ];
}

/**
 * Core emitter: operations[] → dry-run G-code text.
 *
 * @param {Array<object>} operations
 * @param {DryRunGcodeOptions} [options]
 * @returns {string}
 */
export function emitDryRunGcodeFromOperations(operations, options = {}) {
  const opts = options || {};
  const lines = [
    ...buildSafetyHeader(opts.programName),
    ...buildToolStaging(opts),
    "; --- begin operations ---",
  ];

  for (const op of operations || []) {
    if (!op || typeof op !== "object") continue;
    switch (op.type) {
      case OPERATION_TYPES.OUTLINE_CONTOUR:
        lines.push(...emitOutlineContour(op, opts));
        break;
      case OPERATION_TYPES.BORE_SYSTEM_32:
        lines.push(...emitBoreSystem32(op));
        break;
      case OPERATION_TYPES.POCKET_GROOVE:
        lines.push(...emitPocketGroove(op, opts));
        break;
      default:
        lines.push(`; --- UNKNOWN op type=${op.type} id=${op.id} (skipped) ---`);
    }
  }

  lines.push("; --- end operations ---");
  lines.push("M05");
  lines.push("M30");
  lines.push(DRY_RUN_WARNING);
  return lines.join("\n") + "\n";
}

/**
 * Compile PartGraph → neutral IR → dry-run G-code string.
 * Does not require a machine profile (simulation text only).
 *
 * @param {object} partGraph
 * @param {DryRunGcodeOptions & { outlineToolDiameterMm?: number }} [options]
 * @returns {{ gcode: string, ir: object }}
 */
export function emitDryRunGcode(partGraph, options = {}) {
  const ir = compileNeutralOperations(partGraph, {
    outlineToolDiameterMm: options.outlineToolDiameterMm,
  });
  const gcode = emitDryRunGcodeFromOperations(ir.operations, options);
  return { gcode, ir };
}

/**
 * Authenticated machine-file path. Without a signed profile, throws
 * UNAUTHENTICATED_MACHINE_PROFILE. Even with a profile, content remains
 * DRY_RUN_SIMULATION_ONLY until M3.3/M3.4 qualification.
 *
 * @param {object} partGraph
 * @param {unknown} machineProfile
 * @param {DryRunGcodeOptions} [options]
 * @returns {{ gcode: string, ir: object, filename: string }}
 */
export function exportDryRunGcodeFile(partGraph, machineProfile, options = {}) {
  assertAuthenticatedMachineProfile(machineProfile);
  const { gcode, ir } = emitDryRunGcode(partGraph, options);
  const profileId =
    typeof machineProfile === "string"
      ? machineProfile
      : machineProfile.id || machineProfile.profileId || "profile";
  const filename = `${options.programName || "furniai"}.${profileId}.dryrun.nc`;
  return { gcode, ir, filename };
}
