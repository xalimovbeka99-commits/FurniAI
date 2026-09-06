# FurniAI G4 (AI-Alpha) — Conversation to Parametric Wardrobe

> **WORKSHOP-REVIEW SPECIFICATION — NOT CNC-QUALIFIED**
>
> Nothing in this pipeline emits machine coordinates. Hardware drilling remains
> `BLOCKED_PENDING_HARDWARE_APPROVAL` and CNC qualification remains `NO`.

**Status:** `PROPOSED — AWAITING CODEX REVIEW AND BEKZOD SIGN-OFF`
**Gate:** G4 — AI-Alpha conversation slice
**Base SHA:** `7646be1b56ec97fa28c8c94118b9c3896155dd67`
**Branch:** `claude/ai-alpha`
**Visible accomplishment:** `npm run demo:ai-wardrobe`

---

## 1. The trust boundary

```
  customer description  (untrusted text)
          │
          ▼
  interpretDescription()        deterministic, no model call
          │                     emits OBSERVATIONS = proposals only
          ▼
  analyseGaps()                 deterministic completeness analysis
          │                     emits typed GAPS, never a value
          ▼
  questionsFor()                phrasing only; cannot answer anything
          │
          ▼
  human answers                 recorded as CUSTOMER_CONFIRMED
          │
══════════╪══════════════════  ◄── TRUST BOUNDARY ──────────────────
          ▼
  assembleFurniSpec()           refuses while any BLOCKING gap stands
          │                     every value is stated, confirmed, or
          │                     derived from an APPROVED rule with its ID
          ▼
  validateFurniSpec()           existing G2.1 validator, unchanged
          ▼
  buildStructuralPartGraph()    existing G2.2 kernel, unchanged
          ▼
  safetyReport()                reports; decides nothing
```

The rule the whole gate exists to enforce: **an AI may propose, a person decides,
and only an approved rule derives.** No module upstream of the boundary can put a
number into FurniSpec, and no module downstream invents one.

---

## 2. What was added

| File | Responsibility |
|---|---|
| `src/lib/rules/wardrobeRuleCatalog.js` | Every construction constant as addressable data with provenance. `resolve()` throws for any rule still awaiting a Bekzod ruling. |
| `src/lib/rules/materialCatalog.js` | Approved material records. A finish with no record is a blocking gap, never a substitution. |
| `src/lib/conversation/intakeModel.js` | Observation / gap vocabulary and the required-fact list. No field on that list has a default. |
| `src/lib/conversation/interpretDescription.js` | Deterministic phrase interpreter. Text in, proposals out. No model call, no clock, no I/O. |
| `src/lib/conversation/gapAnalysis.js` | Pure completeness and closure analysis producing typed gaps. |
| `src/lib/conversation/questions.js` | Gap to furniture-shop question. Phrasing only. |
| `src/lib/conversation/assembleFurniSpec.js` | The trust boundary. Closure derivations in exact integer deci-millimetres. |
| `src/lib/conversation/pipeline.js` | Orchestration and the safety read-out. |
| `src/lib/conversation/fixtures/demoScenarios.js` | The exact text the demo and the unit suite both use. |
| `scripts/demo-ai-wardrobe.mjs` | `npm run demo:ai-wardrobe`. |

No existing file was modified except `package.json`, which gained one script line.
No Three.js, Builder, catalog, viewer or deployment file was touched.

---

## 3. Rule provenance policy

Every constant carries one of three provenance classes:

| Class | Meaning | Applied automatically? |
|---|---|---|
| `RULEBOOK_V0_1` | Stated in `WARDROBE_RULEBOOK_V0.1.md` under a numbered rule ID (WR-001…WR-013). | Yes |
| `GOLDEN_FIXTURE_BEKZOD_APPROVED` | Present in the Bekzod-approved `goldenWardrobe.fixture.json` but not written as a numbered rule. | Yes, with the weaker provenance recorded |
| `REQUIRES_BEKZOD_RULING` | No approved source. | **No — `resolve()` throws** |

Three constants are currently in the third class and are therefore always asked,
never assumed:

- `UNRULED-BAY-COUNT` — no approved rule maps an overall width to a bay count.
- `UNRULED-DOORS-PER-BAY` — the Golden, narrow and wide fixtures all use two doors
  per bay, but no Rulebook rule states it. It is offered as a proposal only.
- `UNRULED-BAY-SPLIT` — no approved rule distributes a non-integral bay-width
  remainder. A width that does not divide exactly is a blocking gap, not a rounding.

---

## 4. What the demo proves

`npm run demo:ai-wardrobe` runs 22 assertions and exits non-zero on any failure.

1. **Complete description → validated FurniSpec.** A plain-English request is read
   into eight customer-stated facts, closed by seven rule-cited derivations, and
   validated by the existing G2.1 validator with zero errors.
2. **Approved FurniSpec → 19-part PartGraph.** The kernel produces 19 structural
   parts that are **part-for-part identical to the Bekzod-approved Golden Wardrobe**
   — same roles, finished sizes, raw sizes, placements, grain and edge banding —
   reached from prose rather than from a hand-written fixture. Determinism is
   checked over ten consecutive runs.
3. **Incomplete request → clarification questions.** "I need a wardrobe for my
   bedroom, about 2 metres tall" yields eight questions and zero observations. The
   hedged measurement is refused rather than rounded. No spec and no geometry are
   produced. Answering the questions drives the same request to the same 19 parts.
4. **Safety.** CNC qualification is `NO` on both spec and PartGraph, drilling is
   `BLOCKED_PENDING_HARDWARE_APPROVAL`, zero drilling operations exist, the only
   machining operation is the approved back groove, and the serialized PartGraph
   contains no drilling or G-code payload.

---

## 5. Known limitations

- The interpreter is a **deterministic phrase parser**, not a language model. It
  understands the vocabulary in `interpretDescription.js` and nothing else. That is
  deliberate for this gate: it makes the pipeline reproducible and keeps the model
  out of the trusted path. An LLM-backed interpreter is a drop-in alternative that
  must return the same observation shape and remains proposal-only.
- Only two interior layouts exist in this slice: full-height hanging, and short
  hanging over two adjustable shelves.
- Only the melamine material record is approved. Painted and veneer finishes are
  blocking gaps.
- Voice, photograph, sketch, PDF and catalog evidence are **not** implemented.
  Only written text is accepted.
- The `bayLayouts` extractor infers bay order from the order the layouts are
  mentioned. A description that names bays out of order will be misread; the
  layout-count check catches a mismatch but not a reordering.

---

## 6. Related documents

- [Wardrobe Rulebook v0.1](WARDROBE_RULEBOOK_V0.1.md)
- [G2.2 PartGraph Contract](G2_2_PARTGRAPH_CONTRACT.md)
- [G2.1 FurniSpec compatibility note](G2_1_FURNISPEC_COMPATIBILITY_NOTE.md)
- [Known limitations](KNOWN_LIMITATIONS.md)
