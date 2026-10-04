# Generated-model asset viewer (M3): module contract

**Status:** isolated module, local commits only. Round 1 sits on top of `a29f47b`
(`integ/pilot-oct18-candidate`) and was merged by Integration as `ed2178c`. Round 2
(this revision) builds on `f8dd8be` and implements the viewer against the
**PROPOSED** `/api/creative` contract (`docs/creative/SCENARIO_3D_API_CONTRACT.md` in
the Claude backend bundle, §12 below).

**The viewer is NOT attached to any page.** Mounting waits for Antigravity to
confirm the runtime. Their redesign tip `8744d07` is not available here, so mount point and
runtime compatibility are unverified.

All files are new or are this module's own: `src/lib/assetViewer/**`,
`tests/assetViewer/**`, `docs/m3/asset-viewer/**`. No other file was changed:
not `index.html`, Studio code, the parametric builder, `api/**`, `package.json` or
`vitest.config.js`. No backend code was merged or cherry-picked. The viewer
consumes the HTTP contract only.

**Owners:**

- This module: Grok Asset Engineer.
- Scenario backend (`api/creative.js`, `src/lib/creative/*`): Claude Code.
- Studio shell and site UI: Antigravity, who will mount this module.
- Agreement of the contract: open item U8, Antigravity + Grok + CraZy.

**Working assumptions:**

- **Settled by the contract:** only `glb`/`gltf` are displayed. Every other format is
  download-only. Concepts have no verified scale.
- **Still provisional:** whether the provider's CDN allows a cross-origin fetch at all (U7).
- The local `{ url | arrayBuffer | blob }` descriptor path is unchanged. It is used for fixtures and for any future FurniAI-hosted copy.

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

**Scenario backend code received locally (Claude bundle, tip `7f42f95` on `15a571f`), awaiting integration.**
It is a different lineage from `a29f47b`; the merge-base is `3ed620c`. The bundle was read
read-only from `/workspace/scenario-review/review.git`
(`refs/review/claude-scenario-3d/feat/scenario-3d-generation`):

- `api/creative.js`
- `src/lib/creative/{creativeService,errors,http,scenarioClient,memoryStore}.js`
- `docs/creative/SCENARIO_3D_API_CONTRACT.md`

None of it is in this branch. The integration branch `a29f47b` itself still has no
Scenario code: a `grep -ri scenario` there only hits the ordinary word
(`golden-scenarios.json`, `demoScenarios.js`…). Background material that was
used before the contract existed:

- `docs/knowledge-base/image-to-custom-design-landscape.md`: image-to-3D tools
  (Tripo, Meshy, Hunyuan3D) output "USD/FBX/OBJ/STL/GLB/3MF". The file notes that
  this is "raw geometry with no construction semantics" and treats it as a deferred tier.
- `docs/research/07-furniture-cad-cam-execution-blueprint.md`: "glTF is the
  preferred web-preview asset"; "glTF/GLB = portable visual model".
- `docs/audit/BASELINE.md` and `PHASE1_PLAN.md`: proposed `.gitattributes` with
  `*.glb binary` / `*.gltf binary`. These were never committed, and the repo has no `.gitattributes`.

