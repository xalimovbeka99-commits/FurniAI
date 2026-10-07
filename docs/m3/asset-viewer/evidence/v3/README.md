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
