# FurniAI G5 — Connecting the existing designer to a live model

> **WORKSHOP-REVIEW ONLY — NOT CNC-QUALIFIED.** A model-proposed edit produces a
> draft preview. It cannot approve a FurniSpec, and drilling stays blocked.

**Branch:** `claude/live-model-designer`
**Base:** `6506f1484633240b229a6847aa97e085f93a40ea` (tip of `antigravity/unified-design-with-ai`)
**Status:** `PROPOSED — mocked-provider tests only; no live call has been made`

---

## 1. Deployment trace — which chat endpoint is genuinely served

```
vercel.json           framework: null · buildCommand: npm run build:legacy · outputDirectory: dist
        │
        ├── npm run build:legacy → scripts/build-static.mjs
        │       esbuild  src/lib/adapters/browserBridge.js      → partgraph-runtime-bridge.js
        │       esbuild  src/lib/adapters/aiDesignerTransport.js → ai-designer-transport.js   [NEW]
        │       copies   index.html, styles.css, app.js, legacy-builder-adapter.js,
        │                partgraph-runtime-bridge.js, ai-designer-transport.js,
        │                vendor-three-r128.min.js, vendor-supabase.min.js  → dist/
        │
        └── api/**  →  Vercel Serverless Functions, deployed INDEPENDENTLY of outputDirectory
```

**Verified against production**, not assumed:

| Probe | Result | Means |
|---|---|---|
| `GET https://furniai-topaz.vercel.app/api/chat` | **405** | deployed, POST-only |
| `GET .../api/wardrobe/chat` | **405** | deployed, POST-only |
| `GET .../api/design/propose` | **404** | control — not deployed until this branch ships |

So the root `api/` directory **is** served even though `vercel.json` names only
`api/production.py` under `functions` (that block sets per-function options; it is not an
allow-list).

**The nuance worth stating precisely.** `src/app/api/wardrobe/chat/route.js` is **not
deployed as a route** — `framework: null` means `next build` never runs and no Next.js
routing exists in production. But it is **not dead code either**: the deployed function
`api/wardrobe/chat.js` imports its `POST` and calls it as a library. That file's own header
says as much. So the genuinely served chat entry points are:

- `api/chat.js` → `/api/chat` — the legacy catalog assistant (used by `index.html:2958`)
- `api/wardrobe/chat.js` → `/api/wardrobe/chat` — delegates to the Next route module (`index.html:3003`)
- `api/design/propose.js` → `/api/design/propose` — **new in this branch**

The unified "Design with AI" panel added by `cd6b20f` currently calls **neither**. It is
entirely client-side: `PartGraphBridge.previewDraftWardrobe`, `.applyConversationalEdit`,
`.parseAndValidateClarifyInput`, `.approveAndPreview`. That is what this branch connects.

---

## 2. What was added, and what was deliberately not

| File | Role |
|---|---|
| `src/lib/ai-designer/designEditSchema.js` | The tool schema and strict validation of model output. |
| `src/lib/ai-designer/systemPrompt.js` | States the model's boundary; the code enforces it. |
| `src/lib/ai-designer/proposeDesignEdit.js` | One model turn. Imports no SDK, reads no env var. |
| `src/lib/ai-designer/proposalFromModel.js` | Model edits → a proposal-only adapter. |
| `api/design/propose.js` | Deployed transport. Reuses `createChatProviderRouter`. |
| `src/lib/adapters/aiDesignerTransport.js` | The narrow browser transport (§5). |
| `scripts/build-static.mjs` | +1 esbuild target, +1 copied file. |

**No second AI system.** The endpoint uses the existing `createChatProviderRouter`, the
existing `AI_PROVIDER_ORDER` failover policy, the existing normalized chat clients and the
existing `AllProvidersUnavailableError` / `redactErrorForLogging` handling. **No pipeline
file was modified at all** — `applyConversationalEdit` already accepts a proposal adapter
and already falls back to `adapter.interpret()`, so the live model plugs into the seam that
was already there.

`index.html`, `partGraphToThree.js` and `browserBridge.js` are **untouched**, to avoid
colliding with Antigravity. The transport ships as its own bundle and its own global.

### Schema compatibility with canonical FurniSpec

The model may write **only** these keys, which are exactly `REQUIRED_INTAKE_KEYS` plus the
visual swatch:

```
envelope.widthMm  envelope.heightMm  envelope.depthMm  plinth.heightMm
bayCount  doorCount  finishType  bayLayouts  materialKey
```

Every proposed value is re-parsed by `parseAndValidateClarifyInput` — the same validator a
typed human answer goes through — so a model that returns `"about 2 metres"`, `-2000mm` or
`2000.00001mm` is rejected exactly as a customer would be. A second guard rejects any key
matching `partgraph|panel|placement|coordinate|drill|machining|qualification|approval|
fingerprint|status|cnc|gcode|operation|hardware|groove|thickness|revision|specid`, so the
model cannot express geometry even if the allow-list is later widened carelessly.

---

## 3. Resolution order — deterministic first, model second, kernel always

