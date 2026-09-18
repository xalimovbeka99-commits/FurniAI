/**
 * M2-OMIT-01 — no accepted component may disappear.
 *
 * These tests exist because of a real, shipped failure: FurniSpec accepted a
 * DRAWER_BANK, `buildStructuralPartGraph` had no branch for it, and the
 * component vanished — no part, no preview, no warning, no diagnostic. The
 * customer's request was accepted and then silently dropped.
 *
 * The guard is a completeness invariant, not a list of known types: every
 * accepted component must appear in the ledger exactly once. A component type
 * added later without being wired up fails these tests instead of vanishing.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildStructuralPartGraph } from "./buildStructuralPartGraph.js";
import { validatePartGraph } from "./validatePartGraph.js";
import { validateFurniSpec } from "../furnispec/validate.js";
import { unrepresentableComponents } from "../conversation/pipeline.js";
import { COMPONENT_TYPES } from "../furnispec/schema.js";
import {
  COMPONENT_OUTCOME,
  COMPONENT_DIAGNOSTIC_CODE,
  COMPONENT_REPRESENTATION_POLICY,
  unsupportedComponentsForCustomer,
  createComponentLedger,
} from "./componentOutcomes.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../furnispec/goldenWardrobe.fixture.json", import.meta.url)), "utf8")
);

const clone = (o) => JSON.parse(JSON.stringify(o));

/** Total components the spec asked for, across every bay. */
function acceptedComponentCount(spec) {
  return spec.bays.reduce((n, bay) => n + (bay.components || []).length, 0);
}

describe("component representation policy", () => {
  it("declares an outcome for every FurniSpec component type", () => {
    // If this fails, a component type was added to the schema without deciding
    // how it is represented. That decision is the whole point — make it here,
    // explicitly, rather than discovering it as a missing wardrobe part.
    const undeclared = Object.values(COMPONENT_TYPES).filter(
      (t) => !Object.prototype.hasOwnProperty.call(COMPONENT_REPRESENTATION_POLICY, t)
    );
    expect(undeclared).toEqual([]);
  });

  it("gives every unsupported type a customer message and an unapplied alternative", () => {
    for (const [type, policy] of Object.entries(COMPONENT_REPRESENTATION_POLICY)) {
      if (policy.outcome !== COMPONENT_OUTCOME.UNSUPPORTED) continue;
      expect(policy.diagnosticCode, `${type} needs a diagnostic code`).toBeTruthy();
      expect(policy.reason, `${type} needs an engineering reason`).toBeTruthy();
      expect(policy.customerMessage, `${type} needs a customer message`).toBeTruthy();
      // Ordinary language: no enum names or engineering units leak to a customer.
      expect(policy.customerMessage).not.toMatch(/[A-Z]{3,}_[A-Z]/);
      expect(policy.customerMessage).not.toMatch(/dmm|PartGraph|FurniSpec/i);
      if (policy.suggestedAlternative) {
        expect(policy.suggestedAlternative.applied).toBe(false);
      }
    }
  });
});

