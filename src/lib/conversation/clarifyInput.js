/**
 * src/lib/conversation/clarifyInput.js
 * ---------------------------------------------------------------------
 * Parser and validator for clarification answers in the FurniAI intake flow.
 *
 * Enforces:
 * 1. Exact unit conversion for every accepted unit spelling (mm, cm, m).
 * 2. Exact decimal precision validation in integer deci-millimetres (0.1mm resolution)
 *    without rounding input before validation.
 * 3. Strict positive whole-number validation for bay and door counts.
 * 4. Explicit interior bay layout validation without silent fallbacks.
 */

export const ACCEPTED_DIMENSION_UNITS = Object.freeze({
  // Millimetre variants (factor to dmm = 10, factor to mm = 1)
  "": { factorDmm: 10n, factorMm: 1, baseUnit: "mm" },
  mm: { factorDmm: 10n, factorMm: 1, baseUnit: "mm" },
  millimetre: { factorDmm: 10n, factorMm: 1, baseUnit: "mm" },
  millimetres: { factorDmm: 10n, factorMm: 1, baseUnit: "mm" },
  millimeter: { factorDmm: 10n, factorMm: 1, baseUnit: "mm" },
  millimeters: { factorDmm: 10n, factorMm: 1, baseUnit: "mm" },

  // Centimetre variants (factor to dmm = 100, factor to mm = 10)
  cm: { factorDmm: 100n, factorMm: 10, baseUnit: "cm" },
  centimetre: { factorDmm: 100n, factorMm: 10, baseUnit: "cm" },
  centimetres: { factorDmm: 100n, factorMm: 10, baseUnit: "cm" },
  centimeter: { factorDmm: 100n, factorMm: 10, baseUnit: "cm" },
  centimeters: { factorDmm: 100n, factorMm: 10, baseUnit: "cm" },

  // Metre variants (factor to dmm = 10000, factor to mm = 1000)
  m: { factorDmm: 10000n, factorMm: 1000, baseUnit: "m" },
  metre: { factorDmm: 10000n, factorMm: 1000, baseUnit: "m" },
  metres: { factorDmm: 10000n, factorMm: 1000, baseUnit: "m" },
  meter: { factorDmm: 10000n, factorMm: 1000, baseUnit: "m" },
  meters: { factorDmm: 10000n, factorMm: 1000, baseUnit: "m" },
});

const HEDGE_PATTERN = /(?:~|\b(?:about|around|roughly|approx(?:imately)?|or so)\b)/i;

const WORD_NUMS = Object.freeze({
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
});

/**
 * Parses and validates an exact numeric dimension string with unit conversion.
 *
 * Validates whether the converted dimension is exactly representable in
 * integer deci-millimetres (0.1 mm resolution) without loss of precision.
 *
 * @param {string} rawVal - Customer input string (e.g. "1800", "1.8m", "180 centimetres")
 * @returns {{ ok: boolean, value?: number, convertedText?: string|null, error?: string }}
 */
export function parseDimension(rawVal) {
  if (typeof rawVal !== "string") {
    return { ok: false, error: "Dimension input must be a string." };
  }

  const str = rawVal.trim();
  if (str.length === 0) {
    return { ok: false, error: "Please enter a valid numeric dimension in millimetres (e.g. 1800 or 1.8m)." };
  }

  if (str.startsWith("-")) {
    return { ok: false, error: "Negative dimensions are not permitted. Dimension must be a positive number." };
  }

  if (HEDGE_PATTERN.test(str)) {
    return { ok: false, error: "Measurements must be exact. Approximate values are not permitted." };
  }

  // Parse [sign] integer [.fraction] [unit]
  const match = /^\+?(?:(\d+)(?:\.(\d+))?|\.(\d+))\s*([a-zA-Z]+)?$/i.exec(str);
  if (!match) {
    return { ok: false, error: "Please enter a valid numeric dimension in millimetres (e.g. 1800 or 1.8m)." };
  }

  const intStr = match[1] ?? "0";
  const fracStr = match[2] ?? match[3] ?? "";
  const unitRaw = (match[4] ?? "").toLowerCase();

  const unitDef = ACCEPTED_DIMENSION_UNITS[unitRaw];
  if (!unitDef) {
    return { ok: false, error: "Please enter a valid numeric dimension in millimetres (e.g. 1800 or 1.8m)." };
  }

  const intPart = BigInt(intStr);
  const fracLen = BigInt(fracStr.length);
  const multiplier = unitDef.factorDmm;

  let totalDmm;
  if (fracLen === 0n) {
    totalDmm = intPart * multiplier;
  } else {
    const divisor = 10n ** fracLen;
    const fracPart = BigInt(fracStr);
    const fracDmmScaled = fracPart * multiplier;
    if (fracDmmScaled % divisor !== 0n) {
      return { ok: false, error: "Precision finer than 0.1mm is not supported." };
    }
    totalDmm = intPart * multiplier + (fracDmmScaled / divisor);
  }

  if (totalDmm <= 0n) {
    return { ok: false, error: "Dimension must be a positive number greater than zero." };
  }

  const finalMm = Number(totalDmm) / 10;
  const isPlainMm = unitRaw === "" || unitRaw === "mm";

  return {
    ok: true,
    value: finalMm,
    convertedText: !isPlainMm ? `${finalMm} mm` : null,
  };
}

