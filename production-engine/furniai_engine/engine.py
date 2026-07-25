"""
FurniAI - Parametric Cabinet Geometry Engine
============================================
spec (dict/JSON)  ->  Unit  ->  parts + machining ops + 3D placement

Coordinate system (millimetres, right-handed, cabinet-local):
    X : 0 -> W   left to right, viewed from the front
    Y : 0 -> H   floor upward
    Z : 0 -> D   FRONT face of carcass (0) to the back (D)
                 fronts (doors/drawer faces) live at negative Z

Part-local coordinates for machining (Face A = the "reference" face):
    x : 0 -> length   (grain direction)
    y : 0 -> width
    Face A of a side panel is its INTERNAL face. Face A of a door is its BACK.
"""
from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional, Tuple
import math
import copy
import standards as S


# ===========================================================================
#  DATA MODEL
# ===========================================================================
@dataclass
class Op:
    """One machining operation, in part-local coordinates."""
    kind: str                 # drill | edge_drill | groove | rebate | pocket | contour_in
    face: str = "A"           # A | B | edge:L1 | edge:L2 | edge:W1 | edge:W2
    dia: float = 0.0
    depth: float = 0.0
    x: float = 0.0
    y: float = 0.0
    x2: float = 0.0
    y2: float = 0.0
    width: float = 0.0        # groove width
    layer: str = "drill_5_12"
    note: str = ""


@dataclass
class Part:
    pid: str
    name: str
    length: float             # along the grain
    width: float
    thickness: float
    material: str
    qty: int = 1
    group: str = "carcass"    # carcass | front | drawer | back | plinth | accessory
    grain: str = "length"     # length | none
    edges: Dict[str, float] = field(default_factory=dict)   # L1/L2/W1/W2 -> band mm
    pos: Tuple[float, float, float] = (0, 0, 0)             # min corner, cabinet space
    size: Tuple[float, float, float] = (0, 0, 0)            # dx, dy, dz
    instances: List[Tuple[float, float, float]] = field(default_factory=list)
    ops: List[Op] = field(default_factory=list)
    note: str = ""

    @property
    def area_m2(self) -> float:
        return self.length * self.width / 1e6 * self.qty

    @property
    def raw_length(self) -> float:
        band_w1 = self.edges.get("W1", 0.0)
        band_w2 = self.edges.get("W2", 0.0)
        return round(max(0.0, self.length - (band_w1 + band_w2)), 1)

    @property
    def raw_width(self) -> float:
        band_l1 = self.edges.get("L1", 0.0)
        band_l2 = self.edges.get("L2", 0.0)
        return round(max(0.0, self.width - (band_l1 + band_l2)), 1)

    @property
    def raw_size(self) -> Tuple[float, float]:
        return (self.raw_length, self.raw_width)

    def band_metres(self) -> float:
        m = 0.0
        for e, t in self.edges.items():
            if t <= 0:
                continue
            m += (self.length if e.startswith("L") else self.width) / 1000.0
        return m * self.qty


@dataclass
class Hardware:
    key: str
    label: str
    qty: float
    unit: str = "pc"
    note: str = ""


@dataclass
class Unit:
    spec: Dict[str, Any]
    parts: List[Part] = field(default_factory=list)
    hardware: List[Hardware] = field(default_factory=list)
    issues: List[Dict[str, str]] = field(default_factory=list)
    meta: Dict[str, Any] = field(default_factory=dict)

    def add(self, p: Part) -> Part:
        # A part with qty > 1 must know where each copy actually sits, or the
        # 3D view stacks them all on one spot and the drawer looks wrong.
        if not p.instances:
            p.instances = [p.pos]
        self.parts.append(p)
        return p

    def hw(self, key, label, qty, unit="pc", note=""):
        for h in self.hardware:
            if h.key == key and h.note == note:
                h.qty += qty
                return h
        h = Hardware(key, label, qty, unit, note)
        self.hardware.append(h)
        return h

    def flag(self, level, code, msg, fix=""):
        for it in self.issues:
            if it["code"] == code and it["message"] == msg:
                it["count"] = it.get("count", 1) + 1
                return
        self.issues.append({"level": level, "code": code, "message": msg,
                            "fix": fix, "count": 1})


