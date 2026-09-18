# PL-006 boundary review — `minDrawerBayClearWidthMm` = 51

**Date:** 2026-09-18 ~19:30 GST (UTC+4)  
**Tip:** `c48e108ab779a5b4fe36c8600f1dac38376d74c0`  
**Registry:** `src/lib/rules/physicalLimitRegistry.js` → `PHYSICAL_LIMITS.minDrawerBayClearWidthMm`  
**Provenance:** `PROVISIONAL_PENDING_BEKZOD_REVIEW`  
**Registry note (authoritative wording):** *“Construction floor from emitDrawerBankParts constants; engineer-chosen, not a Bekzod width ruling.”*

## Classification (do not invent BEKZOD_APPROVED)

| Claim | Status |
|---|---|
| 51 mm is a **usable drawer-width** product ruling | **NO** |
| 51 mm is **provisional arithmetic construction floor** | **YES** — `21 (undermount slide deduction) + 15 + 15 (L/R box side thickness)` |
| BEKZOD_APPROVED usable min drawer / bay width | **UNVERIFIED / NOT CLAIMED** — sideboard/office knowledge floors (300 mm) are separate domains |

BEK rulings that **are** catalogued for drawers (reveal 2.0, undermount 21.0, etc.) remain in `wardrobeRuleCatalog` — those are not a usable clear-width minimum.

## Exact boundary arithmetic (`emitDrawerBankParts`)

For bay clear width `W`:

| Part | Formula | W=50 | W=51 | W=52 |
|---|---|---|---|---|
| FRONT width | `W − 2×reveal(2)` | 46 | 47 | 48 |
| BACK width | `W − slide(21) − 2×15` | **−1** | **0** | **1** |
| BOTTOM width | `W − slide(21) − 10` | 19 | 20 | 21 |

So **W=51 is exactly where DRAWER_BACK becomes zero-sized**. The kernel gate uses `widthMm < 51` (strict less-than), therefore **exact 51 is allowed into the design model**.

## Live probes on tip (two-bay fixture, left clear = W)

Method: outer 900 mm wardrobe reshaped to sections `[W, remainder]` so left bay clear is exactly 50/51/52; then `addComponent` / `component_add` / PartGraph / exports.

| W | Kernel `addComponent` | Tool `component_add` | PartGraph DRAWER_BACK | DXF | CSV | SVG |
|---|---|---|---|---|---|---|
| **50** | **FAIL** `INSUFFICIENT_BAY_WIDTH_FOR_DRAWERS` | **FAIL** same | (not reached via tools) | — | — | — |
| **51** | **PASS** (bank committed) | **PASS** | **W=0** (zero-sized) | **FAIL-CLOSED** `non-positive flat dimensions` | **FAIL-CLOSED** `non-positive cut dimensions (176×0)` | **PASS** (SVG still emitted) |
| **52** | PASS | PASS | W=1 | PASS | PASS (1 mm backs in CSV) | PASS |

Direct `emitDrawerBankParts` at W=50 also yields BACK **W=−1** (negative); customer tool/kernel path blocks W\<51 so negatives do not commit via those surfaces.

## Proof summary — zero / negative parts vs customer + export

| Threat | Blocked before customer design commit? | Blocked before DXF? | Blocked before CSV? | Blocked before SVG? |
|---|---|---|---|---|
| Negative BACK (W≤50 via tools/kernel) | **YES** (`INSUFFICIENT_BAY_WIDTH_FOR_DRAWERS`) | n/a | n/a | n/a |
| Zero BACK (W=51 exact) | **NO** — design+PartGraph accept | **YES** | **YES** | **NO** — SVG still generates |
| 1 mm BACK (W=52) | NO | NO | NO | NO — absurd but positive |

### Conclusions for BEK (decisions, not auto-fixes)

1. **PL-006 = 51 is not a usable-width ruling** — treat as provisional construction floor only.  
2. **Gap:** exclusive lower bound should arguably be `W > 51` (or a real usable minimum TBD by BEK), because **W=51 commits zero-width BACK into PartGraph** and **SVG**.  
3. **DXF + CSV already fail-closed** on non-positive drawer flats — good for manufacturing export.  
4. **Do not stamp BEKZOD_APPROVED** on 51 mm. If BEK wants a usable floor, pick an explicit product number (knowledge bases elsewhere use ~300 mm for other furniture types — **not** automatically wardrobe law).

## Recommended BEK decision text (PL-006)

- **Keep 51 as provisional construction floor only? Y / N**  
- **Raise fail-closed to reject W≤51 (block zero BACK before design commit)? Y / N**  
- **Separately set a BEKZOD_APPROVED usable min bay/drawer width later? Y / N / DEFER**

No code change in this docs package.
