/**
 * SCALE HONESTY. A generated model has no measured size. The viewer only
 * ever reports bounding-box PROPORTIONS (largest extent = 1) and labels them
 * "Relative scale, not measured". It never emits mm/cm/m/in values, never a
 * "real size", and never renders dimension labels.
 *
 * `asset.scale` metadata is accepted but ignored (declaredScaleIgnored: true)
 * until a provider contract supplies VERIFIED units — see ASSET_VIEWER.md
 * OPEN QUESTIONS.
 */
export const RELATIVE_SCALE_LABEL = "Relative scale, not measured";

export function describeScale({ hasScaleMetadata = false } = {}) {
  return {
    kind: "inferred-relative",
    units: null,
    label: RELATIVE_SCALE_LABEL,
    note: "Generated model — dimensions not measured",
    declaredScaleIgnored: Boolean(hasScaleMetadata),
  };
}

const r2 = (n) => Math.round(n * 100) / 100;

/** size = {x, y, z} bounding-box extents in model units (glTF is Y-up). */
export function relativeProportions(size) {
  const ext = [size.x, size.y, size.z].map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const max = Math.max(...ext);
  if (!(max > 0)) return null;
  const [w, h, d] = ext.map((v) => r2(v / max));
  return {
    w,
    h,
    d,
    normalizedTo: "largest-extent",
    ratioLabel: `W:H:D ${w.toFixed(2)} : ${h.toFixed(2)} : ${d.toFixed(2)}`,
  };
}
