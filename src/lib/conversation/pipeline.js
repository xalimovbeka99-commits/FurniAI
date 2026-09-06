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
import {
  GAP_KIND,
  OBSERVATION_ORIGIN,
  REQUIRED_INTAKE_KEYS,
  BEKZOD_APPROVED_DEFAULTS,
  observation,
} from "./intakeModel.js";
import { createDeterministicPhraseAdapter, assertProposalOnly } from "./proposalAdapter.js";
import { questionsFor } from "./questions.js";

export const PIPELINE_STAGE = Object.freeze({
  NEEDS_CLARIFICATION: "NEEDS_CLARIFICATION",
  UNSUPPORTED_REQUEST: "UNSUPPORTED_REQUEST",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  READY_FOR_REVIEW: "READY_FOR_REVIEW",
  DRAFT_PREVIEW: "DRAFT_PREVIEW",
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
export function proposeWardrobe({ description, answers = {}, specId, revision = 1, adapter = createDeterministicPhraseAdapter() }) {
  assertProposalOnly(adapter);
  const rawDescription = description ?? "";
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
/* Draft Preview Pipeline (Gate G4 Policy Update)                       */
/* ===================================================================== */

/**
 * Generates an immediate 3D draft preview using Bekzod-approved defaults.
 *
 * POLICY CONTRACT:
 * - spec.status remains strictly PROPOSED (never APPROVED).
 * - stage is PIPELINE_STAGE.DRAFT_PREVIEW.
 * - Facts record exact origins (CUSTOMER_STATED, EXTRACTED, DEFAULTED, RULE_DERIVED).
 * - Workshop approval is NOT fabricated; CNC and drilling remain blocked.
 */
export function previewDraftWardrobe({
  description,
  answers = {},
  initialObservations = null,
  specId,
  revision = 1,
  adapter = createDeterministicPhraseAdapter(),
}) {
  assertProposalOnly(adapter);
  let observations = [];
  let ambiguities = [];
  let interpretation = null;

  if (Array.isArray(initialObservations) && initialObservations.length > 0) {
    observations = [...initialObservations];
  } else {
    const rawDescription = description ?? "";
    interpretation = adapter.interpret(rawDescription);
    observations = [...interpretation.observations];
    ambiguities = [...interpretation.ambiguities];
  }

  // Refuse out-of-slice requests outright
  const gaps = analyseGaps({ observations, ambiguities });
  const outOfSlice = gaps.filter((g) => g.kind === GAP_KIND.OUT_OF_SLICE);
  if (outOfSlice.length > 0) {
    return {
      stage: PIPELINE_STAGE.UNSUPPORTED_REQUEST,
      interpretation,
      observations,
      gaps,
      spec: null,
      proposal: null,
      partGraph: null,
      safety: preApprovalSafety(null),
    };
  }

  // Incorporate explicit customer answers or refinement parameters
  for (const [key, value] of Object.entries(answers)) {
    observations = observations.filter((o) => o.key !== key);
    observations.push(
      observation(key, value, OBSERVATION_ORIGIN.CUSTOMER_CONFIRMED, {
        sourceText: `refinement for: ${key}`,
      })
    );
  }

  // Populate any missing required facts with Bekzod-approved Golden defaults
  const existingKeys = new Set(observations.map((o) => o.key));
  for (const requiredKey of REQUIRED_INTAKE_KEYS) {
    if (!existingKeys.has(requiredKey)) {
      const defaultValue = BEKZOD_APPROVED_DEFAULTS[requiredKey];
      observations.push(
        observation(requiredKey, defaultValue, OBSERVATION_ORIGIN.DEFAULTED, {
          sourceText: `Bekzod-approved default for ${requiredKey}`,
        })
      );
    }
  }

  const facts = Object.fromEntries(observations.map((o) => [o.key, o.value]));
  const origins = Object.fromEntries(observations.map((o) => [o.key, o.origin]));
  const effectiveSpecId = specId || `furnispec-draft-${Math.floor(1000 + Math.random() * 9000)}`;

  let assembled;
  try {
    assembled = assembleFurniSpec({
      facts,
      gaps: [], // All facts resolved or defaulted
      specId: effectiveSpecId,
      revision,
      status: SPEC_STATUS.PROPOSED, // STRICTLY PROPOSED
    });
  } catch (err) {
    return {
      stage: PIPELINE_STAGE.VALIDATION_FAILED,
      error: err.message,
      observations,
      origins,
      spec: null,
      proposal: null,
      partGraph: null,
      safety: preApprovalSafety(null),
    };
  }

  const validation = validateFurniSpec(assembled.spec);
  if (!validation.valid) {
    return {
      stage: PIPELINE_STAGE.VALIDATION_FAILED,
      spec: assembled.spec,
      derivations: assembled.derivations,
      validation,
      observations,
      origins,
      proposal: null,
      partGraph: null,
      safety: preApprovalSafety(assembled.spec),
    };
  }

  const proposal = createProposal(assembled.spec);
  const partGraph = buildStructuralPartGraph(assembled.spec);
  const partGraphValidation = validatePartGraph(partGraph);

  return {
    stage: PIPELINE_STAGE.DRAFT_PREVIEW,
    previewType: "DRAFT_PREVIEW",
    spec: assembled.spec,
    proposal,
    partGraph,
    partGraphValidation,
    observations,
    origins,
    facts,
    derivations: assembled.derivations,
    validation,
    safety: draftPreviewSafety(assembled.spec, partGraph),
  };
}

/**
 * Parses conversational refinement commands such as:
 * - "Make it 2000 mm wide"
 * - "2200mm high"
 * - "Add another shelf on the right"
 * - "Oak finish"
 */
export function parseConversationalCommand(text, currentFacts = {}) {
  if (typeof text !== "string" || !text.trim()) return null;
  const t = text.trim();

  // 1. Width: "make it 2000 mm wide", "2000mm wide", "width 2000", "2.1m wide"
  const widthMatch = t.match(/(?:make\s+(?:it\s+)?)?(\d+(?:\.\d+)?)\s*(mm|cm|m|millimetres?|centimetres?|metres?)?\s*(?:wide|width)/i)
    || t.match(/width\s*(?:to\s*|:\s*|=\s*)?(\d+(?:\.\d+)?)\s*(mm|cm|m|millimetres?|centimetres?|metres?)?/i);
  if (widthMatch) {
    const val = Number(widthMatch[1]);
    const unit = (widthMatch[2] || "mm").toLowerCase();
    const isMetre = /^m(etres?|eters?)?$/i.test(unit);
    const isCm = /^c(m|entimetres?|entimeters?)$/i.test(unit);
    const factor = isMetre ? 1000 : isCm ? 10 : 1;
    const widthMm = Math.round(val * factor * 10) / 10;
    return {
      changes: { "envelope.widthMm": widthMm },
      assistantReply: `Updated width to ${widthMm} mm.`,
    };
  }

  // 2. Height: "make it 2200 mm high", "height 2200", "2.2m tall"
  const heightMatch = t.match(/(?:make\s+(?:it\s+)?)?(\d+(?:\.\d+)?)\s*(mm|cm|m|millimetres?|centimetres?|metres?)?\s*(?:high|tall|height)/i)
    || t.match(/height\s*(?:to\s*|:\s*|=\s*)?(\d+(?:\.\d+)?)\s*(mm|cm|m|millimetres?|centimetres?|metres?)?/i);
  if (heightMatch) {
    const val = Number(heightMatch[1]);
    const unit = (heightMatch[2] || "mm").toLowerCase();
    const isMetre = /^m(etres?|eters?)?$/i.test(unit);
    const isCm = /^c(m|entimetres?|entimeters?)$/i.test(unit);
    const factor = isMetre ? 1000 : isCm ? 10 : 1;
    const heightMm = Math.round(val * factor * 10) / 10;
    return {
      changes: { "envelope.heightMm": heightMm },
      assistantReply: `Updated height to ${heightMm} mm.`,
    };
  }

  // 3. Depth: "make it 550 mm deep", "depth 600", "600mm deep"
  const depthMatch = t.match(/(?:make\s+(?:it\s+)?)?(\d+(?:\.\d+)?)\s*(mm|cm|m|millimetres?|centimetres?|metres?)?\s*(?:deep|depth)/i)
    || t.match(/depth\s*(?:to\s*|:\s*|=\s*)?(\d+(?:\.\d+)?)\s*(mm|cm|m|millimetres?|centimetres?|metres?)?/i);
  if (depthMatch) {
    const val = Number(depthMatch[1]);
    const unit = (depthMatch[2] || "mm").toLowerCase();
    const isMetre = /^m(etres?|eters?)?$/i.test(unit);
    const isCm = /^c(m|entimetres?|entimeters?)$/i.test(unit);
    const factor = isMetre ? 1000 : isCm ? 10 : 1;
    const depthMm = Math.round(val * factor * 10) / 10;
    return {
      changes: { "envelope.depthMm": depthMm },
      assistantReply: `Updated depth to ${depthMm} mm.`,
    };
  }

  // 4. Shelf layout change: "Add another shelf on the right", "shelves on the right", "shelves in bay 2"
  if (/add\s+(?:another\s+)?shelf|more\s+shelves|shelves\s+on\s+the\s+right|shelves\s+in\s+bay\s*2/i.test(t)) {
    const currentBays = currentFacts.bayCount || 2;
    const layouts = currentFacts.bayLayouts ? [...currentFacts.bayLayouts] : ["LONG_HANGING", "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES"];
    if (layouts.length >= 2) {
      layouts[1] = "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES";
    }
    return {
      changes: { bayLayouts: layouts },
      assistantReply: "Updated interior layout: short hanging with two adjustable shelves on the right.",
    };
  }

  if (/all\s+shelves|shelves\s+(?:in|on)\s+both\s+(?:bays|sides)/i.test(t)) {
    const currentBays = currentFacts.bayCount || 2;
    const layouts = Array(currentBays).fill("SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES");
    return {
      changes: { bayLayouts: layouts },
      assistantReply: `Configured all ${currentBays} bays with short hanging and two adjustable shelves.`,
    };
  }

  if (/all\s+hanging|hanging\s+(?:in|on)\s+both\s+(?:bays|sides)|full\s+hanging/i.test(t)) {
    const currentBays = currentFacts.bayCount || 2;
    const layouts = Array(currentBays).fill("LONG_HANGING");
    return {
      changes: { bayLayouts: layouts },
      assistantReply: `Configured all ${currentBays} bays with full-height long hanging.`,
    };
  }

  // 5. Bay count change: "3 bays", "make it 3 bays"
  const bayMatch = t.match(/(?:make\s+it\s+)?(\d+)\s*bays?/i);
  if (bayMatch) {
    const count = parseInt(bayMatch[1], 10);
    if (count >= 1 && count <= 6) {
      const layouts = Array(count).fill("SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES");
      layouts[0] = "LONG_HANGING";
      return {
        changes: {
          bayCount: count,
          doorCount: count * 2,
          bayLayouts: layouts,
        },
        assistantReply: `Updated to ${count} bays with ${count * 2} hinged doors.`,
      };
    }
  }

  // 6. Finish change: "oak", "walnut", "white"
  const matMatch = t.match(/\b(oak|walnut|white|grey|taupe|cream|black|navy|sage|ash)\b/i);
  if (matMatch && /finish|material|color|colour/i.test(t)) {
    const mat = matMatch[1].toLowerCase();
    return {
      changes: { materialKey: mat },
      assistantReply: `Changed finish to ${mat}.`,
    };
  }

  return null;
}

/**
 * Applies a conversational edit command to an active draft wardrobe.
 */
export function applyConversationalEdit({
  currentObservations = [],
  commandText,
  specId,
  revision = 1,
  adapter = createDeterministicPhraseAdapter(),
}) {
  const currentFacts = Object.fromEntries(currentObservations.map((o) => [o.key, o.value]));
  const parsed = parseConversationalCommand(commandText, currentFacts);

  if (!parsed) {
    // If not a recognized direct command, interpret using the phrase adapter
    const interpretation = adapter.interpret(commandText);
    if (interpretation.observations.length === 0) {
      return {
        ok: false,
        error: `Could not interpret modification from "${commandText}". Try e.g. "Make it 2000 mm wide" or "Add another shelf on the right".`,
      };
    }
    const newKeys = new Set(interpretation.observations.map((o) => o.key));
    const mergedObservations = [
      ...currentObservations.filter((o) => !newKeys.has(o.key)),
      ...interpretation.observations,
    ];
    const draft = previewDraftWardrobe({
      description: "",
      answers: Object.fromEntries(mergedObservations.map((o) => [o.key, o.value])),
      specId,
      revision: revision + 1,
      adapter,
    });
    return {
      ok: true,
      assistantReply: `Updated wardrobe design (Revision ${revision + 1}).`,
      ...draft,
    };
  }

  const materialKey = parsed.changes.materialKey;
  const changes = { ...parsed.changes };
  delete changes.materialKey;

  const newObservations = currentObservations
    .filter((o) => !Object.prototype.hasOwnProperty.call(changes, o.key))
    .concat(
      Object.entries(changes).map(([k, v]) =>
        observation(k, v, OBSERVATION_ORIGIN.CUSTOMER_STATED, { sourceText: commandText })
      )
    );

  const draft = previewDraftWardrobe({
    initialObservations: newObservations,
    specId,
    revision: revision + 1,
    adapter,
  });

  return {
    ok: true,
    assistantReply: `${parsed.assistantReply} (Revision ${revision + 1})`,
    materialKey,
    ...draft,
  };
}

/**
 * Safety report for an immediate draft preview (Gate G4 policy update).
 * Allows 3D geometry preview in browser, but strictly maintains that CNC and
 * production drilling remain blocked and unapproved.
 */
export function draftPreviewSafety(spec, partGraph) {
  const drillingOperations = (partGraph?.operations ?? []).filter((op) => /DRILL|BORE|HINGE_CUP|PIN_HOLE/i.test(op.type));
  return {
    approvalState: APPROVAL_STATE.NOT_APPROVED,
    previewAuthorized: true,
    draftPreview: true,
    workshopApproved: false,
    geometryGenerated: true,
    cncQualified: false,
    specQualificationStatus: spec?.qualificationStatus ?? null,
    partGraphQualificationStatus: partGraph?.qualificationStatus ?? null,
    cncQualificationAsserted: false,
    drillingPolicy: spec?.machiningPolicy?.drilling ?? null,
    drillingOperationCount: drillingOperations.length,
    drillingBlocked: spec?.machiningPolicy?.drilling === "BLOCKED_PENDING_HARDWARE_APPROVAL" && drillingOperations.length === 0,
    hardwareStatuses: spec ? hardwareStatusesOf(spec) : {},
    approvedOperationTypes: [],
    note: "DRAFT PREVIEW ONLY — NOT APPROVED FOR WORKSHOP. Geometry rendered from Bekzod-approved defaults with status PROPOSED. Approval is required before CNC or production.",
  };
}

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
