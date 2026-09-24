# Persistence DB harness

**NOT production code.** This harness lives under `tests/persistence/real-db/**` and
`scripts/persistence/**`. It does **not** modify `src/lib/persistence/**`.

It turns `docs/m3/PERSISTENCE_DB_TEST_PROCEDURE.md` into an executable check suite with
two modes:

| Mode | What it proves | What it does **not** prove |
|---|---|---|
| `--simulated` (default) | Application-level protocol against `createFakePostgrest` + `createSupabaseDesignStore` + `createDesignService` | Postgres isolation, deployed RLS, unique constraints on a real DB, cross-process durability on Vercel |
| `--real-db` | Same assertions against a live non-Prod API + caller JWT (RLS path) | Nothing if env is missing or looks like Production — harness hard-refuses |

Until `--real-db` has been run on an **approved non-Production** project, the correct
description of the system remains: *application-level protocol tested; durability and
concurrency not verified against Postgres.*

## How to run

```bash
# Simulated (no network, no credentials)
node scripts/persistence/run-real-db-harness.mjs --simulated

# Optional report path
node scripts/persistence/run-real-db-harness.mjs --simulated \
  --report tests/persistence/real-db/reports/simulated-latest.md

# Real DB (gated — see env below)
PERSISTENCE_REAL_DB=1 \
FURNIAI_TEST_URL="https://<preview-or-local>" \
SUPABASE_URL="https://<project>.supabase.co" \
SUPABASE_ANON_KEY="…" \
TOKEN_A="…" \
TOKEN_B="…" \
node scripts/persistence/run-real-db-harness.mjs --real-db
```

Prefer reading tokens with `read -rs` (procedure §2) so they never enter shell history.
**Never** set `SUPABASE_SERVICE_ROLE_KEY` for this harness — service-role bypasses RLS and
makes the isolation cases meaningless.

## Environment variables (names only)

| Name | Required for | Purpose |
|---|---|---|
| `PERSISTENCE_REAL_DB` | `--real-db` | Must be `1` to enable |
| `FURNIAI_TEST_URL` | `--real-db` | Preview / local API base (never Production) |
| `SUPABASE_URL` | `--real-db` | Non-Prod project URL |
| `SUPABASE_ANON_KEY` | `--real-db` | Anon key (caller JWT still required) |
| `TOKEN_A` / `PERSISTENCE_TOKEN_A` | `--real-db` | User A access token |
| `TOKEN_B` / `PERSISTENCE_TOKEN_B` | `--real-db` | User B access token |
| `PERSISTENCE_TEST_PREFIX` | optional | Design name prefix (default `harness-db-`) |
| `VERCEL_ENV` | gate | If `production`, harness **refuses** |

Hard refuse also triggers when `FURNIAI_TEST_URL` looks like Production, or when
`SUPABASE_SERVICE_ROLE_KEY` is set.

## Cases ↔ procedure sections

| Case | File | Procedure | Proves |
|---|---|---|---|
| 01 | `01-auth-create-save-reopen.js` | §5.1 create/save/GET | Authenticated create → save rev 1 → reopen same fingerprint |
| 02 | `02-two-user-isolation.js` | §5.2 | User B gets `MISSING_DESIGN` / 404 on every endpoint; no write; list excludes A; fabricated id indistinguishable |
| 03 | `03-concurrent-saves.js` | §5.3 | Exactly one of two parallel rev-2 saves wins; loser `STALE_REVISION`; one SQL row per revision (×N runs) |
| 04 | `04-retry-after-lost-response.js` | §5.4 | Byte-identical retry → `idempotentReplay`; different body → `STALE_REVISION`; no extra row |
| 05 | `05-durability-across-processes.js` | §5.1 (a)(b) | SQL-visible row; independent process reopen; empty-memory contrast (simulated). Real-db: second HTTP client; full redeploy still manual |
| 06 | `06-identity-content-consistency.js` | §5.5 + §5.7 | Re-derived fingerprint; specId + part count; no-CAS / bad-spec / mismatched-graph refusals |

## Cleanup

- **Simulated:** in-memory tables cleared via `world.cleanup()` (tracked design ids).
- **Real-db:** no delete API in the contract. Designs are created with
  `PERSISTENCE_TEST_PREFIX`. Teardown = delete those designs + test users per procedure §7,
  then `unset TOKEN_A TOKEN_B`.
- Payload helper `scripts/make-db-test-payloads.mjs` may write `./db-test-payloads` (gitignored);
  delete after use. This harness builds payloads in-process and does not require that dir.

## Reports

Default outputs:

- `tests/persistence/real-db/reports/simulated-latest.md`
- `tests/persistence/real-db/reports/real-db-latest.md` (or `real-db-blocked.md` when gated)

Every SIMULATED result is labeled **SIMULATED**. Do not cite them as proof of deployed
durability.

## Mapping note for Integration / Claude

This harness **owns** only the paths listed in the assignment. Production persistence
fixes remain Claude’s. If a SIMULATED case notes a validation gap (bad-spec / mismatched
graph accepted), treat that as “needs Claude coordination via Bekzod” — do not patch
`src/lib/persistence/**` from this branch.
