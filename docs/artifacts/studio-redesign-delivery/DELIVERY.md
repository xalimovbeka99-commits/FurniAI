# Studio Interface Redesign — Delivery Package

**Audience:** Integration Lead / Bekzod  
**Scope:** UI redesign delivery packaging only. Not merged to main. Not deployed to Production. Visual design is **not** claimed approved. Accepted 3D geometry authority unchanged.

## SHAs (preserved)

| Role | SHA |
|------|-----|
| Tip (branch HEAD; deployment SHA) | `de5ebec6b2cb920ce0ec66d5a0e84eb144bc9b75` |
| Redesign commit | `d5ea87fea78a83c3cab388ac0ea95219cbde0a8a` |
| Parent baseline | `717d0c3f1bbfa8d399c6fe3cce1cff4e48177baf` |

## Branch / remote push

- **Branch:** `feat/studio-interface-redesign`
- **Push result:** SUCCESS (new branch; non-force)
- **Remote:** https://github.com/xalimovbeka99-commits/FurniAI.git
- **Branch URL:** https://github.com/xalimovbeka99-commits/FurniAI/tree/feat/studio-interface-redesign
- **PR create URL (not opened):** https://github.com/xalimovbeka99-commits/FurniAI/pull/new/feat/studio-interface-redesign

Note: tip already includes later session-guard commits beyond the redesign SHA. Keep UI redesign separate from persistence PR #8 narrative — do not merge this branch into main or into PR #8 from this package.

## Verified bundles (local)

| Bundle | Absolute path | Contained tip |
|--------|---------------|---------------|
| Redesign | `C:\Users\xalim\OneDrive\Documents\FUrniai new\antigravity-studio-interface-redesign.bundle` | `d5ea87fea78a83c3cab388ac0ea95219cbde0a8a` (`feat/studio-interface-redesign`) |
| Session-guard integrated | `C:\Users\xalim\OneDrive\Documents\FUrniai new\antigravity-studio-session-guard-integrated.bundle` | `de5ebec6b2cb920ce0ec66d5a0e84eb144bc9b75` (HEAD) |

Both `git bundle verify` OK. Both require baseline `717d0c3f1bbfa8d399c6fe3cce1cff4e48177baf`.

## Local non-Production preview

- **Build:** `npm run build:legacy` → `dist\` (8 files)
- **Server:** `npx serve dist -l tcp://127.0.0.1:4173 -n` (localhost only)
- **URL:** http://127.0.0.1:4173/
- **Confirmed:** HTTP 200; TCP Listen on `127.0.0.1:4173` only
- **Deployment SHA:** `de5ebec6b2cb920ce0ec66d5a0e84eb144bc9b75`

## Screenshots (this folder)

| File | Source |
|------|--------|
| `desktop-studio.png` | `docs/artifacts/design-with-ai/01-initial-draft-labelled-defaults.png` (1280×720 Studio draft UI) |
| `mobile-390.png` | `docs/artifacts/design-with-ai/07-mobile-390px-layout.png` |
| `mobile-390-keyboard-open.png` | `docs/artifacts/design-with-ai/07b-mobile-390px-keyboard-simulated.png` |

Absolute paths:

- `C:\Users\xalim\OneDrive\Documents\FUrniai new\docs\artifacts\studio-redesign-delivery\desktop-studio.png`
- `C:\Users\xalim\OneDrive\Documents\FUrniai new\docs\artifacts\studio-redesign-delivery\mobile-390.png`
- `C:\Users\xalim\OneDrive\Documents\FUrniai new\docs\artifacts\studio-redesign-delivery\mobile-390-keyboard-open.png`

## (a) Changed files — redesign commit alone (`d5ea87f`)

docs/artifacts/design-with-ai/01-initial-draft-labelled-defaults.png
docs/artifacts/design-with-ai/02-conversational-edit-visible-change.png
docs/artifacts/design-with-ai/03-finish-swatch-change.png
docs/artifacts/design-with-ai/04-undo-restored-state.png
docs/artifacts/design-with-ai/05-rejected-request-design-preserved.png
docs/artifacts/design-with-ai/06-subsequent-valid-edit.png
docs/artifacts/design-with-ai/07-mobile-390px-layout.png
docs/artifacts/design-with-ai/07b-mobile-390px-keyboard-simulated.png
docs/artifacts/design-with-ai/08-mock-vs-ai-badges.png
docs/artifacts/design-with-ai/state-prot-01-reverse-order-resolved.png
docs/artifacts/design-with-ai/state-prot-02-edit-during-in-flight.png
docs/artifacts/design-with-ai/state-prot-03-undo-during-in-flight.png
docs/artifacts/design-with-ai/state-prot-04-design-reset-preserved.png
docs/artifacts/design-with-ai/verifier-01-2000mm-draft-export-identity.png
docs/artifacts/design-with-ai/verifier-02-edit-export-identity.png
docs/artifacts/design-with-ai/verifier-03-undo-export-identity.png
docs/artifacts/design-with-ai/verifier-04-rejected-export-unchanged.png
docs/m2/integ/evidence/f1/01-closed-overview.png
docs/m2/integ/evidence/f1/02-exact-door-open.png
docs/m2/integ/evidence/f1/03-rails-open-closeup.png
docs/m2/integ/evidence/f1/04-material-rails-unchanged.png
docs/m2/integ/evidence/f1/05-narrow-occlusion.json
docs/m2/integ/evidence/f1/05-narrow-viewport.png
docs/m2/integ/evidence/f1/10-customer-draft.json
docs/m2/integ/evidence/f1/11-customer-edit.json
docs/m2/integ/evidence/f1/12-customer-undo.json
docs/m2/integ/evidence/f1/13-unsupported-customer.json
docs/m2/integ/evidence/f1/SOURCE_SHA.txt
index.html

