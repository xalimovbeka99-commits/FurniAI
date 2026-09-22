#!/usr/bin/env node
/**
 * scripts/make-db-test-payloads.mjs
 * ---------------------------------------------------------------------
 * Emit the exact JSON bodies docs/m3/PERSISTENCE_DB_TEST_PROCEDURE.md posts.
 *
 * WHY THIS EXISTS RATHER THAN CHECKED-IN JSON
 *
 * A save is refused unless the FurniSpec validates, the PartGraph describes
 * that spec, and the fingerprint recomputes — which is the whole point of the
 * validation work. Hand-written fixtures would either be wrong (and prove
 * nothing but that the server says 400) or would mean inventing furniture
 * geometry by hand, which is not this file's business. So every payload is
 * built by the authoritative pipeline and compiler, exactly as the browser
 * builds it.
 *
 *   node scripts/make-db-test-payloads.mjs [outDir]
 *
 * Default outDir: ./db-test-payloads (gitignored; delete when finished).
 * Writes nothing secret — these are furniture dimensions, no tokens, no keys.
 *
 * Emits:
 *   rev1.json              first revision, expectedPreviousRevision null
 *   rev2-painted.json      builds on 1 — concurrency writer A
 *   rev2-veneer.json       builds on 1 — concurrency writer B (different body)
 *   rev2-painted-replay.json   byte-identical to A, for the idempotency check
 *   rev2-no-cas.json       omits expectedPreviousRevision (must be refused)
 *   bad-spec.json          malformed spec, correctly fingerprinted (refused)
 *   mismatched-graph.json  valid spec + another design's graph (refused)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { previewDraftWardrobe } from "../src/lib/conversation/pipeline.js";
import { fingerprintFurniSpec } from "../src/lib/conversation/approval.js";

const outDir = path.resolve(process.argv[2] || "db-test-payloads");
mkdirSync(outDir, { recursive: true });

const SPEC_ID = "furnispec-db-procedure";

function build({ description, specId = SPEC_ID, revision }) {
  const d = previewDraftWardrobe({ description, specId, revision });
  if (!d.validation?.valid) {
    throw new Error(`fixture design is not valid: ${JSON.stringify(d.validation?.errors ?? [])}`);
  }
  return d;
}

function body(d, { revision, expectedPreviousRevision, finishType }) {
  const furniSpec = structuredClone(d.spec);
  furniSpec.revision = revision;
  if (finishType) furniSpec.finishType = finishType;
  // The PartGraph must describe THIS spec, including its revision.
  const partGraph = structuredClone(d.partGraph);
  partGraph.sourceRevision = revision;
  return {
    revision,
    expectedPreviousRevision,
    fingerprint: fingerprintFurniSpec(furniSpec),
    furniSpec,
    partGraph,
    origins: d.origins ?? {},
    validationStatus: "ACCEPTED",
  };
}

const write = (name, obj) => {
  writeFileSync(path.join(outDir, name), JSON.stringify(obj, null, 2) + "\n");
  console.log(`  ${name}`);
};

const A = build({ description: "A wardrobe 1800 mm wide, 2400 mm high and 600 mm deep", revision: 1 });
const B = build({
  description: "A wardrobe 2400 mm wide, 2400 mm high and 600 mm deep",
  specId: "furnispec-db-procedure-other",
  revision: 1,
});

console.log(`Writing payloads to ${outDir}`);

write("rev1.json", body(A, { revision: 1, expectedPreviousRevision: null }));

const painted = body(A, { revision: 2, expectedPreviousRevision: 1, finishType: "painted" });
write("rev2-painted.json", painted);
write("rev2-painted-replay.json", painted); // byte-identical on purpose
write("rev2-veneer.json", body(A, { revision: 2, expectedPreviousRevision: 1, finishType: "veneer" }));

const noCas = body(A, { revision: 2, expectedPreviousRevision: 1 });
delete noCas.expectedPreviousRevision;
write("rev2-no-cas.json", noCas);

// A spec whose envelope no longer agrees with its bays, fingerprinted
// correctly for the broken spec. Must be refused as INVALID_FURNISPEC, not
// accepted because the fingerprint matches.
const badSpec = body(A, { revision: 1, expectedPreviousRevision: null });
badSpec.furniSpec.envelope.widthMm = 2000;
badSpec.fingerprint = fingerprintFurniSpec(badSpec.furniSpec);
write("bad-spec.json", badSpec);

// Design A's spec carrying design B's geometry. Both individually valid.
const mismatched = body(A, { revision: 1, expectedPreviousRevision: null });
mismatched.partGraph = structuredClone(B.partGraph);
write("mismatched-graph.json", mismatched);

console.log("\nNone of these files contain a token, a key, or anything secret.");
console.log("Delete the directory when the procedure is finished.");
