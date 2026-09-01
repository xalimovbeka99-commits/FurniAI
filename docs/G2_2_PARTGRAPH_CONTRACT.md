# FurniAI G2.2 — Structural PartGraph Contract

> **WORKSHOP-REVIEW SPECIFICATION — NOT CNC-QUALIFIED**
>
> This document specifies the canonical structural PartGraph data contract (Gate G2.2). It formalizes the deterministic translation of FurniSpec v0.1 into verified manufacturing panel geometry.

**Status:** `BEKZOD_APPROVED` (Workshop Authority Sign-Off)  
**Milestone:** Gate G2.2 — Deterministic Structural PartGraph  
**Base SHA:** `e47d93ee9089f4ad3f5c3f9d085f2bb4ae8afa2f`  

---

## 1. Primary Flow & Architecture

```
[FurniSpec v0.1 JSON Fixture]
             │
             ▼
[Pure Deterministic Kernel: buildStructuralPartGraph]
   - Asserts exact deci-mm precision (0.1 mm)
   - Evaluates closed-form geometric equations
   - Calculates 19 structural rectangular panels
   - Determines raw cutting dimensions via edge banding
   - Assigns 3D global bounding boxes
             │
             ▼
[Canonical Structural PartGraph]
   ├── 19 Structural Panels
   ├── 4 Approved Back-Groove Operations
   ├── Hardware Drilling BLOCKED
   └── CNC Qualified: NO
```

---

## 2. Canonical Deci-Millimetre Scale Policy

To eliminate floating-point representation anomalies (e.g. `0.1 + 0.2 !== 0.3`) and prevent uncontrolled binary drift across runtimes:

- **Canonical Unit Scale:** All dimensions, offsets, tolerances, and placement coordinates in PartGraph are stored as **exact integers in deci-millimetres (dmm)**.
- **Conversion Factor:** $1\text{ dmm} = 0.1\text{ mm}$ ($10\text{ dmm} = 1.0\text{ mm}$).
- **Precision Rejection Invariant:** Any dimension with precision finer than $0.1\text{ mm}$ (e.g. `447.55 mm`) is strictly rejected with `UNSUPPORTED_DIMENSION_PRECISION`. Silent rounding is prohibited.

---

## 3. Structural Part Schedule (Golden Wardrobe: 19 Parts)

