# Design-with-AI frontend contract — for Antigravity

**Branch:** `claude/live-brain-integration` (off `60ba875`)
**Transport:** `src/lib/adapters/aiDesignerTransport.js` → `POST /api/design/propose`
**Status:** proposed by backend, awaiting Antigravity's confirmation. Nothing here is new API surface — it documents what the transport already publishes.

---

## 1. The seven results, and what the UI must do with each

`proposeDesignChange()` always resolves. It does not reject, and it never returns a partially-applied design. Branch on `result.kind`:

| `kind` | Design changed? | What the customer is told | UI action |
|---|---|---|---|
| `DESIGN_UPDATED` | **yes** | `result.reply` | Re-render from `result.spec` / `result.partGraph`. Record the new revision |
| `MATERIAL_UPDATED` | **yes** | `result.reply` | Re-render; finish-only change |
| `NEEDS_MORE_DETAIL` | no | `result.reply` — a question | Show the question. Keep the current draft on screen |
| `UNSUPPORTED` | no | `result.unsupported[].reason` | Show what could not be done. Offer `alternative` if present; **never auto-apply it** |
| `REJECTED` | no | `result.reply` | The request was understood and refused by engineering validation. Design untouched |
| `DESIGNER_UNAVAILABLE` | no | `result.error` — one sentence | Offer retry. **Do not** surface `code` to the customer |
| `STALE_REVISION` | no | `result.error` | Discard silently or show a quiet note. **Never re-render** |

**The invariant behind all of them:** every non-`*_UPDATED` result leaves `spec` and `partGraph` null. If the UI only re-renders when they are non-null, it cannot apply a stale or failed answer by accident.

## 2. Do not say "Anthropic"

`provider` is returned **only** when `shouldExposeProviderDebugInfo()` is true — a server-side debug flag, off in normal operation. The router's order is `anthropic,openai` with real failover, so a response that came back may well be OpenAI's.

**Use a neutral label** — "AI", "the designer", "FurniAI" — in all customer-facing copy. Naming a vendor is a claim the response body does not support.

When the debug flag is on, `provider` and `fallback` are present and are for operators, not customers.

## 3. Stale responses — the case revision numbers get wrong

`STALE_REVISION` covers three situations, not just an out-of-date revision number:

- the customer edited again while the answer was in flight
- the customer pressed **Undo** — revision goes 1 → 2 → 1, so revision equality says "fresh" and is wrong
- the customer switched to a different design that happens to be at the same revision

Detection uses three signals: `specId`, a monotonic `changeToken` that **never rewinds**, and a per-request `seq`. Revision is deliberately excluded.

Wiring, in `index.html`'s existing `aiWardrobeState` flow:

1. One session per builder session: `const session = AiDesignerTransport.createDesignSession({ specId })`
2. Call `session.noteChange()` **everywhere the design changes** — after `DESIGN_UPDATED`, after `MATERIAL_UPDATED`, and **after Undo**. Undo is the case that matters; missing it there loses the whole benefit. Call `session.switchDesign(newSpecId)` when another design is opened
3. Pass `session` to `proposeDesignChange` and branch on `STALE_REVISION`

A caller that passes no `session` keeps today's behaviour exactly, so this can be adopted one panel at a time. The existing revision guard can stay during the transition.

## 4. Timeouts and provider failure

A timeout surfaces as `DESIGNER_UNAVAILABLE`, not as a thrown error. `result.code` names a failure *class* (`AI_PROVIDER_NOT_CONFIGURED`, timeout, quota, auth) and is safe to log, but it is for operators — the customer gets one sentence.

`operatorNote` is never returned to the browser under any flag: it names environment variables and remediation steps.

**Failure must preserve the design.** On every failure path `spec` and `partGraph` are null and the current design stands.

## 5. Provisional drafts and labelled assumptions

The deterministic parser answers immediately for phrasing it recognises (`source: "DETERMINISTIC"`); anything else goes to the model (`source: "MODEL"`). The immediate draft is not a loading state — it is a real, validated design.

Where an optional detail was defaulted rather than stated, the spec carries a labelled assumption. **Render assumptions as assumptions** — visibly provisional, not as confirmed customer choices. An assumption shown as a decision is how a customer ends up ordering something they never chose.

## 6. What the UI must never infer

- **Not** that a successful AI response means the design is manufacturable. Engineering validation and workshop qualification are separate gates. CNC remains NOT QUALIFIED and hardware drilling BLOCKED
- **Not** that `ok: true` from the endpoint means the design changed — check `kind`
- **Not** the provider, per §2
- **Not** that a rendered preview and an exported drawing are the same revision unless both were produced from the same accepted `specId` + `revision`. Stamp exports with both

## 7. Open for Antigravity

1. Does the panel already distinguish `REJECTED` from `UNSUPPORTED`? They read differently to a customer: "I understood and won't" versus "I can't do that yet".
2. Where should `STALE_REVISION` surface — silent discard, or a quiet note?
3. Confirm the neutral AI label you want in copy, so backend error text matches it.
