# Evaluation Harness — Wardrobe Fixtures + Node Runner Plan (Phase 0)

Purpose: freeze current behavior in tests BEFORE any new rule lands. Every future `constructionValidator.js` diff must ship with its fixture.

## What is testable without touching product code (Phase 0 — Week 1)

`api/constructionValidator.js` is CommonJS and exports `evaluateConstruction`, `PANEL_THK_CM`, `SHELF_SPAN_INFO_CM` — directly `require()`-able from a Node script. **Phase 0 tests target only this module. Zero product-code changes.**

- Runner: `node --test tests/` (built-in `node:test`, no dependency).
- Layout: `tests/validator.test.js` + `tests/fixtures/*.json`.
- `package.json` gets one added script line `"test": "node --test tests/"` — script addition only, no runtime code. If even that must wait, run `node --test tests/` manually.

## What needs one approved micro-change each (Phase 1 — after Bekzod's OK)

| Target | Blocker | Minimal change |
|---|---|---|
| `sanitizeConfig` / `sanitizeCustomDesign` in `api/chat.js` | internal functions, not exported | add to `module.exports` (zero behavior change). Fixture 11 (41-part clamp) lives here — the limit is `chat.js:304` `.slice(0,MAX_CUSTOM_PARTS)`; `constructionValidator.js` has NO independent part-count check (verified 2026-07-23) |
| `src/lib/*` (buildGeometry, production, pricing, configSchema) | ESM syntax under a CJS-root `package.json`; plain Node can't import them | **do NOT set root `"type": "module"` — it risks breaking the live CommonJS Vercel functions in `api/`.** Use a separate test configuration instead: a tests-local runner that handles ESM (e.g. `tests/next/` with its own transform/build step, or a dedicated runner config). Decide at Phase 1 |
| `generateCutList()` / `Builder` in `index.html` | inline in HTML, not a module | do NOT extract during research phase; a real past-order diff would cover it indirectly but is factory-dependent and deferred (Phases 6–7) |

## Fixture classes — a bug must never become a passing expectation

Every fixture is tagged with exactly one class:

- **`regression`** — behavior is correct and must never change (e.g. narrow-bay fix, no-false-positive floating shelf). Failure = red build.
- **`characterization`** — captures current behavior we haven't judged yet. Failure = investigate, may be legitimate change.
- **`knownGap`** — the correct rule does NOT exist yet (drawer overload, sliding-door support, door weight limits). Implemented as `test.todo()` / skipped-with-reason: it documents the missing rule and its expected future findings, but a current "no findings" result is recorded as the gap itself, never asserted as correct. When the rule lands, the fixture flips to `regression` in the same commit.

**Capability status (required on every fixture, per `docs/MASTER-PLAN.md` §14):** each fixture declares `capability`: `production_ready | preview | conceptual | unsupported` — what maturity the modeled scenario is allowed to claim. A fixture must additionally assert that the system does not label the result more mature than this. The sliding/mirror wardrobe is `conceptual`: nothing may imply production-ready sliding-door geometry or machining.

## Fixture format

```json
{
  "id": "wardrobe-simple-2door",
  "description": "240cm 2-section oak wardrobe, defaults",
  "config": { "type": "wardrobe", "w": 240, "h": 260, "d": 60,
              "sections": 2, "drawers": 2, "shelves": 4,
              "doorType": "solid", "mat": "oak", "handle": "gold", "led": "off" },
  "class": "regression",
  "capability": "preview",
  "expect": {
    "findings": [],
    "maxSeverity": null,
    "notes": "baseline sanity — a normal config must stay clean"
  }
}
```

`expect.findings` entries match on `{field, severity, messageIncludes?, hasFix?}` — not exact strings, so message rewording doesn't break tests. A fixture may also assert `fix` correctness: applying the returned patch and re-running must produce zero findings of that type (the auto-repair contract).

## Wardrobe fixture set (initial 14)

| # | Fixture | Class | Phase | Expected |
|---|---|---|---|---|
| 1 | simple-2door (above) | regression | 0 | no findings |
| 2 | multi-module: 360cm, 4 sections, drawers+shelves | regression | 0 | no findings |
| 3 | narrow-bay trap: 140cm w / 5 sections | regression | 0 | warning + deterministic fix (fewer sections) |
| 4 | shelf-span trap: 240cm w / 1 section, shelves>0 | regression | 0 | span warning + fix (more sections); the batch-5 L/360 case |
| 5 | span-info band: bay between 65–90cm | regression | 0 | info, no fix (info findings carry no patch) |
| 6 | drawer overload: 6 drawers in low height | **knownGap** | 0 (todo) | rule missing today; documents expected future finding — never asserts current silence as correct |
| 7 | walkin_l corner: rod/drawer near corner cell | characterization — **validator coverage only** | 0 | asserts only what `evaluateConstruction` returns. Does NOT verify Builder corner geometry (that lives inline in `index.html`; geometry correctness is only evidenced by the Jul-2026 corner-fix commits) |
| 8 | vanity below comfort height (<75cm) | regression | 0 | info finding (existing rule) |
| 9 | custom parts: table with sunk tabletop (observed bug class) | regression | 0 | overlap warning with exact-y fix |
| 10 | custom parts: floating shelf w/ `restsOnParts` declared | regression | 0 | zero findings (no false positive) |
| 11 | custom parts: 41 parts | regression | **1** | clamp lives in `chat.js` `sanitizeCustomDesign` (`.slice(0,40)`), NOT in the validator — needs the Phase-1 export |
| 12 | out-of-range dims: wardrobe w=500 | regression | 1 | clamped to RANGES (needs `sanitizeConfig` export) |
| 13 | sliding-door wardrobe | **knownGap**, `capability: conceptual` | 0 (todo) | rule missing; expected future finding: model must carry `conceptual` status (no production-ready sliding-door geometry/machining implied) until a verified sliding system exists; then flips to regression |
| 14 | mirror-door tall+wide door | **knownGap** | 0 (todo) | weight-limit rule pending hinge series (W2) |

Phase 0 = fixtures 1–5 and 7–10 asserted; 6, 13, 14 as `knownGap` todos. Phase 1 adds 11–12. LLM-layer cases (clarification quality, reference-image with missing dims, honest "unsupported") are a separate scored suite, manual/spot-checked — never CI-gating.

## Definition of done (Week 1 slice)

1. `tests/` exists with runner; fixtures 1–5 and 7–10 asserted against CURRENT behavior; 6, 13, and 14 present as `knownGap` todos with their expected future findings written down.
2. Any surprising baseline result logged as a candidate correction — not fixed inline.
3. CI not required yet; a single `node --test` command Bekzod can run is enough.
