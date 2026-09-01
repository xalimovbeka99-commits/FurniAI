# FurniAI Wardrobe Rulebook v0.1 — Calibrated Benchmark

**Status:** `BEKZOD_APPROVED` (Workshop Authority Sign-Off)  
**Milestone:** G1.1 — Golden Wardrobe Mathematical Calibration  
**Base SHA:** `9f726b9c571b0a0d45d421dfc3d183dabc29a5c1`  
**Scope:** Single Straight Hinged Wardrobe (Deterministic Test Oracle)  

---

## 1. Global Coordinate System Convention

The global origin $(0, 0, 0)$ is fixed at the **Bottom-Left-Front** corner of the wardrobe envelope at floor level:

```
                  +Y (Up: 0 to 2400 mm)
                   ▲
                   │
                   │
                   │       +Z (Rearward: 0 to 600 mm)
                   │      ↗
                   │     ╱
                   │    ╱
(0, 0, 0) [Origin] └───┴────────────────────────► +X (Right: 0 to 1800 mm)
[Floor, Front-Left]
```

- **$+X$ Axis (Width):** Horizontal, from Left $(X = 0)$ to Right $(X = +1800\text{ mm})$.
- **$+Y$ Axis (Height):** Vertical, from Floor $(Y = 0)$ to Plinth Top $(Y = +100\text{ mm})$ to Carcass Top $(Y = +2400\text{ mm})$.
- **$+Z$ Axis (Depth):** Horizontal front-to-back, from Carcass Front Face $(Z = 0)$ to Carcass Rear Edge $(Z = +580\text{ mm})$ to Overall Envelope Rear $(Z = +600\text{ mm})$.

---

## 2. Definitive Construction Rules (No Ranges)

| Rule ID | Parameter | Calibrated Value | Rule Details & Workshop Logic |
|---|---|---|---|
| **WR-001** | Carcass Style | **Cap Style (Style B)** | Top panel $(1800\times 580\times 18)$ and Bottom panel $(1800\times 580\times 18)$ cap the outer sides and divider. Outer sides are $2264\text{ mm}$ high. |
| **WR-002** | Center Divider | **Internal Style A** | Sits inside between Top and Bottom panels. Height = $2264\text{ mm}$, Depth = $560\text{ mm}$ (front flush with carcass, leaves $20\text{ mm}$ rear clearance before back groove). |
| **WR-003** | Core Thicknesses | **18 mm / 6 mm** | Carcass, shelves, dividers, doors, drawer fronts, plinth = **18 mm**. Back panel = **6 mm**. |
| **WR-004** | Back Groove Depth | **7.0 mm** | Machined into Top, Bottom, and both Outer Sides. Leaves $11.0\text{ mm}$ solid core. |
| **WR-005** | Back Groove Width | **7.0 mm** | $6.0\text{ mm}$ back panel $+ 1.0\text{ mm}$ assembly glue gap. |
| **WR-006** | Back Groove Setback | **20.0 mm** | Measured from the rear edge $(Z = 580\text{ mm})$. Groove center is at $Z = 580 - 20 - 3.5 = 556.5\text{ mm}$. |
| **WR-007** | Plinth Elevation | **100.0 mm** | Base height = $100\text{ mm}$. Plinth front is aligned with the carcass frame front face $(Z = 0)$. |
| **WR-008** | Door Gaps / Reveals | **2.0 mm** | $2.0\text{ mm}$ gap around all outer perimeter edges and between adjacent doors (for standard 18mm doors). |
| **WR-009** | System 32 Drilling | **37 mm / 32 mm** | Front and rear drilling lines at $37.0\text{ mm}$ from panel edges; vertical pitch = $32.0\text{ mm}$; hole diameter = $\varnothing 5.0\text{ mm}$, depth = $13.0\text{ mm}$. |
| **WR-010** | Hinge Hardware | **Blum 110°** | Blum CLIP top BLUMOTION 110° (71B3550): $\varnothing 35.0\text{ mm}$ cup, $12.0\text{ mm}$ depth, $21.5\text{ mm}$ cup center from door edge ($4.0\text{ mm}$ tab). |
| **WR-011** | Hinge Offsets | **100.0 mm / 5 Hinges** | Top and bottom hinges at $100.0\text{ mm}$ from door ends. 5 hinges per door for $2296\text{ mm}$ door height. |
| **WR-012** | Hanging Rail Center | **100.0 mm** down | Centered at $Y = \text{underside of shelf} - 100\text{ mm}$, depth $Z = 280\text{ mm}$ (mid-depth of interior bay). |
| **WR-013** | Edge-Banding Policy | **Finished vs Cut** | $\text{Cutting Dimension} = \text{Finished Dimension} - \text{Edge Banding Thickness}$. Front edges receive $1.0\text{ mm}$ PVC lipping. |

