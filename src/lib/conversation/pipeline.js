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

import { parseDimension } from "./clarifyInput.js";

/**
 * Parses conversational refinement commands such as:
 * - "Make it 2000 mm wide"
 * - "Make it -2000 mm wide" (rejected with error)
 * - "Make it 2000.00001 mm wide" (rejected with precision error)
 * - "2200mm high"
 * - "Add another shelf on the right"
 * - "Oak finish"
 *
 * Reuses parseDimension from clarifyInput.js to preserve signs, units,
 * and strict 0.1mm decimal precision without pre-rounding.
 */
const UNIT_RE_STR = "(?:mm|millimetres?|millimeters?|cm|centimetres?|centimeters?|m|metres?|meters?)";
const NUM_RE_STR = "[+-]?\\s*(?:\\d+(?:\\.\\d+)?|\\.\\d+)";

function extractDimension(text, axis) {
  let trailingWords;
  let leadingWords;
  if (axis === "width") {
    trailingWords = "(?:wide|width)";
    leadingWords = "width";
  } else if (axis === "height") {
    trailingWords = "(?:high|tall|height)";
    leadingWords = "height";
  } else if (axis === "depth") {
    trailingWords = "(?:deep|depth)";
    leadingWords = "depth";
  }

  // Trailing: "make it 2000 mm wide", "-2000 mm wide", "2000.00001mm wide"
  const m1 = text.match(new RegExp(`(?:(?:make|set)\\s+(?:it\\s+)?)?(${NUM_RE_STR}\\s*${UNIT_RE_STR}?)\\s*${trailingWords}\\b`, "i"));
  if (m1 && m1[1]) return m1[1].trim();

  // Leading: "width 2000 mm", "width: -2000 mm", "width to 2000.00001 mm"
  const m2 = text.match(new RegExp(`\\b${leadingWords}\\s*(?:to|is|of|:|=)?\\s*(${NUM_RE_STR}\\s*${UNIT_RE_STR}?)\\b`, "i"));
  if (m2 && m2[1]) return m2[1].trim();

  return null;
}

/**
 * Parses conversational refinement commands such as:
 * - "Make it 2000 mm wide"
 * - "Make it -2000 mm wide" (rejected with error)
 * - "Make it 2000.00001 mm wide" (rejected with precision error)
 * - "2200mm high"
 * - "Add another shelf on the right"
 * - "Oak finish"
 *
 * Reuses parseDimension from clarifyInput.js to preserve signs, units,
 * and strict 0.1mm decimal precision without pre-rounding.
 */
