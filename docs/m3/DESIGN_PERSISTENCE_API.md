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
> **Verification status:** the application-level protocol is tested against an in-process
> store and a fake PostgREST that enforces `unique (design_id, revision)` and models RLS.
> **Durability and concurrency have NOT been verified against a real Postgres.** See
> `PERSISTENCE_DB_TEST_PROCEDURE.md`. Until §4.1 and §4.3 of that document pass, do not
> describe this as proven durable.

---

## 1. Authentication

Every endpoint requires a Supabase access token:

```http
Authorization: Bearer <supabase-access-token>
```

- Missing, malformed, empty **or rejected by Supabase** → `401 MISSING_AUTH`. An invalid
  token is an authentication failure and says nothing about any particular design.
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
`503`, *"Design saving is not configured on this deployment. Nothing was saved."* It does
not silently fall back to an in-memory store.

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
6. **The server validates what you send, and that the parts agree with each other.** The
   fingerprint proves the spec arrived intact; it proves nothing about whether the spec is
   buildable or whether the PartGraph describes *that* spec. Every save runs the
   authoritative `validateFurniSpec` and `validatePartGraph`, checks the graph's
   `sourceSpecId`, `sourceRevision` and envelope against the spec, and refuses any graph
   whose ledger records an `UNSUPPORTED` component. **The server never substitutes
   recompiled geometry for what you sent** — it stores your PartGraph exactly, or refuses
   the save.
7. **Retrying an identical save is safe — and "identical" means every persisted field.**
   Equivalence is a canonical digest over `specId`, `revision`, the FurniSpec fingerprint,
   the PartGraph, `origins` and `validationStatus`. Key order does not matter. A true
   replay returns the stored revision with `idempotentReplay: true` and HTTP `200`.

   A request that matches the spec fingerprint but differs in PartGraph, provenance or
   validation status is **not** a replay and is refused with `STALE_REVISION` — reporting it
   as an exact save would be a false statement about what is in the database.
8. **Undo history stays client-side for the pilot.** Only accepted revisions are saved.

### Concurrency, stated precisely

The application's checks read before they act, so two writers can pass all of them. The
single serialization point is `unique (design_id, revision)` in Postgres. Exactly one writer
takes a revision number; the other is told **`STALE_REVISION`** (not `CONFLICT_REVISION` —
it had nothing to overwrite) with `details.concurrent: true`.

**This is not a claim of application-level mutual exclusion, and it is not proven.** It rests
on a database constraint that has not yet been verified to exist on a real deployment.

---

## 4. Endpoints

### `POST /api/designs` — create a design shell

Request:
```json
{ "name": "Living room wardrobe" }
```
`designId` may optionally be supplied; a colliding id returns `409 CONFLICT_DESIGN`.

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

| Code | HTTP | When |
|---|---|---|
| `MISSING_AUTH` | 401 | No, malformed or rejected Bearer token |
| `MISSING_DESIGN` | 404 | Unknown design or revision, **and any access to another owner's design — read or write** |
| `STALE_REVISION` | 409 | `expectedPreviousRevision` ≠ latest; revision does not advance by 1; or a concurrent writer took the number first (`details.concurrent`) |
| `CONFLICT_REVISION` | 409 | Store-level unique violation the service could not reclassify |
| `CONFLICT_DESIGN` | 409 | Supplied `designId` already exists |
| `FINGERPRINT_MISMATCH` | 409 | Body fingerprint ≠ recomputed, `details.expectedFingerprint` |
| `INVALID_FURNISPEC` | 400 | Spec shape invalid, unfingerprintable, **or rejected by `validateFurniSpec`** (`details.errors`) |
| `INVALID_PARTGRAPH` | 400 | PartGraph validation failed (`details.errors`), **or it does not describe this spec** (`details.specId` / `details.envelope`) |
| `UNSUPPORTED_COMPONENT` | 400 | The graph's ledger records a component the kernel could not represent (`details.unsupported`) |
| `BAD_REQUEST` | 400 | Malformed body, missing `expectedPreviousRevision`, specId change, credential-shaped field |
| `STORAGE_UNAVAILABLE` | 502 / 503 | The store failed or was unreachable |
| `METHOD_NOT_ALLOWED` | 405 | Wrong verb |

**There is no `403`. Another owner's design answers exactly as a nonexistent one: `404
MISSING_DESIGN`, same status, same code, same message, on every endpoint, for reads and
writes alike, in every store.**

This is deliberate. A `403` for a real design and a `404` for a fabricated id is an
existence oracle — anyone holding an id learns whether it belongs to a real customer. It
also used to be a divergence: under RLS the deployed path already answered `404` (PostgREST
returns an empty result for rows it hides rather than an error) while the in-memory store
used locally answered `403`, so the cross-user test proved something the deployment did not
do. Both now answer `404`, and `saveConsistency.test.js` asserts the two refusals are
byte-identical.

For the UI this simplifies to one rule: **`404` means "you cannot have this", without
implying anything about whether it exists.** `401` remains the only "sign in again" signal.

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

### Client responsibilities

- Save only **accepted** revisions; never overwrite.
- Always send `expectedPreviousRevision` after the first save.
- On `STALE_REVISION`, reload and let the customer re-apply — never retry blind.
- Safe to retry the **identical** body on a timeout; that is idempotent by contract.
- On reopen, replace in-memory state from the response. Do not merge it into a stale cache.
- Export identity after reopen must come from the returned PartGraph and fingerprint.
- **Reset the session change token on every reopen** — and see the open item below.

---

## 7. Open item affecting reopen

Reopening restores design identity correctly on the server. On the **client**, the stale
guard cannot currently tell one session from another: reopening the same design restarts the
change-token counter, so an in-flight answer from the previous session can match both guard
signals and apply.

Demonstrated in `src/lib/adapters/sessionIdentityCharacterization.test.js`; the fix is
specified in `proposals/SESSION_IDENTITY_GUARD.md`. It needs a change to a shared transport
file and is **not implemented** — it is for the integration lead to schedule.
