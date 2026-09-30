# Corrected pilot workflow map, owners and gaps (Oct 18 pilot)

**Branch:** `integ/pilot-oct18-candidate` (worktree `C:\Users\xalim\FurniAI-Grok-Candidate`)
**Code base mapped:** `c6bbe894e65adf39fd14ed2f449dcb52a82b228d` (committed 2026-09-30 21:58 GST). The branch tip `3bdb98b` only adds `docs/m2/integ/OWNERSHIP_OCT18.md`, so every source line below is identical at the tip.
**Written:** 2026-09-30 (Asia/Dubai, GST) by CraZy Integration (Grok executor). This is a read-only analysis. No source file was edited.
**Status:** local only. Not pushed, not merged to main, not deployed.

**How this was verified.** File and line references come from `git grep -n` and direct reads at `c6bbe89`. Where the doc says **PROBED**, four small throwaway Node scripts were run from `%TEMP%\furniai-wfmap` (outside the repo). They import the committed modules (`pipeline.js`, `commitMaterialUpdate.js`, `designService.js` with `createMemoryStore()`, `projectionEngine.js`, `nestingCompiler.js`) and make no network calls. No model call, no hosted DB, no Vercel/Supabase change, and no tracked file was written. Playwright, vitest and the harnesses were **not** re-run for this doc. Gate numbers quoted come from `OWNERSHIP_OCT18.md` and the task brief.

**Illustrative paths are not real.** `/backend/compiler`, `/components/studio` and `/api/ai` do not exist in this repo. They are mapped below to what does exist. Nothing should be created just to match those names.

---

## 0. Pilot surface (verified)

- Customers load the static root `index.html`. `vercel.json` has `"framework": null`, `"buildCommand": "npm run build:legacy"` and `"outputDirectory": "dist"`. `scripts/build-static.mjs` bundles `src/lib/adapters/browserBridge.js` into `partgraph-runtime-bridge.js` (global `PartGraphBridge`) and `src/lib/adapters/aiDesignerTransport.js` into `ai-designer-transport.js` (global `AiDesignerTransport`), then copies 8 files to `dist/`. **Note:** `build:legacy` rewrites those two tracked bundles. If a rebuild changes them, revert them.
- The hash router is at `index.html:885-903`. `#/build/ai-wardrobe`, `#/design-with-ai` and `#/ai*` go to `showBuilder('ai-wardrobe')` (`:890-891`). `#/projects` goes to `showProjects()` (`:892-893`, `:940-950`). `Builder.load()` rotates the Studio session on every builder entry (`:1923-1924`) and calls `initAiWardrobePanel()` (`:1982`).
- The Next app (`src/app/**`) is not deployed.
- API: root `api/` Vercel functions.
  - Persistence: `api/designs/index.js` (GET list, POST create), `api/designs/[designId].js` (GET), `api/designs/[designId]/revisions.js` (GET list, POST save), `api/designs/[designId]/revisions/[revision].js` (GET). All of them go through `withAuth` (`src/lib/persistence/http.js:74`), which calls `resolveCaller` (`src/lib/persistence/auth.js:30`, Bearer required at `:33`).
  - Diagnostics: `api/design/health.js`.
  - **AI edit/draft endpoint on the pilot route: `api/design/propose.js`** (handler `:151`, `validateBody` `:125`, `router.run(... proposeDesignEdit ...)` `:172`), backed by `src/lib/ai-designer/proposeDesignEdit.js:45` and `src/lib/ai-designer/designEditSchema.js:111` (`validateModelProposal`).
  - Other AI endpoints **not** on the AI-wardrobe path: `api/chat.js` (legacy configurator chat, called from `index.html:3586`), `api/wardrobe/chat.js` (wardrobe agent, `index.html:3631`) and `api/production.py` (legacy production pack, `index.html:3260`).
- At `c6bbe89`, `index.html` never calls `/api/designs`. The persistence doc says the same (`docs/m3/DESIGN_PERSISTENCE_API.md:397-400`). `#/projects` uses the Supabase `projects` table directly (`index.html:3906`).
- Antigravity's `antigravity/studio-designs-client` work (`designsApiClient.js`, bundle, build step, `persistAcceptedRevision`, `reopenDesignFromApi`, `#bReopenApi`, save badge) is **absent** from the candidate. `git grep` finds none of those identifiers, and no such branch ref exists in this worktree. What that work does is taken from the task brief. The real Antigravity checkout was not opened.

---

## 1. Step map (at c6bbe89)

