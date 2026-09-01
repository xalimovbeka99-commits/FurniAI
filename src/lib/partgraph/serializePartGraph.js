/**
 * PartGraph v0.1 — Serializer & Demo Report Formatter
 * ---------------------------------------------------------------------
 * Formats canonical structural PartGraph data into structured tables
 * and human-readable demonstration reports (Gate G2.2).
 */

import { validatePartGraph } from "./validatePartGraph.js";
import { fromDeciMm } from "../furnispec/units.js";

/**
 * Serializes a PartGraph deterministically.
 * @param {object} partGraph
 * @returns {string}
 */
export function serializeCanonicalPartGraph(partGraph) {
  return JSON.stringify(partGraph, null, 2);
}

/**
 * Formats a PartGraph into the authoritative demonstration report.
 * @param {object} partGraph
 * @returns {{ text: string, verdict: "PASS"|"FAIL" }}
 */
export function formatPartGraphReport(partGraph) {
  const valResult = validatePartGraph(partGraph);

  const parts = partGraph.parts || [];
  const operations = partGraph.operations || [];
  const warnings = partGraph.warnings || [];

  const lines = [
    "============================================================",
    "FurniAI Golden Wardrobe — Structural PartGraph v0.1",
    "============================================================",
    `PartGraph Version: ${partGraph.partGraphVersion}`,
    `Source Spec ID: ${partGraph.sourceSpecId} (Revision ${partGraph.sourceRevision})`,
    `Unit Scale: ${partGraph.unitScale} (1 dmm = 0.1 mm)`,
    `Qualification: ${partGraph.qualificationStatus}`,
    "",
    "Structural Panel Schedule:",
    "-------------------------------------------------------------------------------------------------",
    "Part ID           Qty  Finished L×W×T (mm)        Raw L×W×T (mm)             Placement [X, Y, Z] (mm)",
    "-------------------------------------------------------------------------------------------------",
  ];

  parts.forEach((p) => {
    const pId = p.id.padEnd(16, " ");
    const qty = String(p.quantity).padStart(2, " ");
    const finStr = `${fromDeciMm(p.finished.lengthDmm).toFixed(1)} × ${fromDeciMm(p.finished.widthDmm).toFixed(1)} × ${fromDeciMm(p.finished.thicknessDmm).toFixed(1)}`.padEnd(25, " ");
    const rawStr = `${fromDeciMm(p.raw.lengthDmm).toFixed(1)} × ${fromDeciMm(p.raw.widthDmm).toFixed(1)} × ${fromDeciMm(p.raw.thicknessDmm).toFixed(1)}`.padEnd(25, " ");
    const placeStr = `X:[${fromDeciMm(p.placement.minXDmm).toFixed(1)}, ${fromDeciMm(p.placement.maxXDmm).toFixed(1)}] Y:[${fromDeciMm(p.placement.minYDmm).toFixed(1)}, ${fromDeciMm(p.placement.maxYDmm).toFixed(1)}] Z:[${fromDeciMm(p.placement.minZDmm).toFixed(1)}, ${fromDeciMm(p.placement.maxZDmm).toFixed(1)}]`;
    lines.push(`${pId}  ${qty}   ${finStr}  ${rawStr}  ${placeStr}`);
  });

  lines.push(
    "-------------------------------------------------------------------------------------------------",
    "",
    `Structural parts: ${parts.length}`,
    `Unique IDs: ${new Set(parts.map((p) => p.id)).size === parts.length ? "PASS" : "FAIL"}`,
    `Bounding boxes: ${valResult.errors.some((e) => e.code === "BOUNDING_BOX_MISMATCH") ? "FAIL" : "PASS"}`,
    `Raw/finished reconciliation: ${valResult.errors.some((e) => e.code.startsWith("RAW_")) ? "FAIL" : "PASS"}`,
    `Hardware drilling: BLOCKED (Semantic preview only, zero production coordinates)`,
    `CNC qualified: ${partGraph.qualificationStatus === "CNC_QUALIFIED" ? "YES" : "NO"}`,
    `Warnings: ${warnings.length} — ${warnings.map((w) => w.message).join("; ") || "None"}`,
    "============================================================",
    `G2.2 VERDICT: ${valResult.valid && parts.length === 19 ? "PASS" : "FAIL"}`
  );

  return {
    text: lines.join("\n"),
    verdict: valResult.valid && parts.length === 19 ? "PASS" : "FAIL",
  };
}
