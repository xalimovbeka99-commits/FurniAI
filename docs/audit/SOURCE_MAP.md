# SOURCE_MAP — where every FurniAI capability actually lives

Audit date: 2026-08-30. Companion to `BASELINE.md`.
Tags: `[VERIFIED]` `[INFERRED]` `[UNVERIFIED]` `[BLOCKED]` `[KNOWN_GAP]` `[RISK]`

Line counts are from `wc -l` on the working tree. `[VERIFIED]`

---

## 1. Capability inventory

| Capability | Main files / directories | Runtime consumer | Tests | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Landing page | `src/app/page.jsx` (444) | Next App Router `/` | none direct `[KNOWN_GAP]` | Live | Client component; hero R3F canvas + gallery. Ships prohibited CNC/factory copy `[RISK]` |
| Navigation | `src/app/page.jsx` (`next/link` → `/builder?design=…`), `src/app/builder/page.jsx` (`useSearchParams`) | `/`, `/builder` | legacy-only in `site.spec.js` | Live | 7 gallery links verified in production `[VERIFIED]` |
| Next.js builder (shell) | `src/app/builder/page.jsx` (114) | `/builder` | `tests/browser/r3f-builder.spec.js` (7) | Live | `Canvas`, `OrbitControls`, `Grid`, Suspense, panels |
| Builder panels | `src/components/builder/StructurePanel.jsx` (138), `AppearancePanel.jsx` (123) | `/builder` | none direct `[KNOWN_GAP]` | Live | Sections, doors/drawers/shelves, hinge side; material, handle, door type, LED, plinth |
| Legacy static builder | `index.html` (2483, 5 inline `<script>`), `app.js` (544), `styles.css` (429), `legacy-builder-adapter.js` (6 KB), `vendor-three-r128.min.js` (603 KB), `vendor-supabase.min.js` (212 KB), `index_3.html` (65 KB) | **none — no longer served** `[VERIFIED]` | `tests/browser/site.spec.js` (16) | Dead in production, alive in repo | Richest UX reference; holds the only door/drawer animation |
| 3D scene | `src/components/builder/FurnitureModel.jsx` (88), `LocalEnvironment.jsx` (46), `SceneEnhancementBoundary.jsx` (33) | `/builder`, `/` | `r3f-builder.spec.js` | Live | Local environment (no remote HDR) + error boundary so effects can't take down the model |
| Camera / orbit controls | `@react-three/drei` `OrbitControls` — `builder/page.jsx:87` (`minDistance 1.2`, `maxDistance 9`), `page.jsx:193` (hero, zoom disabled) | `/builder`, `/` | `r3f-builder.spec.js` orbit + zoom tests | Live | `[VERIFIED]` |
| **Geometry generation (A)** | `src/lib/buildGeometry.js` + `configSchema.js` + `furnitureConfig.js` | `FurnitureModel.jsx`, `designs.js`, `configurator-adapter`, `production.js`, `furniture-knowledge/*` | `buildGeometry.test.js`, `configSchema.test.js`, `furnitureConfig.test.js`, `frozenSurfaces.test.js` | Live | The path the visible builder renders through `[VERIFIED]` |
| **Geometry generation (B)** | `src/lib/wardrobe-model/buildWardrobeGeometry.js` (115) | `FurnitureModel.jsx`, `runWardrobeAgent.js`, `systemPrompt.js` | `buildWardrobeGeometry.test.js` (86) | Live | The path the AI agent reasons over `[VERIFIED]` `[RISK]` see §3 |
| Wardrobe canonical model | `src/lib/wardrobe-model/kernel.js` (361), `ids.js` (52) | agent, tools, geometry B | `kernel.test.js` (294) | Strong | Stable component IDs; best-tested domain code in the repo |
| Schema | `src/lib/wardrobe-model/schema.js` (124) **and** `src/lib/configSchema.js` **and** `src/lib/fsl/` | both geometry paths | `validator.test.js`, `configSchema.test.js`, `fsl/validator.test.js` | Duplicated `[RISK]` | Three schema families, hand-written, **no Zod** `[VERIFIED]` |
| Validation | `src/lib/wardrobe-model/validator.js` (94), `src/lib/fsl/validator.js`, `tests/validator.test.js` | routes, agent, adapter | validator suites — 21 pass / 3 todo | Working | `[VERIFIED]` |
| Material system | `src/lib/knowledgeBase.js` (142) `MATERIALS`; consumed in `AppearancePanel.jsx`, `FurnitureModel.jsx` | `/builder` | `knowledgeBase.test.js` | Live | 10+ finishes verified live `[VERIFIED]` |
| Door system | `buildGeometry.js`, `buildWardrobeGeometry.js`, `StructurePanel.jsx`, `AppearancePanel.jsx`, `ids.js` | `/builder` | geometry suites | Live (static) | Count, hinge side, door type configurable; **no open/close animation** `[KNOWN_GAP]` |
| Drawer system | same as above | `/builder` | geometry suites | Live (static) | Drawer rows configurable; **no animation** `[KNOWN_GAP]` |
| Shelf / section config | `StructurePanel.jsx`, both geometry modules, `kernel.js` | `/builder` | `kernel.test.js`, geometry suites | Live | Add/remove sections, per-section mode + counts `[VERIFIED]` |
| LED system | `AppearancePanel.jsx`, `FurnitureModel.jsx`, `buildWardrobeGeometry.js`, `SceneEnhancementBoundary.jsx` | `/builder` | none direct `[KNOWN_GAP]` | Live | On/off control present in production `[VERIFIED]` |
| State management | `src/store/furnitureStore.js` (76), `src/store/wardrobeAIStore.js` (68) — Zustand 4.5.7 | `/builder`, panels, `FurnitureModel` | via component tests only `[KNOWN_GAP]` | Live | Two stores; `FurnitureModel` reads both `[RISK]` |
| **Save / load / persistence** | **none** | — | — | ❌ **NOT IMPLEMENTED** | Zero `localStorage` references in `src`; empty storage in production `[VERIFIED]` `[KNOWN_GAP]` |
| AI chat UI | `src/components/builder/WardrobeAIPanel.jsx` (102) | `/builder` ("Ask AI") | none direct `[KNOWN_GAP]` | Live | |
| AI API route | `src/app/api/wardrobe/chat/route.js` (100) | `/api/wardrobe/chat` | `route.test.js`, `apiChatSecurity.test.js` | Live | JSON parse guard → `validateBody` → agent; typed error envelope |
| Provider selection | `src/lib/ai-provider/providerRouter.js`, `chatRouter.js`, `extractionRouter.js`, `index.js` | AI routes | `providerRouter.test.js`, `chatRouter.test.js`, `extractionRouter.test.js` | Strong | Order from `AI_PROVIDER_ORDER` |
| Provider failover | `providerRouter.js` + `errors.js` `isRetriableProviderFailure()` | AI routes | `providerRouter.test.js`, `tests/wardrobe-ai/simulatedFailover.test.js` | Strong | Fails over on availability faults only, **never** on deterministic tool/schema errors `[VERIFIED]` |
| Agent layer | `src/lib/wardrobe-agent/runWardrobeAgent.js`, `systemPrompt.js`, `fakeWardrobeAgentProvider.js` | `/api/wardrobe/chat` | `runWardrobeAgent.test.js`, `tests/wardrobe-ai/*` | Strong | Fake provider enables deterministic tests |
| Tool layer | `src/lib/wardrobe-tools/tools.js`, `toAnthropicTools.js` | agent | `tools.test.js`, `tests/wardrobe-ai/fixtures/tool-contracts.json` | Strong | Tool-based output only; LLM never emits mesh coordinates `[VERIFIED]` |
| Secret redaction | `src/lib/ai-provider/errors.js` → `redactErrorForLogging()`, `classifySdkError()`, `toFslProviderError()` | every AI route's catch block | `errors.test.js`, `providerRouter.test.js`, `apiChatSecurity.test.js`, route tests | Strong | Tests assert `sk-ant-…` never reaches logs or responses `[VERIFIED]` |
| Supabase integration | `api/production.py:36-43` (URL + anon key with **hardcoded defaults**), `index.html:2224-2225` (hardcoded inline), `vendor-supabase.min.js`, `supabase/` dir | `/api/production`; legacy page (dead) | none `[KNOWN_GAP]` | Partly dead | See `SECURITY.md` `[RISK]` |
| Authentication | `api/production.py:544-556` — Bearer token → `POST {SUPABASE_URL}/auth/v1/user` | `/api/production` | none `[KNOWN_GAP]` | Server-side only | No auth anywhere in the Next app `[VERIFIED]` |
| Production / CNC engine | `production-engine/`, `api/production.py` (674), `src/lib/production.js`, `src/lib/wardrobe-production-verification/` | `/api/production` (deployed) | `production.test.js`, `tests/wardrobe-production/fixtures/*` | Quarantined-ish `[RISK]` | Outside the Next bundle but **publicly reachable** |
| PDF / spec export | none found | — | — | ❌ NOT IMPLEMENTED `[KNOWN_GAP]` | |
| WhatsApp | `src/app/api/whatsapp/webhook/route.js` (63), `src/lib/whatsapp.js`; "Order via WhatsApp" CTA in builder | `/api/whatsapp/webhook` | none `[KNOWN_GAP]` | Live | |
| Browser tests | `tests/browser/site.spec.js` (16 tests, **legacy target**), `tests/browser/r3f-builder.spec.js` (7 tests, Next target), `global-teardown.js`, `playwright.config.js`, `playwright.r3f.config.js` | CI / local | — | Split `[RISK]` | 16 of 23 browser tests now exercise a runtime that is no longer deployed |
| Unit tests | 41 `*.test.js` files under `src/` + `tests/wardrobe-ai/*` | Vitest | — | `[BLOCKED]` this env | Cannot be executed here; see `BASELINE.md` §5 |
| Validator tests | `tests/validator.test.js` + `tests/fixtures/*.json` (13 fixtures) | `node --test` | 21 pass / 0 fail / 3 todo | ✅ PASS `[VERIFIED]` | |
| Parity-gate docs | `docs/LEGACY_BUILDER_PARITY_GATE.md` | humans | — | Exists | Frozen legacy ref commit `9b21e8b6…`, ref deployment `dpl_WmF7vQVWso7zpSfRHMk5RNirfkJj` `[VERIFIED]` |
| Vercel configuration | `vercel.json` (framework `nextjs`, `buildCommand npm run build`, `cleanUrls`, `functions` block for `api/production.py`), `.vercel/project.json` (untracked) | Vercel | — | Live | `outputDirectory` deliberately unset — see `LEGACY_REMOTES.md` |
| Environment variables | `.env.example` (tracked template), `.env.local` (untracked, **not read**), `.vercel.bak/.env.preview.local` (untracked) | routes + Python | `apiChatSecurity.test.js` | See `SECURITY.md` | |
| Legacy / dead code | `FurniAI/` (deleted in working tree), `index_3.html`, `api/chat.js`, `api/constructionValidator.js`, `api/wardrobe/chat.js`, `base_builder.txt`, `debug.log`, `test-results/` | none | — | Dead `[RISK]` | |

