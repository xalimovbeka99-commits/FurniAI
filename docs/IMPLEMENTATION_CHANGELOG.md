# Wardrobe AI Phase 1 — implementation changelog

For Codex's frozen-surface review
(`src/lib/wardrobe-verification/frozenSurfaces.test.js`): every file this
work touches, and exactly why. Two of the hash-checked files change — both
were explicitly scoped as minimal, additive wiring in the approved plan, not
a redesign.

## New files (no frozen surface touched)

```
src/lib/wardrobe-model/
  ids.js                    monotonic stable-ID allocator
  schema.js                 component-type enum + manufacturable defaults
  kernel.js                 deterministic modeling kernel (Milestone 3)
  kernel.test.js
  validator.js               physical validator (Milestone 5)
  validator.test.js
  buildWardrobeGeometry.js   WardrobeModel -> the exact part shape
                             buildGeometry.js already produces (Milestone 9)
  buildWardrobeGeometry.test.js

src/lib/wardrobe-tools/
  tools.js                   the 8 approved tools (Milestone 4)
  tools.test.js               contract + adversarial tests
  toAnthropicTools.js         provider-format mapping

src/lib/wardrobe-agent/
  systemPrompt.js
  runWardrobeAgent.js         the tool-calling loop (Milestone 6)
  runWardrobeAgent.test.js
  fakeWardrobeAgentProvider.js
  client.js                   real Anthropic client factory

src/store/wardrobeAIStore.js  session state + revision history (Milestones 8/10)
src/components/builder/WardrobeAIPanel.jsx   minimal chat UI, closed by default
src/app/api/wardrobe/chat/route.js           new API route (does not touch
                                              /api/v1/furniture/generate)

tests/wardrobe-ai/evals/
  creation.eval.test.js
  editing.eval.test.js
  robustness.eval.test.js
  live.eval.test.js           skipped unless ANTHROPIC_API_KEY is set

docs/WARDROBE_MODEL_SCHEMA.md
docs/TOOL_CONTRACTS.md
docs/KNOWN_LIMITATIONS.md
docs/IMPLEMENTATION_CHANGELOG.md   (this file)
```

## Modified files

- **`vitest.config.js`** — added `tests/wardrobe-ai/**/*.test.js` to
  `include`, scoped narrowly so it does not also pick up
  `tests/validator.test.js` (deliberately `node --test`/CommonJS, unrelated
  to this work). Test infrastructure only, not a frozen surface.

- **`src/lib/furniture-brain/wardrobeBenchmark.test.js`** — 5 of the 13
  `test.todo` entries converted to real, passing tests (see
  [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) for exactly which 5, and why
  the other 8 stay `test.todo`). Not a frozen surface.

- **`src/components/builder/FurnitureModel.jsx`** (frozen-surface list) —
  2 new imports (`useWardrobeAIStore`, `buildWardrobeGeometry`) and the
  existing `useMemo` gains one conditional: render the Wardrobe-AI model
  when one exists, else fall back to `buildGeometry(config)` exactly as
  before. Render loop, click-to-select, materials, `<mesh>` structure: all
  unchanged. Full diff: 13 lines (+11/-2).

- **`src/app/builder/page.jsx`** (frozen-surface list) — one new header
  button ("Ask AI") replacing an empty spacer div, toggling a new
  `WardrobeAIPanel` overlay mounted inside the existing `<main>`. Default
  state is closed, so the page is pixel-identical to before until a user
  clicks it. Three-column layout, camera, lighting, grid, existing panels:
  all unchanged. Full diff: 16 lines (+14/-2).

Both frozen-surface diffs are reproducible with:

```bash
git diff -- src/app/builder/page.jsx src/components/builder/FurnitureModel.jsx
```

## What was NOT touched (Phase 1 only — see M1 section below)

`src/store/furnitureStore.js`, `src/lib/buildGeometry.js`,
`src/lib/configSchema.js`, `src/lib/configurator-adapter/adapter.js` — zero
diff, still. `index.html`, `app.js`, `api/chat.js`, and `vercel.json` were
untouched **by Phase 1** but are touched by the M1 milestone below — Phase
1's "new, parallel system" framing still holds for the canonical model
itself (`src/lib/wardrobe-model`, `wardrobe-tools`, `runWardrobeAgent.js`
are unmodified by M1 too), just not for the legacy site as a whole anymore.

## Verification run

```
npx vitest run       # all suites, including the new ones above
npm run lint
npm run build
```

See [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) for what this phase
deliberately does not cover.

---

# M1 — Legacy Builder AI Bridge (2026-08-13)

Connects the existing, unmodified canonical Wardrobe AI (kernel + tools +
`runWardrobeAgent.js`) to the founder-preferred static builder, without
rebuilding or replacing its Three.js renderer. See
[KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md)'s "M1 — Legacy Builder AI
Bridge" section for exactly what this does and does not cover yet.

## New files

