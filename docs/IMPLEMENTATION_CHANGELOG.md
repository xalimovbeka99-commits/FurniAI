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

## What was NOT touched

`src/store/furnitureStore.js`, `src/lib/buildGeometry.js`,
`src/lib/configSchema.js`, `src/lib/configurator-adapter/adapter.js`,
`index.html`, `app.js`, `api/chat.js`, `vercel.json` — zero diff. The
Wardrobe AI is a new, parallel system with its own store and its own
geometry function that happens to produce the same part shape
`FurnitureModel.jsx` already renders.

## Verification run

```
npx vitest run       # all suites, including the new ones above
npm run lint
npm run build
```

See [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) for what this phase
deliberately does not cover.
