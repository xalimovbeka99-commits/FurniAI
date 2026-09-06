/**
 * FurniAI — Conversation to Parametric Wardrobe Pipeline (Gate G4 / AI-Alpha R1)
 * ---------------------------------------------------------------------
 * TWO STAGES, SEPARATED BY AN EXPLICIT HUMAN APPROVAL.
 *
 * Stage 1 — proposeWardrobe()
 *   customer description
 *     -> proposal adapter (deterministic today; proposals only, never trusted)
 *     -> deterministic gap analysis
 *     -> clarification questions
 *     -> human answers
 *     -> assembled FurniSpec with status PROPOSED
 *     -> FurniSpec validation
 *     -> immutable proposal record + canonical fingerprint
 *     => stage READY_FOR_REVIEW, partGraph === null
 *
 * Stage 2 — approveAndPreview()
 *   structured human approval naming the exact proposal
 *     -> validateApproval(): id, revision and recomputed fingerprint must match
 *     -> FurniSpec status becomes APPROVED
 *     -> re-validated
 *     -> deterministic kernel generates the PartGraph
 *     => stage APPROVED_FOR_PREVIEW
 *
 * NO PATH THROUGH THIS MODULE PRODUCES GEOMETRY WITHOUT A VALID APPROVAL.
 * CNC qualification and hardware drilling stay blocked on both sides.
 */

import { buildStructuralPartGraph } from "../partgraph/buildStructuralPartGraph.js";
import { validatePartGraph } from "../partgraph/validatePartGraph.js";
import { QUALIFICATION_STATUS, SPEC_STATUS } from "../furnispec/schema.js";
import { validateFurniSpec } from "../furnispec/validate.js";
import { AssemblyBlockedError, assembleFurniSpec } from "./assembleFurniSpec.js";
import { createProposal, validateApproval } from "./approval.js";
import { analyseGaps, blockingGaps } from "./gapAnalysis.js";
import { GAP_KIND, OBSERVATION_ORIGIN, observation } from "./intakeModel.js";
import { createDeterministicPhraseAdapter, assertProposalOnly } from "./proposalAdapter.js";
import { questionsFor } from "./questions.js";

export const PIPELINE_STAGE = Object.freeze({
  NEEDS_CLARIFICATION: "NEEDS_CLARIFICATION",
  UNSUPPORTED_REQUEST: "UNSUPPORTED_REQUEST",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  READY_FOR_REVIEW: "READY_FOR_REVIEW",
  APPROVED_FOR_PREVIEW: "APPROVED_FOR_PREVIEW",
});

export const APPROVAL_STATE = Object.freeze({
  NOT_APPROVED: "NOT_APPROVED",
  APPROVAL_REJECTED: "APPROVAL_REJECTED",
  APPROVED: "APPROVED",
});

const MAX_RESOLUTION_ROUNDS = 8;

/* ===================================================================== */
/* Stage 1 — propose                                                      */
/* ===================================================================== */

/**
 * @param {object} args
 * @param {string} args.description raw customer text
 * @param {Record<string, any>} [args.answers] answers keyed by gap key
 * @param {string} args.specId
 * @param {number} [args.revision]
 * @param {object} [args.adapter] proposal adapter; defaults to the deterministic phrase adapter
 */