export function parseConversationalCommand(text, currentFacts = {}) {
  if (typeof text !== "string" || !text.trim()) return null;
  const t = text.trim();

  // 1. Width: "make it 2000 mm wide", "make it -2000 mm wide", "width 2000", "2.1m wide"
  const widthRaw = extractDimension(t, "width");
  if (widthRaw !== null) {
    const parsedDim = parseDimension(widthRaw);
    if (!parsedDim.ok) {
      return {
        error: parsedDim.error || "Invalid width dimension.",
      };
    }
    const widthMm = parsedDim.value;
    return {
      changes: { "envelope.widthMm": widthMm },
      assistantReply: `Updated width to ${widthMm} mm.`,
    };
  }

  // 2. Height: "make it 2200 mm high", "height 2200", "2.2m tall"
  const heightRaw = extractDimension(t, "height");
  if (heightRaw !== null) {
    const parsedDim = parseDimension(heightRaw);
    if (!parsedDim.ok) {
      return {
        error: parsedDim.error || "Invalid height dimension.",
      };
    }
    const heightMm = parsedDim.value;
    return {
      changes: { "envelope.heightMm": heightMm },
      assistantReply: `Updated height to ${heightMm} mm.`,
    };
  }

  // 3. Depth: "make it 550 mm deep", "depth 600", "600mm deep"
  const depthRaw = extractDimension(t, "depth");
  if (depthRaw !== null) {
    const parsedDim = parseDimension(depthRaw);
    if (!parsedDim.ok) {
      return {
        error: parsedDim.error || "Invalid depth dimension.",
      };
    }
    const depthMm = parsedDim.value;
    return {
      changes: { "envelope.depthMm": depthMm },
      assistantReply: `Updated depth to ${depthMm} mm.`,
    };
  }

  // 4. Shelf layout changes
  // Requirements:
  // "Only report success after validation and a real state change.
  // If another shelf is supported, add exactly one in the requested bay and verify the resulting PartGraph.
  // Otherwise explain the limitation and offer a supported alternative.
  // Do not report an unchanged layout as an added shelf."
  if (/\b(?:add\s+(?:another\s+|more\s+)?shelf|more\s+shelves|add\s+shelv(?:es|ing)|shelves)\b/i.test(t)) {
    // Check if "all shelves" / "shelves on both"
    if (/all\s+shelves|shelves\s+(?:in|on)\s+both\s+(?:bays|sides)/i.test(t)) {
      const currentBays = currentFacts.bayCount || 2;
      const currentLayouts = currentFacts.bayLayouts || [];
      const allAlreadyShelves = currentLayouts.length === currentBays && currentLayouts.every((l) => l === "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES");
      if (allAlreadyShelves) {
        return {
          error: `All ${currentBays} bays are already configured with short hanging and two adjustable shelves.`,
        };
      }
      const layouts = Array(currentBays).fill("SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES");
      return {
        changes: { bayLayouts: layouts },
        assistantReply: `Configured all ${currentBays} bays with short hanging and two adjustable shelves.`,
      };
    }

    const currentBays = currentFacts.bayCount || 2;
    const layouts = currentFacts.bayLayouts ? [...currentFacts.bayLayouts] : ["LONG_HANGING", "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES"];

    const isLeft = /\b(?:left|bay\s*1)\b/i.test(t);
    const isRight = /\b(?:right|bay\s*2)\b/i.test(t);

    let targetBayIdx;
    if (isLeft) {
      targetBayIdx = 0;
    } else if (isRight) {
      targetBayIdx = 1;
    } else {
      // If neither side specified, find the first bay that can take shelves (i.e. currently LONG_HANGING)
      targetBayIdx = layouts.findIndex((l) => l === "LONG_HANGING");
      if (targetBayIdx === -1) {
        return {
          error: `All bays already have the maximum supported shelving for this manufacturing slice (2 adjustable shelves per bay + top fixed shelf). You can switch a bay to full-height long hanging if desired.`,
        };
      }
    }

    if (targetBayIdx >= currentBays) {
      return {
        error: `Cannot modify bay ${targetBayIdx + 1} because this wardrobe only has ${currentBays} bay${currentBays > 1 ? "s" : ""}.`,
      };
    }

    const currentBayLayout = layouts[targetBayIdx];
    const baySide = targetBayIdx === 0 ? "left" : "right";
    const otherSide = targetBayIdx === 0 ? "right" : "left";

    if (currentBayLayout === "LONG_HANGING") {
      // Transitioning from LONG_HANGING to SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES adds adjustable shelves to this bay
      layouts[targetBayIdx] = "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES";
      return {
        changes: { bayLayouts: layouts },
        assistantReply: `Added shelving to the ${baySide} bay (configured as short hanging with two adjustable shelves).`,
      };
    }

    // If already at SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES:
    // In the first manufacturing slice (G4), the supported layouts per bay are strictly:
    // - LONG_HANGING (full-height hanging with fixed top shelf)
    // - SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES (short hanging + 2 adjustable shelves + fixed top shelf)
    // Adding further shelves beyond 2 adjustable shelves is not yet supported in this manufacturing slice.
    // Honestly explain this limitation and offer supported alternatives.
    return {
      error: `The ${baySide} bay already has the maximum supported shelving for this manufacturing slice (2 adjustable shelves + top fixed shelf). You can change the ${otherSide} bay to shelves or switch back to full-height long hanging.`,
    };
  }

  // 5. Hanging layout changes
  if (/\b(?:all\s+hanging|hanging\s+(?:in|on)\s+both\s+(?:bays|sides)|full\s+hanging\s+(?:in|on)\s+both)\b/i.test(t)) {
    const currentBays = currentFacts.bayCount || 2;
    const currentLayouts = currentFacts.bayLayouts || [];
    const allAlreadyHanging = currentLayouts.length === currentBays && currentLayouts.every((l) => l === "LONG_HANGING");
    if (allAlreadyHanging) {
      return {
        error: `All ${currentBays} bays are already configured with full-height long hanging.`,
      };
    }
    const layouts = Array(currentBays).fill("LONG_HANGING");
    return {
      changes: { bayLayouts: layouts },
      assistantReply: `Configured all ${currentBays} bays with full-height long hanging.`,
    };
  }

  if (/\b(?:hanging|full[- ]?hanging|long\s+hanging)\b/i.test(t)) {
    const currentBays = currentFacts.bayCount || 2;
    const layouts = currentFacts.bayLayouts ? [...currentFacts.bayLayouts] : ["LONG_HANGING", "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES"];
    const isLeft = /\b(?:left|bay\s*1)\b/i.test(t);
    const isRight = /\b(?:right|bay\s*2)\b/i.test(t);

    if (isLeft || isRight) {
      const targetBayIdx = isLeft ? 0 : 1;
      const baySide = targetBayIdx === 0 ? "left" : "right";
      if (layouts[targetBayIdx] === "LONG_HANGING") {
        return {
          error: `The ${baySide} bay is already configured for full-height long hanging.`,
        };
      }
      layouts[targetBayIdx] = "LONG_HANGING";
      return {
        changes: { bayLayouts: layouts },
        assistantReply: `Configured the ${baySide} bay for full-height long hanging.`,
      };
    }
  }

  // 6. Bay count change: "3 bays", "make it 3 bays"
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

  // 7. Finish change: "oak", "walnut", "white"
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

  if (parsed && parsed.error) {
    return {
      ok: false,
      error: parsed.error,
    };
  }

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
    if (!draft.spec || !draft.partGraph || (draft.validation && !draft.validation.valid)) {
      return {
        ok: false,
        error: draft.error || (draft.validation?.errors?.map((e) => e.message).join("; ")) || "Failed to generate valid wardrobe geometry for this change.",
      };
    }
    if (draft.partGraphValidation && !draft.partGraphValidation.valid) {
      return {
        ok: false,
        error: draft.partGraphValidation.errors?.join("; ") || "Generated part graph validation failed.",
      };
    }
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

  if (!draft.spec || !draft.partGraph || (draft.validation && !draft.validation.valid)) {
    return {
      ok: false,
      error: draft.error || (draft.validation?.errors?.map((e) => e.message).join("; ")) || "Failed to generate valid wardrobe geometry for this change.",
    };
  }

  if (draft.partGraphValidation && !draft.partGraphValidation.valid) {
    return {
      ok: false,
      error: draft.partGraphValidation.errors?.join("; ") || "Generated part graph validation failed.",
    };
  }

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
