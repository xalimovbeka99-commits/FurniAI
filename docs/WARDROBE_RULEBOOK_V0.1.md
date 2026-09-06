# FurniAI Wardrobe Rulebook v0.1 — Calibrated Benchmark (Revision 1)

> **WORKSHOP-REVIEW SPECIFICATION — NOT CNC-QUALIFIED**
>
> This document defines the canonical mathematical oracle and construction rules for the FurniAI Wardrobe Alpha vertical slice. It contains verified workshop-review geometry and deterministic formulas. Physical factory CNC production export remains strictly disabled until machine-specific post-processor qualification (Gate G8).

**Status:** `BEKZOD_APPROVED` (Workshop Authority Sign-Off)  
**Milestone:** G1.1-R1 — Corrected Golden Wardrobe Benchmark Oracle
**Base SHA:** `cf87a27`
**Scope:** Single Straight Hinged Wardrobe (Deterministic Test Oracle)  

---

## 1. Global Coordinate System Convention

The global coordinate system $(X, Y, Z)$ is right-handed and defined with an unambiguous origin $(0, 0, 0)$ at the **Bottom-Left-Front** corner of the finished wardrobe envelope:

```
                  +Y (Up: 0 to 2400.0 mm)
                   ▲
                   │
                   │
                   │       +Z (Rearward: 0 to 600.0 mm)
                   │      ↗
                   │     ╱
                   │    ╱
(0, 0, 0) [Origin] └───┴────────────────────────► +X (Right: 0 to 1800.0 mm)
[Floor, Finished Front-Left]
```

### Primary Axis Definitions:
- **$+X$ Axis (Width):** Horizontal axis pointing from Left $(X = 0.0\text{ mm})$ to Right $(X = +1800.0\text{ mm})$.
- **$+Y$ Axis (Height):** Vertical axis pointing upward from Floor $(Y = 0.0\text{ mm})$ through Plinth Top $(Y = +100.0\text{ mm})$ to Carcass Top $(Y = +2400.0\text{ mm})$.
- **$+Z$ Axis (Depth):** Horizontal axis pointing rearward from Finished Front Door Face $(Z = 0.0\text{ mm})$ to Finished Carcass Rear $(Z = +600.0\text{ mm})$.

### Depth Allocation Breakdown (Z-Axis Closure):
$$\begin{aligned}
Z \in [0.0, 18.0]\text{ mm} &: \text{Finished Front Doors (Thickness } = 18.0\text{ mm)} \\
Z \in [18.0, 20.0]\text{ mm} &: \text{Door Bumper / Operating Air Gap (Thickness } = 2.0\text{ mm)} \\
Z = 20.0\text{ mm} &: \mathbf{\text{Finished Carcass Front Datum}} \\
Z \in [20.0, 600.0]\text{ mm} &: \text{Carcass Body Depth (Depth } = 580.0\text{ mm)} \\
Z = 600.0\text{ mm} &: \mathbf{\text{Finished Carcass Rear Datum}} \\
\hline
\mathbf{\text{Total Overall Depth}} &= \mathbf{600.0\text{ mm}} \quad (\text{Exact Closure, Zero Negative Coordinates})
\end{aligned}$$

---

## 2. Definitive Construction Rules (No Ranges)

