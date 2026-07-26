# `factoryProfile` v0 — Field Specification + Required Documents

> **Status: DEFERRED REFERENCE DOCUMENT (2026-07-23, per `docs/MASTER-PLAN.md`).** Not an MVP prerequisite. Becomes relevant only when a verified factory/CNC/BAZIS export profile is implemented (MASTER-PLAN Phases 6–7). The MVP modeling convention is 18mm MDF as an editable default — a FurniAI convention, not a factory fact.

**Canonical source: ONE file** — `factory-profiles/<factory-id>.json` (plain JSON, no code). Canonical JSON is consumed by both systems through their respective thin adapters: an import in `src/lib/knowledgeBase.js` (Next.js) and a `require()` in `api/constructionValidator.js` (CJS). No manually synchronized copies anywhere; if an adapter needs a derived shape, it computes it at load time.

**Scope rule:** everything in a factory profile is authoritative **for that factory only** — it is a profile, not a universal furniture rule. "This factory uses 18mm MFC and confirmats" never becomes "wardrobes are built from 18mm MFC with confirmats." Validator rules that consume profile fields must read them via the active profile, so a second factory later means a second JSON file, not a rule rewrite.

**Not implemented until the interview fills it and Bekzod approves.** Per-value provenance lives in a `_provenance` map keyed by JSON path (see example): each entry records `sourceId` (registry ID), `confidence` (`documented | stated | unknown`), `evidenceRef` (document/photo/interview note), and `verifiedAt`.

## Fields

Example (`factory-profiles/uae-main.json`, valid plain JSON; values shown are illustrative placeholders to be replaced by interview answers — allowed enums are noted in prose after the block):

```json
{
  "factoryId": "uae-main",
  "version": "0.1.0",
  "updated": "2026-07-23",

  "boards": [
    {
      "id": "mfc-w980-18",
      "brand": "EGGER",
      "series": null,
      "decorCode": "W980",
      "label": "Platinum White MFC",
      "material": "mfc",
      "nominalThicknessMm": 18,
      "actualThicknessMm": null,
      "sheetWmm": 2800,
      "sheetHmm": 2070,
      "grainDirectional": false,
      "costPerSheetAED": null,
      "notes": ""
    }
  ],
  "backPanel": { "material": "hdf", "thicknessMm": 3, "fixing": "groove" },

  "edgeBanding": {
    "bands": [
      { "thicknessMm": 2, "widthMm": 22, "matchDecorCodes": ["W980"], "adhesive": "EVA" }
    ],
    "cutSizePolicy": "finished-size",
    "minPanelMm": 120,
    "maxPanelMm": 2800,
    "bandedEdgesByRole": {
      "door": "all", "drawerFront": "all", "shelf": "front",
      "side": "front", "top": "front", "bottom": "front",
      "plinth": "top", "back": "none"
    }
  },

  "cutting": {
    "machine": null,
    "kerfMm": null,
    "trimMarginMm": null,
    "minPartMm": null,
    "canNest": null
  },

  "joinery": {
    "primaryCarcassJoint": "confirmat",
    "byType": { "wardrobe": "confirmat", "kitchen": "confirmat" },
    "drilling": [
      { "joint": "confirmat", "diaMm": 5, "depthMm": null, "edgeSetbackMm": null, "spacingMm": null, "decidedBy": "bazis" }
    ],
    "shelfHoles": { "system32": null, "pitchMm": 32, "diaMm": 5, "frontSetbackMm": 37 }
  },

  "hardware": {
    "hinge": {
      "brand": null, "series": null,
      "cupDiaMm": 35, "cupDepthMm": null, "cupEdgeDistMm": null,
      "hingesPerDoor": [ { "maxDoorHmm": 2400, "maxDoorKg": null, "count": null } ]
    },
    "slides": { "brand": null, "series": null, "lengthsMm": [], "ratedKg": null },
    "rail": { "brand": null, "type": null, "maxSpanMm": null },
    "slidingDoors": { "supported": false, "brand": null, "series": null, "minDepthMm": null, "trackClearanceMm": null },
    "stocked": []
  },

  "tolerances": {
    "revealDoorDoorMm": null,
    "revealDoorCarcassMm": null,
    "drawerGapMm": null,
    "carcassDiagonalDiffMaxMm": null
  },

  "site": {
    "fillerStdWidthsMm": [],
    "fillerMinMm": null,
    "maxPanelTransportMm": null,
    "maxCarryKg": null,
    "measureChecklist": []
  },

  "bazis": {
    "csvColumns": [],
    "units": "mm",
    "separator": ";",
    "encoding": null,
    "verified": false
  },

  "approval": { "whoApprovesCutting": null, "checklist": [] },

  "_provenance": {
    "boards[0].nominalThicknessMm": {
      "sourceId": "fact-partner-factory",
      "confidence": "stated",
      "evidenceRef": "interview A.2",
      "verifiedAt": null
    },
    "edgeBanding.cutSizePolicy": {
      "sourceId": "fact-partner-factory",
      "confidence": "unknown",
      "evidenceRef": "interview B.11 — pending",
      "verifiedAt": null
    },
    "bazis.verified": {
      "sourceId": "fact-partner-factory",
      "confidence": "unknown",
      "evidenceRef": "decision 3 — needs one real accepted import",
      "verifiedAt": null
    }
  }
}
```

Enums (documented here, enforced by the adapter, not in the JSON): `material` ∈ mfc|mdf|hdf|ply; `backPanel.fixing` ∈ groove|rebate|screw|nail; `cutSizePolicy` ∈ finished-size|subtract-band (interview B.11 — affects every cut-list row); `primaryCarcassJoint` ∈ confirmat|dowel|minifix+dowel|screw; `drilling[].decidedBy` ∈ bazis|operator; `bandedEdgesByRole` values ∈ all|front|top|none; `slidingDoors.supported` stays `false` until decision 4 identifies the factory's real system; `_provenance.*.confidence` ∈ documented|stated|unknown. `null` = not yet answered — every `null` must resolve to a value or an explicit `unknown` provenance entry before the profile leaves v0.

## Documents & sample files needed from Bekzod / factory (decision 3 included)

1. **One BAZIS-accepted CSV** — the exact file a past job imported successfully. Blocks: `bazis.*`, W3 compatibility check.
2. **One complete past order** — customer drawing/spec + cut list + the production PDF/sheet the operator used + photos of the finished piece. Used to diff against `production.js` / `generateCutList()` output.
3. **Board supplier invoice or stock list** (with decor codes and sheet sizes) → `boards[]`.
4. **Hardware purchase list/invoice** (brands, series, SKUs) → `hardware.*`; then W2 pulls the matching Blum/Hettich technical pages for exactly those series.
5. **Edge band inventory** (thicknesses, decors) → `edgeBanding.bands`.
6. **Machine list** — make/model of saw/CNC/edge bander/drill; manuals if on hand → `cutting`, `edgeBanding` limits.
7. **A site measurement sheet** actually used (even handwritten) → `site.measureChecklist`.
8. **Any written factory rules** (gaps, tolerances, checklists) — even a photo of a wall poster counts. Tier-A gold.

Missing documents don't block the interview — fields fall back to `confidence: "stated"` and get upgraded when paper arrives.
