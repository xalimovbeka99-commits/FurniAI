# Factory Interview — Structured Questionnaire

> **Status: DEFERRED REFERENCE DOCUMENT (2026-07-23, per `docs/MASTER-PLAN.md`).** Not a Phase-0 prerequisite and not required for the MVP. FurniAI's MVP is an AI furniture 3D-model-creation application using the 18mm-MDF modeling convention; this interview becomes relevant only when implementing a verified export for a specific factory, CNC controller, post-processor, or BAZIS workflow (MASTER-PLAN Phases 6–7).

**Interviewee:** Bekzod (+ factory operator where noted) · **Goal:** populate `factoryProfile` v0 (see `05-factory-profile-spec.md`) and the source registry with Tier-A facts. Every answer becomes data with provenance `fact-partner-factory`.

Workshop language on purpose. Answer with real numbers from the shop, not "usually" values. Where the answer is "depends," write down what it depends on — that IS the rule.

**Scope:** every answer is authoritative for THIS factory's profile only — never promoted to a universal furniture rule. Another factory later gets its own profile file, interview, and answers.

## A. Boards & sheet goods

1. Which boards do you actually stock or order? For each: brand (EGGER? Kronospan? local?), type (MFC/melamine, MDF, HDF, plywood), decor codes you use most.
2. Nominal vs. actual thickness — when you order "18mm," what does the caliper say? Same question for 8mm, 16mm, 25mm if used.
3. Sheet sizes as delivered (2800×2070? 2440×1220?). Which sizes for which material?
4. Grain/texture direction: which decors have a direction the customer notices? Do you ever sequence-match sheets for one order?
5. Back panels: material and thickness (3mm HDF? 8mm?), and how are they fixed (groove, rebate, screwed on, nailed)?
6. Any board you refuse to use (moisture, sag, chipping on cut)? Why?

## B. Cutting & edges

7. What cuts the panels — beam saw, sliding table saw, CNC nesting? Machine make/model.
8. Kerf width. Trim margin per sheet edge. Minimum part size the saw/CNC can safely handle.
9. Edge bander: make/model. Band thicknesses in stock (0.4/1/2mm?). Max/min panel size it accepts. Pre-milling? Corner rounding?
10. Which edges get banded on: door, drawer front, shelf, side panel, top, plinth? (This checks the assumptions in `production.js:finishFor()` — currently guesses like "shelf: front edge 1mm".)
11. The cut-size question that breaks cut lists everywhere: do you cut FINISHED size and the band adds on top, or do you subtract band thickness from the cut size? Per band thickness.

## C. Joinery & drilling

12. Main carcass joint: confirmat? dowel? cam+dowel (minifix)? screws? Different for wardrobe vs. kitchen?
13. Exact drilling data for that joint: diameters, depths, edge setbacks, spacing. Who decides positions — BAZIS automatically, or the operator?
14. Shelf holes: system-32 line boring (5mm holes, 32mm pitch, 37mm from edge)? Or drilled per job? Adjustable vs. fixed shelves — how does the factory tell them apart on the drawing?
15. Anything hand-drilled on site during installation? What and why?

## D. Hardware actually purchased (decision 2)

16. Hinges: brand + exact series (e.g. Blum Clip Top 110°? Hettich Sensys? a generic?). Soft-close integrated or separate? Where do you buy them?
17. Cup drilling for that hinge: cup Ø (35mm?), depth, distance from edge, screw pattern. How many hinges per door at which door heights/weights?
18. Drawers: slide/box system + series (Blum Tandembox? Hettich InnoTech? ball-bearing generic?). Lengths stocked. Weight rating you trust.
19. Wardrobe rails, lift systems, shelf supports, legs/levelers, handles: brands and the specific items you keep in stock.
20. Sliding doors (decision 4): which system, if any, has the factory actually built with (brand/series/track)? If none: confirm sliding-door configs should stay production-unsupported.

## E. Assembly, tolerances, quality

21. Standard gaps: door-to-door reveal, door-to-carcass, drawer front gaps. What does "wrong" look like to you in mm?
22. Carcass squareness tolerance before it leaves the bench. Diagonal difference you accept on a wardrobe carcass?
23. Top 5 mistakes that have actually cost money in the last year (wrong size, missing part, wrong edge, hardware clash, site surprise). Each becomes a validator rule candidate + eval fixture.

## F. Order flow & BAZIS (decision 3)

24. Walk through one real past order end-to-end: what paper/file did the factory receive, who typed what into BAZIS, what came out, what went to the saw.
25. What EXACTLY does your BAZIS accept as import — CSV columns, units, separator, encoding? (We need the sample file, see documents list in `05-factory-profile-spec.md`.)
26. Who is allowed to approve a job for cutting today? What do they check before pressing go?

## G. Site & installation (UAE specifics)

27. What do you measure on site before manufacturing a fitted wardrobe? Wall/floor/ceiling deviations you commonly find in UAE apartments (gypsum walls? AC ducts? curved skirting)?
28. Filler/scribe policy: standard filler widths, minimum you'll accept, where they go (both sides? top?).
29. Delivery/installation constraints: max panel size that fits lifts/stairs, van size, two-man carry limit.

## Interview mechanics

- Expect 90–120 minutes; record audio if OK, fill `05-factory-profile-spec.md` live.
- Mark every answer: **[fact — documented]**, **[fact — Bekzod's word, confirm with operator]**, or **[unknown — needs factory visit]**.
- Contradictions with current code (e.g. `production.js` edge-banding defaults, `PANEL_THK_MM = 18`) get logged as candidate corrections, NOT fixed in code during research phase.
