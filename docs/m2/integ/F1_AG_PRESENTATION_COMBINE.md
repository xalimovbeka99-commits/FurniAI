# F1 + Antigravity presentation combine

**Branch:** `integ/f1-claude-handoff` (kept; CI already lists it)  
**Base tip:** `7541cbd` — Claude rule authority + BEK `changeToken` stale guard  
**AG tip:** `3ac95e0` (`antigravity/f1-presentation-finish`) — 390px mobile, drawer hide, WebGL stability  
**Also cited:** `8f0cfa1` — independent Integration Lead acceptance evidence lineage

## What landed

| Area | Source | Notes |
|---|---|---|
| Mobile CSS (`46vh` sheets, header wrap, FAB hide) | AG | Merged into handoff `index.html` |
| Drawer/door `updateActionButtons` + panel handle collapse | AG | Wired in Builder + `browserBridge` / runtime bridge |
| Hero `heroVisible` pause + `window.hRen` | AG | Required by WebGL stability suite |
| `tests/browser/webgl-context-stability.spec.js` | AG | New |
| F1 journey mobile asserts + measured occlusion | AG asserts + measured evidence | Grok’s 5 tests kept; test #5 negative assistant-bubble proof untouched |
| `editSequence` ↔ transport `changeToken` | Handoff transport + AG UI counter | **One guard** — see below |

## What was NOT taken

- `anthropicChatClient.js` default model (`claude-sonnet-5` retained; no `claude-sonnet-4-6` regression)
- Blind overwrite of `aiDesignerTransport.js` / pipeline / componentRequests (handoff PR5 lineage kept)

## editSequence ↔ changeToken reconciliation

AG UI already bumps monotonic `aiWardrobeState.editSequence` on draft / edit / Undo and discards on mismatch.  
Handoff transport already implements `isStaleAnswer` with `changeToken` + `currentDesignId`.

**Wire (no third guard):**

```js
changeToken: currentSeq,                         // editSequence at request
currentDesignId: () => aiWardrobeState.specId,
currentChangeToken: () => aiWardrobeState.editSequence,
```

Comment in `index.html` aliases the names. UI also handles `STALE_REVISION` without applying geometry.  
Proof: `src/lib/adapters/staleRevisionGuard.test.js` (edit→Undo→delayed, design switch @ equal revision, out-of-order token bump).

## Mobile occlusion (390×844)

Measured bounding boxes after sheet collapse (waited for CSS transition). Evidence:

- `docs/m2/integ/evidence/f1/05-narrow-occlusion.json`
- `docs/m2/integ/evidence/f1/05-narrow-RESULT.txt` → **PASS (measured)**  
  freeCanvas ≈ 654px (77.5%); sheets not occluding; `#parametricBadge` + `#toggle-doors` visible; `#toggle-drawers` hidden when 0 drawers.

## Tests

- Vitest: 1024 passed (4 skipped, 20 todo)
- Playwright F1: **5/5** passed (incl. assistant-bubble negative proof)
- WebGL stability: **4/4** passed
- Live provider: **UNVERIFIED** (no credentials in env)

## Out of scope (honoured)

No F2, no main merge, no production deploy, no rule-value changes, Candidate/Grok/main/production untouched beyond existing worktree link.
