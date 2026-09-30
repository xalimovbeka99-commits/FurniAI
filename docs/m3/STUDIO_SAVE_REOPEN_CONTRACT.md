# Studio & My Designs — save / reopen contract (2026-09-30)

**Audience:** CraZy, Antigravity (Studio / `index.html`), Grok's Designs Engineer, Grok's
Quality Engineer.
**Backend branch:** `feat/pilot-design-persistence`, head listed in
[`BACKEND_HANDOFF_2026-09-30.md`](./BACKEND_HANDOFF_2026-09-30.md).
**Server contract (normative):** [`DESIGN_PERSISTENCE_API.md`](./DESIGN_PERSISTENCE_API.md).
This file is the client half: what the Studio must do with those answers.

---

## 0. Ancestry — check this before integrating

| Line | Tip | Contains 55998dd work? |
|---|---|---|
| Studio candidate `feat/studio-interface-redesign` (GitHub) | `3ed620c` | **No.** It contains `71e72b6` (via `9998853`), not `2c7a88f…55998dd` nor this work. |
| Antigravity local `antigravity/studio-designs-client` | `3ed620c` + **uncommitted** `index.html`, `designs-api-client.js`, `src/lib/persistence/designsApiClient.js(+test)`, `scripts/build-static.mjs`, a hand-edited line in `partgraph-runtime-bridge.js` | No |
| Grok `grok/persist-db-harness` | `8566d34` = `3ed620c` + harness only | No |
| This branch | `55998dd` → this work | Yes |

Verified in a scratch integration (`3ed620c` + Antigravity's working tree as staged
2026-09-30 + `8566d34` + this branch): **both merges clean, no conflicts; rebuilt bundles
byte-identical to the merged files, including `designs-api-client.js`; vitest 1400 pass;
Grok's simulated harness 6/6; Playwright `design-state-protection` 5/5,
`export-identity-verifier` 4/4, `studio-save-reopen-staleness` 3/3 (test 1 is an expected
failure — see §4).** Antigravity's working tree is uncommitted, so that result is for the
files as they were on disk at staging time, not for a SHA.

> The candidate's bridge line `fingerprintFurniSpec: () => fingerprintFurniSpec` was added to
> the **built** bundle by hand. A rebuild from source would have removed it. This branch
> exports it from `src/lib/adapters/browserBridge.js`; the rebuilt line is identical, so the
> merge keeps it and it is now reproducible.

---

## 1. Authentication flow

1. The Studio signs the customer in with the Supabase client already in `index.html`
   (project ref `upavdjmovubblowrxncp`, anon key — both public by design).
2. Every `/api/designs*` call sends `Authorization: Bearer <session.access_token>`. Nothing
   else identifies the caller; never put a token or key in a body.
3. The server verifies the token against **its** `SUPABASE_URL`. **That must be the same
   project the Studio signs in with**, or every save is `401`. `GET /api/design/health`
   (Preview/local) now reports `persistence.projectRef` and `acceptsStudioSignIn`.
4. Answers: `401 MISSING_AUTH` = sign in again (the **only** sign-in signal);
   `503 AUTH_UNAVAILABLE` = auth outage, try later; `503 PERSISTENCE_NOT_CONFIGURED` =
   saving is off on this deployment. Do not open the sign-in modal for the two 503s.

---

## 2. Request / response shapes (exact)

Error body, every endpoint: `{ "ok": false, "code": "<CODE>", "error": "<customer-safe>", "details"?: {…} }`

| Call | Request | Success |
|---|---|---|
| `POST /api/designs` | `{ "name": string }` — **no `designId`** (sending one is `400 BAD_REQUEST`) | `201 { ok, designId, ownerUserId, name, createdAt, updatedAt, latestRevision: null }` |
| `GET /api/designs` | — | `200 { ok, designs: [{ designId, ownerUserId, name, createdAt, updatedAt }] }` newest first |
| `GET /api/designs/:id` | — | `200 { ok, design: {…}, latestRevision: { revision, fingerprint, specId, validationStatus, createdAt } \| null }` |
| `POST /api/designs/:id/revisions` | `{ revision, expectedPreviousRevision, fingerprint, furniSpec, partGraph, origins, validationStatus: "ACCEPTED" }` | `201 { ok, designId, revision, fingerprint, createdAt, validationStatus }`; identical replay `200 { …, idempotentReplay: true }` |
| `GET /api/designs/:id/revisions` | — | `200 { ok, designId, revisions: [{ revision, fingerprint, specId, validationStatus, createdAt }] }` |
| `GET /api/designs/:id/revisions/:n` | — | `200 { ok, designId, revision, fingerprint, furniSpec, partGraph, origins, validationStatus, createdAt }` |

