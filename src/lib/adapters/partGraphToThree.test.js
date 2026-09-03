/**
 * src/lib/adapters/partGraphToThree.test.js
 * ---------------------------------------------------------------------
 * Unit Tests for PartGraph-to-Three.js Adapter with Door Pivots (G3.1-R1)
 */

import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  partGraphToThree,
  disposePartGraphGroup,
  DMM_TO_THREE,
} from "./partGraphToThree.js";
import { buildStructuralPartGraph } from "../partgraph/buildStructuralPartGraph.js";

const root = process.cwd();
const goldenSpec = JSON.parse(
  readFileSync(resolve(root, "src/lib/furnispec/goldenWardrobe.fixture.json"), "utf8")
);

describe("G3.1-R1 — PartGraph-to-Three.js Adapter Unit Tests", () => {
  const goldenPartGraph = buildStructuralPartGraph(goldenSpec);

  // 1. Exactly 19 structural panel meshes exist across the hierarchy
  it("generates exactly 19 panel meshes for the Golden Wardrobe across the hierarchy", () => {
    const group = partGraphToThree(goldenPartGraph, { threeInstance: THREE });
    const panelMeshes = [];
    group.traverse((c) => {
      if (c.isMesh && c.name && c.name.startsWith("part_")) {
        panelMeshes.push(c);
      }
    });
    expect(panelMeshes.length).toBe(19);
    expect(group.userData.structuralPartCount).toBe(19);
  });

  // 2. Exactly four PartGraph door meshes and four door pivot groups exist
  it("generates exactly four door meshes and four door pivot groups", () => {
    const group = partGraphToThree(goldenPartGraph, { threeInstance: THREE });
    const doorIds = ["DOOR_01", "DOOR_02", "DOOR_03", "DOOR_04"];

    expect(group.userData.doorPivots.length).toBe(4);

    for (const doorId of doorIds) {
      const mesh = group.getObjectByName(`part_${doorId}`);
      expect(mesh).toBeDefined();
      expect(mesh.isMesh).toBe(true);
      expect(mesh.userData.partId).toBe(doorId);
      expect(mesh.userData.role).toBe("DOOR_PANEL");

      const pivot = group.getObjectByName(`pivot_${doorId}`);
      expect(pivot).toBeDefined();
      expect(pivot.isGroup).toBe(true);
      expect(pivot.userData.kind).toBe("door");
      expect(pivot.userData.interactive).toBe(true);
      expect(pivot.userData.partId).toBe(doorId);

      // Verify mesh is child of its pivot
      expect(mesh.parent).toBe(pivot);
      expect(mesh.userData.pivot).toBe(pivot);
    }
  });

  // 3. Every door keeps its stable Part ID and complete metadata
  it("attaches complete metadata to each door and carcass panel", () => {
    const group = partGraphToThree(goldenPartGraph, { threeInstance: THREE });
    for (const part of goldenPartGraph.parts) {
      const mesh = group.getObjectByName(`part_${part.id}`);
      expect(mesh).toBeDefined();
      expect(mesh.userData.partId).toBe(part.id);
      expect(mesh.userData.role).toBe(part.role);
      expect(mesh.userData.finishedDimensionsMm).toBeDefined();
      expect(typeof mesh.userData.finishedDimensionsMm.lengthMm).toBe("number");
      expect(typeof mesh.userData.finishedDimensionsMm.widthMm).toBe("number");
      expect(typeof mesh.userData.finishedDimensionsMm.thicknessMm).toBe("number");
      expect(mesh.userData.placementDmm).toBeDefined();
      expect(mesh.userData.sourceSpecId).toBe(goldenPartGraph.sourceSpecId);
    }
  });

  // 4. Door pivots alternate left/right hinge orientation
  it("alternates left/right hinge orientation across the four doors", () => {
    const group = partGraphToThree(goldenPartGraph, { threeInstance: THREE });

    const p1 = group.getObjectByName("pivot_DOOR_01");
    const p2 = group.getObjectByName("pivot_DOOR_02");
    const p3 = group.getObjectByName("pivot_DOOR_03");
    const p4 = group.getObjectByName("pivot_DOOR_04");

    expect(p1.userData.hinge).toBe("left");
    expect(p2.userData.hinge).toBe("right");
    expect(p3.userData.hinge).toBe("left");
    expect(p4.userData.hinge).toBe("right");

    // Left doors rotate open with positive openY, right doors with negative openY
    expect(p1.userData.openY).toBeGreaterThan(0);
    expect(p2.userData.openY).toBeLessThan(0);
    expect(p3.userData.openY).toBeGreaterThan(0);
    expect(p4.userData.openY).toBeLessThan(0);
  });

  // 5. Pivot locations equal the appropriate PartGraph door edges
  it("places pivot locations exactly at the appropriate PartGraph door hinge edges", () => {
    const group = partGraphToThree(goldenPartGraph, { threeInstance: THREE });

    const d1 = goldenPartGraph.parts.find((p) => p.id === "DOOR_01");
    const d2 = goldenPartGraph.parts.find((p) => p.id === "DOOR_02");
    const d3 = goldenPartGraph.parts.find((p) => p.id === "DOOR_03");
    const d4 = goldenPartGraph.parts.find((p) => p.id === "DOOR_04");

    const p1 = group.getObjectByName("pivot_DOOR_01");
    const p2 = group.getObjectByName("pivot_DOOR_02");
    const p3 = group.getObjectByName("pivot_DOOR_03");
    const p4 = group.getObjectByName("pivot_DOOR_04");

    // Left hinge: X = minX
    expect(p1.position.x).toBeCloseTo(d1.placement.minXDmm * DMM_TO_THREE, 6);
    expect(p3.position.x).toBeCloseTo(d3.placement.minXDmm * DMM_TO_THREE, 6);

    // Right hinge: X = maxX
    expect(p2.position.x).toBeCloseTo(d2.placement.maxXDmm * DMM_TO_THREE, 6);
    expect(p4.position.x).toBeCloseTo(d4.placement.maxXDmm * DMM_TO_THREE, 6);

    // Y and Z centers
    for (const [pivot, door] of [[p1, d1], [p2, d2], [p3, d3], [p4, d4]]) {
      const expY = ((door.placement.minYDmm + door.placement.maxYDmm) / 2) * DMM_TO_THREE;
      const expZ = ((door.placement.minZDmm + door.placement.maxZDmm) / 2) * DMM_TO_THREE;
      expect(pivot.position.y).toBeCloseTo(expY, 6);
      expect(pivot.position.z).toBeCloseTo(expZ, 6);
    }
  });

  // 6. Mesh dimensions equal the PartGraph bounding-box extents
  it("derives mesh dimensions strictly from PartGraph bounding-box extents", () => {
    const group = partGraphToThree(goldenPartGraph, { threeInstance: THREE });
    for (const part of goldenPartGraph.parts) {
      const mesh = group.getObjectByName(`part_${part.id}`);
      const expectedW = (part.placement.maxXDmm - part.placement.minXDmm) * DMM_TO_THREE;
      const expectedH = (part.placement.maxYDmm - part.placement.minYDmm) * DMM_TO_THREE;
      const expectedD = (part.placement.maxZDmm - part.placement.minZDmm) * DMM_TO_THREE;

      const { parameters } = mesh.geometry;
      expect(parameters.width).toBeCloseTo(expectedW, 6);
      expect(parameters.height).toBeCloseTo(expectedH, 6);
      expect(parameters.depth).toBeCloseTo(expectedD, 6);
    }
  });

  // 7. Group bounds reconcile with the complete Golden envelope (1.8m x 2.4m x 0.6m)
  it("reconciles overall group bounds when closed with the Golden envelope (1.8m x 2.4m x 0.6m)", () => {
    const group = partGraphToThree(goldenPartGraph, { threeInstance: THREE });
    const bbox = new THREE.Box3().setFromObject(group);

    // Coordinate system: X in [0, 1.8], Y in [0, 2.4], Z in [0, 0.6]
    expect(bbox.min.x).toBeCloseTo(0.0, 4);
    expect(bbox.max.x).toBeCloseTo(1.8, 4);
    expect(bbox.min.y).toBeCloseTo(0.0, 4);
    expect(bbox.max.y).toBeCloseTo(2.4, 4);
    expect(bbox.min.z).toBeCloseTo(0.0, 4);
    expect(bbox.max.z).toBeCloseTo(0.6, 4);
  });

  // 8. Deterministic output across repeated invocations
  it("produces deterministic, equivalent output across repeated invocations", () => {
    const group1 = partGraphToThree(goldenPartGraph, { threeInstance: THREE });
    const group2 = partGraphToThree(goldenPartGraph, { threeInstance: THREE });

    expect(group1.children.length).toBe(group2.children.length);
    expect(group1.userData.doorPivots.length).toBe(group2.userData.doorPivots.length);

    for (const part of goldenPartGraph.parts) {
      const m1 = group1.getObjectByName(`part_${part.id}`);
      const m2 = group2.getObjectByName(`part_${part.id}`);
      expect(m1.userData.partId).toBe(m2.userData.partId);
      expect(m1.position.x).toBe(m2.position.x);
      expect(m1.position.y).toBe(m2.position.y);
      expect(m1.position.z).toBe(m2.position.z);
    }
  });

  // 9. Adapter disposal releases all created geometries and materials
  it("disposes all geometries and materials on cleanup", () => {
    const group = partGraphToThree(goldenPartGraph, { threeInstance: THREE });
    const materials = group.userData.materials;

    let disposedGeoCount = 0;
    group.traverse((obj) => {
      if (obj.geometry) {
        const orig = obj.geometry.dispose;
        obj.geometry.dispose = function () {
          disposedGeoCount++;
          orig.call(this);
        };
      }
    });

    let disposedMatCount = 0;
    materials.forEach((m) => {
      const orig = m.dispose;
      m.dispose = function () {
        disposedMatCount++;
        orig.call(this);
      };
    });

    disposePartGraphGroup(group);

    // 19 BoxGeometries + 4 EdgesGeometries = 23 geometries
    expect(disposedGeoCount).toBe(23);
    expect(disposedMatCount).toBe(materials.length);
    expect(group.children.length).toBe(0);
  });

  // 10. Only rectangular box meshes and subtle edge lines; zero CNC toolpaths or hardware drillings
  it("produces only rectangular box meshes and subtle door edge lines; zero CNC toolpaths", () => {
    const group = partGraphToThree(goldenPartGraph, { threeInstance: THREE });
    group.traverse((child) => {
      if (child.isMesh && child.name.startsWith("part_")) {
        expect(child.geometry.type).toBe("BoxGeometry");
      }
      if (child.isLineSegments) {
        expect(child.geometry.type).toBe("EdgesGeometry");
      }
    });
  });

  // 11. Invalid PartGraph is rejected
  it("rejects invalid PartGraph objects with descriptive errors", () => {
    expect(() => partGraphToThree(null)).toThrow(TypeError);
    expect(() => partGraphToThree({})).toThrow(TypeError);
    expect(() => partGraphToThree({ parts: "invalid" })).toThrow(TypeError);
    expect(() => partGraphToThree({ parts: [{ id: "bad" }] })).toThrow(Error);
  });

  // 12. The adapter does not mutate the PartGraph
  it("does not mutate the source PartGraph during conversion", () => {
    const originalJson = JSON.stringify(goldenPartGraph);
    partGraphToThree(goldenPartGraph, { threeInstance: THREE });
    expect(JSON.stringify(goldenPartGraph)).toBe(originalJson);
  });
});