---

## 3. Golden Wardrobe Reference Specification

### Overall Envelope Dimensions
- **Total Width ($X$):** $1800.0\text{ mm}$
- **Total Height ($Y$):** $2400.0\text{ mm}$ ($100.0\text{ mm}$ Plinth $+ 2300.0\text{ mm}$ Carcass)
- **Total Depth ($Z$):** $600.0\text{ mm}$ ($580.0\text{ mm}$ Carcass $+ 18.0\text{ mm}$ Door $+ 2.0\text{ mm}$ Bumper Gap)
- **Configuration:** 2 Equal Bays, 4 Hinged Doors (2 pairs).

### Arithmetic Reconciliation Proofs

#### A. Width Closure Proof
$$\begin{aligned}
\text{Left Side Thickness} &= 18.0\text{ mm} \\
\text{Left Bay Clear Width} &= 873.0\text{ mm} \\
\text{Center Divider Thickness} &= 18.0\text{ mm} \\
\text{Right Bay Clear Width} &= 873.0\text{ mm} \\
\text{Right Side Thickness} &= 18.0\text{ mm} \\
\hline
\mathbf{\text{Total Width}} &= 18.0 + 873.0 + 18.0 + 873.0 + 18.0 = \mathbf{1800.0\text{ mm}} \quad (\text{Exact Closure})
\end{aligned}$$

#### B. Height Closure Proof
$$\begin{aligned}
\text{Plinth Height} &= 100.0\text{ mm} \\
\text{Bottom Panel Thickness} &= 18.0\text{ mm} \\
\text{Internal Carcass Clear Height} &= 2264.0\text{ mm} \\
\text{Top Panel Thickness} &= 18.0\text{ mm} \\
\hline
\mathbf{\text{Overall Height}} &= 100.0 + 18.0 + 2264.0 + 18.0 = \mathbf{2400.0\text{ mm}} \quad (\text{Exact Closure})
\end{aligned}$$

#### C. Door Width & Gap Closure Proof
$$\begin{aligned}
\text{Number of Doors} &= 4 \\
\text{Door Width} &= 447.5\text{ mm} \quad (\times 4 = 1790.0\text{ mm}) \\
\text{Number of Vertical Gaps} &= 5 \quad (\text{Left reveal, Door 1-2, Center, Door 3-4, Right reveal}) \\
\text{Gap Width} &= 2.0\text{ mm} \quad (\times 5 = 10.0\text{ mm}) \\
\hline
\mathbf{\text{Total Door Zone Width}} &= 1790.0 + 10.0 = \mathbf{1800.0\text{ mm}} \quad (\text{Exact Closure})
\end{aligned}$$

#### D. Door Height & Gap Closure Proof
$$\begin{aligned}
\text{Top Reveal Gap} &= 2.0\text{ mm} \\
\text{Door Finished Height} &= 2296.0\text{ mm} \\
\text{Bottom Reveal Gap} &= 2.0\text{ mm} \\
\hline
\mathbf{\text{Total Carcass Front Height}} &= 2.0 + 2296.0 + 2.0 = \mathbf{2300.0\text{ mm}} \quad (\text{Exact Closure})
\end{aligned}$$

