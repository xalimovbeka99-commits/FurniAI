"""
FurniAI - Pipeline Runner
=========================
    python3 furniai.py demo.json  ./out

One call takes a design SPEC and produces the complete package:
  viewer.html      interactive 3D, dimensioned, explodable
  scene.json       the parametric model (feed your own renderer)
  cutlist.csv      shop floor
  shop_drawings.pdf blueprint: elevations, part details, CNC schedule, nesting,
                   BOM, quote, QC checklist, installation sequence
  dxf/             one layered DXF per part (BAZIS-compatible layers)
  nest/            one DXF per sheet for the beam saw
  report.json      machine-readable summary + every engineering issue found
"""
from __future__ import annotations
import json, os, sys
import planner, engine, nest, cost, exporters, blueprint
import standards as S


def run(spec: dict, outdir: str) -> dict:
    os.makedirs(outdir, exist_ok=True)
    unit_specs = planner.plan(spec)
    units = [engine.build(us) for us in unit_specs]
    parts = [p for u in units for p in u.parts]

    nest_result = nest.nest(parts)
    quote = cost.exact_quote(units, [nest_result], spec)
    quick = cost.quick_quote(spec)

    import buildid
    exporters.export_viewer_html(units, os.path.join(outdir, "viewer.html"),
                                 title=spec.get("name", spec.get("type", "Unit")),
                                 stamp=buildid.stamp(spec))
    exporters.export_scene_json(units, os.path.join(outdir, "scene.json"))
    exporters.export_cutlist_csv(units, os.path.join(outdir, "cutlist.csv"))
    dxf = exporters.export_dxf_parts(units, os.path.join(outdir, "dxf"))
    ndxf = exporters.export_dxf_nest(nest_result, os.path.join(outdir, "nest"))
    blueprint.build_pdf(os.path.join(outdir, "shop_drawings.pdf"),
                        units, nest_result, quote, spec)

    import inspector
    insp = inspector.inspect(spec)
    with open(os.path.join(outdir, "inspection.json"), "w", encoding="utf-8") as fh:
        json.dump(insp.to_dict(), fh, indent=1)
    with open(os.path.join(outdir, "inspection.txt"), "w", encoding="utf-8") as fh:
        fh.write(insp.text(verbose=True))

    issues = [i for u in units for i in u.issues]
    report = {
        "build_id": buildid.build_id(spec),
        "standards_version": buildid.STANDARDS_VERSION,
        "stamp": buildid.stamp(spec),
        "input": spec,
        "carcasses": [u.meta for u in units],
        "part_count": sum(p.qty for p in parts),
        "unique_parts": len(parts),
        "panel_area_m2": round(sum(p.area_m2 for p in parts), 3),
        "edgeband_m": round(sum(p.band_metres() for p in parts), 1),
        "sheets": nest_result["sheet_count"],
        "nest_yield_pct": nest_result["yield_pct"],
        "hardware": [{"item": h.label, "qty": round(h.qty, 2), "unit": h.unit}
                     for u in units for h in u.hardware],
        "quick_estimate_aed": quick["total_aed"],
        "firm_quote_aed": quote["total_aed"],
        "verdict": insp.verdict,
        "manufacturing_release": {
            "allowed": False,
            "status": "FACTORY_QUALIFICATION_REQUIRED",
            "reason": (
                "Software checks cannot validate a CNC post-processor, tooling, "
                "board behavior, or assembled fit. Pass the calibration coupon "
                "and signed first-article inspection before customer production."
            ),
        },
        "inspection": {"gates": insp.gate_summary(),
                       "failures": [c.__dict__ for c in insp.failures],
                       "warnings": [c.__dict__ for c in insp.warnings]},
        "issues": issues,
        "files": {"viewer": "viewer.html", "scene": "scene.json",
                  "cutlist": "cutlist.csv", "pdf": "shop_drawings.pdf",
                  "part_dxf": len(dxf), "nest_dxf": len(ndxf),
                  "inspection": "inspection.txt"},
    }
    with open(os.path.join(outdir, "report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=1)
    return report


DEMOS = {
    "wardrobe": {
        "name": "Master Bedroom Wardrobe", "client": "Demo Client",
        "room": "Master bedroom", "unit_id": "W1", "type": "wardrobe",
        "width": 3600, "height": 2800, "depth": 600,
        "material": "walnut", "handle": "gold_bar", "led": "warm", "zone": "dubai",
        "brief": "3.6m x 2.8m walnut wardrobe, hinged fronts, drawers and hanging",
    },
    "wardrobe_sliding": {
        "name": "Guest Wardrobe - Sliding Mirror", "unit_id": "W2",
        "type": "wardrobe_slide", "width": 2400, "height": 2400, "depth": 650,
        "material": "graphite", "handle": "hidden_push", "led": "cool",
        "front": {"kind": "sliding", "doors": 3, "style": "full_mirror"},
        "brief": "2.4m sliding wardrobe with full-mirror leaves",
    },
    "kitchen_base": {
        "name": "Kitchen Base Run", "unit_id": "K1", "type": "kitchen_base",
        "width": 3000, "height": 720, "depth": 560,
        "material": "sage", "handle": "black_strip", "zone": "dubai",
        "brief": "3.0m drawer-line base run, MR-MDF",
    },
    "vanity": {
        "name": "Guest Bath Vanity", "unit_id": "V1", "type": "vanity",
        "width": 1200, "height": 720, "depth": 480,
        "material": "concrete", "handle": "chrome", "led": "warm",
        "brief": "1.2m wall-hung vanity, two doors",
    },
}


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in DEMOS:
        spec = DEMOS[sys.argv[1]]
        out = sys.argv[2] if len(sys.argv) > 2 else f"./out_{sys.argv[1]}"
    elif len(sys.argv) > 1 and os.path.exists(sys.argv[1]):
        spec = json.load(open(sys.argv[1]))
        out = sys.argv[2] if len(sys.argv) > 2 else "./out"
    else:
        print(__doc__)
        print("demos:", ", ".join(DEMOS))
        sys.exit(0)
    r = run(spec, out)
    print(json.dumps({k: v for k, v in r.items() if k != "input"}, indent=1)[:2600])
