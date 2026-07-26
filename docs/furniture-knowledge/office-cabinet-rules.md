# Office cabinet knowledge (FSL / Furniture Generation API)

Deterministic knowledge for `furniture_type: "office_cabinet"` in the
**Furniture Generation API** (`src/lib/furniture-knowledge/officeCabinet.js`)
— read by `FurnitureBrain` (defaults) and the `FSL Validator`
(range/semantic checks). Modelled directly on `wardrobe.js` /
`wardrobe-rules.md` — same shape, same disclaimers. Maps onto `/builder`'s
`office` configurator type.

All numbers are **configurable application rules for FurniAI's concept
stage** — not a building code or a hardware spec. See
[docs/fsl-v1.md](../fsl-v1.md) for how these feed into `assumptions[]` /
`warnings[]` / `missing_information[]`.

## A default this file corrects

Before this file existed, `office_cabinet` fell through to
`genericCategory.js`, which inherits its default dimensions straight from
`/builder`'s `office` configurator type — and that type's existing
`knowledgeBase.js` default is **desk height, 750mm**, because it was
originally modelled as a desk, not storage. That default doesn't fit what
"office_cabinet" actually names. This file gives it a proper tall
filing/storage-cabinet default instead. `clampDimension()` in
`furnitureConfig.js` allows heights up to 3000mm, so this was always safely
renderable — the 750mm value was an unexamined fallback, not a real
constraint.

## Dimensions (mm)

| Axis | Hard bounds (error outside) | Standard range (warn outside) | Default |
|---|---|---|---|
| width_mm | 300–2400 | 600–1200 | 900 |
| height_mm | 300–2200 | 720–2000 | 1800 |
| depth_mm | 300–700 | 400–600 | 450 |

Note the standard range's lower bound (720mm) intentionally still covers
desk-height requests without a warning — this file corrects the *default*,
not the valid range. A genuinely low credenza-style request is still
"standard," just no longer what an unspecified request becomes.

## Default materials

| Part | Material | Thickness | Finish |
|---|---|---|---|
| body | particle_board | 18mm | grey_matte |
| facades | laminate | 18mm | grey_matte |
| back_panel | hdf | 6mm | grey |

Facades default to `laminate` rather than `mdf` — durable laminate is the
more realistic default finish for office storage furniture.

## Default style

`theme: contemporary`, `primary_color: grey`, `finish: matte`,
`door_style: flat_panel`, `handle_style: bar`.

## Component rules — filing drawer width

Total width ÷ drawer count should land in **300–600mm** per drawer.
Narrower than 300mm and a drawer stops being useful for its stated purpose
(a folder or ring binder won't fit); wider than 600mm and it exceeds a
sensible single slide-rail run. Outside that range:
`FILING_DRAWER_TOO_NARROW` / `FILING_DRAWER_TOO_WIDE` warnings (never
blocks) — the same pattern as wardrobe's door-width check, applied to
drawers instead since filing capacity is the more relevant concern for this
category.

`maxDrawersPerColumn`: 5.

## Component defaults (applied only when a component is mentioned without a count/property, and `allow_defaults: true`)

| Component | Default quantity | Default properties |
|---|---|---|
| shelf | 3 | `adjustable: true` |
| internal_led | 1 | — |
| hinged_door / sliding_door / drawer | 1 (if genuinely uncounted) | `soft_close: true` |

## Allowed components

`side_panel, top_panel, bottom_panel, back_panel, divider, shelf,
hinged_door, sliding_door, drawer, handle, plinth, internal_led, end_panel,
filler_panel`

Deliberately excludes `hanging_rail` and `mirror` — neither is a typical
office-storage component.

## What this does NOT cover

Cable management, lock/security hardware, and desk-height variants (the
type this file deliberately steers *away* from as the default) are all out
of scope for this rule set.
