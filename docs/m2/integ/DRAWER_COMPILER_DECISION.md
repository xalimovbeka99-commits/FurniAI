# Drawer compiler decision — integ/m2-integration-lead

**Date:** 2026-09-18 (GST / UTC+4)  
**Baseline tip before reconcile:** `3fab34a70cbeed90c2480de355bf57a9457d4cfe`  
**Merged reproduction tip:** `e47c2058f97dcfcf6db199b095ac588e9ae94abe` (permanent rejection suite + mobile mfg test)  
**Claude review tip compared:** `review/claude-part-graph-compiler-19ee058` @ `19ee058` / bundle `d80f1d3` (REVIEW ONLY)
**Claude PL-006 fix tip (source of truth for fail-close):** `review/claude-pl006-927c071` @ `927c071db8ce221589c60beec899f02bad67f4c9`  
**Merge-base with candidate:** `cb5f110` (Claude tip is a **sibling** of the M2 line, not a descendant of `c48e108`)

## Decision

**Authoritative construction:** `src/lib/partgraph/emitDrawerBankParts.js`  
**Not wired / not competing:** Claude `drawerPack.js` (remains on review branch only; not imported into `buildStructuralPartGraph`)

## Why (construction parameters + behavioral evidence — not test count)

| Criterion | `emitDrawerBankParts` (candidate) | `drawerPack` (Claude 19ee058) |
|---|---|---|
| Conversational `Add drawers` / `DRAWER_BANK_WITH_SHORT_HANGING` | Works today — bank needs only `rows` (+ optional `heightMm`) | **UNSUPPORTED** unless five explicit box fields present |
| Product journey (tool `component_add`, NL pipeline, Undo) | Preserved | Would regress drawers to refusal |
| Ruled BEKZOD 2026-09-15 values | Uses `drawerFrontRevealMm=2`, `drawerSlideWidthDeductionMm=21`, runner family | Same ruled width/reveal |
| Unruled box geometry | Fills with **labelled provisional** construction constants | Requires explicit inputs; refuses to invent |
| Side thickness | Provisional **15 mm** box sides | Uses carcass **panel** thickness for sides |
| BACK formula | `W − 21 − 2×15` | Depends on `backBetweenSides` + panel T |

Selecting Claude `drawerPack` as the live compiler would break the working customer drawer journey unless the conversational path suddenly collected five unruled dimensions. That is a product/input change, not an engineering drop-in. Therefore **one** live emitter remains: `emitDrawerBankParts`.

Claude’s contribution that **is** retained conceptually:

1. Explicit inventory of five unruled inputs (`boxHeightMm`, `boxDepthMm`, `boxBottomClearanceMm`, `bottomThicknessMm`, `backBetweenSides`) — documented as the provisional defaults map in `emitDrawerBankParts` header and below.
2. Discipline that missing ruled values must not be invented — applied as positive-dim fail-close + exclusive PL-006 gate.
3. Adapter draft labelling (`PROPOSED` + `adapterAssumptions`) instead of silently stamping `APPROVED`.

Useful Claude unit tests that assert ruled reveal/deduction arithmetic are reflected in permanent PL-006 / exporter regressions on this tip; the Claude `drawerPack.test.js` file itself is **not** merged (it would reintroduce a second compiler import path).

## Five explicit inputs vs conversational defaults (provenance)

| Claude required field | Conversational / emit default | Provenance |
|---|---|---|
| `boxHeightMm` | `drawerH − 2×reveal` (`reveal` from catalog) | box height: **provisional**; reveal: **BEKZOD_RULING** |
| `boxDepthMm` | `carcassDepth − 50` (`DRAWER_SIDE_DEPTH_SETBACK_MM`) | **PROVISIONAL_PENDING_BEKZOD_REVIEW** |
| `boxBottomClearanceMm` | `0` (box bottom = front aperture after reveal) | **PROVISIONAL_PENDING_BEKZOD_REVIEW** |
| `bottomThicknessMm` | `max(6, backThicknessMm)` | **PROVISIONAL** / catalog back thickness **RULEBOOK/GOLDEN** as applicable |
| `backBetweenSides` | `true` (BACK between 15 mm L/R sides) | **PROVISIONAL_PENDING_BEKZOD_REVIEW** |

Ruled width path (both compilers): box external width = bay clear − **21.0** total; front perimeter reveal **2.0** mm.

## Draft assumptions labelling

`adaptWardrobeModelToFurniSpec` defaults `status=PROPOSED` and attaches `adapterAssumptions[]` (plinth, shelf kind, rail heuristic, drawer construction defaults). Qualification stays `WORKSHOP_REVIEW_NOT_CNC_QUALIFIED`. Callers must pass `status=APPROVED` explicitly after workshop review — never silent promotion.

## Adapter mapping review (silent intent)

| Mapping | Prior candidate | Claude 19ee058 | Reconciled |
|---|---|---|---|
| SHELF → fixed vs adjustable | Always `SHELF_FIXED` | `SHELF_FIXED` + `shelfKindFor` override | **Keep FIXED default**; labelled `MAPPING_ASSUMPTION` |
| HANGING_RAIL long vs short | `drop > 1000 → LONG` | Nearer of golden 1400 / 900 | **Preserve `>1000` heuristic** to avoid silent reclassification of mid-drop rails; Claude mapping noted only |
| Plinth | Hardcoded 100 | Required input | Default 100 with **provisional** label; overridable |
| Spec status | `APPROVED` | `PROPOSED` default | **`PROPOSED` default** |

## PL-006 (engineering close — not furniture-rule approval)

Derived from actual emit parameters: `BACK = W − 21 − 15 − 15`.  
At **W=51**, BACK=**0**. Gate is exclusive: customer paths reject `widthMm <= 51`. Compiler also refuses non-positive dims.  
**Not** BEKZOD_APPROVED usable width. **W=52** = arithmetic validity only (1 mm BACK), not manufacturability.

Note: wardrobe-model `minSectionWidthMm=250`, so W=50/51 sections are not creatable via normal section resize; customer drawer gate is still proven on synthetic section widths (kernel/tool), and compiler is proven via direct `emitDrawerBankParts` inputs.

## Single authoritative construction after reconcile

`buildStructuralPartGraph` → `emitDrawerBankParts` only. No `drawerPack` import. No dual dimension sources.


## Ported from 927c071 (not wholesale bundle merge)

- `DEGENERATE_DRAWER_GEOMETRY` at emit source with formula in message
- Exclusive `widthMm <= floor` kernel/validator gate
- SVG via `validatePartGraph` before draw (`assertRenderablePartGraph`)
- Exact row-height division refusal when `heightMm` stated
- Provenance header: ruled vs provisional constants (NOT Bekzod-attributed for 15/50/10/180)
- Permanent test: `src/lib/partgraph/pl006DegenerateGeometry.test.js` (50.9 / 51.0 / 51.1)

## Bounded follow-ups (not this tip)

- Per-board-thickness System32 boring disagreement (candidate dual keys vs Claude per-host throw) — drilling stays BLOCKED
- Terminology `PROVISIONAL_PENDING_BEKZOD_REVIEW` vs `PROVISIONAL_PREVIEW_RULE` — settle docs once
- Practical usable min drawer width (above arithmetic 51.1) — Bekzod product ruling required
