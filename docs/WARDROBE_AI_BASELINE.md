# Wardrobe AI — Baseline (Claude Milestone 1)

> Frozen surface, per decision: **Next.js `/builder`** is the existing
> configurator/viewer the Wardrobe Model gets wired into. The live static
> site (`index.html` / `app.js`) is a *separate* system, is not touched by
> this work, and is out of scope for this document.

This is a map of what exists today, not a design document. Every claim below
is backed by a specific file. Where something the milestone plan assumes
*doesn't* exist yet, that is stated plainly rather than glossed over.

---

## CURRENT_FRONTEND

- [`src/app/builder/page.jsx`](../src/app/builder/page.jsx) — the `/builder`
  route. Renders a fixed three-column layout: `StructurePanel` (left) |
  `<Canvas>` 3D viewport (centre) | `AppearancePanel` (right). On mount, if a
  `?design=<id>` query param is present, it loads a canned config from
  [`src/lib/designs.js`](../src/lib/designs.js) via `getDesign()`. That is
  the *only* way a config reaches `/builder` today — there is no AI entry
  point wired into this page (see CURRENT_AI_ROUTE below).
- [`src/components/builder/StructurePanel.jsx`](../src/components/builder/StructurePanel.jsx)
  and
  [`src/components/builder/AppearancePanel.jsx`](../src/components/builder/AppearancePanel.jsx)
  — manual form controls (dimension sliders, module add/remove/resize,
  material/handle/door/LED pickers). Every control calls a `furnitureStore`
  action directly.
- The front page ([`src/app/page.jsx`](../src/app/page.jsx)) links to
  `/builder` and `/builder?design=<id>` in several places (hero CTA, gallery
  cards, footer nav). These links, and the page itself, are visual-identity
  surface — see "Frozen visual surface" below.

## CURRENT_STORE

[`src/store/furnitureStore.js`](../src/store/furnitureStore.js) — a single
flat Zustand store:

```js
{ config: FurnitureConfig, selectedModule: number | null }
```

- `config` is **replaced wholesale** by `loadConfig(config)` (used by the
  `?design=` loader) or `setType(type)` (regenerates a fresh default
  layout). There is no per-field patch/merge semantics beyond the dimension
  and module actions below.
- `selectedModule` is an **array index**, not a stable ID — selection breaks
  if modules are reordered.
- Module actions (`addModule`, `removeModule`, `updateModule`,
  `setModuleRatio`) all splice/map the `config.modules` array directly.
- **No revision history.** Every `set()` call overwrites the previous state;
  there is nothing to build "undo" on top of today (Milestone 10 starts from
  zero here, not from a partial history mechanism).

## CURRENT_GEOMETRY_GENERATOR

[`src/lib/furnitureConfig.js`](../src/lib/furnitureConfig.js) defines the
`FurnitureConfig` shape and
[`src/lib/buildGeometry.js`](../src/lib/buildGeometry.js) turns it into a
flat parts list. This is the real starting point for Claude Milestone 3 (the
deterministic kernel already exists in embryonic form), but it has three
properties that the new Wardrobe Model is required to *not* repeat:

1. **IDs are regenerated sequential counters, not stable identities.**
   `buildGeometry.js:22`: `push()` assigns `id: \`P${id++}\`` — literally the
   exact anti-pattern the milestone plan calls out (`P1`, `P2`, `P3`, ...).
   Every rebuild reassigns every ID from zero. `FurnitureModel.jsx` currently
   gets away with this because React's `key` only needs local stability
   within one render, but this **cannot** carry through to manufacturing
   identity, selection-by-reference, or revision diffing.
2. **Sections are width *ratios*, not absolute widths.** A module is
   `{ kind, widthRatio, doorCount, drawerRows, shelfCount, hingeSide,
   slideType }` — `widthRatio` is a fraction of the *remaining clear width*
   after dividers, renormalised across all modules
   (`normaliseModules()` in `furnitureConfig.js:105`). There is no field for
   "this section is exactly 700mm." A prompt like *"make the left section
   700mm"* cannot be expressed in the current schema without first
   converting the whole module array to/from ratios — this is a real schema
   gap Milestone 2 must close, not an implementation detail.
3. **Modules have no ID at all** — only a positional array index (`i`),
   surfaced on parts as `part.module = i`. Reordering, inserting, or
   removing a module shifts every later module's identity.

`PANEL_THICKNESS = 0.018` and `BACK_THICKNESS = 0.005` are hand-typed
literals in `furnitureConfig.js:20-21` — **not** derived from
`production-engine/furniai_engine/standards.py`. This is the same
constant-drift risk already flagged for the Python↔JS relationship in
general; see "Known duplication" below for how deep it already goes.

A basic physical validator already exists:
`buildGeometry.js:115` `validateGeometry(parts, config)` checks
non-finite/non-positive size and out-of-envelope parts. It does **not**
check section-to-section overlap, since "section" isn't a first-class
addressable object yet — there's nothing to overlap-check *between*.

## CURRENT_AI_ROUTE

`POST /api/v1/furniture/generate`
([`src/app/api/v1/furniture/generate/route.js`](../src/app/api/v1/furniture/generate/route.js))
→
[`furnitureGenerationService.js`](../src/lib/services/furnitureGenerationService.js)
→ `furniture-brain` (single LLM call, text/vision → FSL JSON) → `validateFsl`
→
[`configurator-adapter/adapter.js`](../src/lib/configurator-adapter/adapter.js)
(`fslToFurnitureConfig`) → `configSchema.js`'s `validateConfig()` (the
existing "safety gate": every field is checked against a catalog, every
dimension clamped, unknown values degrade to a template default rather than
propagating).

