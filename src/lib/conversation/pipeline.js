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
import {
  COMPONENT_OUTCOME,
  unsupportedComponentsForCustomer,
} from "../partgraph/componentOutcomes.js";
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
import { detectUnsupportedComponentRequest } from "./componentRequests.js";

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

  // An approval cannot make an unrepresentable component representable. If the
  // approved spec asks for something the kernel cannot build, this is refused
  // at the strictest boundary in the system rather than previewed.
  const unrepresentable = unrepresentableComponents(partGraph);
  if (unrepresentable) {
    return {
      stage: PIPELINE_STAGE.UNSUPPORTED_REQUEST,
      proposal,
      approval,
      approvalValidation,
      spec: null,
      validation,
      partGraph: null,
      partGraphValidation: null,
      unsupported: unrepresentable.unsupported,
      error: unrepresentable.customerMessage,
      safety: preApprovalSafety(null, APPROVAL_STATE.APPROVAL_REJECTED),
    };
  }

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
/**
 * The line between "we recorded that we could not build this" and "we built it".
 *
 * The component ledger makes an unrepresentable component VISIBLE in the
 * PartGraph. That is a diagnostic, not a fulfilment — and the two must never
 * be confused. A PartGraph whose ledger contains an UNSUPPORTED outcome is a
 * record of a request the kernel could not honour; returning it to a customer
 * as their new design would mean quietly shipping a wardrobe missing the part
 * they asked for, with the explanation buried in a field nobody reads.
 *
 * So every pipeline path that turns a spec into a customer-visible design runs
 * this first. If anything is unrepresentable the design is NOT replaced, the
 * revision is NOT advanced, and no suggested alternative is applied — the
 * caller gets the explanation and keeps the design they already had.
 *
 * @param {object} partGraph
 * @returns {{ unsupported: Array<object>, customerMessage: string } | null}
 *          null when every component was represented.
 */
