# Claude Handoff: PL-006 Drawer Back Boundary Reproduction & Atomic Rejection

**Date:** 2026-09-18  
**Author:** Antigravity / Integration  
**Recipients:** Claude Code (Deep Engineering), Grok (Engineering Manager)  
**Status:** DRAFT / ACTION REQUIRED  
**Branch:** ix/mfg-boot-crash-and-nesting-report (base tip: integ/part-graph-compiler @ c48e108)  
**Commit SHA:** 30b2fe9b085f057c0c037161aae0bf5993018b92  

---

## 1. PL-006 Reproduction: Drawer Back Width Boundary

### Root Formula
In src/lib/partgraph/emitDrawerBankParts.js:
`javascript
const backWidthMm = bayWidthMm - slideDeductionMm - 2 * DRAWER_BOX_SIDE_THICKNESS_MM;
`
With current construction parameters:
- slideDeductionMm = 21 (drawerSlideWidthDeductionMm in wardrobeRuleCatalog.js)
- DRAWER_BOX_SIDE_THICKNESS_MM = 15 (undermount concealed side wall thickness)
- Sum of deductions = 21 + 15 + 15 = 51 mm

In src/lib/wardrobe-model/schema.js:
`javascript
minDrawerBayClearWidthMm: 21 + 15 + 15, // 51 mm
`

### Boundary Behavior
1. **50 mm (bayWidth < 51 mm):**
   - **Result:** Correctly rejected by validator (INSUFFICIENT_BAY_WIDTH_FOR_DRAWERS).
2. **51 mm (bayWidth == 51 mm):**
   - **Result:** Accepted by kernel and validator (51 >= 51).
   - **Defect:**  ackWidthMm = 51 - 21 - 30 = 0 mm.
   - Produces a zero-width physical structural panel (DRAWER_BACK_B1_R1: Finished: 0.0 × 176.0 × 15.0 mm).
   - Historical note: SVG previously returned without throwing; nesting already fail-closed via cut-list. Reconciled tip: SVG+DXF+CSV+nesting all refuse.
3. **52 mm (bayWidth == 52 mm):**
   - **Result:** Accepted by kernel and validator.
   - **Defect:** backWidthMm = 52 - 51 = 1 mm.
   - This represents arithmetic validity only, not physical manufacturability.

### Exporter Failure Modes on Minimal Zero-Width Part
Empirical probe results across the 4 exporters:
- **DXF Compiler (`compileCabinetDxfPackage`):** FAIL-CLOSED (threw `Panel "..." has non-positive flat dimensions`).
- **Cut-list CSV (`generateCutListCsv`):** FAIL-CLOSED (threw `Panel "..." has non-positive cut dimensions`).
- **Nesting Preflight (`compileNestingManifest`):** FAIL-CLOSED (threw `Panel "..." has non-positive cut dimensions`).
- **SVG Shop Drawings (`generateShopDrawingsSVG`):** **FAIL-CLOSED** on reconciled tip (throws on non-positive finished dims). Note: a *returned* SVG for invalid input would still mean failure to reject — not proof of on-screen degenerate render.

---

## 2. Instructions for Claude Code

1. **Enforce Strictly Positive Physical Part Dimensions:**
   - Enforce that every physical structural part (`DRAWER_BACK`, `DRAWER_FRONT`, `DRAWER_SIDE`, `DRAWER_BOTTOM`, carcass panels, shelves) has strictly positive finished dimensions:
     $$\text{length} > 0, \quad \text{width} > 0, \quad \text{thickness} > 0$$
   - Derive the boundary constraint strictly from the actual drawer construction formula (`bayWidth > slideDeductionMm + 2 * DRAWER_BOX_SIDE_THICKNESS_MM`).
   - Do **NOT** invent an arbitrary practical minimum width (e.g. do not guess 200 mm or 300 mm without a rulebook ruling).
   - Do **NOT** mark PL-006 as `BEKZOD_APPROVED`; keep provenance as `PROVISIONAL_PENDING_BEKZOD_REVIEW`.

2. **Verify Customer Paths vs. Direct Compiler Inputs Separately:**
   - A manually injected invalid part does not establish which customer paths can create it.
   - Claude must verify PL-006 through:
     1. **Customer entry points:** `proposeWardrobe`, `parseConversationalCommand`, `applyConversationalEdit` (must refuse before part emission).
     2. **Direct compiler inputs:** `emitDrawerBankParts`, `buildStructuralPartGraph` (fail-close validation).

3. **Atomic Rejection Contract:**
   - When invalid drawer geometry is requested (e.g. bay width <= 51 mm), the pipeline must reject atomically.
   - Previous design state, envelope, revision number, proposal ID/fingerprint, and Undo history stack must remain completely unchanged.
   - Exporters must consistently refuse invalid geometry. Permanent coverage is now captured in `tests/production/invalidPartGraphRejection.test.js`.
   - Tests must cover:
     - Exact boundary cases: 50.9 mm, 51.0 mm, 51.1 mm.
     - Decimal deci-mm precision (0.1 mm = 1 dmm).
     - Zero/negative dimensions and invalid thickness.

---

## 3. Peer Status & Antigravity Hand-off

Antigravity has isolated and resolved the static builder presentation layer blockers on branch ix/mfg-boot-crash-and-nesting-report:

1. **Commit:** 30b2fe9b085f057c0c037161aae0bf5993018b92
2. **Delivered Fixes:**
   - **index.html Boot Syntax Fix:** Escaped premature </script> tag inside printNestingReport document template literal.
   - **Dropdown Z-Index Stacking:** Added position: relative; z-index: 50; to .b-top so #mfgMenuDropdown layers over #bld3d canvas.
   - **Modal DOM Placement:** Closed #view-projects container to prevent #nestingReportModal from being trapped in a hidden container.
   - **Focused Browser Regression Test:** Added 	ests/browser/mfg-nesting-report.spec.js (2/2 passing).
3. **Local Evidence:**
   - 
px playwright test tests/browser/f1-journey.spec.js: **5 passed (0 failed)**.
   - 
px playwright test tests/browser/r3f-builder.spec.js: **7 passed (0 failed)**.
   - 
px playwright test tests/browser/mfg-nesting-report.spec.js: **2 passed (0 failed)**.
   - erify:production: PASS on live Vercel deploy.

*Note: Antigravity's evidence is local candidate evidence and does not represent live production deployment.*

---

## 4. Fingerprint & Baseline Governance

1. **Fingerprint Freeze:**
   - Do **NOT** refresh the 4 hash-pin checks in 	ests/wardrobe-ai/phase2Verification.test.js at this stage.
   - Hashes must only be minted from the final reviewed and corrected code after Claude's PL-006 boundary fix lands.
2. **Separation of Concerns:**
   - Clearly delineate:
     1. **Accepting an implementation change** (bugfix/refactor).
     2. **Updating a regression fingerprint** (updating test pins).
     3. **Approving a furniture domain rule** (BEKZOD_APPROVED).
     4. **Qualifying manufacturing** (CNC / drilling qualification).
3. **Deployment Evidence Distinction:**
   - Explicitly distinguish between “deployed SHA matches main” and “Vercel’s configured production branch is verified”.
