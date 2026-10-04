# Persistence DB harness report — REAL-DB

**Mode:** REAL-DB
**Started:** 2026-09-30T18:12:31.801Z
**Finished:** 2026-09-30T18:12:32.662Z

> NOT production code. SIMULATED uses `createFakePostgrest` and does **not**
> prove Postgres durability or that deployed RLS matches schema.sql.

| Case | Procedure § | Result | Evidence |
|---|---|---|---|
| 01 Authenticated create/save/reopen | §5.1 create/save/GET + API reopen | **PASS** | PASS: HTTP create ok; REAL-DB: designId=f5263e52-fd48-4f8e-94ea-40975b9bcf66; PASS: HTTP save 201; PASS: HTTP reopen ok |
| 02 Two-user isolation | §5.2 Cross-user isolation | **PASS** | PASS: A create; PASS: B getDesign → 404 (404); PASS: B getDesign → MISSING_DESIGN ("MISSING_DESIGN"); REAL-DB: B getDesign → 404 MISSING_DESIGN |
| 03 Concurrent saves from same prior revision | §5.3 Concurrency | **PASS** | PASS: run 0: one winner (1); PASS: run 0: one loser (1); PASS: run 0: STALE ("STALE_REVISION"); PASS: run 1: one winner (1) |
| 04 Retry after lost response | §5.4 Idempotent retry | **PASS** | PASS: first save 201; PASS: replay 200; PASS: idempotentReplay flag; REAL-DB: first=201 replay=200 |
| 05 Durability across independent processes | §5.1 Durability (independent process) | **PASS** | PASS: save ok; PASS: 5/5 independent-client reads succeeded (5); REAL-DB: 5/5 reads ok via second HTTP client; full redeploy check still manual per §5.1(c) |
| 06 Stored design identity + content consistency | §5.5 Validation + §5.7 Reopen identity | **PASS** | PASS: reopen ok; PASS: re-derived fingerprint ("fs256:ca22944c89122d32917b3c89a1b56eacf52bb7257542f3755f4147c9e40e44e5"); REAL-DB: reopen identity ok; PASS: no-CAS refused |

## Details

### 01 — Authenticated create/save/reopen → PASS
Procedure: §5.1 create/save/GET + API reopen
- PASS: HTTP create ok
- REAL-DB: designId=f5263e52-fd48-4f8e-94ea-40975b9bcf66
- PASS: HTTP save 201
- PASS: HTTP reopen ok
- PASS: reopen fingerprint ("fs256:ca22944c89122d32917b3c89a1b56eacf52bb7257542f3755f4147c9e40e44e5")

### 02 — Two-user isolation → PASS
Procedure: §5.2 Cross-user isolation
- PASS: A create
- PASS: B getDesign → 404 (404)
- PASS: B getDesign → MISSING_DESIGN ("MISSING_DESIGN")
- REAL-DB: B getDesign → 404 MISSING_DESIGN
- PASS: B listRevisions → 404 (404)
- PASS: B listRevisions → MISSING_DESIGN ("MISSING_DESIGN")
- REAL-DB: B listRevisions → 404 MISSING_DESIGN
- PASS: B getRevision → 404 (404)
- PASS: B getRevision → MISSING_DESIGN ("MISSING_DESIGN")
- REAL-DB: B getRevision → 404 MISSING_DESIGN
- PASS: B saveRevision → 404 (404)
- PASS: B saveRevision → MISSING_DESIGN ("MISSING_DESIGN")
- REAL-DB: B saveRevision → 404 MISSING_DESIGN
- PASS: B list excludes A

### 03 — Concurrent saves from same prior revision → PASS
Procedure: §5.3 Concurrency
- PASS: run 0: one winner (1)
- PASS: run 0: one loser (1)
- PASS: run 0: STALE ("STALE_REVISION")
- PASS: run 1: one winner (1)
- PASS: run 1: one loser (1)
- PASS: run 1: STALE ("STALE_REVISION")
- PASS: run 2: one winner (1)
- PASS: run 2: one loser (1)
- PASS: run 2: STALE ("STALE_REVISION")
- REAL-DB: runs=3 raced=3
- PASS: every run produced a real race/decision

### 04 — Retry after lost response → PASS
Procedure: §5.4 Idempotent retry
- PASS: first save 201
- PASS: replay 200
- PASS: idempotentReplay flag
- REAL-DB: first=201 replay=200
- PASS: different body refused
- PASS: STALE_REVISION ("STALE_REVISION")

### 05 — Durability across independent processes → PASS
Procedure: §5.1 Durability (independent process)
- PASS: save ok
- PASS: 5/5 independent-client reads succeeded (5)
- REAL-DB: 5/5 reads ok via second HTTP client; full redeploy check still manual per §5.1(c)

### 06 — Stored design identity + content consistency → PASS
Procedure: §5.5 Validation + §5.7 Reopen identity
- PASS: reopen ok
- PASS: re-derived fingerprint ("fs256:ca22944c89122d32917b3c89a1b56eacf52bb7257542f3755f4147c9e40e44e5")
- REAL-DB: reopen identity ok
- PASS: no-CAS refused
- PASS: no-CAS 400 (400)

## Notes

- REAL-DB target 127.0.0.1:38571

## Summary
PASS=6 FAIL=0 BLOCKED/SKIP=0 TOTAL=6
