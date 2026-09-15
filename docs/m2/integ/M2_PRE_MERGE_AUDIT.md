# Milestone M2 Pre-Merge Audit Block

**Status:** DRAFT — do not merge to main without BEK approval  
**Date:** 2026-09-15 (Asia/Dubai)  
**Auditor:** Integration (Grok Bot) on behalf of Bekzod Khalimov  
**Checkout:** `C:\Users\xalim\FurniAI-F1-Claude-Handoff`  
**Branch:** `integ/part-graph-compiler`  
**Tip SHA (verified):** `c46ba8376a380978588614021e3a512d37c9b8c7`  
**Parent production tip:** `bd0c97eabe85b6727a37c8ddbab00768595e64c3` (nesting + cut-list CSV)  
**Base lineage (F1 freeze):** `cb5f110627e1df589101f416fb34299ebb092bc0` on `integ/f1-claude-handoff` — **UNTOUCHED**  
**PR:** https://github.com/xalimovbeka99-commits/FurniAI/pull/6  
**PR base:** `integ/f1-claude-handoff` @ `cb5f110`  
**Do not:** merge to `main`, deploy production, or move `integ/f1-claude-handoff`.

---

## Tip contents confirmed

| Artifact | Present | Notes |
|---|---|---|
| `src/lib/production/dxfCompiler.js` | YES | Gated DXF CNC layer compiler (`68f1f0b`) |
| `src/lib/production/nestingCompiler.js` | YES | Nesting preflight + `generateCutListCsv` (`bd0c97e`) |
| AG 2D shop drawing / SVG (`src/lib/drawing/projectionEngine.js`) | YES | Elevation & plan SVG (`6220d24`); toolbar export + SVG text validation (`c46ba83`) |
| `DRAWER_*` emission + conversational wiring | YES | `emitDrawerBankParts.js`, wardrobe-ai drawerBank wiring, DRAWER_* roles |
| `system32Boring` gated | YES | `src/lib/partgraph/system32Boring.js` refuses `CNC_QUALIFIED`; DXF omits `DRILL_SYSTEM_32` unless approve + `CNC_QUALIFIED` |

Included commit spine (selected): `5d88337` drawer pack → `3373fb5` DRAWER_BANK conversational → `68f1f0b` DXF → `6220d24` SVG → `bd0c97e` nesting/CSV → `c46ba83` drawing export UX.

---

## Pass / fail matrix

### 1. Full Vitest (`npx vitest run`) — tip `c46ba83`

| Metric | Count |
|---|---|
| Test files | **1 failed** \| **88 passed** \| **1 skipped** (90) |
| Tests | **4 failed** \| **1116 passed** \| **4 skipped** \| **20 todo** (1144) |
| Duration | ~8.4s |

**Failures (4):** `src/lib/wardrobe-production-verification/phase2Verification.test.js` — Phase 1 protected-surface **hash pins** stale for:

- `src/lib/wardrobe-model/schema.js`
- `src/lib/wardrobe-model/kernel.js`
- `src/lib/wardrobe-model/validator.js`
- `src/lib/wardrobe-tools/tools.js`

These are expected M2 side-effects of WardrobeModel / tools evolution on the PartGraph path. **Not** production-geometry or CNC unlock failures. Residual: refresh Phase 1 hash fixture under BEK direction (do not silently retarget without approval).

### 2. Wardrobe-AI focused (`npx vitest run tests/wardrobe-ai/`)

| Result | Count |
|---|---|
| **PASS** | **138 passed** \| 4 skipped (live.eval) |
| Files | 12 passed \| 1 skipped |

Matches ~138 pass-class expectation.

### 3. Production focused (`npx vitest run tests/production/`)

| Result | Count |
|---|---|
| **PASS** | **22 passed** (dxfCompiler 10 + nestingCompiler 12) |

### 4. Blueprint SVG / AG drawing (`src/lib/drawing/projectionEngine.test.js`)

| Result | Count |
|---|---|
| **PASS** | **13 passed** (was ~12 pre-`c46ba83`; +1 text-coordinate validation) |

### 5. Playwright WebGL / browser

