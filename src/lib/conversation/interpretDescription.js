/**
 * FurniAI — Deterministic Description Interpreter (Gate G4 / AI-Alpha)
 * ---------------------------------------------------------------------
 * Turns a written customer description into OBSERVATIONS and AMBIGUITIES.
 *
 * SAFETY CONTRACT
 * - This module makes NO model call and has NO randomness, clock or I/O.
 *   Identical text in, identical result out, on every runtime.
 * - It never fills a missing fact. Anything not explicitly said becomes a
 *   gap in gapAnalysis.js, never a default here.
 * - Everything it emits is a PROPOSAL. Nothing reaches FurniSpec without
 *   passing the clarification boundary.
 *
 * A future LLM-backed interpreter is a drop-in alternative that must return
 * this same shape and is subject to the same rule: proposals only.
 */

import { toDeciMm, fromDeciMm } from "../furnispec/units.js";
import {
  BAY_LAYOUT,
  GAP_KIND,
  GAP_SEVERITY,
  OBSERVATION_ORIGIN,
  gap,
  observation,
} from "./intakeModel.js";

export const INTERPRETER_ID = "deterministic-phrase-interpreter/0.1";

const NUMBER_WORDS = Object.freeze({
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
});

const HEDGE = "(?:about|around|roughly|approximately|approx\\.?|circa|~|some ?where around|or so|ish)";

const UNIT_TO_MM = Object.freeze({ mm: 1, millimetre: 1, millimeter: 1, cm: 10, centimetre: 10, centimeter: 10, m: 1000, metre: 1000, meter: 1000 });

const DIMENSION_ROLES = Object.freeze([
  { key: "envelope.widthMm", words: "(?:wide|width|across)" },
  { key: "envelope.heightMm", words: "(?:high|tall|height)" },
  { key: "envelope.depthMm", words: "(?:deep|depth)" },
]);

const OUT_OF_SLICE_TERMS = Object.freeze([
  { pattern: /\bsliding\b/i, detail: "Sliding-door manufacturing is deferred; the first slice builds straight hinged wardrobes only." },
  { pattern: /\bcorner wardrobe\b|\bl-shaped\b/i, detail: "Corner wardrobes are deferred." },
  { pattern: /\bcurved\b/i, detail: "Curved and freeform carcasses are deferred." },
  { pattern: /\bkitchen\b/i, detail: "Kitchens are not yet a manufacturing product." },
  { pattern: /\bwalk[- ]?in\b/i, detail: "Walk-in configurations are outside the first manufacturing slice." },
]);

function parseCount(token) {
  const lower = token.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, lower)) return NUMBER_WORDS[lower];
  const n = Number(lower);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Converts a matched magnitude+unit to exact mm, or null when not representable at 0.1mm. */
function toExactMm(magnitude, unitToken) {
  const unitKey = (unitToken || "mm").toLowerCase().replace(/s$/, "").replace(/\./g, "");
  const factor = UNIT_TO_MM[unitKey];
  if (factor === undefined) return null;
  try {
    return fromDeciMm(toDeciMm(Number(magnitude) * factor, "dimension"));
  } catch {
    return null;
  }
}

/**
 * @param {string} description raw customer text
 * @returns {{interpreterId:string, observations:Array, ambiguities:Array, unmatchedIntent:Array<string>}}
 */
