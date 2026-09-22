# Design Persistence API (pilot)

**Audience:** Antigravity (UI) and Integration Lead.  
**Backend branch:** `feat/pilot-design-persistence`  
**Scope:** Durable create / save / reopen by design ID for the wardrobe investor pilot.  
**Out of scope:** UI, Three.js, FurniSpec calculation changes, PartGraph compiler, furniture rule values, CNC qualification.

## Auth

All endpoints require:

```http
Authorization: Bearer <supabase-access-token>
```

Fail closed: missing/invalid auth → `401` / `403`.  
Never send API keys or provider credentials in design bodies.

Test-only (local CI): set `FURNIAI_PERSISTENCE_TEST_AUTH=yes` and use `Authorization: Bearer test:<userId>`.

This bypass is now **structurally unreachable on any deployed environment**, whatever the flag says. `testAuthBypassAllowed()` requires all three of: the explicit flag, `NODE_ENV !== "production"`, and `VERCEL_ENV` absent. Vercel sets both markers on Production *and* Preview, so the flag cannot re-open it from the dashboard. Previously only a code comment stood between a mis-set environment variable and any caller being able to become any user.

## Endpoints

### `POST /api/designs`

Create a design shell (no revision yet).

Request:
```json
{ "name": "Living room wardrobe" }
```

Response `201`:
```json
{
  "ok": true,
  "designId": "<uuid>",
  "ownerUserId": "<uuid>",
  "name": "Living room wardrobe",
  "createdAt": "...",
  "updatedAt": "...",
  "latestRevision": null
}
```

### `GET /api/designs`

List the caller's designs.

### `GET /api/designs/:designId`

Design summary + latest revision metadata (not full PartGraph).

### `POST /api/designs/:designId/revisions`

Save an **accepted** revision. Revisions are **immutable**.

Request:
```json
{
  "revision": 1,
  "fingerprint": "sha256:...",
  "furniSpec": { "...": "..." },
  "partGraph": { "...": "..." },
  "origins": { "envelope.widthMm": "CUSTOMER_STATED" },
  "validationStatus": "ACCEPTED",
  "expectedPreviousRevision": null
}
```

For revision `n>1`, send `expectedPreviousRevision: n-1` so concurrent saves fail closed as `STALE_REVISION`.

Server recomputes the FurniSpec fingerprint and rejects `FINGERPRINT_MISMATCH` if the body fingerprint does not match.

### `GET /api/designs/:designId/revisions`

List revision summaries (`revision`, `fingerprint`, `specId`, `createdAt`).

### `GET /api/designs/:designId/revisions/:revision`

**Reopen** — returns full `furniSpec`, `partGraph`, `origins`, `fingerprint`.

## Fail-closed codes

| Code | HTTP | When |
|------|------|------|
| `MISSING_AUTH` | 401 | No Bearer token |
| `UNAUTHORIZED` | 403 | Another user's design |
| `MISSING_DESIGN` | 404 | Unknown design/revision |
| `STALE_REVISION` | 409 | Concurrent / out-of-order save |
| `CONFLICT_REVISION` | 409 | Revision number already exists |
| `FINGERPRINT_MISMATCH` | 409 | Body fingerprint ≠ recomputed |
| `INVALID_FURNISPEC` | 400 | Spec shape invalid |
| `INVALID_PARTGRAPH` | 400 | PartGraph validation failed |
| `UNSUPPORTED_COMPONENT` | 400 | Unsupported component in graph |
| `BAD_REQUEST` | 400 | Malformed body / credential fields present |

## Client responsibilities (Antigravity)

- Undo history may stay client-side for the pilot.
- After each **accepted** edit, `POST` a new revision (do not overwrite).
- On reopen, replace in-memory state from the GET body; do not trust stale client caches.
- Export identity after reopen must use the returned PartGraph / fingerprint.

## Store

Selected per request by `getService()` in `src/lib/persistence/http.js`.

| Environment | Store | Behaviour |
|---|---|---|
| Local / test (no `VERCEL_ENV`, `NODE_ENV !== production`) | in-memory (`memoryStore.js`) | Single process. Not durable — by design. |
| Deployed, `SUPABASE_URL` + `SUPABASE_ANON_KEY` set | Supabase (`supabaseStore.js`) | Durable. |
| Deployed, Supabase **not** configured | none | **Fails closed**: `503 BAD_REQUEST`, "Design saving is not configured on this deployment. Nothing was saved." |

That last row matters. A deployed environment previously served every request from a module-level `Map`. On Vercel that Map is per-instance and per-lifetime, so a design saved by one invocation is simply absent from the next whenever another instance answers — save/reopen would pass locally and then fail intermittently in front of a customer, reporting a design that existed a minute ago as "not found". A deployment with no durable store now refuses the write instead of pretending to keep it.

### Row-level security is enforced twice

`supabaseStore.js` queries PostgREST with the **caller's own access token**, never a service-role key, so the RLS policies in `supabase/schema.sql` apply to every read and write. The ownership check in `designService.js` remains the first line of defence and still produces the 403/404; Postgres is an independent second one. A service-role key would defeat exactly that property, so the store never reads one — `SUPABASE_SERVICE_ROLE_KEY` is deliberately unused by this path.

Revision immutability is likewise enforced by `unique (design_id, revision)` in the database, not only by the service's read-then-write check (which two concurrent saves can both pass). The unique violation surfaces as `CONFLICT_REVISION`.

### Required environment variables

`SUPABASE_URL` and `SUPABASE_ANON_KEY` — **no `NEXT_PUBLIC_` prefix**. The prefixed names are read by nothing in this repository. As of 2026-09-22 the `furniai-builder` Vercel project has only `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` set, so persistence answers `401 MISSING_AUTH` on every deployed request until the unprefixed pair is added. Add them as **Config**, not Secret. Changing environment variables does not trigger a redeploy.
