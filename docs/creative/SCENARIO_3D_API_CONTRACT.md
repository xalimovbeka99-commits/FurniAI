# Scenario 3D concept generation — API contract and handoff

**Date:** 2026-10-04 · **Revision 2** (after Grok's intake of `7f42f95`) · **Branch:**
`feat/scenario-3d-generation` · **Base:** candidate `15a571f` merged with backend deliveries
`0c1a624` (merge `17f7341`).
**Status of this document: PROPOSED.** Not yet agreed by Antigravity, Grok and CraZy; nothing
in the interface is wired to it. Object to anything here before wiring.

### Changes in revision 2 (all contract-visible changes are additive except the first)

| # | Change | Why |
|---|---|---|
| R2-1 | Customers can no longer write generation records. Server-only writes (`SUPABASE_SERVICE_ROLE_KEY`), owner `SELECT` only, full-row signature, row version, database guard trigger. See §3a. | Intake defect: an owner could `PATCH` their running job to `failed` and buy a second generation. |
| R2-2 | "One active job" is now per **reference** (was per reference and model). | A model change must not open a second concurrent purchase. |
| R2-3 | New `409 PRIOR_SUBMISSION_UNKNOWN`; request field `acknowledgeUnknownCharge`. | After an unknown outcome, a second purchase must be deliberate. |
| R2-4 | `usage.billingOutcome` on every job; no response says a provider request was free. See §4. | The "Charged? no" column in revision 1 claimed what Scenario has not guaranteed. |
| R2-5 | New `422 INVALID_IMAGE`; `reference.width`, `height`, `validation`. See §2.2. | Revision 1 checked the file signature only. |
| R2-6 | Fixture pack: `docs/creative/fixtures/`. See §8. | Requested for UI wiring. |

**Not pushed. Not merged. Nothing deployed. No migration applied. No Scenario call of any
kind has been made — not even a free one: this workspace has no Scenario credentials.
Zero credits spent.**

---

## 1. What this is, and is not

Reference image → Scenario image-to-3D job → a downloadable mesh, shown in FurniAI as an
**AI visual concept**.

A generated mesh is **not** a FurniAI design. It is not a FurniSpec, is not compiled to a
PartGraph, has no verified measurements and no separately editable doors or panels. The
API never links a concept to a `designId`, and every job and asset response carries:

```json
"concept": { "kind": "visual_concept", "editable": false, "dimensionsVerified": false,
             "partsSeparable": false, "manufacturable": false, "notice": "AI-generated visual concept. …" }
```

**UI rule:** show `concept.notice` wherever the mesh is shown. Do not load a concept into
the editable builder, do not show dimensions for it, do not offer export/production from it.

Anthropic (`/api/design/propose`, `/api/chat`, `/api/wardrobe/chat`), `/api/designs*` and
the builder are untouched. Scenario is used for nothing else.

---

## 2. Endpoints

One serverless function, `api/creative.js` (the project has 10 functions; Vercel Hobby
allows 12), dispatched on `?resource=`.

**Auth:** every request needs `Authorization: Bearer <Supabase access token>` — the same
caller resolution as `/api/designs` (`src/lib/persistence/auth.js`). `401 MISSING_AUTH`,
`503 AUTH_UNAVAILABLE`, `503 PERSISTENCE_NOT_CONFIGURED` behave as documented in
`DESIGN_PERSISTENCE_API.md` (their message text mentions "design"; switch on `code`).
All responses are JSON, `cache-control: no-store`. Errors: `{ ok:false, code, error, details? }`.

### 2.1 `GET /api/creative?resource=config`
```json
{ "ok": true, "provider": "scenario", "configured": false,
  "missing": ["SCENARIO_3D_MODEL_ID"], "modelId": null,
  "liveGenerationEnabled": false, "maxCostPerJob": null,
  "reference": { "acceptedTypes": ["image/png","image/jpeg","image/webp"], "maxBytes": 3145728 } }
```
Hide or disable the feature unless `configured && liveGenerationEnabled && maxCostPerJob != null`.

### 2.2 `POST /api/creative?resource=references`
```json
{ "name": "wardrobe.jpg", "contentType": "image/jpeg", "dataBase64": "<plain base64, no data: prefix>" }
```
`contentType` is optional; the **bytes** decide. PNG, JPEG, WebP. Max **3 MB** raw (Vercel
refuses bodies over 4.5 MB and base64 adds a third). 16–8192 px per side, ≤ 40 MP.

**What validation does and does not prove** — reported as `reference.validation`:

| `validation` | Formats | Proven | Not proven |
|---|---|---|---|
| `decoded` | PNG (non-interlaced) | every chunk checksum; the pixel stream decompresses completely and matches the header's dimensions; scanline filters are legal | anything about what the picture shows |
| `structure` | JPEG, WebP, interlaced PNG | well-formed container, dimensions read, image data and end marker present | **that the compressed pixel data decodes.** A file with corrupt entropy-coded data can pass; Scenario is the final decoder |

No image-decoding dependency is added to the serverless function, which is why JPEG and WebP
stop at `structure`. A full decode for those is possible with a decoder library — an
open decision, not done.

`201` new · `200` when the same bytes were uploaded before (`reused: true`, no second
provider upload):
```json
{ "ok": true, "reused": false,
  "reference": { "referenceId": "uuid", "name": "wardrobe.jpg", "contentType": "image/jpeg",
                 "bytes": 482113, "sha256": "…", "width": 1200, "height": 1600,
                 "validation": "structure", "createdAt": "…" } }
```
`400 BAD_REQUEST` · `413 FILE_TOO_LARGE` · `415 UNSUPPORTED_FILE_TYPE` (not PNG/JPEG/WebP, or
content ≠ declared type) · `422 INVALID_IMAGE` (right type; truncated, corrupt or outside the
size limits) · provider errors (§4).

### 2.3 `POST /api/creative?resource=jobs`
```json
{ "referenceId": "uuid", "idempotencyKey": "8–128 chars of A–Z a–z 0–9 _ -",
  "acknowledgeUnknownCharge": false }
```
`acknowledgeUnknownCharge` is optional and only matters after `PRIOR_SUBMISSION_UNKNOWN`.
**`idempotencyKey` is mandatory.** Generate one (e.g. `crypto.randomUUID()`) **per click of
Generate**, keep it, and resend it unchanged on any retry of that click.

| Answer | Meaning |
|---|---|
| `202 { job, replayed:false }` | Submitted. One paid request was sent. |
| `200 { job, replayed:true }` | This key was already used: the existing job, **no provider call**. |
| `409 DUPLICATE_ACTIVE_JOB` | A job for this reference is still running. `details.jobId` is it. No request sent. |
| `409 IDEMPOTENCY_KEY_REUSED` | Key already used with a different reference. No request sent. |
| `409 PRIOR_SUBMISSION_UNKNOWN` | The last job for this reference ended `submission_unknown` — it may have run and been charged. `details.jobId`. Show that to the user; only if they choose to go on, resend with `acknowledgeUnknownCharge: true`. No request sent. |
| `409 RECORD_INTEGRITY_FAILED` | A stored record for this reference does not verify. No request sent; needs an operator. |
| `404 MISSING_REFERENCE` | Not found (or not the caller's — identical answer). |
| `402 COST_CAP_EXCEEDED` | Cost preview above the cap. `details.estimatedCost`, `details.maxCostPerJob`. Key not consumed. No request sent. |
| `502 COST_UNVERIFIED` | Cost preview unreadable. No request sent. |
| `503 CREATIVE_NOT_CONFIGURED` / `CREATIVE_GENERATION_DISABLED` / `CREATIVE_STORE_NOT_CONFIGURED` | Deployment not set up. No request sent. |
| provider errors (§4) | The paid request **was** sent. `details.jobId`, `details.jobStatus`, `details.outcomeUnknown`, `details.billingOutcome`. |

"No request sent" means FurniAI did not send the paid generation request. It is the only
situation in which this API states that nothing can have been charged for a generation.

### 2.4 `GET /api/creative?resource=jobs&jobId=<id>` — status and result
```json
{ "ok": true,
  "job": {
    "jobId": "uuid",
    "status": "processing",
    "provider": "scenario", "model": "<configured model id>",
    "sourceReferenceId": "uuid",
    "providerStatus": "<verbatim from Scenario>", "providerProgress": null,
    "outputs": [],
    "usage": { "estimatedCost": 12, "reportedCost": null, "unit": "provider_cost_units",
               "billingOutcome": "unconfirmed" },
    "storage": { "durableCopy": false, "reason": "ASSET_STORAGE_NOT_CONFIGURED" },
    "error": null,
    "createdAt": "…", "submittedAt": "…", "completedAt": null, "updatedAt": "…",
    "concept": { "…": "…" } },
  "refresh": { "ok": true } }
```
Without `jobId`: `{ ok, jobs: [ …newest first, max 50… ] }`.

**`status` — the only values, owned by FurniAI:**

| `status` | Terminal | Meaning | UI |
|---|---|---|---|
| `submitting` | no | Reserved; the paid call is in flight. | spinner |
| `processing` | no | Scenario accepted it. | spinner; keep polling |
| `succeeded` | yes | `outputs` has ≥ 1 entry. | show / download |
| `failed` | yes | `error.code`, `error.message`. | show the message |
| `submission_unknown` | yes | The paid call was sent and no answer arrived. **It may have been charged.** | say exactly that; do **not** auto-retry |

- **Polling:** every 3–5 s while non-terminal. The server asks Scenario at most once per 2 s per job.
- **No progress percentage exists in this contract.** `providerProgress` is non-null only if
  Scenario sends a number; its scale is unverified — do not render it as a percentage.
- `providerStatus` is Scenario's own word, for diagnostics; never branch on it.
- `refresh.ok:false` means the status *check* failed; the job is unchanged — keep polling.
- `outputs[i]` = `{ index, format, mimeType }`. `format` is read from the returned asset
  (`glb`, `gltf`, `fbx`, `obj`, `usdz`, `stl`, `ply`, `zip`) or **`null` when unrecognised**.
  Only load `glb`/`gltf` in the viewer; offer anything else as download-only.
- `usage.unit` is deliberately generic: which unit Scenario bills this account in is unverified.
- `usage.billingOutcome`: `not_submitted` (the paid request has not been sent for this job) ·
  `reported` (Scenario reported a cost: `reportedCost`) · `unconfirmed` (the request was or may
  have been sent and Scenario has reported no cost). **`unconfirmed` is not "free"** — never
  render it as "no charge". `estimatedCost` is the pre-submission preview, not a bill.

### 2.5 `GET /api/creative?resource=asset&jobId=<id>&index=0` — display / download
```json
{ "ok": true,
  "asset": { "jobId": "uuid", "index": 0, "url": "https://…", "format": "glb", "mimeType": null,
             "resolvedAt": "…", "expiresAt": null, "expiryKnown": false, "durableCopy": false,
             "concept": { "…": "…" } } }
```
The address is resolved from Scenario **on every call** and is never stored. Whether and
when Scenario's addresses expire is unverified, so: **call this endpoint each time you
display or download; never cache or persist `url`; if a load fails, call it again once.**
`409 ASSET_NOT_READY` · `410 ASSET_UNAVAILABLE` (Scenario no longer has it and there is no
FurniAI copy) · `409 RECORD_INTEGRITY_FAILED`.

The browser loads the mesh straight from `url`. **Whether Scenario's CDN sends CORS headers
that let `GLTFLoader` fetch it is unverified**; if it does not, display needs the storage
decision in §6.

---

## 3. Duplicate-submission and billing protection

1. One job per `(user, idempotencyKey)`; replays send nothing to the provider.
2. One active job per `(user, reference)` — enforced atomically by a unique index.
3. Generation refused unless `SCENARIO_LIVE_GENERATION_ENABLED=yes` **and** a numeric
   `SCENARIO_MAX_COST_PER_JOB` is set.
4. Scenario's cost preview (`?dryRun=true`) must be readable and ≤ the cap.
5. The job row is written **before** the paid request.
6. The paid request is sent once. **There are no retries anywhere in this code.** A lost
   answer becomes `submission_unknown`; generating again for that reference then needs
   `acknowledgeUnknownCharge: true`.
7. Before any of this, **every** stored job for the reference must verify (§3a). One that
   does not blocks new generations for that reference.

A deliberate second generation from the same reference is possible only after the first
is terminal, with a new key.

### 3a. Who may write generation records (revision 2)

**Defect found at intake, reproduced, closed.** In revision 1 the owner had an `UPDATE`
policy on `creative_jobs` and the signature covered six fields, not `status`. An owner
could `PATCH` their running row to `failed`; the row still verified, the one-active-job
index no longer saw it, and a new idempotency key bought a second generation.

Signing more fields is necessary and **not sufficient**: a signature cannot detect a row
being *deleted*, *moved* to another reference, or *rolled back* to an older state that was
validly signed at the time. Those are closed only by taking the write away. So:

| Layer | What it does |
|---|---|
| **Privileges and RLS** | `anon`: nothing. `authenticated`: `SELECT` own rows. No `INSERT`/`UPDATE`/`DELETE` policy **and** the table privileges are revoked, on both tables. |
| **Server writes** | `/api/creative` writes with `SUPABASE_SERVICE_ROLE_KEY`; reads still run as the caller under RLS. Without that key a deployed environment answers `503 CREATIVE_STORE_NOT_CONFIGURED` — it never falls back to writing as the caller. |
| **Guard trigger** | Binds every writer, the server included: identity columns immutable, `version` must advance by exactly 1, provider job id cannot change once set, only `submitting → processing/failed/submission_unknown` and `processing → processing/succeeded/failed`; terminal states are final. |
| **Compare-and-swap** | Every update is conditional on the row version; a stale writer changes nothing. |
| **Signature** | HMAC over **every** stored column (a test fails if a column is added without being signed). Any row that does not verify is never acted on, is hidden from lists, and blocks new generations for its reference. |

This is a deliberate exception to the "never a service-role key" rule of
`persistence/supabaseStore.js`: a wardrobe design is content its owner authors, and is
re-validated on every read; a job row is a billing record its owner has no business writing.
The key bypasses RLS, so the module that holds it touches only the two creative tables and
names the owner in every write. **Bekzod: this adds one server secret; veto it here if you
prefer a narrower mechanism** (a `SECURITY DEFINER` function gated by a creative-only secret
would work, at the cost of more SQL to maintain).

---

## 4. Provider errors — and what is known about billing

FurniAI knows whether **it sent** the paid request. It does not know what Scenario charged
unless Scenario reports a cost. **Scenario's billing policy for refused, failed or
interrupted generations has not been verified**, so no code path, message or field here
states that such a request was free.

| `code` | HTTP | When | Paid request sent? | `billingOutcome` |
|---|---|---|---|---|
| `PROVIDER_INSUFFICIENT_CREDITS` | 402 | Scenario 402, or a 4xx whose message says credits/units are insufficient | yes, refused | `unconfirmed` |
| `PROVIDER_AUTH_REJECTED` | 502 | Scenario 401/403 — the deployment's keys | yes, refused | `unconfirmed` |
| `PROVIDER_RATE_LIMITED` | 429 | Scenario 429 | yes, refused | `unconfirmed` |
| `PROVIDER_REJECTED_REQUEST` | 502 | other Scenario 4xx; `details.providerMessage` | yes, refused | `unconfirmed` |
| `PROVIDER_UNAVAILABLE` | 502 | network error, timeout (30 s) or 5xx | yes; answer lost or unusable → `submission_unknown` | `unconfirmed` |
| `PROVIDER_UNEXPECTED_RESPONSE` | 502 | a 2xx this code cannot read → `submission_unknown` | yes | `unconfirmed` |
| `PROVIDER_GENERATION_FAILED` | — (in `job.error`) | Scenario accepted the job and later reported it failed | yes, accepted | `reported` if Scenario gives a cost, else `unconfirmed` |

The same codes can come from the reference upload and the cost preview; those requests are
not generations, and whether Scenario bills for either is likewise unverified (its
documentation describes `dryRun` as a preview "without actually generating").

A refusal with a 4xx most likely costs nothing — that is an expectation, not a fact this
API will assert. The reconciling source is the Scenario account's own usage page.

How Scenario signals exhausted credits is **unverified**; the mapping above is the
conventional status plus a message match, and anything unrecognised is refused, not guessed.

---

## 5. Configuration (server environment only)

`SCENARIO_API_KEY`, `SCENARIO_API_SECRET`, `SCENARIO_3D_MODEL_ID`, `SCENARIO_3D_IMAGE_PARAM`,
`SCENARIO_3D_IMAGE_PARAM_IS_ARRAY`, `SCENARIO_3D_EXTRA_PARAMS_JSON`, `SCENARIO_STATUS_SUCCESS`,
`SCENARIO_STATUS_FAILURE`, `SCENARIO_ASSET_UPLOAD_DATA_URL`, `SCENARIO_LIVE_GENERATION_ENABLED`,
`SCENARIO_MAX_COST_PER_JOB`, `CREATIVE_RECORD_SIGNING_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (new in
revision 2, writes to the two creative tables only) — see `.env.example`.

**The model id, its image-input name and Scenario's status words have no defaults in the
code.** They are to be set from an authenticated read:

```
npm run scenario:discover -- model <modelId>                                           # read-only
npm run scenario:discover -- estimate <modelId> <image> <param> --upload-ok [--array]  # see below
npm run scenario:discover -- job <providerJobId>                                       # read-only
```

**`estimate` uploads the reference image.** It sends the image file to the Scenario account
(`POST /assets`), where it stays, and then requests a cost preview. It starts no generation.
It refuses to run without `--upload-ok`. Use an image you are content to have in that account.
There is no command in this repository that starts a generation outside `/api/creative`, and
`/api/creative` refuses unless `SCENARIO_LIVE_GENERATION_ENABLED=yes` — **which is not set
anywhere and must stay unset until Bekzod authorises a cap.**

**Where discovery can run.** Neither this cloud workspace nor the desktop workspace's
sandbox can reach `api.cloud.scenario.com` (both blocked by network policy, checked
2026-10-04). Discovery therefore has to run on Bekzod's own machine (`npm run
scenario:discover …` in the repository, after `npm ci`), or the host has to be allowed for
the workspace.

No file shipped to the browser contains a Scenario credential; `api/creative.js` returns
none (asserted by test).

---

## 6. Unresolved dependencies — each blocks something specific

| # | Dependency | Blocks | Owner |
|---|---|---|---|
| U1 | **Scenario credentials** in `.env.local` (checked 2026-10-04: still absent), **and a place to run discovery** — the workspaces cannot reach `api.cloud.scenario.com` | everything real | Bekzod |
| U2 | **Model choice + its real schema.** Candidates named in Scenario's public docs — `model_meshy-7-img23d`, `model_meshy-img23d`, `model_meta-sam-3d-objects`, and Tripo/Hunyuan/Hitem3D families — none verified for this account, and no output format is documented for any of them | config; whether the asset is a viewer-loadable GLB | Claude, after U1 |
| U3 | **Scenario's job status words.** Public pages disagree (`succeeded`/`failed` in the guides; `success`/`in_progress` in the MCP docs); the OpenAPI file returned 403 here | `SCENARIO_STATUS_*` | Claude, after U1 |
| U4 | **Spend cap** for the one real generation | the real result | Bekzod ("none yet", 2026-10-04) |
| U5 | **Durable job store.** The migration is written and **unapplied**; it also needs `SUPABASE_SERVICE_ROLE_KEY` and `CREATIVE_RECORD_SIGNING_KEY` in the environment. Without them a deployed environment answers `503`. Needs an approved non-production Supabase project | the feature on any Preview | Bekzod |
| U6 | **Durable asset storage.** No file-storage code or bucket exists. Assets live only at Scenario; `storage.durableCopy` is always `false` | keeping a concept after Scenario drops it; possibly display (U7) | Bekzod → Claude |
| U7 | CORS on Scenario asset URLs; URL expiry; upload encoding (raw base64 vs `data:` URL); the dry-run cost field; **Scenario's billing for refused/failed/interrupted jobs and for stored assets** | first real run; any "no charge" statement | Claude, after U1 |
| U8 | Agreement of this contract (revision 2) | UI wiring | Antigravity, Grok, CraZy |
| U9 | Service-role key for creative writes (§3a) — accept, or ask for the narrower mechanism | U5 | Bekzod |
| U10 | Full decode of JPEG/WebP references (needs a decoder dependency) — wanted or not | nothing; `structure` validation is in place | Bekzod / Grok |

---

## 7. Evidence — three tiers, kept apart

### Tier A — simulated provider, in-memory store (`npm run test:creative`)
**77 tests, all passing.** The real handler, service, client and HTTP against
`src/lib/creative/scenarioStandIn.js`. Nothing leaves the machine; nothing is billed. The
stand-in's status words (`sim-running`/`sim-done`/`sim-failed`), model id, costs and response
shapes are parameters of the test, **not claims about Scenario**.

Intake regression, as it failed on `7f42f95` before the fix:
```
× stored-record integrity > a running row flipped to failed (signature untouched) is refused,
  and a new key does NOT submit again
  → expected 2 to be 1        (paid calls)
```
Now passing, with: every stored job field tampered one at a time (14 fields) → refused, no
provider call, hidden from lists; signed-field list equals the stored columns; rollback to an
older signed state cannot unlock a generation; stale-version write refused; edited reference
refused; acknowledgement after `submission_unknown`; no provider-error response describes
the request as free. Image tests now use real, decodable images (`testImages.js`, synthetic
drawings); signature-only bytes — what revision 1's tests used — are asserted **refused**.

### Tier B — simulated provider, REAL PostgreSQL 16 + PostgREST 12 (`npm run verify:creative-db`)
Local throwaway cluster; the migration applied exactly as committed. **11/11.**

| | Check | Result |
|---|---|---|
| D1a/b | full journey; signed rows verify after `timestamptz`/`jsonb`/`double` round-trips | pass |
| D2a | **owner `PATCH status=failed` with their own token** | `403`, row unchanged |
| D2b | new idempotency key afterwards | `409 DUPLICATE_ACTIVE_JOB`, paid calls still 1 |
| D3 | owner `INSERT`/`DELETE`/key-edit on jobs; `INSERT`/`UPDATE` on references | all `403`, rows unchanged |
| D4 | other user / anonymous read | 0 rows / `401`; API `404` |
| D5 | 8 simultaneous submissions, 8 keys, one reference | exactly 1 paid call, 7 × `DUPLICATE_ACTIVE_JOB` |
| D5b | 8 replays of one key | 0 paid calls, one job id |
| D6 | **server credential** tries rollback / version skip / re-point | all refused by the trigger |
| D7 | stale-version write | 0 rows |
| D8 | catalog | `anon`: none; `authenticated`: `SELECT`; policies: `SELECT` only |

Reproduction of the defect on the **revision-1 migration** (`--reproduce`):
```
owner PATCH status=failed with the owner's own token → HTTP 200; stored status is now "failed";
sig still "sig-written-by-server"
PASS R1 DEFECT REPRODUCES   PASS R2 active rows for the reference: 0
```
Tier B proves PostgreSQL, PostgREST, RLS, privileges and the trigger. It does **not** prove
Supabase Auth (a JWT shim stands in) or any hosted project, and the role `service_role` is
modelled locally as `BYPASSRLS` with full table privileges, as on Supabase.

### Tier C — real Scenario
**None.** No authenticated or unauthenticated request has reached Scenario from this work.
Everything in §6 marked unverified is unverified. Paid generation is disabled and no
environment enables it.

### Mutation checks (guard removed → tests fail)
| Guard removed | Tests that then fail |
|---|---|
| verification of every stored job before a submission | 14 |
| signature narrowed back to the revision-1 fields | 11 |
| compare-and-swap on the row version | 1 |
| PNG pixel-stream decode | 1 |
| unknown-charge acknowledgement | 2 |
| owner `UPDATE` policy restored (the revision-1 migration) | the defect reproduces on PostgreSQL (R1, R2) |

### Repository gates on this branch
`npx vitest run` **1487 passed**, 0 failed, 4 skipped, 20 todo (revision 1: 1458; base: 1410) ·
`npm run test:validator` 21 pass, 0 fail, 3 todo · `npm run lint` exit 0 ·
`npm run build:legacy` leaves the committed bundles unchanged ·
`verify-creative-db.mjs` 11/11 · the existing `verify-persistence-db.mjs --local` still 8/8
(its shared local stack gained a `service_role` and an optional extra migration; additive) ·
`npm run docs:check` **fails on the base and on this branch alike**: three `file:///c:/…`
links in `docs/artifacts/studio-redesign-delivery/DELIVERY.md` (not touched here).

---

## 8. Fixture pack — `docs/creative/fixtures/`

32 JSON fixtures, one per response in this contract (every job status, every error code a UI
must handle), plus two binary files. **All simulated or synthetic; none produced by Scenario.**

- JSON: the real handler's responses against the stand-in, sanitised (fixed ids and
  timestamps). Shapes are the contract; provider-side values (`providerStatus`, model id,
  costs, `providerProgress`) are the stand-in's. `fixtures.test.js` fails if the pack drifts
  from the handler.
- `SYNTHETIC-box-not-scenario-generated.glb` — a hand-built 24-vertex grey box, labelled
  synthetic in its file name, `asset.generator` and `extras`. Loads in three's `GLTFLoader`
  (checked). It is for wiring the viewer and download; it shows nothing about a real mesh.
- `SYNTHETIC-reference-drawing.png` — a 64×48 local drawing for upload tests.
