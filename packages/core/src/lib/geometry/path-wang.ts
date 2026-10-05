import { arcPoint, type ArcSegment } from './path-arc.js';
import { PathGeometry, type PathSegment } from './path-geometry.js';
import type { FlattenPathOptions } from './path-utilities.js';

const DEFAULT_MAX_SEGMENTS = 1_000_000;

type Point = readonly [number, number];

/**
 * Flattens curves with Wang's uniform-parameter bound.
 *
 * This trades adaptive placement for a known output count and independent point
 * evaluation. It is most useful when predictable allocation or parallel output
 * generation matters more than minimizing the number of line segments.
 *
 * @param path - Source geometry; it is not modified. See {@link PathGeometry}.
 * @param options - Maximum approximation error and flattening work limits. See
 * {@link FlattenPathOptions} .
 * @returns Independent geometry with curves replaced by line segments. See {@link PathGeometry}.
 *
 * @see {@link PathGeometry}
 * @see {@link FlattenPathOptions}
 */
export function flattenPathWang(path: PathGeometry, options: Readonly<FlattenPathOptions>): PathGeometry {
  const tolerance = requiredPositive(options.tolerance, 'tolerance');
  const output = collector(options.maxSegments);
  let current: Point = [0, 0];
  let start: Point = [0, 0];
  for (const segment of path) {
    switch (segment.type) {
      case 'move': current = start = [segment.x, segment.y]; output.add(segment); break;
      case 'line': current = [segment.x, segment.y]; output.add(segment); break;
      case 'close': current = start; output.add(segment); break;
      case 'quadratic': {
        const end: Point = [segment.x, segment.y];
        flattenQuadratic(current, [segment.cpx, segment.cpy], end, tolerance, output);
        current = end;
        break;
      }
      case 'cubic': {
        const end: Point = [segment.x, segment.y];
        flattenCubic(current, [segment.cp1x, segment.cp1y], [segment.cp2x, segment.cp2y], end, tolerance, output);
        current = end;
        break;
      }
      case 'arc': {
        const arcStart = arcPoint(segment, segment.startAngle);
        if (!samePoint(current, arcStart)) output.add(line(arcStart));
        flattenArc(segment, tolerance, output);
        current = arcPoint(segment, segment.startAngle + segment.sweep);
        break;
      }
    }
  }
  return output.finish();
}

function flattenQuadratic(a: Point, b: Point, c: Point, tolerance: number, output: ReturnType<typeof collector>): void {
  const n = segmentsForSecondDifference(secondDifference(a, b, c), 2, tolerance);
  output.reserve(n);
  for (let i = 1; i <= n; i++) output.add(line(i === n ? c : evaluateQuadratic(a, b, c, i / n)));
}

function flattenCubic(a: Point, b: Point, c: Point, d: Point, tolerance: number, output: ReturnType<typeof collector>): void {
  const n = Math.max(
    segmentsForSecondDifference(secondDifference(a, b, c), 3, tolerance),
    segmentsForSecondDifference(secondDifference(b, c, d), 3, tolerance),
  );
  output.reserve(n);
  for (let i = 1; i <= n; i++) output.add(line(i === n ? d : evaluateCubic(a, b, c, d, i / n)));
}

function flattenArc(arc: ArcSegment, tolerance: number, output: ReturnType<typeof collector>): void {
  const stretch = operatorNorm(arc.ux, arc.uy, arc.vx, arc.vy);
  if (!Number.isFinite(stretch)) throw new RangeError('flattenPathWang arc calculation overflowed.');
  if (stretch === 0 || arc.sweep === 0) {
    output.add(line(arcPoint(arc, arc.startAngle + arc.sweep)));
    return;
  }
  // The image of a unit-circle chord deviates by no more than its sagitta times
  // the affine basis' maximum stretch. Restricting each span to pi also handles
  // complete turns and finite chord distances conservatively.
  const ratio = Math.min(1, tolerance / stretch);
  // 1 - cos(x) loses useful precision for small tolerances. The equivalent
  // sagitta form remains stable: 2 sin^2(span / 4) <= tolerance / stretch.
  const span = Math.min(Math.PI, 4 * Math.asin(Math.sqrt(ratio / 2)));
  const n = checkedSegments(Math.ceil(Math.abs(arc.sweep) / span));
  output.reserve(n);
  for (let i = 1; i <= n; i++) output.add(line(arcPoint(arc, i === n ? arc.startAngle + arc.sweep : arc.startAngle + arc.sweep * i / n)));
}

function segmentsForSecondDifference(difference: Point, degree: 2 | 3, tolerance: number): number {
  // Wang's formula: sqrt(|second difference| * n(n - 1) / (8 * tolerance)).
  const length = Math.hypot(difference[0], difference[1]);
  if (!Number.isFinite(length)) throw new RangeError('flattenPathWang curve calculation overflowed.');
  return checkedSegments(Math.max(1, Math.ceil(Math.sqrt(length * degree * (degree - 1) / (8 * tolerance)))));
}

function evaluateQuadratic(a: Point, b: Point, c: Point, t: number): Point {
  const ab = interpolate(a, b, t), bc = interpolate(b, c, t);
  return interpolate(ab, bc, t);
}

function evaluateCubic(a: Point, b: Point, c: Point, d: Point, t: number): Point {
  const ab = interpolate(a, b, t), bc = interpolate(b, c, t), cd = interpolate(c, d, t);
  return interpolate(interpolate(ab, bc, t), interpolate(bc, cd, t), t);
}

function secondDifference(a: Point, b: Point, c: Point): Point {
  return [a[0] - 2 * b[0] + c[0], a[1] - 2 * b[1] + c[1]];
}

function operatorNorm(ux: number, uy: number, vx: number, vy: number): number {
  const scale = Math.max(Math.abs(ux), Math.abs(uy), Math.abs(vx), Math.abs(vy));
  if (scale === 0) return 0;
  const a = ux / scale, b = uy / scale, c = vx / scale, d = vy / scale;
  return scale * Math.sqrt((a * a + b * b + c * c + d * d + Math.hypot(a * a + c * c - b * b - d * d, 2 * (a * b + c * d))) / 2);
}

function collector(maxSegments: number | undefined) {
  const limit = maxSegments === undefined ? DEFAULT_MAX_SEGMENTS : requiredInteger(maxSegments, 'maxSegments');
  const segments: PathSegment[] = [];
  return {
    reserve(count: number) {
      if (segments.length + count > limit) throw new RangeError('Path utility output exceeds maxSegments.');
    },
    add(segment: PathSegment) {
      if (segments.length >= limit) throw new RangeError('Path utility output exceeds maxSegments.');
      segments.push(segment);
    },
    finish() {
      const output = new PathGeometry();
      if (segments.length) output.spliceSegments(0, 0, segments);
      return output;
    },
  };
}

function checkedSegments(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new RangeError('flattenPathWang cannot satisfy tolerance due to numerical nonprogress.');
  return value;
}
function requiredPositive(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be a finite positive number.`);
  return value;
}
function requiredInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new RangeError(`${name} must be a positive integer.`);
  return value;
}
function line([x, y]: Point): PathSegment { return { type: 'line', x, y }; }
function interpolate(a: Point, b: Point, t: number): Point { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
function samePoint(a: Point, b: Point): boolean { return a[0] === b[0] && a[1] === b[1]; }
