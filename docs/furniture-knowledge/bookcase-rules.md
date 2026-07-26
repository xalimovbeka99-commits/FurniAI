# Bookcase knowledge (FSL / Furniture Generation API)

Deterministic knowledge for `furniture_type: "bookcase"` in the **Furniture
Generation API** (`src/lib/furniture-knowledge/bookcase.js`) — read by
`FurnitureBrain` (defaults) and the `FSL Validator` (range/semantic checks).
Modelled directly on `wardrobe.js` / `wardrobe-rules.md` — same shape, same
disclaimers. Maps onto `/builder`'s `shelves` configurator type.

All numbers are **configurable application rules for FurniAI's concept
stage** — not a building code or a joinery spec. See
[docs/fsl-v1.md](../fsl-v1.md) for how these feed into `assumptions[]` /
`warnings[]` / `missing_information[]`.

## Dimensions (mm)

| Axis | Hard bounds (error outside) | Standard range (warn outside) | Default |
|---|---|---|---|
| width_mm | 300–4000 | 600–2400 | 1200 |
| height_mm | 300–3000 | 900–2400 | 2000 |
| depth_mm | 200–600 | 250–400 | 350 |

## Default materials

| Part | Material | Thickness | Finish |
|---|---|---|---|
| body | mdf | 18mm | oak_matte |
| facades | mdf | 18mm | oak_matte |
| back_panel | hdf | 6mm | oak |

Default finish is `oak` rather than wardrobe's `white` — open shelving is
conventionally shown in a wood tone in most reference catalogs.

## Default style

`theme: scandinavian`, `primary_color: oak`, `finish: matte`,
`door_style: flat_panel`, `handle_style: minimal`.

## Component rules — shelf span

A shelf spanning more than **900mm** with no supporting divider is prone to
sagging under book weight — a real, if approximate, joinery concern distinct
from wardrobe's door-width check. The span is computed as
`width_mm ÷ (divider_count + 1)`: more dividers means more, narrower
columns, each with a shorter unsupported span.

Exceeding 900mm fires `UNUSUAL_SHELF_SPAN` (never blocks) with a concrete
suggestion ("consider an extra divider").

## Component defaults (applied only when a component is mentioned without a count/property, and `allow_defaults: true`)

| Component | Default quantity | Default properties |
|---|---|---|
| shelf / open_shelf | 4 | `adjustable: true` |
| internal_led | 1 | `activation: "switch"` |
| hinged_door / drawer | 1 (if genuinely uncounted) | `soft_close: true` |

Shelf/open_shelf defaults to 4 (vs. wardrobe's 2) — a bookcase's whole
purpose is shelving, so a higher baseline count is the more useful default.

## Allowed components

`side_panel, top_panel, bottom_panel, back_panel, divider, shelf,
open_shelf, hinged_door, drawer, handle, internal_led, plinth, end_panel,
filler_panel`

Deliberately excludes `hanging_rail` and `mirror` — neither is a typical
bookcase component, unlike wardrobe. Either can still appear on a bookcase
FSL document (nothing in `fsl/enums.js COMPONENT_TYPES` is blocked), it just
produces an `ATYPICAL_COMPONENT_FOR_CATEGORY` warning instead of being
treated as ordinary.

## What this does NOT cover

Corner/built-in bookcase runs, adjustable-shelf hardware selection, and
glass-door variants beyond the generic `hinged_door` mapping are all out of
scope for this rule set.