/**
 * Universal validation dispatcher for clarification answers by gap key.
 *
 * @param {string} gapKey - The intake fact key (e.g. "envelope.widthMm", "bayCount", "bayLayouts")
 * @param {string|any} rawVal - Customer input value
 * @param {number} [currentBayCount=2] - Bay count for interior layout validation
 * @returns {{ ok: boolean, value?: any, convertedText?: string|null, error?: string }}
 */
export function parseAndValidateClarifyInput(gapKey, rawVal, currentBayCount = 2) {
  if (rawVal === undefined || rawVal === null) {
    return { ok: false, error: "Please enter an answer." };
  }

  if (typeof rawVal === "string" && rawVal.trim().length === 0) {
    return { ok: false, error: "Please enter an answer." };
  }

  if (gapKey.endsWith("Mm")) {
    return parseDimension(typeof rawVal === "string" ? rawVal : String(rawVal));
  }

  const v = typeof rawVal === "string" ? rawVal.trim() : rawVal;

  if (gapKey === "bayCount" || gapKey === "doorCount") {
    const label = gapKey === "bayCount" ? "Bay" : "Door";
    if (typeof v === "string" && HEDGE_PATTERN.test(v)) {
      return { ok: false, error: "Counts must be exact integers." };
    }
    if (typeof v === "string") {
      const lower = v.toLowerCase();
      if (WORD_NUMS[lower] !== undefined) {
        return { ok: true, value: WORD_NUMS[lower] };
      }
      if (!/^\+?\d+$/.test(v)) {
        return { ok: false, error: `${label} count must be a positive whole number (e.g. 2, 4).` };
      }
      const n = parseInt(v, 10);
      if (n <= 0) {
        return { ok: false, error: "Count must be at least 1." };
      }
      return { ok: true, value: n };
    }
    if (typeof v === "number") {
      if (!Number.isInteger(v) || v <= 0) {
        return { ok: false, error: `${label} count must be a positive whole number (e.g. 2, 4).` };
      }
      return { ok: true, value: v };
    }
    return { ok: false, error: `${label} count must be a positive whole number (e.g. 2, 4).` };
  }

  if (gapKey === "finishType") {
    if (typeof v === "string") {
      const lower = v.toLowerCase();
      if (lower.includes("melamine")) return { ok: true, value: "melamine" };
      if (lower.includes("painted") || lower.includes("paint")) return { ok: true, value: "painted" };
      if (lower.includes("veneer")) return { ok: true, value: "veneer" };
      return { ok: true, value: lower };
    }
    return { ok: true, value: v };
  }

  if (gapKey === "bayLayouts") {
    if (Array.isArray(v)) {
      if (v.length === 0) {
        return { ok: false, error: "Please select an interior layout for each bay." };
      }
      for (let i = 0; i < v.length; i++) {
        if (!v[i]) {
          return { ok: false, error: `Please select an interior layout for Bay ${i + 1}.` };
        }
      }
      return { ok: true, value: v };
    }
    if (typeof v === "string" && v.startsWith("[") && v.endsWith("]")) {
      try {
        const arr = JSON.parse(v);
        if (Array.isArray(arr) && arr.length > 0) {
          for (let i = 0; i < arr.length; i++) {
            if (!arr[i]) {
              return { ok: false, error: `Please select an interior layout for Bay ${i + 1}.` };
            }
          }
          return { ok: true, value: arr };
        }
      } catch (_e) {
        // Fall through to error
      }
    }
    return { ok: false, error: "Please use the bay selectors below to choose each bay layout." };
  }

  return { ok: true, value: v };
}
