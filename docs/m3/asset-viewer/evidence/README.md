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
