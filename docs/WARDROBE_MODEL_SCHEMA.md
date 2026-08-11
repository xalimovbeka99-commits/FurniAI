# WardrobeModel schema (Phase 1)

Canonical source: [`src/lib/wardrobe-model/schema.js`](../src/lib/wardrobe-model/schema.js)
(JSDoc typedefs + constants). This document is the narrative version.

## Shape

```jsonc
{
  "id": "wardrobe-01",
  "revision": 3,
  "widthMm": 2400,
  "heightMm": 2600,
  "depthMm": 600,
  "panelThicknessMm": 18,
  "idCounters": { "wardrobe": 1, "section": 1, "SHELF": 2, "HANGING_RAIL": 1 },
  "sections": [
    {
      "id": "section-01",
      "widthMm": 600,
      "components": [
        { "id": "shelf-01", "type": "SHELF", "positionMm": 900, "heightMm": 18 },
        { "id": "hanging-rail-01", "type": "HANGING_RAIL", "positionMm": 100, "heightMm": 40 }
      ]
    }
  ]
}
```

All dimensions are **integer** millimetres — fractional input (e.g. `700.5`)
is rejected with `INVALID_DIMENSION`, never rounded (see
[TOOL_CONTRACTS.md](TOOL_CONTRACTS.md)) — matching the production engine's
own mm convention (`production-engine/furniai_engine/standards.py`); this
repo does not add a second unit convention.

## Stable IDs

`id` fields are type-prefixed, human-legible, kernel-allocated:
`wardrobe-01`, `section-01`, `shelf-01`, `drawer-bank-01`, `hanging-rail-01`,
`door-01`. Each entity type has its **own** counter (`model.idCounters`),
assigned once at creation and **never reassigned** — reordering, removing,
or editing anything never changes another entity's ID. This is the direct
fix for the anti-pattern found in Milestone 1's baseline (`buildGeometry.js`'s
`id: \`P${id++}\`` recomputes every part's ID from zero on every rebuild).