| Suite | Command | Result | Notes |
|---|---|---|---|
| R3F Builder WebGL | `npm run test:browser:r3f` | **7 passed** | Required `npm run build` (`.next` missing initially). Orbit/zoom/sliders/HDR-blocked survival OK. Run stamped on parent tip `bd0c97e` after production build; tip delta `c46ba83` is drawing-export only. |
| F1 customer journey | `npm run test:browser:f1` | **4 passed / 1 failed** | Fail: *Add drawers on the left applies DRAWER_BANK* — static-site assistant still refuses drawers (`can't add drawers… runner hardware…`). Vitest conversational DRAWER_BANK path is green; **legacy static F1 surface lags**. |

### 6. System 32 / CNC gate

| Assert | Result |
|---|---|
| `DRILL_SYSTEM_32` omitted without `CNC_QUALIFIED` | **PASS** (dxfCompiler fail-closed tests + smoke) |
| Golden PartGraph `qualificationStatus` | `WORKSHOP_REVIEW_NOT_CNC_QUALIFIED` |
| `compileSystem32Boring` vs CNC_QUALIFIED | Throws / refuse |
| DXF smoke any `DRILL_SYSTEM_32` layer | **false** |

**CNC / System32 status: BLOCKED** (by design; Gate G8 coupon not claimed).

### 7. Export triad smoke (Golden Wardrobe PartGraph)

| Export | Result | Detail |
|---|---|---|
| `compileCabinetDxfPackage` | **PASS** | 19 non-empty DXF panel entries |
| `generateCutListCsv` | **PASS** | 1416 chars; header + CARC_* rows |
| `generateShopDrawingsSVG` | **PASS** | 13912 chars; contains `<svg` |
| Multi-bay parametric | **PASS** (fixture-backed) | Golden Wardrobe = **2 bays** × 873 mm, 1 divider. Scenario fixture `tests/fixtures/02-wardrobe-multimodule.json` present (capability/config expect shape — not a second FurniSpec oracle). |

---

## Residuals / risks

1. **Phase 1 hash pins (4 vitest fails)** — protected-surface SHA fixture out of date after M2 WardrobeModel/tools changes. Needs deliberate BEK-approved pin refresh, not drive-by.
2. **F1 static-site DRAWER_BANK journey fail** — Playwright customer-path still gets hardware-refusal copy; Next/wardrobe-ai wiring + unit/evals pass. Risk: product surfaces diverge (static Builder vs conversational stack).
3. **Path A provisional physical limits** — `physicalLimitRegistry` / rule-authority remain provisional; do not treat as final factory law.
4. **Live provider** — `tests/wardrobe-ai/evals/live.eval.test.js` skipped (4); live Anthropic/OpenAI credential path **UNVERIFIED** in this audit.
5. **CNC never unlocked** — any future `CNC_QUALIFIED` invent would fail FurniSpec/PartGraph validators; keep it that way until Gate G8.
6. **Nesting is preflight** — cut-list/nesting manifest is not a machine-posting pack; workshop review still required.
7. **Tip moved during audit** — matrix browser run completed on `bd0c97e`; tip then advanced to `c46ba83` (drawing toolbar + SVG text validation). Vitest + export smoke re-confirmed on `c46ba83`.

---

## Explicit merge gate

> **DRAFT — do not merge to `main` without BEK approval.**  
> `integ/f1-claude-handoff` @ `cb5f110` must remain the PR base / F1 freeze.  
> This document updates PR #6 evidence only.

## Readiness verdict

**Ready for BEK review** with known residuals (hash pins + static F1 drawer journey).  
**Not** ready to merge to main. CNC remains **BLOCKED**.

---

## Reproduction (this machine)

```text
cd C:\Users\xalim\FurniAI-F1-Claude-Handoff
git fetch origin integ/part-graph-compiler
git reset --hard origin/integ/part-graph-compiler   # c46ba83
npx vitest run
npx vitest run tests/wardrobe-ai/
npx vitest run tests/production/
npx vitest run src/lib/drawing/projectionEngine.test.js
npm run build && npm run test:browser:r3f
npm run test:browser:f1
```
