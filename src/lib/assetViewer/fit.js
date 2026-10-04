/**
 * Pure camera-fit math (no three import). Given a bounding sphere and a
 * perspective camera, returns where the camera must sit so the whole sphere
 * is visible in BOTH the vertical and horizontal field of view, plus
 * near/far planes and orbit distance limits scaled to the model.
 */
export const DEFAULT_VIEW_DIRECTION = Object.freeze([0.9, 0.55, 1.25]);

export function computeFit({ center, radius, fovDeg, aspect, direction = DEFAULT_VIEW_DIRECTION, margin = 1.15 }) {
  if (!(radius > 0) || !Number.isFinite(radius)) throw new RangeError("computeFit: radius must be a positive finite number");
  const a = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
  const vFov = (fovDeg * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * a);
  const halfFov = Math.min(vFov, hFov) / 2;
  const distance = (radius / Math.sin(halfFov)) * margin;
  let [dx, dy, dz] = direction;
  let len = Math.hypot(dx, dy, dz);
  if (!(len > 1e-9)) {
    [dx, dy, dz] = DEFAULT_VIEW_DIRECTION;
    len = Math.hypot(dx, dy, dz);
  }
  dx /= len;
  dy /= len;
  dz /= len;
  const minDistance = radius * 0.9;
  const maxDistance = Math.max(distance * 4, radius * 10);
  return {
    distance,
    position: [center[0] + dx * distance, center[1] + dy * distance, center[2] + dz * distance],
    target: [center[0], center[1], center[2]],
    near: radius * 0.01,
    far: maxDistance + radius * 2,
    minDistance,
    maxDistance,
    halfFovRad: halfFov,
  };
}