**ID ownership is kernel-allocated, not caller-supplied.** Codex's own
`tests/wardrobe-ai/fixtures/tool-contracts.json` models a different scheme —
the caller (the LLM) supplies the semantic ID string as a tool argument
(`section_add({ wardrobeId, sectionId, widthMm })`, "uses caller-supplied
stable semantic ID"). This repo deliberately keeps kernel-owned allocation
instead: uniqueness and the naming scheme are guaranteed by construction,
not by validating whatever string an LLM proposes, and it avoids a new
failure mode where the LLM invents an ID, forgets it, or reuses one from an
unrelated turn. The trade-off: IDs read `shelf-01` rather than a
caller-chosen `shelf-left-01`, so "the left shelf" still has to be resolved
by array position or by asking, not by the ID string alone. This was a
deliberate decision, not an oversight — see
[KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).

Structural parts that aren't a WardrobeModel component in their own right
(the two side panels, top, bottom, back, and the dividers between sections)
get deterministic, derived IDs instead of a counter allocation — see
`buildWardrobeGeometry.js`: `carcass-side-left`, `carcass-top`,
`divider-<leftSectionId>-<rightSectionId>`, etc. They don't need a counter
because they're fully determined by structure, not user action.

## Section widths are clear-opening widths, not a raw fraction of the outer width

The two outer side panels and every inter-section divider are real material
— `panelThicknessMm` thick, same as `buildGeometry.js`'s existing carcass
math. A section's `widthMm` is the width of that section's own clear
opening, so:

```text
sum(section.widthMm) = wardrobe.widthMm
                        - 2 * panelThicknessMm            (the two sides)
                        - (sectionCount - 1) * panelThicknessMm   (the dividers)
```

This mirrors `buildGeometry.js`'s own `clearBayWidth = interiorW -
dividerCount * T` exactly (see `src/lib/wardrobe-model/kernel.js`'s
`availableSectionWidth()`) — it isn't a new convention invented for this
schema, it's the existing one, just made explicit and enforced by the
validator (`SECTION_WIDTH_MISMATCH`).

## Components

| type | `positionMm` means | `heightMm` means | type-specific fields |
|---|---|---|---|
| `SHELF` | height from the section's interior floor | a nominal thin zone (18mm) | — |
| `HANGING_RAIL` | height from the interior floor | the rail bar's clearance zone (40mm) | — |
| `DRAWER_BANK` | height from the interior floor | `rows * 180mm` | `rows` (1–8) |
| `DOOR` | unused (0) — a door spans the whole section | the section's full interior height (informational) | `leaves` (1–4), `hingeSide` |

`SHELF`, `HANGING_RAIL`, and `DRAWER_BANK` are **zone components**: they
occupy a vertical band inside their section and must not overlap each other
(`validator.js`'s `COMPONENT_OVERLAP` check). `DOOR` is not a zone
component — it's a front panel over the whole section, so it never competes
for vertical space with what's behind it.

`DIVIDER` is a real enum value (`schema.js`'s `COMPONENT_TYPES`) but is
**not** addable through `component_add` — see
[TOOL_CONTRACTS.md](TOOL_CONTRACTS.md) and
[KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) for why.

## Revisioning

`kernel.js`'s pure functions never touch `revision` — that's deliberately
the tool layer's job (`src/lib/wardrobe-tools/tools.js`'s `commit()`), which
only bumps it after the *resulting* model has also passed
`validateWardrobeModel()`. This keeps "compute the new geometry" and "commit
the edit" as separate, individually testable steps, matching the required
sequence: validate request → execute tool → validate resulting wardrobe →
commit model revision.

## Migration/adapter decisions (Milestone 9)

Recorded here because they were made while building this schema, even
though the adapter itself is separate code
(`buildWardrobeGeometry.js`) — these are the constraints future changes to
either side must keep true:

1. **The adapter is a second producer of `buildGeometry.js`'s existing part
   contract** (`{ id, role, size, position, material }`), not a new render
   contract. `FurnitureModel.jsx` picks whichever model is active with one
   `useMemo` conditional; the render loop, click-to-select behavior, and
   materials are untouched. If that contract ever changes, both producers
   change together or drift silently — there is no schema-level guard
   against that today, only the shared test convention (`buildGeometry.test.js`
   and `buildWardrobeGeometry.test.js` both assert against the same shape).
2. **Units convert at the adapter boundary for geometry, and once at import
   time for the shared constant.** `WardrobeModel` is millimetres end to
   end; `buildGeometry.js`/Three.js is metres. The per-part `MM = 0.001`
   conversion happens only inside `buildWardrobeGeometry.js`. One narrower
   exception, found during the Milestone 2 remediation review and recorded
   here rather than silently fixed: `schema.js` also does a one-time
   `PANEL_THICKNESS_MM = PANEL_THICKNESS * 1000` at module load, to derive
   `DEFAULTS.panelThicknessMm` from the shared metres constant instead of
   duplicating "18" as a literal (see the "Engineering constants" section of
   the remediation report). This is a conversion of a *constant*, not of
   per-part geometry, and doesn't touch kernel/tools/agent/store logic — but
   it means the earlier, stronger claim ("no other file ever touches
   metres") was not quite accurate, and this is the corrected version.
3. **Structural parts get derived IDs; component parts reuse the model's own
   ID.** A multi-piece component (a 4-row `DRAWER_BANK`) fans out to
   `${componentId}-row1..4` — deterministic, not a new allocation, so the
   viewer's part IDs are traceable back to exactly one `WardrobeModel`
   component, satisfying "every solid has a row in the cut list" in spirit
   even though production export for Wardrobe-AI-built pieces doesn't exist
   yet (see `docs/KNOWN_LIMITATIONS.md`).
4. **The adapter never reaches into `buildGeometry.js`'s module system**
   (ratios, one-type-per-module). It computes cursor/section layout directly
   from `WardrobeModel.sections`, reusing only the shared constants
   (`PANEL_THICKNESS`, `BACK_THICKNESS`) and the same box-offset conventions
   — not the ratio-resolution code itself, which doesn't apply to a model
   with absolute widths and multiple stacked components per section.

## What this schema does not model (Phase 1)

See [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) for the full, honest list —
notably: no plinth/base, no material/finish, no L-shaped/corner/sloped
carcasses, no appliance or worktop concepts (this is a wardrobe model, not
a kitchen one; the production engine's kitchen work is a separate system).
