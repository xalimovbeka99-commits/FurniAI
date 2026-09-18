# CI Fingerprint Findings — Phase 1 protected surfaces

**Status:** DOCS ONLY — hashes **not** refreshed (BEK gate)  
**Date:** 2026-09-18 ~19:21 GST (UTC+4)  
**Tip:** `c48e108ab779a5b4fe36c8600f1dac38376d74c0` on `integ/part-graph-compiler` (PR #6)  
**Pin baseline:** F1 freeze `cb5f110627e1df589101f416fb34299ebb092bc0` (`integ/f1-claude-handoff`)  
**Fixture:** `tests/wardrobe-production/fixtures/phase1-protected-surfaces.json`  
**Algorithm:** `sha256-normalized-lf` (CRLF → LF before hash)  
**Checkout used for this report:** isolated integ clone mirroring Claude-Handoff tip (peer AG/Candidate/Grok trees untouched)

**CI context:** GitHub Actions run [35018071571](https://github.com/xalimovbeka99-commits/FurniAI/actions/runs/35018071571) — `Engineering safety net` **FAILURE** on tip `c48e108`. Local reconfirm: `npx vitest run src/lib/wardrobe-production-verification/phase2Verification.test.js` → **5 failed** hash pins / 9 passed / 12 todo.

**Policy:** Do **not** edit `phase1-protected-surfaces.json` without explicit BEK approval. CNC remains **BLOCKED**. No main merge.

---

## Summary matrix

| File | Owner (role) | Expected (pin) | Received (`c48e108`) | Introducing commit(s) vs `cb5f110` | Recommended next action |
|---|---|---|---|---|---|
| `src/lib/wardrobe-model/schema.js` | Claude | `762db472…5caf20` | `4017a90e…3b4a03` | `f607380` | **BEK-approved pin refresh** (intentional DRAWER_BANK bay-width constant) — not revert |
| `src/lib/wardrobe-model/kernel.js` | Claude | `243b670f…124ed5` | `78e520a7…5d3140e` | `3373fb5`, `f607380` (+ merge `aedc33a`) | **BEK-approved pin refresh** (drawer shelf-shift + fail-closed clearance) — not revert |
| `src/lib/wardrobe-model/validator.js` | Claude | `a7fc020d…d9be80` | `1af85fe1…aa919e` | `f607380` | **BEK-approved pin refresh** (bay-width gate for DRAWER_BANK) — not revert |
| `src/lib/wardrobe-tools/tools.js` | Claude | `8b927a29…a10b9a` | `3bf272d0…8c8aa99` | `3373fb5` | **BEK-approved pin refresh** (expose `_shiftedShelves` + tool description) — not revert |
| `src/app/builder/page.jsx` | Antigravity | `a62763f2…84ba00` | `e8b04078…3d8029` | `f4fd28c` | **BEK-approved pin refresh** (ExportMenu toolbar) — not revert |

**Still MATCH at tip:** `runWardrobeAgent.js`, `FurnitureModel.jsx`, `vercel.json`.

> Note: M2 pre-merge audit on `c46ba83` cited **4** hash fails (model + tools). Tip `c48e108` also includes AG `f4fd28c` → **5th** mismatch on `page.jsx`. Document all five; do not silently pin-refresh any of them.

---

## Behavioral diffs vs pin baseline `cb5f110`

### 1. `src/lib/wardrobe-model/schema.js` — Claude

- **Expected:** `762db472d86836a8067eeb8471a7500429f2b10fc7ffd81157069998945caf20`
- **Received:** `4017a90e56afc705b675a6877bce200c06602e5609560b6dd26ad634f63b4a03`
- **Introduced by:** `f607380` — `test(wardrobe-ai): adversarial conversational drawer fuzz + multi-turn revision` (author `xalimovbeka-ui`)
- **Behavior change:** Adds `DEFAULTS.minDrawerBayClearWidthMm = 21 + 15 + 15` (undermount deduction + L/R drawer-box side walls) so DRAWER_BANK placement can fail-closed on too-narrow bays. No other DEFAULTS / enums changed in this delta.

### 2. `src/lib/wardrobe-model/kernel.js` — Claude

- **Expected:** `243b670f6487fc9b05015cbc4c6eb36509400785d6c040317cb1d93674124ed5`
- **Received:** `78e520a7dd655b5417e6f93ae5c77454e995a33831d0273242145d2305d3140e`
- **Introduced by:** `3373fb5` (wire conversational Add drawers) then hardened in `f607380` (adversarial fuzz); merge commit `aedc33a` carries the same lineage
- **Behavior change:**
  - New `planShelfShiftsForDrawerBank` — overlapping / landing-zone shelves auto-shift above the bank with `minShelfClearanceMm`; fails `INSUFFICIENT_VERTICAL_CLEARANCE` if interior cannot absorb the stack (hanging rails never auto-moved).
  - `component_add` DRAWER_BANK: rejects negative `rows` (`INVALID_INPUT`); enforces `minDrawerBayClearWidthMm` (`INSUFFICIENT_BAY_WIDTH_FOR_DRAWERS`); rejects bank taller than interior (`INSUFFICIENT_VERTICAL_CLEARANCE`).
  - Returns optional `_shiftedShelves` metadata for tool/agent surfaces.
- **~+98 / −5 lines** vs pin.

### 3. `src/lib/wardrobe-model/validator.js` — Claude

- **Expected:** `a7fc020d4d33ec1c3064fe6dfa04ad617013a3905a43db8a978fd8629fd9be80`
- **Received:** `1af85fe126a8024f8f1eb5da0f7f985821788c18ec36a52166994602f9aa919e`
- **Introduced by:** `f607380`
- **Behavior change:** When a section already contains DRAWER_BANK(s) and `section.widthMm < minDrawerBayClearWidthMm`, emits `INSUFFICIENT_BAY_WIDTH_FOR_DRAWERS` issues (mirrors kernel gate for committed models).

### 4. `src/lib/wardrobe-tools/tools.js` — Claude

- **Expected:** `8b927a29d54982dca39006f0a66bb2ecbaae040e663a63482bfaed99f1a10b9a`
- **Received:** `3bf272d0e18463b897839df4532c88b8b64e6799dd718653455b383e48c8aa99`
- **Introduced by:** `3373fb5`
- **Behavior change:** `commit()` strips `_shiftedShelves` from the stored model and surfaces `shiftedShelves` on successful tool results. `component_add` description documents STRUCTURAL DRAWER_BANK / PartGraph emission, shelf-shift policy, and `INSUFFICIENT_VERTICAL_CLEARANCE` (CNC drilling still blocked).

### 5. `src/app/builder/page.jsx` — Antigravity

- **Expected:** `a62763f26155ed85c282d5e600f69c32083b1c851e6129e8fd0e13caf984ba00`
- **Received:** `e8b04078be00d39d3309e180d14ce412def93b80332d2704ac685805483d8029`
- **Introduced by:** `f4fd28c` — `feat(ui): wire Manufacturing & Blueprints action menu and export bridges` (author Bekzod Khalimov / AG export UI path)
- **Behavior change:** Imports `ExportMenu` and places it in the builder header beside Ask AI / Hide AI. No camera, Environment, or panel layout change in this delta (~+11 / −7).

---

## Recommended BEK decision

1. **Prefer pin refresh (not revert)** for all five files — deltas implement approved M2 drawer STRUCTURAL path + export toolbar; reverting would undo conversational DRAWER_BANK and Manufacturing/Blueprints UI.
2. On BEK approval only: recompute `sha256-normalized-lf` at tip SHA, update `phase1-protected-surfaces.json` `files` entries, append `justifiedBaselineUpdates` rows citing this doc + tip SHA, re-run Phase 1 hash suite + full Vitest.
3. Until then: keep CI red on these pins; treat as **known / documented** residual on PR #6.
4. **Out of scope here:** CNC unlock, main merge, moving `cb5f110`, or refreshing hashes without BEK.

---

## Reproduction

```text
# isolated tip (do not touch peer worktrees)
git fetch origin integ/part-graph-compiler
git rev-parse HEAD   # expect c48e108ab779a5b4fe36c8600f1dac38376d74c0
node -e '/* compare fixture hashes vs working tree */'
npx vitest run src/lib/wardrobe-production-verification/phase2Verification.test.js
git diff cb5f110627e1df589101f416fb34299ebb092bc0 -- \
  src/lib/wardrobe-model/schema.js \
  src/lib/wardrobe-model/kernel.js \
  src/lib/wardrobe-model/validator.js \
  src/lib/wardrobe-tools/tools.js \
  src/app/builder/page.jsx
```