Round 1 treated every format and shape choice as an assumption. Round 2 replaces
those assumptions with the contract wherever the contract answers them (§12, and
[OPEN QUESTIONS](#open-questions-for-integration)).

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

// /api/creative (AI visual concept, §12):
const creativeSource = createCreativeAssetSource({ fetchImpl: fetch, getAuthToken: () => session.access_token });
const v = mountAssetViewer(el, { three, deps, creativeSource });
await v.load({ jobId, index: 0, format: "glb" });   // resolve -> glb/gltf: load | other: download-only
await v.load({ job });                              // a job object from GET ?resource=jobs&jobId=
await v.watchJob(jobId);                            // polls every 3-5 s until terminal, then shows it
await v.download({ save: true });                   // re-resolves a FRESH url first
```

The **contract** is `load`, `dispose` and `onError`. These extras are also available:

| method | returns / does |
|---|---|
| `clear()` | drops the current model and any in-flight load, then goes back to `idle` |
| `fitToView()` | re-frames the model and keeps the current orbit direction. Returns the fit numbers, or `null` when no model is loaded |
| `getState()` | JSON-safe snapshot (§4) |
| `on(event, cb)` | `statechange`, `progress`, `ready`, `error`, `dispose`. Returns an unsubscribe function. Unknown event names throw |
| `download({ save? })` | local item: original bytes plus filename and mime, synchronously (§7). Concept: a **Promise**. It re-resolves a fresh url and returns `{ ok, url, filename, … }`. Returns `null` when nothing can be downloaded |
| `showJob(job, { index? })` | renders a job object (§12.4). Same as `load({ job, index })` |
| `watchJob(jobId, { index?, intervalMs=4000 })` | polls `getJob`. The interval is clamped to 3–5 s. Polling is superseded by any later load, clear or dispose |

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
| `creativeSource` | none | `createCreativeAssetSource(...)` (§12). Required for `{ jobId }` references and jobs. Without it you get `MISSING_DEPENDENCY` |
| `setTimeout` / `clearTimeout` | globals | polling timers, injectable for tests |
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

concept: loading{job-checking | job-submitting | job-processing}      (no %)
         ─▶ loading{resolving ─▶ fetching ─▶ parsing [─▶ retrying ─▶ fetching ─▶ parsing]}
         ─▶ ready | download-only | error
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

The concept codes (§12.3) are `SIGN_IN_REQUIRED`, `SIGN_IN_UNAVAILABLE`,
`CONCEPTS_NOT_CONFIGURED`, `SERVICE_UNAVAILABLE`, `PROVIDER_UNAVAILABLE`,
`CONCEPT_NOT_FOUND`, `ASSET_NOT_READY`, `ASSET_UNAVAILABLE`,
`RECORD_INTEGRITY_FAILED`, `RESOLVE_FAILED`, `ASSET_DISPLAY_FAILED`,
`GENERATION_FAILED`, `SUBMISSION_UNKNOWN` and `JOB_STATUS_UNKNOWN`.

An error record can carry these extra fields: `status`, `serverCode` (the backend's `code`),
`jobStatus`, `downloadAvailable`, `chargeMayHaveOccurred`, `autoRetry:false` and `attempts`.

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
- **Concepts:** the contract says `concept.dimensionsVerified:false` and that no
  metric scale exists. The viewer stays relative even if a response ever claims
  `dimensionsVerified:true`. It reports the flag in `state.concept` and does not act on it
  (`creativeViewer.test.js`).

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

- **Concepts** never keep bytes or the url. `download()` calls `?resource=asset`
  again and gets a fresh address. With `save:true` it clicks a temporary
  `<a href download target=_blank rel="noopener noreferrer">`. A navigation is not
  subject to CORS, so this can work even when display failed (U7).
  Cross-origin addresses ignore the `download` filename, so the provider may choose
  the name. The filename the viewer proposes is `furniai-concept-<jobId>-<index>.<format|bin>`.

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
  // NOT APPLIED. Mount point/runtime await Antigravity (redesign tip 8744d07 not seen here).
  const source = FurniAssetViewer.createCreativeAssetSource({
    fetchImpl: window.fetch.bind(window),
    getAuthToken: async () => (await supabase.auth.getSession()).data.session?.access_token, // asked on EVERY call
  });
  const viewer = FurniAssetViewer.mountAssetViewer(document.getElementById("generated-model"), {
    three: window.THREE,
    deps: { GLTFLoader: THREE.GLTFLoader, OrbitControls: THREE.OrbitControls },
    creativeSource: source,
    onError: (e) => studioToast(e.message),                        // e.code / e.serverCode for analytics
  });
  viewer.watchJob(jobIdFromPostJobs);       // or viewer.load({ jobId, index: 0, format })
  // download button (host-owned): await viewer.download({ save: true });   // fresh url each time
  // NEVER: open in builder, show dimensions, export/production (state.actions says false)
  // leaving the panel:  viewer.dispose();
</script>
```

React or R3F is not needed. If the Next app ever hosts the viewer, a `useEffect`
that calls `mountAssetViewer(ref.current, { three: THREE, deps })` and returns
`viewer.dispose` is enough. No wrapper ships, by design.

## 11. Tests, demo, evidence

- `npx vitest run --config tests/assetViewer/vitest.config.js` runs **152 tests in 13 files**.
  Round 1 has 65 tests in 10 files: state, errors, supersede, dispose, fit, scale, download, registry, r128 and no-bundled-three.
  Round 2 adds `creativeSource`, `creativeViewer` and `creativeJob`, which run against the SIMULATED stand-in (§12.6).
  They use real three 0.166 scene classes and the real GLTFLoader. Only the GPU (a fake
  renderer with faithful `info.memory`) and the pointer-driven OrbitControls are faked.
  Node has no `createImageBitmap`, so a small shim stands in for PNG decoding. Real pixels are checked in the browser.
- The root `npx vitest run` collects them through
  `src/lib/assetViewer/assetViewer.collect.test.js`. **Delete that file** if
  `tests/assetViewer/**` is ever added to the root include list.
- Fixtures: `node tests/assetViewer/fixtures/generate-fixtures.mjs` writes
  `chair-textured.glb` (6 boxes, embedded 64×64 PNG), `table-untextured.glb`,
  `corrupt.glb`, `empty-scene.gltf` and `simulated-download-only.fbx`. The last one is a labelled
  text placeholder, *not* an FBX. All of them are procedural: no downloads, no exporter.
- Demo: `node docs/m3/asset-viewer/demo/serve.mjs`, then open
  `http://127.0.0.1:4318/docs/m3/asset-viewer/demo/?three=r166` (or `?three=r128`).
- Evidence: `node docs/m3/asset-viewer/demo/capture.mjs` writes the files in `docs/m3/asset-viewer/evidence/`. See its README.
- SIMULATED concept demo: the same server, then open
  `http://127.0.0.1:4318/docs/m3/asset-viewer/demo/creative.html`. It uses fixtures only and is not Scenario.
  `node docs/m3/asset-viewer/demo/capture-creative.mjs` writes `evidence/creative/`.

---

## 12. `/api/creative` contract mapping (PROPOSED contract, backend bundle `7f42f95`)

Implemented in `src/lib/assetViewer/creativeAsset.js`, which imports no backend code.
The field names and error codes were checked against `api/creative.js` and
`src/lib/creative/*` at `7f42f95`.

### 12.1 Requests

| call | request | notes |
|---|---|---|
| `source.resolve(jobId, index=0)` | `GET {baseUrl}?resource=asset&jobId=<id>&index=<n>` | `Authorization: Bearer <getAuthToken()>`. The token is asked for on **every** call. `cache:"no-store"`, `credentials:"same-origin"`. With no token, nothing is sent and the result is `SIGN_IN_REQUIRED` |
| `source.getJob(jobId)` | `GET {baseUrl}?resource=jobs&jobId=<id>` | same auth. Returns `{ job, refresh }` |
| mesh bytes | `GET asset.url` | the viewer's `fetch`, `credentials:"omit"` |

`baseUrl` defaults to `/api/creative`. Nothing is cached, memoised or stored. The
viewer source contains no `localStorage`, `sessionStorage`, `indexedDB` or `caches`,
and a test enforces that.

### 12.2 `asset` response → descriptor

| backend `asset.*` | descriptor | notes |
|---|---|---|
| `url` (`https://…`) | `url` | must be http(s). It is used once and dropped right away. It is **never** in `getState()`, events, `current`, error detail (redacted to `[url]`) or storage |
| `format` (`glb gltf fbx obj usdz stl ply zip` or `null`) | `format` | lower-cased. Unknown values become `null`. **The resolve-time format is authoritative.** The backend computes `detectFormat(asset) ?? out.format`, so it can differ from `job.outputs[i].format` |
| `mimeType` (may be `null`) | `mimeType` | |
| | `filename` | `furniai-concept-<jobId>-<index>.<format \| bin>`, never taken from the provider address |
| `concept` | `concept` | normalised: the notice is kept (trimmed, at most 600 chars) and the flags are booleans (default `false`). Without a notice, a strict default is used and `noticeSource:"viewer-default"` |
| `resolvedAt`, `expiresAt:null`, `expiryKnown:false`, `durableCopy:false` | same | informational only |
| `jobId` / `index` | checked | a mismatch gives `RESOLVE_FAILED` |

### 12.3 Error mapping (switch on `code`; HTTP status only when `code` is absent)

| backend `code` (HTTP) | viewer `code` | customer message (abridged) |
|---|---|---|
| `MISSING_AUTH` (401), `UNAUTHORIZED` (403) | `SIGN_IN_REQUIRED` | Please sign in to view this 3D concept. |
| `AUTH_UNAVAILABLE` (503) | `SIGN_IN_UNAVAILABLE` | Sign-in is temporarily unavailable… |
| `PERSISTENCE_NOT_CONFIGURED`, `CREATIVE_NOT_CONFIGURED`, `CREATIVE_STORE_NOT_CONFIGURED`, `CREATIVE_GENERATION_DISABLED` (503) | `CONCEPTS_NOT_CONFIGURED` | 3D concepts aren't available on this site yet. |
| `STORAGE_UNAVAILABLE` (503); a 5xx without a code | `SERVICE_UNAVAILABLE` | temporarily unavailable |
| `PROVIDER_*` (502/429/402) | `PROVIDER_UNAVAILABLE` | The 3D generation service couldn't be reached… |
| `MISSING_JOB` (404) | `CONCEPT_NOT_FOUND` | couldn't be found… |
| `ASSET_NOT_READY` (409) | `ASSET_NOT_READY` | isn't ready yet. `jobStatus` kept |
| `ASSET_UNAVAILABLE` (410) | `ASSET_UNAVAILABLE` | no longer available… no copy was kept |
| `RECORD_INTEGRITY_FAILED` (409) | `RECORD_INTEGRITY_FAILED` | failed a safety check |
| `BAD_REQUEST` (400) | `INVALID_ASSET` | |
| `INTERNAL` (500), unknown codes, network errors, malformed `ok:true` bodies | `RESOLVE_FAILED` | couldn't be opened. Please try again. |

The backend's message text is never used: the auth messages mention "design", and
409 is shared by two codes. Viewer messages never contain the code or any technical words
(tested).

### 12.4 Flows

- **Reference** `load({ jobId, index, format? })`:
  1. If `format` is given and is not `glb`/`gltf` (including `null`), the state goes straight to
     **`download-only`**, with no resolve and no mesh request.
  2. Otherwise, resolve. A non-viewable resolved format → `download-only`.
  3. Otherwise fetch and parse the mesh.
  4. If that fails with `FETCH_FAILED`, `PARSE_FAILED` or `UNSUPPORTED_FORMAT` (an expired address,
     CORS, a truncated body), **re-resolve once and retry once**. A second failure gives
     `ASSET_DISPLAY_FAILED`: "This 3D concept couldn't be displayed here. Downloading it may still work."
     The error carries `downloadAvailable:true` and `attempts:{resolve:2, display:2}`, and download stays offered.
  5. If the re-resolve itself fails, its mapped error is reported (for example a 410).
  6. `EMPTY_SCENE` and `FILE_TOO_LARGE` are not retried.
- **Job** `load({ job })` / `showJob(job)` / `watchJob(jobId)`:

  | `job.status` | viewer |
  |---|---|
  | `submitting` | `loading:job-submitting`: "Sending your image to the 3D generation service…" |
  | `processing` | `loading:job-processing`: "Generating 3D concept… This can take a few minutes." `watchJob` keeps polling every 3–5 s (default 4 s) |
  | `succeeded` + `outputs.length ≥ 1` | picks `outputs[0]` (or `index`) → reference flow |
  | `succeeded` with no matching output | `ASSET_NOT_READY` |
  | `failed` | `GENERATION_FAILED` with `job.error.message`, sanitised: one line, at most 300 chars, never an address, rendered with textContent. Otherwise a default. `serverCode` is kept |
  | `submission_unknown` | `SUBMISSION_UNKNOWN`: "…It may have been charged. It will not be retried automatically." `chargeMayHaveOccurred:true`, `autoRetry:false`, polling stops |
  | anything else | `JOB_STATUS_UNKNOWN` |

  `providerProgress` and `providerStatus` are never read (a static test enforces this), so
  no percentage exists for job phases. `refresh.ok:false` is ignored, as the contract says.
  `progress` is `null` in job phases. A percentage appears only for the **byte download**
  of the mesh, which is measured locally.
- **Download** always re-resolves (§7).

### 12.5 Concept honesty in state and overlay

- `state.concept` = `{ kind, editable, dimensionsVerified, partsSeparable, manufacturable, notice, noticeSource }`.
- `state.actions` = `{ view, download, openInBuilder:false, export:false, production:false }`.
- `state.job` = `{ jobId, index, status, outputCount }`.
- `state.attempts` = `{ resolve, display }`.
- `state.source` is `"creative"` or `"local"`.
- The overlay shows `concept.notice` in a separate banner (`[data-av-concept]`) in **every** state
  that carries a concept: loading, ready, download-only and error.
- The overlay's Download button (`[data-av-download]`) appears for download-only, and for
  display errors that still allow download.
- The scale badge stays "Relative scale, not measured · W:H:D …".
- No dimensions appear anywhere (tested).

### 12.6 Tests and SIMULATED stand-in

`tests/assetViewer/helpers/creativeStandIn.js` is a **SIMULATED** `/api/creative`. It uses
fixtures only and is not Scenario. It returns the backend's response shapes, its
verbatim `CONCEPT_NOTICE` and its error messages. Its signed addresses are **single use**: a second GET
returns 403, so any url reuse fails the tests. A mutation that cached the url failed 6 tests.

The 87 new tests cover:

- a fresh resolve and Bearer token on every load and every download (call counts, distinct urls)
- no url in state, events, errors or storage
- one re-resolve and retry, then `ASSET_DISPLAY_FAILED`
- the no-CORS case, simulated
- every code mapping, including 409 vs 409
- download-only for `fbx obj usdz stl ply zip null` and unknown formats
- notice always present, with the default when it is missing
- no dimensions or mm
- every job status, including `submission_unknown` with no further calls
- no `%` from `providerProgress`
- poll cadence clamped to 3–5 s
- supersession of polling
- the legacy descriptor path

### 12.7 Contract doc vs backend code: mismatches and ambiguities found

1. **§2.5 lists only `409 ASSET_NOT_READY`, `410 ASSET_UNAVAILABLE` and
   `409 RECORD_INTEGRITY_FAILED`.** The asset route can also answer:
   - `404 MISSING_JOB` (unknown job or another user's)
   - `400 BAD_REQUEST` (missing jobId; index not a non-negative integer)
   - `503 CREATIVE_NOT_CONFIGURED` (`requireCredentials()` runs before the provider call)
   - pass-through provider errors (`PROVIDER_*` 502/429/402)
   - the auth/persistence 401/503s
   - `500 INTERNAL`

   The viewer maps all of them.
2. **`ASSET_NOT_READY` is overloaded.** It means both "not succeeded" and "index out of range"
   (`job.outputs?.[index]` missing). Both carry `details.jobStatus`, so a client can
   only tell them apart by `jobStatus === "succeeded"`.
3. **Two codes share HTTP 409**, so clients must switch on `code`. The viewer does.
4. **The format can change between the job and the asset.** `outputs[i].format` is computed
   at completion, and the asset route returns `detectFormat(asset) ?? out.format` from a fresh
   provider lookup. The doc does not say which wins. The viewer trusts the resolve-time value.
5. **`detectFormat` on the asset route sees only `{ url, mimeType }`** from the
   provider client. A signed address without a file extension and a generic
   mime therefore falls back to the stored `out.format`, or `null` (download-only).
6. **Index validation:** the doc shows `index=0` but does not say that it defaults to 0 or that
   invalid values give 400.
7. **The auth message text mentions "design"** for a creative concept. The doc acknowledges
   this, and the viewer ignores the text.
8. **A failed job's `error.message`** for `PROVIDER_GENERATION_FAILED` is the provider's
   own text (up to 300 chars), not FurniAI copy. The doc says "show the message". The viewer
   sanitises it but cannot vouch for its wording (open question 10).
9. The `errors.js` comment on `RECORD_INTEGRITY_FAILED` ("…Never used.") means that *the
   record* is never used. It does not mean the code is unused. The code is thrown by `assertIntact` on
   the asset and job routes.
10. **`submitting` older than 120 s becomes `submission_unknown`** with
    `error.code PROVIDER_UNAVAILABLE`. A client that switched on `error.code` would
    misread this as a transient provider outage. The viewer switches on `status`.

---

## OPEN QUESTIONS for Integration

### Answered by the PROPOSED contract (round 2)

| # (round 1) | answer now implemented |
|---|---|
| 1 Formats | the backend reports `glb gltf fbx obj usdz stl ply zip` or `null`. **Only `glb`/`gltf` are displayed. Everything else is download-only** (§12.4). It can return several outputs per job (`outputs[]`, picked by `index`). Draco/meshopt/KTX2 remain unknown (U2): no model or output format is verified yet |
| 2 Result shape | `GET ?resource=asset` → `{ url, format, mimeType, resolvedAt, expiresAt:null, expiryKnown:false, durableCopy:false, concept }`; `GET ?resource=jobs` → the job view (§12.2). The viewer itself maps this; no host mapping is needed. No thumbnail exists in the contract |
| 5 Downloads | the original provider file, via a **fresh** address at click time. The filename is `furniai-concept-<jobId>-<index>.<ext>`. No conversion |
| 6 Scale metadata | none: `concept.dimensionsVerified:false`. Relative ratios only, whatever a response claims |
| 7 (part) Fresh url / caching / credentials | resolve on every display and download, never cache or persist, re-resolve once on a load failure. The API call is same-origin with `Authorization: Bearer <Supabase access token>`. The CDN fetch uses `credentials:"omit"` |

### Still open

1. **CORS on provider addresses (U7).** It is unverified whether Scenario's CDN sends
   `Access-Control-Allow-Origin`. If it does not, display is impossible from the browser.
   The viewer reports `ASSET_DISPLAY_FAILED` honestly and still offers download. This was
   simulated, not verified. The fix would be a FurniAI copy or proxy, which depends on U6.
   URL expiry is also unverified.
2. **Durable asset storage (U6).** `durableCopy` is always `false`. Once the provider drops an
   asset, users get `ASSET_UNAVAILABLE`. A Supabase Storage copy-on-success would let
   the viewer use a stable FurniAI address. The descriptor path already supports one.
3. **r128 loaders.** Who supplies an r128-compatible `GLTFLoader`/`OrbitControls` for the
   static page (§9)? This is unchanged from round 1.
4. **Mount point and runtime compatibility with Antigravity's redesign (tip `8744d07`, not
   available here).** Which page or panel hosts the viewer? Is the runtime still static
   `index.html` with `window.THREE` r128? Who owns the Supabase session getter? **The
   viewer stays unattached until Antigravity confirms.**
5. **Size and time limits.** `maxBytes` is a 100 MiB placeholder and the parse timeout is 120 s.
   The contract sets no limit for generated assets, and none is set for mobile.
6. **Orientation.** The contract does not specify Y-up, centring or a front direction.
   The viewer frames any bounds.
7. **Contract agreement (U8).** The status is PROPOSED. The mismatches in §12.7 should be folded
   into the doc, especially the extra asset-route error codes and which format wins.
8. **Polling ownership.** `watchJob` polls `GET ?resource=jobs` itself, every 3–5 s. Should
   the Studio poll instead and hand job objects to `showJob`? Both work. Is there a maximum
   polling duration before telling the user to come back later?
9. **Download UX for cross-origin addresses.** The provider decides the saved file name, and
   whether the browser opens or saves the file. A FurniAI proxy or copy (U6) would fix this.
10. **Provider error text.** `job.error.message` for `PROVIDER_GENERATION_FAILED` is
    verbatim provider text. Should the backend replace it with FurniAI copy?
11. **Analytics and logging** (round 1 question 10): should `code`, `serverCode` and `detail` (urls
    redacted) be logged?

## Known limitations

- Animations are counted but not played.
- Only glTF is displayed. Concept formats other than glb/gltf are download-only by contract.
- No KTX2, Draco or meshopt support (would be added by injection once confirmed).
- The built-in overlay is minimal. A host can pass `ui:false` and render its own from events.
- r128 residual PMREM geometry (§8).
