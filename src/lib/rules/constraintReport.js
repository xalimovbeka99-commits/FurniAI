/**
 * Manufacturing constraint report — traceable, and separated by authority.
 * ---------------------------------------------------------------------
 * One design, four DIFFERENT kinds of statement, never mixed:
 *
 *   blockingViolations  the design is refused: validator, kernel geometry,
 *                       PartGraph validator, unrepresentable component.
 *   advisoryWarnings    the design is accepted; a PROVISIONAL limit or a
 *                       kernel assumption says "look at this". Never blocks.
 *   approvedRules       catalog rules with Bekzod provenance (Rulebook v0.1,
 *                       golden fixture, explicit ruling) that this design
 *                       actually used — with the parts that carry them.
 *   provisionalRules    values the design used that are NOT approved
 *                       (PROVISIONAL_PENDING_BEKZOD*, engineer defaults).
 *   untracedReferences  rule ids the compiler cites that the catalog does not
 *                       define — a traceability gap, reported, not guessed.
 *
 * plus `notQualified`: hardware drilling, STEP export and CNC qualification
 * are stated as NOT available, from the design's own fields — this report
 * cannot raise them.
 *
 * Every entry carries its source (rule id + provenance + file) so it can be
 * traced to the document that authorises it, or to the fact that nothing does.
 * Pure: no I/O.
 */
import { WARDROBE_RULES, RULE_PROVENANCE, RULE_CATALOG_VERSION } from "./wardrobeRuleCatalog.js";
import { PHYSICAL_LIMITS, PHYSICAL_LIMIT_REGISTRY_VERSION } from "./physicalLimitRegistry.js";
import { DEFAULTS as MODEL_DEFAULTS } from "../wardrobe-model/schema.js";
import { validateFurniSpec } from "../furnispec/validate.js";
import { buildStructuralPartGraph } from "../partgraph/buildStructuralPartGraph.js";
import { validatePartGraph } from "../partgraph/validatePartGraph.js";
import {
  DRAWER_BOX_SIDE_THICKNESS_MM,
  DRAWER_SIDE_DEPTH_SETBACK_MM,
  DRAWER_BOTTOM_SIDE_INSET_TOTAL_MM,
  DRAWER_BOTTOM_THICKNESS_MM,
  DEFAULT_DRAWER_ROW_HEIGHT_MM,
} from "../partgraph/emitDrawerBankParts.js";

export const CONSTRAINT_REPORT_VERSION = "constraint-report/0.1";

const APPROVED = new Set([
  RULE_PROVENANCE.RULEBOOK_V0_1,
  RULE_PROVENANCE.GOLDEN_FIXTURE_BEKZOD_APPROVED,
  RULE_PROVENANCE.BEKZOD_RULING,
]);
const SOURCE_OF = {
  RULEBOOK_V0_1: "docs/WARDROBE_RULEBOOK_V0.1.md",
  GOLDEN_FIXTURE_BEKZOD_APPROVED: "src/lib/furnispec/goldenWardrobe.fixture.json",
  BEKZOD_RULING: "src/lib/rules/wardrobeRuleCatalog.js (Bekzod ruling record)",
  PROVISIONAL_PENDING_BEKZOD: "src/lib/rules/wardrobeRuleCatalog.js (provisional record)",
};

const SHELF_ROLES = new Set(["FIXED_SHELF", "ADJUSTABLE_SHELF"]);
const BELOW_RAIL_ROLES = new Set(["FIXED_SHELF", "ADJUSTABLE_SHELF", "BOTTOM_PANEL", "DRAWER_FRONT", "DRAWER_SIDE_L", "DRAWER_SIDE_R", "DRAWER_BACK", "DRAWER_BOTTOM"]);

const P = (part) => part.placement || {};

/** Catalog rules by id, and by the key used in derivations. */
function catalogIndex() {
  const byId = new Map();
  for (const [key, r] of Object.entries(WARDROBE_RULES)) {
    if (!byId.has(r.id)) byId.set(r.id, []);
    byId.get(r.id).push({ key, ...r });
  }
  return byId;
}

function refuse(source, list) {
  return (list || []).map((e) => ({
    source,
    code: e.code || "UNKNOWN",
    message: e.message || String(e),
    ...(e.path ? { path: e.path } : {}),
    ...(e.details ? { details: e.details } : {}),
  }));
}

