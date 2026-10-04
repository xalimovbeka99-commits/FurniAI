# Backend / AI / persistence — handoff, 2026-09-24

**Branch:** `feat/pilot-design-persistence` · **base** `71e72b6` (my previous delivery, already
integrated by Antigravity in `9998853` → `de5ebec`) · **head** = the commit containing this
file; the code head is listed below.
**Not pushed** (push from my environment is refused by the git proxy; not retried).
**Not merged. Nothing deployed. No migration applied. No external resource created. No
provider call made. Zero tokens billed.**

---

## 0. Read first

The brief asked me to continue from `f92dc6b`. The session-guard and validation work it
describes was already delivered on top of it — `06cbdcf`, `57c9d13`, `71e72b6` — and
Antigravity had already integrated it (`de5ebec`). So I **audited that delivery against
the brief and fixed what it still got wrong**, and did not re-implement it. Every fix has a
regression that failed on `71e72b6`.

| SHA | What |
|---|---|
| `2c7a88f` | persistence: a saved revision must be what the **compiler** makes of its spec; CAS on an empty design; reopen re-verifies |
| `91761e8` | persistence: truthful refusals (not-configured ≠ sign-in; auth outage ≠ sign-in); malformed id == nonexistent; server-assigned design ids |
| `5a4450d` | **executable real-PostgreSQL verification**; migration: close the cascade-delete hole, narrow privileges |
| `5cda494` | transport: capture the editing session **at request start**; refuse before the paid call; mojibake in customer text |
| `2ed3063` | AI diagnostics: absent vs empty key per runtime, no provider call |
| *(this)* | docs: API contract, session contract, DB procedure, this handoff |

---

## 1. Session identity (priority 1)

**Already correct on 71e72b6 for the de5ebec caller** — I did not claim that fix again.
What was still wrong:

1. The transport did not capture the session when the request started; it trusted the
   caller's copy. A getter-only caller was refused as "misconfigured" on **every** request.
   Now the transport reads `currentSessionId()` at start and again on landing; `sessionId`
   is an optional cross-check that must match at start.
2. A request issued from a session already left went to the provider anyway. Now refused at
   start, **no provider call**.
3. A half-configured guard was detected only *after* the provider answered — a paid call per
   request, discarded. Now pre-flight.
4. The shipped customer text read *"Your current design is unchanged â€” please ask again."*
   Repaired in source and bundle.

The five identities are asserted separately in `sessionReopenJourney.test.js`: design id,
**stored** revision (not a transport input), **displayed** revision (rewinds on Undo), change
token (monotonic in a session), editing session (new on reopen).

**Browser proof, run this session in real Chromium** on `de5ebec` merged with this branch
(clean merge, bundle byte-identical): `design-state-protection.spec.js` **5/5 pass**, including
test 5 (same-page reopen). **Mutation check:** test 5 with the session arguments removed
**fails** — the delayed answer applies, tokens `1 = 1` — so the test proves the session guard
and does not pass on the change token. `export-identity-verifier.spec.js` **4/4 pass** (it does
not cover reopen from the durable store; nothing in the UI calls `/api/designs` yet).

---

## 2. Persistence accepts only a coherent design (priority 2)

| Case from the brief | On 71e72b6 | Now |
|---|---|---|
| Malformed FurniSpec, correct fingerprint | refused (57c9d13) | refused |
| Individually valid, mismatched FurniSpec/PartGraph — right labels, wrong panel | **stored** | `400 INVALID_PARTGRAPH`, `details.compiledMismatch` names the part |
| — another design's graph relabelled, or identity fields deleted | **stored** | refused |
| Spec that validates but compiles to invalid geometry (30 mm groove in 18 mm panel) | **stored** with a healthy old graph | `400 INVALID_FURNISPEC`, `compiledGraphInvalid` |
| Non-physical dimensions (negative, zero, string, null) | refused by validator | refused, no write |
| Same identity, changed content (provenance / different valid design) | refused (57c9d13) | refused, stored row byte-identical afterwards |
| `expectedPreviousRevision` on a design with no history | **ignored, saved** | `409 STALE_REVISION` |
| A row written straight to PostgREST by its owner (RLS allows it) | **served on reopen** | `409 REVISION_INTEGRITY_FAILED` |

Rule: the server recompiles the submitted spec with the authoritative, pure
`buildStructuralPartGraph` and requires canonical equality. It never stores the recompiled
graph in place of the caller's. Every refusal precedes the write — asserted with a store that
records write attempts, and on the real database.

**For Bekzod, not fixed (a practical rule is yours):** a hanging-rail `targetClearDropMm` of
5000 in a 2300 mm carcass passes the validator **and** the compiler. The minimum-plausibility
gap from G5 (300 mm wardrobe) is also still open.

---

## 3. Concurrency improvements — preserved, and now verified on PostgreSQL (priority 3)

`node scripts/verify-persistence-db.mjs --local` on `71e72b6` itself: **T1–T4 pass** — the
concurrency, retry and isolation work from `96d6b4b` holds on a real database. T5–T7 failed:

- **T5 — the migration let an owner erase history.** `DELETE` on the design → 1 row, revisions
  afterwards 0: `ON DELETE CASCADE` is not subject to RLS. Delete policy removed; privileges
  narrowed. The migration is still unapplied anywhere, so nothing real was exposed.
