import { arcPoint, TAU, type ArcSegment } from './path-arc.js';
import { PathGeometry, type PathSegment } from './path-geometry.js';

const DEFAULT_MAX_SEGMENTS = 1_000_000;

export interface FlattenPathOptions {
  readonly tolerance: number;
  readonly maxSegments?: number;
}

export interface SimplifyPathOptions {
  readonly tolerance: number;
  readonly maxSegments?: number;
}

export interface SubdividePathOptions {
  readonly divisions: number;
  readonly maxSegments?: number;
}

type Point = readonly [number, number];

export function flattenPath(path: PathGeometry, options: Readonly<FlattenPathOptions>): PathGeometry {
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

export function subdividePath(path: PathGeometry, options: Readonly<SubdividePathOptions>): PathGeometry {
  const divisions = requiredInteger(options.divisions, 'divisions');
  const output = collector(options.maxSegments);
  let current: Point = [0, 0];
  let start: Point = [0, 0];
  for (const segment of path) {
    switch (segment.type) {
      case 'move': current = start = [segment.x, segment.y]; output.add(segment); break;
      case 'line': {
        const end: Point = [segment.x, segment.y];
        subdivideLine(current, end, divisions, output);
        current = end;
        break;
      }
      case 'quadratic': {
        const end: Point = [segment.x, segment.y];
        subdivideQuadratic(current, [segment.cpx, segment.cpy], end, divisions, output);
        current = end;
        break;
      }
      case 'cubic': {
        const end: Point = [segment.x, segment.y];
        subdivideCubic(current, [segment.cp1x, segment.cp1y], [segment.cp2x, segment.cp2y], end, divisions, output);
        current = end;
        break;
      }
      case 'arc': {
        const arcStart = arcPoint(segment, segment.startAngle);
        if (!samePoint(current, arcStart)) output.add(line(arcStart));
        for (let i = 0; i < divisions; i++) {
          output.add({ ...segment, startAngle: normalizeAngle(segment.startAngle + segment.sweep * i / divisions), sweep: segment.sweep / divisions });
        }
        current = arcPoint(segment, segment.startAngle + segment.sweep);
        break;
      }
      case 'close':
        if (!samePoint(current, start)) subdivideLine(current, start, divisions, output);
        current = start;
        output.add(segment);
        break;
    }
  }
  return output.finish();
}

export function simplifyPath(path: PathGeometry, options: Readonly<SimplifyPathOptions>): PathGeometry {
  const tolerance = requiredPositive(options.tolerance, 'tolerance');
  const output = collector(options.maxSegments);
  let current: Point | undefined;
  let start: Point | undefined;
  let run: Point[] = [];
  const flushOpen = () => {
    if (!run.length) return;
    for (const point of simplifyOpen(run, tolerance).slice(1)) output.add(line(point));
    run = current ? [current] : [];
  };
  for (const segment of path) {
    switch (segment.type) {
      case 'move':
        flushOpen();
        current = start = [segment.x, segment.y];
        run = [current];
        output.add(segment);
        break;
      case 'line':
        current = [segment.x, segment.y];
        run.push(current);
        break;
      case 'close': {
        if (!current || !start) throw new TypeError('simplifyPath requires a move segment before close.');
        const simplified = simplifyClosed(withoutClosingDuplicate(run), tolerance);
        for (const point of simplified.slice(1)) output.add(line(point));
        output.add(segment);
        current = start;
        run = [current];
        break;
      }
      default: throw new TypeError('simplifyPath requires line-only geometry.');
    }
  }
  flushOpen();
  return output.finish();
}

function collector(maxSegments: number | undefined) {
  const limit = maxSegments === undefined ? DEFAULT_MAX_SEGMENTS : requiredInteger(maxSegments, 'maxSegments');
  const segments: PathSegment[] = [];
  return {
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

function requiredPositive(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be a finite positive number.`);
  return value;
}

function requiredInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new RangeError(`${name} must be a positive integer.`);
  return value;
}

function flattenQuadratic(a: Point, b: Point, c: Point, tolerance: number, output: ReturnType<typeof collector>): void {
  const stack: Array<readonly [Point, Point, Point, number]> = [[a, b, c, 0]];
  while (stack.length) {
    const [p0, p1, p2, depth] = stack.pop()!;
    if (pointSegmentDistance(p1, p0, p2) <= tolerance) { output.add(line(p2)); continue; }
    if (depth >= 60) throw new RangeError('flattenPath cannot satisfy tolerance due to numerical nonprogress.');
    const p01 = midpoint(p0, p1), p12 = midpoint(p1, p2), p = midpoint(p01, p12);
    stack.push([p, p12, p2, depth + 1], [p0, p01, p, depth + 1]);
  }
}

function flattenCubic(a: Point, b: Point, c: Point, d: Point, tolerance: number, output: ReturnType<typeof collector>): void {
  const stack: Array<readonly [Point, Point, Point, Point, number]> = [[a, b, c, d, 0]];
  while (stack.length) {
    const [p0, p1, p2, p3, depth] = stack.pop()!;
    if (Math.max(pointSegmentDistance(p1, p0, p3), pointSegmentDistance(p2, p0, p3)) <= tolerance) { output.add(line(p3)); continue; }
    if (depth >= 60) throw new RangeError('flattenPath cannot satisfy tolerance due to numerical nonprogress.');
    const p01 = midpoint(p0, p1), p12 = midpoint(p1, p2), p23 = midpoint(p2, p3);
    const p012 = midpoint(p01, p12), p123 = midpoint(p12, p23), p = midpoint(p012, p123);
    stack.push([p, p123, p23, p3, depth + 1], [p0, p01, p012, p, depth + 1]);
  }
}

function flattenArc(arc: ArcSegment, tolerance: number, output: ReturnType<typeof collector>): void {
  const radius = Math.hypot(arc.ux, arc.uy, arc.vx, arc.vy);
  const stack: Array<readonly [number, number, number]> = [[arc.startAngle, arc.startAngle + arc.sweep, 0]];
  while (stack.length) {
    const [from, to, depth] = stack.pop()!;
    const middle = (from + to) / 2;
    const a = arcPoint(arc, from), b = arcPoint(arc, to);
    const sampled = Math.max(
      pointSegmentDistance(arcPoint(arc, from + (to - from) / 4), a, b),
      pointSegmentDistance(arcPoint(arc, middle), a, b),
      pointSegmentDistance(arcPoint(arc, to - (to - from) / 4), a, b),
    );
    const bound = radius * (to - from) ** 2 / 8;
    if (sampled <= tolerance && bound <= tolerance) { output.add(line(b)); continue; }
    if (depth >= 60 || middle === from || middle === to) throw new RangeError('flattenPath cannot satisfy tolerance due to numerical nonprogress.');
    stack.push([middle, to, depth + 1], [from, middle, depth + 1]);
  }
}

function subdivideLine(a: Point, b: Point, divisions: number, output: ReturnType<typeof collector>) {
  for (let i = 1; i <= divisions; i++) output.add(line(interpolate(a, b, i / divisions)));
}

function subdivideQuadratic(a: Point, b: Point, c: Point, divisions: number, output: ReturnType<typeof collector>) {
  let rest: readonly [Point, Point, Point] = [a, b, c];
  for (let i = divisions; i > 1; i--) {
    const [left, right] = splitQuadratic(...rest, 1 / i);
    output.add({ type: 'quadratic', cpx: left[1][0], cpy: left[1][1], x: left[2][0], y: left[2][1] });
    rest = right;
  }
  output.add({ type: 'quadratic', cpx: rest[1][0], cpy: rest[1][1], x: rest[2][0], y: rest[2][1] });
}

function subdivideCubic(a: Point, b: Point, c: Point, d: Point, divisions: number, output: ReturnType<typeof collector>) {
  let rest: readonly [Point, Point, Point, Point] = [a, b, c, d];
  for (let i = divisions; i > 1; i--) {
    const [left, right] = splitCubic(...rest, 1 / i);
    output.add({ type: 'cubic', cp1x: left[1][0], cp1y: left[1][1], cp2x: left[2][0], cp2y: left[2][1], x: left[3][0], y: left[3][1] });
    rest = right;
  }
  output.add({ type: 'cubic', cp1x: rest[1][0], cp1y: rest[1][1], cp2x: rest[2][0], cp2y: rest[2][1], x: rest[3][0], y: rest[3][1] });
}

function simplifyOpen(points: readonly Point[], tolerance: number): Point[] {
  if (points.length <= 2) return [...points];
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: Array<readonly [number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let index = -1, maximum = tolerance;
    for (let i = first + 1; i < last; i++) {
      const distance = pointSegmentDistance(points[i], points[first], points[last]);
      if (distance > maximum) { maximum = distance; index = i; }
    }
    if (index !== -1) { keep[index] = 1; stack.push([first, index], [index, last]); }
  }
  const result: Point[] = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) result.push(points[i]);
  return result;
}

function simplifyClosed(points: readonly Point[], tolerance: number): Point[] {
  if (points.length <= 3 || !hasThreeDistinct(points)) return [...points];
  const [firstAnchor, secondAnchor] = closedAnchors(points);
  const first = simplifyOpen(points.slice(0, firstAnchor + 1), tolerance);
  const second = simplifyOpen(points.slice(firstAnchor, secondAnchor + 1), tolerance);
  const third = simplifyOpen([...points.slice(secondAnchor), points[0]], tolerance);
  return [...first, ...second.slice(1), ...third.slice(1, -1)];
}

function closedAnchors(points: readonly Point[]): readonly [number, number] {
  let farthest = 1, farthestDistance = -1;
  for (let i = 1; i < points.length; i++) {
    const distance = squaredDistance(points[0], points[i]);
    if (distance > farthestDistance) { farthestDistance = distance; farthest = i; }
  }
  let third = -1, thirdDistance = -1;
  for (let i = 1; i < points.length; i++) {
    if (i === farthest || samePoint(points[i], points[0]) || samePoint(points[i], points[farthest])) continue;
    const distance = pointSegmentDistance(points[i], points[0], points[farthest]);
    if (distance > thirdDistance) { thirdDistance = distance; third = i; }
  }
  const [firstAnchor, secondAnchor] = [farthest, third].sort((a, b) => a - b);
  return [firstAnchor, secondAnchor];
}

function withoutClosingDuplicate(points: readonly Point[]): Point[] {
  return points.length > 1 && samePoint(points[0], points.at(-1)!) ? points.slice(0, -1) : [...points];
}
function hasThreeDistinct(points: readonly Point[]): boolean {
  const first = points[0];
  let second: Point | undefined;
  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    if (samePoint(point, first)) continue;
    if (!second) second = point;
    else if (!samePoint(point, second)) return true;
  }
  return false;
}
function splitQuadratic(a: Point, b: Point, c: Point, t: number): readonly [readonly [Point, Point, Point], readonly [Point, Point, Point]] {
  const ab = interpolate(a, b, t), bc = interpolate(b, c, t), p = interpolate(ab, bc, t);
  return [[a, ab, p], [p, bc, c]];
}
function splitCubic(a: Point, b: Point, c: Point, d: Point, t: number): readonly [readonly [Point, Point, Point, Point], readonly [Point, Point, Point, Point]] {
  const ab = interpolate(a, b, t), bc = interpolate(b, c, t), cd = interpolate(c, d, t);
  const abc = interpolate(ab, bc, t), bcd = interpolate(bc, cd, t), p = interpolate(abc, bcd, t);
  return [[a, ab, abc, p], [p, bcd, cd, d]];
}
function line([x, y]: Point): PathSegment { return { type: 'line', x, y }; }
function midpoint(a: Point, b: Point): Point { return interpolate(a, b, 0.5); }
function interpolate(a: Point, b: Point, t: number): Point { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
function squaredDistance(a: Point, b: Point): number { const x = a[0] - b[0], y = a[1] - b[1]; return x * x + y * y; }
function samePoint(a: Point, b: Point): boolean { return a[0] === b[0] && a[1] === b[1]; }
function pointSegmentDistance(point: Point, a: Point, b: Point): number {
  const x = b[0] - a[0], y = b[1] - a[1], length = x * x + y * y;
  if (length === 0) return Math.hypot(point[0] - a[0], point[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * x + (point[1] - a[1]) * y) / length));
  return Math.hypot(point[0] - (a[0] + x * t), point[1] - (a[1] + y * t));
}
function normalizeAngle(angle: number): number { const normalized = angle % TAU; return Object.is(normalized, -0) ? 0 : normalized; }
