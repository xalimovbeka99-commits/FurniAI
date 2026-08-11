# Wardrobe AI tool contracts (Phase 1)

Canonical source: [`src/lib/wardrobe-tools/tools.js`](../src/lib/wardrobe-tools/tools.js)
(registry + implementations),
[`tools.test.js`](../src/lib/wardrobe-tools/tools.test.js) (contract tests —
if this document and that file ever disagree, the test file is correct and
this document is stale).

Every tool follows the same sequence, no exceptions:

```text
validate request → execute tool (kernel) → validate resulting wardrobe → commit model revision
```

**On success:** `{ success: true, model, revision, ...tool-specific fields }`.
**On failure:** `{ success: false, error: "CODE", message }` — no `model`
field. Callers keep using whatever model they already had; kernel functions
never mutate their input, and a failed validation is never committed. Tool
arguments are never silently coerced into something valid — see each error
code below.

**Strict schemas:** every `inputSchema` declares `additionalProperties:
false` (including the nested `properties` object on `component_update`).
Anthropic's API does not enforce this on its own — it only uses the schema
to steer the model — so `tools.js`'s `checkSchemaShape` re-checks it at
execution time. An unknown argument, a missing required argument, or a raw
geometry-shaped field (`threeJsPosition`, `x`, `y`, `z`) all fail with
`INVALID_TOOL_ARGUMENTS` before the kernel ever runs.

**Integer-millimetre contract:** every `*Mm` argument (`widthMm`, `heightMm`,
`depthMm`, `positionMm`, `deltaMm`) must be an exact integer. `700.5` is
rejected with `INVALID_DIMENSION`, never silently rounded to `700` or `701`.

**ID ownership:** every ID (`wardrobe-01`, `section-01`, `shelf-01`, ...) is
allocated by the kernel (`src/lib/wardrobe-model/ids.js`), never supplied by
the caller. See [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) for the explicit
record of this decision against Codex's caller-supplied-ID contract
suggestion (`tests/wardrobe-ai/fixtures/tool-contracts.json`).

---

### `wardrobe_create`

Starts a brand-new wardrobe, replacing whatever was being edited.

| Input | Type | Notes |
|---|---|---|
| `widthMm` | integer | 300–6000 |
| `heightMm` | integer | 300–3000 |
| `depthMm` | integer | 200–1200 |

