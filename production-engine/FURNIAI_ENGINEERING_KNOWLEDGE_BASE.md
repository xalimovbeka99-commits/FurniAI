# FurniAI — Furniture Engineering Knowledge Base

**Scope:** flat-panel, box-based casework only — wardrobes, kitchens, cabinets, consoles,
vanities, shelving, dressing tables, with glass/mirror fronts. No steam-bent, turned,
carved or frame-and-panel solid timber joinery.
**Units:** millimetres for production, metres for customers, AED for money.
**Status:** every number here is encoded in `furniai_engine/standards.py` and enforced
by `furniai_engine/verify.py`.

---

## 0. The rule that overrides everything

> **Never design only for appearance. If a thing cannot be cut, machined, assembled,
> transported, installed and serviced, it is wrong — no matter how good it renders.**

Seven gates, answered before any design ships:

1. Can every part be **cut** (fits the sheet after trim)?
2. Can every part be **machined** (reachable by the router/borer, no impossible ops)?
3. Can every part be **assembled** (nothing trapped, fixings accessible)?
4. Can every part be **transported** (lift, stairwell, van bed, weight per person)?
5. Can every part be **installed** (swing clearance, wall type, services)?
6. Can every part be **serviced later** (hinge adjust, runner replace, panel swap)?
7. Will it **survive long-term use** (deflection, hinge load, humidity, AC cycling)?

Any "no" → **REJECTED — corrections required**, with the correction stated.

---

## 1. Two construction systems, and why FurniAI only builds one

| | **Frameless (European / "32mm")** | **Face-frame (American)** |
|---|---|---|
| Structure | 16–18mm panel box, no front frame | Box + solid timber frame glued to the front |
| Access | Full opening width | Frame steals 30–50mm each side |
| Machining | 100% CNC-able from flat sheet | Needs solid-wood milling, joinery, clamping |
| Hardware | Concealed cup hinges, undermount runners | Face-frame hinges, side-mount runners |
| Tolerance strategy | Everything referenced from panel edges | Frame absorbs error |
| Fit for an AI + CNC pipeline | **Native** | Poor |

FurniAI builds **frameless only**. Every part is a rectangle from a flat sheet; the whole
design space becomes arithmetic on `(W, H, D, t)`. This is the single decision that makes
automatic generation of manufacturable furniture tractable.

---

## 2. System 32 — the coordinate system of modern casework

Everything is positioned relative to a column of 5mm holes at a 32mm pitch. Not a
standards-body standard; a post-war convention that became universal because line-boring
machines could not place drill bits closer than 32mm.

| Parameter | Value | Why |
|---|---|---|
| Hole pitch | **32.000 mm** | Machine gear limit that became the world standard |
| Hole diameter | **5 mm** | Shelf pin, hinge plate screw, runner screw all fit |
| Hole depth | **12–14 mm** | Into an 18mm panel; does not break through |
| First row from **front** edge | **37 mm** | Hinge plates, runner front fixings, drawer slides |
| Rear row from **rear** edge | **37 mm** | Same setup, panel can be loaded either way |
| End margin | ≥ 64 mm (2 pitches) | Avoid blowout at the panel end |
| Symmetry rule | distance(first hole → bottom) **=** distance(last hole → top) | One machine setup works whichever way up the panel loads |

**The payoff:** a hinge mounting plate, a drawer runner and a shelf pin all land on the
*same* column of holes. FurniAI's engine deliberately **snaps hinge positions to the
nearest 32mm hole** so mounting plates need no dedicated boring at all.

**The cost trap:** boring a 2400mm panel end to end is ~70 holes × 2 columns = 140 drill
cycles. A factory pays for machine seconds. FurniAI bores **only the zones that carry
something** — shelf ranges, hinge positions, runner rows. Typical saving: 55–70% of drill
cycles per panel.

---

## 3. Carcass anatomy and the panel formulas

Coordinate system used throughout: `X` = 0→W left to right, `Y` = 0→H floor up,
`Z` = 0→D front face to back. Fronts live at negative Z.

### 3.1 Two carcass styles

- **`sides_full`** — side panels run the full height; top and bottom are captured
  *between* them. Load path goes straight down through the sides into the floor.
  **Use for:** wardrobes, tall units, anything carrying weight.
- **`topbot_full`** — top and bottom run the full width; sides captured between.
  **Use for:** base kitchen units sitting on legs, where the bottom spreads load to legs.