# ===========================================================================
#  HELPERS
# ===========================================================================
def sys32_rows(panel_length: float) -> List[float]:
    """Return System-32 hole centre positions along a panel, symmetric about
    the middle so that distance(first hole -> bottom) == distance(last -> top).
    That symmetry is the whole point of the system: one machine setup works
    whichever way up the panel is loaded."""
    p, m = S.SYS32["pitch"], S.SYS32["min_end_margin"]
    usable = panel_length - 2 * m
    if usable < p:
        return []
    n = int(usable // p) + 1
    span = (n - 1) * p
    start = (panel_length - span) / 2.0
    return [round(start + i * p, 1) for i in range(n)]


def snap32(value: float, origin: float, holes: List[float]) -> float:
    """Snap a target Y to the nearest System-32 hole centre."""
    if not holes:
        return value
    return min(holes, key=lambda h: abs((origin + h) - value))


def hinge_count(door_height: float) -> int:
    for lim, n in S.HINGE["count_by_height"]:
        if door_height <= lim:
            return n
    return 6


def hinge_positions(door_height: float) -> List[float]:
    """Cup-centre Y positions measured from the bottom of the door."""
    n = hinge_count(door_height)
    e = S.HINGE["first_from_end"]
    if n == 2:
        return [e, door_height - e]
    inner = door_height - 2 * e
    # extra hinges biased toward the top where load is highest
    step = inner / (n - 1)
    return [round(e + i * step, 1) for i in range(n)]


def pick_slide(clear_depth: float) -> Optional[int]:
    ok = [l for l in S.DRAWER["slide_lengths"]
          if l <= clear_depth - S.DRAWER["box_rear_clearance"]]
    return max(ok) if ok else None


def pick_box_height(row_h: float, mount="undermount") -> Optional[int]:
    top = S.DRAWER[f"{mount}_top_clearance"]
    bot = S.DRAWER[f"{mount}_bottom_clearance"]
    avail = row_h - top - bot
    ok = [h for h in S.DRAWER["standard_box_heights"] if h <= avail]
    return max(ok) if ok else None


def resolve_widths(items: List[Any], total: float, key="width") -> List[float]:
    """Distribute `total` across items; None/'fill' entries share the remainder."""
    fixed, fills = 0.0, []
    out = []
    for i, it in enumerate(items):
        v = it.get(key) if isinstance(it, dict) else it
        if v in (None, "fill", "auto"):
            fills.append(i)
            out.append(None)
        else:
            fixed += float(v)
            out.append(float(v))
    if fills:
        share = (total - fixed) / len(fills)
        for i in fills:
            out[i] = share
    elif abs(sum(out) - total) > 0.5 and sum(out) > 0:
        scale = total / sum(out)          # proportional re-fit
        out = [v * scale for v in out]
    return [round(v, 1) for v in out]


# ===========================================================================
#  MAIN BUILDER
# ===========================================================================
class CabinetBuilder:

    def __init__(self, spec: Dict[str, Any]):
        self.raw = spec
        self.s = self._normalise(spec)
        self.u = Unit(spec=self.s)
        self._n = 0

    # ---------------------------------------------------------------- setup
    def _normalise(self, spec):
        s = dict(spec)
        t = s.get("type", "cabinet")
        d = S.TYPE_DEFAULTS.get(t, S.TYPE_DEFAULTS["cabinet"])
        w, h, dp = d["whd"]
        s.setdefault("width", w)
        s.setdefault("height", h)
        s.setdefault("depth", dp)
        s.setdefault("material", S.DEFAULT_MATERIAL)
        s.setdefault("front_material", s["material"])
        s.setdefault("carcass_style", S.CARCASS["default_style"])
        s.setdefault("panel_thickness", S.PANEL["carcass"])
        s.setdefault("back_thickness", S.PANEL["back"])
        s.setdefault("back_material", S.BACK_MATERIAL)
        s.setdefault("door_thickness", S.PANEL["door"])
        s.setdefault("handle", "gold_bar")
        s.setdefault("led", "off")
        s.setdefault("zone", S.DEFAULT_ZONE)
        s.setdefault("unit_id", "U1")
        s.setdefault("base", {"type": "plinth", "height": 100, "setback": 50}
                     if t.startswith("kitchen") or t == "vanity"
                     else {"type": "none", "height": 0, "setback": 0})
        if not s.get("bays"):
            s["bays"] = self._auto_bays(s)
        s["bays"] = self._enforce_spans(s)
        return s

    def _enforce_spans(self, s):
        """A shelf that sags is a warranty claim. Any bay wider than the
        deflection limit for its board is split with extra dividers - which is
        exactly what a designer does by hand."""
        t = s["panel_thickness"]
        limit = S.SHELF_SPAN["mdf"].get(int(t), 800)
        bays, out = s["bays"], []
        target = resolve_widths(bays, s["width"])
        for bay, w in zip(bays, target):
            has_shelf = any(m.get("type") in (None, "shelves")
                            for m in bay.get("modules", []))
            opening = w - t
            if has_shelf and opening > limit and not bay.get("no_split"):
                k = math.ceil(opening / limit)
                for _ in range(k):
                    nb = copy.deepcopy(bay)
                    nb["width"] = round(w / k, 1)
                    out.append(nb)
            else:
                nb = dict(bay); nb["width"] = round(w, 1)
                out.append(nb)
        return out

    def _auto_bays(self, s):
        """No layout given -> generate a sensible one for the type."""
        t, W = s["type"], s["width"]
        if s.get("_top_box"):
            n = max(1, math.ceil(W / 600))
            return [{"width": None, "front": {"kind": "door", "leaves": 1},
                     "modules": [{"type": "shelves", "height": "fill", "count": 0}]}
                    for _ in range(n)]
        if t in ("wardrobe", "wardrobe_slide"):
            sliding = (s.get("front") or {}).get("kind") == "sliding"
            n = max(2, math.ceil(W / 600))
            inner = s["height"] - s["base"].get("height", 0) - 2 * s["panel_thickness"]
            e = S.ERGO["wardrobe"]
            bays = []
            for i in range(n):
                mods = []
                if i == 0 and inner >= 2000:
                    mods.append({"type": "drawers", "height": 640, "rows": 3})
                # reserve a 400mm top shelf whenever there is room for it
                top_shelf = inner - sum(m["height"] for m in mods) >= \
                    (e["long_hang_min"] + 400 + 3 * s["panel_thickness"])
                if top_shelf:
                    mods.append({"type": "hanging", "height": "fill"})
                    mods.append({"type": "shelves", "height": 400, "count": 1})
                else:
                    mods.append({"type": "hanging", "height": "fill"})
                bays.append({"width": None,
                             "front": None if sliding else {"kind": "door", "leaves": 1},
                             "modules": mods})
            return bays
        if t == "kitchen_base":
            return [{"width": None,
                     "modules": [{"type": "drawers", "height": "fill", "rows": 3,
                                  "front": {"kind": "drawer_faces"}}]}]
        if t == "kitchen_wall":
            n = max(1, round(W / 500))
            return [{"width": None, "front": {"kind": "door", "leaves": 1},
                     "modules": [{"type": "shelves", "height": "fill", "count": 2}]}
                    for _ in range(n)]
        if t == "kitchen_tall":
            return [{"width": None, "modules": [
                {"type": "shelves", "height": 1300, "count": 4,
                 "front": {"kind": "door", "leaves": 1}},
                {"type": "shelves", "height": "fill", "count": 2,
                 "front": {"kind": "door", "leaves": 1}}]}]
        if t == "vanity":
            return [{"width": None, "front": {"kind": "door", "leaves": 2},
                     "modules": [{"type": "open", "height": "fill"}]}]
        if t == "shelving":
            n = max(1, round(W / 800))
            return [{"width": None, "modules": [{"type": "shelves",
                     "height": "fill", "count": 4}]} for _ in range(n)]
        n = max(1, round(W / 500))
        return [{"width": None, "front": {"kind": "door", "leaves": 1},
                 "modules": [{"type": "shelves", "height": "fill", "count": 2}]}
                for _ in range(n)]

    def _pid(self, prefix):
        self._n += 1
        return f"{self.s['unit_id']}-{prefix}{self._n:02d}"

    # ---------------------------------------------------------------- build
    def build(self) -> Unit:
        s = self.s
        t = s["panel_thickness"]
        W, H, D = s["width"], s["height"], s["depth"]
        base = s["base"]
        hb = base.get("height", 0) if base.get("type") in ("plinth", "legs") else 0
        Hc = H - hb                      # carcass height
        self.t, self.W, self.H, self.D = t, W, H, D
        self.hb, self.Hc = hb, Hc
        self.mat = s["material"]

        # usable depth in front of the back panel
        self.z_back = D - S.CARCASS["back_groove_setback"] - s["back_thickness"]
        self.clear_depth = self.z_back            # from z=0 to back face

        self.bore_zones = {}          # bay index -> list of (y0, y1) absolute
        self.shelf_fix = {}           # bay index -> absolute Y of each fixed shelf
        self._bays()                  # layout first: it decides where holes go
        self._fronts()                # fronts add hinge-plate zones
        self._carcass()               # now bore only what is actually needed
        self._back()
        self._base()
        self._check_logistics()
        self._consumables()
        order = {"carcass": 0, "back": 1, "front": 2, "drawer": 3,
                 "plinth": 4, "accessory": 5}
        self.u.parts.sort(key=lambda p: (order.get(p.group, 9), p.pid))
        self.u.meta = {
            "unit_id": s["unit_id"], "type": s["type"],
            "W": W, "H": H, "D": D, "carcass_height": Hc, "plinth": hb,
            "internal_depth": self.clear_depth,
            "bay_openings": [b["_open"] for b in s["bays"]],
        }
        return self.u

    # ------------------------------------------------------------ carcass
    def _carcass(self):
        s, t, W, D, Hc, hb = self.s, self.t, self.W, self.D, self.Hc, self.hb
        style = s["carcass_style"]
        band = S.EDGEBAND["thickness"]

        if style == "sides_full":
            side_len, side_wid = Hc, D
            tb_len, tb_wid = W - 2 * t, D
        else:                                  # topbot_full
            side_len, side_wid = Hc - 2 * t, D
            tb_len, tb_wid = W, D

        for i, (nm, x0) in enumerate([("Side L", 0.0), ("Side R", W - t)]):
            p = self.u.add(Part(
                pid=self._pid("S"), name=nm, length=side_len, width=side_wid,
                thickness=t, material=self.mat, group="carcass",
                edges={"W1": band},           # front edge only (visible)
                pos=(x0, hb if style == "sides_full" else hb + t, 0.0),
                size=(t, side_len, side_wid),
                note="Face A = internal"))
            self._side_machining(p, [0] if i == 0 else [len(self.s["bays"]) - 1],
                                 p.pos[1])

        for nm, y0 in [("Bottom", hb if style == "topbot_full" else hb),
                       ("Top", self.H - t)]:
            y = hb if nm == "Bottom" else self.H - t
            x0 = 0.0 if style == "topbot_full" else t
            p = self.u.add(Part(
                pid=self._pid("H"), name=nm, length=tb_len, width=tb_wid,
                thickness=t, material=self.mat, group="carcass",
                edges={"W1": band},
                pos=(x0, y, 0.0), size=(tb_len, t, tb_wid)))
            self._groove_back(p, along="length")
            self._edge_connectors(p, edge_len=tb_len)

    def _zones_for(self, bay_idx_list) -> List[Tuple[float, float]]:
        z = []
        for i in bay_idx_list:
            z += self.bore_zones.get(i, [])
        if not z:
            return []
        z.sort()
        merged = [list(z[0])]
        for a, b in z[1:]:
            if a <= merged[-1][1] + S.SYS32["pitch"]:
                merged[-1][1] = max(merged[-1][1], b)
            else:
                merged.append([a, b])
        return [tuple(m) for m in merged]

    def _bore_column(self, p: Part, zones, y_origin, faces=("A",)):
        """Drill System-32 holes only where a zone requires them.
        Boring the full panel end-to-end is what hobby software does; a factory
        pays for machine seconds, so we bore the ranges that carry shelves,
        hinge plates or runners - and nothing else."""
        holes = sys32_rows(p.length)
        n = 0
        for h in holes:
            abs_y = y_origin + h
            if not any(z0 <= abs_y <= z1 for z0, z1 in zones):
                continue
            n += 1
            # x runs along the panel LENGTH, y across its WIDTH.
            # The System-32 rows run along the length; the two columns sit
            # 37mm in from each width edge.
            for y in (S.SYS32["front_setback"],
                      p.width - S.SYS32["rear_setback"]):
                for f in faces:
                    p.ops.append(Op(kind="drill", face=f,
                                    dia=S.SYS32["hole_dia"],
                                    depth=S.SYS32["hole_depth"],
                                    x=h, y=y, layer="drill_5_12",
                                    note="System 32"))
        return n

    def _shelf_fixings(self, p: Part, bay_idx_list, y_origin, faces=("A",)):
        """Every fixed shelf and divider needs real fixings, not good intentions."""
        n = 0
        for i in bay_idx_list:
            for abs_y in self.shelf_fix.get(i, []):
                local = abs_y - y_origin
                if not (0 < local < p.length):
                    continue
                for yy in self._connector_positions(p.width):
                    for f in faces:
                        p.ops.append(Op(kind="drill", face=f,
                                        dia=S.CARCASS["confirmat_dia"], depth=0,
                                        x=local, y=yy, layer="drill_thru",
                                        note="Confirmat into fixed shelf edge"))
                        n += 1
        return n

    def _side_machining(self, p: Part, bay_idx_list, y_origin):
        n = self._bore_column(p, self._zones_for(bay_idx_list), y_origin)
        self._shelf_fixings(p, bay_idx_list, y_origin)
        p.note += f" | {n} System-32 positions x 2 columns (37mm front / rear)"
        self._groove_back(p, along="length")
        # carcass connectors: through the side face into the top/bottom edges
        if self.s["carcass_style"] == "sides_full":
            for yy in self._connector_positions(p.width):
                for xx in (self.t / 2, p.length - self.t / 2):
                    p.ops.append(Op(kind="drill", face="A",
                                    dia=S.CARCASS["confirmat_dia"], depth=0,
                                    x=xx, y=yy, layer="drill_thru",
                                    note="Confirmat through-hole into top/bottom"))

    def _connector_positions(self, span: float) -> List[float]:
        e = S.CARCASS["confirmat_end_offset"]
        n = max(2, int(math.ceil((span - 2 * e) / S.CARCASS["confirmat_pitch_max"])) + 1)
        step = (span - 2 * e) / (n - 1)
        return [round(e + i * step, 1) for i in range(n)]

    def _groove_back(self, p: Part, along="length"):
        g = S.CARCASS
        y = p.width - g["back_groove_setback"] - g["back_groove_width"] / 2
        p.ops.append(Op(kind="groove", face="A", width=g["back_groove_width"],
                        depth=g["back_groove_depth"], x=0, y=y,
                        x2=p.length, y2=y, layer="groove",
                        note="Back panel groove"))

    def _edge_connectors(self, p: Part, edge_len: float):
        for x in self._connector_positions(p.width):
            for edge in ("W1", "W2"):
                p.ops.append(Op(kind="edge_drill", face=f"edge:{edge}",
                                dia=S.CARCASS["confirmat_pilot"], depth=50,
                                x=x, layer="drill_thru", note="Confirmat pilot"))

    def _back(self):
        s, t = self.s, self.t
        g = S.CARCASS["back_groove_depth"]
        bw = self.W - 2 * t + 2 * g
        bh = self.Hc - 2 * t + 2 * g
        # split oversized backs into panels that fit a sheet
        maxw = S.SHEET["default"][1] - 2 * S.SHEET["trim"]
        n = max(1, math.ceil(bw / maxw))
        seg = bw / n
        for i in range(n):
            self.u.add(Part(
                pid=self._pid("B"), name=f"Back{'' if n == 1 else f' {i+1}/{n}'}",
                length=round(bh, 1), width=round(seg, 1),
                thickness=s["back_thickness"],
                material=s.get("back_material", S.BACK_MATERIAL),
                group="back", grain="none",
                pos=(t - g + i * seg, self.hb + t - g, self.z_back),
                size=(seg, bh, s["back_thickness"]),
                note="Sits in 6x10 groove; also squares the carcass"))

    def _base(self):
        b = self.s["base"]
        if b.get("type") == "plinth" and b.get("height", 0) > 0:
            h, sb = b["height"], b.get("setback", 50)
            self.u.add(Part(
                pid=self._pid("P"), name="Plinth front", length=self.W - 2 * self.t,
                width=h, thickness=self.t, material=self.s["front_material"],
                group="plinth", edges={"L1": S.EDGEBAND["thickness"]},
                pos=(self.t, 0, sb), size=(self.W - 2 * self.t, h, self.t),
                note="Removable / clip-on toe kick"))
            for nm, x0 in [("Plinth side L", 0.0), ("Plinth side R", self.W - self.t)]:
                self.u.add(Part(
                    pid=self._pid("P"), name=nm, length=self.D - sb - self.t,
                    width=h, thickness=self.t, material=self.mat, group="plinth",
                    pos=(x0, 0, sb + self.t), size=(self.t, h, self.D - sb - self.t)))
            self.u.hw("adjustable_leg", "Adjustable leg 100mm",
                      max(4, 2 * math.ceil(self.W / 600)))
        elif b.get("type") == "legs":
            self.u.hw("adjustable_leg", "Adjustable leg",
                      max(4, 2 * math.ceil(self.W / 600)))

    # --------------------------------------------------------------- bays
    def _bays(self):
        s, t, W = self.s, self.t, self.W
        bays = s["bays"]
        self._dividers = []
        widths = resolve_widths(bays, W)
        b = 0.0
        bounds = []
        for w in widths:
            bounds.append((b, b + w))
            b += w

        for i, (bay, (x0, x1)) in enumerate(zip(bays, bounds)):
            left_edge = t if i == 0 else x0 + t / 2
            right_edge = (W - t) if i == len(bays) - 1 else x1 - t / 2
            bay["_x0"], bay["_x1"] = x0, x1
            bay["_ox0"], bay["_ox1"] = left_edge, right_edge
            bay["_open"] = round(right_edge - left_edge, 1)

            if i < len(bays) - 1:            # divider on the right boundary
                self.u.add(Part(
                    pid=self._pid("V"), name=f"Divider {i+1}",
                    length=self.Hc - 2 * t, width=self.clear_depth,
                    thickness=t, material=self.mat, group="carcass",
                    edges={"W1": S.EDGEBAND["thickness"]},
                    pos=(x1 - t / 2, self.hb + t, 0.0),
                    size=(t, self.Hc - 2 * t, self.clear_depth),
                    note="Full-height divider; System-32 both faces"))
                self._dividers.append((self.u.parts[-1], [i, i + 1]))

            self._bay_modules(bay, i)
        for pv, idxs in self._dividers:
            n = self._bore_column(pv, self._zones_for(idxs), pv.pos[1],
                                  faces=("A", "B"))
            self._shelf_fixings(pv, idxs, pv.pos[1], faces=("A", "B"))
            # A divider is only as deep as the clear depth, so its rear edge
            # butts the back panel - it takes no back groove.
            pv.note += f" | {n} System-32 positions, both faces"

    def _bay_modules(self, bay, idx):
        t = self.t
        y0 = self.hb + t
        y1 = self.H - t
        inner_h = y1 - y0
        mods = bay.get("modules", [{"type": "shelves", "height": "fill", "count": 2}])
        # every junction between stacked modules costs one 18mm fixed shelf
        usable_h = inner_h - (len(mods) - 1) * t
        heights = resolve_widths(mods, usable_h, key="height")
        ow = bay["_open"]
        y = y0
        for m, mh in zip(mods, heights):
            m["_y0"], m["_y1"], m["_h"] = round(y, 1), round(y + mh, 1), round(mh, 1)
            m["_ow"] = ow
            kind = m.get("type", "shelves")
            zl = self.bore_zones.setdefault(idx, [])
            if kind == "shelves":
                zl.append((m["_y0"] + 100, m["_y1"] - 100))
            if kind == "shelves":
                self._mod_shelves(bay, m)
            elif kind == "drawers":
                self._mod_drawers(bay, m)
            elif kind == "hanging":
                self._mod_hanging(bay, m)
            y += mh
            # fixed shelf between stacked modules
            if m is not mods[-1]:
                self._fixed_shelf(bay, y, idx)
                y += t
                m["_y1"] = round(m["_y1"], 1)
        # re-fit if fixed shelves consumed height
        return

    def _fixed_shelf(self, bay, y, idx=0):
        ow = bay["_open"]
        self.shelf_fix.setdefault(idx, []).append(y + self.t / 2)
        self.u.add(Part(
            pid=self._pid("F"), name=f"Fixed shelf @{int(y)}",
            length=ow, width=self.clear_depth, thickness=self.t,
            material=self.mat, group="carcass",
            edges={"L1": S.EDGEBAND["thickness"]},
            pos=(bay["_ox0"], y, 0.0), size=(ow, self.t, self.clear_depth),
            note="Structural: ties the carcass. Confirmat 7x50 through the "
                 "side/divider into both short edges."))
        self._edge_connectors(self.u.parts[-1], edge_len=ow)
        self._span_check(ow, "fixed shelf")

    def _mod_shelves(self, bay, m):
        n = int(m.get("count", 2))
        if n <= 0:
            return
        ow, h0, h1 = m["_ow"], m["_y0"], m["_y1"]
        cl = S.CARCASS["shelf_side_clearance"]
        sd = self.clear_depth - S.CARCASS["shelf_front_setback"]
        pitch = (h1 - h0) / (n + 1)
        ys = [h0 + pitch * (i + 1) for i in range(n)]
        p = self.u.add(Part(
            pid=self._pid("A"), name=f"Adj. shelf (bay {bay['_x0']:.0f})",
            length=round(ow - cl, 1), width=round(sd, 1), thickness=self.t,
            material=self.mat, qty=n, group="carcass",
            edges={"L1": S.EDGEBAND["thickness"]},
            pos=(bay["_ox0"] + cl / 2, ys[0], S.CARCASS["shelf_front_setback"]),
            size=(ow - cl, self.t, sd),
            instances=[(bay["_ox0"] + cl / 2, y, S.CARCASS["shelf_front_setback"])
                       for y in ys],
            note=f"{n} adjustable, nominal pitch {pitch:.0f}mm, 4 x 5mm pins each"))
        self.u.hw("shelf_pin", "Shelf pin 5mm", 4 * n)
        self._span_check(ow, "adjustable shelf")
        m["_shelf_ys"] = [round(y, 1) for y in ys]

    def _span_check(self, span, what):
        lim = S.SHELF_SPAN["mdf"][int(self.t)]
        if span > lim:
            self.u.flag("error", "SHELF_SPAN",
                        f"{what} clear span {span:.0f}mm exceeds the {lim}mm limit "
                        f"for {self.t:.0f}mm MDF (deflection > L/200).",
                        f"Add a mid divider, thicken to 25mm ({S.SHELF_SPAN['mdf'][25]}mm "
                        f"limit), or add a rear cleat / front lipping.")

    def _mod_hanging(self, bay, m):
        ow, h0, h1 = m["_ow"], m["_y0"], m["_y1"]
        z = self.clear_depth / 2
        y = h1 - 60
        self.u.add(Part(
            pid=self._pid("R"), name="Hanger rod", length=round(ow, 1),
            width=30, thickness=15, material="aluminium", group="accessory",
            grain="none", pos=(bay["_ox0"], y, z - 15), size=(ow, 30, 30),
            note="Oval alu rod 30x15 in end supports"))
        self.u.hw("hanger_rod_m", "Aluminium hanger rod", ow / 1000.0, "m")
        self.u.hw("rod_support", "Rod end support", 2)
        clear = h1 - h0 - 60
        m["_hang_clear"] = round(clear, 1)
        e = S.ERGO["wardrobe"]
        if clear < e["short_hang_min"]:
            self.u.flag("error", "HANG_HEIGHT",
                        f"Hanging clear height {clear:.0f}mm < {e['short_hang_min']}mm "
                        f"minimum for short-hang garments.",
                        "Increase the module height or convert to shelving.")
        elif clear < e["long_hang_min"]:
            self.u.flag("info", "HANG_TYPE",
                        f"Hanging clear height {clear:.0f}mm suits SHORT-hang "
                        f"(shirts/jackets) only; long garments need "
                        f"{e['long_hang_min']}-{e['long_hang_max']}mm.")
        if self.clear_depth < e["min_internal_depth_hanging"]:
            self.u.flag("error", "HANG_DEPTH",
                        f"Internal depth {self.clear_depth:.0f}mm < "
                        f"{e['min_internal_depth_hanging']}mm - hangers will foul "
                        f"the doors.",
                        f"Increase external depth to >= "
                        f"{e['min_internal_depth_hanging'] + 18 + 18:.0f}mm, or use a "
                        f"pull-out side-mounted rail.")
        if ow > 1000:
            self.u.hw("rod_centre_support", "Rod centre support", 1,
                      note="span > 1000mm")

    def _mod_drawers(self, bay, m):
        rows = int(m.get("rows", 3))
        ow, h0, h1 = m["_ow"], m["_y0"], m["_y1"]
        mount = m.get("mount", "undermount")
        ts = S.PANEL["drawer_side"]
        gb = S.DRAWER
        slide = pick_slide(self.clear_depth)
        if slide is None:
            self.u.flag("error", "SLIDE_DEPTH",
                        f"Internal depth {self.clear_depth:.0f}mm too shallow for the "
                        f"shortest {min(gb['slide_lengths'])}mm runner.",
                        "Increase cabinet depth or use hinged doors + shelves.")
            return
        row_h = (h1 - h0) / rows
        box_h = pick_box_height(row_h, mount)
        if box_h is None:
            self.u.flag("error", "DRAWER_HEIGHT",
                        f"Row height {row_h:.0f}mm cannot host a standard drawer box.",
                        f"Reduce to {rows-1} rows or raise the module height.")
            return

        box_out_w = ow - gb[f"{mount}_side_clearance_total"]
        box_in_w = box_out_w - 2 * ts
        side_gap = (ow - box_out_w) / 2.0
        x_left = bay["_ox0"] + side_gap
        x_right = x_left + box_out_w - ts
        bot_cl = gb[f"{mount}_bottom_clearance"]
        bd = gb["bottom_groove_depth"]

        # --- one positioned copy per drawer, per side -----------------------
        sides, fronts, backs, bottoms, runner_ys = [], [], [], [], []
        for r in range(rows):
            y_box = h0 + r * row_h + bot_cl
            sides += [(x_left, y_box, 0.0), (x_right, y_box, 0.0)]
            fronts.append((x_left + ts, y_box, 0.0))
            backs.append((x_left + ts, y_box, slide - ts))
            bottoms.append((x_left + ts, y_box + gb["bottom_groove_from_edge"], ts))
            runner_ys.append(y_box)

        p = self.u.add(Part(
            pid=self._pid("DS"), name="Drawer side",
            length=slide, width=box_h, thickness=ts,
            material=S.DRAWER_BOX_MATERIAL, qty=len(sides), group="drawer",
            edges={"L1": S.EDGEBAND["thin"], "W1": S.EDGEBAND["thin"]},
            pos=sides[0], size=(ts, box_h, slide), instances=sides,
            note=f"L+R for {rows} drawers. Bottom groove "
                 f"{gb['bottom_groove_width']:.0f}x{gb['bottom_groove_depth']:.0f} at "
                 f"{gb['bottom_groove_from_edge']:.0f}mm from the lower edge"))
        p.ops.append(Op(kind="groove", face="A", width=gb["bottom_groove_width"],
                        depth=bd, x=0, y=gb["bottom_groove_from_edge"],
                        x2=slide, y2=gb["bottom_groove_from_edge"],
                        layer="groove", note="Drawer bottom"))

        p = self.u.add(Part(
            pid=self._pid("DF"), name="Drawer box front/back",
            length=round(box_in_w, 1), width=box_h, thickness=ts,
            material=S.DRAWER_BOX_MATERIAL, qty=len(fronts) + len(backs),
            group="drawer", edges={"L1": S.EDGEBAND["thin"]},
            pos=fronts[0], size=(box_in_w, box_h, ts),
            instances=fronts + backs,
            note=f"{rows} fronts + {rows} backs, identical"))
        p.ops.append(Op(kind="groove", face="A", width=gb["bottom_groove_width"],
                        depth=bd, x=0, y=gb["bottom_groove_from_edge"],
                        x2=box_in_w, y2=gb["bottom_groove_from_edge"],
                        layer="groove"))

        self.u.add(Part(
            pid=self._pid("DB"), name="Drawer bottom",
            length=round(box_in_w + 2 * bd, 1),
            width=round(slide - 2 * ts + 2 * bd, 1),
            thickness=S.PANEL["drawer_bottom"], material=S.DRAWER_BOX_MATERIAL,
            qty=rows, group="drawer", grain="none",
            pos=bottoms[0],
            size=(box_in_w, S.PANEL["drawer_bottom"], slide - 2 * ts),
            instances=bottoms))

        # --- runner fixings: bore the runner heights, not the whole module ---
        idx = self.s["bays"].index(bay)
        zl = self.bore_zones.setdefault(idx, [])
        grid = [self.hb + g for g in sys32_rows(self.Hc)]
        for y in runner_ys:
            t = min(grid, key=lambda g: abs(g - y)) if grid else y
            zl.append((t - 16, t + 16))
        m["_runner_ys"] = [round(y, 1) for y in runner_ys]

        self.u.hw("drawer_slide_pair",
                  f"Undermount runner {slide}mm soft-close", rows, "pair")
        m["_rows"], m["_row_h"], m["_box_h"], m["_slide"] = rows, row_h, box_h, slide
        m["_box_out_w"] = round(box_out_w, 1)

        if h1 > S.ERGO["wardrobe"]["top_drawer_max_height"]:
            self.u.flag("warn", "DRAWER_REACH",
                        f"Top drawer at {h1:.0f}mm exceeds the "
                        f"{S.ERGO['wardrobe']['top_drawer_max_height']}mm comfortable "
                        f"reach for seeing into a drawer.",
                        "Move the drawer bank lower or use pull-out shelves above.")

    # ------------------------------------------------------------- fronts
    def _fronts(self):
        s = self.s
        uf = s.get("front") or {}
        if uf.get("kind") == "sliding":
            return self._sliding_fronts(uf)
        for bay in s["bays"]:
            bf = bay.get("front")
            if bf and bf.get("kind") == "door":
                self._hinged_doors(bay, bf, bay_full=True)
            else:
                for m in bay.get("modules", []):
                    mf = m.get("front") or (
                        {"kind": "drawer_faces"} if m.get("type") == "drawers" else None)
                    if not mf:
                        continue
                    if mf.get("kind") == "door":
                        self._hinged_doors(bay, mf, module=m)
                    elif mf.get("kind") == "drawer_faces":
                        self._drawer_faces(bay, m)

    def _front_zone(self, bay, module=None):
        """Return (x0, x1, y0, y1) of the visible front rectangle, reveals applied."""
        r = S.FRONTS["edge_reveal"]
        x0 = bay["_x0"] + r
        x1 = bay["_x1"] - r
        if module:
            y0 = module["_y0"] - self.t / 2 + r
            y1 = module["_y1"] + self.t / 2 - r
        else:
            y0 = self.hb + S.FRONTS["bottom_reveal"]
            y1 = self.H - S.FRONTS["top_reveal"]
        return x0, x1, y0, y1

    def _hinged_doors(self, bay, cfg, module=None, bay_full=False):
        n = int(cfg.get("leaves", 1))
        style = cfg.get("style", self.s.get("door_style", "solid_panel"))
        x0, x1, y0, y1 = self._front_zone(bay, module)
        zone_w, zone_h = x1 - x0, y1 - y0
        g = S.FRONTS["gap"]
        dw = round((zone_w - (n - 1) * g) / n, 1)
        residual = zone_w - (n * dw + (n - 1) * g)   # <= 0.1mm rounding crumb
        dh = zone_h

        if dw > S.FRONTS["max_hinged_door_width"]:
            need = math.ceil(zone_w / S.FRONTS["max_hinged_door_width"])
            self.u.flag("error", "DOOR_WIDTH",
                        f"Hinged door {dw:.0f}mm wide exceeds the "
                        f"{S.FRONTS['max_hinged_door_width']:.0f}mm limit - it will "
                        f"sag and the swing needs {dw:.0f}mm of clear floor.",
                        f"Split into {need} leaves, or switch this unit to sliding doors.")
        stack = 1
        if dh > S.FRONTS["max_hinged_door_height"]:
            stack = math.ceil(dh / S.FRONTS["max_hinged_door_height"])
            dh = (zone_h - (stack - 1) * g) / stack
            self.u.flag("info", "DOOR_SPLIT",
                        f"Front height {zone_h:.0f}mm exceeds the "
                        f"{S.FRONTS['max_hinged_door_height']:.0f}mm single-leaf limit; "
                        f"auto-split into {stack} stacked leaves of {dh:.0f}mm "
                        f"with a {g:.0f}mm shadow gap.",
                        "A horizontal rail behind the joint keeps both leaves flat.")
        if dw * dh / 1e6 > S.FRONTS["max_door_area_m2"]:
            self.u.flag("warn", "DOOR_MASS",
                        f"Door area {dw*dh/1e6:.2f} m2 - mass approx "
                        f"{dw*dh*self.s['door_thickness']/1e9*S.LOGISTICS['density_kg_m3']['mdf']:.1f}kg. "
                        f"Use heavy-duty hinges and 4+ per leaf.")

        nh = hinge_count(dh)
        hy_nom = hinge_positions(dh)
        bidx = self.s["bays"].index(bay)
        grid = [self.hb + h for h in sys32_rows(self.Hc)]
        for i in range(n * stack):
            col, row = i % n, i // n
            w_this = dw + (residual if col == n - 1 else 0.0)
            dx = x0 + col * (dw + g)
            dy0 = y0 + row * (dh + g)
            hinge_side = "L" if (col == 0 or n == 1) else "R"
            p = self.u.add(Part(
                pid=self._pid("D"),
                name=f"Door b{bidx+1}-{col+1}" + (f"-lvl{row+1}" if stack > 1 else "")
                     + f" ({hinge_side}H)",
                length=round(dh, 1), width=round(w_this, 2),
                thickness=self.s["door_thickness"],
                material=self.s["front_material"], group="front",
                edges={"L1": S.EDGEBAND["thickness"], "L2": S.EDGEBAND["thickness"],
                       "W1": S.EDGEBAND["thickness"], "W2": S.EDGEBAND["thickness"]},
                pos=(dx, dy0, -self.s["door_thickness"]),
                size=(w_this, dh, self.s["door_thickness"]),
                note=f"{style}; {nh} hinges; hinge edge {hinge_side}"))
            # Snap every hinge to an existing System-32 hole. This is the single
            # highest-value trick in frameless cabinetmaking: the mounting plate
            # then needs no dedicated boring - it screws into the shelf-pin row.
            hy = []
            for hh in hy_nom:
                target = dy0 + hh
                if grid:
                    snapped = min(grid, key=lambda g: abs(g - target))
                    if abs(snapped - target) <= S.SYS32["pitch"] and \
                       60 <= (snapped - dy0) <= dh - 60:
                        target = snapped
                hy.append(round(target - dy0, 1))
                z = self.bore_zones.setdefault(bidx, [])
                z.append((target - 40, target + 40))
            # Door part: length = door height, width = door width.
            # Cup centres sit 22.5mm in from the hinge edge (a width edge),
            # spaced up the height (the length).
            e = S.HINGE["cup_centre_from_edge"]
            cy = e if hinge_side == "L" else w_this - e
            for hpos in hy:
                p.ops.append(Op(kind="drill", face="A", dia=S.HINGE["cup_dia"],
                                depth=S.HINGE["cup_depth"], x=hpos, y=cy,
                                layer="drill_35_13", note="Hinge cup"))
                for dx in (-S.HINGE["cup_screw_pitch"] / 2,
                           S.HINGE["cup_screw_pitch"] / 2):
                    p.ops.append(Op(kind="drill", face="A",
                                    dia=S.HINGE["cup_screw_dia"],
                                    depth=13, x=hpos + dx, y=cy,
                                    layer="drill_8_13",
                                    note="Cup fixing dowel"))
            self._handle(p, orientation="vertical", hinge_side=hinge_side)
            self.u.hw("hinge_softclose",
                      f"Blum CLIP top BLUMOTION {S.HINGE['opening_angle']:.0f} deg", nh)
            self.u.hw("door_surcharge", f"Door front: {style}", 1, note=style)
            self._mount_plate_holes(bay, hinge_side, hy, dy0)

    def _mount_plate_holes(self, bay, hinge_side, hy, y0):
        """Record where the hinge mounting plates land on the side/divider.
        They sit on the System-32 front row at 37mm, so no extra boring is
        needed if the row already exists - we assert that here."""
        for y in hy:
            abs_y = y0 + y
            holes = [h for h in sys32_rows(self.Hc)]
            if not holes:
                continue
            nearest = min(holes, key=lambda h: abs((self.hb + h) - abs_y))
            if abs((self.hb + nearest) - abs_y) > 1.0:
                self.u.flag("info", "HINGE_PLATE_OFFGRID",
                            f"Hinge plate at Y={abs_y:.0f}mm is "
                            f"{abs((self.hb+nearest)-abs_y):.0f}mm off the System-32 "
                            f"grid - dedicated 5mm holes required.",
                            "Nudge the door height or accept a second boring pass.")

    def _drawer_faces(self, bay, m):
        rows = m.get("_rows")
        if not rows:
            return
        x0, x1, y0, y1 = self._front_zone(bay, m)
        g = S.FRONTS["gap"]
        fw = x1 - x0
        fh = (y1 - y0 - (rows - 1) * g) / rows
        if fh < S.DRAWER["min_face_height"]:
            self.u.flag("warn", "FACE_HEIGHT",
                        f"Drawer face {fh:.0f}mm is below the {S.DRAWER['min_face_height']:.0f}mm "
                        f"practical minimum.", "Reduce the number of rows.")
        face_ys = [y0 + i * (fh + g) for i in range(rows)]
        p = self.u.add(Part(
            pid=self._pid("DFR"), name=f"Drawer face (bay {bay['_x0']:.0f})",
            length=round(fw, 1), width=round(fh, 1),
            thickness=self.s["door_thickness"], material=self.s["front_material"],
            qty=rows, group="front",
            edges={k: S.EDGEBAND["thickness"] for k in ("L1", "L2", "W1", "W2")},
            pos=(x0, face_ys[0], -self.s["door_thickness"]),
            size=(fw, fh, self.s["door_thickness"]),
            instances=[(x0, y, -self.s["door_thickness"]) for y in face_ys],
            note=f"{rows} identical faces, {g:.0f}mm gaps"))
        self._handle(p, orientation="horizontal")
        for i in range(2):
            p.ops.append(Op(kind="drill", face="A", dia=5, depth=12,
                            x=37 if i == 0 else fw - 37, y=fh / 2,
                            layer="drill_5_12", note="Front fixing bracket"))
        m["_face_h"] = round(fh, 1)

    def _handle(self, p: Part, orientation="vertical", hinge_side="L"):
        h = self.s.get("handle", "none")
        if h in ("none", "hidden_push"):
            if h == "hidden_push":
                self.u.hw("push_latch", "Push-to-open latch", p.qty)
            return
        cc = 128.0
        if orientation == "vertical":
            y = p.width - 50 if hinge_side == "L" else 50
            for dx in (-cc / 2, cc / 2):
                p.ops.append(Op(kind="drill", face="A", dia=5, depth=0,
                                x=p.length / 2 + dx, y=y, layer="drill_thru",
                                note="Handle 128 c/c"))
        else:
            for dx in (-cc / 2, cc / 2):
                p.ops.append(Op(kind="drill", face="A", dia=5, depth=0,
                                x=p.length / 2 + dx, y=p.width / 2,
                                layer="drill_thru", note="Handle 128 c/c"))
        self.u.hw("handle", f"Handle {h} 128mm c/c", p.qty, note=h)

    def _sliding_fronts(self, cfg):
        n = int(cfg.get("doors", 2 if self.W < 2000 else 3))
        ov = cfg.get("overlap", S.SLIDING["default_overlap"])
        style = cfg.get("style", "full_mirror")
        opening_w, opening_h = self.W, self.H
        dw = (opening_w + (n - 1) * ov) / n
        dh = opening_h - S.SLIDING["door_height_deduction"]
        if dw > S.SLIDING["max_door_width"]:
            self.u.flag("error", "SLIDE_WIDTH",
                        f"Sliding leaf {dw:.0f}mm exceeds the "
                        f"{S.SLIDING['max_door_width']:.0f}mm practical maximum.",
                        f"Use {n+1} leaves.")
        track_depth = (S.SLIDING["track_depth_3door"] if n >= 3
                       else S.SLIDING["track_depth_2door"])
        pitch = track_depth / n          # each leaf gets its own track
        leaf_t = 20.0
        framed = style != "solid_panel"
        for i in range(n):
            z0 = -((i + 1) * pitch)      # track 1 nearest the room
            self.u.add(Part(
                pid=self._pid("SD"), name=f"Sliding door {i+1}/{n}",
                length=round(dh, 1), width=round(dw, 1),
                thickness=self.s["door_thickness"] if style == "solid_panel"
                          else S.PANEL["glass_door"],
                material=self.s["front_material"] if style == "solid_panel" else style,
                group="front",
                edges={} if framed else
                      {k: S.EDGEBAND["thickness"] for k in ("L1", "L2", "W1", "W2")},
                pos=(i * (dw - ov), S.SLIDING["bottom_track_height"], z0),
                size=(dw, dh, leaf_t),
                note=f"{style} infill in {S.SLIDING['frame_profile']} frame; "
                     f"overlap {ov:.0f}mm; TRACK {i+1} of {n} at "
                     f"{abs(z0):.0f}mm from the carcass face"))
            self.u.hw("sliding_gear_per_door", "Sliding door gear set (rollers+guides)", 1)
            self.u.hw("door_surcharge", f"Sliding leaf: {style}", 1, note=style)
        self.u.hw("sliding_track", f"{n}-track alu top+bottom rail", self.W / 1000.0, "m")
        self.u.flag("info", "SLIDE_DEPTH_LOSS",
                    f"Sliding gear consumes approx "
                    f"{S.SLIDING['carcass_depth_penalty']:.0f}mm of depth; usable "
                    f"internal depth is {self.clear_depth - S.SLIDING['carcass_depth_penalty']:.0f}mm.")
        self.s["_sliding"] = {"n": n, "dw": round(dw, 1), "dh": round(dh, 1), "overlap": ov}

    def _check_logistics(self):
        sw, sh = S.SHEET["default"]
        sw -= 2 * S.SHEET["trim"]; sh -= 2 * S.SHEET["trim"]
        for p in self.u.parts:
            if p.group == "accessory":
                continue
            L, Wd = max(p.length, p.width), min(p.length, p.width)
            if L > sw or Wd > sh:
                self.u.flag("error", "SHEET_SIZE",
                            f"{p.pid} {p.name} {p.length:.0f}x{p.width:.0f}mm does not "
                            f"fit a {S.SHEET['default'][0]:.0f}x{S.SHEET['default'][1]:.0f}mm "
                            f"sheet after trim.",
                            "Split the part or source oversize board.")
            if L > S.LOGISTICS["max_panel_elevator"]:
                self.u.flag("warn", "TRANSPORT",
                            f"{p.pid} {p.name} is {L:.0f}mm long - over the "
                            f"{S.LOGISTICS['max_panel_elevator']:.0f}mm standard lift limit.",
                            "Confirm stair access or split the carcass horizontally "
                            "with a mid rail.")
            kg = (p.length * p.width * p.thickness / 1e9) * \
                 S.LOGISTICS["density_kg_m3"]["mdf"]
            if kg > S.LOGISTICS["max_single_person_kg"]:
                p.note += f" | {kg:.0f}kg - two-person lift"
        if self.W > S.LOGISTICS["long_run_threshold"]:
            self.u.flag("info", "EXPANSION",
                        f"Run is {self.W:.0f}mm. Leave "
                        f"{S.LOGISTICS['long_run_expansion_gap']:.0f}mm expansion per "
                        f"{S.LOGISTICS['long_run_threshold']:.0f}m and scribe with "
                        f"{S.TOLERANCE['scribe_allowance']:.0f}mm fillers - UAE AC "
                        f"cycling moves long MDF runs.")
        if self.s["type"] in S.UAE_RULES["moisture_resistant_required"]:
            self.u.flag("info", "MR_MDF", S.UAE_RULES["note_mr"])

    # -------------------------------------------------------- consumables
    def _consumables(self):
        area = sum(p.area_m2 for p in self.u.parts if p.group in ("carcass", "front", "plinth"))
        self.u.hw("confirmat_set_m2", "Confirmat 7x50 + cam/dowel set", round(area, 2), "m2")
        band = sum(p.band_metres() for p in self.u.parts)
        self.u.hw("edgeband_m", f"PVC edgeband {S.EDGEBAND['thickness']}mm",
                  round(band, 1), "m")
        led = self.s.get("led", "off")
        if led != "off":
            self.u.hw("led", f"LED kit ({led})", 1, note=led)


def build(spec: Dict[str, Any]) -> Unit:
    return CabinetBuilder(spec).build()