| Rule ID | Parameter | Calibrated Value | Rule Details & Workshop Logic |
|---|---|---|---|
| **WR-001** | Carcass Style | **Cap Style (Style B)** | Top panel $(1800\times 580\times 18)$ and Bottom panel $(1800\times 580\times 18)$ cap the outer sides and center divider. Outer sides are $2264.0\text{ mm}$ high. |
| **WR-002** | Center Divider | **Internal Style A** | Sits inside between Top and Bottom panels. Height = $2264.0\text{ mm}$, Depth = $560.0\text{ mm}$ ($Z \in [20.0, 580.0]$). Front edge is flush with carcass front datum $(Z = 20.0)$; rear edge stops $6.0\text{ mm}$ before the back groove front edge $(Z = 586.0)$ to provide clear clearance. |
| **WR-003** | Core Thicknesses | **18.0 mm / 6.0 mm** | Carcass panels, shelves, divider, doors, and plinth rails = **18.0 mm**. Back panel = **6.0 mm**. |
| **WR-004** | Back Groove Depth | **7.0 mm** | Machined into Top, Bottom, and both Outer Sides. Leaves $11.0\text{ mm}$ solid core on $18.0\text{ mm}$ panels. |
| **WR-005** | Back Groove Width | **7.0 mm** | Accommodates $6.0\text{ mm}$ back panel $+ 1.0\text{ mm}$ assembly glue gap. |
| **WR-006** | Back Groove Setback | **20.0 mm to rear face** | Measured from Carcass Rear Datum $(Z = 600.0\text{ mm})$ to the rear face of the groove $(Z = 593.0\text{ mm})$. Groove channel occupies $Z \in [586.0, 593.0]\text{ mm}$. |
| **WR-007** | Plinth Frame Alignment & Box | **Frame-Aligned Box** | Plinth structural box aligns with the carcass frame footprint ($X \in [0.0, 1800.0]\text{ mm}$, $Z \in [20.0, 600.0]\text{ mm}$, $Y \in [0.0, 100.0]\text{ mm}$). Front fascia sits at Carcass Front Datum ($Z = 20.0\text{ mm}$), rear rail at Carcass Rear Datum ($Z = 600.0\text{ mm}$). Full supporting box structure with front, rear, side returns, and center stretcher. |
| **WR-008** | Door Gaps / Reveals | **2.0 mm** | $2.0\text{ mm}$ perimeter reveals (Top, Bottom, Left, Right) and $2.0\text{ mm}$ vertical gaps between doors. |
| **WR-009** | System 32 Shelf Pins | **37 mm / 32 mm** | Semantic grid on 32mm pitch, 37mm edge setback. Exact drilling coordinates are `MACHINING_BLOCKED` pending Bekzod pin SKU sign-off. |
| **WR-010** | Hinge Hardware | **110° Concealed Hinge** | Semantic specification: 110° soft-close concealed clip-on hinge, $\varnothing 35.0\text{ mm}$ cup, $12.0\text{ mm}$ depth, 5 hinges per door. Exact production drilling is `MACHINING_BLOCKED` pending Bekzod SKU approval. |
| **WR-011** | Hinge Vertical Spacing | **5 Hinges per Door** | Door cup centers at local $V = [100.0, 624.0, 1148.0, 1672.0, 2196.0]\text{ mm}$. Aligns mathematically with carcass side reference heights. |
| **WR-012** | Hanging Rail Center | **100.0 mm down** | Centered at $Y = \text{underside of fixed shelf} - 100.0\text{ mm} = 1914.0\text{ mm}$, depth $Z = 300.0\text{ mm}$ (mid-depth of carcass opening). |
| **WR-013** | Edge-Banding Policy | **Finished vs Cut** | $\text{Cutting Dimension} = \text{Finished Dimension} - \sum(\text{Applied Edge Banding})$. Front visible edges receive $1.0\text{ mm}$ PVC; non-visible unbanded edges receive $0.0\text{ mm}$. |

---

## 3. Mathematical Reconciliation Proofs

### A. Width Closure Proof ($X$-Axis)
$$\begin{aligned}
\text{Left Outer Side Panel (`CARC_SIDE_L`)} &= 18.0\text{ mm} \\
\text{Left Bay Clear Opening} &= 873.0\text{ mm} \\
\text{Center Divider Panel (`CARC_DIV_01`)} &= 18.0\text{ mm} \\
\text{Right Bay Clear Opening} &= 873.0\text{ mm} \\
\text{Right Outer Side Panel (`CARC_SIDE_R`)} &= 18.0\text{ mm} \\
\hline
\mathbf{\text{Total Overall Width}} &= 18.0 + 873.0 + 18.0 + 873.0 + 18.0 = \mathbf{1800.0\text{ mm}} \quad (\text{Exact Closure})
\end{aligned}$$

### B. Height Closure Proof ($Y$-Axis)
$$\begin{aligned}
\text{Plinth Box (`PLINTH_*`)} &= 100.0\text{ mm} \quad (Y \in [0.0, 100.0]) \\
\text{Bottom Panel (`CARC_BOT`)} &= 18.0\text{ mm} \quad (Y \in [100.0, 118.0]) \\
\text{Internal Carcass Clear Opening} &= 2264.0\text{ mm} \quad (Y \in [118.0, 2382.0]) \\
\text{Top Panel (`CARC_TOP`)} &= 18.0\text{ mm} \quad (Y \in [2382.0, 2400.0]) \\
\hline
\mathbf{\text{Total Overall Height}} &= 100.0 + 18.0 + 2264.0 + 18.0 = \mathbf{2400.0\text{ mm}} \quad (\text{Exact Closure})
\end{aligned}$$

