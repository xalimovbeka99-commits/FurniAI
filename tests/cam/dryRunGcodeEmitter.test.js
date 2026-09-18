import { describe, it, expect } from "vitest";
import { buildStructuralPartGraph } from "../../src/lib/partgraph/buildStructuralPartGraph.js";
import golden from "../../src/lib/furnispec/goldenWardrobe.fixture.json";
import {
  emitDryRunGcode,
  emitDryRunGcodeFromOperations,
  exportDryRunGcodeFile,
  buildSafetyHeader,
  DRY_RUN_WARNING,
} from "../../src/lib/cam/emitters/dryRunGcodeEmitter.js";
import { UNAUTHENTICATED_MACHINE_PROFILE } from "../../src/lib/cam/neutralOperations.js";

describe("dryRunGcodeEmitter M3.2", () => {
  it("safety header includes metric/absolute/plane/comp-cancel and dry-run warning", () => {
    const h = buildSafetyHeader("TEST").join("\n");
    expect(h).toContain(DRY_RUN_WARNING);
    expect(h).toContain("G21");
    expect(h).toContain("G90");
    expect(h).toContain("G17");
    expect(h).toContain("G40");
    expect(h).toContain("M05");
  });

  it("emits dry-run G-code from Golden Wardrobe with warning headers", () => {
    const graph = buildStructuralPartGraph(golden);
    const { gcode, ir } = emitDryRunGcode(graph, {
      programName: "GOLDEN_DRY_RUN",
      toolSku: "COMPRESSION_6MM",
      toolNumber: 3,
    });
    expect(ir.operations.length).toBeGreaterThan(0);
    expect(gcode.startsWith(DRY_RUN_WARNING)).toBe(true);
    expect(gcode).toContain(DRY_RUN_WARNING);
    expect(gcode).toContain("G21");
    expect(gcode).toContain("G90");
    expect(gcode).toContain("G17");
    expect(gcode).toContain("G40");
    expect(gcode).toContain("M06 T3");
    expect(gcode).toContain("G00");
    expect(gcode).toContain("G01");
    expect(gcode).toContain("M30");
    // System 32 stays comment-gated â€” no plunge cycle
    expect(gcode).toMatch(/FAIL-CLOSED: no G81\/G83/);
    expect(gcode).not.toMatch(/^G81/m);
  });

  it("exportDryRunGcodeFile throws without signed profile", () => {
    const graph = buildStructuralPartGraph(golden);
    try {
      exportDryRunGcodeFile(graph, null);
      expect.unreachable();
    } catch (err) {
      expect(err.code).toBe(UNAUTHENTICATED_MACHINE_PROFILE);
    }
  });

  it("exportDryRunGcodeFile succeeds with signed profile but keeps dry-run warning", () => {
    const graph = buildStructuralPartGraph(golden);
    const out = exportDryRunGcodeFile(
      graph,
      { id: "homag-lab-01", signed: true },
      { programName: "LAB" }
    );
    expect(out.filename).toContain("homag-lab-01");
    expect(out.filename).toMatch(/\.dryrun\.nc$/);
    expect(out.gcode).toContain(DRY_RUN_WARNING);
  });

  it("emitDryRunGcodeFromOperations is the operations[] interface", () => {
    const text = emitDryRunGcodeFromOperations(
      [
        {
          id: "OUTLINE_001",
          hostPartId: "P1",
          type: "OUTLINE_CONTOUR",
          status: "DRY_RUN_ONLY",
          toolDiameterMm: 6,
          stepDownDepthsMm: [3, 6],
          pathMm: [
            [0, 0],
            [100, 0],
            [100, 50],
            [0, 50],
            [0, 0],
          ],
        },
      ],
      { programName: "UNIT" }
    );
    expect(text).toContain("OUTLINE_CONTOUR OUTLINE_001");
    expect(text).toContain("G01");
  });
});