| Part ID | Role | Qty | Finished Dim ($L \times W \times T$) | Raw Cutting Dim ($L \times W \times T$) | Edge Banding (`LE1 / LE2 / WE1 / WE2`) | Placement [$X_{\min}..X_{\max}, Y_{\min}..Y_{\max}, Z_{\min}..Z_{\max}$] |
|---|---|---|---|---|---|---|
| `CARC_TOP` | `TOP_PANEL` | 1 | $1800.0 \times 580.0 \times 18.0$ | $1798.0 \times 579.0 \times 18.0$ | 1.0mm / 0.0mm / 1.0mm / 1.0mm | $[0..1800, 2382..2400, 20..600]$ |
| `CARC_BOT` | `BOTTOM_PANEL` | 1 | $1800.0 \times 580.0 \times 18.0$ | $1798.0 \times 579.0 \times 18.0$ | 1.0mm / 0.0mm / 1.0mm / 1.0mm | $[0..1800, 100..118, 20..600]$ |
| `CARC_SIDE_L` | `SIDE_PANEL_LEFT` | 1 | $2264.0 \times 580.0 \times 18.0$ | $2264.0 \times 579.0 \times 18.0$ | 1.0mm / 0.0mm / 0.0mm / 0.0mm | $[0..18, 118..2382, 20..600]$ |
| `CARC_SIDE_R` | `SIDE_PANEL_RIGHT` | 1 | $2264.0 \times 580.0 \times 18.0$ | $2264.0 \times 579.0 \times 18.0$ | 1.0mm / 0.0mm / 0.0mm / 0.0mm | $[1782..1800, 118..2382, 20..600]$ |
| `CARC_DIV_01` | `DIVIDER_PANEL` | 1 | $2264.0 \times 560.0 \times 18.0$ | $2264.0 \times 559.0 \times 18.0$ | 1.0mm / 0.0mm / 0.0mm / 0.0mm | $[891..909, 118..2382, 20..580]$ |
| `SHELF_FIX_L1` | `FIXED_SHELF` | 1 | $873.0 \times 560.0 \times 18.0$ | $873.0 \times 559.0 \times 18.0$ | 1.0mm / 0.0mm / 0.0mm / 0.0mm | $[18..891, 2014..2032, 20..580]$ |
| `SHELF_FIX_R1` | `FIXED_SHELF` | 1 | $873.0 \times 560.0 \times 18.0$ | $873.0 \times 559.0 \times 18.0$ | 1.0mm / 0.0mm / 0.0mm / 0.0mm | $[909..1782, 2014..2032, 20..580]$ |
| `SHELF_ADJ_R2` | `ADJUSTABLE_SHELF` | 1 | $871.0 \times 550.0 \times 18.0$ | $869.0 \times 549.0 \times 18.0$ | 1.0mm / 0.0mm / 1.0mm / 1.0mm | $[910..1781, 628..646, 25..575]$ |
| `SHELF_ADJ_R3` | `ADJUSTABLE_SHELF` | 1 | $871.0 \times 550.0 \times 18.0$ | $869.0 \times 549.0 \times 18.0$ | 1.0mm / 0.0mm / 1.0mm / 1.0mm | $[910..1781, 996..1014, 25..575]$ |
| `BACK_PANEL_01`| `BACK_PANEL` | 1 | $2276.0 \times 1776.0 \times 6.0$ | $2276.0 \times 1776.0 \times 6.0$ | 0.0mm / 0.0mm / 0.0mm / 0.0mm | $[12..1788, 112..2388, 586.5..592.5]$ |
| `DOOR_01` | `DOOR_PANEL` | 1 | $2296.0 \times 447.5 \times 18.0$ | $2294.0 \times 445.5 \times 18.0$ | 1.0mm / 1.0mm / 1.0mm / 1.0mm | $[2..449.5, 102..2398, 0..18]$ |
| `DOOR_02` | `DOOR_PANEL` | 1 | $2296.0 \times 447.5 \times 18.0$ | $2294.0 \times 445.5 \times 18.0$ | 1.0mm / 1.0mm / 1.0mm / 1.0mm | $[451.5..899, 102..2398, 0..18]$ |
| `DOOR_03` | `DOOR_PANEL` | 1 | $2296.0 \times 447.5 \times 18.0$ | $2294.0 \times 445.5 \times 18.0$ | 1.0mm / 1.0mm / 1.0mm / 1.0mm | $[901..1348.5, 102..2398, 0..18]$ |
| `DOOR_04` | `DOOR_PANEL` | 1 | $2296.0 \times 447.5 \times 18.0$ | $2294.0 \times 445.5 \times 18.0$ | 1.0mm / 1.0mm / 1.0mm / 1.0mm | $[1350.5..1798, 102..2398, 0..18]$ |
| `PLINTH_FRONT` | `PLINTH_FRONT_FASCIA` | 1 | $1700.0 \times 100.0 \times 18.0$ | $1698.0 \times 99.0 \times 18.0$ | 1.0mm / 0.0mm / 1.0mm / 1.0mm | $[50..1750, 0..100, 70..88]$ |
| `PLINTH_REAR` | `PLINTH_REAR_RAIL` | 1 | $1700.0 \times 100.0 \times 18.0$ | $1700.0 \times 100.0 \times 18.0$ | 0.0mm / 0.0mm / 0.0mm / 0.0mm | $[50..1750, 0..100, 562..580]$ |
| `PLINTH_SIDE_L`| `PLINTH_SIDE_RETURN_LEFT` | 1 | $474.0 \times 100.0 \times 18.0$ | $474.0 \times 99.0 \times 18.0$ | 1.0mm / 0.0mm / 0.0mm / 0.0mm | $[50..68, 0..100, 88..562]$ |
| `PLINTH_SIDE_R`| `PLINTH_SIDE_RETURN_RIGHT`| 1 | $474.0 \times 100.0 \times 18.0$ | $474.0 \times 99.0 \times 18.0$ | 1.0mm / 0.0mm / 0.0mm / 0.0mm | $[1732..1750, 0..100, 88..562]$ |
| `PLINTH_CROSS_C`| `PLINTH_CROSS_STRETCHER` | 1 | $474.0 \times 100.0 \times 18.0$ | $474.0 \times 100.0 \times 18.0$ | 0.0mm / 0.0mm / 0.0mm / 0.0mm | $[891..909, 0..100, 88..562]$ |

---

## 4. Edge-Banding Reconciliation Formula

For every rectangular panel:
$$\begin{aligned}
\text{Raw Length} &= \text{Finished Length} - (\text{WIDTH\_EDGE\_1} + \text{WIDTH\_EDGE\_2}) \\
\text{Raw Width} &= \text{Finished Width} - (\text{LENGTH\_EDGE\_1} + \text{LENGTH\_EDGE\_2}) \\
\text{Raw Thickness} &= \text{Finished Thickness}
\end{aligned}$$

---

## 5. Collision & Joinery Engagement Rules

- **Intentional Joinery Engagement (Permitted):** `BACK_PANEL_01` engages $6.0\text{ mm}$ ($60\text{ dmm}$) into the $7.0\text{ mm}$ ($70\text{ dmm}$) grooves of `CARC_TOP`, `CARC_BOT`, `CARC_SIDE_L`, and `CARC_SIDE_R`.
- **Touching Coplanar Faces (Permitted):** Panels resting face-to-face (e.g. `CARC_SIDE_L` bottom face resting on `CARC_BOT` top face).
- **Unintended Volume Intersections (Disallowed):** Any other 3D overlap produces an `UNINTENDED_PART_COLLISION` error.
