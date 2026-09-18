import { describe, it, expect, beforeEach } from "vitest";
import * as THREE from "three";
import goldenSpec from "../../src/lib/furnispec/goldenWardrobe.fixture.json";
import { buildStructuralPartGraph } from "../../src/lib/partgraph/buildStructuralPartGraph.js";
import {
  DEFAULT_KERF_MM,
  EXCLUSION_HALO_MM,
  generatePanelToolpaths,
  buildToolpathTrajectoryMesh,
  generateDefaultVacuumClamps,
  isToolpathCollidingWithClamp,
  detectClampCollisions,
  buildVacuumClampExclusionMesh,
  buildToolheadMesh,
  createCamOverlay,
} from "../../src/components/viewer3d/CamOverlayLayer.jsx";

describe("Milestone M3: CAM Viewport Overlays & Vacuum Pod Visualization Suite", () => {
  let partGraph;

  beforeEach(() => {
    partGraph = buildStructuralPartGraph(goldenSpec);
  });

  it("generates discrete G00 rapid and G01 cutting operations for panels", () => {
    const leftSide = partGraph.parts.find((p) => p.role === "SIDE_PANEL_LEFT");
    expect(leftSide).toBeDefined();

    const ops = generatePanelToolpaths(leftSide, { kerfMm: 9.525 });
    expect(Array.isArray(ops)).toBe(true);
    expect(ops.length).toBeGreaterThanOrEqual(6);

    // Initial move must be G00 rapid to clearance plane
    const firstOp = ops[0];
    expect(firstOp.type).toBe("G00");
    expect(firstOp.isCutting).toBe(false);
    expect(firstOp.zDepthMm).toBe(25); // clearance height

    // Next move must be G01 plunge cut
    const plungeOp = ops[1];
    expect(plungeOp.type).toBe("G01");
    expect(plungeOp.isCutting).toBe(true);
    expect(plungeOp.zDepthMm).toBeLessThan(0); // cutting depth into material

    // Final move must be G00 retract back to clearance
    const lastOp = ops[ops.length - 1];
    expect(lastOp.type).toBe("G00");
    expect(lastOp.isCutting).toBe(false);
    expect(lastOp.zDepthMm).toBe(25);
  });

  it("constructs Three.js trajectory meshes with dashed amber rapid lines and solid cyan feeds", () => {
    const topPanel = partGraph.parts.find((p) => p.role === "TOP_PANEL");
    const ops = generatePanelToolpaths(topPanel);

    const group = buildToolpathTrajectoryMesh(ops, {}, THREE);
    expect(group.isGroup).toBe(true);
    expect(group.name).toBe("camTrajectories");

    // Check Rapid lines (camRapidTrajectories)
    const rapidLines = group.getObjectByName("camRapidTrajectories");
    expect(rapidLines).toBeDefined();
    expect(rapidLines.material.isLineDashedMaterial).toBe(true);
    expect(rapidLines.material.color.getHex()).toBe(0xffb703); // amber

    // Check Cutting Feed lines (camCutFeedTrajectories)
    const cutLines = group.getObjectByName("camCutFeedTrajectories");
    expect(cutLines).toBeDefined();
    expect(cutLines.material.isLineBasicMaterial).toBe(true);
    expect(cutLines.material.color.getHex()).toBe(0x00f5d4); // cyan

    // Check Kerf Ribbon Mesh (camKerfRibbons)
    const ribbonMesh = group.getObjectByName("camKerfRibbons");
    expect(ribbonMesh).toBeDefined();
    expect(ribbonMesh.material.isMeshBasicMaterial).toBe(true);
    expect(ribbonMesh.material.transparent).toBe(true);
    expect(ribbonMesh.geometry.attributes.position.count).toBeGreaterThan(0);
  });

  it("generates vacuum clamps with 15 mm exclusion halo", () => {
    const clamps = generateDefaultVacuumClamps(partGraph, { haloMm: EXCLUSION_HALO_MM });
    expect(Array.isArray(clamps)).toBe(true);
    expect(clamps.length).toBe(6);

    const firstClamp = clamps[0];
    expect(firstClamp.id).toBe("VAC_POD_1_1");
    expect(firstClamp.haloMm).toBe(15.0);
    expect(firstClamp.size.x).toBe(0.14); // 140 mm
    expect(firstClamp.size.y).toBe(0.05); // 50 mm
    expect(firstClamp.size.z).toBe(0.115); // 115 mm
  });

  it("detects collisions when a toolpath penetrates the 15 mm clamp exclusion halo", () => {
    const testClamp = {
      id: "TEST_POD_01",
      center: { x: 0.1, y: 0.0, z: 0.1 },
      size: { x: 0.14, y: 0.05, z: 0.115 },
      haloMm: 15.0,
    };

    // Safe path far away (X = 2.0)
    const safeOp = {
      type: "G01",
      from: { x: 2.0, y: 0.0, z: 0.0 },
      to: { x: 2.5, y: 0.0, z: 0.0 },
      isCutting: true,
      kerfMm: DEFAULT_KERF_MM,
      description: "Safe cut",
    };
    expect(isToolpathCollidingWithClamp(safeOp.from, safeOp.to, safeOp.kerfMm, testClamp)).toBe(false);

    // Colliding path cutting straight through pod center
    const collidingOp = {
      type: "G01",
      from: { x: 0.0, y: 0.0, z: 0.1 },
      to: { x: 0.2, y: 0.0, z: 0.1 },
      isCutting: true,
      kerfMm: DEFAULT_KERF_MM,
      description: "Direct collision cut",
    };
    expect(isToolpathCollidingWithClamp(collidingOp.from, collidingOp.to, collidingOp.kerfMm, testClamp)).toBe(true);

    const result = detectClampCollisions([safeOp, collidingOp], [testClamp]);
    expect(result.hasCollision).toBe(true);
    expect(result.collisions.length).toBe(1);
    expect(result.collisions[0].clampId).toBe("TEST_POD_01");
  });

  it("switches vacuum clamp exclusion mesh to hazard warning red on collision", () => {
    const clamps = [
      { id: "POD_SAFE", center: { x: 1, y: 0, z: 1 }, size: { x: 0.1, y: 0.05, z: 0.1 }, haloMm: 15 },
      { id: "POD_HAZARD", center: { x: 0, y: 0, z: 0 }, size: { x: 0.1, y: 0.05, z: 0.1 }, haloMm: 15 },
    ];

    const collisions = [{ clampId: "POD_HAZARD", opDescription: "Colliding toolpath" }];
    const meshGroup = buildVacuumClampExclusionMesh(clamps, { collisions }, THREE);

    const safeHalo = meshGroup.getObjectByName("halo_POD_SAFE");
    expect(safeHalo).toBeDefined();
    expect(safeHalo.material.color.getHex()).toBe(0x2a9d8f); // green safe halo

    const hazardHalo = meshGroup.getObjectByName("halo_POD_HAZARD");
    expect(hazardHalo).toBeDefined();
    expect(hazardHalo.material.color.getHex()).toBe(0xff0033); // red hazard warning halo
  });

  it("creates dynamic toolhead spindle and cone mesh", () => {
    const toolhead = buildToolheadMesh(9.525, THREE);
    expect(toolhead.isGroup).toBe(true);
    expect(toolhead.name).toBe("camToolheadMesh");

    const cone = toolhead.getObjectByName("toolheadCone");
    expect(cone).toBeDefined();
    expect(cone.material.color.getHex()).toBe(0xff7b00); // safety orange cutter

    const spindle = toolhead.getObjectByName("toolheadSpindle");
    expect(spindle).toBeDefined();
  });

  it("mounts isolated camToolpathsGroup to scene, scrubs t in [0, 1], and disposes cleanly", () => {
    const scene = new THREE.Scene();

    const overlay = createCamOverlay({
      scene,
      partGraph,
      threeInstance: THREE,
    });

    const mountedGroup = scene.getObjectByName("camToolpathsGroup");
    expect(mountedGroup).toBeDefined();
    expect(overlay.operations.length).toBeGreaterThan(0);

    // Scrubbing at t = 0.5
    const stepInfo = overlay.updateSimulationStep(0.5);
    expect(stepInfo).toBeDefined();
    expect(stepInfo.opIndex).toBeGreaterThan(0);
    expect(stepInfo.coords).toBeDefined();
    expect(typeof stepInfo.coords.xMm).toBe("number");
    expect(typeof stepInfo.zDepthMm).toBe("number");

    // Toggle layer visibility
    overlay.setLayersVisibility({
      cutVectors: false,
      rapidTrajectories: false,
      vacuumPods: true,
      kerfRibbon: true,
    });

    const cutMesh = mountedGroup.getObjectByName("camCutFeedTrajectories");
    const rapidMesh = mountedGroup.getObjectByName("camRapidTrajectories");
    if (cutMesh) expect(cutMesh.visible).toBe(false);
    if (rapidMesh) expect(rapidMesh.visible).toBe(false);

    // Clean disposal
    overlay.dispose();
    expect(scene.getObjectByName("camToolpathsGroup")).toBeUndefined();
  });
});
