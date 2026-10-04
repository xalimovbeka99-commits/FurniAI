# Design Persistence API — the definitive contract

**Audience:** Antigravity (UI), Grok (integration lead).
**Backend branch:** `feat/pilot-design-persistence`
**Implementation:** `api/designs*` + `src/lib/persistence/**`
**Scope:** durable create / save / reopen by design ID for the wardrobe investor pilot.
**Out of scope:** UI, Three.js, FurniSpec calculation, PartGraph compiler, furniture rule
values, CNC qualification.

> **This file supersedes every earlier description of these endpoints.** Where an older
> handoff, comment or message disagrees with it, this file is correct — it is written
> against the code and is covered by `src/lib/persistence/*.test.js`.
>
> **Verification status (2026-09-30):**
>
> | Layer | Verified? | How |
> |---|---|---|
> | Application protocol | yes | `src/lib/persistence/*.test.js` (in-process store, fake PostgREST) |
> | PostgreSQL 16 + PostgREST 12 + RLS + the committed migration | **yes, locally** | `node scripts/verify-persistence-db.mjs --local` — real database, real handlers in separate OS processes; 8/8 pass (re-run 2026-09-30 on `e7a4f70`, 50 rounds × 8 writers); Grok's harness `--real-db` 6/6 through `scripts/db-verify/with-local-stack.mjs`; evidence in `docs/m3/evidence/` |
> | Supabase Auth (GoTrue), the Supabase gateway, a hosted project | **no** | `--target` mode exists and has **not been run**; it needs an approved non-production project |
>
> Say "verified against PostgreSQL locally", not "verified on Supabase", until `--target`
> has passed.

---

## 1. Authentication

Every endpoint requires a Supabase access token:

```http
Authorization: Bearer <supabase-access-token>
```

| Situation | Answer | UI meaning |
|---|---|---|
| No / malformed / empty `Authorization` | `401 MISSING_AUTH` | sign in |
| Token the auth provider **rejects** (401/403 from `/auth/v1/user`) | `401 MISSING_AUTH` | sign in again |
| Auth provider **unreachable or 5xx** | `503 AUTH_UNAVAILABLE` | try again shortly — *not* a sign-in problem |
| Deployment has no durable store configured, credential presented | `503 PERSISTENCE_NOT_CONFIGURED` | saving is unavailable here — *not* a sign-in problem |

`401` is the **only** "sign in" signal. Before 2026-09-24 the last three rows all answered
`401`, so a signed-in customer on Preview or Production (neither has `SUPABASE_URL` today)
was told to sign in, in a loop that could not succeed.

- The token is used to resolve the caller **and** to query Postgres as that caller, so
  row-level security applies to every read and write. It is never logged, never returned,
  and never written into a design.
- **Never put an API key, provider credential or Authorization value in a request body.**
  A FurniSpec carrying `apiKey`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `authorization`
  is rejected with `400 BAD_REQUEST`.

**Local development only:** with `FURNIAI_PERSISTENCE_TEST_AUTH=yes` and no deployment
markers present, `Authorization: Bearer test:<userId>` is accepted. This is structurally
unreachable on any deployed environment — it additionally requires `NODE_ENV !== production`
and `VERCEL_ENV` absent, and Vercel sets both on Production *and* Preview. It cannot be
re-enabled from the dashboard.

---

## 2. Required server environment variables

| Name | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | yes, for any deployment | **No `NEXT_PUBLIC_` prefix.** The prefixed name is read by nothing in this repo. |
| `SUPABASE_ANON_KEY` | yes, for any deployment | As above. Add as **Config**, not Secret. |
| `SUPABASE_SERVICE_ROLE_KEY` | **must NOT be used by this path** | It bypasses RLS and would defeat the second line of defence. The store never reads it. |
| `FURNIAI_PERSISTENCE_TEST_AUTH` | never set it anywhere | Inert on deployments; has no legitimate deployed use. |

A deployed environment with `SUPABASE_URL` / `SUPABASE_ANON_KEY` unset **fails closed**:
`503 PERSISTENCE_NOT_CONFIGURED`. It does not silently fall back to an in-memory store, and
it does not tell a signed-in customer to sign in.

