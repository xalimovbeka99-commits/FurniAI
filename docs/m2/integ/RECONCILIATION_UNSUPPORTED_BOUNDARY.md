# Reconciliation — unsupported-request boundary

**Branch tip lineage:** Claude `claude/f1-reconciled` @ `e163a3d` combined onto Grok `integ/f1-m2omit-candidate` (browser/mobile/evidence retained).
**Bases:** Grok candidate through `88b03db` / later Grok browser commits; Claude original boundary `8a865cf`; Claude **reconciled** tip `e163a3d`.
**Owners:** Claude — boundary implementation. Grok — integration and browser verification.

Both agents independently implemented the same boundary. This records what was
kept, what was replaced, and why, so the decision is auditable rather than a
merge artefact.

## Retained: Claude's implementation (reconciled tip `e163a3d`)

| Capability | Claude original `8a865cf` | Claude reconciled `e163a3d` | Grok PR #4 (pre-reconcile) |
|---|---|---|---|
| Drawer requests refused | yes | yes | yes |
| Handles / mirror / lighting / lock / racks / soft-close | yes | yes | no |
| Negation handled (`I do not want drawers…`) | incomplete / not the deciding fix | **yes — deciding fix lives here** | **no — clause-spanning false positive** |
| Reference framing (`the drawers you showed me`) | partial | **yes** | partially |
| `light oak` never read as lighting | incomplete / not the deciding fix | **yes — deciding fix lives here** | not reached (no lighting coverage) |
| Kernel refusal for unrepresentable components | yes | yes | no |
| Approval path protected (`approveAndPreview`) | yes | yes | no |
| Clause-level scoping | yes | yes (hardened) | proximity window only |

**Attribution note:** Negation and `light oak` false-positive fixes that decide this reconcile are in Claude's **reconciled** tip `e163a3d`, not claimed as complete on the original `8a865cf` alone. Do not attribute those deciding fixes solely to `8a865cf`.

The deciding evidence, run against both regexes on the reconciled tip:

```
Grok PR #4 detection, "I do not want drawers; make it 2000 mm wide"  → true  (false refusal)
Claude reconciled detection, same sentence                          → null  (defers; width edit applies)
```

PR #4's `[\s\S]{0,60}` window spans clause boundaries, so "want … drawers"
matches across the semicolon. The customer's width edit was discarded and
replaced with a refusal for something they had explicitly declined.

PR #4 also does not carry the kernel-side guard: without it a spec containing
an unbuildable component can still be previewed as a finished design, including
through `approveAndPreview`, which is the strictest boundary in the system.

## Retained from Grok (integration / browser)

- **`tests/browser/f1-journey.spec.js`** — customer navigation, pointer-click doors, unsupported **assistant** bubble asserts (+ negative proof), Undo identity + panel finish. Review fixes applied on this tip.
- **`index.html`** assistant/user `data-role` markers needed for bubble targeting (Grok).
- **`src/lib/adapters/unsupportedCustomerEntry.test.js`** — restored from Claude reconciled tip; run against Claude's implementation.
- **`kind` on `applyConversationalEdit` refusals** — `UNSUPPORTED` vs `REJECTED`.
- **`test:browser:f1` npm script** and `docs/m2/integ/evidence/f1/**` (refreshed on this tip).
- Mobile UI work / readiness claims stay Antigravity-owned; not overwritten by this boundary import.

No third competing parser was written. Grok's inline drawer detector remains replaced by Claude's `componentRequests.js`.

## Defect found in PR #4 lineage and fixed in `e163a3d`

`pipeline.js`, `aiDesignerTransport.js` and `buildStructuralPartGraph.js` on
PR #4 carry UTF-8 mojibake from a Windows re-encode. Repaired on Claude's
reconciled tip; those repaired files are what this candidate retains.

## Preserved and re-verified on combine

Customer-facing unsupported explanations; kernel refusal including the approval
path; design and revision preservation; negation and `light oak` fixes from
`e163a3d`; rail previews; Grok browser journey; main/production untouched.
