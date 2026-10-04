# Scenario Contract Questions

> **PROPOSED - NOT AGREED; answers must come from the real owners via Bekzod.**
>
> Nothing below is a decision. Grok roles must not implement against any of these shapes until the owning role (Claude Code for section A, Antigravity for section B) answers and Bekzod confirms.

- Date: 4 Oct 2026
- Context: Scenario 3D-asset direction (see `docs/m3/scenario/OWNERSHIP_SCENARIO.md`). Scenario is the only generation provider; no paid calls without Bekzod's explicit authorization; tests run on fixtures.

## A. Generation contract - questions for Claude Code (backend owner)

### A1. Job creation

1. What is the endpoint (method + path) for creating a generation job?
2. Input - reference image upload:
   - Accepted MIME types (image/jpeg, image/png, image/webp, HEIC?)
   - Maximum file size and maximum pixel dimensions?
   - Is the image uploaded directly to the endpoint (multipart) or first to storage (signed upload URL), then referenced?
   - Where is the reference image stored, and for how long?
3. Is prompt text accepted (optional/required, max length)? Any other parameters (style, quality tier, model choice)?
4. Response: does creation return a `jobId` immediately (async), and with which HTTP status?
5. Idempotency: is there an idempotency key so a double-click / retry does not create (and bill) two Scenario jobs?

### A2. Status

1. Status polling endpoint vs webhook (or both)? If polling, recommended interval and rate limit?
2. Status enum - is it `queued | running | succeeded | failed | cancelled`? Anything else (e.g. `expired`)? Is there progress (percent/stage)?
3. Failure codes: list of codes, human message, and which are retryable (by client vs by backend)?
4. Timeouts: maximum job duration before the backend marks it failed? Client-side timeout we should use?
5. Can a job be cancelled by the user?

### A3. Output

1. Which formats does Scenario return: GLB / glTF 2.0 with embedded textures? OBJ+MTL? USDZ? FBX?
2. Which of those is downloadable by the customer, and which one should the viewer load?
3. Asset URL directly from the provider vs proxied blob through our backend?
4. URL expiry: are URLs signed / time-limited? What is `expiresAt`, and how does the client refresh an expired URL?
5. Storage location: Supabase bucket? Our own storage? Is the provider asset copied to our storage on success?
6. Ownership / auth: how is an asset scoped per user; who can read it; is the URL usable without the user's session?
7. Thumbnail: does Scenario (or the backend) produce a thumbnail? Size/format?
8. Texture maps: embedded vs separate files; which maps (base color, normal, roughness/metallic)?
9. Provider metadata exposed to the client: Scenario model id, provider job id, credits/cost per job?
10. Units / scale: does Scenario output have real units? (Current assumption: none - relative scale only, `verified: false`.)

### A4. Linking to projects

1. How does a generation result link to a saved project: design id? revision? a separate `assets` table?
2. Can one project have multiple generated assets (re-generations)? Which is "current"?

### A5. Fixtures

Please commit a **sanitized** fixture set (no secrets, no live signed URLs, no account ids):
- a fixture result JSON (one `succeeded`, one `failed`, one `running`), and
- a small GLB (ideally < 1 MB) matching what Scenario actually returns.

Grok tests (viewer, projects, acceptance) will run only against these fixtures.

### A6. Draft shape (FOR DISCUSSION ONLY - not agreed)

```ts
// DRAFT for discussion - not agreed; Claude Code to confirm/replace.
type GenerationStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

interface GenerationResult {
  jobId: string;
  status: GenerationStatus;
  asset: {
    url: string;
    mime: string;            // e.g. 'model/gltf-binary'
    format: string;          // e.g. 'glb'
    bytes?: number;
    expiresAt?: string;      // ISO 8601, if signed URL
  };
  thumbnailUrl?: string;
  provider: {
    name: 'scenario';
    modelId?: string;
    jobId?: string;
    costCredits?: number;
  };
  scale: {
    units: null | 'm' | 'mm';
    verified: boolean;       // false unless the backend can vouch for real units
  };
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}
```

## B. Viewer / gallery mount contract - questions for Antigravity (customer UI owner)

1. Which page/route hosts the upload + viewer? Today the deployed customer page is the static `index.html` with legacy three r128 globals; R3F with three 0.166 exists only in the `src/` Next app. Which one is the target for the Scenario flow?
2. Mount element ids: which element(s) should `mountAssetViewer(el, { asset, onError })` receive (id/selector, sizing rules)?
3. Should the viewer reuse the page's three (r128 global) or bundle its own copy (the viewer accepts an injected `three`)?
4. Design tokens: which CSS variables should the viewer use for loading, empty and error states?
5. Gallery cards for generated assets in My Designs / Projects: confirm card props - `thumbnail`, `title`, `status`, `createdAt`, `open`, `download`. Anything else (re-generate, delete)?
6. Mobile (390px width): viewer size, touch rotate/zoom expectations, where controls go.
7. Upload UI is owned by Antigravity: what event/callback does it emit to start a job (name, payload: file / storage ref / prompt), and what does it expect back (jobId, status updates)?

## First demonstration - acceptance (proposed)

Flow: customer uploads a wardrobe reference image -> a genuine interactive 3D asset is generated by Scenario -> customer rotates it -> saves the project -> downloads the model.

Evidence required:
- Commit SHA(s) of what was demonstrated
- Working page(s) / URL(s)
- Screenshots and/or video of each step
- Provider evidence (Scenario job id)
- Cost of the run (credits)
- Blockers / known issues

No live run until Bekzod explicitly authorizes paid calls.
