/**
 * Component outcome ledger (M2-OMIT-01)
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * `buildStructuralPartGraph` walks every component of every bay and emits
 * structural panels for the types it knows. Before this module, a component
 * type the builder did not know simply fell through the `if/else if` chain:
 * FurniSpec validation accepted it, the customer saw their request accepted,
 * and then no part, no preview and no diagnostic ever appeared. A requested
 * DRAWER_BANK disappeared silently. That is the worst possible failure mode
 * for a design tool — the system looked like it agreed.
 *
 * This module makes silence structurally impossible. Every accepted component
 * MUST be recorded exactly once with one of three explicit outcomes:
 *
 *   STRUCTURAL   Represented by real manufacturing parts. `partIds` lists them.
 *   PREVIEW      Represented visually and/or as a documented placement datum,
 *                but NOT a manufacturing part. Counted separately, never in
 *                `totalStructuralParts`.
 *   UNSUPPORTED  Not represented. Carries a structured diagnostic, an
 *                ordinary-language explanation, and (optionally) a suggested
 *                alternative that is NEVER applied automatically.
 *
 * The ledger is a report, not a decision: it records what the deterministic
 * kernel did. It never alters geometry and never invents a construction rule.
 *
 * COMPLETENESS IS ENFORCED, NOT ASSUMED
 *
 * `COMPONENT_REPRESENTATION_POLICY` must cover every member of FurniSpec's
 * `COMPONENT_TYPES`; `componentOutcomes.test.js` fails if a type is added to
 * the schema without a declared policy here. And at runtime, a component whose
 * type has no policy entry is recorded as UNSUPPORTED/`UNDECLARED_COMPONENT_TYPE`
 * rather than skipped — so even a policy gap surfaces to the customer as an
 * honest "we could not represent this", never as silence.
 */
import { COMPONENT_TYPES } from "../furnispec/schema.js";

export const COMPONENT_OUTCOME = Object.freeze({
  STRUCTURAL: "STRUCTURAL",
  PREVIEW: "PREVIEW",
  UNSUPPORTED: "UNSUPPORTED",
});

export const COMPONENT_DIAGNOSTIC_CODE = Object.freeze({
  /** The kernel has no representation for this component type at all. */
  COMPONENT_NOT_REPRESENTED: "COMPONENT_NOT_REPRESENTED",
  /** The type passed FurniSpec validation but no policy is declared here. */
  UNDECLARED_COMPONENT_TYPE: "UNDECLARED_COMPONENT_TYPE",
  /** The type is representable but this instance could not be placed. */
  COMPONENT_NOT_PLACED: "COMPONENT_NOT_PLACED",
});

/**
 * Declared representation policy, one entry per FurniSpec component type.
 *
 * `reason` is for engineers and logs. `customerMessage` is shown to a customer
 * and must read as ordinary language — no part roles, no dmm, no enum names.
 * `suggestedAlternative` is an OFFER. Nothing in this file applies it.
 */
