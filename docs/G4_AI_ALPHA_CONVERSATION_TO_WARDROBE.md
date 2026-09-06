# FurniAI G4 (AI-Alpha R1) — Conversation to Parametric Wardrobe

> **WORKSHOP-REVIEW SPECIFICATION — NOT CNC-QUALIFIED**
>
> Nothing in this pipeline emits machine coordinates. Hardware drilling remains
> `BLOCKED_PENDING_HARDWARE_APPROVAL` and CNC qualification remains `NO`, before
> and after human approval.

**Status:** `PROPOSED — AWAITING CODEX REVIEW AND BEKZOD SIGN-OFF`
**Gate:** G4 — AI-Alpha conversation slice, revision R1 (trusted approval boundary)
**R1 base SHA:** `7c557064f15c681e9c74454ce437cd577a1bd2bb`
**Branch:** `claude/ai-alpha`
**Visible accomplishment:** `npm run demo:ai-wardrobe`

---

## 1. The two stages

No PartGraph can exist until a person approves the exact canonical FurniSpec they
were shown.

```
STAGE 1 — proposeWardrobe()
  customer description  (untrusted text)
          │
          ▼
  proposal adapter            deterministic today; PROPOSALS ONLY
          │                   cannot approve, cannot build geometry
          ▼
  analyseGaps()               pure completeness + closure analysis
          │
          ├── out-of-slice ──────────────► UNSUPPORTED_REQUEST
          ├── blocking gap ──────────────► NEEDS_CLARIFICATION  (questions)
          ▼
  assembleFurniSpec()         status = PROPOSED
          │
          ├── invalid ───────────────────► VALIDATION_FAILED
          ▼
  createProposal()            canonical fingerprint over the exact document
          │
          ▼                              partGraph === null
        READY_FOR_REVIEW                 partGraphValidation === null
                                         safety.geometryGenerated === false

══════════════ HUMAN APPROVAL — the only door ══════════════

STAGE 2 — approveAndPreview()
  structured approval record
          │
          ▼
  validateApproval()          id + revision + RECOMPUTED fingerprint must match
          │
          ├── any mismatch ──────────────► stays READY_FOR_REVIEW, partGraph null
          ▼
  status = APPROVED, re-validated
          │
          ├── invalid ───────────────────► VALIDATION_FAILED, partGraph null
          ▼
  buildStructuralPartGraph()  ► APPROVED_FOR_PREVIEW
                                CNC still NO, drilling still BLOCKED
```

## 2. Pipeline states

| State | Meaning | `partGraph` |
|---|---|---|
| `NEEDS_CLARIFICATION` | A required fact is missing, hedged, or self-contradictory. | `null` |
| `UNSUPPORTED_REQUEST` | Outside the first manufacturing slice (sliding doors, corner, curved, kitchen, walk-in, a finish with no approved material). **Never returned as a clarification** — there is no question that makes it buildable. | `null` |
| `VALIDATION_FAILED` | A spec was assembled but the G2.1 validator rejected it. | `null` |
| `READY_FOR_REVIEW` | A valid `PROPOSED` FurniSpec and its fingerprint are waiting for a person. | `null` |
| `APPROVED_FOR_PREVIEW` | A person approved this exact proposal. Geometry exists. | 19 parts |

## 3. Approval contract

```jsonc
{
  "approvedBy":          "Bekzod Khalimov",              // non-empty string
  "proposalId":          "furnispec-…",                  // === proposal.specId
  "proposalRevision":    1,                              // === proposal.revision (integer)
  "proposalFingerprint": "fs256:fa2e4a3f…"               // === recomputed fingerprint
}
```

Rejected, always, with a typed error code and zero geometry:

| Input | Code |
|---|---|
| `null` / `undefined` | `MISSING_APPROVAL` |
| `{}` | `MISSING_APPROVED_BY` (+ the three other missing-field codes) |
| a string, boolean, number or array | `INVALID_APPROVAL_TYPE` |
| blank or non-string `approvedBy` | `BLANK_APPROVED_BY` |
| wrong spec ID | `PROPOSAL_ID_MISMATCH` |
| wrong or non-integer revision | `PROPOSAL_REVISION_MISMATCH` |
| malformed fingerprint | `MALFORMED_PROPOSAL_FINGERPRINT` |
| wrong fingerprint, or an approval issued against an earlier proposal | `PROPOSAL_FINGERPRINT_MISMATCH` |
| the proposal changed after it was signed off | `PROPOSAL_TAMPERED_SINCE_ISSUE` |

## 4. Fingerprint algorithm

```
fingerprint = "fs256:" + SHA-256( UTF-8( serializeCanonicalJson(spec) ) )
```

1. `serializeCanonicalJson` (`src/lib/furnispec/normalize.js`) recursively sorts every
   object key alphabetically and normalises every number to exact 0.1mm precision,
   then emits `JSON.stringify(x, null, 2)`. Key order and number formatting are
   therefore not implementation-dependent.
2. UTF-8 encoded with `TextEncoder`.
3. SHA-256 (FIPS 180-4), lower-case hex, prefixed `fs256:`.

**Runtime.** SHA-256 is implemented in plain JavaScript in
`src/lib/conversation/fingerprint.js` with no imports beyond `TextEncoder`. The
fingerprint is computed on both sides of the approval boundary and must be identical
wherever the pipeline runs — the Node demo, the Vitest suite, a serverless API route,
and later a browser view that shows a customer what they are approving. Importing
`node:crypto` would break the browser case and make the boundary runtime-dependent.
`fingerprint.test.js` proves the implementation equals `node:crypto` over the FIPS
vectors, every message length from 0 to 199 bytes, and 100 random multi-byte inputs.

