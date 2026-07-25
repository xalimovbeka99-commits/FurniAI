# FurniAI → BAZIS-CNC Layer Map

**Configure this once.** Every FurniAI job from now on imports without touching a setting.

FurniAI writes one DXF per part. Geometry is in **millimetres**, real size, no scaling.
Datum is the **bottom-left corner of Face A**, X along the grain (the part's *length*),
Y across the *width*. Every operation is carried on a named layer, and the layer name
encodes tool and depth.

---

## The mapping table

| DXF layer | Entity | Tool | Ø | Depth | Side | Notes |
|---|---|---|---|---|---|---|
| `CONTOUR` | LWPOLYLINE, closed | Router / saw | — | through | — | The part outline. One per file. |
| `CONTOUR_IN` | LWPOLYLINE, closed | Router | — | through | A | Approved internal joinery cut-outs |
| `DRILL_5_12` | CIRCLE | Vertical borer | **5.0** | **12.0** | A (and B on dividers) | System-32 rows, shelf pins, hinge plates, runner fixings |
| `DRILL_8_24` | CIRCLE | Vertical borer | **8.0** | 24.0 | A | Construction dowels |
| `DRILL_8_13` | CIRCLE | Vertical borer | **8.0** | **13.0** | A | Hinge-cup fixing dowels — shallow on purpose |
| `DRILL_35_13` | CIRCLE | Cup bit | **35.0** | **12.5** | A | Hinge cup |
| `DRILL_THRU` | CIRCLE | Vertical borer | 7.0 / 5.0 | **through** | A | Confirmat bodies, handle holes |
| `DRILL_THRU` (on an edge) | CIRCLE centred on the outline | Horizontal borer | **4.5** | **50** | edge | Confirmat pilots. Centre lies exactly on the contour — that is how you tell them apart |
| `GROOVE_6_10` | LWPOLYLINE, closed rectangle | 6 mm groover | 6.0 | **read the rectangle** | A | See the depth warning below |
| `REBATE` | LWPOLYLINE, closed | Router | — | as drawn | A | Rare |
| `POCKET` | LWPOLYLINE, closed | Router | — | as drawn | A | Rare |
| `LABEL` | TEXT | — | — | — | — | **Do not machine.** Part ID and size |
| `DIM` | TEXT / LWPOLYLINE | — | — | — | — | **Do not machine.** Reference only |

---

## Three things that will bite you if you skip them

**1. `GROOVE_6_10` carries two different depths.**
The back-panel groove is 6 × **10** deep. The drawer-bottom groove is 6 × **8** deep.
Same cutter, same layer family, different depth. If your post-processor maps the layer
to a fixed depth, both come out the same and the drawer bottoms will be loose.

Two ways to handle it — pick one and tell FurniAI which:
- **Split the layers** — we emit `GROOVE_6_10` and `GROOVE_6_08` as separate layers.
- **Read the depth from the operation schedule** in `shop_drawings.pdf`, sheet
  "CNC OPERATION SCHEDULE", which lists depth per part.

The calibration coupon deliberately contains both depths so the problem surfaces in five
minutes rather than on a customer's kitchen.

**2. Hinge-cup dowels are on their own layer, `DRILL_8_13`.**
Same Ø8 bit as `DRILL_8_24`, but **13 mm deep, not 24**. Boring 24 mm into an 18 mm door
breaks through the face. These were originally emitted on `DRILL_8_24` with a written
warning; they now have a dedicated layer so no override is needed. If your post-processor
does not know `DRILL_8_13`, add it — do not fold it back into `DRILL_8_24`.

**3. Edge borings share the `DRILL_THRU` layer.**
A circle whose centre lies exactly on the `CONTOUR` outline is a **horizontal** boring
into the panel edge, Ø4.5 × 50 deep. A circle inside the outline is a **vertical**
through-hole. If your post cannot distinguish them geometrically, ask FurniAI to emit
`DRILL_EDGE_45` as a separate layer — it is a one-line change.

---

## Face A / Face B

- **Side panels:** Face A is the **internal** face (the one you can see into the cabinet from).
- **Dividers:** bored on **both** faces — the DXF carries the union; mirror it for Face B.
- **Doors and drawer faces:** Face A is the **back**. Hinge cups are on the back. Obviously.
- **Top / bottom panels:** Face A is the internal (downward for the top, upward for the bottom).

Every DXF carries a `LABEL` text with the part ID, cut size, material and quantity.
Print it on the part sticker; the assembly sequence in the shop drawings refers to those IDs.

---

## Import checklist (do this once)

- [ ] Import units set to **millimetres**, no unit conversion, no scaling
- [ ] Create the twelve layers above with the exact names — names are case-sensitive
- [ ] Bind each layer to its tool and depth in the post-processor
- [ ] Map `DRILL_8_24` to **24 mm** and `DRILL_8_13` to **13 mm**; never merge them
- [ ] Decide the groove-depth strategy (split layers, or read the schedule)
- [ ] Confirm `LABEL` and `DIM` are excluded from machining
- [ ] Set the datum to bottom-left, Face A up
- [ ] Run `dxf/COUPON_calibration.dxf` on an offcut and measure every feature

---

## Nesting files

`nest/NEST_nn_<material>_<thk>.dxf` — one per sheet, for the beam saw.
Sheet boundary is on `DIM`; each nested part outline is on `CONTOUR` with a `LABEL`
carrying its part ID. Parts marked `ROT` were rotated 90° — this only ever happens on
non-grained board, never on a woodgrain finish.

Kerf assumed: **4.0 mm**. If your saw differs, tell FurniAI — the nest is regenerated,
not hand-edited.

---

## Reporting back

If any layer imports wrong, send FurniAI:
1. the offending DXF,
2. a screenshot of what BAZIS shows,
3. the layer/tool table from your post-processor.

Every one of these is a `standards.py` change, not a redesign. Fixing it once fixes it
for every job that follows.
