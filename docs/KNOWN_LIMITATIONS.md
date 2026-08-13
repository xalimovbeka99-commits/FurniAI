# Wardrobe AI Phase 1 — known limitations

Stated plainly, per the project rule that unsupported functionality must be
reported as `NOT IMPLEMENTED`, never silently absent or implied to exist.

## Deployment status — PARTIALLY DEPLOYED as of the M1 legacy builder bridge

**Superseded, 2026-08-13:** the paragraph below described Phase 1's original
state (Wardrobe AI reachable only via `next dev`). That is no longer the
whole picture. The M1 legacy-builder bridge (`legacy-builder-adapter.js`,
`api/wardrobe/chat.js`) now gives the deployed static site one real, narrow
path into `src/`: the in-builder "Ask AI" drawer, when the active design is
already `type:"wardrobe"`, calls `POST /api/wardrobe/chat`, which is a thin
framework-null transport that imports and calls
`src/app/api/wardrobe/chat/route.js`'s `POST` handler directly (see
`api/wardrobe/chat.js`'s own doc comment). That route in turn runs
`runWardrobeAgent` against the real, unmodified Wardrobe AI kernel/tools.
`src/app/builder` (the Next.js page) itself is still not deployed by this
Vercel project — only the one API route it shares is now reachable from the
static site. See the new "M1 — Legacy Builder AI Bridge" section below for
the full, current picture (routing, unit conversion, adapter limits).

<details>
<summary>Original Phase 1 text (2026-08-12), kept for history</summary>

**Wardrobe AI exists only inside this repository's Next.js workspace
(`src/`) and has not been deployed anywhere.** The live, customer-facing
site at the current Vercel deployment is still the static `index.html`/
`app.js`/`api/chat.js` build at the repository root — that deployment does
not import from `src/` at all, so nothing in this phase changes what a real
visitor sees today, and no build/deploy step run as part of Phase 1 has
published `src/app/builder`'s new "Ask AI" panel anywhere public.

Concretely:
- No `vercel.json` routing change, environment variable, or build config
  change was made to expose `src/app/builder` or `/api/wardrobe/chat`.
- The only way to exercise Wardrobe AI today is `npm run dev` (or a
  from-source `next build && next start`) run locally/by a developer.
- Moving Wardrobe AI onto the deployed site is a **separate, explicit gate**
  after Phase 1 passes independent verification — it has not been requested
  or attempted here, and shouldn't be inferred from "the tests pass."

</details>

## Schema / geometry

- **No plinth or base.** `WardrobeModel` has no plinth field; every wardrobe
  is modeled as if it sits directly on the floor. `buildGeometry.js`'s
  existing manually-configured pieces do have a plinth — the two systems are
  visually inconsistent on this point until a follow-up adds one.
- **No material/finish.** None of the eight tools set material, color, or
  finish; `buildWardrobeGeometry.js` renders every part with the catalogue
  default (`DEFAULT_MATERIAL`). The existing `AppearancePanel` only affects
  the manually-configured piece (`config`), not a Wardrobe-AI-built one.
- **`DIVIDER` is structural, not addable.** A divider only makes sense
  between two adjacent sections; the kernel generates it automatically, with
  its own stable id, whenever sections are adjacent. `component_add` with
  `type: DIVIDER` returns `NOT_IMPLEMENTED`. No Phase 1 acceptance scenario
  needs a manually-placed mid-section divider.
- **`component_move` only supports the vertical (`"z"`) axis.** Horizontal
  repositioning within a section returns `NOT_IMPLEMENTED`.
- **No L-shaped, corner, or sloped-ceiling wardrobes.** `buildGeometry.js`
  and `buildWardrobeGeometry.js` both model a single rectangular carcass
  only. (The *kitchen* engine in `production-engine/furniai_engine` does
  support an L-shaped layout as of a separate piece of work in this
  repository's history — that is a different system, in Python, for a
  different furniture type, and does not extend to wardrobes.)
