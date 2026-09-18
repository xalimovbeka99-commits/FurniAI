# Milestone M2 Full-Stack Verification Report — tip `c46ba83`

**Status:** READY FOR BEK REVIEW (not for main merge)  
**Date:** 2026-09-18 20:04 GST (Asia/Dubai, UTC+4)  
**Auditor:** FurniAI Principal Adversarial QA (Grok Bot executor)  
**machineId (declared):** `c37f1e43-b9f4-4f8d-a7ff-45c89dc31a5c`  
**Isolation:** detached soak worktree `/workspace/FurniAI-M2-Soak-c46ba83` (Linux box analogue of preferred `C:\Users\xalim\FurniAI-M2-Soak-c46ba83`)  
**Did NOT touch:** `FurniAI-F1-Claude-Handoff` PL-006 dirty tree, `integ/part-graph-compiler` tip advancement, AG OneDrive tree, fingerprint refresh, CNC unlock, main merge.

---

## SHA verified

| Item | Value |
|---|---|
| Soak HEAD | `c46ba8376a380978588614021e3a512d37c9b8c7` |
| Subject | `feat(drawing): add builder toolbar export action and SVG text coordinate validation` |
| Lineage | ancestor of `origin/integ/part-graph-compiler` (`c48e108` = docs audit on top of `c46ba83`) |
| Checkout mode | `git worktree add --detach` (no branch advance on compiler/lead) |

### Baselines intact (`git ls-remote origin`, post-soak)

| Ref | SHA | Status |
|---|---|---|
| `main` | `dc94bdae2449270e867037b1af2bdf90e9936801` | **UNTOUCHED** (matches required `dc94bda`) |
| `integ/f1-claude-handoff` | `cb5f110627e1df589101f416fb34299ebb092bc0` | **UNTOUCHED** (matches required `cb5f110`) |
| `integ/part-graph-compiler` | `c48e108ab779a5b4fe36c8600f1dac38376d74c0` | not advanced by this soak |
| `integ/m2-integration-lead` | `3fab34a70cbeed90c2480de355bf57a9457d4cfe` | not advanced by this soak |

---

## Vitest full — `npx vitest run`

| Metric | Count |
|---|---|
| Test files | **1 failed** \| **88 passed** \| **1 skipped** (90) |
| Tests | **4 failed** \| **1116 passed** \| **4 skipped** \| **20 todo** (1144) |
| Vitest Duration | **8.76s** (transform 2.21s, collect 12.12s, tests 5.21s, prepare 10.85s) |
| Wall clock | **~9.9s** |
| Exit code | 1 (expected — fingerprint pins only) |

### 4 fails (known / expected — do NOT refresh without BEK)

All in `src/lib/wardrobe-production-verification/phase2Verification.test.js` — Phase 1 protected-surface hash pins:

| Surface | Note |
|---|---|
| `src/lib/wardrobe-model/schema.js` | hash drift |
| `src/lib/wardrobe-model/kernel.js` | hash drift |
| `src/lib/wardrobe-model/validator.js` | hash drift |
| `src/lib/wardrobe-tools/tools.js` | hash drift |

**No fingerprint refresh performed.**

### Focused production / drawing suites

| Suite | Result | Duration |
|---|---|---|
| `tests/production/` + `projectionEngine.test.js` | **35 passed** (3 files) | vitest 837ms / wall ~1.8s |

---

## Demo / verify scripts

| Script | Exit | Result | Wall |
|---|---|---|---|
| `npm run verify:production` | 0 | **PASS** — live `https://furniai-topaz.vercel.app` canvas/WebGL non-blank (`nonBlankFraction≈0.755`, `partCount=49`, THREE r128, no Next assets) | ~18.0s |
| `npm run demo:golden-wardrobe` | 0 | **G2.1 VERDICT: PASS** — CNC Qualified: NO; Hardware Drilling: BLOCKED | ~0.6s |
| `npm run demo:golden-partgraph` | 0 | **G2.2 VERDICT: PASS** — 19 structural parts; Hardware drilling BLOCKED; CNC qualified: NO | ~0.6s |
| `npm run demo:parametric-partgraph` | 0 | **G2.2-R1 VERDICT: PASS** — Golden/Narrow/Wide/Height all Determinism/Bounds/Closure PASS; CNC NO across all | ~0.6s |

