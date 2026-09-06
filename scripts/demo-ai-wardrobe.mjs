#!/usr/bin/env node

/**
 * scripts/demo-ai-wardrobe.mjs  —  npm run demo:ai-wardrobe
 * ---------------------------------------------------------------------
 * FurniAI AI-Alpha — Conversation to Parametric Wardrobe (Gate G4)
 *
 * Demonstrates, in one deterministic run:
 *   1. A complete customer description becoming a validated FurniSpec.
 *   2. The approved FurniSpec becoming a 19-part PartGraph.
 *   3. An incomplete request producing clarification questions instead of guesses.
 *   4. CNC qualification and hardware drilling remaining blocked throughout.
 *
 * WORKSHOP-REVIEW OUTPUT — NOT CNC-QUALIFIED.
 * Exits 0 only when all four demonstrations pass.
 */

import { PIPELINE_STAGE, runConversationToWardrobe } from "../src/lib/conversation/pipeline.js";
import {
  COMPLETE_DESCRIPTION,
  INCOMPLETE_ANSWERS,
  INCOMPLETE_DESCRIPTION,
} from "../src/lib/conversation/fixtures/demoScenarios.js";
import { serializeCanonicalJson } from "../src/lib/furnispec/normalize.js";
import { serializeCanonicalPartGraph } from "../src/lib/partgraph/serializePartGraph.js";
import { fromDeciMm } from "../src/lib/furnispec/units.js";
import goldenFixture from "../src/lib/furnispec/goldenWardrobe.fixture.json" with { type: "json" };
import { buildStructuralPartGraph } from "../src/lib/partgraph/buildStructuralPartGraph.js";

const RULE = "=".repeat(99);
const THIN = "-".repeat(99);

const checks = [];
function check(label, pass, detail = "") {
  checks.push({ label, pass, detail });
  console.log(`  [${pass ? "PASS" : "FAIL"}] ${label}${detail ? ` — ${detail}` : ""}`);
  return pass;
}

console.log(RULE);
console.log("FurniAI AI-Alpha — Conversation to Parametric Wardrobe (Gate G4)");
console.log("WORKSHOP-REVIEW OUTPUT — NOT CNC-QUALIFIED — HARDWARE DRILLING BLOCKED");
console.log(RULE);

// =====================================================================
// 1. A complete customer description becomes a validated FurniSpec
// =====================================================================
console.log("\n[1/4] COMPLETE DESCRIPTION -> VALIDATED FURNISPEC");
console.log(THIN);
console.log("Customer says:");
console.log(`  "${COMPLETE_DESCRIPTION}"`);

const complete = runConversationToWardrobe({
  description: COMPLETE_DESCRIPTION,
  specId: "furnispec-ai-alpha-demo-01",
  revision: 1,
  approval: { approvedBy: "Bekzod (workshop authority)" },
});

console.log("\nWhat the interpreter read out of that text (proposals, not yet trusted):");
for (const obs of complete.observations) {
  console.log(`  ${obs.key.padEnd(20)} = ${String(JSON.stringify(obs.value)).padEnd(58)} [${obs.origin}] <- "${obs.sourceText}"`);
}

console.log("\nClosure derivations (every one carries the rule it came from):");
for (const d of complete.derivations ?? []) {
  console.log(`  ${d.path.padEnd(34)} = ${String(d.value).padStart(8)} mm  rules[${d.ruleIds.join(", ") || "closure"}]`);
  console.log(`  ${"".padEnd(34)}   ${d.formula}`);
}