### 3.2 Panel formulas (frameless, `t` = panel thickness, `g` = groove depth 10mm)

| Part | Length (with grain) | Width | Qty |
|---|---|---|---|
| Side panel (`sides_full`) | `Hc` | `D` | 2 |
| Top / Bottom (`sides_full`) | `W − 2t` | `D` | 2 |
| Vertical divider | `Hc − 2t` | `D − back_zone` | n−1 |
| Fixed shelf | `bay_opening` | `D − back_zone` | per junction |
| Adjustable shelf | `bay_opening − 2` | `D − back_zone − 8` | as specified |
| Back panel (grooved) | `Hc − 2t + 2g` | `W − 2t + 2g` | 1 (split if > sheet) |
| Plinth front | `W − 2t` | plinth height | 1 |

Where:
- `Hc` = carcass height = overall H − plinth height
- `back_zone` = `back_groove_setback (12) + back_thickness (6)` = **18 mm**
- `bay_opening` = for the end bay `boundary − t/2 − t`; for a middle bay `bay_width − t`

**Bay opening derivation (the part everyone gets wrong).** With boundaries
`b₀=0 … bₙ=W`, side panels occupy `[0,t]` and `[W−t,W]`, and each internal divider is
**centred** on its boundary, occupying `[bᵢ−t/2, bᵢ+t/2]`. Therefore:

```
opening(first)  = (b₁ − t/2) − t
opening(middle) = (bᵢ₊₁ − t/2) − (bᵢ + t/2) = wᵢ − t
opening(last)   = (W − t) − (b_{n−1} + t/2)
```

### 3.3 The back panel is structure, not cladding

A 6mm HDF back sitting in a `6 × 10 mm` groove, `12 mm` from the rear edge, on **all four
sides**, is what makes a carcass square and keeps it square. A nailed-on back is a racking
failure waiting to happen. Never specify the back in the face material — use white/matched
HDF; it is invisible and a third of the price.

### 3.4 Plinths, scribes and fillers

- Plinth (toe kick): **150 mm high, 50 mm setback** — European/UAE standard.
  Make it a **separate clip-on part**, not part of the carcass: it levels independently,
  survives floor tiling changes, and is the only part that gets kicked.
- Adjustable legs: 2 per 600mm of run, minimum 4.
- **Scribe fillers: 20 mm minimum at every wall.** UAE walls are block + render and are
  rarely plumb or square. A design without scribe allowance will not fit the room.

---

## 4. Fronts — the part the customer actually sees

### 4.1 Overlay geometry (frameless, full overlay)

The front covers the entire carcass face; only the reveal gaps are visible.

```
gap G                = 3.0 mm   (between two adjacent leaves)
edge reveal R        = 1.5 mm   (at the outer edge of each module)

leaf_width  = (module_width − 2R − (n−1)·G) / n
leaf_height = (module_height − R_top − R_bottom)
```

**Why R = G/2:** two units standing side by side each contribute 1.5 mm, so the joint
between them reads as the same 3 mm gap as every internal joint. Get this wrong and a
kitchen run has one visibly fat gap where two carcasses meet.

**Rounding rule:** round leaf widths to 0.1 mm and give the sub-0.1 mm residual to the
**last** leaf. Rounding each leaf independently leaves a 0.1–0.3 mm error that shows up
as an uneven end gap.

### 4.2 Hinges (Blum CLIP top BLUMOTION geometry)

| Parameter | Value |
|---|---|
| Cup diameter | **35 mm** |
| Cup depth | **12.5 mm** |
| Boring distance **K** (cup edge → door edge) | 3–6 mm; FurniAI standard **5 mm** |
| Cup centre from hinge edge | **22.5 mm** = 35/2 + K |
| Cup fixing dowels | 8 mm, 45 mm apart, symmetric about the cup |
| Mounting plate row on the side panel | **37 mm** setback — the System-32 front row |
| Standard opening | 110° |

**Hinge count by door height (18mm MDF):**

| Door height | Hinges |
|---|---|
| ≤ 900 | 2 |
| ≤ 1600 | 3 |
| ≤ 2000 | 4 |
| ≤ 2400 | 5 |
| ≤ 2800 | 6 |

**First hinge at 96 mm from each end** — deliberately 3 × 32, so it lands on the grid.

**Hard limits:**
- Hinged leaf width ≤ **600 mm** (beyond that it sags and needs 600mm of clear floor to swing)
- Hinged leaf height ≤ **2400 mm** (above → split into stacked leaves with a 3 mm shadow gap)
- Leaf area ≤ **1.4 m²** before you must go to heavy-duty hinges

