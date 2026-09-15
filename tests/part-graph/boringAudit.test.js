/**
 * Adversarial QA — boring / drilling depth fail-closed audit.
 *
 * Production PartGraph blocks hardware drilling (BACK_GROOVE only APPROVED).
 * These tests prove auditBoringDepths rejects unsafe synthetic ops without
 * unlocking CNC, and that serialize/build still report drilling BLOCKED.
 */
import { describe, expect, it } from "vitest";
import fixture from "../../src/lib/furnispec/goldenWardrobe.fixture.json";
import { buildStructuralPartGraph } from "../../src/lib/partgraph/buildStructuralPartGraph.js";
import { formatPartGraphReport } from "../../src/lib/partgraph/serializePartGraph.js";
import { auditBoringDepths } from "../../src/lib/partgraph/boringDepthAudit.js";

describe("PartGraph boring depth adversarial audit", () => {
  it("golden structural ops are BACK_GROOVE only (no hardware drilling unlocked)", () => {
    const graph = buildStructuralPartGraph(fixture);
    expect(graph.operations.length).toBe(4);
    for (const op of graph.operations) {
      expect(op.type).toBe("BACK_GROOVE");
      expect(op.status).toBe("APPROVED");
    }
    expect(fixture.machiningPolicy.drilling).toBe("BLOCKED_PENDING_HARDWARE_APPROVAL");
  });

  it("serialize report still states Hardware drilling: BLOCKED", () => {
    const graph = buildStructuralPartGraph(fixture);
    const report = formatPartGraphReport(graph);
    expect(report.text).toMatch(/Hardware drilling:\s*BLOCKED/i);
  });

  it("build summary counts blocked operations separately from approved grooves", () => {
    const graph = buildStructuralPartGraph(fixture);
    expect(graph.summary.approvedOperations).toBe(4);
    expect(graph.summary.blockedOperations).toBe(0);
    // Inject a blocked synthetic drill description onto the graph object only —
    // does not change kernel output or unlock CNC.
    graph.operations.push({
      id: "SYNTH_DRILL_BLOCKED",
      hostPartId: "CARC_SIDE_L",
      type: "BORE",
      status: "BLOCKED_PENDING_HARDWARE_APPROVAL",
      depthMm: 10,
      diameterMm: 5,
    });
    expect(graph.operations.filter((o) => o.status !== "APPROVED").length).toBe(1);
  });

  it("accepts safe blind bore depth at panelThickness - 3 mm", () => {
    const result = auditBoringDepths(
      [{ id: "B1", type: "BORE", hostPartId: "CARC_SIDE_L", depthMm: 15, diameterMm: 5 }],
      { panelThicknessMm: 18 }
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects blind bore deeper than panelThickness - 3 mm", () => {
    const result = auditBoringDepths(
      [{ id: "B_DEEP", type: "BLIND_BORE", hostPartId: "CARC_SIDE_L", depthMm: 16, diameterMm: 5 }],
      { panelThicknessMm: 18 }
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "BLIND_BORE_DEPTH_EXCEEDED")).toBe(true);
  });

  it("rejects DRILL synonym when depth exceeds blind max", () => {
    const result = auditBoringDepths(
      [{ id: "D1", type: "DRILL", depthMm: 18, diameterMm: 8 }],
      { panelThicknessMm: 18 }
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "BLIND_BORE_DEPTH_EXCEEDED")).toBe(true);
  });

  it("shelf pin: accepts Ø5 mm × 13 mm in 18 mm panel", () => {
    const result = auditBoringDepths(
      [{ id: "SP_OK", type: "SHELF_PIN", depthMm: 13, diameterMm: 5 }],
      { panelThicknessMm: 18 }
    );
    expect(result.valid).toBe(true);
  });

  it("shelf pin: rejects deeper than 13 mm in 18 mm panel", () => {
    const result = auditBoringDepths(
      [{ id: "SP_DEEP", type: "SHELF_PIN", depthMm: 14, diameterMm: 5 }],
      { panelThicknessMm: 18 }
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "SHELF_PIN_DEPTH_EXCEEDED")).toBe(true);
  });

  it("shelf pin: rejects wrong diameter", () => {
    const result = auditBoringDepths(
      [{ id: "SP_DIA", type: "LINE_BORE", depthMm: 10, diameterMm: 8 }],
      { panelThicknessMm: 18 }
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "SHELF_PIN_DIAMETER_REJECTED")).toBe(true);
  });

  it("hinge cup: accepts Ø35 mm × 12.5 mm in 18 mm door", () => {
    const result = auditBoringDepths(
      [{ id: "HC_OK", type: "HINGE_CUP", depthMm: 12.5, diameterMm: 35 }],
      { doorThicknessMm: 18 }
    );
    expect(result.valid).toBe(true);
  });

  it("hinge cup: rejects deeper than 12.5 mm in 18 mm door", () => {
    const result = auditBoringDepths(
      [{ id: "HC_DEEP", type: "HINGE_CUP", depthMm: 13, diameterMm: 35 }],
      { doorThicknessMm: 18 }
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "HINGE_CUP_DEPTH_EXCEEDED")).toBe(true);
  });

  it("hinge cup: rejects wrong diameter", () => {
    const result = auditBoringDepths(
      [{ id: "HC_DIA", type: "HINGE_CUP", depthMm: 12, diameterMm: 26 }],
      { doorThicknessMm: 18 }
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "HINGE_CUP_DIAMETER_REJECTED")).toBe(true);
  });

  it("REJECTED when back groove intersects Minifix cam on same host", () => {
    const result = auditBoringDepths([
      {
        id: "OP_GRV_SIDE_L",
        type: "BACK_GROOVE",
        hostPartId: "CARC_SIDE_L",
        widthMm: 7,
        depthMm: 7,
        spanMm: { min: 560, max: 567 },
      },
      {
        id: "CAM_CONFLICT",
        type: "MINIFIX_CAM",
        hostPartId: "CARC_SIDE_L",
        depthMm: 12,
        diameterMm: 15,
        positionMm: { y: 563 },
      },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "REJECTED")).toBe(true);
  });

  it("REJECTED when shelf-support line bore flagged as conflicting with groove", () => {
    const result = auditBoringDepths([
      {
        id: "OP_GRV_TOP",
        type: "BACK_GROOVE",
        hostPartId: "CARC_TOP",
        widthDmm: 70,
        depthDmm: 70,
      },
      {
        id: "LINE_CONFLICT",
        type: "SHELF_SUPPORT_BORE",
        hostPartId: "CARC_TOP",
        depthMm: 10,
        diameterMm: 5,
        conflictsWithGroove: true,
      },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "REJECTED")).toBe(true);
  });

  it("fail-closes same-host cam without positions (ambiguous machining)", () => {
    const result = auditBoringDepths([
      { id: "G1", type: "BACK_GROOVE", hostPartId: "CARC_SIDE_R" },
      { id: "C1", type: "CAM", hostPartId: "CARC_SIDE_R", depthMm: 10, diameterMm: 15 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "REJECTED")).toBe(true);
  });

  it("does not treat non-drill ops as unlock of CNC machining", () => {
    const graph = buildStructuralPartGraph(fixture);
    const audited = auditBoringDepths(graph.operations);
    expect(audited.valid).toBe(true);
    expect(graph.qualificationStatus).not.toBe("CNC_QUALIFIED");
    expect(fixture.machiningPolicy.drilling).toMatch(/BLOCKED/);
  });
});
