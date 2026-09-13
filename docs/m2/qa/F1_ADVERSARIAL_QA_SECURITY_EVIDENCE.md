# F1 adversarial QA / security evidence (stop after F1)

**Date:** 2026-09-13 (Asia/Dubai)  
**Base SHA:** `b3288bfaf0b8e14ff0813078219c41dc7a701d8a`  
**Final engineering SHA:** `6d78e2601138ade33b32d26eadee9e0e8e3bb979` (relay harness + locks). Evidence/docs tip is the branch HEAD after this file lands.
**Branch:** `test/adversarial-qa-security-f1`  
**Checkout:** `C:\Users\xalim\FurniAI-F1-Candidate`  
**Scope:** F1 only. No F2. No merge. No deploy. `main` / production untouched.  
**Left alone:** FurniAI-Integration on `integ/ai-rails-viewer`; FurniAI-Grok untouched.

## 1–3) anthropicRelay

### Reproduction (pre-fix) — 10 consecutive `npx vitest run src/lib/ai-provider/anthropicRelay.test.js`

| Run | Status | Notes |
|---|---|---|
| 1–10 | FAIL | Both tests failed every run |

Failure signatures (stable):

1. Concurrency: `expected undefined to be 'req-0'` (response body missing markers).
2. Cleanup: `expected [ 'body.json', 'curl.cfg' ] to deeply equal []`.

### Classification

| Hypothesis | Verdict | Evidence |
|---|---|---|
| Genuine concurrency defect (fixed filenames) | **Already fixed in production at base** | `scripts/anthropic-relay.mjs` already uses per-request `body-${reqId}.json` / `curl-${reqId}.cfg` |
| Test-isolation defect | **Confirmed contributor** | Cleanup scanned *all* `fa-relay-*` under `%TEMP%`; stale dirs from older fixed-name runs still held `body.json` / `curl.cfg` |
| Environment-only (Windows harness) | **Confirmed primary blocker** | Test PATH-stubbed a Unix `curl` script with `:` separator; Node `execFile("curl")` on Windows ignores PATH `curl.cmd` and always launches `System32\curl.exe`, so the race harness never ran |

**Root-cause fix (no test weakening):**

- Expose `relay.dir`; cleanup asserts only that directory.
- Add `ANTHROPIC_RELAY_CURL_STUB` so tests invoke `node <stub>` via `execFile` (works on Windows + Unix without `shell:true`).
- Cross-platform Node stub with ~50ms busy-wait preserves the race window.

### Post-fix 10× table

| Run | Status |
|---|---|
| 1–10 | PASS |

## 4) Full clean suite

Command: `npx vitest run` on tip `6d78e26` → **994 passed**, 4 skipped, 20 todo, **0 failed** (78 files passed | 1 skipped). Physical / adversarial / security clusters green.

## 5) CI evidence

Existing `.github/workflows/ci.yml` previously triggered only on `main`. Extended triggers to include `test/adversarial-qa-security-f1` so the exact tip SHA receives GitHub Actions coverage after Integration fetch→push.

## 6–7) Dual-architecture enforcement matrix

Five limits traced on:

- **Path A:** wardrobe-model / wardrobe-tools (validator + kernel auto-stack + tool fail-closed)
- **Path B:** authoritative FurniSpec → PartGraph → customer-visible design

| Rule | Path A (wardrobe-model / tools) | Path B (FurniSpec → PartGraph → customer design) |
|---|---|---|
| 800mm hanging clearance | **ENFORCED** (`DEFAULTS.minHangingClearanceBelowMm`, `INSUFFICIENT_HANGING_CLEARANCE`) | **NOT ENFORCED** as this fail-closed gate — FurniSpec/PartGraph do not reject short hanging drops with that code |
| 300mm hanging interior depth | **ENFORCED** (`minHangingInteriorDepthMm`, `INSUFFICIENT_DEPTH_FOR_HANGING`) | **NOT ENFORCED** equivalently on FurniSpec validate / PartGraph build |
| 1200mm unsupported shelf span | **ENFORCED** (`maxUnsupportedShelfSpanMm`, `UNSUPPORTED_SHELF_SPAN`) | **NOT ENFORCED** equivalently on path B |
| 50mm max panel thickness | **ENFORCED** (`maxPanelThicknessMm`, `INVALID_DIMENSION` when >50) | **NOT ENFORCED** as the same envelope — FurniSpec checks positive deci-mm thickness, not a 50mm ceiling matching path A |
| 60mm shelf clearance | **ENFORCED** (`minShelfClearanceMm`, `INSUFFICIENT_SHELF_CLEARANCE`) | **NOT ENFORCED** equivalently on path B |

**Do not claim global FurniAI safety.** Path A fail-closed gates are wardrobe-model/tool scoped. Path B remains a separate authority for Golden / PartGraph customer designs and does **not** currently mirror these five gates.

### Additional verifications (evidence, not invented)

| Claim | Evidence |
|---|---|
| Previous valid design byte-identical after rejected ops | `tests/wardrobe-ai/adversarial.scenarios.test.js` (`byteSnapshot` / `JSON.stringify`); `tests/wardrobe-ai/failClosed.physicalRules.test.js` dedicated test |
| Golden Wardrobe 19 structural | `src/lib/partgraph/buildStructuralPartGraph.test.js` — “exactly 19 structural parts” |
| Preview rails separate | PartGraph emits `PREVIEW_ONLY` / `visualConcept` hanging-rail previews; not structural parts (`buildStructuralPartGraph.js`) |
| CNC NOT QUALIFIED | Golden fixture + PartGraph `qualificationStatus: WORKSHOP_REVIEW_NOT_CNC_QUALIFIED` |
| Drilling BLOCKED | Golden `machiningPolicy.drilling: BLOCKED_PENDING_HARDWARE_APPROVAL`; structural ops are `BACK_GROOVE` only |

## 8) Rule-approval table

No `docs/memory` BEKZOD approval records were found for these five security gates on this checkout or Integration docs tree. Therefore **none** are marked `BEKZOD_APPROVED`.

| Rule | Status |
|---|---|
| 800mm hanging clearance | **PROVISIONAL_PREVIEW_RULE** |
| 300mm hanging interior depth | **PROVISIONAL_PREVIEW_RULE** |
| 1200mm unsupported shelf span | **PROVISIONAL_PREVIEW_RULE** |
| 50mm max panel thickness | **PROVISIONAL_PREVIEW_RULE** |
| 60mm shelf clearance | **PROVISIONAL_PREVIEW_RULE** |

## 9) 12–50 mm docs mismatch

- Code: `panelThicknessMm > 0` and `<= 50` only — **no 12mm minimum**.
- Bekzod has not approved a 12mm floor in this thread / docs/memory.
- Fixture note in `tests/wardrobe-ai/fixtures/physical-boundary-scenarios.json` updated so it no longer claims a “12-50mm” floor.

## 10) UNSUPPORTED_FURNITURE_TYPE

**F1 deferral** with regression lock: `tests/wardrobe-ai/unsupportedFurnitureType.f1Deferral.test.js`.

Locked asymmetry:

- FSL: UNSUPPORTED only for types outside `FURNITURE_TYPES` enum.
- FurniSpec: UNSUPPORTED for non-wardrobe.
- Wardrobe tools: no furnitureType; unknown component → `INVALID_ARGUMENT`.

## Rollback

```bat
git checkout test/adversarial-qa-security-f1 && git reset --hard b3288bfaf0b8e14ff0813078219c41dc7a701d8a
```
