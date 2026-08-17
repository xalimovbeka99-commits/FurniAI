import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * BLOCKER 2 (round 2) — this test extracts the REAL `disposeObject3DTree`
 * source text from the shipped index.html and executes it, rather than
 * testing a hand-copied reimplementation of the algorithm (Codex's exact
 * complaint about round 1). Any future edit to the real function — a
 * dropped Set, a removed texture slot, a broken _grainTex/_mirrorEnv
 * check — breaks this test against the actual file, not a stale copy of
 * the design intent.
 */
function loadRealDisposeObject3DTree() {
  const html = readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
  const slotsStart = html.indexOf('const SHARED_TEXTURE_SLOTS=');
  if (slotsStart === -1) throw new Error('SHARED_TEXTURE_SLOTS not found in index.html');
  const fnMarker = 'function disposeObject3DTree(roots){';
  const fnStart = html.indexOf(fnMarker, slotsStart);
  if (fnStart === -1) throw new Error('disposeObject3DTree not found in index.html');
  let depth = 0, i = html.indexOf('{', fnStart);
  const braceStart = i;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  const source = html.slice(slotsStart, i);
  const factory = new Function('_grainTex', '_mirrorEnv', `${source}\nreturn disposeObject3DTree;`);
  return factory;
}

function makeMesh({ geometry, material }) {
  return { geometry, material, traverse: undefined };
}
function makeGroup(children) {
  return {
    children,
    traverse(fn) {
      fn(this);
      children.forEach((c) => (c.traverse ? c.traverse(fn) : fn(c)));
    },
  };
}
function makeDisposeCounter() {
  let count = 0;
  return { dispose: () => { count++; }, get count() { return count; } };
}