### C. Door Zone Width & Gap Closure Proof ($X$-Axis)
$$\begin{aligned}
\text{Left Outer Reveal} &= 2.0\text{ mm} \quad (X \in [0.0, 2.0]) \\
\text{Door 01 (`DOOR_01`)} &= 447.5\text{ mm} \quad (X \in [2.0, 449.5]) \\
\text{Gap 1-2} &= 2.0\text{ mm} \quad (X \in [449.5, 451.5]) \\
\text{Door 02 (`DOOR_02`)} &= 447.5\text{ mm} \quad (X \in [451.5, 899.0]) \\
\text{Center Reveal Gap} &= 2.0\text{ mm} \quad (X \in [899.0, 901.0]) \\
\text{Door 03 (`DOOR_03`)} &= 447.5\text{ mm} \quad (X \in [901.0, 1348.5]) \\
\text{Gap 3-4} &= 2.0\text{ mm} \quad (X \in [1348.5, 1350.5]) \\
\text{Door 04 (`DOOR_04`)} &= 447.5\text{ mm} \quad (X \in [1350.5, 1798.0]) \\
\text{Right Outer Reveal} &= 2.0\text{ mm} \quad (X \in [1798.0, 1800.0]) \\
\hline
\mathbf{\text{Total Door Front Width}} &= 2.0 + 447.5 + 2.0 + 447.5 + 2.0 + 447.5 + 2.0 + 447.5 + 2.0 = \mathbf{1800.0\text{ mm}} \quad (\text{Exact Closure})
\end{aligned}$$

### D. Door Zone Height & Gap Closure Proof ($Y$-Axis)
$$\begin{aligned}
\text{Plinth Height} &= 100.0\text{ mm} \quad (Y \in [0.0, 100.0]) \\
\text{Bottom Reveal Gap} &= 2.0\text{ mm} \quad (Y \in [100.0, 102.0]) \\
\text{Door Finished Height (`DOOR_01..04`)} &= 2296.0\text{ mm} \quad (Y \in [102.0, 2398.0]) \\
\text{Top Reveal Gap} &= 2.0\text{ mm} \quad (Y \in [2398.0, 2400.0]) \\
\hline
\mathbf{\text{Total Height Enclosure}} &= 100.0 + 2.0 + 2296.0 + 2.0 = \mathbf{2400.0\text{ mm}} \quad (\text{Exact Closure})
\end{aligned}$$

### E. Shelf Spacing & Clear Opening Proofs ($Y$-Axis)
- **Top Fixed Shelf (`SHELF_FIX_L1`, `SHELF_FIX_R1`):**
  - Underside of Carcass Top datum: $Y = 2382.0\text{ mm}$.
  - Top Shelf Upper Face: $Y = 2382.0 - 350.0 = 2032.0\text{ mm}$.
  - Top Shelf Lower Face: $Y = 2032.0 - 18.0 = 2014.0\text{ mm}$.
  - **Top Compartment Clear Opening:** $2382.0 - 2032.0 = \mathbf{350.0\text{ mm}}$ (Exact to approved spec).
- **Left Bay Long Hanging Zone:**
  - Hanging Rail Center: $Y = 2014.0 - 100.0 = 1914.0\text{ mm}$.
  - Carcass Bottom Upper Face: $Y = 118.0\text{ mm}$.
  - **Clear Vertical Hanging Drop:** $1914.0 - 118.0 = \mathbf{1796.0\text{ mm}}$ (Satisfies $>1400\text{ mm}$ requirement).
- **Right Bay Short Hanging & Adjustable Shelves:**
  - Short Hanging Rail Center: $Y = 1914.0\text{ mm}$.
  - Adjustable Shelf 2 (`SHELF_ADJ_R3`): Upper Face at $Y = 1914.0 - 900.0 = 1014.0\text{ mm}$, Lower Face at $Y = 996.0\text{ mm}$.
  - **Short Hanging Clear Drop:** $1914.0 - 1014.0 = \mathbf{900.0\text{ mm}}$ (Exact to approved spec).
  - Adjustable Shelf 1 (`SHELF_ADJ_R2`): Upper Face at $Y = 996.0 - 350.0 = 646.0\text{ mm}$, Lower Face at $Y = 628.0\text{ mm}$.
  - **Middle Shelf Clear Opening:** $996.0 - 646.0 = \mathbf{350.0\text{ mm}}$ (Exact to approved spec).
  - **Bottom Shelf Clear Opening:** $628.0 - 118.0 = \mathbf{510.0\text{ mm}}$ (Footwear / storage compartment).

