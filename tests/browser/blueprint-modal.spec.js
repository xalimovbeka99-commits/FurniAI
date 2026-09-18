const { test, expect } = require('@playwright/test');

test.describe('2D Blueprint Viewport Modal & Export Feedback Suite', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => {
      // Unhandled errors should fail the test
      throw new Error(`Uncaught page error: ${err.message}`);
    });
  });

  test('Preview blueprint modal opens with scaled A3 SVG and does not disrupt Three.js WebGL context', async ({ page }) => {
    await page.goto('/#/build/golden-parametric');
    await page.waitForFunction(() => typeof window.Builder !== 'undefined' && window.Builder.ready);

    // 1. Capture initial WebGL renderer state
    const initialGlState = await page.evaluate(() => {
      const gl = window.Builder.ren ? window.Builder.ren.getContext() : null;
      window.__testRendererRef = window.Builder.ren;
      return {
        ready: window.Builder.ready,
        hasGl: !!gl,
        isContextLost: gl ? gl.isContextLost() : true,
        contextLostCount: window.__contextLostCount || 0,
      };
    });

    expect(initialGlState.ready).toBe(true);
    expect(initialGlState.hasGl).toBe(true);
    expect(initialGlState.isContextLost).toBe(false);

    // 2. Open manufacturing dropdown and click Preview Blueprint (2D)
    await page.click('#btnMfgDropdown');
    const previewBtn = page.locator('#btnPreviewShopDrawings');
    await expect(previewBtn).toBeVisible();
    await previewBtn.click();

    // 3. Verify modal is visible
    const modal = page.locator('#blueprintPreviewModal');
    await expect(modal).toBeVisible();

    // 4. Verify SVG blueprint is loaded with A3 sheet properties
    const svg = page.locator('#blueprintSvgContainer svg');
    await expect(svg).toBeVisible();
    const viewBox = await svg.getAttribute('viewBox');
    expect(viewBox).toBe('0 0 420 297');

    // Verify title block and technical projections exist in SVG
    const svgText = await page.locator('#blueprintSvgContainer').innerHTML();
    expect(svgText).toContain('AUTOMATED SHOP DRAWING');
    expect(svgText).toContain('VIEW A: FRONT ELEVATION');
    expect(svgText).toContain('VIEW C: PLAN VIEW (TOP-DOWN)');

    // 5. Verify toast feedback was displayed
    const toast = page.locator('#toastContainer .toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('2D Blueprint preview ready');

    // 6. Verify Three.js WebGL context remains untouched (no re-instantiation, no context loss)
    const midGlState = await page.evaluate(() => {
      const gl = window.Builder.ren ? window.Builder.ren.getContext() : null;
      return {
        sameRenderer: window.Builder.ren === window.__testRendererRef,
        isContextLost: gl ? gl.isContextLost() : true,
        contextLostCount: window.__contextLostCount || 0,
        ready: window.Builder.ready,
      };
    });

    expect(midGlState.sameRenderer).toBe(true);
    expect(midGlState.isContextLost).toBe(false);
    expect(midGlState.contextLostCount).toBe(0);
    expect(midGlState.ready).toBe(true);

    // 7. Close modal via close button
    await page.locator('.blueprint-modal-close').click();
    await expect(modal).toBeHidden();

    // 8. Re-verify WebGL context remains active after close
    const postGlState = await page.evaluate(() => {
      const gl = window.Builder.ren ? window.Builder.ren.getContext() : null;
      return {
        sameRenderer: window.Builder.ren === window.__testRendererRef,
        isContextLost: gl ? gl.isContextLost() : true,
        contextLostCount: window.__contextLostCount || 0,
        ready: window.Builder.ready,
      };
    });

    expect(postGlState.sameRenderer).toBe(true);
    expect(postGlState.isContextLost).toBe(false);
    expect(postGlState.contextLostCount).toBe(0);
  });

  test('Export Shop Drawings displays confirmation toast and error boundary catches failures gracefully', async ({ page }) => {
    await page.goto('/#/build/golden-parametric');
    await page.waitForFunction(() => typeof window.Builder !== 'undefined' && window.Builder.ready);

    // 1. Export SVG triggers success toast
    await page.click('#btnMfgDropdown');
    const exportSvgBtn = page.locator('#btnExportShopDrawings');
    await expect(exportSvgBtn).toBeVisible();
    await exportSvgBtn.click();

    // Verify confirmation toast
    const toast = page.locator('#toastContainer .toast-success');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Exported Shop Drawings (SVG)');

    // 2. Test error boundary protection
    await page.evaluate(() => {
      // Intentionally simulate an unbuildable PartGraph state
      const origFn = window.getActivePartGraph;
      window.getActivePartGraph = () => null;
      window.handleExportShopDrawings('SVG');
      window.getActivePartGraph = origFn;
    });

    // Verify error toast displayed descriptive message instead of silent failure
    const errorToast = page.locator('#toastContainer .toast-error');
    await expect(errorToast).toBeVisible();
    await expect(errorToast).toContainText('Export failed');
  });

  test('Modal closes gracefully with Escape key', async ({ page }) => {
    await page.goto('/#/build/golden-parametric');
    await page.waitForFunction(() => typeof window.Builder !== 'undefined' && window.Builder.ready);

    await page.click('#btnMfgDropdown');
    await page.click('#btnPreviewShopDrawings');
    const modal = page.locator('#blueprintPreviewModal');
    await expect(modal).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  });
});
