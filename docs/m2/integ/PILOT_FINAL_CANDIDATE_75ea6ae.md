# Pilot final candidate — acceptance close

## Final SHA
`75ea6ae0f002afd5c220e5877ccf14b697a56284`

## Ancestry
- Baseline: `60ba875` (v0.2.0-m2)
- Bundle tip: `796e96b` (`candidate/pilot-live-brain-combined`)
  - includes AG `3987db6`, Claude old series ending `2bb9cc8`, verifier export suite, static rebuild
- + missing Claude `223094e` files only (range-diff: adapter commits equivalent; contract doc + `frontendContract.test.js` missing)
- + blocker closes (this tip)

Branch: `integ/pilot-final-candidate`
No main merge.

## Range-diff (Claude 2bb9cc8 series vs 223094e series)
| Old | New | Note |
|---|---|---|
| b43e4cd | = 9615f09 | adapter defect repro |
| ff95b1c | = c72551c | adapter fix + doors-per-bay |
| 2bb9cc8 | replaced by 223094e | docs-only → docs+test contract reconcile |

## Before / after blockers
| # | Blocker | Before (796e96b) | After (75ea6ae) |
|---|---|---|---|
| 1 | Stale guard wrong type | Silently disabled | Fail-closed STALE_REVISION |
| 2 | Provider guess | anthropic special-case | `ai` / stated provider only |
| 3 | Finish canonical chain | Swatch + revision only | commitMaterialUpdate → FurniSpec + fingerprint + PartGraph finish intent |
| 4 | Undo finish | AG Undo path present | Restores prior snapshot incl. proposal fingerprint |
| 5 | Rejected unchanged | Contract + AG tests | Preserved |
| 6 | Shop Drawings PDF | Label said PDF | **Browser print preview** (`window.print`); UI: Print / Save as PDF |
| 7 | Doors-per-bay | BEKZOD_RULING | **PROVISIONAL_PENDING_BEKZOD** |
| 8 | Suites | Partial | Unit 1219; validator 21; golden PASS; production verify PASS |

## Evidence classes (this tip)
| Class | Status |
|---|---|
| DETERMINISTIC | 1219 passed (vitest) |
| SIMULATED HTTP | frontendContract + transport stubs green |
| MOCKED / BROWSER | Playwright in progress / DemoTester assigned |
| LIVE ANTHROPIC | **NOT RUN** — credential step remains |
| WORKSHOP | golden + production verify PASS; CNC still blocked |

`verify-live-designer` = SIMULATED, not LIVE.

## LIVE TEST READY?
**NOT READY** — Anthropic runtime key not confirmed for `/api/design/propose`.

## Remaining blockers (one owner)
1. **LIVE Anthropic credential** — Bekzod / ops: set key on Vercel or local propose runtime, then one labelled LIVE journey.
2. **Doors-per-bay exact values** — Bekzod: approve or revise PROVISIONAL numbers.
3. **Browser matrix sign-off** — DemoTester (desktop+390 journey on 75ea6ae).
4. **Independent finish/export matrix** — Verifier (no production fixes).