`revision` / `expectedPreviousRevision` are the **stored** numbers: first save `1` / `null`;
thereafter `latestStored + 1` / `latestStored`. `fingerprint` =
`PartGraphBridge.fingerprintFurniSpec(furniSpec)`. `partGraph` must be the one the pipeline
produced for that exact `furniSpec` (the server recompiles and compares; it never
substitutes).

New in this delivery — a save of a spec whose geometry the kernel refuses:
`400 INVALID_FURNISPEC`, `details.compileError` ∈ `HANGING_DROP_NOT_ACHIEVABLE`,
`HANGING_RAIL_OUTSIDE_BAY`, `HANGING_RAIL_INTERSECTS_PART`, `INTERIOR_PART_OUTSIDE_BAY`,
with `details.geometry` = `{ componentId | partId, bayIndex, …measured mm }`. Nothing is
written. The Studio cannot normally reach this — the pipeline refuses the same design first
(§5) — so seeing it on a save means the client paired a spec with something the pipeline did
not produce.

---

## 3. Identities — five, never substituted

| Identity | Owner | Changes on | Sent to `/api/designs`? |
|---|---|---|---|
| `designId` | **server** (create) | never for one design | in the path |
| `specId` | FurniSpec | never within one design (changing it is `400`) | inside `furniSpec` |
| **stored revision** | server | each confirmed save, +1 | `revision`, `expectedPreviousRevision` |
| displayed revision (`aiWardrobeState.revision`, `revRevision`) | UI | edit +1, **Undo −1** | **never** |
| change token (`editSequence`) | UI | every edit **and** Undo; restarts on reopen | never |
| editing session (`activeStudioSessionId`) | UI | page load, reset, reopen, design switch | never |

Consequences:
- **Save after Undo** = stored + 1 with the undone content. The server does not compare the
  spec's own `revision` with the stored number; the Undo snapshot must **not** carry
  `durableRevision` (the candidate's snapshots correctly don't).
- **"Saved"** is true only while the change token equals the token that was saved.
- **A response belongs to the session that sent it.** Apply it only if that session is still
  live.

---

## 4. What the Studio candidate gets wrong today, and the fix

Found by reading Antigravity's working-tree `index.html` (`persistAcceptedRevision`,
`reopenDesignFromApi`) and proven in Chromium by
`tests/browser/studio-save-reopen-staleness.spec.js`.

| # | Defect | Observed / consequence | Fix |
|---|---|---|---|
| D1 | After each `await`, `persistAcceptedRevision` writes `durableDesignId` / `durableRevision` / `durableFingerprint` into whatever `aiWardrobeState` is current. `reopenAiWardrobeDesign` replaces that object. | **Test 1 (Chromium):** save of A in flight, customer reopens B (stored rev 4); A's answer lands → B shows rev **1** with A's fingerprint. B's next save claims to build on 1 → `409 STALE_REVISION` for a customer who did nothing wrong. | Capture session at start; apply only if unchanged (coordinator does). |
| D2 | A create answered after a reopen/reset is adopted by the new design. | Next save of the new design goes to the wrong `designId`. | Same; the coordinator reports `orphanedDesignId` (an empty shell, harmless) and adopts nothing. |
| D3 | No single-flight. Accepted edits call `persistAcceptedRevision({quiet:true})` without awaiting (three call sites), so two quick edits start two saves; before the first create returns they start **two creates**. | Two saves compute the same `prior + 1`: one is refused `STALE_REVISION` against the customer's own save. Two creates leave two design shells and the later answer overwrites `durableDesignId`. | Serialise saves (the coordinator queues them and creates once). |
| D4 | After a lost answer (network/timeout) the retry button re-reads current state. | If the lost save committed and the customer edited since, the retry is a *different* body for the same number → `STALE_REVISION`; the committed save is reported as a failure. | Keep the exact body; resend it identically before anything new (`200 idempotentReplay`). |
| D5 | Any 409 (incl. `FINGERPRINT_MISMATCH`, `REVISION_INTEGRITY_FAILED`) shows "Revision conflict" + a retry that repeats the blind save. | Retrying a refused body cannot succeed; retrying a stale one bumps nothing and loops. | `STALE_REVISION` → fetch latest, let the customer choose (keep mine → `adoptLatestAsBase(latest)`; take theirs → reopen). Other 409/400 → refused, keep on-screen state, no retry. |
| D6 | `reopenDesignFromApi` has no supersession: two reopens (or a reopen then "New design") can land out of order. | The earlier-clicked design replaces the later one. | Reopen ticket; late reopen = `SUPERSEDED`. |
| D7 | `createDesignsApiClient.createDesign({designId})` forwards a client id. | Server `400 BAD_REQUEST` (ids are server-assigned since `91761e8`). | Remove the option. |
| D8 | `DESIGNS_API_ERROR` / `READABLE` lack `AUTH_UNAVAILABLE`, `PERSISTENCE_NOT_CONFIGURED`, `REVISION_INTEGRITY_FAILED`; fallback maps any `409` to `STALE_REVISION`, any 502/503 to `STORAGE_UNAVAILABLE`. | Body `code` still wins, so behaviour is right when the server answers; the fallbacks are wrong for a body-less 409/503. | Add the three codes; fall back to `UNKNOWN` rather than guessing. |

