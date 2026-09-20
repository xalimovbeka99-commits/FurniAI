# Pilot candidate — contract reconcile + customer journey

## Combined tip

Built on `0d8f312` by:

1. Merge Claude `claude/contract-reconcile` @ `223094e4ff99158bf641c21edabd96b35555c498`
2. Cherry-pick Antigravity `3987db67a9e138a3d615bfa8650e36d66199b5db`
3. Integration defect closes (this commit)

## Conflict decisions

- **No overlapping files** between Claude `223094e` and AG `3987db6`.
- Transport / SPA owned by AG tip for live-state getters; Claude characterization tests flipped to assert the closed defects.
- Claude adapter / doors-per-bay / frontend contract docs kept from `223094e`.
- MATERIAL_UPDATED transport contract preserved (materialKey only). Canonical finish commit is UI/engineering-path via `commitMaterialUpdate`.

## Defects closed before nomination

1. **Stale-guard argument type** — `invalidLiveStateGuardResult` fail-closes with non-committing `STALE_REVISION` when any live-state arg is a plain value.
2. **Provider attribution** — never guesses `anthropic`; missing metadata → `ai`. Customer badge stays `[AI]` unless `__FURNIAI_DEBUG_PROVIDER__`.
3. **Material state** — `commitMaterialUpdate` rebuilds FurniSpec finish, observations, PartGraph finish intent, and `createProposal` fingerprint before UI treats MATERIAL_UPDATED as committed. Manufacturing SKUs remain catalog-backed (melamine) until walnut has an approved material record; customer finish is tracked on spec + PartGraph summary.
4. **Contract integration** — commit only on `ok && (DESIGN_UPDATED|MATERIAL_UPDATED)`; UNSUPPORTED/REJECTED distinct; STALE_REVISION never re-renders.

## Evidence (this SHA)

| Class | Result |
|---|---|
| Deterministic parser / unit | 1219 passed, 4 skipped, 20 todo |
| Mocked browser provider | AG journey specs present; rerun on this tip required |
| Simulated HTTP provider | frontendContract + aiDesignerTransport (fetch stubs) green |
| Live Anthropic | **not run** — remaining credential step below |

## Remaining live-credential step

Set the Anthropic API key in the Vercel / local runtime used by `/api/design/propose` (or the bounded `verify-live-designer` path), confirm the endpoint returns real model payloads (not mock), then rerun the customer journey once and label that evidence **live**.

## Publication

Branch: `integ/pilot-combined-contract`
No main merge. No production deployment.