Changing an environment variable does not trigger a redeploy. Redeploy for it to take
effect.

---

## 3. Revision semantics

Read this section before writing any client code; most of the error cases follow from it.

1. **Revisions are immutable and addressable.** `(designId, revision)` names exactly one
   stored FurniSpec + PartGraph, for ever. There is no update and no delete — enforced by a
   unique constraint and by the absence of UPDATE/DELETE policies, not by convention.
2. **Revisions start at 1 and advance by exactly 1.**
3. **`expectedPreviousRevision` is REQUIRED once a design has any saved revision.** It is
   the compare-and-swap: it states which revision you believe you are building on. Omitting
   it is a `400`, not a convenience. For the first revision send `null` or omit it — there
   is no predecessor.
4. **`specId` may not change across revisions of one design.** The design id identifies the
   saved record; the specId identifies the FurniSpec lineage inside it.
5. **The server recomputes the fingerprint** from the submitted FurniSpec and rejects the
   save if it disagrees with the one you sent.
6. **The saved PartGraph must be exactly what the compiler makes of the saved FurniSpec.**
   The fingerprint proves the spec arrived intact; it proves nothing about whether the spec
   is buildable or whether the PartGraph describes *that* spec. Every save runs, in order:
   `validateFurniSpec`; `validatePartGraph` and the unsupported-component ledger; the
   identity/envelope checks; then **recompiles the spec with `buildStructuralPartGraph`**
   (pure and deterministic) and requires the submitted graph to equal it canonically (key
   order irrelevant). A spec the compiler cannot build, or that compiles to a graph its own
   validator rejects, is `INVALID_FURNISPEC`; a graph that differs from the compiled one is
   `INVALID_PARTGRAPH` with `details.compiledMismatch` naming the differing fields and part
   ids. **The server never substitutes recompiled geometry for what you sent** — it stores
   your PartGraph byte-for-byte, or refuses the save. Every refusal happens before the
   write: no row, no history change.

   *Client consequence:* send the PartGraph the pipeline produced for this exact FurniSpec.
   Do not hand-edit a graph, and do not pair a spec with a graph from an earlier edit.
7. **Retrying an identical save is safe — and "identical" means every persisted field.**
   Equivalence is a canonical digest over `specId`, `revision`, the FurniSpec fingerprint,
   the PartGraph, `origins` and `validationStatus`. Key order does not matter. A true
   replay returns the stored revision with `idempotentReplay: true` and HTTP `200`.

   A request that matches the spec fingerprint but differs in PartGraph, provenance or
   validation status is **not** a replay and is refused with `STALE_REVISION` — reporting it
   as an exact save would be a false statement about what is in the database.
8. **Undo history stays client-side for the pilot.** Only accepted revisions are saved.
9. **Reopen serves only a revision that still verifies.** RLS lets an owner INSERT into
   their own design directly through PostgREST with their own session token, bypassing this
   API. RLS confines the damage to their own design; reopen re-runs the fingerprint,
   validators and compiler check and answers `409 REVISION_INTEGRITY_FAILED` (reason code
   only, no contents) rather than serving such a row as authoritative geometry.
10. **`expectedPreviousRevision` on a design with no history is refused** (`409
    STALE_REVISION`, `latestRevision: null`) — the client believes in history that does not
    exist, so it has the wrong design or a stale view.

### Concurrency, stated precisely

The application's checks read before they act, so two writers can pass all of them. The
single serialization point is `unique (design_id, revision)` in Postgres. Exactly one writer
takes a revision number; the other is told **`STALE_REVISION`** (not `CONFLICT_REVISION` —
it had nothing to overwrite) with `details.concurrent: true`.

This is not application-level mutual exclusion. It has now been **observed on a real
PostgreSQL 16**: 50 rounds × 8 writers, each a separate OS process with its own connection,
released at the same instant — exactly one `201` per round, every loser `409
STALE_REVISION`, never `CONFLICT_REVISION`, exactly one row per revision (T2 in
`docs/m3/evidence/dbverify-local-after.txt`). It has **not** been observed on a hosted
Supabase project.

### Immutability, stated precisely

