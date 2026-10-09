# Asset viewer v3 evidence

**SIMULATED, demonstration asset, not a Scenario result.** Nothing here is LIVE: no Scenario (or
any other provider) request was made. Every page carries that banner plus an evidence-class chip.

- Build: viewer `fa97785`, demo host `523ffd9` (branch `grok/asset-viewer`, base `f472aef`).
  Captured from the committed tree with `node docs/m3/asset-viewer/demo/capture-host.mjs`.
- Host: `docs/m3/asset-viewer/demo/host.html` (three r128 as a global, core bundle + optional
  Scenario adapter as classic scripts), Chromium via Playwright 1.62.1, SwiftShader WebGL.
- Viewports: desktop 1440×900, mobile 390×844, device scale 1.
- Labels (integration lead taxonomy): **SYNTHETIC/MOCKED** = a synthetic fixture file loaded as-is
  (the rev 2 `docs/creative/fixtures/SYNTHETIC-box-not-scenario-generated.glb`, sha256
  `e2bec10b7995124700de3c8d73b9219671f6e9ebd90c124aa18f482636403b71`, read-only, or QE's
  `tests/fixtures/scenario/*.glb`); **SIMULATED** = a staged route (slow / 404 / 410 / 403 / no
  CORS), stubbed WebGL, or the fixture-backed `/__rev2/api/creative` stand-in. **LIVE: none.**
- `capture-results.json`: per shot the state, status, error code/reason/message, banner text,
  horizontal overflow (0 everywhere) and whether Download was offered.
- `imgdiff-desktop-vs-mobile.json`: replica-diff `imgdiff.py` (read directly, unmodified) desktop vs
  mobile of the same state. Low scores are expected (the page reflows to one column); not a parity claim.

| # | state | label | status / code | Download | files |
|---|---|---|---|---|---|
| 01 | loaded (rev 2 SYNTHETIC box) | SYNTHETIC/MOCKED | ready | yes | `01-loaded-SYNTHETIC-MOCKED-{desktop,mobile}.png` |
| 02 | textured | SYNTHETIC/MOCKED | ready | yes | `02-textured-SYNTHETIC-MOCKED-{desktop,mobile}.png` |
| 03 | texture missing | SYNTHETIC/MOCKED | ready + texture note | yes | `03-texture-missing-SYNTHETIC-MOCKED-{desktop,mobile}.png` |
| 04 | loading | SIMULATED | loading | no | `04-loading-SIMULATED-{desktop,mobile}.png` |
| 05 | invalid: bad magic | SYNTHETIC/MOCKED | PARSE_FAILED | no | `05-invalid-bad-magic-SYNTHETIC-MOCKED-{desktop,mobile}.png` |
| 06 | invalid: HTML as .glb | SYNTHETIC/MOCKED | PARSE_FAILED | no | `06-invalid-html-as-glb-SYNTHETIC-MOCKED-{desktop,mobile}.png` |
| 07 | invalid: truncated | SYNTHETIC/MOCKED | PARSE_FAILED | no | `07-invalid-truncated-SYNTHETIC-MOCKED-{desktop,mobile}.png` |
| 08 | invalid: no mesh | SYNTHETIC/MOCKED | EMPTY_SCENE | no | `08-invalid-no-mesh-SYNTHETIC-MOCKED-{desktop,mobile}.png` |
| 09 | unavailable 404 | SIMULATED | FETCH_FAILED (gone) | no | `09-unavailable-404-SIMULATED-{desktop,mobile}.png` |
| 10 | unavailable 410 | SIMULATED | FETCH_FAILED (gone) | no | `10-unavailable-410-SIMULATED-{desktop,mobile}.png` |
| 11 | expired link 403 | SIMULATED | FETCH_FAILED (denied) | no | `11-unavailable-403-expired-SIMULATED-{desktop,mobile}.png` |
| 11b | blocked cross-origin | SIMULATED | FETCH_FAILED (cross-origin) + Try again | no | `11b-unavailable-cors-blocked-SIMULATED-{desktop,mobile}.png` |
| 12 | WebGL: no context | SIMULATED | WEBGL_UNAVAILABLE | yes (valid file) | `12-webgl-no-context-SIMULATED-{desktop,mobile}.png` |
| 13 | WebGL: throws | SIMULATED | WEBGL_UNAVAILABLE | yes (valid file) | `13-webgl-throws-SIMULATED-{desktop,mobile}.png` |
| 14 | WebGL: context lost | SIMULATED | WEBGL_CONTEXT_LOST | yes (valid file) | `14-webgl-context-lost-SIMULATED-{desktop,mobile}.png` |
| 15 | after replace | SYNTHETIC/MOCKED | ready | yes | `15-after-replace-SYNTHETIC-MOCKED-{desktop,mobile}.png` |
| 16 | job succeeded (rev 2 pack) | SIMULATED | ready | yes | `16-job-succeeded-SIMULATED-{desktop,mobile}.png` |
| 17 | job submission unknown | SIMULATED | SUBMISSION_UNKNOWN | no | `17-job-submission-unknown-SIMULATED-{desktop,mobile}.png` |
| 18 | FORBIDDEN (403 from /api/creative) | SIMULATED | FORBIDDEN | no | `18-forbidden-SIMULATED-{desktop,mobile}.png` |
| 19 | idle | SIMULATED | idle | no | `19-idle-SIMULATED-{desktop,mobile}.png` |

40 PNGs in total, plus `capture-results.json`, `imgdiff-desktop-vs-mobile.json` and this README.

## Review round 5 re-capture (only the affected shots)

**SIMULATED / SYNTHETIC-MOCKED, nothing LIVE, no provider called.** Re-captured with
`CAPTURE_ONLY=18:desktop,18:mobile,01:mobile node docs/m3/asset-viewer/demo/capture-host.mjs`
(only those entries in `capture-results.json` were replaced; every other shot and the imgdiff
file are unchanged from the v3 capture above). Same host page, Chromium/Playwright 1.62.1,
SwiftShader WebGL, 1440×900 and 390×844.

| file | label | what changed |
|---|---|---|
| `18-forbidden-SIMULATED-desktop.png`, `18-forbidden-SIMULATED-mobile.png` | SIMULATED | FORBIDDEN now reads only "This account doesn't have permission to open this 3D concept." (no sign-in sentence). Exactly **1** `[role=alert]` on the page (`alerts: 1`), `error.pageWide: true`; the host panel shows "error · FORBIDDEN · page-wide" as plain text (no second alert). No Try again, no Download, overflow 0 |
| `01-loaded-SYNTHETIC-MOCKED-mobile.png` | SYNTHETIC/MOCKED | 390 px loaded state after the 44 px tap-target / overflow pass: ready, Download offered, overflow 0, `alerts: 0`. Pixel-identical to the v3 capture (the host page already met 44×44; the demo pages `index.html` / `creative.html` were the ones fixed, asserted by e2e `F08`) |

The round 5 entries in `capture-results.json` also record `alerts` (count of `[role=alert]`) and
`error.pageWide`.
