# Proposal — a session signal for the stale guard

**Status: SUPERSEDED — IMPLEMENTED 2026-09-22.** Assigned to Claude by the coordination
decision and now in `src/lib/adapters/aiDesignerTransport.js`, covered by
`src/lib/adapters/sessionIdentityGuard.test.js`. The client-side calling contract is
`../SESSION_ID_CALLING_CONTRACT.md`. This file is kept for the reasoning and the rejected
alternatives; **the contract doc is authoritative**. The feature is not complete until the
browser caller passes the arguments.
**Raised by:** backend/persistence owner, 2026-09-22.
**Demonstrated by:** `src/lib/adapters/sessionIdentityCharacterization.test.js` (passing —
it records today's behaviour).

## The defect

The stale guard has two live signals: the design id and a monotonic change token. Both are
scoped to one browsing session.

Reopening a saved design starts a new session whose change-token counter begins again from
zero, and reopening the *same* design leaves the design id identical. An in-flight answer
belonging to the previous session therefore matches on both signals once the new session's
counter climbs back through the same value — and it applies.

```
session 1:  request sent at changeToken 7 for design D
            ... customer saves, reopens D ...
session 2:  counter restarts at 0, edits bring it back to 7
            session 1's answer lands: designId D === D, token 7 === 7  ->  APPLIED
```

Reproduced directly:

```
earlier-session answer after reopen: {"ok":true,"kind":"DESIGN_UPDATED","width":2000}
```

The deterministic kernel still validates the result, so this yields a valid wardrobe. It is
simply not the one the customer asked for, and nothing reports that anything went wrong.

**Durable save/reopen is what makes this reachable.** Before it, a session ended when the
page did and there was no second session to confuse. This is a persistence-era defect.

## Why the existing signals cannot be stretched to cover it

- **Design id** is stable across a reopen *by design* — that is the point of reopening.
- **Change token** is explicitly documented as monotonic *within a session*. Making it
  globally monotonic would mean persisting a counter across sessions and devices, which is
  a distributed-counter problem for a value that only ever needs to answer "same session?".
- **Revision** already rewinds on Undo; that is why the change token exists.

The missing signal is not a bigger number. It is **identity of the session**.

## Proposed change

Add a fourth signal, additive and optional, alongside the existing three.

### Transport (`aiDesignerTransport.js`)

```js
// New request-time argument, and new live getter:
//   sessionId          — the session this request was issued from
//   currentSessionId   — () => the session that is live when the answer lands
```

In `isStaleAnswer`, checked **first**, because it is the cheapest and most decisive:

```js
const hasSessionGuard = typeof currentSessionId === "function";
if (hasSessionGuard) {
  const nowSession = readGetter(currentSessionId);
  // Unreadable or absent fails closed, consistent with the other signals.
  if (sessionIdAtRequest == null || nowSession == null || nowSession === "") return true;
  if (String(nowSession) !== String(sessionIdAtRequest)) return true;
}
```

And in `invalidLiveStateGuardResult`, the same pairing rule the other guards already have:
supplying `currentSessionId` without `sessionId` is a misconfiguration and must be named,
not silently refused for every answer.

### Client (Antigravity)

Mint one opaque id per session — `crypto.randomUUID()` is enough — and:

- set it when the builder loads, **and again on every reopen**;
- pass it as `sessionId` on each `proposeDesignChange` call;
- pass `currentSessionId: () => store.sessionId` as the live getter.

No server round trip is needed. The id never leaves the browser and identifies nothing
about the customer.

### Server

**No change.** The reopen endpoint already returns everything needed to restore identity
(`specId`, `revision`, `fingerprint`, `furniSpec`, `partGraph`). Minting the session id
server-side was considered and rejected: it would add a field that only the browser can
meaningfully produce or verify, and would tie session lifetime to a request/response cycle
it has nothing to do with.

## Tests to add when this is applied

Replace the characterization file with these requirements:

1. A pre-reopen answer is refused after reopen, same design, same token value →
   `ok:false`, `STALE_REVISION`, no `spec`.
2. An answer from the current session with a matching id still applies — the guard is not a
   blanket refusal.
3. `currentSessionId` supplied without `sessionId` → named misconfiguration
   (`guardMisconfigured: true`, `guardParameter: "sessionId"`), matching the existing
   half-configured-guard behaviour.
4. A `currentSessionId` getter that throws → fails closed and is named, matching
   `readLiveStateGuards`.
5. Callers passing no session arguments behave exactly as today — this must be additive for
   any UI that has not adopted it yet.

## Compatibility

Additive. `STALE_REVISION` is an already-published kind the UI handles. A caller that
passes neither `sessionId` nor `currentSessionId` is unaffected, so this can ship before
Antigravity adopts it and start working the moment they do.

## What this does NOT fix

A customer with the same design open in **two tabs of the same session model** still gets
two distinct session ids, which is correct. But two *devices* editing one saved design
concurrently is a different problem — that is server-side concurrency, and it is handled by
`expectedPreviousRevision` and `unique (design_id, revision)`, not by this guard. See
`docs/m3/DESIGN_PERSISTENCE_API.md`.
