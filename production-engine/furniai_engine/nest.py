"""
FurniAI - Sheet Nesting (guillotine, kerf-aware, grain-aware)
=============================================================
Panel saws can only make guillotine cuts: every cut runs edge-to-edge across
the piece being cut. So we do NOT use a free-form nester here - we use a
shelf/strip algorithm that a beam saw can actually execute.

Algorithm: First-Fit Decreasing Height with kerf, restricted to horizontal
strips (a "shelf"). Parts with grain=length may not be rotated; grain-free
parts (backs, drawer bottoms) may.
"""
from __future__ import annotations
from typing import List, Dict, Any, Tuple
import standards as S


class Placement:
    __slots__ = ("pid", "name", "x", "y", "w", "h", "rotated", "material", "thk")

    def __init__(self, pid, name, x, y, w, h, rotated, material, thk):
        self.pid, self.name = pid, name
        self.x, self.y, self.w, self.h = x, y, w, h
        self.rotated, self.material, self.thk = rotated, material, thk

    def as_dict(self):
        return {k: getattr(self, k) for k in self.__slots__}


class Sheet:
    def __init__(self, index, sw, sh, material, thk):
        self.index, self.material, self.thk = index, material, thk
        self.w, self.h = sw, sh
        self.placements: List[Placement] = []
        self.strips: List[Dict[str, float]] = []   # y, height, used_x

    @property
    def used_area(self):
        return sum(p.w * p.h for p in self.placements)

    @property
    def yield_pct(self):
        return 100.0 * self.used_area / (self.w * self.h)


def nest(parts, sheet_size=None, kerf=None, trim=None) -> Dict[str, Any]:
    sw, sh = sheet_size or S.SHEET["default"]
    kerf = S.SHEET["kerf"] if kerf is None else kerf
    trim = S.SHEET["trim"] if trim is None else trim
    usable_w, usable_h = sw - 2 * trim, sh - 2 * trim

    # explode quantities, group by (material, thickness)
    groups: Dict[Tuple[str, float], List[Dict]] = {}
    for p in parts:
        if p.group == "accessory":
            continue
        key = (p.material, round(p.thickness, 1))
        for i in range(p.qty):
            groups.setdefault(key, []).append({
                "pid": p.pid if p.qty == 1 else f"{p.pid}#{i+1}",
                "name": p.name, "l": p.length, "w": p.width,
                "grain": _eff_grain(p), "material": p.material,
                "thk": p.thickness})

    sheets: List[Sheet] = []
    unplaced = []
    idx = 0
    for (mat, thk), items in sorted(groups.items()):
        # decreasing height: "height" = the dimension across the strip
        items.sort(key=lambda it: (-max(it["l"], it["w"]), -min(it["l"], it["w"])))
        grp_sheets: List[Sheet] = []
        for it in items:
            placed = False
            for orient in _orientations(it, usable_w, usable_h):
                w, h, rot = orient
                for sheet in grp_sheets:
                    if _place_in(sheet, it, w, h, rot, kerf, usable_w, usable_h, trim):
                        placed = True
                        break
                if placed:
                    break
            if not placed:
                orients = _orientations(it, usable_w, usable_h)
                if not orients:
                    unplaced.append(it)
                    continue
                idx += 1
                sheet = Sheet(idx, sw, sh, mat, thk)
                grp_sheets.append(sheet)
                w, h, rot = orients[0]
                _place_in(sheet, it, w, h, rot, kerf, usable_w, usable_h, trim)
        sheets += grp_sheets

    total_used = sum(s.used_area for s in sheets)
    total_area = sum(s.w * s.h for s in sheets)
    return {
        "sheets": sheets,
        "unplaced": unplaced,
        "sheet_count": len(sheets),
        "yield_pct": round(100.0 * total_used / total_area, 1) if total_area else 0.0,
        "sheet_size": (sw, sh),
        "kerf": kerf,
        "area_used_m2": round(total_used / 1e6, 3),
        "area_bought_m2": round(total_area / 1e6, 3),
    }


def _eff_grain(p):
    """Grain direction only constrains nesting on a grained finish. A plain
    white or matt colour board can be rotated freely - which is typically
    worth 8-15 percentage points of sheet yield."""
    m = S.MATERIALS.get(p.material)
    if m is not None and not m.get("grained", False):
        return "none"
    return p.grain


def _orientations(it, uw, uh):
    out = []
    l, w = it["l"], it["w"]
    if l <= uw and w <= uh:
        out.append((l, w, False))
    if it["grain"] == "none" and w <= uw and l <= uh:
        out.append((w, l, True))
    return out


def _place_in(sheet, it, w, h, rot, kerf, uw, uh, trim) -> bool:
    for st in sheet.strips:
        if h <= st["height"] and st["used_x"] + w <= uw:
            x = trim + st["used_x"]
            y = trim + st["y"]
            sheet.placements.append(Placement(it["pid"], it["name"], x, y, w, h,
                                              rot, it["material"], it["thk"]))
            st["used_x"] += w + kerf
            return True
    used_y = sum(s["height"] + kerf for s in sheet.strips)
    if used_y + h <= uh:
        st = {"y": used_y, "height": h, "used_x": 0.0}
        sheet.strips.append(st)
        sheet.placements.append(Placement(it["pid"], it["name"],
                                          trim + 0.0, trim + used_y, w, h,
                                          rot, it["material"], it["thk"]))
        st["used_x"] = w + kerf
        return True
    return False
