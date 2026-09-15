/**
 * System 32 boring plan — values approved, CNC coordinates still BLOCKED.
 *
 * Consumes Bekzod-approved depth / column origin / rear-row policy from the
 * wardrobe rule catalog. Every emitted operation stays
 * BLOCKED_PENDING_HARDWARE_APPROVAL with null machineOutput / toolPath.
 * Does not unlock CNC qualification.
 */
import { resolve, ruleIdOf } from "../rules/wardrobeRuleCatalog.js";

const BLOCKED = "BLOCKED_PENDING_HARDWARE_APPROVAL";

/**
 * @param {object} partGraph
 * @param {{ enumerateHoles?: boolean }} [options]
 */
export function compileSystem32Boring(partGraph, options = {}) {
  if (!partGraph || typeof partGraph !== "object") {
    throw new Error("compileSystem32Boring requires a PartGraph object.");
  }
  if (partGraph.qualificationStatus === "CNC_QUALIFIED") {
    throw new Error("Refusing to compile boring against a CNC_QUALIFIED PartGraph.");
  }

  const holeDepthMm = resolve("shelfPinHoleDepthMm");
  const depthByBoard = resolve("shelfPinHoleDepthMmByBoardThickness");
  const columnOriginDatum = resolve("shelfPinColumnOriginDatum");
  const columnOriginUpperDatum = resolve("shelfPinColumnOriginUpperDatum");
  const rearRowPolicy = resolve("shelfPinRearRowPolicy");
  const pitchMm = resolve("shelfPinPitchMm");

  const hosts = (partGraph.parts || []).filter((p) =>
    ["SIDE_PANEL_LEFT", "SIDE_PANEL_RIGHT", "DIVIDER_PANEL"].includes(p.role),
  );

  const operations = hosts.map((host, idx) => ({
    id: `SYS32_BORE_${String(idx + 1).padStart(2, "0")}`,
    hostPartId: host.id,
    type: "SHELF_PIN",
    status: BLOCKED,
    diameterMm: 5,
    depthMm: holeDepthMm,
    pitchMm,
    columnOriginDatum,
    columnOriginUpperDatum,
    rearRowPolicy,
    depthByBoardMm: depthByBoard,
    sourceRuleIds: [
      ruleIdOf("shelfPinHoleDepthMm"),
      ruleIdOf("shelfPinColumnOriginDatum"),
      ruleIdOf("shelfPinRearRowPolicy"),
      ruleIdOf("shelfPinPitchMm"),
    ],
    machineOutput: null,
    toolPath: null,
    note: options.enumerateHoles
      ? "Hole enumeration is review-only; coordinates remain blocked pending pin SKU sign-off."
      : "Semantic System 32 plan only; no coordinates emitted.",
  }));

  return {
    planVersion: "system32-boring/0.1",
    sourceSpecId: partGraph.sourceSpecId ?? null,
    qualificationStatus: partGraph.qualificationStatus,
    approvedOperations: 0,
    blockedOperations: operations.length,
    operations,
    assumptions: [
      "Pin SKU sign-off is still outstanding (WR-009).",
      "machineOutput and toolPath are null on every operation.",
    ],
    machineOutput: null,
    toolPath: null,
  };
}
