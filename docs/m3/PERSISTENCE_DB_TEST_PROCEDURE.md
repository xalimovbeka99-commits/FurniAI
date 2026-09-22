# Real-database test procedure — durable save/reopen

**Status: NOT RUN. Nothing in this document has been executed.**
No migration has been applied, no Supabase project has been created or modified, and no
external resource exists as a result of this work. Every step below needs Bekzod's explicit
approval and an approved **non-production** database before anyone runs it.

**Why this document exists.** Every persistence test in the repository runs against either
an in-process `Map` or `createFakePostgrest()`. Both are single-process JavaScript. They
demonstrate the application-level protocol and they cannot demonstrate:

- Postgres transaction isolation or real lock behaviour under genuine parallelism;
- that the RLS policies in `supabase/schema.sql` are the policies actually deployed;
- that `unique (design_id, revision)` exists on the real table;
- that PostgREST maps those failures to the status codes the store expects;
- that a row written by one serverless invocation is visible to the next.

Until this procedure has been run, **"durable" describes an intent, not a verified
property.**

---

## 0. Approvals needed before step 1

| Needed | Why |
|---|---|
| A non-production Supabase project | Nothing here may touch customer data |
| Permission to run `supabase/schema.sql` against it | It creates tables and policies |
| Two throwaway auth users in that project | Cross-user isolation cannot be tested with one |
| Confirmation this is NOT the production project | The procedure writes and reads freely |

Do not create the project, the users, or run the SQL without that approval. If approval is
given for the database but not for creating users, stop after step 2 and report it — the
isolation tests are the ones that matter most and they need two identities.

---

## 1. Apply the schema

`supabase/schema.sql` is idempotent: every statement is `IF NOT EXISTS`, or
`DROP ... IF EXISTS` before `CREATE`. A partial or repeated run does not error.

Supabase dashboard → SQL Editor → New query → paste the file → Run.

The pilot tables are appended at the end of that file:

- `public.wardrobe_designs` — `id`, `owner_user_id`, `name`, timestamps
- `public.wardrobe_revisions` — `design_id`, `revision`, `fingerprint`, `furnispec`,
  `part_graph`, `origins`, `validation_status`, `created_at`, with
  **`unique (design_id, revision)`**

### Verify the schema landed, rather than assuming it

```sql
-- The constraint the whole concurrency argument rests on must exist.
select conname, contype
from pg_constraint
where conrelid = 'public.wardrobe_revisions'::regclass;
-- EXPECT: a UNIQUE constraint covering (design_id, revision).

-- Revisions must be append-only: SELECT and INSERT policies only.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename in ('wardrobe_designs','wardrobe_revisions')
order by tablename, cmd;
-- EXPECT wardrobe_revisions: SELECT and INSERT ONLY.
-- ANY row with cmd = UPDATE or DELETE on wardrobe_revisions FAILS this gate.

-- RLS must actually be on. A policy on a table with RLS disabled does nothing.
select relname, relrowsecurity
from pg_class
where relname in ('wardrobe_designs','wardrobe_revisions');
-- EXPECT relrowsecurity = true for both.
```

That third query is the one most worth running. A policy list looks reassuring whether or
not RLS is enabled, and a disabled-RLS table returns every row to everyone.

---

## 2. Two test users

Create two users in the **non-production** project (Authentication → Users → Add user), or
sign up twice through the app. Call them **A** and **B**.

Obtain an access token for each. Never paste a token into chat, a commit, a log or a bug
report; treat each one as a password. In a browser console on the app origin:

```js
// Run once per user, while signed in as that user.
(await supabase.auth.getSession()).data.session.access_token
```

Hold each token in a shell variable in the terminal that will run the tests. Do not write
them to a file.

```bash
export FURNIAI_TEST_URL="https://<preview-or-local>"   # never production
export TOKEN_A="..."   # user A
export TOKEN_B="..."   # user B
```

---

## 3. Environment

The server reads **`SUPABASE_URL`** and **`SUPABASE_ANON_KEY`** — no `NEXT_PUBLIC_` prefix;
the prefixed names are read by nothing in this repository. Set them for whatever environment
`FURNIAI_TEST_URL` points at, then redeploy: changing an environment variable does not
trigger a deployment.

`SUPABASE_SERVICE_ROLE_KEY` must **not** be used by this path. The store queries as the
caller so RLS applies; a service-role key would bypass every policy under test and make the
whole procedure meaningless.

---

## 4. The tests

Each returns a status and a JSON body. The expectations are exact.

### 4.1 Durability across invocations — the headline claim

```bash
# Create, then save revision 1.
DESIGN=$(curl -s -X POST "$FURNIAI_TEST_URL/api/designs" \
  -H "authorization: Bearer $TOKEN_A" -H 'content-type: application/json' \
  -d '{"name":"DB procedure wardrobe"}' | jq -r .designId)

# ... POST revision 1 with a valid furniSpec/partGraph/fingerprint ...

# WAIT at least 15 minutes, so the serverless instance that served the write
# is very unlikely to be the one that serves the read.
curl -s "$FURNIAI_TEST_URL/api/designs/$DESIGN/revisions/1" \
  -H "authorization: Bearer $TOKEN_A" | jq '{ok, revision, fingerprint}'
```

