/**
 * FurniSpec v0.1 — Normalizer & Canonical Serializer
 * ---------------------------------------------------------------------
 * Normalizes FurniSpec v0.1 documents into deterministic, byte-stable
 * canonical data structures.
 */

/**
 * Recursively sorts all keys in an object alphabetically and normalizes
 * float dimensions to exact tenths of a millimeter (0.1 mm precision).
 *
 * @param {any} val
 * @returns {any}
 */
export function normalizeValue(val) {
  if (val === null || val === undefined) {
    return val;
  }

  if (typeof val === "number") {
    if (!Number.isFinite(val)) return val;
    // Standardize to tenths of a millimeter without binary floating-point drift
    return Math.round(val * 10) / 10;
  }

  if (Array.isArray(val)) {
    return val.map((item) => normalizeValue(item));
  }

  if (typeof val === "object") {
    const sortedKeys = Object.keys(val).sort();
    const result = {};
    for (const key of sortedKeys) {
      result[key] = normalizeValue(val[key]);
    }
    return result;
  }

  return val;
}

/**
 * Normalizes a FurniSpec object into its canonical form.
 * @param {object} spec
 * @returns {object}
 */
export function normalizeFurniSpec(spec) {
  return normalizeValue(spec);
}

/**
 * Serializes a FurniSpec into a deterministic, byte-stable JSON string.
 * @param {object} spec
 * @returns {string}
 */
export function serializeCanonicalJson(spec) {
  const normalized = normalizeFurniSpec(spec);
  return JSON.stringify(normalized, null, 2);
}