---

## 2. Dependency chains

**Manual builder (what production actually renders):**

```
/builder page.jsx
  → StructurePanel / AppearancePanel  (UI)
  → useFurnitureStore (Zustand)       (FurnitureConfig shape)
  → FurnitureModel.jsx
      → validateConfig()  [src/lib/configSchema.js]
      → buildGeometry()   [src/lib/buildGeometry.js]
      → MATERIALS         [src/lib/knowledgeBase.js]
      → R3F <Canvas> + OrbitControls + Grid + LocalEnvironment
```

**AI path (canonical wardrobe model):**

```
WardrobeAIPanel → POST /api/wardrobe/chat
  → validateBody()
  → createChatProviderRouter()        [ai-provider/chatRouter.js]
      → providerRouter  (AI_PROVIDER_ORDER, retry only on retriable faults)
          → anthropicProvider | openaiProvider | fakeProvider
  → runWardrobeAgent()                [wardrobe-agent]
      → wardrobe-tools/tools.js (8 tools, tool-use only)
      → wardrobe-model/kernel.js  → validator.js  → buildWardrobeGeometry.js
  → new revision + stable component IDs
  → useWardrobeAIStore (Zustand) → FurnitureModel.jsx
```

**FSL path:**

```
/fsl-lab | /api/v1/furniture/generate
  → src/lib/fsl/  (FSL document + validator)
  → src/lib/configurator-adapter/adapter.js   ← lossy, documented approximation
      → validateConfig() → buildGeometry()    (back into path A)
```

