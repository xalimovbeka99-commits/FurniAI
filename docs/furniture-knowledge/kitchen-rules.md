# Kitchen knowledge (FSL / Furniture Generation API)

Deterministic knowledge for `furniture_type: "kitchen"` in the **Furniture
Generation API** (`src/lib/furniture-knowledge/kitchen.js`) — read by
`FurnitureBrain` (defaults) and the `FSL Validator` (range/semantic checks).
Modelled directly on `wardrobe.js` / `wardrobe-rules.md` — same shape, same
disclaimers.

All numbers are **configurable application rules for FurniAI's concept
stage** — not a building code or a hardware spec. See
[docs/fsl-v1.md](../fsl-v1.md) for how these feed into `assumptions[]` /
`warnings[]` / `missing_information[]`.

**Scope reminder:** `/builder` renders ONE cabinet carcass in kitchen
styling, not a fitted multi-cabinet run (see
[fsl-v1.md](../fsl-v1.md#known-limitations-v1)). The dimensions below
describe that single carcass — a full floor-to-overhead run treated as one
piece — not a real kitchen's total footprint.

## Dimensions (mm)

| Axis | Hard bounds (error outside) | Standard range (warn outside) | Default |
|---|---|---|---|
| width_mm | 600–8000 | 1500–4500 | 3000 |
| height_mm | 700–2500 | 1800–2300 | 2200 |
| depth_mm | 300–700 | 550–650 | 600 |

Depth additionally has a `worktopClearanceMin` of 500mm — below that, an
`UNUSUAL_KITCHEN_DEPTH` warning fires (still valid, just flagged), since a
shallower run won't comfortably carry a standard worktop overhang.

## Default materials

| Part | Material | Thickness | Finish (no colour known) |
|---|---|---|---|
| body | particle_board | 18mm | white_matte |
| facades | mdf | 18mm | white_matte |
| back_panel | hdf | 6mm | white |

Body defaults to `particle_board` rather than `mdf` (wardrobe's choice) —
moisture-resistant carcass board is the more realistic default for a
kitchen environment.

## Default style

`theme: modern`, `primary_color: white`, `finish: matte`,
`door_style: flat_panel`, `handle_style: bar`.

## Component rules

- Door width sanity: total width ÷ door count should land in **300–600mm**
  per door — narrower than wardrobe's 350–700mm range, since base-cabinet
  doors are typically smaller than wardrobe doors. Outside that range:
  `DOOR_WIDTH_TOO_NARROW` / `DOOR_WIDTH_TOO_WIDE` warnings (never blocks).
- `maxDrawersPerColumn`: 5.

## Component defaults (applied only when a component is mentioned without a count/property, and `allow_defaults: true`)

| Component | Default quantity | Default properties |
|---|---|---|
| shelf / open_shelf | 1 | `adjustable: true` |
| internal_led | 1 | `activation: "switch"` (under-cabinet lighting, not door-sensor) |
| hinged_door / drawer | 1 (if genuinely uncounted) | `soft_close: true` |

## Allowed components

`side_panel, top_panel, bottom_panel, back_panel, divider, shelf,
hinged_door, drawer, handle, internal_led, plinth, countertop, base_cabinet,
wall_cabinet, tall_cabinet, corner_cabinet, end_panel, filler_panel`

Several of these (`countertop`, `base_cabinet`, `wall_cabinet`,
`corner_cabinet`) are typical *kitchen* components but not yet renderable by
`/builder` — see `components.js`'s `CONFIGURATOR_COMPONENT_SUPPORT` for
which. They stay in this list because the question this list answers is
"is this typical for a kitchen concept," a separate question from "can the
configurator draw it today."

## What this does NOT cover

Multi-cabinet fitted layouts (L/U runs, islands), appliance cutouts, and
countertop material selection beyond the generic material vocabulary are
all out of scope for this rule set — see
[fsl-v1.md](../fsl-v1.md#known-limitations-v1).
