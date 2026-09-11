# F1 readiness report — Grok integration verification

**Date:** 2026-09-11 (Asia/Dubai)  
**Candidate tip:** `90e3e84` (+ this readiness/test commit) on `integ/ai-rails-viewer` (plus follow-up commits stamped below if any)  
**Draft PR:** https://github.com/xalimovbeka99-commits/FurniAI/pull/3  
**Main / production:** unchanged

## Product behavior (brief)
Design-first, simple language, preserve intent, reversible edits, honest unsupported, preview ≠ manufacturing — enforced as acceptance criteria below.

## Draft path definitions (do not conflate)

| Path | What it is | Needs API key? |
|---|---|---|
| **Local / parser draft** | `PartGraphBridge.previewDraftWardrobe` via **Generate Draft Preview** | **No** |
| **Local / parser edit** | `PartGraphBridge.applyConversationalEdit` (fallback when live transport absent) | **No** |
| **Live model** | `AiDesignerTransport.proposeDesignChange` (and any live draft path) | **Yes** |

Missing `.env.local` / Anthropic key must **not** block local draft verification.

## F1 journey matrix (exact candidate)

| # | Customer step | Result | Evidence method |
|---|---|---|---|
| 1a | Short description → **local** draft | **PASS** | Playwright `local parser` on `#/build/ai-wardrobe` — Generate Draft Preview (no API key) — evidence `07-local-draft.json` |
| 1b | Short description → **live** draft | **UNVERIFIED** | No key in integ worktree; do not invent credentials |
| 2 | Entire wardrobe clear | **PASS** | Playwright closed overview |
| 3 | Open exact door touched | **PASS** | Only DOOR_01 open — `02-exact-door-state.json` |
| 4 | Interior rails visible | **PASS** | 2 preview meshes; structural 19 — `03-rails-state.json` + PNG |
| 5 | Change panel finish | **PASS** | Swatch click; rail hex unchanged — `04-*` |
| 6a | Supported edit (**local parser**) | **PASS** | Refine chip with `AiDesignerTransport` nulled → width 2000 — `08-local-edit.json` |
| 6b | Supported edit (**live model**) | **UNVERIFIED** | Needs live key |
| 7 | Preserve unrelated choices | **PARTIAL** | Material keeps rails chrome; full layout+intent needs live proof |
| 8a | Undo after successful **local** edit | **PASS** | `#btnUndoEdit` visible after width edit; restore width/revision — `09-local-undo.json`, `06-undo-RESULT.txt` |
| 8b | Undo after successful **live** edit | **UNVERIFIED** | Needs live key + Antigravity mobile/Undo UX polish |
| 9 | Unsupported request, design kept | **BLOCKED** | Claude M2-OMIT not on remote; PartGraph still silent-drops `DRAWER_BANK`. Edit-schema unit tests cover `unsupported[]` (simulated, 9/9 PASS) |
| 10 | Narrow viewport usable wardrobe | **NEEDS FIXES (Antigravity)** | 390×844 canvas can render (`05-narrow-viewport.png`) but **do not mark PASS** for usable mobile wardrobe UI. Needs compact status badge, usable framing, collapsible bottom panel, hide drawer controls when no drawers. |

## Simulated vs live AI

| Kind | Result |
|---|---|
| Live model through app path | **Not run** (no key) |
| Local Generate Draft Preview | **PASS** (Playwright) |
| Local refine chip → Undo | **PASS** (Playwright) |
| Parser / designEditSchema unit | **9/9 PASS** (unsupported payload kept) |
| PartGraph EXP-01 unit | **28/28 PASS** (prior) |

## Preview trace
- **Proven URL:** `http://127.0.0.1:4173/#/build/golden-parametric` after `npm run build:legacy` from this worktree  
- **Auth:** none  
- **Vercel:** `https://furniai-builder-git-integ-a4a1ea-xalimovbeka99-commits-projects.vercel.app` (Ready; may require Vercel login)  
- Screenshots under `docs/m2/integ/evidence/f1/` stamped with `SOURCE_SHA`

## Remaining defects (one owner)
1. **Antigravity** — Mobile/narrow UX (NEEDS FIXES); draft→supported edit→**visible Undo** restore design+material; every door individually + oblique view. Compact status badge; collapsible bottom panel; hide drawer controls if no drawers. Sole editor of rail adapter/kernel files after handoff.
2. **Claude** — Land M2-OMIT: PartGraph/FurniSpec fail-closed for unsupported components (no silent drop).
3. **Grok** — After those land, re-assemble candidate and re-run full F1 including live path.
4. **BEK** — Unlock Vercel preview auth if remote URL proof required; authorize any main release.

## Recommendation
**F1 rails/materials/exact-door viewer: ready for Bekzod visual review on desktop.**  
**F1 complete customer journey: not yet** — mobile NEEDS FIXES (Antigravity), live Undo UNVERIFIED, local Undo PASS, unsupported BLOCKED (Claude), live AI UNVERIFIED.

Next smallest useful task: Antigravity mobile + Undo visibility after edit on this tip; Claude M2-OMIT PR; Grok re-verify only. Stay on F1.

