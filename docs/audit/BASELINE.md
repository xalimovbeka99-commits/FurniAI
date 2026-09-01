# BASELINE — verified condition of the legacy FurniAI repository

Audit date: 2026-08-30 (Asia/Dubai)
Auditor: Senior Software Architect / Migration Auditor (automated session)
Scope: read-only inspection. No application source, test, config, dependency,
lockfile, environment file, Git remote or Vercel linkage was modified.

Evidence tags: `[VERIFIED]` `[INFERRED]` `[UNVERIFIED]` `[BLOCKED]` `[KNOWN_GAP]` `[RISK]` `[DECISION_REQUIRED]`

> **Framing.** This repository is the ORIGINAL FurniAI repository. It is *not*
> the clean rebuild described in the master plan. From this document forward it
> is treated as a **LEGACY SOURCE REPOSITORY FOR AUDIT AND COMPONENT EXTRACTION**.

---

## 1. Repository identity

| Item | Value | Evidence |
| --- | --- | --- |
| Working directory (audit host) | `/sessions/<session>/mnt/FUrniai new` | `[VERIFIED]` `pwd` |
| Working directory (owner's machine) | `C:\Users\xalim\OneDrive\Documents\FUrniai new` | `[VERIFIED]` session folder mount |
| Package name / version | `furni-ai` 0.1.0 | `[VERIFIED]` `package.json`, `package-lock.json` |
| GitHub owner / repository | `xalimovbeka99-commits` / `furnia` | `[VERIFIED]` `git remote -v` |
| Remote `origin` (fetch + push) | `https://github.com/xalimovbeka99-commits/furnia.git` | `[VERIFIED]` |
| Other remotes | none | `[VERIFIED]` |
| Current branch | `main` (tracking `origin/main`) | `[VERIFIED]` `git status -sb` |
| HEAD commit | `4f4f1cd85cfc9f57909479ec269d01ee47da2109` | `[VERIFIED]` `git rev-parse HEAD` |
| HEAD subject | `fix: set framework nextjs and buildCommand npm run build in vercel.json` | `[VERIFIED]` |
| HEAD author / date | Bekzod Khalimov, 2026-08-30 12:27:39 +0400 | `[VERIFIED]` |
| Commit count on `main` | 78 | `[VERIFIED]` `git rev-list --count HEAD` |
| Initial commit | `b88ac91063d04e74d03dd80a0108eea594dd512f` — 2026-06-18 01:35:10 +0400 — "Initial commit: Setup Next.js 14 project for FurniAI" | `[VERIFIED]` |
| Tags | 0 | `[VERIFIED]` `git tag` |

### Local branches (15)

`main` (current), `integration/wardrobe-M1-20260814` (worktree-checked-out), `integration/wardrobe-M1-20260815`,
`antigravity/M1-stability-20260816`, `claude/M1-webgl-stability-recovery-20260817`,
`claude/legacy-builder-adapter-20260813`, `claude/legacy-builder-ai-bridge-M1`,
`claude/provider-failover-20260812`, `codex/M1-webgl-stability-20260816`, `codex/furniai-auth-ux`,
`codex/furniai-gallery`, `codex/furniai-master-engineering-spec`, `codex/furniai-production-engine`,
`codex/furniai-wardrobe-compiler`, `codex/legacy-builder-parity-gate-20260813`. `[VERIFIED]` `git branch`

The branch names record at least three different authoring agents (`claude/`, `codex/`,
`antigravity/`) working the same milestones in parallel. `[INFERRED]` — relevant to the
duplicate-implementation findings in `SOURCE_MAP.md`.

### Recent history (HEAD → HEAD~4)

```
4f4f1cd fix: set framework nextjs and buildCommand npm run build in vercel.json
f34a53a fix: update vercel.json build command for Next.js
21306e1 deploy: update Vercel production settings and documentation
93c7687 fix: eliminate homepage's remote HDR dependency (F1)
af04890 fix: eliminate /builder's remote HDR dependency, close app.js TS1128
```
`[VERIFIED]` `git log --oneline -5`

### Working-tree status

| Measure | Count | Evidence |
| --- | --- | --- |
| `git status --porcelain` entries | 172 | `[VERIFIED]` |
| Staged changes | 0 | `[VERIFIED]` `git diff --cached` |
| Untracked files | 0 | `[VERIFIED]` |
| Files with **substantive** change (`git diff --numstat --ignore-cr-at-eol`) | **4** | `[VERIFIED]` |
| Files that are **line-ending churn only** | **168** | `[VERIFIED]` (172 − 4) |

The four substantive changes are all deletions:

```
0  43   FurniAI/README.md
0  369  FurniAI/app.js
0  198  FurniAI/index.html
0  229  FurniAI/styles.css
```

See §7 for the full line-ending investigation. **No genuine content edit is hidden
inside the churn** — with CR-at-EOL ignored, every other tracked file diffs to zero. `[VERIFIED]`

---

## 2. Vercel identity

No credential was read, printed or used. Values below are project identifiers only.

| Item | Value | Evidence |
| --- | --- | --- |
| Project name | `furniai` | `[VERIFIED]` `.vercel/project.json`, Vercel dashboard |
| Project ID | `prj_Ynh5dWulo2ndc9peCBmIVd9MQ0H2` | `[VERIFIED]` `.vercel/project.json` |
| Org / team ID | `team_dd65MomZZ9d1RAmMjVGtVvjJ` | `[VERIFIED]` `.vercel/project.json` |
| Team slug | `xalimovbeka99-commits-projects` | `[VERIFIED]` dashboard URL |
| Production URL | `https://furniai.vercel.app` | `[VERIFIED]` dashboard, live fetch |
| Connected Git repository | `xalimovbeka99-commits/furnia`, branch `main` | `[VERIFIED]` deployments list shows `main` + commit SHAs |
| Deployment for HEAD `4f4f1cd` | `myS5ZNUgx` — **Ready**, 1m 03s, Production, domain `furniai.vercel.app` assigned | `[VERIFIED]` dashboard |
| Earlier deployments of `4f4f1cd` / `f34a53a` | 4 × **Error** (`AfW8HD38a` and siblings) | `[VERIFIED]` dashboard |
| Is this the OLD project? | **Yes.** This is the pre-existing project, not a new one. | `[VERIFIED]` |
| `.vercel/` present on disk | Yes — `project.json`, `README.txt` (untracked, gitignored) | `[VERIFIED]` |
| `.vercel.bak/` present on disk | Yes — contains `.env.preview.local`, `index.html`, `node`, `repo.json` (untracked, gitignored) | `[VERIFIED]` `[RISK]` see `SECURITY.md` |

### Build settings at time of audit

Framework Preset `Next.js`; Build Command override **off**; Output Directory override **off**;
Install Command **not overridden**; Development Command **not overridden**; Root Directory empty;
Node.js 22.x; Deployment Checks `Lint` + `TypeCheck` configured for Preview and Production. `[VERIFIED]` dashboard

Prior to 2026-08-30 the project carried two dashboard overrides —
Build Command `mkdir -p dist && cp index.html styles.css app.js legacy-builder-adapter.js vendor-three-r128.min.js vendor-supabase.min.js dist/`
and Output Directory `dist` — which caused every Next.js build to fail with
`The Next.js output directory "dist" was not found at "/vercel/path0/dist"`. `[VERIFIED]` build log of `AfW8HD38a`

`[DECISION_REQUIRED]` This project must NOT be reused, renamed or deleted as part of
the clean rebuild. See `LEGACY_REMOTES.md`.

---

## 3. Runtime stack

Installed versions read from `node_modules/<pkg>/package.json`. `[VERIFIED]`

| Package | Declared (`package.json`) | Installed | Note |
| --- | --- | --- | --- |
| Node.js | *no `engines` field* `[KNOWN_GAP]` | v22.23.2 (audit host) | Vercel project set to 22.x |
| npm | — | 10.9.8 | `package-lock.json` lockfileVersion 3 |
| next | `16.3.0` | 16.3.0 | pinned exact |
| react | `19.2.8` | 19.2.8 | pinned exact |
| react-dom | `19.2.8` | 19.2.8 | pinned exact |
| three | `^0.166.0` | 0.166.1 | |
| @react-three/fiber | `9.7.0` | 9.7.0 | pinned exact |
| @react-three/drei | `10.7.8` | 10.7.8 | pinned exact |
| zustand | `^4.5.5` | 4.5.7 | |
| vitest | `^2.1.9` | 2.1.9 | |
| @playwright/test | `^1.62.1` | 1.62.1 | |
| eslint | `9.39.5` | 9.39.5 | |
| eslint-config-next | `16.3.0` | 16.3.0 | |
| tailwindcss | `^3.4.15` | 3.4.19 | |
| @anthropic-ai/sdk | `^0.28.0` | 0.28.0 | |
| openai | `^4.104.0` | 4.104.0 | |
| **typescript** | **not declared** `[KNOWN_GAP]` | 6.0.3 (transitive) | present but unused |
| **zod** | **not declared** `[KNOWN_GAP]` | 3.25.76 (transitive) | present but unused |
| **prettier** | **not declared** `[KNOWN_GAP]` | NOT INSTALLED | no config file either |
| **@supabase/supabase-js** | **not declared** | NOT INSTALLED | Supabase is reached over raw HTTP from Python, and via a vendored browser bundle |

TypeScript is **not adopted**: zero `.ts`/`.tsx` files under `src`, and the project uses
`jsconfig.json`, not `tsconfig.json`. `[VERIFIED]` `find src -name '*.ts' -o -name '*.tsx'`

Zod is **not used**: no import of `zod` anywhere in `src`. Runtime validation is hand-written
(`src/lib/wardrobe-model/{schema,validator}.js`, `src/lib/configSchema.js`, `src/lib/fsl/validator.js`). `[VERIFIED]`

---

## 4. Routes

### Next.js App Router (`src/app`)

| Route | Source file | Type | Purpose | Production | Tests | Gaps |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | `src/app/page.jsx` (444 L, `"use client"`) | Page | Landing + hero 3D + gallery | ✅ serving `[VERIFIED]` | none direct `[KNOWN_GAP]` | prohibited factory/CNC claims — §6 `[RISK]` |
| `/builder` | `src/app/builder/page.jsx` (114 L, `"use client"`) | Page | R3F configurator | ✅ serving `[VERIFIED]` | `tests/browser/r3f-builder.spec.js` (7 tests) | no persistence, no door/drawer animation `[KNOWN_GAP]` |
| `/fsl-lab` | `src/app/fsl-lab/page.jsx` (340 L, `"use client"`) | Page | FSL experiment surface | ✅ 200 `[VERIFIED]` | none `[KNOWN_GAP]` | internal tool exposed publicly `[RISK]` |
| `/api/health` | — | — | — | ❌ **does not exist** | — | `[KNOWN_GAP]` required by master plan |
| `/api/wardrobe/chat` | `src/app/api/wardrobe/chat/route.js` (100 L) | Route (POST) | Wardrobe AI agent turn | ✅ POST 400 on empty body `[VERIFIED]` | `route.test.js`, `apiChatSecurity.test.js` | no rate limiting `[RISK]` |
| `/api/sales-agent` | `src/app/api/sales-agent/route.js` (43 L) | Route (POST) | Sales conversation | ✅ POST 400 `[VERIFIED]` | `route.test.js` | no rate limiting `[RISK]` |
| `/api/v1/furniture/generate` | `src/app/api/v1/furniture/generate/route.js` (196 L) | Route (POST) | FSL generation | ✅ POST 400 `[VERIFIED]` | `route.test.js` | public generation endpoint, unauthenticated `[RISK]` |
| `/api/whatsapp/webhook` | `src/app/api/whatsapp/webhook/route.js` (63 L) | Route (GET+POST) | WhatsApp Cloud API webhook | ✅ POST 200 `[VERIFIED]` | none `[KNOWN_GAP]` | returns 200 on empty body — signature verification unconfirmed `[RISK]` |

### Top-level `api/` (Vercel serverless, built regardless of framework)

| File | Lines | Purpose | Status |
| --- | --- | --- | --- |
| `api/production.py` | 674 | Python production/CNC endpoint; validates a Supabase token server-side | ✅ `/api/production` returns 200 `[VERIFIED]` |
| `api/wardrobe/chat.js` | 26 | Transport shim that re-exports the Next route's `POST` | tracked; superseded by App Router `[INFERRED]` |
| `api/chat.js` | — | Older chat handler with image blocks | tracked; duplicate surface `[RISK]` |
| `api/constructionValidator.js` | — | Validator used by the legacy transport | tracked; duplicate surface `[RISK]` |
| `api/__pycache__/production.cpython-311.pyc` | — | build artifact | **untracked**, gitignored `[VERIFIED]` |

`[RISK]` The top-level `api/` directory is a second, parallel API surface that Vercel deploys
alongside the App Router. It is not covered by the parity gate and is easy to forget.

---

## 5. Verification gates

All commands run read-only in a Linux VM with the owner's Windows folder mounted.
No dependency was installed, updated or removed.

| Gate | Exact command | Exit | Result | Classification |
| --- | --- | --- | --- | --- |
| Lint | `npm run lint` (`eslint src tests`) | **0** | clean, no findings | ✅ PASS `[VERIFIED]` |
| Validator tests | `npm run test:validator` (`node --test tests/validator.test.js`) | **0** | 24 tests · 21 pass · 0 fail · 3 todo (all tagged `[knownGap]`) | ✅ PASS `[VERIFIED]` |
| Unit tests | `npx vitest run --reporter=basic` | 1 | `Error: Cannot find module @rollup/rollup-linux-x64-gnu` | 🚫 `[BLOCKED]` **environmental** |
| Production build | `npx next build` | 1 | `Downloading swc package @next/swc-linux-x64-gnu…` → `getaddrinfo EAI_AGAIN registry.npmjs.org` | 🚫 `[BLOCKED]` **environmental** |
| Browser tests | `npx playwright test …` | not run | depends on a working build/dev server | 🚫 `[BLOCKED]` **environmental** |
| Git status | `git status --porcelain` | 0 | 172 entries; 4 substantive (§7) | ✅ `[VERIFIED]` |
| Dependency inspection | `node -e require('./node_modules/<p>/package.json')` | 0 | table in §3 | ✅ `[VERIFIED]` |
| Secret scan (heuristic) | `git grep -nIE '<key patterns>'` | 0 | see `SECURITY.md` | ✅ `[VERIFIED]` |

### Why the two blockers are environmental, not code

`node_modules/` was installed on **Windows**. The audit reaches the same folder from a
**Linux** VM, so the platform-specific optional binaries (`@rollup/rollup-linux-x64-gnu`,
`@next/swc-linux-x64-gnu`) are absent, and that VM has **no network egress**, so Next.js
cannot download the missing SWC package. Neither failure implicates repository code.
`[VERIFIED]`

**Nearest independent evidence that the build is green:** Vercel built this exact SHA
(`4f4f1cd`) successfully in 1m 03s on 2026-08-30 (deployment `myS5ZNUgx`). `[VERIFIED]`

`[DECISION_REQUIRED]` Re-running the unit, build and browser gates requires either a
clean `npm ci` on Linux (which rewrites `node_modules`, currently out of scope) or the
owner running them on Windows and pasting the output.

---

## 6. Live application (production, 2026-08-30)

Inspected read-only in a browser pane against `https://furniai.vercel.app`.

### Landing page `/`

- Renders the Next.js app: 11+ `/_next/static/immutable/chunks/*.js` scripts; document title
  `FurniAI — Custom Furniture, Built to the Millimetre`. `[VERIFIED]`
- Hero 3D canvas: 704 × 704 backing store, WebGL context acquired, wardrobe visible. `[VERIFIED]`
- Gallery links to 7 designs (`/builder?design=…`) plus section anchors `#gallery`, `#pipeline`, `#materials`. `[VERIFIED]`
- `src/lib/designs.js` defines 8 designs total. `[VERIFIED]`
- Console errors during load: **none captured**. `[VERIFIED]`

**`[RISK]` — prohibited claims are present on the landing page.** The master plan forbids
presenting CNC, factory-ready output, nesting, DXF or pricing as complete in v0.1 while the
Python engine remains `FACTORY_QUALIFICATION_REQUIRED`. Live copy includes:

- `CNC INTEGRATED CONFIG` (eyebrow above the hero headline)
- `0.0 mm · TOLERANCE LIMIT`
- `Direct · FACTORY DISPATCH`
- "…then send your spec straight to production."

`[VERIFIED]` by page text extraction and screenshot. No price or currency figure appears. `[VERIFIED]`

### Builder `/builder`

- Default wardrobe renders on first load without user input; canvas 880 × 840; WebGL healthy. `[VERIFIED]`
- Controls present: furniture type (8 types), sections with add/remove, per-section mode
  (doors / drawers / open shelves), door count, shelf count, hinge left/right, drawer rows,
  width / height / depth, material (10+ finishes), handle, door type, LED lighting, plinth toggle,
  "Ask AI" panel, "Order via WhatsApp". `[VERIFIED]`
- Orbit by drag is advertised in-scene and covered by a browser test. `[VERIFIED]`
- **No save / load / reset control exists**, and `localStorage` is empty after load. `[VERIFIED]` `[KNOWN_GAP]`
- **No door or drawer animation**: zero occurrences of `useFrame`, `requestAnimationFrame`,
  `lerp` or `damp` across all `src/components/builder/*.jsx` and `src/app/builder/page.jsx`.
  The legacy `app.js` does contain such code (4 occurrences). `[VERIFIED]` `[KNOWN_GAP]`
- No price, quote, CNC, DXF, nesting or factory language on this page. `[VERIFIED]`

### Legacy static runtime

No longer served. `/app.js` returns **404**; `/index.html` redirects to `/` and serves the Next
page. The legacy files remain **in the repository**. `[VERIFIED]`

---

## 7. Line-ending investigation

**Method.** `git diff --numstat` reports 172 files / +36,539 / −37,378.
`git diff --numstat --ignore-cr-at-eol` reports **4 files**. Every other file therefore differs
only by carriage returns. Confirmed by inspection: added lines in `README.md` end `^M$`,
removed lines end `$`. `git config core.autocrlf` is **unset**, and there is **no `.gitattributes`**,
so a Windows editor rewrote whole files LF → CRLF. `[VERIFIED]`

1. **Line-ending-only:** 168 files. `[VERIFIED]`
2. **Substantive:** 4 files, all deletions — `FurniAI/README.md`, `FurniAI/app.js`,
   `FurniAI/index.html`, `FurniAI/styles.css`. `[VERIFIED]`
3. **Were the deletions intentional?** `[INFERRED] — probably yes, and harmless.`
   `FurniAI/` was added in `a080ba7` ("feat: commit static vanilla HTML/CSS/JS site and configure
   vercel.json") and last touched in `8112a1e` (2026-07-26). It is an **older, smaller snapshot**
   of the same static site that now lives at the repository root:
   `index.html` 198 L vs root 2,483 L · `app.js` 369 L vs root 544 L · `styles.css` 229 L vs root 429 L.
   The two copies are **not identical**. Nothing in the build references `FurniAI/`; the only
   tracked mention is a directory diagram at `README.md:8`. Vercel never served that path. `[VERIFIED]`
   `[DECISION_REQUIRED]` Owner to confirm the deletion was deliberate before it is committed.
4. **Hidden genuine changes:** **none.** `[VERIFIED]`
5. **Recommended policy:** see §8 — proposed only, **not applied**.

---

## 8. Proposed `.gitattributes` (NOT APPLIED)

Adding this file would cause Git to renormalize on the next checkout, which would touch
essentially every tracked file. That is a bulk operation and is explicitly out of scope for
this audit, so it is proposed here only. `[DECISION_REQUIRED]`

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

Recommended sequencing (for the **clean rebuild**, not this repository): commit
`.gitattributes` as the *first* commit of the fresh history, before any source lands, so no
renormalization commit is ever needed.

For this legacy repository, the recommendation is to leave the 168-file churn
**uncommitted and discarded** (`git restore` the churned paths, keep only the intended
`FurniAI/` deletion) rather than commit 36k phantom line changes into the audit trail.
`[DECISION_REQUIRED]`

---

## 9. Definition-of-done comparison — FurniAI Clean Vertical Slice v0.1

| # | Requirement | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | Fresh GitHub repository exists | **FAIL** | repo is `furnia`, 78 commits from 2026-06-18 `[VERIFIED]` |
| 2 | Fresh Vercel project exists | **FAIL** | project `furniai` / `prj_Ynh5…` is the pre-existing one `[VERIFIED]` |
| 3 | Production URL serves the Next.js app | **PASS** | `/_next/` chunks, Next metadata title `[VERIFIED]` |
| 4 | `/builder` directly loads a visible wardrobe | **PASS** | 880×840 canvas, model visible on first load `[VERIFIED]` |
| 5 | Required controls work | **PARTIAL** | dimensions, sections, shelves, drawers, material, handle, door type, LED, plinth present; **door and drawer animation absent** `[VERIFIED]` |
| 6 | Save / reload works | **FAIL** | no persistence code, no control, empty `localStorage` `[VERIFIED]` |
| 7 | AI can safely create/edit the canonical wardrobe when configured | **PARTIAL** | route + agent + 8 tools + validation exist and are unit-tested; live provider behaviour not exercised `[UNVERIFIED]` |
| 8 | Manual builder survives provider failure | **PARTIAL** | `simulatedFailover.test.js` and `AllProvidersUnavailableError → 503` exist; not verified in a browser `[UNVERIFIED]` |
| 9 | All local and production gates pass | **BLOCKED** | lint ✅, validator ✅; unit + build + browser blocked environmentally `[BLOCKED]` |
| 10 | Exact deployed SHA recorded | **PASS** | `4f4f1cd` → deployment `myS5ZNUgx` `[VERIFIED]` |
| 11 | No secrets or old remote metadata in repository history | **PARTIAL** | no credential file ever tracked; but a live Supabase **anon** key + project URL are hardcoded in two tracked files `[VERIFIED]` — see `SECURITY.md` |
| 12 | No factory / price / CNC / nesting / payment claim presented as complete | **FAIL** | landing page ships `CNC INTEGRATED`, `0.0 mm TOLERANCE LIMIT`, `FACTORY DISPATCH`, "straight to production" `[VERIFIED]` `[RISK]` |
| — | `/api/health` exists | **FAIL** | route absent `[VERIFIED]` |
| — | TypeScript for new/migrated modules | **FAIL** | zero `.ts`/`.tsx`; `jsconfig.json` `[VERIFIED]` |
| — | Zod for runtime validation | **FAIL** | not a declared dependency; hand-written validators `[VERIFIED]` |
| — | Prettier configured | **FAIL** | not installed, no config `[VERIFIED]` |
| — | `docs/audit/*` package exists | **PASS (as of this audit)** | this document set |
| — | Parity gate documented | **PASS** | `docs/LEGACY_BUILDER_PARITY_GATE.md` `[VERIFIED]` |
| — | Python engine quarantined from customer runtime | **PARTIAL** | `production-engine/` is out of the Next bundle, but `api/production.py` is deployed and reachable at `/api/production` `[VERIFIED]` `[RISK]` |

**Overall: v0.1 is NOT met.** The blocking clauses are 1, 2, 6, 12, plus the missing
`/api/health`, TypeScript and Zod. Clauses 3, 4 and 10 are genuinely satisfied.

---

## 10. Pre-existing documents that overlap this audit

Per the audit rules these were **referenced, not replaced**. None was modified.

| Existing document | Overlaps | Assessment | Migration verdict |
| --- | --- | --- | --- |
| `docs/LEGACY_BUILDER_PARITY_GATE.md` | The parity gate the master plan requires | Genuine, detailed, with a frozen reference commit (`9b21e8b6…`) and reference deployment (`dpl_WmF7vQVWso7zpSfRHMk5RNirfkJj`). Currently **unenforced** — the legacy runtime was taken off production before the gate passed. `[VERIFIED]` | **Migrate**, updated to reflect that legacy is already off production |
| `docs/KNOWN_LIMITATIONS.md` (192 L) | Parts of the `[KNOWN_GAP]` inventory | Written to the same "report NOT IMPLEMENTED plainly" discipline; scoped to Wardrobe AI Phase 1 and to a deployment state that today's Next.js cutover has superseded. `[VERIFIED]` | **Migrate after revision** — its deployment-status section is now stale |
| `docs/WARDROBE_AI_VERIFICATION_REPORT.md` (216 L) | Verification evidence for the AI layer | Dated 2026-08-11 with verdict `BLOCKED`; predates the AI implementation that now exists. Historical. `[VERIFIED]` | **Reference only** — do not carry a stale verdict into the new repo |
| `docs/furniai-existing-system-analysis.md` (273 L) | A prior Phase 0 analysis | Same intent as `SOURCE_MAP.md`, written before the FSL/tool work landed. `[VERIFIED]` | **Reference only** — superseded by `SOURCE_MAP.md` |
| `docs/STABILITY.md` (78 L) | WebGL lifecycle requirements | Pinned to branch `antigravity/M1-stability-20260816` and base SHA `c823c2bb…`. Its requirements are real and largely met by `LocalEnvironment` / `SceneEnhancementBoundary`. `[VERIFIED]` | **Migrate after revision** — drop the branch/SHA pinning |
| `docs/adr/ADR-001…`, `ADR-002…` | Architectural decisions (FSL provider-independent contract; Next 16 security migration) | Real ADRs. `[VERIFIED]` | **Migrate** — ADRs should survive the repository change |
| `docs/MASTER-PLAN.md` → `docs/furniai-authoritative-master-plan-prompt.md` | The authoritative plan | `MASTER-PLAN.md` is a 7-line compatibility pointer. `[VERIFIED]` | **Migrate the target**, drop the pointer |
| `docs/WARDROBE_AI_TEST_PLAN.md`, `WARDROBE_AI_BASELINE.md`, `WARDROBE_MODEL_SCHEMA.md`, `TOOL_CONTRACTS.md`, `WARDROBE_PRODUCTION_VERIFICATION_PLAN.md`, `IMPLEMENTATION_CHANGELOG.md` | Contracts and plans for the AI + production layers | Substantive; align with the `REUSE_AS_IS` code they describe. `[INFERRED]` — read at heading level only | **Migrate alongside their code** |

`[DECISION_REQUIRED]` No existing document is an equivalent of `SECURITY.md`, `REUSE_MATRIX.md`
or `LEGACY_REMOTES.md`. Those three are new to this package.

---

## 11. Audit integrity statement

- Files created: `docs/audit/{BASELINE,SOURCE_MAP,REUSE_MATRIX,SECURITY,LEGACY_REMOTES}.md` — 5 new files, all LF-terminated (0 carriage returns). `[VERIFIED]`
- Files modified: **none**. `[VERIFIED]`
- After writing this package, `git status --porcelain` shows: 168 line-ending-only modifications
  (pre-existing, untouched), 4 pre-existing deletions under `FurniAI/`, and one new untracked
  path `docs/audit/`. `git diff --numstat --ignore-cr-at-eol` still reports **only** the four
  `FurniAI/` deletions. **No unrelated file changed as a result of this audit.** `[VERIFIED]`
- No application source, test, configuration, dependency, lockfile, environment file, Git remote
  or Vercel setting was altered. Nothing was deployed. No credential was read, printed or rotated.
  `.env.local` was never opened; only its variable names were listed. `[VERIFIED]`