- **No sliding doors.** `DOOR` components are hinged only; there's no
  `slideType` field and no distinct sliding-door geometry.

## Persistence

- **Session-only state.** `wardrobeAIStore.js` holds the model, revision
  history, and conversation in memory (a Zustand store) for the current
  browser session. There is no database persistence: a page reload loses
  the wardrobe. The existing Supabase `projects` table is scoped to a
  different shape (the legacy static site's flat `cfg` object) and to
  authenticated users; wiring the Wardrobe AI into it is a real follow-up,
  not attempted here, since Phase 1's Definition of Done is a single-session
  conversation and does not require login.
- **Revision history is a snapshot list, not an undo UI.** Every successful
  tool call is recorded (`revisions: [{revision, model, at}]`), enough to
  build "undo that" on top of later, but no undo control exists yet.

## Integration scope

- **Superseded, 2026-08-13:** the bullet below was true for Phase 1 as
  originally shipped. The M1 legacy-builder bridge deliberately touches
  `index.html` (and, for parity, the standalone `app.js` copy) with a small,
  additive integration surface — see "M1 — Legacy Builder AI Bridge" below
  for exactly what changed and why. `src/lib/wardrobe-model/`,
  `wardrobe-tools/`, and `runWardrobeAgent.js` themselves are still
  untouched by M1; only the render/config boundary gained a new,
  narrow entry point.
- ~~The legacy static site (`index.html`/`app.js`) is untouched.~~ Per the
  frozen-surface decision, this work lives entirely under `src/` (the
  in-development Next.js app) and does not affect what real customers see
  at the deployed URL today.
- **The FSL v1 pipeline is untouched and unrelated.** `furniture-brain`,
  `configurator-adapter`, and the single-shot `/api/v1/furniture/generate`
  route are a separate system with a separate schema (`FurnitureConfig`, not
  `WardrobeModel`). The Wardrobe AI does not replace or unify with it — both
  now exist in the same repository, serving different purposes. Only
  `/builder`'s *render* path is shared (`FurnitureModel.jsx` picks whichever
  model is active).
- **Of the original 13 `test.todo` entries in `wardrobeBenchmark.test.js`,
  5 are now real, passing tests** (typed resize, add/remove drawer bank,
  add/remove shelf, collision detection, stable-ID/production cross-check).
  The other 8 stay `test.todo` because they are genuinely still missing:
  multi-module FSL→buildGeometry wiring, wall-to-wall fillers/scribes,
  L-shaped/corner/sloped-ceiling wardrobes, sliding-vs-hinged rendering,
  image-based dimension extraction, and custom arbitrary-panel furniture.

## M1 — Legacy Builder AI Bridge (2026-08-13)

What actually ships to the deployed static site as of this milestone, and
exactly where it stops:

- **Entry point is scoped to one place.** Only the in-builder "Ask AI"
  drawer routes to the canonical Wardrobe AI, and only when the design
  currently open is already `Builder.cfg.type === 'wardrobe'`
  (`index.html`'s `aiSendMessage`). Every other furniture type (kitchen,
  vanity, bookshelf, sideboard, both walk-in shapes, custom) keeps using the
  original `/api/chat` flow completely unchanged. The top-level, pre-builder
  "Ask AI" page (`#/ai`, reached before opening any design) also still uses
  `/api/chat` for every type, including a brand-new wardrobe — it does not
  route to the new bridge. Starting a wardrobe from nothing via the
  canonical model requires first opening any wardrobe preset, then asking
  the in-drawer AI to create a new one (`wardrobe_create` explicitly
  replaces "any wardrobe currently being edited").
