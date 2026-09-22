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

Test-only (local CI): set `FURNIAI_PERSISTENCE_TEST_AUTH=yes` and use `Authorization: Bearer test:<userId>`. Must never be enabled in Production.

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

Pilot default serverless process uses an in-memory store (single-instance / test).  
Supabase tables `wardrobe_designs` + `wardrobe_revisions` are defined in `supabase/schema.sql` for the durable pilot deploy path.
