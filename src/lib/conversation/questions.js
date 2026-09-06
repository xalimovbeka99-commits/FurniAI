/**
 * FurniAI — Clarification Question Phrasing (Gate G4 / AI-Alpha)
 * ---------------------------------------------------------------------
 * Maps a typed gap to a furniture-shop question. This layer only PHRASES;
 * it never decides what is missing and never answers anything. Swapping it
 * for an LLM-backed phraser changes the wording and nothing else.
 */

import { BAY_LAYOUT, GAP_KIND } from "./intakeModel.js";

const PHRASING = Object.freeze({
  "envelope.widthMm": "How wide should the wardrobe be, wall to wall, in millimetres?",
  "envelope.heightMm": "What is the finished overall height in millimetres, floor to top?",
  "envelope.depthMm": "How deep should it be in millimetres, including the doors?",
  "plinth.heightMm": "How high should the plinth be in millimetres?",
  bayCount: "How many bays should the wardrobe be divided into?",
  doorCount: "How many hinged doors across the front?",
  finishType: "Which finish: melamine, painted or veneer?",
  bayLayouts: "What goes inside each bay, left to right? Options in this slice: full-height hanging, or short hanging over two adjustable shelves.",
  furnitureScope: "This request falls outside the straight hinged wardrobe we can build today. Shall we proceed with a straight hinged wardrobe instead?",
});

const KIND_PREFIX = Object.freeze({
  [GAP_KIND.AMBIGUOUS_FACT]: "That measurement was approximate, and a cut panel needs an exact one.",
  [GAP_KIND.CONFLICTING_FACT]: "Those two details do not fit together.",
  [GAP_KIND.UNRULED_DERIVATION]: "This needs a decision from the workshop, not a guess.",
  [GAP_KIND.OUT_OF_SLICE]: "That is outside what we can manufacture today.",
});

export const LAYOUT_LABELS = Object.freeze({
  [BAY_LAYOUT.LONG_HANGING]: "full-height hanging with a shelf over the top",
  [BAY_LAYOUT.SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES]: "short hanging over two adjustable shelves, with a shelf over the top",
});

/**
 * @param {object} gapRecord
 * @returns {{key:string, severity:string, kind:string, question:string, why:string, proposal:any, proposalBasis:string|null}}
 */
export function questionFor(gapRecord) {
  const base = PHRASING[gapRecord.key] ?? `Could you confirm ${gapRecord.key}?`;
  const prefix = KIND_PREFIX[gapRecord.kind];
  let question = prefix ? `${prefix} ${base}` : base;

  if (gapRecord.proposal !== null && gapRecord.proposal !== undefined) {
    question += ` We would suggest ${JSON.stringify(gapRecord.proposal)} — can you confirm?`;
  }

  return Object.freeze({
    key: gapRecord.key,
    severity: gapRecord.severity,
    kind: gapRecord.kind,
    question,
    why: gapRecord.detail,
    proposal: gapRecord.proposal ?? null,
    proposalBasis: gapRecord.proposalBasis ?? null,
  });
}

/** Deterministic question list for a deterministic gap list. */
export function questionsFor(gaps) {
  return gaps.map(questionFor);
}