/**
 * @param {object} args
 * @param {object} args.spec          the accepted FurniSpec
 * @param {object} [args.partGraph]   its PartGraph; recompiled when omitted
 * @param {Array}  [args.derivations] assembleFurniSpec derivations, when available
 */
export function buildConstraintReport({ spec, partGraph = null, derivations = [] } = {}) {
  const report = {
    reportVersion: CONSTRAINT_REPORT_VERSION,
    ruleCatalogVersion: RULE_CATALOG_VERSION,
    physicalLimitsVersion: PHYSICAL_LIMIT_REGISTRY_VERSION,
    specId: spec?.specId ?? null,
    revision: spec?.revision ?? null,
    status: "PASS",
    blockingViolations: [],
    advisoryWarnings: [],
    approvedRules: [],
    provisionalRules: [],
    /** Rule ids a part cites that have no catalog record: traceability gaps, not rules. */
    untracedReferences: [],
    notQualified: {
      hardwareDrilling: spec?.machiningPolicy?.drilling ?? "BLOCKED_PENDING_HARDWARE_APPROVAL",
      stepExport: "NOT_SUPPORTED",
      cncQualification: spec?.qualificationStatus ?? "WORKSHOP_REVIEW_NOT_CNC_QUALIFIED",
      statement:
        "Workshop review only. No hardware drilling, no STEP export, no CNC qualification — none is claimed by this report.",
    },
  };

  // ---- Blocking ---------------------------------------------------------
  const v = validateFurniSpec(spec);
  if (!v.valid) {
    report.blockingViolations.push(...refuse("FURNISPEC_VALIDATOR", v.errors));
  }
  let graph = partGraph;
  if (v.valid && !graph) {
    try {
      graph = buildStructuralPartGraph(spec);
    } catch (err) {
      report.blockingViolations.push({
        source: "KERNEL_GEOMETRY",
        code: err?.code || "COMPILE_FAILED",
        message: err?.message || "compile failed",
        ...(err?.details ? { details: err.details } : {}),
      });
    }
  }
  if (graph) {
    const pv = validatePartGraph(graph);
    if (!pv.valid) report.blockingViolations.push(...refuse("PARTGRAPH_VALIDATOR", pv.errors));
    for (const o of graph.componentOutcomes || []) {
      if (o.outcome === "UNSUPPORTED") {
        report.blockingViolations.push({
          source: "UNSUPPORTED_COMPONENT",
          code: o.diagnosticCode || "COMPONENT_NOT_REPRESENTED",
          message: o.reason || `Component ${o.componentId} is not represented.`,
          details: { componentId: o.componentId, componentType: o.componentType, bayIndex: o.bayIndex },
        });
      }
    }
  }
  if (report.blockingViolations.length > 0) {
    report.status = "BLOCKED";
    return report;
  }

  // ---- Approved and provisional rules actually used ---------------------
  const byId = catalogIndex();
  const used = new Map(); // ruleId -> Set(partIds | "derivation:<path>")
  for (const part of graph.parts || []) {
    for (const id of part.sourceRuleIds || []) {
      if (!used.has(id)) used.set(id, new Set());
      used.get(id).add(part.id);
    }
  }
  for (const d of derivations || []) {
    for (const id of d.ruleIds || []) {
      if (!used.has(id)) used.set(id, new Set());
      used.get(id).add(`derivation:${d.path}`);
    }
  }
  for (const [id, where] of [...used.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const records = byId.get(id);
    const appliedTo = [...where].sort();
    if (!records) {
      report.untracedReferences.push({
        id,
        source: "cited in PartGraph sourceRuleIds; no record in wardrobeRuleCatalog.js",
        appliedTo,
      });
      continue;
    }
    for (const r of records) {
      const entry = { id, key: r.key, value: r.value, provenance: r.provenance, source: SOURCE_OF[r.provenance] || r.provenance, note: r.note, appliedTo };
      (APPROVED.has(r.provenance) ? report.approvedRules : report.provisionalRules).push(entry);
    }
  }

  const drawerParts = (graph.parts || []).filter((p) => String(p.role).startsWith("DRAWER_"));
  if (drawerParts.length > 0) {
    const ids = drawerParts.map((p) => p.id).sort();
    for (const [key, value] of Object.entries({
      DRAWER_BOX_SIDE_THICKNESS_MM,
      DRAWER_SIDE_DEPTH_SETBACK_MM,
      DRAWER_BOTTOM_SIDE_INSET_TOTAL_MM,
      DRAWER_BOTTOM_THICKNESS_MM,
      DEFAULT_DRAWER_ROW_HEIGHT_MM,
    })) {
      report.provisionalRules.push({
        id: key,
        value,
        provenance: "PROVISIONAL_PENDING_BEKZOD_REVIEW",
        source: "src/lib/partgraph/emitDrawerBankParts.js (docs/m2/integ/DRAWER_COMPILER_DECISION.md)",
        appliedTo: ids,
      });
    }
  }
  for (const pv of graph.previews || []) {
    if (pv.kind !== "HANGING_RAIL") continue;
    report.provisionalRules.push({
      id: "RAIL-PREVIEW-ASSUMPTIONS",
      value: { endInsetMm: pv.assumed?.endInsetMm, centerZRule: pv.assumed?.centerZRule },
      provenance: "PREVIEW_ONLY_ASSUMPTION",
      source: "src/lib/partgraph/buildStructuralPartGraph.js (visual preview, not a manufacturing part)",
      appliedTo: [pv.id],
    });
  }

  // ---- Advisory: provisional limits, measured, never blocking ------------
  const advise = (limitKey, code, message, evidence) => {
    const lim = PHYSICAL_LIMITS[limitKey];
    report.advisoryWarnings.push({
      code,
      message,
      limitId: lim?.id,
      limitValueMm: MODEL_DEFAULTS[limitKey],
      provenance: lim?.provenance,
      source: "src/lib/rules/physicalLimitRegistry.js",
      evidence,
    });
  };
  const parts = graph.parts || [];
  for (const rail of (graph.previews || []).filter((p) => p.kind === "HANGING_RAIL")) {
    const overlapsX = (p) => P(p).minXDmm < rail.maxXDmm && P(p).maxXDmm > rail.minXDmm;
    const below = parts.filter((p) => BELOW_RAIL_ROLES.has(p.role) && overlapsX(p) && P(p).maxYDmm <= rail.centerYDmm);
    const top = below.reduce((best, p) => (P(p).maxYDmm > (best ? P(best).maxYDmm : -Infinity) ? p : best), null);
    if (!top) continue;
    const dropMm = (rail.centerYDmm - P(top).maxYDmm) / 10;
    const min = MODEL_DEFAULTS.minHangingClearanceBelowMm;
    if (typeof min === "number" && dropMm < min) {
      advise("minHangingClearanceBelowMm", "ADVISORY_SHORT_HANGING_DROP",
        `Hanging rail ${rail.id} has ${dropMm} mm clear drop, below the provisional ${min} mm garment assumption.`,
        { railId: rail.id, clearDropMm: dropMm, obstructionId: top.id });
    }
  }
  const spanLimit = MODEL_DEFAULTS.maxUnsupportedShelfSpanMm;
  for (const shelf of parts.filter((p) => SHELF_ROLES.has(p.role))) {
    const spanMm = (P(shelf).maxXDmm - P(shelf).minXDmm) / 10;
    if (typeof spanLimit === "number" && spanMm > spanLimit) {
      advise("maxUnsupportedShelfSpanMm", "ADVISORY_LONG_SHELF_SPAN",
        `Shelf ${shelf.id} spans ${spanMm} mm, over the provisional ${spanLimit} mm span limit (material and load are not modelled).`,
        { partId: shelf.id, spanMm });
    }
  }
  const depthLimit = MODEL_DEFAULTS.minHangingInteriorDepthMm;
  if ((graph.previews || []).some((p) => p.kind === "HANGING_RAIL") && typeof spec?.carcass?.depthMm === "number") {
    const interior = spec.carcass.depthMm - (spec.carcass.backThicknessMm || 0);
    if (typeof depthLimit === "number" && interior < depthLimit) {
      advise("minHangingInteriorDepthMm", "ADVISORY_SHALLOW_HANGING_BAY",
        `Interior depth ${interior} mm is below the provisional ${depthLimit} mm for hanging.`, { interiorDepthMm: interior });
    }
  }
  for (const w of graph.warnings || []) {
    report.advisoryWarnings.push({ code: w.code, message: w.message, provenance: "KERNEL_WARNING", source: "PartGraph.warnings" });
  }

  report.status = report.advisoryWarnings.length > 0 ? "PASS_WITH_ADVISORIES" : "PASS";
  return report;
}
