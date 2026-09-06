#!/usr/bin/env node

/**
 * scripts/demo-ai-wardrobe.mjs  —  npm run demo:ai-wardrobe
 * ---------------------------------------------------------------------
 * FurniAI AI-Alpha R1 — Conversation to Parametric Wardrobe (Gate G4)
 *
 * Demonstrates the trusted approval boundary:
 *   1. A description produces a PROPOSED FurniSpec.
 *   2. The proposal is READY_FOR_REVIEW.
 *   3. No PartGraph exists yet.
 *   4. A human approves the exact proposal fingerprint.
 *   5. Only then is the 19-part PartGraph generated.
 *   6. CNC and hardware drilling remain blocked throughout.
 *
 * Plus: an incomplete request asks questions, an out-of-slice request is
 * refused, and unapproved / mismatched / tampered approvals produce nothing.
 *
 * WORKSHOP-REVIEW OUTPUT — NOT CNC-QUALIFIED. Exits 0 only if every check passes.
 */

import { PIPELINE_STAGE, approveAndPreview, proposeWardrobe } from "../src/lib/conversation/pipeline.js";
import {
  COMPLETE_DESCRIPTION,
  INCOMPLETE_ANSWERS,
  INCOMPLETE_DESCRIPTION,
  OUT_OF_SLICE_DESCRIPTION,
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
  checks.push({ label, pass });
  console.log(`  [${pass ? "PASS" : "FAIL"}] ${label}${detail ? ` — ${detail}` : ""}`);
  return pass;
}

console.log(RULE);
console.log("FurniAI AI-Alpha R1 — Conversation to Parametric Wardrobe (Gate G4)");
console.log("TRUSTED APPROVAL BOUNDARY — WORKSHOP-REVIEW ONLY — NOT CNC-QUALIFIED");
console.log(RULE);

/* =====================================================================
 * STAGE 1 — description becomes a PROPOSED FurniSpec, and stops there
 * ===================================================================== */
console.log("\n[1/6] DESCRIPTION -> PROPOSED FURNISPEC");
console.log(THIN);
console.log("Customer says:");
console.log(`  "${COMPLETE_DESCRIPTION}"`);

const stage1 = proposeWardrobe({ description: COMPLETE_DESCRIPTION, specId: "furnispec-ai-alpha-demo-01", revision: 1 });

console.log(`\nProposal adapter: ${stage1.adapterId} (${stage1.adapterKind}, live model: none)`);
console.log("\nWhat the adapter proposed (untrusted until a human confirms):");
for (const obs of stage1.observations) {
  console.log(`  ${obs.key.padEnd(20)} = ${String(JSON.stringify(obs.value)).padEnd(58)} [${obs.origin}]`);
}
console.log("\nClosure derivations (each carries the rule it came from):");
for (const d of stage1.derivations) {
  console.log(`  ${d.path.padEnd(34)} = ${String(d.value).padStart(8)} mm  rules[${d.ruleIds.join(", ") || "closure"}]`);
}

console.log("");
check("FurniSpec status is PROPOSED, not APPROVED", stage1.spec.status === "PROPOSED", stage1.spec.status);
check("FurniSpec validates with zero errors", stage1.validation.valid && stage1.validation.errors.length === 0);
check("No clarification gap remains", stage1.gaps.length === 0);
console.log(`\n  Canonical proposal is ${serializeCanonicalJson(stage1.spec).length} bytes, byte-stable.`);

/* =====================================================================
 * STAGE 2 — the proposal is READY_FOR_REVIEW and carries a fingerprint
 * ===================================================================== */
