# Persistence DB harness report — SIMULATED

**Mode:** SIMULATED
**Started:** 2026-09-24T17:53:17.765Z
**Finished:** 2026-09-24T17:53:17.870Z

> NOT production code. SIMULATED uses `createFakePostgrest` and does **not**
> prove Postgres durability or that deployed RLS matches schema.sql.

| Case | Procedure § | Result | Evidence |
|---|---|---|---|
| 01 Authenticated create/save/reopen | §5.1 create/save/GET + API reopen | **PASS** | PASS: create returns designId; SIMULATED: designId=row-wardrobe_designs-1; PASS: save revision 1 (1); PASS: save fingerprint ("fs256:ca22944c89122d32917b3c89a1b56eacf52bb7257542f3755f4147c9e40e44e5") |
| 02 Two-user isolation | §5.2 Cross-user isolation | **PASS** | PASS: getDesign refused; PASS: getDesign: MISSING_DESIGN ("MISSING_DESIGN"); PASS: getDesign: 404 not 403 (404); SIMULATED: B getDesign → 404 MISSING_DESIGN |
| 03 Concurrent saves from same prior revision | §5.3 Concurrency | **PASS** | PASS: run 0: one winner (1); PASS: run 0: one loser (1); PASS: run 0: loser STALE_REVISION ("STALE_REVISION"); PASS: run 0: exactly 2 rows (2) |
| 04 Retry after lost response | §5.4 Idempotent retry | **PASS** | PASS: first save ok; PASS: first save is not a replay; PASS: byte-identical retry → idempotentReplay (true); PASS: replay fingerprint unchanged ("fs256:f9df2ae11c65c60ba91e593e7c12319dbb1f76973b7e59859fdaf597608e5bcf") |
| 05 Durability across independent processes | §5.1 Durability (independent process) | **PASS** | PASS: SQL row exists for revision 1; PASS: SQL fingerprint matches API ("fs256:ca22944c89122d32917b3c89a1b56eacf52bb7257542f3755f4147c9e40e44e5"); SIMULATED: sql row present fingerprint=fs256:ca22944c8912…; PASS: independent process reads same revision ("fs256:ca22944c89122d32917b3c89a1b56eacf52bb7257542f3755f4147c9e40e44e5") |
| 06 Stored design identity + content consistency | §5.5 Validation + §5.7 Reopen identity | **PASS** | PASS: re-derived fingerprint matches stored ("fs256:ca22944c89122d32917b3c89a1b56eacf52bb7257542f3755f4147c9e40e44e5"); PASS: reopen fingerprint == save ("fs256:ca22944c89122d32917b3c89a1b56eacf52bb7257542f3755f4147c9e40e44e5"); PASS: specId unchanged ("furnispec-harness-db"); PASS: partGraph part count matches save (19) |

## Details

### 01 — Authenticated create/save/reopen → PASS
Procedure: §5.1 create/save/GET + API reopen
- PASS: create returns designId
- SIMULATED: designId=row-wardrobe_designs-1
- PASS: save revision 1 (1)
- PASS: save fingerprint ("fs256:ca22944c89122d32917b3c89a1b56eacf52bb7257542f3755f4147c9e40e44e5")
- PASS: reopen fingerprint matches ("fs256:ca22944c89122d32917b3c89a1b56eacf52bb7257542f3755f4147c9e40e44e5")
- PASS: reopen preserves specId ("furnispec-harness-db")
- PASS: SQL row count = 1 (1)

### 02 — Two-user isolation → PASS
Procedure: §5.2 Cross-user isolation
- PASS: getDesign refused
- PASS: getDesign: MISSING_DESIGN ("MISSING_DESIGN")
- PASS: getDesign: 404 not 403 (404)
- SIMULATED: B getDesign → 404 MISSING_DESIGN
- PASS: listRevisions refused
- PASS: listRevisions: MISSING_DESIGN ("MISSING_DESIGN")
- PASS: listRevisions: 404 not 403 (404)
- SIMULATED: B listRevisions → 404 MISSING_DESIGN
- PASS: getRevision refused
- PASS: getRevision: MISSING_DESIGN ("MISSING_DESIGN")
- PASS: getRevision: 404 not 403 (404)
- SIMULATED: B getRevision → 404 MISSING_DESIGN
- PASS: saveRevision refused
- PASS: saveRevision: MISSING_DESIGN ("MISSING_DESIGN")
- PASS: saveRevision: 404 not 403 (404)
- SIMULATED: B saveRevision → 404 MISSING_DESIGN
- PASS: B write inserted no row (1)
- PASS: B list excludes A's design
- PASS: fabricated vs A's id: same code ("MISSING_DESIGN")
- PASS: fabricated vs A's id: same status (404)

