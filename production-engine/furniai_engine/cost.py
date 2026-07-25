"""
FurniAI - Costing (AED)
=======================
Two modes:
  quick_quote()  - the fast configurator estimate (bounding-box panel factor).
                   Used while the customer is still moving sliders.
  exact_quote()  - from the real cut list + real nested sheet count.
                   This is the number the factory is held to.
Both print their formula. Never quote a number produced any other way.
"""
from __future__ import annotations
from typing import Dict, Any, List
import math
import standards as S


def quick_quote(spec: Dict[str, Any]) -> Dict[str, Any]:
    t = spec.get("type", "cabinet")
    d = S.TYPE_DEFAULTS.get(t, S.TYPE_DEFAULTS["cabinet"])
    W = spec.get("width", d["whd"][0]) / 1000
    H = spec.get("height", d["whd"][1]) / 1000
    D = spec.get("depth", d["whd"][2]) / 1000
    # Measured by decomposing real geometry across a size sweep (verify.py §9),
    # not assumed. The original published factors were wrong in five of six
    # categories - wardrobes under-quoted 15%, shelving nearly double-quoted.
    factor = S.PANEL_FACTOR.get(t, 1.3)
    bounding = 2 * (W * H) + 2 * (W * D) + 2 * (H * D)
    area = bounding * factor
    mat = S.MATERIALS[spec.get("material", S.DEFAULT_MATERIAL)]
    material = area * mat["aed_m2"]
    import planner
    carcasses = planner.plan(spec)
    doors = max(2, math.ceil(W * 1000 / 600))
    sl = (spec.get("front") or {}).get("kind") == "sliding"
    if sl:
        doors = int((spec.get("front") or {}).get("doors", 2 if W < 2.0 else 3))
    style = (spec.get("front") or {}).get("style", "solid_panel")
    extra = 0.0
    if sl:
        extra = (doors * S.HARDWARE_COST["sliding_gear_per_door"]
                 + W * 95.0                       # top + bottom alu track, per m
                 + doors * S.HARDWARE_COST["door_surcharge"].get(style, 0))
    hardware = (extra + (0 if sl else doors * 2 * S.HARDWARE_COST["hinge_softclose"])
                + area * S.HARDWARE_COST["confirmat_set_m2"]
                + doors * S.HARDWARE_COST["handle"].get(spec.get("handle", "none"), 0)
                + S.HARDWARE_COST["led"].get(spec.get("led", "off"), 0))
    # A 3m run is not one carcass. The planner already knows how many boxes
    # it becomes, and labour is charged per box.
    labor = 0.0
    for cs in carcasses:
        dd = S.TYPE_DEFAULTS.get(cs.get("type", t), d)
        labor += dd["labor"] * dd["complexity"]
    material *= (1 + S.SHEET["waste_allowance"])
    sub = material + hardware + labor
    margin = sub * S.MARGIN
    delivery = S.DELIVERY.get(spec.get("zone", S.DEFAULT_ZONE), 50)
    return _pack("QUICK ESTIMATE", area, material, hardware, labor, sub, margin,
                 delivery, mat["label"],
                 note=f"Bounding-box estimate over {len(carcasses)} carcass(es). "
                      f"Firm price follows the cut list.")


def exact_quote(units, nests, spec: Dict[str, Any]) -> Dict[str, Any]:
    """units: list[Unit]; nests: dict material-key -> nest result."""
    material_cost = 0.0
    part_area = 0.0
    sheets_by_mat: Dict[str, int] = {}
    area_bought = 0.0
    yields = []
    for res in nests:
        yields.append(res["yield_pct"])
        for sh in res["sheets"]:
            sheets_by_mat[sh.material] = sheets_by_mat.get(sh.material, 0) + 1
            area_bought += sh.w * sh.h / 1e6
    y = (sum(yields) / len(yields) / 100.0) if yields else 0.85
    waste = min(0.18, max(S.SHEET["waste_allowance"], 1.0 / max(y, 0.4) - 1.0))
    for u in units:
        for p in u.parts:
            if p.group == "accessory":
                continue
            m = S.MATERIALS.get(p.material)
            rate = m["aed_m2"] if m else 60.0
            part_area += p.area_m2
            material_cost += p.area_m2 * rate
    material_cost *= (1 + waste)

    hw_cost = 0.0
    hw_lines = []
    for u in units:
        for h in u.hardware:
            rate = _hw_rate(h)
            amt = rate * h.qty
            hw_cost += amt
            hw_lines.append({"item": h.label, "qty": round(h.qty, 2),
                             "unit": h.unit, "rate": rate, "total": round(amt, 2)})

    labor = 0.0
    for u in units:
        d = S.TYPE_DEFAULTS.get(u.spec.get("type", "cabinet"),
                                S.TYPE_DEFAULTS["cabinet"])
        labor += d["labor"] * d["complexity"]

    sub = material_cost + hw_cost + labor
    margin = sub * S.MARGIN
    delivery = S.DELIVERY.get(spec.get("zone", S.DEFAULT_ZONE), 50)
    out = _pack("FIRM QUOTE", part_area, material_cost, hw_cost, labor, sub,
                margin, delivery,
                ", ".join(f"{S.MATERIALS.get(k,{}).get('label',k)} x{v}"
                          for k, v in sheets_by_mat.items()),
                note="Priced on nested sheets actually consumed, not on part area.")
    out["hardware_lines"] = _merge(hw_lines)
    out["waste_pct"] = round(waste * 100, 1)
    out["sheets_total"] = sum(sheets_by_mat.values())
    out["area_bought_m2"] = round(area_bought, 2)
    out["nest_yield_pct"] = round(y * 100, 1)
    out["sheets_by_material"] = sheets_by_mat
    return out


def _merge(lines):
    agg = {}
    for l in lines:
        k = (l["item"], l["unit"], l["rate"])
        if k in agg:
            agg[k]["qty"] += l["qty"]; agg[k]["total"] += l["total"]
        else:
            agg[k] = dict(l)
    for v in agg.values():
        v["qty"] = round(v["qty"], 2); v["total"] = round(v["total"], 2)
    return sorted(agg.values(), key=lambda x: -x["total"])


def _hw_rate(h):
    c = S.HARDWARE_COST
    if h.key == "handle":
        return c["handle"].get(h.note, 0)
    if h.key == "door_surcharge":
        return c["door_surcharge"].get(h.note, 0)
    if h.key == "led":
        return c["led"].get(h.note, 0)
    v = c.get(h.key)
    if isinstance(v, (int, float)):
        return float(v)
    return {"rod_support": 6.0, "rod_centre_support": 9.0,
            "push_latch": 11.0, "sliding_track": 95.0}.get(h.key, 0.0)


def _pack(title, area, material, hardware, labor, sub, margin, delivery,
          mat_label, note=""):
    total = sub + margin + delivery
    return {
        "title": title,
        "material_label": mat_label,
        "area_m2": round(area, 2),
        "lines": [
            ("Material", round(material, 2)),
            ("Hardware & fittings", round(hardware, 2)),
            ("Labour & production", round(labor, 2)),
            ("Subtotal", round(sub, 2)),
            (f"Margin ({S.MARGIN*100:.0f}%)", round(margin, 2)),
            ("Delivery", round(delivery, 2)),
        ],
        "total_aed": round(total, 2),
        "formula": ("TOTAL = (material + hardware + labour) x "
                    f"{1 + S.MARGIN:.2f} + delivery"),
        "note": note,
    }
