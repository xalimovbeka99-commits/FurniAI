# PHASE 1 EXECUTION PLAN — FurniAI clean rebuild

Status: **PLAN ONLY. NOTHING CREATED, INSTALLED, LINKED OR DEPLOYED.**
Date: 2026-08-30. Authorized by the audit-acceptance decision of the same date.
Source repository classification: `LEGACY_SOURCE — READ-ONLY COMPONENT REFERENCE`

Every version below was resolved against the public npm registry on 2026-08-30 `[VERIFIED]`,
or carried forward from a build Vercel has already completed successfully `[VERIFIED]`.

---

## 1. Proposed GitHub repository name

**`furniai-clean`** — primary recommendation.

Matches the master plan's own suggestion, reads unambiguously as "not `furnia`", and leaves the
name `furniai` free for a future rename once the legacy project is retired. Alternatives if you
prefer: `furniai-app`, `furniai-v1`. **Do not** reuse `furnia`.
`[DECISION_REQUIRED]` Owner confirms the name and that it does not already exist under
`xalimovbeka99-commits`.

## 2. Proposed Vercel project name

**`furniai-clean`** — deliberately identical to the repository name so the dashboard, the URL
and the repo never drift apart. Production URL will be `https://furniai-clean.vercel.app`.

Must be a **new** project. It must not reuse `prj_Ynh5dWulo2ndc9peCBmIVd9MQ0H2`, and no custom
domain gets attached in Phase 1.

## 3. Exact clean local-directory name

**`C:\dev\furniai-clean`**

`[RISK]` **Not** under `C:\Users\xalim\OneDrive\Documents\`. The legacy folder is OneDrive-synced,
and that is a measured problem, not a preference: OneDrive continuously syncs `node_modules` and
`.next`, which is the most likely cause of the local build never completing during the audit, and
it is how a Windows-installed `node_modules` ends up mounted where a Linux toolchain cannot use it.
Keep the working repository outside OneDrive; OneDrive is for documents, not build trees.

## 4. Initial directory structure

```
furniai-clean/
├── .gitattributes                 ← FIRST commit, before any source
├── .gitignore
├── .prettierrc.json
├── .prettierignore
├── eslint.config.mjs
├── next.config.mjs
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
├── .env.example                   ← names only, no real defaults
├── README.md
├── docs/
│   ├── audit/                     ← this package, copied over as the migration record
│   ├── adr/
│   │   ├── ADR-001-canonical-furniture-design-contract.md
│   │   └── ADR-002-single-store-single-geometry-path.md
│   ├── PARITY_GATE.md             ← migrated from LEGACY_BUILDER_PARITY_GATE.md
│   └── EVIDENCE/                  ← one dated file per wave (see §9)
├── public/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx               ← /
│   │   ├── globals.css
│   │   ├── builder/page.tsx       ← /builder
│   │   └── api/
│   │       ├── health/route.ts            ← /api/health
│   │       └── wardrobe/chat/route.ts     ← /api/wardrobe/chat
│   ├── components/
│   │   └── builder/
│   │       ├── BuilderCanvas.tsx
│   │       ├── WardrobeScene.tsx
│   │       ├── LocalEnvironment.tsx
│   │       ├── SceneEnhancementBoundary.tsx
│   │       ├── RendererFailurePanel.tsx    ← controlled renderer failure UI
│   │       ├── StructurePanel.tsx
│   │       └── AppearancePanel.tsx
│   ├── domain/
│   │   ├── contract.ts            ← the ONE canonical FurnitureDesign (Zod + inferred types)
│   │   ├── kernel.ts              ← migrated wardrobe kernel
│   │   ├── ids.ts
│   │   ├── validator.ts
│   │   ├── geometry.ts            ← the ONE deterministic scene-part generator
│   │   └── materials.ts
│   ├── ai/
│   │   ├── provider/              ← migrated ai-provider layer
│   │   ├── agent/                 ← migrated wardrobe-agent
│   │   ├── tools/                 ← migrated wardrobe-tools
│   │   └── errors.ts              ← migrated secret redaction
│   ├── store/
│   │   └── designStore.ts         ← the ONE Zustand store
│   ├── persistence/
│   │   └── localDesigns.ts        ← canonical revision persistence + migration
│   └── lib/
│       └── rateLimit.ts
└── tests/
    ├── fixtures/                  ← the 13 migrated validator fixtures
    ├── unit/
    └── browser/
        └── builder.spec.ts