- **T6** — a malformed id answered `502` (PostgREST `400 22P02`) vs `404` locally; client ids
  were accepted.
- **T7** — a signed-in caller on a deployment without Supabase was told to sign in.

After: **8/8**, 50 rounds × 8 writers. Required `expectedPreviousRevision`, immutable revisions,
accurate race errors (every loser `STALE_REVISION`, never `CONFLICT_REVISION`), idempotent
retries after a genuinely lost response, truthful storage failures: all observed on PostgreSQL.

The duplicate-import fix in `wardrobeModelAdapter.js` is kept (`node -e "import(...)"` works;
lint 0).

---

## 4. Executable database verification (priority 4)

`scripts/verify-persistence-db.mjs` — see its header and `PERSISTENCE_DB_TEST_PROCEDURE.md`.

- **Two-user isolation**: API *and* PostgreSQL (B's token straight at PostgREST).
- **Competing writes**: N separate OS processes, own connections, released at one instant.
- **Lost-response retry**: a proxy lets the save commit and drops the `201`.
- **Durability across independent server processes**: process 1 saves and exits (port then
  refuses); process 2 has a different pid and boot id. **No fixed wait.** Negative control: the
  same journey on the in-memory store returns `404`, so the test can tell durable from not.
- `--local` uses a JWT shim instead of GoTrue — it proves PostgreSQL/PostgREST/RLS, not
  Supabase Auth. `--target` covers Supabase Auth and **has not been run**. It refuses unless the
  non-production host is typed out, never applies SQL, never uses a service-role key, scrubs
  tokens from every line.

One anomaly, reported: in the very first run 1 of 120 race workers printed nothing (the DB
invariant held). Not reproduced in 1,500+ further writers; worker stderr is now captured.

---

## 5. API contract (priority 5) — `DESIGN_PERSISTENCE_API.md`

Rewritten against the code: auth table (401 only for "sign in"; `503 AUTH_UNAVAILABLE`;
`503 PERSISTENCE_NOT_CONFIGURED`), full status/code table with "nothing was written?", the
save-conflict recovery algorithm, and **one answer for hidden, nonexistent and malformed
designs: `404 MISSING_DESIGN`, byte-identical**, verified on the real database.

---

## 6. AI availability (priority 6)

| Runtime | Status | Evidence |
|---|---|---|
| Preview | `503 AI_PROVIDER_NOT_CONFIGURED` as of 2026-09-22. **Not re-probed** — if the keys have since been repaired, the same request would be a paid call. | previous ledger |
| Production | same, same date | previous ledger |
| Local (Bekzod's machine) | **unknown** — the desktop workspace is still down (Windows update); `.env.local` was not moved here | — |

New, zero-cost: `GET /api/design/health` (Preview/local only; plain 404 on Production) and
`npm run check:provider -- --config-only` report per key **absent / empty / whitespace-only /
configured**, the order the router would try and the model id — never a value. That separates
"variable not in this function's environment" (wrong project/scope, no redeploy) from "row
saved with an empty value". No provider/model has been verified as responding; none is
recorded. Neutral `AI` labelling on Production is unchanged. `claude-sonnet-5` as the default
model id was verified on 2026-09-09 and not re-verified since.

---

## 7. Coordination

**Antigravity (you own `index.html`; I own the transport):**
1. `sessionId` is now optional — `currentSessionId` alone is a complete guard. Your de5ebec
   wiring (both) is unchanged in behaviour. New refusal fields: `guardPhase: "request-start"`,
   `sessionNotLiveAtRequest`.
2. Misconfiguration now refuses **before** the provider call; same fields as before.
3. Persistence, when you wire it: never send `designId` on create; handle
   `AUTH_UNAVAILABLE` / `PERSISTENCE_NOT_CONFIGURED` / `REVISION_INTEGRITY_FAILED`; follow the
   recovery algorithm; on a durable reopen call `rotateStudioSession()` before replacing state.
4. A reopen-from-server browser journey does not exist yet and is needed before "durable
   reopen" can be claimed in the product.

**Grok (intake):** take the six commits as a unit or in order; each passes the suite alone.
Merge into `de5ebec` is clean and reproduces the bundle byte-identically. Please re-run, not
trust: `npx vitest run`, `node scripts/verify-persistence-db.mjs --local` (needs a non-root
user plus PostgreSQL and PostgREST binaries), and the two Playwright suites.

**Bekzod — decisions and actions:**
1. Approve (or not) a non-production Supabase project for `--target`.
2. After pushing, open `/api/design/health` on the Preview URL: it will say whether the keys
   are absent or empty there, at no cost.
3. The practical-rule findings in §2.
4. Contract changes above are yours to veto: server-assigned ids, no design delete.

---

## 8. Gates on the code head

| Gate | Result |
|---|---|
| `npx vitest run` | **1363 passed**, 0 failed, 4 skipped, 20 todo (was 1307) |
| `npm run test:validator` | 21 pass, 0 fail, 3 todo |
| `npm run lint` | exit 0 |
| `npm run docs:check` | valid |
| `npm run build:legacy` | committed bundle reproduces byte-identically |
| `verify-persistence-db.mjs --local` | 8/8, 50 rounds × 8 writers |
| Playwright `design-state-protection` + `export-identity-verifier` (de5ebec + this branch) | 5/5, 4/4 |

Untouched: UI, `index.html`, geometry, FurniSpec calculation, compiler, validators, furniture
rule values, `main`, Production.