Status key: **works**, **partial**, **missing**, or **pending-AG** (waits on Antigravity's unpublished client). Exactly one owner per step (PROPOSED; CraZy confirms). "Patch via" names a different owner who must supply a patch for part of the gap. The step owner stays accountable for closing it.

| # | Step | Real files / functions (file:line) | Status | Owner (proposed) | Gap to close |
|---|---|---|---|---|---|
| 1 | Description | `index.html:703-712` (`#aiWardrobeInput` `:710`, `#aiWardrobeSubmitBtn` `:711`); `bindAiWardrobeEvents` `:2952` (submit `:2984-2987`, Enter `:2974-2982`); `runAiWardrobeDraftPreview` `:2471-2536`; optional async AI refinement `runInitialAiInterpretation` `:2538-2651` (called at `:2532-2534`) | works (deterministic) | **Antigravity** | `runInitialAiInterpretation` handles only DESIGN_UPDATED/MATERIAL_UPDATED (`:2584-2644`). NEEDS_MORE_DETAIL / UNSUPPORTED / REJECTED / DESIGNER_UNAVAILABLE are dropped silently, and errors only reach `console.warn` (`:2649`). Real-model behaviour on free-text descriptions is unproven (see section 7). |
| 2 | Validated draft | `PartGraphBridge.previewDraftWardrobe` (re-export `src/lib/adapters/browserBridge.js:18,65`) -> `src/lib/conversation/pipeline.js:318-458`: `analyseGaps` `:341`, out-of-slice refusal `:343-345`, Bekzod defaults `:366-373` (`BEKZOD_APPROVED_DEFAULTS` `src/lib/conversation/intakeModel.js:30-39`), `assembleFurniSpec` `:385`, `validateFurniSpec` `:405`, `createProposal` (fingerprint) `:420`, `buildStructuralPartGraph` `:421`, `validatePartGraph` `:422`, unrepresentable refusal `:427-442`, DRAFT_PREVIEW result `:444-457`. Viewer: `loadDraftPartGraph` (`browserBridge.js:327` = `loadApprovedPartGraph` `:263`). Summary: `updateAiWardrobeSummaryUI` `index.html:2366-2418` | works | **Claude Code** | (a) `index.html:2494-2535` handles only `UNSUPPORTED_REQUEST` (generic `alert`, which ignores the real `result.error` from `pipeline.js:439`) and `DRAFT_PREVIEW`. `VALIDATION_FAILED` (`pipeline.js:393-394`, `:406-408`) shows the customer **nothing**. Patch via Antigravity. (b) The draft is returned even if `validatePartGraph` fails. `partGraphValidation` is only carried in the result (`:422`, `:450`) and no one reads it. Decide: refuse, or at least surface. |
| 3 | Live AI-assisted edit | UI `runAiWardrobeConversationalEdit` `index.html:2653-2823` -> `AiDesignerTransport.proposeDesignChange` `src/lib/adapters/aiDesignerTransport.js:338-643` (deterministic parser first `:361-393`; `POST /api/design/propose` `:483-492`; browser re-validation `validateModelProposal` `:574-577`; kernel replay `applyConversationalEdit` `:616-642` -> `pipeline.js:898`) -> `api/design/propose.js:151` -> `proposeDesignEdit.js:45`. Chips `index.html:765-767`, input `:770-771` | works (deterministic, mocked, simulated); live model unproven | **Claude Code** | (a) **Dead branch:** `index.html:2802` reads `} else if (kind === 'NEEDS_MORE_DETAIL') {  } else if (kind === 'NEEDS_MORE_DETAIL') {`. The first, empty branch always wins, so a model "need more detail" reply is never shown. Patch via Antigravity. (b) Conversational edit refuses silently when `aiWardrobeState.observations` is empty (`:2654`). That matters after a durable reopen (see step 6). (c) No approved real-model evidence for this path (section 7). |
| 4 | Undo | Button `index.html:777`, bound at `:3015-3018`; `undoLastAiWardrobeEdit` `:2825-2849`; stack in `aiWardrobeState.undoStack` (`:2157`), pushed at `:2613`, `:2642`, `:2755`, `:2800` | works in-session (in-memory only) | **Antigravity** | (a) On Undo the finish is restored from `prev.spec.finishType` (`:2844-2846`). That is the catalog value (`melamine`), not `customerFinishKey`, so undoing back across a finish-preserving edit can repaint the viewer with the wrong swatch. Code reading only, not browser-verified. (b) After Undo the revision rewinds (`:2840`), and the next edit re-uses `revision + 1` (`pipeline.js:941`, `:984`). One session can therefore produce two different designs with the same revision number, which collides with immutable saved revisions (section 4). (c) Undo history is not persisted (section 4; pilot definition PROPOSED). |
| 5 | Save | Current button `#bSave` `index.html:861` -> `saveCurrentDesign` `:3848-3862` inserts **`Builder.cfg`** (the legacy configurator config) into Supabase `projects` (`:3853`). It does **not** save `aiWardrobeState` (spec/partGraph/revision). Backend ready: `POST /api/designs` + `POST /api/designs/:id/revisions` (`api/designs/[designId]/revisions.js:15-32`) -> `designService.saveRevision` `src/lib/persistence/designService.js:117-129` (fingerprint `:160-172`, spec/graph consistency `:468-515`, compile-equality `:533-574`); schema `supabase/migrations/2026-09-22_wardrobe_design_persistence.sql` | missing for AI design; pending-AG (`persistAcceptedRevision` + `designsApiClient.saveAcceptedRevision`) | **Antigravity** | (a) Wire Save to the API (pending). (b) **Blocking dependency on Claude Code, PROBED:** any design with a customer finish is **refused** (`INVALID_PARTGRAPH`, 400). `commitMaterialUpdate` bumps `spec.revision` but not `partGraph.sourceRevision` (`src/lib/conversation/commitMaterialUpdate.js:137-140` vs `:53-67`), so the save fails "built from a different revision". It also annotates the PartGraph (`parts[].customerFinishKey/finishIntent`, `summary.customerFinishKey/revision`, `:53-67`), which the compiler never emits, so even with the revision patched the save fails "not the geometry of this FurniSpec" (`designService.js:567-573`). A width edit made after a finish change fails the same way. **PROBED works:** the same finish spec saved with `buildStructuralPartGraph(spec)` (no annotation) saves, and reopens with `customerFinishKey: walnut`. The save-payload contract has to be decided (Claude Code), then the client wiring (Antigravity). No geometry change is needed. |
| 6 | Reload / reopen | `reopenAiWardrobeDesign(savedState)` `index.html:2162-2180` (rotates session, resets `editSequence` and `undoStack`, loads the PartGraph). **No caller in `index.html`**; only `tests/browser/design-state-protection.spec.js:413` calls it. `#/projects` -> `loadProjects` `:3901-3927` reopens legacy `Builder.cfg` into `DESIGNS` (`:3916`), not an AI design. Backend ready: `GET /api/designs`, `GET .../revisions/:rev` -> `designService.getRevision` `:82-115` (stored row re-verified `:103`, `:601-620`) | missing for AI design; pending-AG (`reopenDesignFromApi`, `#bReopenApi`) + My Designs module | **Grok Designs Engineer** (CraZy to confirm; the alternative is Antigravity as owner with Designs Engineer contributing) | (a) My Designs list/open module consuming AG's `listDesigns/getDesign/getRevision`, exposing `onOpenDesign({designId, revision, name})`. (b) Patch via Antigravity: map the API response into Studio state. The API returns `furniSpec` (not `spec`), `partGraph`, `origins`, `revision` and `fingerprint`, and **no `observations`, `proposal`, `approval` or `currentStage`**. `reopenAiWardrobeDesign` spreads `savedState` as-is. Without rebuilding `observations` and `proposal` from the stored spec, conversational edit is silently disabled (`:2654`). (c) `reopenAiWardrobeDesign` calls `updateAiWardrobeSummaryTable` (`:2175-2176`), which is **not defined anywhere**, so the summary table is not refreshed. It never re-applies the customer finish to the viewer and does not un-hide the review panel. Patch via Antigravity. |
| 7 | Matching drawings and cut list | Menu `index.html:680-692` (SVG `:686`, Print/PDF `:687`, DXF `:690`, CSV `:691`, Nesting `:692`); source graph `getActivePartGraph` `:3467-3475` (reads `window.aiWardrobeState.partGraph` first, `:3468`); handlers `:3477-3542`. `src/lib/drawing/projectionEngine.js` (`generateShopDrawingsSVG` `:602`, `exportShopDrawingsSVG` `:804-825`, `exportShopDrawingsPDF` `:836-873` = print window); `src/lib/production/exportBridge.js` (`exportCutListCSV` `:159-171`, `exportCabinetDxfZip` `:181-226`, `formatNestingReport` `:235`); `src/lib/production/nestingCompiler.js` (`CUT_LIST_CSV_COLUMNS` `:105-118`, `generateCutListCsv` `:312-334`, `compileNestingManifest` `:1014`); `dxfCompiler.js` | partial | **Grok Export Engineer** | **PROBED:** (a) The SVG title block always prints **"Rev 1"**. `projectionEngine.js:516` reads `partGraph.revision`, but the compiler sets `sourceRevision` (`src/lib/partgraph/buildStructuralPartGraph.js:923`), and `index.html:3486/3488` passes no options. Confirmed for rev 1, rev 2 (width edit) and rev 3 (walnut). (b) The cut-list CSV has **no identity**: no spec id, revision or finish (columns `:105-118`). (c) The customer finish (e.g. walnut) appears in neither SVG nor CSV. (d) File names carry `sourceSpecId` only (`projectionEngine.js:806`, `:838`; `exportBridge.js:162`, `:184`). (e) The title block hard-codes `SLIDES: UNDERMOUNT_CONCEALED_21MM / BOTTOMS: HDF_WHITE_6` on every sheet (`projectionEngine.js:779`). Label patch ("Print drawings", CNC wording) via Antigravity. |

Cross-cutting owners (no single workflow step):
- **Grok Quality Engineer:** `tests/acceptance/**` journey for steps 1-7, reusing Playwright + `tests/persistence/real-db` + `scripts/db-verify`. **Note:** `playwright.config.js:9` sets `testDir: 'tests/browser'`, so specs under `tests/acceptance/` are not collected by the existing config. There is a precedent for a second config on the same Playwright setup (`playwright.r3f.config.js:26-27`, `testMatch`). That is a config file, not a new framework. CraZy decides.
- **Grok Website Engineer:** landing/nav/footer/catalog. Owns the landing overclaim fix `index.html:540` (section 5) as an `index.html` patch file.
- **CraZy:** integration only.

---

## 2. Session / reopen guard (how it works now)

**Client half (`index.html`).**
- Session id: `activeStudioSessionId` `:2129` (a `crypto.randomUUID()`). `rotateStudioSession()` `:2131-2138` issues a new id and sets `aiWardrobeState.sessionId` and **`editSequence = 0`**. It is called from `Builder.load` (`:1924`, every builder entry), `initAiWardrobePanel(true)` (`:2188-2190`, Start new / Start over) and `reopenAiWardrobeDesign` (`:2163`).
- Generation counter: `aiWardrobeState.editSequence` (`:2149-2150`; "=== transport changeToken; bumps on draft/edit/Undo; never rewinds" within a session). It is bumped at draft (`:2484`), at each conversational edit (`:2679-2680`) and at Undo (`:2831`).
- Each request captures `capturedSessionId`, `currentSeq`, `expectedSpecId` and `expectedRevision` (`:2678-2682`). It passes `sessionId`, `currentSessionId: () => activeStudioSessionId`, `changeToken`, `currentChangeToken: () => aiWardrobeState.editSequence`, `specId` and `currentDesignId` getters to the transport (`:2698-2708`; initial-interpretation path `:2554-2564`).
- After the answer lands, the UI re-checks session, sequence, specId and revision, and discards on any mismatch (`:2742-2751`; initial path `:2571-2578`). A transport `STALE_REVISION` is shown as a message (`:2736-2740`).

**Transport half (`src/lib/adapters/aiDesignerTransport.js`).**
- Pre-flight, before the paid call: misconfigured guards are refused (`invalidLiveStateGuardResult` `:95-141`, invoked `:420-430`).
- Session captured **at request start** from the live getter (`:432-479`). A caller-supplied `sessionId` that is not the live session is refused without a model call (`:465-477`, `sessionNotLiveAtRequest`).
- After the response: getters are read once (`readLiveStateGuards` `:164-194`, used `:511-514`), then `isStaleAnswer` `:227-283` runs. The order is **session first** (`:244-258`), then design id (`:260-265`), then change token by strict inequality (`:267-273`); legacy revision applies only when there is no token (`:275-280`). A stale answer becomes a geometry-free `STALE_REVISION` refusal (`staleResult` `:294-319`).

**Does reopen create a fresh session and drop earlier pending AI responses?** **Yes, for the client-side reopen that exists today.** `reopenAiWardrobeDesign` calls `rotateStudioSession()` (`:2163`), then installs the saved state with the new `sessionId`, `editSequence: 0` and an empty `undoStack` (`:2164-2170`). Any answer still in flight carries the old session id. The transport refuses it at `aiDesignerTransport.js:252-258`, and the UI guard at `index.html:2744` would discard it too. This is exercised in real Chromium by `tests/browser/design-state-protection.spec.js` (reopen at `:413`, delayed old-session answer asserted `STALE_REVISION` at `:440`), as recorded in `docs/m3/SESSION_ID_CALLING_CONTRACT.md:10-13`. **Caveat:** durable reopen from `/api/designs` has no caller yet (pending-AG). The guarantee holds for it only if `reopenDesignFromApi` goes through `reopenAiWardrobeDesign`, or calls `rotateStudioSession()` itself. The Quality Engineer should assert that in the acceptance journey.

---

## 3. Persistence restore: what a saved revision stores

`public.wardrobe_revisions` (`supabase/migrations/2026-09-22_wardrobe_design_persistence.sql:71-82`) has these columns: `id`, `design_id`, `revision` (int >= 1), `fingerprint` (text), `furnispec` (jsonb), `part_graph` (jsonb), `origins` (jsonb, nullable), `validation_status` (text), `created_at`, and `unique (design_id, revision)`. Rows are immutable because there is no UPDATE/DELETE policy and those grants are revoked (`:106-112`, `:141-142`). `public.wardrobe_designs` (`:23-29`) stores `id`, `owner_user_id`, `name`, `created_at` and `updated_at`. `getRevision` returns `designId, revision, fingerprint, furniSpec, partGraph, origins, validationStatus, createdAt` (`designService.js:104-114`) after re-verifying the stored row (`:103`).

| Needed on reopen | Stored? | Where |
|---|---|---|
| Accepted design (spec + geometry) | yes | `furnispec`, `part_graph`. The server enforces `part_graph == buildStructuralPartGraph(furnispec)` canonically (`designService.js:533-574`) |
| Dimensions | yes | `furnispec.envelope.{widthMm,heightMm,depthMm}`, `furnispec.plinth.heightMm` (also checked vs `partGraph.summary.envelope`, `:491-514`) |
| Finish | catalog `finishType` yes. Customer `customerFinishKey` **only if saved with an un-annotated PartGraph** (PROBED) | `furnispec.finishType`, `furnispec.customerFinishKey`. Today's UI state can't be saved once a finish is chosen (step 5 gap b) |
| Revision number | yes | `revision` column = `furnispec.revision` = `part_graph.sourceRevision` (`:478-489`) |
| Design identity | yes | `design_id` (server UUID), `furnispec.specId` = `part_graph.sourceSpecId` (`:469-476`) |
| Approval fingerprint | yes | `fingerprint` = `fs256:` + sha256(canonical spec) (`src/lib/conversation/approval.js:44-49`, `src/lib/conversation/fingerprint.js:100-101`) |
| Field origins (stated vs defaulted) | yes, optional | `origins` |
| **Observations** (needed for conversational edit, `index.html:2654`) | **no** | Must be rebuilt client-side from `furniSpec` + `origins` (Antigravity/Claude contract) |
| Proposal object / approval state / currentStage | **no** | `createProposal(spec)` can rebuild the proposal. Approval is not persisted, so a reopened design is unapproved |
| Undo history, conversation transcript | **no** | By design (section 4) |
| Design name | yes | `wardrobe_designs.name` |

**Conclusion.** The stored revision restores the accepted design, dimensions and revision number, plus finish (catalog finish always; customer finish only once the save payload contract in step 5 is fixed). What is missing for a working reopened Studio is `observations`, `proposal` and approval state. These are client reconstruction, not schema. Recommendation: **no schema change for the pilot.**

---

## 4. Undo

**Implementation.** Undo is an in-memory stack of snapshots `{spec, proposal, partGraph, observations, origins, revision}` held in `aiWardrobeState.undoStack` (`index.html:2157`). A snapshot is pushed before each committed AI/deterministic change (`:2613`, `:2642`, `:2755`, `:2800`). `undoLastAiWardrobeEdit` (`:2825-2849`) bumps `editSequence` (invalidating in-flight answers), pops, restores all fields, reloads the PartGraph into the viewer and repaints the finish from `prev.spec.finishType`. There is no `localStorage`/`sessionStorage`, and nothing sent to `/api/designs`.

**What happens to Undo history (code facts):**
- **After Save:** unchanged, because Save does not touch the stack. Today Save does not save the AI design at all (`:3853` saves `Builder.cfg`).
- **After page reload:** lost. The stack exists only in page memory (`:2143-2160` re-initialise on load).
- **After reopen (`reopenAiWardrobeDesign`):** cleared (`undoStack: []`, `:2168`).
- **After a new draft:** cleared (`:2483`). **After Start new / Start over:** cleared (`:2228` via `initAiWardrobePanel(true)`).
- **After in-page navigation away from and back to the builder:** kept. `Builder.load` rotates the session (`:1924`), but `initAiWardrobePanel(false)` keeps the existing state object (`:2191-2211`).
- Undo can rewind below the last saved revision, and the next edit re-uses that revision number (`pipeline.js:941`, `:984`). A later save of that number would hit `unique (design_id, revision)`: a 409 conflict, or idempotent only if byte-identical.

**PROPOSED pilot definition (needs Bekzod's agreement; not yet agreed):**
> Undo history is session-local and in memory. Saving does not clear it and does not make it durable. After a page reload or a reopen, Undo starts empty at the stored revision. Undo never deletes or alters a saved revision; saved revisions are immutable. If the customer undoes past the last saved revision and edits again, the next save is stored as a new revision numbered after the latest saved one (latest + 1), never re-using a saved number.

The last sentence requires a client/contract change (the save must renumber, and the server requires `furnispec.revision == part_graph.sourceRevision`, so the spec and graph are rebuilt at the new number through the existing deterministic path). Owners: Antigravity (client) and Claude Code (contract). If Bekzod prefers a narrower pilot, the alternative is: "Undo is disabled below the last saved revision."

---

## 5. Manufacturing rules, validations, warnings

Four classes:
- **Approved rule:** a value with Rulebook / Golden fixture / explicit Bekzod ruling provenance.
- **Provisional rule:** applied or enforced, but not approved by Bekzod.
- **Advisory warning:** reported, does not block.
- **Blocking violation:** refuses or fails closed.

### 5.1 Approved rules (subtotal 45 entries)
| Source | Count | file:line |
|---|---|---|
| `WARDROBE_RULES` RULEBOOK_V0_1 (WR-001, 003-013, S1-Z) | 19 | `src/lib/rules/wardrobeRuleCatalog.js:37-61`, `:73` |
| `WARDROBE_RULES` GOLDEN_FIXTURE_BEKZOD_APPROVED | 9 | `wardrobeRuleCatalog.js:65-71`, `:74`, `:75` |
| `WARDROBE_RULES` BEKZOD_RULING (2026-09-15 hardware rulings: shelf-pin depth 13.0/11.5, column origin +/-64, rear row bored 37, runner family, slide deduction 21.0, drawer-front reveal 2.0) | 8 | `wardrobeRuleCatalog.js:79-126` (drawer rulings are also cited in `src/lib/partgraph/emitDrawerBankParts.js:7`) |
| `BEKZOD_APPROVED_DEFAULTS` (draft defaults) | 8 keys | `src/lib/conversation/intakeModel.js:30-39` |
| Material catalog golden record | 1 | `src/lib/rules/materialCatalog.js:13` |

Note: `hingeCountPerDoor = 5` (WR-011, `wardrobeRuleCatalog.js:60`) is approved. The legacy configurator order modal uses 2-4 Blum hinges per door (`index.html:3149-3153`). See 5.5.

### 5.2 Provisional rules (18 items)
| Item | Count | file:line | Note |
|---|---|---|---|
| Doors-per-bay threshold 600 / 2 / 1 (`RULEBOOK_V0_2_DOORS_PER_BAY`) | 3 entries | `wardrobeRuleCatalog.js:134-136` | **Inconsistent:** the comment at `:130` says "Ruled 2026-09-18", but the provenance is `PROVISIONAL_PENDING_BEKZOD`. `resolve()` (`:157-166`) applies it without refusal. Bekzod decision needed |
| Physical limits PL-001..PL-006 (max panel thickness, min shelf clearance, min hanging clearance, min hanging depth, max unsupported span, min drawer bay width) | 6 | `src/lib/rules/physicalLimitRegistry.js:55-104` | Enforced fail-closed (they block) while provisional |
| Drawer box construction defaults (box height, depth setback 50, bottom clearance 0, bottom 6 mm HDF, back-between-sides, side 15 / inset 10) | 6 | `emitDrawerBankParts.js:8-15` (constants `:25-34`) | `PROVISIONAL_PENDING_BEKZOD_REVIEW` |
| Wardrobe-agent adapter provisional defaults (plinth default, drawer pack inputs) | 3 sites | `src/lib/partgraph/wardrobeModelAdapter.js:72`, `:246`, `:270-271` | Agent path (`/api/wardrobe/chat`), not the pilot draft path |

### 5.3 Unapproved, must ask (treated as blocking)
| Item | Count | file:line |
|---|---|---|
| `REQUIRES_BEKZOD_RULING`: `bayCountForWidth`, `unevenBayWidthDistribution`. `resolve()` throws `UnapprovedRuleError` | 2 | `wardrobeRuleCatalog.js:129`, `:137`, `:140-166` |

### 5.4 Blocking violations (fail-closed checks)
| Check | Count | file:line |
|---|---|---|
| FurniSpec validator (incl. `ILLEGAL_DRILLING_APPROVAL`, `CNC_QUALIFIED_FORBIDDEN`) | ~51 upper-case code strings (regex-extracted; approximate) | `src/lib/furnispec/validate.js:29` (drilling vs hardware `:415-423`) |
| PartGraph validator (incl. `CNC_QUALIFIED_FORBIDDEN`) | 10 literal codes | `src/lib/partgraph/validatePartGraph.js:16`, `:38-40` |
| Intake gaps (BLOCKING severity) | 9 push sites | `src/lib/conversation/gapAnalysis.js:86`, `:92`, `:105`, `:123`, `:132`, `:148`, `:164`, `:182`, `:188` |
| Wardrobe-model validator (agent path) | 11 codes | `src/lib/wardrobe-model/validator.js:18-195` |
| **System32 drilling gate:** explicit unlock AND `CNC_QUALIFIED` both required. Since `CNC_QUALIFIED` is itself forbidden by both validators, drilling is unreachable | 1 | `src/lib/production/dxfCompiler.js:62-72` |
| System32 boring plan: refuses a `CNC_QUALIFIED` graph; every op `BLOCKED_PENDING_HARDWARE_APPROVAL`, `machineOutput/toolPath: null` | 1 | `src/lib/partgraph/system32Boring.js:11`, `:21-23`, `:40`, `:54-55` |
| Nesting: panel exceeds sheet envelope; unrouted material | 2 | `src/lib/production/nestingCompiler.js:49`, `:55`, `:82` |
| Drawer degenerate geometry | 1 | `emitDrawerBankParts.js:17` (header) |
| Approval validation (id / revision / fingerprint) | - | `src/lib/conversation/approval.js:78-165` |
| Persistence save refusals (fingerprint, spec/graph consistency, compile equality, stored-row re-verification) | 4 | `designService.js:160-172`, `:468-515`, `:533-574`, `:601-620` |

### 5.5 Advisory warnings
| Item | Count | file:line |
|---|---|---|
| PartGraph warnings: `PLINTH_SIDE_INSET_ASSUMPTION`; unsupported component | 2 push sites | `buildStructuralPartGraph.js:899`, `:911` |
| Draft PartGraph validation result carried but never enforced or shown | 1 | `pipeline.js:422`, `:450` |
| Safety notes (draft / pre-approval / approved) | 3 | `pipeline.js:1038`, `:1056`, `:1080` |
| Legacy configurator construction findings (`/api/chat` only, not the AI-wardrobe path) | 6 `warning` + 8 `info` | `api/constructionValidator.js:80`, `:113`, `:126`, `:157`, `:172`, `:198` (warning); `:161`, `:176`, `:184`, `:191`, `:204`, `:210`, `:216`, `:222` (info) |
| Legacy order-modal hardware list: hinge tiers, slide tiers, placeholder handle pack, approximate cam-locks/dowels. Not Bekzod-approved; conflicts with WR-011 | 4 | `index.html:3149-3153`, `:3157-3161`, `:3162`, `:3193-3194` |

**Counts:** approved 45; provisional 18; unapproved/must-ask 2; blocking checks 10 families; advisory 5 families (10 listed sites + 14 legacy construction findings).

### 5.6 Overclaims found (UI / docs)
1. `index.html:540`: landing stat **"CNC / Production-ready"**. This contradicts `CNC: NOT QUALIFIED` (`:676`) and `WORKSHOP REVIEW - NOT CNC QUALIFIED` (`:827`). Owner of fix: Website Engineer (landing patch).
2. `index.html:680`, `:689`, `:690`: menu title "Manufacturing Blueprints & CNC Export", header "Fabrication & CNC", item **"CNC Package (DXF ZIP)"**. The ZIP carries outline and groove layers only; the drill layer is fail-closed and its README states the qualification (`exportBridge.js:197`, `:204`). The label implies a CNC-ready package. Fix via Antigravity label patch.
3. `index.html:3380`: legacy print pack heading **"CNC Cutting List"**. Fix via Antigravity.
4. `index.html:3150-3152`, `:3158-3160`: named Blum hinge/slide SKUs and counts presented as the order hardware list, and sent in WhatsApp text (`:3337-3339`). Not approved; conflicts with WR-011 (5 hinges per door).
5. `index.html:788`: "Final **19-part** PartGraph generated" is hard-coded. A non-golden design can have a different part count.
6. `projectionEngine.js:779` (slides/bottoms line on every sheet, even with no drawers) and `:789` ("ACCURACY: +/-0.5 mm", unqualified). Export Engineer.
7. `projectionEngine.js:870`: the "PDF" export returns `mimeType: "application/pdf"` for what is a print window. The code comment (`:828-829`) and the UI label (`:687`, "Print / Save as PDF") are honest.
- **Hardware drilling:** no positive claim found. The UI states it is blocked (`index.html:740`, `:829-830`). `index.html:569` ("The workshop cuts, drills and assembles") describes workshop labour, which is low risk.
- **STEP support:** **none claimed** in UI or `src/`. STEP appears only as a future item in planning docs (`docs/MASTER_PLAN_2026.md:63`, `:97`; `docs/research/07-furniture-cad-cam-execution-blueprint.md:320`, `:429`, `:509`).
- To check separately: `index.html:3324` (legacy production engine promises "PDF, cut list, DXF set, nesting files..."). This task did not verify `api/production.py`. `:3290` truthfully says release is blocked.

---

## 6. Acceptance identity (saved -> reopened -> displayed -> exported)

**Existing identity fields**
| Link | Field | file:line |
|---|---|---|
| Saved | `design_id`; `revision`; `fingerprint` (fs256 of canonical spec); `furnispec.specId`; `part_graph.sourceSpecId`/`sourceRevision` | migration `:71-82`; `approval.js:44-49`; `buildStructuralPartGraph.js:922-923` |
| Server content digest | `revisionContentDigest` = sha256(canonical `{fingerprint, specId, revision, partGraph, origins, validationStatus}`). Used for idempotent replay; **not stored as a column and not returned to the client** | `designService.js:639-657` |
| Reopened state | `aiWardrobeState.specId` / `revision` / `partGraph` | `index.html:2143-2160`, `:2162-2180` |
| Displayed | Summary: Proposal ID / Revision / Fingerprint (`index.html:753-755`, set at `:2415-2417`). Viewer loads the same `partGraph` (`:2172-2174`) | |
| Exported | Every export reads `getActivePartGraph()` (`:3467-3475`). SVG title block DESIGN ID = `sourceSpecId` (`projectionEngine.js:775-776`); SVG "Rev" is **wrong (always 1)** (`:516`, `:778`); DXF README Source Spec ID (`exportBridge.js:196`); CSV **none** | |

**Is there a PartGraph content hash?** No persisted or exported PartGraph content hash exists. The fs256 fingerprint covers the FurniSpec only. The server digest is internal.

**Proposed minimal check (test-side only, existing data, no schema or production change):**
1. Saved == reopened: `designId`, `revision`, and `fingerprint === fingerprintFurniSpec(reopened spec)` (reuses `approval.js:44`).
2. Reopened == displayed: `aiWardrobeState.revision === spec.revision === partGraph.sourceRevision`; the summary `#revRevision` and `#revFingerprint` equal the stored values; and `serializeCanonicalJson(buildStructuralPartGraph(spec)) === serializeCanonicalJson(stripFinish(getActivePartGraph()))`. This is the same equality the server enforces (`designService.js:567`). `stripFinish` removes only the known client annotation fields (`parts[].customerFinishKey`, `parts[].finishIntent`, `summary.customerFinishKey`, `summary.revision`; `commitMaterialUpdate.js:53-67`).
3. Displayed == exported: `generateCutListCsv(getActivePartGraph())` equals `generateCutListCsv(buildStructuralPartGraph(stored furniSpec))`; the SVG DESIGN ID equals `specId`; and the SVG Rev equals `revision`. That last one **fails today** and is the Export Engineer's gap.
4. For evidence only: record `pgHash = sha256Hex(serializeCanonicalJson(partGraph))` (`fingerprint.js:47` + `src/lib/furnispec/normalize.js`) at save, reopen and export, labelled MOCKED / LOCAL-REAL-DB / HOSTED-DB / LIVE-MODEL. Reuses `tests/browser/export-identity-verifier.spec.js` patterns (`:68`, `:95`, `:125`, `:161`) and harness case `tests/persistence/real-db/cases/06-identity-content-consistency.js`. Owner: Quality Engineer.

---

## 7. Evidence tracks (prepared only; nothing below was run)

Rules: no command here may be run without Bekzod's explicit approval of that run. The scripts load `.env.local` themselves; never print it. Run on Bekzod's machine in the candidate worktree. Afterwards, `git status` must be clean. Revert any tracked report a script rewrites.

### 7.1 REAL AI (live model) - costs money; needs Bekzod approval per run
- Free pre-checks:
  - `npm run check:provider -- --config-only` (config only, no network; `scripts/check-provider-config.mjs:17-18`)
  - `node scripts/verify-live-designer.mjs` (real handler, router, transport and kernel; the **Anthropic service is simulated** via a local `ANTHROPIC_BASE_URL`, `:9-21`; no model call). Its header mentions `--live`, but no argv handling exists at `c6bbe89`, so treat it as simulated-only.
- **Pilot-path live test (PAID, bounded to 3 attempts, local only):** `scripts/live-test-design-propose.mjs` (refuses unless `FURNIAI_LIVE_TEST_AUTHORIZED=yes`, `:16-19`; redacted evidence). Its header records a 2026-09-07 authorization; a new run needs **fresh** approval.
  - PowerShell: `$env:FURNIAI_LIVE_TEST_AUTHORIZED='yes'; node scripts/live-test-design-propose.mjs; Remove-Item Env:FURNIAI_LIVE_TEST_AUTHORIZED`
  - bash: `FURNIAI_LIVE_TEST_AUTHORIZED=yes node scripts/live-test-design-propose.mjs`
  - Sandbox without DNS only: `FURNIAI_LIVE_TEST_AUTHORIZED=yes node scripts/live-test-runner.mjs`
- Agent-path live eval (PAID; `runWardrobeAgent` / `/api/wardrobe/chat`, **not** the pilot `/api/design/propose` path): `npx vitest run tests/wardrobe-ai/evals/live.eval.test.js`. It is skipped unless `ANTHROPIC_API_KEY` is in the process env (`:23`).
- Not available: a browser journey (index.html -> transport -> live model). The Quality Engineer would have to design one on the existing Playwright setup, under the same approval.

### 7.2 REAL HOSTED persistence - needs authorization and a non-Prod Supabase with the migration applied by a human
- Direct DB/RLS verification (`scripts/verify-persistence-db.mjs --target`, `:25-38`: never applies migrations, never creates users, never uses service-role, refuses production hosts). Per `docs/m3/PERSISTENCE_DB_TEST_PROCEDURE.md:22-30`:
  ```bash
  read -rs FURNIAI_DB_TEST_TOKEN_A; export FURNIAI_DB_TEST_TOKEN_A
  read -rs FURNIAI_DB_TEST_TOKEN_B; export FURNIAI_DB_TEST_TOKEN_B
  read -rs FURNIAI_DB_TEST_ANON_KEY; export FURNIAI_DB_TEST_ANON_KEY
  export FURNIAI_DB_TEST_SUPABASE_URL="https://<nonprod-ref>.supabase.co"
  export FURNIAI_DB_TEST_CONFIRM_NONPRODUCTION="<nonprod-ref>.supabase.co"
  export FURNIAI_DB_TEST_PRODUCTION_HOSTS="<prod-ref>.supabase.co"
  node scripts/verify-persistence-db.mjs --target --rounds 20 --writers 6 --json "$TEMP/dbverify-target.json"
  unset FURNIAI_DB_TEST_TOKEN_A FURNIAI_DB_TEST_TOKEN_B FURNIAI_DB_TEST_ANON_KEY
  ```
  PowerShell equivalent: set each secret with `$env:NAME = Read-Host 'NAME'` (not echoed to history), set the three non-secret values as above, run the same `node` line with `--json "$env:TEMP\dbverify-target.json"`, then `Remove-Item Env:FURNIAI_DB_TEST_TOKEN_A, Env:FURNIAI_DB_TEST_TOKEN_B, Env:FURNIAI_DB_TEST_ANON_KEY`.
- HTTP harness through deployed `/api/designs` (`scripts/persistence/run-real-db-harness.mjs --real-db`; gate `tests/persistence/real-db/helpers/env.js:22-54` refuses `VERCEL_ENV=production`, prod-looking URLs and any `SUPABASE_SERVICE_ROLE_KEY`). This needs a **Preview** deployment wired to the non-Prod Supabase, which is a Vercel change outside Grok's permissions (Bekzod/CraZy):
  ```bash
  PERSISTENCE_REAL_DB=1 FURNIAI_TEST_URL="https://<preview-url>" \
  SUPABASE_URL="https://<nonprod-ref>.supabase.co" SUPABASE_ANON_KEY="<read -rs>" \
  TOKEN_A="<read -rs>" TOKEN_B="<read -rs>" \
  node scripts/persistence/run-real-db-harness.mjs --real-db --report "$TEMP/real-db-latest.md"
  ```
  **Always pass `--report` outside the repo.** The defaults rewrite tracked files `tests/persistence/real-db/reports/real-db-latest.md`, `real-db-blocked.md` and (simulated mode) `simulated-latest.md` (`run-real-db-harness.mjs:61-64`, `:129-134`). If one is rewritten, run `git checkout -- tests/persistence/real-db/reports/`.
- Free local alternatives: `node scripts/persistence/run-real-db-harness.mjs --simulated --report "$TEMP/sim.md"` (6/6 SIMULATED at `c6bbe89` per brief). `node scripts/verify-persistence-db.mjs --local` needs `initdb/postgres/psql/postgrest` and a non-root user (`:16-23`), and is likely unavailable on Windows.

---

## 8. Consolidated gap list by owner (for CraZy)
- **Antigravity (patches):** Save wiring (step 5a); reopen state mapping incl. observations/proposal, undefined `updateAiWardrobeSummaryTable`, finish re-apply (step 6b/c); `NEEDS_MORE_DETAIL` dead branch `index.html:2802`; `VALIDATION_FAILED` silent (`:2494-2535`); initial interpretation silent kinds (`:2584-2649`); Undo finish repaint (`:2844-2846`); CNC labels `:680/689/690`, `:3380`; "19-part" text `:788`; publish `designsApiClient`.
- **Claude Code:** finish save-payload contract (step 5b; PROBED); decide draft behaviour on invalid `partGraphValidation`; revision renumbering after Undo past a saved revision (section 4); live-model evidence plan for `/api/design/propose`.
- **Grok Designs Engineer:** My Designs module + `tests/contract/designs-api/**`; `onOpenDesign` handoff; relies on AG's reopen rotating the session (section 2).
- **Grok Export Engineer:** SVG Rev from `sourceRevision`; CSV identity meta (spec id, revision, finish); finish on sheets; the title-block hard-codes.
- **Grok Website Engineer:** `index.html:540` landing overclaim (patch file).
- **Grok Quality Engineer:** acceptance journey 1-7 with the section 6 identity check; Playwright config decision for `tests/acceptance/**`; evidence labels.
- **Bekzod:** agree or amend the Undo definition (section 4); rule on doors-per-bay provenance (`wardrobeRuleCatalog.js:130-136`); approve or decline each paid/hosted run (section 7).