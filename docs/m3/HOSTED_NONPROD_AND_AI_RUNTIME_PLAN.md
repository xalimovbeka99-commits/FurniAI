# Hosted authentication/database and AI runtime — plan and status (2026-09-30)

Evidence tiers are kept separate. Nothing below upgrades one tier into another.

| Tier | Status | Where |
|---|---|---|
| Application protocol (in-process) | **VERIFIED** | vitest, 1393 pass on this head |
| Real PostgreSQL 16 + PostgREST 12.2.3 + RLS + committed migration, **local**, JWT shim | **VERIFIED** on `e7a4f70`: `verify-persistence-db --local` 8/8 (50 rounds × 8 writers); Grok's harness `--real-db` via `with-local-stack` 6/6 | `docs/m3/evidence/2026-09-30/` |
| Hosted Supabase (GoTrue + gateway + hosted Postgres), non-production | **NOT RUN — BLOCKED** (§1) | — |
| Preview deployment configuration (AI keys, `SUPABASE_URL`) | **NOT DIAGNOSED — BLOCKED** (§3) | — |
| Live AI provider call | **NOT RUN** — no authorization for paid calls in this session | — |

## 1. Why hosted evidence was not produced today

1. **No authorization or credential for a non-production project exists in this session.**
   Searched: the connected folders, the staged `.env.local` (it holds only
   `ANTHROPIC_API_KEY` and `VERCEL_OIDC_TOKEN` — a `vercel env pull` of *Development*; no
   Supabase variable; read for names/state only and deleted from the workspace). The device
   has a `~/.supabase` CLI folder; using it would create or modify a hosted resource, which
   needs Bekzod's explicit approval — not taken.
2. **Egress:** from this workspace `*.supabase.co`, `api.supabase.com`, `api.vercel.com` and
   `*.vercel.app` are refused by the egress proxy (`connect_rejected`, organization policy).
   Even with credentials, `--target` cannot run from here. It can run from Bekzod's terminal
   (the desktop Linux workspace is still down after the 8 Sep Windows update; a normal
   Windows terminal with Node works).

## 2. Finding that changes the plan — the Studio's sign-in project

`index.html` signs customers in against Supabase project **`upavdjmovubblowrxncp`**
(hardcoded `SUPABASE_URL` + anon key; public by design; the anon JWT decodes to
`role: anon, ref: upavdjmovubblowrxncp`). `/api/designs` verifies the bearer token against
the **server's** `SUPABASE_URL`. Therefore:

