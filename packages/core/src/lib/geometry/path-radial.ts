import { PathGeometry } from './path-geometry.js';
import { simplifyPath, type SimplifyPathOptions } from './path-utilities.js';

type Point = readonly [number, number];

/**
 * Simplifies line-only paths with a radial-distance prepass followed by the
 * default Douglas--Peucker implementation. Each stage receives half of the
 * requested error budget, so their errors compose within `tolerance`.
 *
 * @param path - Source geometry; it is not modified. See {@link PathGeometry}.
 * @param options - Simplification tolerance and work limits. See {@link SimplifyPathOptions}.
 * @returns Independent geometry with redundant line vertices removed. See {@link PathGeometry}.
 *
 * @see {@link PathGeometry}
 * @see {@link SimplifyPathOptions}
 */
export function simplifyPathRadial(path: PathGeometry, options: Readonly<SimplifyPathOptions>): PathGeometry {
  const tolerance = requiredPositive(options.tolerance, 'tolerance');
  const stageTolerance = tolerance / 2;
  // A two-stage split cannot represent half of the smallest subnormal number
  // without exceeding the caller's error budget. Retain the exact default
  // contract in that case instead of applying the radial prepass.
  if (stageTolerance === 0) return simplifyPath(path, options);
  const filtered = new PathGeometry();
  let current: Point | undefined;
  let start: Point | undefined;
  let run: Point[] = [];
  const flushOpen = () => {
    if (!run.length) return;
    appendOpen(filtered, radialFilterOpen(run, stageTolerance));
    run = current ? [current] : [];
  };
  for (const segment of path) {
    switch (segment.type) {
      case 'move':
        flushOpen();
        current = start = [segment.x, segment.y];
        run = [current];
        filtered.moveTo(segment.x, segment.y);
        break;
      case 'line':
        current = [segment.x, segment.y];
        run.push(current);
        break;
      case 'close': {
        if (!current || !start) throw new TypeError('simplifyPathRadial requires a move segment before close.');
        const raw = withoutClosingDuplicate(run);
        const radial = radialFilterClosed(raw, stageTolerance);
        // Do not make a valid closed subpath degenerate. The raw path is an
        // exact fallback, and the shared DP stage will enforce the same rule.
        appendOpen(filtered, radial.length >= 3 && hasThreeDistinct(radial) ? radial : raw);
        filtered.closePath();
        current = start;
        run = [current];
        break;
      }
      default: throw new TypeError('simplifyPathRadial requires line-only geometry.');
    }
  }
  flushOpen();
  return simplifyPath(filtered, { tolerance: stageTolerance, maxSegments: options.maxSegments });
}

function appendOpen(path: PathGeometry, points: readonly Point[]): void {
  for (const [x, y] of points.slice(1)) path.lineTo(x, y);
}

function radialFilterOpen(points: readonly Point[], tolerance: number): Point[] {
  if (points.length <= 2) return [...points];
  const result: Point[] = [points[0]];
  let previous = points[0];
  for (let i = 1; i < points.length - 1; i++) {
    if (distance(points[i], previous) > tolerance) {
      result.push(points[i]);
      previous = points[i];
    }
  }
  const last = points.at(-1)!;
  if (!samePoint(previous, last)) result.push(last);
  return result;
}

function radialFilterClosed(points: readonly Point[], tolerance: number): Point[] {
  if (points.length <= 3) return [...points];
  const result: Point[] = [points[0]];
  let previous = points[0];
  for (let i = 1; i < points.length; i++) {
    if (distance(points[i], previous) > tolerance) {
      result.push(points[i]);
      previous = points[i];
    }
  }
  return result;
}

function withoutClosingDuplicate(points: readonly Point[]): Point[] {
  return points.length > 1 && samePoint(points[0], points.at(-1)!) ? points.slice(0, -1) : [...points];
}
function hasThreeDistinct(points: readonly Point[]): boolean {
  let first: Point | undefined;
  let second: Point | undefined;
  for (const point of points) {
    if (!first) { first = point; continue; }
    if (samePoint(point, first)) continue;
    if (!second) { second = point; continue; }
    if (!samePoint(point, second)) return true;
  }
  return false;
}
function requiredPositive(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be a finite positive number.`);
  return value;
}
function samePoint(a: Point, b: Point): boolean { return a[0] === b[0] && a[1] === b[1]; }
function distance(a: Point, b: Point): number { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