### F. Back Panel Engagement & Tolerance Proof
- **Groove Channel Definition:** $Z \in [586.0, 593.0]\text{ mm}$ (Width = $7.0\text{ mm}$, Depth = $7.0\text{ mm}$).
- **Back Panel Placement:** $Z \in [586.5, 592.5]\text{ mm}$ (Thickness = $6.0\text{ mm}$, centered with $0.5\text{ mm}$ air gap per face).
- **Horizontal Engagement ($X$-Axis):**
  - Left Side inner face: $X = 18.0\text{ mm}$; Groove bottom: $X = 18.0 - 7.0 = 11.0\text{ mm}$.
  - Right Side inner face: $X = 1782.0\text{ mm}$; Groove bottom: $X = 1782.0 + 7.0 = 1789.0\text{ mm}$.
  - Back Panel Bounds: $X \in [12.0, 1788.0]\text{ mm}$ (Finished Width = $1776.0\text{ mm}$).
  - Left Engagement: $18.0 - 12.0 = \mathbf{6.0\text{ mm}}$ into 7.0mm groove; Left Expansion Gap: $12.0 - 11.0 = \mathbf{1.0\text{ mm}}$.
  - Right Engagement: $1788.0 - 1782.0 = \mathbf{6.0\text{ mm}}$ into 7.0mm groove; Right Expansion Gap: $1789.0 - 1788.0 = \mathbf{1.0\text{ mm}}$.
- **Vertical Engagement ($Y$-Axis):**
  - Bottom Panel inner face: $Y = 118.0\text{ mm}$; Groove bottom: $Y = 118.0 - 7.0 = 111.0\text{ mm}$.
  - Top Panel inner face: $Y = 2382.0\text{ mm}$; Groove bottom: $Y = 2382.0 + 7.0 = 2389.0\text{ mm}$.
  - Back Panel Bounds: $Y \in [112.0, 2388.0]\text{ mm}$ (Finished Height = $2276.0\text{ mm}$).
  - Bottom Engagement: $118.0 - 112.0 = \mathbf{6.0\text{ mm}}$ into 7.0mm groove; Bottom Expansion Gap: $112.0 - 111.0 = \mathbf{1.0\text{ mm}}$.
  - Top Engagement: $2388.0 - 2382.0 = \mathbf{6.0\text{ mm}}$ into 7.0mm groove; Top Expansion Gap: $2389.0 - 2388.0 = \mathbf{1.0\text{ mm}}$.
- **Conclusion:** Back panel engages exactly $6.0\text{ mm}$ into all four surrounding grooves and maintains an exact $1.0\text{ mm}$ thermal/assembly expansion gap at every groove root.

### G. Hinge Center Global Alignment Proof ($Y$-Axis)
Let Door Bottom be at Global $Y_{\text{door\_bot}} = 102.0\text{ mm}$.
Let Carcass Side Bottom be at Global $Y_{\text{side\_bot}} = 118.0\text{ mm}$.

$$\begin{aligned}
\text{Hinge 1:} \quad \text{Door } V_1 &= 100.0\text{ mm} \implies \text{Global } Y = 102.0 + 100.0 = \mathbf{202.0\text{ mm}} \\
\text{Side } V_1 &= 202.0 - 118.0 = \mathbf{84.0\text{ mm}} \implies \text{Global } Y = 118.0 + 84.0 = \mathbf{202.0\text{ mm}} \quad (\text{Exact Alignment}) \\
\\
\text{Hinge 2:} \quad \text{Door } V_2 &= 624.0\text{ mm} \implies \text{Global } Y = 102.0 + 624.0 = \mathbf{726.0\text{ mm}} \\
\text{Side } V_2 &= 726.0 - 118.0 = \mathbf{608.0\text{ mm}} \implies \text{Global } Y = 118.0 + 608.0 = \mathbf{726.0\text{ mm}} \quad (\text{Exact Alignment}) \\
\\
\text{Hinge 3:} \quad \text{Door } V_3 &= 1148.0\text{ mm} \implies \text{Global } Y = 102.0 + 1148.0 = \mathbf{1250.0\text{ mm}} \\
\text{Side } V_3 &= 1250.0 - 118.0 = \mathbf{1132.0\text{ mm}} \implies \text{Global } Y = 118.0 + 1132.0 = \mathbf{1250.0\text{ mm}} \quad (\text{Exact Alignment}) \\
\\
\text{Hinge 4:} \quad \text{Door } V_4 &= 1672.0\text{ mm} \implies \text{Global } Y = 102.0 + 1672.0 = \mathbf{1774.0\text{ mm}} \\
\text{Side } V_4 &= 1774.0 - 118.0 = \mathbf{1656.0\text{ mm}} \implies \text{Global } Y = 118.0 + 1656.0 = \mathbf{1774.0\text{ mm}} \quad (\text{Exact Alignment}) \\
\\
\text{Hinge 5:} \quad \text{Door } V_5 &= 2196.0\text{ mm} \implies \text{Global } Y = 102.0 + 2196.0 = \mathbf{2298.0\text{ mm}} \\
\text{Side } V_5 &= 2298.0 - 118.0 = \mathbf{2180.0\text{ mm}} \implies \text{Global } Y = 118.0 + 2180.0 = \mathbf{2298.0\text{ mm}} \quad (\text{Exact Alignment})
\end{aligned}$$

