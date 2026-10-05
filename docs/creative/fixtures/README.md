# /api/creative fixture pack

**Everything in this folder is SIMULATED or SYNTHETIC. Nothing here was produced by Scenario.**

- The `*.json` files are the real `/api/creative` handler's responses, captured against a
  local stand-in for Scenario and sanitised (ids → `00000000-0000-4000-8000-…`, timestamps →
  one fixed instant, asset addresses → `https://fixtures.invalid/…`). The **shapes** are the
  application contract (docs/creative/SCENARIO_3D_API_CONTRACT.md). Provider-side **values** —
  `providerStatus` words such as `sim-running`, the model id, costs, `providerProgress` — are
  the stand-in's, not Scenario's. Do not build on them; branch on `status` and `code` only.
- Each file: `_fixture.request`, `_fixture.httpStatus`, and `response` (the body).
- `SYNTHETIC-box-not-scenario-generated.glb` is a hand-built grey box (24 vertices, 1.0 × 2.0 × 0.6). It exists
  so the viewer and the download button can be wired. It is **not** a Scenario output and says
  nothing about a real mesh's size, topology, materials or quality. `asset.200.json` points at
  a placeholder address; serve this file from your mock at whatever address you choose.
- `SYNTHETIC-reference-drawing.png` is a 64×48 drawing made locally for tests — not a photo, not
  customer data.

Regenerate: `node scripts/make-creative-fixtures.mjs`. `src/lib/creative/fixtures.test.js`
fails when the committed pack no longer matches the handler.
