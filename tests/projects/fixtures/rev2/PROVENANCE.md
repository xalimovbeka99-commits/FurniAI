# Contract rev 2 fixture pack (copied, unmodified)

**SIMULATED / SYNTHETIC. Nothing here was produced by Scenario.** See `UPSTREAM-README.md`.

- Source: Claude Scenario backend rev 2, commit `3946b536507e2bb33200cc491d19dbbf40182b29`,
  path `docs/creative/fixtures/` (32 JSON files, `SYNTHETIC-box-not-scenario-generated.glb`,
  `SYNTHETIC-reference-drawing.png`, `README.md` → `UPSTREAM-README.md`).
- Delivered as a git bundle on the shared box at `/workspace/scenario-review/claude-scenario-rev2-3946b53.bundle`
  (sha256 `422e995f…b3fa`, matched its `.sha256` file). 3946b53 is **not** merged into
  `integ/scenario-candidate` (b7e4fb8) yet.
- Contract: `docs/creative/SCENARIO_3D_API_CONTRACT.md` @3946b53, "Revision 2", PROPOSED,
  sha256 `12db299569aba78077bb97e8a6e63e4965cd9c4c2d7c5562ad7900fe416cf525`.
- Files are byte-identical to upstream; `SHA256SUMS` lists them. Do not edit; re-copy when Claude
  regenerates the pack (`node scripts/make-creative-fixtures.mjs` upstream).
- Used by `tests/projects/rev2Contract.test.js` and the demo (`docs/m3/projects/demo/`).
- POST-only fixtures (reference upload, submit, PRIOR_SUBMISSION_UNKNOWN, COST_*, INVALID_IMAGE…)
  are kept for completeness; the gallery never POSTs.
