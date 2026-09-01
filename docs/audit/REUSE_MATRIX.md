# REUSE_MATRIX — what migrates, what is rewritten, what is rejected

Audit date: 2026-08-30. Companion to `BASELINE.md` and `SOURCE_MAP.md`.
Decisions: `REUSE_AS_IS` · `MIGRATE_AND_REWRITE` · `REFERENCE_ONLY` · `REJECT`

**`REUSE_AS_IS` here means "the logic and its tests are sound enough to carry over
substantially unchanged".** It does not waive the master plan's TypeScript requirement:
every migrated production module still gets typed at the boundary. Where that conversion
is more than mechanical, the decision is `MIGRATE_AND_REWRITE` instead.

Quality scale: **High** = covered by passing tests and a clear contract · **Medium** =
works, thin or indirect coverage · **Low** = untested, unclear ownership, or known defects.

---

## 1. Component decisions

| Component | Location | Evidence | Quality | Dependencies | Risks | Decision | Migration notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Wardrobe geometry kernel | `src/lib/wardrobe-model/kernel.js` (361), `ids.js` (52) | `kernel.test.js` 294 L; lint clean `[VERIFIED]`; suite not executable in this env `[BLOCKED]` | High | none beyond JS stdlib | Test run unverified here | **REUSE_AS_IS** | Highest-value asset. Port verbatim, then add TS types + a Zod schema at the edge. Keep stable-ID semantics exactly. |
| Canonical wardrobe data model | `src/lib/wardrobe-model/schema.js` (124) | consumed by agent, tools, geometry B `[VERIFIED]` | High | kernel | Competes with `configSchema.js` `[RISK]` | **MIGRATE_AND_REWRITE** | Becomes the ONE `FurnitureDesign` contract. Add contract version, design/revision IDs, explicit-vs-defaulted-vs-inferred metadata (all absent today `[KNOWN_GAP]`). Integer millimetres throughout. |
| Hand-written schema (`configSchema.js`) | `src/lib/configSchema.js` | `configSchema.test.js` `[VERIFIED]` | Medium | buildGeometry A | Second source of truth `[RISK]` | **REFERENCE_ONLY** | Mine it for bounds and defaults, then retire. Do not port the shape. |
| Hand-written validator | `src/lib/wardrobe-model/validator.js` (94), `tests/validator.test.js` | 24 tests · 21 pass · 0 fail · 3 todo, exit 0 `[VERIFIED]` | High | schema | 3 `[knownGap]` todos (shelf-span, door-weight) | **MIGRATE_AND_REWRITE** | Re-express as Zod schemas + refinements. Carry the 13 JSON fixtures across unchanged — they are the real asset. Keep the 3 todos visible as known gaps; do not silently drop them. |
| FSL validator | `src/lib/fsl/`, `validator.test.js` | lint clean `[VERIFIED]` | Medium | fsl model | Third schema family `[RISK]` | **REFERENCE_ONLY** | v0.1 is a wardrobe slice; FSL is out of scope. Revisit after the slice is stable. |
| Geometry generator A | `src/lib/buildGeometry.js` (+ `furnitureConfig.js`) | `buildGeometry.test.js`, `frozenSurfaces.test.js` `[VERIFIED]`; this is what production renders `[VERIFIED]` | Medium | configSchema, knowledgeBase | Duplicate of B; multi-type (kitchen/vanity/shelving) scope creep beyond the v0.1 wardrobe slice | **REFERENCE_ONLY** | Do not port. Use it as the visual-parity reference while B is extended to cover what the live builder shows. Non-wardrobe types are out of v0.1 scope. |
| Geometry generator B | `src/lib/wardrobe-model/buildWardrobeGeometry.js` (115) | `buildWardrobeGeometry.test.js` (86) `[VERIFIED]` | High | kernel, canonical model | Currently narrower than A | **REUSE_AS_IS** | Becomes the single deterministic scene-part generator. Extend to full parity with A for wardrobes before A is dropped. |
| React Three Fiber builder | `src/app/builder/page.jsx` (114), `FurnitureModel.jsx` (88) | 7 browser tests: non-blank render, orbit, zoom, W/H/D, hard refresh, blocked HDR, all-cross-origin-blocked `[VERIFIED]` | Medium | drei, both stores, both geometry paths | Reads two stores + two geometry modules `[RISK]`; no animation `[KNOWN_GAP]` | **MIGRATE_AND_REWRITE** | Keep the R3F structure, `OrbitControls` bounds (`minDistance 1.2` / `maxDistance 9`), Suspense layout and the local-environment approach. Rewrite the data path to read ONE canonical revision. |
| Builder control panels | `StructurePanel.jsx` (138), `AppearancePanel.jsx` (123) | live in production, all controls exercised `[VERIFIED]` | Medium | furnitureStore | No unit tests `[KNOWN_GAP]` | **MIGRATE_AND_REWRITE** | The UX and control taxonomy are proven — keep them. Re-bind to the canonical contract and type the props. |
| `LocalEnvironment` + `SceneEnhancementBoundary` | `src/components/builder/` (46 + 33) | browser tests prove blocked HDR / blocked cross-origin do not break the builder `[VERIFIED]` | High | drei | none | **REUSE_AS_IS** | Directly satisfies "no remote HDR dependency" and "nonessential effects must never take down the model". Port early. |
| Zustand stores | `src/store/furnitureStore.js` (76), `wardrobeAIStore.js` (68) | live `[VERIFIED]` | Low | — | Two stores, implicit precedence `[RISK]`; no tests `[KNOWN_GAP]` | **MIGRATE_AND_REWRITE** | Collapse to ONE store holding the canonical revision + UI state. AI and manual edits both produce revisions; no second source of truth. |
| Material system | `src/lib/knowledgeBase.js` (142) `MATERIALS` | `knowledgeBase.test.js`; 10+ finishes live `[VERIFIED]` | Medium | — | Mixed with unrelated knowledge data | **MIGRATE_AND_REWRITE** | Extract the material/finish catalogue into its own typed module; leave the rest behind. |
| Door system | `buildWardrobeGeometry.js`, `StructurePanel.jsx`, `ids.js` | count/hinge/type live `[VERIFIED]` | Medium | geometry B | **No open/close animation** `[KNOWN_GAP]` | **MIGRATE_AND_REWRITE** | Port static geometry; write animation fresh against `useFrame`, using legacy `app.js` only as behavioural reference. |
| Drawer system | as above | drawer rows live `[VERIFIED]` | Medium | geometry B | No animation `[KNOWN_GAP]` | **MIGRATE_AND_REWRITE** | Same as doors. |
| LED system | `AppearancePanel.jsx`, `buildWardrobeGeometry.js`, `SceneEnhancementBoundary.jsx` | control live `[VERIFIED]` | Medium | geometry B | No tests `[KNOWN_GAP]` | **MIGRATE_AND_REWRITE** | Keep the boundary pattern so LED failure can never blank the model. |
| Camera / orbit controls | drei `OrbitControls` config in `builder/page.jsx:87`, `page.jsx:193` | orbit + zoom browser tests `[VERIFIED]` | High | drei | none | **REUSE_AS_IS** | Copy the configuration values; they are tuned and tested. |
| AI provider layer | `src/lib/ai-provider/**` (20 files) | 8 dedicated test files `[VERIFIED]` | High | `@anthropic-ai/sdk`, `openai` | SDK version drift | **REUSE_AS_IS** | Best-engineered subsystem in the repo. Port whole, add types. |
| Provider failover | `providerRouter.js` + `errors.js:isRetriableProviderFailure` | `providerRouter.test.js`, `simulatedFailover.test.js` `[VERIFIED]` | High | provider layer | Live behaviour never exercised `[UNVERIFIED]` | **REUSE_AS_IS** | Preserve the invariant exactly: fail over on availability faults, never on deterministic tool/schema errors. |
| Agent layer | `src/lib/wardrobe-agent/**` | `runWardrobeAgent.test.js`, `tests/wardrobe-ai/**` `[VERIFIED]` | High | provider + tools + kernel | Evidence is fake-provider only `[UNVERIFIED]` | **REUSE_AS_IS** | Port with the fake provider. Keep the separate opt-in live eval (`live.eval.test.js`) — do not let fake-provider passes stand in for live understanding. |
| Tool layer | `src/lib/wardrobe-tools/**` | `tools.test.js` + `tool-contracts.json` `[VERIFIED]` | High | kernel, validator | none | **REUSE_AS_IS** | The "LLM never emits mesh coordinates" guarantee lives here. Port intact. |
| Secret-redaction logic + tests | `src/lib/ai-provider/errors.js:216`, `errors.test.js`, `apiChatSecurity.test.js` | tests assert `sk-ant-…` never reaches logs or responses `[VERIFIED]` | High | — | none | **REUSE_AS_IS** | Port before any provider code so redaction exists from commit one. |
| `/api/wardrobe/chat` | `src/app/api/wardrobe/chat/route.js` (100) | `route.test.js`, live POST 400 on empty body `[VERIFIED]` | High | agent, router | **No rate limiting, no auth** `[RISK]` | **MIGRATE_AND_REWRITE** | Keep the shape (JSON guard → validate → route → typed errors). Add Zod body parsing and rate limiting during the port. |
| `/api/sales-agent`, `/api/v1/furniture/generate`, `/api/whatsapp/webhook` | `src/app/api/**` | live `[VERIFIED]`; webhook has no tests `[KNOWN_GAP]` | Low–Medium | provider layer | Unauthenticated public endpoints `[RISK]`; webhook signature verification unconfirmed `[UNVERIFIED]` | **REFERENCE_ONLY** for v0.1 | Out of the vertical slice. Re-introduce deliberately, each with auth + rate limiting + tests. |
| Top-level `api/chat.js`, `api/constructionValidator.js`, `api/wardrobe/chat.js` | `api/` | tracked, deployed by Vercel `[VERIFIED]` | Low | — | Shadow API surface `[RISK]` | **REJECT** | Do not carry across. Their only purpose was the `framework: null` static deployment. |
| `api/production.py` | `api/production.py` (674) | `/api/production` returns 200 in production `[VERIFIED]` | Medium | Supabase, `production-engine/` | Publicly reachable factory endpoint `[RISK]`; hardcoded Supabase defaults `[RISK]`; stale `FURNIAI_ALLOWED_ORIGINS` default `[RISK]` | **REFERENCE_ONLY** | Must stay OUT of the v0.1 customer runtime. `FACTORY_QUALIFICATION_REQUIRED` until a real factory validates it. |
| `production-engine/` | `production-engine/` | `production.test.js`, `tests/wardrobe-production/**` | Medium | Python | Software consistency ≠ factory validity `[RISK]` | **REFERENCE_ONLY** | Quarantined directory or separate repository. Never linked to a v0.1 claim. |
| Legacy static builder (`app.js`) | `app.js` (544) | 16 browser tests, all against the now-undeployed runtime `[VERIFIED]` | Medium | vendored three r128 | Monolith; not the deployed runtime | **REFERENCE_ONLY** | Behavioural reference for door/drawer animation and gallery thumbnails. Never paste into a React component. |
| Legacy `index.html` | `index.html` (2483, 5 inline scripts) | not served `[VERIFIED]` | Low | vendored bundles | **Contains a live Supabase URL + anon key inline** `[RISK]` | **REJECT** | Do not copy. Extract visual identity by reading it, not by porting it. |
| Legacy CSS | `styles.css` (429) | design identity source | Medium | — | — | **REFERENCE_ONLY** | Re-implement the identity (paper/brass, Fraunces + Space Mono) in the new styling system. |
| `index_3.html`, `base_builder.txt`, `debug.log`, `FurniAI/`, `test-results/` | repo root | dead; `FurniAI/` deleted in working tree `[VERIFIED]` | Low | — | Confusion | **REJECT** | Leave behind entirely. |
| Vendored bundles (`vendor-three-r128.min.js` 603 KB, `vendor-supabase.min.js` 212 KB) | repo root | pinned, no CDN — the reason a browser test passes with CDNs blocked `[VERIFIED]` | Medium | — | Obsolete three r128 vs r166 in `package.json` `[RISK]` | **REJECT** | The npm-managed `three` supersedes them. Keep the *principle* (no unpinned runtime CDN), drop the files. |
| Supabase client | `vendor-supabase.min.js`, `supabase/`, `api/production.py:36-43` | `@supabase/supabase-js` NOT installed `[VERIFIED]` | Low | — | Hardcoded anon key in two tracked files `[RISK]` | **REJECT** | Master plan defers Supabase/auth past the local slice. Rebuild against the official SDK later, from env vars only. |
| Authentication | `api/production.py:544-556` | Bearer → `/auth/v1/user` `[VERIFIED]` | Medium | Supabase | No auth in the Next app at all `[KNOWN_GAP]` | **REFERENCE_ONLY** | The pattern is sound; re-implement server-side with tenant ownership and revision immutability when auth returns. |
| Existing unit tests (41 files) | `src/**/*.test.js`, `tests/wardrobe-ai/**` | not executable here `[BLOCKED]` | High (by inspection) | Vitest | Coverage skewed to AI layer; UI and stores untested `[KNOWN_GAP]` | **MIGRATE_AND_REWRITE** | Port the AI, kernel, geometry-B and redaction suites first. Add the missing store/panel/persistence suites new. |
| Browser tests | `site.spec.js` (16, legacy), `r3f-builder.spec.js` (7, Next) | `[VERIFIED]` | Mixed | Playwright | 16/23 target a dead runtime `[RISK]` | `site.spec.js` → **REFERENCE_ONLY**; `r3f-builder.spec.js` → **MIGRATE_AND_REWRITE** | `site.spec.js` is the best written statement of required behaviour — mine it to author the missing 13 of the 20 required assertions against `/builder`. |
| Parity-gate documentation | `docs/LEGACY_BUILDER_PARITY_GATE.md` | frozen ref commit `9b21e8b6…` `[VERIFIED]` | High | — | Currently unenforced — legacy was un-deployed before the gate passed `[RISK]` | **MIGRATE_AND_REWRITE** | Carry into `docs/` of the clean repo as the acceptance contract, updated to reflect that legacy is already off production. |
| Current deployment configuration | `vercel.json`, `.vercel/`, `.vercel.bak/` | see `LEGACY_REMOTES.md` | Low | — | Old project linkage `[RISK]` | **REJECT** | New `vercel.json` written fresh: Next.js framework detection, repository root, no `dist`. Never copy `.vercel/`. |

