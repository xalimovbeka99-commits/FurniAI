/**
 * evaluateConstruction(cfg) — deterministic, graded (non-binary) checks on a
 * sanitized furniture config. sanitizeConfig() in chat.js clamps every field
 * to a valid *range* independently; it can't catch a combination that's
 * individually valid but doesn't render the way the customer expects.
 * Findings never block config creation — they're extra context the AI can
 * mention naturally, the same "graded severity, not pass/fail" idea used by
 * cabinet-mcp's evaluation engine (see docs/knowledge-base/open-source-landscape.md).
 *
 * Every rule below is grounded in exactly how index.html's Builder interprets
 * each field per type (wall()/kitchenRun()/buildVanity()/buildBookshelf()/
 * buildSideboard()) — not generic cabinetry advice.
 */

const PANEL_THK_CM = 1.8; // Builder.P = 0.018m, see index.html

function sectionWidthCm(wCm, sections) {
  return (wCm - PANEL_THK_CM * (sections + 1)) / sections;
}

// `fix` (optional) is a deterministic partial-config patch that resolves
// the finding — the same rule that detected the problem computes its own
// correction, so it's exact, not guessed. Only attached to `warning`-level
// findings with a clean, unambiguous fix; `info` findings are just context,
// not something to auto-correct. The frontend renders these as a one-click
// "Apply fix" chip (cabinet-mcp's auto-repair pattern) instead of leaving
// the customer to work out new numbers themselves from the prose message.
function finding(severity, field, message, fix) {
  return fix ? { severity, field, message, fix } : { severity, field, message };
}

// Search toward fewer sections (wider bays shrink as sections drop) until
// the bay clears the narrow-bay floor.
function sectionsToWidenBays(wCm, fromSections) {
  for (let n = fromSections; n >= 1; n--) {
    if (sectionWidthCm(wCm, n) >= 25) return n;
  }
  return 1;
}
// Search toward more sections (narrower bays shrink the shelf span) until
// it clears the safe-span threshold, capped at the schema's own max (6).
function sectionsToNarrowShelfSpan(wCm, fromSections) {
  for (let n = fromSections; n <= 6; n++) {
    if (sectionWidthCm(wCm, n) <= SHELF_SPAN_INFO_CM) return n;
  }
  return 6;
}

// Real shelving-industry deflection guidance (L/360 rule): a shelf on
// 32mm-system pin supports (this catalog's construction, see
// docs/knowledge-base/construction-standards.md) safely spans roughly
// 49-65cm before sag becomes visible — pin supports carry less than fixed
// end supports, hence the lower end of the usual 61-76cm fixed-support
// range. Sag grows with the CUBE of span, so this isn't a soft limit.
const SHELF_SPAN_WARN_CM = 90;
const SHELF_SPAN_INFO_CM = 65;
const VANITY_MIN_COMFORT_HEIGHT_CM = 75; // real standard is 86-91cm "comfort height"
const OVERLAP_TOLERANCE_CM = 0.3; // parts flush/touching (e.g. a leg meeting a tabletop) aren't a conflict

// Real 3D bounding-box overlap check for a custom design's parts. The AI
// composes each part's x/y/z by hand (see set_custom_design's worked example
// in api/chat.js) and coordinate arithmetic mistakes are a real, observed
// failure mode — e.g. a tabletop positioned half its own thickness too low,
// sinking it into the legs instead of resting on top of them. Two boxes
// truly overlap only if ALL THREE axes overlap; sharing a footprint (a leg
// under a tabletop) is normal and only a real conflict if they also overlap
// vertically.
function axesOverlap(c1, e1, c2, e2) {
  return Math.abs(c1 - c2) < (e1 + e2) / 2 - OVERLAP_TOLERANCE_CM;
}
function evaluateCustomOverlaps(parts) {
  const findings = [];
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const a = parts[i], b = parts[j];
      const overlapsX = axesOverlap(a.x, a.w, b.x, b.w);
      const overlapsY = axesOverlap(a.y, a.h, b.y, b.h);
      const overlapsZ = axesOverlap(a.z, a.d, b.z, b.d);
      if (overlapsX && overlapsY && overlapsZ) {
        findings.push(finding('warning', 'parts',
          `The ${a.role} (part ${i + 1}) and ${b.role} (part ${j + 1}) overlap in 3D space — check their x/y/z positions, one likely needs to sit flush on top of/beside the other instead of intersecting it.`));
      }
    }
  }
  return findings;
}

