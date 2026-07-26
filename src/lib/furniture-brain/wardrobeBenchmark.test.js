import { describe, test } from "vitest";

/**
 * Known-gap register for the master plan's §25 "core modeling benchmark" and
 * Phase 1 ("Wardrobe: idea to exact editable 3D") acceptance criteria.
 * ----------------------------------------------------------------------------
 * §25 defines three fixture types: regression (must keep passing), characterization
 * (current behavior, not yet judged), and knownGap (missing behavior, documented as
 * a todo, never asserted as correct). Everything below is knownGap: real, wanted
 * capability that does not exist in the repository today. `test.todo` makes each
 * one visible in `npm test` output (shown as pending, never pass/fail) instead of
 * silently missing — a checklist for Phase 1+, not a claim that any of it works.
 *
 * What IS covered today, elsewhere, so it's deliberately NOT repeated here:
 *   - FSL interpretation of a fully-specified / partially-specified wardrobe request,
 *     explicit-vs-assumption tracking, missing_information — furniture-brain/brain.test.js
 *   - FSL schema/semantic validation, configurator compatibility per component — fsl/validator.test.js
 *   - buildGeometry.js's panel output for a given FurnitureConfig — buildGeometry.test.js
 *   - configSchema.js's sanitization of raw AI output — configSchema.test.js
 * The gap is specifically the END-TO-END path (natural-language -> FSL -> exact
 * geometry -> production) and the layout/editing capabilities the master plan
 * describes but the repository does not yet implement — see docs/furniai-authoritative-master-plan-prompt.md §26.
 */
describe("Core wardrobe modeling benchmark (master plan §25) — known gaps", () => {
  test.todo("multi-module wardrobe: FSL document -> configurator-adapter -> buildGeometry produces panels consistent with the FSL component counts (no layer currently connects FSL all the way to buildGeometry's parts list)");
  test.todo("wall-to-wall wardrobe with fillers/scribes (no filler_panel/end_panel geometry exists in buildGeometry.js)");
  test.todo("L-shaped wardrobe (buildGeometry.js models one rectangular carcass only)");
  test.todo("corner wardrobe (no corner geometry exists)");
  test.todo("sloped-ceiling wardrobe (no sloped/angled geometry exists)");
  test.todo("sliding-door wardrobe renders distinctly from a hinged door (components.js marks sliding_door render-identical to hinged_door today)");
  test.todo("wardrobe from a reference image with missing dimensions, through to a clarifying question (brain.test.js covers text-only missing-dimension cases; no attachment-driven dimension-extraction test exists)");
  test.todo("resize after creation via a typed patch command (set_dimension) that only touches the affected parts (no typed-patch layer exists — see master plan §6's corrected note)");
  test.todo("add/remove a drawer via a typed patch (add_drawer/remove_part) without rebuilding the whole document");
  test.todo("add/remove a shelf via a typed patch (add_shelf/remove_part)");
  test.todo("collision/overlap detection between components after an edit (no collision engine exists — buildGeometry.js never checks for overlapping parts)");
  test.todo("custom furniture built from arbitrary panels, not a preset category (no typed custom-parts representation exists — see master plan §6's corrected note on set_custom_design)");
  test.todo("production handoff cross-check: every geometry panel appears in the parts list, quantities and dimensions agree, no duplicate/omitted stable IDs (production.js and buildGeometry.js are not currently cross-validated against each other)");
});