Revisions cannot be updated or deleted by any non-service role: there is no UPDATE/DELETE
policy **and** the privilege is revoked. Designs cannot be deleted by their owner either —
`wardrobe_revisions.design_id` is `ON DELETE CASCADE` and a referential action is not
subject to RLS, so an owner allowed to delete a design could erase all of its "immutable"
revisions in one request. That was true of the migration until 2026-09-24 (observed: owner
`DELETE` design → 1 row, revisions afterwards 0) and is now closed. Owners may update only
`name` and `updated_at` on a design.

---

## 4. Endpoints

### `POST /api/designs` — create a design shell

Request:
```json
{ "name": "Living room wardrobe" }
```
**Design ids are assigned by the server.** Sending `designId` is `400 BAD_REQUEST`,
whatever its value. (It used to be accepted; because the primary key is global, creating
with another customer's id answered `409 CONFLICT_DESIGN` — an existence oracle. No client
sent one.) A lost response on create is harmless: retrying creates a second, empty shell.

`201`:
```json
{
  "ok": true,
  "designId": "8f2c…",
  "ownerUserId": "a91e…",
  "name": "Living room wardrobe",
  "createdAt": "2026-09-22T18:00:00.000Z",
  "updatedAt": "2026-09-22T18:00:00.000Z",
  "latestRevision": null
}
```

### `GET /api/designs` — list the caller's designs

`200`: `{ "ok": true, "designs": [ { designId, ownerUserId, name, createdAt, updatedAt } ] }`
Ordered by `updatedAt` descending. Only the caller's own designs are ever returned.

### `GET /api/designs/:designId` — summary + latest revision metadata

`200`:
```json
{
  "ok": true,
  "design": { "designId": "8f2c…", "ownerUserId": "a91e…", "name": "…",
              "createdAt": "…", "updatedAt": "…" },
  "latestRevision": { "revision": 3, "fingerprint": "sha256:…",
                      "specId": "furnispec-…", "validationStatus": "ACCEPTED",
                      "createdAt": "…" }
}
```
`latestRevision` is `null` for a design with no saved revision. **No PartGraph here** — use
the reopen endpoint.

### `POST /api/designs/:designId/revisions` — save an accepted revision

Request:
```json
{
  "revision": 2,
  "expectedPreviousRevision": 1,
  "fingerprint": "sha256:…",
  "furniSpec": { "specId": "furnispec-…", "revision": 2, "envelope": { "…": "…" } },
  "partGraph": { "parts": [], "summary": { "…": "…" } },
  "origins": { "envelope.widthMm": "CUSTOMER_STATED" },
  "validationStatus": "ACCEPTED"
}
```

`201` (created):
```json
{ "ok": true, "designId": "8f2c…", "revision": 2,
  "fingerprint": "sha256:…", "createdAt": "…", "validationStatus": "ACCEPTED" }
```

`200` (identical replay — nothing created):
```json
{ "ok": true, "designId": "8f2c…", "revision": 2,
  "fingerprint": "sha256:…", "createdAt": "…", "validationStatus": "ACCEPTED",
  "idempotentReplay": true }
```

### `GET /api/designs/:designId/revisions` — list revision summaries

`200`: `{ "ok": true, "designId": "…", "revisions": [ { revision, fingerprint, specId, validationStatus, createdAt } ] }`
Ascending by revision.

### `GET /api/designs/:designId/revisions/:revision` — **reopen**

`200`:
```json
{
  "ok": true,
  "designId": "8f2c…",
  "revision": 2,
  "fingerprint": "sha256:…",
  "furniSpec": { "…": "…" },
  "partGraph": { "…": "…" },
  "origins": { "envelope.widthMm": "CUSTOMER_STATED" },
  "validationStatus": "ACCEPTED",
  "createdAt": "…"
}
```

This is the only endpoint that returns the full FurniSpec and PartGraph.

---

## 5. Errors

Every error body is `{ "ok": false, "code": "...", "error": "...", "details"?: {...} }`.
`error` is customer-safe: it never names a provider, an environment variable or a credential.

