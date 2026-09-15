/**
 * Design-engine capability description (versioned).
 *
 * WHY THIS IS DERIVED, NOT WRITTEN
 *
 * The brief's rule is blunt: *a label such as "supported" must match actual
 * implementation*. A hand-written capability list satisfies that on the day it
 * is written and drifts every day after. So this file computes what it can
 * from the same constants the kernel obeys — the component representation
 * policy, the part roles, the editable-key allowlist, the schema versions —
 * and `capabilities.test.js` fails when a hand-written claim and the code
 * disagree.
 *
 * Anything that cannot be derived is written once, here, and pinned by a test
 * against the value the kernel actually hard-wires.
 *
 * This is a description of the DESIGN ENGINE. It says nothing about the
 * viewer, the browser, or what is deployed — those are other agents' surfaces
 * and claiming them here would be exactly the drift this file exists to stop.
 */
import { COMPONENT_TYPES, FINISH_TYPES, FURNISPEC_SCHEMA_VERSION, QUALIFICATION_STATUS } from "./furnispec/schema.js";
import { PART_ROLES, PARTGRAPH_VERSION } from "./partgraph/schema.js";
import {
  COMPONENT_OUTCOME,
  COMPONENT_REPRESENTATION_POLICY,
} from "./partgraph/componentOutcomes.js";
import { EDITABLE_KEYS } from "./ai-designer/designEditSchema.js";

/**
 * Bumped when the MEANING of a capability changes — a component moves between
 * outcomes, an editable key is added or removed, a boundary moves. Not bumped
 * for wording.
 */
export const CAPABILITY_DESCRIPTION_VERSION = "capabilities/0.2";

function componentTypesWithOutcome(outcome) {
  return Object.freeze(
    Object.values(COMPONENT_TYPES)
      .filter((type) => COMPONENT_REPRESENTATION_POLICY[type]?.outcome === outcome)
      .sort()
  );
}

export const DESIGN_ENGINE_CAPABILITIES = Object.freeze({
  version: CAPABILITY_DESCRIPTION_VERSION,
  schemas: Object.freeze({
    furniSpec: FURNISPEC_SCHEMA_VERSION,
    partGraph: PARTGRAPH_VERSION,
  }),

  furniture: Object.freeze({
    /** One family only. Saying "furniture" here would be the overclaim. */
    supported: Object.freeze(["WARDROBE / STRAIGHT_HINGED"]),
  }),

  components: Object.freeze({
    /** Produce real manufacturing parts. */
    structural: componentTypesWithOutcome(COMPONENT_OUTCOME.STRUCTURAL),
    /** Shown and/or positioned, but bought rather than cut. Never a part. */
    preview: componentTypesWithOutcome(COMPONENT_OUTCOME.PREVIEW),
    /** Accepted by the schema, reported honestly, never silently dropped. */
    unsupported: componentTypesWithOutcome(COMPONENT_OUTCOME.UNSUPPORTED),
  }),

  /** Roles the kernel may emit. `validatePartGraph` rejects anything else. */
  partRoles: Object.freeze(Object.values(PART_ROLES).sort()),

  editing: Object.freeze({
    /** The complete allowlist. A model proposing anything else is refused. */
    editableKeys: Object.freeze([...EDITABLE_KEYS].sort()),
    finishes: Object.freeze(Object.values(FINISH_TYPES).sort()),
    /** True of every edit path: the model proposes, deterministic code decides. */
    modelMayProposeOnly: true,
    /** A rejected edit returns no geometry and leaves the design as it was. */
    rejectedEditPreservesDesign: true,
  }),

  manufacturing: Object.freeze({
    qualificationStatus: QUALIFICATION_STATUS.WORKSHOP_REVIEW_NOT_CNC_QUALIFIED,
    drilling: "BLOCKED",
    cncExport: "NOT SUPPORTED",
    drawings: "NOT SUPPORTED",
    nesting: "NOT SUPPORTED",
    panelSchedule: "NOT SUPPORTED",
    /**
     * The line that matters most: a preview is a customer-comprehension aid
     * and never becomes manufacturing information by being looked at.
     */
    previewsAreNotManufacturingOutput: true,
  }),

  /**
   * Stated so nobody has to infer it from silence. Each of these is a real
   * limitation of the design engine today, not a rendering gap.
   */
  notSupportedYet: Object.freeze([
    "Handles, hinges and other hardware as placed, drillable objects.",
    "Drawer runner / System 32 hole CNC machining (geometry approved; drilling BLOCKED).",
    "A finish applied to one part rather than the whole wardrobe.",
    "Per-shelf editing beyond the supported bay layouts (hanging, shelves, drawer bank).",
    "Sliding, corner and walk-in wardrobes.",
    "Any furniture family other than wardrobes.",
  ]),
});

/**
 * The customer-facing half: plain sentences, no enum names, for a UI that
 * wants to tell someone what they can ask for.
 */
export function describeCapabilitiesForCustomer() {
  return {
    canDo: [
      "Design a straight wardrobe with hinged doors from a short description.",
      "Change the overall width, height and depth.",
      "Choose between the supported bay layouts.",
      "Add drawer banks cut to the approved undermount pack.",
      "Change the finish of the whole wardrobe.",
      "Undo a change and go back to the previous version.",
    ],
    cannotDoYet: [
      "Add handles or other hardware.",
      "Finish one part differently from the rest.",
      "Produce workshop drawings or cutting files.",
      "Export CNC drilling for drawer runners or System 32 holes.",
    ],
  };
}