export const COMPONENT_REPRESENTATION_POLICY = Object.freeze({
  [COMPONENT_TYPES.SHELF_FIXED]: Object.freeze({
    outcome: COMPONENT_OUTCOME.STRUCTURAL,
    representation: "Fixed shelf panel cut to the clear bay width.",
  }),
  [COMPONENT_TYPES.SHELF_ADJUSTABLE]: Object.freeze({
    outcome: COMPONENT_OUTCOME.STRUCTURAL,
    representation: "Adjustable shelf panel, inset by the clearance policy.",
  }),
  [COMPONENT_TYPES.HANGING_RAIL_LONG]: Object.freeze({
    outcome: COMPONENT_OUTCOME.PREVIEW,
    previewKind: "HANGING_RAIL",
    representation:
      "Bought hanging rail. Not a cut panel. Recorded as a placement datum " +
      "(rail centre height) and, where the preview lane is enabled, drawn as " +
      "a PREVIEW_ONLY visual.",
  }),
  [COMPONENT_TYPES.HANGING_RAIL_SHORT]: Object.freeze({
    outcome: COMPONENT_OUTCOME.PREVIEW,
    previewKind: "HANGING_RAIL",
    representation:
      "Bought hanging rail. Not a cut panel. Recorded as a placement datum " +
      "(rail centre height) and, where the preview lane is enabled, drawn as " +
      "a PREVIEW_ONLY visual.",
  }),
  [COMPONENT_TYPES.DRAWER_BANK]: Object.freeze({
    // STILL UNSUPPORTED BY DEFAULT, and deliberately so.
    //
    // The 2026-09-15 ruling made a drawer bank representable IN PRINCIPLE: the
    // runner family and the 21.0mm width deduction size the box's width, and
    // drawerPack.js compiles five parts per row. But the box's height, depth,
    // runner clearance, bottom thickness and back arrangement are still unruled,
    // and nothing in the conversational intake path can supply them. So a
    // customer who asks for drawers still cannot be given drawers, and this
    // policy is what tells them so before the request reaches a model.
    //
    // A spec that DOES state those five inputs compiles normally — the kernel
    // records STRUCTURAL at runtime, overriding this default. That is the only
    // route to drawer parts today, and it is not one a conversation can take.
    outcome: COMPONENT_OUTCOME.UNSUPPORTED,
    conditionallyStructural: Object.freeze({
      requiredInputs: Object.freeze([
        "boxHeightMm",
        "boxDepthMm",
        "boxBottomClearanceMm",
        "bottomThicknessMm",
        "backBetweenSides",
      ]),
      compiledBy: "src/lib/partgraph/drawerPack.js",
    }),
    representation:
      "Five cut parts per row - DRAWER_FRONT, DRAWER_SIDE_L, DRAWER_SIDE_R, " +
      "DRAWER_BACK, DRAWER_BOTTOM - sized from the 2026-09-15 runner ruling " +
      "(UNDERMOUNT_CONCEALED_21MM, 21.0mm total width deduction, 2.0mm front " +
      "reveal). See drawerPack.js.",
    // Kept because the ruling did NOT settle the box's height, depth, runner
    // clearance, bottom thickness or back arrangement. A bank that does not
    // state those is recorded UNSUPPORTED/COMPONENT_NOT_PLACED at runtime with
    // the missing field named, using this copy.
    diagnosticCode: COMPONENT_DIAGNOSTIC_CODE.COMPONENT_NOT_PLACED,
    reason:
      "The runner family and its 21.0mm width deduction are ruled, so the box's " +
      "width is determined. Its height, depth, runner clearance, bottom thickness " +
      "and back arrangement are not ruled and are not derivable from the bay.",
    customerMessage:
      "I can't build the drawers for this design yet \u2014 the drawer box sizes for " +
      "this runner aren't confirmed. Everything else in your wardrobe is unchanged.",
    suggestedAlternative: Object.freeze({
      componentType: COMPONENT_TYPES.SHELF_FIXED,
      // Lower-case and clause-shaped: it is always read inside an offer
      // sentence ("If you'd like, I can use ..."), never on its own.
      summary: "a fixed shelf at the same height, which you could add drawers under later",
      applied: false,
    }),
  }),
});

/**
 * A write-once ledger. `record*` is called from the kernel as each component is
 * walked; `finish()` returns frozen entries plus counts.
 */