Two facts matter more than the pipeline shape:

- **This is the exact "prompt → JSON configuration" pattern Milestone 6
  is written to replace.** One LLM call produces a complete FSL document in
  one shot; there is no tool-call loop, no multi-turn state, no ability to
  reference "the third shelf" from a prior turn.
- **It is not wired into `/builder` at all today.** The only caller of this
  route is [`src/app/fsl-lab/page.jsx`](../src/app/fsl-lab/page.jsx), a
  separate lab/test page. `/builder` has zero AI code path currently — the
  Wardrobe AI is not replacing a working integration, it is building the
  first one.

The FSL↔FurnitureConfig structural mismatch is already documented plainly at
the top of `adapter.js` (FSL is "N doors / N drawers / N shelves for the
whole piece"; `/builder` is per-module counts) — the adapter's translation
is a deliberate, lossy approximation, not a bug.

## CURRENT_3D_VIEWER

[`src/components/builder/FurnitureModel.jsx`](../src/components/builder/FurnitureModel.jsx),
rendered inside a react-three-fiber `<Canvas>` in `builder/page.jsx`. It
calls `buildGeometry(config)` (memoised on `config` identity) and renders one
`<mesh>` per part, `<boxGeometry>` + `<meshStandardMaterial>`. Click handling
resolves `part.module` (the array index) back to `selectModule(index)` in the
store. This is genuinely a "read state, render boxes" component with no
geometry logic of its own — it is the correct, minimal integration point for
Milestone 9: swap what feeds `useMemo(() => buildGeometry(config), [config])`
without touching the render loop.

## CURRENT_PRODUCTION_EXPORTS

There are **two independent production/export pipelines**, and neither
talks to the other:

1. **`production-engine/furniai_engine`** (Python) — the real, standards-driven
   engine with an Inspector, DXF export, nesting, nine-gate validation. Reached
   from the *legacy static site* via `api/production.py`. Nothing in `src/`
   calls this.
2. **[`src/lib/production.js`](../src/lib/production.js)** — a separate,
   JS-only, explicitly **preview-only** module (`PRODUCTION_CAPABILITIES`:
   `geometry: "preview"`, `drawings: "unsupported"`, `nesting: "unsupported"`,
   `cnc: "unsupported"`). It calls `buildGeometry()`/`validateGeometry()`
   from the *same* `buildGeometry.js` the viewer uses, and defines **its own
   third copy** of the panel-thickness constant
   (`production.js:16`: `const PANEL_THK_MM = 18;` — not imported from
   `furnitureConfig.js`'s own `PANEL_THICKNESS`, let alone from
   `standards.py`). `buildProductionPack()` explicitly blocks manufacturing
   release and lists exactly why (no hardware SKUs, no factory profile, no
   drawings/nesting/CNC).

**Known duplication, for the record:** `18mm` panel thickness now exists as
three independent literals in this repo — `standards.py` (Python,
authoritative), `furnitureConfig.js:20` (JS), and `production.js:16` (JS,
*again*, not even reading the first JS copy). Any future "generate JS
constants from `standards.py`" work (the Phase-3 idea from the architecture
doc) should collapse all three into one generated source, not just the two
in `src/`.

---

## Files that must remain visually unchanged

Per the frozen-surface decision, these are load-bearing for "the app still
runs exactly as before" and must not be redesigned, only extended:

- `src/app/builder/page.jsx` — panel layout, header, camera, lighting, grid
- `src/components/builder/StructurePanel.jsx`,
  `src/components/builder/AppearancePanel.jsx` — existing manual controls
  keep working exactly as today; the Wardrobe AI is additive, not a
  replacement for manual editing
- `src/components/builder/FurnitureModel.jsx` — render loop, click-to-select
  behaviour, material shading
- `src/app/page.jsx` and its `/builder` links/nav — untouched
- The live static site (`index.html`, `app.js`, `styles.css`) — out of scope
  entirely for this work, per the frozen-surface decision

Agents may add: new store actions, a new adapter module, new API routes, new
tool definitions. They may **not**: replace `buildGeometry.js`'s render
contract (the `{ id, role, size, position, material }` shape
`FurnitureModel.jsx` expects), rewrite the panel layout, or introduce a
second 3D viewer.

## Exact integration point for the new Wardrobe Model

```text
WardrobeModel (new, canonical, stable IDs)
        │
        ▼
   adapter (new) ── converts WardrobeModel → the exact `parts` shape
        │            buildGeometry() already produces:
        │            { id, role, size, position, material, module? }
        ▼
FurnitureModel.jsx's `useMemo(() => buildGeometry(config), [config])`
        │            becomes `useMemo(() => adapt(wardrobeModel), [wardrobeModel])`
        ▼
   unchanged render loop
```

Concretely: `buildGeometry.js` is not deleted. It is joined by a new,
parallel module that consumes a `WardrobeModel` (Milestone 2's schema, with
absolute widths and stable IDs) and produces the same part shape. Whichever
one `FurnitureModel.jsx` calls is a one-line swap once the adapter exists —
that is the entire "no viewer rewrite" contract in code terms.

The store gains a new model slot alongside (not replacing) `config` during
the transition, or `config` itself is regenerated from `WardrobeModel` on
every change — exact mechanism is a Milestone 2/9 decision, not this
document's.

---

## Acceptance check

`npx vitest run` — all existing suites green, nothing in this document
changed application code.
