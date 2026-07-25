"""
FurniAI - DXF Audit
===================
Reads every generated DXF back off disk and checks it against the engine's own
machining list. Catches export bugs (wrong layer, wrong diameter, geometry
outside the panel, missing operations) before a factory finds them.

    python3 audit_dxf.py <pack_dir>
"""
from __future__ import annotations
import os, sys, math
from collections import Counter, defaultdict
import ezdxf
import standards as S

TOL = 0.05
LAYER_OF = {k: v["name"] for k, v in S.CNC_LAYERS.items()}
NAME2KEY = {v["name"]: k for k, v in S.CNC_LAYERS.items()}

# what diameter each drilling layer is allowed to carry
ALLOWED_DIA = {
    "DRILL_5_12":  {5.0},
    "DRILL_8_24":  {8.0},
    "DRILL_8_13":  {8.0},
    "DRILL_35_13": {35.0},
    "DRILL_THRU":  {S.CARCASS["confirmat_dia"], S.CARCASS["confirmat_pilot"], 5.0},
}


def audit(pack_dir, units):
    parts = {p.pid: p for u in units for p in u.parts}
    dxfdir = os.path.join(pack_dir, "dxf")
    problems, stats = [], Counter()
    checked = 0

    for fn in sorted(os.listdir(dxfdir)):
        if not fn.endswith(".dxf") or fn.startswith("COUPON"):
            continue
        pid = fn[:-4]
        p = parts.get(pid)
        doc = ezdxf.readfile(os.path.join(dxfdir, fn))
        msp = doc.modelspace()
        checked += 1

        circles = [e for e in msp if e.dxftype() == "CIRCLE"]
        plines = [e for e in msp if e.dxftype() == "LWPOLYLINE"]
        texts = [e for e in msp if e.dxftype() in ("TEXT", "MTEXT")]
        for e in msp:
            stats[e.dxf.layer] += 1

        if p is None:
            problems.append((fn, "no matching part in the engine output"))
            continue

        # --- 1. outline present, on the right layer, correct size ----------
        outl = [e for e in plines if e.dxf.layer == LAYER_OF["outline"]]
        if len(outl) != 1:
            problems.append((pid, f"expected 1 CONTOUR polyline, found {len(outl)}"))
        else:
            pts = [(v[0], v[1]) for v in outl[0].get_points()]
            w = max(x for x, _ in pts) - min(x for x, _ in pts)
            h = max(y for _, y in pts) - min(y for _, y in pts)
            if abs(w - p.length) > TOL or abs(h - p.width) > TOL:
                problems.append((pid, f"outline {w:.1f}x{h:.1f} != cut list "
                                      f"{p.length:.1f}x{p.width:.1f}"))

        # --- 2. every drilling op appears, on the right layer, right dia ---
        want = Counter()
        for op in p.ops:
            if op.kind in ("drill", "edge_drill"):
                want[(LAYER_OF.get(op.layer, "DRILL_THRU"), round(op.dia, 2))] += 1
        got = Counter((e.dxf.layer, round(e.dxf.radius * 2, 2)) for e in circles)
        for k, n in want.items():
            if got.get(k, 0) != n:
                problems.append((pid, f"layer {k[0]} d{k[1]}: DXF has "
                                      f"{got.get(k,0)}, engine says {n}"))
        for k, n in got.items():
            if k not in want:
                problems.append((pid, f"layer {k[0]} d{k[1]}: {n} unexpected holes"))

        # --- 3. diameters legal for their layer ----------------------------
        for e in circles:
            lay, d = e.dxf.layer, round(e.dxf.radius * 2, 2)
            if lay in ALLOWED_DIA and d not in ALLOWED_DIA[lay]:
                problems.append((pid, f"d{d} is not a legal diameter for {lay}"))

        # --- 4. face holes stay inside; edge holes sit ON their edge -------
        # An edge boring is centred on the panel edge by definition, so it is
        # exempt from the containment test - but only if the engine actually
        # asked for one at that point, on that edge.
        edge_pts = set()
        for op in p.ops:
            if op.kind != "edge_drill":
                continue
            ed = op.face.split(":")[-1]
            pt = {"L1": (op.x, 0.0), "L2": (op.x, p.width),
                  "W1": (0.0, op.x), "W2": (p.length, op.x)}.get(ed)
            if pt:
                edge_pts.add((round(pt[0], 1), round(pt[1], 1)))
        for e in circles:
            x, y = round(e.dxf.center.x, 1), round(e.dxf.center.y, 1)
            r = e.dxf.radius
            on_edge = (abs(x) < TOL or abs(x - p.length) < TOL or
                       abs(y) < TOL or abs(y - p.width) < TOL)
            if on_edge:
                if (x, y) not in edge_pts:
                    problems.append((pid, f"hole d{r*2:.1f} sits on the panel edge "
                                          f"at ({x},{y}) but the engine never "
                                          f"specified an edge boring there"))
                continue
            if x - r < -TOL or y - r < -TOL or \
               x + r > p.length + TOL or y + r > p.width + TOL:
                problems.append((pid, f"hole d{r*2:.1f} at ({x},{y}) "
                                      f"breaks the {p.length:.0f}x{p.width:.0f} edge"))
        for pt in edge_pts:
            if not any(abs(e.dxf.center.x - pt[0]) < TOL and
                       abs(e.dxf.center.y - pt[1]) < TOL for e in circles):
                problems.append((pid, f"edge boring at {pt} missing from the DXF"))

        # --- 5. grooves present and correctly sized ------------------------
        gwant = sum(1 for op in p.ops if op.kind == "groove")
        ggot = len([e for e in plines if e.dxf.layer == LAYER_OF["groove"]])
        if gwant != ggot:
            problems.append((pid, f"grooves: DXF {ggot}, engine {gwant}"))
        for e in plines:
            if e.dxf.layer != LAYER_OF["groove"]:
                continue
            pts = [(v[0], v[1]) for v in e.get_points()]
            gw = min(max(y for _, y in pts) - min(y for _, y in pts),
                     max(x for x, _ in pts) - min(x for x, _ in pts))
            if gw not in (S.CARCASS["back_groove_width"],
                          S.DRAWER["bottom_groove_width"]):
                problems.append((pid, f"groove width {gw:.1f} is not a "
                                      f"catalogue cutter size"))

        # --- 6. identity text present --------------------------------------
        if not any(pid in (t.dxf.text if t.dxftype() == "TEXT" else t.text)
                   for t in texts):
            problems.append((pid, "no part-ID label in the DXF"))

        # --- 7. units and layer table --------------------------------------
        if doc.units != 4:      # 4 == millimetres
            problems.append((pid, f"DXF units code {doc.units}, expected 4 (mm)"))
        missing = [n for n in LAYER_OF.values() if n not in doc.layers]
        if missing:
            problems.append((pid, f"layer table missing {missing}"))

    return checked, stats, problems