---

## 4. Part-Local Coordinate System Definition

Every rectangular part defines its own right-handed local coordinate frame $(U, V, W)$:
- **$+U$ (Length Axis):** Runs along the primary dimension $L \in [0.0, L_{\text{finished}}]$.
- **$+V$ (Width Axis):** Runs along the secondary dimension $W \in [0.0, W_{\text{finished}}]$.
- **$+W$ (Thickness Axis):** Runs through the material thickness $T \in [0.0, T_{\text{finished}}]$.

### Edge Identification Standard:
- `LENGTH_EDGE_1`: Edge along $U$ at $V = 0.0\text{ mm}$ (e.g. Front finished edge).
- `LENGTH_EDGE_2`: Edge along $U$ at $V = W_{\text{finished}}$ (e.g. Rear edge).
- `WIDTH_EDGE_1`: Edge along $V$ at $U = 0.0\text{ mm}$ (e.g. Left / Bottom edge).
- `WIDTH_EDGE_2`: Edge along $V$ at $U = L_{\text{finished}}$ (e.g. Right / Top edge).

---

## 5. Complete PartGraph Oracle (Exact Physical Part Count: 25)

### Table 5.1 — Master Panel Schedule & Edge-Banding Oracle

| Part ID | Description | Qty | Material | Finished Dim $(L \times W \times T)$ | Cutting Dim $(L \times W \times T)$ | Edge Banding Policy (`LE1 / LE2 / WE1 / WE2`) | Status |
|---|---|---|---|---|---|---|---|
| `CARC_TOP` | Top Cap Panel | 1 | 18mm Melamine | $1800.0 \times 580.0 \times 18.0$ | $1798.0 \times 579.0 \times 18.0$ | 1.0mm / 0.0mm / 1.0mm / 1.0mm | `APPROVED` |
| `CARC_BOT` | Bottom Base Panel | 1 | 18mm Melamine | $1800.0 \times 580.0 \times 18.0$ | $1798.0 \times 579.0 \times 18.0$ | 1.0mm / 0.0mm / 1.0mm / 1.0mm | `APPROVED` |
| `CARC_SIDE_L` | Left Outer Side | 1 | 18mm Melamine | $2264.0 \times 580.0 \times 18.0$ | $2264.0 \times 579.0 \times 18.0$ | 1.0mm / 0.0mm / 0.0mm / 0.0mm | `APPROVED` |
| `CARC_SIDE_R` | Right Outer Side | 1 | 18mm Melamine | $2264.0 \times 580.0 \times 18.0$ | $2264.0 \times 579.0 \times 18.0$ | 1.0mm / 0.0mm / 0.0mm / 0.0mm | `APPROVED` |
| `CARC_DIV_01` | Center Divider | 1 | 18mm Melamine | $2264.0 \times 560.0 \times 18.0$ | $2264.0 \times 559.0 \times 18.0$ | 1.0mm / 0.0mm / 0.0mm / 0.0mm | `APPROVED` |
| `SHELF_FIX_L1` | Top Fixed Shelf (Left) | 1 | 18mm Melamine | $873.0 \times 560.0 \times 18.0$ | $873.0 \times 559.0 \times 18.0$ | 1.0mm / 0.0mm / 0.0mm / 0.0mm | `APPROVED` |
| `SHELF_FIX_R1` | Top Fixed Shelf (Right)| 1 | 18mm Melamine | $873.0 \times 560.0 \times 18.0$ | $873.0 \times 559.0 \times 18.0$ | 1.0mm / 0.0mm / 0.0mm / 0.0mm | `APPROVED` |
| `SHELF_ADJ_R2` | Adj Shelf 1 (Right) | 1 | 18mm Melamine | $871.0 \times 550.0 \times 18.0$ | $869.0 \times 549.0 \times 18.0$ | 1.0mm / 0.0mm / 1.0mm / 1.0mm | `APPROVED` |
| `SHELF_ADJ_R3` | Adj Shelf 2 (Right) | 1 | 18mm Melamine | $871.0 \times 550.0 \times 18.0$ | $869.0 \times 549.0 \times 18.0$ | 1.0mm / 0.0mm / 1.0mm / 1.0mm | `APPROVED` |
| `BACK_PANEL_01`| Back Panel | 1 | 6mm HDF | $2276.0 \times 1776.0 \times 6.0$ | $2276.0 \times 1776.0 \times 6.0$ | 0.0mm / 0.0mm / 0.0mm / 0.0mm | `APPROVED` |
| `DOOR_01` | Hinged Door 1 (Far Left)| 1 | 18mm Melamine | $2296.0 \times 447.5 \times 18.0$ | $2294.0 \times 445.5 \times 18.0$ | 1.0mm / 1.0mm / 1.0mm / 1.0mm | `APPROVED` |
| `DOOR_02` | Hinged Door 2 (Mid Left)| 1 | 18mm Melamine | $2296.0 \times 447.5 \times 18.0$ | $2294.0 \times 445.5 \times 18.0$ | 1.0mm / 1.0mm / 1.0mm / 1.0mm | `APPROVED` |
| `DOOR_03` | Hinged Door 3 (Mid Right)| 1 | 18mm Melamine | $2296.0 \times 447.5 \times 18.0$ | $2294.0 \times 445.5 \times 18.0$ | 1.0mm / 1.0mm / 1.0mm / 1.0mm | `APPROVED` |
| `DOOR_04` | Hinged Door 4 (Far Right)| 1 | 18mm Melamine | $2296.0 \times 447.5 \times 18.0$ | $2294.0 \times 445.5 \times 18.0$ | 1.0mm / 1.0mm / 1.0mm / 1.0mm | `APPROVED` |
| `PLINTH_FRONT` | Front Plinth Fascia | 1 | 18mm Melamine | $1800.0 \times 100.0 \times 18.0$ | $1798.0 \times 99.0 \times 18.0$ | 1.0mm / 0.0mm / 1.0mm / 1.0mm | `APPROVED` |
| `PLINTH_REAR` | Rear Plinth Rail | 1 | 18mm Melamine | $1800.0 \times 100.0 \times 18.0$ | $1800.0 \times 100.0 \times 18.0$ | 0.0mm / 0.0mm / 0.0mm / 0.0mm | `APPROVED` |
| `PLINTH_SIDE_L`| Left Plinth Return Rail| 1 | 18mm Melamine | $544.0 \times 100.0 \times 18.0$ | $544.0 \times 99.0 \times 18.0$ | 1.0mm / 0.0mm / 0.0mm / 0.0mm | `APPROVED` |
| `PLINTH_SIDE_R`| Right Plinth Return Rail| 1 | 18mm Melamine | $544.0 \times 100.0 \times 18.0$ | $544.0 \times 99.0 \times 18.0$ | 1.0mm / 0.0mm / 0.0mm / 0.0mm | `APPROVED` |
| `PLINTH_CROSS_C`| Center Plinth Stretcher | 1 | 18mm Melamine | $544.0 \times 100.0 \times 18.0$ | $544.0 \times 100.0 \times 18.0$ | 0.0mm / 0.0mm / 0.0mm / 0.0mm | `APPROVED` |
| `RAIL_TUBE_L` | Left Hanging Oval Rail | 1 | Chrome Steel Tube | $869.0 \times 30.0 \times 15.0$ | $869.0 \times 30.0 \times 15.0$ | Hardware profile | `APPROVED` |
| `RAIL_TUBE_R` | Right Hanging Oval Rail| 1 | Chrome Steel Tube | $869.0 \times 30.0 \times 15.0$ | $869.0 \times 30.0 \times 15.0$ | Hardware profile | `APPROVED` |
| `RAIL_BRACKET_L1`| Left Bay Left Bracket | 1 | Diecast Zinc Flange | $45.0 \times 20.0 \times 12.0$ | $45.0 \times 20.0 \times 12.0$ | Hardware fitting | `APPROVED` |
| `RAIL_BRACKET_L2`| Left Bay Right Bracket| 1 | Diecast Zinc Flange | $45.0 \times 20.0 \times 12.0$ | $45.0 \times 20.0 \times 12.0$ | Hardware fitting | `APPROVED` |
| `RAIL_BRACKET_R1`| Right Bay Left Bracket | 1 | Diecast Zinc Flange | $45.0 \times 20.0 \times 12.0$ | $45.0 \times 20.0 \times 12.0$ | Hardware fitting | `APPROVED` |
| `RAIL_BRACKET_R2`| Right Bay Right Bracket| 1 | Diecast Zinc Flange | $45.0 \times 20.0 \times 12.0$ | $45.0 \times 20.0 \times 12.0$ | Hardware fitting | `APPROVED` |

