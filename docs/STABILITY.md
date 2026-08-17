# FURNIAI M1 BROWSER STABILITY & ARCHITECTURE SPECIFICATION

**Date:** 2026-08-16  
**Target Branch:** `antigravity/M1-stability-20260816`  
**Base Integration SHA:** `c823c2bb252f525cffd148f1f5fd0f9fae7ee937`

---

## 1. RUNTIME SOURCE AUTHORITY

* **Deployment Target:** Vercel static output (`index.html`, `styles.css`, `legacy-builder-adapter.js`).
* **Active Runtime Code:** The client application logic and 3D parametric configurator are embedded directly in [`index.html`](../index.html) and [`legacy-builder-adapter.js`](../legacy-builder-adapter.js).
* **Orphaned Source Code:** `app.js` is an orphaned leftover with a syntax error on line 186 and is **not loaded** by `index.html`. It must never be used as a runtime authority.

---

## 2. WEBGL LIFECYCLE & MEMORY MANAGEMENT

### A. Context Exhaustion & Gallery One-Shot Rendering
* **Problem:** Previously, creating a separate WebGL context for every gallery card canvas on startup caused WebGL context exhaustion (`WEBGL_CONTEXT_LOST`) and canvas blanking.
* **Solution (`initGalleryThumbnails`):**
  * A single temporary offscreen `WebGLRenderer` renders each item in the complete `DESIGNS` catalog (30 catalog items, `DESIGNS.length === 30`) to an offscreen canvas during initialization.
  * The rendered bitmap is copied to each card's 2D canvas context using `drawImage()`.
  * All geometries, materials (except shared global textures), and the offscreen WebGL renderer are disposed immediately.
  * Result: **0 active WebGL contexts for gallery cards**, processing all 30 catalog items without background RAF loop overhead.

### B. RAF Animation Loop Suspension
* **Tracked Animation Frame IDs:** `hRafId` (Hero) and `bldRafId` (Builder).
* **View-Based Suspension:**
  * When `showBuilder()` is active, `stopHeroLoop()` halts the Hero RAF loop.
  * When `showLanding()` is active, `stopBuilderLoop()` halts the Builder RAF loop.
* **Visibility API Integration:**
  * A global `visibilitychange` event listener automatically pauses all active RAF animation loops when the browser tab is hidden or minimized (`document.hidden === true`), and resumes only the active view when visible.
  * `startHeroLoop()` and `Builder.startLoop()` include explicit `document.hidden` guards to prevent loop startup while the page is concealed.

### C. Resource Disposal Ownership & Deduplication
* **Shared Textures (PRESERVED):** `_grainTex` (CanvasTexture bump map) and `_mirrorEnv` (CubeTexture environment map) are NEVER disposed during normal `Builder.clear()`.
* **Owned Geometries & Materials (DISPOSED ONCE):**
  * `Builder.clear()` uses `Set` deduplication (`seenObjects`, `seenGeometries`, `seenMaterials`, `seenTextures`) to ensure each owned geometry, material, and texture reference is disposed at most once, preventing double disposal across overlapping `parts`, `doorObjs`, `drawerObjs`, and group hierarchies.

### D. Context Loss Recovery
* Both `#hero3d` and `#bld3d` canvases register `webglcontextlost` and `webglcontextrestored` event listeners.
* On `webglcontextlost`, the animation loop halts cleanly (`e.preventDefault()`).
* On `webglcontextrestored`, render settings (shadow maps, encoding, tone mapping) are re-established and the 3D scene is rebuilt seamlessly, provided `document.hidden` is false.

---

## 3. VERIFICATION

1. `npm test` — Passed Vitest test suite and Node validator tests.
2. `npm run lint` — Passed with 0 errors / 0 warnings.
3. `npm run docs:check` — Passed link and structural validation.
4. `npm run build` — Next.js production build succeeded cleanly.
5. `src/lib/sourceLifecycleRegression.test.js` — Source-level static-analysis
   suite validating WebGL context loss handlers, RAF loop control,
   Set-based disposal dedup, and the single-shot gallery generator are
   present in the real shipped `index.html` (not a reimplemented copy).
6. `npm run test:browser` (`tests/browser/site.spec.js`, Playwright +
   real headless Chromium) — an actual browser loads the real static files
   from `scripts/static-server.js` over real WebGL: homepage + hero canvas,
   all 30 catalog cards, opening the Builder from a card, opening a
   wardrobe/kitchen/vanity design specifically, a dimension slider actually
   changing rendered state, and 5 rounds of landing↔builder navigation with
   zero uncaught JS errors and the Builder RAF loop provably stopped on
   return to landing. This is real browser automation, not a string/regex
   assertion — see the file's own doc comment for exactly what it does and
   does not prove.
   **Scope boundary, stated plainly:** this proves the app survives real
   navigation without throwing or leaking a running RAF loop. It does **not**
   measure sustained frame-rate stability or memory growth over a long
   session — that needs a real GPU and a human watching a real tab over
   time, which this headless, software-rendered sandbox cannot provide.
   Long-run WebGL endurance under real usage still requires founder/
   interactive-browser verification.
