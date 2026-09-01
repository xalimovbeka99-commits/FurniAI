/**
 * FurniSpec v0.1 — Normalizer & Canonical Serializer
 * ---------------------------------------------------------------------
 * Normalizes FurniSpec v0.1 documents into deterministic, byte-stable
 * canonical data structures with strict 0.1mm (deci-mm) precision.
 */

import { toDeciMm, fromDeciMm } from "./units.js";

/**
 * Recursively sorts all keys in an object alphabetically and normalizes
 * float dimensions to exact tenths of a millimeter (0.1 mm precision).
 * Throws DimensionPrecisionError if precision is finer than 0.1mm.
 *
 * @param {any} val
 * @param {string} [path="root"]
 * @returns {any}
 */
export function normalizeValue(val, path = "root") {
  if (val === null || val === undefined) {
    return val;
  }

  if (typeof val === "number") {
    if (!Number.isFinite(val)) return val;
    // Check and normalize to exact tenths of a millimeter
    const dmm = toDeciMm(val, path);
    return fromDeciMm(dmm);
  }

  if (Array.isArray(val)) {
    return val.map((item, idx) => normalizeValue(item, `${path}[${idx}]`));
  }

  if (typeof val === "object") {
    const sortedKeys = Object.keys(val).sort();
    const result = {};
    for (const key of sortedKeys) {
      result[key] = normalizeValue(val[key], `${path}.${key}`);
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
  return normalizeValue(spec, "spec");
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
