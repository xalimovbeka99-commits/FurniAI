# FurniAI — Factory Validation Pack

**Purpose:** find out whether the files FurniAI produces drive your machines correctly,
before any customer work depends on them.

**This is not a product.** The unit is deliberately small, cut in the cheapest white board,
and designed to exercise every machine operation exactly once. Cut it, measure it,
assemble it, and throw it away.

---

## What is in here

| File | What to do with it |
|---|---|
| `01_BAZIS_CNC_LAYER_MAP.md` | **Read first.** Configure the post-processor from this. One-time setup. |
| `dxf/COUPON_calibration.dxf` | **Cut this first**, on an offcut. Contains one of every hole and groove FurniAI uses, labelled with its nominal size. |
| `first_article_inspection.pdf` | Print it. Fill it in as you go. This is the deliverable. |
| `shop_drawings.pdf` | The full A3 blueprint set — elevations, part details with every hole located, CNC schedule, nesting, BOM, QC, install sequence. |
| `cutlist.csv` | 13 unique parts, 22 pieces. |
| `dxf/` | One layered DXF per part. |
| `nest/` | One DXF per sheet, guillotine-nested, kerf 4 mm. |
| `viewer.html` | Open in a browser. Hover any part for its cut size; hit Explode. |
| `report.json` | Machine-readable summary. Software verdict: **ENGINEERING CHECKS PASSED**; manufacturing release remains blocked until this physical qualification passes. |

---

## The test unit

800 × 1400 × 500 mm cabinet, white MDF, no plinth.
Two hinged doors over two drawers over two adjustable shelves.

That combination is not arbitrary — it is the smallest thing that forces every operation:

| Operation | Where it appears |
|---|---|
| Through cut / part outline | Every part |
| System-32 row, Ø5 × 12 | Both side panels, 154 holes total |
| Hinge cup, Ø35 × 12.5 | 6 cups across two doors |
| Cup fixing dowels, Ø8 × 13 | 12, on their own `DRILL_8_13` layer |
| Drawer-runner fixings | 2 per drawer row, on the System-32 grid |
| Confirmat through-hole, Ø7 | Side panels — top, bottom and every fixed shelf |
| Confirmat edge pilot, Ø4.5 × 50 | Top and bottom panel edges — **horizontal boring** |
| Back groove, 6 × 10 | Sides, top, bottom |
| Drawer groove, 6 × 8 | Drawer sides and box fronts — **different depth, same cutter** |
| Edge banding 2 mm | Doors all round, shelf front edges |
| Edge banding 0.8 mm | Drawer box parts |
| Guillotine nesting with kerf | 4 sheets |
| Full-overlay gap arithmetic | 3 mm between doors, 1.5 mm at every outer edge |

---

## Sequence

1. **Configure** the post-processor from `01_BAZIS_CNC_LAYER_MAP.md`.
2. **Cut the coupon** on an offcut. Measure every feature against Section A of the
   inspection sheet. **Do not proceed until every row passes.**
3. **Cut the panels** from `nest/`. Measure each against Section B.
4. **Bore** from `dxf/`. Spot-check positions against Section C.
5. **Edgeband**, then **dry-assemble**. Fill in Section D.
6. **Sign Section E** and send it back with the coupon and a photo.

Budget: about 4 sheets of white MDF, half a day of machine and bench time.

---

## What "pass" means

Every dimension inside tolerance, hinge plates seating on the System-32 row **without
re-drilling**, both groove depths coming out different, and door gaps reading 3 mm even
top to bottom.

If those five things are true, the tested machine/post-processor profile may be
approved by the responsible factory engineer. Record that approval against the exact
standards version and machine profile before sending real jobs through it.

---

## What we already checked, so you do not have to

- `verify.py` — 40 checks: System-32 conformance, hinge geometry, gap arithmetic that
  closes out exactly, panel formulas, drawer clearances, ergonomics, cut-list
  completeness, nesting integrity (no overlaps, nothing off-sheet, no grained panel
  rotated). All pass.
- `audit_dxf.py` — reads every generated DXF **back off disk** and cross-checks it against
  the engine's own machining list: entity counts per layer, diameters legal for their
  layer, nothing outside the panel, edge borings on the correct edge, units set to mm,
  part-ID label present. Clean.

That second tool has already earned its keep twice.

**Round one — five X/Y transposition bugs.** The audit found 116 problems: System-32 rows,
hinge cups, cup dowels, handle holes and the edge-boring axis map all had X and Y swapped.
Every hinge cup and every shelf-pin row was landing outside the panel. The 3D looked
perfect and the cut list was correct; only the DXF was wrong.

**Round two — geometry and drilling defects.**
- Every part with a quantity above one was rendering at a **single position**, so three
  drawer faces stacked into one and six drawer sides collapsed into one box. Each copy now
  carries its own position; a new check asserts *solid count == piece count*.
- The **drawer box was flat** — front and back were both at Z=0 instead of front at the
  face and back at runner-length minus 16.
- Side panels were bored with a **blanket System-32 column across the whole drawer zone**
  (16 holes) instead of the two runner fixings per row that are actually used (6 holes).
- **Fixed shelves and dividers had no fixings at all** — they would have been floating.
  Confirmat Ø7 through the side or divider into a Ø4.5 × 50 edge pilot is now generated
  on both parts, at matching positions.
- Hinge-cup dowels moved off `DRILL_8_24` onto a dedicated **`DRILL_8_13`** layer, so a
  post-processor keying depth off the layer name can no longer bore through an 18 mm door.
- Dividers no longer carry a spurious back groove — their rear edge butts the back panel.

All fixed and re-verified: 40 engine checks pass, and the audit is clean across 155 part
DXFs and 33 nesting DXFs. This is the first pack worth cutting.
