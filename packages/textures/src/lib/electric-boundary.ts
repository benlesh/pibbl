import { point, type ElectricPoint } from "./electric-shared.js";

/** One simple closed polygon, supplied in texture coordinates. */
export function boundary(
  input?: readonly ElectricPoint[],
): ElectricPoint[] | undefined {
  if (input === undefined) return undefined;
  if (!Array.isArray(input) || input.length < 3 || input.length > 256)
    throw new RangeError("Tendril boundary requires 3..256 points.");
  return input.map(point);
}
function nearest(p: ElectricPoint, a: ElectricPoint, b: ElectricPoint) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    length = dx * dx + dy * dy;
  const t = length
    ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length))
    : 0;
  return { x: a.x + dx * t, y: a.y + dy * t };
}
export function contain(
  p: ElectricPoint,
  polygon?: readonly ElectricPoint[],
): ElectricPoint {
  if (!polygon) return p;
  let inside = false,
    best = p,
    distance = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j],
      b = polygon[i];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
    const q = nearest(p, a, b),
      d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < distance) {
      distance = d;
      best = q;
    }
  }
  return inside ? p : best;
}
/** Bounded continuous convection: hit the outline, then walk its upward tangent. */
export function riseAlongBoundary(
  p: ElectricPoint,
  distance: number,
  polygon?: readonly ElectricPoint[],
): ElectricPoint {
  if (!polygon) return { x: p.x, y: Math.max(0.02, p.y - distance) };
  let current = contain(p, polygon);
  // Tiny adjacent edges cannot cause unbounded work in one frame.
  for (let step = 0; step < 8 && distance > 1e-9; step++) {
    let onEdge = false,
      next: ElectricPoint | undefined,
      steepest = 0;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i],
        b = polygon[(i + 1) % polygon.length],
        q = nearest(current, a, b);
      if (Math.hypot(q.x - current.x, q.y - current.y) > 1e-7) continue;
      onEdge = true;
      for (const v of [a, b]) {
        const length = Math.hypot(v.x - current.x, v.y - current.y);
        const slope = length ? (current.y - v.y) / length : 0;
        if (slope > steepest + 1e-9) {
          steepest = slope;
          next = v;
        }
      }
    }
    if (onEdge) {
      // At a local peak, stay there until the filament fades/restarts.
      if (!next) return current;
      const length = Math.hypot(next.x - current.x, next.y - current.y);
      const travel = Math.min(distance, length),
        t = travel / length;
      current = {
        x: current.x + (next.x - current.x) * t,
        y: current.y + (next.y - current.y) * t,
      };
      distance -= travel;
      continue;
    }
    let travel = distance;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i],
        b = polygon[(i + 1) % polygon.length],
        dx = b.x - a.x;
      if (Math.abs(dx) < 1e-12) continue;
      const t = (current.x - a.x) / dx;
      if (t < 0 || t > 1) continue;
      const dy = current.y - (a.y + (b.y - a.y) * t);
      if (dy > 1e-9 && dy <= travel) travel = dy;
    }
    current = { x: current.x, y: current.y - travel };
    distance -= travel;
  }
  return current;
}
