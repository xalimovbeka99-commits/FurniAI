# Claude & Grok Handoff: PL-006 Drawer Back Boundary Reproduction & Exporter Matrix

**Date:** 2026-09-18  
**Author:** Antigravity / Integration  
**Recipients:** Grok (Engineering Manager / PL-006 Lead), Claude Code (Deep Engineering)  
**Status:** ACTION REQUIRED FOR COMBINED CANDIDATE  
**Branch:** `integ/m2-reproduction-combined`  
**Base Tip:** `e47c2058f97dcfcf6db199b095ac588e9ae94abe`  

---

## 1. Executive Summary & Ownership Boundaries

- **Grok Ownership:** Grok currently owns the drawer reconciliation and PL-006 boundary fix. Antigravity has strictly avoided starting any new compiler implementation in accordance with high-collision single-writer rules (`AGENTS.md`).
- **Permanent Regression Suite:** Antigravity has implemented and verified the permanent test suite at `tests/production/invalidPartGraphRejection.test.js` (18/18 passing).
- **Test Corrections Flagged:** Exactly 5 test corrections are flagged below for the combined candidate when Grok's fix lands.

---

## 2. Five Flagged Test Corrections for the Combined Candidate

### Flag 1: Replace SVG Defect-Characterization with Rejection Assertion
- **Current Baseline:** `generateShopDrawingsSVG` does not reject invalid input (returns SVG string without throwing). Returning SVG proves a failure to reject invalid input; it does not alone prove a degenerate part was rendered on screen.
- **Current Test:** Characterizes this defect in `tests/production/invalidPartGraphRejection.test.js`:
  ```javascript
  const result = generateShopDrawingsSVG(zeroBack);
  expect(typeof result).toBe('string');
  expect(result.length).toBeGreaterThan(0);
  ```
- **Action When Grok Fix Lands:** When the SVG input validation gate is added to `src/lib/drawing/projectionEngine.js`, replace the characterization with:
  ```javascript
  expect(() => generateShopDrawingsSVG(zeroBack)).toThrow(/non-positive|invalid/i);
  ```

### Flag 2: Representative Positive Control & Single-Dimension Mutations
- **Positive Control:** Uses `createPositiveControlGraph()` generated from `buildStructuralPartGraph(goldenSpec)`.
- **Mutation Pattern:** Deep-clones positive control and mutates exactly ONE dimension of one part per test:
  - **Finished Dimensions (DXF fail-closed):**
    - `lengthDmm: 0` -> DXF throws `/non-positive flat dimensions/i`
    - `lengthDmm: -100` -> DXF throws `/non-positive flat dimensions/i`
    - `widthDmm: 0` (PL-006 boundary) -> DXF throws `/non-positive flat dimensions/i`
    - `widthDmm: -50` -> DXF throws `/non-positive flat dimensions/i`
  - **Raw Cut Dimensions (CSV Cut List & Nesting Preflight fail-closed):**
    - `lengthDmm: 0` -> CSV & Nesting throw `/non-positive cut dimensions/i`
    - `lengthDmm: -200` -> CSV & Nesting throw `/non-positive cut dimensions/i`
    - `widthDmm: 0` -> CSV & Nesting throw `/non-positive cut dimensions/i`
    - `widthDmm: -150` -> CSV & Nesting throw `/non-positive cut dimensions/i`
  - **Thickness Exporter Gap (Finished & Raw Thickness):**
    - Currently, `dxfCompiler.js`, `nestingCompiler.js` (cut list & manifest) do not reject `thicknessDmm <= 0`.
    - Characterized in test suite. When Grok/Claude adds thickness validation, flip assertions to `.toThrow(/non-positive/i)`.

### Flag 3: 0.1 mm Precision Boundary vs Manufacturability
- **Empirical Boundary:** Tested on ungrooved panels (`SHELF_FIX_L1`) at `1 dmm` ($0.1\text{ mm}$):
  - DXF polyline outline and CSV cut-list accept $0.1\text{ mm}$ without arithmetic underflow.
- **Critical Limitations Documented in Suite:**
  1. *Arithmetic acceptance at $0.1\text{ mm}$ does NOT establish practical manufacturability.*
  2. *Nesting stock packing is NOT exercised or claimed for $0.1\text{ mm}$ precision.*
  3. *Grooved panels (e.g. `CARC_TOP`) fail DXF containment at $0.1\text{ mm}$ because the $7\text{--}10\text{ mm}$ back groove margin crosses the $0.1\text{ mm}$ outer outline.*

### Flag 4: Customer-Entry Tests vs Direct Compiler Inputs & Dynamic Derivation
- **Separation:**
  - **Customer-Entry Tests:** Test `proposeWardrobe`, `parseConversationalCommand`, `applyConversationalEdit` ensuring atomic refusal (state, envelope, revision, undo history completely unchanged).
  - **Direct Compiler Tests:** Test `emitDrawerBankParts` and `buildStructuralPartGraph` directly.
- **Dynamic Derivation:**
  - The drawer boundary must be derived dynamically from construction parameters:
    $$\text{bayWidth} > \text{slideDeductionMm} + 2 \times \text{DRAWER\_BOX\_SIDE\_THICKNESS\_MM}$$
  - With current parameters ($21 + 15 + 15 = 51\text{ mm}$), $51\text{ mm}$ yields back width $0\text{ mm}$.
  - Do not hardcode $51\text{ mm}$ or assume every customer path can reach a $51\text{ mm}$ bay.

### Flag 5: Preserved Browser Evidence with Actual Tested SHAs
Every browser test run is stamped with its exact git tree:
1. **F1 Browser Journey (5/5 PASSED):** Tested on `30b2fe9` / `bdafb42` (evidence preserved in `docs/m2/integ/evidence/f1/`).
2. **R3F Next.js Builder (7/7 PASSED):** Tested on `30b2fe9` / `bdafb42`.
3. **Manufacturing Menu & Nesting Report (3/3 PASSED):** Tested on `c51af19`.
4. **Mobile Viewport & Print Window Check (PASSED):** Tested on `e47c205`.

---

## 3. Fingerprint & Governance Status

- **CI Fingerprints (Frozen):** Exactly 6 failed assertions across 5 files in `phase2Verification.test.js` and `frozenSurfaces.test.js`:
  1. `src/lib/wardrobe-model/schema.js`
  2. `src/lib/wardrobe-model/kernel.js`
  3. `src/lib/wardrobe-model/validator.js`
  4. `src/lib/wardrobe-tools/tools.js`
  5. `src/app/builder/page.jsx` (2 assertions)
- **Governance:** Fingerprints remain frozen and will not be refreshed until the final reviewed code from Grok/Claude is merged and reviewed by BEK.
