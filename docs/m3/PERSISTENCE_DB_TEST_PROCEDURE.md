# Real-database test procedure — durable save/reopen

**Status (2026-09-24):**

| What | Status |
|---|---|
| Executable harness `scripts/verify-persistence-db.mjs --local` — real PostgreSQL 16.13 + PostgREST 12.2.3, the committed migration, real handlers in separate OS processes | **RUN: 8/8 PASS** on the backend branch head; on `71e72b6` it found 3 failures, all fixed. Evidence: `docs/m3/evidence/` |
| Same harness, `--target` against an approved non-production Supabase project | **NOT RUN** — needs Bekzod's approval, a project, the migration applied by a human, two test users |
| The manual steps below | **NOT RUN** |

No Supabase project, table, user or migration has been created or applied by this work.
The `--local` cluster lives in a temp directory for the duration of the run and is deleted.

## The quickest path — run the harness in `--target` mode

Everything in §5 below is automated by the harness, including the parts a manual run does
badly (genuinely parallel writers, a response dropped *after* commit, a provably different
server process). After §0–§2 below (approval, migration applied and inspected, two users):

```bash
# In a terminal that will not be recorded. Nothing below is echoed or logged.
read -rs FURNIAI_DB_TEST_TOKEN_A; export FURNIAI_DB_TEST_TOKEN_A
read -rs FURNIAI_DB_TEST_TOKEN_B; export FURNIAI_DB_TEST_TOKEN_B
read -rs FURNIAI_DB_TEST_ANON_KEY; export FURNIAI_DB_TEST_ANON_KEY
export FURNIAI_DB_TEST_SUPABASE_URL="https://<nonprod-ref>.supabase.co"
export FURNIAI_DB_TEST_CONFIRM_NONPRODUCTION="<nonprod-ref>.supabase.co"   # typed, deliberately
export FURNIAI_DB_TEST_PRODUCTION_HOSTS="<prod-ref>.supabase.co"           # refused if matched

node scripts/verify-persistence-db.mjs --target --rounds 20 --writers 6 --json dbverify-target.json
unset FURNIAI_DB_TEST_TOKEN_A FURNIAI_DB_TEST_TOKEN_B FURNIAI_DB_TEST_ANON_KEY
```

It runs the API handlers locally (as separate processes) against the hosted database, so it
verifies PostgreSQL, PostgREST, RLS **and Supabase Auth** for real. It does not verify
Vercel's serverless instances; §5.1(c) below is still the way to do that. It prints the SQL
to delete what it created — it cannot delete it itself, by design (no delete policy).

**Two schema facts the harness established** — apply the migration as now committed, not an
earlier copy: the design table has **no DELETE policy** (the cascade would erase revisions
bypassing RLS — observed), and privileges are narrowed (anon: none; authenticated:
SELECT/INSERT, UPDATE of `name, updated_at` only on designs; no UPDATE/DELETE on revisions).

**Corrected 2026-09-22** after review. Five things in the first draft were wrong and are
fixed below; each is marked **CORRECTED** where it appears.

**Why this document exists.** Every persistence test in the repository runs against either
an in-process `Map` or `createFakePostgrest()`. Both are single-process JavaScript. They
demonstrate the application-level protocol and they cannot demonstrate:

- Postgres transaction isolation or real lock behaviour under genuine parallelism;
- that the RLS policies are the policies actually deployed, or that RLS is even enabled;
- that `unique (design_id, revision)` exists on the real table;
- that PostgREST maps those failures to the status codes the store expects;
- that a row written by one serverless invocation is visible to the next.

Isolation, concurrency, lost-response retry and durability across independent processes are
now **verified against a real PostgreSQL locally**. They remain **UNVERIFIED on Supabase**
until `--target` (or the manual procedure) has passed there.

---

## 0. Approvals needed before step 1

| Needed | Why |
|---|---|
| An approved **non-production** Supabase project | Nothing here may touch customer data |
| Permission to apply the migration to it | It creates two tables and their policies |
| Two throwaway auth users in that project | Cross-user isolation cannot be tested with one |
| Explicit confirmation this is NOT the production project | The procedure writes and reads freely |

Do not create the project, the users, or run the SQL without that approval. If the database
is approved but creating users is not, stop after §2 and report it — the isolation tests are
the ones that matter most and they need two identities.

---

## 1. Inspect first, then apply a narrowly scoped migration

**CORRECTED.** The first draft said to run the whole of `supabase/schema.sql`. That file
also defines `profiles`, `projects`, `ai_conversations` and `ai_corrections` and installs a
trigger on `auth.users` — four unrelated tables and an auth trigger, on a database that may
already have them. That is a far larger blast radius than this work needs.