const FIT_TOLERANCE_CM = 0.5;

// Overlap detection only catches parts that intersect — it's blind to the
// opposite failure mode, a part floating above whatever it's meant to rest
// on (found in real testing: a tabletop positioned exactly a gap's width
// above its legs). A generic "any gap between any two parts is wrong" rule
// would false-positive on every INTENTIONAL gap (the space between two
// shelves, for instance), so this only checks relationships the AI
// explicitly declares via restsOnFloor/restsOnParts (see set_custom_design
// in api/chat.js) — an undeclared relationship is simply not checked, never
// guessed. Because the correct y is fully determined by what a part rests
// on, this can compute an EXACT fix, not just flag the problem.
function evaluateCustomFit(cfg) {
  const findings = [];
  const parts = cfg.parts || [];
  const floorY = -cfg.h / 2;
  const withFix = (i, correctedY) => ({ parts: parts.map((q, k) => (k === i ? { ...q, y: correctedY } : q)) });

  parts.forEach((p, i) => {
    const partBottom = p.y - p.h / 2;

    if (p.restsOnFloor) {
      const gap = partBottom - floorY;
      if (Math.abs(gap) > FIT_TOLERANCE_CM) {
        const correctedY = floorY + p.h / 2;
        findings.push(finding('warning', 'parts',
          `The ${p.role} (part ${i + 1}) should rest on the floor but is ${gap > 0 ? `floating ${gap.toFixed(1)}cm above` : `sunk ${(-gap).toFixed(1)}cm below`} it — y should be ${correctedY.toFixed(1)}, not ${p.y}.`,
          withFix(i, correctedY)));
      }
    }

    if (Array.isArray(p.restsOnParts) && p.restsOnParts.length) {
      let supportTop = -Infinity;
      p.restsOnParts.forEach(idx => { const s = parts[idx]; if (s) supportTop = Math.max(supportTop, s.y + s.h / 2); });
      if (Number.isFinite(supportTop)) {
        const gap = partBottom - supportTop;
        if (Math.abs(gap) > FIT_TOLERANCE_CM) {
          const correctedY = supportTop + p.h / 2;
          findings.push(finding('warning', 'parts',
            `The ${p.role} (part ${i + 1}) should rest on part(s) ${p.restsOnParts.map(x => x + 1).join(', ')} but there's a ${Math.abs(gap).toFixed(1)}cm ${gap > 0 ? 'gap' : 'overlap'} — y should be ${correctedY.toFixed(1)}, not ${p.y}.`,
            withFix(i, correctedY)));
        }
      }
    }
  });

  return findings;
}

