# Milestone M2 — Final Sign-Off Dossier

**Branch:** `integ/m2-integration-lead`  
**Unified tip:** `893ad0ed49fe5c3831c9ca9c8c145342224858d2`  
**PR #6 baseline HEAD:** `c48e108ab779a5b4fe36c8600f1dac38376d74c0` (`integ/part-graph-compiler`)  
**PR #6 target:** `integ/f1-claude-handoff` @ `cb5f110627e1df589101f416fb34299ebb092bc0`  
**Main checkpoint (untouched):** `dc94bdae2449270e867037b1af2bdf90e9936801`  
**Date:** 2026-09-18 (Asia/Dubai)  
**Author role:** Lead Systems Architect & CAM Compiler Engineer (Grok Bot / CraZy)

---

## 1. Executive Summary

Tip `893ad0e` is the first **fully green** unified state on `integ/m2-integration-lead`:

| Metric | Result |
|---|---|
| Vitest | **1194 passed / 0 failed** (4 skipped, 20 todo; 98 files) |
| Protected surface pins | Refreshed & green (Bekzod-authorized) |
| Golden demos | PASS (wardrobe / partgraph / parametric) |
| System 32 CNC | **BLOCKED** (`WORKSHOP_REVIEW_NOT_CNC_QUALIFIED`) |
| Main / F1 baselines | Untouched |

