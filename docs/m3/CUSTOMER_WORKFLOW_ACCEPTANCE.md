# Customer workflow — ownership map and acceptance (2026-09-30)

Workflow adopted: **description → validated draft → live AI-assisted edit → Undo → save →
reload/reopen → matching drawings and cut list.** Applied to the existing implementation;
no replacement paths were created. `/backend/compiler`, `/components/studio`, `/api/ai` in
the brief are illustrative — the real files are below.

## 1. Task → actual files → one owner

| Step | Actual files | Owner |
|---|---|---|
| Description → validated draft | `src/lib/conversation/{pipeline,assembleFurniSpec,interpretDescription,gapAnalysis}.js`, `src/lib/furnispec/*` | Claude (backend) — unchanged path |
| Canonical spec → geometry | `src/lib/partgraph/buildStructuralPartGraph.js`, `validatePartGraph.js`, `hangingDropGeometry.js` | Claude |
| Live AI edit (server) | `api/design/propose.js`, `src/lib/ai-designer/proposeDesignEdit.js`, `src/lib/ai-provider/*` | Claude |
| Live AI edit (client transport, stale guards) | `src/lib/adapters/aiDesignerTransport.js` → `ai-designer-transport.js` | Claude |
| Studio UI: input, chips, Undo, panels | `index.html` (`runAiWardrobe*`, `undoLastAiWardrobeEdit`, `reopenAiWardrobeDesign`) | Antigravity |
| Accepted 3D builder | `src/lib/adapters/partGraphToThree.js`, `browserBridge.js` (`loadDraftPartGraph`), legacy Builder in `index.html`/`app.js` | Antigravity (preserved, not modified) |
| Save / reopen API + store | `api/designs/**`, `src/lib/persistence/{designService,supabaseStore,auth,http,errors}.js`, `supabase/migrations/2026-09-22_*.sql` | Claude |
| Session-safe save/reopen, editable reopen | `src/lib/persistence/designSaveCoordinator.js`, `src/lib/conversation/reopenDesign.js` | Claude |
| My Designs + designs API client | `src/lib/persistence/designsApiClient.js` → `designs-api-client.js` (currently in Antigravity's uncommitted tree) + My Designs UI | **Grok** (product engineering) |
| Drawings / cut list / DXF / nesting | `src/lib/drawing/projectionEngine.js`, `src/lib/production/{nestingCompiler,exportBridge,dxfCompiler}.js` | **Grok** (product engineering) |
| Rule authority / constraint report | `src/lib/rules/{wardrobeRuleCatalog,physicalLimitRegistry,constraintReport}.js` | Claude (values: Bekzod) |
| Database harnesses | `scripts/verify-persistence-db.mjs`, `scripts/db-verify/*` (Claude); `tests/persistence/real-db/**`, `scripts/persistence/*` (Grok QE) | as listed |
| Browser harness | `tests/browser/*.spec.js` (Playwright) — each file has one author | shared framework |

## 2. What changed in the backend for this workflow

| Commit | Change |
|---|---|
| `389c486` | **A chosen finish could not be saved** (walnut/oak → `400 INVALID_PARTGRAPH`): the finish was patched onto the graph after compilation. Now `customerFinishKey` is compiled into the graph; `commitMaterialUpdate` recompiles. **Reopen was not editable** (Studio reopened with `observations: []`): `restoreEditableDesign` rebuilds intake facts from the stored revision and proves they reproduce the stored spec and PartGraph. |
| `32ab202` | Traceable constraint report (§4). |
| this commit | Browser acceptance on a real database; live AI workflow script; evidence. |

Persistence restores: accepted FurniSpec (dimensions, layout, `finishType`, `customerFinishKey`),
PartGraph byte-for-byte, provenance (`origins`), stored revision. **Defined session
behaviour on reopen:** fresh editing session (id rotated); change token restarts; earlier
pending AI answers and save answers are refused (transport session guard; coordinator
`DISCARDED_STALE_SESSION`); displayed revision = the spec's own revision; **Undo history
does not cross a reopen or reload** — Undo after reopen says "nothing to undo". Cross-session
Undo is not a pilot requirement unless agreed.

## 3. Acceptance evidence — three separate tiers

**A. Browser + real database (local).** `tests/browser/studio-workflow-acceptance.spec.js`
via `node scripts/db-verify/with-local-stack.mjs -- npx playwright test …` (Chromium 1194,
PostgreSQL 16.13, PostgREST 12.2.3, JWT shim). Real Studio page: description → draft →
"2000 mm" chip → walnut chip → "2200 mm high" → Undo → cut list CSV + drawing SVG downloaded
→ save (coordinator + Antigravity's client) → row read back by a second client → **page
reload** → reopen → state spec/PartGraph/fingerprint = saved = accepted; 3D CARC_TOP mesh
2000 mm; downloaded CSV and SVG **byte-identical** to before save; Undo depth 0; edit
"2100 mm wide" continues with height 2400 and walnut kept → save = stored revision 2.
**PASS.** Evidence: `docs/m3/evidence/2026-09-30/browser-workflow-acceptance-local-postgres.txt`.

Recorded Studio gaps (Antigravity, presentation — not changed by me):
- **D9** after reopen the intake panel stays on screen; the refine input is not visible
  (the edit was driven through `runAiWardrobeConversationalEdit`).
- **D10** after reopen the summary shows revision 1 / 1800 mm / Oak while state, 3D and
  exports are revision 3 / 2000 mm / walnut. Second test in the spec is `test.fail` and
  flips when fixed.
- **D11** `reopenDesignFromApi` should use `restoreEditableDesign` (it sets `observations: []`).

**B. Real AI (live provider) — authorized by Bekzod 2026-09-30, ≤ 3 calls.**
`scripts/live-workflow-acceptance.mjs --relay --max-requests 3` under `with-local-stack`,
key taken only from `ANTHROPIC_API_KEY` in the local `.env.local`, held in process
environment, staged copy deleted, no key in any output.
- Run 1: 3 relay attempts, **0 reached the provider** (curl exit 77: the unprivileged user
  could not read the CA bundle). Nothing billed.
- Run 2: **1 provider request, HTTP 200**, model `claude-sonnet-5`, 2.4 s. The customer's
  "open it up a bit — go to two metres across" became `DESIGN_UPDATED` 2000 × 2400 × 600;
  PartGraph = compiler(spec), valid; constraint report PASS (13 approved, 2 provisional,
  0 advisory, 0 blocking); saved 201 to real PostgreSQL; reopened editable; fingerprint,
  spec, PartGraph, cut list and drawings identical. **PASS.**
- Total billed provider requests this session: **1**. (A plumbing check used a fake key:
  one unauthenticated request, 401, not the owner's key.)
- Evidence: `live-ai-workflow-run1-no-request-sent.txt`, `live-ai-workflow-run2-PASS.txt`.
- This is the **local** runtime of this branch. Preview/Production AI configuration is still
  undiagnosed (no deployment of this branch exists).

**C. Real hosted persistence (Supabase) — NOT RUN, BLOCKED.** Bekzod: "not now" for the
Studio's project `upavdjmovubblowrxncp`; no non-production project exists; this workspace
cannot reach `*.supabase.co`. Plan unchanged: `HOSTED_NONPROD_AND_AI_RUNTIME_PLAN.md`.
Nothing in A or B is evidence for C.

Regression on the merged candidate (3ed620c + Antigravity WIP + Grok 8566d34 + this
branch): `design-state-protection` 5/5, `export-identity-verifier` 4/4,
`studio-save-reopen-staleness` 3/3 (1 intentional expected failure), vitest 1410 pass on the merged tree, 1402 on this branch.

## 4. Manufacturing constraints — four kinds, traced

`PartGraphBridge.buildConstraintReport({ spec, partGraph, derivations })`:

| Field | Contains | Blocks? |
|---|---|---|
| `blockingViolations` | FurniSpec validator, kernel geometry (e.g. `HANGING_DROP_NOT_ACHIEVABLE`), PartGraph validator, unrepresentable component | yes — report stops |
| `advisoryWarnings` | provisional limits measured on the design: PL-003 garment drop < 800, PL-004 hanging depth < 300, PL-005 shelf span > 1200 (+ kernel warnings) — each with limit id, value, provenance `PROVISIONAL_PENDING_BEKZOD_REVIEW` | never |
| `approvedRules` | catalog rules with Rulebook v0.1 / golden-fixture / Bekzod-ruling provenance that parts actually cite, with the part ids | — |
| `provisionalRules` | `PROVISIONAL_PENDING_BEKZOD` records, drawer construction constants, hanging-rail preview assumptions | — |
| `untracedReferences` | rule ids cited by parts with no catalog record (today: `WR-002`) | — |
| `notQualified` | drilling `BLOCKED_PENDING_HARDWARE_APPROVAL`, STEP `NOT_SUPPORTED`, the design's CNC qualification status | — |

No hardware drilling, STEP support or CNC qualification is claimed.

## 5. For Grok (product engineering)

1. **API client** (`designsApiClient.js`): remove the `designId` option on create (server
   refuses it); add `AUTH_UNAVAILABLE`, `PERSISTENCE_NOT_CONFIGURED`,
   `REVISION_INTEGRITY_FAILED`; fall back to `UNKNOWN` rather than guessing from status.
   The coordinator uses the client unchanged. My Designs list = `GET /api/designs`; open =
   `coord.reopen` → `restoreEditableDesign` → Studio apply → `coord.bind`.
2. **Exports:** the DXF package README is titled "FurniAI CNC Fabrication Package" and the
   export module header says "CNC layer compiler" while the design is
   `WORKSHOP_REVIEW_NOT_CNC_QUALIFIED` and drilling is blocked — recommend "workshop review
   DXF package" wording. Drawings already say "WORKSHOP REVIEW (NOT CNC)". Optionally print
   the constraint report's `approvedRules` / `provisionalRules` / `advisoryWarnings` on the
   drawing sheet.
3. Acceptance above proves drawings and cut list are a pure function of the PartGraph and
   identical after reopen; keep `generateShopDrawingsSVG` deterministic given `options.date`.

## 6. Owner and decisions

Antigravity: D1–D6 (use the coordinator), D9, D10, D11. Bekzod: hosted target (§3C), the
hanging-drop decisions, whether cross-session Undo is wanted.