```
legacy-builder-adapter.js
  Canonical WardrobeModel -> legacy Builder.cfg. UMD (works as a browser
  <script> global AND as a CommonJS require() for tests). Validates the
  model, converts integer mm -> cm in one place (mmToCm), derives
  sections/shelves/drawers/sectionLayouts, rejects anything the legacy
  renderer cannot represent (LegacyBuilderAdapterError) instead of
  clamping or guessing. Preserves mat/doorType/handle/led/every other
  existing Builder.cfg field untouched (spread from `current`) since the
  canonical model has no finish concept in M1.

src/lib/legacy-builder-adapter/adapter.test.js
  Contract tests: mm->cm conversion, dimension/section/shelf/drawer
  mapping (including a non-uniform middle section, proving no lossy
  flattening), applying through Builder.applyConfiguration, successive
  revisions preserving wardrobe id + unrelated appearance state, a full
  deterministic create->edit->resize sequence run through the real
  wardrobe-tools registry, invalid/out-of-range/unsupported-component/
  multiple-drawer-bank rejection, and a source-scan proving the bridge
  never touches Three.js/coordinates directly. Also covers the
  framework-null transport (method/validation delegation).

api/wardrobe/chat.js
  The Vercel serverless entry point the static site actually calls
  (POST /api/wardrobe/chat). Deliberately thin: constructs a standard
  Request from the classic (req,res) Vercel body and calls
  src/app/api/wardrobe/chat/route.js's POST directly, rather than
  creating a second provider/agent implementation. No API key handling
  of its own — the route it delegates to owns that. When the pending
  provider-failover work lands in that route, this transport inherits it
  with zero changes.
```

## Modified files

- **`src/app/api/wardrobe/chat/route.js`** — switched from `next/server`'s
  `NextResponse` + the `@/` path alias to a plain `Response` constructor and
  relative imports. Fixes a real defect (verified by direct Node import,
  not assumed): Next 14's `package.json` declares no `./server` export
  subpath for consumers outside its own build, so `api/wardrobe/chat.js`
  loading this route directly — exactly what M1 needs — threw
  `ERR_MODULE_NOT_FOUND` before this change. `@/` aliases are a
  webpack/SWC/Next-specific resolution feature with the same problem under
  Vercel's plain Node function bundler. Behavior for the Next.js app itself
  is unchanged: Route Handlers only need to return a standard `Response`,
  and `NextResponse.json(...)` was the only feature used.

- **`index.html` / `app.js`** (both, kept in parity) —
  - `wall()`'s per-section loop: reads an optional `opts.sectionLayouts[i]`
    override for that section's drawer/shelf count, falling back to the old
    uniform `opts.drawers`/`opts.shelves` when absent. `buildWardrobe()`
    passes `this.cfg.sectionLayouts` through. This is the one change to
    protected rendering logic, and it's additive/backward-compatible: a
    config with no `sectionLayouts` renders exactly as before.
  - New `Builder.applyConfiguration(configuration)` — merges a partial
    config into `Builder.cfg`, syncs every slider/label/material-swatch DOM
    element, calls the existing `build()`, returns the merged `cfg`. This is
    the "one clean boundary" the M1 spec asked for; it does not duplicate
    `build()` or any geometry function.
  - New `Builder.applyWardrobeModel(model)` — thin call to
    `globalThis.LegacyBuilderAdapter.applyWardrobeModelToBuilder(this,
    model)`.
  - Manual slider input now clears any stale `cfg.sectionLayouts` before
    rebuilding, so a manual uniform edit after an AI per-section edit
    doesn't silently keep overriding it.
  - `index.html` only: `wardrobeAiSendMessage()` (new) posts to
    `/api/wardrobe/chat` with `{message, model, conversation}`, applies the
    returned canonical model via `Builder.applyWardrobeModel`, and keeps
    `wardrobeAiModel`/`wardrobeAiConversation` in page memory for
    continuity. `aiSendMessage()` routes to it only when
    `isDrawer && !image && Builder.cfg.type === 'wardrobe'` — every other
    type/entry point is byte-for-byte unchanged.
  - `<script src="/legacy-builder-adapter.js"></script>` added to
    `index.html`'s `<head>`.

- **`vercel.json`** — `buildCommand` now also copies
  `legacy-builder-adapter.js` into `dist/` alongside the existing
  `index.html styles.css app.js`. Framework, output directory, and
  `api/production.py` config: unchanged.

- **`tests/wardrobe-production/fixtures/phase1-protected-surfaces.json`** —
  `vercel.json`'s hash updated with a `justifiedBaselineUpdates` entry
  explaining the one-line reason above.

## What was NOT touched by M1

`src/lib/wardrobe-model/`, `src/lib/wardrobe-tools/`,
`src/lib/wardrobe-agent/runWardrobeAgent.js`, `src/lib/wardrobe-agent/
client.js`, `src/lib/wardrobe-agent/systemPrompt.js` — zero diff. The
canonical kernel, tools, and agent loop are exactly Phase 1's. `api/chat.js`,
`api/constructionValidator.js`, and every non-wardrobe furniture type's
in-drawer AI flow — zero diff, zero behavior change.

## Verification run

```
npx vitest run          # 373 passed, 3 skipped (live API), 20 todo
npm run lint             # clean
npm run docs:check       # clean
npm run build             # clean (next build)
npm run test:validator    # 21 passed, 3 todo
```