**Production / CNC path (quarantine boundary):**

```
client → POST /api/production  (Vercel Python function)
  → Authorization: Bearer <token> → Supabase /auth/v1/user
  → production-engine/furniai_engine/**   [FACTORY_QUALIFICATION_REQUIRED]
```

---

## 3. Duplicate implementations and competing sources of truth

`[RISK]` — these are the highest-value findings for the rebuild.

1. **Two geometry generators, both imported by the same component.**
   `src/components/builder/FurnitureModel.jsx:15-16` imports **both** `buildGeometry`
   (path A) and `buildWardrobeGeometry` (path B). Path A is driven by `FurnitureConfig`
   (bay/module oriented, `configSchema.js`); path B is driven by the canonical
   `WardrobeModel` (`wardrobe-model/kernel.js`). `[VERIFIED]`
   This is exactly the "two independent business schemas" the master plan prohibits.

2. **`configurator-adapter/adapter.js` is a documented *lossy* bridge, not a lossless adapter.**
   Its own header states the FSL → FurnitureConfig translation is "a deliberate, documented
   approximation": each door becomes its own module, drawers collapse into one bank capped at
   6 rows, shelves are redistributed. `[VERIFIED]` No round-trip test exists. `[KNOWN_GAP]`

3. **Two Zustand stores feeding one renderer.** `furnitureStore` (manual) and
   `wardrobeAIStore` (AI) are both read by `FurnitureModel.jsx`; precedence between them is
   implicit in component code rather than in a single canonical revision. `[VERIFIED]` `[RISK]`

4. **Two API surfaces.** `src/app/api/**` (App Router) and top-level `api/**` (Vercel
   functions). `api/wardrobe/chat.js` re-exports the App Router handler; `api/chat.js` and
   `api/constructionValidator.js` are independent older implementations. Vercel builds
   top-level `api/` regardless of framework, so all of them ship. `[VERIFIED]` `[RISK]`

5. **Two builders.** The legacy static builder (`index.html`/`app.js`) still holds behaviours
   the Next builder lacks — most importantly door and drawer animation. It is in the repo but
   no longer deployed, so the parity gate in `docs/LEGACY_BUILDER_PARITY_GATE.md` is currently
   **unsatisfied and unenforced**. `[VERIFIED]` `[RISK]`

6. **Three schema families:** `wardrobe-model/schema.js`, `configSchema.js`, `fsl/`.
   All hand-written; none use Zod. `[VERIFIED]`

7. **Two static-site snapshots:** root (`index.html` 2,483 L) and `FurniAI/`
   (`index.html` 198 L, older). The latter is deleted in the working tree. `[VERIFIED]`
