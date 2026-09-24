/**
 * Revision payloads via golden FurniSpec + structural PartGraph.
 * Matches concurrency.test.js field names. NOT production code.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildStructuralPartGraph } from "../../../../src/lib/partgraph/buildStructuralPartGraph.js";
import { fingerprintFurniSpec } from "../../../../src/lib/conversation/approval.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const fixture = JSON.parse(
  readFileSync(path.join(root, "src/lib/furnispec/goldenWardrobe.fixture.json"), "utf8")
);

export const SPEC_ID = "furnispec-harness-db";

export function makePayload(opts = {}) {
  const revision = opts.revision ?? 1;
  const furniSpec = {
    ...structuredClone(fixture),
    specId: opts.specId || SPEC_ID,
    revision,
    ...(opts.finish ? { finishType: opts.finish } : {}),
  };
  const body = {
    revision,
    fingerprint: fingerprintFurniSpec(furniSpec),
    furniSpec,
    partGraph: buildStructuralPartGraph(furniSpec),
    origins: { "envelope.widthMm": "CUSTOMER_STATED" },
    validationStatus: "ACCEPTED",
  };
  if ("expectedPreviousRevision" in opts) {
    body.expectedPreviousRevision = opts.expectedPreviousRevision;
  } else if (revision === 1) {
    body.expectedPreviousRevision = null;
  } else {
    body.expectedPreviousRevision = revision - 1;
  }
  return body;
}

export function makePayloadNoCas(revision = 2) {
  const body = makePayload({ revision, finish: "painted" });
  delete body.expectedPreviousRevision;
  return body;
}

export function makeBadSpecPayload() {
  const body = makePayload({ revision: 1, expectedPreviousRevision: null });
  if (body.furniSpec.envelope) {
    body.furniSpec.envelope = {
      ...body.furniSpec.envelope,
      widthMm: (body.furniSpec.envelope.widthMm || 1800) + 200,
    };
  }
  body.fingerprint = fingerprintFurniSpec(body.furniSpec);
  return body;
}

export function makeMismatchedGraphPayload() {
  // Both specs are individually valid; we attach B's PartGraph to A's FurniSpec.
  // Consistency must refuse (sourceSpecId / geometry mismatch) — do NOT invent
  // invalid geometry that buildStructuralPartGraph cannot compile.
  const a = makePayload({ revision: 1, expectedPreviousRevision: null, specId: SPEC_ID });
  const b = makePayload({
    revision: 1,
    expectedPreviousRevision: null,
    specId: SPEC_ID + "-other",
    finish: "veneer",
  });
  a.partGraph = structuredClone(b.partGraph);
  if (a.partGraph && typeof a.partGraph === "object") {
    a.partGraph.sourceSpecId = b.furniSpec.specId;
  }
  return a;
}

export function partCount(partGraph) {
  if (!partGraph) return 0;
  if (Array.isArray(partGraph.parts)) return partGraph.parts.length;
  if (Array.isArray(partGraph.panels)) return partGraph.panels.length;
  return 0;
}

export { fingerprintFurniSpec };

