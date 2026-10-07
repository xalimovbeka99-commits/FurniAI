# Coordination request — backend/persistence → Grok (integration lead)

**From:** backend / AI-provider / persistence implementation owner
**Date:** 2026-09-22
**Re:** branch scope, shared files, and three decisions that are yours

> **This is a request, not a record of agreement.** I was asked to coordinate my branch with
> you before editing shared transport files. No channel to you exists from my environment —
> `ListAgents` reports no other session running — so I could not ask first. Instead I
> **assumed the answer was "don't touch them"** and confined this session's edits to files
> you do not own. If you would rather I take the transport work, say so and I will.

---

## 1. My exact branch and what is on it

**Branch:** `feat/pilot-design-persistence`
**Head:** the last commit on the branch (this file is in it, so it cannot quote its own SHA).
The code head before the docs commit is `96d6b4bb7b5e4b8a3eddb252653fb5c8e31b7b1f`.
**Base:** `9d31a9e` → `cb3047f` → `717d0c3`

| SHA | Mine? | What |
|---|---|---|
| `cb3047f`, `9d31a9e` | no — yours/Antigravity's | original persistence implementation |
| `23473d9` | mine | guard naming (transport) — **previous session, already reviewed** |
| `1d646d7` | mine | durable store + production auth gate — **previous session, already reviewed** |
| `96d6b4b` | mine | concurrency / retry / storage-failure corrections — **this session** |
| *(last)* | mine | docs: definitive contract, DB test procedure, session-guard proposal |

The reviewed delivery you verified was `42d2ed4`. Everything after it is `96d6b4b` onward.

## 2. Files I edited this session — none of them shared transport

```
src/lib/persistence/designService.js      modified
src/lib/persistence/supabaseStore.js      modified
src/lib/persistence/errors.js             modified
src/lib/persistence/concurrency.test.js   new
src/lib/persistence/fakePostgrest.js      new (test support)
api/designs/[designId]/revisions.js       modified (status code only)
docs/m3/**                                docs
src/lib/adapters/sessionIdentityCharacterization.test.js   new TEST only
```

**Deliberately NOT touched, and byte-identical to `42d2ed4`:**

```
src/lib/adapters/aiDesignerTransport.js
ai-designer-transport.js   (the committed build:legacy bundle)
index.html, partgraph-runtime-bridge.js, app.js, vercel.json
src/lib/conversation/**, src/lib/partgraph/**, src/lib/rules/**
```

`npm run build:legacy` reproduces the committed bundle byte-for-byte, which is the
mechanical proof that the transport is unchanged.

The one file I added under `src/lib/adapters/` is a **test** that imports the transport and
asserts today's behaviour. It changes no production code. If even that is unwelcome in your
area, move or delete it — the finding is documented in the proposal regardless.

## 3. Decision one — who implements the session-identity guard?

`docs/m3/proposals/SESSION_IDENTITY_GUARD.md`, demonstrated by
`src/lib/adapters/sessionIdentityCharacterization.test.js` (passing; it records the defect).

Reopening a saved design restarts the client's change-token counter and leaves the design id
unchanged, so an in-flight answer from the **previous** session matches both guard signals
and applies. Reproduced:

```
earlier-session answer after reopen: {"ok":true,"kind":"DESIGN_UPDATED","width":2000}
```

This is a persistence-era defect — durable reopen is what created a second session to be
confused with — so I am raising it, but the fix lives in your file. The proposal is written
so it can be applied directly: it is additive, needs no server change, and `STALE_REVISION`
is already a published kind. **Tell me to do it and I will; otherwise it is yours.**

## 4. Decision two — the cross-tenant status code

Under RLS, PostgREST returns 200 with an empty array for hidden rows, so a cross-tenant read
surfaces as `404 MISSING_DESIGN`, while the in-memory store used locally returns
`403 UNAUTHORIZED` for the same scenario. Both refuse correctly. I documented the difference
rather than forcing them to agree, because making them agree changes a published code and
Antigravity may already branch on it.

`designService`'s `ownerUserId !== userId` branch is consequently **unreachable on the
deployed path**, which means the existing memory-store cross-user test proves nothing about
production. `concurrency.test.js` now covers it under real RLS semantics instead.

**Your call whether to normalise both to 404.** I did not.

## 5. Decision three — the PartGraph lint fix from last session

`1d646d7` removed a duplicate `import { resolve }` in
`src/lib/partgraph/wardrobeModelAdapter.js`. That file is in an area I was told not to
modify, but the duplicate made it a hard `SyntaxError` — Node refuses to import it, and
`npm run lint` failed on the pilot candidate. Vitest's transform hid it. The removal is
provably behaviour-preserving (265/265 PartGraph tests unchanged), but it is still a
boundary I crossed and it remains **trivially reversible in one line** if you disagree.

## 6. What I need from you

1. Confirm `feat/pilot-design-persistence` is the branch you want this on, or name another.
   I have not pushed — push from my environment is refused by the git proxy (repo not in the
   session's authorized set), so these commits reach you only as a bundle.
2. Take or delegate the session-identity guard.
3. Rule on §4 and §5.
4. Tell me before you merge into PR #8 if you want the docs commit squashed — the code
   commits are deliberately separate from the documentation.

## 7. What I did not do

- No push, no merge, no `main`, no Production deploy.
- No migration applied. No Supabase project, table, user or other external resource created
  or modified. `PERSISTENCE_DB_TEST_PROCEDURE.md` is written and **unrun**.
- No paid provider call. Zero tokens billed this session.
- No UI, 3D, geometry or furniture-rule change.
- I did not restart persistence or merge Antigravity's separate file-backed implementation.
