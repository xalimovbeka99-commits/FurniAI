"""
FurniAI - Factory First-Article Test Pack
=========================================
A deliberately small unit that exercises EVERY machine operation exactly once,
plus a calibration coupon that can be cut from an offcut in five minutes.

The point is not to build a wardrobe. The point is to find out whether the DXF
files FurniAI emits drive the factory's machines correctly, BEFORE any customer
work depends on it.

Operations under test
  1. Part outline / through cut                    CONTOUR
  2. System-32 shelf-pin row, 5 x 12 deep          DRILL_5_12
  3. Hinge cup, 35 dia x 12.5 deep                 DRILL_35_13
  4. Hinge cup fixing dowels, 8 dia x 13 deep      DRILL_8_13
  5. Confirmat through-hole                        DRILL_THRU
  6. Confirmat edge pilot (edge boring)            DRILL_THRU on an edge
  7. Back-panel groove, 6 wide x 10 deep           GROOVE_6_10
  8. Drawer-bottom groove, 6 wide x 8 deep         GROOVE_6_10
  9. Edge banding 2mm on the marked edges          (bander, not CNC)
 10. Guillotine nesting with kerf                  (saw)
"""
import os, math
import ezdxf
from ezdxf import units as dxfunits
import standards as S

# --- The test unit ---------------------------------------------------------
# 900 wide so it is one sheet of board and two people can carry it.
# 2 doors  -> hinge cups both hands, and the gap arithmetic is visible.
# 2 drawers-> runner rows, drawer grooves, face fixing holes.
# shelves  -> System-32 boring zones.
TEST_UNIT = {
    "name": "FurniAI First-Article Test Unit",
    "brief": "Not for sale. Cut this to qualify the CNC post-processor.",
    "client": "Internal - factory qualification",
    "room": "Factory floor",
    "unit_id": "FA1",
    "type": "cabinet",
    "width": 800, "height": 1400, "depth": 500,
    "material": "white",            # cheapest board - this piece is disposable
    "front_material": "white",
    "handle": "black_strip",
    "led": "off",
    "zone": "pickup",
    "no_split": True,
    "bays": [{
        "width": None, "no_split": True,
        "modules": [
            {"type": "drawers", "height": 400, "rows": 2,
             "front": {"kind": "drawer_faces"}},
            {"type": "shelves", "height": "fill", "count": 2,
             "front": {"kind": "door", "leaves": 2}},
        ],
    }],
}


# --- Calibration coupon ----------------------------------------------------
COUPON = {
    "length": 600.0, "width": 300.0, "thickness": 18.0,
    "material": "white",
}