**Recommendation:** Authorize fast-forward of `integ/part-graph-compiler` (PR #6) from `c48e108` → `893ad0e`. Ancestry is a pure fast-forward (no unique commits on PR #6 tip beyond `c48e108`).

---

## 2. Commit Lineage (`c48e108` → `893ad0e`)

**21 commits** ahead of PR #6 HEAD. Chronological (oldest → newest):

```
fbfd7a7 docs(m2): baseline change package + PL-006 boundary on c48e108
30b2fe9 fix(ui): resolve boot script escape, dropdown stacking and nesting modal DOM placement
bdafb42 docs(m2): document PL-006 drawer back reproduction and Claude handoff pack
653b87e integ(m2): merge AG fix/mfg-boot-crash tip onto integration-lead baseline
c51af19 test(browser): add mobile viewport regression for manufacturing menu and nesting modal
3fab34a docs(m2): fingerprint 6/5 inventory + exporter invalid PartGraph matrix
ba60fee integ(m2): reconcile integration-lead baseline and checklists with mobile browser regression test
e47c205 test(production): add permanent invalid PartGraph rejection suite and update Claude PL-006 handoff
927c071 fix(pl006): fail-close degenerate drawer geometry at source, boundary and SVG
183b347 docs(m3): CAM post-processor spec and part-graph lineage audit
4dcc96e integ(m2): reconcile Claude PL-006 927c071 + keep emitDrawerBankParts
ba9e675 / c85aa70 / 7f88e72 docs(m2): baseline package stamps
6da4d67 feat(production): multi-material nesting runs + oversized panel split policy
a2365c1 fix(production): ship DRAWER_BOTTOM as HDF_WHITE_6 at 6mm
3dae10e feat(ui): harmonize 2D blueprint title block legend and render multi-run nesting batches
5c5d55f integ(m2): merge review/claude-reconcile (183b347) onto 3dae10e
5d77e82 fix(drawing): drop duplicate assertRenderablePartGraph after Claude merge
ebbe622 feat(ui): display material runs with edge banding and harmonize blueprint schedule
893ad0e chore(qa): refresh protected surface hashes and add adversarial nesting edge cases
```

### Diff volume

`git diff --stat c48e108..893ad0e` → **51 files, +4544 / −99**.

Major product deltas vs PR #6 HEAD:

| Area | What landed |
|---|---|
| PL-006 | Exclusive bay-width gate; `DEGENERATE_DRAWER_GEOMETRY`; SVG fail-closed |
| Drawer compiler | `emitDrawerBankParts` authoritative; bottoms `HDF_WHITE_6` / 6 mm |
| Nesting / CAM | Per-(material, thickness) FFDH runs; `PANEL_EXCEEDS_SHEET_ENVELOPE`; `UNROUTED_MATERIAL_ERROR` |
| UI | AG boot/menu/modal fixes; multi-run ExportMenu + edge banding display |
| Pins | Phase-1 + frozen surface hashes refreshed with justification |
| Docs | Baseline package, PL-006 boundary, M3 CAM/lineage specs |

---

## 3. Verification Matrix

| Class | Evidence on `893ad0e` | Result |
|---|---|---|
| Unit / full Vitest | `npx vitest run` | **1194 passed, 0 failed**, 4 skipped, 20 todo |
| Protected pins | `phase2Verification` + `frozenSurfaces` | **21 passed** (pins refreshed) |
| Production compilers | `tests/production/` (9 files) | **69 passed** (incl. adversarial nesting 6) |
| Part-graph / PL-006 | `src/lib/partgraph/` + `tests/part-graph/` | **75 + 46 passed** (prior focused runs) |
| Adversarial nesting | `adversarialNesting.test.js` | Unrouted material fail-closed; grain rotation rules |
| Invalid PartGraph exporters | SVG/DXF/CSV/nesting refuse | Permanent suites green |
| Kernel demos | `demo:golden-wardrobe`, `demo:golden-partgraph`, `demo:parametric-partgraph` | **PASS** / G2.1 & G2.2 PASS |
| Browser (prior on lead) | F1 5/5, R3F 7/7, mfg nesting + mobile | Recorded on integration lead; re-run after FF recommended |
| Live AI provider | — | **Not claimed** |

### Programmatic artifact & safety re-check (2026-09-18, tip `893ad0e`)

Golden Wardrobe PartGraph (`partCount = 19`):

| Check | Result |
|---|---|
| DXF package files | 19 / 19 |
| OUTLINE_CONTOUR closed loops | **19 closed, 0 open** |
| `DRILL_SYSTEM_32` layers in DXF | **0** (suppressed) |
| System32 plan | `qualificationStatus: WORKSHOP_REVIEW_NOT_CNC_QUALIFIED`; **0 approved / 3 blocked**; `machineOutput` & `toolPath` null |
| Valid SVG shop drawing | Non-empty SVG with `viewBox` (14184 chars) |
| Degenerate PartGraph → SVG | **Fail-closed** (`INVALID_FINISHED_DIMENSION` / `INVALID_RAW_DIMENSION`) |
| CSV cut-list rows | **19** data rows; columns match contract |
| Nesting material runs | `MEL_WHITE_18|18` (6 sheets, 70.03% yield) + `HDF_WHITE_6|6` (1 sheet, 69.74% yield) — **no mixed sheets** |
| Usable raw sheet envelope | **`2770 × 2040` mm** (`MAX_USABLE_SHEET_*`) |

---

## 4. Rule Provenance Confirmation

| Claim | Status |
|---|---|
| Drawer / System32 catalog values | From `wardrobeRuleCatalog` / Bekzod rulings already promoted on M2 path — **not invented in this tip** |
| `minDrawerBayClearWidthMm = 51` | **Arithmetic construction floor** (21 + 15 + 15); exclusive gate; **not** labelled BEKZOD_APPROVED usable drawer width |
| Material codes nested | Catalog / golden fixture codes only (`MEL_WHITE_18`, `HDF_WHITE_6`, …); unknown codes → `UNROUTED_MATERIAL_ERROR` |
| CNC drilling | Remains **blocked** unless explicit `CNC_QUALIFIED` (refused by boring compiler) |
| Authoritative drawer emitter | `emitDrawerBankParts.js` (Claude `drawerPack.js` not dual-sourced) |

**Zero invented furniture rules** in the pin-refresh / adversarial nesting work: CAM fail-closed and pin documentation only.

---

## 5. Standing CAM & Physical Boundaries

| Boundary | Enforcement |
|---|---|
| System 32 boring → machine output | `BLOCKED_PENDING_HARDWARE_APPROVAL`; null `machineOutput` / `toolPath` |
| DXF `DRILL_SYSTEM_32` | Omitted unless explicitly CNC-qualified |
| Sheet envelope | Reject / split policy at **2770 × 2040 mm** usable |
| Multi-material | Independent FFDH per `(materialCode, thicknessMm)` |
| Unrouted material | `UNROUTED_MATERIAL_ERROR` — no default / UNKNOWN bucket |
| Grain | `LENGTHWISE` / birch: no 90° rotation; `NONE` / melamine: may rotate |
| Drawer bottoms | `HDF_WHITE_6` @ 6.0 mm (not 18 mm carcass stock) |
| PL-006 | Reject W ≤ 51 at customer commit; exporters refuse zero/negative geometry |

---

## 6. PR #6 Fast-Forward Readiness

**Facts:**

- `origin/integ/part-graph-compiler` = `c48e108`
- `origin/integ/m2-integration-lead` = `893ad0e`
- `git log 893ad0e..c48e108` is **empty** → PR tip has no commits missing from the lead
- `c48e108` is an ancestor of `893ad0e` → **pure fast-forward**

### Recommended command sequence (do **not** merge to `main`)

```bash
# From a clean clone / Integration worktree
git fetch origin
git checkout integ/part-graph-compiler
git merge --ff-only origin/integ/m2-integration-lead
# Expect: Fast-forward c48e108..893ad0e

git push origin integ/part-graph-compiler
# PR #6 updates to tip 893ad0e without a merge commit
```

Equivalent single-ref update:

```bash
git push origin 893ad0e:integ/part-graph-compiler
```

### Post-FF checklist

1. Confirm PR #6 HEAD SHA = `893ad0e`
2. Confirm CI green (pins + full Vitest)
3. Confirm preview deploy SHA = `893ad0e` (do not infer from branch alias alone)
4. **Do not** merge PR #6 to `main` or unlock CNC in this step — separate Bekzod decisions

---

## 7. Sign-Off

| Decision | Status |
|---|---|
| M2 engineering candidate on lead tip | **READY for PR #6 fast-forward** |
| Fingerprint / pin refresh | **Authorized & applied** on `893ad0e` |
| Main merge | **NOT authorized** by this dossier |
| Production deploy | **NOT authorized** by this dossier |
| CNC / System 32 qualification | **Remains blocked** |

**Bekzod action:** Approve FF of PR #6 to `893ad0e`, then run post-FF CI + preview SHA verification before any further release steps.

---

*Generated from programmatic probes and git ancestry on tip `893ad0e`, 2026-09-18.*
