# M2 Baseline Change Package (docs only — no pin refresh)

**Branch:** `integ/m2-integration-lead`  
**Combined tip (post Claude 927c071 + e47c205 reconcile):** `9addc8e0aa00cf86367d83ac131c6ebab0869fb9`  
**Start baseline:** `3fab34a70cbeed90c2480de355bf57a9457d4cfe`  
**Merged reproduction:** `e47c2058f97dcfcf6db199b095ac588e9ae94abe`  
**Claude PL-006 SoT:** `927c071db8ce221589c60beec899f02bad67f4c9`  
**Claude bundle (REVIEW ONLY):** `d80f1d309297f1c167cec69eb6bccc76f26c4b16` — drawerPack NOT merged  
**AG boot/menu:** `30b2fe9` / `bdafb42` + mobile test from `c51af19`  
**Pin baseline (unchanged):** `cb5f110627e1df589101f416fb34299ebb092bc0`  
**Date:** 2026-09-18 ~20:05 GST (UTC+4)  
**Policy:** No protected-hash replacement, no main/prod, no CNC unlock.

### Compiler decision
**emitDrawerBankParts** authoritative. See `DRAWER_COMPILER_DECISION.md`.

### PL-006 engineering (not furniture-rule approval)
`DEGENERATE_DRAWER_GEOMETRY` at source; exclusive `W<=51` customer gate; SVG via validatePartGraph; DXF/CSV/nesting refuse. 50.9/51.0/51.1 covered. Not BEKZOD_APPROVED usable width.

### Proposed fingerprints (normalized LF sha256) — DO NOT refresh fixtures yet

| File | New sha256-normalized-lf |
|---|---|
| `src/lib/wardrobe-model/schema.js` | `cdbbc49cc414250730fc2f46006da9eaa2689d4232a44ed1badf30a323340c22` |
| `src/lib/wardrobe-model/kernel.js` | `0f7ffa171d8e571b03baa050f02f4f102e7c14df51cd311574485837facac84b` |
| `src/lib/wardrobe-model/validator.js` | `783d9ebf68b763e4bc6b6c600c9463365b5f2270d98ba0f2ae55d118bc6c1af8` |
| `src/lib/partgraph/emitDrawerBankParts.js` | `98c14f745bb97028e56d322cb6c630c7344aae24631571285bdfd3b3a61098d7` |
| `src/lib/partgraph/wardrobeModelAdapter.js` | `82384d20a236a974ebcec34770f8bf518ae2211e43da186d4ea4d83bf2a033c0` |
| `src/lib/drawing/projectionEngine.js` | `d0305c6fc0e08b22c2e8df42810dea4315edacb171a5780a9ce68afcbcfbb728` |
| `src/lib/production/dxfCompiler.js` | `3024cbaec27c7673385ccbdaf1f23db1b647b1b91cb6a4256814752d6d08cf87` |
| `src/lib/production/nestingCompiler.js` | `75716016a89abfb2d6c07ce84113a687bdee24f76cfb38469617717c472a1368` |

Fingerprint refresh **PENDING** BEK. Prior per-file rows retained below for history.

### Evidence classes (separate)

| Class | Result on combined tip |
|---|---|
| Parser/unit Vitest (PL-006 + exporters + drawer wiring + conversational) | **156 passed** (focused 14 files) |
| Browser static Builder — mfg-nesting (+mobile) | **3 passed** |
| Browser F1 journey | **5 passed** (incl. Add drawers STRUCTURAL) |
| Browser Next R3F | **7 passed** |
| AG prior local Playwright | Reported only; re-run above supersedes for this SHA |
| Live provider | Not claimed |

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
| **Behavior changed** | `planShelfShiftsForDrawerBank`; DRAWER_BANK rejects negative rows (`INVALID_INPUT`); enforces `minDrawerBayClearWidthMm` (`INSUFFICIENT_BAY_WIDTH_FOR_DRAWERS`); over-height → `INSUFFICIENT_VERTICAL_CLEARANCE`; returns `_shiftedShelves`. Gate is **`widthMm <= 51`** exclusive (exact 51 rejected — PL-006 engineering close on combined tip). |
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
| **Behavior changed** | Emits `INSUFFICIENT_BAY_WIDTH_FOR_DRAWERS` when section already has DRAWER_BANK and `widthMm <= minDrawerBayClearWidthMm` (exclusive floor). |
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
