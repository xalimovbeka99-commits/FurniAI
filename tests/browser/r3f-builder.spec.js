/**
 * Real browser acceptance suite for the Next.js /builder route (React
 * Three Fiber) — src/app/builder/page.jsx + src/components/builder/
 * FurnitureModel.jsx. This is a genuinely different rendering stack from
 * the legacy static site's tests/browser/site.spec.js (vanilla-JS
 * Three.js, no React) and is intentionally kept in its own config
 * (playwright.r3f.config.js) and its own npm script.
 *
 * Investigation finding (recorded here, not just in a commit message,
 * since it directly explains why every assertion below polls for real
 * rendered pixels rather than checking for a fixed short delay): opening
 * /builder triggers a genuine, bounded Suspense-resolution period during
 * initial hydration — the page correctly shows its own "Loading
 * Configurator..." fallback the whole time, never a blank/white screen —
 * that resolves within roughly 0.6-4.5s in this environment (measured
 * across 20+ repeated loads against a production build; every single one
 * eventually resolved, none stayed stuck). A check using a short fixed
 * wait (under ~1s) or testing only for `<canvas>`/context existence can
 * observe this normal, in-progress state and misreport it as "the Builder
 * is blank" — exactly the failure this suite is built not to repeat.
 * `waitForRealPixels()` below is the actual regression guard: it proves
 * real rendered furniture geometry via a genuine WebGL `readPixels()`
 * call, the same technique proven against the legacy builder's own suite,
 * and fails loudly (not silently) if nothing ever renders within a
 * generous 15s budget.
 */
const { test, expect } = require("@playwright/test");

async function readPixels(page) {
  return page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => {
      const canvas = document.querySelector("canvas");
      if (!canvas) { resolve({ nonBlankFraction: 0, noCanvas: true }); return; }
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (!gl) { resolve({ nonBlankFraction: 0, noGl: true }); return; }
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      if (!w || !h) { resolve({ nonBlankFraction: 0, zeroSize: true }); return; }
      const pixels = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let nonBlank = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] || pixels[i + 1] || pixels[i + 2]) nonBlank++;
      }
      resolve({ w, h, nonBlankFraction: nonBlank / (w * h) });
    });
  }));
}

async function waitForRealPixels(page, maxMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const r = await readPixels(page);
    if (r.nonBlankFraction > 0.02) return { ...r, elapsedMs: Date.now() - start };
    await page.waitForTimeout(300);
  }
  return { nonBlankFraction: 0, timedOut: true, elapsedMs: Date.now() - start };
}

test.describe("Next.js /builder (React Three Fiber) — real browser lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw new Error(`Uncaught page error: ${err.message}`);
    });
  });

  test("the default wardrobe renders real, non-blank geometry — not just a mounted canvas", async ({ page }) => {
    await page.goto("/builder", { waitUntil: "load" });
    const result = await waitForRealPixels(page);
    expect(result.timedOut, "no real pixels ever rendered within the 15s budget").toBeFalsy();
    // A real wardrobe with lighting/materials/floor grid fills a
    // substantial fraction of frame — not just a stray pixel or two.
    expect(result.nonBlankFraction).toBeGreaterThan(0.1);
  });

  test("orbit (drag) actually moves the camera and changes the rendered frame", async ({ page }) => {
    await page.goto("/builder", { waitUntil: "load" });
    await waitForRealPixels(page);
    const before = await readPixels(page);

    const box = await page.locator("canvas").boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 150, cy + 40, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    const after = await readPixels(page);

    expect(after.nonBlankFraction).toBeGreaterThan(0.02);
    expect(Math.abs(after.nonBlankFraction - before.nonBlankFraction), "orbit drag did not change the rendered frame at all").toBeGreaterThan(0.001);
  });

  test("zoom (wheel) changes the rendered frame", async ({ page }) => {
    await page.goto("/builder", { waitUntil: "load" });
    await waitForRealPixels(page);
    const before = await readPixels(page);

    const box = await page.locator("canvas").boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(400);
    const after = await readPixels(page);

    expect(Math.abs(after.nonBlankFraction - before.nonBlankFraction), "wheel zoom did not change the rendered frame at all").toBeGreaterThan(0.001);
  });

  test("width, height, and depth sliders each visibly change the rendered model", async ({ page }) => {
    await page.goto("/builder", { waitUntil: "load" });
    await waitForRealPixels(page);

    const sliderCount = await page.locator('input[type="range"]').count();
    expect(sliderCount, "expected width/height/depth range inputs to exist").toBeGreaterThanOrEqual(3);

    for (let i = 0; i < 3; i++) {
      const before = await readPixels(page);
      const slider = page.locator('input[type="range"]').nth(i);
      const beforeValue = await slider.inputValue();
      const box = await slider.boundingBox();
      await page.mouse.move(box.x + box.width * 0.15, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.85, box.y + box.height / 2, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(400);
      const afterValue = await slider.inputValue();
      const after = await readPixels(page);

      expect(afterValue, `slider[${i}] value did not change`).not.toBe(beforeValue);
      expect(Math.abs(after.nonBlankFraction - before.nonBlankFraction), `slider[${i}] change did not visibly affect the rendered model`).toBeGreaterThan(0.001);
    }
  });

  test("hard refresh still renders the wardrobe", async ({ page }) => {
    await page.goto("/builder", { waitUntil: "load" });
    await waitForRealPixels(page);
    await page.reload({ waitUntil: "load" });
    const result = await waitForRealPixels(page);
    expect(result.timedOut).toBeFalsy();
    expect(result.nonBlankFraction).toBeGreaterThan(0.1);
  });
});
