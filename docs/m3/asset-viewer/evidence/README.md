# Asset viewer: browser evidence (DEMO ONLY)

Captured on 2026-10-04 at 11:05 Dubai time (UTC+4) by `node docs/m3/asset-viewer/demo/capture.mjs`.
It used Playwright's headless Chromium 151.0.7922.34 with
`--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
WebGL came up as **WebGL 2.0, ANGLE / SwiftShader (Vulkan) software renderer**,
so these screenshots are real GPU-pipeline pixels, not mocks. Only the local
procedural fixtures in `tests/assetViewer/fixtures/` were loaded. Nothing came from the network.

The run is recorded twice, in two modes:

| mode | THREE | loader classes injected |
|---|---|---|
| `r166` | three 0.166.1 from node_modules (ES module, import map) | `three/examples/jsm` GLTFLoader, OrbitControls, RoomEnvironment |
| `r128` | the repo's `vendor-three-r128.min.js` as `window.THREE` (what the static Studio page has) | three-stdlib 2.36.1 loaders rewired to `window.THREE`, with two demo shims (see ASSET_VIEWER.md §r128) |

## Files

| file | shows |
|---|---|
| `r166-01-loading.png`, `r128-01-loading.png` | `loading:fetching` with streamed progress (33% / 67%), overlay "Loading model… N%" |
| `*-02-textured-ready.png` | textured chair `ready`, sRGB baseColor, badge "Relative scale, not measured · W:H:D 0.46 : 1.00 : 0.46" |
| `*-03-orbited.png` | after a real pointer drag through OrbitControls (damping) |
| `*-04-zoomed.png` | after mouse-wheel zoom |
| `*-05-fit.png` | `fitToView()`: the fit distance comes back and the orbit direction is kept |
| `*-06-replaced-untextured.png` | the chair replaced by the untextured table |
| `*-07-error-corrupt.png` | `PARSE_FAILED` error state with the customer-safe message |
| `asset-viewer-r166.webm` | 13.4 s: loading, orbit, zoom in and out, fit, replace, orbit, corrupt-file error |
| `capture-results.json` | every step's `getState()`, `renderer.info.memory`, camera numbers, pixel samples, console errors |

## Key measured results (from capture-results.json)

| check | r166 | r128 |
|---|---|---|
| colour management detected | `colorSpace` | `encoding` |
| baseColor texture | `colorSpace: "srgb"` (ImageBitmap) | `encoding: 3001` (sRGBEncoding) |
| renderer output | `outputColorSpace: "srgb"` | `outputEncoding: 3001` |
| model pixels / average RGB of the textured chair | 10.98% / [220,170,112] | 10.98% / [221,172,115] |
| memory, chair ready (geometries/textures) | 1 / 2 (model + env) | 2 / 2 (model + r128 PMREM internals) |
| memory after replace with table | 1 / 1 | 2 / 1 |
| memory after `clear()` | 0 / 1 (env only) | 1 / 1 |
| memory after `dispose()` with a model loaded | **0 / 0**, context lost, canvas detached | 1 / 0, context lost, canvas detached |
| corrupt / `.obj` / empty scene | PARSE_FAILED / UNSUPPORTED_FORMAT / EMPTY_SCENE | same |
| supersede race (slow chair overtaken by table) | table shown, no error | same |
| `download()` bytes identical to the fixture | true (`model/gltf-binary`, `table-untextured.glb`) | true |
| console errors during the run | none | none |

The residual geometry in r128 is **r128's own PMREMGenerator**. Even with an
empty scene and after `pmrem.dispose()`, r128 keeps one geometry counted.
three 0.166 does not, and with `environment: "none"` r128 also returns to 0.
The viewer calls `forceContextLoss()` on dispose, so the browser frees the GL
objects with the context anyway. See ASSET_VIEWER.md §Disposal.

## Round 2: `/api/creative` contract, SIMULATED (`creative/`)

> **SIMULATED. Fixtures only. This is NOT a Scenario demonstration.** No Scenario
> request was made, no credentials exist on this box, no credits were spent. Every
> model on screen is a procedural fixture from `tests/assetViewer/fixtures/`. The
> "API" is the stand-in in `tests/assetViewer/helpers/creativeStandIn.js`, served by
> `demo/serve.mjs`. It copies the response *shapes* of the PROPOSED contract and of the
> Claude backend bundle (tip 7f42f95); it is not that backend. Every screenshot carries a red
> "SIMULATED /api/creative stand-in · fixtures only · not a Scenario result" banner and
> a "SIMULATED · fixture model · not Scenario" watermark.

Captured on 2026-10-04 at 11:54 Dubai time (UTC+4) by
`node docs/m3/asset-viewer/demo/capture-creative.mjs`. Same headless Chromium
151.0.7922.34 and SwiftShader WebGL 2.0 as above, three 0.166 (`creative.html?three=r166`).
The page passes `getAuthToken: () => "sim-token"`. The stand-in rejects any call
without that Bearer token (401 `MISSING_AUTH`). Its signed addresses are **single use**:
a second GET of the same address gets a 403, so reusing a url would show up as a failure.

**v2.1 note:** these SIMULATED captures were taken at `24f6721`, before the v2.1 hardening
(V1–V6). They were not re-captured. None of the 14 steps goes through a path that v2.1
changed: there is no 5xx or network failure on resolve, no 403 API answer and no malformed
body. The 410 and 409 steps are still not retried. The notice shown is the stand-in's
verbatim server text, which is also the v2.1 fallback. The video was not regenerated.

**v3 retry default (AV3-D1, round 5):** in v3 `autoRetry` defaults to **`false`**: no silent
retries, only the user's **Try again**. Steps `06` (expired address → one fresh resolve → shown)
and `10` (no-CORS address → re-resolved once → `ASSET_DISPLAY_FAILED`) show the **v2.1** single
automatic retry, which v3 keeps only behind the opt-in `autoRetry:true`. With the v3 default the
same inputs stop after **one** resolve: `06` shows `FETCH_FAILED` (`denied`) with Try again (a
click resolves fresh and recovers), `10` shows `FETCH_FAILED` (`cross-origin`) with Try again.
They were not re-captured; the v3 host-page evidence (`v3/11-…`, `v3/11b-…`) shows the default.

| file | shows |
|---|---|
| `creative/01-processing.png` | `watchJob("sim-processing")`: `loading:job-processing`, "Generating 3D concept… This can take a few minutes." The stand-in sends `providerProgress: 0.37`; it is not shown and no % appears anywhere (`noPercentage: true`, `progress: null`) |
| `creative/02-processing-then-succeeded.png` | 3 polls at a 3 s cadence (one with `refresh.ok:false`, ignored), then `succeeded` → resolve → GLB shown |
| `creative/03-succeeded-glb-concept-notice.png` | succeeded GLB with the server's `concept.notice` banner, "Relative scale, not measured" ratios, and `actions.openInBuilder/export/production: false` |
| `creative/04a-orbit.png`, `04b-zoom.png`, `04c-fit.png` | real pointer drag, wheel zoom (distance 2.02 → 0.75), and `fitToView()` back to 2.02 |
| `creative/05-download-fresh-url.png` | Download makes a NEW resolve (asset resolves 2 → 3). The mesh was shown from address `t0002` and the download used the fresh `t0003`. Chromium saved `furniai-concept-sim-glb-chair-0.glb` |
| `creative/06-expired-url-reresolve.png` | first address `t0004` → 403 (expired), one fresh resolve → `t0005` → 200 → shown. Exactly 2 resolves |
| `creative/07-asset-unavailable-410.png` | 410 `ASSET_UNAVAILABLE` → "This 3D concept is no longer available…", no retry, no download |
| `creative/08-download-only-fbx.png` | fbx output → `download-only` with **0** mesh fetches. The built-in "Download file" button re-resolved and saved `furniai-concept-sim-fbx-0.fbx` (a labelled text placeholder, not a real FBX) |
| `creative/09-submission-unknown.png` | `submission_unknown` → "…It may have been charged. It will not be retried automatically." One status call, no further polling |
| `creative/10-no-cors-address-display-failed.png` | U7 simulation: the address points at a second origin with no `Access-Control-Allow-Origin`. The browser refuses the fetch, the viewer re-resolves once, is refused again, and shows `ASSET_DISPLAY_FAILED` "couldn't be displayed here. Downloading it may still work." with a Download button |
| `creative/11-unrecognised-format-download-only.png` | `format: null` → download-only ("this file type") |
| `creative/12-job-failed.png` | `failed` → the job's own `error.message` (sanitised) |
| `creative/13-record-integrity-failed.png` | 409 `RECORD_INTEGRITY_FAILED`, told apart from 409 `ASSET_NOT_READY` by `code` |
| `creative/14-submitting.png` | `submitting` → "Sending your image to the 3D generation service…" |
| `creative/creative-simulated-r166.webm` | 21.9 s recording of the whole run above |
| `creative/creative-results.json` | for each step: `getState()`, overlay texts, the stand-in's server-side call log, camera and pixel numbers, plus console errors. The expected ones are the 403/410/409 responses and the two CORS refusals |

Summary from `creative-results.json`:

- 23 API calls, **0 without Bearer**.
- 10 asset resolves and 8 signed-address GETs, one of which was the deliberate expired-url 403.
- `urlInAnyCapturedState: false`.
- `conceptNoticeInEveryConceptStep: true`.
