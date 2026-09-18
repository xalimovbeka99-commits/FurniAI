# Claude bundle 19ee058 reconciliation

**Claude tip:** `19ee0584e1885312e1228836a39bcc8c4f23397e` (`review/claude-part-graph-compiler-19ee058`)  
**Candidate start:** `3fab34a70cbeed90c2480de355bf57a9457d4cfe`  
**Decision detail:** `DRAWER_COMPILER_DECISION.md` (authoritative)

## Claude analysis

### 1. Does bundle supersede or complement emitDrawerBankParts?

**Complements conceptually; does not supersede in production.**  
`drawerPack.js` is a stricter compiler that refuses to invent five unruled box dimensions. The live product path already invents those as provisional conversational defaults via `emitDrawerBankParts`. Adopting `drawerPack` as the live path would regress `Add drawers` to UNSUPPORTED. Engineering discipline from Claude (positive dims, explicit five-input inventory, draft labelling) is folded into the single authoritative emitter — Claude’s file is **not** imported.

### 2. Five explicit drawer inputs vs conversational defaults + provenance

| Field | Conversational default | Provenance |
|---|---|---|
| `boxHeightMm` | `drawerH − 2×reveal` | height provisional; reveal **BEKZOD_RULING** |
| `boxDepthMm` | `carcassDepth − 50` | **PROVISIONAL** |
| `boxBottomClearanceMm` | `0` | **PROVISIONAL** |
| `bottomThicknessMm` | `max(6, backThickness)` | **PROVISIONAL** / catalog |
| `backBetweenSides` | `true` | **PROVISIONAL** |

### 3. Draft assumptions labelling

Adapter defaults `status=PROPOSED` + `adapterAssumptions[]`. Does not silently stamp workshop-approved. Qualification remains `WORKSHOP_REVIEW_NOT_CNC_QUALIFIED`.

### 4. PL-006 independent proof results

- Construction: `BACK = W − 21 − 30`. W=50→−1; W=51→0; W=52→+1.  
- Customer: kernel + `component_add` reject W≤51; revision/components unchanged on reject.  
- Direct compiler: `emitDrawerBankParts` throws on W=50/51 non-positive BACK.  
- Exporters: permanent Vitest — valid control then mutate one dim; SVG/DXF/CSV/nesting all refuse.  
- Note: `minSectionWidthMm=250` so W=50/51 sections are not creatable via normal section resize; customer gate proven on synthetic section widths.  
- **Not** BEKZOD_APPROVED usable width. W=52 = arithmetic only.

### 5. Adapter mapping review

- SHELF→FIXED: kept; labelled mapping assumption.  
- Rail LONG/SHORT: **preserved** prior `drop > 1000` heuristic (Claude nearer-of-1400/900 would silently reclassify mid-drop rails).  
- Plinth 100: provisional labelled default.  
- Status: PROPOSED not APPROVED.

### 6. Single authoritative drawer construction after reconcile

`buildStructuralPartGraph` → **`emitDrawerBankParts` only**. No competing `drawerPack` on this branch.

## Also merged

- AG boot/menu/modal `30b2fe9` (already on 3fab34a ancestry)  
- Mobile mfg/nesting browser test from `c51af19` (test only; **no** fingerprint evidence refresh)  
- `fbfd7a7` baseline package/checklists preserved and regenerated for final tip


## Update — Claude returned with 927c071

PL-006 fail-close tip `927c071` independently verified and integrated as source of truth for:
DEGENERATE_DRAWER_GEOMETRY, exclusive bay gate, SVG validatePartGraph refusal, 50.9/51.0/51.1 tests.
Bundle `d80f1d3` remains REVIEW ONLY — drawerPack not merged.
