"""
FurniAI - The Inspector
=======================
The agent that stands between a design and the factory.

It does not design anything. It takes a finished build and tries to find the
reason it must not be cut. Nine gates, each a list of named checks with
evidence. Any FAIL means the whole build is REJECTED.

This is the component that catches what a human reviewer misses: a dowel bored
deeper than the panel is thick, a hinge counted in the price list but absent
from the drilling, two holes overlapping, a shelf that is in the 3D but not in
the cut list, a part nested twice.

    from inspector import inspect
    result = inspect(spec)          # builds, nests, prices, then judges
    print(result.text())
    result.verdict                  # "ENGINEERING CHECKS PASSED" | "REJECTED"
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
import itertools, math

import standards as S
import planner, engine, nest as nesting, cost, exporters, buildid


# ===========================================================================
@dataclass
class Check:
    gate: str
    name: str
    status: str            # PASS | FAIL | WARN | SKIP
    evidence: str = ""
    fix: str = ""


@dataclass
class Report:
    build_id: str = ""
    stamp: str = ""
    checks: List[Check] = field(default_factory=list)
    stats: Dict[str, Any] = field(default_factory=dict)

    def add(self, gate, name, ok, evidence="", fix="", warn_only=False):
        st = "PASS" if ok else ("WARN" if warn_only else "FAIL")
        self.checks.append(Check(gate, name, st, evidence, fix))
        return ok

    @property
    def failures(self):
        return [c for c in self.checks if c.status == "FAIL"]

    @property
    def warnings(self):
        return [c for c in self.checks if c.status == "WARN"]

    @property
    def verdict(self):
        return "REJECTED" if self.failures else "ENGINEERING CHECKS PASSED"

    def gate_summary(self):
        out = {}
        for c in self.checks:
            g = out.setdefault(c.gate, {"PASS": 0, "FAIL": 0, "WARN": 0, "SKIP": 0})
            g[c.status] += 1
        return out

    def text(self, verbose=False):
        L = ["=" * 74,
             f"  FurniAI INSPECTION REPORT",
             f"  {self.stamp}",
             "=" * 74, ""]
        for gate, g in self.gate_summary().items():
            tot = sum(g.values())
            mark = "FAIL" if g["FAIL"] else ("WARN" if g["WARN"] else "PASS")
            L.append(f"  [{mark:4}] {gate:<26} {g['PASS']}/{tot} passed"
                     + (f", {g['FAIL']} failed" if g["FAIL"] else "")
                     + (f", {g['WARN']} warnings" if g["WARN"] else ""))
        L.append("")
        for c in self.checks:
            if c.status == "PASS" and not verbose:
                continue
            L.append(f"  {c.status:4}  {c.gate} / {c.name}")
            if c.evidence:
                L.append(f"        {c.evidence}")
            if c.fix:
                L.append(f"        FIX: {c.fix}")
        if not self.failures and not self.warnings:
            L.append("  Every check passed.")
        L += ["", "-" * 74]
        for k, v in self.stats.items():
            L.append(f"  {k:<28} {v}")
        L += ["-" * 74,
              f"  VERDICT: {self.verdict}",
              "=" * 74]
        return "\n".join(L)

    def to_dict(self):
        return {
            "build_id": self.build_id, "stamp": self.stamp,
            "verdict": self.verdict,
            "gates": self.gate_summary(),
            "stats": self.stats,
            "checks": [c.__dict__ for c in self.checks],
        }


# ===========================================================================
def inspect(spec: Dict[str, Any], verbose=False) -> Report:
    r = Report(build_id=buildid.build_id(spec), stamp=buildid.stamp(spec))

    # ---- build ------------------------------------------------------------
    unit_specs = planner.plan(spec)
    units = [engine.build(us) for us in unit_specs]
    parts = [p for u in units for p in u.parts]
    panels = [p for p in parts if p.group != "accessory"]
    nres = nesting.nest(parts)
    quote = cost.exact_quote(units, [nres], spec)
    quick = cost.quick_quote(spec)
    scene = exporters.scene_json(units)

    _gate_spec(r, spec)
    _gate_geometry(r, spec, units, parts, scene)
    _gate_machining(r, panels)
    _gate_hardware(r, units, parts)
    _gate_ergonomics(r, units)
    _gate_structure(r, units, panels)
    _gate_production(r, panels, nres)
    _gate_logistics(r, panels, units)
    _gate_commercial(r, quote, quick)

    r.stats = {
        "carcasses": len(units),
        "unique parts": len(panels),
        "pieces": sum(p.qty for p in panels),
        "solids in 3D": len(scene["boxes"]),
        "machining ops": sum(len(p.ops) * p.qty for p in panels),
        "panel area m2": round(sum(p.area_m2 for p in panels), 2),
        "edgeband m": round(sum(p.band_metres() for p in parts), 1),
        "sheets": nres["sheet_count"],
        "nest yield %": nres["yield_pct"],
        "quick estimate AED": f"{quick['total_aed']:,.2f}",
        "firm quote AED": f"{quote['total_aed']:,.2f}",
    }
    return r


# ---------------------------------------------------------------- 1. SPEC
def _gate_spec(r, spec):
    G = "1 SPEC"
    t = spec.get("type")
    r.add(G, "furniture type is known", t in S.TYPE_DEFAULTS,
          f"type={t!r}", "Use one of: " + ", ".join(S.TYPE_DEFAULTS))
    m = spec.get("material", S.DEFAULT_MATERIAL)
    r.add(G, "material is in the catalogue", m in S.MATERIALS, f"material={m!r}",
          "Add it to standards.MATERIALS with a rate, or pick an existing one.")
    for k, lo, hi in (("width", 200, 8000), ("height", 200, 3500),
                      ("depth", 150, 900)):
        v = spec.get(k)
        r.add(G, f"{k} is physically sensible", v is None or lo <= v <= hi,
              f"{k}={v}", f"Expected {lo}-{hi}mm.")
    z = spec.get("zone", S.DEFAULT_ZONE)
    r.add(G, "delivery zone is known", z in S.DELIVERY, f"zone={z!r}")
    h = spec.get("handle", "none")
    r.add(G, "handle is in the catalogue",
          h in S.HARDWARE_COST["handle"] or h == "none", f"handle={h!r}")


# ------------------------------------------------------------ 2. GEOMETRY
def _gate_geometry(r, spec, units, parts, scene):
    G = "2 GEOMETRY"
    panels = [p for p in parts if p.group != "accessory"]

    pieces = sum(p.qty for p in parts)
    r.add(G, "every piece has its own place in 3D", len(scene["boxes"]) == pieces,
          f"{len(scene['boxes'])} solids vs {pieces} pieces",
          "A part with qty>1 must carry one position per copy, or copies stack.")

    for p in parts:
        if len(p.instances) != p.qty:
            r.add(G, f"{p.pid} instance count matches qty", False,
                  f"{p.name}: {len(p.instances)} positions for qty {p.qty}")

    bb = scene["bbox"]
    want = [spec.get("width"), spec.get("height"), spec.get("depth")]
    r.add(G, "assembly fills its declared envelope",
          all(w is None or abs(b - w) < 1.5 for b, w in zip(bb, want)),
          f"bbox {bb} vs spec {want}",
          "Parts are missing, or a carcass offset is wrong.")

    # carcass closes out across the width
    for u in units:
        t = u.spec["panel_thickness"]
        opens = u.meta["bay_openings"]
        n = len(opens)
        total = sum(opens) + 2 * t + (n - 1) * t
        r.add(G, f"{u.meta['unit_id']} openings + panels = width",
              abs(total - u.meta["W"]) < 0.6,
              f"{sum(opens):.1f} openings + {2*t + (n-1)*t:.1f} panel = "
              f"{total:.1f} vs W {u.meta['W']:.1f}")

    # fronts close out
    for u in units:
        fronts = [p for p in u.parts if p.group == "front"]
        if not fronts or u.spec.get("front", {}).get("kind") == "sliding":
            continue
        cols = {}
        for p in fronts:
            for (x, y, z) in p.instances:
                cols.setdefault(round(y, 1), []).append((x, p.size[0]))
        for y, items in cols.items():
            items.sort()
            span = items[-1][0] + items[-1][1] - items[0][0]
            gaps = sum(items[i + 1][0] - (items[i][0] + items[i][1])
                       for i in range(len(items) - 1))
            expect = S.FRONTS["gap"] * (len(items) - 1)
            if len(items) > 1:
                r.add(G, f"front row at Y={y:.0f} has even {S.FRONTS['gap']:.0f}mm gaps",
                      abs(gaps - expect) < 0.6 * len(items),
                      f"{len(items)} leaves, total gap {gaps:.2f} vs "
                      f"{expect:.2f} expected")

    # solid overlap
    boxes = []
    for u in units:
        ox = u.spec.get("_stack_x", 0.0); oy = u.spec.get("_stack_y", 0.0)
        for p in u.parts:
            if p.group == "accessory":
                continue
            for (x, y, z) in p.instances:
                boxes.append((p, (x + ox, y + oy, z), p.size))
    gd = S.CARCASS["back_groove_depth"] + 0.2
    clashes = []
    for (pa, pa_pos, pa_sz), (pb, pb_pos, pb_sz) in itertools.combinations(boxes, 2):
        ov = [min(pa_pos[i] + pa_sz[i], pb_pos[i] + pb_sz[i]) - max(pa_pos[i], pb_pos[i])
              for i in range(3)]
        if min(ov) <= 0.2:
            continue
        # A back panel legitimately sits inside its groove: the intersection is
        # a thin sliver in two of the three axes (groove depth x back thickness)
        # and runs the length of the groove in the third.
        if "back" in (pa.group, pb.group) and sorted(ov)[1] <= gd:
            continue
        if min(ov) < 0.5:
            continue
        clashes.append(f"{pa.pid} {pa.name} x {pb.pid} {pb.name} "
                       f"overlap {tuple(round(v,1) for v in ov)}")
    r.add(G, "no two solids occupy the same space", not clashes,
          "; ".join(clashes[:4]) + (f" (+{len(clashes)-4} more)" if len(clashes) > 4 else ""),
          "Two parts intersect - the carcass cannot be assembled.")


# ----------------------------------------------------------- 3. MACHINING
def _gate_machining(r, panels):
    G = "3 MACHINING"
    through, deep, outside, tight, collide, edgefar = [], [], [], [], [], []

    for p in panels:
        face_ops = [o for o in p.ops if o.kind == "drill"]
        for o in p.ops:
            # depth must not break through the panel
            if o.kind in ("drill", "groove", "pocket", "rebate") and o.depth > 0:
                if o.depth > p.thickness - 2.0:
                    deep.append(f"{p.pid} {p.name}: {o.note or o.kind} "
                                f"d{o.dia:.0f} bored {o.depth:.1f} deep into a "
                                f"{p.thickness:.0f}mm panel")
            if o.kind == "edge_drill" and o.depth > p.length - 5:
                edgefar.append(f"{p.pid}: edge boring {o.depth:.0f} deep "
                               f"into a {p.length:.0f}mm part")
            # geometry inside the panel
            if o.kind == "drill":
                rr = o.dia / 2.0
                if (o.x - rr < -0.05 or o.y - rr < -0.05 or
                        o.x + rr > p.length + 0.05 or o.y + rr > p.width + 0.05):
                    outside.append(f"{p.pid}: d{o.dia:.0f} at ({o.x:.1f},{o.y:.1f}) "
                                   f"on a {p.length:.0f}x{p.width:.0f} panel")
                elif min(o.x - rr, o.y - rr,
                         p.length - o.x - rr, p.width - o.y - rr) < 2.0:
                    tight.append(f"{p.pid}: d{o.dia:.0f} at ({o.x:.1f},{o.y:.1f}) "
                                 f"is <2mm from an edge")
        # hole-to-hole collision on the same face
        for a, b in itertools.combinations(face_ops, 2):
            if a.face != b.face:
                continue
            d = math.hypot(a.x - b.x, a.y - b.y)
            if d < (a.dia + b.dia) / 2 - 0.5:
                collide.append(f"{p.pid}: d{a.dia:.0f} and d{b.dia:.0f} centres "
                               f"{d:.1f}mm apart - they intersect")

    r.add(G, "no operation breaks through its panel", not deep,
          "; ".join(deep[:3]),
          "Reduce the depth, or move the operation to a layer whose depth is "
          "correct for that panel thickness.")
    r.add(G, "every hole lies inside its panel", not outside, "; ".join(outside[:3]),
          "Check the part-local x/y convention: x runs along the LENGTH.")
    r.add(G, "no two holes intersect on the same face", not collide,
          "; ".join(collide[:3]))
    r.add(G, "holes keep 2mm clear of the panel edge", not tight,
          "; ".join(tight[:3]),
          "A hole this close will blow out the edge.", warn_only=True)
    r.add(G, "edge borings fit within the part", not edgefar, "; ".join(edgefar[:3]))

    # System 32 conformance
    bad = []
    for p in panels:
        rows = sorted({o.x for o in p.ops
                       if o.kind == "drill" and abs(o.dia - S.SYS32["hole_dia"]) < .01
                       and (o.note or "").startswith("System")})
        for a, b in zip(rows, rows[1:]):
            if abs((b - a) % S.SYS32["pitch"]) > 0.05:
                bad.append(f"{p.pid}: {a:.1f} -> {b:.1f} is not a multiple of 32")
                break
        cols = sorted({round(o.y, 1) for o in p.ops
                       if (o.note or "").startswith("System")})
        for cx in cols:
            if abs(cx - S.SYS32["front_setback"]) > .05 and \
               abs(cx - (p.width - S.SYS32["rear_setback"])) > .05:
                bad.append(f"{p.pid}: System-32 column at {cx} is not 37mm "
                           f"from either edge")
    r.add(G, "System-32 rows are on the 32mm grid at 37mm setback", not bad,
          "; ".join(bad[:3]))

    # hinge cup geometry
    bad = []
    for p in panels:
        for o in p.ops:
            if abs(o.dia - S.HINGE["cup_dia"]) < .01:
                d = min(o.y, p.width - o.y)
                if abs(d - S.HINGE["cup_centre_from_edge"]) > 0.2:
                    bad.append(f"{p.pid}: cup centre {d:.1f}mm from the hinge edge, "
                               f"expected {S.HINGE['cup_centre_from_edge']:.1f}")
                if abs(o.depth - S.HINGE["cup_depth"]) > 0.1:
                    bad.append(f"{p.pid}: cup depth {o.depth}, expected "
                               f"{S.HINGE['cup_depth']}")
    r.add(G, "hinge cups are Ø35 x 12.5 at 22.5mm from the hinge edge", not bad,
          "; ".join(bad[:3]))


# ------------------------------------------------------------ 4. HARDWARE
def _gate_hardware(r, units, parts):
    G = "4 HARDWARE"
    for u in units:
        hw = {h.key: h.qty for h in u.hardware}

        cups = sum(sum(1 for o in p.ops if abs(o.dia - S.HINGE["cup_dia"]) < .01) * p.qty
                   for p in u.parts)
        r.add(G, f"{u.meta['unit_id']}: hinges priced == cups drilled",
              abs(hw.get("hinge_softclose", 0) - cups) < .5,
              f"{hw.get('hinge_softclose',0):.0f} hinges vs {cups} cups",
              "A hinge in the price list with no cup is a missing operation; "
              "a cup with no hinge is an unpriced part.")

        rows = sum(1 for p in u.parts if p.name == "Drawer bottom" for _ in range(p.qty))
        r.add(G, f"{u.meta['unit_id']}: runner pairs == drawer boxes",
              abs(hw.get("drawer_slide_pair", 0) - rows) < .5,
              f"{hw.get('drawer_slide_pair',0):.0f} pairs vs {rows} boxes")

        sides = sum(p.qty for p in u.parts if p.name == "Drawer side")
        r.add(G, f"{u.meta['unit_id']}: two sides per drawer box",
              sides == rows * 2, f"{sides} sides for {rows} boxes")

        adj = sum(p.qty for p in u.parts if p.name.startswith("Adj"))
        r.add(G, f"{u.meta['unit_id']}: 4 shelf pins per adjustable shelf",
              abs(hw.get("shelf_pin", 0) - adj * 4) < .5,
              f"{hw.get('shelf_pin',0):.0f} pins vs {adj} shelves")

        rods = sum(p.qty for p in u.parts if p.name == "Hanger rod")
        r.add(G, f"{u.meta['unit_id']}: rod supports for every rail",
              rods == 0 or hw.get("rod_support", 0) >= rods * 2,
              f"{rods} rods, {hw.get('rod_support',0):.0f} supports")

        fronts = sum(p.qty for p in u.parts if p.group == "front")
        handle = u.spec.get("handle", "none")
        if handle not in ("none", "hidden_push"):
            r.add(G, f"{u.meta['unit_id']}: a handle for every front",
                  abs(hw.get("handle", 0) - fronts) < .5,
                  f"{hw.get('handle',0):.0f} handles vs {fronts} fronts")

        if any(p.group == "carcass" for p in u.parts):
            r.add(G, f"{u.meta['unit_id']}: carcass connectors are on the BOM",
                  hw.get("confirmat_set_m2", 0) > 0,
                  f"{hw.get('confirmat_set_m2',0):.2f} m2 of connector allowance")


# --------------------------------------------------------- 5. ERGONOMICS
def _gate_ergonomics(r, units):
    G = "5 ERGONOMICS"
    seen = set()
    for u in units:
        for i in u.issues:
            key = (i["code"], i["message"])
            if key in seen:
                continue
            seen.add(key)
            if i["level"] == "error":
                r.add(G, i["code"], False, i["message"], i.get("fix", ""))
            elif i["level"] == "warn":
                r.add(G, i["code"], False, i["message"], i.get("fix", ""),
                      warn_only=True)
    if not seen:
        r.add(G, "no ergonomic or feasibility issues raised", True)
    else:
        r.add(G, "engine issue list reviewed", True,
              f"{len(seen)} distinct issues, see above")


# ---------------------------------------------------------- 6. STRUCTURE
def _gate_structure(r, units, panels):
    G = "6 STRUCTURE"
    bad = []
    for p in panels:
        if "shelf" not in p.name.lower():
            continue
        lim = S.SHELF_SPAN["mdf"].get(int(p.thickness), 800)
        if p.length > lim:
            bad.append(f"{p.pid} {p.name} spans {p.length:.0f} > {lim} limit")
    r.add(G, "every shelf is inside its deflection limit", not bad,
          "; ".join(bad[:3]),
          "Add a divider, go to 25mm board, or add a front lipping.")

    heavy = []
    for p in panels:
        kg = p.length * p.width * p.thickness / 1e9 * S.LOGISTICS["density_kg_m3"]["mdf"]
        if kg > S.LOGISTICS["max_two_person_kg"]:
            heavy.append(f"{p.pid} {p.name} {kg:.0f}kg")
    r.add(G, "no single panel needs lifting equipment", not heavy,
          "; ".join(heavy[:3]))

    doors = [p for p in panels if p.group == "front"]
    over = [f"{p.pid} {p.length*p.width/1e6:.2f} m2" for p in doors
            if p.length * p.width / 1e6 > S.FRONTS["max_door_area_m2"]]
    r.add(G, f"no front exceeds {S.FRONTS['max_door_area_m2']} m2", not over,
          "; ".join(over[:3]), "Use heavy-duty hinges and raise the count.",
          warn_only=True)


# --------------------------------------------------------- 7. PRODUCTION
def _gate_production(r, panels, nres):
    G = "7 PRODUCTION"
    r.add(G, "every piece was nested", not nres["unplaced"],
          f"{len(nres['unplaced'])} unplaced")
    placed = sum(len(s.placements) for s in nres["sheets"])
    expect = sum(p.qty for p in panels)
    r.add(G, "each piece nested exactly once", placed == expect,
          f"{placed} placements vs {expect} pieces")

    ov = 0
    for sh in nres["sheets"]:
        for a, b in itertools.combinations(sh.placements, 2):
            if (a.x < b.x + b.w - 0.01 and b.x < a.x + a.w - 0.01 and
                    a.y < b.y + b.h - 0.01 and b.y < a.y + a.h - 0.01):
                ov += 1
    r.add(G, "no overlapping placements on any sheet", ov == 0, f"{ov} overlaps")

    off = [f"sheet {sh.index}" for sh in nres["sheets"] for p in sh.placements
           if p.x < -.01 or p.y < -.01 or p.x + p.w > sh.w + .01
           or p.y + p.h > sh.h + .01]
    r.add(G, "nothing hangs off a sheet", not off, "; ".join(off[:3]))

    rot = [f"{p.pid}" for sh in nres["sheets"] for p in sh.placements
           if p.rotated and S.MATERIALS.get(p.material, {}).get("grained")]
    r.add(G, "no grained panel rotated across the grain", not rot,
          "; ".join(rot[:3]))

    r.add(G, "sheet yield is commercially sane", nres["yield_pct"] >= 45,
          f"{nres['yield_pct']:.1f}%",
          "Below 45% means the design is fighting the sheet size, or the run is "
          "too small to batch.", warn_only=True)

    # A glass or mirror leaf lives in an aluminium frame - there is no board
    # edge to band. Only board fronts are checked.
    unbanded = [f"{p.pid} {p.name}" for p in panels
                if p.group == "front" and p.material in S.MATERIALS
                and len([v for v in p.edges.values() if v]) < 4]
    r.add(G, "every board front is banded on all four edges", not unbanded,
          "; ".join(unbanded[:3]))
    framed = [p.pid for p in panels
              if p.group == "front" and p.material not in S.MATERIALS]
    if framed:
        r.add(G, "framed glass/mirror leaves excluded from banding", True,
              f"{len(framed)} framed leaves: {', '.join(framed[:4])}")

    nolabel = [p.pid for p in panels if not p.pid]
    r.add(G, "every part has an ID", not nolabel, "; ".join(nolabel[:3]))


# ---------------------------------------------------------- 8. LOGISTICS
def _gate_logistics(r, panels, units):
    G = "8 LOGISTICS"
    lift = S.LOGISTICS["max_panel_elevator"]
    big = [f"{p.pid} {max(p.length, p.width):.0f}mm" for p in panels
           if max(p.length, p.width) > lift]
    r.add(G, f"every part fits a {lift:.0f}mm lift", not big, "; ".join(big[:3]),
          "Split the carcass horizontally, or confirm stair access.",
          warn_only=True)

    sw, sh = S.SHEET["default"]
    sw -= 2 * S.SHEET["trim"]; sh -= 2 * S.SHEET["trim"]
    nofit = [f"{p.pid} {p.length:.0f}x{p.width:.0f}" for p in panels
             if max(p.length, p.width) > sw or min(p.length, p.width) > sh]
    r.add(G, "every part fits a sheet after trim", not nofit, "; ".join(nofit[:3]))

    for u in units:
        kg = sum(p.length * p.width * p.thickness / 1e9 * p.qty
                 * S.LOGISTICS["density_kg_m3"]["mdf"]
                 for p in u.parts if p.group != "accessory")
        r.add(G, f"{u.meta['unit_id']} carcass mass recorded", True, f"{kg:.0f} kg")


# --------------------------------------------------------- 9. COMMERCIAL
def _gate_commercial(r, quote, quick):
    G = "9 COMMERCIAL"
    r.add(G, "firm quote is a positive number", quote["total_aed"] > 0,
          f"AED {quote['total_aed']:,.2f}")
    if quick["total_aed"] > 0:
        drift = abs(quote["total_aed"] - quick["total_aed"]) / quick["total_aed"]
        r.add(G, "quick estimate is within 25% of the firm quote", drift <= 0.25,
              f"quick {quick['total_aed']:,.0f} vs firm {quote['total_aed']:,.0f} "
              f"({drift*100:.0f}% apart)",
              "Recalibrate the panel factor for this type - run verify.py "
              "section 9.", warn_only=True)
    lines = dict(quote["lines"])
    r.add(G, "material, hardware and labour are all priced",
          all(lines.get(k, 0) > 0 for k in
              ("Material", "Hardware & fittings", "Labour & production")),
          ", ".join(f"{k} {v:,.0f}" for k, v in quote["lines"][:3]))


if __name__ == "__main__":
    import sys, json, furniai
    key = sys.argv[1] if len(sys.argv) > 1 else "wardrobe"
    spec = furniai.DEMOS.get(key)
    if spec is None:
        spec = json.load(open(key))
    rep = inspect(spec, verbose="-v" in sys.argv)
    print(rep.text(verbose="-v" in sys.argv))
    sys.exit(0 if not rep.failures else 1)