describe("golden wardrobe — outcomes accounted for, geometry unchanged", () => {
  const graph = buildStructuralPartGraph(fixture);

  it("still produces exactly 19 structural parts", () => {
    expect(graph.parts).toHaveLength(19);
    expect(graph.summary.totalStructuralParts).toBe(19);
  });

  it("accounts for every accepted component exactly once", () => {
    expect(graph.componentOutcomes).toHaveLength(acceptedComponentCount(fixture));
    const keys = graph.componentOutcomes.map((e) => `${e.bayIndex}:${e.componentId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("counts previews separately from structural parts", () => {
    expect(graph.summary.structuralComponents).toBe(4);
    expect(graph.summary.previewComponents).toBe(2);
    expect(graph.summary.unsupportedComponents).toBe(0);
    // Preview components contribute no structural parts, by construction.
    const previewPartIds = graph.componentOutcomes
      .filter((e) => e.outcome === COMPONENT_OUTCOME.PREVIEW)
      .flatMap((e) => e.partIds);
    expect(previewPartIds).toEqual([]);
  });

  it("classifies hanging rails as PREVIEW with a placement datum, not as unsupported", () => {
    // Coordination with EXP-01: rails are a supported preview. An older
    // implementation represented them only as a positioning datum, which is a
    // reason to record the datum — never a reason to call the rail unsupported.
    const rails = graph.componentOutcomes.filter((e) => e.componentType.startsWith("HANGING_RAIL"));
    expect(rails).toHaveLength(2);
    for (const rail of rails) {
      expect(rail.outcome).toBe(COMPONENT_OUTCOME.PREVIEW);
      expect(rail.previewKind).toBe("HANGING_RAIL");
      expect(rail.placementDatum.railCenterYDmm).toBeGreaterThan(0);
      expect(Number.isInteger(rail.placementDatum.railCenterYDmm)).toBe(true);
    }
  });

  it("joins every PREVIEW outcome to the preview actually drawn for it", () => {
    // Two lists answer two questions: `previews` is what the viewer draws,
    // `componentOutcomes` is what the customer asked for and what became of
    // it. They are maintained in the same loop by different concerns (EXP-01
    // and M2-OMIT-01), so they can drift — a preview with no outcome is a
    // component that vanished from the ledger, and an outcome with no preview
    // is a rail the customer is told about but never sees.
    const previews = graph.previews ?? [];
    const previewOutcomes = graph.componentOutcomes.filter((e) => e.outcome === COMPONENT_OUTCOME.PREVIEW);

    expect(previewOutcomes).toHaveLength(previews.length);
    expect(graph.summary.previewComponents).toBe(graph.summary.totalPreviewParts);

    const previewIds = new Set(previews.map((p) => p.id));
    for (const outcome of previewOutcomes) {
      expect(outcome.placementDatum?.previewId, `${outcome.componentId} has no preview id`).toBeTruthy();
      expect(previewIds.has(outcome.placementDatum.previewId)).toBe(true);
    }

    // And every drawn preview traces back to a real component.
    const componentIds = new Set(graph.componentOutcomes.map((e) => e.componentId));
    for (const preview of previews) {
      expect(componentIds.has(preview.sourceComponentId)).toBe(true);
    }
  });

  it("keeps previews out of the manufacturing lane entirely", () => {
    // The preview/manufacturing separation, asserted rather than assumed.
    for (const preview of graph.previews ?? []) {
      expect(preview.status).toBe("PREVIEW_ONLY");
      expect(preview.manufacturingOutput).toBe(false);
      expect(preview.engineeringVerified).toBe(false);
      // No preview id may collide with a structural part id.
      expect(graph.parts.some((p) => p.id === preview.id)).toBe(false);
    }
    expect(graph.summary.totalStructuralParts).toBe(graph.parts.length);
  });

  it("reports no unsupported warnings for a fully supported spec", () => {
    const codes = graph.warnings.map((w) => w.code);
    expect(codes).not.toContain(COMPONENT_DIAGNOSTIC_CODE.COMPONENT_NOT_REPRESENTED);
    expect(codes).not.toContain(COMPONENT_DIAGNOSTIC_CODE.UNDECLARED_COMPONENT_TYPE);
  });
});

describe("a requested DRAWER_BANK is reported, never silently omitted", () => {
  function specWithDrawerBank() {
    const spec = clone(fixture);
    spec.bays[0].components.push({
      id: "drawer-bank-l1",
      type: COMPONENT_TYPES.DRAWER_BANK,
      offsetFromBottomMm: 0,
      rows: 4,
    });
    return spec;
  }

  it("is accepted by FurniSpec validation (so the kernel must answer for it)", () => {
    const result = validateFurniSpec(specWithDrawerBank());
    expect(result.valid).toBe(true);
  });

  // Since the 2026-09-15 runner ruling a DRAWER_BANK is representable in
  // principle, so a bank that omits the box dimensions is NOT_PLACED (this
  // instance could not be built) rather than NOT_REPRESENTED (the kernel has
  // no idea what a drawer is). The guarantee under test is unchanged: it is
  // reported, never silently omitted.
  it("appears in the ledger as UNSUPPORTED with a structured diagnostic", () => {
    const graph = buildStructuralPartGraph(specWithDrawerBank());
    const entry = graph.componentOutcomes.find((e) => e.componentId === "drawer-bank-l1");

    expect(entry).toBeDefined();
    expect(entry.outcome).toBe(COMPONENT_OUTCOME.UNSUPPORTED);
    expect(entry.componentType).toBe(COMPONENT_TYPES.DRAWER_BANK);
    expect(entry.bayIndex).toBe(0);
    expect(entry.diagnosticCode).toBe(COMPONENT_DIAGNOSTIC_CODE.COMPONENT_NOT_PLACED);
    expect(entry.reason).toMatch(/runner|not ruled|box/i);
    expect(entry.customerMessage).toMatch(/drawers/i);
    expect(entry.partIds).toEqual([]);
    expect(entry.undeclared).toBe(false);
  });

  it("offers an alternative without applying it", () => {
    const graph = buildStructuralPartGraph(specWithDrawerBank());
    const entry = graph.componentOutcomes.find((e) => e.componentId === "drawer-bank-l1");

    expect(entry.suggestedAlternative).toBeTruthy();
    expect(entry.suggestedAlternative.applied).toBe(false);
    // The offer must not have quietly become a shelf in the geometry.
    expect(graph.parts).toHaveLength(19);
    expect(graph.summary.totalStructuralParts).toBe(19);
  });

  it("preserves every other part of the design", () => {
    const before = buildStructuralPartGraph(fixture);
    const after = buildStructuralPartGraph(specWithDrawerBank());
    // The unsupported component changes nothing that was already valid.
    expect(after.parts).toEqual(before.parts);
    expect(after.operations).toEqual(before.operations);
    expect(after.summary.envelope).toEqual(before.summary.envelope);
  });

  it("surfaces a warning on the PartGraph itself", () => {
    const graph = buildStructuralPartGraph(specWithDrawerBank());
    const warning = graph.warnings.find((w) => w.componentId === "drawer-bank-l1");
    expect(warning).toBeDefined();
    expect(warning.code).toBe(COMPONENT_DIAGNOSTIC_CODE.COMPONENT_NOT_PLACED);
    expect(warning.componentType).toBe(COMPONENT_TYPES.DRAWER_BANK);
  });

  it("produces a well-formed DIAGNOSTIC PartGraph — which is not a fulfilled request", () => {
    // The graph is structurally valid: an unsupported component is a reported
    // limitation, not a crash, and the diagnostic has to be inspectable.
    const graph = buildStructuralPartGraph(specWithDrawerBank());
    expect(validatePartGraph(graph).valid).toBe(true);

    // But validity here must never be read as "the customer got what they
    // asked for". The graph itself says otherwise, and `pipeline.js`
    // (`unrepresentableComponents`) refuses to hand it to a customer as their
    // design — proven end to end in
    // src/lib/conversation/unsupportedRequestIntegration.test.js.
    expect(graph.summary.unsupportedComponents).toBeGreaterThan(0);
    expect(unrepresentableComponents(graph)).not.toBeNull();
  });

  it("converts to the customer-facing unsupported[] shape the transport already reads", () => {
    const graph = buildStructuralPartGraph(specWithDrawerBank());
    const forCustomer = unsupportedComponentsForCustomer(graph.componentOutcomes);

    expect(forCustomer).toHaveLength(1);
    const [item] = forCustomer;
    expect(item).toMatchObject({
      request: "drawer-bank-l1",
      componentType: COMPONENT_TYPES.DRAWER_BANK,
      code: COMPONENT_DIAGNOSTIC_CODE.COMPONENT_NOT_PLACED,
      alternativeApplied: false,
    });
    expect(typeof item.reason).toBe("string");
    expect(typeof item.alternative).toBe("string");
  });
});

describe("completeness holds for arbitrary component mixes", () => {
  it("accounts for every component in a multi-bay spec with mixed types", () => {
    const spec = clone(fixture);
    spec.bays[1].components.push(
      { id: "drawer-bank-r1", type: COMPONENT_TYPES.DRAWER_BANK, offsetFromBottomMm: 0, rows: 3 },
      { id: "shelf-fix-r9", type: COMPONENT_TYPES.SHELF_FIXED, offsetFromBottomMm: 1500, thicknessMm: 18, depthMm: 560 }
    );

    const graph = buildStructuralPartGraph(spec);
    expect(graph.componentOutcomes).toHaveLength(acceptedComponentCount(spec));
    expect(graph.summary.totalComponents).toBe(acceptedComponentCount(spec));

    const sum =
      graph.summary.structuralComponents +
      graph.summary.previewComponents +
      graph.summary.unsupportedComponents;
    expect(sum).toBe(graph.summary.totalComponents);
  });

  it("rejects a wholly unknown component type at FurniSpec validation", () => {
    // First line of defence: a type that is in no enum never reaches the
    // kernel at all. Documented here so the backstop below is understood as
    // defence in depth rather than the primary guard.
    const spec = clone(fixture);
    spec.bays[0].components.push({ id: "mystery-01", type: "SHOE_RACK", offsetFromBottomMm: 200 });

    const result = validateFurniSpec(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain("UNSUPPORTED_COMPONENT_TYPE");
    expect(() => buildStructuralPartGraph(spec)).toThrow(/Unknown component type/);
  });

  it("backstops a declared-but-unwired type with an honest diagnostic, not silence", () => {
    // Second line of defence, exercised directly on the ledger: a type added
    // to COMPONENT_TYPES (so validation accepts it) but never given a policy
    // or a kernel branch. The required behaviour is a reported refusal.
    const ledger = createComponentLedger();
    ledger.recordUnsupported({ id: "future-01", type: "SHOE_RACK" }, 0);
    const { componentOutcomes, counts } = ledger.finish();

    expect(counts.unsupportedComponents).toBe(1);
    const [entry] = componentOutcomes;
    expect(entry.outcome).toBe(COMPONENT_OUTCOME.UNSUPPORTED);
    expect(entry.diagnosticCode).toBe(COMPONENT_DIAGNOSTIC_CODE.UNDECLARED_COMPONENT_TYPE);
    expect(entry.undeclared).toBe(true);
    expect(entry.customerMessage).toBeTruthy();
    expect(entry.partIds).toEqual([]);
  });

  it("refuses to record the same component twice at the ledger level", () => {
    const ledger = createComponentLedger();
    const comp = { id: "shelf-x", type: COMPONENT_TYPES.SHELF_FIXED };
    ledger.recordStructural(comp, 0, ["SHELF_X"]);
    expect(() => ledger.recordStructural(comp, 0, ["SHELF_X"])).toThrow(/recorded twice/i);
  });

  it("never records the same component twice", () => {
    const spec = clone(fixture);
    spec.bays[0].components.push({ id: "drawer-bank-dup", type: COMPONENT_TYPES.DRAWER_BANK, offsetFromBottomMm: 0, rows: 2 });
    const graph = buildStructuralPartGraph(spec);
    const ids = graph.componentOutcomes.map((e) => `${e.bayIndex}:${e.componentId}`);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
