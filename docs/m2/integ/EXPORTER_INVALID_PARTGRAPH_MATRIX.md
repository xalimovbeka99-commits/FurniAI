# Exporter invalid PartGraph matrix — independent reconciliation

**Date:** 2026-09-18 (GST / UTC+4)  
**Combined tip:** `integ/m2-integration-lead` after merge of `bdafb42`  
**Probe script:** `scripts/integ/probe-invalid-partgraph.mjs`  
**Fixture:** minimal PartGraph with one `DRAWER_BACK` panel `finished.widthDmm = 0` (0 mm), `finished.lengthDmm = 1760` (176 mm) — mirrors PL-006 W=51 bay arithmetic (`176×0`). Optional companion valid `LEFT_SIDE` panel included in mixed runs.  
**Policy:** Permanent Vitest `tests/production/invalidPartGraph.exporters.test.js` is authoritative. SVG wording: a **returned** SVG for invalid input is a **failure to REJECT** — it does **not** alone prove a degenerate part was rendered. After PL-006 engineering close on this tip, SVG must throw on non-positive finished dims (same as DXF/CSV/nesting).

## Claims being reconciled

| Source | Claim about zero-width `DRAWER_BACK` |
|---|---|
| Integration / Claude (`PL006_BOUNDARY.md`) | DXF **FAIL-CLOSED**, CSV **FAIL-CLOSED**, SVG **PASS** (still emitted). Nesting not separately tabulated. |
| Antigravity (`CLAUDE_PL006_REPRODUCTION_HANDOFF.md`) | “Exporters (SVG shop drawings, **nesting**) still emit this zero-width part without fail-closing.” |

## Actual results (this tip)

| Exporter surface | Entry point | Solo zero BACK | Mixed (zero BACK + valid side) | Actual outcome |
|---|---|---|---|---|
| **SVG** shop drawings | `generateShopDrawingsSVG` | **THREW** non-positive finished (post-fix) | **THREW** same | **FAIL-CLOSED** — returning SVG would mean failure to reject |
| **DXF** panel | `compilePanelToDxf` | **THREW** `Panel "DRW_BACK_ZERO" has non-positive flat dimensions.` | n/a | **FAIL-CLOSED** |
| **DXF** package | `compileCabinetDxfPackage` | **THREW** same | **THREW** same (aborts whole package when zero panel reached) | **FAIL-CLOSED** |
| **CSV** cut list | `generateCutListCsv` / `buildCutListRows` | **THREW** `Panel "DRW_BACK_ZERO" has non-positive cut dimensions (176×0).` | **THREW** same | **FAIL-CLOSED** |
| **Nesting** | `compileNestingManifest` (via `buildCutListRows`) | **THREW** `Panel "DRW_BACK_ZERO" has non-positive cut dimensions (176×0).` | **THREW** same | **FAIL-CLOSED** |
| Nesting report HTML | `formatNestingReport` after compile | unreachable (compile throws) | unreachable | n/a |

## Reconciliation verdict

| Claim | Verdict |
|---|---|
| Claude/Integration: DXF + CSV fail-closed; SVG emits | **SUPERSEDED** — SVG now fail-closes with DXF/CSV/nesting |
| AG: nesting still emits zero-width without fail-closing | **REFUTED on this tip** — nesting shares `buildCutListRows` and throws the same non-positive cut-dimension error as CSV |
| AG: SVG still emits | **SUPERSEDED** on reconciled tip — SVG refuses non-positive finished dims |

**PL-006 engineering status (reconciled tip):** exclusive bay gate (`W <= 51` reject) + emit positive-dim refuse + SVG/DXF/CSV/nesting refuse non-positive. Still **not** a BEKZOD_APPROVED usable-width ruling. Fingerprint refresh remains PENDING.

## Reproduce

```bash
node scripts/integ/probe-invalid-partgraph.mjs
```
