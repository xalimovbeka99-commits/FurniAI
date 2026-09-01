# FurniAI G2.1 — FurniSpec v0.1 Compatibility & Architecture Note

**Author:** Google Antigravity (Visual & Application Lead)  
**Authority:** `docs/MASTER_PLAN_2026.md` & `docs/WARDROBE_RULEBOOK_V0.1.md` (Base SHA `0bdc471`)  
**Milestone:** Gate G2.1 — Canonical FurniSpec and Golden Fixture  

---

## 1. Existing Codebase Audit & Reuse Assessment

### A. Reusable Existing Modules & Concepts
- **`src/lib/fsl/enums.js` & `src/lib/fsl/validator.js`**:
  - The pattern of deterministic structured error objects `{ code, message, path }` without throwing unhandled exceptions.
  - The principle of provenance tracking (`explicit`, `defaulted`, `inferred`, `unresolved`).
- **`src/lib/wardrobe-model/ids.js`**:
  - Stable identifier allocation principles (`bay-01`, `shelf-01`).
- **`src/lib/furnitureConfig.js` & `src/lib/knowledgeBase.js`**:
  - Centralized material definitions and dimension boundaries.

### B. Legacy & Insufficient Existing Modules
- **`src/lib/wardrobe-model/kernel.js` & `src/lib/wardrobe-model/schema.js`**:
  - **Strict Integer-mm Restriction**: The existing `assertIntegerMm` function rejects any fractional millimeter input (e.g. `447.5` mm for 4 equal wardrobe doors across 1800mm width).
  - **Missing Structural Concepts**: The existing model lacks representations for plinths, back-groove depth/width/setbacks, reveals/gap policies, edge-banding schedules, and qualification gates.
  - **Direct Geometry Coupling**: `buildWardrobeGeometry.js` previously built visual approximations in Three.js units without calculating exact manufacturing part graphs or semantic machining.

---

## 2. Preventing Conflicting Authorities

FurniSpec v0.1 is strictly established as the **Single Source of Truth** for furniture design intent and manufacturing constraints:

```
Customer Input / Evidence
         │
         ▼
[FurniSpec v0.1 Specification]  <-- The Canonical Intent Oracle
         │
         ▼
[Deterministic PartGraph Kernel] (Gate G2.2+)
   ├── Structural Panel Schedule
   ├── Exact Global/Local 3D Coordinates
   ├── Semantic Machining Feature Map
   └── Workshop Drawings / Cut Lists
```

- FurniSpec v0.1 contains **intent, envelopes, structural choices, bay layouts, and hardware policies**.
- FurniSpec v0.1 **never contains arbitrary, unvalidated mesh vertices or raw toolpaths**.
- No downstream component (3D renderer, workshop drawing generator, cut-list exporter) may invent dimensions or hardware rules independently of FurniSpec.

---

## 3. Numeric Representation Decision

To guarantee 100% deterministic, byte-stable normalization while supporting real-world furniture tolerances (such as half-millimeter door widths like $447.5\text{ mm}$):

- **Internal Canonical Scale:** Dimensions are normalized using **canonical tenths of a millimetre (dmm)** ($1\text{ mm} = 10\text{ dmm}$, integer representation) or exact fixed-point string decimals.
- **Public Interface:** The public JSON fixture exposes clean decimal numbers (e.g. `447.5`, `1800.0`, `18.0`).
- **Normalization Invariant:** Normalization rounds floats to exact tenths ($0.1\text{ mm}$) to eliminate binary floating-point representation drift (`0.1 + 0.2 !== 0.3`) across platforms and runtimes.

---

## 4. Protection of Existing Functionality

- **Live Legacy Three.js Builder (`index.html` + `dist/`)**: Untouched. The 16/16 Playwright browser tests continue to guard production.
- **Vercel API Routes & Next.js Endpoints**: Untouched.
- **New Code Placement**: All FurniSpec v0.1 code lives cleanly isolated under `src/lib/furnispec/`.