## (b) Changed files — tip vs baseline (`de5ebec` vs `717d0c3`)

.gitignore
ai-designer-transport.js
api/designs/[designId].js
api/designs/[designId]/revisions.js
api/designs/[designId]/revisions/[revision].js
api/designs/index.js
docs/artifacts/design-with-ai/01-initial-draft-labelled-defaults.png
docs/artifacts/design-with-ai/02-conversational-edit-visible-change.png
docs/artifacts/design-with-ai/03-finish-swatch-change.png
docs/artifacts/design-with-ai/04-undo-restored-state.png
docs/artifacts/design-with-ai/05-rejected-request-design-preserved.png
docs/artifacts/design-with-ai/06-subsequent-valid-edit.png
docs/artifacts/design-with-ai/07-mobile-390px-layout.png
docs/artifacts/design-with-ai/07b-mobile-390px-keyboard-simulated.png
docs/artifacts/design-with-ai/08-mock-vs-ai-badges.png
docs/artifacts/design-with-ai/state-prot-01-reverse-order-resolved.png
docs/artifacts/design-with-ai/state-prot-02-edit-during-in-flight.png
docs/artifacts/design-with-ai/state-prot-03-undo-during-in-flight.png
docs/artifacts/design-with-ai/state-prot-04-design-reset-preserved.png
docs/artifacts/design-with-ai/state-prot-05-same-page-reopen-session-guard.png
docs/artifacts/design-with-ai/verifier-01-2000mm-draft-export-identity.png
docs/artifacts/design-with-ai/verifier-02-edit-export-identity.png
docs/artifacts/design-with-ai/verifier-03-undo-export-identity.png
docs/artifacts/design-with-ai/verifier-04-rejected-export-unchanged.png
docs/m2/integ/BACKEND_PERSISTENCE_HANDOFF_cb3047f.md
docs/m2/integ/evidence/f1/01-closed-overview.png
docs/m2/integ/evidence/f1/02-exact-door-open.png
docs/m2/integ/evidence/f1/03-rails-open-closeup.png
docs/m2/integ/evidence/f1/04-material-rails-unchanged.png
docs/m2/integ/evidence/f1/05-narrow-occlusion.json
docs/m2/integ/evidence/f1/05-narrow-viewport.png
docs/m2/integ/evidence/f1/10-customer-draft.json
docs/m2/integ/evidence/f1/11-customer-edit.json
docs/m2/integ/evidence/f1/12-customer-undo.json
docs/m2/integ/evidence/f1/13-unsupported-customer.json
docs/m2/integ/evidence/f1/SOURCE_SHA.txt
docs/m3/DESIGN_PERSISTENCE_API.md
docs/m3/GROK_COORDINATION_REQUEST.md
docs/m3/PERSISTENCE_DB_TEST_PROCEDURE.md
docs/m3/SESSION_ID_CALLING_CONTRACT.md
docs/m3/proposals/SESSION_IDENTITY_GUARD.md
index.html
scripts/make-db-test-payloads.mjs
src/lib/adapters/aiDesignerTransport.js
src/lib/adapters/frontendContract.test.js
src/lib/adapters/liveStateGuardReaders.test.js
src/lib/adapters/sessionIdentityGuard.test.js
src/lib/partgraph/wardrobeModelAdapter.js
src/lib/persistence/auth.js
src/lib/persistence/concurrency.test.js
src/lib/persistence/designService.js
src/lib/persistence/designService.test.js
src/lib/persistence/durableStore.test.js
src/lib/persistence/errors.js
src/lib/persistence/fakePostgrest.js
src/lib/persistence/http.js
src/lib/persistence/index.js
src/lib/persistence/memoryStore.js
src/lib/persistence/saveConsistency.test.js
src/lib/persistence/supabaseStore.js
supabase/migrations/2026-09-22_wardrobe_design_persistence.sql
supabase/schema.sql
tests/browser/design-state-protection.spec.js

## Constraints respected

- Did **not** merge to main
- Did **not** deploy / touch Production
- Did **not** create competing persistence store or rewrite `/api/designs*`
- UI redesign kept separate from persistence PR #8 narrative
- Did **not** claim visual design approved
- Did **not** change accepted 3D geometry authority
