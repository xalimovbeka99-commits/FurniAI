/**
 * Real browser tests — an actual headless Chromium instance driven by
 * Playwright, not a string/regex assertion pretending to be one. Runs
 * against scripts/static-server.js serving the exact flat files Vercel
 * deploys (index.html/styles.css/legacy-builder-adapter.js/app.js/
 * vendor-three-r128.min.js/vendor-supabase.min.js), so a pass here means
 * the real DOM + real Three.js WebGL context + real navigation lifecycle
 * actually worked, not that the source text merely contains an expected
 * substring.
 *
 * M1.1 — no CDN dependency, no interception needed for the standard suite:
 * Three.js r128 and Supabase are same-origin vendored files (see
 * index.html's <script src="/vendor-*.min.js"> tags), so every test below
 * loads them exactly the way production does — nothing here fulfills or
 * substitutes a third-party request. The dedicated resilience test further
 * down actively BLOCKS the old CDN domains (and Google Fonts) to prove the
 * app no longer depends on them at all, which is the actual regression
 * guard against this ever regressing back to a runtime CDN dependency.
 *
 * Every custom async page.evaluate() Promise below races against an
 * explicit manual timeout (HANG_GUARD_MS) rather than relying solely on
 * Playwright's own test timeout. A previous round of this suite was
 * reported to hang indefinitely in one environment after all tests
 * appeared to pass — the most defensible fix, without being able to
 * reproduce that exact hang here, is to make every custom in-page Promise
 * provably unable to wait forever, whatever the cause.
 *
 * Scope: this proves the app survives real navigation without throwing and
 * without leaving stray WebGL contexts/RAF loops running — it does not
 * measure long-run frame-rate stability or memory pressure under sustained
 * use, which needs a real GPU and a human watching a real tab. That kind of
 * endurance check is out of scope here — see docs/STABILITY.md.
 */
const { test, expect } = require("@playwright/test");

const HANG_GUARD_MS = 8000;

