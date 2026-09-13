# Rule authority policy v0.1 — which engine decides, and who approved it

**Scope:** F1 correction only. Nothing here changes a number, unlocks CNC, or
records an approval.

## 1. The dual path, mapped

FurniAI has two engineering stacks. Both are real, both are used, and they
answer to different authorities.

| | `wardrobe-model` + `wardrobe-tools` | `furnispec` + `partgraph` |
|---|---|---|
| Canonical state | `WardrobeModel` — `id`, `revision`, `sections[]`, `components[]` | `FurniSpec` → `PartGraph` |
| Identity | `id` allocated once; `revision` +1 per successful tool | `specId` + `revision`, canonical `fs256:` fingerprint |
| Geometry | `buildWardrobeGeometry.js` | `buildStructuralPartGraph.js` |
| Rule provenance | **none** — constants live in `schema.js` `DEFAULTS` | `wardrobeRuleCatalog.js`, 31 rules, all with provenance |
| Approval gate | none | `validateApproval()` by fingerprint |
| Physical limits | 5 fail-closed gates in the validator | plausibility gaps only |
| Reached by | `/api/wardrobe/chat` → `runWardrobeAgent` → 8 tools | `/api/design/propose` → transport → pipeline |

**Which serves the customer interface?** Both, through different panels, and
that is the finding rather than a complaint:

- The **unified Design-with-AI panel** — the F1 journey — runs
  `index.html` → `ai-designer-transport.js` → `POST /api/design/propose` →
  `proposeDesignChange` → `applyConversationalEdit` → `previewDraftWardrobe` →
  `assembleFurniSpec` → `buildStructuralPartGraph`. **FurniSpec/PartGraph is
  the authority for F1.**
- The **in-builder "Ask AI" drawer** runs `/api/wardrobe/chat` →
  `runWardrobeAgent` → the eight deterministic tools →
  `wardrobe-model`. Still live, still reachable, and where the five physical
  limits are enforced.

So the stack with approval tracking is not the stack with the physical limits.
That is the gap this policy closes.

## 2. One versioned policy, two registries

No third engine, and no constant copied between schemas. Values stay where they
are enforced; provenance becomes declarable for both stacks.

| Registry | Version | Covers |
|---|---|---|
| `wardrobeRuleCatalog.js` | `wardrobe-rules/0.1` | 31 construction constants — FurniSpec path |
| `physicalLimitRegistry.js` | `physical-limits/0.1` | fail-closed physical limits — wardrobe-model path |

Provenance classes, now four:

| Class | Meaning | `resolve()` |
|---|---|---|
| `RULEBOOK_V0_1` | Approved, by rule ID in `docs/WARDROBE_RULEBOOK_V0.1.md` | returns |
| `GOLDEN_FIXTURE_BEKZOD_APPROVED` | Approved, evidenced by the golden fixture | returns |
| `REQUIRES_BEKZOD_RULING` | **No value exists.** Must be asked | **throws** |
| `PROVISIONAL_PENDING_BEKZOD_REVIEW` | **A value IS enforced, nobody approved it** | n/a — see below |

The fourth class exists because the third does not fit. `REQUIRES_BEKZOD_RULING`
means "no value, so ask". A fail-closed limit is the opposite shape: a value is
enforced, and deleting it would weaken safety rather than restore honesty. It
must keep working, and it must stop looking approved.

## 3. The five physical limits — provisional

Searched for an approval: `docs/WARDROBE_RULEBOOK_V0.1.md`, `docs/adr/`, the
golden fixture, and every doc in the repository. **None found for any of the
five.** Absent that, provisional is the only accurate label.

| ID | Key | Value | Unit | Scope | Provenance |
|---|---|---|---|---|---|
| PL-001 | `maxPanelThicknessMm` | 50 | mm | Upper bound on panel thickness | PROVISIONAL |
| PL-002 | `minShelfClearanceMm` | 60 | mm | Clear gap between shelf zones | PROVISIONAL |
| PL-003 | `minHangingClearanceBelowMm` | 800 | mm | Clear drop below rod centre | PROVISIONAL |
| PL-004 | `minHangingInteriorDepthMm` | 300 | mm | Interior depth for a hanging bay | PROVISIONAL |
| PL-005 | `maxUnsupportedShelfSpanMm` | 1200 | mm | Continuous span with no partition | PROVISIONAL |

Introduced by Grok in `b3288bf` on `test/adversarial-qa-security-f1`. On this
handoff tip (`integ/f1-claude-handoff`, base `8f0cfa1`) those five keys are
already present in `DEFAULTS`; the registry declares their provisional provenance
without changing any number.

**They stay enforced.** Nothing is relaxed. What changes is that
`rulePolicySummary()` reports `approved: false` for each, and a test asserts no
code path can describe them as approved.

**PL-005 is the one to look at first.** Deflection depends on material,
thickness and load, none of which the limit reads. A single span number cannot
be right for every material, so it is likely wrong in both directions — too
permissive for 18 mm particle board, too strict for 25 mm ply.

## 4. The mechanism

`physicalLimitRegistry.test.js` fails when a `min*`/`max*` limit appears in
`DEFAULTS` with no registry entry, naming the key and saying to register it —
never to delete it. Pre-existing envelope bounds are excluded **by name**, so a
new one cannot hide behind the exclusion. Verified by regression: adding an
unregistered `minDrawerTravelClearanceMm` fails the guard with that key named.

Values are read from `DEFAULTS` at call time. The registry cannot disagree with
behaviour because it holds no copy of any number.

## 5. Not done here, and why

- **No approval recorded.** Bekzod's ruling is his to give.
- **No limit changed.** Changing one is a furniture decision.
- **No rule-value changes.** Numbers stay exactly as enforced on `8f0cfa1`.
- **No third engine.** The long-term question of whether `wardrobe-model` and
  `FurniSpec` converge is a roadmap decision, not an F1 correction.

## 6. For Bekzod — five questions, one sitting

For each: keep as-is, change the number, or make it material-dependent.

1. PL-001 — 50 mm max panel thickness.
2. PL-002 — 60 mm minimum clear gap between shelves.
3. PL-003 — 800 mm minimum drop below a hanging rod.
4. PL-004 — 300 mm minimum interior depth for a hanging bay.
5. PL-005 — 1200 mm maximum unsupported shelf span, and whether it should
   depend on material and thickness.

Answers move each entry from `PROVISIONAL_PENDING_BEKZOD_REVIEW` to
`RULEBOOK_V0_1` with a rule ID. Until then the label stays honest and the limits
stay enforced.


## 7. Stale-response guard (transport)

Published `proposeDesignChange` rejects in-flight answers that no longer match
the active design. **Revision alone is not sufficient** (Undo can restore the
prior revision). Callers must pass:

- `specId` / `currentDesignId` — design identity
- `changeToken` / `currentChangeToken` — monotonic token bumped on every
  committed edit **and** every Undo (never rewinds)

Refusal kind: `RESULT_KIND.STALE_REVISION` (name kept for Antigravity additive
compatibility; covers changeToken and design-id mismatch). UI wiring:
`docs/m2/integ/ANTIGRAVITY_STALE_GUARD_HANDOFF.md`.
