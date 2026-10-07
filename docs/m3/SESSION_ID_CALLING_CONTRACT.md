# Session ID — calling contract for the client

**Audience:** Antigravity (client lifecycle wiring).
**Status of the backend half:** IMPLEMENTED in `src/lib/adapters/aiDesignerTransport.js`,
covered by `src/lib/adapters/sessionIdentityGuard.test.js` (14 tests), bundled into the
committed `ai-designer-transport.js`.
**Status of the feature:** **NOT COMPLETE.** The guard is inert until the browser caller
passes these arguments. Nothing in the product uses them yet.

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

## 2. The two arguments

Both go to `proposeDesignChange`. They are a **pair**: supplying one without the other is a
named misconfiguration, not a silent refusal.

| Argument | Type | Meaning |
|---|---|---|
| `sessionId` | `string` | The session this request is being issued **from**. Captured at call time. |
| `currentSessionId` | `() => string` | A **getter** read when the answer lands, returning the session that is live **then**. |

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

  // NEW — the pair
  sessionId: store.sessionId,              // captured now, by value
  currentSessionId: () => store.sessionId, // read later, by reference
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
| `currentSessionId()` ≠ `sessionId` | `ok:false`, `kind: STALE_REVISION`, **no `spec`, no `partGraph`** |
| `currentSessionId()` throws | `ok:false`, `STALE_REVISION`, `guardThrew: true`, `guardParameter: "currentSessionId"`. The thrown error's message is deliberately **not** propagated — only its constructor name. |
| `currentSessionId()` returns `null` / `undefined` / `""` | `ok:false`, `STALE_REVISION` — unreadable fails closed rather than guessing |
| `currentSessionId` passed as a plain value | `ok:false`, `STALE_REVISION`, `guardParameter: "currentSessionId"`, `guardParameterType` naming the type you passed |
| `currentSessionId` supplied, `sessionId` missing | `ok:false`, `guardMisconfigured: true`, `guardParameter: "sessionId"` — the error names the missing half |
| Neither supplied | Behaves exactly as today. **Additive.** |
| Session matches | Proceeds to the design-id and change-token checks as before |

The session comparison runs **first**, before design id and change token, because it is the
only one that can catch a reopen.

A refusal carries the evidence it was decided on: `sessionIdAtRequest` and
`currentSessionId`. Each live getter is read **exactly once**, so the reported evidence and
the decision come from the same read.

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

## 6. Until that journey passes

The transport refuses these answers; the product does not yet produce the arguments. Please
do not describe session protection as done — and I will not either — until the same-page
journey above passes against the real builder. The backend half is testable today via
`npx vitest run src/lib/adapters/sessionIdentityGuard.test.js`.