#### E. Back Panel Sizing Proof
- Internal Carcass Opening: Width = $1764.0\text{ mm}$, Height = $2264.0\text{ mm}$.
- Groove Depth: $7.0\text{ mm}$ on Left, Right, Top, Bottom.
- Theoretical Opening in Grooves: Width = $1764 + 2(7) = 1778.0\text{ mm}$, Height = $2264 + 2(7) = 2278.0\text{ mm}$.
- Assembly & Expansion Tolerance: $2.0\text{ mm}$ ($1.0\text{ mm}$ each side).
- **Finished Back Panel Dimensions:** $\mathbf{2276.0\text{ mm} \times 1776.0\text{ mm} \times 6.0\text{ mm}}$.

---

## 4. Master Parts & Output Tables

### Table 4.1 — Complete Panel Schedule

| Part ID | Part Name | Qty | Material | Finished Dim $(L \times W \times T)$ | Cutting Dim $(L \times W \times T)$ | Edge Banding (F / B / L / R) |
|---|---|---|---|---|---|---|
| `CARC_TOP` | Top Panel | 1 | 18mm Melamine | $1800.0 \times 580.0 \times 18.0$ | $1798.0 \times 579.0 \times 18.0$ | 1.0mm (Front) / 0.4mm (Back) / 1.0mm (Left) / 1.0mm (Right) |
| `CARC_BOT` | Bottom Panel | 1 | 18mm Melamine | $1800.0 \times 580.0 \times 18.0$ | $1798.0 \times 579.0 \times 18.0$ | 1.0mm (Front) / 0.4mm (Back) / 1.0mm (Left) / 1.0mm (Right) |
| `CARC_SIDE_L` | Left Side Panel | 1 | 18mm Melamine | $2264.0 \times 580.0 \times 18.0$ | $2264.0 \times 579.0 \times 18.0$ | 1.0mm (Front) / 0.4mm (Back) / None (Top) / None (Bottom) |
| `CARC_SIDE_R` | Right Side Panel | 1 | 18mm Melamine | $2264.0 \times 580.0 \times 18.0$ | $2264.0 \times 579.0 \times 18.0$ | 1.0mm (Front) / 0.4mm (Back) / None (Top) / None (Bottom) |
| `CARC_DIV_01` | Center Divider | 1 | 18mm Melamine | $2264.0 \times 560.0 \times 18.0$ | $2264.0 \times 559.0 \times 18.0$ | 1.0mm (Front) / 0.4mm (Back) / None (Top) / None (Bottom) |
| `SHELF_FIX_L1` | Top Fixed Shelf (Left) | 1 | 18mm Melamine | $873.0 \times 560.0 \times 18.0$ | $873.0 \times 559.0 \times 18.0$ | 1.0mm (Front) / 0.4mm (Back) / None (Left) / None (Right) |
| `SHELF_FIX_R1` | Top Fixed Shelf (Right)| 1 | 18mm Melamine | $873.0 \times 560.0 \times 18.0$ | $873.0 \times 559.0 \times 18.0$ | 1.0mm (Front) / 0.4mm (Back) / None (Left) / None (Right) |
| `SHELF_ADJ_R2` | Adj Shelf 1 (Right) | 1 | 18mm Melamine | $871.0 \times 550.0 \times 18.0$ | $869.0 \times 549.0 \times 18.0$ | 1.0mm (Front) / 0.4mm (Back) / 1.0mm (Left) / 1.0mm (Right) |
| `SHELF_ADJ_R3` | Adj Shelf 2 (Right) | 1 | 18mm Melamine | $871.0 \times 550.0 \times 18.0$ | $869.0 \times 549.0 \times 18.0$ | 1.0mm (Front) / 0.4mm (Back) / 1.0mm (Left) / 1.0mm (Right) |
| `BACK_PANEL_01`| Back Panel | 1 | 6mm HDF | $2276.0 \times 1776.0 \times 6.0$ | $2276.0 \times 1776.0 \times 6.0$ | None (Raw edges all sides) |
| `DOOR_01` | Hinged Door 1 (Far Left)| 1 | 18mm Melamine | $2296.0 \times 447.5 \times 18.0$ | $2294.0 \times 445.5 \times 18.0$ | 1.0mm on all 4 edges |
| `DOOR_02` | Hinged Door 2 (Mid Left)| 1 | 18mm Melamine | $2296.0 \times 447.5 \times 18.0$ | $2294.0 \times 445.5 \times 18.0$ | 1.0mm on all 4 edges |
| `DOOR_03` | Hinged Door 3 (Mid Right)| 1 | 18mm Melamine | $2296.0 \times 447.5 \times 18.0$ | $2294.0 \times 445.5 \times 18.0$ | 1.0mm on all 4 edges |
| `DOOR_04` | Hinged Door 4 (Far Right)| 1 | 18mm Melamine | $2296.0 \times 447.5 \times 18.0$ | $2294.0 \times 445.5 \times 18.0$ | 1.0mm on all 4 edges |
| `PLINTH_FRONT` | Front Plinth Facia | 1 | 18mm Melamine | $1800.0 \times 100.0 \times 18.0$ | $1798.0 \times 99.0 \times 18.0$ | 1.0mm (Top) / 1.0mm (Left) / 1.0mm (Right) / 0.4mm (Bottom) |
| `PLINTH_SIDE_L`| Left Plinth Return | 1 | 18mm Melamine | $562.0 \times 100.0 \times 18.0$ | $562.0 \times 99.0 \times 18.0$ | 1.0mm (Top) / 0.4mm (Bottom) / None (Ends) |
| `PLINTH_SIDE_R`| Right Plinth Return | 1 | 18mm Melamine | $562.0 \times 100.0 \times 18.0$ | $562.0 \times 99.0 \times 18.0$ | 1.0mm (Top) / 0.4mm (Bottom) / None (Ends) |