| Code | HTTP | When | Nothing was written? |
|---|---|---|---|
| `MISSING_AUTH` | 401 | No, malformed or **rejected** Bearer token | yes |
| `AUTH_UNAVAILABLE` | 503 | The auth provider could not be asked (network / 5xx) | yes |
| `PERSISTENCE_NOT_CONFIGURED` | 503 | This deployment has no durable store | yes |
| `MISSING_DESIGN` | 404 | Unknown **or malformed** design id, unknown revision, **and any access to another owner's design — read or write** | yes |
| `STALE_REVISION` | 409 | `expectedPreviousRevision` ≠ latest (or claims history on an empty design); revision does not advance by 1; a concurrent writer took the number (`details.concurrent`); or same revision number, different content | yes |
| `CONFLICT_REVISION` | 409 | Store-level unique violation the service could not reclassify (not observed on the real database) | yes |
| `CONFLICT_DESIGN` | 409 | Unreachable through the API now that ids are server-assigned; kept in the enum | yes |
| `FINGERPRINT_MISMATCH` | 409 | Body fingerprint ≠ recomputed, `details.expectedFingerprint` | yes |
| `REVISION_INTEGRITY_FAILED` | 409 | **Reopen only**: the stored row no longer verifies, `details.reason` | nothing changed |
| `INVALID_FURNISPEC` | 400 | Shape, `validateFurniSpec` (`details.errors`), compile failure (`details.compileError`; for a kernel geometry refusal — `HANGING_DROP_NOT_ACHIEVABLE`, `HANGING_RAIL_OUTSIDE_BAY`, `HANGING_RAIL_INTERSECTS_PART`, `INTERIOR_PART_OUTSIDE_BAY` — also `details.geometry` with the component/part id and measured mm), or compiles to invalid geometry (`details.compiledGraphInvalid`) | yes |
| `INVALID_PARTGRAPH` | 400 | `validatePartGraph` (`details.errors`), identity/envelope mismatch, or not the compiler's graph for this spec (`details.compiledMismatch`) | yes |
| `UNSUPPORTED_COMPONENT` | 400 | The graph's ledger records a component the kernel could not represent (`details.unsupported`) | yes |
| `BAD_REQUEST` | 400 | Malformed body, missing `expectedPreviousRevision`, specId change, credential-shaped field, client-supplied `designId` | yes |
| `STORAGE_UNAVAILABLE` | 502 / 503 | The store failed or was unreachable. On a save the message says the design was **not saved**; on a read it makes no claim about saving | yes |
| `METHOD_NOT_ALLOWED` | 405 | Wrong verb | yes |

`UNAUTHORIZED` (403) remains in the enum for compatibility and is never emitted.

### Hidden and nonexistent designs — one answer

**There is no `403`. Another owner's design, a nonexistent design and a malformed design id
all answer exactly the same: `404 MISSING_DESIGN`, same status, same code, same message, on
every endpoint, for reads and writes, in every store.** Verified byte-for-byte on the real
database for all four design endpoints (T1, T6).

A `403` for a real design and a `404` for a fabricated id is an existence oracle. So was the
old `409 CONFLICT_DESIGN` on create, and so was the old `502` for a malformed id on the
deployed path (PostgreSQL rejects a bad uuid with `22P02`; PostgREST returns `400`; the
store reported an outage) while the local store said `404`. All three are closed.

For the UI this is one rule: **`404` means "you cannot have this", without implying
anything about whether it exists.** `401` is the only "sign in again" signal; `503` is
"try again later / not available here".

---

## 6. Worked example — save, then reopen

```js
const auth = { authorization: `Bearer ${accessToken}`, "content-type": "application/json" };

// 1. Create once, when the customer first saves.
const { designId } = await (await fetch("/api/designs", {
  method: "POST", headers: auth, body: JSON.stringify({ name: "Bedroom wardrobe" }),
})).json();

// 2. Save the first accepted revision. No predecessor.
await fetch(`/api/designs/${designId}/revisions`, {
  method: "POST", headers: auth,
  body: JSON.stringify({
    revision: 1, expectedPreviousRevision: null,
    fingerprint, furniSpec, partGraph, origins, validationStatus: "ACCEPTED",
  }),
});

// 3. Every later accepted edit states what it builds on.
const res = await fetch(`/api/designs/${designId}/revisions`, {
  method: "POST", headers: auth,
  body: JSON.stringify({
    revision: latest + 1, expectedPreviousRevision: latest,
    fingerprint, furniSpec, partGraph, origins, validationStatus: "ACCEPTED",
  }),
});
if (res.status === 409) {
  const { code } = await res.json();
  if (code === "STALE_REVISION") {
    // Someone (or another tab/device) saved first. Reload, do not retry blind.
  }
}

// 4. Reopen an exact revision.
const reopened = await (await fetch(
  `/api/designs/${designId}/revisions/2`, { headers: auth })).json();
// reopened.furniSpec / .partGraph / .fingerprint / .specId restore identity exactly.
```

