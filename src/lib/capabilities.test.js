/**
 * The capability description must not be able to lie.
 *
 * Every claim here is checked against the behaviour it describes, using the
 * real kernel rather than the constants the description was built from where
 * that is possible. A claim that "supported" means supported is worth exactly
 * as much as the test behind it.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DESIGN_ENGINE_CAPABILITIES, describeCapabilitiesForCustomer } from "./capabilities.js";
import { buildStructuralPartGraph } from "./partgraph/buildStructuralPartGraph.js";
import { validatePartGraph } from "./partgraph/validatePartGraph.js";
import { COMPONENT_TYPES } from "./furnispec/schema.js";
import { COMPONENT_OUTCOME } from "./partgraph/componentOutcomes.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("./furnispec/goldenWardrobe.fixture.json", import.meta.url)), "utf8")
);
const clone = (o) => JSON.parse(JSON.stringify(o));

describe("the description covers every component type exactly once", () => {
  it("classifies all of them, with no type in two buckets", () => {
    const { structural, preview, unsupported } = DESIGN_ENGINE_CAPABILITIES.components;
    const all = [...structural, ...preview, ...unsupported];
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual(Object.values(COMPONENT_TYPES).sort());
  });
});

describe("claims are checked against what the kernel actually does", () => {
  const graph = buildStructuralPartGraph(fixture);

  it("every type called structural really produces parts", () => {
    for (const type of DESIGN_ENGINE_CAPABILITIES.components.structural) {
      const outcomes = graph.componentOutcomes.filter((e) => e.componentType === type);
      if (outcomes.length === 0) continue; // not exercised by this fixture
      for (const outcome of outcomes) {
        expect(outcome.outcome).toBe(COMPONENT_OUTCOME.STRUCTURAL);
        expect(outcome.partIds.length).toBeGreaterThan(0);
      }
    }
  });

  it("every type called preview produces no parts", () => {
    for (const type of DESIGN_ENGINE_CAPABILITIES.components.preview) {
      for (const outcome of graph.componentOutcomes.filter((e) => e.componentType === type)) {
        expect(outcome.outcome).toBe(COMPONENT_OUTCOME.PREVIEW);
        expect(outcome.partIds).toEqual([]);
      }
    }
  });

  it("every type called unsupported is reported, and leaves the design intact", () => {
    for (const type of DESIGN_ENGINE_CAPABILITIES.components.unsupported) {
      const spec = clone(fixture);
      spec.bays[0].components.push({ id: `probe-${type.toLowerCase()}`, type, offsetFromBottomMm: 0, rows: 2 });

      const probed = buildStructuralPartGraph(spec);
      const outcome = probed.componentOutcomes.find((e) => e.componentId === `probe-${type.toLowerCase()}`);

      expect(outcome, `${type} vanished instead of being reported`).toBeDefined();
      expect(outcome.outcome).toBe(COMPONENT_OUTCOME.UNSUPPORTED);
      expect(outcome.customerMessage).toBeTruthy();
      // The rest of the wardrobe is untouched.
      expect(probed.parts).toEqual(graph.parts);
    }
  });

  it("declares only roles the validator will actually accept", () => {
    // Proven by construction: a part carrying each declared role passes the
    // role check, and one carrying an undeclared role does not.
    for (const role of DESIGN_ENGINE_CAPABILITIES.partRoles) {
      const probe = buildStructuralPartGraph(fixture);
      probe.parts[0].role = role;
      const roleErrors = validatePartGraph(probe).errors.filter((e) => e.code === "INVALID_PART_ROLE");
      expect(roleErrors, `${role} is declared but rejected by the validator`).toEqual([]);
    }

    const bad = buildStructuralPartGraph(fixture);
    bad.parts[0].role = "NOT_A_REAL_ROLE";
    expect(validatePartGraph(bad).errors.some((e) => e.code === "INVALID_PART_ROLE")).toBe(true);
  });
});

describe("the description does not overclaim", () => {
  it("names no furniture family beyond wardrobes", () => {
    expect(DESIGN_ENGINE_CAPABILITIES.furniture.supported).toEqual(["WARDROBE / STRAIGHT_HINGED"]);
  });

  it("keeps machining blocked and says so in every field that could imply otherwise", () => {
    const m = DESIGN_ENGINE_CAPABILITIES.manufacturing;
    expect(m.qualificationStatus).toBe("WORKSHOP_REVIEW_NOT_CNC_QUALIFIED");
    expect(m.drilling).toBe("BLOCKED");
    expect(m.cncExport).toBe("NOT SUPPORTED");
    expect(m.previewsAreNotManufacturingOutput).toBe(true);
    // The golden wardrobe agrees.
    const graph = buildStructuralPartGraph(fixture);
    expect(graph.qualificationStatus).toBe(m.qualificationStatus);
    for (const preview of graph.previews ?? []) {
      expect(preview.manufacturingOutput).toBe(false);
    }
  });

  it("lists DRAWER_BANK as structural and hardware machining as not supported", () => {
    expect(DESIGN_ENGINE_CAPABILITIES.components.structural).toContain(COMPONENT_TYPES.DRAWER_BANK);
    expect(DESIGN_ENGINE_CAPABILITIES.components.unsupported).not.toContain(COMPONENT_TYPES.DRAWER_BANK);
    const text = DESIGN_ENGINE_CAPABILITIES.notSupportedYet.join(" ").toLowerCase();
    expect(text).toMatch(/handle/);
    expect(text).toMatch(/machining|drilling|cnc/);
    expect(DESIGN_ENGINE_CAPABILITIES.manufacturing.drilling).toBe("BLOCKED");
  });

  it("says nothing about the viewer, the browser, or what is deployed", () => {
    const blob = JSON.stringify(DESIGN_ENGINE_CAPABILITIES).toLowerCase();
    for (const word of ["deployed", "production", "browser", "three.js", "vercel"]) {
      expect(blob, `capability description should not claim anything about "${word}"`).not.toContain(word);
    }
  });
});

describe("the customer-facing summary stays consistent with the technical one", () => {
  it("promises nothing the technical description calls unsupported", () => {
    const { canDo, cannotDoYet } = describeCapabilitiesForCustomer();
    const promised = canDo.join(" ").toLowerCase();
    expect(promised).toMatch(/drawer/);
    expect(promised).not.toMatch(/handle/);
    expect(promised).not.toMatch(/drawing|cutting file|cnc/);
    const cannot = cannotDoYet.join(" ").toLowerCase();
    expect(cannot).toMatch(/handle/);
    expect(cannot).toMatch(/cnc|cutting|drawing/);
  });

  it("uses no enum names or engineering units", () => {
    const all = Object.values(describeCapabilitiesForCustomer()).flat().join(" ");
    expect(all).not.toMatch(/[A-Z]{3,}_[A-Z]/);
    expect(all).not.toMatch(/dmm|PartGraph|FurniSpec/i);
  });
});
