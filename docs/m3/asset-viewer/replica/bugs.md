# Bugs: FurniAI generated-asset viewer (v3)

Format and severities from the replica-test skill (read directly from
`/workspace/scenario-review/skills/replica-test/bug-report.md` and `SKILL.md`):
S1 = data loss, security, or the core flow is blocked; S2 = a feature is broken with no
workaround; S3 = a workaround exists or something is visibly wrong; S4 = cosmetic.

Only **reproduced** bugs are listed. Things not reproduced or not testable here are in
"To check" below. Every bug was fixed test-first (a failing test, then the fix).

**Open bugs: none. Open S1: none. Open S2: none.**

| severity | count | open |
|---|---|---|
| S1 | 1 | 0 |
| S2 | 1 | 0 |
| S3 | 3 | 0 |
| S4 | 0 | 0 |

### BUG-001: a texture whose image is missing makes the whole model fail to load

- Severity: S2 (texture degradation is criterion 1; the model was lost entirely, no workaround)
- Flow / case: F01 / F01-E1
- Screen: viewer, `host.html?state=texture-missing`
- Build: v3 WIP before `fa97785`  Browser / device: Chromium (Playwright 1.62.1), 1440px and 390px; also vitest with three 0.166.1

Steps
1. Open `host.html?state=texture-missing` (QE fixture `missing-texture.glb`: a texture points at an image index that doesn't exist).
2. Wait for the viewer.

Expected: the mesh is shown untextured, with an honest note, and Download is offered.
Actual: the load failed with `PARSE_FAILED` (GLTFLoader threw a `TypeError` reading the missing image), so nothing was shown.
Evidence: failing test `textures.test.js` "missing-texture: the mesh still shows; TEXTURES_NOT_LOADED + a visible honest note (role=note); download still offered"; evidence `03-texture-missing-SYNTHETIC-MOCKED-*.png` after the fix.
Suspected cause: GLTFLoader `loadTexture` dereferences `json.images[texture.source]` without a guard.
Status: fixed in `fa97785` (GLTFLoader plugin `FURNI_skip_missing_images` in `adapters/gltf.js` resolves such a texture to `null`; verified in vitest and with the r128 global loaders in the browser).

### BUG-002: a blocked cross-origin download said "check your connection"

- Severity: S3 (the message is visibly wrong; Try again still worked)
- Flow / case: F04 / F04-E1
- Screen: viewer, `host.html?state=unavailable&http=cors`
- Build: v3 WIP before `fa97785`  Browser / device: Chromium, 1440px and 390px

Steps
1. Open `host.html?state=unavailable&http=cors` (the model is on a second origin that sends no CORS header).
2. Read the alert.

Expected: a message that doesn't blame the user's connection, since the browser can't tell a CORS refusal from a dropped connection.
Actual: "Check your connection" (reason `network`).
Evidence: first-run evidence `11b-unavailable-cors-blocked-SIMULATED-*.png` (replaced by the re-capture); failing test `errors.test.js` "BUG-002: a transport error on a CROSS-ORIGIN link may be a CORS refusal -> reason 'cross-origin', never just 'check your connection'".
Suspected cause: every transport `TypeError` was mapped to `network`.
Status: fixed in `fa97785` (reason `cross-origin` when the URL's origin differs from the page's, message names both causes; same-origin and offline unchanged).

### BUG-003: viewer crashed on mount (temporal dead zone)

- Severity: S1 (core flow blocked: nothing could mount)
- Flow / case: F01 / F01-H1
- Build: v3 WIP, never committed  Browser / device: vitest and Chromium

Steps
1. Mount the viewer with the WIP build.

Expected: the viewer mounts.
Actual: `ReferenceError: Cannot access 'detached' before initialization`.
Evidence: the whole asset suite failed at mount; caught before any commit.
Status: fixed before the first commit; shipped in `fa97785` (`detached` is a function declaration, hoisted).

### BUG-004: core bundle over the 48 KiB minified limit

- Severity: S3 (a release gate failed: `noBundledThree.test.js`; no user-visible break)
- Flow / case: build
- Build: v3 WIP, never committed

Steps
1. `npx vitest run --config tests/assetViewer/vitest.config.js tests/assetViewer/noBundledThree.test.js`

Expected: minified core ≤ 49,152 bytes.
Actual: 51,681 bytes.
Status: fixed before the first commit; shipped in `fa97785` (the optional Scenario adapter split into `entry.creative.js`, `/* @__PURE__ */` annotations, trimming). Now 48,884 bytes.

### BUG-005: dead links (404 / 410) told the user to check their connection

- Severity: S3 (visibly wrong advice; the user could still do nothing useful either way)
- Flow / case: F04 / F04-N1, F04-N2
- Build: v3 WIP (inherited from v2.1), never committed

Steps
1. Open `host.html?state=unavailable&http=404` (or `410`).

Expected: "the file wasn't found or has been removed", and no pointless Try again.
Actual: the generic FETCH_FAILED "check your connection" text.
Evidence: `errors.test.js` reason cases (`gone`, `denied`, `server`, `offline`, `network`).
Status: fixed in `fa97785` (reason-specific `FETCH_FAILED_MESSAGE`).

## To check (not reproduced or not testable on this box)

- Real three r128 `examples/js` loaders: the repo has no three@0.128 examples; the demo uses
  three-stdlib 2.36.1 loaders rewired to `window.THREE` with r128 shims.
- Real-device touch and pinch (the e2e uses CDP touch emulation on the mobile project).
- A real screen reader (VoiceOver, TalkBack, NVDA): only axe and role checks ran.
- Safari and Firefox: only Chromium ran.
- WebGL context restore in a real browser (simulated with `WEBGL_lose_context` only).
- Very large files and slow-network timeouts beyond the 600 s stalled route.
- FORBIDDEN wording: says "this 3D concept", but a 403 is page-wide (ASSET_VIEWER.md §16); copy owner to decide.
- The concept gallery (`src/lib/projects/conceptGallery/mountConceptGallery.js` ~L352–354, not
  module-owned) still retries Download once silently, against the new autoRetry default.
- An untextured white model is faint on the light background (e.g. `01-loaded-*`): possibly S4.
