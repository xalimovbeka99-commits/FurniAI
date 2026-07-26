# FSL v1 — Furniture Specification Language

FSL is the provider-independent contract between "a user's furniture idea" and
"a rendered/configurable piece of furniture" in FurniAI. It is produced by
`FurnitureBrain`, gated by the `FSL Validator`, and consumed by the
`Configurator Adapter` — see [furniture-generation-api.md](furniture-generation-api.md)
for the full request/response contract and [adr/ADR-001-fsl-provider-independent-contract.md](adr/ADR-001-fsl-provider-independent-contract.md)
for why it exists as its own layer instead of being folded into an existing
config shape.

Millimetres everywhere. JSON-serializable. Versioned (`fsl_version: "1.0"`).

## Where the code lives

| Concern | File |
|---|---|
| Enums / controlled vocabulary | `src/lib/fsl/enums.js` |
| Document shape / factories | `src/lib/fsl/schema.js` |
| Error codes | `src/lib/fsl/errors.js` |
| Deterministic validation | `src/lib/fsl/validator.js` |
| Example documents | `src/lib/fsl/fixtures.js` |
| Category knowledge (wardrobe = dedicated, rest = generic) | `src/lib/furniture-knowledge/` |
| NL → FSL orchestration | `src/lib/furniture-brain/brain.js` |
| AI extraction contract + providers | `src/lib/ai-provider/` |
| FSL → `/builder` config mapping | `src/lib/configurator-adapter/adapter.js` |
| HTTP endpoint | `src/app/api/v1/furniture/generate/route.js` |

## Root structure

```
fsl_version, project, dimensions, style, materials, layout,
components[], appliances[], features[], views[],
assumptions[], warnings[], missing_information[], metadata, status
```

`project.furniture_type`, `dimensions.*`, `components[].type`, `materials.*.material`,
and `style.theme` are all drawn from controlled vocabularies in `fsl/enums.js` —
nothing outside those lists can survive `validateFsl()`.

## Status

| Status | Meaning |
|---|---|
| `draft` | Valid concept, fully compatible with the configurator, but `target` was `"concept"` — not yet confirmed for build. |
| `needs_clarification` | A *required* fact (furniture type, or a dimension once a type is known) is missing and defaults were disallowed. |
| `ready` | Valid, `target: "configurator"`, and fully renderable by `/builder` today. |
| `invalid` | Failed schema/semantic validation (never happens via the live NL path — `FurnitureBrain` pre-checks explicit values before a document is even assembled — but reachable via `validateFsl()` directly, e.g. a hand-built or future direct-FSL-input document). |
| `partially_supported` | Valid, but contains at least one field `/builder` cannot render today (see Compatibility below). Takes priority over `ready`/`draft` regardless of `target`, because it's a fact about the document, not about what was asked. |

## Furniture types: FSL vocabulary vs. configurator support

FSL can *describe* ten types (`fsl/enums.js FURNITURE_TYPES`). `/builder`
(`furnitureConfig.js` + `buildGeometry.js`) can only *render* five of them
today, each as a single rectangular carcass:

| FSL type | Configurator-supported? | Maps onto `/builder` type |
|---|---|---|
| `wardrobe` | Yes | `wardrobe` |
| `kitchen` | Yes (one cabinet, not a fitted layout) | `kitchen` |
| `bookcase` | Yes | `shelves` |
| `office_cabinet` | Yes — dedicated knowledge corrects the inherited desk-height (750mm) default | `office` |
| `sideboard` | Yes — dedicated knowledge corrects the inherited tall-cabinet (1800mm) default | `cabinet` |
| `walk_in_closet` | No | — |
| `tv_unit` | No | — |
| `shoe_cabinet` | No | — |
| `bathroom_vanity` | No | — |
| `custom_cabinet` | No | — |

**wardrobe**, **kitchen**, **bookcase**, **office_cabinet**, and **sideboard**
have dedicated knowledge (dimension ranges, category-specific semantic
checks, component defaults) — see `docs/furniture-knowledge/*.md` for each.
The remaining five (`walk_in_closet`, `tv_unit`, `shoe_cabinet`,
`bathroom_vanity`, `custom_cabinet`) use a generic fallback
(`furniture-knowledge/genericCategory.js`): wide structural bounds, a rough
concept default, no component-specific rules.

## Components

Full vocabulary and per-component configurator support live in
`furniture-knowledge/components.js`. Summary:

