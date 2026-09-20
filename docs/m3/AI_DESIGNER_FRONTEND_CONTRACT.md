# Design-with-AI frontend contract — v2, implementation-backed

**Branch:** `claude/contract-reconcile`, off the combined pilot candidate `0d8f312`
**Transport:** `src/lib/adapters/aiDesignerTransport.js` → `POST /api/design/propose`
**Backed by:** `src/lib/adapters/frontendContract.test.js` — 17 tests through the real entry point

---

## 0. What v1 got wrong

v1 was written against a transport that does not exist on this branch. Corrected here:

| v1 said | Actually |
|---|---|
| Call `createDesignSession()` / `noteChange()` / `switchDesign()` | **No such functions.** `designSessionGuard.js` is not on `0d8f312`; `createDesignSession` appears nowhere in `src/` or `index.html` |
| `result.reply` | `result.assistantReply` on some kinds, `result.error` on others — §2 |
| `MATERIAL_UPDATED` → re-render from spec/PartGraph | Returns `materialKey` and **no** spec or PartGraph |
| Non-updating results have `spec: null` explicitly | The field is **absent**, not null. Do not test for `=== null` |
| "always resolves, never throws" | Not established. The tests assert the failure paths actually exercised; nothing proves the general claim |

Every statement below is asserted in `frontendContract.test.js`. If the transport changes, that file fails before this document becomes wrong again.

## 1. The commit gate

**Commit a change only when `result.ok === true` AND `result.kind` is `DESIGN_UPDATED` or `MATERIAL_UPDATED`.**

Neither half alone is sufficient. `ok` is a boolean on every result and `kind` is always one of the seven values; the pair is the gate. Asserted by *"no non-committing kind ever arrives with ok:true"*.

## 2. The seven kinds, as the transport actually returns them

| `kind` | `ok` | Customer text field | Also carries | UI action |
|---|---|---|---|---|
| `DESIGN_UPDATED` | `true` | — | `spec`, `partGraph`, `observations` | Re-render from `spec` |
| `MATERIAL_UPDATED` | `true` | `assistantReply` | `materialKey` | **Reskin in place.** No new geometry arrives |
| `NEEDS_MORE_DETAIL` | `false` | `assistantReply` | `error` as fallback text | Show the question; keep the current draft |
| `UNSUPPORTED` | `false` | `unsupported[].reason` | `assistantReply`, `rejected[]` | Say what could not be done. Never auto-apply an alternative |
| `REJECTED` | `false` | `error` | `rejected[]` on the model path | Understood and refused. Design untouched |
| `DESIGNER_UNAVAILABLE` | `false` | `error` | `code` (`NETWORK_ERROR`, `ABORTED`, `HTTP_500`, …) | Offer retry. **Do not show `code`** to the customer |
| `STALE_REVISION` | `false` | `error` | `designIdAtRequest`, `currentDesignId`, `changeTokenAtRequest`, `currentChangeToken`, `revisionAtRequest`, `currentRevision` | Discard. **Never re-render** |

Every result also carries `source` (`DETERMINISTIC` | `MODEL`), `provider` and `isMock`.

**`MATERIAL_UPDATED` is the one to get right.** It is a finish change, not a rebuild: `{ ok, source, provider, isMock, kind, materialKey, assistantReply }`. A panel that waits for `spec` here waits forever.

## 3. Stale answers — and a hazard that fails silently

There is no session object. The caller passes both sides directly to `proposeDesignChange`:

- at request time: `specId`, `revision`, `changeToken`
- live state: `currentDesignId`, `currentChangeToken`, `currentRevision`

### The live-state parameters MUST be getter functions

`isStaleAnswer()` enables each signal only when the parameter is a **function**:

```js
const hasTokenGuard = typeof currentChangeToken === "function";
if (!hasDesignGuard && !hasTokenGuard && !hasRevisionGuard) return false;
```

Pass plain values and **all three guards are off, silently** — a stale answer is applied with no error and no warning. Asserted in *"DOCUMENTS A HAZARD: plain values silently disable the guard"*, where a request for a design the customer has left is applied anyway.

```js
// RIGHT
currentDesignId:    () => state.specId,
currentChangeToken: () => state.changeToken,
currentRevision:    () => state.revision,

// WRONG — compiles, runs, protects nothing
currentDesignId: state.specId,
```

The getter requirement is sound in itself: it is read *after* the await, so it reflects live state, which a value captured at call time cannot. The hazard is only that the wrong type fails open.

**Proposed correction, for agreement before anyone edits shared code:** `isStaleAnswer` should throw on a non-function, or accept values and compare them. `aiDesignerTransport.js` is shared, so this is not changed unilaterally.

### What must bump the change token

`changeToken` must increase on **every** design change — after `DESIGN_UPDATED`, after `MATERIAL_UPDATED`, and **after Undo**. Undo is the case revision equality gets wrong: revision goes 1 → 2 → 1 and compares equal while two changes have happened. Bump it on switching designs too.

## 4. Do not display `provider` to a customer

`provider` is present on every result, and it is **not reliable as a vendor claim**:

- deterministic path → `"rules"` (no model involved at all)
- model path → `payload.provider || (payload.mock ? "mock" : "anthropic")`

That last fallback is a **guess**. `/api/design/propose` includes `provider` only behind `shouldExposeProviderDebugInfo()`, off in normal operation — so in normal operation an OpenAI failover response is labelled `"anthropic"` in the browser. Asserted in *"DOCUMENTS A DEFECT: with no provider stated, the client guesses 'anthropic'"*.

**Use a neutral label** — "AI", "the designer", "FurniAI". Treat `provider` as an operator hint only.

**Proposed correction, again for agreement:** default to `"ai"` or `"unknown"` rather than `"anthropic"`, and have the endpoint always echo a provider when one ran.

## 5. Failure preserves the design

On every failure path the result carries no `spec` — asserted across `REJECTED`, `DESIGNER_UNAVAILABLE` and `STALE_REVISION` by *"carries no spec on any non-committing result"*. The field is **absent**, so test truthiness (`result.spec ?? null`), not `=== null`.

A thrown `fetch` becomes `DESIGNER_UNAVAILABLE` with `code: "NETWORK_ERROR"`; an HTTP 500 becomes `DESIGNER_UNAVAILABLE` with a `code`. Both asserted. No credential or environment-variable name appears in any result body — also asserted.

This is not a general "never throws" guarantee. It is the set of failure paths that are tested.

## 6. Provisional drafts and labelled assumptions

The deterministic parser answers synchronously for phrasing it recognises (`source: "DETERMINISTIC"`, `provider: "rules"`); anything else goes to the model. The immediate draft is a real validated design, not a loading state.

Where an optional detail was defaulted rather than stated, render it **visibly as an assumption**. An assumption shown as a decision is how a customer orders something they never chose.

## 7. What the UI must never infer

- Not that a successful AI response means the design is manufacturable. CNC remains NOT QUALIFIED, hardware drilling BLOCKED
- Not that HTTP `ok` means the design changed — check §1
- Not the provider, per §4
- Not that a rendered preview and an exported drawing are the same revision unless both came from the same `specId` + `revision`. Stamp exports with both

## 8. Open for Antigravity

1. Agree the two proposed transport corrections in §3 and §4, then one of us makes both in a single reviewed commit.
2. Does the panel distinguish `REJECTED` from `UNSUPPORTED`? They read differently: "I understood and won't" versus "I can't do that yet".
3. Where should `STALE_REVISION` surface — silent discard, or a quiet note?
4. Confirm the neutral AI label you want, so backend error text matches it.
