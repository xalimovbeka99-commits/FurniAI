# Test plan: FurniAI generated-asset viewer (v3)

Build: `fa97785` (viewer) + `523ffd9` (demo host, e2e)  Date: 2026-10-07  Env: local box, demo host
`docs/m3/asset-viewer/demo/host.html` served by `serve.mjs`, three r128 as a global, Chromium
(Playwright 1.62.1, SwiftShader WebGL). Seed data: synthetic fixtures only.

Format and severities follow the replica-test skill, read directly from
`/workspace/scenario-review/skills/replica-test/` (`SKILL.md`, `test-plan.md`, `bug-report.md`).
Evidence labels: **SYNTHETIC/MOCKED** (a synthetic fixture file) and **SIMULATED** (a staged route,
stubbed WebGL or the fixture-backed `/api/creative` stand-in). **Nothing is LIVE**; no provider
was called.

`auto` = `e2e` (Playwright spec in `tests/assetViewer/e2e/`, run in both the `desktop-1440`
1440×900 and `mobile-390` 390×844 projects, axe wcag2a/aa/21a/21aa where marked), `unit`
(vitest, `tests/assetViewer/`), `manual`. Result of the final run: **e2e 55 passed, 1 skipped
(F02-E3 on desktop: touch only exists on the mobile project); unit 274/274.** Review round 5
(on `3411eb2`): **e2e 69 passed, 1 skipped; unit 292/292** (new rows F07-N4/N5, F04-E4, F08-L1/L2).

