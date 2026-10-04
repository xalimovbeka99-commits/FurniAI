/**
 * Reopen a saved revision as an EDITABLE accepted design.
 * ---------------------------------------------------------------------
 * The server returns the stored FurniSpec, PartGraph and provenance. That is
 * enough to display and export the design, but conversational edits rebuild
 * from intake observations (applyConversationalEdit(currentObservations)), and
 * a reopened design had none: the Studio candidate reopened with
 * `observations: []`, so the first edit after reopen rebuilt the wardrobe from
 * the edit alone.
 *
 * restoreEditableDesign() derives the observations from the stored spec, then
 * PROVES they rebuild the stored design exactly (same canonical spec, same
 * canonical PartGraph) before calling it editable. If the stored design is not
 * one the conversational pipeline can reproduce (a hand-built spec, a layout
 * this pipeline does not assemble), it says so — the design is still shown and
 * exported from the stored data, but edits must not pretend to continue it.
 *
 * Session contract (defined, not a new pilot feature):
 *   - the reopened revision is the new baseline: displayed revision = the
 *     spec's own revision; storedRevision = the server's number;
 *   - Undo history does NOT cross a reopen (undoStack starts empty); Undo
 *     after reopen answers "nothing to undo" rather than restoring a state
 *     from another session;
 *   - the change token restarts at 0 in a fresh editing session; answers from
 *     the previous session are refused by the transport's session guard and by
 *     the save coordinator.
 */
import { previewDraftWardrobe, PIPELINE_STAGE } from "./pipeline.js";
import { preserveCustomerFinishOnDraft } from "./commitMaterialUpdate.js";
import { OBSERVATION_ORIGIN, BAY_LAYOUT, REQUIRED_INTAKE_KEYS } from "./intakeModel.js";
import { serializeCanonicalJson } from "../furnispec/normalize.js";

const VALID_ORIGINS = new Set(Object.values(OBSERVATION_ORIGIN));

function layoutOf(bay) {
  const types = (bay?.components || []).map((c) => c?.type);
  const has = (t) => types.includes(t);
  if (has("DRAWER_BANK") && has("HANGING_RAIL_SHORT")) return BAY_LAYOUT.DRAWER_BANK_WITH_SHORT_HANGING;
  if (has("HANGING_RAIL_SHORT") && has("SHELF_ADJUSTABLE")) return BAY_LAYOUT.SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES;
  if (has("HANGING_RAIL_LONG")) return BAY_LAYOUT.LONG_HANGING;
  return null;
}

/** Facts the intake model needs, read from a stored spec. */
export function factsFromSpec(spec) {
  const layouts = Array.isArray(spec?.bays) ? spec.bays.map(layoutOf) : [];
  const facts = {
    "envelope.widthMm": spec?.envelope?.widthMm,
    "envelope.heightMm": spec?.envelope?.heightMm,
    "envelope.depthMm": spec?.envelope?.depthMm,
    "plinth.heightMm": spec?.plinth?.heightMm,
    bayCount: Array.isArray(spec?.bays) ? spec.bays.length : undefined,
    doorCount: spec?.doors?.count,
    finishType: spec?.finishType,
    bayLayouts: layouts,
  };
  const missing = REQUIRED_INTAKE_KEYS.filter((k) => facts[k] === undefined || facts[k] === null);
  if (layouts.some((l) => l === null)) missing.push("bayLayouts");
  return { facts, missing: [...new Set(missing)] };
}

const canonical = (v) => serializeCanonicalJson(v);

/**
 * @param {object} args
 * @param {object} args.furniSpec  as returned by GET /api/designs/:id/revisions/:n
 * @param {object} args.partGraph
 * @param {object} [args.origins]
 * @param {number} args.storedRevision
 * @param {string} [args.designId]
 * @returns {{
 *   editable: boolean, reason?: string, details?: object,
 *   state: { designId, storedRevision, specId, revision, spec, partGraph, observations, origins,
 *            undoStack: [], editSequence: 0, customerFinishKey: string|null, finishType, envelope }
 * }}
 */
export function restoreEditableDesign({ furniSpec, partGraph, origins = {}, storedRevision, designId = null } = {}) {
  const base = {
    designId,
    storedRevision,
    specId: furniSpec?.specId ?? null,
    revision: furniSpec?.revision ?? null,
    spec: furniSpec,
    partGraph,
    origins: origins || {},
    undoStack: [],
    editSequence: 0,
    customerFinishKey: typeof furniSpec?.customerFinishKey === "string" ? furniSpec.customerFinishKey : null,
    finishType: furniSpec?.finishType ?? null,
    envelope: furniSpec?.envelope ?? null,
  };

  const { facts, missing } = factsFromSpec(furniSpec);
  if (missing.length > 0) {
    return { editable: false, reason: "NOT_A_PIPELINE_DESIGN", details: { missing }, state: { ...base, observations: [] } };
  }

  const sourceText = `restored from saved revision ${storedRevision}`;
  const observations = Object.entries(facts).map(([key, value]) => ({
    key,
    value: Array.isArray(value) ? [...value] : value,
    origin: VALID_ORIGINS.has(origins?.[key]) ? origins[key] : OBSERVATION_ORIGIN.EXTRACTED,
    sourceText,
    sourceSpan: null,
    ruleIds: [],
  }));
  if (base.customerFinishKey) {
    observations.push({
      key: "customerFinishKey",
      value: base.customerFinishKey,
      origin: VALID_ORIGINS.has(origins?.customerFinishKey) ? origins.customerFinishKey : OBSERVATION_ORIGIN.CUSTOMER_STATED,
      sourceText,
      sourceSpan: null,
      ruleIds: [],
    });
  }

  let rebuilt;
  try {
    rebuilt = preserveCustomerFinishOnDraft(
      previewDraftWardrobe({ initialObservations: observations, specId: furniSpec.specId, revision: furniSpec.revision }),
      observations
    );
  } catch (err) {
    return { editable: false, reason: "REBUILD_FAILED", details: { message: err?.message }, state: { ...base, observations: [] } };
  }
  if (rebuilt?.stage !== PIPELINE_STAGE.DRAFT_PREVIEW || !rebuilt.spec || !rebuilt.partGraph) {
    return {
      editable: false,
      reason: "REBUILD_REFUSED",
      details: { stage: rebuilt?.stage, errors: rebuilt?.validation?.errors?.map((e) => e.code) },
      state: { ...base, observations: [] },
    };
  }

  const specSame = canonical(rebuilt.spec) === canonical(furniSpec);
  const graphSame = canonical(rebuilt.partGraph) === canonical(partGraph);
  if (!specSame || !graphSame) {
    const differing = Object.keys({ ...rebuilt.spec, ...furniSpec })
      .filter((k) => canonical(rebuilt.spec[k] ?? null) !== canonical(furniSpec[k] ?? null))
      .sort();
    return {
      editable: false,
      reason: "RESTORED_DESIGN_DIFFERS",
      details: { specFields: differing, partGraphSame: graphSame },
      state: { ...base, observations: [] },
    };
  }

  // The stored design is kept byte-for-byte; the rebuild only proved the facts.
  return { editable: true, state: { ...base, observations: rebuilt.observations || observations } };
}
