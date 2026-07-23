# Vision & Recognition Landscape — Research Batch 2

Second pilot batch (first was kitchen/wardrobe/hardware/joinery/parametric/DXF,
see [open-source-landscape.md](open-source-landscape.md)). This batch: style
recognition, image analysis/datasets, computer vision/object detection, AI/ML
interior design, recommendation systems — chosen because it directly feeds the
one still-unbuilt skill from the first pass, Style/Image Recognition (see
[../ai-skills/proposed-skills.md](../ai-skills/proposed-skills.md)).

## iDECOR (IKEA Furniture Recommender)

[sophiachann/ObjectDetectionProject-IKEAFurnituresRecommender](https://github.com/sophiachann/ObjectDetectionProject-IKEAFurnituresRecommender)

**Purpose**: upload a room photo → get the 5 closest-matching IKEA products.

**Architecture** (the important part — a clean, complete 3-stage pipeline):
1. **Detect**: Detectron2 (Faster R-CNN + Region Proposal Network), trained on
   ~10,000 annotated images across 6 categories (beds/chairs/couches/tables/
   lamps/cabinetry) from Open Images V6, to find individual furniture pieces
   within a room photo.
2. **Embed**: each detected crop goes through VGG16 or InceptionV3 (transfer
   learning, several frozen-layer configurations tested) to produce a feature
   vector encoding its visual design.
3. **Retrieve**: cosine similarity against a pre-computed feature-vector index
   of the product catalog (~1,400 scraped IKEA items) — top 5 closest vectors
   returned as recommendations.

**What Furni AI can learn**: this detect→embed→retrieve pattern is exactly
the right shape for a **Furniture Similar Design Finder** / **Inspiration
Search** skill (both named in the original research brief's skill list, but
not in our first-pass proposals) — except Furni AI doesn't need the detect
step at all for this use case (a customer's inspiration photo is *already* a
single furniture item, not a room scene with multiple objects to find), and
doesn't need a separately-trained embedding model either — a vision-capable
LLM call (the same Claude model already in `api/chat.js`) can describe a
photo's style/material/type directly in one call, without a bespoke
CNN/index-building pipeline. The 3-stage pattern matters for *design*, not
because we should copy the stack.

**Can this become a skill?** Yes — see the refined Style/Image Recognition
proposal, and a new proposal, Similar Design Finder, in
[../ai-skills/proposed-skills.md](../ai-skills/proposed-skills.md).

---

## Furniture-Style-Classifier

[plasmon360/Furniture-Style-Classifier](https://github.com/plasmon360/Furniture-Style-Classifier)

**Purpose**: classify a furniture photo into one of 4 styles (Mid-century
modern, Rustic, Arts and Crafts, Traditional).

**Architecture**: ResNet34, transfer learning, trained on Google Images
photos, served via a small Flask webapp. Notably: the webapp lets a user
correct a wrong prediction, and logs every submission + correction to a
database — a simple, real feedback loop for improving the model over time
without a full retraining pipeline upfront.

**What Furni AI can learn**: the feedback-logging pattern is worth adopting
regardless of which underlying model does the classifying — if the
Style/Image Recognition skill ever mis-reads a photo, logging the correction
(customer said "actually this is walnut, not oak") builds a real, growing,
proprietary dataset of exactly the furniture styles/materials Furni AI's own
customers care about, which a generic pretrained classifier never gives you.

**Can this become a skill?** The classification task itself, yes (folded
into Style/Image Recognition). The correction-logging pattern is a **Future
Version** note on that same skill, not a separate one.

---

## iMaterialist / Flying Furniture / assorted CNN classifiers

[iMaterialist Challenge (FGVC5)](https://github.com/zhby99/Furniture-Classification) ·
[Flying Furniture dataset](https://github.com/BardOfCodes/flying_furniture) ·
several 5-8-class CNN classifiers (chair/sofa/table/bed/dresser/lamp).

**What Furni AI can learn**: these are all closed-vocabulary classifiers (a
fixed list of furniture *types*, not styles or construction detail) trained
on large labeled datasets (iMaterialist: 194,828 images / 128 classes).
None of them classify anything Furni AI actually needs — the live site
already knows the furniture type from the customer's own request (wardrobe/
kitchen/vanity/etc., an 11-value enum in `api/chat.js`), so a general
"is-this-a-chair-or-a-sofa" classifier solves a problem Furni AI doesn't
have. Confirms the Claude-vision-call approach (ask "what style/material/
door type is this photo," not "what furniture type is this") is the right
scope — no training pipeline needed.

**Can this become a skill?** No — reference/confirmation only.

---

## StableDesign (generative interior design)

[Lavreniuk/generative-interior-design](https://github.com/Lavreniuk/generative-interior-design)
— 2nd place, Generative Interior Design 2024 competition.

**Purpose**: given an empty room photo, generate a photorealistic furnished
render matching a text-described style.

**Architecture** (materially more advanced than anything else in this
batch): dual ControlNet conditioning — one on room segmentation
(`controlnet-seg-room`, spatial zones) and one on depth
(`sd-controlnet-depth`, preserves geometry/perspective) — driving a
LoRA-fine-tuned Stable Diffusion v1.5, with Places365 for scene detection and
LLaVA-1.5 for auto-captioning the desired look.

**What Furni AI can learn**: this is a genuinely different *class* of
capability from style recognition — **generating** a photorealistic
furnished visualization, not **recognizing** an uploaded photo's style. It
requires hosting/calling a diffusion model + ControlNet stack, nothing like
the one-call-to-Claude-vision approach that covers recognition. Worth
recording as the real architecture for a future **Furniture Render
Generator** skill (named in the original brief's skill list) — but it's a
substantially heavier lift (model hosting, fine-tuning, room-structure
conditioning) than anything built so far this pass, and shouldn't be
conflated with or scoped alongside the lightweight Style/Image Recognition
skill just because both involve "AI and a photo."

**Can this become a skill?** Yes, but explicitly scoped as a separate,
future, higher-complexity skill — see **Furniture Render Generator (future)**
in [../ai-skills/proposed-skills.md](../ai-skills/proposed-skills.md).

---

## Recommendation systems (collaborative filtering / LDA / pairing)

[Umang2002/Furniture-Recommendation-System](https://github.com/Umang2002/Furniture-Recommendation-System) (collaborative filtering) ·
[FurnitureRecommenderSystem](https://github.com/shakewingo/FurnitureRecommenderSystem) (text+image LDA) ·
[FurniturePairing](https://github.com/kuril-intech/FurniturePairing) (cross-category visual matching).

**What Furni AI can learn**: collaborative filtering needs a large existing
user-interaction history (purchases/ratings) to work at all — Furni AI has
no such history yet (it's a design tool, not a storefront with purchase
history), so this approach doesn't fit today. The LDA and cross-category
visual-pairing approaches are closer to what could eventually matter (e.g.
"what handle style pairs with this door style"), but need a larger, labeled
design corpus than the current ~30-entry `DESIGNS` catalog provides.

**Can this become a skill?** Not yet — noted as a **Future Version** idea
only, gated on having enough real customer design history to make
collaborative signals meaningful.
