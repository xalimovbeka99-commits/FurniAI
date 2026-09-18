/**
 * M3.3-prep — Biesse bSolid / BiesseWorks (.cix) dry-run emitter STUB
 * =====================================================================
 * SPECIFICATION STUB ONLY. Exact CIX macro syntax must be proven by
 * round-trip against a machine-exported .cix reference (see
 * docs/m3/CAM_POST_PROCESSOR_SPEC.md §5). This module emits a Biesse-shaped
 * MACRO envelope with DRY_RUN="1" metadata — not a live spindle program.
 *
 * Invariants:
 * - BEGIN ID="MACRO" / END ID="MACRO" envelope
 * - DRY_RUN="1" metadata tag present
 * - File export requires signed machine profile
 * - No executable spindle-on / live boring without hardware approval
 */

import {
  OPERATION_TYPES,
  OP_STATUS,
  assertAuthenticatedMachineProfile,
  compileNeutralOperations,
} from "../neutralOperations.js";

export const BIESSE_EMITTER_ID = "dry-run-biesse-cix/0.1-stub";
export const BIESSE_DRY_RUN_ATTR = 'DRY_RUN="1"';

/**
 * @param {string} [programName]
 * @returns {string[]}
 */
export function buildBiesseDryRunHeader(programName = "FURNIAI_DRY_RUN") {
  return [
    `BEGIN ID="MACRO" NAME="${programName}" ${BIESSE_DRY_RUN_ATTR} EMITTER="${BIESSE_EMITTER_ID}"`,
    `  PARAM NAME="Mode" VALUE="DRY_RUN_SIMULATION_ONLY"`,
    `  PARAM NAME="Spindle" VALUE="OFF"`,
    `  PARAM NAME="Unit" VALUE="mm"`,
    `  ; WARNING: STUB OUTPUT — NOT A VERIFIED BIESSE CIX DIALECT FILE`,
    `  ; Round-trip against a Biesse-exported .cix before any live use.`,
  ];
}

function stubOutline(op) {
  const path = Array.isArray(op.pathMm) ? op.pathMm : [];
  return [
    `  BEGIN ID="OP" TYPE="OUTLINE_CONTOUR" UID="${op.id}" HOST="${op.hostPartId}" ${BIESSE_DRY_RUN_ATTR}`,
    `    PARAM NAME="Status" VALUE="${op.status || OP_STATUS.DRY_RUN_ONLY}"`,
    `    PARAM NAME="ToolDiameterMm" VALUE="${op.toolDiameterMm ?? 0}"`,
    `    PARAM NAME="VertexCount" VALUE="${path.length}"`,
    `    ; Contour geometry deferred — await verified CIX contour macro mapping`,
    `  END ID="OP"`,
  ];
}

function stubBoreSystem32(op) {
  return [
    `  BEGIN ID="OP" TYPE="BORE_SYSTEM_32" UID="${op.id}" HOST="${op.hostPartId}" ${BIESSE_DRY_RUN_ATTR}`,
    `    PARAM NAME="Status" VALUE="${op.status || OP_STATUS.DRY_RUN_ONLY}"`,
    `    PARAM NAME="HardwareGate" VALUE="${op.hardwareGate || "BLOCKED_PENDING_HARDWARE_APPROVAL"}"`,
    `    PARAM NAME="DiameterMm" VALUE="${op.diameterMm ?? 0}"`,
    `    PARAM NAME="DepthMm" VALUE="${op.depthMm ?? 0}"`,
    `    PARAM NAME="CenterMm" VALUE="null"`,
    `    ; FAIL-CLOSED STUB: no Biesse boring / BV / spindle-on macro emitted`,
    `  END ID="OP"`,
  ];
}

function stubGroove(op) {
  return [
    `  BEGIN ID="OP" TYPE="POCKET_GROOVE" UID="${op.id}" HOST="${op.hostPartId}" ${BIESSE_DRY_RUN_ATTR}`,
    `    PARAM NAME="Status" VALUE="${op.status || OP_STATUS.DRY_RUN_ONLY}"`,
    `    PARAM NAME="WidthMm" VALUE="${op.widthMm ?? 0}"`,
    `    PARAM NAME="DepthMm" VALUE="${op.depthMm ?? 0}"`,
    `    ; Groove geometry deferred — await verified CIX pocket macro mapping`,
    `  END ID="OP"`,
  ];
}

/**
 * @param {Array<object>} operations
 * @param {{ programName?: string }} [options]
 * @returns {string}
 */
export function emitDryRunBiesseCixFromOperations(operations, options = {}) {
  const lines = [...buildBiesseDryRunHeader(options.programName)];
  for (const op of operations || []) {
    if (!op || typeof op !== "object") continue;
    if (op.type === OPERATION_TYPES.OUTLINE_CONTOUR) lines.push(...stubOutline(op));
    else if (op.type === OPERATION_TYPES.BORE_SYSTEM_32) lines.push(...stubBoreSystem32(op));
    else if (op.type === OPERATION_TYPES.POCKET_GROOVE) lines.push(...stubGroove(op));
    else lines.push(`  ; skipped unknown type=${op.type} id=${op.id}`);
  }
  lines.push(`END ID="MACRO"`);
  return lines.join("\n") + "\n";
}

/**
 * @param {object} partGraph
 * @param {{ programName?: string, outlineToolDiameterMm?: number, machineProfile?: unknown, requireAuthenticatedProfile?: boolean }} [options]
 * @returns {{ cix: string, ir: object }}
 */
export function emitDryRunBiesseCix(partGraph, options = {}) {
  if (options.requireAuthenticatedProfile) {
    assertAuthenticatedMachineProfile(options.machineProfile);
  }
  const ir = compileNeutralOperations(partGraph, {
    outlineToolDiameterMm: options.outlineToolDiameterMm,
    machineProfile: options.machineProfile,
  });
  const cix = emitDryRunBiesseCixFromOperations(ir.operations, options);
  return { cix, ir };
}

/**
 * @param {object} partGraph
 * @param {unknown} machineProfile
 * @param {{ programName?: string }} [options]
 */
export function exportDryRunBiesseCixFile(partGraph, machineProfile, options = {}) {
  assertAuthenticatedMachineProfile(machineProfile);
  const { cix, ir } = emitDryRunBiesseCix(partGraph, { ...options, machineProfile });
  const profileId =
    typeof machineProfile === "string"
      ? machineProfile
      : machineProfile.id || machineProfile.profileId || "profile";
  const filename = `${options.programName || "furniai"}.${profileId}.dryrun.cix`;
  return { cix, ir, filename };
}
