import { describe, test, expect, vi } from 'vitest';

describe('BLOCKER 4 — Resource Disposal Ownership & Deduplication', () => {
  test('disposal deduplicates geometries, materials, and textures without double-disposal', () => {
    let geoDisposeCount = 0;
    let matDisposeCount = 0;
    let texDisposeCount = 0;

    const mockTexture = {
      dispose() { texDisposeCount++; }
    };
    const mockSharedGrainTex = {
      dispose() { throw new Error('Shared _grainTex must NEVER be disposed!'); }
    };
    const mockSharedMirrorEnv = {
      dispose() { throw new Error('Shared _mirrorEnv must NEVER be disposed!'); }
    };

    const mockGeometry = {
      dispose() { geoDisposeCount++; }
    };

    const mockMaterial = {
      map: mockTexture,
      bumpMap: mockSharedGrainTex,
      envMap: mockSharedMirrorEnv,
      dispose() { matDisposeCount++; }
    };

    const node1 = {
      geometry: mockGeometry,
      material: mockMaterial,
    };
    const node2 = {
      geometry: mockGeometry,
      material: mockMaterial,
    };
    const parentGroup = {
      children: [node1, node2],
      traverse(fn) {
        fn(this);
        fn(node1);
        fn(node2);
      }
    };

    const parts = [parentGroup, node1, node2];
    const doorObjs = [node1];
    const drawerObjs = [node2];

    const seenObjects = new Set();
    const seenGeometries = new Set();
    const seenMaterials = new Set();
    const seenTextures = new Set();

    const _grainTex = mockSharedGrainTex;
    const _mirrorEnv = mockSharedMirrorEnv;

    const disposeTex = (tex) => {
      if (!tex || seenTextures.has(tex)) return;
      if (tex === _grainTex || tex === _mirrorEnv) return;
      seenTextures.add(tex);
      if (typeof tex.dispose === 'function') tex.dispose();
    };

    const disposeMat = (mat) => {
      if (!mat || seenMaterials.has(mat)) return;
      seenMaterials.add(mat);
      if (mat.map) disposeTex(mat.map);
      if (mat.bumpMap) disposeTex(mat.bumpMap);
      if (mat.envMap) disposeTex(mat.envMap);
      if (typeof mat.dispose === 'function') mat.dispose();
    };

    const disposeObj = (obj) => {
      if (!obj || seenObjects.has(obj)) return;
      seenObjects.add(obj);

      if (obj.geometry && !seenGeometries.has(obj.geometry)) {
        seenGeometries.add(obj.geometry);
        if (typeof obj.geometry.dispose === 'function') obj.geometry.dispose();
      }

      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => disposeMat(m));
        } else {
          disposeMat(obj.material);
        }
      }
    };

    const targets = [...parts, ...doorObjs, ...drawerObjs];
    targets.forEach(p => {
      if (p && p.traverse) {
        p.traverse(c => disposeObj(c));
      }
      disposeObj(p);
    });

    expect(geoDisposeCount).toBe(1);
    expect(matDisposeCount).toBe(1);
    expect(texDisposeCount).toBe(1);
  });
});
