# Image-to-Custom-Design — Targeted Research

Triggered by a real gap: the image-upload system prompt instructions only
ever mentioned `set_furniture_config` (the 11 presets) — a photo of a chair,
table, or any non-preset shape would have been forced into the closest
preset instead of composed freely, even though text requests for the same
thing already correctly route to `set_custom_design`.

## Two distinct capability tiers found

**True image-to-3D mesh reconstruction** (Tripo AI, Meshy, Hunyuan3D, Pocket
3D AI) — a two-stage neural pipeline: 2D photo → point cloud → textured
polygon mesh, in USD/FBX/OBJ/STL/GLB/3MF. This is a real, mature, current
capability (2026) — but it produces **raw geometry with no construction
semantics**. There's no "role: leg" or "role: panel," no real board
thickness, no joinery, nothing a cutlist/hardware-BOM/construction-validator
pipeline could use. Plugging this in would mean a completely separate
rendering/export path parallel to everything already built, not an
extension of it. Same weight class and same verdict as the already-deferred
**Furniture Render Generator** (see
[vision-recognition-landscape.md](vision-recognition-landscape.md)) — a
real future capability, not something to bolt on this round.

**VLM-based proportion/dimension estimation** — reasoning about an object's
real-world size from a photo using reference objects and perspective cues,
typically landing within 10-20% accuracy with a clear reference in frame.
This is architecturally identical to what Claude's vision already does
today reading a photo for Style/Image Recognition (skill #3) — no new
model, no new infrastructure, just a reasoning task the same call already
performs.

## What this means for Furni AI

The correct fix is not "add image-to-3D" (that's the heavy, deferred tier)
— it's "let the existing vision call reach `set_custom_design`, not just
`set_furniture_config`." The accuracy ceiling (10-20%, reference-object-
dependent) is honestly about right for "a reasonable starting design from a
photo," the same expectation already set for text-described custom pieces —
not a precision-manufacturing measurement tool, a starting point the
customer refines in chat afterward.

**Implemented**: the image-handling instructions in `api/chat.js`'s system
prompt now mirror the text-based instruction — if the photographed piece
isn't one of the 11 presets, call `set_custom_design` using the same
generic-parts/coordinate/reference-dimension knowledge already built for
text requests, not `set_furniture_config`.

**Verified, with a real secondary finding**: a screenshot of an
already-built custom coffee table, re-submitted as a photo with "build me
something like this, but in black," correctly triggered `set_custom_design`
with matching dimensions and the right material change. But the resulting
part coordinates had a 2cm floating gap between the legs and the tabletop —
visibly a thin highlight line at that junction in the render. This is the
**opposite** failure mode from the sinking-tabletop bug found earlier (see
[[feedback_llm_geometry_needs_backstop]]): a gap instead of an overlap. The
existing `evaluateCustomOverlaps` backstop only checks for *intersections*,
not gaps, and doesn't catch this. **Fixed properly in a follow-up round**: each part in `set_custom_design`
can now declare `restsOnFloor` (boolean) or `restsOnParts` (indices of the
parts it sits on top of) — an explicit, AI-declared structural relationship,
not a guess from geometry. `evaluateCustomFit()` in
`constructionValidator.js` checks only the relationships actually declared
(so intentional gaps between undeclared parts, like two bookcase shelves,
are correctly never flagged), and because the correct y is fully determined
by what a part rests on, it computes an **exact** corrected value, not just
a warning — feeding the same auto-repair chip UI already built for preset
warnings. Requiring the AI to state its intent up front turned out to
improve its own arithmetic too: re-running both the original sinking-table
and floating-table requests, and the previously-broken asymmetric dining
chair, all now produce zero findings and visually flush joints — verified
with real screenshots, not just the tool-call JSON.
