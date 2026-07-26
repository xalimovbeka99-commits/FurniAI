# Sideboard knowledge (FSL / Furniture Generation API)

Deterministic knowledge for `furniture_type: "sideboard"` in the
**Furniture Generation API** (`src/lib/furniture-knowledge/sideboard.js`)
— read by `FurnitureBrain` (defaults) and the `FSL Validator`
(range/semantic checks). Modelled directly on `officeCabinet.js` — same
shape, same disclaimers, deliberately independent (no shared base with the
other category files). Maps onto `/builder`'s `cabinet` configurator type.

All numbers are **configurable application rules for FurniAI's concept
stage** — not a building code or a hardware spec. See
[docs/fsl-v1.md](../fsl-v1.md) for how these feed into `assumptions[]` /
`warnings[]` / `missing_information[]`.

## A default this file corrects

Before this file existed, `sideboard` fell through to `genericCategory.js`,
which inherits its default dimensions straight from `/builder`'s `cabinet`
configurator type — and that type's existing `knowledgeBase.js` default is
**1800mm tall**, a tall storage-cabinet height. That default doesn't fit
what "sideboard" actually names: a low, wide piece with a flat top meant
for display/serving, typically 750–900mm tall. This file gives it a proper
sideboard-height default instead. `clampDimension()` in `furnitureConfig.js`
allows heights down to 300mm, so this was always safely renderable — the
1800mm value was an unexamined fallback, not a real constraint.

This is the same class of bug `officeCabinet.js` fixed for the inherited
750mm desk-height default — see that file's rules doc for the precedent.

## Dimensions (mm)

| Axis | Hard bounds (error outside) | Standard range (warn outside) | Default |
|---|---|---|---|
| width_mm | 600–3000 | 1200–2000 | 1600 |
| height_mm | 400–1300 | 750–900 | 800 |
| depth_mm | 300–600 | 400–500 | 450 |

## Default materials

| Part | Material | Thickness | Finish |
|---|---|---|---|
| body | particle_board | 18mm | walnut |
| facades | laminate | 18mm | walnut |
| back_panel | hdf | 6mm | grey |

`laminate` is an existing `MATERIAL_TYPES` enum value (`fsl/enums.js`) — used
directly as the closest supported facade material to a laminate/MDF-style
front. No new material category was added.

## Default style

`theme: contemporary`, `primary_color: walnut`, `finish: satin`,
`door_style: flat_panel`, `handle_style: bar`.

## Component rules — drawer width

Total width ÷ drawer count should land in **300–700mm** per drawer — wider
than a filing drawer's usable range (this isn't storage furniture), but
still narrow enough below 300mm that a drawer stops being useful, and wide
enough above 700mm that it exceeds a sensible single slide-rail run.
Outside that range: `SIDEBOARD_DRAWER_TOO_NARROW` /
`SIDEBOARD_DRAWER_TOO_WIDE` warnings (never blocks).

`maxDrawersPerColumn`: 4.

## Component defaults (applied only when a component is mentioned without a count/property, and `allow_defaults: true`)

| Component | Default quantity | Default properties |
|---|---|---|
| shelf | 2 | `adjustable: true` |
| internal_led | 1 | — |
| hinged_door / sliding_door / drawer | 1 (if genuinely uncounted) | `soft_close: true` |

## Allowed components

`side_panel, top_panel, bottom_panel, back_panel, divider, shelf,
hinged_door, sliding_door, drawer, handle, plinth, leg, internal_led,
end_panel, filler_panel`

Deliberately excludes `hanging_rail` (never applicable) and `mirror` (not a
typical sideboard front for v1 — mirrored sideboards exist but are a
stylistic niche, the same conservative call `officeCabinet.js` made for its
own excluded components).

### `leg` is allowed, but never a silent default

`leg` is in the allowed-components list because sideboards are commonly
raised on legs rather than a plinth — a real, typical detail for this
category. It deliberately has **no entry** in the default
quantity/properties/material-ref maps: it only gets a quantity or
properties assigned when the user's request already includes it, never as
a spontaneous addition to an unrequested design. `leg` is also marked
`unsupported` in `furniture-knowledge/components.js` (no leg geometry exists
in the current configurator) — so any sideboard design that does include it
is correctly reported as `compatibility.compatible: false` /
`partially_supported`, not silently accepted as fully renderable. See
`sideboard.test.js`'s `validateFsl` integration test for the regression
guard.

## What this does NOT cover

`furnitureConfig.js`'s `defaultModules("cabinet")` (two plain hinged doors,
no drawers) is a separate `/builder`-side layout default that doesn't fully
match a typical sideboard's drawers-over-doors layout either — deliberately
**not** changed here. That's geometry/configurator-layer work, out of scope
for this knowledge file (see the audit that preceded this file for why it
wasn't touched). Cable management and lighting-integration hardware
specifics are also out of scope for this rule set.
