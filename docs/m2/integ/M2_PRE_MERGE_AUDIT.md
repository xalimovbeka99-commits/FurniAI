# Milestone M2 Pre-Merge Audit Block

**Status:** DRAFT — do not merge to main without BEK approval  
**Date:** 2026-09-15 / 2026-09-16 (Asia/Dubai)  
**Auditor:** Integration (Grok Bot) for Bekzod Khalimov  
**Checkout:** `C:\Users\xalim\FurniAI-F1-Claude-Handoff`  
**Branch:** `integ/part-graph-compiler`  
**Unified tip SHA (LIVE on origin / PR #6):** `c46ba8376a380978588614021e3a512d37c9b8c7`  
**This audit commit:** lands *on top of* `c46ba83` (docs only)  
**PR:** https://github.com/xalimovbeka99-commits/FurniAI/pull/6  
**PR base:** `integ/f1-claude-handoff`  

### Baselines intact (verified)

| Ref | SHA | Status |
|---|---|---|
| `main` | `dc94bdae2449270e867037b1af2bdf90e9936801` | **UNTOUCHED** |
| `integ/f1-claude-handoff` | `cb5f110627e1df589101f416fb34299ebb092bc0` | **UNTOUCHED** |
| Unified compiler tip | `c46ba83` | LIVE on origin |

**Do not:** merge to `main`, deploy production, or move `integ/f1-claude-handoff`.

---

## M2 ship list (present on tip)

| Item | Path / commit | Status |
|---|---|---|
| Gated DXF CNC layer compiler | `src/lib/production/dxfCompiler.js` (`68f1f0b`) | SHIPPED |
| Nesting preflight + cut-list CSV | `src/lib/production/nestingCompiler.js` (`bd0c97e`) | SHIPPED |
| AG 2D SVG shop drawings | `src/lib/drawing/projectionEngine.js` (`6220d24`) | SHIPPED |
| Builder toolbar SVG export + text coord validation | `c46ba83` | SHIPPED |
| `DRAWER_*` pack emission | `emitDrawerBankParts.js` | SHIPPED |
| Conversational DRAWER_BANK wiring | wardrobe-ai / pipeline | SHIPPED (vitest); static F1 surface lags |
| `system32Boring` fail-closed | `system32Boring.js` + DXF gate | SHIPPED / **CNC BLOCKED** |

---

## Pass / fail matrix (tip lineage `c46ba83`)

### Vitest full — `npx vitest run`

| Metric | Count |
|---|---|
| Test files | **1 failed** \| **88 passed** \| **1 skipped** (90) |
| Tests | **4 failed** \| **1116 passed** \| **4 skipped** \| **20 todo** (1144) |

**4 fails:** Phase 1 protected-surface **hash pins** in `phase2Verification.test.js` (`wardrobe-model/{schema,kernel,validator}.js`, `wardrobe-tools/tools.js`). Expected M2 side-effect — refresh pins only with BEK approval.

### Focused suites

| Suite | Result |
|---|---|
| `tests/wardrobe-ai/` | **138 passed** \| 4 skipped (live.eval) |
| `tests/production/` | **22 passed** |
| `src/lib/drawing/projectionEngine.test.js` | **13 passed** |

### Scripts

| Script | Result |
|---|---|
| `npm run verify:production` | **PASS** — canvas/WebGL non-blank (`nonBlankFraction≈0.76`, partCount=49) vs live Vercel origin |
| `npm run demo:golden-wardrobe` | **G2.1 VERDICT: PASS** — CNC NO; Hardware Drilling BLOCKED |
| `npm run demo:golden-partgraph` | **G2.2 VERDICT: PASS** — 19 structural parts; Hardware drilling BLOCKED; CNC qualified: NO |

### Playwright

| Suite | Result | Notes |
|---|---|---|
| `npm run test:browser:r3f` | **7 passed** | Required `npm run build` first |
| `npm run test:browser:f1` | **4 passed / 1 failed** | Fail: static-site *Add drawers* still refuses (hardware copy). Vitest DRAWER_BANK path is green |

---

## E2E export triad + nesting smoke

### A) Golden Wardrobe PartGraph — **PASS**

| Artifact | Result |
|---|---|
| `compileCabinetDxfPackage` | 19 non-empty panels; **AC1009 R12** header present |
| `generateShopDrawingsSVG` | 13912 chars; `<svg` + **viewBox** + **dimension `<text>`** |
| `generateCutListCsv` | 1416 chars; columns match `CUT_LIST_CSV_COLUMNS` |
| `compileNestingManifest` | **sheetCount=5**, **yield=57.11%** on `SHEET_2800x2070` |
| `DRILL_SYSTEM_32` | **omitted** (`anyDrillSystem32=false`) |
| Qualification | `WORKSHOP_REVIEW_NOT_CNC_QUALIFIED` |

### B) 3-bay parametric + DRAWER_BANK (3 rows) — **PARTIAL PASS**

Built via `wardrobe_create(2400×2400×600)` → `section_add` → `component_add DRAWER_BANK`.

| Artifact | Result |
|---|---|
| Structure | **3 bays**, **15 DRAWER_*** parts (`FRONT/SIDE_L/SIDE_R/BACK/BOTTOM`) |
| DXF package | **32** non-empty R12 panels; no `DRILL_SYSTEM_32` |
| SVG | 17080 chars; viewBox + dim text |
| CSV | 2489 chars; columns OK |
| Nesting | **FAIL** — `BACK_PANEL_01` grain=LENGTH does not fit usable area on either stock family |

**Residual:** wide carcass back panels can exceed nesting stock under LENGTH grain — nesting preflight correctly fail-closes; needs BEK product rule (grain override / split back / larger stock).

---

## CNC / System32

**BLOCKED** (by design).

- DXF omits `DRILL_SYSTEM_32` unless `approveSystem32Drilling === true` **and** `qualificationStatus === "CNC_QUALIFIED"`.
- `compileSystem32Boring` refuses CNC_QUALIFIED graphs.
- FurniSpec / PartGraph validators forbid inventing `CNC_QUALIFIED`.
- Golden demos report Hardware drilling BLOCKED / CNC Qualified: NO.

---

## Residuals / risks

1. Phase 1 hash-pin vitest fails (4) — pin refresh under BEK only.  
2. Static F1 Playwright drawer journey fails while conversational vitest path passes — surface divergence.  
3. 3-bay nesting fail-closed on oversized LENGTH-grain back panel.  
4. Path A provisional physical limits (`physicalLimitRegistry`) — not final factory law.  
5. Live provider evals skipped — credential path UNVERIFIED.  
6. Nesting/DXF/SVG are **preflight / workshop** artifacts — not machine-posting packs.

---

## Explicit merge gate

> **DRAFT — do not merge to `main` without BEK approval.**  
> Keep `integ/f1-claude-handoff` @ `cb5f110` as PR base / F1 freeze.  
> This doc updates PR #6 only.

## Readiness verdict

**Ready for BEK review** on unified tip `c46ba83` with known residuals (hash pins, static F1 drawers, 3-bay nesting back-panel fit).  
**Not** ready to merge to main. **CNC remains BLOCKED.** Baselines `main=dc94bda` and `f1=cb5f110` intact.

---

## Reproduction

```text
cd C:\Users\xalim\FurniAI-F1-Claude-Handoff
git fetch origin integ/part-graph-compiler
git reset --hard origin/integ/part-graph-compiler
npx vitest run
npm run verify:production
npm run demo:golden-wardrobe
npm run demo:golden-partgraph
npm run build && npm run test:browser:r3f
npm run test:browser:f1
```
