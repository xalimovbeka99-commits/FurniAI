# Drawings, Blueprints & PDF/OCR Landscape — Research Batch 4

Fourth pilot batch: furniture technical drawings, blueprint generation, PDF
dimension parsing, and OCR for engineering drawings. Chosen because the live
site already *generates* technical drawings/blueprints (`svgOrthoView()`,
`buildTechnicalDrawings()`, `buildAssemblyBlueprint()` in `index.html`) but
has no way to *read* one a customer or factory partner sends in — this batch
checks what that reverse direction would need.

## Blueprint/drawing generation (the direction Furni AI already has)

**SketchChair**, **O-LAP**, **Draw2D-Furniture**, **Blueprint3D** — all
generate 2D/CAD output from a parametric or sketched model, the same shape
as the live site's own technical-drawing generation.

**What Furni AI can learn**: nothing new to build — `svgOrthoView()` already
does real orthographic front/side/top views with dimension lines, and
`buildAssemblyBlueprint()` already does a numbered component-key diagram.
This is a **confirmation batch, not a gap batch**, same as batch 3 — the
generation direction is already solved at the live site's own scope.

**Can this become a skill?** No — already done.

## PDF dimension extraction (the direction Furni AI doesn't have)

**Floorplan-Dimractor** ([jasoncobra3](https://github.com/jasoncobra3/Floorplan-Dimractor))
is the most relevant find: extracts dimensions and cabinet codes from
architectural floorplan PDFs **without any ML or OCR model at all** —
PyMuPDF + pdfplumber pull the PDF's actual text layer (for born-digital
PDFs, not scans), then comprehensive regex handles every real-world
dimension notation (`25"`, `2' 6"`, `34 1/2"`, mixed numbers), normalizing
all of it to a single decimal unit, with bounding-box coordinates for each
match in the output JSON.

**CAD-pdf-chatbot** ([adityawalture](https://github.com/adityawalture/CAD-pdf-chatbot))
takes a different, complementary approach: PyMuPDF text extraction feeding
a **local LLM** to produce an engineering summary — i.e., extract-then-ask-
an-LLM, rather than extract-then-regex.

**What Furni AI can learn**: there are two genuinely different techniques
here depending on what kind of file arrives —
1. **Born-digital PDF with a real text layer** (a spec sheet, a CAD export,
   an architect's floor plan): direct text/regex extraction like
   Floorplan-Dimractor is fast, free, and more precise than any vision
   call — no LLM needed at all for this case.
2. **Scanned/photographed drawing** (no text layer, just pixels): needs
   either OCR (see below) or a vision-capable LLM call — which Furni AI
   already has, from Style/Image Recognition (skill #3).

Furni AI's existing image-attachment mechanism (skill #3) already covers
case 2 reasonably well — Claude's vision can read dimension labels on a
photographed drawing the same way it reads door style on a furniture photo.
Case 1 (a real digital PDF) isn't covered yet, and needlessly burning a
vision call to re-read text a PDF already has natively would be wasteful —
noted as a real, scoped future improvement rather than urgent.

**Can this become a skill?** Not a new skill — a **future version** note on
skill #3 (see [../ai-skills/proposed-skills.md](../ai-skills/proposed-skills.md)):
detect whether an uploaded file is an image/scan (use vision, as today) or a
text-layer PDF (extract text directly, skip the vision call). No code
changed this round — this is scoped as a refinement to revisit if/when
customers start sending real spec-sheet PDFs, not photos.

## OCR for engineering drawings

**eDOCr** / **eDOCr2** ([javvi51](https://github.com/javvi51/eDOCr)) — a
purpose-built OCR pipeline (keras-ocr based) specifically for mechanical
drawings: separately recognizes dimensions, title-block info, and GD&T
(geometric dimensioning and tolerancing) symbols. **dimension-interpolation**
and **EngineeringDrawingAndTextExtraction** (Tesseract-based) are similar,
narrower tools. Recent academic work (arXiv 2510.21862, 2505.01530)
confirms the field is actively moving toward **vision-language models**
(Donut, Florence-2, and general VLMs) for this exact task, rather than
classical OCR pipelines — validating that reaching for Claude's vision
(already integrated) is the current, not outdated, approach for reading a
scanned technical drawing, not a shortcut around "real" OCR.

**What Furni AI can learn**: confirms the direction taken in skill #3
(vision-LLM over dedicated OCR/CV pipeline) is the state-of-the-art choice,
not a corner cut for lack of a proper pipeline — the specialized OCR tools
here (eDOCr) exist mainly for teams *without* API access to a capable
vision model, which isn't Furni AI's situation.

**Can this become a skill?** No — confirms the existing approach.