Parametric script **exists** (`scripts/demo-parametric-partgraph.mjs`).

---

## Artifact smoke matrix

### A) Golden Wardrobe — **PASS**

| Artifact | Result |
|---|---|
| `compileCabinetDxfPackage` | **19/19** non-empty DXF; R12/SECTION present; **all OUTLINE_CONTOUR closed** (first==last) |
| `generateShopDrawingsSVG` | **13912** chars; `<svg` + `viewBox` + dimension `<text>`; **no NaN/undefined** |
| `generateCutListCsv` | **1416** chars; **19** data rows = panel count; columns match `CUT_LIST_CSV_COLUMNS` |
| `compileNestingManifest` | **sheetCount=5**, **yieldEfficiencyPct=57.11%**, stock `SHEET_2800x2070`; **0 overlapping AABB** on sheets |
| `DRILL_SYSTEM_32` | **omitted** default; still omitted with `approveSystem32Drilling:true` alone (needs `CNC_QUALIFIED`) |
| Qualification | `WORKSHOP_REVIEW_NOT_CNC_QUALIFIED` |

### B) Parametric fixtures — **PASS with known residual**

| Fixture | Panels | DXF closed | SVG valid | CSV rows | Nesting | Drill gate |
|---|---|---|---|---|---|---|
| Narrow | 12 | PASS | PASS (12386 chars) | 12 | **4 sheets**, yield **71.11%**, 0 overlaps (`SHEET_2440x1220`) | BLOCKED |
| Height (2100mm) | 18 | PASS | PASS (13701 chars) | 18 | **4 sheets**, yield **62.5%**, 0 overlaps (`SHEET_2800x2070`) | BLOCKED |
| Wide (3-bay) | 23 | PASS | PASS (14780 chars) | 23 | **FAIL-CLOSED** — `BACK_PANEL_01` grain=LENGTH does not fit usable 2770×2040 on `SHEET_2800x2070` | BLOCKED |

Wide nesting fail-closed matches prior M2 pre-merge audit residual (product rule needed: grain override / split back / larger stock). Export triad otherwise healthy.

---

## Hardware / CAM gate

**System32 `DRILL_SYSTEM_32` BLOCKED without `CNC_QUALIFIED` — CONFIRMED.**

- Default compile: no drill layer on golden / parametric packages.
- `approveSystem32Drilling: true` alone: still no drill layer while qualification remains `WORKSHOP_REVIEW_NOT_CNC_QUALIFIED`.
- Vitest `dxfCompiler` gate suite covered inside the 35 focused production/drawing passes.
- Golden + parametric demos report Hardware drilling BLOCKED / CNC Qualified: NO.
- **No CNC unlock performed.**

---

## Isolation / non-goals confirmed

- Did **not** use or reset the active PL-006 handoff working tree (`/workspace/FurniAI-F1-Claude-Handoff` remains dirty on `integ/m2-integration-lead` @ `e47c205`, ahead of origin — left alone).
- Did **not** push/reset `integ/part-graph-compiler`.
- Did **not** touch AG OneDrive tree.
- Did **not** merge to `main`, refresh fingerprints, or unlock CNC.

---

## Pre-merge recommendation

**Ready for BEK review** on unified tip `c46ba83`.

**Not** ready to merge to `main`. Keep CNC blocked. Keep baselines `main=dc94bda` and `integ/f1-claude-handoff=cb5f110`.

Known residuals (carry-forward, not soak regressions):

1. 4 Phase-1 hash-pin vitest fails — refresh only with BEK approval.  
2. Wide 3-bay nesting fail-closed on oversized LENGTH-grain back panel.  
3. Nesting/DXF/SVG remain workshop/preflight artifacts — not machine-posting packs.  
4. Live AI provider credential path still unverified (evals skipped/todo as before).

---

## Reproduction (soak)

```text
# from FurniAI clone (do NOT reset Claude-Handoff PL-006 tree)
git worktree add --detach /path/to/FurniAI-M2-Soak-c46ba83 c46ba8376a380978588614021e3a512d37c9b8c7
cd /path/to/FurniAI-M2-Soak-c46ba83
npm ci
npx vitest run
npm run verify:production
npm run demo:golden-wardrobe
npm run demo:golden-partgraph
npm run demo:parametric-partgraph
git ls-remote origin refs/heads/main refs/heads/integ/f1-claude-handoff
```
