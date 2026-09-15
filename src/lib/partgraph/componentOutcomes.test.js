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
 *
 * BEK 2026-09-15: DRAWER_BANK is now STRUCTURAL (undermount 21 mm / reveal 2 mm).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildStructuralPartGraph } from "./buildStructuralPartGraph.js";
import { validatePartGraph } from "./validatePartGraph.js";
import { validateFurniSpec } from "../furnispec/validate.js";
import { unrepresentableComponents } from "../conversation/pipeline.js";
import { COMPONENT_TYPES } from "../furnispec/schema.js";
import { PART_ROLES } from "./schema.js";
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
const acceptedComponentCount = (spec) =>
  (spec.bays || []).reduce((n, b) => n + (b.components || []).length, 0);

describe("COMPONENT_REPRESENTATION_POLICY covers every FurniSpec component type", () => {
  it("declares a policy for each COMPONENT_TYPES member", () => {
    for (const type of Object.values(COMPONENT_TYPES)) {
      expect(COMPONENT_REPRESENTATION_POLICY[type], type).toBeDefined();
      expect(Object.values(COMPONENT_OUTCOME)).toContain(COMPONENT_REPRESENTATION_POLICY[type].outcome);
    }
  });
});

describe("golden wardrobe ledger completeness", () => {
  const graph = buildStructuralPartGraph(fixture);

  it("records every accepted component exactly once", () => {
    expect(graph.componentOutcomes).toHaveLength(acceptedComponentCount(fixture));
    const keys = graph.componentOutcomes.map((e) => `${e.bayIndex}:${e.componentId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("counts match the ledger", () => {
    expect(graph.summary.totalComponents).toBe(graph.componentOutcomes.length);
    const sum =
      graph.summary.structuralComponents +
      graph.summary.previewComponents +
      graph.summary.unsupportedComponents;
    expect(sum).toBe(graph.summary.totalComponents);
  });

  it("marks hanging rails as PREVIEW and shelves as STRUCTURAL", () => {
    const byType = Object.fromEntries(
      graph.componentOutcomes.map((e) => [e.componentId, e.outcome])
    );
    expect(byType["shelf-fix-l1"]).toBe(COMPONENT_OUTCOME.STRUCTURAL);
    expect(byType["rail-long-l1"]).toBe(COMPONENT_OUTCOME.PREVIEW);
  });

  it("keeps totalStructuralParts aligned with parts[]", () => {
    expect(graph.summary.totalStructuralParts).toBe(graph.parts.length);
  });

  it("reports no unsupported warnings for a fully supported spec", () => {
    const codes = graph.warnings.map((w) => w.code);
    expect(codes).not.toContain(COMPONENT_DIAGNOSTIC_CODE.COMPONENT_NOT_REPRESENTED);
    expect(codes).not.toContain(COMPONENT_DIAGNOSTIC_CODE.UNDECLARED_COMPONENT_TYPE);
  });
});

describe("a requested DRAWER_BANK is built as STRUCTURAL drawer parts", () => {
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

  it("appears in the ledger as STRUCTURAL with DRAWER_* part ids", () => {
    const graph = buildStructuralPartGraph(specWithDrawerBank());
    const entry = graph.componentOutcomes.find((e) => e.componentId === "drawer-bank-l1");

    expect(entry).toBeDefined();
    expect(entry.outcome).toBe(COMPONENT_OUTCOME.STRUCTURAL);
    expect(entry.componentType).toBe(COMPONENT_TYPES.DRAWER_BANK);
    expect(entry.bayIndex).toBe(0);
    expect(entry.partIds.length).toBe(4 * 5);
    expect(entry.partIds.some((id) => id.includes("FRONT"))).toBe(true);
  });

  it("emits five DRAWER_* roles per row and validates", () => {
    const graph = buildStructuralPartGraph(specWithDrawerBank());
    const roles = new Set(graph.parts.filter((p) => p.role.startsWith("DRAWER_")).map((p) => p.role));
    expect(roles).toEqual(
      new Set([
        PART_ROLES.DRAWER_FRONT,
        PART_ROLES.DRAWER_SIDE_L,
        PART_ROLES.DRAWER_SIDE_R,
        PART_ROLES.DRAWER_BACK,
        PART_ROLES.DRAWER_BOTTOM,
      ])
    );
    expect(validatePartGraph(graph).valid).toBe(true);
    // Golden had 19 parts; 4 rows × 5 panels = +20
    expect(graph.parts.length).toBe(19 + 20);
    expect(graph.summary.totalStructuralParts).toBe(graph.parts.length);
  });

  it("does not treat drawers as unrepresentable once ruled", () => {
    const graph = buildStructuralPartGraph(specWithDrawerBank());
    expect(graph.summary.unsupportedComponents).toBe(0);
    expect(unrepresentableComponents(graph)).toBeNull();
    expect(unsupportedComponentsForCustomer(graph.componentOutcomes)).toEqual([]);
  });

  it("preserves non-drawer geometry from the golden baseline", () => {
    const before = buildStructuralPartGraph(fixture);
    const after = buildStructuralPartGraph(specWithDrawerBank());
    const beforeIds = before.parts.map((p) => p.id).sort();
    const afterNonDrawer = after.parts.filter((p) => !String(p.role).startsWith("DRAWER_")).map((p) => p.id).sort();
    expect(afterNonDrawer).toEqual(beforeIds);
    expect(after.operations).toEqual(before.operations);
  });
});

describe("completeness holds for arbitrary component mixes", () => {
  it("accounts for every component in a multi-bay spec with mixed types", () => {
    const spec = clone(fixture);
    spec.bays[1].components.push(
      { id: "drawer-bank-r1", type: COMPONENT_TYPES.DRAWER_BANK, offsetFromBottomMm: 0, rows: 1 },
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
    expect(validatePartGraph(graph).valid).toBe(true);
  });

  it("rejects a wholly unknown component type at FurniSpec validation", () => {
    const spec = clone(fixture);
    spec.bays[0].components.push({ id: "mystery-01", type: "SHOE_RACK", offsetFromBottomMm: 200 });

    const result = validateFurniSpec(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain("UNSUPPORTED_COMPONENT_TYPE");
    expect(() => buildStructuralPartGraph(spec)).toThrow(/Unknown component type/);
  });

  it("backstops a declared-but-unwired type with an honest diagnostic, not silence", () => {
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
