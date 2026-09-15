# PartGraph adversarial QA matrix (volumetric + boring + production preflight)

**Date:** 2026-09-15 (Asia/Dubai)  
**Branch:** `test/adversarial-part-graph`  
**Checkout:** `C:\Users\xalim\FurniAI-F1-Claude-Handoff`  
**Base tip:** `cb5f110627e1df589101f416fb34299ebb092bc0`  
**Scope:** Adversarial PartGraph collision / boring audits + production geometry preflight.  
**Do not:** merge main, deploy production, or move F1 freeze tip on `integ/f1-claude-handoff`.

## Tracking intent

| Branch / surface | Status | Notes |
|---|---|---|
| `test/adversarial-part-graph` | **This work** | Adversarial tests + `boringDepthAudit` helper; push via Integration fetch→push |
| `integ/part-graph-compiler` | **Not on origin yet** | Tracking intent only — compiler integration branch is planned; not created/pushed here |
| `integ/f1-claude-handoff` | **Frozen tip left alone** | QA stays on `test/adversarial-part-graph` |

## PASSED vs REJECTED matrix

| Case | Path | Verdict | Mechanism |
|---|---|---|---|
| Golden wardrobe solid panels — zero unintended volumetric intersection | `buildStructuralPartGraph` + `validatePartGraph` | **PASSED** | AABB overlap requires ox/oy/oz > 0; golden has none among solids |
| Fixed shelves terminate at inner gable/divider faces (face contact only) | PartGraph kernel + validator | **PASSED** | Shelf X equals neighbour face; no positive 3-axis overlap |
| Adjustable shelves honour side clearance vs gables | PartGraph clearancePolicy | **PASSED** | `sideClearanceMm` insets bay clear width |
| Injected colliding shelf vs gable | `validatePartGraph` | **REJECTED** | `UNINTENDED_PART_COLLISION` |
| Injected shelf-on-shelf volumetric overlap | `validatePartGraph` | **REJECTED** | `UNINTENDED_PART_COLLISION` |
| Back panel groove engagement with carcass | `validatePartGraph` | **PASSED** (intentional allow-list) | Only `BACK_PANEL_01` ↔ carcass sides/top/bot |
| Drawer box geometry in golden PartGraph | PartGraph roles | **ASPIRATIONAL / NOT ON PATH** | No `DRAWER_*` in `PART_ROLES`; `DRAWER_BANK` → UNSUPPORTED outcome |
| Synthetic intersecting drawer box (stand-in role) | `validatePartGraph` | **REJECTED** | Fail-closed via `UNINTENDED_PART_COLLISION` |
| Synthetic drawer slide-gap < policy | placement audit helper in test | **REJECTED** | `DRAWER_SLIDE_GAP_TOO_SMALL` / `DRAWER_BOX_SIDE_INTERSECTION` |
| Synthetic drawer-front reveal < 1.5 mm | placement audit helper in test | **REJECTED** | `DRAWER_FRONT_REVEAL_TOO_SMALL` |
| Synthetic drawer-front reveal in 1.5–2.0 mm band | placement audit helper in test | **PASSED** | Gaps within policy band |
| Hardware drilling on production PartGraph | kernel + serialize | **BLOCKED** | Only `BACK_GROOVE` APPROVED; report says `Hardware drilling: BLOCKED` |
| Blind bore depth ≤ panelThickness − 3 mm | `auditBoringDepths` | **PASSED** / **REJECTED** when deeper | `BLIND_BORE_DEPTH_EXCEEDED` |
| Shelf pin Ø5 × ≤13 mm in 18 mm panel | `auditBoringDepths` | **PASSED** / **REJECTED** when deeper/wrong Ø | `SHELF_PIN_DEPTH_EXCEEDED` / `SHELF_PIN_DIAMETER_REJECTED` |
| Hinge cup Ø35 × ≤12.5 mm in 18 mm door | `auditBoringDepths` | **PASSED** / **REJECTED** when deeper/wrong Ø | `HINGE_CUP_DEPTH_EXCEEDED` / `HINGE_CUP_DIAMETER_REJECTED` |
| Back groove ∩ Minifix cam / shelf-support line bore | `auditBoringDepths` | **REJECTED** | code `REJECTED` |
| Production preview: NaN dims/coords | `assertProductionGeometry` / `buildCutList` / pack | **REJECTED** | `ProductionPreviewError` / `GEOMETRY_VALIDATION_FAILED` |
| Production preview: negative panel thickness (injected part size) | `assertProductionGeometry` | **REJECTED** | `NON_POSITIVE_PART_SIZE` |
| Production preview: zero dimensions | `buildCutList` / pack / `assertProductionGeometry` | **REJECTED** | `GEOMETRY_VALIDATION_FAILED` |

## Enforced vs aspirational (current PartGraph)

| Concern | Enforced on current PartGraph? | Notes |
|---|---|---|
| Solid panel volumetric non-intersection | **ENFORCED** | `UNINTENDED_PART_COLLISION` |
| Shelf ↔ gable face-contact policy | **ENFORCED** (geometry + collision gate) | Fixed shelves span bay clear width |
| Drawer box slide gap | **ASPIRATIONAL** | No drawer parts on PartGraph path; synthetic audit in QA only |
| Drawer front perimeter reveal 1.5–2.0 mm | **ASPIRATIONAL** | Same — synthetic audit only |
| Hardware boring depth / diameter limits | **ENFORCED via QA helper** (`boringDepthAudit.js`) | Does **not** unlock CNC; production drilling remains BLOCKED |
| Groove ∩ cam/line-bore conflict | **ENFORCED via QA helper** | Fail-closed on synthetic conflicting ops |
| Production geometry NaN / zero / non-positive size | **ENFORCED** | `ProductionPreviewError` |

## Deliverables

- `tests/part-graph/panelCollisions.test.js`
- `tests/part-graph/boringAudit.test.js`
- `src/lib/partgraph/boringDepthAudit.js`
- Extended `src/lib/production.test.js` preflight cases
- Vitest include: `tests/part-graph/**/*.test.js`
- CI triggers extended for `test/adversarial-part-graph`

## Push pattern

Worktree origin → local Integration (`C:\Users\xalim\FurniAI-Integration`) → GitHub `xalimovbeka99-commits/FurniAI` (Integration fetch→push). Leave `integ/f1-claude-handoff` tip unchanged.
