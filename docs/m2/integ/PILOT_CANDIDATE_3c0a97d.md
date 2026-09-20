# Combined candidate after AG 3987db6 + Claude 2bb9cc8

**Engineering combined SHA:** `3c0a97d1d53bcb310628f144b9ef965e86df0e5d`  
**Branch:** `integ/pilot-combined-candidate`  
**Baseline comparison:** `60ba875`  
**Prior candidate:** `0d8f312`

## Included

| Source | Full SHA | How integrated |
|---|---|---|
| Antigravity | `3987db67a9e138a3d615bfa8650e36d66199b5db` | cherry-pick → `ace3bf1` (parent `eff99fd`) |
| Claude | `2bb9cc8fd5a49fa4b5e629bd3b7690eeed94faab` | merge → tip `3c0a97d` (`live-brain-integration.bundle`) |

Spot-check: `getActivePartGraph()` returns `aiWardrobeState.partGraph` when set; ExportMenu uses `config.specId` (no Date.now at call site).

## Verifier / Demo

Finish-state matrix A–E on `3987db6` and `3c0a97d`. PDF: print-preview vs download defect classification.
