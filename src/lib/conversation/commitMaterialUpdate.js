/**
 * Commit a MATERIAL_UPDATED materialKey into the canonical accepted design.
 *
 * Transport returns materialKey only (no new spec/PartGraph). Before the UI
 * treats the change as committed, this rebuilds accepted state through the
 * engineering path: updated FurniSpec + createProposal fingerprint + PartGraph
 * finish annotation. Manufacturing SKUs stay catalog-backed (melamine); the
 * customer finish is recorded on the spec and PartGraph summary so exports,
 * approval and Undo share one identity.
 */
import { createProposal } from "./approval.js";
import { OBSERVATION_ORIGIN } from "./intakeModel.js";

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

/**
 * @param {object} args
 * @param {string} args.materialKey customer finish key (e.g. "walnut")
 * @param {object} args.spec active FurniSpec
 * @param {object|null} [args.partGraph]
 * @param {Array} [args.observations]
 * @param {object} [args.origins]
 * @param {number} [args.revision]
 * @returns {{ ok: true, spec, proposal, partGraph, observations, origins, revision, materialKey } | { ok: false, error: string }}
 */
export function commitMaterialUpdate({
  materialKey,
  spec,
  partGraph = null,
  observations = [],
  origins = {},
  revision = undefined,
} = {}) {
  if (typeof materialKey !== "string" || materialKey.trim() === "") {
    return { ok: false, error: "materialKey is required to commit a finish change." };
  }
  if (!spec || typeof spec !== "object") {
    return { ok: false, error: "An active FurniSpec is required before a finish can be committed." };
  }

  const key = materialKey.trim().toLowerCase();
  const nextRevision = Number.isFinite(revision)
    ? revision + 1
    : (Number.isFinite(spec.revision) ? spec.revision : 1) + 1;

  const nextSpec = {
    ...cloneJson(spec),
    finishType: key,
    revision: nextRevision,
  };
  // Preserve manufacturing materials from the prior approved catalog entry.
  // Annotate the customer finish so fingerprint + approval track the swatch.
  nextSpec.customerFinishKey = key;
  if (nextSpec.materials && typeof nextSpec.materials === "object") {
    nextSpec.materials = { ...nextSpec.materials, customerFinishKey: key };
  }

  const nextProposal = createProposal(nextSpec);

  let nextPartGraph = cloneJson(partGraph);
  if (nextPartGraph && typeof nextPartGraph === "object") {
    nextPartGraph.summary = {
      ...(nextPartGraph.summary || {}),
      customerFinishKey: key,
      revision: nextRevision,
    };
    if (Array.isArray(nextPartGraph.parts)) {
      nextPartGraph.parts = nextPartGraph.parts.map((part) => ({
        ...part,
        customerFinishKey: key,
        // Manufacturing codes stay catalog-backed; finish intent is explicit.
        finishIntent: key,
      }));
    }
  }

  const nextObservations = [
    ...observations.filter((o) => o && o.key !== "finishType" && o.key !== "materialKey"),
    {
      key: "finishType",
      value: key,
      origin: OBSERVATION_ORIGIN.CUSTOMER_STATED,
      sourceText: `customer finish ${key}`,
      sourceSpan: null,
      ruleIds: [],
    },
  ];

  const nextOrigins = {
    ...origins,
    finishType: OBSERVATION_ORIGIN.CUSTOMER_STATED,
  };

  return {
    ok: true,
    materialKey: key,
    spec: nextSpec,
    proposal: nextProposal,
    partGraph: nextPartGraph,
    observations: nextObservations,
    origins: nextOrigins,
    revision: nextRevision,
  };
}