### 4.3 Sliding doors (wardrobes)

```
leaf_width  = (opening_width + (n−1)·overlap) / n
leaf_height = opening_height − 45          (top track 40 + bottom track 20, less engagement)
```

- Overlap: minimum 25 mm; **use the stile width** (typically 40 mm) so the overlap reads as
  a deliberate line, not a gap.
- 2 doors → 80 mm deep track; 3 doors → 120 mm deep track.
- **Sliding costs you ~100 mm of usable internal depth.** A 600mm sliding wardrobe has
  ~482 mm usable — below the 530 mm a hanger needs. **Sliding wardrobes must be 650 mm
  deep minimum.** This single rule prevents the most common wardrobe failure in the region.
- Frame: 6063-T5 anodised aluminium. Max practical leaf width 1200 mm.
- Sliding doors never fully expose the carcass — a 3-door slider only ever opens 2/3.

### 4.4 Glass and mirror fronts

- Mirror as a **5 mm overlay** bonded to an 18 mm substrate, or as a glazed infill in an
  aluminium frame. Overlay is cheaper; framed is safer and serviceable.
- Always specify **safety-backed mirror** (vinyl film) — required for anything at head height.
- Glass/mirror leaves are heavy: add ~12 kg/m². Recount hinges by weight, not by height.
- Transport vertical, edge-protected. Never flat-stack.

---

## 5. Drawers

### 5.1 Box sizing

**Undermount (Blum TANDEM / LEGRABOX class)** — runners sit *under* the box, so lateral
clearance is small:

```
box_outside_width = cabinet_opening − 10          (5 mm each side)
box_inside_width  = box_outside_width − 2·t_side
top clearance     = 7 mm
bottom clearance  = 14 mm
```

Cross-check against the Blum published rule: *inner* drawer width = opening − 42 mm for
≤16 mm sides, opening − 49 mm for 16–19 mm sides. Both reduce to the same "opening − 10"
outside width.

**Side-mount ball bearing (2 × 12.7 mm):**

```
box_outside_width = cabinet_opening − 26
top / bottom clearance = 8 mm each
```

### 5.2 Box construction

- Box depth = the **runner length**, chosen from the catalogue: 270 / 300 / 350 / 400 /
  450 / 500 / 550. Never invent a length.
- Required internal carcass depth ≥ `runner + 15 mm` rear clearance.
- Bottom: 6 mm in a `6 × 8 mm` groove, 12 mm up from the lower edge.
  Bottom size = `(inside_width + 2×8) × (depth − 2·t + 2×8)`.
- Standard box side heights: 86 / 100 / 125 / 150 / 180 / 200 / 224.
- Faces get 2 adjustment-bracket holes at the 37 mm System-32 setback.
- Minimum practical face height: **100 mm**. Below that the handle zone disappears.

### 5.3 Reach

Top drawer edge **≤ 1250 mm** from the floor. Above that you cannot see into it, and a
drawer you cannot see into is a shelf with extra steps.

---

## 6. Materials

| Board | Density kg/m³ | Use | Watch out |
|---|---|---|---|
| **MDF 18 mm** | 750 | Carcass, doors, shelves | Heavy; edges must be sealed |
| **MR-MDF (green core)** | 760 | **Mandatory** for kitchens, vanities, laundry | Costs ~15% more, non-negotiable in UAE |
| **Chipboard/MFC 18 mm** | 660 | Budget carcass | Poor screw retention; no fine profiling |
| **Plywood 18 mm** | 600 | Long shelves, heavy loads | Edge voids; more expensive |
| **HDF 6 mm** | 850 | Backs, drawer bottoms | Not structural on its own |

**Finishes:** melamine/laminate (cheapest, hardest), acrylic high-gloss (fingerprints —
never for a family kitchen), veneer (grain must be matched and sequenced), lacquer/PU
(most repairable, longest lead time, needs a spray booth and a clean room).

**Edge banding:** 2 mm PVC on every exposed edge (survives a vacuum cleaner);
0.8 mm on hidden internal edges. Budget the linear metres — it is a real cost line and
is the most commonly forgotten one.

**Grain direction matters only on grained finishes.** A plain white or matt colour board
may be rotated freely during nesting, which is typically worth **8–15 percentage points
of sheet yield**. Encode `grained: true/false` per material, not per part.