```

**Not present, by decision:** any `index.html`/`app.js`/`styles.css` at root, any `vendor-*.min.js`,
any top-level `api/` directory, any `production-engine/`, any Supabase wiring, any `dist`.

## 5. Initial dependency list — exact versions

Two pinning rules. **Proven-in-production** packages carry forward the exact versions Vercel has
already built successfully for this codebase. **New toolchain** packages, which have no legacy
precedent, take current stable. All peer ranges below were checked and are satisfied `[VERIFIED]`.

### dependencies

| Package | Version | Basis |
| --- | --- | --- |
| `next` | `16.3.0` | proven `[VERIFIED]` |
| `react` | `19.2.8` | proven; satisfies r3f peer `>=19 <19.3` `[VERIFIED]` |
| `react-dom` | `19.2.8` | proven `[VERIFIED]` |
| `three` | `0.166.1` | proven; satisfies drei peer `>=0.159` `[VERIFIED]` |
| `@react-three/fiber` | `9.7.0` | proven `[VERIFIED]` |
| `@react-three/drei` | `10.7.8` | proven; peer `@react-three/fiber ^9.0.0` ✓ `[VERIFIED]` |
| `zustand` | `4.5.7` | proven. `[DECISION_REQUIRED]` current stable is `5.0.15`; v5 is a small but breaking API change. Recommendation: **take 5.0.15** — the store is being rewritten from scratch anyway, so the migration cost is zero and starting a clean repo one major behind is avoidable debt. |
| `zod` | `3.25.76` | already resolved in the legacy tree `[VERIFIED]`. `[DECISION_REQUIRED]` current stable is `4.5.4`. Recommendation: **take 4.5.4** — no legacy Zod code exists to migrate, so there is nothing to break. |
| `tailwindcss` | `3.4.19` | proven `[VERIFIED]` |

### devDependencies

| Package | Version | Basis |
| --- | --- | --- |
| `typescript` | `6.0.3` | latest 6.x `[VERIFIED]`. `[DECISION_REQUIRED]` 7.0.2 exists; recommendation is to hold at 6.x for the first commit and raise deliberately once the codebase compiles clean. `eslint-config-next@16.3.0` peers `typescript >=3.3.1`, so either satisfies it. |
| `@types/react` | `19.2.18` | current `[VERIFIED]` |
| `@types/react-dom` | `19.2.5` | current `[VERIFIED]` |
| `@types/three` | `0.166.0` | **must track `three`**, not latest (0.185.4 would mistype the API) `[VERIFIED]` |
| `@types/node` | `22.20.1` | matches the Node 22 runtime, not latest 26.x `[VERIFIED]` |
| `eslint` | `9.39.5` | proven `[VERIFIED]` |
| `eslint-config-next` | `16.3.0` | proven; peers `eslint >=9.0.0` ✓ `[VERIFIED]` |
| `eslint-config-prettier` | `10.1.8` | current `[VERIFIED]` |
| `prettier` | `3.9.6` | current `[VERIFIED]` |
| `vitest` | `2.1.9` | proven `[VERIFIED]` |
| `@vitest/coverage-v8` | `2.1.9` | must match vitest exactly `[VERIFIED]` |
| `@playwright/test` | `1.62.1` | proven; satisfies `next@16.3.0` optional peer `^1.51.1` ✓ `[VERIFIED]` |
| `postcss` | `8.5.26` | current 8.x `[VERIFIED]` |
| `autoprefixer` | `10.5.4` | current 10.x `[VERIFIED]` |

`engines`: `{ "node": ">=22.0.0 <23" }` — the legacy repo has no `engines` field, which is a
`[KNOWN_GAP]` this fixes. Vercel is already on 22.x.

Deliberately **omitted** from the first commit: `jsdom`, `@testing-library/react`,
`@vitejs/plugin-react`. Wave 0–4 tests are pure Node-environment unit tests; component-test
tooling is added in the wave that first needs it, pinned then.

## 6. First-commit file list

Commit 1 is `chore: line-ending policy` and contains **exactly one file** — `.gitattributes` —
so the policy predates every byte of source and no renormalization commit can ever be needed.

```
.gitattributes
```

Commit 2 is `chore: project foundation`:

```
.gitignore
.env.example
.prettierrc.json
.prettierignore
README.md
package.json
tsconfig.json
next.config.mjs
postcss.config.mjs
tailwind.config.ts
eslint.config.mjs
vitest.config.ts
playwright.config.ts
src/app/layout.tsx
src/app/page.tsx
src/app/globals.css
src/app/api/health/route.ts
public/.gitkeep
docs/audit/**            (this package, copied verbatim as the migration record)
docs/adr/ADR-001-canonical-furniture-design-contract.md
docs/PARITY_GATE.md
```

`package-lock.json` is generated by the first `npm install` and committed with commit 2.
No lockfile is carried over from the legacy repository. `[DECISION_REQUIRED]` resolved: regenerate.

### Approved `.gitattributes`

```gitattributes
* text=auto eol=lf

*.bat  text eol=crlf
*.cmd  text eol=crlf
*.ps1  text eol=crlf

*.png  binary
*.jpg  binary
*.jpeg binary
*.webp binary
*.ico  binary
*.pdf  binary
*.woff binary
*.woff2 binary
*.hdr  binary
*.glb  binary
*.gltf binary
```

## 7. Migration order

Each wave is one reviewable commit or a short series, and each ends with its gates green.
**Migration means reading the legacy file and re-authoring it in TypeScript — never copying a
directory tree.** Nothing from `.git/`, `.vercel/`, `.vercel.bak/`, `node_modules/` or any
environment file crosses over, per `LEGACY_REMOTES.md` §8.

| Wave | Content | Legacy source | Why here |
| --- | --- | --- | --- |
| **0** | Foundation, `/api/health`, landing shell | new | Deployable skeleton; `/api/health` exists from day one rather than as an afterthought |
| **1** | Secret redaction + typed provider errors | `src/lib/ai-provider/errors.js` + `errors.test.js` | **First code migrated.** Redaction must exist before any provider code can leak anything |
| **2** | Canonical `FurnitureDesign` contract (Zod), validator, 13 fixtures | `wardrobe-model/schema.js`, `validator.js`, `tests/fixtures/*.json` | Everything downstream depends on the one contract. Adds what the legacy model lacks: contract version, design + revision IDs, explicit/defaulted/inferred metadata, integer-millimetre enforcement |
| **3** | Wardrobe kernel + stable IDs | `wardrobe-model/kernel.js`, `ids.js`, `kernel.test.js` | Highest-value asset; `REUSE_AS_IS` logic, newly typed |
| **4** | Deterministic geometry generator | `wardrobe-model/buildWardrobeGeometry.js` | The single scene-part generator. `buildGeometry.js` is consulted as a parity reference only and never ported |
| **5** | Single Zustand store; `/builder` shell; `LocalEnvironment`; `SceneEnhancementBoundary`; `RendererFailurePanel`; `OrbitControls` config | `store/*`, `builder/page.jsx`, two scene components | First visible wardrobe. `OrbitControls` values `minDistance 1.2` / `maxDistance 9` carry over verbatim |
| **6** | Structure + Appearance panels; material catalogue | `StructurePanel.jsx`, `AppearancePanel.jsx`, `knowledgeBase.js` MATERIALS | Proven UX, rebound to the canonical revision |
| **7** | Canonical revision persistence | **none — new code** | Versioned canonical designs in local storage, with load-time migration, reset and corrupted-state recovery. Never renderer state |
| **8** | AI provider + failover + tools + agent + `/api/wardrobe/chat` + Zod bodies + **rate limiting** | `ai-provider/**`, `wardrobe-tools/**`, `wardrobe-agent/**`, chat route | Largest `REUSE_AS_IS` block. Rate limiting ships in the same commit as the first paid endpoint — the legacy mistake is not repeated |
| **9** | Door + drawer open/close animation | **new code**; legacy `app.js` is behavioural reference only | The one capability legacy has that the Next builder never had |
| **10** | Landing page, gallery, hero scene | `src/app/page.jsx`, `styles.css` for identity | Copy is written fresh with **no** CNC, factory, tolerance, pricing, DXF, nesting or quotation claims |

## 8. Per-component test requirements

No wave is complete until its own row is green.

| Wave | Required tests |
| --- | --- |
| 0 | `/api/health` returns 200 with a stable JSON shape; lint, typecheck, build, Prettier check all pass |
| 1 | A key-shaped string never appears in a log line or a response body, including when nested in `error.cause`; every provider error maps to a typed code; retriable vs deterministic classification is exhaustive |
| 2 | All 13 fixtures round-trip; schema bounds reject out-of-range and negative values; **no NaN and no negative dimension can ever be produced**; section widths close to the total width; contract version and revision ID are always present. The 3 legacy `[knownGap]` todos (shelf-span, door-weight) are carried forward **as visible todos**, not silently dropped |
| 3 | Component IDs are stable across edits; the same input yields the same kernel output |
| 4 | Geometry is deterministic for a given revision; no NaN/negative dimensions reach the renderer; wardrobe parity with the legacy generator for the shapes production currently shows |
| 5 | Playwright: `/builder` loads a **visible non-blank** wardrobe with no user input; canvas has non-zero dimensions; orbit and zoom change the frame; hard refresh still renders; blocked HDR and blocked cross-origin do not break the builder; **a forced `WebGLRenderer` construction failure shows the failure panel, not a blank screen**; `webglcontextlost` is handled; repeated landing↔builder navigation does not multiply loops; no uncaught console or page errors |
| 6 | Width/height/depth changes alter the rendered model; section, shelf and drawer changes alter scene evidence; material and LED changes alter pixels or asserted state; mobile viewport remains usable |
| 7 | Save then reload restores the **same canonical revision**; a stored older version migrates on load; corrupted stored state triggers recovery rather than a crash |
| 8 | Tool validation rejects malformed AI edits; failover occurs on availability faults and **never** on a deterministic tool or schema error; secret-safe error responses; rate limiter returns 429 past the threshold; the manual builder stays fully operational while every provider is unavailable. Fake-provider passes are **not** accepted as evidence of live AI understanding — a separate opt-in live evaluation is kept |
| 9 | Doors animate open and closed; drawers animate open and closed — asserted on pixels or screenshots plus deterministic state, never on scene-object counts alone |
| 10 | Landing page loads; catalog is visible; builder opens through UI navigation as well as direct `/builder`; an automated copy check asserts the absence of the words price, quote, CNC, DXF, nesting and factory-ready |
| Final | The production deployment passes the same browser smoke test as local |

## 9. Rollback and evidence procedure

**Evidence.** Every wave writes `docs/EVIDENCE/WAVE-<n>-<date>.md` recording: the exact commands
run, exit codes, pass/fail counts, the commit SHA, screenshots or pixel assertions where the claim
is visual, and any `[BLOCKED]` item with its cause. The words "works", "deployed" and "verified"
appear only next to evidence. A red gate is **never** turned green by deleting or weakening a test.

**Rollback.**

- Every wave is its own commit or short series on a branch `wave/<n>-<slug>`; `main` only ever
  receives a wave whose gates are green.
- **No force-push, ever.** Rollback is `git revert`, which preserves the audit trail.
- Vercel keeps the last successful deployment on the production domain, so a failed build cannot
  take the site down. The previous good deployment can also be promoted from the dashboard.
- Record the deployed SHA for every production deployment in the wave's evidence file.
- **Environment blocker, known in advance:** `npm ci` must run on the machine that will run the
  tests. Do not install on Windows and execute on Linux, or on any mounted copy of the folder —
  that is exactly what blocked the unit and build gates during the audit `[VERIFIED]`.

## 10. Clean environment-variable inventory — names only

No values appear here, and none are carried over from `.env.local` or `.vercel.bak/`.

**Required for Wave 8 and later:**

| Name | Scope | Note |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | server | at least one provider key required for AI |
| `OPENAI_API_KEY` | server | |
| `ANTHROPIC_MODEL` | server | optional override |
| `OPENAI_MODEL` | server | optional override |
| `AI_PROVIDER_ORDER` | server | e.g. anthropic first, then openai |

**Optional:**

| Name | Scope | Note |
| --- | --- | --- |
| `FURNIAI_FOUNDER_PREVIEW` | server | exposes a safe `{provider, fallback}` field. Leave **unset** in production |

**Deliberately absent in Phase 1:** every `SUPABASE_*` name (auth deferred until after the local
slice is stable, and until RLS is confirmed), every `WHATSAPP_*` name, and
`FURNIAI_ALLOWED_ORIGINS`. **No `NEXT_PUBLIC_*` variable exists at all** — the legacy repo has
none either, and that property is worth preserving deliberately.

`.env.example` ships with every name present and **every value blank**. No default may point at a
real project, which is the specific defect found in `api/production.py` and in the legacy
`.env.example`'s stale `furnia.vercel.app` origin default.

## 11. Required owner actions

These are yours; I cannot and will not do them.

| # | Action | Blocks |
| --- | --- | --- |
| 1 | Confirm the repository name `furniai-clean` and the Vercel project name `furniai-clean` | everything |
| 2 | Confirm the local directory `C:\dev\furniai-clean`, outside OneDrive | Wave 0 |
| 3 | Confirm the authenticated GitHub owner (`xalimovbeka99-commits`) and that `furniai-clean` does not already exist | repo creation |
| 4 | Confirm the Vercel team (`xalimovbeka99-commits-projects`) that will hold the new project | project creation |
| 5 | Decide `zustand` 4.5.7 vs 5.0.15, `zod` 3.25.76 vs 4.5.4, `typescript` 6.0.3 vs 7.0.2 (§5 recommends 5.0.15 / 4.5.4 / 6.0.3) | `package.json` |
| 6 | **Create the GitHub repository yourself**, or approve my doing so — repository creation is an account action | Wave 0 push |
| 7 | **Create and link the Vercel project yourself**, or approve my doing so; use framework detection and repository root, and set **no** Output Directory override | first deploy |
| 8 | Add environment variables in the Vercel dashboard — I will never enter a credential | Wave 8 |
| 9 | Confirm Supabase Row Level Security status **before** any auth work is scheduled | post-Phase 1 |
| 10 | Approve or decline the containment steps in `CONTAINMENT_PROPOSAL.md` — independent of this plan, and more time-sensitive | legacy exposure |
| 11 | Confirm the legacy repository and Vercel project stay running and untouched until the rebuild is verified | Phase D disposition |

## 12. Definition of done for Phase 1

Phase 1 is complete only when **every** line below is true and evidenced.

**Repository and history**
1. `furniai-clean` exists as a new GitHub repository with **genuinely fresh history** — first commit is `.gitattributes`, no legacy commit is an ancestor
2. No `.git/`, `.vercel/`, `.vercel.bak/`, `node_modules/`, `.next/`, environment file or vendored bundle from the legacy repository exists in the new tree
3. A secret scan passes **before** the first push and again at Phase 1 close
4. `git status` is clean; no CRLF churn — `.gitattributes` was commit 1

**Stack**
5. Next.js 16 App Router, React 19, TypeScript, Zod, Zustand, Three.js, React Three Fiber, Drei, Vitest, Playwright, ESLint and Prettier are all present, at the pinned versions, and all in use — not merely installed

**Architecture**
6. Exactly **one** canonical `FurnitureDesign` contract, in TypeScript, validated by Zod, in integer millimetres, carrying contract version, design ID, revision ID and explicit/defaulted/inferred metadata
7. Exactly **one** Zustand store and exactly **one** geometry generator. No competing schema family, no second store, no second geometry path, no lossy adapter
8. The LLM proposes or edits the canonical design only; deterministic code generates every scene part

**Routes**
9. `/`, `/builder`, `/api/health` and `/api/wardrobe/chat` all exist and respond in production

**Behaviour**
10. `/builder` loads a visible wardrobe with no user input, on direct navigation and via the UI
11. Width, height, depth, sections, shelves, drawers, material, handle, door type, LED and plinth all change the rendered model
12. Doors and drawers animate open and closed
13. Orbit and zoom work; the layout is usable on a mobile viewport
14. Save and reload restore the same canonical revision; a corrupted store recovers
15. **Controlled renderer failure handling:** a forced renderer construction failure shows a visible failure panel, `webglcontextlost` is handled, no remote HDR dependency exists, no unpinned runtime CDN is used, and one owned render loop per canvas is cancelled and disposed on unmount
16. The manual builder remains fully operational when every AI provider is unavailable

**Security**
17. Rate limiting is present on every endpoint that invokes a paid provider
18. No provider key reaches the browser; no `NEXT_PUBLIC_*` variable exists; redaction tests pass
19. `.env.example` contains names only, with no default pointing at a real project

**Claims**
20. No pricing, quotation, CNC, DXF, nesting or factory-ready claim appears anywhere in the product, and an automated check enforces this

**Deployment and evidence**
21. A new Vercel project `furniai-clean` is linked **only** to the new repository, framework-detected, repository root, no Output Directory override
22. The exact SHA that passed local gates is deployed, and the production deployment passes the same browser smoke test as local
23. Repository URL, commit SHA, deployment URL, deployment ID and project name are all recorded
24. No custom domain is attached; the legacy repository, Vercel project and production URL are untouched
25. Every claim in the Phase 1 closing report carries `[VERIFIED]` evidence; anything else is tagged `[UNVERIFIED]`, `[BLOCKED]` or `[KNOWN_GAP]`
