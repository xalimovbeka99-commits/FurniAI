/**
 * FurniSpec v0.1 — Canonical Units & Precision Helpers
 * ---------------------------------------------------------------------
 * Authoritative numeric policy:
 * - 1 deci-millimetre (dmm) = 0.1 mm.
 * - 1 millimetre = 10 deci-millimetres.
 * - All internal kernel math operates on exact integer deci-millimetres.
 * - Fractional inputs beyond 0.1 mm precision are rejected outright with
 *   code `UNSUPPORTED_DIMENSION_PRECISION` — never silently rounded.
 */

export class DimensionPrecisionError extends Error {
  constructor(field, value, message) {
    super(message || `${field}: value ${value} cannot be represented at 0.1mm (deci-mm) precision.`);
    this.name = "DimensionPrecisionError";
    this.code = "UNSUPPORTED_DIMENSION_PRECISION";
    this.field = field;
    this.value = value;
  }
}

/**
 * Converts a floating-point millimetre value to an exact integer deci-millimetre.
 * Throws `DimensionPrecisionError` if the value has more than 1 decimal place.
 *
 * @param {number} valueMm
 * @param {string} [field="dimension"]
 * @returns {number} Integer deci-millimetres
 */
export function toDeciMm(valueMm, field = "dimension") {
  if (typeof valueMm !== "number" || !Number.isFinite(valueMm)) {
    throw new DimensionPrecisionError(field, valueMm, `${field} must be a finite number, got ${valueMm}.`);
  }

  const scaled = valueMm * 10;
  const rounded = Math.round(scaled);

  // Check whether the input had precision finer than 0.1mm
  if (Math.abs(scaled - rounded) > 1e-5) {
    throw new DimensionPrecisionError(
      field,
      valueMm,
      `${field} (${valueMm}mm) has precision finer than 0.1mm. Silent rounding is forbidden.`
    );
  }

  return rounded;
}

/**
 * Converts an integer deci-millimetre value back to decimal millimetres.
 *
 * @param {number} dmm
 * @returns {number} Decimal millimetres
 */
export function fromDeciMm(dmm) {
  if (typeof dmm !== "number" || !Number.isInteger(dmm)) {
    throw new Error(`fromDeciMm expects an integer deci-millimetre value, got ${dmm}.`);
  }
  return dmm / 10;
}

/**
 * Asserts that a millimetre value is a strictly positive, finite number
 * exact to 0.1 mm precision. Returns integer deci-millimetres.
 *
 * @param {number} valueMm
 * @param {string} field
 * @returns {number} Integer deci-millimetres
 */
export function assertDeciMm(valueMm, field) {
  const dmm = toDeciMm(valueMm, field);
  if (dmm <= 0) {
    throw new DimensionPrecisionError(field, valueMm, `${field} must be strictly positive (> 0), got ${valueMm}mm.`);
  }
  return dmm;
}
