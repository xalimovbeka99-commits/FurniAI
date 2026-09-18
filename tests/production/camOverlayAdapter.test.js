import { describe, it, expect, beforeEach } from "vitest";
import goldenSpec from "../../src/lib/furnispec/goldenWardrobe.fixture.json";
import { buildStructuralPartGraph } from "../../src/lib/partgraph/buildStructuralPartGraph.js";
import {
  compileNeutralOperations,
  OPERATION_TYPES,
  OP_STATUS,
} from "../../src/lib/cam/neutralOperations.js";
import {
  mapNeutralOperationsToOverlayProps,
  mapPartLocalToWorld,
  CAM_TOOL_SKUS,
  DEFAULT_CLEARANCE_Z_MM,
} from "../../src/lib/cam/camOverlayAdapter.js";

describe("M3 camOverlayAdapter Suite: Neutral IR -> 3D Viewport Overlays", () => {
  let partGraph;
  let neutralIr;

  beforeEach(() => {
    partGraph = buildStructuralPartGraph(goldenSpec);
    neutralIr = compileNeutralOperations(partGraph);
  });

  it("ingests operations[] from compileNeutralOperations and produces valid overlay props", () => {
    const props = mapNeutralOperationsToOverlayProps(neutralIr.operations, { partGraph });

    expect(props).toBeDefined();
    expect(Array.isArray(props.camCutFeedTrajectories)).toBe(true);
    expect(Array.isArray(props.camRapidTrajectories)).toBe(true);
    expect(Array.isArray(props.camGrooveTrajectories)).toBe(true);
    expect(Array.isArray(props.drillMarkers)).toBe(true);
    expect(Array.isArray(props.kerfRibbons)).toBe(true);
    expect(Array.isArray(props.stepSequences)).toBe(true);
    expect(props.totalOps).toBe(neutralIr.operations.length);
  });

  it("extracts OUTLINE_CONTOUR segments into camCutFeedTrajectories with cyan kerf ribbon metadata", () => {
    const props = mapNeutralOperationsToOverlayProps(neutralIr.operations, { partGraph });

    expect(props.camCutFeedTrajectories.length).toBeGreaterThan(0);

    for (const cut of props.camCutFeedTrajectories) {
      expect(cut.type).toBe("G01");
      expect(cut.isCutting).toBe(true);
      expect(cut.category).toBe("CONTOUR");
      expect(cut.cutterDiameterMm).toBeGreaterThanOrEqual(6.0);
      expect(cut.kerfMm).toBeGreaterThanOrEqual(6.0);
      expect(cut.toolSku).toBe(CAM_TOOL_SKUS.OUTLINE_CONTOUR);
      expect(cut.feedRate).toBeGreaterThan(0);
      expect(cut.zDepthMm).toBeLessThanOrEqual(0); // Cut depth into panel
    }

    // Verify kerf ribbon metadata
    expect(props.kerfRibbons.length).toBeGreaterThanOrEqual(props.camCutFeedTrajectories.length);
    const firstRibbon = props.kerfRibbons[0];
    expect(firstRibbon.widthMm).toBeGreaterThanOrEqual(6.0);
    expect(firstRibbon.from).toBeDefined();
    expect(firstRibbon.to).toBeDefined();
  });

  it("calculates transit steps between operations into camRapidTrajectories at Z_safe = +25 mm", () => {
    const props = mapNeutralOperationsToOverlayProps(neutralIr.operations, {
      partGraph,
      clearanceZMm: DEFAULT_CLEARANCE_Z_MM,
    });

    expect(props.camRapidTrajectories.length).toBeGreaterThan(0);

    // Filter for transit rapids specifically
    const transitRapids = props.camRapidTrajectories.filter(
      (r) => r.opId && r.opId.startsWith("TRANSIT_")
    );
    expect(transitRapids.length).toBeGreaterThan(0);

    for (const transit of transitRapids) {
      expect(transit.type).toBe("G00");
      expect(transit.category).toBe("RAPID");
      expect(transit.isCutting).toBe(false);
      expect(transit.zDepthMm).toBe(25.0); // Z_safe = +25 mm
      expect(transit.from).toBeDefined();
      expect(transit.to).toBeDefined();
    }
  });

  it("maps POCKET_GROOVE operations to neon lime groove paths in camGrooveTrajectories", () => {
    const props = mapNeutralOperationsToOverlayProps(neutralIr.operations, { partGraph });

    expect(props.camGrooveTrajectories.length).toBeGreaterThan(0);

    for (const groove of props.camGrooveTrajectories) {
      expect(groove.category).toBe("GROOVE");
      expect(groove.type === "G01" || groove.type === "G00").toBe(true);
      expect(groove.cutterDiameterMm).toBe(6.0); // 6mm back groove width
      expect(groove.toolSku).toBe(CAM_TOOL_SKUS.POCKET_GROOVE);
      if (groove.isCutting) {
        expect(groove.zDepthMm).toBeLessThan(0); // Groove plunge depth (-8mm)
      }
    }
  });

  it("extracts drill target positions from BORE_SYSTEM_32 into drillMarkers with status GATED/BLOCKED", () => {
    const props = mapNeutralOperationsToOverlayProps(neutralIr.operations, { partGraph });

    expect(props.drillMarkers.length).toBeGreaterThan(0);

    for (const marker of props.drillMarkers) {
      expect(marker.status).toBe("GATED/BLOCKED"); // Explicit invariant requirement
      expect(marker.hardwareGate).toBe("BLOCKED_PENDING_HARDWARE_APPROVAL");
      expect(marker.diameterMm).toBe(5.0);
      expect(marker.depthMm).toBe(13.0);
      expect(marker.toolSku).toBe(CAM_TOOL_SKUS.BORE_SYSTEM_32);
      expect(marker.worldPosition).toBeDefined();
      expect(typeof marker.worldPosition.x).toBe("number");
      expect(typeof marker.worldPosition.y).toBe("number");
      expect(typeof marker.worldPosition.z).toBe("number");
    }
  });

  it("asserts stepSequences have aligned active Z-depth, feedrate, and tool SKU", () => {
    const props = mapNeutralOperationsToOverlayProps(neutralIr.operations, { partGraph });

    expect(props.stepSequences.length).toBeGreaterThan(0);

    for (const step of props.stepSequences) {
      expect(typeof step.zDepthMm).toBe("number");
      expect(typeof step.feedRate).toBe("number");
      expect(step.feedRate).toBeGreaterThan(0);
      expect(typeof step.toolSku).toBe("string");
      expect(step.toolSku.length).toBeGreaterThan(0);
      expect(step.from).toBeDefined();
      expect(step.to).toBeDefined();
    }
  });

  it("gracefully handles empty operations array and missing partGraph", () => {
    const emptyProps = mapNeutralOperationsToOverlayProps([]);
    expect(emptyProps.totalOps).toBe(0);
    expect(emptyProps.stepSequences.length).toBe(0);

    // Call without partGraph
    const dummyOp = [
      {
        id: "OUTLINE_DUMMY",
        hostPartId: "NON_EXISTENT",
        type: OPERATION_TYPES.OUTLINE_CONTOUR,
        status: OP_STATUS.DRY_RUN_ONLY,
        pathMm: [[0, 0], [100, 0], [100, 100], [0, 0]],
        toolDiameterMm: 6.0,
      },
    ];
    const fallbackProps = mapNeutralOperationsToOverlayProps(dummyOp);
    expect(fallbackProps.totalOps).toBe(1);
    expect(fallbackProps.camCutFeedTrajectories.length).toBeGreaterThan(0);
  });
});