### Save-conflict recovery — the algorithm

```text
POST revision N+1 with expectedPreviousRevision N
├─ 201                        saved. latest = N+1.
├─ 200 idempotentReplay:true  it was already saved (your earlier response was lost). latest = N+1.
├─ network error / timeout    you do not know. Resend the IDENTICAL body (same revision,
│                             same expectedPreviousRevision, same content):
│                               200 replay → it had been saved; 201 → it is now;
│                               409 → someone else's save won (below).
├─ 409 STALE_REVISION         someone else saved first (another tab or device), or your
│                             view is stale. Do NOT retry blind and do NOT bump the number.
│                             GET /api/designs/:id → latestRevision; GET that revision;
│                             show the customer both; they choose; save their choice as
│                             latest+1 with expectedPreviousRevision = latest.
├─ 400 INVALID_* / UNSUPPORTED_COMPONENT
│                             the design itself is not saveable. Nothing was written. Keep
│                             the customer's on-screen state; do not retry the same body.
├─ 401 MISSING_AUTH           sign in again, then resend the same body.
├─ 503 AUTH_UNAVAILABLE / STORAGE_UNAVAILABLE
│                             nothing was saved (or: unknown — resend identical body later).
└─ 503 PERSISTENCE_NOT_CONFIGURED
                              saving is off on this deployment; say so, keep local state.
```

A refused save never changes stored history, and it must not change the client's active
design either: keep what is on screen.

### Client responsibilities

- Save only **accepted** revisions; never overwrite.
- Always send `expectedPreviousRevision` after the first save.
- Never send `designId` to `POST /api/designs`.
- Send the PartGraph the pipeline produced for exactly this FurniSpec.
- On `STALE_REVISION`, reload and let the customer choose — never retry blind.
- Safe to retry the **identical** body on a timeout; that is idempotent by contract, and it
  has been exercised with the response genuinely lost after commit (T3).
- On reopen, replace in-memory state from the response. Do not merge it into a stale cache.
- Export identity after reopen must come from the returned PartGraph and fingerprint.
- **On reopen, rotate the editing-session id and restart the change token** — see §7.

---

## 7. Reopen and the editing session

Server-side identity after reopen is exact. Client-side, the AI transport now refuses an
answer from a session the customer has left (`06cbdcf`, extended in `5cda494`), and
Antigravity wired the rotation in `de5ebec`. The contract is
`SESSION_ID_CALLING_CONTRACT.md`. The five identities involved are distinct and must not be
substituted for each other:

| Identity | Where | Changes on |
|---|---|---|
| Design identity | `designId` (server), `specId` (spec lineage) | never, for one design |
| Stored revision | `revision` in these endpoints | each accepted save (immutable once written) |
| Displayed revision | the UI's revision counter | edit (+1), Undo (−1) |
| Change token | `changeToken` | every edit **and** every Undo; restarts on reopen |
| Editing session | `sessionId` (browser only, never sent here) | page load, reopen, design switch, reset |

**Client wiring (2026-09-30):** Antigravity's uncommitted Studio work calls these endpoints
(`persistAcceptedRevision`, `reopenDesignFromApi`) but applies late answers to whichever
design is current. The session-safe client half is
`AiDesignerTransport.createDesignSaveCoordinator` — see
[`STUDIO_SAVE_REOPEN_CONTRACT.md`](./STUDIO_SAVE_REOPEN_CONTRACT.md) for the defects, the
wiring and the browser journey (`tests/browser/studio-save-reopen-staleness.spec.js`,
routed responses — not a hosted save).
