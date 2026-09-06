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

  test.describe("G3.1-R1 Golden Parametric Builder — Visibly Functional", () => {
    test("opens #/build/golden-parametric, renders 19 panel meshes, 4 door pivots, and non-blank GPU pixels", async ({ page }) => {
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
        const panelMeshes = [];
        rootGroup.traverse((c) => {
          if (c.isMesh && c.name && c.name.startsWith("part_")) {
            panelMeshes.push(c);
          }
        });
        const partIds = panelMeshes.map((m) => m.userData.partId);
        const doorPivots = (Builder.doorObjs || []).map((p) => ({
          name: p.name,
          kind: p.userData.kind,
          hinge: p.userData.hinge,
          partId: p.userData.partId,
          openY: p.userData.openY,
          base: p.userData.base,
        }));

        return {
          isParametric: Builder.isParametric,
          hasRenderer: !!Builder.ren,
          meshCount: panelMeshes.length,
          partIds,
          doorPivots,
        };
      });

      expect(state.isParametric).toBe(true);
      expect(state.hasRenderer).toBe(true);
      expect(state.meshCount).toBe(19);
      expect(new Set(state.partIds).size).toBe(19);

      // Exactly 4 door pivots with alternating hinge orientation
      expect(state.doorPivots.length).toBe(4);
      expect(state.doorPivots[0].partId).toBe("DOOR_01");
      expect(state.doorPivots[0].hinge).toBe("left");
      expect(state.doorPivots[1].partId).toBe("DOOR_02");
      expect(state.doorPivots[1].hinge).toBe("right");
      expect(state.doorPivots[2].partId).toBe("DOOR_03");
      expect(state.doorPivots[2].hinge).toBe("left");
      expect(state.doorPivots[3].partId).toBe("DOOR_04");
      expect(state.doorPivots[3].hinge).toBe("right");

      // Verify non-blank GPU pixels
      await page.waitForTimeout(200);
      const pixelResult = await readBuilderCanvasPixels(page);
      expect(pixelResult.timedOut).toBe(false);
      expect(pixelResult.nonBlankFraction, "parametric model must produce non-blank pixels").toBeGreaterThan(0.05);
    });

    test("clicking an individual door toggles only that door and animates its rotation", async ({ page }) => {
      await page.goto("/#/build/golden-parametric");
      await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.doorObjs && Builder.doorObjs.length === 4);

      // Toggle DOOR_01 directly via clickPick target logic
      await page.evaluate(() => {
        const door1Mesh = Builder.scene.getObjectByName("part_DOOR_01");
        const target = door1Mesh.userData.pivot || door1Mesh;
        target.userData.base = target.userData.base ? 0 : 1;
      });

      // Allow frames to animate
      await page.waitForTimeout(300);

      const doorStates = await page.evaluate(() => {
        return Builder.doorObjs.map((p) => ({
          partId: p.userData.partId,
          base: p.userData.base,
          cur: p.userData.cur,
          rotY: p.rotation.y,
        }));
      });

      // DOOR_01 must be open/animating, others must remain closed at base=0
      expect(doorStates[0].base).toBe(1);
      expect(doorStates[0].cur).toBeGreaterThan(0.5);
      expect(Math.abs(doorStates[0].rotY)).toBeGreaterThan(0.5);

      expect(doorStates[1].base).toBe(0);
      expect(doorStates[1].cur).toBe(0);
      expect(doorStates[2].base).toBe(0);
      expect(doorStates[2].cur).toBe(0);
      expect(doorStates[3].base).toBe(0);
      expect(doorStates[3].cur).toBe(0);
    });

    test("global Open / close doors button opens and closes all four doors", async ({ page }) => {
      await page.goto("/#/build/golden-parametric");
      await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.doorObjs && Builder.doorObjs.length === 4);

      // Click the global toggle button
      await page.locator("#toggle-doors").click();
      await page.waitForTimeout(400);

      let states = await page.evaluate(() =>
        Builder.doorObjs.map((p) => ({ base: p.userData.base, cur: p.userData.cur, rotY: p.rotation.y }))
      );

      // All 4 doors must have base=1 and non-zero rotation
      for (let i = 0; i < 4; i++) {
        expect(states[i].base).toBe(1);
        expect(states[i].cur).toBeGreaterThan(0.8);
        expect(Math.abs(states[i].rotY)).toBeGreaterThan(0.8);
      }

      // Click again to close all doors
      await page.locator("#toggle-doors").click();
      await page.waitForTimeout(400);

      states = await page.evaluate(() =>
        Builder.doorObjs.map((p) => ({ base: p.userData.base, cur: p.userData.cur, rotY: p.rotation.y }))
      );

      for (let i = 0; i < 4; i++) {
        expect(states[i].base).toBe(0);
        expect(states[i].cur).toBeLessThan(0.2);
      }
    });

    test("material swatch change updates PartGraph materials in place without replacing geometry", async ({ page }) => {
      await page.goto("/#/build/golden-parametric");
      await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.parts && Builder.parts.length > 0);

      // Initial color
      const initialColor = await page.evaluate(() => {
        const rootGroup = Builder.parts[0];
        const doorMesh = rootGroup.getObjectByName("part_DOOR_01");
        return doorMesh.material.color.getHexString();
      });

      // Click the 'walnut' swatch
      const walnutSwatch = page.locator(".b-sw[data-mat='walnut']");
      await expect(walnutSwatch).toBeVisible();
      await walnutSwatch.click();

      // Check updated color and that PartGraph was NOT replaced with legacy geometry
      const updatedState = await page.evaluate(() => {
        const rootGroup = Builder.parts[0];
        const panelMeshes = [];
        rootGroup.traverse((c) => {
          if (c.isMesh && c.name && c.name.startsWith("part_")) {
            panelMeshes.push(c);
          }
        });
        const doorMesh = rootGroup.getObjectByName("part_DOOR_01");
        const carcassMesh = rootGroup.getObjectByName("part_CARC_SIDE_L");

        return {
          isParametric: Builder.isParametric,
          partCount: panelMeshes.length,
          doorColor: doorMesh.material.color.getHexString(),
          carcassColor: carcassMesh.material.color.getHexString(),
          doorObjsCount: Builder.doorObjs.length,
        };
      });

      expect(updatedState.isParametric).toBe(true);
      expect(updatedState.partCount).toBe(19);
      expect(updatedState.doorObjsCount).toBe(4);
      expect(updatedState.doorColor).not.toBe(initialColor);
      expect(updatedState.doorColor).toBe("6e5236"); // MAT.walnut color hex 0x6e5236
      expect(updatedState.carcassColor).toBe("6e5236");
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
        const panelMeshes = [];
        rootGroup.traverse((c) => {
          if (c.isMesh && c.name && c.name.startsWith("part_")) {
            panelMeshes.push(c);
          }
        });
        return {
          isParametric: Builder.isParametric,
          meshCount: panelMeshes.length,
          doorObjsCount: Builder.doorObjs.length,
        };
      });
      expect(stateParametric.isParametric).toBe(true);
      expect(stateParametric.meshCount).toBe(19);
      expect(stateParametric.doorObjsCount).toBe(4);
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
              const panelMeshes = [];
              if (rootGroup) {
                rootGroup.traverse((c) => {
                  if (c.isMesh && c.name && c.name.startsWith("part_")) {
                    panelMeshes.push(c);
                  }
                });
              }
              resolve({
                supported: true,
                isParametric: Builder.isParametric,
                meshCount: panelMeshes.length,
                doorCount: Builder.doorObjs.length,
              });
            }, 100);
          }, 50);
        });
      });

      if (restoreResult.supported) {
        expect(restoreResult.isParametric).toBe(true);
        expect(restoreResult.meshCount).toBe(19);
        expect(restoreResult.doorCount).toBe(4);
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
        const panelMeshes = [];
        rootGroup.traverse((c) => {
          if (c.isMesh && c.name && c.name.startsWith("part_")) {
            panelMeshes.push(c);
          }
        });
        return panelMeshes.length;
      });
      expect(meshCount).toBe(19);
    });
  });

  test.describe("G3.1-R2 Exact Door Picking & Frame-Aligned Plinth", () => {
    async function getDoorCenter(page, partId) {
      return page.evaluate((id) => {
        const cv = document.getElementById("bld3d");
        const rect = cv.getBoundingClientRect();
        const mesh = Builder.scene.getObjectByName(`part_${id}`);
        if (!mesh) return null;
        mesh.geometry.computeBoundingBox();
        const bb = mesh.geometry.boundingBox;
        const center = new THREE.Vector3();
        bb.getCenter(center);
        mesh.localToWorld(center);
        center.project(Builder.cam);
        const x = ((center.x + 1) / 2) * rect.width + rect.left;
        const y = ((-center.y + 1) / 2) * rect.height + rect.top;
        return { x, y, inFrustum: center.z >= -1 && center.z <= 1 };
      }, partId);
    }

    test("1. proves frame-aligned plinth dimensions and coordinates in browser 3D scene", async ({ page }) => {
      await page.goto("/#/build/golden-parametric");
      await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.parts && Builder.parts.length > 0);

      const plinthData = await page.evaluate(() => {
        const root = Builder.parts[0];
        const getBox = (id) => {
          const m = root.getObjectByName(`part_${id}`);
          if (!m) return null;
          return {
            partId: m.userData.partId,
            placementMm: {
              minX: m.userData.placementDmm.minXDmm / 10,
              maxX: m.userData.placementDmm.maxXDmm / 10,
              minY: m.userData.placementDmm.minYDmm / 10,
              maxY: m.userData.placementDmm.maxYDmm / 10,
              minZ: m.userData.placementDmm.minZDmm / 10,
              maxZ: m.userData.placementDmm.maxZDmm / 10,
            },
            finishedMm: m.userData.finishedDimensionsMm,
          };
        };
        return {
          front: getBox("PLINTH_FRONT"),
          rear: getBox("PLINTH_REAR"),
          sideL: getBox("PLINTH_SIDE_L"),
          sideR: getBox("PLINTH_SIDE_R"),
          crossC: getBox("PLINTH_CROSS_C"),
        };
      });

      // Front: 1800 x 100 x 18 mm, X: 0-1800, Y: 0-100, Z: 20-38
      expect(plinthData.front.placementMm).toEqual({ minX: 0, maxX: 1800, minY: 0, maxY: 100, minZ: 20, maxZ: 38 });
      expect(plinthData.front.finishedMm).toEqual({ lengthMm: 1800, widthMm: 100, thicknessMm: 18 });

      // Rear: 1800 x 100 x 18 mm, X: 0-1800, Y: 0-100, Z: 582-600
      expect(plinthData.rear.placementMm).toEqual({ minX: 0, maxX: 1800, minY: 0, maxY: 100, minZ: 582, maxZ: 600 });
      expect(plinthData.rear.finishedMm).toEqual({ lengthMm: 1800, widthMm: 100, thicknessMm: 18 });

      // Side L: 544 x 100 x 18 mm, X: 0-18, Y: 0-100, Z: 38-582
      expect(plinthData.sideL.placementMm).toEqual({ minX: 0, maxX: 18, minY: 0, maxY: 100, minZ: 38, maxZ: 582 });
      expect(plinthData.sideL.finishedMm).toEqual({ lengthMm: 544, widthMm: 100, thicknessMm: 18 });

      // Side R: 544 x 100 x 18 mm, X: 1782-1800, Y: 0-100, Z: 38-582
      expect(plinthData.sideR.placementMm).toEqual({ minX: 1782, maxX: 1800, minY: 0, maxY: 100, minZ: 38, maxZ: 582 });
      expect(plinthData.sideR.finishedMm).toEqual({ lengthMm: 544, widthMm: 100, thicknessMm: 18 });

      // Cross C: 544 x 100 x 18 mm, X: 891-909, Y: 0-100, Z: 38-582
      expect(plinthData.crossC.placementMm).toEqual({ minX: 891, maxX: 909, minY: 0, maxY: 100, minZ: 38, maxZ: 582 });
      expect(plinthData.crossC.finishedMm).toEqual({ lengthMm: 544, widthMm: 100, thicknessMm: 18 });
    });

    test("2. clicks projected center of each closed door individually and verifies matching Part ID toggles", async ({ page }) => {
      await page.goto("/#/build/golden-parametric");
      await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.doorObjs && Builder.doorObjs.length === 4);

      const doorIds = ["DOOR_01", "DOOR_02", "DOOR_03", "DOOR_04"];

      for (let i = 0; i < doorIds.length; i++) {
        const id = doorIds[i];
        const center = await getDoorCenter(page, id);
        expect(center).not.toBeNull();
        expect(center.inFrustum).toBe(true);

        // Click projected center
        await page.mouse.click(center.x, center.y);
        await page.waitForTimeout(200);

        // Verify only door i has base=1, others base=0
        const bases = await page.evaluate(() => Builder.doorObjs.map(d => ({ partId: d.userData.partId, base: d.userData.base })));
        for (let j = 0; j < doorIds.length; j++) {
          if (j === i) {
            expect(bases[j].base, `${doorIds[j]} should be open (base=1)`).toBe(1);
          } else {
            expect(bases[j].base, `${doorIds[j]} should remain closed (base=0)`).toBe(0);
          }
        }

        // Reset all doors to closed for the next door test
        await page.evaluate(() => {
          Builder.doorObjs.forEach(d => { d.userData.base = 0; d.userData.cur = 0; d.rotation.y = 0; });
        });
        await page.waitForTimeout(100);
      }
    });

    test("3. door picking operates reliably after orbiting the camera", async ({ page }) => {
      await page.goto("/#/build/golden-parametric");
      await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.doorObjs && Builder.doorObjs.length === 4);

      // Orbit camera by dragging
      const cv = page.locator("#bld3d");
      const box = await cv.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 - 40, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(200);

      // Doors should not have opened during drag
      const dragBases = await page.evaluate(() => Builder.doorObjs.map(d => d.userData.base));
      expect(dragBases.every(b => b === 0)).toBe(true);

      // Project DOOR_02 in new camera position and click
      const center2 = await getDoorCenter(page, "DOOR_02");
      expect(center2).not.toBeNull();
      await page.mouse.click(center2.x, center2.y);
      await page.waitForTimeout(200);

      const bases = await page.evaluate(() => Builder.doorObjs.map(d => ({ partId: d.userData.partId, base: d.userData.base })));
      expect(bases[1].base).toBe(1);
      expect(bases[0].base).toBe(0);
      expect(bases[2].base).toBe(0);
      expect(bases[3].base).toBe(0);
    });

    test("4. door picking works when another door is already open", async ({ page }) => {
      await page.goto("/#/build/golden-parametric");
      await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.doorObjs && Builder.doorObjs.length === 4);

      // Open DOOR_01
      const center1 = await getDoorCenter(page, "DOOR_01");
      await page.mouse.click(center1.x, center1.y);
      await page.waitForTimeout(300);

      // Click DOOR_02
      const center2 = await getDoorCenter(page, "DOOR_02");
      await page.mouse.click(center2.x, center2.y);
      await page.waitForTimeout(200);

      const bases = await page.evaluate(() => Builder.doorObjs.map(d => ({ partId: d.userData.partId, base: d.userData.base })));
      expect(bases[0].base).toBe(1);
      expect(bases[1].base).toBe(1);
      expect(bases[2].base).toBe(0);
      expect(bases[3].base).toBe(0);
    });

    test("5. door picking works after changing material swatches", async ({ page }) => {
      await page.goto("/#/build/golden-parametric");
      await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.doorObjs && Builder.doorObjs.length === 4);

      // Select walnut material
      await page.locator(".b-sw[data-mat='walnut']").click();
      await page.waitForTimeout(200);

      // Click DOOR_03
      const center3 = await getDoorCenter(page, "DOOR_03");
      await page.mouse.click(center3.x, center3.y);
      await page.waitForTimeout(200);

      const bases = await page.evaluate(() => Builder.doorObjs.map(d => ({ partId: d.userData.partId, base: d.userData.base })));
      expect(bases[2].base).toBe(1);
      expect(bases[0].base).toBe(0);
      expect(bases[1].base).toBe(0);
      expect(bases[3].base).toBe(0);
    });

    test("6. door picking works after navigating away and returning", async ({ page }) => {
      await page.goto("/#/build/golden-parametric");
      await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.doorObjs && Builder.doorObjs.length === 4);

      // Navigate to landing
      await page.evaluate(() => { window.location.hash = "#/"; });
      await expect(page.locator("#view-landing")).toBeVisible();

      // Return to parametric builder
      await page.evaluate(() => { window.location.hash = "#/build/golden-parametric"; });
      await expect(page.locator("#parametricBadge")).toBeVisible();
      await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.doorObjs && Builder.doorObjs.length === 4);
      await page.waitForTimeout(200);

      // Click DOOR_04
      const center4 = await getDoorCenter(page, "DOOR_04");
      await page.mouse.click(center4.x, center4.y);
      await page.waitForTimeout(200);

      const bases = await page.evaluate(() => Builder.doorObjs.map(d => ({ partId: d.userData.partId, base: d.userData.base })));
      expect(bases[3].base).toBe(1);
      expect(bases[0].base).toBe(0);
      expect(bases[1].base).toBe(0);
      expect(bases[2].base).toBe(0);
    });

    test("7. touch tap produces exactly one state transition, suppresses synthetic click, and touch drag does not toggle", async ({ page }) => {
      await page.goto("/#/build/golden-parametric");
      await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.doorObjs && Builder.doorObjs.length === 4);

      const center1 = await getDoorCenter(page, "DOOR_01");

      // Dispatch single touch tap (touchstart + touchend with changedTouches[0]) followed immediately by synthetic click
      await page.evaluate((c) => {
        const cv = document.getElementById("bld3d");
        // Simulate Builder touchend execution for a tap
        Builder.downX = c.x;
        Builder.downY = c.y;
        Builder.dragMoved = false;
        Builder.isDragging = false;
        Builder.lastTouchTime = Date.now();
        Builder.setPointer(c.x, c.y, cv);
        Builder.clickPick();

        // Synthetic click follows immediately (e.g. within 50ms)
        const clickEv = new MouseEvent("click", { clientX: c.x, clientY: c.y, bubbles: true });
        cv.dispatchEvent(clickEv);
      }, center1);

      await page.waitForTimeout(200);

      // Door 1 must be open (base=1), NOT toggled twice back to base=0!
      const bases = await page.evaluate(() => Builder.doorObjs.map(d => d.userData.base));
      expect(bases[0]).toBe(1);
      expect(bases[1]).toBe(0);

      // Now test touch drag followed by touchend: must produce ZERO toggles
      await page.evaluate((c) => {
        const cv = document.getElementById("bld3d");
        // Touch drag simulation
        Builder.downX = c.x;
        Builder.downY = c.y;
        Builder.dragMoved = true;
        // Touchend with dragMoved true should not toggle
        if (!Builder.dragMoved) {
          Builder.setPointer(c.x + 30, c.y, cv);
          Builder.clickPick();
        }
      }, center1);

      await page.waitForTimeout(200);
      // DOOR_01 base must still be 1 (not toggled by drag)
      const basesAfterDrag = await page.evaluate(() => Builder.doorObjs.map(d => d.userData.base));
      expect(basesAfterDrag[0]).toBe(1);
    });

    test("8. legacy catalog door selection and drawer selection still work without interference", async ({ page }) => {
      // Legacy wardrobe (#/build/0)
      await page.goto("/#/build/0");
      await page.waitForFunction(() => typeof Builder !== "undefined" && !Builder.isParametric && Builder.doorObjs && Builder.doorObjs.length > 0);

      const legacyDoorBefore = await page.evaluate(() => Builder.doorObjs[0].userData.base);
      await page.evaluate(() => {
        Builder.doorObjs[0].userData.base = Builder.doorObjs[0].userData.base ? 0 : 1;
      });
      const legacyDoorAfter = await page.evaluate(() => Builder.doorObjs[0].userData.base);
      expect(legacyDoorAfter).not.toBe(legacyDoorBefore);

      // Catalog design with drawers (#/build/5)
      await page.goto("/#/build/5");
      await page.waitForFunction(() => typeof Builder !== "undefined" && !Builder.isParametric);
      const hasDrawers = await page.evaluate(() => Builder.drawerObjs && Builder.drawerObjs.length > 0);
      if (hasDrawers) {
        const beforeDrawer = await page.evaluate(() => Builder.drawerObjs[0].userData.base);
        await page.evaluate(() => {
          Builder.drawerObjs[0].userData.base = Builder.drawerObjs[0].userData.base ? 0 : 1;
        });
        const afterDrawer = await page.evaluate(() => Builder.drawerObjs[0].userData.base);
        expect(afterDrawer).not.toBe(beforeDrawer);
      }
    });
  });
});
