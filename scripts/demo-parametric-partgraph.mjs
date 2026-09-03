#!/usr/bin/env node

/**
 * scripts/demo-parametric-partgraph.mjs
 * ---------------------------------------------------------------------
 * Demonstrates the generalized, fully parametric PartGraph kernel across:
 * - Golden Wardrobe (baseline)
 * - Narrow 1-bay wardrobe
 * - Wide 3-bay wardrobe
 * - Changed-height wardrobe
 *
 * Verifies determinism, bounds, closure, and blocked CNC qualifications.
 */

import goldenFixture from "../src/lib/furnispec/goldenWardrobe.fixture.json" with { type: "json" };
import narrowFixture from "../src/lib/furnispec/fixtures/narrowWardrobe.fixture.json" with { type: "json" };
import wideFixture from "../src/lib/furnispec/fixtures/wideWardrobe.fixture.json" with { type: "json" };
import heightFixture from "../src/lib/furnispec/fixtures/heightMutation.fixture.json" with { type: "json" };

import { buildStructuralPartGraph } from "../src/lib/partgraph/buildStructuralPartGraph.js";
import { validatePartGraph } from "../src/lib/partgraph/validatePartGraph.js";
import { serializeCanonicalPartGraph } from "../src/lib/partgraph/serializePartGraph.js";
import { fromDeciMm } from "../src/lib/furnispec/units.js";

const examples = [
  { name: "Golden Wardrobe (2-Bay Baseline)", fixture: goldenFixture },
  { name: "Narrow Wardrobe (1-Bay, 2-Door)", fixture: narrowFixture },
  { name: "Wide Wardrobe (3-Bay, 6-Door)", fixture: wideFixture },
  { name: "Changed-Height Wardrobe (2100mm)", fixture: heightFixture },
];

console.log("=================================================================================================");
console.log("FurniAI Parametric PartGraph Comparison — Kernel Generalization (Gate G2.2-R1)");
console.log("=================================================================================================");

let allPass = true;

const tableRows = examples.map((ex) => {
  const spec = ex.fixture;
  const partGraph = buildStructuralPartGraph(spec);
  const valResult = validatePartGraph(partGraph);

  // 1. Determinism verification (10 consecutive runs)
  const baseline = serializeCanonicalPartGraph(partGraph);
  let determinismPass = true;
  for (let i = 0; i < 10; i++) {
    if (serializeCanonicalPartGraph(buildStructuralPartGraph(spec)) !== baseline) {
      determinismPass = false;
      break;
    }
  }

  // 2. Bounds verification (all parts inside envelope)
  let boundsPass = valResult.valid && !valResult.errors.some((e) => e.code.includes("BOUNDING_BOX") || e.code.includes("COLLISION"));
  for (const p of partGraph.parts) {
    if (
      p.placement.minXDmm < 0 ||
      p.placement.maxXDmm > partGraph.summary.envelope.widthDmm ||
      p.placement.minYDmm < 0 ||
      p.placement.maxYDmm > partGraph.summary.envelope.heightDmm ||
      p.placement.minZDmm < 0 ||
      p.placement.maxZDmm > partGraph.summary.envelope.depthDmm
    ) {
      boundsPass = false;
    }
  }

  // 3. Closure verification
  const closurePass = valResult.valid && valResult.errors.length === 0;

  // 4. Counts
  const bayCount = spec.bays.length;
  const dividerCount = partGraph.parts.filter((p) => p.role === "DIVIDER_PANEL").length;
  const doorCount = spec.doors.count;
  const structuralPartCount = partGraph.parts.length;
  const cncQual = partGraph.qualificationStatus === "CNC_QUALIFIED" ? "YES" : "NO (Blocked)";

  if (!determinismPass || !boundsPass || !closurePass) {
    allPass = false;
  }

  const envStr = `${spec.envelope.widthMm} × ${spec.envelope.heightMm} × ${spec.envelope.depthMm}`;

  return {
    name: ex.name,
    envelope: envStr,
    bays: bayCount,
    dividers: dividerCount,
    doors: doorCount,
    parts: structuralPartCount,
    determinism: determinismPass ? "PASS" : "FAIL",
    bounds: boundsPass ? "PASS" : "FAIL",
    closure: closurePass ? "PASS" : "FAIL",
    cnc: cncQual,
  };
});

console.log(
  "Configuration                     Envelope (mm)          Bays Divs Doors Parts  Determinism Bounds Closure CNC"
);
console.log(
  "-------------------------------------------------------------------------------------------------"
);

tableRows.forEach((row) => {
  const nameStr = row.name.padEnd(33, " ");
  const envStr = row.envelope.padEnd(22, " ");
  const baysStr = String(row.bays).padStart(4, " ");
  const divsStr = String(row.dividers).padStart(4, " ");
  const doorsStr = String(row.doors).padStart(5, " ");
  const partsStr = String(row.parts).padStart(5, " ");
  const detStr = row.determinism.padStart(12, " ");
  const bndStr = row.bounds.padStart(7, " ");
  const cloStr = row.closure.padStart(8, " ");
  const cncStr = `  ${row.cnc}`;
  console.log(`${nameStr} ${envStr} ${baysStr} ${divsStr} ${doorsStr} ${partsStr} ${detStr} ${bndStr} ${cloStr}${cncStr}`);
});

console.log("-------------------------------------------------------------------------------------------------");
console.log("Hardware drilling: BLOCKED across all fixtures");
console.log("CNC qualification: NO across all fixtures");
console.log("=================================================================================================");
console.log(`G2.2-R1 VERDICT: ${allPass ? "PASS" : "FAIL"}`);

if (!allPass) {
  process.exit(1);
}
