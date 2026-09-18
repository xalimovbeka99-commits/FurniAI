# M2 Baseline Change Package (docs only — no pin refresh)

**Branch:** `integ/m2-integration-lead` (cut from tip `c48e108`; **not** a push to `integ/part-graph-compiler`)  
**Tip SHA:** `c48e108ab779a5b4fe36c8600f1dac38376d74c0`  
**Pin baseline:** F1 freeze `cb5f110627e1df589101f416fb34299ebb092bc0`  
**Fixture:** `tests/wardrobe-production/fixtures/phase1-protected-surfaces.json` (`sha256-normalized-lf`)  
**Date:** 2026-09-18 ~19:30 GST (UTC+4)  
**Author:** Integration lead (Grok Bot) for BEK  
**Policy:** No protected-hash replacement, no main merge, no prod deploy, no CNC unlock.  
**Companion:** `PL006_BOUNDARY.md`, `BROWSER_ACCEPTANCE_CHECKLIST.md`, `CI_FINGERPRINT_FINDINGS.md` (detail)

### What this package asks BEK

Approve or reject **pin refresh** per file below. This is **not** a request to “make CI green” by any other means (revert, skip, force).

### Hash assertion count

Phase 1 suite checks **8** pinned paths. On tip `c48e108`, **5 fail** / **3 match** (`runWardrobeAgent.js`, `FurnitureModel.jsx`, `vercel.json`).  
Prior M2 audit on `c46ba83` cited 4 model/tools fails; AG `f4fd28c` added the 5th (`page.jsx`).  
(If a “6th assertion” was expected beyond these five mismatches: none additional failed in local reconfirm — only these five.)

Local reconfirm: `npx vitest run src/lib/wardrobe-production-verification/phase2Verification.test.js` → 5 failed hash pins.

---

## Per-file baseline rows

### 1. `src/lib/wardrobe-model/schema.js`

| Field | Value |
|---|---|
| **Old fingerprint (expected from test)** | `762db472d86836a8067eeb8471a7500429f2b10fc7ffd81157069998945caf20` |
| **New fingerprint (actual on tip)** | `4017a90e56afc705b675a6877bce200c06602e5609560b6dd26ad634f63b4a03` |
| **Introducing commits** | `f607380` — adversarial conversational drawer fuzz |
| **ORIGINAL AUTHOR (git)** | `xalimovbeka-ui` \<xalimov.beka@gmail.com\> (Integration hop identity) |
| **CURRENT OWNER (role)** | **Claude Code** — wardrobe-model schema/kernel/validator |
| **Behavior changed** | Adds `DEFAULTS.minDrawerBayClearWidthMm = 21 + 15 + 15` (**51**). Arithmetic construction floor for DRAWER_BANK bay clear width (undermount 21 + L/R box sides 15+15). **Not** a usable-drawer product ruling (see PL-006). |
| **Regression evidence (still passes)** | wardrobe-ai Vitest 138+ (incl. drawer wiring/fuzz); production 22; R3F Playwright 7/7 this run; CNC still blocked |
| **BEK approval decision text** | **Approve pin refresh for `schema.js`? Y / N** — Recommended **Y** if M2 DRAWER_BANK path is accepted; **N** means keep CI red or revert this DEFAULT (do not silently skip). |

### 2. `src/lib/wardrobe-model/kernel.js`

| Field | Value |
|---|---|
| **Old fingerprint** | `243b670f6487fc9b05015cbc4c6eb36509400785d6c040317cb1d93674124ed5` |
| **New fingerprint** | `78e520a7dd655b5417e6f93ae5c77454e995a33831d0273242145d2305d3140e` |
| **Introducing commits** | `3373fb5` (wire Add drawers) → hardened `f607380` (fuzz); merge `aedc33a` |
| **ORIGINAL AUTHOR (git)** | `xalimovbeka-ui` (Integration hop) |
| **CURRENT OWNER (role)** | **Claude Code** |
| **Behavior changed** | `planShelfShiftsForDrawerBank`; DRAWER_BANK rejects negative rows (`INVALID_INPUT`); enforces `minDrawerBayClearWidthMm` (`INSUFFICIENT_BAY_WIDTH_FOR_DRAWERS`); over-height → `INSUFFICIENT_VERTICAL_CLEARANCE`; returns `_shiftedShelves`. Gate is **`widthMm < 51`** (exact 51 allowed — see PL-006). |
| **Regression evidence** | Same as above; drawerBank.wiring + drawerConversational.eval PASS |
| **BEK approval decision text** | **Approve pin refresh for `kernel.js`? Y / N** — Recommended **Y** with PL-006 follow-up (boundary exclusivity); **N** = keep red / revert drawer gates. |

### 3. `src/lib/wardrobe-model/validator.js`