describe('gallery/Builder shared disposal helper (real index.html source, not a reimplemented copy)', () => {
  test('extracts and evaluates without throwing', () => {
    expect(() => loadRealDisposeObject3DTree()).not.toThrow();
  });

  test('same geometry referenced by two meshes is disposed exactly once', () => {
    const factory = loadRealDisposeObject3DTree();
    const disposeObject3DTree = factory(null, null);
    const geo = makeDisposeCounter();
    const mat1 = makeDisposeCounter();
    const mat2 = makeDisposeCounter();
    const mesh1 = makeMesh({ geometry: geo, material: mat1 });
    const mesh2 = makeMesh({ geometry: geo, material: mat2 });
    const group = makeGroup([mesh1, mesh2]);

    disposeObject3DTree(group);

    expect(geo.count).toBe(1);
    expect(mat1.count).toBe(1);
    expect(mat2.count).toBe(1);
  });

  test('same material shared by two meshes (e.g. makeDrawer()\'s shared cmat) is disposed exactly once', () => {
    const factory = loadRealDisposeObject3DTree();
    const disposeObject3DTree = factory(null, null);
    const sharedMat = makeDisposeCounter();
    const geo1 = makeDisposeCounter();
    const geo2 = makeDisposeCounter();
    const bottom = makeMesh({ geometry: geo1, material: sharedMat });
    const left = makeMesh({ geometry: geo2, material: sharedMat });
    const group = makeGroup([bottom, left]);

    disposeObject3DTree(group);

    expect(sharedMat.count).toBe(1);
    expect(geo1.count).toBe(1);
    expect(geo2.count).toBe(1);
  });

  test('same texture referenced by two different materials is disposed exactly once', () => {
    const factory = loadRealDisposeObject3DTree();
    const disposeObject3DTree = factory(null, null);
    const sharedTex = makeDisposeCounter();
    const mat1 = { map: sharedTex, dispose: makeDisposeCounter().dispose };
    const mat2 = { map: sharedTex, dispose: makeDisposeCounter().dispose };
    const mesh1 = makeMesh({ geometry: makeDisposeCounter(), material: mat1 });
    const mesh2 = makeMesh({ geometry: makeDisposeCounter(), material: mat2 });
    const group = makeGroup([mesh1, mesh2]);

    disposeObject3DTree(group);

    expect(sharedTex.count).toBe(1);
  });

  test('checks material texture slots beyond map/bumpMap (envMap, normalMap, etc.)', () => {
    const factory = loadRealDisposeObject3DTree();
    const disposeObject3DTree = factory(null, null);
    const envTex = makeDisposeCounter();
    const normalTex = makeDisposeCounter();
    const mat = { envMap: envTex, normalMap: normalTex, dispose: () => {} };
    const mesh = makeMesh({ geometry: makeDisposeCounter(), material: mat });

    disposeObject3DTree(makeGroup([mesh]));

    expect(envTex.count).toBe(1);
    expect(normalTex.count).toBe(1);
  });

  test('material arrays are handled correctly, each material disposed once', () => {
    const factory = loadRealDisposeObject3DTree();
    const disposeObject3DTree = factory(null, null);
    const matA = makeDisposeCounter();
    const matB = makeDisposeCounter();
    const mesh = makeMesh({ geometry: makeDisposeCounter(), material: [matA, matB] });

    disposeObject3DTree(makeGroup([mesh]));

    expect(matA.count).toBe(1);
    expect(matB.count).toBe(1);
  });

  test('nested groups with repeated/shared references are handled correctly', () => {
    const factory = loadRealDisposeObject3DTree();
    const disposeObject3DTree = factory(null, null);
    const sharedGeo = makeDisposeCounter();
    const sharedMat = makeDisposeCounter();
    const meshA = makeMesh({ geometry: sharedGeo, material: sharedMat });
    const meshB = makeMesh({ geometry: sharedGeo, material: sharedMat });
    const innerGroup = makeGroup([meshA]);
    const outerGroup = makeGroup([innerGroup, meshB]);

    disposeObject3DTree(outerGroup);

    expect(sharedGeo.count).toBe(1);
    expect(sharedMat.count).toBe(1);
  });

  test('door and drawer objects sharing references across the parts/doorObjs/drawerObjs arrays are deduplicated across the whole call, not per-array', () => {
    const factory = loadRealDisposeObject3DTree();
    const disposeObject3DTree = factory(null, null);
    const doorGeo = makeDisposeCounter();
    const doorMat = makeDisposeCounter();
    const door = makeMesh({ geometry: doorGeo, material: doorMat });
    // Same object appearing in both "parts" and "doorObjs" (mirroring how
    // Builder.clear() concatenates this.parts/doorObjs/drawerObjs into one
    // targets array before calling the shared helper once).
    const targets = [door, door];

    disposeObject3DTree(targets);

    expect(doorGeo.count).toBe(1);
    expect(doorMat.count).toBe(1);
  });

  test('shared global _grainTex and _mirrorEnv are NEVER disposed, even when referenced by an owned material', () => {
    const grainTex = { dispose: () => { throw new Error('Shared _grainTex must NEVER be disposed!'); } };
    const mirrorEnv = { dispose: () => { throw new Error('Shared _mirrorEnv must NEVER be disposed!'); } };
    const factory = loadRealDisposeObject3DTree();
    const disposeObject3DTree = factory(grainTex, mirrorEnv);

    const mat = { bumpMap: grainTex, envMap: mirrorEnv, dispose: () => {} };
    const mesh = makeMesh({ geometry: makeDisposeCounter(), material: mat });

    expect(() => disposeObject3DTree(makeGroup([mesh]))).not.toThrow();
  });

  test('index.html wires both Builder.clear() and initGalleryThumbnails() through this one real helper (no second, drifting copy)', () => {
    const html = readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    const clearBody = html.slice(html.indexOf('clear(){'), html.indexOf('clear(){') + 400);
    expect(clearBody).toContain('disposeObject3DTree(targets)');
    const galleryBody = html.slice(html.indexOf('function initGalleryThumbnails()'), html.indexOf('function initGalleryThumbnails()') + 5000);
    expect(galleryBody).toContain('disposeObject3DTree(scene)');
  });
});
