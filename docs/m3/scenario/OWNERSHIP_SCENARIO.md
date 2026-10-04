# Scenario 3D-Asset Direction - Ownership

- **Date:** 4 Oct 2026
- **Decision:** Pivot confirmed by Bekzod (founder, final authority): switch now to the Scenario 3D-asset direction. The wardrobe pilot work is parked on its branches as-is (see "Parked pilot work").
- **Integration branch:** `integ/scenario-candidate`, worktree `C:\Users\xalim\FurniAI-Grok-Scenario`, based on `a29f47b06ba2d4b7766b963be87938104bb795d7` (same base the Asset Engineer was told to use for `grok/asset-viewer`).
- **Status of contracts:** the generation and mount contracts are NOT agreed yet. Open questions live in `docs/m3/scenario/CONTRACT_QUESTIONS.md`.

## Ownership by role and path

| Role | Who | Branch / worktree | Owns | Does not touch |
|---|---|---|---|---|
| Customer UI owner | Real Antigravity | (their own) | The whole website redesign, shared page shell, UI, design tokens, upload UI, Studio mount points | - |
| Backend owner | Real Claude Code | (their own) | Scenario backend integration: job creation, status, storage, provider calls | - |
| CraZy / Integration | Grok | `integ/scenario-candidate`, `C:\Users\xalim\FurniAI-Grok-Scenario` | `docs/m3/scenario/**` and integration glue only (wiring / build config). Defects are returned to the owning role. | Antigravity UI paths, Claude backend paths, other streams' owned paths |
| Asset Engineer | Grok, bot `dbb46488` | `grok/asset-viewer` from `a29f47b`, `C:\Users\xalim\FurniAI-Grok-AssetEng` | `src/lib/assetViewer/**`, `tests/assetViewer/**`, `docs/m3/asset-viewer/**` | Everything else |
| Projects Engineer (formerly Designs Engineer) | Grok, bot `55b45df1` | proposed `grok/projects-assets` from `a29f47b`, `C:\Users\xalim\FurniAI-Grok-Projects` | `src/lib/projects/**`, `tests/projects/**`, `docs/m3/projects/**`; My Designs gallery extended with generated assets | Existing My Designs module stays at `src/lib/designs/myDesigns/**` (`grok/my-designs-module` `2ad22ac`, QE ACCEPT-WITH-NITS) |
| Quality Engineer | Grok, bot `f87059d5` | `grok/quality-acceptance` | `tests/acceptance/**`, `scripts/persistence/**` | Scenario acceptance starts only after the contract + fixtures exist; uses its own Playwright port (not 4173) |
| Website Engineer | bot `7e8a2c8f` | `grok/website-visual-system` (`dcf6b4e8`, preserved) | **HOLD** - no new work | - |

Grok (all Grok roles) does **not** edit Antigravity-owned UI (website redesign, page shell, design tokens, upload UI, Studio mount points) or Claude Code-owned backend (Scenario job creation, status, storage, provider calls).

### Asset Engineer scope (summary)

Isolated generated-model viewer:

- Framework-free API: `mountAssetViewer(el, { asset, onError }) -> { load, dispose }`.
- `three` is injectable (the viewer must not assume a global or a specific bundled copy).
- Relative scale only: no real-world dimensions are claimed unless the generation contract later provides verified units.

## Provider rule

- **Scenario is the only generation provider.**
- Meshy, Tripo, Zoo and Blender experiments are paused; their branches are preserved.
- **No paid provider calls without Bekzod's explicit authorization.** Tests run on fixtures only.

## Parked pilot work

SHAs were checked with `git rev-parse` on 4 Oct 2026 in the shared repo (`xalimovbeka99-commits/FurniAI`). `origin/*` values are the local remote-tracking refs as of the last fetch (nothing was fetched or pushed for this doc).

| Ref | Expected | Resolved (full SHA) | Notes |
|---|---|---|---|
| `main` | `60ba875` | `60ba87564c4cc3e70bd015ed59c3a5e7bba0626d` | matches `origin/main` |
| `feat/studio-interface-redesign` | `3ed620c` | `3ed620c34bb0005949a7c438c39651898fe2eb37` | no local branch; resolved via `origin/feat/studio-interface-redesign` (also `refs/review/antigravity-studio-tip`) |
| `feat/pilot-design-persistence` (PR #8) | `9d31a9e` | `9d31a9e057ae6f802fa98ae6a47fd9c3a8f1c762` | matches `origin/feat/pilot-design-persistence` |
| `grok/persist-db-harness` | `8566d34` | `8566d3464dc9f61491ec36492719b5d1e8d2c06a` | resolved via `origin/grok/persist-db-harness`. Local branch `grok/persist-db-harness` is stale at `3ed620c` (its creation point, never advanced locally); left unchanged |
| `integ/pilot-oct18-candidate` | new park tip | `ec2b10f3382ebbc80eaa7290f661e52e306cc065` | park commit on top of `a29f47b` (adds built root `my-designs.js` bundle) |
| `grok/export-drawing-package` | `6800342`, tree `e7f30066` | `6800342d27d6260aace1ecd17c4435ed4c929e71`, tree `e7f3006605dd464ab533566aaecaaa4c6dea06f6` | QE ACCEPT-WITH-NITS; N1-N4 open |
| `grok/my-designs-module` | `2ad22ac` | `2ad22ac926179bf0038376e22b4fbd46d21e20c8` | QE ACCEPT-WITH-NITS |
| `grok/website-visual-system` | `dcf6b4e8` | `dcf6b4e8bcb8c53f710fedcab526c960a1335dd0` | Website Engineer on HOLD |
| `grok/quality-acceptance` | `331b109` (WIP on `d4ef088`) | `331b10976f439324496484917ed0132dea0bee89` | parent `d4ef088926367543e55fec01fa5eb37bf1f21bcc`; tip is "WIP editable-builder acceptance specs (pre-Scenario; I1 failing, U3-U5/resilience unrun)" |
| `refs/review/ag-9d44e10` | - | `9d44e10d1550992073b0a918bfcca4d19bff8c45` | Antigravity delivery imported, **NOT accepted** |
| `refs/review/ag-e06377b` | - | `e06377bce0ce8784a8bfbbe629b66b65b7917e9b` | Antigravity delivery imported, **NOT accepted** |
| `refs/review/claude-55998dd` | - | `55998dd69c35327ff82d3ab2b4cecaac9d26fd5d` | review ref |

Nothing in this table was "not found".

## Ports

- Each stream uses its own port. Do not share or reuse another stream's dev/preview server.
- `playwright.config.js` reuses whatever is already serving `:4173`, so a test run can silently hit another stream's server. Use a stream-specific config with `reuseExistingServer: false` on a port verified free first (e.g. `Get-NetTCPConnection -LocalPort <port>` returns nothing).
- Quality Engineer uses its own Playwright port (not 4173).
