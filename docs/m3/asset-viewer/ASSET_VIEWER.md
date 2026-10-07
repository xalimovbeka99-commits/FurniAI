# Generated-model asset viewer (M3): module contract

**Status:** isolated module, local commits only. Round 1 sits on top of `a29f47b`
(`integ/pilot-oct18-candidate`) and was merged by Integration as `ed2178c`. Round 2
(this revision) builds on `f8dd8be` and implements the viewer against the
**PROPOSED** `/api/creative` contract (`docs/creative/SCENARIO_3D_API_CONTRACT.md` in
the Claude backend bundle, §12 below).

**v2.1 hardening (V1–V6)** sits on top of `f971fae` and changes retry, error codes,
the notice fallback, `download(ref)` and `renderConceptNotice`. See the
[changelog](#changelog) at the end. All evidence is still **SIMULATED** (fixtures and a
local stand-in). No Scenario request of any kind has been made.

**v3 (this revision)** builds on `f472aef` (Claude contract **rev 2** merged by
Integration). It adds the interim host interface `FurniAssetViewer.mount(containerEl,
{ THREE, ...opts })` ([§13](#13-mounting-in-a-host-page)), the v3 states (invalid / unavailable /
WebGL failure with honest sub-messages), textures with an honest note when one can't be
loaded, view controls (orbit, zoom, fit, reset, keyboard, touch), navigation-safe disposal,
**`autoRetry` (default `false`: retries happen only when the user starts them)**, and the rev 2
fields (`billingOutcome`, `PRIOR_SUBMISSION_UNKNOWN`, one active job per reference). See
[§14–§19](#14-v3-states-textures-view-controls) and the [v3 changelog](#v3). Every evidence item is
labelled **SYNTHETIC/MOCKED** or **SIMULATED**; nothing is **LIVE** and no provider was called.

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
await v.download({ save: true });                   // current item: re-resolves a FRESH url first
await v.download({ jobId, index: 1, save: true });  // any item (e.g. another gallery tile), state untouched
```

The **contract** is `load`, `dispose` and `onError`. These extras are also available:

| method | returns / does |
|---|---|
| `clear()` | drops the current model and any in-flight load, then goes back to `idle` |
| `fitToView()` | re-frames the model and keeps the current orbit direction. Returns the fit numbers, or `null` when no model is loaded |
| `getState()` | JSON-safe snapshot (§4) |
| `on(event, cb)` | `statechange`, `progress`, `ready`, `error`, `dispose`. Returns an unsubscribe function. Unknown event names throw |
| `download({ save? })` | local item: original bytes plus filename and mime, synchronously (§7). Concept: a **Promise**. It re-resolves a fresh url (and once more on a retryable failure, §12.4) and returns `{ ok, url, filename, …, attempts }`. Returns `null` when nothing can be downloaded or the viewer is disposed |
| `download({ jobId, index = 0, save? })` | v2.1: an explicit `/api/creative` reference. Downloads **any** item, not just the one on screen, in any viewer state (idle, ready, error…). Same fresh-resolve and retry rule. It never changes the displayed item or state. Needs `creativeSource`; without one it gives `{ ok:false, error:{ code:"MISSING_DEPENDENCY" } }`. With no `jobId`, the current item is the target, as before |
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
| `renderConceptNotice` | `true` | v2.1. `false` hides **only** the overlay's `concept.notice` banner, for a host that renders the notice itself (so it doesn't show twice). `getState().concept.notice` and every `statechange` still carry the text. **With `false` (or `ui:false`) the host is responsible for always showing `concept.notice`** wherever the concept is shown or offered for download (contract §1 UI rule) |
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
         ─▶ loading{resolving [─▶ retrying (resolve, v2.1)] ─▶ fetching ─▶ parsing
                    [─▶ retrying ─▶ fetching ─▶ parsing]}
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

The concept codes (§12.3) are `SIGN_IN_REQUIRED`, `SIGN_IN_UNAVAILABLE`, `FORBIDDEN` (v2.1),
`CONCEPTS_NOT_CONFIGURED`, `SERVICE_UNAVAILABLE`, `PROVIDER_UNAVAILABLE`,
`CONCEPT_NOT_FOUND`, `ASSET_NOT_READY`, `ASSET_UNAVAILABLE`,
`RECORD_INTEGRITY_FAILED`, `RESOLVE_FAILED`, `RESOLVE_MALFORMED` (v2.1), `ASSET_DISPLAY_FAILED`,
`GENERATION_FAILED`, `SUBMISSION_UNKNOWN` and `JOB_STATUS_UNKNOWN`.

An error record can carry these extra fields: `status`, `serverCode` (the backend's `code`),
`jobStatus`, `downloadAvailable`, `chargeMayHaveOccurred`, `autoRetry:false`, `attempts` and
(v2.1, resolve failures) `details: { cause: "network" | "malformed" | "http", retryable }`.

**Backwards compatibility (v2.1).** No code was removed or renamed. Two cases now get a new,
more specific code. Hosts that switch on these should add the new code next to the old one.
A host with a generic fallback keeps working, because every code has a customer-safe `message`.

| situation | before v2.1 | v2.1 |
|---|---|---|
| HTTP 403 (`UNAUTHORIZED`, `FORBIDDEN`, or no code) | `SIGN_IN_REQUIRED` | `FORBIDDEN` |
| 2xx with a malformed or invalid body | `RESOLVE_FAILED` | `RESOLVE_MALFORMED` |
| network or transport error; unknown server code / `INTERNAL` | `RESOLVE_FAILED` | `RESOLVE_FAILED` (unchanged, now with `details.cause`) |

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
  again and gets a fresh address. On a retryable failure (§12.4) it calls once more,
  again for a **fresh** address; it never falls back to an earlier url. The result carries
  `attempts: { resolve }`. `download({ jobId, index })` (v2.1) does the same for any item and
  leaves the displayed item and state untouched. With `save:true` it clicks a temporary
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
  // download button (host-owned): await viewer.download({ save: true });   // fresh url each time, one retry
  // another tile:                    await viewer.download({ jobId, index, save: true });
  // host shows concept.notice itself? mount with renderConceptNotice:false and ALWAYS render
  //   viewer.getState().concept.notice (or the download result's concept.notice) yourself
  // NEVER: open in builder, show dimensions, export/production (state.actions says false)
  // leaving the panel:  viewer.dispose();
</script>
```

React or R3F is not needed. If the Next app ever hosts the viewer, a `useEffect`
that calls `mountAssetViewer(ref.current, { three: THREE, deps })` and returns
`viewer.dispose` is enough. No wrapper ships, by design.

## 11. Tests, demo, evidence

- `npx vitest run --config tests/assetViewer/vitest.config.js` runs **194 tests in 14 files**
  (v2.1; it was 152 in 13 at `f971fae`). v2.1 adds `creativeRetry.test.js` and extends `creativeSource` and `creativeViewer`.
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
| `concept` | `concept` | normalised. The flags are booleans (default `false`). A non-blank server `notice` is kept **verbatim** (v2.1: not trimmed, collapsed or truncated; it is rendered with textContent only), with `noticeSource:"server"`. Without one, `DEFAULT_CONCEPT_NOTICE` is used with `noticeSource:"viewer-default"`. That fallback is a character-for-character copy of `CONCEPT_NOTICE.notice` in `creativeService.js` at `7f42f95` (tested) |
| `resolvedAt`, `expiresAt:null`, `expiryKnown:false`, `durableCopy:false` | same | informational only |
| `jobId` / `index` | checked | a mismatch gives `RESOLVE_MALFORMED` (v2.1; was `RESOLVE_FAILED`) |

### 12.3 Error mapping (switch on `code`; HTTP status only when `code` is absent)

| backend `code` (HTTP) | viewer `code` | customer message (abridged) |
|---|---|---|
| `MISSING_AUTH` (401); a 401 without a code; no token (no request is sent) | `SIGN_IN_REQUIRED` | Please sign in to view this 3D concept. |
| `UNAUTHORIZED` (403, persistence: signed in but not allowed), `FORBIDDEN`; a 403 without a code | `FORBIDDEN` (v2.1) | This account doesn't have permission to open this 3D concept. Signing in again won't change that. **v3: rev 2 never sends a 403 from `/api/creative` code; treat it as page-wide, see [§16](#16-forbidden-403-when-and-is-it-ever-per-job).** |
| `AUTH_UNAVAILABLE` (503) | `SIGN_IN_UNAVAILABLE` | Sign-in is temporarily unavailable… |
| `PERSISTENCE_NOT_CONFIGURED`, `CREATIVE_NOT_CONFIGURED`, `CREATIVE_STORE_NOT_CONFIGURED`, `CREATIVE_GENERATION_DISABLED` (503) | `CONCEPTS_NOT_CONFIGURED` | 3D concepts aren't available on this site yet. |
| `STORAGE_UNAVAILABLE` (503); a 5xx without a code | `SERVICE_UNAVAILABLE` | temporarily unavailable |
| `PROVIDER_*` (502/429/402) | `PROVIDER_UNAVAILABLE` | The 3D generation service couldn't be reached… |
| `MISSING_JOB` (404) | `CONCEPT_NOT_FOUND` | couldn't be found… |
| `ASSET_NOT_READY` (409) | `ASSET_NOT_READY` | isn't ready yet. `jobStatus` kept |
| `ASSET_UNAVAILABLE` (410) | `ASSET_UNAVAILABLE` | no longer available… no copy was kept |
| `RECORD_INTEGRITY_FAILED` (409) | `RECORD_INTEGRITY_FAILED` | failed a safety check |
| `BAD_REQUEST` (400) | `INVALID_ASSET` | |
| network or transport errors (`details.cause:"network"`) **only** (v3) | `RESOLVE_FAILED` | couldn't be opened. Please try again. |
| v3: `INTERNAL` (500), unknown codes, and any status without a usable code (`details.cause:"http"`, `retryable` true on 5xx) | `RESOLVE_SERVER_ERROR` | The 3D concept service had a problem opening this concept. Please try again later. |
| a 2xx whose body is not usable: not JSON, `ok !== true`, no or non-http(s) `url`, another job or index, a jobs answer without `job` (`details.cause:"malformed"`) | `RESOLVE_MALFORMED` (v2.1) | The 3D concept service sent a reply that couldn't be read… |

Every resolve error from `createCreativeAssetSource` carries
`details: { cause, retryable }`. `cause` is `"network"`, `"malformed"` or `"http"` (any
mapped error answer). `retryable` comes from the exported `isRetryableResolveError(err)`,
the same rule the viewer uses (§12.4). The server's own `details` object is not copied:
only `jobStatus` is kept. A missing token (`SIGN_IN_REQUIRED` before any request) carries no
`details`.

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
  7. **v2.1 (V1):** if the **first resolve** (step 2) fails retryably, the viewer resolves
     **once more** (phase `retrying`) before giving up, then reports that second error with
     `attempts`. This budget is separate from the display retry in step 4, so one load makes at
     most **3 resolves and 2 mesh fetches**. The re-resolve in step 4 is not retried again.
     See the retry policy below.

  **Retry policy (v3: `autoRetry`, default `false`).** Rule from Bekzod via the integration
  lead (2026-10-07): **retries happen only when the user starts them.** With the default the
  viewer makes **no silent retry of any kind**: one resolve, one mesh fetch, then the error state
  with a focusable **Try again** (where a retry can help). A click on Try again re-runs the same
  `load` / `showJob` / `watchJob` with a **fresh resolve**; a click on Download always resolves
  fresh. `autoRetry:true` (mount option, or per call `load(ref, { autoRetry })`,
  `showJob(job, { autoRetry })`, `watchJob(id, { autoRetry })`, `download({ ..., autoRetry })`;
  the gallery's Open goes through `load`) restores the v2.1 single retry.

  | failure | default (`autoRetry:false`), load / open | default, download | `autoRetry:true` (v2.1), load / open and download | Try again offered |
  |---|---|---|---|---|
  | network or transport error (`RESOLVE_FAILED`, `cause:"network"`) | error after **1** resolve | `{ok:false}` after **1** resolve | re-resolve **once** | yes |
  | any 5xx: `PROVIDER_UNAVAILABLE`, `PROVIDER_AUTH_REJECTED`, `PROVIDER_REJECTED_REQUEST`, `PROVIDER_UNEXPECTED_RESPONSE` (502), `AUTH_UNAVAILABLE`, `STORAGE_UNAVAILABLE` (503), `RESOLVE_SERVER_ERROR` (500 / no code) | error after **1** resolve | `{ok:false}` after 1 | re-resolve **once** | yes |
  | 429 `PROVIDER_RATE_LIMITED`, or a 429 without a code | error after **1** resolve, **no pause** | `{ok:false}` after 1 | wait `rateLimitRetryDelayMs` (default **1000 ms**, injectable), then re-resolve **once** | yes |
  | 503 `PERSISTENCE_NOT_CONFIGURED` / `CREATIVE_*_NOT_CONFIGURED` / `CREATIVE_GENERATION_DISABLED` | error | `{ok:false}` | no retry | no |
  | 401 / no token, 403, 404, 409 `ASSET_NOT_READY` / `RECORD_INTEGRITY_FAILED` / `PRIOR_SUBMISSION_UNKNOWN` / `DUPLICATE_ACTIVE_JOB`, 410, 400, 402 | error | `{ok:false}` | no retry | no |
  | malformed 2xx body (`RESOLVE_MALFORMED`) | error | `{ok:false}` | no retry | no |
  | mesh `FETCH_FAILED` / `PARSE_FAILED` / `UNSUPPORTED_FORMAT` after a good resolve (expired address, CORS, cut-off body) | that error after **1** resolve + **1** fetch (`attempts {resolve:1, display:1}`); Download stays offered unless the bytes were malformed | n/a (download does not fetch bytes) | fresh resolve **+** refetch **once**, then `ASSET_DISPLAY_FAILED` | **yes** (a fresh resolve may fix it) |
  | `EMPTY_SCENE`, `FILE_TOO_LARGE` | error | n/a | no retry | no |
  | job `submission_unknown` / 409 `PRIOR_SUBMISSION_UNKNOWN` | never retried, never resubmitted, never sends `acknowledgeUnknownCharge` | n/a | same | no |
  | abort / superseded | no (`superseded:true`) | n/a | no | n/a |

  Tested in `tests/assetViewer/autoRetry.test.js` (default: exactly 1 resolve and 0 retries on
  network / 5xx / 429 / expired display; Try again = fresh resolve; per-call overrides; download).
  Turning the default to `true` fails 12 tests (mutation check). `creativeRetry.test.js`,
  `creativeViewer.test.js` and the rev 2 429 block pin the opt-in `autoRetry:true` behaviour.

  Hosts that call `source.resolve()` themselves, such as the gallery's download button,
  should use `isRetryableResolveError(err)` (exported from `index.js` and the browser entry)
  so they behave the same.
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
- **Download** always re-resolves (§7). It retries only with `autoRetry:true` (same table).
  `download({ jobId, index })` targets any item.

### 12.5 Concept honesty in state and overlay

- `state.concept` = `{ kind, editable, dimensionsVerified, partsSeparable, manufacturable, notice, noticeSource }`.
- `state.actions` = `{ view, download, openInBuilder:false, export:false, production:false }`.
- `state.job` = `{ jobId, index, status, outputCount }`.
- `state.attempts` = `{ resolve, display }`.
- `state.source` is `"creative"` or `"local"`.
- The overlay shows `concept.notice` in a separate banner (`[data-av-concept]`) in **every** state
  that carries a concept: loading, ready, download-only and error. The server's text is shown
  verbatim. The viewer's own text appears only when the server sent none, and that fallback
  equals the server's text (v2.1, V3).
- **`renderConceptNotice: false`** (v2.1, V6) hides that banner, so a host that renders the
  notice itself does not show it twice. The banner node stays in the DOM, empty, hidden and marked
  `data-av-concept-host-rendered`. `getState().concept.notice` is still set in every concept
  state, including errors before any server answer, where it holds the fallback text. **The host
  must then always show it**, as it must with `ui:false`.
- The overlay's Download button (`[data-av-download]`) appears for download-only, and for
  display errors that still allow download.
- The scale badge stays "Relative scale, not measured · W:H:D …".
- No dimensions appear anywhere (tested).

### 12.6 Tests and SIMULATED stand-in

`tests/assetViewer/helpers/creativeStandIn.js` is a **SIMULATED** `/api/creative`. It uses
fixtures only and is not Scenario. It returns the backend's response shapes, its
verbatim `CONCEPT_NOTICE` and its error messages. Its signed addresses are **single use**: a second GET
returns 403, so any url reuse fails the tests. A mutation that cached the url failed 6 tests.
Re-checked in v2.1 (suite of 194):

- adapter `resolve()` memoised per job/index: **13 tests fail**
- viewer `download()` reusing a cached descriptor: **3 fail**
- no load resolve retry (V1 reverted): **13 fail**
- no download retry: **2 fail**
- `renderConceptNotice` ignored: **1 fails**
- 403 mapped back to `SIGN_IN_REQUIRED`: **6 fail**
- malformed bodies reported as `RESOLVE_FAILED`: **2 fail**
- the old "editable parts" fallback text: **1 fails**

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
11. **§2.5 "if a load fails, call it again once" is ambiguous** (v2.1). It doesn't say
    whether a failed *resolve* (5xx, network) counts, or whether the "once" is shared with the
    display retry. The viewer's default is in the §12.4 retry policy: one resolve retry for
    network/5xx/429 only, with a separate budget from the display retry.
12. **The notice text in the contract doc is abridged** (`"AI-generated visual concept. …"`).
    The server's real text in `creativeService.js` says "no separately editable **doors or
    panels**". Until v2.1 the viewer's fallback said "parts", so it drifted. It is now a verbatim copy.
13. **`UNAUTHORIZED` is 403 in `persistence/errors.js`**: signed in but not allowed. The
    contract lists only `401 MISSING_AUTH`. Up to v2.1 the viewer told those users to sign in.
    It now reports `FORBIDDEN`.

---

## 13. Mounting in a host page

Interim host interface decided by the integration lead (2026-10-07), until Antigravity
ships the real container. `mount()` is a thin wrapper over `mountAssetViewer()` exported from
the public entry (`src/lib/assetViewer/entry.js` → IIFE global `window.FurniAssetViewer`, and
`index.js` for module users). The host passes its **global r128 THREE**; the viewer never
imports, bundles or reads a THREE global itself (static test in `noBundledThree.test.js`).

```html
<!-- Container sizing: the viewer fills 100% x 100% of the element you give it.
     Give it a real width AND height (it has a 320px min-height of its own). -->
<div id="concept-viewer" style="width:100%;height:clamp(320px,62vh,620px)"></div>

<script src="/vendor-three-r128.min.js"></script>        <!-- window.THREE, r128 (already on the site) -->
<script src="/path/to/GLTFLoader.js"></script>            <!-- r128 examples/js: sets THREE.GLTFLoader -->
<script src="/path/to/OrbitControls.js"></script>         <!-- r128 examples/js: sets THREE.OrbitControls -->
<script src="/path/to/asset-viewer.js"></script>          <!-- IIFE of entry.js: window.FurniAssetViewer (no three inside) -->
<!-- optional, only for /api/creative (Scenario) concepts: -->
<script src="/path/to/asset-viewer-creative.js"></script> <!-- IIFE of entry.creative.js: window.FurniAssetViewerCreative -->
<script>
  const el = document.getElementById("concept-viewer");
  const handle = FurniAssetViewer.mount(el, {
    THREE: window.THREE,                       // required; mapped to the core's `three`
    asset: { url: "/models/chair.glb" },       // a plain URL works: no Scenario needed
    // creativeSource: FurniAssetViewerCreative.createCreativeAssetSource({ getAuthToken }),
    // autoRetry: false,                       // default: retries only when the user clicks Try again
    onError: (err) => console.info("viewer", err.code),
  });
  // Later: handle.load({ url }) replaces the model (old GPU resources are disposed first).

  // Navigation / unmount: the host calls dispose(). It is idempotent.
  function leave() { handle.dispose(); }
  // SPA example: router.beforeEach(leave); or in a component's unmount hook.
  // Safety nets (stay on even when you call dispose yourself):
  //   - window "pagehide" disposes (opt out: disposeOnPageHide:false)
  //   - pass { signal } (an AbortSignal) and abort it to dispose
  //   - if the host removes the element without dispose(), rendering stops (no frames are drawn)
</script>
```

| rule | detail |
|---|---|
| `THREE` | **required**, a three.js namespace (`THREE.Scene` must be a function). Missing or wrong → `TypeError` with `code:"MISSING_DEPENDENCY"`, thrown synchronously, nothing mounted: "FurniAssetViewer.mount(containerEl, { THREE }): THREE is missing or is not a three.js namespace. Pass the page's global three.js (window.THREE, r128); the viewer never imports or bundles three." |
| loaders | `GLTFLoader`, `OrbitControls`, `RoomEnvironment` are taken from `deps.X`, then a top-level option `X`, then `THREE.X` (the r128 examples/js globals). Without a GLTFLoader the viewer still mounts and a load reports `MISSING_DEPENDENCY` honestly |
| defaults that differ from `mountAssetViewer` | `downloadButton:"always"` (the viewer's own **Download file** button whenever a valid asset is held). `mountAssetViewer` keeps `"auto"` because the concept gallery renders its own button |
| everything else | passed through unchanged: `asset`, `creativeSource`, `fetch`, `signal`, `disposeOnPageHide`, `autoRetry`, `rateLimitRetryDelayMs`, `renderConceptNotice`, `onError`, `ui`, … |
| returned handle | the full viewer handle: `load`, `showJob`, `watchJob`, `download`, `retry`, `orbit`, `zoom`, `resetView`, `fitToView`, `getView`, `getState`, `on`, `clear`, **`dispose`** |
| sizing | the root is `position:relative; width:100%; height:100%; min-height:320px; overflow:hidden`. A resize of the container (ResizeObserver, window `resize` fallback), including a phone orientation change, re-fits and keeps the view direction and zoom ratio |
| what `dispose()` releases | geometries, materials, textures (every slot), the PMREM render target + generator, lights, OrbitControls, ResizeObserver, every DOM/window/signal listener, the pending animation frame, `renderer.dispose()` + `forceContextLoss()`, the canvas and the overlay DOM. Counted against allocations in `dispose.test.js` and `mount.test.js` (ledger across load → replace → replace → pagehide) |

Tests: `tests/assetViewer/mount.test.js` (THREE mapping, explicit deps win, missing THREE error,
missing GLTFLoader, `downloadButton:"always"`, plain URL without any creative source, double
dispose, dispose then pagehide/abort, pagehide, already-aborted signal, abort mid-load, detached
root stops rendering, allocation ledger). Browser: `tests/assetViewer/e2e/f06-replace-navigate.spec.mjs`
(draw-call counter proves no frame is drawn after dispose or after the host removes the node).

**Demo host used.** `docs/m3/asset-viewer/demo/host.html` is a classic-script page served by
`serve.mjs` that mounts exactly like the snippet: `/vendor-three-r128.min.js` (the repo's r128,
loaded as a global), then `/__demo/r128-globals.js`, then `/__demo/asset-viewer.js` (esbuild
IIFE of the current source, built per request) and the optional creative IIFE. **The repo has no
three@0.128 `examples/js` loader files** (node_modules has three 0.166 only), so
`r128-globals.js` stands in for them: three-stdlib 2.36.1's GLTFLoader / OrbitControls /
RoomEnvironment, rewired to `window.THREE`, with two r128 shims (`LoaderUtils.resolveURL`,
`Texture.userData`) and hung on `window.THREE` the way the examples/js scripts do. The real page
should load loaders built **for** r128 (open question 3).

    node docs/m3/asset-viewer/demo/serve.mjs 4318
    open http://127.0.0.1:4318/docs/m3/asset-viewer/demo/host.html?state=loaded

States: `loaded`, `textured`, `texture-missing`, `loading`, `invalid&file=bad-magic|html-as|truncated|no-mesh`,
`unavailable&http=404|410|403|cors`, `webgl&webgl=none|throw|lost`, `replace`,
`job&job=succeeded|submission-unknown`, `forbidden`, `idle`. Every page shows the banner
**"SIMULATED, demonstration asset, not a Scenario result"** plus its evidence class.

## 14. v3 states, textures, view controls

| state | how it shows | Try again | Download |
|---|---|---|---|
| idle | `role=status` "No model loaded" | no | no |
| loading | `role=status` "Loading model… N%" (bytes measured locally) or the job phase text | no | **hidden** |
| ready | model, **Visual concept** chip, "Relative scale, not measured · W:H:D a : b : c", view controls; the demonstration label for synthetic files | n/a | offered with `downloadButton:"always"` (mount default) |
| ready, texture failed | as ready plus `role=note` "Some textures in this file couldn't be loaded, so the model is shown without them." (`model.warnings: ["TEXTURES_NOT_LOADED"]`, `model.textures {declared, loaded}`) | n/a | offered |
| invalid: bad magic / HTML-as-GLB / truncated / no mesh | `role=alert` with a specific message (`error.reason` `bad-magic` / `html` / `truncated` / `no-mesh`; `INVALID_FILE_MESSAGE`) | no | **hidden** (not a valid asset) |
| unavailable: 404 / 410 | `FETCH_FAILED` reason `gone`: "This model's link no longer works…" | no | hidden |
| unavailable: 403 expired link | `FETCH_FAILED` reason `denied`: "This model's link has expired or isn't allowed from this page." | no for a plain URL; **yes** for a creative concept (a fresh resolve may fix it) | hidden (plain URL); creative: offered (download resolves fresh) |
| unavailable: network / CORS / offline / 5xx | `FETCH_FAILED` reason `network` (same origin) / `cross-origin` ("…the connection failed, or the file's server doesn't allow this page to load it") / `offline` / `server` | **yes** | hidden |
| WebGL: no context, context creation throws | `WEBGL_UNAVAILABLE`; the file is still fetched and validated | no | **offered if the file is valid** (actual bytes) |
| WebGL: context lost mid-session | `WEBGL_CONTEXT_LOST` (restored → the model comes back) | **yes** | offered (the held file is valid) |
| FORBIDDEN (403 from `/api/creative`) | `role=alert`; page-wide, see §16 | no | hidden |
| job submission_unknown | "…It may have been charged. It will not be retried automatically." | no | hidden |
| disposed | nothing (root removed) | n/a | n/a |

All texts are `role=status` (polite) or `role=alert` (assertive); Try again and Download are real
`<button type=button>` with 44 px targets and a visible `:focus-visible` ring; the canvas is
`role=img`, focusable, described by the keyboard help (arrows rotate, + / − zoom, 0 resets, F
fits). Touch: one finger orbits, two fingers pinch-zoom (OrbitControls; e2e via CDP touch
events). `getView()` → `{ distance, fitDistance, zoomRatio, azimuth, polar }`.

**Textures.** Embedded and external images go through the injected GLTFLoader; colour maps are
forced to sRGB. A texture whose image is absent (`missing-texture.glb`: a texture pointing at an
image that doesn't exist) used to make GLTFLoader throw and lose the whole model (BUG-001, S2);
a GLTFLoader plugin in `adapters/gltf.js` now resolves it to "no texture" so the mesh still shows
with the note. An undecodable image (`corrupt-texture.glb`) degrades the same way.

## 15. Contract rev 2 (`docs/creative/SCENARIO_3D_API_CONTRACT.md`, read-only)

| rev 2 item | viewer behaviour |
|---|---|
| `usage.billingOutcome` on every job (`not_submitted` / `reported` / `unconfirmed`) | `getState().job.billing = { outcome, source:"server" }`; a rev 1 record without it is derived conservatively (`source:"derived"`); anything unknown reads as `unconfirmed`, never free (`describeBillingOutcome`) |
| one active job per **reference** (`409 DUPLICATE_ACTIVE_JOB` with `details.jobId`) | `DUPLICATE_ACTIVE_JOB`, `relatedJobId`, never retried; `job.referenceId` reported |
| `409 PRIOR_SUBMISSION_UNKNOWN` + `acknowledgeUnknownCharge` | `PRIOR_SUBMISSION_UNKNOWN`, `requiresAcknowledgement:true`, `relatedJobId`. The viewer **never** POSTs, resubmits or sets `acknowledgeUnknownCharge`; never auto-retried (with any `autoRetry`) |
| job `submission_unknown` | `SUBMISSION_UNKNOWN`, `chargeMayHaveOccurred:true`, billing `unconfirmed`, no resolve, no fetch, no Try again |
| `422 INVALID_IMAGE`, `reference.width/height/validation` (`decoded` / `structure`) | mapped error; `describeReferenceValidation()` for hosts |
| asset route | unchanged between `b7e4fb8` and `f472aef` (`api/creative.js` not in the diff); the URL is resolved fresh on every display and download and never cached (single-use signed addresses in the stand-in prove it) |
| `concept.notice` | shown verbatim unless `renderConceptNotice:false` (then the host must show it) |
| fixture pack `docs/creative/fixtures` | drives `rev2.test.js` and the demo's `/__rev2/api/creative` (SIMULATED). `SYNTHETIC-box-not-scenario-generated.glb` (1828 bytes, sha256 `e2bec10b7995124700de3c8d73b9219671f6e9ebd90c124aa18f482636403b71`) is loaded read-only (its mtime is checked after every test); it labels itself `extras.synthetic:true, generatedByScenario:false`, so the viewer shows the demonstration label |

`RESOLVE_FAILED` is narrowed to network/transport; server answers without a known code are
`RESOLVE_SERVER_ERROR` (`cause:"http"`, retryable on 5xx). The QE acceptance tests that pin
500 `INTERNAL` → `RESOLVE_FAILED` (`tests/acceptance/scenario/viewerV21.acceptance.test.js`) already
fail at `f472aef` for a rev 2 upload-helper reason, so no new failure; QE should update them.

## 16. FORBIDDEN (403): when, and is it ever per job?

Answer from the rev 2 backend code at `f472aef` (`api/creative.js`, `src/lib/creative/**`,
and the shared `src/lib/persistence/auth.js` / `errors.js` it uses), read-only:

- **`/api/creative` never answers 403 from its own code.** `withCreative()` sends
  `CreativeError.status` (table in `src/lib/creative/errors.js`: 400/402/404/409/410/413/415/422/
  429/502/503, no 403) or `PersistenceError.status`.
- Caller resolution (`resolveCaller`): no or empty bearer → **401** `MISSING_AUTH`; a token Supabase
  rejects → **401** `MISSING_AUTH`; Supabase auth 5xx or unreachable → **503** `AUTH_UNAVAILABLE`;
  not configured → **503**.
- `PERSISTENCE_ERROR.UNAUTHORIZED` maps to 403 in `persistence/errors.js`, but **nothing on the
  creative path (or anywhere in `src`/`api`) throws it**.
- The creative Supabase store maps **any** PostgREST non-ok answer (including an RLS 401/403) to
  **503** `STORAGE_UNAVAILABLE`.
- A provider (Scenario) 401/403 becomes **502** `PROVIDER_AUTH_REJECTED`: deployment credentials,
  the same for every user and job.
- **Another user's job is 404 `MISSING_JOB`**, identical to a job that doesn't exist (every store
  query filters on `owner_user_id`). Ownership is never revealed as 403.

So **no 403 is per job** in rev 2. A 403 can only come from something in front of the function
(hosting/deployment protection, a WAF or proxy), which applies to every request from that page.
**Recommendation: hosts treat FORBIDDEN as page-wide**, like signed-out in scope (one page-level
message; stop opening other tiles; don't offer per-tile retry), but unlike signed-out, signing in
again won't fix it, so don't send the user to sign in. The viewer still shows it locally (no Try
again, no Download) for hosts that don't elevate it. The message says "this 3D concept"; a
page-wide wording would be more accurate, but it matches the gallery's copy and is pinned there,
so it is left for the copy owner (open question 16).

## 17. Evidence labels (integration lead taxonomy)

Every evidence item is exactly one of:

| label | meaning here |
|---|---|
| **SYNTHETIC/MOCKED** | a synthetic fixture file loaded as-is: the rev 2 SYNTHETIC box, QE's `tests/fixtures/scenario/*.glb` |
| **SIMULATED** | a staged environment: slow / 404 / 410 / 403 / no-CORS routes, stubbed WebGL, the fixture-backed `/api/creative` stand-ins |
| **LIVE** | real provider output. **Nothing is LIVE.** No Scenario request of any kind was made |

The label is in each page's banner, in every evidence filename
(`docs/m3/asset-viewer/evidence/v3/<NN>-<state>-<LABEL>-<desktop|mobile>.png`), in the evidence
README and in `replica/features.csv`. Scenario stays an **optional adapter**: the core bundle
works with a plain URL or asset descriptor and no creative source (tested in `mount.test.js`).

## 18. Method: replica skills

The replica skills were applied by **reading the skill folders directly (read-only)**, not via
catalog discovery: `/workspace/scenario-review/skills/replica-build/SKILL.md`,
`replica-test/` (`SKILL.md`, `test-plan.md`, `bug-report.md`, `e2e.example.spec.ts`) and
`replica-diff/` (`SKILL.md`, `imgdiff.py`, `parity.py`). Outputs: `replica/build-log.md`,
`replica/features.csv`, `replica/test-plan.md`, `replica/bugs.md`, `replica/mutate.py`, the Playwright specs in
`tests/assetViewer/e2e/` (one per flow F01–F07, own config, role/label selectors, fail on console
errors and 5xx, axe on every state with `@axe-core/playwright` from `/workspace/asset-viewer/tools`)
and `evidence/v3/imgdiff-desktop-vs-mobile.json`.

    npx playwright test -c tests/assetViewer/e2e/playwright.config.mjs

## 19. Bundles: the creative adapter is optional

| bundle | entry | global | contents |
|---|---|---|---|
| core | `entry.js` | `FurniAssetViewer` | `mount`, `mountAssetViewer`, adapters, errors, labels, `isRetryableResolveError`, `normalizeConcept` (`version: asset-viewer-module/3`) |
| creative (optional) | `entry.creative.js` | `FurniAssetViewerCreative` | `createCreativeAssetSource`, retry helpers, `mapCreativeError`, `normalizeBilling`, `describeBillingOutcome`, `describeReferenceValidation`, … (`version: asset-viewer-creative/3`) |

Errors cross the two bundles by duck typing (`isViewerError`: `name === "AssetViewerError"` and a
known code), not `instanceof`. `index.js` still exports everything for module users. Sizes are in
the [v3 changelog](#v3).

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
12. **Retry policy sign-off (v2.1).** Is the viewer default in §12.4 what the contract means? In
    particular: are `*_NOT_CONFIGURED` 503s really never worth a retry, and should a 429 wait
    (`Retry-After`) instead of retrying at once? The backend sends no `Retry-After` today.
13. **Host-rendered notice (v2.1).** The gallery should set `renderConceptNotice:false` and show
    `getState().concept.notice` (or a download result's `concept.notice`) itself. Who checks
    that it is always visible?

14. **Interim host interface (v3).** `mount(containerEl, { THREE, ...opts })` is interim until
    Antigravity's container exists. Does the final container keep `{ THREE }` injection and the
    host-calls-`dispose()` rule?
15. **Gallery Download still retries silently (v3, not in this module's paths).**
    `src/lib/projects/conceptGallery/mountConceptGallery.js` (~L352–354) does its own single
    re-resolve on a retryable Download failure, and its header still describes the viewer's old
    default. Under the "retries only when the user starts them" rule its owner should drop that
    retry (or pass `autoRetry:true` deliberately).
16. **FORBIDDEN copy.** The message says "this 3D concept"; rev 2 can only produce a 403 from
    infrastructure, so it is page-wide (§16). Copy owner to decide on a page-wide wording (the
    gallery has the same text).
17. **CORS vs offline.** A browser reports a CORS block and a dropped connection the same way
    (`TypeError`). v3 says both on a cross-origin link (reason `cross-origin`, BUG-002 fixed), but
    only a FurniAI copy/proxy (U6/U7) removes the ambiguity.
18. **QE acceptance follow-ups (not edited: `tests/acceptance/**` is QE's).** See the v3
    changelog: tests pinning `RESOLVE_FAILED` for 500 and the old default single retry.

## Known limitations

- Animations are counted but not played.
- Only glTF is displayed. Concept formats other than glb/gltf are download-only by contract.
- No KTX2, Draco or meshopt support (would be added by injection once confirmed).
- The built-in overlay is minimal. A host can pass `ui:false` and render its own from events.
- r128 residual PMREM geometry (§8).
- A browser can't tell a CORS block from a dropped connection; on a cross-origin link the message names both (BUG-002).
- Core bundle headroom is small (minified 48,884 of 49,152 bytes); the creative adapter was split
  out for that reason and because Scenario is optional.

## Changelog

### v3

Builds on `f472aef` (contract rev 2). Only module-owned paths changed (`src/lib/assetViewer/**`,
`tests/assetViewer/**`, `docs/m3/asset-viewer/**`). Evidence: SYNTHETIC/MOCKED and SIMULATED only;
**no real Scenario run, nothing LIVE.**

- **Host interface:** `mount(containerEl, { THREE, ...opts })` in the public entry (§13).
- **autoRetry (default `false`)**: no silent retry of any kind; Try again = user-started fresh
  resolve; `autoRetry:true` (mount or per call) = v2.1 behaviour incl. the 1 s 429 pause (§12.4).
- **States:** reason-specific honest messages: `FETCH_FAILED_MESSAGE` (`network`, `cross-origin`, `offline`,
  `gone` 404/410, `denied` 403, `server` 5xx, `http`) and `INVALID_FILE_MESSAGE` (`html`,
  `bad-magic`, `truncated`, `no-mesh`), `error.reason`; WebGL no-context / throws / lost with
  download of a valid file; FORBIDDEN documented page-wide (§16).
- **Textures:** `model.textures {declared, loaded}`, `TEXTURES_NOT_LOADED` note; missing image no
  longer loses the model (BUG-001).
- **View:** orbit / zoom / reset / fit buttons, keyboard, touch, `getView()`, resize re-fit keeps
  direction and zoom ratio.
- **Navigation:** `signal` (AbortSignal) and window `pagehide` dispose; no frames while the root is
  detached; `dispose()` idempotent.
- **Download:** the viewer's own button (`downloadButton:"always"`, mount default) gives the
  actual stored bytes and format; hidden in loading / invalid / unavailable / failed-job states.
- **Resolve errors:** `RESOLVE_FAILED` = network only; new `RESOLVE_SERVER_ERROR` (`cause:"http"`,
  retryable on 5xx). `source.isRetryable(err)` / `source.retryDelayMs(err)` on the instance (free
  export kept).
- **Rev 2:** billing outcome, `PRIOR_SUBMISSION_UNKNOWN`, `DUPLICATE_ACTIVE_JOB`, reference
  validation (§15).
- **Bundles:** creative adapter moved to `entry.creative.js` (`FurniAssetViewerCreative`).
  Core `entry.js`: unminified 88,448 bytes (limit 98,304), minified 48,884 (limit 49,152);
  creative: 18,102 / 11,400 (limit 16 KiB minified). `version`: `asset-viewer-module/3`, `asset-viewer-creative/3`.
- **Scale honesty:** a new test proves claimed real-world dimensions never change the mesh, its
  bounds, the fit or the proportions (no silent rescale).
- **Tests:** asset-viewer suite 194 → 274 (19 files); root `npx vitest run` 2098 → 2178 tests,
  1940 → 2020 passed, the same 134 pre-existing failures as `f472aef` (none new, none fixed),
  4 skipped, 20 todo; `npx vitest run src/lib/creative` 77/77. Playwright e2e (own config,
  desktop-1440 + mobile-390): 55 passed, 1 skipped (touch on the desktop project, by design), axe
  clean on every checked state.
- **Mutation checks** (`replica/mutate.py`, all KILLED): caching the resolved URL (10 failing),
  removing model dispose (8), removing renderer dispose (5), skipping the pagehide dispose (5),
  Download in an error state (14), rescaling to claimed dimensions (1), autoRetry default → true (12).
- **QE follow-ups (tests/acceptance/** not edited; all of these already fail at `f472aef` because the
  rev 2 upload helper reads `body.reference.referenceId`, so v3 adds no new failure, but they will
  fail for the v3 reasons once that helper is fixed):**
  - `viewerV21.acceptance.test.js` "V1 load(): exactly ONE fresh re-resolve…" (5 cases) asserts
    `expect(s1.attempts).toEqual({ resolve: 2, display: 1 })`, `expect(a.t.states.some((s) => s.phase === "retrying")).toBe(true)`,
    `expect(s2.attempts.resolve).toBe(2)` → needs `autoRetry: true` (or the new default).
  - `viewerV21.acceptance.test.js` "V5 download(): exactly ONE fresh re-resolve…" (5 cases) asserts
    `toMatchObject({ ok: true, …, attempts: { resolve: 2 } })` and `expect(d2.attempts).toEqual({ resolve: 2 })` → same.
  - `viewerV21.acceptance.test.js` "V2 … FINDING: an unknown server code (500 INTERNAL) is also
    RESOLVE_FAILED" → now `RESOLVE_SERVER_ERROR`.
  - `galleryViewer.acceptance.test.js` "one retry on a failed load: a dead first address is re-resolved ONCE…"
    asserts `expect(s1.attempts).toEqual({ resolve: 2, display: 2 })` → the gallery's Open goes through
    `load`, so it needs `autoRetry:true` from the gallery or a new expectation. Its Download retry cases
    exercise the gallery's own retry (open question 15).

### v2.1 hardening (V1–V6)

Builds on `f971fae`. Only module-owned paths changed. All test evidence is **SIMULATED**
(stand-in and fixtures). **No real Scenario run.**

- **V1:** `load()` re-resolves **once** when the asset resolve itself fails retryably
  (network, 5xx, 429). It never does so for 401/403/404/409/410, `ASSET_NOT_READY`,
  integrity, malformed bodies or `*_NOT_CONFIGURED`. This is the viewer's default, because
  contract §2.5 is ambiguous (§12.4, §12.7 item 11).
- **V2:** `RESOLVE_FAILED` now means network or transport only (plus unknown server codes). A bad
  body is the new `RESOLVE_MALFORMED`, which is never retried. Every resolve error carries
  `details.cause` (`network | malformed | http`) and `details.retryable`. New export:
  `isRetryableResolveError`.
- **V3:** the server's `concept.notice` is shown verbatim. The fallback `DEFAULT_CONCEPT_NOTICE`
  now equals the server's text exactly ("…no separately editable doors or panels…").
- **V4:** only 401 means signed out. A 403 (`UNAUTHORIZED`, `FORBIDDEN`, or no code) becomes the new
  `FORBIDDEN`, with an honest message.
- **V5:** `download()` follows the same fresh-resolve and single-retry rule, and accepts
  `download({ jobId, index, save })` for an item that isn't on screen. It never reuses a url.
- **V6:** new mount option `renderConceptNotice` (default `true`). With `false` the host renders
  the notice, and must always do so. `getState().concept.notice` still carries it.
- Bundle (esbuild IIFE of `entry.js`): unminified 72,727 → 76,522 bytes (limit 96 KiB), minified
  40,675 → 42,538 bytes (limit 48 KiB). `version` stays `asset-viewer-module/2`.
- Tests: 152 → 194 asset-viewer tests; root `npx vitest run` 1631 → 1673 passed, 4 skipped, 20 todo.