- A separate non-production project gives a correct **harness** proof (`--target`, Grok
  `--real-db`: tokens are minted for that project's test users), but the **Studio on a
  Preview** would still sign customers into `upavdjmovubblowrxncp` and every save would be
  `401 MISSING_AUTH`.
- For an end-to-end Studio save on Preview, either (a) the Preview's `SUPABASE_URL` is
  `upavdjmovubblowrxncp` and the two tables are migrated there, or (b) the Studio's auth
  config becomes per-environment (Antigravity) and points Preview at the non-production
  project. Whether `upavdjmovubblowrxncp` is production is **not known here** — Bekzod to
  state. If it is production, (a) is out of scope under "do not deploy Production".
- `GET /api/design/health` now reports `persistence.projectRef` and
  `acceptsStudioSignIn` so this is checkable on any Preview at zero cost.

## 3. Exact non-production target and migration plan

**Decisions for Bekzod (required before anything hosted):**
1. Approve a **new** Supabase project, e.g. `furniai-nonprod-persistence` (free tier, any
   region), *or* state that `upavdjmovubblowrxncp` is non-production and may take the two
   tables.
2. Approve setting `SUPABASE_URL` / `SUPABASE_ANON_KEY` on the **Preview** scope of Vercel
   project `furniai-builder` (`prj_8tFr9kHJ0niYGkXATDp7648V7M1j`) for the integration branch
   only. Never Production.
3. Approve pushing the integration branch so a Preview exists (this workspace cannot push).

**Steps (Bekzod, or an agent he authorizes, from a machine with egress):**

| # | Action | Exact content |
|---|---|---|
| 1 | Inspect | `PERSISTENCE_DB_TEST_PROCEDURE.md` §1a queries in the SQL editor; read the output (existing `wardrobe_*` tables? existing policies?) |
| 2 | Apply | `supabase/migrations/2026-09-22_wardrobe_design_persistence.sql` **only** — not `supabase/schema.sql` (that also touches `profiles`, `projects`, `ai_*` and an `auth.users` trigger) |
| 3 | Verify | §1c queries: RLS on both tables; policies = designs {SELECT, INSERT, UPDATE}, revisions {SELECT, INSERT}; `UNIQUE (design_id, revision)`; no DELETE policy; grants narrowed |
| 4 | Users | two throwaway users (Auth → Add user, auto-confirm), §2 — tokens read with `read -rs`, never echoed |
| 5 | Harness proof | `FURNIAI_DB_TEST_CONFIRM_NONPRODUCTION=<host typed out> node scripts/verify-persistence-db.mjs --target` (8 checks) **and** Grok's `PERSISTENCE_REAL_DB=1 … node scripts/persistence/run-real-db-harness.mjs --real-db` with `FURNIAI_TEST_URL` = a local `scripts/dev-api-server.mjs` pointed at the project (no Preview needed for this step) |
| 6 | Preview config | set Preview-scoped `SUPABASE_URL`, `SUPABASE_ANON_KEY` (no `NEXT_PUBLIC_` prefix; never the service-role key); redeploy the Preview |
| 7 | Preview check | open `https://<preview>/api/design/health` → expect `persistence.configured: true`, `acceptsStudioSignIn: true` (else stop: see §2) |
| 8 | Hosted journey | Grok `--real-db` with `FURNIAI_TEST_URL=<preview>`; then the Studio: sign in → save → reload → My Designs → reopen → same fingerprint |
| 9 | Teardown | §7 SQL (delete the prefixed designs, then the two users); `unset` tokens |

What each step proves: 5 = Supabase Auth + hosted Postgres/RLS/unique constraint;
7–8 = the deployed function actually uses them; only 8 proves the customer path.

## 4. AI runtime

**Checked without spending tokens (this session):**

| Runtime | Finding | Evidence tier |
|---|---|---|
| Local development pull (`.env.local`, written 2026-09-22) | `ANTHROPIC_API_KEY` present, non-empty; no `OPENAI_*`, no `ANTHROPIC_MODEL` → router would try Anthropic with the built-in default model id | local file, names/state only — **says nothing about Preview** |
| Preview | **Not diagnosed.** The deployed candidate (`3ed620c`) has no zero-cost probe: every well-formed `POST /api/design/propose` reaches the provider router, so any probe is a potential paid call. `/api/design/health` exists only from `2ed3063` on this branch, which is not deployed. | — |
| Production | not touched | — |

**To diagnose the intended Preview (zero cost):** push the integration branch → open
`/api/design/health` on *that* Preview URL. It reports per key `absent | empty |
whitespace-only | configured`, the provider order, the model id, `wouldAttempt`, and
`liveCallMade: false`. Interpretation is in the response (`meaning`). Dashboard rows are not
evidence: a row can be scoped to the wrong environment or added after the last deploy.

**Credentials stay server-side:** shipped files scanned (`index.html`, all bundles) for
`sk-ant-`, `sk-proj-`, `AIza…`, `service_role` — none. The only key in the page is the
Supabase **anon** key (public by design). The health endpoint returns states, never values,
and is a plain 404 on Production. The propose response carries a `provider` field only when
`NODE_ENV !== "production"` (local runs) or `FURNIAI_FOUNDER_PREVIEW=true`
(`shouldExposeProviderDebugInfo`); Vercel sets `NODE_ENV=production` on Preview **and**
Production, so the customer label stays the neutral "AI" unless that flag is set — it must
never be set on Production. The acceptance script below records whether the field appears.

**Bounded live acceptance — prepared, not run** (`scripts/live-accept-preview.mjs`):

1. Zero-cost first: `node scripts/live-accept-preview.mjs --preview https://<preview-host>`
   → prints only the health summary (verdict, order, model id, key states, persistence
   `projectRef` / `acceptsStudioSignIn`). Refuses a non-preview-looking host unless retyped
   with `--confirm-host`, refuses a `404` health (Production) and `VERCEL_ENV=production`.
2. Only with Bekzod's explicit authorization for paid calls:
   `FURNIAI_LIVE_TEST_AUTHORIZED=yes node scripts/live-accept-preview.mjs --preview … --live --max-calls 3`
   (hard ceiling 5; refuses unless the verdict is `CONFIGURED_UNVERIFIED`). Three fixed
   cases: supported width change, unsupported (sliding doors), ambiguous. It prints status,
   code, edit keys, unsupported count, whether a `provider` field is present, latency — never
   a body, header or key.
3. Pass: supported → `200` with an `envelope.widthMm` edit that the Studio then applies
   through the kernel; unsupported → no geometry edit (design unchanged); ambiguous → no
   geometry edit without clear intent; no `provider` field unless founder preview is on.
4. Record date, Preview URL, model id from health, calls made, provider-dashboard tokens.
   Until then no provider/model is recorded as responding; `claude-sonnet-5` was last
   verified on 2026-09-09. (`scripts/live-test-design-propose.mjs` remains the local-only,
   3-attempt test authorized on 2026-09-07.)
