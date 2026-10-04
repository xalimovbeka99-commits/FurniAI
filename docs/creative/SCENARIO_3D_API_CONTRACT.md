# Scenario 3D concept generation — API contract and handoff

**Date:** 2026-10-04 · **Branch:** `feat/scenario-3d-generation` · **Base:** candidate `15a571f`
merged with backend deliveries `0c1a624` (merge `17f7341`).
**Status of this document: PROPOSED.** Antigravity and Grok have not yet agreed it; nothing
in the interface is wired to it. Object to anything here before wiring.

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
refuses bodies over 4.5 MB and base64 adds a third).

`201` new · `200` when the same bytes were uploaded before (`reused: true`, no second
provider upload):
```json
{ "ok": true, "reused": false,
  "reference": { "referenceId": "uuid", "name": "wardrobe.jpg", "contentType": "image/jpeg",
                 "bytes": 482113, "sha256": "…", "createdAt": "…" } }
```
`400 BAD_REQUEST` · `413 FILE_TOO_LARGE` · `415 UNSUPPORTED_FILE_TYPE` · provider errors (§4).

### 2.3 `POST /api/creative?resource=jobs`
```json
{ "referenceId": "uuid", "idempotencyKey": "8–128 chars of A–Z a–z 0–9 _ -" }
```
**`idempotencyKey` is mandatory.** Generate one (e.g. `crypto.randomUUID()`) **per click of
Generate**, keep it, and resend it unchanged on any retry of that click.

