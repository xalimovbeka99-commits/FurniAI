# Wardrobe AI Phase 1 — known limitations

Stated plainly, per the project rule that unsupported functionality must be
reported as `NOT IMPLEMENTED`, never silently absent or implied to exist.

## Deployment status — NOT DEPLOYED

**Wardrobe AI exists only inside this repository's Next.js workspace
(`src/`) and has not been deployed anywhere.** The live, customer-facing
site at the current Vercel deployment is still the static `index.html`/
`app.js`/`api/chat.js` build described in
[docs/architecture/SYSTEM_ARCHITECTURE.md](architecture/SYSTEM_ARCHITECTURE.md)
— that deployment does not import from `src/` at all, so nothing in this
phase changes what a real visitor sees today, and no build/deploy step run
as part of Phase 1 has published `src/app/builder`'s new "Ask AI" panel
anywhere public.

Concretely:
- No `vercel.json` routing change, environment variable, or build config
  change was made to expose `src/app/builder` or `/api/wardrobe/chat`.
- The only way to exercise Wardrobe AI today is `npm run dev` (or a
  from-source `next build && next start`) run locally/by a developer.
- Moving Wardrobe AI onto the deployed site is a **separate, explicit gate**
  after Phase 1 passes independent verification — it has not been requested
  or attempted here, and shouldn't be inferred from "the tests pass."

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

- **The legacy static site (`index.html`/`app.js`) is untouched.** Per the
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
