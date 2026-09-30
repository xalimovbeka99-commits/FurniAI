# Oct 18 pilot — five-role ownership table

**Branch:** `integ/pilot-oct18-candidate` (worktree `C:\Users\xalim\FurniAI-Grok-Candidate`)
**Written:** 2026-09-30 (Asia/Dubai) by CraZy Integration
**Status:** local only — not pushed, not merged to main, not deployed.

## Candidate SHA lineage

| Step | SHA | What |
|---|---|---|
| Studio base | `3ed620c34bb0005949a7c438c39651898fe2eb37` | Published studio tip (docs-only on `de5ebec6b2cb920ce0ec66d5a0e84eb144bc9b75`, whose parent is merge `99988538` of `d5ea87f` redesign + Claude `71e72b6`) |
| + Claude backend | `55998dd69c35327ff82d3ab2b4cecaac9d26fd5d` (`refs/review/claude-55998dd`) | `71e72b6` + 6 Claude commits: coherent save, truthful refusals, real-Postgres verify scripts + migration SQL, transport session capture, `api/design/health.js` key-absent diagnostics, docs |
| Merge 1 | `ef80acbf82b2f234a969c72b90c6bdd62432c94f` | `integ: merge Claude backend 55998dd ... onto studio 3ed620c` — clean, 31 files |
| + Grok harness | `8566d3464dc9f61491ec36492719b5d1e8d2c06a` (`origin/grok/persist-db-harness`) | 1 commit on `3ed620c`, own test paths only |
| Merge 2 = **engineer base** | `c6bbe894e65adf39fd14ed2f449dcb52a82b228d` | `integ: merge Grok real-DB harness 8566d34` — clean, 17 files |
| This doc | (the commit adding this file) | `docs(integ): Oct 18 five-role ownership table` — docs only |

All four engineer branches start from `c6bbe894e65adf39fd14ed2f449dcb52a82b228d`.

Gates on `c6bbe89` (local, no real DB, no live model): vitest 111 files passed / 1 skipped (live eval, no key); 1363 tests passed, 4 skipped, 20 todo, 0 failed · `node --test tests/validator.test.js` 21 pass / 0 fail / 3 todo · `run-real-db-harness.mjs --simulated` 6/6 PASS (SIMULATED) · `npm run build:legacy` OK (8 files in `dist/`).

## Pilot route facts

- Deployed surface = static root `index.html` built by `scripts/build-static.mjs` (`vercel.json`: `framework: null`, `buildCommand: npm run build:legacy`, `outputDirectory: dist`).
- `dist/` = `index.html`, `app.js`, `styles.css`, `ai-designer-transport.js`, `partgraph-runtime-bridge.js`, `legacy-builder-adapter.js`, `vendor-supabase.min.js`, `vendor-three-r128.min.js`.
- API = root `api/` Vercel functions: `api/designs/index.js`, `api/designs/[designId].js`, `api/designs/[designId]/revisions.js`, `api/designs/[designId]/revisions/[revision].js`, plus `api/design/propose.js`, `api/design/health.js`, `api/chat.js`, `api/wardrobe/chat.js`, `api/production.py`.
- The Next app (`src/app/**`) is **not** deployed on the pilot route.

## Ownership

| Role | Bot ID | Branch / worktree | Owns (write) | Must not edit | Interface dependency | Deliverable |
|---|---|---|---|---|---|---|
| CraZy Integration | `de7eb6b8-2166-455f-978a-9aff104da10a` | `integ/pilot-oct18-candidate` / `FurniAI-Grok-Candidate` | merges, `scripts/build-static.mjs` packaging additions, `vercel.json` only with concrete reason+review, api routing fixes, shared-entry patch application after owner approval | peer feature code | all peers | one combined candidate + gate reruns |
| Designs Engineer | `55b45df1-fec4-43ae-a8db-84a7333bc917` | `grok/my-designs-module` / `FurniAI-Grok-Designs` | `src/lib/designs/myDesigns/**` (UI module), its tests, `tests/contract/designs-api/**` (contract tests vs `api/designs` handlers), `docs/m3/MY_DESIGNS_MODULE.md` | `src/lib/persistence/designsApiClient.js` (real Antigravity, pending publish), `index.html`, session guard, auth backend, `api/designs` handlers, stores | consumes Antigravity's `createDesignsApiClient` `{listDesigns, getDesign, getRevision}` via injection; exposes `onOpenDesign({designId, revision, name})` for Antigravity to wire to `reopenDesignFromApi` | working My Designs module + contract tests + focused `index.html` mount patch for Antigravity |
| Export Engineer | `dbb46488-d11a-4ccd-9823-b9e34ac6382d` | `grok/export-drawing-package` / `FurniAI-Grok-ExportEng` | `src/lib/drawing/projectionEngine.js`, `src/lib/production/exportBridge.js`, `nestingCompiler.js` CSV header/meta only, their tests, print CSS inside `projectionEngine` | `index.html` button labels/`getActivePartGraph` (Antigravity), PartGraph compiler/furniture rules/geometry (Claude), `dxfCompiler` drilling qualification | reads active PartGraph + identity provided by Studio | drawing/print package usable for non-golden, finish change, Undo; label patch 'Print drawings' for Antigravity |
| Website Engineer | `7e8a2c8f-de2b-45c1-8fcd-f57337b76ffa` | `grok/website-visual-system` / `FurniAI-Grok-Website` | `site/website.css` (scoped to landing/nav/catalog/projects shell), `site/*.js` if needed, `docs/m3/WEBSITE_VISUAL_SYSTEM.md`, a focused `index.html` patch file for markup | Studio (`#view-ai`, `#view-builder`), 3D builder, `:root` tokens (Antigravity), `app.js` | Antigravity tokens in `index.html` `:root` | nav/landing/catalog on the approved tokens, 390px + desktop screenshots |
| Quality Engineer | `f87059d5-5925-483c-ad09-46029211e7e1` | `grok/quality-acceptance` / `FurniAI-Grok-PersistTest` | `tests/persistence/real-db/**`, `scripts/persistence/**`, `tests/acceptance/**` (browser journey), `docs/m3/ACCEPTANCE_EVIDENCE.md` | production persistence code, Claude `scripts/db-verify` (coordinate), any feature code | runs on combined candidate | consolidated harness + full browser journey + stale-session/conflict/failure-recovery; evidence labelled MOCKED / LOCAL-REAL-DB / HOSTED-DB / LIVE-MODEL |

## External owners

- **Real Claude Code** = backend / persistence / transport / compiler.
- **Real Google Antigravity** = Studio / UI / labels / session wiring / `index.html` Studio sections / `designsApiClient`.

Grok engineers deliver patch files for anything in an external owner's paths; Integration applies them only after that owner approves.

## Notes

- `origin/fix/ai-export-viewer-identity` (`72b80bb`) is a docs-only handoff on `0d8f312`; it carries no code fix. The `getActivePartGraph()` fix (reads `window.aiWardrobeState.partGraph` first) is already in `3ed620c` via `3987db6` and is therefore in this candidate. Not merged.
