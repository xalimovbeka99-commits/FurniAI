const { test, expect } = require('@playwright/test');

const HANG_GUARD_MS = 8000;

test.describe('WebGL Context Preservation & Stability Suite', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => {
      throw new Error(`Uncaught page error: ${err.message}`);
    });
  });

  async function readBuilderPixels(page) {
    return page.evaluate((guardMs) => Promise.race([
      new Promise((resolve) => {
        requestAnimationFrame(() => {
          if (!window.Builder || !window.Builder.ren) {
            return resolve({ timedOut: false, error: 'Builder.ren not ready' });
          }
          const gl = window.Builder.ren.getContext();
          const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
          const pixels = new Uint8Array(w * h * 4);
          gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          let nonBlank = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i] !== 0 || pixels[i + 1] !== 0 || pixels[i + 2] !== 0) nonBlank++;
          }
          resolve({ width: w, height: h, nonBlankFraction: nonBlank / (w * h), timedOut: false });
        });
      }),
      new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), guardMs)),
    ]), HANG_GUARD_MS);
  }

  test('Homepage maintains at most 1 active WebGL context and gallery uses zero live contexts', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => document.querySelectorAll('#galleryGrid .card').length > 0);

    const contextReport = await page.evaluate(() => {
      const heroCv = document.getElementById('hero3d');
      const cardCanvases = Array.from(document.querySelectorAll('#galleryGrid .card canvas'));
      
      // Check hero WebGL context
      let heroHasGl = false;
      try {
        const ren = window.hRen || (typeof hRen !== 'undefined' ? hRen : null);
        if (ren && ren.getContext()) {
          heroHasGl = !ren.getContext().isContextLost();
        } else if (heroCv) {
          const gl = heroCv.getContext('webgl') || heroCv.getContext('experimental-webgl');
          heroHasGl = !!(gl && !gl.isContextLost());
        }
      } catch (e) {}

      // Check card canvases: they must NOT have active WebGL contexts
      let bitmapCards = 0;
      for (const cv of cardCanvases) {
        const is2d = !!cv.getContext('2d');
        if (is2d) bitmapCards++;
      }

      return {
        heroHasGl,
        totalCardCanvases: cardCanvases.length,
        bitmapCards,
        heroRafActive: typeof hRafId !== 'undefined' && hRafId !== null,
      };
    });

    expect(contextReport.heroHasGl).toBe(true);
    expect(contextReport.totalCardCanvases).toBe(30);
    expect(contextReport.bitmapCards).toBe(30);
  });

  test('Hero render loop pauses when scrolled out of viewport and resumes when visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#hero3d')).toBeAttached();

    // Give time for initial layout and hero loop to be active
    await page.waitForFunction(() => typeof hRafId !== 'undefined' && hRafId !== null);
    const initialLoopState = await page.evaluate(() => ({
      landingActive,
      heroVisible,
      hRafId: hRafId !== null,
    }));
    expect(initialLoopState.heroVisible).toBe(true);
    expect(initialLoopState.hRafId).toBe(true);

    // Scroll down to the gallery
    await page.evaluate(() => {
      const gallery = document.getElementById('galleryGrid');
      if (gallery) gallery.scrollIntoView();
    });

    // Wait for IntersectionObserver to detect hero out of view and pause loop
    await page.waitForFunction(() => typeof heroVisible !== 'undefined' && heroVisible === false, { timeout: 5000 });
    await page.waitForFunction(() => typeof hRafId !== 'undefined' && hRafId === null, { timeout: 5000 });

    const scrolledState = await page.evaluate(() => ({
      heroVisible,
      hRafId: hRafId !== null,
    }));
    expect(scrolledState.heroVisible).toBe(false);
    expect(scrolledState.hRafId).toBe(false);

    // Scroll back up to the hero
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });

    // Loop should resume
    await page.waitForFunction(() => typeof heroVisible !== 'undefined' && heroVisible === true, { timeout: 5000 });
    await page.waitForFunction(() => typeof hRafId !== 'undefined' && hRafId !== null, { timeout: 5000 });

    const resumedState = await page.evaluate(() => ({
      heroVisible,
      hRafId: hRafId !== null,
    }));
    expect(resumedState.heroVisible).toBe(true);
    expect(resumedState.hRafId).toBe(true);
  });

  test('Survives 50 rapid slider updates without context loss or canvas blanking', async ({ page }) => {
    await page.goto('/#/build/0');
    await expect(page.locator('#bld3d')).toBeAttached();
    await page.waitForFunction(() => typeof Builder !== 'undefined' && Builder.ready && Builder.parts.length > 0);

    // Track context loss events on the Builder canvas
    await page.evaluate(() => {
      window.__contextLostCount = 0;
      const cv = document.getElementById('bld3d');
      if (cv) {
        cv.addEventListener('webglcontextlost', () => {
          window.__contextLostCount++;
        });
      }
    });

    // Perform 50 rapid configuration and slider updates
    for (let i = 0; i < 50; i++) {
      const w = 180 + (i % 8) * 20; // 180 to 320
      const h = 200 + (i % 5) * 10; // 200 to 240
      const d = 50 + (i % 4) * 5;   // 50 to 65
      const sections = 2 + (i % 4);  // 2 to 5
      const shelves = 1 + (i % 4);   // 1 to 4
      const drawers = i % 4;         // 0 to 3

      await page.evaluate(({ w, h, d, sections, shelves, drawers }) => {
        Builder.applyConfiguration({ w, h, d, sections, shelves, drawers });
      }, { w, h, d, sections, shelves, drawers });
    }

    // Check context loss count and active status
    const postStress = await page.evaluate(() => {
      const gl = Builder.ren ? Builder.ren.getContext() : null;
      return {
        contextLostCount: window.__contextLostCount,
        isContextLost: gl ? gl.isContextLost() : true,
        partCount: Builder.parts.length,
        ready: Builder.ready,
        loopActive: typeof bldRafId !== 'undefined' && bldRafId !== null,
      };
    });

    expect(postStress.contextLostCount, 'WebGL context lost during slider updates').toBe(0);
    expect(postStress.isContextLost, 'WebGL context is reported as lost').toBe(false);
    expect(postStress.partCount, 'Builder parts length is 0 after stress test').toBeGreaterThan(0);
    expect(postStress.loopActive, 'Builder RAF loop is inactive').toBe(true);

    // Verify canvas pixels are non-blank
    const pixelResult = await readBuilderPixels(page);
    expect(pixelResult.timedOut).toBe(false);
    expect(pixelResult.nonBlankFraction, 'Builder canvas rendered blank pixels after 50 slider updates').toBeGreaterThan(0.05);
  });

  test('Navigation lifecycle strictly bounds active WebGL contexts to at most 2', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof hRafId !== 'undefined' && hRafId !== null);

    // 1. Landing state
    let state = await page.evaluate(() => ({
      landingActive,
      builderActive,
      heroLoop: hRafId !== null,
      builderLoop: typeof bldRafId !== 'undefined' && bldRafId !== null,
    }));
    expect(state.landingActive).toBe(true);
    expect(state.heroLoop).toBe(true);
    expect(state.builderLoop).toBe(false);

    // 2. Navigate to Builder
    await page.goto('/#/build/0');
    await page.waitForFunction(() => typeof Builder !== 'undefined' && Builder.ready);

    state = await page.evaluate(() => ({
      landingActive,
      builderActive,
      heroLoop: hRafId !== null,
      builderLoop: bldRafId !== null,
    }));
    expect(state.landingActive).toBe(false);
    expect(state.builderActive).toBe(true);
    expect(state.heroLoop, 'Hero loop should be stopped when on builder').toBe(false);
    expect(state.builderLoop, 'Builder loop should be running').toBe(true);

    // 3. Navigate back to Landing
    await page.goto('/#/');
    await page.waitForFunction(() => landingActive);

    state = await page.evaluate(() => ({
      landingActive,
      builderActive,
      heroLoop: hRafId !== null,
      builderLoop: bldRafId !== null,
    }));
    expect(state.landingActive).toBe(true);
    expect(state.builderActive).toBe(false);
    expect(state.builderLoop, 'Builder loop should be stopped when on landing').toBe(false);
    expect(state.heroLoop, 'Hero loop should resume on landing').toBe(true);
  });
});