Use **`supabase/migrations/2026-09-22_wardrobe_design_persistence.sql`**, which creates
exactly `wardrobe_designs` and `wardrobe_revisions` and nothing else.

### 1a. Inspect what is already there — before applying anything

```sql
-- Do these tables already exist, and with what shape?
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('wardrobe_designs','wardrobe_revisions')
order by table_name, ordinal_position;

-- What policies already exist on them?
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('wardrobe_designs','wardrobe_revisions')
order by tablename, cmd;

-- Is RLS on?
select relname, relrowsecurity
from pg_class
where relname in ('wardrobe_designs','wardrobe_revisions');
```

**Read the output before continuing.** If the tables exist with a different shape, or carry
an UPDATE or DELETE policy on `wardrobe_revisions`, **stop and report it** — the migration
is idempotent but it will not remove a policy it did not create, and an existing UPDATE
policy silently withdraws revision immutability.

### 1b. Apply

Supabase dashboard → SQL Editor → New query → paste the migration → Run. Idempotent; a
partial or repeated run does not error.

### 1c. Verify the migration landed, rather than assuming it

```sql
-- The constraint the entire concurrency argument rests on.
select conname, contype, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.wardrobe_revisions'::regclass;
-- EXPECT a UNIQUE constraint over (design_id, revision).
-- If it is absent, every concurrency claim in DESIGN_PERSISTENCE_API.md is void.

-- Revisions must be append-only.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'wardrobe_revisions';
-- EXPECT SELECT and INSERT ONLY. Any UPDATE or DELETE row FAILS this gate.

-- RLS must actually be ON. A policy list looks identical whether or not it is,
-- and a disabled-RLS table returns every row to everyone.
select relname, relrowsecurity
from pg_class
where relname in ('wardrobe_designs','wardrobe_revisions');
-- EXPECT relrowsecurity = true for both.
```

---

## 2. Two test users, without leaking their tokens

**CORRECTED.** The first draft told you to print an access token in a browser console and
paste it into an `export`. Both are wrong: a console-printed token sits in the devtools
scrollback and may be captured by any extension or screen share, and an `export` line lands
verbatim in shell history.

Create two users in the **non-production** project (Authentication → Users → Add user), or
sign up twice through the app. Call them **A** and **B**.

Read each token into the shell **without echoing it and without writing it to history**:

```bash
# -s suppresses echo; `read` is a shell builtin, so nothing enters history.
read -rs -p "user A access token: " TOKEN_A; export TOKEN_A; echo
read -rs -p "user B access token: " TOKEN_B; export TOKEN_B; echo
```

To obtain each token, use the app's own session rather than a console `console.log`: sign in
as that user and copy it from the Supabase client's stored session via the browser's
Application → Local Storage panel (the value is already there; reading it does not add a new
copy anywhere). Close the panel afterwards.

Treat each token as a password: never paste one into chat, a commit, a log, a bug report or
a screenshot. They expire, but not fast enough to matter if one leaks.

```bash
export FURNIAI_TEST_URL="https://<preview-or-local>"   # never production
```

Optional, and worth it if you will re-run this: `unset TOKEN_A TOKEN_B` when finished, and
sign both test users out to invalidate the tokens.

---

## 3. Environment

The server reads **`SUPABASE_URL`** and **`SUPABASE_ANON_KEY`** — no `NEXT_PUBLIC_` prefix;
the prefixed names are read by nothing in this repository. Set them for whatever environment
`FURNIAI_TEST_URL` points at, then **redeploy**: changing an environment variable does not
trigger a deployment.

`SUPABASE_SERVICE_ROLE_KEY` must **not** be used by this path. The store queries as the
caller so RLS applies; a service-role key would bypass every policy under test and make the
whole procedure meaningless.

---

## 4. Generate the payloads

**CORRECTED.** The first draft referred to `rev2-painted.json` and friends without ever
providing them.

```bash
node scripts/make-db-test-payloads.mjs ./db-test-payloads
```

Every body is built by the authoritative pipeline and compiler, so each one validates,
fingerprints and cross-checks exactly as the browser's would. Hand-written fixtures would
prove only that the server says `400`.

| File | Used for | Expected |
|---|---|---|
| `rev1.json` | first save | `201`, revision 1 |
| `rev2-painted.json` | concurrency writer A / retry | `201`, revision 2 |
| `rev2-painted-replay.json` | byte-identical retry | `200`, `idempotentReplay: true` |
| `rev2-veneer.json` | concurrency writer B | one of A/B wins |
| `rev2-no-cas.json` | missing `expectedPreviousRevision` | `400 BAD_REQUEST` |
| `bad-spec.json` | malformed spec, correct fingerprint | `400 INVALID_FURNISPEC` |
| `mismatched-graph.json` | valid spec + another design's graph | `400 INVALID_PARTGRAPH` |

