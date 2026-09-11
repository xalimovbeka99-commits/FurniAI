/**
 * Customer requests for components the design engine cannot build.
 *
 * WHY THIS IS DETERMINISTIC
 *
 * "Add drawers" is the single most likely unsupported request a wardrobe
 * customer will type, and until now it matched no parser branch at all. It
 * fell through to the model, which either proposed an edit the kernel then
 * rejected with a generic validation message, or — when no provider was
 * reachable — produced "the designer is not available right now". In neither
 * case did the customer learn the actual answer: drawers are not supported
 * yet. A capability limit was being reported as a transient failure.
 *
 * Recognising these requests here means the answer never depends on a model
 * being reachable, and never costs a model call.
 *
 * WHY THE WORDING COMES FROM THE POLICY
 *
 * For anything FurniSpec knows as a component type, the explanation and the
 * offered alternative are read from `COMPONENT_REPRESENTATION_POLICY` — the
 * same source the kernel's own ledger uses. One wording, one place. If the
 * policy changes because a component becomes supported, this changes with it
 * rather than drifting into a stale apology.
 */
import { COMPONENT_TYPES } from "../furnispec/schema.js";
import {
  COMPONENT_DIAGNOSTIC_CODE,
  COMPONENT_OUTCOME,
  COMPONENT_REPRESENTATION_POLICY,
} from "../partgraph/componentOutcomes.js";

/** Wanting one of these is a request, not an aside. */
const REQUEST_INTENT = /\b(add|put|fit|install|include|want|need|like|give|have|can\s+(?:i|we|you)|could\s+(?:i|we|you)|with)\b/i;

/**
 * Customer words → the FurniSpec component type they mean. Only types the
 * policy marks UNSUPPORTED are refused here; anything supported falls through
 * to the branches that can actually apply it.
 */
const COMPONENT_WORDS = Object.freeze([
  { pattern: /\b(drawers?|drawer\s+bank|chest\s+of\s+drawers)\b/i, componentType: COMPONENT_TYPES.DRAWER_BANK, customerWord: "drawers" },
]);

/**
 * Things a customer asks for that FurniSpec has no component type for at all.
 * These are hardware or finishing items, not cut parts, and each needs its own
 * honest sentence — there is no policy entry to read one from.
 */
const UNMODELLED_WORDS = Object.freeze([
  { pattern: /\b(handles?|knobs?|pulls?)\b/i, customerWord: "handles" },
  { pattern: /\b(mirrors?|mirrored)\b/i, customerWord: "a mirror" },
  { pattern: /\b(lights?|lighting|led\s+strip|leds?)\b/i, customerWord: "lighting" },
  { pattern: /\b(locks?|lockable)\b/i, customerWord: "a lock" },
  { pattern: /\b(shoe\s+racks?|tie\s+racks?|trouser\s+racks?|baskets?)\b/i, customerWord: "racks and baskets" },
  { pattern: /\b(soft[-\s]?close|push[-\s]?to[-\s]?open)\b/i, customerWord: "soft-close hardware" },
]);

/**
 * @param {string} text the customer's message
 * @returns {{ unsupported: Array<object>, error: string } | null}
 *          null when the message asks for nothing unsupported.
 */
export function detectUnsupportedComponentRequest(text) {
  if (typeof text !== "string" || !REQUEST_INTENT.test(text)) return null;

  const unsupported = [];

  for (const { pattern, componentType, customerWord } of COMPONENT_WORDS) {
    if (!pattern.test(text)) continue;
    const policy = COMPONENT_REPRESENTATION_POLICY[componentType];
    // A type the policy considers buildable is not this module's business.
    if (!policy || policy.outcome !== COMPONENT_OUTCOME.UNSUPPORTED) continue;

    unsupported.push({
      request: customerWord,
      componentType,
      code: policy.diagnosticCode ?? COMPONENT_DIAGNOSTIC_CODE.COMPONENT_NOT_REPRESENTED,
      reason: policy.customerMessage,
      engineeringReason: policy.reason,
      alternative: policy.suggestedAlternative ? policy.suggestedAlternative.summary : null,
      alternativeApplied: false,
    });
  }

  for (const { pattern, customerWord } of UNMODELLED_WORDS) {
    if (!pattern.test(text)) continue;
    unsupported.push({
      request: customerWord,
      componentType: null,
      code: COMPONENT_DIAGNOSTIC_CODE.COMPONENT_NOT_REPRESENTED,
      reason: `I can't add ${customerWord} to the design yet. Your wardrobe is unchanged.`,
      engineeringReason:
        `"${customerWord}" has no representation in FurniSpec v0.1 — it is neither a cut part nor an approved hardware item.`,
      alternative: null,
      alternativeApplied: false,
    });
  }

  if (unsupported.length === 0) return null;

  return {
    unsupported,
    error: unsupported
      .map((u) => (u.alternative ? `${u.reason} If you'd like, I can use ${u.alternative}.` : u.reason))
      .join(" "),
  };
}