def build_coupon(path):
    """One offcut with a sample of every hole and groove FurniAI ever asks for,
    each labelled with its nominal size. Measure it with callipers before you
    cut a single carcass panel."""
    doc = ezdxf.new("R2010", setup=True)
    doc.units = dxfunits.MM
    for spec in S.CNC_LAYERS.values():
        if spec["name"] not in doc.layers:
            doc.layers.add(spec["name"], color=spec["color"])
    msp = doc.modelspace()
    L, W = COUPON["length"], COUPON["width"]
    LAY = {k: v["name"] for k, v in S.CNC_LAYERS.items()}

    msp.add_lwpolyline([(0, 0), (L, 0), (L, W), (0, W)], close=True,
                       dxfattribs={"layer": LAY["outline"]})

    def note(txt, x, y, h=9):
        msp.add_text(txt, height=h, dxfattribs={"layer": LAY["label"]}
                     ).set_placement((x, y))

    # 1. System-32 row at the true 37mm setback, 5 holes at 32 pitch
    y0 = W - 37.0
    for i in range(5):
        msp.add_circle((60 + i * 32.0, y0), S.SYS32["hole_dia"] / 2,
                       dxfattribs={"layer": LAY["drill_5_12"]})
    note(f"SYS-32: 5 x d{S.SYS32['hole_dia']:.0f} x {S.SYS32['hole_depth']:.0f}dp "
         f"@ {S.SYS32['pitch']:.0f} pitch, {S.SYS32['front_setback']:.0f} from edge",
         60, y0 - 16)

    # 2. Hinge cup + its two fixing dowels, at the real geometry
    cx, cy = 300.0, W - 120.0
    msp.add_circle((cx, cy), S.HINGE["cup_dia"] / 2,
                   dxfattribs={"layer": LAY["drill_35_13"]})
    for dy in (-S.HINGE["cup_screw_pitch"] / 2, S.HINGE["cup_screw_pitch"] / 2):
        msp.add_circle((cx, cy + dy), S.HINGE["cup_screw_dia"] / 2,
                       dxfattribs={"layer": LAY["drill_8_13"]})
    note(f"HINGE CUP d{S.HINGE['cup_dia']:.0f} x {S.HINGE['cup_depth']:.1f}dp "
         f"+ 2 x d{S.HINGE['cup_screw_dia']:.0f} @ {S.HINGE['cup_screw_pitch']:.0f} c/c",
         cx - 90, cy - 45)

    # 3. Confirmat through-holes
    for i in range(2):
        msp.add_circle((470 + i * 60, W - 90), S.CARCASS["confirmat_dia"] / 2,
                       dxfattribs={"layer": LAY["drill_thru"]})
    note(f"CONFIRMAT d{S.CARCASS['confirmat_dia']:.1f} THROUGH", 450, W - 120)

    # 4. Back-panel groove, full length, at the real setback
    gy = 90.0
    gw = S.CARCASS["back_groove_width"]
    msp.add_lwpolyline([(0, gy - gw / 2), (L, gy - gw / 2),
                        (L, gy + gw / 2), (0, gy + gw / 2)],
                       close=True, dxfattribs={"layer": LAY["groove"]})
    note(f"GROOVE {gw:.0f} wide x {S.CARCASS['back_groove_depth']:.0f} deep",
         10, gy + 12)

    # 5. Drawer-bottom groove (shallower - proves depth control per layer)
    gy2 = 45.0
    gw2 = S.DRAWER["bottom_groove_width"]
    msp.add_lwpolyline([(0, gy2 - gw2 / 2), (L, gy2 - gw2 / 2),
                        (L, gy2 + gw2 / 2), (0, gy2 + gw2 / 2)],
                       close=True, dxfattribs={"layer": LAY["groove"]})
    note(f"GROOVE {gw2:.0f} wide x {S.DRAWER['bottom_groove_depth']:.0f} deep "
         f"(different depth, same layer family - CHECK YOUR MAPPING)",
         10, gy2 - 22)

    # 6. Edge boring reference marks
    for x in (150.0, 450.0):
        msp.add_circle((x, 0), S.CARCASS["confirmat_pilot"] / 2,
                       dxfattribs={"layer": LAY["drill_thru"]})
    note(f"EDGE PILOT d{S.CARCASS['confirmat_pilot']:.1f} x 50dp "
         f"(bore into the edge, not the face)", 150, 14)

    # 7. Datum + identity
    msp.add_lwpolyline([(0, 0), (25, 0), (0, 25)], close=True,
                       dxfattribs={"layer": LAY["dim"]})
    note("DATUM 0,0 - bottom left, FACE A up", 30, 8, 7)
    note(f"FurniAI CALIBRATION COUPON  {L:.0f} x {W:.0f} x "
         f"{COUPON['thickness']:.0f}  |  measure every feature with callipers "
         f"before cutting carcass parts", 10, W + 14, 11)
    doc.saveas(path)
    return path


if __name__ == "__main__":
    import sys, furniai
    out = sys.argv[1] if len(sys.argv) > 1 else "./factory_pack"
    os.makedirs(out, exist_ok=True)
    import planner, engine, inspection, audit_dxf
    rep = furniai.run(TEST_UNIT, out)
    build_coupon(os.path.join(out, "dxf", "COUPON_calibration.dxf"))
    units = [engine.build(sp) for sp in planner.plan(TEST_UNIT)]
    inspection.build(os.path.join(out, "first_article_inspection.pdf"),
                     units, TEST_UNIT)
    n, stats, probs = audit_dxf.audit(out, units)
    nn, nprobs = audit_dxf.audit_nest(out)
    print(f"parts {rep['unique_parts']} | pieces {rep['part_count']} | "
          f"sheets {rep['sheets']} | verdict {rep['verdict']}")
    print(f"DXF audit: {n} part files + {nn} nest files, "
          f"{len(probs)+len(nprobs)} problems")
    for who, msg in (probs + nprobs)[:20]:
        print("   ", who, msg)
