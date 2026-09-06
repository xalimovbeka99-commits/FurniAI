/**
 * FurniAI — Customer Intake Model (Gate G4 / AI-Alpha)
 * ---------------------------------------------------------------------
 * Shared vocabulary for the untrusted side of the trust boundary.
 *
 * Everything produced before a FurniSpec exists is an OBSERVATION: a
 * proposal carrying its origin and the exact source text it came from.
 * Nothing here is trusted geometry. The boundary is crossed only in
 * assembleFurniSpec.js, and only once every BLOCKING gap is resolved.
 */

/** Where an observed value came from. */
export const OBSERVATION_ORIGIN = Object.freeze({
  /** The customer said it, in their own words. */
  CUSTOMER_STATED: "CUSTOMER_STATED",
  /** The customer confirmed a value put to them in a clarification question. */
  CUSTOMER_CONFIRMED: "CUSTOMER_CONFIRMED",
  /** Extracted or parsed from prompt chips, assistant suggestions, or conversation context. */
  EXTRACTED: "EXTRACTED",
  /** Supplied using Bekzod-approved Golden Wardrobe defaults for immediate draft preview. */
  DEFAULTED: "DEFAULTED",
  /** Derived by a closure equation from approved rules and stated values. */
  RULE_DERIVED: "RULE_DERIVED",
});

/**
 * Bekzod-approved Golden Wardrobe defaults used for immediate draft previews (Gate G4).
 * Values originate from src/lib/furnispec/goldenWardrobe.fixture.json and Rulebook v0.1.
 */
export const BEKZOD_APPROVED_DEFAULTS = Object.freeze({
  "envelope.widthMm": 1800.0,
  "envelope.heightMm": 2400.0,
  "envelope.depthMm": 600.0,
  "plinth.heightMm": 100.0,
  bayCount: 2,
  doorCount: 4,
  finishType: "melamine",
  bayLayouts: Object.freeze(["LONG_HANGING", "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES"]),
});

/** Why a fact is not yet usable. */
export const GAP_KIND = Object.freeze({
  /** The fact was never supplied. */
  MISSING_REQUIRED_FACT: "MISSING_REQUIRED_FACT",
  /** Supplied, but hedged or imprecise ("about 2 metres"). */
  AMBIGUOUS_FACT: "AMBIGUOUS_FACT",
  /** Supplied, but internally inconsistent with another stated fact. */
  CONFLICTING_FACT: "CONFLICTING_FACT",
  /** Would require applying a rule that has no Bekzod ruling. */
  UNRULED_DERIVATION: "UNRULED_DERIVATION",
  /** Requested, but outside the first manufacturing slice. */
  OUT_OF_SLICE: "OUT_OF_SLICE",
});

export const GAP_SEVERITY = Object.freeze({
  /** The kernel must refuse the spec while this gap stands. */
  BLOCKING: "BLOCKING",
  /** Worth asking, but does not stop assembly. */
  ADVISORY: "ADVISORY",
});

/** Interior layouts the first slice can build. */
export const BAY_LAYOUT = Object.freeze({
  LONG_HANGING: "LONG_HANGING",
  SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES: "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES",
});

/** Finishes the first slice has an approved material for. */
export const SUPPORTED_FINISHES = Object.freeze(["melamine"]);

/**
 * Facts the pipeline requires before a FurniSpec may be assembled.
 * `derivable: false` means no approved rule can supply it — it must be
 * stated or confirmed by a person. Nothing on this list has a default.
 */
export const REQUIRED_INTAKE_FACTS = Object.freeze([
  Object.freeze({ key: "envelope.widthMm", label: "overall width", unit: "mm", derivable: false }),
  Object.freeze({ key: "envelope.heightMm", label: "overall height", unit: "mm", derivable: false }),
  Object.freeze({ key: "envelope.depthMm", label: "overall depth", unit: "mm", derivable: false }),
  Object.freeze({ key: "plinth.heightMm", label: "plinth height", unit: "mm", derivable: false }),
  Object.freeze({ key: "bayCount", label: "number of bays", unit: "count", derivable: false }),
  Object.freeze({ key: "doorCount", label: "number of hinged doors", unit: "count", derivable: false }),
  Object.freeze({ key: "finishType", label: "finish", unit: "enum", derivable: false }),
  Object.freeze({ key: "bayLayouts", label: "interior layout of each bay", unit: "enum[]", derivable: false }),
]);

export const REQUIRED_INTAKE_KEYS = Object.freeze(REQUIRED_INTAKE_FACTS.map((f) => f.key));

/**
 * Builds an observation record.
 * @param {string} key intake fact key
 * @param {any} value observed value
 * @param {string} origin one of OBSERVATION_ORIGIN
 * @param {{sourceText?:string, sourceSpan?:[number,number], ruleIds?:string[]}} [meta]
 */
export function observation(key, value, origin, meta = {}) {
  if (!Object.values(OBSERVATION_ORIGIN).includes(origin)) {
    throw new Error(`Unknown observation origin "${origin}".`);
  }
  return Object.freeze({
    key,
    value,
    origin,
    sourceText: meta.sourceText ?? null,
    sourceSpan: meta.sourceSpan ? Object.freeze([...meta.sourceSpan]) : null,
    ruleIds: Object.freeze([...(meta.ruleIds ?? [])]),
  });
}

/**
 * Builds a gap record.
 * @param {string} key intake fact key the gap concerns
 * @param {string} kind one of GAP_KIND
 * @param {string} severity one of GAP_SEVERITY
 * @param {{detail?:string, sourceText?:string, proposal?:any, proposalBasis?:string}} [meta]
 */
export function gap(key, kind, severity, meta = {}) {
  if (!Object.values(GAP_KIND).includes(kind)) throw new Error(`Unknown gap kind "${kind}".`);
  if (!Object.values(GAP_SEVERITY).includes(severity)) throw new Error(`Unknown gap severity "${severity}".`);
  return Object.freeze({
    key,
    kind,
    severity,
    detail: meta.detail ?? "",
    sourceText: meta.sourceText ?? null,
    /** A value put to the customer for confirmation. Never applied on its own. */
    proposal: meta.proposal ?? null,
    proposalBasis: meta.proposalBasis ?? null,
  });
}

/** Deterministic ordering: by the canonical required-fact order, then key. */
export function sortGaps(gaps) {
  const order = new Map(REQUIRED_INTAKE_KEYS.map((k, i) => [k, i]));
  return [...gaps].sort((a, b) => {
    const ai = order.has(a.key) ? order.get(a.key) : REQUIRED_INTAKE_KEYS.length;
    const bi = order.has(b.key) ? order.get(b.key) : REQUIRED_INTAKE_KEYS.length;
    if (ai !== bi) return ai - bi;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
}