| Answer | Meaning |
|---|---|
| `202 { job, replayed:false }` | Submitted. One paid call was made. |
| `200 { job, replayed:true }` | This key was already used: the existing job, **no provider call**. |
| `409 DUPLICATE_ACTIVE_JOB` | A job for this reference is still running. `details.jobId` is it. Nothing submitted. |
| `409 IDEMPOTENCY_KEY_REUSED` | Key already used with a different reference. Nothing submitted. |
| `404 MISSING_REFERENCE` | Not found (or not the caller's — identical answer). |
| `402 COST_CAP_EXCEEDED` | Cost preview above the cap. `details.estimatedCost`, `details.maxCostPerJob`. Key not consumed. |
| `502 COST_UNVERIFIED` | Cost preview unreadable. Nothing submitted. |
| `503 CREATIVE_NOT_CONFIGURED` / `CREATIVE_GENERATION_DISABLED` / `CREATIVE_STORE_NOT_CONFIGURED` | Deployment not set up. Nothing submitted. |
| provider errors (§4) | `details.jobId`, `details.jobStatus`, `details.outcomeUnknown`. |

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
    "usage": { "estimatedCost": 12, "reportedCost": null, "unit": "provider_cost_units" },
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

1. One job per `(user, idempotencyKey)`; replays make no provider call.
2. One active job per `(user, reference, model)` — enforced atomically in the store
   (unique indexes in the migration), not just checked in code.
3. Generation refused unless `SCENARIO_LIVE_GENERATION_ENABLED=yes` **and** a numeric
   `SCENARIO_MAX_COST_PER_JOB` is set.
4. Scenario's free cost preview (`?dryRun=true`) must be readable and ≤ the cap.
5. The job row is written **before** the paid call.
6. The paid call is made once. **There are no retries anywhere in this code.** A lost
   answer becomes `submission_unknown`.
7. Rows are HMAC-signed by the server; a row edited around the API is refused, so a caller
   cannot point a job at someone else's Scenario asset.

A deliberate second generation from the same reference is possible only after the first
is terminal, with a new key.

---

## 4. Provider error codes

| `code` | HTTP | When | Charged? |
|---|---|---|---|
| `PROVIDER_INSUFFICIENT_CREDITS` | 402 | Scenario 402, or a 4xx whose message says credits/units are insufficient | no |
| `PROVIDER_AUTH_REJECTED` | 502 | Scenario 401/403 — the deployment's keys | no |
| `PROVIDER_RATE_LIMITED` | 429 | Scenario 429 | no |
| `PROVIDER_REJECTED_REQUEST` | 502 | other Scenario 4xx; `details.providerMessage` | no |
| `PROVIDER_UNAVAILABLE` | 502 | network error, timeout (30 s) or 5xx | **unknown** if on the paid call (`details.outcomeUnknown`) |
| `PROVIDER_UNEXPECTED_RESPONSE` | 502 | a 2xx this code cannot read | **unknown** if on the paid call |
| `PROVIDER_GENERATION_FAILED` | — (in `job.error`) | Scenario reported the job failed | per Scenario's policy — unverified |

How Scenario actually signals exhausted credits is **unverified**; the mapping above is the
conventional one plus a message match, and anything unrecognised is refused, not guessed.

---

## 5. Configuration (server environment only)

`SCENARIO_API_KEY`, `SCENARIO_API_SECRET`, `SCENARIO_3D_MODEL_ID`, `SCENARIO_3D_IMAGE_PARAM`,
`SCENARIO_3D_IMAGE_PARAM_IS_ARRAY`, `SCENARIO_3D_EXTRA_PARAMS_JSON`, `SCENARIO_STATUS_SUCCESS`,
`SCENARIO_STATUS_FAILURE`, `SCENARIO_ASSET_UPLOAD_DATA_URL`, `SCENARIO_LIVE_GENERATION_ENABLED`,
`SCENARIO_MAX_COST_PER_JOB`, `CREATIVE_RECORD_SIGNING_KEY` — see `.env.example`.

**The model id, its image-input name and Scenario's status words have no defaults in the
code.** They are to be set from an authenticated read:

```
npm run scenario:discover -- model <modelId>                              # read-only
npm run scenario:discover -- estimate <modelId> <image> <param> [--array] # uploads one asset, cost preview, NO generation
npm run scenario:discover -- job <providerJobId>                          # read-only
```

No file shipped to the browser contains a Scenario credential; `api/creative.js` returns
none (asserted by test).

---

## 6. Unresolved dependencies — each blocks something specific

| # | Dependency | Blocks | Owner |
|---|---|---|---|
| U1 | **Scenario credentials** in `.env.local` (and Preview env) | everything real | Bekzod |
| U2 | **Model choice + its real schema.** Candidates named in Scenario's public docs — `model_meshy-7-img23d`, `model_meshy-img23d`, `model_meta-sam-3d-objects`, and Tripo/Hunyuan/Hitem3D families — none verified for this account, and no output format is documented for any of them | config; whether the asset is a viewer-loadable GLB | Claude, after U1 |
| U3 | **Scenario's job status words.** Public pages disagree (`succeeded`/`failed` in the guides; `success`/`in_progress` in the MCP docs); the OpenAPI file returned 403 here | `SCENARIO_STATUS_*` | Claude, after U1 |
| U4 | **Spend cap** for the one real generation | the real result | Bekzod (answered "none yet" on 2026-10-04) |
| U5 | **Durable job store.** `supabase/migrations/2026-10-04_creative_generation.sql` is written and **unapplied**. Without it a deployed environment answers `503 CREATIVE_STORE_NOT_CONFIGURED` (jobs in function memory would vanish between requests). Same blocker as design persistence: an approved non-production Supabase project | the feature on any Preview | Bekzod |
| U6 | **Durable asset storage.** There is no file-storage code or bucket in this project. Assets live only at Scenario; `storage.durableCopy` is always `false`. Needs a decision (Supabase Storage bucket is the natural fit) and then a copy-on-success step. Also the fallback if U7 fails | keeping a concept after Scenario drops it; possibly display | Bekzod → Claude |
| U7 | CORS on Scenario asset URLs; URL expiry; upload encoding (raw base64 vs `data:` URL); dry-run response field for cost | first real run | Claude, after U1 |
| U8 | Agreement of this contract | UI wiring | Antigravity, Grok, CraZy |

---

## 7. Evidence — simulated and real, kept apart

### Simulated (a local stand-in for Scenario; nothing left the machine; nothing billed)
`npm run test:creative` — **48 tests, all passing**, driving the real handler, service,
client and HTTP against `src/lib/creative/scenarioStandIn.js`. The stand-in's status words
(`sim-running`/`sim-done`/`sim-failed`) and response shapes are parameters of the test, **not
claims about Scenario**.

Covered: type/size validation by magic number; content de-duplication; auth on every
resource; cross-user answers identical to nonexistent; full upload → submit → poll → asset
journey; poll throttling; unknown status passed through; format from the asset; 10
simultaneous identical submissions → 1 paid call; 10 with different keys → 1 paid call;
key reuse; every spend gate → 0 paid calls; cap; unreadable cost; 402 / worded
insufficient-credits / 401 / 429 / 5xx / dropped connection / no job id; fresh asset
address per request, none stored; asset gone → 410; forged rows refused; deployed without
a store fails closed; no secret in any response.

Mutation checks (guard removed → tests fail): active-job guard → 1 fails; signature
check → 2 fail; cost cap → 1 fails.

The durable-store adapter is tested against a **fake PostgREST**, not a database.

### Real Scenario evidence
**None.** No authenticated request has been made. Everything in §6 marked unverified is
unverified.

### Repository gates on this branch
`npx vitest run` 1458 passed, 0 failed, 4 skipped, 20 todo (base 1410) · `npm run test:validator`
21 pass, 0 fail, 3 todo · `npm run lint` exit 0 · `npm run build:legacy` leaves the committed
bundles unchanged · `npm run docs:check` **fails on the base and on this branch alike**: three
`file:///c:/…` links in `docs/artifacts/studio-redesign-delivery/DELIVERY.md` (not touched here).