---

### Table 4.2 — Exact 3D Placement Coordinates (Bounding Box Min/Max)

| Part ID | $X_{\min}$ | $X_{\max}$ | $Y_{\min}$ | $Y_{\max}$ | $Z_{\min}$ | $Z_{\max}$ |
|---|---|---|---|---|---|---|
| `PLINTH_FRONT` | 0.0 | 1800.0 | 0.0 | 100.0 | 0.0 | 18.0 |
| `PLINTH_SIDE_L` | 0.0 | 18.0 | 0.0 | 100.0 | 18.0 | 580.0 |
| `PLINTH_SIDE_R` | 1782.0 | 1800.0 | 0.0 | 100.0 | 18.0 | 580.0 |
| `CARC_BOT` | 0.0 | 1800.0 | 100.0 | 118.0 | 0.0 | 580.0 |
| `CARC_SIDE_L` | 0.0 | 18.0 | 118.0 | 2382.0 | 0.0 | 580.0 |
| `CARC_SIDE_R` | 1782.0 | 1800.0 | 118.0 | 2382.0 | 0.0 | 580.0 |
| `CARC_DIV_01` | 891.0 | 909.0 | 118.0 | 2382.0 | 0.0 | 560.0 |
| `CARC_TOP` | 0.0 | 1800.0 | 2382.0 | 2400.0 | 0.0 | 580.0 |
| `SHELF_FIX_L1` | 18.0 | 891.0 | 2014.0 | 2032.0 | 0.0 | 560.0 |
| `SHELF_FIX_R1` | 909.0 | 1782.0 | 2014.0 | 2032.0 | 0.0 | 560.0 |
| `SHELF_ADJ_R2` | 910.0 | 1781.0 | 664.0 | 682.0 | 5.0 | 555.0 |
| `SHELF_ADJ_R3` | 910.0 | 1781.0 | 1014.0 | 1032.0 | 5.0 | 555.0 |
| `BACK_PANEL_01`| 12.0 | 1788.0 | 112.0 | 2388.0 | 553.5 | 559.5 |
| `DOOR_01` | 2.0 | 449.5 | 102.0 | 2398.0 | -20.0 | -2.0 |
| `DOOR_02` | 451.5 | 899.0 | 102.0 | 2398.0 | -20.0 | -2.0 |
| `DOOR_03` | 901.0 | 1348.5 | 102.0 | 2398.0 | -20.0 | -2.0 |
| `DOOR_04` | 1350.5 | 1798.0 | 102.0 | 2398.0 | -20.0 | -2.0 |