| Field | Value |
|---|---|
| **Old fingerprint** | `a7fc020d4d33ec1c3064fe6dfa04ad617013a3905a43db8a978fd8629fd9be80` |
| **New fingerprint** | `1af85fe126a8024f8f1eb5da0f7f985821788c18ec36a52166994602f9aa919e` |
| **Introducing commits** | `f607380` |
| **ORIGINAL AUTHOR (git)** | `xalimovbeka-ui` |
| **CURRENT OWNER (role)** | **Claude Code** |
| **Behavior changed** | Emits `INSUFFICIENT_BAY_WIDTH_FOR_DRAWERS` when section already has DRAWER_BANK and `widthMm < minDrawerBayClearWidthMm`. |
| **Regression evidence** | Validator + wardrobe-ai suites green aside from hash pins |
| **BEK approval decision text** | **Approve pin refresh for `validator.js`? Y / N** — Recommended **Y** (mirrors kernel); **N** = keep red / revert. |

### 4. `src/lib/wardrobe-tools/tools.js`

| Field | Value |
|---|---|
| **Old fingerprint** | `8b927a29d54982dca39006f0a66bb2ecbaae040e663a63482bfaed99f1a10b9a` |
| **New fingerprint** | `3bf272d0e18463b897839df4532c88b8b64e6799dd718653455b383e48c8aa99` |
| **Introducing commits** | `3373fb5` |
| **ORIGINAL AUTHOR (git)** | `xalimovbeka-ui` |
| **CURRENT OWNER (role)** | **Claude Code** (wardrobe-tools) |
| **Behavior changed** | Strips `_shiftedShelves` from stored model; returns `shiftedShelves` on success; `component_add` description documents STRUCTURAL DRAWER_BANK / shelf-shift / clearance fail-closed (CNC still blocked). |
| **Regression evidence** | tools + wardrobe-ai PASS |
| **BEK approval decision text** | **Approve pin refresh for `tools.js`? Y / N** — Recommended **Y**; **N** = keep red / revert. |

### 5. `src/app/builder/page.jsx`

| Field | Value |
|---|---|
| **Old fingerprint** | `a62763f26155ed85c282d5e600f69c32083b1c851e6129e8fd0e13caf984ba00` |
| **New fingerprint** | `e8b04078be00d39d3309e180d14ce412def93b80332d2704ac685805483d8029` |
| **Introducing commits** | `f4fd28c` — Manufacturing & Blueprints action menu / export bridges |
| **ORIGINAL AUTHOR (git)** | Bekzod Khalimov \<xalimov.beka99@gmail.com\> (`xalimovbeka99-commits`) |
| **CURRENT OWNER (role)** | **Antigravity** — customer Builder UI / export toolbar |
| **Behavior changed** | Imports `ExportMenu`; places it in header beside Ask AI. No Environment/camera/panel layout change in this delta. |
| **Regression evidence** | R3F Playwright **7/7 PASS** this run (local Next build); ExportMenu is Next builder surface |
| **BEK approval decision text** | **Approve pin refresh for `page.jsx`? Y / N** — Recommended **Y** if export toolbar is intentional on M2 tip; **N** = keep red / revert ExportMenu wiring only. |

---

## Aggregate recommendation (not auto-applied)

| File | Recommend pin refresh |
|---|---|
| schema.js | **Y** |
| kernel.js | **Y** (with PL-006 exclusivity follow-up) |
| validator.js | **Y** |
| tools.js | **Y** |
| page.jsx | **Y** |

Hashes must be rewritten **only after explicit BEK Y** per file (or a single written blanket Y listing these five). Until then CI Phase 1 pins stay red by design.

---

## Release checklist — keep OPEN until verified resolved

| ID | Item | Status |
|---|---|---|
| RC-STALE | Stale-response / changeToken + design-id guard (see `ANTIGRAVITY_STALE_GUARD_HANDOFF.md`) | **OPEN — keep on checklist until independently re-verified on tip** |
| RC-DIM | Drawing-dimension findings (SVG dimension `<text>` / shop-drawing correctness residuals) | **OPEN — keep on checklist until independently re-verified on tip** |
| RC-F1-DRAWERS | Static F1 “Add drawers” browser path vs STRUCTURAL Vitest path | **OPEN** (prior audit 4/5 F1; parser green) |
| RC-PL006 | PL-006 usable width vs 51 mm construction floor | **OPEN** — see `PL006_BOUNDARY.md` |
| RC-CNC | CNC / System32 | **BLOCKED** (unchanged) |

---

## Explicit non-goals

- Do not refresh `phase1-protected-surfaces.json` in this branch without BEK Y text.  
- Do not push/reset `integ/part-graph-compiler` (AG dirty worktree risk).  
- Do not merge main / deploy production / unlock CNC.
