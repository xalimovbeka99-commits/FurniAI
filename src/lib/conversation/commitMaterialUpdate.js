/**
 * Commit a MATERIAL_UPDATED materialKey into the canonical accepted design.
 *
 * Transport returns materialKey only (no new spec/PartGraph). Before the UI
 * treats the change as committed, this annotates accepted state through the
 * engineering path: FurniSpec + createProposal fingerprint + PartGraph finish
 * intent. Manufacturing finishType/SKU stay catalog-backed (melamine). The
 * customer visual finish is customerFinishKey — never overwrite finishType with
 * a swatch name, or later structural rebuilds fail materialsFor().
 */
import { createProposal } from "./approval.js";
import { OBSERVATION_ORIGIN } from "./intakeModel.js";

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

/**
 * Annotate an already-built accepted design with a customer visual finish.
 * Does not bump revision (caller owns revision).
 */
export function applyCustomerFinishAnnotation({
  materialKey,
  spec,
  partGraph = null,
  observations = [],
  origins = {},
} = {}) {
  if (typeof materialKey !== "string" || materialKey.trim() === "") {
    return { ok: false, error: "materialKey is required to commit a finish change." };
  }
  if (!spec || typeof spec !== "object") {
    return { ok: false, error: "An active FurniSpec is required before a finish can be committed." };
  }

  const key = materialKey.trim().toLowerCase();
  const nextSpec = {
    ...cloneJson(spec),
    // Keep manufacturing finishType catalog-backed.
    finishType: spec.finishType && spec.finishType !== key ? spec.finishType : (spec.finishType || "melamine"),
    customerFinishKey: key,
  };
  if (nextSpec.finishType === key) {
    // If a prior bug wrote the swatch into finishType, restore catalog default.
    nextSpec.finishType = "melamine";
  }
  if (nextSpec.materials && typeof nextSpec.materials === "object") {
    nextSpec.materials = { ...nextSpec.materials, customerFinishKey: key };
  }

  const nextProposal = createProposal(nextSpec);

  let nextPartGraph = cloneJson(partGraph);
  if (nextPartGraph && typeof nextPartGraph === "object") {
    nextPartGraph.summary = {
      ...(nextPartGraph.summary || {}),
      customerFinishKey: key,
      revision: nextSpec.revision,
    };
    if (Array.isArray(nextPartGraph.parts)) {
      nextPartGraph.parts = nextPartGraph.parts.map((part) => ({
        ...part,
        customerFinishKey: key,
        finishIntent: key,
      }));
    }
  }

  const nextObservations = [
    ...observations.filter(
      (o) => o && o.key !== "customerFinishKey" && o.key !== "materialKey"
    ),
    {
      key: "customerFinishKey",
      value: key,
      origin: OBSERVATION_ORIGIN.CUSTOMER_STATED,
      sourceText: `customer finish ${key}`,
      sourceSpan: null,
      ruleIds: [],
    },
  ];
  // Ensure manufacturing finishType observation remains catalog-backed.
  const hasFinish = nextObservations.some((o) => o.key === "finishType");
  if (!hasFinish) {
    nextObservations.push({
      key: "finishType",
      value: nextSpec.finishType || "melamine",
      origin: OBSERVATION_ORIGIN.DEFAULTED,
      sourceText: "catalog manufacturing finish",
      sourceSpan: null,
      ruleIds: [],
    });
  } else {
    for (let i = 0; i < nextObservations.length; i++) {
      if (nextObservations[i].key === "finishType" && nextObservations[i].value === key) {
        nextObservations[i] = {
          ...nextObservations[i],
          value: "melamine",
          origin: OBSERVATION_ORIGIN.DEFAULTED,
          sourceText: "restored catalog manufacturing finish (swatch is customerFinishKey)",
        };
      }
    }
  }

  const nextOrigins = {
    ...origins,
    customerFinishKey: OBSERVATION_ORIGIN.CUSTOMER_STATED,
  };

  return {
    ok: true,
    materialKey: key,
    spec: nextSpec,
    proposal: nextProposal,
    partGraph: nextPartGraph,
    observations: nextObservations,
    origins: nextOrigins,
    revision: nextSpec.revision,
  };
}

/**
 * Commit a customer finish change: bump revision, then annotate.
 */
export function commitMaterialUpdate({
  materialKey,
  spec,
  partGraph = null,
  observations = [],
  origins = {},
  revision = undefined,
} = {}) {
  if (!spec || typeof spec !== "object") {
    return { ok: false, error: "An active FurniSpec is required before a finish can be committed." };
  }
  const nextRevision = Number.isFinite(revision)
    ? revision + 1
    : (Number.isFinite(spec.revision) ? spec.revision : 1) + 1;
  const bumped = { ...cloneJson(spec), revision: nextRevision };
  return applyCustomerFinishAnnotation({
    materialKey,
    spec: bumped,
    partGraph,
    observations,
    origins,
  });
}

/**
 * After a structural rebuild, re-apply any prior customerFinishKey from observations.
 */
export function preserveCustomerFinishOnDraft(draft, currentObservations = []) {
  if (!draft?.ok && !draft?.spec) return draft;
  const fromObs =
    currentObservations.find((o) => o?.key === "customerFinishKey")?.value ||
    currentObservations.find((o) => o?.key === "materialKey")?.value ||
    draft.spec?.customerFinishKey;
  if (!fromObs) return draft;
  const annotated = applyCustomerFinishAnnotation({
    materialKey: fromObs,
    spec: draft.spec,
    partGraph: draft.partGraph,
    observations: draft.observations || currentObservations,
    origins: draft.origins || {},
  });
  if (!annotated.ok) return draft;
  return {
    ...draft,
    spec: annotated.spec,
    proposal: annotated.proposal,
    partGraph: annotated.partGraph,
    observations: annotated.observations,
    origins: annotated.origins,
    materialKey: annotated.materialKey,
  };
}