---

## 7. Structure — what actually breaks

### 7.1 Shelf clear-span limits (deflection ≤ L/200 at 40 kg/m²)

| Material | 16 mm | 18 mm | 25 mm |
|---|---|---|---|
| MDF | 700 | **800** | 1000 |
| Chipboard | 650 | 750 | 950 |
| Plywood | 800 | 900 | 1150 |
| Solid timber | — | 950 | 1200 |
| Glass | 600 (6mm) | 800 (8mm) | 1000 (10mm) |

Books, crockery and stone: **multiply by 0.75**.

A shelf over its span limit is a warranty claim, not an aesthetic choice. FurniAI's engine
**auto-inserts a divider** when a bay exceeds the limit rather than shipping a sagging shelf.

### 7.2 Fixing to walls

- UAE walls are commonly **block + render**. Anchor into the block, never into render alone.
- Gypsum partitions need a batten spanning studs, or heavy-duty toggles.
- Minimum **2 anchors per carcass**. Tall units get fixed *before* they are loaded — tip-over
  is the single most dangerous failure mode in furniture.

### 7.3 Movement

Long MDF runs move with the AC cycling in UAE buildings. Allow **3 mm expansion per 2.4 m**
of continuous run and absorb it in the scribe fillers, not in the door gaps.

---

## 8. Ergonomics by typology

### Wardrobes
| Requirement | Value |
|---|---|
| Long hang (dresses, coats) | 1600–1700 mm clear |
| Short hang (shirts, jackets) | 950–1100 mm clear |
| Double hang needs internal height | ≥ 2000 mm |
| Internal depth for a standard hanger | **≥ 530 mm** (560+ ideal) |
| Folded-clothes shelf pitch | 280–350 mm |
| Top drawer edge | ≤ 1250 mm |
| Daily-use reach | ≤ 1850 mm — above that is seasonal storage only |

### Kitchens
| Requirement | Value |
|---|---|
| Base carcass height | 720 mm |
| Toe kick | 150 mm high, 50 mm setback |
| Worktop thickness | 20–40 mm |
| **Resulting worktop height** | **890–910 mm** (UAE standard 900) |
| Base depth | 560 mm (600 max) |
| Wall cabinet depth | 320 mm (350 max) |
| Wall unit underside | 1400–1500 mm from floor |
| Worktop → wall unit gap | 500–600 mm |
| Tall unit height | 1825–2150 mm |
| Hob to side wall | ≥ 300 mm |
| Hob to extractor | ≥ 650 mm |
| Landing zone beside fridge/oven | ≥ 300 mm |
| Walkway | ≥ 1000 single-cook, ≥ 1200 galley |
| Work triangle | each leg 1.2–2.7 m, perimeter ≤ 6.5 m |

### Vanities
Height with top 800–900 mm · depth 450–550 mm · basin clearance below ≥ 250 mm ·
mirror centre 1500–1650 mm from floor · **MR-MDF mandatory** · leave a plumbing cut-out
zone in the back panel and a removable rear access panel.

### Dressing tables
Top 720–760 mm · knee clearance ≥ 580 mm · mirror centre 1100–1200 mm (seated eye height).

### Universal
Handles 900–1100 mm from floor where possible · two facing drawer banks need ≥ 1100 mm
between them · hinged door needs 900 mm clear swing, sliding needs 600 mm.

---

## 9. Kitchen system logic

A kitchen is not one object; it is **three runs plus appliances**:

1. **Base run** — 720 carcass on a 150 plinth. Modules ≤ 1200 mm. Drawer-line (3 rows) is
   the default modern spec; doors + one drawer is the budget spec.
2. **Wall run** — 720 or 900 high, 320 deep, underside at 1400–1500.
3. **Tall run** — 2100/2150 high, 560 deep, for ovens, fridge, pantry.

**Corner solutions** (the hardest part of any kitchen):
- Blind corner base — cheapest, worst access; needs a pull-out mechanism to be usable.
- L-shaped corner with a bi-fold door — good access, expensive hardware.
- Diagonal corner with a carousel — best access, eats the most cubic space.
- **Never** put a corner unit within the door-swing arc of an adjacent drawer bank.

**Appliance rules:** every appliance is a fixed void, not a flexible one. Take the aperture
from the manufacturer's spec sheet, add the ventilation gap, then design the cabinetry
around it — never the other way round.

---

## 10. Manufacturing

### 10.1 Nesting and cutting