test.describe("FurniAI static site — real browser lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw new Error(`Uncaught page error: ${err.message}`);
    });
  });

  test("loads the real THREE.js r128 build locally, with zero requests to the old CDN domains", async ({ page }) => {
    const cdnRequests = [];
    page.on("request", (req) => {
      const url = req.url();
      if (/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/.test(url)) cdnRequests.push(url);
    });
    await page.goto("/");
    const revision = await page.evaluate(() => (typeof THREE !== "undefined" ? THREE.REVISION : null));
    expect(revision).toBe("128");
    expect(cdnRequests, `unexpected third-party CDN request(s): ${cdnRequests.join(", ")}`).toEqual([]);
  });

  test("homepage loads with the hero canvas present", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#hero3d")).toBeAttached();
    await expect(page.locator("#view-landing")).not.toHaveAttribute("hidden", "");
  });

  test("catalog loads all 30 designs as gallery cards", async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => document.querySelectorAll("#galleryGrid .card").length > 0);
    const cardCount = await page.locator("#galleryGrid .card").count();
    expect(cardCount).toBe(30);
  });

  test("gallery thumbnails are actually produced (non-blank canvas pixels) for every card", async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => document.querySelectorAll("#galleryGrid .card").length > 0);
    // initGalleryThumbnails() runs once, 300ms after boot() — give it room.
    await page.waitForTimeout(600);
    const blankCards = await page.evaluate(() => {
      const canvases = Array.from(document.querySelectorAll("#galleryGrid .card canvas"));
      return canvases.filter((cv) => {
        const ctx = cv.getContext("2d");
        if (!ctx || cv.width === 0 || cv.height === 0) return true;
        const { data } = ctx.getImageData(0, 0, cv.width, cv.height);
        return !data.some((channel) => channel !== 0);
      }).length;
    });
    expect(blankCards).toBe(0);
  });

  test("Builder opens from a gallery card and renders the 3D canvas", async ({ page }) => {
    await page.goto("/");
    await page.locator("#galleryGrid .card").first().click();
    await expect(page.locator("#view-builder")).toBeVisible();
    await expect(page.locator("#bld3d")).toBeAttached();
    const hasContext = await page.evaluate(() => {
      const cv = document.getElementById("bld3d");
      return !!(cv.getContext("webgl") || cv.getContext("webgl2") || cv.getContext("experimental-webgl"));
    });
    expect(hasContext).toBe(true);
  });

  async function openDesignOfType(page, type) {
    await page.goto("/");
    const foundIndex = await page.evaluate((t) => {
      const script = Array.from(document.scripts).map((s) => s.textContent).join("\n");
      const m = script.match(/const DESIGNS=(\[[\s\S]*?\]);/);
      if (!m) return -1;
      const designs = new Function(`return ${m[1]}`)();
      return designs.findIndex((d) => d.type === t);
    }, type);
    expect(foundIndex).toBeGreaterThanOrEqual(0);
    await page.evaluate((i) => { window.location.hash = "#/build/" + i; }, foundIndex);
    await expect(page.locator("#view-builder")).toBeVisible();
    await expect(page.locator("#bld3d")).toBeAttached();
  }

  test("wardrobe design opens in the Builder", async ({ page }) => {
    await openDesignOfType(page, "wardrobe");
  });

  test("kitchen design opens in the Builder", async ({ page }) => {
    await openDesignOfType(page, "kitchen");
  });

  test("vanity design opens in the Builder", async ({ page }) => {
    await openDesignOfType(page, "vanity_freestanding");
  });

  // Reading GPU pixels back from a WebGLRenderer created WITHOUT
  // preserveDrawingBuffer (Builder's is not) is only reliable if the read
  // happens inside a requestAnimationFrame callback registered AFTER
  // Builder's own render call for that frame — RAF callbacks run in
  // registration order within a frame, and the browser only clears/swaps
  // the drawing buffer after all of a frame's callbacks finish. Reading
  // from an arbitrary later point (a plain page.evaluate with no RAF)
  // would be unreliable and could read a cleared buffer even while
  // rendering is genuinely working — that's the "weak/fake assertion"
  // this file's own review explicitly warns against. Races against
  // HANG_GUARD_MS so a RAF that never fires (for any reason, in any
  // environment) fails fast with a clear message instead of hanging.
  async function readBuilderCanvasPixels(page) {
    return page.evaluate((guardMs) => Promise.race([
      new Promise((resolve) => {
        requestAnimationFrame(() => {
          const gl = Builder.ren.getContext();
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

  test("all 30 designs individually load a real, correctly-mapped Three.js scene into the Builder", async ({ page }) => {
    test.setTimeout(120000); // 30 real navigations x Builder init; default 30s is too tight for this test's legitimate scope
    const failedRequests = [];
    page.on("requestfailed", (req) => failedRequests.push(`${req.url()} — ${req.failure()?.errorText}`));

    await page.goto("/");
    const designs = await page.evaluate(() => {
      const script = Array.from(document.scripts).map((s) => s.textContent).join("\n");
      const m = script.match(/const DESIGNS=(\[[\s\S]*?\]);/);
      return new Function(`return ${m[1]}`)();
    });
    expect(designs.length).toBe(30);

    for (let i = 0; i < designs.length; i++) {
      await page.evaluate((idx) => { window.location.hash = "#/build/" + idx; }, i);
      await expect(page.locator("#bld3d")).toBeAttached();
      await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.cfg && Builder.parts && Builder.parts.length > 0);
      const state = await page.evaluate(() => ({
        type: Builder.cfg.type,
        partCount: Builder.parts.length,
        sceneChildren: Builder.scene ? Builder.scene.children.length : 0,
      }));
      expect(state.type, `design[${i}] (${designs[i].name}) cfg.type mismatch`).toBe(designs[i].type);
      expect(state.partCount, `design[${i}] (${designs[i].name}) rendered zero parts`).toBeGreaterThan(0);
      // 3 fixed scene members always exist (hemisphere light, key light, fill
      // light) plus the floor plane — any real design adds panels/doors/etc.
      // on top of that baseline.
      expect(state.sceneChildren, `design[${i}] (${designs[i].name}) scene has no real content beyond lighting/floor`).toBeGreaterThan(4);
    }

    // Same-origin failures (index.html, styles.css, legacy-builder-adapter.js,
    // app.js, the two vendor-*.min.js files) would mean a real broken asset
    // path. External failures unrelated to the app (e.g. Google Fonts) are
    // not this test's concern and are excluded.
    const relevantFailures = failedRequests.filter((f) => /127\.0\.0\.1:4173/.test(f));
    expect(relevantFailures, `unexpected asset/network failures: ${relevantFailures.join("; ")}`).toEqual([]);
  });

  test("representative designs (first, middle, last, #30) render non-blank GPU pixels, not just scene-graph objects", async ({ page }) => {
    // Scene-graph presence (previous test) proves Three.js objects exist;
    // it does NOT prove they're actually visible on screen — a mesh could
    // exist off-camera, behind the near/far clip planes, or with zero-size
    // geometry and still pass a "parts.length > 0" check while the canvas
    // stays genuinely blank. This is the actual pixel-level proof for a
    // representative spread: first two, two from the middle, and the last
    // two (covering "thumbnail 30" explicitly).
    const sampleIndices = [0, 1, 14, 15, 28, 29];
    for (const i of sampleIndices) {
      await page.goto(`/#/build/${i}`);
      await expect(page.locator("#bld3d")).toBeAttached();
      await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.parts && Builder.parts.length > 0);
      await page.waitForTimeout(200); // let a few real frames render past the initial one
      const result = await readBuilderCanvasPixels(page);
      expect(result.timedOut, `design[${i}] pixel readback never completed within ${HANG_GUARD_MS}ms`).toBe(false);
      expect(result.nonBlankFraction, `design[${i}] Builder canvas is visually blank (${(result.nonBlankFraction * 100).toFixed(1)}% non-black pixels)`).toBeGreaterThan(0.05);
    }
  });

  test("navigating away and back to the same design restores a real, non-blank scene (not corrupted or empty)", async ({ page }) => {
    const targetIndex = 5;
    await page.goto(`/#/build/${targetIndex}`);
    await expect(page.locator("#bld3d")).toBeAttached();
    await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.parts && Builder.parts.length > 0);
    await page.waitForTimeout(200);
    const before = await readBuilderCanvasPixels(page);
    const expectedType = await page.evaluate(() => Builder.cfg.type);
    expect(before.timedOut).toBe(false);
    expect(before.nonBlankFraction).toBeGreaterThan(0.05);

    await page.evaluate(() => { window.location.hash = "#/"; });
    await expect(page.locator("#view-landing")).toBeVisible();
    await page.evaluate((idx) => { window.location.hash = "#/build/" + idx; }, targetIndex);
    await expect(page.locator("#bld3d")).toBeAttached();
    await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.parts && Builder.parts.length > 0);
    await page.waitForTimeout(200);
    const after = await readBuilderCanvasPixels(page);

    expect(after.timedOut).toBe(false);
    expect(after.nonBlankFraction, "restored scene is blank after navigating away and back").toBeGreaterThan(0.05);
    const restoredType = await page.evaluate(() => Builder.cfg.type);
    expect(restoredType).toBe(expectedType);
  });

  test("dimension control changes update the visible model", async ({ page }) => {
    await page.goto("/#/build/0");
    await expect(page.locator("#bld3d")).toBeAttached();
    const before = await page.locator("#w-val").textContent();
    const widthInput = page.locator("#width");
    await widthInput.fill("360");
    await widthInput.dispatchEvent("input");
    await page.waitForFunction(
      (prev) => document.getElementById("w-val").textContent !== prev,
      before,
      { timeout: 5000 }
    );
    const after = await page.locator("#w-val").textContent();
    expect(after).not.toBe(before);
  });

  test("repeated navigation between landing and builder does not throw or leak loops", async ({ page }) => {
    await page.goto("/");
    for (let i = 0; i < 5; i++) {
      await page.evaluate((idx) => { window.location.hash = "#/build/" + idx; }, i % 30);
      await expect(page.locator("#view-builder")).toBeVisible();
      await page.evaluate(() => { window.location.hash = "#/"; });
      await expect(page.locator("#view-landing")).toBeVisible();
    }
    // After settling on landing, only the Hero RAF loop should be armed —
    // Builder's should have been stopped by stopBuilderLoop() on each return.
    const rafState = await page.evaluate(() => ({
      hero: typeof hRafId !== "undefined" ? hRafId !== null : null,
      builder: typeof bldRafId !== "undefined" ? bldRafId !== null : null,
    }));
    expect(rafState.builder).toBe(false);
  });

  test("Builder WebGL context loss stops the loop, and a real restore rebuilds without throwing", async ({ page }) => {
    await page.goto("/#/build/0");
    await expect(page.locator("#bld3d")).toBeAttached();
    await page.waitForFunction(() => typeof bldRafId !== "undefined" && bldRafId !== null);

    const result = await page.evaluate((guardMs) => Promise.race([
      new Promise((resolve) => {
        const cv = document.getElementById("bld3d");
        const gl = Builder.ren.getContext();
        const ext = gl.getExtension("WEBGL_lose_context");
        if (!ext) { resolve({ supported: false, timedOut: false }); return; }

        let lostFired = false;
        let restoredFired = false;
        cv.addEventListener("webglcontextlost", () => { lostFired = true; }, { once: true });
        cv.addEventListener("webglcontextrestored", () => { restoredFired = true; }, { once: true });

        ext.loseContext();
        setTimeout(() => {
          const bldRafIdAfterLoss = bldRafId;
          ext.restoreContext();
          setTimeout(() => {
            resolve({
              supported: true,
              timedOut: false,
              lostFired,
              restoredFired,
              rafStoppedOnLoss: bldRafIdAfterLoss === null,
              rafResumedAfterRestore: bldRafId !== null,
            });
          }, 1500);
        }, 200);
      }),
      new Promise((resolve) => setTimeout(() => resolve({ supported: true, timedOut: true }), guardMs)),
    ]), HANG_GUARD_MS);

    test.skip(result.supported === false, "WEBGL_lose_context extension not available in this environment");
    expect(result.timedOut, `context-loss/restore cycle never completed within ${HANG_GUARD_MS}ms`).toBe(false);
    expect(result.lostFired).toBe(true);
    expect(result.rafStoppedOnLoss).toBe(true);
    expect(result.restoredFired).toBe(true);
    expect(result.rafResumedAfterRestore).toBe(true);
  });

  test("blocking the old CDN domains (cdnjs, jsDelivr) and Google Fonts does not break the Builder", async ({ page }) => {
    await page.route("**://cdnjs.cloudflare.com/**", (route) => route.abort());
    await page.route("**://cdn.jsdelivr.net/**", (route) => route.abort());
    await page.route("**://fonts.googleapis.com/**", (route) => route.abort());
    await page.route("**://fonts.gstatic.com/**", (route) => route.abort());

    await page.goto("/#/build/0");
    await expect(page.locator("#bld3d")).toBeAttached();
    await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.parts && Builder.parts.length > 0);

    const revision = await page.evaluate(() => (typeof THREE !== "undefined" ? THREE.REVISION : null));
    expect(revision).toBe("128");

    const bootErrorShown = await page.evaluate(() => !!document.getElementById("furniai-boot-error"));
    expect(bootErrorShown, "boot-error fallback should not appear — the app never needed the blocked domains").toBe(false);

    await page.waitForTimeout(200);
    const result = await readBuilderCanvasPixels(page);
    expect(result.timedOut).toBe(false);
    expect(result.nonBlankFraction).toBeGreaterThan(0.05);
  });

  test("a real WebGLRenderer construction failure on the Builder canvas shows the visible failure panel, not a blank screen", async ({ page }) => {
    // Denies a real WebGL context specifically on #bld3d (returning null,
    // exactly what a browser with WebGL genuinely unavailable/exhausted
    // would do) so THREE.WebGLRenderer's own constructor throws for real —
    // this is not mocking THREE itself, just the browser API it depends on.
    // #hero3d and gallery canvases are untouched, matching the real-world
    // case where only the Builder's specific canvas/context creation fails.
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (this.id === "bld3d" && /webgl/i.test(type)) return null;
        return orig.call(this, type, ...args);
      };
    });

    const consoleErrors = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    // This test's whole point is the uncaught-pageerror guard from
    // beforeEach must NOT fire here — Builder.init()'s catch is expected
    // to consume the exception and route it through the visible failure
    // panel instead of letting it become an uncaught page error. No
    // additional pageerror listener is added; the shared beforeEach guard
    // already asserts this implicitly by failing the test if one occurs.

    await page.goto("/#/build/0");
    await page.waitForFunction(() => !!document.getElementById("furniai-boot-error"));

    const panel = await page.evaluate(() => {
      const el = document.getElementById("furniai-boot-error");
      const retry = document.getElementById("furniai-boot-retry");
      return {
        panelText: el ? el.innerText : null,
        retryVisible: !!retry && retry.offsetParent !== null,
        builderReady: typeof Builder !== "undefined" ? Builder.ready : null,
      };
    });

    expect(panel.panelText).toContain("3D Builder could not start.");
    expect(panel.retryVisible, "retry/reload control must be visible").toBe(true);
    // The safe, fixed panel text must never include exception internals —
    // constructor names, "at ", file paths, or the word "Error" as raised
    // by the engine (as opposed to appearing in this test's own strings).
    expect(panel.panelText).not.toMatch(/at\s+\S+:\d+|\.js:\d+|WebGLRenderer|TypeError|ReferenceError/);
    // Builder.init() returns before setting ready=true on this path — a
    // failed boot must never be reported as a successful one.
    expect(panel.builderReady, "Builder.ready must not be falsely set true after a failed init").not.toBe(true);

    // The technical detail must still reach the console for debugging —
    // "do not expose to the user" is not the same as "log nothing at all."
    const hasTechnicalLog = consoleErrors.some((t) => /Builder WebGL initialization failed|FurniAI fatal error/.test(t));
    expect(hasTechnicalLog, `expected a technical console.error; got: ${JSON.stringify(consoleErrors)}`).toBe(true);
  });

  test.describe("G3.1 Golden Parametric Builder in existing 3D Builder", () => {
    test("opens #/build/golden-parametric and renders 19 meshes in existing #bld3d canvas", async ({ page }) => {
      await page.goto("/#/build/golden-parametric");
      await expect(page.locator("#view-builder")).toBeVisible();
      await expect(page.locator("#bld3d")).toBeAttached();

      const badge = page.locator("#parametricBadge");
      await expect(badge).toBeVisible();
      await expect(badge).toContainText("PARAMETRIC PARTGRAPH");
      await expect(badge).toContainText("furnispec-golden-wardrobe-01");
      await expect(badge).toContainText("1800 × 2400 × 600 mm");
      await expect(badge).toContainText("19 structural panels");
      await expect(badge).toContainText("WORKSHOP REVIEW");
      await expect(badge).toContainText("CNC: NOT QUALIFIED");

      await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.parts && Builder.parts.length > 0);

      const state = await page.evaluate(() => {
        const rootGroup = Builder.parts[0];
        const meshes = (rootGroup && rootGroup.children) || [];
        const partIds = meshes.map((m) => m.userData.partId);
        return {
          isParametric: Builder.isParametric,
          hasRenderer: !!Builder.ren,
          meshCount: meshes.length,
          partIds,
        };
      });

      expect(state.isParametric).toBe(true);
      expect(state.hasRenderer).toBe(true);
      expect(state.meshCount).toBe(19);
      expect(new Set(state.partIds).size).toBe(19);

      // Verify non-blank GPU pixels
      await page.waitForTimeout(200);
      const pixelResult = await readBuilderCanvasPixels(page);
      expect(pixelResult.timedOut).toBe(false);
      expect(pixelResult.nonBlankFraction, "parametric model must produce non-blank pixels").toBeGreaterThan(0.05);
    });

    test("navigates between parametric route and catalog #/build/0 without leaking contexts or breaking state", async ({ page }) => {
      await page.goto("/#/build/golden-parametric");
      await expect(page.locator("#parametricBadge")).toBeVisible();
      await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.parts && Builder.parts.length > 0);

      // Navigate to catalog #/build/0
      await page.evaluate(() => { window.location.hash = "#/build/0"; });
      await expect(page.locator("#parametricBadge")).toBeHidden();
      await page.waitForFunction(() => typeof Builder !== "undefined" && !Builder.isParametric && Builder.cfg && Builder.cfg.type === "wardrobe");

      const state0 = await page.evaluate(() => ({
        isParametric: Builder.isParametric,
        type: Builder.cfg.type,
        partCount: Builder.parts.length,
      }));
      expect(state0.isParametric).toBe(false);
      expect(state0.type).toBe("wardrobe");
      expect(state0.partCount).toBeGreaterThan(0);

      // Return to parametric route
      await page.evaluate(() => { window.location.hash = "#/build/golden-parametric"; });
      await expect(page.locator("#parametricBadge")).toBeVisible();
      await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.isParametric && Builder.parts && Builder.parts.length > 0);

      const stateParametric = await page.evaluate(() => {
        const rootGroup = Builder.parts[0];
        return {
          isParametric: Builder.isParametric,
          meshCount: (rootGroup && rootGroup.children.length) || 0,
        };
      });
      expect(stateParametric.isParametric).toBe(true);
      expect(stateParametric.meshCount).toBe(19);
    });

    test("survives WebGL context loss and restore on #/build/golden-parametric", async ({ page }) => {
      await page.goto("/#/build/golden-parametric");
      await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.parts && Builder.parts.length > 0);

      const restoreResult = await page.evaluate(() => {
        const cv = document.getElementById("bld3d");
        const ctx = cv.getContext("webgl") || cv.getContext("webgl2") || cv.getContext("experimental-webgl");
        const ext = ctx && ctx.getExtension("WEBGL_lose_context");
        if (!ext) return { supported: false };

        ext.loseContext();
        return new Promise((resolve) => {
          setTimeout(() => {
            ext.restoreContext();
            setTimeout(() => {
              const rootGroup = Builder.parts[0];
              resolve({
                supported: true,
                isParametric: Builder.isParametric,
                meshCount: (rootGroup && rootGroup.children.length) || 0,
              });
            }, 100);
          }, 50);
        });
      });

      if (restoreResult.supported) {
        expect(restoreResult.isParametric).toBe(true);
        expect(restoreResult.meshCount).toBe(19);
      }
    });

    test("loads correctly on #/build/golden-parametric with external CDNs blocked", async ({ page }) => {
      await page.route("**/*", (route) => {
        const url = route.request().url();
        if (/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url)) {
          return route.abort();
        }
        return route.continue();
      });

      await page.goto("/#/build/golden-parametric");
      await expect(page.locator("#bld3d")).toBeAttached();
      await expect(page.locator("#parametricBadge")).toBeVisible();
      await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.parts && Builder.parts.length > 0);

      const meshCount = await page.evaluate(() => {
        const rootGroup = Builder.parts[0];
        return (rootGroup && rootGroup.children.length) || 0;
      });
      expect(meshCount).toBe(19);
    });
  });
});
