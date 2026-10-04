# Session ID — calling contract for the client

**Audience:** Antigravity (client lifecycle wiring).
**Status of the backend half:** IMPLEMENTED in `src/lib/adapters/aiDesignerTransport.js`
(`06cbdcf`; start-of-request capture and pre-flight refusal added in `5cda494`), covered by
`sessionIdentityGuard.test.js` and `sessionReopenJourney.test.js`, bundled into the committed
`ai-designer-transport.js`.
**Status of the client half:** wired by Antigravity in `de5ebec` (`rotateStudioSession`,
`reopenAiWardrobeDesign`, both request paths pass the pair).
**Status of the journey:** `tests/browser/design-state-protection.spec.js` test 5 **passes in
real Chromium** on `de5ebec` merged with `5cda494` (run 2026-09-24). A mutation check —
the same test with the session arguments removed — **fails** (the delayed answer applies,
tokens 1 = 1), so the test genuinely depends on the session guard.
**Still not covered:** reopen *from the durable store*. `reopenAiWardrobeDesign()` restores a
client-side snapshot; the UI does not call `/api/designs` yet.

---

## 1. What the guard is for

`designId` and `changeToken` are both scoped to one browsing session. Reopening a saved
design restarts your token counter and leaves the design id identical — that is what
reopening *means*. So an answer still in flight from the **previous** session matches both
signals once the new session's counter climbs back through the same value, and it applies to
the revision the customer has just restored.

The kernel still validates the result, so this yields a *valid* wardrobe. It is simply not
the one the customer asked for, and nothing reports that anything went wrong. Durable
save/reopen is what made this reachable.

The session id is the only signal that does not survive a reopen — which is exactly why it
can detect one.

---

## 2. The arguments

| Argument | Type | Meaning |
|---|---|---|
| `currentSessionId` | `() => string` | A **getter** for the live session. The transport reads it **when the request starts** (that is the session the request belongs to) and **again when the answer lands**. |
| `sessionId` | `string`, optional | The session the caller believes it is issuing from. If supplied it must equal `currentSessionId()` at start; otherwise the request is refused before the provider is called. |

**Changed 2026-09-24 (`5cda494`):** `sessionId` is no longer required alongside the getter.
Before, a getter without `sessionId` was a named misconfiguration — refused on every request,
so a getter-only caller could never apply anything. Now the transport captures the session
itself at request start, which also means a caller that captured its copy too late (after an
`await`) or from the wrong store cannot silently defeat the guard. The de5ebec wiring passes
both, and behaves exactly as before.

`currentSessionId` must be a getter for the same reason the other live-state readers are: a
value captured before `await` is a copy of the session you are trying to detect leaving.

```js
const result = await AiDesignerTransport.proposeDesignChange({
  message,
  currentObservations,
  specId,
  revision,
  changeToken,

  // existing live-state guards
  currentDesignId: () => store.activeDesignId,
  currentChangeToken: () => store.changeToken,

  // session: the getter is enough; sessionId is an optional cross-check
  sessionId: store.sessionId,              // optional; must match the live session now
  currentSessionId: () => store.sessionId, // read at start AND when the answer lands
});
```

---

## 3. Lifecycle — when to mint a new session id

Mint an opaque id with `crypto.randomUUID()`. It never leaves the browser, is not sent to
the server, and identifies nothing about the customer.

Rotate it — assign a **new** id — at each of these points:

| Event | Rotate? | Why |
|---|---|---|
| Builder initialisation / page load | **yes** | A fresh session begins. |
| **Reopening a saved design** | **yes** | This is the case the guard exists for. |
| Replacing the active design with another | **yes** | A different design's answers must not cross over. |
| Reset / "start again" | **yes** | Pending answers from the discarded design must not land. |
| An ordinary accepted edit | no | Same session — that is what `changeToken` is for. |
| Undo | no | Same session; `changeToken` bumps and does not rewind. |

Keep `changeToken` **monotonic within the active session**: bump it on every committed edit
*and* every Undo, and restart it freely when you rotate the session id. Its only job is
ordering inside one session; cross-session ordering is now the session id's job.

```js
function beginSession() {
  store.sessionId = crypto.randomUUID();
  store.changeToken = 0;          // restarting is fine now
}
// call on init, on reopen, on design switch, on reset
```

---

## 4. What the transport does with them

| Situation | Result |
|---|---|
| At start: `sessionId` supplied and ≠ `currentSessionId()` | `STALE_REVISION`, `guardPhase: "request-start"`, `sessionNotLiveAtRequest: true`. **Provider not called.** |
| At start: `currentSessionId()` throws | `STALE_REVISION`, `guardPhase: "request-start"`, `guardThrew: true`, `guardErrorName` only. **Provider not called.** |
| At start: `currentSessionId()` returns `null` / `undefined` / `""` | `STALE_REVISION`, `guardPhase: "request-start"`. **Provider not called.** |
| `currentSessionId` passed as a plain value | `STALE_REVISION`, `guardParameter: "currentSessionId"`, `guardParameterType`. **Provider not called.** |
| Any other half-configured guard (e.g. `currentChangeToken` without `changeToken`) | `guardMisconfigured: true`, names the missing half. **Provider not called** (it used to be called, and its answer discarded). |
| On landing: live session ≠ session at request | `STALE_REVISION`, **no `spec`, no `partGraph`**; `sessionIdAtRequest`, `currentSessionId` |
| On landing: getter throws / unreadable | `STALE_REVISION`, `guardThrew` / fail closed |
| No session arguments at all | Behaves exactly as before. **Additive.** |
| Session matches on landing | Proceeds to the design-id and change-token checks as before |

The session comparison runs **first**, before design id and change token, because it is the
only one that can catch a reopen.

A refusal carries the evidence it was decided on: `sessionIdAtRequest` and
`currentSessionId`. On a healthy request the session getter is read exactly **twice** — once
at start, once on landing — and each other live getter exactly once on landing; the reported
evidence and the decision come from the same landing read.

`STALE_REVISION` is an already-published kind your UI handles — no new branch is required,
though you may want to word the message differently when `sessionIdAtRequest` is present.

---

## 5. The journey that proves it

A page reload is **not** this reproduction: the old page's pending JavaScript is gone, so
nothing could have applied anyway. It must be a **same-page** journey:

1. Start an AI request that will take a while (throttle, or stub a slow response).
2. **Without reloading**, reopen the same saved design — rotating the session id.
3. Edit until the new session's `changeToken` reaches the same value the pending request
   captured.
4. Let the delayed answer arrive.
5. **Assert it is rejected**, the design is unchanged, and the customer is told.

Then the control, in the same journey: a request issued *after* the reopen, in the current
session, still applies normally.

---

## 6. Status of that journey

It passes: `design-state-protection.spec.js` test 5, real Chromium, 2026-09-24, on `de5ebec`
merged with the backend branch (clean merge; `build:legacy` reproduces the committed bundle
byte-identically in the merged tree). With the session arguments removed the same test
fails, so it proves the guard rather than passing on the change token.

What it does not prove: reopen from the durable store, because the UI does not yet call
`/api/designs`. When it does, the reopen path must call `rotateStudioSession()` before it
replaces the design, exactly as `reopenAiWardrobeDesign()` does today.