- Panel saws make **guillotine cuts only**: every cut runs edge-to-edge. Use a strip/shelf
  algorithm (First-Fit Decreasing Height with kerf), **not** a free-form nester.
- CNC routers can free-nest, which yields tighter layouts, but a beam-saw shop cannot
  execute those layouts. Match the algorithm to the machine you actually own.
- **Kerf** 3–5 mm on a panel saw. Ten crosscuts at 4 mm removes 40 mm of usable board.
  Account for kerf between *every* adjacent part.
- Realistic yield: **85–95%** on batched production, **60–75%** on a one-off unit.
  Do not quote one-off jobs at batch yield.
- Trim 10 mm from two edges of every raw sheet before you start.

### 10.2 The five factory operations, in order

1. **Cut** — nest, saw or router, label every part as it comes off the machine
2. **Edgeband** — before drilling; the band adds thickness that drilling references
3. **CNC bore/route** — System-32 columns, hinge cups, grooves, cut-outs
4. **Dry assemble** — square the carcass, fit runners and hinge plates, hang fronts,
   set gaps, **number every part**, then knock down
5. **Pack** — corner protection, film, flat-pack by carcass, one label per bundle

Dry-assembling in the factory and knocking down for transport is what separates a two-hour
installation from a two-day one.

### 10.3 CNC operation vocabulary

| Operation | Spec | Layer (BAZIS convention) |
|---|---|---|
| Part outline | cut through | `CONTOUR` |
| Internal cut-out | cut through | `CONTOUR_IN` |
| System-32 hole | Ø5 × 12 deep | `DRILL_5_12` |
| Dowel | Ø8 × 24 deep | `DRILL_8_24` |
| Hinge cup | Ø35 × 12.5 deep | `DRILL_35_13` |
| Through hole | confirmat / handle | `DRILL_THRU` |
| Back groove | 6 wide × 10 deep | `GROOVE_6_10` |
| Rebate | as specified | `REBATE` |
| Pocket | as specified | `POCKET` |

Layer names carry the tool and depth. One DXF per part, plus one DXF per nested sheet.
This is the format BAZIS-Mebelshik, and most CNC post-processors, ingest directly.

---

## 11. Tolerances and QC

| Item | Tolerance |
|---|---|
| Panel cutting | ± 0.5 mm |
| Drilling position | ± 0.3 mm |
| Assembled carcass squareness | ± 1.0 mm over the diagonal |
| Door/drawer gaps | 3.0 ± 0.5 mm, even all round |
| Level over 1 m | ± 1.0 mm |
| Scribe allowance at walls | 20 mm |

**QC gates:** dimensions → alignment & gaps → movement (cycle every door and drawer 10×)
→ hardware seating and torque → surface & edges → structural (load shelves to rated UDL).

---

## 12. UAE-specific engineering notes

- **Humidity:** MR-MDF in every wet or humid zone. Seal all cut edges, including the ones
  nobody sees — moisture enters through raw edges, not faces.
- **AC cycling:** long runs expand and contract. 3 mm per 2.4 m, absorbed in fillers.
- **Access:** standard residential lift takes a **2400 mm** panel. Villas often have
  stairs-only upper floors — assume **2200 mm** there. Anything taller must split into a
  main carcass + a top box.
- **Ceiling heights** of 2.7–3.0 m are normal, which is exactly why the **top box** is the
  default wardrobe pattern here, not an upsell.
- **Walls:** block + render. Anchor into block. Expect out-of-plumb.
- **Weight:** flag any part over 25 kg as a two-person lift; over 60 kg needs equipment.

---

## 13. Failure-mode catalogue (what the validator must catch)

| Code | Failure | Correction |
|---|---|---|
| `SHELF_SPAN` | Shelf exceeds deflection limit | Add divider, thicken to 25 mm, or add a front lipping |
| `DOOR_WIDTH` | Hinged leaf > 600 mm | Split into leaves or go sliding |
| `DOOR_HEIGHT` | Leaf > 2400 mm | Split into stacked leaves with a shadow gap |
| `DOOR_MASS` | Leaf > 1.4 m² | Heavy-duty hinges, increase count |
| `HANG_DEPTH` | Internal depth < 530 mm | Deepen the carcass or fit a pull-out rail |
| `HANG_HEIGHT` | Hanging zone < 950 mm | Raise the module or convert to shelving |
| `SLIDE_DEPTH` | Carcass too shallow for the shortest runner | Deepen or change to doors + shelves |
| `DRAWER_HEIGHT` | Row cannot host a catalogue box | Reduce rows or raise the module |
| `DRAWER_REACH` | Top drawer above 1250 mm | Move the bank down |
| `SHEET_SIZE` | Part exceeds sheet after trim | Split the part or source oversize board |
| `TRANSPORT` | Part exceeds lift/stair limit | Split the carcass horizontally |
| `SLIDE_DEPTH_LOSS` | Sliding gear eats 100 mm | Stated explicitly, depth re-checked |
| `EXPANSION` | Run > 2400 mm | Expansion gap + scribe fillers |
| `MR_MDF` | Wet zone | Specify moisture-resistant board |