---

### Table 4.3 — Semantic Machining & Drilling Operations

| Host Part ID | Face | Operation Type | Tool / Feature Spec | Grid Coordinates (mm) | Count |
|---|---|---|---|---|---|
| `CARC_SIDE_L` | Inner $(+X)$ | Back Groove | $7.0\text{ mm}$ wide $\times 7.0\text{ mm}$ deep | $Z = 556.5$, runs full length $Y = [0, 2264]$ | 1 |
| `CARC_SIDE_L` | Inner $(+X)$ | Hinge Plate Holes | $\varnothing 5.0\text{ mm} \times 12.0\text{ mm}$ | $Z = 37.0$ & $Z = 69.0$; $Y = [100, 624, 1148, 1672, 2196]$ | 10 |
| `CARC_SIDE_L` | Inner $(+X)$ | Fixed Shelf Joint | $\varnothing 8.0\text{ mm} \times 30.0\text{ mm}$ Dowel + Confirmat | $Y = 1896.0$; $Z = 37.0, 280.0, 523.0$ | 3 |
| `CARC_SIDE_L` | Inner $(+X)$ | Hanging Rail Mount | $\varnothing 5.0\text{ mm} \times 12.0\text{ mm}$ | $Y = 1796.0$; $Z = 280.0$ | 2 |
| `CARC_SIDE_R` | Inner $(-X)$ | Back Groove | $7.0\text{ mm}$ wide $\times 7.0\text{ mm}$ deep | $Z = 556.5$, runs full length $Y = [0, 2264]$ | 1 |
| `CARC_SIDE_R` | Inner $(-X)$ | Hinge Plate Holes | $\varnothing 5.0\text{ mm} \times 12.0\text{ mm}$ | $Z = 37.0$ & $Z = 69.0$; $Y = [100, 624, 1148, 1672, 2196]$ | 10 |
| `CARC_SIDE_R` | Inner $(-X)$ | Fixed Shelf Joint | $\varnothing 8.0\text{ mm} \times 30.0\text{ mm}$ Dowel + Confirmat | $Y = 1896.0$; $Z = 37.0, 280.0, 523.0$ | 3 |
| `CARC_SIDE_R` | Inner $(-X)$ | System 32 Shelf Pins | $\varnothing 5.0\text{ mm} \times 13.0\text{ mm}$ | $Z = 37.0$ & $Z = 523.0$; $Y = [400 \dots 1200\text{ step }32]$ | 52 |
| `CARC_DIV_01` | Left $(-X)$ | Fixed Shelf Joint | $\varnothing 8.0\text{ mm} \times 30.0\text{ mm}$ Dowel + Confirmat | $Y = 1896.0$; $Z = 37.0, 280.0, 523.0$ | 3 |
| `CARC_DIV_01` | Right $(+X)$ | System 32 Shelf Pins | $\varnothing 5.0\text{ mm} \times 13.0\text{ mm}$ | $Z = 37.0$ & $Z = 523.0$; $Y = [400 \dots 1200\text{ step }32]$ | 52 |
| `CARC_TOP` | Under $(-Y)$ | Back Groove | $7.0\text{ mm}$ wide $\times 7.0\text{ mm}$ deep | $Z = 556.5$, runs $X = [18.0, 1782.0]$ | 1 |
| `CARC_BOT` | Top $(+Y)$ | Back Groove | $7.0\text{ mm}$ wide $\times 7.0\text{ mm}$ deep | $Z = 556.5$, runs $X = [18.0, 1782.0]$ | 1 |
| `DOOR_01..04` | Rear $(+Z)$ | Blum Hinge Cups | $\varnothing 35.0\text{ mm} \times 12.0\text{ mm}$ | Center at $X = 21.5\text{ mm}$; $Y = [100, 624, 1148, 1672, 2196]$ | 5 per door |
