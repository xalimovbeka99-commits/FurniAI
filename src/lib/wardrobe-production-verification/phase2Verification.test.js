import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, test } from "vitest";
import contract from "../../../tests/wardrobe-production/fixtures/production-contract.json";
import adversarial from "../../../tests/wardrobe-production/fixtures/adversarial-scenarios.json";
import protectedSurfaces from "../../../tests/wardrobe-production/fixtures/phase1-protected-surfaces.json";
import wardrobe62 from "../../../tests/reference/wardrobe62/manifest.json";
import wardrobe73 from "../../../tests/reference/wardrobe73/expected-shelf-positions.json";

function normalizedSha256(content) {
  return createHash("sha256").update(content.replace(/\r\n/g, "\n")).digest("hex");
}

describe("Phase 2 verification fixture integrity", () => {
  it("keeps the approved WardrobeModel as the only source aggregate", () => {
    expect(contract.source).toEqual({
      aggregate: "WardrobeModel",
      approvedRevisionRequired: true,
      secondCanonicalFurnitureModelForbidden: true
    });
  });

  it("pins the 2400mm three-section clear-width reconciliation to 2328mm", () => {
    const example = contract.sectionReconciliation.example;
    const calculated = example.outerWidthMm
      - 2 * example.panelThicknessMm
      - (example.sectionCount - 1) * example.panelThicknessMm;
    expect(calculated).toBe(2328);
    expect(calculated).toBe(example.availableClearWidthMm);
  });

  it("requires stable manufacturing identity and source traceability", () => {
    expect(contract.panel).toMatchObject({
      stableIdentityRequired: true,
      orderDerivedIdsForbidden: true,
      sourceTraceabilityRequired: true
    });
    expect(contract.panel.requiredFields).toEqual(expect.arrayContaining(["id", "sourceComponentId", "machiningOperations"]));
  });

  it("defines the required production-blocking attack set", () => {
    expect(adversarial.defaultExpected).toEqual({
      productionStatus: "PRODUCTION_BLOCKED",
      pdfGenerated: false,
      sourceWardrobeUnchanged: true
    });
    expect(adversarial.cases).toHaveLength(13);
    expect(new Set(adversarial.cases.map((entry) => entry.id)).size).toBe(adversarial.cases.length);
  });

  it("does not misrepresent missing reference PDFs as verified evidence", () => {
    expect(wardrobe62).toMatchObject({ status: "BLOCKED_NO_SOURCE", sourceDocument: null, facts: [] });
    expect(wardrobe73).toMatchObject({ status: "CANDIDATE" });
    expect(wardrobe73.source.documentAvailable).toBe(false);
    expect(wardrobe73.authorization.mayDriveProduction).toBe(false);
    expect(wardrobe73.positionsMm).toEqual([370, 788, 1206, 1624, 2042, 2462]);
  });

  it("excludes nesting and CNC from Phase 2 outputs", () => {
    expect(contract.phase2ForbiddenOutputs).toEqual(["NESTING", "CNC", "DXF_MACHINE_POSTPROCESSOR"]);
  });
});

describe("Phase 1 protected-surface regression hashes", () => {
  for (const [relativePath, expectedHash] of Object.entries(protectedSurfaces.files)) {
    it(`preserves ${relativePath}`, async () => {
      const content = await readFile(path.resolve(process.cwd(), relativePath), "utf8");
      expect(normalizedSha256(content)).toBe(expectedHash);
    });
  }
});

describe("Phase 2 production verification — blocked pending Claude interfaces", () => {
  test.todo("BLOCKED: derive stable manufacturing panels twice and compare canonical output across 100 runs");
  test.todo("BLOCKED: reconcile carcass sides, dividers, and section clear widths against the approved WardrobeModel");
  test.todo("BLOCKED: verify every assembly-graph connection references two existing panels");
  test.todo("BLOCKED: verify only applicable APPROVED joinery rules generate machining operations");
  test.todo("BLOCKED: verify drilling bounds, faces, depths, and mating-operation alignment");
  test.todo("BLOCKED: verify shelf bottom, centerline, top, and clear-opening schedules");
  test.todo("BLOCKED: execute all adversarial scenarios and prove production/PDF generation is blocked atomically");
  test.todo("BLOCKED: reconcile individual panel identities with cut-list quantities and machining variants");
  test.todo("BLOCKED: reconcile hardware BOM quantities with connections and joinery rules");
  test.todo("BLOCKED: prove drawing data and PDF values exactly match the validated production artifacts");
  test.todo("BLOCKED_NO_SOURCE: verify Wardrobe 62 facts after its source drawing is supplied and reviewed");
  test.todo("BLOCKED_NO_SOURCE: verify Wardrobe 73 B2 candidate positions against the actual source drawing");
});
