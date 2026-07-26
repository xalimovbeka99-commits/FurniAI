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
    corner_role = spec.get("_corner_role")
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
        # a run's corner treatment belongs to whichever split-off module is
        # actually nearest the corner, not to every module of the run
        if corner_role == "blind_end" and i != n - 1:
            u.pop("_corner_role", None)
        elif corner_role == "blind_start" and i != 0:
            u.pop("_corner_role", None)
        out.append(u)
        x += each
    out[0]["_note"] = (f"Run of {W:.0f}mm split into {n} carcasses of "
                       f"{each:.0f}mm - each fits the sheet, the lift and two "
                       f"installers. Carcasses are bolted together on site.")
    return out


def _kitchen_base_wall(spec: Dict[str, Any], width: float,
                        unit_id_prefix: str) -> List[Dict[str, Any]]:
    """One straight kitchen run (base + wall carcasses) at the given width.
    Shared by the single-run path and each run of a multi-run (L-shape)
    kitchen - a run is a run regardless of how many walls the job has."""
    k = S.ERGO["kitchen"]
    base = dict(spec, type="kitchen_base", width=width,
                height=k["base_carcass_height"], depth=k["base_depth"],
                unit_id=unit_id_prefix + "-B",
                base={"type": "plinth", "height": k["toe_kick_height"],
                      "setback": k["toe_kick_setback"]})
    wall = dict(spec, type="kitchen_wall", width=width, height=720,
                depth=k["wall_depth"], unit_id=unit_id_prefix + "-W",
                base={"type": "none", "height": 0, "setback": 0},
                # Wall units mount above the worktop, not on the floor - without
                # this the wall and base carcasses of the same run occupy the
                # same 0-720mm Y band and the whole-job overlap check
                # (inspector Gate 2) correctly rejects them as colliding.
                _stack_y=k["wall_underside_from_floor"][1])
    for u in (base, wall):
        u.pop("bays", None)
        u.pop("runs", None)
    return [base, wall]


def _expand_kitchen_runs(spec: Dict[str, Any]) -> List[Dict[str, Any]]:
    """L-shape only: two straight runs meeting at a right-angle corner.

    Run 'a' sits at world anchor (0,0), unrotated: its own width along world
    X, its own depth along world Z. Run 'b' is rotated 90 degrees and
    anchored at world X = run a's length, world Z = 0 - i.e. it starts
    exactly where run 'a's footprint ends along X, so the two carcasses
    share only the corner boundary plane and never occupy the same volume -
    the same "two walls meeting at a corner" arrangement as a real
    L-shaped kitchen. `_corner_x`/`_corner_z`/`_stack_rot_deg` are the run's
    *anchor* (set once here, per run); they are distinct from `_stack_x`,
    which `_split_run` still uses for its own purpose - the offset of a
    sub-module *within* one run's own local width axis, before rotation.

    U-shape (3 runs) is a fork, not a chain - both side runs would attach to
    opposite ends of the same back run - and needs its own placement math
    plus a visual check this engine cannot perform. It is deliberately not
    supported here; callers must reject a 3-run request before this point.
    """
    runs = spec["runs"]
    if len(runs) != 2:
        raise ValueError(
            "Multi-run kitchens currently support exactly 2 runs (L-shape). "
            f"Got {len(runs)} runs. U-shape (3 runs) is not yet implemented."
        )
    expected_corners = ("end", "start")
    for index, (run, expected_corner) in enumerate(zip(runs, expected_corners)):
        length = run.get("length")
        if not isinstance(length, (int, float)) or not 300 <= length <= 8000:
            raise ValueError(
                f"Kitchen run {index + 1} length must be 300-8000mm; "
                f"got {length!r}."
            )
        if run.get("corner") != expected_corner:
            raise ValueError(
                f"Kitchen run {index + 1} corner must be "
                f"{expected_corner!r}; got {run.get('corner')!r}."
            )
    unit_prefix = spec.get("unit_id", "K")
    out: List[Dict[str, Any]] = []
    corner_x = 0.0
    for i, run in enumerate(runs):
        length = run["length"]
        run_id = "a" if i == 0 else "b"
        rot = 0 if i == 0 else 90
        units = _kitchen_base_wall(spec, length, f"{unit_prefix}-{run_id.upper()}")
        for u in units:
            u["_run_id"] = run_id
            u["_corner_x"] = corner_x
            u["_corner_z"] = 0.0
            u["_stack_rot_deg"] = rot
            corner = run.get("corner")
            if corner == "end":
                u["_corner_role"] = "blind_end"
            elif corner == "start":
                u["_corner_role"] = "blind_start"
        out.extend(units)
        corner_x = length         # run 'b' starts where run 'a's length ends
    return out


def _expand_kitchen(spec: Dict[str, Any]) -> List[Dict[str, Any]]:
    if spec.get("type") != "kitchen":
        return [spec]
    if spec.get("runs"):
        return _expand_kitchen_runs(spec)
    return _kitchen_base_wall(spec, spec["width"], spec.get("unit_id", "K"))


def expected_envelope(spec: Dict[str, Any]) -> List[float]:
    """Finished assembly envelope implied by a customer-level specification.

    A kitchen request is a composite assembly: its base carcasses use the
    approved kitchen depth and its wall carcasses mount above the worktop.
    Therefore the finished envelope is not the raw room/request H and D that
    may have been supplied by the customer.
    """
    if spec.get("type") != "kitchen":
        return [spec.get("width"), spec.get("height"), spec.get("depth")]

    k = S.ERGO["kitchen"]
    height = k["wall_underside_from_floor"][1] + 720
    depth = k["base_depth"]
    runs = spec.get("runs")
    if not runs:
        return [spec.get("width"), height, depth]

    # Run B is rotated 90 degrees and begins on run A's end plane. Its
    # carcass depth consequently extends the world-X envelope by base depth.
    return [runs[0]["length"] + depth, height,
            max(depth, runs[1]["length"])]


def plan(spec: Dict[str, Any]) -> List[Dict[str, Any]]:
    stage = _expand_kitchen(spec)
    stage = [u for s in stage for u in _split_run(s)]
    stage = [u for s in stage for u in _split_tall(s)]
    return stage