console.log("\n[2/6] PROPOSAL IS READY_FOR_REVIEW");
console.log(THIN);
console.log(`  proposalId          : ${stage1.proposal.specId}`);
console.log(`  proposalRevision    : ${stage1.proposal.revision}`);
console.log(`  proposalFingerprint : ${stage1.proposal.fingerprint}`);
console.log(`  algorithm           : ${stage1.proposal.fingerprintAlgorithm}`);
console.log("");
check("Stage is READY_FOR_REVIEW", stage1.stage === PIPELINE_STAGE.READY_FOR_REVIEW, stage1.stage);
check("Proposal record is frozen", Object.isFrozen(stage1.proposal));
check("Fingerprint is a canonical fs256 digest", /^fs256:[0-9a-f]{64}$/.test(stage1.proposal.fingerprint));

/* =====================================================================
 * STAGE 3 — no geometry exists yet, and cannot be forced into existence
 * ===================================================================== */
console.log("\n[3/6] NO PARTGRAPH EXISTS BEFORE APPROVAL");
console.log(THIN);
check("partGraph is null", stage1.partGraph === null);
check("partGraphValidation is null", stage1.partGraphValidation === null);
check("Safety says no geometry was generated", stage1.safety.geometryGenerated === false);
check("Safety says preview is not authorised", stage1.safety.previewAuthorized === false);
check("Safety reports no approved operations", stage1.safety.approvedOperationTypes.length === 0);

console.log("\n  Attempts to skip the boundary:");
const attempts = [
  ["no approval at all", null],
  ["an empty object", {}],
  ['the string "approved"', "approved"],
  ["boolean true", true],
  ["blank approvedBy", { approvedBy: "  ", proposalId: stage1.proposal.specId, proposalRevision: 1, proposalFingerprint: stage1.proposal.fingerprint }],
  ["wrong spec ID", { approvedBy: "Bekzod", proposalId: "another-spec", proposalRevision: 1, proposalFingerprint: stage1.proposal.fingerprint }],
  ["wrong revision", { approvedBy: "Bekzod", proposalId: stage1.proposal.specId, proposalRevision: 7, proposalFingerprint: stage1.proposal.fingerprint }],
  ["wrong fingerprint", { approvedBy: "Bekzod", proposalId: stage1.proposal.specId, proposalRevision: 1, proposalFingerprint: `fs256:${"0".repeat(64)}` }],
];
let allRefused = true;
for (const [label, approval] of attempts) {
  const attempt = approveAndPreview({ proposal: stage1.proposal, approval });
  const refused = attempt.partGraph === null && attempt.stage !== PIPELINE_STAGE.APPROVED_FOR_PREVIEW;
  if (!refused) allRefused = false;
  const code = attempt.approvalValidation.errors[0]?.code ?? "—";
  console.log(`    ${refused ? "refused" : "LEAKED "}  ${label.padEnd(24)} ${code}`);
}

// A proposal edited after the human signed it off.
const signed = { approvedBy: "Bekzod", proposalId: stage1.proposal.specId, proposalRevision: 1, proposalFingerprint: stage1.proposal.fingerprint };
const tampered = {
  ...stage1.proposal,
  spec: { ...stage1.proposal.spec, envelope: { ...stage1.proposal.spec.envelope, widthMm: 2000.0 } },
};
const tamperResult = approveAndPreview({ proposal: tampered, approval: signed });
const tamperRefused = tamperResult.partGraph === null;
if (!tamperRefused) allRefused = false;
console.log(`    ${tamperRefused ? "refused" : "LEAKED "}  ${"proposal widened after sign-off".padEnd(24)} ${tamperResult.approvalValidation.errors.map((e) => e.code).join(", ")}`);
console.log("");
check("Every unapproved or mismatched attempt produced zero geometry", allRefused);

/* =====================================================================
 * STAGE 4 — a human approves the exact fingerprint
 * ===================================================================== */