---

### Table 5.2 — Exact Global 3D Placement Coordinates (Bounding Box Min/Max)

| Part ID | $X_{\min}$ | $X_{\max}$ | $Y_{\min}$ | $Y_{\max}$ | $Z_{\min}$ | $Z_{\max}$ |
|---|---|---|---|---|---|---|
| `PLINTH_FRONT` | 0.0 | 1800.0 | 0.0 | 100.0 | 20.0 | 38.0 |
| `PLINTH_REAR` | 0.0 | 1800.0 | 0.0 | 100.0 | 582.0 | 600.0 |
| `PLINTH_SIDE_L` | 0.0 | 18.0 | 0.0 | 100.0 | 38.0 | 582.0 |
| `PLINTH_SIDE_R` | 1782.0 | 1800.0 | 0.0 | 100.0 | 38.0 | 582.0 |
| `PLINTH_CROSS_C` | 891.0 | 909.0 | 0.0 | 100.0 | 38.0 | 582.0 |
| `CARC_BOT` | 0.0 | 1800.0 | 100.0 | 118.0 | 20.0 | 600.0 |
| `CARC_SIDE_L` | 0.0 | 18.0 | 118.0 | 2382.0 | 20.0 | 600.0 |
| `CARC_SIDE_R` | 1782.0 | 1800.0 | 118.0 | 2382.0 | 20.0 | 600.0 |
| `CARC_DIV_01` | 891.0 | 909.0 | 118.0 | 2382.0 | 20.0 | 580.0 |
| `CARC_TOP` | 0.0 | 1800.0 | 2382.0 | 2400.0 | 20.0 | 600.0 |
| `SHELF_FIX_L1` | 18.0 | 891.0 | 2014.0 | 2032.0 | 20.0 | 580.0 |
| `SHELF_FIX_R1` | 909.0 | 1782.0 | 2014.0 | 2032.0 | 20.0 | 580.0 |
| `SHELF_ADJ_R2` | 910.0 | 1781.0 | 628.0 | 646.0 | 25.0 | 575.0 |
| `SHELF_ADJ_R3` | 910.0 | 1781.0 | 996.0 | 1014.0 | 25.0 | 575.0 |
| `BACK_PANEL_01` | 12.0 | 1788.0 | 112.0 | 2388.0 | 586.5 | 592.5 |
| `DOOR_01` | 2.0 | 449.5 | 102.0 | 2398.0 | 0.0 | 18.0 |
| `DOOR_02` | 451.5 | 899.0 | 102.0 | 2398.0 | 0.0 | 18.0 |
| `DOOR_03` | 901.0 | 1348.5 | 102.0 | 2398.0 | 0.0 | 18.0 |
| `DOOR_04` | 1350.5 | 1798.0 | 102.0 | 2398.0 | 0.0 | 18.0 |
| `RAIL_TUBE_L` | 19.0 | 890.0 | 1899.0 | 1929.0 | 292.5 | 307.5 |
| `RAIL_TUBE_R` | 910.0 | 1781.0 | 1899.0 | 1929.0 | 292.5 | 307.5 |
| `RAIL_BRACKET_L1`| 18.0 | 19.0 | 1891.5 | 1936.5 | 290.0 | 310.0 |
| `RAIL_BRACKET_L2`| 890.0 | 891.0 | 1891.5 | 1936.5 | 290.0 | 310.0 |
| `RAIL_BRACKET_R1`| 909.0 | 910.0 | 1891.5 | 1936.5 | 290.0 | 310.0 |
| `RAIL_BRACKET_R2`| 1781.0 | 1782.0 | 1891.5 | 1936.5 | 290.0 | 310.0 |

