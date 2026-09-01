# FurniAI Wardrobe Rulebook v0.1

**Status:** `BEKZOD_APPROVED` (Workshop Authority Sign-Off)  
**Date:** September 2026  
**Scope:** Straight Hinged Wardrobe Vertical Slice  

---

## 1. Carcass Construction Architecture

### WR-001 — Carcass Orientation by Finish Type
- **Plain / Melamine / Foil:** Top and bottom panels sit **on top of** the outer side panels (Style B / Cap style).
- **Veneer or Painted:** Outer side panels run **full height** (Style A), top and bottom sit **inside** between the sides to eliminate visible raw core edges on the outer flanks.

### WR-002 — Internal Vertical Dividers
- Internal dividers **always sit inside** between the top and bottom panels (Style A) across all finishes without exception.
- Top and bottom panels are continuous across the module and cap the dividers.

---

## 2. Standard Panel Thicknesses

### WR-003 — Material Thickness Matrix
| Component | Plain / Melamine | Veneer / Painted | Notes |
|---|---|---|---|
| Outer Sides | 18 mm | 18 mm | Core substrate |
| Top Panel | 18 mm | 18 mm | Core substrate |
| Bottom Panel | 18 mm | 18 mm | Core substrate |
| Vertical Dividers | 18 mm | 18 mm | Internal bays |
| Fixed Shelves | 18 mm | 18 mm | Structural ties |
| Adjustable Shelves | 18 mm | 18 mm | Supported on Ø5mm pins |
| **Back Panel** | **6 mm** | **6 mm** | HDF / MDF backer |
| Hinged Doors | 18 mm | **19 mm** | +1mm for veneer/paint finish |
| Drawer Fronts | 18 mm | **19 mm** | +1mm for veneer/paint finish |
| Drawer Boxes | 15 mm / 18 mm | 15 mm / 18 mm | Standard runner spec |

---

## 3. Back Panel & Grooving

### WR-004 — Back Panel Groove & Rear Setback
- **Back Panel Thickness:** 6 mm.
- **Groove Width:** **7 mm** (provides 1 mm clearance for assembly glue flow).
- **Groove Depth:** 8 mm – 10 mm.
- **Rear Setback (Squaring Zone):** **20 mm – 25 mm** from the rear edge of all carcass panels.
- **Groove Locations:** Machined into the inner faces of Top, Bottom, and both Outer Sides.

---

## 4. Plinth, Base & Fillers

### WR-005 — Plinth & Elevation
- **Standard Plinth Height:** **100 mm** (configurable range: 80 mm – 100 mm).
- **Flat Floor:** Continuous horizontal 18mm plinth base box.
- **Uneven / Sloped Floor:** Heavy-duty adjustable leveling legs (100 mm) with clip-on plinth facia.
- **Setback:** Standard plinth is **recessed** underneath (toe-kick style); flush is configurable.

### WR-006 — Plinth & Filler Finishes
- Plinths and perimeter scribes/fillers **must always match the finish** of the doors and drawer faces (e.g. painted, veneer, or melamine).

---

## 5. Bay Dimensions & Structural Spans

### WR-007 — Spans & Door Limits
- **Max Single Hinged Door Width:** **600 mm** (standard range: 400 mm – 600 mm).
- **Max Unsupported 18mm Shelf Span:** **900 mm** (spans > 900mm require an intermediate vertical divider).
- **Standard Bay Widths:** 450 mm, 500 mm, 600 mm, 800 mm, 900 mm.

---

## 6. Interior Clearance Standards

### WR-008 — Vertical Zones & Rails
- **Hanging Rail Mount:** Centered at **100 mm down** from the underside of the panel above, aligned to mid-depth of carcass.
- **Short Hanging Clear Height:** **900 mm** (shirts, suits, jackets, folded trousers).
- **Long Hanging Clear Height:** **1400 mm** (dresses, long coats, abayas/thobes).
- **Standard Shelf Spacing:** **350 mm** clear opening (folded clothes, linen).

---

## 7. Hardware & Machining Templates

### WR-009 — Hinges & Drilling Pattern
- **Approved Brands:** **Blum** (CLIP top BLUMOTION) / **Hettich** (Sensys).
- **Hinge Cup:** Ø35 mm diameter, 12 mm depth.
- **Drilling Distance from Door Edge (Tab / K):** 4 mm – 5 mm (center at 21.5 mm – 22.5 mm).
- **End Hinge Offset:** 100 mm from top and bottom door edges to hinge cup centers.
- **Hinge Count by Door Height:**
  - Up to 1000 mm: **2 hinges**
  - 1000 mm – 1600 mm: **3 hinges**
  - 1600 mm – 2100 mm: **4 hinges**
  - 2100 mm – 2600 mm: **5 hinges**

### WR-010 — Joinery Fasteners & Concealment
- **Non-Visible Connections (Internal / Scribe sides):** Confirmat screws (7×50 mm) + Ø8mm wooden dowels.
- **Visible External Flanks (No screw holes permitted):** Concealed Minifix / Cam & Dowel (Ø15mm cam, Ø8mm dowel).
- **Edge Banding:** Standard 1.0 mm PVC on all front visible carcass edges; 1.0 mm / 2.0 mm on doors and drawer fronts; 0.4 mm moisture-seal on hidden rear edges.

---

## 8. Reference Golden Wardrobe Specification (G1 Baseline)

### Overall Envelope
- **Width:** 1800 mm
- **Height:** 2400 mm (100 mm Plinth + 2300 mm Carcass)
- **Depth:** 600 mm
- **Type:** 2-Bay Straight Wardrobe with 4 Hinged Doors (2 pairs)

### Internal Layout
- **Left Bay (900 mm nominal):** Top shelf at 350 mm + Long hanging rail (1400 mm clear) + Bottom shelf.
- **Right Bay (900 mm nominal):** Top shelf at 350 mm + Short hanging rail (900 mm clear) + 2 adjustable shelves below (350 mm spacing).

### Exact Mathematical Part List (Golden Carcass)
| Part ID | Role | Qty | Finished Length (mm) | Finished Width (mm) | Thickness (mm) |
|---|---|---|---|---|---|
| `CARC_SIDE_L` | Left Side | 1 | 2300 | 580 | 18 |
| `CARC_SIDE_R` | Right Side | 1 | 2300 | 580 | 18 |
| `CARC_TOP` | Top Panel | 1 | 1800 | 580 | 18 |
| `CARC_BOT` | Bottom Panel | 1 | 1800 | 580 | 18 |
| `CARC_DIV_01` | Center Divider | 1 | 2264 | 560 | 18 |
| `SHELF_FIX_L1` | Top Shelf (Left) | 1 | 873 | 560 | 18 |
| `SHELF_FIX_R1` | Top Shelf (Right) | 1 | 873 | 560 | 18 |
| `SHELF_ADJ_R2` | Adj Shelf 1 (Right) | 1 | 871 | 550 | 18 |
| `SHELF_ADJ_R3` | Adj Shelf 2 (Right) | 1 | 871 | 550 | 18 |
| `BACK_PANEL_01`| Back Panel | 1 | 2280 | 1780 | 6 |
| `DOOR_01..04` | Hinged Doors | 4 | 2296 | 447 | 18 |
| `PLINTH_FRONT` | Front Plinth | 1 | 1800 | 100 | 18 |
