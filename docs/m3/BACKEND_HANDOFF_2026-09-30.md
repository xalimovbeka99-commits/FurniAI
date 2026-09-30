# Backend — handoff, 2026-09-30

**Branch:** `feat/pilot-design-persistence` · **base** `55998dd` (2026-09-24 delivery,
not re-implemented) · **head** = the commit containing this file.
**Delivered as a git bundle** (`claude-backend-2026-09-30.bundle`, prerequisite `55998dd`);
this workspace cannot push. **Not merged. Nothing deployed. No migration applied. No hosted
resource created or changed. No provider call. Zero tokens billed.** Untouched: website
presentation (`index.html`, `styles.css`), furniture rule values, `main`, Production.

| SHA | What |
|---|---|
| `a2bf3ba` | kernel: a declared hanging drop must exist in the compiled carcass; interior parts inside the bay; pipeline refuses instead of throwing; adapter places the rail where the model has it |
| `e7a4f70` | persistence: session-safe save/reopen coordinator (+ `fingerprintFurniSpec` exported from bridge source) |
| `449b134` | one local PostgreSQL stack for both harnesses; Grok's harness 6/6 on real PostgreSQL |
| `d21d219` | browser: late save/reopen answers; unbuildable height refused in the page |
| `2e7031a` | health report: Supabase project ref + whether this deployment accepts the Studio's sign-in |
| `5bd1fe9` | docs + `scripts/live-accept-preview.mjs` (prepared, not run) |
| *(this)* | this handoff |

## 1. Handoff to CraZy, Antigravity, Grok's Designs Engineer

**Read [`STUDIO_SAVE_REOPEN_CONTRACT.md`](./STUDIO_SAVE_REOPEN_CONTRACT.md).** It has the exact
shapes, auth flow, server-assigned ids, the five identities, conflict recovery, and eight
defects in the current Studio candidate with the fix for each. Headline: **D1 is proven in
Chromium** — a save answered after reopening design B rewrites B's stored revision (4 → 1)
and fingerprint; B's next save is then refused as stale. The coordinator
(`AiDesignerTransport.createDesignSaveCoordinator`) discards that answer (browser test 2).

**Ancestry:** the Studio candidate `3ed620c` contains `71e72b6` but none of
`2c7a88f…55998dd` nor this work. Grok `8566d34` = `3ed620c` + harness. Antigravity's
`studio-designs-client` is `3ed620c` + uncommitted files. Scratch integration of all four:
clean merges, bundles rebuild byte-identical, vitest 1401, Grok simulated 6/6, Playwright
12/12 (one intentional expected-failure reproduction).

## 2. Hanging drop / carcass (reported inconsistency) — fixed

[`HANGING_DROP_GEOMETRY.md`](./HANGING_DROP_GEOMETRY.md). Reproduced on `55998dd` (a 5000 mm drop
in a 2300 mm carcass saved; a 1200 mm draft put shelves at Y −572 mm). Rule: rail centre →
upper face of the next part below (rulebook §E datum), exact at 0.1 mm; no new furniture
value; golden byte-identical. Refused atomically for commit, save and export. **Behaviour
change:** default-layout designs below 2004 mm overall height are now refused (they were
previewed with a drop they did not have). Decisions for Bekzod in §4 of that file. Two test
fixtures that declared a drop their own drawer bank removed now declare none; the original
combination is asserted refused.

## 3. Save / reopen identity

Server rules unchanged and re-verified. Client half delivered (coordinator): stored revision
+1 regardless of Undo; server-assigned id adopted only by the session that asked; late
answers `DISCARDED_STALE_SESSION`; saves serialised; lost answer resent identically first;
`STALE_REVISION` → `CONFLICT` with the stored latest, no blind bump; reopen supersession;
"Saved" tied to the change token. FurniSpec validation and compiler equality on every save
and reopen are unchanged and now include the geometry rule.

## 4. Hosted authentication / database — BLOCKED, plan ready

[`HOSTED_NONPROD_AND_AI_RUNTIME_PLAN.md`](./HOSTED_NONPROD_AND_AI_RUNTIME_PLAN.md). No
authorization or credential for a non-production project in this session; egress from here
to `*.supabase.co` / Vercel is refused. **Finding:** the Studio signs in against
`upavdjmovubblowrxncp`; `/api/designs` must verify against the same project or every save is
`401`. Local PostgreSQL evidence (separate tier): `verify-persistence-db --local` 8/8,
50 × 8 writers; Grok's `--real-db` 6/6 via `with-local-stack`.

## 5. AI runtime — configuration only

Local Development pull: Anthropic key present, default model. **Preview not diagnosed** —
the deployed candidate has no zero-cost probe; `/api/design/health` exists only on this
branch. Push → `node scripts/live-accept-preview.mjs --preview <url>` (zero cost). Paid
calls only with explicit authorization (`--live`, ceiling 5). Shipped files contain no
provider or service-role key.

## 6. Bekzod — decisions and actions

1. Push this bundle's branch (or have Grok take it) so a Preview exists; open
   `/api/design/health` on it.
2. Is `upavdjmovubblowrxncp` production? Approve either migrating the two tables there or a
   new non-production project + Preview-scoped `SUPABASE_URL`/`SUPABASE_ANON_KEY` + a
   per-environment Studio auth config (Antigravity).
3. Hanging-drop decisions (low wardrobes: refuse or offer another layout; datum; equality).
4. Paid live AI acceptance: authorize or not, and the budget.

## 7. Gates on the code head

| Gate | Result |
|---|---|
| `npx vitest run` | **1393 passed**, 0 failed, 4 skipped, 20 todo (was 1363) |
| `npm run test:validator` | 21 pass, 0 fail, 3 todo |
| `npm run lint` | exit 0 |
| `npm run docs:check` | valid |
| `npm run build:legacy` | committed bundles reproduce byte-identically |
| `verify-persistence-db.mjs --local` (`e7a4f70`) | 8/8, 50 rounds × 8 writers, PostgreSQL 16.13, PostgREST 12.2.3 |
| Grok `run-real-db-harness.mjs --real-db` via `with-local-stack` | 6/6 (local PostgreSQL, JWT shim) |
| Playwright on scratch integration | `design-state-protection` 5/5, `export-identity-verifier` 4/4, `studio-save-reopen-staleness` 3/3 (test 1 = expected failure documenting D1) |
| Mutation checks | geometry rule disabled → 12/15 new tests fail; coordinator landing guards removed → 2 fail; hanging test on candidate without this branch → fails (1900 mm accepted) |

Browser runs used Chromium 1194 via a local config (`executablePath`); the repo's
`playwright.config.js` expects a different headless-shell build.
