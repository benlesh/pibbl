import type { LayoutBox } from "../layout/types.js";
import type { CircularSweep } from "../geometry/circular-sweep.js";

const fullTurn = Math.PI * 2;

export function arcBounds(
  cx: number,
  cy: number,
  radius: number,
  sweep: Readonly<CircularSweep>,
): LayoutBox | undefined {
  if (radius <= 0 || sweep.sweep === 0) return undefined;
  if (sweep.fullCircle) {
    return {
      x: cx - radius,
      y: cy - radius,
      width: radius * 2,
      height: radius * 2,
    };
  }

  const angles = [sweep.startAngle, sweep.endAngle];
  for (const cardinal of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    if (containsAngle(sweep, cardinal)) angles.push(cardinal);
  }
  const xs = angles.map((angle) => cx + radius * Math.cos(angle));
  const ys = angles.map((angle) => cy + radius * Math.sin(angle));
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function wedgeBounds(
  cx: number,
  cy: number,
  radius: number,
  sweep: Readonly<CircularSweep>,
): LayoutBox | undefined {
  const bounds = arcBounds(cx, cy, radius, sweep);
  if (!bounds || sweep.fullCircle) return bounds;
  const left = Math.min(bounds.x, cx);
  const right = Math.max(bounds.x + bounds.width, cx);
  const top = Math.min(bounds.y, cy);
  const bottom = Math.max(bounds.y + bounds.height, cy);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function containsAngle(sweep: Readonly<CircularSweep>, angle: number): boolean {
  const distance = sweep.counterclockwise
    ? positiveModulo(sweep.startAngle - angle, fullTurn)
    : positiveModulo(angle - sweep.startAngle, fullTurn);
  return distance <= Math.abs(sweep.sweep);
}

function positiveModulo(value: number, divisor: number): number {
  const result = value % divisor;
  if (result === 0) return 0;
  return result < 0 ? result + divisor : result;
}
