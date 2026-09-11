# F1 readiness report — Grok integration verification

**Date:** 2026-09-11 (Asia/Dubai)  
**Base SHA (start of session):** `b4ed66d935aa9f7b337f785cef2a4d4b79e93dae`  
**Final SHA:** (this commit after report) on `integ/ai-rails-viewer`  
**Draft PR:** https://github.com/xalimovbeka99-commits/FurniAI/pull/3  
**Main/production:** unchanged

## Product behavior (brief)
Design-first, simple language, preserve intent, reversible edits, honest unsupported, preview ≠ manufacturing — enforced as acceptance criteria below.

## F1 journey matrix (exact candidate)

| # | Customer step | Result | Evidence method |
|---|---|---|---|
| 1 | Short description → draft | **UNVERIFIED (live)** | No `.env.local` / Anthropic key in integ worktree. Antigravity journey artifacts exist on `206ee06` but are **not** this SHA. |
| 2 | Entire wardrobe clear | **PASS** | Playwright F1 closed overview |
| 3 | Open exact door touched | **PASS** | Only DOOR_01 open — `02-exact-door-state.json` |
| 4 | Interior rails visible | **PASS** | 2 preview meshes; structural 19 — `03-rails-state.json` + PNG |
| 5 | Change panel finish | **PASS** | Swatch click; rail hex unchanged — `04-*` |
| 6 | Supported dimension/layout edit | **PARTIAL** | Unit/parametric fixtures elsewhere; **no live AI width** on this SHA |
| 7 | Preserve unrelated choices | **PARTIAL** | Material change preserved rails; full layout edit needs live AI |
| 8 | Undo | **FAIL (honest)** | `#btnUndoEdit` in DOM but **not customer-visible** without AI revision — `06-undo-RESULT.txt` |
| 9 | Unsupported request, design kept | **BLOCKED** | Claude M2-OMIT not on remote; PartGraph still silent-drops `DRAWER_BANK`. Edit-schema unit tests cover `unsupported[]` (**simulated**, 9/9 PASS) |
| 10 | Narrow viewport usable | **PASS** | `05-narrow-viewport.png` 390×844 |

## Simulated vs live AI
| Kind | Result |
|---|---|
| Live model through app path | **Not run** (no key; do not spend invalid credentials) |
| Parser / designEditSchema unit | **9/9 PASS** (unsupported payload kept) |
| PartGraph EXP-01 unit | **28/28 PASS** (prior) |
| Playwright F1 viewer | **1/1 PASS** |

## Preview trace
- **Proven URL:** `http://127.0.0.1:4173/#/build/golden-parametric` after `npm run build:legacy` from this worktree  
- **Auth:** none  
- **Vercel:** `https://furniai-builder-git-integ-a4a1ea-xalimovbeka99-commits-projects.vercel.app` (Ready; may require Vercel login — prior experience)  
- Screenshots under `docs/m2/integ/evidence/f1/` stamped with SOURCE_SHA

## Remaining defects (one owner)
1. **Antigravity** — Make Undo customer-visible after an edit; re-verify live draft + width + Undo on `integ/ai-rails-viewer` tip. Sole editor of rail adapter/kernel files.  
2. **Claude** — Land M2-OMIT: PartGraph/FurniSpec fail-closed for unsupported components (no silent drop).  
3. **Grok** — After those land, re-assemble candidate and re-run full F1 including live path.  
4. **BEK** — Unlock Vercel preview auth if remote URL proof required; authorize any main release.

## Recommendation
**F1 viewer/rails/materials/narrow: ready for Bekzod visual review.**  
**F1 complete customer journey: not yet** — blocked on live AI+Undo (Antigravity) and unsupported fail-closed (Claude).

Next smallest useful task: Antigravity live draft→edit→Undo on this tip; Claude M2-OMIT PR; Grok re-verify only.