These contain furniture dimensions only — no token, no key. Delete the directory afterwards.

---

## 5. The tests

### 5.1 Durability across processes — the headline claim

**CORRECTED.** The first draft said to "wait at least 15 minutes" and then read again. That
proves nothing: the same warm instance can serve both requests, and an elapsed clock is not
evidence about process identity. Waiting tests patience, not durability.

Durability means *the row is in the database, and a different process can see it*. Prove
both directly:

```bash
DESIGN=$(curl -s -X POST "$FURNIAI_TEST_URL/api/designs" \
  -H "authorization: Bearer $TOKEN_A" -H 'content-type: application/json' \
  -d '{"name":"DB procedure wardrobe"}' | jq -r .designId)

curl -s -X POST "$FURNIAI_TEST_URL/api/designs/$DESIGN/revisions" \
  -H "authorization: Bearer $TOKEN_A" -H 'content-type: application/json' \
  -d @db-test-payloads/rev1.json | jq '{ok, revision}'
```

**(a) Confirm the stored row exists in the database itself**, in the SQL editor — not
through the API that just claimed to write it:

```sql
select d.id, r.revision, r.fingerprint, r.created_at
from public.wardrobe_revisions r
join public.wardrobe_designs d on d.id = r.design_id
where d.id = '<DESIGN>';
-- EXPECT exactly one row, revision 1, fingerprint matching the API response.
-- No row here means the API reported a save that did not happen.
```

**(b) Read it back from an INDEPENDENT process**, not the same shell session and ideally not
the same machine — a different terminal, a colleague's laptop, or a CI runner:

```bash
curl -s "$FURNIAI_TEST_URL/api/designs/$DESIGN/revisions/1" \
  -H "authorization: Bearer $TOKEN_A" | jq '{ok, revision, fingerprint}'
```

**(c) Force a genuinely new server process.** Redeploy the preview (any no-op commit, or
"Redeploy" with the build cache disabled), confirm a **new deployment id**, then read again
against that deployment. A fresh deployment cannot share an in-memory Map with the old one,
which is the only thing that makes this conclusive.

**EXPECT** `ok: true`, same revision and fingerprint, in all three.

**On a 404 — CORRECTED.** The first draft said a 404 here "means the deployment is still
serving from the in-memory store". That is one hypothesis, not a finding. A 404 is a
**failure requiring diagnosis**, and at least these can produce it:

| Candidate | How to tell |
|---|---|
| Still serving from the in-memory store | §5.1(a) found no row, and `SUPABASE_URL`/`SUPABASE_ANON_KEY` are unset → the service should have failed closed with 503, so check why it did not |
| The write never happened | §5.1(a) found no row, and the POST did not return 201 |
| Wrong `designId` in the shell variable | `echo $DESIGN`; compare with the row in (a) |
| RLS hiding the row from this token | The row exists in (a) but the API 404s — sign-in mismatch between the token and `owner_user_id` |
| Reading a different deployment than the one written to | Compare the deployment ids of the two requests |
| Token expired between write and read | Any endpoint now returns 401 |

Record which of these was checked and what each showed. Do not report a cause that was not
distinguished from the others.

Repeat the read a few times. **An intermittent 404 is a failure even when most reads
succeed** — that pattern is the per-instance Map signature and must not be averaged away.

### 5.2 Cross-user isolation — all endpoints

With `$DESIGN` owned by A, as **B**:

```bash
for p in "" "/revisions" "/revisions/1"; do
  printf 'GET %-12s -> ' "$p"
  curl -s -o /dev/null -w "%{http_code}\n" \
    "$FURNIAI_TEST_URL/api/designs/$DESIGN$p" -H "authorization: Bearer $TOKEN_B"
done
```

**EXPECT `404` on every one — never `200`, and never `403`.** A `403` would be an existence
oracle; the contract says another owner's design must be indistinguishable from one that
does not exist. Confirm that directly by probing a fabricated id as B and checking the
responses are identical:

```bash
curl -s "$FURNIAI_TEST_URL/api/designs/00000000-0000-4000-8000-000000000000" \
  -H "authorization: Bearer $TOKEN_B" | jq -S .
curl -s "$FURNIAI_TEST_URL/api/designs/$DESIGN" \
  -H "authorization: Bearer $TOKEN_B" | jq -S .
# EXPECT byte-identical bodies.
```

Then B attempting to write into A's design:

```bash
curl -s -X POST "$FURNIAI_TEST_URL/api/designs/$DESIGN/revisions" \
  -H "authorization: Bearer $TOKEN_B" -H 'content-type: application/json' \
  -d @db-test-payloads/rev2-painted.json | jq '{ok, code}'
```