function evaluateConstruction(cfg) {
  const findings = [];
  const { type, sections, drawers, shelves, doorType, w, h } = cfg;

  // Every rule below assumes the preset shape (sections/drawers/shelves/
  // doorType/bay-width) — a custom design has none of that, it's a freeform
  // parts array instead. Run the one check that DOES apply — real 3D
  // overlap between parts — and skip everything else cleanly rather than
  // let preset-only math run on undefined fields.
  if (type === 'custom') {
    findings.push(...evaluateCustomFit(cfg));
    findings.push(...evaluateCustomOverlaps(cfg.parts || []));
    return findings;
  }

  // Every type divides width into bays the same way: sw = (W - panel*(N+1)) / N
  // (wall(), kitchenRun(), buildVanity(), buildBookshelf(), buildSideboard()).
  const sw = sectionWidthCm(w, sections);
  if (sw < 25) {
    const fixSections = sectionsToWidenBays(w, sections);
    findings.push(finding('warning', 'sections',
      `At ${w}cm wide with ${sections} sections, each bay is only ~${sw.toFixed(1)}cm — too narrow for a real door or drawer front. Reduce sections or increase width.`,
      fixSections !== sections ? { sections: fixSections } : undefined));
  } else if (sw < 32) {
    findings.push(finding('info', 'sections',
      `Each bay works out to ~${sw.toFixed(1)}cm — on the tight side for a full-height door.`));
  }

  // Shelves span the full bay width with no center support (wall()/
  // buildVanity()/buildSideboard()) — a wide, lightly-sectioned bay risks
  // real, visible sag. Kitchen doesn't use cfg.shelves as adjustable
  // shelving (kitchenRun() has no shelf concept), so it's excluded.
  if (!type.startsWith('kitchen') && shelves > 0) {
    if (sw > SHELF_SPAN_WARN_CM) {
      const fixSections = sectionsToNarrowShelfSpan(w, sections);
      findings.push(finding('warning', 'shelves',
        `Each shelf would span ~${sw.toFixed(0)}cm unsupported — well beyond the ~${SHELF_SPAN_INFO_CM}cm a pin-supported shelf can carry without visible sag. Add more sections (narrower bays) or drop the shelf count.`,
        fixSections !== sections ? { sections: fixSections } : undefined));
    } else if (sw > SHELF_SPAN_INFO_CM) {
      findings.push(finding('info', 'shelves',
        `Each shelf spans ~${sw.toFixed(0)}cm — on the wide side for a pin-supported shelf; expect some sag over time under a full load.`));
    }
  }

  // Real vanity "comfort height" is 86-91cm; the schema's own range floor (45cm)
  // allows something far shorter than any real vanity is ever built at.
  if (type.startsWith('vanity') && h < VANITY_MIN_COMFORT_HEIGHT_CM) {
    findings.push(finding('info', 'h',
      `${h}cm is unusually low for a vanity — real vanity counters are typically 86-91cm from the floor.`));
  }

  // Kitchen door fronts are hardcoded solid in kitchenRun() — doorType never
  // reaches makeDoor() for any kitchen variant.
  if (type.startsWith('kitchen') && doorType !== 'solid') {
    findings.push(finding('info', 'doorType',
      `Kitchen door fronts always render as solid panels today — "${doorType}" won't change how the doors look.`));
  }

  // Kitchen and sideboard alternate door/drawer bays by index (even = door,
  // odd = drawers) — with fewer than 2 sections there's never an odd bay.
  if ((type.startsWith('kitchen') || type === 'sideboard') && drawers > 0 && sections < 2) {
    findings.push(finding('warning', 'drawers',
      `Drawers only appear in alternating bays — with ${sections} section(s), no drawer bay will render at all. Use at least 2 sections to get a drawer stack.`,
      { sections: 2 }));
  }
  // Kitchen additionally floors any drawer bay at 2 drawers (Math.max(2, drawers)).
  if (type.startsWith('kitchen') && sections >= 2 && drawers === 0) {
    findings.push(finding('info', 'drawers',
      `With 2+ sections, a kitchen run always shows at least 2 drawers in its drawer bay — a fully drawerless kitchen isn't possible at this section count.`));
  }

  // Bookshelf forces drawers:0, doorType:'open' regardless of cfg.
  if (type === 'bookshelf' && (doorType !== 'open' || drawers > 0)) {
    findings.push(finding('info', 'doorType',
      `Bookshelves always render as open shelving (at least 4 shelves) — doorType and drawers have no effect on this type.`));
  }

  // Walk-in L/U corner cubby (makeCornerCab) never gets a door, by design.
  if ((type === 'walkin_l' || type === 'walkin_u') && doorType !== 'open') {
    findings.push(finding('info', 'doorType',
      `The corner cubby unit in an L/U walk-in closet is always open (no door) by design — every other bay still uses "${doorType}".`));
  }

  // Vanity clamps to at most 3 drawers per bay (Math.min(3, drawers)).
  if (type.startsWith('vanity') && drawers > 3) {
    findings.push(finding('info', 'drawers',
      `Vanities show at most 3 drawers per bay — the extra ${drawers - 3} won't have a visible effect.`));
  }

  return findings;
}

module.exports = { evaluateConstruction, PANEL_THK_CM, SHELF_SPAN_INFO_CM };
