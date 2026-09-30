/** @internal Analytic arc representation shared by conversion and geometry math. */
export interface ArcSegment {
  type: 'arc';
  cx: number; cy: number;
  ux: number; uy: number;
  vx: number; vy: number;
  startAngle: number; sweep: number;
}
export const TAU = Math.PI * 2;
export function arcPoint(arc: ArcSegment, angle: number): [number, number] {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return [arc.cx + arc.ux * cos + arc.vx * sin, arc.cy + arc.uy * cos + arc.vy * sin];
}
export function arcSweep(start: number, end: number, ccw: boolean): number {
  const delta = end - start;
  if (!ccw && delta >= TAU) return TAU;
  if (ccw && -delta >= TAU) return -TAU;
  // Reducing separately also avoids overflow in end - start.
  let sweep = ((end % TAU) - (start % TAU)) % TAU;
  if (!ccw && sweep < 0) sweep += TAU;
  if (ccw && sweep > 0) sweep -= TAU;
  return sweep;
}

/** Singular-value decomposition of a 2x2 ellipse basis. */
export function ellipseParameters(arc: ArcSegment) {
  const scale = Math.max(Math.abs(arc.ux), Math.abs(arc.uy), Math.abs(arc.vx), Math.abs(arc.vy));
  if (scale === 0) return null;
  const ux = arc.ux / scale, uy = arc.uy / scale, vx = arc.vx / scale, vy = arc.vy / scale;
  const determinant = ux * vy - uy * vx;
  if (determinant === 0) return null;
  const xx = ux * ux + vx * vx, yy = uy * uy + vy * vy, xy = ux * uy + vx * vy;
  const rotation = Math.atan2(2 * xy, xx - yy) / 2;
  const major = Math.sqrt((xx + yy + Math.hypot(xx - yy, 2 * xy)) / 2);
  const minor = Math.abs(determinant) / major;
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  const phase = Math.atan2((-sin * ux + cos * uy) / minor, (cos * ux + sin * uy) / major);
  const direction = determinant < 0 ? -1 : 1;
  return {
    radiusX: major * scale, radiusY: minor * scale, rotation,
    start: phase + direction * arc.startAngle, sweep: direction * arc.sweep,
  };
}

/** Preserve all turns in the traversal of an ellipse collapsed onto a line. */
export function singularArcPoints(arc: ArcSegment): [number, number][] {
  const useX = Math.hypot(arc.ux, arc.vx) >= Math.hypot(arc.uy, arc.vy);
  const turning = Math.atan2(useX ? arc.vx : arc.vy, useX ? arc.ux : arc.uy);
  const end = arc.startAngle + arc.sweep;
  const low = Math.min(arc.startAngle, end), high = Math.max(arc.startAngle, end);
  const angles: number[] = [];
  for (let k = Math.ceil((low - turning) / Math.PI); k <= Math.floor((high - turning) / Math.PI); k++) {
    const angle = turning + k * Math.PI;
    if (angle > low && angle < high) angles.push(angle);
  }
  if (arc.sweep < 0) angles.reverse();
  angles.push(end);
  return angles.map(angle => arcPoint(arc, angle));
}
