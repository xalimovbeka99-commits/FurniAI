# Antigravity handoff — stale-response guard (changeToken + design id)

**Owner of UI:** Antigravity (do not rewrite `index.html` / renderer here).  
**Owner of transport:** F1 backend (`integ/f1-claude-handoff`).  
**Kind name:** `RESULT_KIND.STALE_REVISION` (kept for additive compatibility; covers changeToken **and** design-id mismatch, not only revision).

## Why revision is not enough

| Event | Typical `revision` | Required `changeToken` |
|---|---|---|
| Committed edit | +1 | +1 |
| Undo | often **restores** prior revision | **+1** (never rewinds) |
| Switch design | may match the other design’s revision | reset or continue per-design; **always bind design id** |

A delayed model answer after **edit → Undo** can see `revisionAtRequest === currentRevision` again. A revision-only inequality check would wrongly apply it. `changeToken` is monotonic for that reason.

## Contract — fields to pass into `proposeDesignChange`

| Field | Who sets it | Meaning |
|---|---|---|
| `specId` | UI | Design id **at request** (already required). |
| `changeToken` | UI | Monotonic integer **at request**. |
| `currentDesignId` | UI getter `() => string` | Live active design id when the answer lands. |
| `currentChangeToken` | UI getter `() => number` | Live token when the answer lands. |
| `revision` / `currentRevision` | optional legacy | Prefer changeToken; revision alone is insufficient for Undo. |

Pass **getters**, not snapshots, for `currentDesignId` / `currentChangeToken`.

## When to bump `changeToken`

Bump **once** on every:

1. Committed successful edit (deterministic or model-applied).
2. **Undo** (and Redo if it mutates the active design the same way).

Do **not** rewind the token when Undo restores an older revision. Do **not** bump on failed/rejected/stale answers.

Store the token **per design id** (or bump a global generation — either works if the design id is also checked).

## Sample call site (Design-with-AI panel)

```js
// Pseudocode — Antigravity owns the real panel state.
const panel = {
  activeSpecId: "...",
  // Per-design monotonic counters; never rewind on Undo.
  changeTokens: new Map(), // specId -> number
  revisions: new Map(),
};

function getChangeToken(specId) {
  return panel.changeTokens.get(specId) ?? 0;
}
function bumpChangeToken(specId) {
  const next = getChangeToken(specId) + 1;
  panel.changeTokens.set(specId, next);
  return next;
}

async function onAskAi(message) {
  const specId = panel.activeSpecId;
  const changeToken = getChangeToken(specId);
  const revision = panel.revisions.get(specId) ?? 1;

  const result = await AiDesignerTransport.proposeDesignChange({
    message,
    currentObservations: /* active observations */,
    specId,
    revision,
    changeToken,
    currentDesignId: () => panel.activeSpecId,
    currentChangeToken: () => getChangeToken(panel.activeSpecId),
  });

  if (result.kind === "STALE_REVISION") {
    // Design unchanged — show result.error; do not apply geometry.
    return;
  }

  if (result.ok && result.kind === "DESIGN_UPDATED") {
    // Apply result.spec / observations, then:
    bumpChangeToken(specId);
    panel.revisions.set(specId, result.spec.revision);
  }
}

function onUndo() {
  // Restore prior snapshot for activeSpecId (revision may go backwards).
  // ALWAYS bump changeToken so in-flight answers cannot re-apply.
  bumpChangeToken(panel.activeSpecId);
}
```

## Anthropic client compatibility (do not regress)

- PR #5 / this branch defaults to **`claude-sonnet-5`** (`DEFAULT_ANTHROPIC_MODEL`).
- Antigravity tip `origin/antigravity/finish-visible-designer` still defaults to **`claude-sonnet-4-6`** (not a published Anthropic model id).
- **Do not** merge AG’s client default over this branch. When AG wires the panel, keep `claude-sonnet-5` (or `ANTHROPIC_MODEL` env). See `src/lib/ai-provider/anthropicChatClient.js` on this tip.

## Result handling

- `STALE_REVISION` → `ok: false`, no `spec` / `partGraph` / `materialKey`.
- Customer copy is plain language (“not applied” / “unchanged”); operator fields include `designIdAtRequest`, `currentDesignId`, `changeTokenAtRequest`, `currentChangeToken`.
- Unknown kinds already fall into AG’s generic-error path — additive and safe.

## Out of scope for Antigravity in this handoff

- Rule-value number changes, F2, merge to main, deploy.
- Rewriting the backend transport (already published here).