console.log("\n[4/6] HUMAN APPROVES THE EXACT PROPOSAL");
console.log(THIN);
const approval = {
  approvedBy: "Bekzod Khalimov (workshop authority)",
  proposalId: stage1.proposal.specId,
  proposalRevision: stage1.proposal.revision,
  proposalFingerprint: stage1.proposal.fingerprint,
};
console.log(`  approvedBy          : ${approval.approvedBy}`);
console.log(`  proposalId          : ${approval.proposalId}`);
console.log(`  proposalRevision    : ${approval.proposalRevision}`);
console.log(`  proposalFingerprint : ${approval.proposalFingerprint}`);

const stage2 = approveAndPreview({ proposal: stage1.proposal, approval });
console.log("");
check("Approval validated against the recomputed fingerprint", stage2.approvalValidation.valid);
check("Stage is APPROVED_FOR_PREVIEW", stage2.stage === PIPELINE_STAGE.APPROVED_FOR_PREVIEW, stage2.stage);
check("FurniSpec status is now APPROVED", stage2.spec.status === "APPROVED");
check("Approved fingerprint matches the reviewed proposal", stage2.approvedFingerprint === stage1.proposal.fingerprint);

/* =====================================================================
 * STAGE 5 — only now is the 19-part PartGraph generated
 * ===================================================================== */
console.log("\n[5/6] APPROVED FURNISPEC -> 19-PART PARTGRAPH");
console.log(THIN);
console.log("Part ID            Role                     Finished L x W x T (mm)      Placement X / Y / Z (mm)");
console.log(THIN);
for (const p of stage2.partGraph.parts) {
  const f = `${fromDeciMm(p.finished.lengthDmm)} x ${fromDeciMm(p.finished.widthDmm)} x ${fromDeciMm(p.finished.thicknessDmm)}`;
  const pl = `[${fromDeciMm(p.placement.minXDmm)}-${fromDeciMm(p.placement.maxXDmm)}] [${fromDeciMm(p.placement.minYDmm)}-${fromDeciMm(p.placement.maxYDmm)}] [${fromDeciMm(p.placement.minZDmm)}-${fromDeciMm(p.placement.maxZDmm)}]`;
  console.log(`${p.id.padEnd(18)} ${p.role.padEnd(24)} ${f.padEnd(28)} ${pl}`);
}
console.log(THIN);

const structuralKey = (p) =>
  JSON.stringify([p.role, p.quantity, p.materialCode, p.finished, p.raw, p.placement, p.orientation, p.grainDirection, p.edges, p.status]);
const goldenKeys = buildStructuralPartGraph(goldenFixture).parts.map(structuralKey).sort();
const mineKeys = stage2.partGraph.parts.map(structuralKey).sort();

check("PartGraph contains exactly 19 structural parts", stage2.partGraph.summary.totalStructuralParts === 19);
check("PartGraph validates with zero errors", stage2.partGraphValidation.valid);
check("Geometry is part-for-part identical to the Bekzod-approved Golden Wardrobe", JSON.stringify(mineKeys) === JSON.stringify(goldenKeys));

const baseline = serializeCanonicalPartGraph(stage2.partGraph);
let deterministic = true;
for (let i = 0; i < 10; i += 1) {
  const again = proposeWardrobe({ description: COMPLETE_DESCRIPTION, specId: "furnispec-ai-alpha-demo-01", revision: 1 });
  if (again.proposal.fingerprint !== stage1.proposal.fingerprint) deterministic = false;
  const previewed = approveAndPreview({
    proposal: again.proposal,
    approval: { ...approval, proposalFingerprint: again.proposal.fingerprint },
  });
  if (serializeCanonicalPartGraph(previewed.partGraph) !== baseline) deterministic = false;
}
check("Fingerprint and geometry are deterministic over 10 consecutive runs", deterministic);

/* =====================================================================
 * STAGE 6 — safety, and the two refusal paths
 * ===================================================================== */