console.log("");
check("Pipeline reached PartGraph without a single unresolved gap", complete.stage === PIPELINE_STAGE.PART_GRAPH_READY, `stage=${complete.stage}`);
check("FurniSpec validates with zero errors", complete.validation?.valid === true, `${complete.validation?.errors.length ?? "n/a"} error(s)`);
check("Spec is APPROVED by the workshop authority", complete.spec?.status === "APPROVED");
check(
  "Width closes exactly",
  complete.spec.bays.reduce((s, b) => s + b.clearWidthMm, 0) + (complete.spec.bays.length + 1) * complete.spec.carcass.panelThicknessMm ===
    complete.spec.envelope.widthMm,
  `${complete.spec.envelope.widthMm} mm`
);
check(
  "Height closes exactly",
  complete.spec.plinth.heightMm + complete.spec.carcass.heightMm === complete.spec.envelope.heightMm,
  `${complete.spec.envelope.heightMm} mm`
);
console.log(`\n  Canonical FurniSpec is ${serializeCanonicalJson(complete.spec).length} bytes, byte-stable.`);

// =====================================================================
// 2. The approved FurniSpec becomes a 19-part PartGraph
// =====================================================================
console.log("\n[2/4] APPROVED FURNISPEC -> 19-PART PARTGRAPH");
console.log(THIN);
console.log("Part ID            Role                     Finished L x W x T (mm)      Placement X / Y / Z (mm)");
console.log(THIN);
for (const p of complete.partGraph.parts) {
  const f = `${fromDeciMm(p.finished.lengthDmm)} x ${fromDeciMm(p.finished.widthDmm)} x ${fromDeciMm(p.finished.thicknessDmm)}`;
  const pl = `[${fromDeciMm(p.placement.minXDmm)}-${fromDeciMm(p.placement.maxXDmm)}] [${fromDeciMm(p.placement.minYDmm)}-${fromDeciMm(p.placement.maxYDmm)}] [${fromDeciMm(p.placement.minZDmm)}-${fromDeciMm(p.placement.maxZDmm)}]`;
  console.log(`${p.id.padEnd(18)} ${p.role.padEnd(24)} ${f.padEnd(28)} ${pl}`);
}
console.log(THIN);

const goldenGraph = buildStructuralPartGraph(goldenFixture);
const structuralKey = (p) =>
  JSON.stringify([p.role, p.quantity, p.materialCode, p.finished, p.raw, p.placement, p.orientation, p.grainDirection, p.edges, p.status]);
const mineKeys = complete.partGraph.parts.map(structuralKey).sort();
const goldenKeys = goldenGraph.parts.map(structuralKey).sort();

check("PartGraph contains exactly 19 structural parts", complete.partGraph.summary.totalStructuralParts === 19, `${complete.partGraph.summary.totalStructuralParts} parts`);
check("PartGraph validates with zero errors", complete.partGraphValidation?.valid === true, `${complete.partGraphValidation?.errors.length ?? "n/a"} error(s)`);
check(
  "Geometry is part-for-part identical to the Bekzod-approved Golden Wardrobe",
  JSON.stringify(mineKeys) === JSON.stringify(goldenKeys)
);

const baselineGraph = serializeCanonicalPartGraph(complete.partGraph);
let deterministic = true;
for (let i = 0; i < 10; i += 1) {
  const again = runConversationToWardrobe({
    description: COMPLETE_DESCRIPTION,
    specId: "furnispec-ai-alpha-demo-01",
    revision: 1,
    approval: { approvedBy: "Bekzod (workshop authority)" },
  });
  if (serializeCanonicalPartGraph(again.partGraph) !== baselineGraph) deterministic = false;
}
check("Description -> PartGraph is deterministic over 10 consecutive runs", deterministic);

// =====================================================================
// 3. An incomplete request produces clarification questions
// =====================================================================
console.log("\n[3/4] INCOMPLETE REQUEST -> CLARIFICATION QUESTIONS");
console.log(THIN);
console.log("Customer says:");
console.log(`  "${INCOMPLETE_DESCRIPTION}"`);

const incomplete = runConversationToWardrobe({
  description: INCOMPLETE_DESCRIPTION,
  specId: "furnispec-ai-alpha-demo-02",
  revision: 1,
});

console.log("\nFurniAI asks, before building anything:");
incomplete.questions.forEach((q, i) => {
  console.log(`  ${String(i + 1).padStart(2)}. ${q.question}`);
  console.log(`      why: ${q.why}`);
  if (q.proposalBasis) console.log(`      basis: ${q.proposalBasis} (proposal only — needs a human answer)`);
});