**The fingerprint covers the proposal as proposed**, i.e. with `status: "PROPOSED"`.
Approval promotes the status to `APPROVED`, which is why verification always
re-fingerprints `proposal.spec` and never the promoted copy.

## 5. What was added in R1

| File | Responsibility |
|---|---|
| `src/lib/conversation/fingerprint.js` | Pure-JS SHA-256 and the `fs256:` format. |
| `src/lib/conversation/approval.js` | `fingerprintFurniSpec`, `createProposal`, `validateApproval`, typed error codes. |
| `src/lib/conversation/proposalAdapter.js` | The proposal-only adapter contract and the deterministic adapter. `assertProposalOnly` refuses any adapter exposing an approve or geometry method. |
| `src/lib/conversation/pipeline.js` | Rewritten into `proposeWardrobe` / `approveAndPreview`, five states, and two safety read-outs. |
| `src/lib/conversation/approvalBoundary.test.js` | The 12 mandatory negative tests plus a positive control. |

## 6. AI-Alpha is not connected to a live model

- AI-Alpha currently uses a **deterministic phrase parser**
  (`deterministic-phrase-interpreter/0.1`). It reads the vocabulary in
  `interpretDescription.js` and nothing else.
- **It is not connected to Claude, Gemini, OpenAI, or any other live LLM.**
  `createDeterministicPhraseAdapter().liveModel === null`.
- The parser is an **interchangeable proposal adapter**, not a permanent design.
- When an LLM arrives it will **propose observations only**.
- **An LLM must never approve a FurniSpec and must never generate PartGraph
  geometry.** This is enforced in code, not only in prose: `assertProposalOnly()`
  throws if an adapter exposes `approve`, `approveProposal`, `assembleFurniSpec`,
  `buildPartGraph`, `buildStructuralPartGraph` or `generateGeometry`, and the
  pipeline calls it on every adapter before using it.

## 7. Integration with the existing AI modules — no second architecture

AI-Alpha deliberately introduces **no new AI stack**. When the LLM adapter is built
it reuses what this repository already has:

| Existing module | What it already does | AI-Alpha's decision |
|---|---|---|
| `src/lib/ai-provider/` | Provider abstraction: `createChatProviderRouter`, `callWithFailover`, `resolveProviderOrder`, Anthropic and OpenAI chat clients, `createExtractionAiProvider`, `createFakeProvider`, typed `ProviderError`s and redacted logging. | **Reuse as-is.** This is the transport, failover and model-config layer for the future LLM adapter. AI-Alpha will not add a second provider abstraction, a second failover policy, or a second place that reads `AI_PROVIDER_ORDER`. |
| `src/lib/wardrobe-agent/` | `runWardrobeAgent` — the multi-turn tool-calling loop, provider-agnostic, already tested against a deterministic fake. | **Reuse as the conversation loop.** The LLM adapter is a caller of this loop, not a new loop. AI-Alpha will not write a second agent runtime. |
| `src/lib/wardrobe-tools/` | The eight deterministic tools that are the only surface an LLM may mutate a `WardrobeModel` through, with strict schemas re-checked at execution time. | **Extend by one proposal-only tool**, `propose_furnispec_observations`, returning the `{observations, ambiguities, unmatchedIntent}` shape. It proposes; it does not approve and it does not build geometry. The existing eight tools stay as they are. |
| `src/lib/furniture-brain/` | `interpretFurnitureRequest` — turns a provider's NL extraction into an **FSL v1** candidate and decides assumption vs missing information. | **Do not extend, do not duplicate, do not delete.** It targets FSL v1, a different schema family from FurniSpec v0.1; its "knowledge-base default + assumption" behaviour is also the opposite of AI-Alpha's no-silent-defaults rule. AI-Alpha keeps its own gap analysis over FurniSpec. **Flagged for Bekzod and Codex as a schema-consolidation decision** (see the four coexisting schemas noted in the G4 review), not settled unilaterally here. |

Sequence once the LLM adapter exists:

```
customer text
  -> runWardrobeAgent (wardrobe-agent)      loop
       using createChatProviderRouter       (ai-provider)
       calling propose_furnispec_observations (wardrobe-tools)
  -> Observation[]                          ← the model's authority ends here
  -> analyseGaps / questions / human answers
  -> assembleFurniSpec  -> PROPOSED         ← deterministic from here down
  -> human approval + fingerprint match
  -> buildStructuralPartGraph
```

## 8. Known limitations

- Only two interior layouts: full-height hanging, and short hanging over two
  adjustable shelves.
- Only the melamine material record is approved; other finishes are
  `UNSUPPORTED_REQUEST`.
- Voice, photograph, sketch, PDF and catalog evidence are **not** implemented.
  Written text only.
- `bayLayouts` infers bay order from the order layouts are mentioned. A description
  naming bays out of order is misread; the layout-count check catches a mismatch,
  not a reordering.
- The approval record is validated, not authenticated. It proves *which proposal*
  was approved, not *who* approved it — there is no signature or identity check.
  Binding an approval to a real identity is a persistence-and-auth concern (S15),
  outside this gate.

## 9. Related documents

- [Wardrobe Rulebook v0.1](WARDROBE_RULEBOOK_V0.1.md)
- [G2.2 PartGraph Contract](G2_2_PARTGRAPH_CONTRACT.md)
- [G2.1 FurniSpec compatibility note](G2_1_FURNISPEC_COMPATIBILITY_NOTE.md)
- [Tool contracts](TOOL_CONTRACTS.md)
- [Known limitations](KNOWN_LIMITATIONS.md)
