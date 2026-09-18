# Exporter invalid PartGraph matrix — independent reconciliation

**Date:** 2026-09-18 (GST / UTC+4)  
**Combined tip:** `integ/m2-integration-lead` after merge of `bdafb42`  
**Probe script:** `scripts/integ/probe-invalid-partgraph.mjs`  
**Fixture:** minimal PartGraph with one `DRAWER_BACK` panel `finished.widthDmm = 0` (0 mm), `finished.lengthDmm = 1760` (176 mm) — mirrors PL-006 W=51 bay arithmetic (`176×0`). Optional companion valid `LEFT_SIDE` panel included in mixed runs.  
**Policy:** Recorded results only — no exporter code changes. PL-006 remains **OPEN**.

## Claims being reconciled

| Source | Claim about zero-width `DRAWER_BACK` |
|---|---|
| Integration / Claude (`PL006_BOUNDARY.md`) | DXF **FAIL-CLOSED**, CSV **FAIL-CLOSED**, SVG **PASS** (still emitted). Nesting not separately tabulated. |
| Antigravity (`CLAUDE_PL006_REPRODUCTION_HANDOFF.md`) | “Exporters (SVG shop drawings, **nesting**) still emit this zero-width part without fail-closing.” |

## Actual results (this tip)

| Exporter surface | Entry point | Solo zero BACK | Mixed (zero BACK + valid side) | Actual outcome |
|---|---|---|---|---|
| **SVG** shop drawings | `generateShopDrawingsSVG` | **RETURNED** (~10.8 KB SVG) | **RETURNED** (~10.9 KB SVG) | **PASS / emits** — does **not** fail-close |
| **DXF** panel | `compilePanelToDxf` | **THREW** `Panel "DRW_BACK_ZERO" has non-positive flat dimensions.` | n/a | **FAIL-CLOSED** |
| **DXF** package | `compileCabinetDxfPackage` | **THREW** same | **THREW** same (aborts whole package when zero panel reached) | **FAIL-CLOSED** |
| **CSV** cut list | `generateCutListCsv` / `buildCutListRows` | **THREW** `Panel "DRW_BACK_ZERO" has non-positive cut dimensions (176×0).` | **THREW** same | **FAIL-CLOSED** |
| **Nesting** | `compileNestingManifest` (via `buildCutListRows`) | **THREW** `Panel "DRW_BACK_ZERO" has non-positive cut dimensions (176×0).` | **THREW** same | **FAIL-CLOSED** |
| Nesting report HTML | `formatNestingReport` after compile | unreachable (compile throws) | unreachable | n/a |

## Reconciliation verdict

| Claim | Verdict |
|---|---|
| Claude/Integration: DXF + CSV fail-closed; SVG emits | **CONFIRMED** |
| AG: nesting still emits zero-width without fail-closing | **REFUTED on this tip** — nesting shares `buildCutListRows` and throws the same non-positive cut-dimension error as CSV |
| AG: SVG still emits | **CONFIRMED** |

**Net gap for PL-006 (still OPEN):** design model + PartGraph + **SVG** accept/emit zero-width BACK; manufacturing cut-path (DXF / CSV / nesting) already refuse. Closing PL-006 requires a product/code decision (raise bay gate and/or fail-close SVG), not a pin refresh.

## Reproduce

```bash
node scripts/integ/probe-invalid-partgraph.mjs
```
