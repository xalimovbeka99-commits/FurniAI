# Generated-model asset viewer (M3): module contract

**Status:** isolated module, local commits only, on top of `a29f47b`
(`integ/pilot-oct18-candidate`). It is not mounted anywhere yet. All files are new:
`src/lib/assetViewer/**`, `tests/assetViewer/**`, `docs/m3/asset-viewer/**`.
No existing file was changed, including `index.html`, Studio code, the
parametric builder, `api/**`, `package.json` and `vitest.config.js`.

**Owner of this module:** Grok Asset Engineer. The Scenario backend belongs to
Claude Code. The Studio shell and site UI belong to Antigravity, who will
mount this module. Integration owns the output contract, which is still
open (see [OPEN QUESTIONS](#open-questions-for-integration)).

**Working assumptions, all provisional:** generated models arrive as glTF 2.0
(GLB). The viewer receives a *neutral* asset descriptor and does not use any
Scenario field names. The loader for each format sits behind an adapter
registry.

---

## 1. What the repo has today (read-only inspection at a29f47b)

| item | finding |
|---|---|
| three.js | `three ^0.166.0`, installed **0.166.1**, used only by the undeployed Next app (`src/lib/buildGeometry.js`, `src/lib/adapters/partGraphToThree.js`) |
| R3F / drei | `@react-three/fiber 9.7.0`, `@react-three/drei 10.7.8` in `src/app/builder/page.jsx` and `src/app/page.jsx` (`<Canvas>`, drei `<OrbitControls>`, `<Grid>`). `src/components/builder/LocalEnvironment.jsx` already bakes `RoomEnvironment` through `PMREMGenerator`, with no network env maps. That is the same approach used here. |
| jsm addons | `three/examples/jsm/loaders/GLTFLoader.js`, `controls/OrbitControls.js`, `environments/RoomEnvironment.js` and `exporters/GLTFExporter.js` are all present (0.166.1) |
| three-stdlib | 2.36.1, a transitive dependency of drei. It has its own GLTFLoader, OrbitControls and RoomEnvironment that feature-detect `colorSpace` versus `encoding` |
| static customer page | `index.html:50` loads `/vendor-three-r128.min.js`, which provides `window.THREE` with `REVISION "128"`. Its viewers are hand-written: they set `renderer.outputEncoding = THREE.sRGBEncoding`, use ACES tone mapping, and release resources with their own `disposeObject3DTree` (tested by `src/lib/disposalOwnership.test.js`). **The repo vendors no GLTFLoader and no OrbitControls for r128.** |
| vitest | `vitest 2.1.9`, `environment: "node"`. The repo has **no jsdom or happy-dom**. The root include covers `src/**/*.test.js`, `tests/{wardrobe-ai,part-graph,production,contract}/**`, but **not** `tests/assetViewer/**` |
| Playwright | `@playwright/test 1.62.1`. Chromium is in `~/.cache/ms-playwright` (chromium-1234 and headless shell), plus `/usr/bin/google-chrome`. Headless WebGL works with SwiftShader |
| bundling precedent | `src/lib/designs/myDesigns/entry.js` is built by `scripts/build-static.mjs` (esbuild IIFE, `globalName`) and has its client injected. This module copies that pattern |

### Scenario references

`grep -ri scenario src docs api` finds **no Scenario provider code, docs or
config**. Every hit is the ordinary word "scenario": test fixtures such as
`golden-scenarios.json`, `adversarial-scenarios.json` and `demoScenarios.js`.
Nothing in the repo describes a Scenario output format, a result shape, URLs
or blobs, thumbnails, metadata or scale. The only related material is:

- `docs/knowledge-base/image-to-custom-design-landscape.md`: image-to-3D tools
  (Tripo, Meshy, Hunyuan3D) output "USD/FBX/OBJ/STL/GLB/3MF". The file notes that
  this is "raw geometry with no construction semantics" and treats it as a deferred tier.
- `docs/research/07-furniture-cad-cam-execution-blueprint.md`: "glTF is the
  preferred web-preview asset"; "glTF/GLB = portable visual model".
- `docs/audit/BASELINE.md` and `PHASE1_PLAN.md`: proposed `.gitattributes` with
  `*.glb binary` / `*.gltf binary`. These were never committed, and the repo has no `.gitattributes`.

**So every format and shape choice below is an assumption for Integration to confirm.**

---

## 2. API

```js
import { mountAssetViewer } from "src/lib/assetViewer/index.js"; // or window.FurniAssetViewer (§9)

const viewer = mountAssetViewer(el, {
  three,                                  // REQUIRED: the THREE namespace (r128 window.THREE or r15x+)
  deps: { GLTFLoader, OrbitControls, RoomEnvironment }, // classes from the host page
  asset: { url, filename },              // optional: load right after mount
  onError: (err) => {},                  // { code, message, detail, status? }
});

await viewer.load(asset);   // -> { ok:true, state } | { ok:false, error, state } | { ok:false, superseded:true, state }
viewer.dispose();           // releases everything; idempotent
```

The **contract** is `load`, `dispose` and `onError`. These extras are also available:

| method | returns / does |
|---|---|
| `clear()` | drops the current model and any in-flight load, then goes back to `idle` |
| `fitToView()` | re-frames the model and keeps the current orbit direction. Returns the fit numbers, or `null` when no model is loaded |
| `getState()` | JSON-safe snapshot (§4) |
| `on(event, cb)` | `statechange`, `progress`, `ready`, `error`, `dispose`. Returns an unsubscribe function. Unknown event names throw |
| `download({ save? })` | original bytes plus filename and mime (§7). Returns `null` unless `ready` |

`load()` **never rejects**. A programmer error (no element) throws a
`TypeError` from `mountAssetViewer`. Everything else becomes an error state.

### Options

| option | default | notes |
|---|---|---|
| `three` | none (required) | missing gives `MISSING_DEPENDENCY` |
| `deps.GLTFLoader` | none | needed by the glb and gltf adapters. Missing gives `MISSING_DEPENDENCY` at load time |
| `deps.OrbitControls` | none | optional. Without it the camera is static and `capabilities.controls` is `false` |
| `deps.RoomEnvironment` | none | optional. With it, a neutral PMREM environment is baked locally. Without it, lighting is hemisphere plus directional only |
| `GLTFLoader` / `OrbitControls` / `RoomEnvironment` | | also accepted at the top level |
| `asset` | none | initial load |
| `onError` | none | called once for each non-superseded failure. Mount-time failures are reported in a microtask |
| `adapters` / `registry` | glb + gltf | §6 |
| `maxBytes` | 100 MiB | **placeholder**: gives `FILE_TOO_LARGE` |
| `parseTimeoutMs` | 120000 | a loader that never calls back gives `PARSE_FAILED` |
| `fetch` / `fetchCredentials` | global fetch / `"omit"` | see the CORS question |
| `background` | `0xf3f1ed` | `null` means transparent |
| `environment` | auto | `"none"` disables PMREM |
| `fov` | 40 | |
| `ui` | `true` | built-in status overlay and scale badge. `false` lets the host render its own UI from events |
| `createRenderer`, `requestAnimationFrame`, `cancelAnimationFrame` | browser defaults | injection points for tests |

### Neutral asset descriptor (PROVISIONAL)

```js
{ url?: string, arrayBuffer?: ArrayBuffer | TypedArray, blob?: Blob,   // exactly one source
  format?: "glb" | "gltf" | <registered id>,  mime?: string,  filename?: string,
  scale?: unknown }   // accepted but ignored (§5)
```

The format is chosen in this order:

1. An explicit `format` that is not registered gives `UNSUPPORTED_FORMAT` and nothing is fetched.
2. Otherwise `mime`, then the extension of `filename` or the URL path, act as a hint.
   A known-but-unsupported extension (`obj fbx usdz usd* stl 3mf ply dae blend step stp 3ds max`)
   fails before any fetch.
3. After the bytes arrive, **a content sniff wins** over the hints.
   Storage often serves `application/octet-stream`.
4. No match at all gives `UNSUPPORTED_FORMAT`.

---

## 3. State machine

```
idle ──load()──▶ loading{phase: fetching ─▶ parsing} ──▶ ready
  ▲                    │                                   │
  └──── clear() ───────┴──────────▶ error ◀────────────────┘ (next load can recover)
any ── dispose() ──▶ disposed (terminal; load() → VIEWER_DISPOSED)
```

- **Progress:** while fetching, `progress = { loaded, total|null, ratio|null }` is
  streamed from `res.body`. `ratio` is `null` when `content-length` is
  unknown. Bytes already in memory (an ArrayBuffer or Blob) go straight to `parsing`.
- **Supersession:** a `load()`, `clear()` or `dispose()` call bumps the load id.
  The older fetch is **aborted** through `AbortController`. If the older parse finishes
  anyway, its scene is **disposed without ever being added**. The older promise
  resolves `{ ok:false, superseded:true }` and **never** fires `onError` or changes state.
- **On error** the previously displayed model is disposed. An error
  message never sits on top of a stale model.

### Error codes

| code | when | message shown (customer-safe) |
|---|---|---|
| `INVALID_ASSET` | no source, several sources, or a bad type | This model can't be shown: no file or link was provided. |
| `UNSUPPORTED_FORMAT` | unregistered format, known-unsupported extension, or unrecognised content | This model's file type isn't supported by the viewer yet. |
| `FETCH_FAILED` | network error, non-2xx response (`status` kept, e.g. 403 for an expired signed URL), or a body read failure | The model couldn't be downloaded. Check your connection and try again. |
| `FILE_TOO_LARGE` | `content-length`, streamed bytes, blob size or ArrayBuffer above `maxBytes` | This model file is too large to preview here. |
| `PARSE_FAILED` | the loader threw or rejected (corrupt or truncated file), or the parse timed out | The model file appears to be damaged or incomplete and couldn't be opened. |
| `EMPTY_SCENE` | no renderable geometry, or empty or degenerate bounds | The model file opened, but it doesn't contain anything to show. |
| `WEBGL_UNAVAILABLE` | renderer creation failed | 3D preview isn't available in this browser (WebGL is disabled or unsupported). |
| `MISSING_DEPENDENCY` | `three` or a required loader class was not injected | The 3D viewer isn't fully set up on this page. |
| `VIEWER_DISPOSED` | `load()` after `dispose()` | The 3D viewer has been closed. |

`detail` is for developers and logs, for example `"Invalid typed array length: 2048"`. It is never rendered.

### `getState()` when ready (example: the chair fixture)

```json
{ "status": "ready", "loadId": 3, "phase": null,
  "progress": { "loaded": 5628, "total": 5628, "ratio": 1 }, "error": null,
  "asset": { "source": "url", "format": "glb", "mime": "model/gltf-binary", "filename": "chair-textured.glb", "byteLength": 5628 },
  "model": { "meshCount": 6, "triangleCount": 72, "materialCount": 1, "textureCount": 1,
             "colorTextures": 1, "colorTexturesSRGB": 1, "animations": 0, "warnings": [],
             "proportions": { "w": 0.46, "h": 1, "d": 0.46, "normalizedTo": "largest-extent", "ratioLabel": "W:H:D 0.46 : 1.00 : 0.46" },
             "scale": { "kind": "inferred-relative", "units": null, "label": "Relative scale, not measured",
                        "note": "Generated model — dimensions not measured", "declaredScaleIgnored": false } },
  "capabilities": { "threeRevision": 166, "colorManagement": "colorSpace", "controls": true, "environment": "room-pmrem", "formats": ["glb", "gltf"] } }
```

`model.warnings` contains `"TEXTURES_NOT_LOADED"` when the file declares textures
but none arrived. GLTFLoader only `console.error`s an image it cannot decode
and still resolves the model. This happened during development on r128.

---

## 4. Camera, orbit, fit

`computeFit({ center, radius, fovDeg, aspect, direction, margin=1.15 })` is a
pure function. It computes `distance = radius / sin(min(vFov, hFov)/2) × margin`,
so the bounding sphere fits in **both** the vertical and the horizontal field of view
(portrait viewports are handled). It also sets:

- `near = 0.01 r`
- `far = maxDistance + 2 r`
- `minDistance = 1.2 r`: the camera can never enter the bounding sphere. The browser capture showed that 0.9 r let a zoom go into the chair back.
- `maxDistance = max(4 × fit, 10 r)`

OrbitControls get `enableDamping = true` and `dampingFactor = 0.08`. Frames
are rendered on demand. Damping keeps requesting frames until it settles.
`fitToView()` keeps the user's current direction.

## 5. Scale honesty (rule)

- The viewer outputs **only** bounding-box proportions, normalised so the largest
  extent is 1, together with
  `scale: { kind: "inferred-relative", units: null, note: "Generated model — dimensions not measured" }`.
- The overlay badge reads **"Relative scale, not measured · W:H:D a : b : c"**.
  The viewer shows no dimension labels, no mm/cm/m/in values and no "real size".
- `asset.scale` metadata is **accepted but ignored**. State reports
  `declaredScaleIgnored: true`, and the values are never copied into state. This stays
  in place until a provider contract supplies **verified** units together with
  their source. At that point, add a labelled `kind: "provider-declared"` path
  that names the source and do not call it "measured". The tests in
  `tests/assetViewer/scale.test.js` assert that no unit tokens appear anywhere in the state JSON
  or the overlay text, even when the caller passes `{ units: "mm", width: 460 … }`.

## 6. Format adapter interface

```js
{
  id: "glb", label: "glTF 2.0 binary (GLB)",
  mime: "model/gltf-binary", mimes: ["model/gltf-binary", "model/glb"], extensions: ["glb"],
  requires: ["GLTFLoader"],                       // deps keys that must be injected
  sniff(bytes /* Uint8Array, first 16 KiB */) { /* "glTF" magic */ },
  async load(arrayBuffer, { three, deps, resourcePath }) { return { root /* Object3D|null */, info: {...} }; },
}
```

- Built in: `glb` (`model/gltf-binary`) and `gltf` (`model/gltf+json`). Both
  use the injected `GLTFLoader.parse`.
- The viewer **always fetches the bytes itself**, which gives progress, the size limit,
  abort and an honest `download()`. Adapters therefore only receive bytes.
- To add a format once it is agreed (OBJ, FBX, USDZ…):
  `mountAssetViewer(el, { adapters: [...DEFAULT_ADAPTERS, objAdapter], deps: { ...deps, OBJLoader } })`.
  The viewer itself does not change. `tests/assetViewer/registry.test.js` shows a fake OBJ adapter doing this.
- USDZ deserves care: three's `USDZLoader` is incomplete, and USDZ is mainly an AR Quick Look delivery format.

## 7. Download

`download()` returns
`{ format, mime, filename, byteLength, bytes /* copy */, url /* original, may expire */, blob }`.
These are the **original bytes**. Nothing is re-exported or converted.

- `mime` and the extension follow the *detected* content: GLB gives
  `model/gltf-binary` and `.glb`, JSON glTF gives `model/gltf+json` and `.gltf`.
- The filename comes from `asset.filename`, then `blob.name`, then the last path
  segment of the URL (with the query and signature stripped), then `generated-model.<ext>`.
- `download({ save: true })` also triggers a browser save through a temporary
  `<a download>` object URL, which is revoked straight away.
- A JSON `.gltf` with *external* `.bin` or texture files downloads only the JSON. GLB
  avoids this, which is one more reason to prefer it.

## 8. Disposal guarantees

`replace` (the next successful load), `clear()`, an error, a superseded late result,
and `dispose()` all release resources through `disposeObject3D`:

- every geometry
- every material, including multi-material arrays
- **every texture-valued property of every material**, plus `ShaderMaterial` uniforms and texture arrays
- skeletons
- decoded `ImageBitmap`s (`close()`)

Each resource is disposed exactly once.

`dispose()` additionally:

- cancels the pending rAF
- disconnects the `ResizeObserver`, or removes the window `resize` listener
- removes the controls listener and disposes the controls
- disposes the lights and the PMREM render target
- calls `renderer.dispose()` and `renderer.forceContextLoss()`
- removes the canvas and its own DOM root, but never the host element
- clears all listeners

The PMREM generator and the RoomEnvironment scene are released right after baking.

How this is proven:

- **Unit tests** (`tests/assetViewer/dispose.test.js`) use a fake renderer
  that keeps `info.memory` the way WebGLRenderer does: a resource is counted when it is
  first rendered, and un-counted only by its own `dispose` event. Counts return
  to zero after `clear()` and `dispose()`, and to the new model's count after a replace.
- **Real browser** (`evidence/capture-results.json`, r166): `info.memory` is
  `{1,2}` while ready and `{0,0}` after `dispose()`. The context is lost and the canvas detached.
- **r128 caveat:** r128's own `PMREMGenerator` leaves one geometry counted even
  for an empty scene after `pmrem.dispose()`. This is upstream r128 behaviour, and 0.166
  does not do it. The viewer forces context loss on dispose, so the GPU
  objects are freed with the context. `environment: "none"` avoids it entirely.

## 9. r128 / static Studio: three must be injected

- `src/lib/assetViewer/**` **never imports `three`** (or React). This is enforced
  by `tests/assetViewer/noBundledThree.test.js`, which scans the sources and
  builds an esbuild IIFE of `entry.js`. That bundle contains only `src/lib/assetViewer/*` inputs
  and no WebGLRenderer, and it evaluates with no THREE global present.
- Colour management is **feature-detected**:
  - `texture.colorSpace` / `renderer.outputColorSpace` on r152+
  - `texture.encoding = THREE.sRGBEncoding` / `renderer.outputEncoding` on r128
  - Only colour slots (`map`, `emissiveMap`, `sheenColorMap`, `specularColorMap`) become sRGB. Data maps stay linear.
  - Light intensities are scaled ×π on r155+, where legacy light units were removed.
- **The static page has no r128 GLTFLoader or OrbitControls.** The demo's
  `?three=r128` mode used three-stdlib 2.36.1 rewired to `window.THREE` and
  needed **two shims**:
  - `LoaderUtils.resolveURL`, which only exists from r130
  - `Texture.userData`, which r128 lacks. three-stdlib writes `texture.userData.mimeType`.

  Without these shims, embedded textures silently failed to load. With them, r128 renders
  the same pixels as r166 (avg RGB [221,172,115] vs [220,170,112]).
  **Recommendation:** Antigravity or Integration supply loaders built *for* r128, i.e.
  `three@0.128.0/examples/js/loaders/GLTFLoader.js` and
  `examples/js/controls/OrbitControls.js`, which attach to `window.THREE`. Those are not
  available offline here, so they could not be verified. The other options are to
  bundle the demo's shimmed three-stdlib build or to upgrade the page's three.
  Adding vendor files to the page needs approval.

### Bundling (not applied: `scripts/build-static.mjs` is Integration-owned)

```js
await build({
  entryPoints: [resolve(root, "src/lib/assetViewer/entry.js")],
  bundle: true, format: "iife", globalName: "FurniAssetViewer",
  outfile: resolve(root, "asset-viewer.js"),
});
// and add "asset-viewer.js" to the copied files list
```

## 10. How the Studio would mount it (example only: no Studio file edited)

```html
<!-- index.html already has: <script src="/vendor-three-r128.min.js"></script> -->
<!-- r128-compatible loaders supplied by Antigravity/Integration (OPEN QUESTION): -->
<script src="/vendor/three-r128/GLTFLoader.js"></script>     <!-- sets THREE.GLTFLoader -->
<script src="/vendor/three-r128/OrbitControls.js"></script>  <!-- sets THREE.OrbitControls -->
<script src="/asset-viewer.js"></script>                     <!-- window.FurniAssetViewer -->
<div id="generated-model" style="height:420px"></div>
<script>
  // `result` = whatever Claude Code's Scenario route returns, mapped by Integration
  // onto the neutral descriptor (no Scenario field names inside the viewer).
  const viewer = FurniAssetViewer.mountAssetViewer(document.getElementById("generated-model"), {
    three: window.THREE,
    deps: { GLTFLoader: THREE.GLTFLoader, OrbitControls: THREE.OrbitControls },
    asset: { url: result.modelUrl, filename: result.filename },   // placeholder names
    onError: (e) => studioToast(e.message),                        // e.code for analytics
  });
  // replace:  viewer.load({ url: next.modelUrl });
  // download: const d = viewer.download({ save: true });
  // leaving the panel:  viewer.dispose();
</script>
```

React or R3F is not needed. If the Next app ever hosts the viewer, a `useEffect`
that calls `mountAssetViewer(ref.current, { three: THREE, deps })` and returns
`viewer.dispose` is enough. No wrapper ships, by design.

## 11. Tests, demo, evidence

- `npx vitest run --config tests/assetViewer/vitest.config.js` runs **65 tests in 10 files**.
  The suites cover state, errors, supersede, dispose, fit, scale, download, registry, r128 and no-bundled-three.
  They use real three 0.166 scene classes and the real GLTFLoader. Only the GPU (a fake
  renderer with faithful `info.memory`) and the pointer-driven OrbitControls are faked.
  Node has no `createImageBitmap`, so a small shim stands in for PNG decoding. Real pixels are checked in the browser.
- The root `npx vitest run` collects them through
  `src/lib/assetViewer/assetViewer.collect.test.js`. **Delete that file** if
  `tests/assetViewer/**` is ever added to the root include list.
- Fixtures: `node tests/assetViewer/fixtures/generate-fixtures.mjs` writes
  `chair-textured.glb` (6 boxes, embedded 64×64 PNG), `table-untextured.glb`,
  `corrupt.glb` and `empty-scene.gltf`. They are procedural: no downloads, no exporter.
- Demo: `node docs/m3/asset-viewer/demo/serve.mjs`, then open
  `http://127.0.0.1:4318/docs/m3/asset-viewer/demo/?three=r166` (or `?three=r128`).
- Evidence: `node docs/m3/asset-viewer/demo/capture.mjs` writes the files in `docs/m3/asset-viewer/evidence/`. See its README.

---

## OPEN QUESTIONS for Integration

1. **Scenario output format(s).** Is it GLB only? Will we also get FBX, OBJ or USDZ? Is
   there more than one per job? Are meshes Draco- or meshopt-compressed? If so,
   `DRACOLoader` / `MeshoptDecoder` must also be injected, and the decoder WASM must be hosted locally.
   Do textures use KTX2 or Basis?
2. **Result shape.** Is the model a URL (public or signed) or bytes or a blob through
   our backend? Are textures embedded, or separate files that need a `resourcePath` or a URL map?
   Is there a thumbnail or preview image? What metadata comes with it (job id,
   prompt, seed, poly count)? The viewer currently takes `{ url | arrayBuffer | blob, format?, mime?, filename? }`.
   Who maps the provider result onto it: Claude Code's route or Antigravity's Studio?
3. **Mount style.** The static `index.html` would use a vanilla mount through
   `window.FurniAssetViewer`, as proposed here. Is an R3F component for the Next app wanted
   at all? There is none by design.
4. **r128 loaders.** Who supplies the r128-compatible `GLTFLoader` and
   `OrbitControls` for the static page? The options are
   `three@0.128.0/examples/js` (recommended), a shimmed three-stdlib build (what the demo does), or upgrading
   the page's three. Can a vendor file be added to the page and to `build-static.mjs`?
5. **Downloads.** Which formats may customers download: the original GLB only,
   or also provider-converted formats? Should download be offered at all for
   generated (non-manufacturable) models? Is a filename convention needed, for example one that includes the design or job id?
6. **Scale metadata.** Does Scenario or our pipeline provide any *verified*
   metric scale? If so, what is its source, its units and how was it verified? Until then the
   viewer shows only "Relative scale, not measured" with W:H:D ratios.
7. **CORS and signed URLs.** Will the model host send `Access-Control-Allow-Origin`
   for the Studio origin? What is the URL expiry? A 403 currently surfaces as `FETCH_FAILED`
   with `status: 403`. Should the viewer ask the host to refresh the URL and retry
   once? Should credentials be `omit` (the current default) or `include`?
8. **Max file size and timeouts.** `maxBytes` is a placeholder of 100 MiB and the parse timeout
   is 120 s. What are the real limits, and are they the same on mobile?
9. **Orientation and units.** Is the generated model Y-up glTF, centred, and
   facing +Z? The viewer frames whatever bounds it gets, but a consistent "front"
   view would need that convention or provider metadata.
10. **Analytics and logging.** Should `error.code` and `detail` go to a logging endpoint?
    Is it acceptable to keep `console.error` from loaders?

## Known limitations

- Animations are counted but not played.
- Only glTF is implemented.
- No KTX2, Draco or meshopt support (would be added by injection once confirmed).
- The built-in overlay is minimal. A host can pass `ui:false` and render its own from events.
- r128 residual PMREM geometry (§8).