- **Mapped** (translate into a real `/builder` field): `shelf`, `open_shelf`, `hinged_door`, `drawer`, `handle`, `internal_led`, `plinth`, `mirror` (only as a door finish).
- **Implicit** (always present on any carcass, not independently specifiable): `side_panel`, `top_panel`, `bottom_panel`, `back_panel`, `divider`.
- **Unsupported today** (FSL can describe them; `/builder` cannot render them at any fidelity): `sliding_door` (stored but rendered as hinged), `drawer_box`, `hanging_rail`, `leg`, `countertop`, `base_cabinet`, `wall_cabinet`, `tall_cabinet`, `corner_cabinet`, `end_panel`, `filler_panel`.

This is why the primary "modern white wardrobe" example — which includes
`hanging_rail` — legitimately comes back `partially_supported` for
`target: "configurator"`: that's the compatibility system working as
intended, not a bug.

## Dimension validation

Three tiers per axis (Section 13), read from the category's `dimensionRules`:

1. **Structurally invalid** (outside `[min, max]`, non-numeric, ≤ 0) → hard
   error `INVALID_DIMENSION`. For an *explicit* user value, `FurnitureBrain`
   throws this the moment it's detected — no document is even built around
   a broken number.
2. **Unusual but valid** (outside `[standardMin, standardMax]`, e.g. a
   500mm-deep wardrobe) → warning, never blocks.
3. **Standard** → no warning.

Wardrobe ranges (`furniture-knowledge/wardrobe.js`) are configurable
application rules, not a building code:

| Axis | Hard bounds | Standard range | Default |
|---|---|---|---|
| width_mm | 300–6000 | 600–3600 | 2400 |
| height_mm | 600–3200 | 1800–2800 | 2400 |
| depth_mm | 250–900 | 500–700 | 600 |

Depth below 550mm also raises a `UNUSUAL_WARDROBE_DEPTH` warning (hanging
clearance), and a door count that implies per-door widths outside 350–700mm
raises `DOOR_WIDTH_TOO_NARROW` / `DOOR_WIDTH_TOO_WIDE`.

## Assumptions, warnings, missing information

- **`assumptions[]`**: every value `FurnitureBrain` filled in because the
  user didn't (dimensions, style, materials, component quantities/properties)
  when `allow_defaults: true`. Each has `field`, `value`, `reason`,
  `confidence`, `requires_confirmation`. Explicit user-given values never
  appear here.
- **`warnings[]`**: semantic concerns from the validator (unusual dimensions,
  atypical components) plus configurator-adapter notes (e.g. a colour with
  no confident swatch match). Never blocks a response.
- **`missing_information[]`**: only for `furniture_type` (always) and
  dimensions (once a type is known) when `allow_defaults: false` and the
  user didn't provide them. Style and materials are treated as optional —
  they default silently disclosed via `assumptions[]` even when
  `allow_defaults` is false they're simply left `null`, never blocking.

Note: the master prompt's own Section 3 worked example shows
`"assumptions": []` alongside several clearly-defaulted fields (finish,
door_style, handle_style, material thicknesses, soft-close). This
implementation follows the *stated rule* in Section 17 ("every default must
be visible") rather than that illustrative example, since the two conflict.
Component quantities implied by words like "internal shelves" (no count
given) are similarly defaulted with a recorded assumption, using this
project's own simple, documented placeholder numbers (`wardrobe.js`) — not a
reverse-engineered version of the example's unstated sizing formula.

## Examples

See `src/lib/fsl/fixtures.js` for `completeWardrobeFsl()` (matches the
Section 3 primary user story, dimensions/components explicit) and
`needsClarificationWardrobeFsl()` (matches Section 7).

## Known limitations (v1)

- Wardrobe, kitchen, bookcase, and office_cabinet have dedicated knowledge;
  the remaining six types use wide generic bounds and no component rules.
- `/builder` renders one carcass per request — no multi-cabinet runs, so a
  "kitchen" FSL document means one cabinet in kitchen styling, not a fitted
  kitchen layout.
- Hanging rails, drawer boxes, legs, countertops, and corner geometry have
  no configurator representation at all yet.
- The FSL→module translation (one module per door, shelves distributed
  across door modules, drawers pooled into one bank) is a deliberate
  approximation — see the comment at the top of `configurator-adapter/adapter.js`.
- Material matching from `style.primary_color`/`finish` to a configurator
  swatch is keyword-based best-effort, not exact.