export function createComponentLedger() {
  /** @type {Map<string, object>} keyed by `${bayIndex}:${componentId}` */
  const entries = new Map();

  function key(bayIndex, componentId) {
    return `${bayIndex}:${componentId}`;
  }

  function put(entry) {
    const k = key(entry.bayIndex, entry.componentId);
    if (entries.has(k)) {
      throw new Error(
        `Component "${entry.componentId}" in bay ${entry.bayIndex} was recorded twice in the outcome ledger.`
      );
    }
    entries.set(k, Object.freeze(entry));
  }

  return {
    /** A component that produced real manufacturing parts. */
    recordStructural(comp, bayIndex, partIds) {
      const policy = COMPONENT_REPRESENTATION_POLICY[comp.type];
      put({
        componentId: comp.id,
        componentType: comp.type,
        bayIndex,
        outcome: COMPONENT_OUTCOME.STRUCTURAL,
        partIds: Object.freeze([...partIds]),
        representation: policy?.representation ?? null,
      });
    },

    /**
     * A component represented visually and/or by a placement datum, never as a
     * cut part. `datum` documents what the kernel actually computed (for a
     * hanging rail: its centre height), so the outcome is meaningful even when
     * the visual preview lane is not enabled on this branch.
     */
    recordPreview(comp, bayIndex, datum = null) {
      const policy = COMPONENT_REPRESENTATION_POLICY[comp.type];
      put({
        componentId: comp.id,
        componentType: comp.type,
        bayIndex,
        outcome: COMPONENT_OUTCOME.PREVIEW,
        previewKind: policy?.previewKind ?? null,
        partIds: Object.freeze([]),
        placementDatum: datum ? Object.freeze({ ...datum }) : null,
        representation: policy?.representation ?? null,
      });
    },

    /**
     * A component the kernel cannot represent. `overrides` lets a caller
     * narrow the diagnostic (e.g. COMPONENT_NOT_PLACED) without duplicating
     * the customer-facing copy.
     */
    recordUnsupported(comp, bayIndex, overrides = {}) {
      const policy = COMPONENT_REPRESENTATION_POLICY[comp.type];
      const undeclared = !policy;
      put({
        componentId: comp.id,
        componentType: comp.type,
        bayIndex,
        outcome: COMPONENT_OUTCOME.UNSUPPORTED,
        partIds: Object.freeze([]),
        diagnosticCode:
          overrides.diagnosticCode ??
          policy?.diagnosticCode ??
          COMPONENT_DIAGNOSTIC_CODE.UNDECLARED_COMPONENT_TYPE,
        reason:
          overrides.reason ??
          policy?.reason ??
          `Component type "${comp.type}" passed FurniSpec validation but no representation policy is declared for it.`,
        customerMessage:
          overrides.customerMessage ??
          policy?.customerMessage ??
          "I couldn't include one of the parts you asked for in this design. Everything else is unchanged.",
        suggestedAlternative: policy?.suggestedAlternative ?? null,
        undeclared,
      });
    },

    /** Has this component already been accounted for? */
    has(comp, bayIndex) {
      return entries.has(key(bayIndex, comp.id));
    },

    finish() {
      const list = Object.freeze([...entries.values()]);
      const count = (outcome) => list.filter((e) => e.outcome === outcome).length;
      return {
        componentOutcomes: list,
        counts: Object.freeze({
          totalComponents: list.length,
          structuralComponents: count(COMPONENT_OUTCOME.STRUCTURAL),
          previewComponents: count(COMPONENT_OUTCOME.PREVIEW),
          unsupportedComponents: count(COMPONENT_OUTCOME.UNSUPPORTED),
        }),
      };
    },
  };
}

/**
 * The customer-facing half of the ledger, in the shape the published transport
 * contract already uses for `unsupported[]` (`{ request, reason, alternative }`
 * — see `ai-designer-transport.js`), so the browser needs no new branch.
 */
export function unsupportedComponentsForCustomer(componentOutcomes = []) {
  return componentOutcomes
    .filter((e) => e.outcome === COMPONENT_OUTCOME.UNSUPPORTED)
    .map((e) => ({
      request: e.componentId,
      componentType: e.componentType,
      bayIndex: e.bayIndex,
      code: e.diagnosticCode,
      reason: e.customerMessage,
      engineeringReason: e.reason,
      alternative: e.suggestedAlternative ? e.suggestedAlternative.summary : null,
      alternativeApplied: false,
    }));
}