export function unrepresentableComponents(partGraph) {
  const outcomes = partGraph?.componentOutcomes ?? [];
  const blocked = outcomes.filter((e) => e.outcome === COMPONENT_OUTCOME.UNSUPPORTED);
  if (blocked.length === 0) return null;

  const unsupported = unsupportedComponentsForCustomer(outcomes);
  // One sentence per refused component, in the customer's language, plus the
  // alternative as an OFFER. Nothing here applies anything.
  const customerMessage = unsupported
    .map((u) => (u.alternative ? `${u.reason} If you'd like, I can use ${u.alternative}.` : u.reason))
    .join(" ");

  return { unsupported, customerMessage };
}

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

  // A draft that silently omits something the customer asked for is not a
  // draft of their request. Refuse with the explanation instead of showing a
  // wardrobe that quietly lost a part.
  const unrepresentable = unrepresentableComponents(partGraph);
  if (unrepresentable) {
    return {
      stage: PIPELINE_STAGE.UNSUPPORTED_REQUEST,
      interpretation,
      observations,
      gaps,
      spec: null,
      proposal: null,
      partGraph: null,
      partGraphValidation: null,
      unsupported: unrepresentable.unsupported,
      error: unrepresentable.customerMessage,
      safety: preApprovalSafety(null),
    };
  }

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

  // 0. A request for something the engine cannot build is answered here,
  // before any branch tries to interpret it as a dimension or a layout.
  // Unmodelled hardware (handles, locks, mirrors, …) still refuses here.
  // DRAWER_BANK is STRUCTURAL now — "Add drawers" is handled below as a
  // supported bay-layout change, not as an unsupported refusal.
  //
  // The refusal carries structured `unsupported` entries, which the transport
  // maps to RESULT_KIND.UNSUPPORTED so the browser shows the reason and the
  // offered alternative. Nothing is applied.
  const unsupportedRequest = detectUnsupportedComponentRequest(t);
  if (unsupportedRequest) {
    return {
      error: unsupportedRequest.error,
      unsupported: unsupportedRequest.unsupported,
    };
  }

  // 0b. Add drawers → DRAWER_BANK_WITH_SHORT_HANGING bay layout (STRUCTURAL
  // DRAWER_* emission). Replaces low adjustable shelves in that bay so the
  // drawer pack does not collide with them (PartGraph fail-closed).
  const DRAWER_INTENT = new RegExp(
    [
      "\\b(?:add|put|fit|install|include|want|need|like|have|give|get)\\b[\\s\\S]{0,48}\\bdrawers?\\b",
      "\\b(?:\\d+|two|three|four|five|six)\\s+(?:[a-z-]+\\s+){0,2}?drawers?\\b",
      "\\bdrawer\\s+bank\\b",
      "\\bchest\\s+of\\s+drawers\\b",
    ].join("|"),
    "i"
  );
  const DRAWER_NEGATION = /\b(no|not|n't|never|without|don't|dont|do\s+not)\b/i;
  if (DRAWER_INTENT.test(t) && !DRAWER_NEGATION.test(t)) {
    const currentBays = currentFacts.bayCount || 2;
    const layouts = currentFacts.bayLayouts
      ? [...currentFacts.bayLayouts]
      : ["LONG_HANGING", "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES"];
    while (layouts.length < currentBays) {
      layouts.push("SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES");
    }

    const isLeft = /\b(?:left|bay\s*1)\b/i.test(t);
    const isRight = /\b(?:right|bay\s*2)\b/i.test(t);
    let targetBayIdx;
    if (isLeft) targetBayIdx = 0;
    else if (isRight) targetBayIdx = 1;
    else {
      // Prefer a bay that does not already have drawers.
      targetBayIdx = layouts.findIndex((l) => l !== "DRAWER_BANK_WITH_SHORT_HANGING");
      if (targetBayIdx === -1) targetBayIdx = 0;
    }

    if (targetBayIdx >= currentBays) {
      return {
        error: `Cannot modify bay ${targetBayIdx + 1} because this wardrobe only has ${currentBays} bay${currentBays > 1 ? "s" : ""}.`,
      };
    }

    const baySide = targetBayIdx === 0 ? "left" : targetBayIdx === 1 ? "right" : `bay ${targetBayIdx + 1}`;
    if (layouts[targetBayIdx] === "DRAWER_BANK_WITH_SHORT_HANGING") {
      return {
        error: `The ${baySide} bay already has a drawer bank with short hanging above.`,
      };
    }

    layouts[targetBayIdx] = "DRAWER_BANK_WITH_SHORT_HANGING";
    return {
      changes: { bayLayouts: layouts },
      assistantReply: `Added a drawer bank to the ${baySide} bay (with short hanging above).`,
    };
  }

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

  // Helper to detect explicit command requesting two shelves or short hanging on a bay
  const isExplicitTwoShelvesSwitch = (text) => {
    if (/\b(?:all\s+shelves|shelves\s+(?:in|on)\s+both)\b/i.test(text)) return false;
    const patterns = [
      /\b(?:switch|change|convert|set|configure|use)\s+(?:the\s+)?(?:left|right|bay\s*[12])\s+(?:bay\s+)?(?:to\s+)?(?:short\s+hanging(?:\s+with)?\s+)?(?:two|2)\s+shelves\b/i,
      /\b(?:switch|change|convert|set|configure|use)\s+(?:short\s+hanging(?:\s+with)?\s+)?(?:two|2)\s+shelves\s+(?:on|in)\s+(?:the\s+)?(?:left|right|bay\s*[12])\b/i,
      /\b(?:two|2)\s+shelves\s+(?:on|in)\s+(?:the\s+)?(?:left|right|bay\s*[12])\b/i,
      /\b(?:short\s+hanging(?:\s+with)?\s+(?:two|2)\s+shelves)\s+(?:on|in)\s+(?:the\s+)?(?:left|right|bay\s*[12])\b/i,
      /\b(?:switch|change|convert|set|configure)\s+(?:the\s+)?(?:left|right|bay\s*[12])\s+(?:bay\s+)?to\s+(?:shelves|short\s+hanging)\b/i,
      /\b(?:yes[,\s]+)?(?:switch|change|use)\s+(?:the\s+)?(?:left|right)\s+(?:bay\s+)?(?:to\s+)?(?:two|2)\s+shelves\b/i,
    ];
    return patterns.some((p) => p.test(text));
  };

  // 4a. Explicit two-shelf layout switch
  // When the user explicitly requests short hanging with two shelves on a bay:
  if (isExplicitTwoShelvesSwitch(t)) {
    const currentBays = currentFacts.bayCount || 2;
    const layouts = currentFacts.bayLayouts ? [...currentFacts.bayLayouts] : ["LONG_HANGING", "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES"];
    const isLeft = /\b(?:left|bay\s*1)\b/i.test(t);
    const isRight = /\b(?:right|bay\s*2)\b/i.test(t);
    const targetBayIdx = isLeft ? 0 : (isRight ? 1 : 0);
    const baySide = targetBayIdx === 0 ? "left" : "right";

    if (targetBayIdx >= currentBays) {
      return {
        error: `Cannot modify bay ${targetBayIdx + 1} because this wardrobe only has ${currentBays} bay${currentBays > 1 ? "s" : ""}.`,
      };
    }

    if (layouts[targetBayIdx] === "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES") {
      return {
        error: `The ${baySide} bay is already configured as short hanging with two adjustable shelves.`,
      };
    }

    layouts[targetBayIdx] = "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES";
    return {
      changes: { bayLayouts: layouts },
      assistantReply: `Configured the ${baySide} bay as short hanging with two adjustable shelves.`,
    };
  }

  // 4b. Conversational shelf additions & limits
  // Requirements:
  // "“Add another shelf on the left” must not automatically replace long hanging with short hanging and two shelves.
  // Either add exactly one shelf through supported parameters, preserving unrelated choices,
  // or offer the two-shelf layout as an explicit alternative before applying it.
  // Do not report an unchanged layout as an added shelf."
  // The bare word "shelves" used to enter this branch on its own, so "make the
  // shelves oak" — a finish request — was answered with a shelving-layout
  // refusal. A confident answer to a question nobody asked. Entry now requires
  // an intent about shelf quantity or layout; a sentence that merely mentions
  // shelves falls through to the branches that actually match it.
  const SHELF_INTENT = new RegExp(
    [
      "\\badd\\s+(?:another\\s+|more\\s+|a\\s+|an\\s+|\\d+\\s+|two\\s+|three\\s+)?shelv(?:es|ing)?\\b",
      "\\badd\\s+(?:another\\s+|more\\s+)?shelf\\b",
      "\\bmore\\s+shelves\\b",
      "\\ball\\s+shelves\\b",
      "\\b(?:use|switch|change|configure|want|need|with|give)\\b[^.]*\\bshelv(?:es|ing)\\b",
      "\\b(?:\\d+|one|two|three|four)\\s+shelves\\b",
      "\\bshelves\\s+(?:in|on)\\s+both\\b",
    ].join("|"),
    "i"
  );
  if (SHELF_INTENT.test(t)) {
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
      // If neither side specified, find the first bay that has long hanging
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
      // Do NOT automatically replace long hanging with short hanging and two shelves.
      // Offer the two-shelf layout as an explicit alternative before applying it.
      return {
        error: `Adding a single shelf to full-height long hanging is not supported in this manufacturing slice. The supported shelving layout is short hanging with two adjustable shelves. To use this layout, reply 'switch ${baySide} bay to short hanging with two shelves' or 'use two shelves on the ${baySide}'.`,
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

  // 7. Finish change.
  //
  // Two things are separated here, because conflating them is how a customer
  // ends up with a whole wardrobe repainted when they asked about one door.
  //
  //   "Make it walnut"            → change the wardrobe finish.
  //   "Make the doors walnut"     → a per-part finish, which is NOT supported.
  //                                 Say so; do not apply it to everything.
  //
  // Widening matters for a second reason: every phrasing the parser misses
  // spends a model call on a trivial edit, and the model is slower, costlier
  // and less predictable than this branch.
  const FINISH_WORDS = "oak|walnut|white|grey|taupe|cream|black|navy|sage|ash";

  /** Parts a customer might name; a finish scoped to one of these is not supported. */
  const SCOPED_PART = /\b(door|doors|handle|handles|shelf|shelves|drawer|drawers|rail|rails|interior|inside|back|plinth|trim|edge|edges|frame|top|side|sides)\b/i;

  const matMatch = t.match(new RegExp(`\\b(${FINISH_WORDS})\\b`, "i"));
  if (matMatch) {
    const mat = matMatch[1].toLowerCase();
    const beforeColour = t.slice(0, matMatch.index);
    const afterColour = t.slice(matMatch.index + matMatch[1].length);

    // A noun straight after the colour ("black handles") means the colour
    // describes that thing, not the wardrobe.
    const scopedAfter = SCOPED_PART.test(afterColour);
    // A part named before the colour ("make the doors walnut") scopes it too.
    const scopedBefore = SCOPED_PART.test(beforeColour);

    if (scopedAfter || scopedBefore) {
      const named = (afterColour.match(SCOPED_PART) || beforeColour.match(SCOPED_PART))[1].toLowerCase();

      // "Add black handles" is a request for handles, not for a black
      // wardrobe. Answering it as a finish problem would be a confident,
      // fluent, wrong answer — worse than admitting the real limitation.
      if (/\b(add|fit|install|include|put|attach|give\s+it)\b/i.test(beforeColour)) {
        return {
          error:
            `I can't add ${named} to the design yet. Your wardrobe is unchanged — ` +
            `you can still change its size, layout or finish.`,
        };
      }

      return {
        error:
          `I can only change the finish of the whole wardrobe at the moment, not just the ${named}. ` +
          `Your design is unchanged — say "make it ${mat}" if you'd like the whole wardrobe in ${mat}.`,
      };
    }

    // An explicit finish word, or the colour standing as the whole point of
    // the sentence ("make it walnut", "in oak", "walnut please").
    const explicitFinishWord = /finish|material|colour|color|paint/i.test(t);
    const colourIsTheRequest =
      /(?:make|paint|change|switch|turn|do|have|want|like|use|try|in|to)\b[^.]*$/i.test(beforeColour) &&
      /^[\s,.!?]*(please|thanks|thank you)?[\s,.!?]*$/i.test(afterColour);

    if (explicitFinishWord || colourIsTheRequest) {
      return {
        changes: { materialKey: mat },
        assistantReply: `Changed finish to ${mat}.`,
      };
    }
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
    // A parse-time capability limit carries the same structured shape as a
    // kernel-time one, so the browser and the transport handle both the same
    // way and neither can lose the explanation. `kind` (adopted from Grok's
    // PR #4) lets a caller branch without re-deriving the reason from the
    // array — asserted by src/lib/adapters/unsupportedCustomerEntry.test.js.
    const parsedUnsupported = Array.isArray(parsed.unsupported) ? parsed.unsupported : [];
    return {
      ok: false,
      kind: parsedUnsupported.length > 0 ? "UNSUPPORTED" : "REJECTED",
      error: parsed.error,
      ...(parsedUnsupported.length > 0 ? { unsupported: parsedUnsupported } : {}),
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
        // Carry the structured refusal so the browser can show the reason and
        // the offered alternative, rather than a generic failure string.
        ...(draft.unsupported ? { unsupported: draft.unsupported } : {}),
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
      // Carry the structured refusal so the browser can show the reason and
      // the offered alternative, rather than a generic failure string.
      ...(draft.unsupported ? { unsupported: draft.unsupported } : {}),
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
