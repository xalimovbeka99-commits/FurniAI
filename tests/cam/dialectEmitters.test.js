import { describe, it, expect } from "vitest";
import { buildStructuralPartGraph } from "../../src/lib/partgraph/buildStructuralPartGraph.js";
import golden from "../../src/lib/furnispec/goldenWardrobe.fixture.json";
import { UNAUTHENTICATED_MACHINE_PROFILE } from "../../src/lib/cam/neutralOperations.js";
import {
  emitDryRunWoodwopMpr,
  exportDryRunWoodwopMprFile,
  WOODWOP_DRY_RUN_MARKER,
} from "../../src/lib/cam/emitters/woodwopMprEmitter.js";
import {
  emitDryRunBiesseCix,
  exportDryRunBiesseCixFile,
  BIESSE_DRY_RUN_ATTR,
} from "../../src/lib/cam/emitters/biesseCixEmitter.js";

/** Live spindle / activation patterns that must never appear in stub output. */
const FORBIDDEN_SPINDLE = [
  /\bM03\b/i,
  /\bM04\b/i,
  /\bM13\b/i,
  /\bM14\b/i,
  /\bSPINDLE\s*=\s*ON\b/i,
  /\bG81\b/,
  /\bG83\b/,
];

describe("dialect emitters — WoodWOP .mpr stub", () => {
  it("emits [HEADER], $P params, and DryRunOnly marker", () => {
    const graph = buildStructuralPartGraph(golden);
    const { mpr, ir } = emitDryRunWoodwopMpr(graph, { programName: "GOLDEN_MPR" });
    expect(ir.operations.length).toBeGreaterThan(0);
    expect(mpr.startsWith("[HEADER]")).toBe(true);
    expect(mpr).toContain("$P Name=");
    expect(mpr).toContain("$P Mode=\"DRY_RUN_SIMULATION_ONLY\"");
    expect(mpr).toContain(WOODWOP_DRY_RUN_MARKER);
    expect(mpr).toContain("FAIL-CLOSED STUB: no WoodWOP boring");
  });

  it("rejects unauthenticated machine profile on file export", () => {
    const graph = buildStructuralPartGraph(golden);
    try {
      exportDryRunWoodwopMprFile(graph, null);
      expect.unreachable();
    } catch (err) {
      expect(err.code).toBe(UNAUTHENTICATED_MACHINE_PROFILE);
    }
  });

  it("exports with signed profile but keeps dry-run / no spindle activation", () => {
    const graph = buildStructuralPartGraph(golden);
    const out = exportDryRunWoodwopMprFile(
      graph,
      { id: "homag-lab-01", signed: true },
      { programName: "LAB" }
    );
    expect(out.filename).toMatch(/\.dryrun\.mpr$/);
    expect(out.mpr).toContain(WOODWOP_DRY_RUN_MARKER);
    for (const re of FORBIDDEN_SPINDLE) {
      expect(out.mpr).not.toMatch(re);
    }
  });
});

describe("dialect emitters — Biesse .cix stub", () => {
  it("emits BEGIN/END MACRO envelope with DRY_RUN=\"1\"", () => {
    const graph = buildStructuralPartGraph(golden);
    const { cix, ir } = emitDryRunBiesseCix(graph, { programName: "GOLDEN_CIX" });
    expect(ir.operations.length).toBeGreaterThan(0);
    expect(cix).toContain('BEGIN ID="MACRO"');
    expect(cix).toContain('END ID="MACRO"');
    expect(cix).toContain(BIESSE_DRY_RUN_ATTR);
    expect(cix).toContain("FAIL-CLOSED STUB: no Biesse boring");
  });

  it("rejects unauthenticated machine profile on file export", () => {
    const graph = buildStructuralPartGraph(golden);
    try {
      exportDryRunBiesseCixFile(graph, {});
      expect.unreachable();
    } catch (err) {
      expect(err.code).toBe(UNAUTHENTICATED_MACHINE_PROFILE);
    }
  });

  it("exports with signed profile but keeps dry-run / no spindle activation", () => {
    const graph = buildStructuralPartGraph(golden);
    const out = exportDryRunBiesseCixFile(
      graph,
      { id: "biesse-lab-01", signed: true },
      { programName: "LAB" }
    );
    expect(out.filename).toMatch(/\.dryrun\.cix$/);
    expect(out.cix).toContain(BIESSE_DRY_RUN_ATTR);
    for (const re of FORBIDDEN_SPINDLE) {
      expect(out.cix).not.toMatch(re);
    }
  });
});
