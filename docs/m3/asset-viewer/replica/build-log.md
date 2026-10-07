# Build log: FurniAI generated-asset viewer (v3)

Method: replica-build, read directly from `/workspace/scenario-review/skills/replica-build/SKILL.md`
(not via catalog discovery). There is no "original app" to clone here: the "recon map" is the
task brief (acceptance criteria 1–6, contract rev 2, team follow-ups), and `features.csv` is the
matrix (the `original` column = required by the brief). Every line of code was written in this
module; three.js is injected, never bundled.

Base `f472aef` (contract rev 2). Commits: `fa97785` viewer + unit tests, `523ffd9` demo host +
e2e, then docs/evidence/replica. Evidence is SYNTHETIC/MOCKED or SIMULATED; nothing is LIVE.

| ID | date | status | what is missing | harder than expected |
|---|---|---|---|---|
| shell: `mount(containerEl, { THREE, ...opts })` + demo host page | 2026-10-07 | done | – | the repo has no three r128 `examples/js`; loaders are three-stdlib rewired to `window.THREE` with r128 shims (`demo/r128-compat.mjs`) |
| S-loaded (01) | 2026-10-07 | done | – | – |
| S-textured (02) | 2026-10-07 | done | – | the test DOM needed a strict `createImageBitmap` shim to prove decoding |
| S-texture-missing (03) | 2026-10-07 | done | – | GLTFLoader threw on a missing image (BUG-001); needed a loader plugin |
| S-loading (04) | 2026-10-07 | done | – | – |
| S-invalid ×4 (05–08) | 2026-10-07 | done | – | – |
| S-unavailable 404/410/403 (09–11) | 2026-10-07 | done | – | reason-specific messages (BUG-005) |
| S-unavailable CORS (11b) | 2026-10-07 | done | a browser can't tell CORS from offline; only a same-origin proxy removes the ambiguity (open question 17) | BUG-002 |
| S-WebGL none / throws / lost (12–14) | 2026-10-07 | done | real context restore not tested | download of a valid file while WebGL is down |
| S-replace (15) | 2026-10-07 | done | – | proving release needed an allocation ledger in vitest and draw counters in e2e |
| S-job succeeded / submission unknown (16–17) | 2026-10-07 | done | – | – |
| S-FORBIDDEN (18) | 2026-10-07 | done | wording left to the copy owner | establishing from the backend code that a 403 is never per job (ASSET_VIEWER.md §16) |
| S-idle (19) | 2026-10-07 | done | – | – |
| autoRetry (default false) | 2026-10-07 | done | the gallery's own silent Download retry is outside this module (open question 15) | v2.1 tests had to opt in to `autoRetry:true` |
| view controls: orbit/zoom/fit/reset, keyboard, touch, resize | 2026-10-07 | done | real-device touch | keeping zoom ratio and direction across resize |
| dispose: host, pagehide, AbortSignal, detached root | 2026-10-07 | done | – | a TDZ crash in the WIP (BUG-003) |
| bundles ≤ 48 KiB minified | 2026-10-07 | done | 268 bytes of headroom left | the core went over the limit (BUG-004); fixed by splitting the optional Scenario adapter |

Definition of done per state: every state at 390 px and 1440 px (all `overflowX` 0 in
`evidence/v3/capture-results.json`), keyboard reachable with visible focus (e2e F02-E1), no console
errors (e2e guard fixture), axe clean, features.csv updated (parity.py: 100, 27 of 27 musts),
screenshot saved (`evidence/v3/`).