export function proposeWardrobe({ description, text, answers = {}, specId = "furnispec-ai-wardrobe-01", revision = 1, adapter = createDeterministicPhraseAdapter() }) {
  assertProposalOnly(adapter);
  const rawDescription = description ?? text ?? "";
  const interpretation = adapter.interpret(rawDescription);

  let observations = [...interpretation.observations];
  let ambiguities = [...interpretation.ambiguities];
  const answeredKeys = [];

  for (let round = 0; round < MAX_RESOLUTION_ROUNDS; round += 1) {
    const currentGaps = analyseGaps({ observations, ambiguities });
    const answerable = blockingGaps(currentGaps).filter((g) =>
      Object.prototype.hasOwnProperty.call(answers, g.key)
    );
    if (answerable.length === 0) break;

    for (const g of answerable) {
      observations = observations.filter((o) => o.key !== g.key);
      ambiguities = ambiguities.filter((a) => a.key !== g.key);
      observations.push(
        observation(g.key, answers[g.key], OBSERVATION_ORIGIN.CUSTOMER_CONFIRMED, {
          sourceText: `answer to: ${g.key}`,
        })
      );
      answeredKeys.push(g.key);
    }
  }

  const gaps = analyseGaps({ observations, ambiguities });
  const questions = questionsFor(gaps);
  const open = blockingGaps(gaps);
  const outOfSlice = gaps.filter((g) => g.kind === GAP_KIND.OUT_OF_SLICE);

  const base = {
    adapterId: adapter.id,
    adapterKind: adapter.kind,
    interpretation,
    observations,
    gaps,
    questions,
    answeredKeys,
    spec: null,
    derivations: null,
    validation: null,
    proposal: null,
    approval: null,
    approvalValidation: null,
    partGraph: null,
    partGraphValidation: null,
  };

  // An out-of-slice request is refused outright — it is not a question we can ask.
  if (outOfSlice.length > 0) {
    return { ...base, stage: PIPELINE_STAGE.UNSUPPORTED_REQUEST, safety: preApprovalSafety(null) };
  }

  if (open.length > 0) {
    return { ...base, stage: PIPELINE_STAGE.NEEDS_CLARIFICATION, safety: preApprovalSafety(null) };
  }

  const facts = Object.fromEntries(observations.map((o) => [o.key, o.value]));

  let assembled;
  try {
    assembled = assembleFurniSpec({ facts, gaps, specId, revision, status: SPEC_STATUS.PROPOSED });
  } catch (err) {
    if (err instanceof AssemblyBlockedError) {
      return { ...base, stage: PIPELINE_STAGE.NEEDS_CLARIFICATION, safety: preApprovalSafety(null) };
    }
    throw err;
  }

  const validation = validateFurniSpec(assembled.spec);
  if (!validation.valid) {
    return {
      ...base,
      stage: PIPELINE_STAGE.VALIDATION_FAILED,
      spec: assembled.spec,
      derivations: assembled.derivations,
      validation,
      safety: preApprovalSafety(assembled.spec),
    };
  }

  const proposal = createProposal(assembled.spec);

  return {
    ...base,
    stage: PIPELINE_STAGE.READY_FOR_REVIEW,
    spec: assembled.spec, // status PROPOSED
    derivations: assembled.derivations,
    validation,
    proposal,
    safety: preApprovalSafety(assembled.spec),
  };
}

/* ===================================================================== */
/* Stage 2 — approve, then and only then preview                          */
/* ===================================================================== */

/**
 * @param {object} args
 * @param {object|null} args.proposal proposal record from stage 1
 * @param {unknown} args.approval structured human approval
 */
export function approveAndPreview({ proposal, approval }) {
  const approvalValidation = validateApproval({ proposal, approval });

  if (!approvalValidation.valid) {
    return {
      stage: proposal ? PIPELINE_STAGE.READY_FOR_REVIEW : PIPELINE_STAGE.NEEDS_CLARIFICATION,
      proposal: proposal ?? null,
      approval: approval ?? null,
      approvalValidation,
      spec: proposal?.spec ?? null,
      validation: null,
      partGraph: null,
      partGraphValidation: null,
      safety: preApprovalSafety(proposal?.spec ?? null, APPROVAL_STATE.APPROVAL_REJECTED),
    };
  }

  // The approval is valid for exactly this proposal. Promote and re-validate.
  const approvedSpec = { ...proposal.spec, status: SPEC_STATUS.APPROVED };
  const validation = validateFurniSpec(approvedSpec);
  if (!validation.valid) {
    return {
      stage: PIPELINE_STAGE.VALIDATION_FAILED,
      proposal,
      approval,
      approvalValidation,
      spec: approvedSpec,
      validation,
      partGraph: null,
      partGraphValidation: null,
      safety: preApprovalSafety(approvedSpec, APPROVAL_STATE.APPROVAL_REJECTED),
    };
  }

  const partGraph = buildStructuralPartGraph(approvedSpec);
  const partGraphValidation = validatePartGraph(partGraph);

  return {
    stage: PIPELINE_STAGE.APPROVED_FOR_PREVIEW,
    proposal,
    approval,
    approvalValidation,
    approvedFingerprint: approvalValidation.expectedFingerprint,
    spec: approvedSpec,
    validation,
    partGraph,
    partGraphValidation,
    safety: approvedSafety(approvedSpec, partGraph, approval),
  };
}