def audit_nest(pack_dir):
    d = os.path.join(pack_dir, "nest")
    if not os.path.isdir(d):
        return 0, []
    probs, n = [], 0
    for fn in sorted(os.listdir(d)):
        if not fn.endswith(".dxf"):
            continue
        n += 1
        doc = ezdxf.readfile(os.path.join(d, fn))
        msp = doc.modelspace()
        pl = [e for e in msp if e.dxftype() == "LWPOLYLINE"]
        boundary = [e for e in pl if e.dxf.layer == S.CNC_LAYERS["dim"]["name"]]
        parts = [e for e in pl if e.dxf.layer == S.CNC_LAYERS["outline"]["name"]]
        if len(boundary) != 1:
            probs.append((fn, f"expected 1 sheet boundary, found {len(boundary)}"))
        if not parts:
            probs.append((fn, "no nested parts on the sheet"))
        if boundary:
            bp = [(v[0], v[1]) for v in boundary[0].get_points()]
            SW = max(x for x, _ in bp); SH = max(y for _, y in bp)
            for e in parts:
                pp = [(v[0], v[1]) for v in e.get_points()]
                if (min(x for x, _ in pp) < -TOL or min(y for _, y in pp) < -TOL
                        or max(x for x, _ in pp) > SW + TOL
                        or max(y for _, y in pp) > SH + TOL):
                    probs.append((fn, "a nested part hangs off the sheet"))
                    break
    return n, probs


if __name__ == "__main__":
    pack = sys.argv[1] if len(sys.argv) > 1 else "./factory_pack"
    import json, planner, engine
    report_path = os.path.join(pack, "report.json")
    if not os.path.isfile(report_path):
        print(f"ERROR: {report_path} is required to reconstruct the audited build.")
        sys.exit(2)
    with open(report_path, encoding="utf-8") as fh:
        spec = json.load(fh).get("input")
    if not isinstance(spec, dict):
        print(f"ERROR: {report_path} does not contain a valid input specification.")
        sys.exit(2)
    units = [engine.build(s) for s in planner.plan(spec)]
    n, stats, probs = audit(pack, units)
    nn, nprobs = audit_nest(pack)

    print("=" * 72)
    print(f"  DXF AUDIT - {pack}")
    print("=" * 72)
    print(f"\n  {n} part files + {nn} nesting files read back from disk\n")
    print("  Entities written, by layer:")
    for lay, c in sorted(stats.items(), key=lambda kv: -kv[1]):
        desc = S.CNC_LAYERS.get(NAME2KEY.get(lay, ""), {}).get("desc", "")
        print(f"    {lay:14} {c:6}   {desc}")
    allp = probs + nprobs
    print()
    if allp:
        print(f"  {len(allp)} PROBLEM(S):")
        for who, msg in allp:
            print(f"    {who:16} {msg}")
    else:
        print("  No problems. Every operation the engine specified is present in")
        print("  the DXF, on the correct layer, at the correct diameter, inside")
        print("  the panel boundary, in millimetres.")
    print("=" * 72)
    sys.exit(1 if allp else 0)