---

## 2. Applied principles — how the calls were made

1. **Preserve verified domain logic.** The kernel, tools, provider layer and redaction all
   carry real tests and are marked `REUSE_AS_IS`.
2. **Do not blindly copy architectural debt.** Every duplicate-source-of-truth component
   (two stores, two geometry paths, three schemas, two API surfaces) is `MIGRATE_AND_REWRITE`
   or `REFERENCE_ONLY`, never `REUSE_AS_IS`.
3. **TypeScript for new/migrated production modules.** No exceptions; `REUSE_AS_IS` means the
   logic survives, not that the file stays untyped `.js`.
4. **Zod for external-data validation.** Route bodies, AI tool inputs and stored designs all
   get Zod schemas; the 13 JSON fixtures remain the source of truth for expected behaviour.
5. **Visual parity does not require copying dead or insecure code.** `index.html` is `REJECT`
   while `styles.css` is `REFERENCE_ONLY` — the identity is reproduced, not pasted.
6. **A public Supabase anon key is not a secret, but hardcoded dead integration code is still
   rejected.** No hardcoded project URL or key travels to the clean repository.
7. **Good tests earn reuse.** The AI subsystem's 8 test files are why it is the largest
   `REUSE_AS_IS` block.
8. **Obsolete-architecture dependants are rewritten or referenced only.** Everything that
   exists solely to serve the `framework: null` static deployment is rejected.

