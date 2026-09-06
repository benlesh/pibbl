import type { LayoutBox } from '../layout/types.js';

const fullTurn = Math.PI * 2;

export interface CircularSweep {
  readonly startAngle: number;
  readonly endAngle: number;
  readonly sweep: number;
  readonly counterclockwise: boolean;
  readonly fullCircle: boolean;
}

export function resolveCircularSweep(
  startAngle: number,
  endAngle: number,
  counterclockwise: boolean,
): CircularSweep {
  const fullCircle = counterclockwise
    ? startAngle - endAngle >= Math.PI * 2
    : endAngle - startAngle >= Math.PI * 2;
  let sweep: number;
  if (fullCircle) {
    sweep = counterclockwise ? -fullTurn : fullTurn;
  } else if (counterclockwise) {
    const distance = positiveModulo(startAngle - endAngle, fullTurn);
    sweep = distance === 0 ? 0 : -distance;
  } else {
    sweep = positiveModulo(endAngle - startAngle, fullTurn);
  }

  return {
    startAngle,
    endAngle: startAngle + sweep,
    sweep,
    counterclockwise,
    fullCircle,
  };
}

export function createArcPath(
  cx: number,
  cy: number,
  radius: number,
  sweep: Readonly<CircularSweep>,
): Path2D {
  const path = new Path2D();
  if (radius > 0 && sweep.sweep !== 0) {
    path.arc(
      cx,
      cy,
      radius,
      sweep.startAngle,
      sweep.endAngle,
      sweep.counterclockwise,
    );
  }
  return path;
}

export function createWedgePath(
  cx: number,
  cy: number,
  radius: number,
  sweep: Readonly<CircularSweep>,
): Path2D {
  const path = new Path2D();
  if (radius <= 0 || sweep.sweep === 0) return path;

  if (!sweep.fullCircle) {
    path.moveTo(cx, cy);
    path.lineTo(
      cx + radius * Math.cos(sweep.startAngle),
      cy + radius * Math.sin(sweep.startAngle),
    );
  }
  path.arc(
    cx,
    cy,
    radius,
    sweep.startAngle,
    sweep.endAngle,
    sweep.counterclockwise,
  );
  path.closePath();
  return path;
}

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
  const xs = angles.map(angle => cx + radius * Math.cos(angle));
  const ys = angles.map(angle => cy + radius * Math.sin(angle));
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

function containsAngle(
  sweep: Readonly<CircularSweep>,
  angle: number,
): boolean {
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
