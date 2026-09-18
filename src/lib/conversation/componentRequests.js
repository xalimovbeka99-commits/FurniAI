/**
 * Customer requests for components the design engine cannot build.
 *
 * WHY THIS IS DETERMINISTIC
 *
 * Unmodelled hardware (handles, locks, mirrors, lighting, …) used to fall
 * through to the model, which — with no provider reachable — answered "the
 * designer is not available right now". A permanent capability limit reported
 * as a transient failure. Recognising these here means the answer never depends
 * on a model being reachable and never costs a model call.
 * DRAWER_BANK is STRUCTURAL now; "Add drawers" is routed by the conversational
 * parser to a supported bay layout, not refused here.
 *
 * WHY THE WORDING COMES FROM THE POLICY
 *
 * For anything FurniSpec knows as a component type, the explanation and the
 * offered alternative are read from `COMPONENT_REPRESENTATION_POLICY` — the
 * same source the kernel ledger uses. One wording, one place.
 *
 * WHY MATCHING IS CONSERVATIVE
 *
 * A false refusal is worse than a missed one. A missed request falls through
 * to the model and still gets an answer; a false refusal tells a customer that
 * something they never asked for is impossible, and throws away the edit they
 * DID ask for in the same sentence. Two real examples that a keyword match got
 * wrong:
 *
 *   "I do not want drawers; make it 2000 mm wide"
 *       — an intent word and a component word both appear, yet the customer is
 *         declining drawers and requesting a width change. The width edit was
 *         being discarded and replaced with a refusal.
 *
 *   "I would like a light oak finish"
 *       — "like" plus "light" was read as a request for lighting. It is an
 *         adjective describing a wood tone.
 *
 * So matching requires that a request verb actually GOVERNS the component noun
 * inside a single clause, with no negation in that clause, and ambiguous words
 * only count in forms that cannot mean anything else. Where the reading is
 * uncertain this returns null and the sentence continues down the existing
 * interpretation path, which is always a safe fallback.
 */
import { COMPONENT_TYPES } from "../furnispec/schema.js";
import {
  COMPONENT_DIAGNOSTIC_CODE,
  COMPONENT_OUTCOME,
  COMPONENT_REPRESENTATION_POLICY,
} from "../partgraph/componentOutcomes.js";

/** Verbs that express wanting a thing added. */
const REQUEST_VERB = "add|put|fit|install|include|want|need|like|love|have|give|get|use|with|featuring";

/**
 * Anything that turns a request into a refusal, a removal, or a hypothetical.
 * Presence anywhere in the clause disqualifies it — we defer rather than guess
 * which half of "I don't want drawers but I do want a mirror" is which.
 */