---

## 3. Recommended extraction list

### Recommended for direct migration (`REUSE_AS_IS`)
- `src/lib/wardrobe-model/kernel.js` + `ids.js` + `kernel.test.js`
- `src/lib/wardrobe-model/buildWardrobeGeometry.js` + its test
- `src/lib/ai-provider/**` (all 20 files, including every `*.test.js`)
- `src/lib/wardrobe-agent/**`
- `src/lib/wardrobe-tools/**`
- `src/lib/ai-provider/errors.js` redaction + `errors.test.js` + `apiChatSecurity.test.js`
- `src/components/builder/LocalEnvironment.jsx`, `SceneEnhancementBoundary.jsx`
- `OrbitControls` configuration values from `builder/page.jsx:87`
- `tests/fixtures/*.json` (13 validator fixtures) and `tests/wardrobe-ai/fixtures/**`

### Recommended for controlled rewrite (`MIGRATE_AND_REWRITE`)
- Canonical `FurnitureDesign` contract (from `wardrobe-model/schema.js`, plus versioning,
  revision IDs and explicit/defaulted/inferred metadata)
- Validator, re-expressed in Zod, fixtures preserved
- `/builder` page + `FurnitureModel` data path (single store, single geometry path)
- `StructurePanel` / `AppearancePanel` (UX kept, bindings and types new)
- Single Zustand store
- Material catalogue, extracted from `knowledgeBase.js`
- Door, drawer and LED systems — geometry ported, **animation written new**
- `/api/wardrobe/chat` with Zod + rate limiting
- `r3f-builder.spec.js`, extended from 7 to the full 20 required assertions
- `docs/LEGACY_BUILDER_PARITY_GATE.md`
- Local-storage persistence — **new code, nothing to migrate** `[KNOWN_GAP]`
- `/api/health` — **new code, nothing to migrate** `[KNOWN_GAP]`

### Reference only
- `app.js`, `styles.css` (UX + visual identity, incl. door/drawer animation behaviour)
- `tests/browser/site.spec.js` (behavioural specification)
- `src/lib/buildGeometry.js`, `configSchema.js`, `furnitureConfig.js` (bounds and defaults)
- `src/lib/fsl/**`, `configurator-adapter/adapter.js` (post-v0.1)
- `api/production.py`, `production-engine/` (`FACTORY_QUALIFICATION_REQUIRED`)
- Auth pattern in `api/production.py:544-556`
- `src/app/api/sales-agent`, `/api/v1/furniture/generate`, `/api/whatsapp/webhook`

### Reject completely
- `index.html`, `index_3.html`, `FurniAI/**`, `base_builder.txt`, `debug.log`, `test-results/`
- `vendor-three-r128.min.js`, `vendor-supabase.min.js`, `legacy-builder-adapter.js`
- `api/chat.js`, `api/constructionValidator.js`, `api/wardrobe/chat.js`
- `supabase/` vendored client wiring and every hardcoded project URL / anon key
- `.git/`, `.vercel/`, `.vercel.bak/`, `.env.local`, `.next/`, `node_modules/`, `__pycache__/`
- The existing `vercel.json` and all old project linkage
