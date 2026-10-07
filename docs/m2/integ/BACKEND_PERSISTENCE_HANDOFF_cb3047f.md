# Backend handoff — feat/pilot-design-persistence

**Branch:** `feat/pilot-design-persistence`  
**SHA:** `cb3047f4134a3cf92a23b6b5beae322c1fa3d85b`  
**Base:** `integ/pilot-final-candidate` @ `717d0c3`  
**Date:** 2026-09-22 (Asia/Dubai)

## Phase 1 — vs Claude `223094e`

Pilot tip already ahead: `invalidLiveStateGuardResult`, neutral provider `ai`, `commitMaterialUpdate.js`, `frontendContract.test.js`.  
This branch additionally fail-closes **unreadable** live-state getters as `STALE_REVISION` (was fail-open via non-finite → false).

## Phase 2 — live provider

**PENDING.** `.env.local` not yet present on Integration checkout. Bekzod will configure local path. No live Anthropic calls made. Ask before any paid call.

## Phase 3 — persistence

- Library: `src/lib/persistence/*` (memory store + designService)
- API: `POST/GET /api/designs`, `GET /api/designs/:id`, `GET/POST .../revisions`, `GET .../revisions/:rev`
- Schema: `wardrobe_designs` + immutable `wardrobe_revisions` in `supabase/schema.sql`
- Contract for Antigravity: `docs/m3/DESIGN_PERSISTENCE_API.md`
- Tests: 7 persistence + contract/stale suites green (44 tests in focused run)

## Limitations

- Default runtime store is **in-memory** (process-local). Supabase tables are schema-ready; wire `FURNIAI_DESIGN_STORE=supabase` adapter still TODO for multi-instance Preview.
- No UI. Undo stays client-side.
- No Production deploy / main merge.
- Live Anthropic evidence not collected yet.

## For Grok (Integration Lead)

Ready for review on `cb3047f`. After Preview wiring + live evidence, decide Vercel Preview readiness.