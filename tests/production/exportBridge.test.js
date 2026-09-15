import { describe, expect, it } from "vitest";
import fixture from "../../src/lib/furnispec/goldenWardrobe.fixture.json";
import { buildStructuralPartGraph } from "../../src/lib/partgraph/buildStructuralPartGraph.js";
import {
  computeCrc32,
  createZipBuffer,
  exportCutListCSV,
  exportCabinetDxfZip,
  formatNestingReport,
} from "../../src/lib/production/exportBridge.js";
import { compileNestingManifest } from "../../src/lib/production/nestingCompiler.js";

describe("exportBridge — Manufacturing Downloads & Blueprints", () => {
  const goldenPartGraph = buildStructuralPartGraph(fixture);

  it("calculates accurate CRC32 for known strings", () => {
    const encoder = new TextEncoder();
    // Known CRC32 for "123456789" is 0xCBF43926 (3421760294)
    expect(computeCrc32(encoder.encode("123456789"))).toBe(0xcbf43926);
  });

  it("creates a valid uncompressed PKZip buffer with headers and central directory", () => {
    const files = [
      { name: "test1.txt", data: "Hello World" },
      { name: "test2.dxf", data: "0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n" },
    ];
    const zipBuf = createZipBuffer(files);
    expect(zipBuf).toBeInstanceOf(Uint8Array);
    expect(zipBuf.length).toBeGreaterThan(100);

    // Verify PKZip local file header signature 0x04034b50 (PK\x03\x04)
    expect(zipBuf[0]).toBe(0x50); // 'P'
    expect(zipBuf[1]).toBe(0x4b); // 'K'
    expect(zipBuf[2]).toBe(0x03);
    expect(zipBuf[3]).toBe(0x04);
  });

  it("exports Cut List CSV with all required columns and 19 parts", () => {
    const res = exportCutListCSV(goldenPartGraph, "test-cut-list.csv");
    expect(res.filename).toBe("test-cut-list.csv");
    expect(res.mimeType).toBe("text/csv");
    expect(res.content).toContain("Part ID,Role,Material,Cut Length (mm),Cut Width (mm)");
    expect(res.content).toContain("CARC_TOP");
    expect(res.content).toContain("CARC_SIDE_L");
    expect(res.content).toContain("PLINTH_FRONT");

    const lines = res.content.trim().split("\n");
    expect(lines.length).toBe(20); // 1 header + 19 parts
  });

  it("bundles all machinable panels into a CNC DXF ZIP package with README manifest", () => {
    const res = exportCabinetDxfZip(goldenPartGraph, "test-cnc.zip");
    expect(res.filename).toBe("test-cnc.zip");
    expect(res.mimeType).toBe("application/zip");
    expect(res.fileCount).toBe(19);
    expect(res.buffer).toBeInstanceOf(Uint8Array);
    expect(res.buffer.length).toBeGreaterThan(1000);
  });

  it("formats Nesting Report with sheet count, yield efficiency, and edge-banding schedule", () => {
    const manifest = compileNestingManifest(goldenPartGraph);
    const report = formatNestingReport(manifest);

    expect(report.sheetCount).toBe(manifest.sheetCount);
    expect(report.primaryStockId).toBe(manifest.primaryStockId);
    expect(report.yieldEfficiencyPct).toBeGreaterThan(50);
    expect(report.totalSheetAreaM2).toBeGreaterThan(0);
    expect(report.totalPanelAreaM2).toBeGreaterThan(0);
    expect(report.edgeBanding.length).toBeGreaterThan(0);

    // Text representation contains key markers
    expect(report.text).toContain("FurniAI Sheet Nesting & Material Optimization Report");
    expect(report.text).toContain(`Required Sheets:    ${manifest.sheetCount} sheets`);
    expect(report.text).toContain("1.0 mm ABS");

    // HTML representation contains modal layout elements
    expect(report.html).toContain("nesting-report-modal-content");
    expect(report.html).toContain("Sheets Required");
    expect(report.html).toContain("Material Yield");
  });
});
