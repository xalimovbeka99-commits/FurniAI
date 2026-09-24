# Persistence DB harness report — REAL-DB

**Mode:** REAL-DB
**Started:** 2026-09-24T17:53:33.082Z
**Finished:** 2026-09-24T17:53:33.083Z

> NOT production code. SIMULATED uses `createFakePostgrest` and does **not**
> prove Postgres durability or that deployed RLS matches schema.sql.

| Case | Procedure § | Result | Evidence |
|---|---|---|---|
| 01 01-auth-create-save-reopen.js | — | **BLOCKED** | BLOCKED: missing env |
| 02 02-two-user-isolation.js | — | **BLOCKED** | BLOCKED: missing env |
| 03 03-concurrent-saves.js | — | **BLOCKED** | BLOCKED: missing env |
| 04 04-retry-after-lost-response.js | — | **BLOCKED** | BLOCKED: missing env |
| 05 05-durability-across-processes.js | — | **BLOCKED** | BLOCKED: missing env |
| 06 06-identity-content-consistency.js | — | **BLOCKED** | BLOCKED: missing env |

## Details

### 01 — 01-auth-create-save-reopen.js → BLOCKED
Procedure: —
- BLOCKED: missing env

### 02 — 02-two-user-isolation.js → BLOCKED
Procedure: —
- BLOCKED: missing env

### 03 — 03-concurrent-saves.js → BLOCKED
Procedure: —
- BLOCKED: missing env

### 04 — 04-retry-after-lost-response.js → BLOCKED
Procedure: —
- BLOCKED: missing env

### 05 — 05-durability-across-processes.js → BLOCKED
Procedure: —
- BLOCKED: missing env

### 06 — 06-identity-content-consistency.js → BLOCKED
Procedure: —
- BLOCKED: missing env

## Notes

- REAL-DB BLOCKED: missing env
- Missing: PERSISTENCE_REAL_DB=1, FURNIAI_TEST_URL, SUPABASE_URL, SUPABASE_ANON_KEY, TOKEN_A, TOKEN_B

## Summary
PASS=0 FAIL=0 BLOCKED/SKIP=6 TOTAL=6