const NEGATION =
  /\b(no|not|n't|never|without|none|don't|dont|do\s+not|does\s+not|doesn't|won't|will\s+not|can't|cannot|rather\s+not|instead\s+of|skip|drop|remove|delete|take\s+out|get\s+rid|no\s+need|unless)\b/i;

/**
 * Framing that refers to something rather than asking for it — a past
 * conversation, a showroom piece, someone else's design.
 */
const REFERENCE_FRAMING =
  /\b(you\s+(?:showed|mentioned|suggested|said)|the\s+ones?\s+(?:you|in)|showroom|catalogue|catalog|last\s+time|earlier|previous|other\s+wardrobe|like\s+the\s+one)\b/i;

/**
 * Filler allowed between the verb and the noun: determiners, quantities and up
 * to two adjectives. Wide enough for "add up to four soft-close drawers",
 * narrow enough that a verb in one phrase cannot reach a noun in another.
 */
const GAP = "(?:\\s+(?:up\\s+to|a|an|the|some|any|more|extra|another|about|around|at\\s+least|\\d+|one|two|three|four|five|six|couple|few|pair|of|my|our|it|its))*(?:\\s+[a-z-]+){0,2}\\s+";

/**
 * Component types a customer might name, with the words they use.
 * Only types the policy marks UNSUPPORTED are refused here.
 */
const COMPONENT_WORDS = Object.freeze([
  {
    noun: "drawers?|drawer\\s+bank|chest\\s+of\\s+drawers",
    componentType: COMPONENT_TYPES.DRAWER_BANK,
    customerWord: "drawers",
  },
]);

/**
 * Things FurniSpec has no component type for at all — hardware and fittings
 * rather than cut parts. Each needs its own sentence; there is no policy entry
 * to read one from.
 *
 * `light` is deliberately absent as a bare noun. It is a far more common
 * adjective ("light oak", "light grey") than it is a request for illumination,
 * so only unambiguous forms are listed.
 */
const UNMODELLED_WORDS = Object.freeze([
  { noun: "handles?|knobs?|pulls?", customerWord: "handles" },
  { noun: "mirrors?|mirrored\\s+doors?", customerWord: "a mirror" },
  { noun: "lighting|lights|led\\s+strips?|leds?|spotlights?|light\\s+strips?", customerWord: "lighting" },
  { noun: "locks?|lockable", customerWord: "a lock" },
  { noun: "shoe\\s+racks?|tie\\s+racks?|trouser\\s+racks?|baskets?|pull-?out\\s+racks?", customerWord: "racks and baskets" },
  { noun: "soft[-\\s]?close|push[-\\s]?to[-\\s]?open", customerWord: "soft-close hardware" },
]);

/**
 * Split on sentence and clause boundaries so a verb in one clause cannot bind
 * a noun in another. This is what keeps "I do not want drawers; make it 2000
 * mm wide" from losing its width edit.
 */
function toClauses(text) {
  return text
    .split(/[;.!?]+|,\s*|\s+\band\b\s+|\s+\bbut\b\s+|\s+\bthen\b\s+|\s+\balso\b\s+|\s+\bhowever\b\s+/i)
    .map((c) => c.trim())
    .filter(Boolean);
}

/** Does a request verb actually govern this noun, inside this clause? */
function clauseRequests(clause, noun) {
  const governed = new RegExp(`\\b(?:${REQUEST_VERB})\\b${GAP}(?:${noun})\\b`, "i");
  if (governed.test(clause)) return true;

  // "4 drawers on the left" — a bare quantity is a request even with the verb
  // implied, but only when the noun is quantified, never when merely named.
  const quantified = new RegExp(`\\b(?:\\d+|two|three|four|five|six)\\s+(?:[a-z-]+\\s+){0,2}?(?:${noun})\\b`, "i");
  return quantified.test(clause);
}

/**
 * @param {string} text the customer's message
 * @returns {{ unsupported: Array<object>, error: string } | null}
 *          null when nothing unsupported is being requested, or when the
 *          reading is uncertain — in which case the caller continues down the
 *          normal interpretation path.
 */
export function detectUnsupportedComponentRequest(text) {
  if (typeof text !== "string" || !text.trim()) return null;

  const unsupported = [];
  const seen = new Set();

  for (const clause of toClauses(text)) {
    // A clause that declines, removes, or merely refers to something is not a
    // request. Defer on all three rather than guess.
    if (NEGATION.test(clause) || REFERENCE_FRAMING.test(clause)) continue;

    for (const { noun, componentType, customerWord } of COMPONENT_WORDS) {
      if (seen.has(customerWord) || !clauseRequests(clause, noun)) continue;
      const policy = COMPONENT_REPRESENTATION_POLICY[componentType];
      // A type the policy considers buildable is not this module's business.
      if (!policy || policy.outcome !== COMPONENT_OUTCOME.UNSUPPORTED) continue;

      seen.add(customerWord);
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

    for (const { noun, customerWord } of UNMODELLED_WORDS) {
      if (seen.has(customerWord) || !clauseRequests(clause, noun)) continue;

      seen.add(customerWord);
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
  }

  if (unsupported.length === 0) return null;

  return {
    unsupported,
    error: unsupported
      .map((u) => (u.alternative ? `${u.reason} If you'd like, I can use ${u.alternative}.` : u.reason))
      .join(" "),
  };
}