export function interpretDescription(description) {
  if (typeof description !== "string") {
    throw new TypeError("interpretDescription expects a string description.");
  }
  const text = description;
  const observations = [];
  const ambiguities = [];
  const seen = new Set();

  const push = (key, value, meta) => {
    if (seen.has(key)) return;
    seen.add(key);
    observations.push(observation(key, value, OBSERVATION_ORIGIN.CUSTOMER_STATED, meta));
  };

  // --- 1. Envelope dimensions -------------------------------------------------
  for (const role of DIMENSION_ROLES) {
    // "<hedge>? <number><unit>? ... <role word>"  e.g. "1800mm wide", "about 2 metres tall"
    const re = new RegExp(
      `(${HEDGE}\\s+)?(\\d+(?:\\.\\d+)?)\\s*(mm|cm|m|millimetres?|millimeters?|centimetres?|centimeters?|metres?|meters?)?\\s*(?:\\w+\\s+){0,2}?${role.words}`,
      "i"
    );
    const m = re.exec(text);
    if (!m) continue;
    const sourceText = m[0].trim();
    const span = [m.index, m.index + m[0].length];
    if (m[1]) {
      ambiguities.push(
        gap(role.key, GAP_KIND.AMBIGUOUS_FACT, GAP_SEVERITY.BLOCKING, {
          detail: `"${sourceText}" is hedged. A manufacturing dimension must be exact.`,
          sourceText,
        })
      );
      seen.add(role.key);
      continue;
    }
    const mm = toExactMm(m[2], m[3]);
    if (mm === null) {
      ambiguities.push(
        gap(role.key, GAP_KIND.AMBIGUOUS_FACT, GAP_SEVERITY.BLOCKING, {
          detail: `"${sourceText}" cannot be represented exactly at 0.1mm precision. Silent rounding is forbidden.`,
          sourceText,
        })
      );
      seen.add(role.key);
      continue;
    }
    push(role.key, mm, { sourceText, sourceSpan: span });
  }

  // --- 2. Plinth height -------------------------------------------------------
  const plinthRe = new RegExp(
    `(?:(${HEDGE})\\s+)?(?:(\\d+(?:\\.\\d+)?)\\s*(mm|cm|m)?\\s*(?:high\\s+)?plinth|plinth\\s+(?:of\\s+|at\\s+)?(\\d+(?:\\.\\d+)?)\\s*(mm|cm|m)?)`,
    "i"
  );
  const pm = plinthRe.exec(text);
  if (pm) {
    const sourceText = pm[0].trim();
    if (pm[1]) {
      ambiguities.push(
        gap("plinth.heightMm", GAP_KIND.AMBIGUOUS_FACT, GAP_SEVERITY.BLOCKING, {
          detail: `"${sourceText}" is hedged. Plinth height sets the carcass height and must be exact.`,
          sourceText,
        })
      );
      seen.add("plinth.heightMm");
    } else {
      const mm = toExactMm(pm[2] ?? pm[4], pm[3] ?? pm[5]);
      if (mm !== null) push("plinth.heightMm", mm, { sourceText, sourceSpan: [pm.index, pm.index + pm[0].length] });
    }
  }

  // --- 3. Bay and door counts -------------------------------------------------
  const bayRe = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:equal\s+|separate\s+)?bays?\b/i;
  const bm = bayRe.exec(text);
  if (bm) {
    const n = parseCount(bm[1]);
    if (n !== null) push("bayCount", n, { sourceText: bm[0].trim(), sourceSpan: [bm.index, bm.index + bm[0].length] });
  }

  const doorRe = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:\w+\s+){0,2}?doors?\b/i;
  const dm = doorRe.exec(text);
  if (dm) {
    const n = parseCount(dm[1]);
    if (n !== null) push("doorCount", n, { sourceText: dm[0].trim(), sourceSpan: [dm.index, dm.index + dm[0].length] });
  }

  // --- 4. Finish --------------------------------------------------------------
  const finishRe = /\b(melamine|painted|lacquered|veneer(?:ed)?)\b/i;
  const fm = finishRe.exec(text);
  if (fm) {
    const raw = fm[1].toLowerCase();
    const finish = raw.startsWith("melamine") ? "melamine" : raw.startsWith("veneer") ? "veneer" : "painted";
    push("finishType", finish, { sourceText: fm[0], sourceSpan: [fm.index, fm.index + fm[0].length] });
  }

  // --- 5. Interior layouts, in the order the customer describes them ----------
  const layoutPatterns = [
    { layout: BAY_LAYOUT.LONG_HANGING, re: /\b(?:full[- ]?(?:height|length)\s+hanging|long\s+hanging|full\s+hanging)\b/gi },
    { layout: BAY_LAYOUT.SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES, re: /\bshort\s+hanging\b/gi },
  ];
  const layoutHits = [];
  for (const { layout, re } of layoutPatterns) {
    let hit;
    while ((hit = re.exec(text)) !== null) {
      layoutHits.push({ index: hit.index, layout, sourceText: hit[0] });
    }
  }
  layoutHits.sort((a, b) => a.index - b.index);
  if (layoutHits.length > 0) {
    push(
      "bayLayouts",
      layoutHits.map((h) => h.layout),
      { sourceText: layoutHits.map((h) => h.sourceText).join(" | "), sourceSpan: [layoutHits[0].index, layoutHits[layoutHits.length - 1].index + layoutHits[layoutHits.length - 1].sourceText.length] }
    );
  }

  // --- 6. Out-of-slice intent -------------------------------------------------
  const unmatchedIntent = [];
  for (const term of OUT_OF_SLICE_TERMS) {
    const om = term.pattern.exec(text);
    if (om) {
      unmatchedIntent.push(om[0]);
      ambiguities.push(
        gap("furnitureScope", GAP_KIND.OUT_OF_SLICE, GAP_SEVERITY.BLOCKING, {
          detail: term.detail,
          sourceText: om[0],
        })
      );
    }
  }

  return {
    interpreterId: INTERPRETER_ID,
    observations,
    ambiguities,
    unmatchedIntent,
  };
}