/**
 * Convenience wrapper: stage 1, then stage 2 when an approval is supplied.
 * With no approval it stops at READY_FOR_REVIEW and returns no geometry.
 */
export function runConversationToWardrobe({ description, answers = {}, specId, revision = 1, approval = null, adapter }) {
  const proposed = proposeWardrobe({ description, answers, specId, revision, ...(adapter ? { adapter } : {}) });
  if (proposed.stage !== PIPELINE_STAGE.READY_FOR_REVIEW || approval === null || approval === undefined) {
    return proposed;
  }
  const previewed = approveAndPreview({ proposal: proposed.proposal, approval });
  return { ...proposed, ...previewed };
}

/* ===================================================================== */
/* Safety read-outs — they report, they decide nothing                    */
/* ===================================================================== */

/** Safety before a valid approval exists. Must not imply approved geometry. */
export function preApprovalSafety(spec, approvalState = APPROVAL_STATE.NOT_APPROVED) {
  return {
    approvalState,
    previewAuthorized: false,
    geometryGenerated: false,
    cncQualified: false,
    specQualificationStatus: spec?.qualificationStatus ?? null,
    partGraphQualificationStatus: null,
    drillingPolicy: spec?.machiningPolicy?.drilling ?? null,
    drillingOperationCount: 0,
    drillingBlocked: spec ? spec.machiningPolicy?.drilling === "BLOCKED_PENDING_HARDWARE_APPROVAL" : true,
    hardwareStatuses: spec ? hardwareStatusesOf(spec) : {},
    approvedOperationTypes: [],
    note: "No geometry exists. Nothing in this report describes approved manufacturing output.",
  };
}

/** Safety after a valid approval, with geometry in hand. */
export function approvedSafety(spec, partGraph, approval) {
  const drillingOperations = (partGraph?.operations ?? []).filter((op) => /DRILL|BORE|HINGE_CUP|PIN_HOLE/i.test(op.type));
  return {
    approvalState: APPROVAL_STATE.APPROVED,
    approvedBy: approval.approvedBy,
    previewAuthorized: true,
    geometryGenerated: true,
    cncQualified: false,
    specQualificationStatus: spec.qualificationStatus,
    partGraphQualificationStatus: partGraph?.qualificationStatus ?? null,
    cncQualificationAsserted:
      spec.qualificationStatus === QUALIFICATION_STATUS.WORKSHOP_REVIEW_NOT_CNC_QUALIFIED &&
      partGraph?.qualificationStatus === QUALIFICATION_STATUS.WORKSHOP_REVIEW_NOT_CNC_QUALIFIED,
    drillingPolicy: spec.machiningPolicy?.drilling ?? null,
    drillingOperationCount: drillingOperations.length,
    drillingBlocked:
      spec.machiningPolicy?.drilling === "BLOCKED_PENDING_HARDWARE_APPROVAL" && drillingOperations.length === 0,
    hardwareStatuses: hardwareStatusesOf(spec),
    approvedOperationTypes: [...new Set((partGraph?.operations ?? []).map((op) => op.type))].sort(),
    note: "Workshop review only. Approval authorises a preview, never a machine.",
  };
}

function hardwareStatusesOf(spec) {
  return Object.fromEntries(Object.entries(spec.hardware ?? {}).map(([k, v]) => [k, v?.status ?? "UNKNOWN"]));
}