console.log("");
check("Pipeline stopped at clarification", incomplete.stage === PIPELINE_STAGE.CLARIFICATION_REQUIRED, `stage=${incomplete.stage}`);
check("No FurniSpec was produced from an incomplete request", incomplete.spec === null);
check("No geometry was produced from an incomplete request", incomplete.partGraph === null);
check("One question per unresolved fact", incomplete.questions.length === incomplete.gaps.length, `${incomplete.questions.length} question(s)`);
check(
  "The hedged measurement was refused, not rounded",
  incomplete.gaps.some((g) => g.key === "envelope.heightMm" && g.kind === "AMBIGUOUS_FACT"),
  '"about 2 metres tall"'
);
check(
  "Nothing was silently defaulted",
  incomplete.observations.length === 0,
  "zero values assumed on the customer's behalf"
);

console.log("\nCustomer answers every question; the same pipeline runs again:");
const answered = runConversationToWardrobe({
  description: INCOMPLETE_DESCRIPTION,
  answers: INCOMPLETE_ANSWERS,
  specId: "furnispec-ai-alpha-demo-02",
  revision: 2,
  approval: { approvedBy: "Bekzod (workshop authority)" },
});
check("After answers, the same request reaches a 19-part PartGraph", answered.stage === PIPELINE_STAGE.PART_GRAPH_READY && answered.partGraph?.summary.totalStructuralParts === 19);
check(
  "Every answered fact is recorded as CUSTOMER_CONFIRMED, never as an AI guess",
  answered.observations.every((o) => o.origin === "CUSTOMER_CONFIRMED"),
  `${answered.answeredKeys.length} confirmed fact(s)`
);

// =====================================================================
// 4. CNC and hardware safety remain blocked
// =====================================================================
console.log("\n[4/4] SAFETY GATES");
console.log(THIN);
for (const [label, result] of [["complete description", complete], ["answered request", answered]]) {
  const s = result.safety;
  console.log(`  ${label}:`);
  console.log(`    spec qualification      : ${s.specQualificationStatus}`);
  console.log(`    PartGraph qualification : ${s.partGraphQualificationStatus}`);
  console.log(`    machining drilling      : ${s.drillingPolicy}`);
  console.log(`    drilling operations     : ${s.drillingOperationCount}`);
  console.log(`    approved operations     : ${s.approvedOperationTypes.join(", ") || "none"}`);
  console.log(`    hardware                : ${Object.entries(s.hardwareStatuses).map(([k, v]) => `${k}=${v}`).join(", ")}`);
}
console.log("");
check("CNC qualification is NO on both spec and PartGraph", complete.safety.cncQualificationAsserted && answered.safety.cncQualificationAsserted);
check("Hardware drilling is BLOCKED and emits zero operations", complete.safety.drillingBlocked && answered.safety.drillingBlocked);
check("No hardware group is APPROVED", !Object.values(complete.safety.hardwareStatuses).includes("APPROVED"));
check("Only the approved back groove is machined", complete.safety.approvedOperationTypes.join(",") === "BACK_GROOVE");
check("PartGraph carries no drilling or G-code payload", !/DRILL|HINGE_CUP|PIN_HOLE|GCODE|G-CODE/i.test(JSON.stringify(complete.partGraph)));

// =====================================================================
console.log("\n" + RULE);
const failed = checks.filter((c) => !c.pass);
console.log(`G4 AI-ALPHA VERDICT: ${failed.length === 0 ? "PASS" : "FAIL"}  (${checks.length - failed.length}/${checks.length} checks)`);
console.log("CNC QUALIFIED: NO    HARDWARE DRILLING: BLOCKED    STATUS: WORKSHOP REVIEW ONLY");
console.log(RULE);

if (failed.length > 0) {
  for (const f of failed) console.error(`FAILED: ${f.label}`);
  process.exit(1);
}
