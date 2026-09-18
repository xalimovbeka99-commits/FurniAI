import { describe, it, expect } from "vitest";
import { buildStructuralPartGraph } from "../../src/lib/partgraph/buildStructuralPartGraph.js";
import golden from "../../src/lib/furnispec/goldenWardrobe.fixture.json";
import {
  compileNeutralOperations,
  exportNeutralOperationsForMachine,
  assertAuthenticatedMachineProfile,
  isAuthenticatedMachineProfile,
  closedOutlinePolylineMm,
  OPERATION_TYPES,
  OP_STATUS,
  UNAUTHENTICATED_MACHINE_PROFILE,
  CAM_FACES,
} from "../../src/lib/cam/neutralOperations.js";

describe("neutralOperations M3.1", () => {
  it("builds a closed outline polyline (first == last)", () => {
    const path = closedOutlinePolylineMm(1800, 580);
    expect(path.length).toBe(5);
    expect(path[0]).toEqual(path[path.length - 1]);
  });

  it("rejects unauthenticated machine profiles", () => {
    expect(isAuthenticatedMachineProfile(null)).toBe(false);
    expect(isAuthenticatedMachineProfile("")).toBe(false);
    expect(isAuthenticatedMachineProfile({ id: "homag-1" })).toBe(false);
    expect(isAuthenticatedMachineProfile({ id: "homag-1", signed: true })).toBe(true);
    expect(() => assertAuthenticatedMachineProfile(null)).toThrowError();
    try {
      assertAuthenticatedMachineProfile(undefined);
    } catch (err) {
      expect(err.code).toBe(UNAUTHENTICATED_MACHINE_PROFILE);
    }
  });

  it("compiles DRY_RUN_ONLY ops from Golden Wardrobe PartGraph", () => {
    const graph = buildStructuralPartGraph(golden);
    const ir = compileNeutralOperations(graph);
    expect(ir.irVersion).toMatch(/neutral-ops/);
    expect(ir.operations.length).toBeGreaterThan(0);
    expect(ir.counts.outline).toBeGreaterThan(0);
    expect(ir.counts.boreSystem32).toBeGreaterThan(0);

    for (const op of ir.operations) {
      expect(op.status).toBe(OP_STATUS.DRY_RUN_ONLY);
      expect(op.machineOutput).toBeNull();
      expect(op.toolPath).toBeNull();
    }

    const outlines = ir.operations.filter((o) => o.type === OPERATION_TYPES.OUTLINE_CONTOUR);
    expect(outlines.length).toBeGreaterThan(0);
    for (const o of outlines) {
      expect(o.closed).toBe(true);
      expect(o.pathMm[0]).toEqual(o.pathMm[o.pathMm.length - 1]);
      expect(o.toolDiameterMm).toBeGreaterThan(0);
      expect(Array.isArray(o.stepDownDepthsMm)).toBe(true);
      expect(o.stepDownDepthsMm.length).toBeGreaterThan(0);
    }

    const bores = ir.operations.filter((o) => o.type === OPERATION_TYPES.BORE_SYSTEM_32);
    expect(bores.length).toBeGreaterThan(0);
    for (const b of bores) {
      expect(b.centerMm).toBeNull();
      expect(b.diameterMm).toBe(5);
      expect(b.face).toBe(CAM_FACES.EDGE);
      expect(b.hardwareGate).toBe("BLOCKED_PENDING_HARDWARE_APPROVAL");
    }

    const grooves = ir.operations.filter((o) => o.type === OPERATION_TYPES.POCKET_GROOVE);
    expect(grooves.length).toBeGreaterThan(0);
    for (const g of grooves) {
      expect(g.widthMm).toBe(6);
      expect(g.depthMm).toBeGreaterThan(0);
      expect(Array.isArray(g.startMm)).toBe(true);
      expect(Array.isArray(g.endMm)).toBe(true);
    }
  });

  it("throws UNAUTHENTICATED_MACHINE_PROFILE on raw export without profile", () => {
    const graph = buildStructuralPartGraph(golden);
    expect(() => exportNeutralOperationsForMachine(graph, null)).toThrowError();
    try {
      exportNeutralOperationsForMachine(graph, {});
    } catch (err) {
      expect(err.code).toBe(UNAUTHENTICATED_MACHINE_PROFILE);
    }
  });

  it("allows export path only with signed machine profile", () => {
    const graph = buildStructuralPartGraph(golden);
    const ir = exportNeutralOperationsForMachine(graph, {
      id: "homag-woodwop-lab-01",
      signed: true,
    });
    expect(ir.machineProfileAuthenticated).toBe(true);
    expect(ir.operations.every((o) => o.status === OP_STATUS.DRY_RUN_ONLY)).toBe(true);
  });

  it("refuses invalid / degenerate PartGraphs", () => {
    const graph = buildStructuralPartGraph(golden);
    const bad = {
      ...graph,
      parts: graph.parts.map((p, i) =>
        i === 0
          ? {
              ...p,
              finished: { ...p.finished, lengthDmm: 0 },
              raw: { ...p.raw, lengthDmm: 0 },
            }
          : p
      ),
    };
    expect(() => compileNeutralOperations(bad)).toThrowError(/invalid PartGraph/i);
  });
});