console.log("\n[6/6] SAFETY GATES AND REFUSAL PATHS");
console.log(THIN);
const s = stage2.safety;
console.log(`  approval state          : ${s.approvalState} (${s.approvedBy})`);
console.log(`  spec qualification      : ${s.specQualificationStatus}`);
console.log(`  PartGraph qualification : ${s.partGraphQualificationStatus}`);
console.log(`  machining drilling      : ${s.drillingPolicy}`);
console.log(`  drilling operations     : ${s.drillingOperationCount}`);
console.log(`  approved operations     : ${s.approvedOperationTypes.join(", ") || "none"}`);
console.log(`  hardware                : ${Object.entries(s.hardwareStatuses).map(([k, v]) => `${k}=${v}`).join(", ")}`);
console.log("");
check("CNC qualification is NO on both spec and PartGraph", s.cncQualified === false && s.cncQualificationAsserted === true);
check("Hardware drilling is BLOCKED and emits zero operations", s.drillingBlocked === true && s.drillingOperationCount === 0);
check("No hardware group is APPROVED", !Object.values(s.hardwareStatuses).includes("APPROVED"));
check("Only the approved back groove is machined", s.approvedOperationTypes.join(",") === "BACK_GROOVE");
check("PartGraph carries no drilling or G-code payload", !/DRILL|HINGE_CUP|PIN_HOLE|GCODE|G-CODE/i.test(JSON.stringify(stage2.partGraph)));

console.log("\n  Incomplete request:");
console.log(`    "${INCOMPLETE_DESCRIPTION}"`);
const incomplete = proposeWardrobe({ description: INCOMPLETE_DESCRIPTION, specId: "furnispec-ai-alpha-demo-02", revision: 1 });
incomplete.questions.forEach((q, i) => console.log(`      ${String(i + 1).padStart(2)}. ${q.question}`));
console.log("");
check("Incomplete request returns NEEDS_CLARIFICATION", incomplete.stage === PIPELINE_STAGE.NEEDS_CLARIFICATION, incomplete.stage);
check("No proposal and no geometry from an incomplete request", incomplete.proposal === null && incomplete.partGraph === null);
check("Nothing was silently defaulted", incomplete.observations.length === 0);

const answered = proposeWardrobe({
  description: INCOMPLETE_DESCRIPTION,
  answers: INCOMPLETE_ANSWERS,
  specId: "furnispec-ai-alpha-demo-02",
  revision: 2,
});
const answeredPreview = approveAndPreview({
  proposal: answered.proposal,
  approval: {
    approvedBy: "Bekzod Khalimov (workshop authority)",
    proposalId: answered.proposal.specId,
    proposalRevision: answered.proposal.revision,
    proposalFingerprint: answered.proposal.fingerprint,
  },
});
check("After answers and a fresh approval, the same request reaches 19 parts", answeredPreview.partGraph?.summary.totalStructuralParts === 19);

console.log("\n  Out-of-slice request:");
console.log(`    "${OUT_OF_SLICE_DESCRIPTION}"`);
const unsupported = proposeWardrobe({ description: OUT_OF_SLICE_DESCRIPTION, specId: "furnispec-ai-alpha-demo-03", revision: 1 });
console.log("");
check("Out-of-slice request returns UNSUPPORTED_REQUEST, not NEEDS_CLARIFICATION", unsupported.stage === PIPELINE_STAGE.UNSUPPORTED_REQUEST, unsupported.stage);
check("No proposal and no geometry from an unsupported request", unsupported.proposal === null && unsupported.partGraph === null);

console.log("\n" + RULE);
const failed = checks.filter((c) => !c.pass);
console.log(`G4 AI-ALPHA R1 VERDICT: ${failed.length === 0 ? "PASS" : "FAIL"}  (${checks.length - failed.length}/${checks.length} checks)`);
console.log("APPROVAL REQUIRED BEFORE GEOMETRY: ENFORCED    CNC QUALIFIED: NO    HARDWARE DRILLING: BLOCKED");
console.log(RULE);

if (failed.length > 0) {
  for (const f of failed) console.error(`FAILED: ${f.label}`);
  process.exit(1);
}
