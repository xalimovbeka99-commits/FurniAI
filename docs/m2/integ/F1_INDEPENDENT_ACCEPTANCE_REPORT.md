# F1 independent acceptance report (FurniAI Integration Lead)

**Date:** 2026-09-13 (Asia/Dubai, ~19:25 GST)  
**Checkout:** `C:\Users\xalim\FurniAI-F1-Candidate`  
**Branch:** `test/adversarial-qa-security-f1`  
**Candidate SHA:** `9a9bf6355fecdd36bf3604ae2cb2f7f63be0fcf6` (verified `git rev-parse HEAD`; not reset; not newer)  
**Explicit:** **no merge / no deploy / main untouched**. FurniAI-Integration / FurniAI-Grok worktrees not disturbed. Claude parser / Antigravity renderer not rewritten.

## Included agent / lineage SHAs (from checkpoint docs + git log)

| Role | SHA | Notes |
|---|---|---|
| Candidate tip (this acceptance) | `9a9bf63…` | docs(f1) adversarial QA/security evidence |
| Final engineering (relay harness) | `6d78e26` | anthropicRelay harness + locks |
| Security gates base | `b3288bf` | fail-closed hanging/shelf/panel gates |
| Claude reconciled boundary | `e163a3d` | retained unsupported boundary (negation / light oak) |
| Claude original boundary | `8a865cf` | pre-reconcile |
| Production `main` tip | `dc94bda` | older than candidate — see production URL |

## CI

- Link: https://github.com/xalimovbeka99-commits/FurniAI/actions/runs/34759584351  
- Head SHA: `9a9bf6355fecdd36bf3604ae2cb2f7f63be0fcf6`  
- Conclusion: **success** (2026-09-13 13:20–13:21 UTC / 17:20–17:21 GST)  
- Job: **Engineering safety net** — docs:check, golden/parametric/ai-wardrobe demos, test:validator, **Vitest unit**, **lint**  
- **Playwright not in CI** (local only)

## Local totals (this acceptance)

| Check | Result |
|---|---|
| `npx vitest run` | **994 passed**, 4 skipped, 20 todo, **0 failed** (78 files passed \| 1 skipped) |
| `npm run lint` | PASS (exit 0) |
| `npm run docs:check` | PASS |
| `npm run build:legacy` | PASS (8 static files → `dist/`) |
| `npm run test:browser:f1` | First full run: **3 passed / 2 failed** (unsupported waitForFunction 20s flake + cascade connection refused). Isolated unsupported retry: **2/2 PASS**. Clean full rerun: **5/5 PASS** (~1.6m) |

## Evidence lanes

| Lane | Status |
|---|---|
| **A** parser-only | **PASS** — Vitest unsupported/finish/outcomes + Playwright TEST SETUP transport-disabled draft/edit/Undo |
| **B** simulated provider | **PASS** — wardrobe-ai evals + simulatedFailover + manualAcceptance (mocked SDK boundary) |
| **C** live provider | **UNVERIFIED** — `live.eval.test.js` skipped (no API key in suite); credential not exercised |
| **D** browser | **PASS** (5/5 clean rerun) with noted first-run flake on unsupported assistant wait |
| **E** workshop | **CNC NOT QUALIFIED** / **drilling BLOCKED** / WORKSHOP REVIEW visible — **NOT QUALIFIED** for CNC; drilling **BLOCKED** |

## Path A vs Path B + five rules

Confirmed still documented in `docs/m2/qa/F1_ADVERSARIAL_QA_SECURITY_EVIDENCE.md`:

- **Path A** (wardrobe-model/tools): five physical gates **ENFORCED**
- **Path B** (FurniSpec → PartGraph → customer design): same five **NOT ENFORCED** equivalently
- All five remain **PROVISIONAL_PREVIEW_RULE** (none `BEKZOD_APPROVED`)

## Acceptance matrix (items 1–12)

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Design with AI nav | **PASS** | customer-path Playwright + `16-independent-acceptance.json` → `#/build/ai-wardrobe` |
| 2 | Short-description draft | **PASS** | draft 1800×2400×600, rev 1, 19 structural / 2 preview |
| 3 | Supported width edit | **PASS** | 1800→2000, revision bump |
| 4 | Finish change without losing layout | **PASS** | material swatch → walnut; envelope/bays/doors/structural/rails unchanged (`howTested` in 16-*) |
| 5 | Undo order | **PASS** | customer-path Undo identity+materialCode; independent script rev 2→1 |
| 6 | Unsupported → assistant explanation (not customer msg) + design unchanged | **PASS** | `13-unsupported-customer.json` + negative-proof test; assistant text matches /drawer/+/can't/ |
| 7 | Another valid edit after rejection | **PASS** | After drawers refuse, width chip applies (`17-valid-after-reject.json`). Note: shelf chip itself also refuses with assistant alternative — still a valid recovery via width |
| 8 | Exact door operate via pointer (no forced state) | **PASS** | `02-exact-door-*.png/json` |
| 9 | Rails remain preview objects | **PASS** | preview=2, structural=19, `isPreviewMesh` |
| 10 | Desktop + 390px mobile | **PASS** desktop / **NEEDS FIXES** mobile | `14-acceptance-desktop.png`; `05-narrow-*` + `15-acceptance-mobile-390.png` — Antigravity |
| 11 | Save / reopen | **UNVERIFIED** | Save control present; product does not claim F1 durable reopen |
| 12 | Workshop badges (CNC / drilling) | **PASS** (qualified as blocked) | CNC NOT QUALIFIED + HARDWARE DRILLING BLOCKED visible |

## Desktop / mobile evidence paths

- Desktop: `docs/m2/integ/evidence/f1/01-closed-overview.png`, `14-acceptance-desktop.png`, door/rails/material set `02–04-*`
- Mobile 390px: `docs/m2/integ/evidence/f1/05-narrow-viewport.png`, `15-acceptance-mobile-390.png` (+ `05-narrow-RESULT.txt` = NEEDS FIXES)
- SOURCE_SHA: `docs/m2/integ/evidence/f1/SOURCE_SHA.txt` = `9a9bf63…`

## Production preview URL

- https://furniai-topaz.vercel.app — marketing/landing content loads; **production `main` tip `dc94bda` is older than F1 candidate `9a9bf63`**. Candidate features require **local static preview** (Playwright `scripts/static-server.js` / `dist`), not this production URL.

## Remaining issues (one owner each)

1. **Mobile usable wardrobe UI** — **NEEDS FIXES** — owner: **Antigravity**
2. **Live provider end-to-end** — **UNVERIFIED** — owner: **Bekzod** (API credential / explicit live run)
3. **Save/reopen persistence** — **UNVERIFIED** — owner: **Product / Antigravity** (no F1 claim)
4. **Playwright unsupported assistant wait flake** (20s `waitForFunction` under full-suite load) — owner: **Grok / Integration** (harden wait / stabilize; first run failed, clean rerun passed)
5. **Five physical rules still PROVISIONAL_PREVIEW_RULE; Path B does not mirror Path A** — owner: **Bekzod** (approval) + **Claude/security** (Path B parity if required)
6. **Shelf chip “Add shelf on left” refuses on Golden long-hanging layout** — owner: **Claude / product copy** (chip vs manufacturing slice mismatch; recovery via width still works)

## Recommendation

**Ready for Bekzod approval review of the F1 candidate tip `9a9bf63`** with residuals explicitly listed (mobile NEEDS FIXES, live UNVERIFIED, save/reopen UNVERIFIED, Path A/B provisional rules).  

**Not ready to merge or deploy to `main` / production.** Stay on F1. No merge/deploy performed in this acceptance.
