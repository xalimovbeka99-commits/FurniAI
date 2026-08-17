import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('SOURCE-LEVEL LIFECYCLE REGRESSION (index.html static analysis)', () => {
  const htmlPath = path.join(process.cwd(), 'index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  test('index.html static structure contains expected 3D canvas declarations', () => {
    expect(htmlContent).toContain('<!DOCTYPE html>');
    expect(htmlContent).toContain('id="hero3d"');
    expect(htmlContent).toContain('id="bld3d"');
  });

  test('Gallery thumbnail renderer static source code uses initGalleryThumbnails generator', () => {
    expect(htmlContent).toContain('initGalleryThumbnails()');
  });

  test('Hero 3D scene static source code includes context loss listeners', () => {
    expect(htmlContent).toContain("cv.addEventListener('webglcontextlost'");
    expect(htmlContent).toContain("cv.addEventListener('webglcontextrestored'");
  });

  test('Builder static source code includes loop control methods', () => {
    expect(htmlContent).toContain('startLoop()');
    expect(htmlContent).toContain('stopLoop()');
  });

  test('Page visibility listener static source code exists', () => {
    expect(htmlContent).toContain("document.addEventListener('visibilitychange'");
  });

  // BLOCKER 4/5 follow-up: disposalOwnership.test.js and pageVisibilityGuards.test.js
  // verify the intended *algorithm* against a reimplemented copy, which proves the
  // design is sound but not that index.html actually ships it. These assertions tie
  // the same guarantees to the real, shipped source so a future edit to Builder.clear()
  // or startLoop()/startHeroLoop() that silently drops a guard is caught here too.
  test('Builder.clear() deduplicates disposal via Set-based ownership tracking', () => {
    expect(htmlContent).toContain('seenObjects');
    expect(htmlContent).toContain('seenGeometries');
    expect(htmlContent).toContain('seenMaterials');
    expect(htmlContent).toContain('seenTextures');
  });

  test('shared _grainTex and _mirrorEnv are explicitly excluded from disposal', () => {
    expect(htmlContent).toMatch(/_grainTex\s*\)\s*return/);
    expect(htmlContent).toMatch(/_mirrorEnv\s*\)\s*return/);
  });

  test('startHeroLoop and Builder.startLoop both guard on document.hidden', () => {
    const heroLoopFn = htmlContent.slice(htmlContent.indexOf('function startHeroLoop'), htmlContent.indexOf('function startHeroLoop') + 200);
    expect(heroLoopFn).toContain('document.hidden');
    const builderLoopFn = htmlContent.slice(htmlContent.indexOf('startLoop(){'), htmlContent.indexOf('startLoop(){') + 200);
    expect(builderLoopFn).toContain('document.hidden');
  });

  test('DESIGNS catalog has exactly 30 entries and gallery thumbnails never hardcode a count', () => {
    const match = htmlContent.match(/const DESIGNS=\[[\s\S]*?\];/);
    expect(match).not.toBeNull();
    const DESIGNS = new Function(`${match[0]} return DESIGNS;`)();
    expect(DESIGNS.length).toBe(30);
    expect(htmlContent).not.toMatch(/DESIGNS\.slice\(0,\s*(7|30)\)/);
  });
});