### 03 — Concurrent saves from same prior revision → PASS
Procedure: §5.3 Concurrency
- PASS: run 0: one winner (1)
- PASS: run 0: one loser (1)
- PASS: run 0: loser STALE_REVISION ("STALE_REVISION")
- PASS: run 0: exactly 2 rows (2)
- PASS: run 1: one winner (1)
- PASS: run 1: one loser (1)
- PASS: run 1: loser STALE_REVISION ("STALE_REVISION")
- PASS: run 1: exactly 2 rows (2)
- PASS: run 2: one winner (1)
- PASS: run 2: one loser (1)
- PASS: run 2: loser STALE_REVISION ("STALE_REVISION")
- PASS: run 2: exactly 2 rows (2)
- PASS: run 3: one winner (1)
- PASS: run 3: one loser (1)
- PASS: run 3: loser STALE_REVISION ("STALE_REVISION")
- PASS: run 3: exactly 2 rows (2)
- PASS: run 4: one winner (1)
- PASS: run 4: one loser (1)
- PASS: run 4: loser STALE_REVISION ("STALE_REVISION")
- PASS: run 4: exactly 2 rows (2)
- SIMULATED: runs=5 raced=5
- PASS: every run produced a real race/decision

### 04 — Retry after lost response → PASS
Procedure: §5.4 Idempotent retry
- PASS: first save ok
- PASS: first save is not a replay
- PASS: byte-identical retry → idempotentReplay (true)
- PASS: replay fingerprint unchanged ("fs256:f9df2ae11c65c60ba91e593e7c12319dbb1f76973b7e59859fdaf597608e5bcf")
- PASS: replay inserts no new row (2)
- SIMULATED: idempotentReplay=true; sql rows=2
- PASS: different body under same revision refused
- PASS: different body → STALE_REVISION ("STALE_REVISION")
- PASS: stored finishType still painted ("painted")

### 05 — Durability across independent processes → PASS
Procedure: §5.1 Durability (independent process)
- PASS: SQL row exists for revision 1
- PASS: SQL fingerprint matches API ("fs256:ca22944c89122d32917b3c89a1b56eacf52bb7257542f3755f4147c9e40e44e5")
- SIMULATED: sql row present fingerprint=fs256:ca22944c8912…
- PASS: independent process reads same revision ("fs256:ca22944c89122d32917b3c89a1b56eacf52bb7257542f3755f4147c9e40e44e5")
- SIMULATED: independent process reopen ok
- PASS: empty memory cannot see prior write
- PASS: empty memory → MISSING_DESIGN ("MISSING_DESIGN")
- SIMULATED: empty-memory contrast → MISSING_DESIGN (proves Map is not durable)
- PASS: repeat read 0 ("fs256:ca22944c89122d32917b3c89a1b56eacf52bb7257542f3755f4147c9e40e44e5")
- PASS: repeat read 1 ("fs256:ca22944c89122d32917b3c89a1b56eacf52bb7257542f3755f4147c9e40e44e5")
- PASS: repeat read 2 ("fs256:ca22944c89122d32917b3c89a1b56eacf52bb7257542f3755f4147c9e40e44e5")
- PASS: repeat read 3 ("fs256:ca22944c89122d32917b3c89a1b56eacf52bb7257542f3755f4147c9e40e44e5")
- PASS: repeat read 4 ("fs256:ca22944c89122d32917b3c89a1b56eacf52bb7257542f3755f4147c9e40e44e5")

### 06 — Stored design identity + content consistency → PASS
Procedure: §5.5 Validation + §5.7 Reopen identity
- PASS: re-derived fingerprint matches stored ("fs256:ca22944c89122d32917b3c89a1b56eacf52bb7257542f3755f4147c9e40e44e5")
- PASS: reopen fingerprint == save ("fs256:ca22944c89122d32917b3c89a1b56eacf52bb7257542f3755f4147c9e40e44e5")
- PASS: specId unchanged ("furnispec-harness-db")
- PASS: partGraph part count matches save (19)
- SIMULATED: fingerprint stable; specId=furnispec-harness-db; parts=19
- PASS: missing expectedPreviousRevision refused
- PASS: no-CAS → BAD_REQUEST ("BAD_REQUEST")
- PASS: error names expectedPreviousRevision
- SIMULATED: bad-spec → 400 INVALID_FURNISPEC
- PASS: bad-spec refused
- SIMULATED: mismatched-graph → 400 INVALID_PARTGRAPH
- PASS: mismatched graph refused
- PASS: validation refusals wrote no rows on primary design (1)

## Notes

- SIMULATED via createFakePostgrest — not proof of Postgres durability

## Summary
PASS=6 FAIL=0 BLOCKED/SKIP=0 TOTAL=6
