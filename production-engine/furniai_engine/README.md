# FurniAI Parametric Engine

Deterministic half of FurniAI: a FurniSpec JSON goes in, a complete, inspected,
manufacturable package comes out.

```bash
pip install ezdxf reportlab

python3 furniai.py wardrobe ./out     # demos: wardrobe wardrobe_sliding kitchen_base vanity
python3 furniai.py my_spec.json ./out
python3 inspector.py wardrobe         # nine gates, verdict
python3 verify.py                     # 40 standards checks + quote calibration
python3 audit_dxf.py ./out            # read DXF back, cross-check against the ops
python3 pack_check.py ./out           # every artefact describes the same build
python3 factory_test.py ./factory     # first-article pack + calibration coupon
```

## Modules

| File | Role |
|---|---|
| `standards.py` | **Single source of truth.** Every dimension, tolerance, hardware spec, ergonomic limit and rate. Nothing else may hard-code a number. |
| `planner.py` | Spec to buildable carcasses: tall split, run split, kitchen expansion |
| `engine.py` | Carcass to parts, machining ops, 3D placement, issue list |
| `nest.py` | Guillotine FFDH nesting, kerf- and grain-aware |
| `cost.py` | Quick estimate and firm quote, AED |
| `exporters.py` | Cut list, per-part DXF, nesting DXF, scene JSON, Three.js viewer |
| `blueprint.py` | The A3 shop-drawing set |
| `inspection.py` | First-article inspection sheet (PDF) |
| `buildid.py` | Build stamp carried by every artefact |
| **`inspector.py`** | **Nine gates. Judges a finished build and rejects it if anything is wrong.** |
| `verify.py` | Standards self-test and quote calibration |
| `audit_dxf.py` | DXF export audit |
| `pack_check.py` | Artefact consistency |
| `factory_test.py` | First-article test unit and calibration coupon |
| `furniai.py` | Pipeline runner |

## Output of a run

`viewer.html` `scene.json` `cutlist.csv` `shop_drawings.pdf` `inspection.txt`
`inspection.json` `report.json` `dxf/` `nest/`

## What the Inspector enforces

Solids equal pieces. No two solids intersect. No operation breaks through its
panel. No two holes intersect. System 32 on the 32 mm grid at 37 mm setback.
Hinges priced equal cups drilled. Runner pairs equal drawer boxes. Shelf spans
inside the deflection limit. Every piece nested exactly once. Everything fits a
2400 mm lift and a 2800x2070 sheet. Quick estimate within 25% of the firm quote.

Reasoning behind every number: `../FURNIAI_ENGINEERING_KNOWLEDGE_BASE.md`.
How to work on this: `../FURNIAI_MASTER_PROMPT.md`.