---

## 6. Machining Operations Registry & Status

Every machining operation carries an unambiguous status:
- **`APPROVED`**: Geometry, tooling parameters, and coordinate transformations are mathematically proven and authorized.
- **`BLOCKED`**: Hardware SKU or drilling standard is pending Bekzod workshop confirmation. Production drilling output remains disabled.

### Table 6.1 — Semantic Operations Master List

| Operation ID | Host Part ID | Operation Type | Face / Vector | Geometric Parameters | Local Coordinate / Formula | Status |
|---|---|---|---|---|---|---|
| `OP_GRV_SIDE_L` | `CARC_SIDE_L` | `BACK_GROOVE` | Inner Face $(+W)$, Normal: $(+1,0,0)$ | Width: $7.0\text{ mm}$, Depth: $7.0\text{ mm}$ | $V \in [566.0, 573.0]\text{ mm}$, runs full $U \in [0.0, 2264.0]$ | `APPROVED` |
| `OP_GRV_SIDE_R` | `CARC_SIDE_R` | `BACK_GROOVE` | Inner Face $(+W)$, Normal: $(-1,0,0)$ | Width: $7.0\text{ mm}$, Depth: $7.0\text{ mm}$ | $V \in [566.0, 573.0]\text{ mm}$, runs full $U \in [0.0, 2264.0]$ | `APPROVED` |
| `OP_GRV_TOP` | `CARC_TOP` | `BACK_GROOVE` | Lower Face $(+W)$, Normal: $(0,-1,0)$ | Width: $7.0\text{ mm}$, Depth: $7.0\text{ mm}$ | $V \in [566.0, 573.0]\text{ mm}$, runs $U \in [18.0, 1782.0]$ | `APPROVED` |
| `OP_GRV_BOT` | `CARC_BOT` | `BACK_GROOVE` | Upper Face $(+W)$, Normal: $(0,+1,0)$ | Width: $7.0\text{ mm}$, Depth: $7.0\text{ mm}$ | $V \in [566.0, 573.0]\text{ mm}$, runs $U \in [18.0, 1782.0]$ | `APPROVED` |
| `OP_HNG_CUP_01..05`| `DOOR_01..04`| `HINGE_CUP` | Rear Face $(+W)$, Normal: $(0,0,+1)$ | $\varnothing 35.0\text{ mm} \times 12.0\text{ mm}$ | $V = 21.5\text{ mm}$; $U = [100.0, 624.0, 1148.0, 1672.0, 2196.0]$ | `BLOCKED` (`HARDWARE_SKU_PENDING_BEKZOD_CONFIRMATION`) |
| `OP_HNG_PLT_01..05`| `CARC_SIDE_L/R/DIV`| `MOUNTING_PLATE_BORE`| Inner Face $(+W)$ | $\varnothing 5.0\text{ mm} \times 12.0\text{ mm}$ | $V = 37.0\text{ mm}$; $U = [84.0, 608.0, 1132.0, 1656.0, 2180.0]$ | `BLOCKED` (`HARDWARE_SKU_PENDING_BEKZOD_CONFIRMATION`) |
| `OP_PIN_GRID_R` | `CARC_SIDE_R`, `CARC_DIV_01` | `SHELF_PIN_BORE` | Inner Face $(+W)$ | $\varnothing 5.0\text{ mm} \times 13.0\text{ mm}$ | $V = 37.0\text{ mm} \ \& \ 523.0\text{ mm}$; $U \in [400.0 \dots 1200.0\text{ step }32.0]$ | `BLOCKED` (`HARDWARE_SKU_PENDING_BEKZOD_CONFIRMATION`) |
| `OP_JNT_DOWEL` | `CARC_*`, `SHELF_*` | `DOWEL_BORE` | Joint Edges | $\varnothing 8.0\text{ mm} \times 30.0\text{ mm}$ | Standard 32mm spacing | `BLOCKED` (`HARDWARE_SKU_PENDING_BEKZOD_CONFIRMATION`) |
| `OP_JNT_CONFIRMAT`| `CARC_*`, `SHELF_*` | `CONFIRMAT_PILOT_BORE`| Joint Edges | $\varnothing 5.0\text{ mm} \times 50.0\text{ mm}$ | Standard 32mm spacing | `BLOCKED` (`HARDWARE_SKU_PENDING_BEKZOD_CONFIRMATION`) |
| `OP_RAIL_FLANGE` | `CARC_SIDE_L/R`, `CARC_DIV_01`| `HANGING_RAIL_BORE`| Inner Face $(+W)$ | $\varnothing 5.0\text{ mm} \times 12.0\text{ mm}$ | $V = 280.0\text{ mm}$; $U = 1796.0\text{ mm}$ | `BLOCKED` (`HARDWARE_SKU_PENDING_BEKZOD_CONFIRMATION`) |

---

## 7. Gate G2 Architectural Invariants

The Gate G2 deterministic rectangular kernel must strictly enforce the following invariants on every generated PartGraph:

1. **Deterministic Output:** Identical input specification JSON must yield byte-for-byte identical PartGraph data structures.
2. **Unique Stable Identifiers:** Every part and machining operation must carry a globally unique, immutable string ID.
3. **Strict Positive Bounding Geometry:** All dimensions $(L, W, T)$ must be strictly positive real numbers ($> 0.0$).
4. **Collision & Overlap Prevention:** No solid panels may intersect or occupy overlapping 3D space.
5. **Canonical Integer/Decimal Millimetres:** Millimetres are the sole authoritative internal unit. Floating-point coordinates preserve up to 3 decimal places without arbitrary truncation.
6. **Referential Integrity:** Every machining operation must resolve to an existing valid host `Part ID`.
7. **Hardware Safety Interlock:** Any operation marked `BLOCKED` must never produce CNC drilling commands or unverified toolpaths.
8. **Reversible Coordinate Mappings:** Forward and inverse transformations between Part-Local $(U, V, W)$ and Global $(X, Y, Z)$ coordinate spaces must evaluate with $< 10^{-6}\text{ mm}$ mathematical drift.