| case | flow | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- | --- |
| F01-H1 | open and view a model | happy | open `host.html?state=loaded` (rev 2 SYNTHETIC box, read-only) | ready; role=note "Demonstration asset, synthetic fixture, not a generated result"; "Visual concept"; "Relative scale, not measured · W:H:D 0.50 : 1.00 : 0.30"; no "mm"; Download offered; axe clean | e2e | pass (both) |
| F01-H2 | | happy: textured model | `?state=textured` (textured-cube.glb) | texture decoded and applied (screenshot colour check), sRGB colour map, no texture note | e2e + unit (textures.test.js) | pass |
| F01-E1 | | edge: missing texture image | `?state=texture-missing` | model still shown untextured; role=note texture message; Download still offered (BUG-001 regression) | e2e + unit | pass |
| F01-E2 | | edge: slow network | `?state=loading` (600 s route) | role=status progress; no Download, no view controls; axe clean | e2e | pass |
| F01-E3 | | edge: idle | `?state=idle` | nothing loaded, no Download | e2e | pass |
| F01-E4 | | edge: corrupt texture bytes | unit: corrupt-texture.glb | ready, `TEXTURES_NOT_LOADED` note, Download offered | unit | pass |
| F01-N1 | | negative: claimed real-world size | unit: load with `scale: { units: "mm", 460×1010×460 }` | metadata ignored and never echoed; mesh, bounds, fit and proportions identical to the same file without metadata | unit (scale.test.js) | pass |
| F02-H1 | orbit, zoom, fit, reset | happy | press ◀ ▶ + − Reset Fit | view changes; Reset returns to the fitted view; Fit re-frames | e2e | pass (both) |
| F02-E1 | | edge: keyboard only | Tab through canvas and controls; arrows, +/- | every control reachable, visible focus ring, arrows orbit, +/- zoom | e2e | pass (both) |
| F02-E2 | | edge: resize / orientation change | resize viewport (rotate on mobile) | re-fit, same direction and zoom ratio, no horizontal overflow | e2e + unit | pass (both) |
| F02-E3 | | edge: touch and pinch | one-finger drag, two-finger pinch (CDP touch) | orbit and zoom | e2e (mobile only) | pass mobile; skipped desktop |
| F03-N1..N4 | invalid files | negative | `?state=invalid&file=bad-magic / html-as / truncated / no-mesh` | role=alert with the reason message; no Try again; no Download; axe clean | e2e + unit | pass (both) |
| F04-N1..N3 | unavailable asset | negative | `?state=unavailable&http=404 / 410 / 403` | FETCH_FAILED, honest reason message (gone / denied); no Download | e2e + unit | pass (both) |
| F04-E1 | | edge: blocked cross-origin fetch | `?state=unavailable&http=cors` then click Try again | cross-origin message (BUG-002); focusable Try again; exactly one request per click, no silent retry | e2e | pass (both) |
| F04-E2 | | edge: autoRetry default false | unit: 500/502/503/429/network/expired URL/damaged mesh | 1 resolve, 0 retries, no 1 s pause, no "retrying" phase; Try again = fresh resolve | unit (autoRetry.test.js) | pass |
| F04-E3 | | edge: autoRetry:true | unit: same failures with `autoRetry:true` (mount or per call) | v2.1: one fresh re-resolve + one retry; 429 waits ~1 s (injectable) | unit | pass |
| F05-N1..N3 | WebGL failure | negative | `?state=webgl&webgl=none / throw / lost` | WEBGL_UNAVAILABLE / WEBGL_CONTEXT_LOST alert; the valid file can still be downloaded (sha256 of the bytes = the fixture) | e2e | pass (both) |
| F06-H1 | replace and navigate | happy: replace | Replace with another model | second model shown; first model's GPU memory released (draw-call and resource counters) | e2e + unit (allocation ledger) | pass (both) |
| F06-H2 | | happy: host dispose | Leave page (dispose viewer) | canvas and overlay removed, context lost, no further draws; dispose idempotent | e2e + unit | pass (both) |
| F06-E1 | | edge: navigation mid-load | pagehide during a slow load | disposed; page comes back clean | e2e + unit | pass (both) |
| F06-E2 | | edge: node removed without dispose | host removes the viewer's root | rendering stops | e2e + unit | pass (both) |
| F06-E3 | | edge: AbortSignal | unit: abort mid-load / pre-aborted signal | disposed, nothing left on window or signal | unit (mount.test.js) | pass |
| F07-H1 | download and jobs | happy: local asset | click Download twice quickly | original GLB bytes (sha256), `.glb` name, one download | e2e | pass (both) |
| F07-H2 | | happy: SIMULATED job succeeded | `?state=job&job=succeeded`; click Download twice | rendered from the rev 2 pack; concept notice verbatim; every click resolves a FRESH address | e2e + unit | pass (both) |
| F07-N1 | | negative: submission unknown | `?state=job&job=submission-unknown` | "may have been charged"; not retried; nothing resolved; no Download | e2e + unit | pass (both) |
| F07-N2 | | negative: 403 from /api/creative | `?state=forbidden` | FORBIDDEN; no Try again; no Download; one request | e2e + unit | pass (both) |
| F07-N3 | | negative: download default | unit: download() on 503/429 | 1 resolve, no automatic retry; next click resolves again | unit | pass |
| F07-N2 (r5) | | negative: FORBIDDEN copy | `?state=forbidden` | alert text is exactly "This account doesn't have permission to open this 3D concept."; no sign-in wording anywhere in the viewer | e2e + unit (reviewRound5.test.js) | pass (both) |
| F07-N4 | | negative: INT-403 duplicates | `?state=forbidden` with a MutationObserver from page load | exactly ONE `[role=alert]` on the page, none with an extra `aria-live`; ONE announcement of the permission text; `error.pageWide:true`; FORBIDDEN entered once; `retry()` a no-op (no request, no announcement); host closes the panel → 0 alerts | e2e + unit | pass (both) |
| F07-N5 | | negative: retry() not offered | unit: idle, ready, 404, submission_unknown, disposed | `{ ok:false, retried:false, state }`; no fetch, no state change; still re-runs where `canRetry` | unit | pass |
| F04-E4 | unavailable asset | edge: broken on both attempts (AV3-D2) | unit: `sim-corrupt` with `autoRetry:true` | `PARSE_FAILED` (`attempts {2,2}`), no Download, no Try again; contrast `sim-cors` twice → `ASSET_DISPLAY_FAILED` with Download | unit | pass |
| F08-L1 | layout at 390 / 1440 | edge: host page | `?state=loaded / forbidden / unavailable&http=cors / webgl&webgl=none` | 0 horizontal overflow (document and every element); every visible control in the viewer and the host page ≥ 44×44 CSS px | e2e | pass (both) |
| F08-L2 | | edge: demo pages | `demo/?three=r166`, `demo/creative.html?three=r166` | one column at 390, viewer ≥ 300 px wide, 0 overflow, every control ≥ 44×44 | e2e | pass (both) |

Mutation checks (`replica/mutate.py`, every mutant must fail the unit suite): caching the
resolved URL, removing model dispose, removing renderer dispose, skipping the pagehide dispose,
Download in an error state, rescaling to claimed dimensions, autoRetry default → true. All 7 killed.