Success: `{ success, model, revision }` (`revision` is always `1` — this
tool does not increment from a previous model's revision, it starts one).
Failure codes: `INVALID_DIMENSION`, `INVALID_TOOL_ARGUMENTS`.

### `wardrobe_resize`

| Input | Type | Notes |
|---|---|---|
| `widthMm` | integer, optional | Existing sections proportionally rescale to fit |
| `heightMm` | integer, optional | Sections are not affected |
| `depthMm` | integer, optional | Sections are not affected |

Success adds `wardrobeId`, `oldDimensionsMm`, `newDimensionsMm` (each
`{ widthMm, heightMm, depthMm }`) alongside `model`/`revision`. Failure
codes: `INVALID_DIMENSION`, `SECTION_TOO_NARROW` (a width reduction would
push a section below the 250mm manufacturable minimum), `INVALID_TOOL_ARGUMENTS`.

### `section_add`

| Input | Type | Notes |
|---|---|---|
| `widthMm` | integer, required | The new section's clear opening width |
| `afterSectionId` | string, optional | Insert after this section; omit to append at the end |

Existing sections are proportionally shrunk to make room for the new one —
adding a section also adds a divider, which itself consumes width (see
[WARDROBE_MODEL_SCHEMA.md](WARDROBE_MODEL_SCHEMA.md)). Success adds
`sectionId` (the new section's id). Failure codes: `SECTION_NOT_FOUND`
(bad `afterSectionId`), `SECTION_WIDTHS_EXCEED_WARDROBE`, `SECTION_TOO_NARROW`,
`INVALID_DIMENSION`, `INVALID_TOOL_ARGUMENTS`.

### `section_resize`

| Input | Type | Notes |
|---|---|---|
| `sectionId` | string, required | |
| `widthMm` | integer, required | |

The target section hits the exact requested width; the *other* sections
proportionally give up or receive the difference, by their own current
widths, so the total is unchanged. This is documented, deterministic
recompute — not a silent fix of bad input. A lone section (no siblings)
cannot be resized away from the wardrobe's own available width through this
tool; use `wardrobe_resize` for that, or `section_add` first. Success adds
`sectionId`, `oldWidthMm`, `newWidthMm`. Failure codes: `SECTION_NOT_FOUND`,
`SECTION_WIDTHS_EXCEED_WARDROBE`, `SECTION_TOO_NARROW`, `INVALID_DIMENSION`,
`INVALID_TOOL_ARGUMENTS`.

### `component_add`

| Input | Type | Notes |
|---|---|---|
| `sectionId` | string, required | |
| `type` | `SHELF` \| `DRAWER_BANK` \| `HANGING_RAIL` \| `DOOR` | `DIVIDER` is a valid enum value but always fails `NOT_IMPLEMENTED` — see [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) |
| `positionMm` | integer, optional | Height from the section's interior floor. Omit to auto-stack on top of the highest existing component |
| `rows` | integer, `DRAWER_BANK` only | 1–8, default 3 |
| `leaves` | integer, `DOOR` only | 1–4, default 1 |
| `hingeSide` | `left` \| `right`, `DOOR` only | default `left` |

Success adds `componentId`. Failure codes: `SECTION_NOT_FOUND`,
`NOT_IMPLEMENTED` (DIVIDER), `INVALID_ARGUMENT` (unknown type), `OUT_OF_RANGE`
(rows/leaves out of bounds — a count, not a millimetre dimension),
`INVALID_DIMENSION` (fractional/out-of-range `positionMm`),
`COMPONENT_OUTSIDE_SECTION`, `COMPONENT_OVERLAP`, `INVALID_TOOL_ARGUMENTS`
(unknown argument, including any raw geometry field).

### `component_move`

| Input | Type | Notes |
|---|---|---|
| `componentId` | string, required | |
| `axis` | `"z"` | Only `"z"` (vertical) is supported in Phase 1 |
| `deltaMm` | integer, required | Positive moves up, negative moves down |

**Exact arithmetic, not approximate**: starting at 900, `deltaMm: 120` gives
exactly `1020`, verified in `tools.test.js`. Success adds `componentId`,
`oldZ`, `newZ`. Failure codes: `COMPONENT_NOT_FOUND`, `NOT_IMPLEMENTED` (any
axis other than `"z"`), `COMPONENT_NOT_MOVABLE` (a `DOOR` — it has no
vertical position to move), `INVALID_DIMENSION` (fractional `deltaMm`),
`COMPONENT_OUTSIDE_SECTION` (the move would push it out of the section),
`COMPONENT_OVERLAP`, `INVALID_TOOL_ARGUMENTS`.

### `component_remove`

| Input | Type | Notes |
|---|---|---|
| `componentId` | string, required | |

Success adds `componentId`. Failure codes: `COMPONENT_NOT_FOUND`,
`INVALID_TOOL_ARGUMENTS`.

### `component_update`

| Input | Type | Notes |
|---|---|---|
| `componentId` | string, required | |
| `properties` | object, required | Only `rows` (`DRAWER_BANK`) or `leaves`/`hingeSide` (`DOOR`) — any other key is rejected outright, not ignored |

Success adds `componentId`, `oldProperties`, `newProperties` (each
`{ rows, leaves, hingeSide }`, undefined fields included as `undefined`).
Failure codes: `COMPONENT_NOT_FOUND`, `INVALID_ARGUMENT` (an unsupported
field for that component's type), `OUT_OF_RANGE`, `INVALID_TOOL_ARGUMENTS`
(unknown key inside `properties`, since that object also declares
`additionalProperties: false`).

---

## Error code reference

| Code | Meaning |
|---|---|
| `INVALID_DIMENSION` | A `*Mm` argument is non-finite, fractional, or out of its manufacturable range |
| `INVALID_TOOL_ARGUMENTS` | Schema-shape violation: unknown property, missing required property, or wrong type at the top level or one level of nesting |
| `INVALID_ARGUMENT` | A non-dimension argument is semantically wrong (unknown component type, unsupported `component_update` field) |
| `OUT_OF_RANGE` | A bounded integer count (`rows`, `leaves`) is out of range — distinct from `INVALID_DIMENSION` because it isn't a millimetre value |
| `SECTION_NOT_FOUND` / `COMPONENT_NOT_FOUND` | Referenced ID does not exist on the current model |
| `SECTION_WIDTHS_EXCEED_WARDROBE` | Requested section width(s) leave no room for the rest |
| `SECTION_TOO_NARROW` | A resize/add would push some section below the 250mm minimum |
| `NOT_IMPLEMENTED` | A recognized-but-unsupported request: `DIVIDER` via `component_add`, any `component_move` axis other than `"z"` |
| `COMPONENT_NOT_MOVABLE` | Attempted to move a `DOOR`, which has no vertical position |
| `COMPONENT_OUTSIDE_SECTION` | Resulting component position/zone would not fit inside its section's interior height |
| `COMPONENT_OVERLAP` | Two zone components (`SHELF`/`DRAWER_BANK`/`HANGING_RAIL`) would occupy overlapping height in the same section |
| `TOOL_NOT_AVAILABLE` | The provider named a tool outside the 8 approved ones (checked in `runWardrobeAgent.js`, not `tools.js`) |

A handful of these are deliberately narrower/more general than the example
codes in `tests/wardrobe-ai/fixtures/adversarial-scenarios.json` (e.g. that
fixture suggests `SHELF_OUTSIDE_SECTION`; this repo uses the more general
`COMPONENT_OUTSIDE_SECTION` since the same check applies uniformly to
`DRAWER_BANK` and `HANGING_RAIL` too, not just shelves) — see the executed
fixture test for the exact mapping recorded.

---

## Anthropic mapping

[`toAnthropicTools.js`](../src/lib/wardrobe-tools/toAnthropicTools.js) maps
this same registry to `{ name, description, input_schema }` — the exact
shape `@anthropic-ai/sdk`'s `tools` parameter expects. If a second provider
is ever added, it gets its own equally small mapping file; nothing about
`tools.js` or the kernel changes.
