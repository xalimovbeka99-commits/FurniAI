/**
 * src/lib/adapters/partGraphToThree.test.js
 * ---------------------------------------------------------------------
 * Phase 5 Unit Tests for PartGraph-to-Three.js Adapter
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

describe("Phase 5 — PartGraph-to-Three.js Adapter Unit Tests", () => {
  const goldenPartGraph = buildStructuralPartGraph(goldenSpec);

  // 1. Exactly 19 meshes are generated
  it("generates exactly 19 meshes for the Golden Wardrobe", () => {
    const group = partGraphToThree(goldenPartGraph, { threeInstance: THREE });
    const meshes = group.children.filter((c) => c.isMesh);
    expect(meshes.length).toBe(19);
  });

  // 2. Each PartGraph part maps to exactly one mesh
  it("maps each PartGraph part to exactly one mesh with matching name", () => {
    const group = partGraphToThree(goldenPartGraph, { threeInstance: THREE });
    for (const part of goldenPartGraph.parts) {
      const mesh = group.getObjectByName(`part_${part.id}`);
      expect(mesh).toBeDefined();
      expect(mesh.isMesh).toBe(true);
      expect(mesh.userData.partId).toBe(part.id);
    }
  });

  // 3. Every mesh contains the required metadata
  it("attaches all required metadata fields to every mesh", () => {
    const group = partGraphToThree(goldenPartGraph, { threeInstance: THREE });
    for (const mesh of group.children) {
      expect(mesh.userData).toBeDefined();
      expect(typeof mesh.userData.partId).toBe("string");
      expect(typeof mesh.userData.role).toBe("string");
      expect(mesh.userData.finishedDimensionsMm).toBeDefined();
      expect(typeof mesh.userData.finishedDimensionsMm.lengthMm).toBe("number");
      expect(typeof mesh.userData.finishedDimensionsMm.widthMm).toBe("number");
      expect(typeof mesh.userData.finishedDimensionsMm.thicknessMm).toBe("number");
      expect(mesh.userData.placementDmm).toBeDefined();
      expect(mesh.userData.sourceSpecId).toBe(goldenPartGraph.sourceSpecId);
    }
  });

  // 4. Mesh dimensions equal the PartGraph bounding-box extents
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

  // 5. Mesh centers equal the PartGraph placement centers
  it("positions mesh centers at ((min + max) / 2) * DMM_TO_THREE", () => {
    const group = partGraphToThree(goldenPartGraph, { threeInstance: THREE });
    for (const part of goldenPartGraph.parts) {
      const mesh = group.getObjectByName(`part_${part.id}`);
      const expectedX = ((part.placement.minXDmm + part.placement.maxXDmm) / 2) * DMM_TO_THREE;
      const expectedY = ((part.placement.minYDmm + part.placement.maxYDmm) / 2) * DMM_TO_THREE;
      const expectedZ = ((part.placement.minZDmm + part.placement.maxZDmm) / 2) * DMM_TO_THREE;

      expect(mesh.position.x).toBeCloseTo(expectedX, 6);
      expect(mesh.position.y).toBeCloseTo(expectedY, 6);
      expect(mesh.position.z).toBeCloseTo(expectedZ, 6);
    }
  });

  // 6. No ID is duplicated
  it("contains no duplicate part IDs across meshes", () => {
    const group = partGraphToThree(goldenPartGraph, { threeInstance: THREE });
    const ids = group.children.map((c) => c.userData.partId);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  // 7. Group bounds reconcile with the complete Golden envelope
  it("reconciles overall group bounds with the Golden envelope (1.8m x 2.4m x 0.6m)", () => {
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

  // 8. Running the adapter repeatedly produces equivalent hierarchy and metadata
  it("produces deterministic, equivalent output across repeated invocations", () => {
    const group1 = partGraphToThree(goldenPartGraph, { threeInstance: THREE });
    const group2 = partGraphToThree(goldenPartGraph, { threeInstance: THREE });

    expect(group1.children.length).toBe(group2.children.length);
    for (let i = 0; i < group1.children.length; i++) {
      const m1 = group1.children[i];
      const m2 = group2.children[i];
      expect(m1.userData.partId).toBe(m2.userData.partId);
      expect(m1.position.x).toBe(m2.position.x);
      expect(m1.position.y).toBe(m2.position.y);
      expect(m1.position.z).toBe(m2.position.z);
    }
  });

  // 9. Adapter disposal releases all created geometries and materials
  it("disposes all geometries and materials on cleanup", () => {
    const group = partGraphToThree(goldenPartGraph, { threeInstance: THREE });
    const geometries = group.children.map((c) => c.geometry);
    const materials = group.userData.materials;

    let disposedGeoCount = 0;
    geometries.forEach((g) => {
      const orig = g.dispose;
      g.dispose = function () {
        disposedGeoCount++;
        orig.call(this);
      };
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

    expect(disposedGeoCount).toBe(19);
    expect(disposedMatCount).toBe(materials.length);
    expect(group.children.length).toBe(0);
  });

  // 10. No hardware/CNC geometry is produced
  it("produces only rectangular box meshes and zero CNC toolpaths or hardware drillings", () => {
    const group = partGraphToThree(goldenPartGraph, { threeInstance: THREE });
    for (const child of group.children) {
      expect(child.geometry.type).toBe("BoxGeometry");
      expect(child.type).toBe("Mesh");
    }
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