### The coordinator (backend-owned, in the bundle you already load)

`AiDesignerTransport.createDesignSaveCoordinator` — source
`src/lib/persistence/designSaveCoordinator.js`, 12 unit tests against the real design
service, browser test 2. It takes Antigravity's client unchanged.

```js
const coord = AiDesignerTransport.createDesignSaveCoordinator({
  client: createDesignsApiClient(),          // Antigravity's, unchanged
  getToken: getStudioAccessToken,            // may be async
  getSessionId: () => getActiveStudioSessionId(),
});
coord.reset(getActiveStudioSessionId());      // page load and every "New design"

// Save button / autosave:
const out = await coord.save({
  furniSpec: aiWardrobeState.spec,
  partGraph: aiWardrobeState.partGraph,
  fingerprint: PartGraphBridge.fingerprintFurniSpec(aiWardrobeState.spec),
  origins: aiWardrobeState.origins || {},
  name,                                      // used only when creating
  changeToken: aiWardrobeState.editSequence,
});
switch (out.status) {
  case "SAVED": case "REPLAYED":   /* badge: coord.isSaved(aiWardrobeState.editSequence) */ break;
  case "DISCARDED_STALE_SESSION":  /* do nothing: the customer is elsewhere */ break;
  case "UNCONFIRMED":              /* "Not confirmed — Retry" → coord.retryPending() */ break;
  case "SIGN_IN":                  /* open sign-in, then coord.retryPending() */ break;
  case "CONFLICT":                 /* show out.latest; keep mine → coord.adoptLatestAsBase(out.latest.revision) then save; take theirs → reopen */ break;
  case "REFUSED":                  /* out.error.code; keep state; no retry */ break;
  case "NOT_CONFIGURED":           /* "Saving isn't available here" */ break;
  case "MISSING_DESIGN":           /* treat as a new design: coord.reset(...) */ break;
}

// My Designs → Open:
const r = await coord.reopen({ designId });   // revision optional (= latest)
if (r.status === "REOPENED") {
  reopenAiWardrobeDesign({ /* from r.payload, as today */ });      // rotates the session
  coord.bind({ sessionId: getActiveStudioSessionId(), designId: r.designId,
               storedRevision: r.storedRevision, specId: r.specId, name: r.name });
}   // SUPERSEDED → ignore; MISSING_DESIGN → "not available"; REFUSED (integrity) → do not load
```

Order matters on reopen: **rotate the session, replace state, then `bind`.** An answer
from the old session is then discarded by both the AI transport (session guard) and the
coordinator.

Test 1 of `studio-save-reopen-staleness.spec.js` is marked `test.fail`: it documents D1 and
will report "unexpectedly passed" once the Studio routes saves through the coordinator (or
an equivalent guard) — then remove the marker.

---

## 5. Kernel refusals the Studio now receives (hanging drop)

From this delivery the pipeline answers some designs `VALIDATION_FAILED` that it previously
previewed — see [`HANGING_DROP_GEOMETRY.md`](./HANGING_DROP_GEOMETRY.md). For an edit,
`applyConversationalEdit` returns `{ ok: false, error }`; nothing on screen changes (browser
test 3: "Make it 1900 mm high" on a 2400 mm draft → refused, viewer/export PartGraph and
revision unchanged). The `error` text is the kernel's
(`…declares a clear drop of 1400mm, but only 1296mm is available…`); customer wording is
the Studio's to choose — the structured code is in `validation.errors[0].code` and
`.details` on the pipeline result.

---

## 6. Harnesses — one database setup for both teams

- `node scripts/db-verify/with-local-stack.mjs -- <command>` starts PostgreSQL 16 +
  PostgREST + the real `/api/designs` handlers and gives the child
  `PERSISTENCE_REAL_DB, FURNIAI_TEST_URL, SUPABASE_URL, SUPABASE_ANON_KEY, TOKEN_A, TOKEN_B`
  (and the `FURNIAI_DB_TEST_*` names) in its environment only.
- Grok's `run-real-db-harness.mjs --real-db` ran through it: **6/6** (evidence
  `docs/m3/evidence/2026-09-30/grok-harness-realdb-on-local-postgres.md`). Label: *real
  PostgreSQL, local, JWT shim — not hosted Supabase.*
- Differences to keep in mind: Grok case 05 reads through a second HTTP client of the
  **same** server process; `verify-persistence-db.mjs` T4 uses two independent processes
  (pid, boot id, refused port) with a negative control. Case 03 races 2 writers × 3;
  T2 races 8 × 50 from separate OS processes. Use T2/T4 for concurrency and durability
  claims; use the Grok cases as the portable smoke set, including against hosted `--target`.