**EXPECT** `404 MISSING_DESIGN`, and **no row written**:

```sql
select count(*) from public.wardrobe_revisions where design_id = '<DESIGN>';
-- EXPECT: unchanged.
```

And B must not see A's design in a listing:

```bash
curl -s "$FURNIAI_TEST_URL/api/designs" -H "authorization: Bearer $TOKEN_B" \
  | jq '[.designs[].designId] | index("'"$DESIGN"'")'
# EXPECT: null
```

### 5.3 Concurrency — the claim the fake cannot make

Two genuinely parallel writers, same design, same target revision:

```bash
curl -s -X POST "$FURNIAI_TEST_URL/api/designs/$DESIGN/revisions" \
  -H "authorization: Bearer $TOKEN_A" -H 'content-type: application/json' \
  -d @db-test-payloads/rev2-painted.json > a.out &
curl -s -X POST "$FURNIAI_TEST_URL/api/designs/$DESIGN/revisions" \
  -H "authorization: Bearer $TOKEN_A" -H 'content-type: application/json' \
  -d @db-test-payloads/rev2-veneer.json > b.out &
wait
jq -c '{ok, code, revision, idempotentReplay}' a.out b.out
```

**EXPECT** exactly one `ok: true`, and one refusal with `code: "STALE_REVISION"` — **not**
`CONFLICT_REVISION`. The loser had nothing to overwrite; its view was out of date.

Then:

```sql
select revision, count(*) from public.wardrobe_revisions
where design_id = '<DESIGN>' group by revision order by revision;
-- EXPECT exactly one row per revision number. Two rows for revision 2 means the
-- unique constraint is missing and every concurrency claim is void.
```

Run at least 20 times, resetting to a known revision between runs. A race that only
sometimes loses is still a race; record how many runs were done and how many raced at all.

### 5.4 Idempotent retry

Send `rev2-painted.json`, then `rev2-painted-replay.json` (byte-identical):

**EXPECT** `201` with `ok:true`, then `200` with `ok:true` and `idempotentReplay: true`, the
same `fingerprint`, and **no new row** in SQL.

Then send `rev2-veneer.json` under the same revision: **EXPECT** `409 STALE_REVISION`, and
the stored row unchanged — confirm in SQL that `furnispec->>'finishType'` is still the
painted one.

### 5.5 Validation is enforced server-side

| Payload | Expect |
|---|---|
| `bad-spec.json` | `400 INVALID_FURNISPEC`, `details.errors` non-empty |
| `mismatched-graph.json` | `400 INVALID_PARTGRAPH` |
| `rev2-no-cas.json` (on a design whose latest is 1) | `400 BAD_REQUEST` naming `expectedPreviousRevision` |
| `rev1.json` with `"expectedPreviousRevision": null` on a fresh design | `201` |

After each refusal, confirm in SQL that **no row was written**.

### 5.6 Immutability

```sql
-- As an authenticated (non-service-role) session, both must be refused.
update public.wardrobe_revisions set fingerprint = 'tampered' where design_id = '<DESIGN>';
delete from public.wardrobe_revisions where design_id = '<DESIGN>';
```

**EXPECT** both to fail for want of a policy. If either succeeds, "immutable revisions" is
false regardless of what the application does.

> The SQL editor may run as a privileged role that bypasses RLS. If these succeed there,
> re-run them through PostgREST with `$TOKEN_A` before concluding anything — and roll back.

### 5.7 Reopen preserves identity

Reopen revision 1, re-derive the fingerprint from the returned `furniSpec`, and confirm it
equals the returned `fingerprint`; that `specId` is unchanged; and that the PartGraph part
count matches what was saved. Then export from the reopened state and confirm export
identity matches `tests/browser/export-identity-verifier.spec.js`.

### 5.8 Storage failure reporting

Point `SUPABASE_URL` at an unreachable host on a scratch preview and redeploy:
**EXPECT** `503 STORAGE_UNAVAILABLE`; a **read** failure must **not** say "Your design was
not saved."

---

## 6. Recording the result

For each test record: what ran, the exact status and code, the SQL row counts before and
after, and — for §5.1 and §5.3 — how many runs and how many raced. A test that was not run
is recorded as **NOT RUN**, never inferred from a related one that passed.

Until §5.1 and §5.3 have both passed against a real database, the correct description of
this system is: *"the application-level protocol is tested; durability and concurrency are
not verified against Postgres."*

---

## 7. Teardown

Delete the test designs, delete the two test users, `unset TOKEN_A TOKEN_B`, and remove
`./db-test-payloads`. No key was created for this procedure, so nothing needs rotating. Do
not drop the tables if the non-production project is being kept for further testing.