```
customer types a message
   │
   ├─1─ parseConversationalCommand()      in-browser, no network, no cost
   │      "Make it 2000 mm wide" · "width 2000" · "2.1m wide" resolve here
   │      a deterministic rejection (negative / imprecise) stops here too
   │
   ├─2─ POST /api/design/propose          only for phrasings step 1 does not know
   │      returns PROPOSED EDITS ONLY — no geometry, no approval
   │      re-validated client-side with the identical rules
   │
   └─3─ applyConversationalEdit()         the deterministic kernel decides
          invalid → ok:false, the active design is untouched
          valid   → new draft spec + PartGraph, same specId, revision + 1
```

The active design is never mutated in place. A rejected edit returns `ok:false` and the
caller keeps exactly the design it had.

---

## 4. Provider credentials

Server-side only. The key is read by `createChatProviderRouter` from `process.env` inside
the serverless function; it is never sent to the browser, never logged (`redactErrorForLogging`),
and never echoed in a response. `shouldExposeProviderDebugInfo()` gates even the provider
*name* to development or founder preview.

| Environment | Checked how | Result |
|---|---|---|
| Local `.env.local` | presence and length only, value never read or printed | `ANTHROPIC_API_KEY` **present** · `OPENAI_API_KEY` **absent** → single provider, no failover locally |
| Vercel project | **NOT VERIFIED** — needs an authenticated CLI or the dashboard | run `vercel env ls` in the project, or Settings → Environment Variables |

Required in Vercel for this endpoint to work in production: `ANTHROPIC_API_KEY` and/or
`OPENAI_API_KEY`, optionally `AI_PROVIDER_ORDER` (default `anthropic,openai`). With neither
set, `/api/design/propose` answers **503 `AI_PROVIDER_UNAVAILABLE`** with a user-facing
message that says the design is unchanged — which is the correct behaviour, not a crash.

---

## 5. Narrow browser transport interface — the UI handoff for Antigravity

Global `AiDesignerTransport`, from `ai-designer-transport.js`. **One call.**

```js
const result = await AiDesignerTransport.proposeDesignChange({
  message,                 // the customer's words
  currentObservations,     // aiWardrobeState.observations — the active design
  specId,                  // aiWardrobeState.specId  (keeps design identity)
  revision,                // aiWardrobeState.revision (result is revision + 1)
});
```

Returns one of, and never throws for an expected failure:

| `kind` | `ok` | What the panel should do |
|---|---|---|
| `DESIGN_UPDATED` | `true` | `loadDraftPartGraph(Builder, result.partGraph)`; store `result.spec`, `result.observations`, `result.partGraph`; show `result.assistantReply` |
| `MATERIAL_UPDATED` | `true` | `updateParametricMaterial(Builder, result.materialKey)` only — geometry is unchanged, do not reload it |
| `NEEDS_MORE_DETAIL` | `false` | show `result.assistantReply` as a question; leave the design alone |
| `UNSUPPORTED` | `false` | show `result.unsupported[i].reason` and `.alternative`; leave the design alone |
| `REJECTED` | `false` | show `result.error`; leave the design alone |
| `DESIGNER_UNAVAILABLE` | `false` | show `result.error` (already user-facing); leave the design alone |

`result.source` is `DETERMINISTIC` or `MODEL` — useful for a subtle "✦ AI" marker, not for
logic. `result.rejected` lists anything the model proposed that validation threw away.

**Three lines of wiring, all additive:**

1. `<script src="ai-designer-transport.js"></script>` after `partgraph-runtime-bridge.js`.
2. In the Design-with-AI send handler, when the existing deterministic path returns
   "could not interpret", `await AiDesignerTransport.proposeDesignChange({...})` and switch
   on `result.kind` per the table.
3. Nothing else. Approval still goes through `PartGraphBridge.approveAndPreview` unchanged.

**Report success only after the change is applied** — that is, only on `ok === true` with a
`partGraph` present (or `MATERIAL_UPDATED`). Never on a 200 from the endpoint alone.

---

## 6. Safety

A model-proposed edit produces a **draft preview**, never an approval. Everything from
G4 R1 still holds: `approveAndPreview` needs a structured human approval matching the exact
proposal fingerprint, spec status stays `PROPOSED` until then, `qualificationStatus` stays
`WORKSHOP_REVIEW_NOT_CNC_QUALIFIED`, `machiningPolicy.drilling` stays
`BLOCKED_PENDING_HARDWARE_APPROVAL`, and the drilling operation count stays zero. The model
has no path to any of those fields.

---

## 7. Known gaps

- **No minimum-plausibility rule.** A 300 mm wardrobe with 72.5 mm doors closes
  arithmetically and passes the validator today. A characterisation test in
  `aiDesignerTransport.test.js` records this rather than hiding it. **This needs a Bekzod
  ruling** — a hanging bay needs real internal width, and a 72.5 mm door is not a door. No
  rule was invented here.
- **No live model call has been made.** Every test mocks the provider at the HTTP boundary.
  See §8.
- Bay ordering, layout vocabulary and the melamine-only material record are unchanged from
  G4 and still apply.

---

## 8. The precise remaining blocker

The integration is complete and tested against a mocked provider. Two things are needed
before a real sentence reaches a real model:

1. **Billing authorization.** A key is present in `.env.local`, but spending against it was
   never authorised in this session, so no live call was made. One word from Bekzod and the
   local end-to-end run takes a minute.
2. **Deployment credentials, unverified.** Whether `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`
   exist in the Vercel project could not be checked from here. `vercel env ls` answers it.

Until both are settled, `/api/design/propose` is correct-by-test and returns a clean 503 in
production rather than failing badly.
