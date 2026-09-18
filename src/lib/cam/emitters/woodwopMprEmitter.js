/**
 * M3.3-prep — Homag WoodWOP (.mpr) dry-run emitter STUB
 * =====================================================================
 * SPECIFICATION STUB ONLY. Exact WoodWOP block syntax must be proven by
 * round-trip against a machine-exported .mpr reference (see
 * docs/m3/CAM_POST_PROCESSOR_SPEC.md §5). This module emits a structured
 * ASCII dry-run placeholder that posts can later replace with verified dialect.
 *
 * Invariants:
 * - Starts with [HEADER] and $P parameter declarations
 * - Contains <100 \DryRunOnly=1>
 * - File export requires signed machine profile (UNAUTHENTICATED_MACHINE_PROFILE)
 * - System 32 bores are comment-only stubs — no live spindle / boring macros
 */

import {
  OPERATION_TYPES,
  OP_STATUS,
  assertAuthenticatedMachineProfile,
  compileNeutralOperations,
} from "../neutralOperations.js";

export const WOODWOP_EMITTER_ID = "dry-run-woodwop-mpr/0.1-stub";
export const WOODWOP_DRY_RUN_MARKER = "<100 \\DryRunOnly=1>";

/**
 * @param {string} [programName]
 * @returns {string[]}
 */
export function buildWoodwopDryRunHeader(programName = "FURNIAI_DRY_RUN") {
  return [
    "[HEADER]",
    `$P Name="${programName}"`,
    `$P Emitter="${WOODWOP_EMITTER_ID}"`,
    `$P Unit="mm"`,
    `$P Mode="DRY_RUN_SIMULATION_ONLY"`,
    `$P Spindle="OFF"`,
    WOODWOP_DRY_RUN_MARKER,
    "; WARNING: STUB OUTPUT — NOT A VERIFIED WOODWOP DIALECT FILE",
    "; Round-trip against a Homag-exported .mpr before any live use.",
    "[HEADER]",
  ];
}

/**
 * @param {object} op
 * @returns {string[]}
 */
function stubOutline(op) {
  const path = Array.isArray(op.pathMm) ? op.pathMm : [];
  return [
    `[OP OUTLINE_CONTOUR id=${op.id} host=${op.hostPartId}]`,
    `$P Status="${op.status || OP_STATUS.DRY_RUN_ONLY}"`,
    `$P ToolDiameterMm=${op.toolDiameterMm ?? 0}`,
    `$P Closed=${op.closed ? 1 : 0}`,
    `$P VertexCount=${path.length}`,
    "; Contour geometry deferred — await verified WoodWOP contour macro mapping",
  ];
}

/**
 * System 32: commented dry-run only — never emit live boring instructions.
 * @param {object} op
 * @returns {string[]}
 */
function stubBoreSystem32(op) {
  return [
    `[OP BORE_SYSTEM_32 id=${op.id} host=${op.hostPartId}]`,
    `$P Status="${op.status || OP_STATUS.DRY_RUN_ONLY}"`,
    `$P HardwareGate="${op.hardwareGate || "BLOCKED_PENDING_HARDWARE_APPROVAL"}"`,
    `$P DiameterMm=${op.diameterMm ?? 0}`,
    `$P DepthMm=${op.depthMm ?? 0}`,
    `$P CenterMm=null`,
    "; FAIL-CLOSED STUB: no WoodWOP boring / vertical drill macro emitted",
    "; Coordinates remain gated pending pin SKU + signed machine profile",
  ];
}

/**
 * @param {object} op
 * @returns {string[]}
 */
function stubGroove(op) {
  return [
    `[OP POCKET_GROOVE id=${op.id} host=${op.hostPartId}]`,
    `$P Status="${op.status || OP_STATUS.DRY_RUN_ONLY}"`,
    `$P WidthMm=${op.widthMm ?? 0}`,
    `$P DepthMm=${op.depthMm ?? 0}`,
    "; Groove geometry deferred — await verified WoodWOP pocket macro mapping",
  ];
}

/**
 * operations[] → dry-run WoodWOP-shaped ASCII stub.
 * @param {Array<object>} operations
 * @param {{ programName?: string }} [options]
 * @returns {string}
 */
export function emitDryRunWoodwopMprFromOperations(operations, options = {}) {
  const lines = [...buildWoodwopDryRunHeader(options.programName)];
  lines.push("[BODY]");
  for (const op of operations || []) {
    if (!op || typeof op !== "object") continue;
    if (op.type === OPERATION_TYPES.OUTLINE_CONTOUR) lines.push(...stubOutline(op));
    else if (op.type === OPERATION_TYPES.BORE_SYSTEM_32) lines.push(...stubBoreSystem32(op));
    else if (op.type === OPERATION_TYPES.POCKET_GROOVE) lines.push(...stubGroove(op));
    else lines.push(`; skipped unknown type=${op.type} id=${op.id}`);
  }
  lines.push("[END]");
  lines.push(WOODWOP_DRY_RUN_MARKER);
  return lines.join("\n") + "\n";
}

/**
 * PartGraph → neutral IR → dry-run .mpr stub string.
 * Simulation text only — no profile required.
 *
 * @param {object} partGraph
 * @param {{ programName?: string, outlineToolDiameterMm?: number, machineProfile?: unknown }} [options]
 * @returns {{ mpr: string, ir: object }}
 */
export function emitDryRunWoodwopMpr(partGraph, options = {}) {
  if (options.requireAuthenticatedProfile) {
    assertAuthenticatedMachineProfile(options.machineProfile);
  }
  const ir = compileNeutralOperations(partGraph, {
    outlineToolDiameterMm: options.outlineToolDiameterMm,
    machineProfile: options.machineProfile,
  });
  const mpr = emitDryRunWoodwopMprFromOperations(ir.operations, options);
  return { mpr, ir };
}

/**
 * Authenticated file path — throws UNAUTHENTICATED_MACHINE_PROFILE without signed profile.
 *
 * @param {object} partGraph
 * @param {unknown} machineProfile
 * @param {{ programName?: string }} [options]
 */
export function exportDryRunWoodwopMprFile(partGraph, machineProfile, options = {}) {
  assertAuthenticatedMachineProfile(machineProfile);
  const { mpr, ir } = emitDryRunWoodwopMpr(partGraph, { ...options, machineProfile });
  const profileId =
    typeof machineProfile === "string"
      ? machineProfile
      : machineProfile.id || machineProfile.profileId || "profile";
  const filename = `${options.programName || "furniai"}.${profileId}.dryrun.mpr`;
  return { mpr, ir, filename };
}