**EXPECT** `ok: true` with the same `revision` and `fingerprint`.
**A 404 here means the deployment is still serving from the in-memory store, or Supabase is
not configured** — that is the exact failure this whole workstream exists to prevent, and it
is the single most important line in this document.

Repeat the read a few times over an hour. An intermittent 404 is the per-instance `Map`
signature and must be treated as a failure even if most reads succeed.

### 4.2 Cross-user isolation — all five endpoints

With `$DESIGN` owned by A, as **B**:

```bash
for p in "" "/revisions" "/revisions/1"; do
  echo -n "GET $p -> "
  curl -s -o /dev/null -w "%{http_code}\n" \
    "$FURNIAI_TEST_URL/api/designs/$DESIGN$p" -H "authorization: Bearer $TOKEN_B"
done
```

**EXPECT 404 or 403 on every one — never 200.**

Then B attempting to write into A's design:

```bash
curl -s -X POST "$FURNIAI_TEST_URL/api/designs/$DESIGN/revisions" \
  -H "authorization: Bearer $TOKEN_B" -H 'content-type: application/json' \
  -d '{"revision":2,"expectedPreviousRevision":1, ...}' | jq '{code}'
```

**EXPECT** refusal, and then confirm in SQL that **no row was written**:

```sql
select count(*) from public.wardrobe_revisions where design_id = '<DESIGN>';
-- EXPECT: unchanged.
```

Also confirm B cannot see A's design in a listing:

```bash
curl -s "$FURNIAI_TEST_URL/api/designs" -H "authorization: Bearer $TOKEN_B" \
  | jq '[.designs[].designId] | index("'"$DESIGN"'")'
# EXPECT: null
```

> Note on codes: under RLS, PostgREST returns **200 with an empty array** for rows it hides,
> so a cross-user read surfaces as `MISSING_DESIGN` (404), not `UNAUTHORIZED` (403). Both
> are correct refusals. What matters is that no data comes back and no row is written.

### 4.3 Concurrency — the claim the fake cannot make

This is the reason for the whole document. Two genuinely parallel writers, same design,
same target revision:

```bash
# Both build on revision 1. Bodies differ (different finishType).
curl -s -X POST "$FURNIAI_TEST_URL/api/designs/$DESIGN/revisions" \
  -H "authorization: Bearer $TOKEN_A" -H 'content-type: application/json' \
  -d @rev2-painted.json > a.out &
curl -s -X POST "$FURNIAI_TEST_URL/api/designs/$DESIGN/revisions" \
  -H "authorization: Bearer $TOKEN_A" -H 'content-type: application/json' \
  -d @rev2-veneer.json > b.out &
wait
jq -c '{ok, code, revision, idempotentReplay}' a.out b.out
```

**EXPECT** exactly one `ok: true`, and one refusal with `code: "STALE_REVISION"` —
**not** `CONFLICT_REVISION`. The loser had nothing to overwrite; its view was out of date.

Then in SQL:

```sql
select revision, count(*) from public.wardrobe_revisions
where design_id = '<DESIGN>' group by revision order by revision;
-- EXPECT exactly one row per revision number. Two rows for revision 2 means the
-- unique constraint is missing and every concurrency claim is void.
```

Run this at least 20 times. A race that only sometimes loses is still a race.

### 4.4 Idempotent retry

Send **the identical revision-2 body twice, sequentially**:

**EXPECT** the first `201` with `ok:true`; the second `200` with `ok:true` and
`idempotentReplay: true`, the same `fingerprint`, and **no new row** in SQL.

Then send a *different* body under revision 2: **EXPECT** `STALE_REVISION`, and the stored
row unchanged.

### 4.5 Immutability

```sql
-- As an authenticated (non-service-role) session, both must be refused.
update public.wardrobe_revisions set fingerprint = 'tampered' where design_id = '<DESIGN>';
delete from public.wardrobe_revisions where design_id = '<DESIGN>';
```

**EXPECT** both to fail on missing policy. If either succeeds, "immutable revisions" is
false regardless of what the application does.

### 4.6 Compare-and-swap is mandatory

POST revision 2 **omitting** `expectedPreviousRevision` on a design that already has
revision 1: **EXPECT** `400 BAD_REQUEST` naming `expectedPreviousRevision`.

POST revision 1 with `"expectedPreviousRevision": null` on a fresh design: **EXPECT** `201`.

### 4.7 Reopen preserves identity

Reopen revision 1 and re-derive the fingerprint from the returned `furniSpec`:
**EXPECT** it equals the returned `fingerprint`, `specId` is unchanged, and the PartGraph
part count matches what was saved. Then export from the reopened state and confirm the
export identity matches `tests/browser/export-identity-verifier.spec.js`.

### 4.8 Storage failure reporting

Point `SUPABASE_URL` at an unreachable host and redeploy a scratch preview:
**EXPECT** `503 STORAGE_UNAVAILABLE`; a *read* failure must **not** say "Your design was
not saved."

---

## 5. Recording the result

For each test record: what ran, the exact status and code, and the SQL row counts before and
after. A test that was not run is recorded as **NOT RUN**, never inferred from a related one
that passed.

Until §4.1 and §4.3 have both passed against a real database, the correct description of
this system is: *"the application-level protocol is tested; durability and concurrency are
not yet verified against Postgres."*

---

## 6. Teardown

Delete the test designs, delete the two test users, and rotate nothing — no key was created
for this procedure. Do **not** delete the schema if the non-production project is being kept
for further testing.
