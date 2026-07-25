"""
FurniAI - Project Planner
=========================
Turns ONE customer-level request into the set of factory units that can
actually be built, transported through a UAE lift, and installed.

Three transforms, applied in order:
  1. TALL SPLIT   - anything over the carcass height limit becomes
                    a main carcass + a top box (the standard answer to a
                    2.7-3.0m villa ceiling).
  2. RUN SPLIT    - a long run becomes several modules under the sheet /
                    handling limit, plus scribe fillers at the walls.
  3. KITCHEN ZONE - a "kitchen" request expands into base + wall + tall runs.
"""
from __future__ import annotations
from typing import List, Dict, Any
import copy, math
import standards as S

MAX_CARCASS_H = S.LOGISTICS["max_panel_elevator"]      # 2400
MIN_TOP_BOX_H = 350.0
MAX_MODULE_W = 1200.0        # widest single carcass we will build
MIN_MODULE_W = 300.0


def _split_tall(spec: Dict[str, Any]) -> List[Dict[str, Any]]:
    H = spec["height"]
    if H <= MAX_CARCASS_H or spec.get("no_split"):
        return [spec]
    top_h = H - MAX_CARCASS_H
    if top_h < MIN_TOP_BOX_H:
        top_h = MIN_TOP_BOX_H
    main_h = H - top_h - 0.0
    main = copy.deepcopy(spec)
    main["height"] = round(main_h, 1)
    main["_stack_y"] = 0.0
    main["unit_id"] = spec.get("unit_id", "U1")

    top = copy.deepcopy(spec)
    top["height"] = round(top_h, 1)
    top["_stack_y"] = round(main_h, 1)
    top["unit_id"] = spec.get("unit_id", "U1") + "T"
    top["base"] = {"type": "none", "height": 0, "setback": 0}
    top["_top_box"] = True
    top["front"] = {"kind": "door"} if (spec.get("front") or {}).get("kind") != "sliding" \
        else spec["front"]
    # a top box is always a single shelf module per bay - it is seasonal storage
    for b in top.get("bays", []) or []:
        b["modules"] = [{"type": "shelves", "height": "fill", "count": 1}]
        b["front"] = {"kind": "door", "leaves": 1}
    if not top.get("bays"):
        top.pop("bays", None)
    top["_note"] = ("Top box / loft unit. Above 1850mm reach: seasonal storage only. "
                    "Fixed to the main carcass with connector bolts, scribed to the "
                    "ceiling with a 20mm filler.")
    return [main, top]


def _partition_bays(orig_bays: List[Dict[str, Any]], n: int) -> List[List[Dict[str, Any]]]:
    if not orig_bays:
        return [[] for _ in range(n)]
    if len(orig_bays) == n:
        return [[copy.deepcopy(b)] for b in orig_bays]
    if len(orig_bays) % n == 0:
        k = len(orig_bays) // n
        return [copy.deepcopy(orig_bays[i * k:(i + 1) * k]) for i in range(n)]
    k = len(orig_bays) / n
    res = []
    for i in range(n):
        i0 = int(round(i * k))
        i1 = int(round((i + 1) * k))
        res.append(copy.deepcopy(orig_bays[i0:i1]))
    return res


def _split_run(spec: Dict[str, Any]) -> List[Dict[str, Any]]:
    W = spec["width"]
    if W <= MAX_MODULE_W or spec.get("no_split"):
        return [spec]
    n = math.ceil(W / MAX_MODULE_W)
    each = W / n
    if each < MIN_MODULE_W:
        return [spec]
    orig_bays = spec.get("bays")
    bays_part = _partition_bays(orig_bays, n) if orig_bays else None
    out = []
    x = 0.0
    for i in range(n):
        u = copy.deepcopy(spec)
        u["width"] = round(each, 1)
        u["unit_id"] = f"{spec.get('unit_id','U1')}.{i+1}"
        u["_stack_x"] = round(x, 1)
        if bays_part and bays_part[i]:
            u["bays"] = bays_part[i]
        else:
            u.pop("bays", None)
        out.append(u)
        x += each
    out[0]["_note"] = (f"Run of {W:.0f}mm split into {n} carcasses of "
                       f"{each:.0f}mm - each fits the sheet, the lift and two "
                       f"installers. Carcasses are bolted together on site.")
    return out


def _expand_kitchen(spec: Dict[str, Any]) -> List[Dict[str, Any]]:
    if spec.get("type") != "kitchen":
        return [spec]
    W = spec["width"]
    k = S.ERGO["kitchen"]
    base = dict(spec, type="kitchen_base", height=k["base_carcass_height"],
                depth=k["base_depth"], unit_id=spec.get("unit_id", "K") + "-B",
                base={"type": "plinth", "height": k["toe_kick_height"],
                      "setback": k["toe_kick_setback"]})
    wall = dict(spec, type="kitchen_wall", height=720, depth=k["wall_depth"],
                unit_id=spec.get("unit_id", "K") + "-W",
                base={"type": "none", "height": 0, "setback": 0},
                _mount_y=k["wall_underside_from_floor"][1])
    for u in (base, wall):
        u.pop("bays", None)
    return [base, wall]


def plan(spec: Dict[str, Any]) -> List[Dict[str, Any]]:
    stage = _expand_kitchen(spec)
    stage = [u for s in stage for u in _split_run(s)]
    stage = [u for s in stage for u in _split_tall(s)]
    return stage