---

## 14. Costing

```
material  = Σ(part_area_m² × rate_m²) × (1 + waste)
            waste = max(10%, 1/nest_yield − 1), capped at 18%
hardware  = hinges + runners + rods + handles + connectors + LED + door surcharges
labour    = labour_base(type) × complexity(type)
subtotal  = material + hardware + labour
TOTAL     = subtotal × 1.35 + delivery_zone       (AED)
```

Two quotes, always:
- **Quick estimate** — bounding-box × panel factor. For live sliders, while the customer
  is still deciding. Fast, ±15%.
- **Firm quote** — from the real cut list and the real nested sheet count. This is the
  number the factory is held to.

### Calibration finding (measured, not assumed)

`verify.py` decomposed real geometry across a size sweep and compared the resulting panel
area to the configurator's bounding-box factor:

| Type | Factor in use | Measured | Error |
|---|---|---|---|
| wardrobe | 1.60 | **1.83** | +15% (**under-quoting**) |
| kitchen_base | 1.80 | 1.82 | +1% (accurate) |
| kitchen_wall | 1.60 | **1.24** | −23% (over-quoting) |
| vanity | 1.50 | **1.02** | −32% (over-quoting) |
| cabinet | 1.50 | **1.16** | −22% (over-quoting) |
| shelving | 1.70 | **0.93** | −46% (over-quoting) |

Wardrobes are being under-quoted on material and open shelving is being roughly
double-quoted. The kitchen base factor is the only one that is right.

---

## 15. Software landscape (what exists, and what to borrow)

**Industry CAD/CAM for cabinets**
- **Cabinet Vision** (Hexagon) — the enterprise standard. Parametric library, shop
  drawings, CNC post. Expensive, Windows-only, steep.
- **Mozaik** (Cyncly, acq. 2022) — design + manufacture + CNC in one, mid-market.
- **Polyboard** (Wood Designer) — parametric method-driven cabinets, auto cut lists,
  pricing and CNC files. Closest philosophical match to what FurniAI generates.
- **PRO100** — sales-focused visualiser, weak manufacturing output.
- **BAZIS-Mebelshik** — the Russian-language furniture suite common in this region;
  BAZIS-CNC generates control programs for saws and routers. **FurniAI's export target.**

**General CAD**
- **SketchUp** — fast conceptual modelling; add-ons (CutList, OpenCutList, CabWriter)
  bolt on manufacturing data. Not parametric at its core.
- **AutoCAD** — 2D shop drawings and the DXF lingua franca. Every CNC shop reads DXF.
- **Fusion 360 / SolidWorks** — genuinely parametric, but modelled around mechanical
  parts, not sheet-good casework.

**Open source worth using**
- **ezdxf** (Python) — read/write DXF R12→R2018, layer control. What FurniAI uses for
  every CNC export.
- **CadQuery / OpenCascade** — parametric B-rep in Python, for STEP output if a client
  needs true solids.
- **Deepnest / nest2D / OpenNest** — free-form nesting for routers and lasers.
  Useful *only* if the shop cuts on a router, not a beam saw.
- **Three.js / react-three-fiber** — the web 3D layer. The right pattern for a
  configurator is **not** loading a GLTF: it is generating box geometry from parameters
  at runtime, so the model and the cut list come from the same numbers.

**The research direction that matters**
Recent work on LLM-driven CAD (AIDL and similar solver-aided DSLs, 2025–26) converges on
one architecture: **the language model writes a high-level, constrained spec; a
deterministic solver produces the geometry.** The model is never allowed to emit
coordinates. That is exactly the architecture in `FURNIAI_MASTER_ARCHITECTURE.md`, and it
is the only way to get furniture that is *always* buildable rather than usually buildable.