- **Material, handle, LED, and door style are not AI-controlled.** The
  canonical `WardrobeModel` (`src/lib/wardrobe-model/schema.js`) has no
  finish/material/handle/LED/door-style field at all — only dimensions,
  sections, and structural components (SHELF/DRAWER_BANK/HANGING_RAIL/DOOR
  leaves+hingeSide). `wardrobeModelToLegacyConfiguration()` in
  `legacy-builder-adapter.js` deliberately leaves `mat`/`doorType`/`handle`/
  `led` untouched (spread from whatever `Builder.cfg` already had) rather
  than guessing a value with no source of truth. A door's presence/absence
  or style is therefore never changed by the AI in M1 — asking it to "make
  the doors glass" or "remove the doors" has no tool that can do that yet.
- **The adapter's own bounds are tighter than the kernel's.** The kernel
  allows width 300–6000mm / height 300–3000mm / depth 200–1200mm; the
  legacy adapter additionally requires width 1200–3600mm, height
  1800–2800mm, depth 400–800mm, 1–6 sections, 0–6 shelves and 0–8 drawer
  rows per section (`LEGACY_LIMITS` in `legacy-builder-adapter.js`), and
  exactly one `DRAWER_BANK` per section (the legacy renderer only has one
  drawer stack per bay). A canonical wardrobe outside these bounds is valid
  by the kernel/validator but is rejected by the adapter with a typed
  `LegacyBuilderAdapterError`, surfaced to the customer as a generic "that
  wardrobe cannot be represented safely in this builder" message — never
  silently clamped or partially rendered.
- **Per-section shelves/drawers now render faithfully.** Unlike the
  original uniform-per-wardrobe `wall()` loop, `buildWardrobe()` now accepts
  an optional `sectionLayouts` array (one `{shelves, drawers}` entry per
  section) and, when present, overrides the old uniform `opts.shelves`/
  `opts.drawers` per section — so "four drawers in the middle, shelves on
  the right" renders as asked, not as a lossy wardrobe-wide average. The
  `sections`/`drawers`/`shelves` scalar fields are still populated (as the
  max across sections) for the slider UI and for any code path that only
  reads the old uniform shape.
- **`app.js` (the standalone root copy, not the deployed `index.html`) got
  the `applyConfiguration`/`applyWardrobeModel`/`sectionLayouts` changes for
  parity, but has no AI drawer UI to call them from** — that UI
  (`aiFab`/`aiDrawer`/`wardrobeAiSendMessage`) exists only in `index.html`.
  `app.js` is not currently `<script>`-loaded by `index.html` (that file
  inlines its own copy of the builder instead) and is not the file real
  visitors execute; see the Vercel deployment notes for the existing,
  independent gap this reflects.
- **Session-only continuity, same as Phase 1.** The client holds
  `wardrobeAiModel`/`wardrobeAiConversation` in page memory and resends them
  each turn; a page reload starts a fresh wardrobe. No new persistence was
  added.
- **Provider resilience matches whatever `route.js` currently does.**
  `api/wardrobe/chat.js` delegates entirely to
  `src/app/api/wardrobe/chat/route.js`, which today constructs a single
  Anthropic-only client (`createAnthropicWardrobeClient`). The
  Anthropic/OpenAI failover work (PR #4) is a separate, still-under-review
  branch; once it lands in `route.js`, this bridge inherits it automatically
  with no changes of its own — it was written to depend on the route's
  behavior, not reimplement it.

## Evaluation

- **The fake-provider eval suites** (`tests/wardrobe-ai/evals/*.eval.test.js`,
  minus `live.eval.test.js`) prove the tool-calling *loop* and the
  deterministic *tools* are correct given a scripted model response. They do
  **not** prove the real Anthropic model reliably picks the right tool calls
  for genuinely open-ended natural language — that is what
  `live.eval.test.js` is for, and it is intentionally excluded from normal
  CI (skipped unless `ANTHROPIC_API_KEY` is set) since it costs money and
  depends on live model behavior. Treat a green fake-provider suite as
  "the mechanism is sound," not as "the AI understands every prompt."
