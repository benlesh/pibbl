import { PathGeometry, type PathSegment } from './path-geometry.js';
import { TAU } from './path-arc.js';
import { bendSpanBounds, bendSpanPoint, bendSpans, splitBendSpan, type BendBounds, type BendPoint, type BendSpan } from './path-bend-spans.js';
import { measureBendGuide, prepareBendGuide } from './path-bend-guide.js';

export interface PathBendFrame {
  readonly x: number; readonly y: number; readonly width: number; readonly height: number;
}
export interface PathBendArc {
  readonly cx: number; readonly cy: number; readonly radius: number;
  readonly startAngle: number; readonly sweep: number;
}
export type PathBendAlign = 'start' | 'center' | 'end';
export type PathBendBaseline = 'center' | 'top' | 'bottom' | number;
export type PathBendFit = 'none' | 'stretch';
export type PathBendOverflow = 'error' | 'extend' | 'wrap';
export interface PathBendOptions {
  readonly source: PathBendFrame;
  readonly align?: PathBendAlign;
  readonly baseline?: PathBendBaseline;
  readonly fit?: PathBendFit;
  readonly offset?: number;
  readonly normalOffset?: number;
  readonly overflow?: PathBendOverflow;
  readonly tolerance: number;
  readonly maxSegments?: number;
}
export interface BendPathAlongArcOptions extends PathBendOptions { readonly arc: PathBendArc }

// Work limits bound failed certification attempts, not just successful output.
const MAX_WORK = 2_000_000;
const MAX_DEPTH = 52;
interface Placement {
  readonly x: number; readonly baseline: number; readonly normal: number;
  readonly shift: number; readonly scale: number; readonly length: number;
  readonly tolerance: number; readonly maxSegments: number; readonly overflow: PathBendOverflow;
  readonly width: number; readonly fit: PathBendFit; readonly anchor: number; readonly offset: number;
}

/** Bends continuous geometry along an analytic circle; returns independent line geometry. */
export function bendPathAlongArc(source: PathGeometry, options: Readonly<BendPathAlongArcOptions>): PathGeometry {
  if (!(source instanceof PathGeometry)) throw new TypeError('source must be a PathGeometry.');
  object(options, 'options');
  const input = options.arc;
  object(input, 'arc');
  const startAngle = finite(input.startAngle, 'arc.startAngle');
  const arc: PathBendArc = {
    cx: finite(input.cx, 'arc.cx'), cy: finite(input.cy, 'arc.cy'),
    radius: positive(input.radius, 'arc.radius'), startAngle: startAngle % TAU,
    sweep: finite(input.sweep, 'arc.sweep'),
  };
  if (!arc.sweep || Math.abs(arc.sweep) > TAU) throw new RangeError('arc.sweep must be nonzero and at most one revolution.');
  const p = placement(options, positive(arc.radius * Math.abs(arc.sweep), 'guide length'));
  if (p.overflow === 'wrap' && Math.abs(arc.sweep) !== TAU) throw new RangeError('wrap requires a closed guide.');
  const direction = Math.sign(arc.sweep);
  const distance = (x: number) => p.shift + p.scale * (x - p.x);
  const displacement = (y: number) => y - p.baseline + p.normal;
  const map = ([x, y]: BendPoint): BendPoint => {
    const s = finite(distance(x), 'mapped guide distance'), d = finite(displacement(y), 'normal displacement');
    if (p.overflow === 'error' && (s < 0 || s > p.length)) throw new RangeError('Source geometry extends beyond the guide.');
    const onGuide = p.overflow === 'extend' ? Math.max(0, Math.min(p.length, s)) : s;
    const theta = arc.startAngle + direction * ((onGuide / arc.radius) % TAU);
    const cos = Math.cos(theta), sin = Math.sin(theta);
    const radial = arc.radius - direction * d, extension = s - onGuide;
    // Division/modulo can lose the phase of enormous unwrapped angles. Its
    // output effect scales with the displaced radius (not just the guide radius).
    checkPrecision(Math.max(Math.abs(startAngle), Math.abs(onGuide / arc.radius)) * Math.max(Math.abs(radial), Math.abs(extension)), p.tolerance);
    return [
      finite(arc.cx + radial * cos - direction * extension * sin, 'bent x'),
      finite(arc.cy + radial * sin + direction * extension * cos, 'bent y'),
    ];
  };
  const bound = (b: BendBounds): number => {
    const low = distance(b.xmin), high = distance(b.xmax);
    if (p.overflow === 'error' && (low < 0 || high > p.length)) return Infinity;
    const d = Math.max(Math.abs(displacement(b.ymin)), Math.abs(displacement(b.ymax)));
    const dx = p.scale * b.dx, ddx = p.scale * b.ddx;
    if (p.overflow === 'extend') {
      if (high <= 0 || low >= p.length) return Math.hypot(ddx, b.ddy) / 8;
      // The normal is continuous at extension boundaries, but the derivative
      // may jump. A Lipschitz bound remains valid across the boundary.
      if (low < 0 || high > p.length) return (b.dy + (1 + d / arc.radius) * dx) / 2;
    }
    const theta1 = dx / arc.radius, theta2 = ddx / arc.radius;
    const radial = Math.max(Math.abs(arc.radius - direction * displacement(b.ymin)), Math.abs(arc.radius - direction * displacement(b.ymax)));
    // For F = center + rho * unit(theta), ||F''|| <= |rho''|
    // + 2|rho'||theta'| + |rho|(|theta'|² + |theta''|).
    // Linear interpolation on [0,1] has error at most sup ||F''|| / 8.
    return (b.ddy + 2 * b.dy * theta1 + radial * (theta1 * theta1 + theta2)) / 8;
  };
  const scale = Math.max(Math.abs(arc.cx), Math.abs(arc.cy), arc.radius, p.length);
  return approximate(source, p, map, bound, scale);
}

/** Bends geometry by distance along one smooth guide contour. */
export function bendPathAlongPath(source: PathGeometry, guide: PathGeometry, options: Readonly<PathBendOptions>): PathGeometry {
  if (!(source instanceof PathGeometry) || !(guide instanceof PathGeometry)) throw new TypeError('source and guide must be PathGeometry values.');
  object(options, 'options');
  const input = placement(options, 1); // Snapshot options once; guide measurement supplies length later.
  const prepared = prepareBendGuide(guide);
  if (input.overflow === 'wrap' && !prepared.closed) throw new RangeError('wrap requires an explicitly closed guide.');
  let xmin = Infinity, xmax = -Infinity, displacement = 0;
  const normalDistance = (y: number) => y - input.baseline + input.normal;
  for (const item of bendSpans(source)) {
    if (item.type === 'close') continue;
    const b = item.type === 'move' ? { xmin: item.point[0], xmax: item.point[0], ymin: item.point[1], ymax: item.point[1] } : bendSpanBounds(item.span);
    xmin = Math.min(xmin, b.xmin); xmax = Math.max(xmax, b.xmax);
    displacement = Math.max(displacement, Math.abs(normalDistance(b.ymin)), Math.abs(normalDistance(b.ymax)));
  }
  if (xmin === Infinity) xmin = xmax = input.x;
  finite(displacement, 'normal displacement');
  const atLength = (length: number): Placement => {
    const scale = input.fit === 'stretch' ? positive(length / input.width, 'fit scale') : 1;
    return { ...input, length, scale, shift: input.anchor * (length - scale * input.width) + input.offset };
  };
  const distance = (p: Placement, x: number) => p.shift + p.scale * (x - p.x);
  const measured = measureBendGuide(prepared, input.tolerance, displacement, length => {
    const p = atLength(length);
    const sensitivity = input.fit === 'stretch' ? Math.max(Math.abs((xmin - input.x) / input.width), Math.abs((xmax - input.x) / input.width)) : input.anchor;
    const laps = input.overflow === 'wrap' ? Math.ceil(Math.max(Math.abs(distance(p, xmin)), Math.abs(distance(p, xmax))) / length) : 0;
    return finite(2 + sensitivity + laps, 'guide distance sensitivity');
  });
  const p = atLength(measured.length), upper = atLength(measured.length + measured.uncertainty);
  const wrap = p.overflow === 'wrap';
  const rangeCertified = (x: number) => {
    const d = distance(p, x), u = distance(upper, x);
    const roundoff = Number.EPSILON * 64 * Math.max(Math.abs(d), Math.abs(u), p.length);
    return Math.min(d, u) >= -roundoff && Math.min(p.length - d, upper.length - u) >= -roundoff;
  };
  const map = ([x, y]: BendPoint): BendPoint => {
    if (p.overflow === 'error' && !rangeCertified(x)) throw new RangeError('Source geometry exceeds the guide or its range cannot be certified.');
    const field = measured.field(distance(p, x), wrap), d = normalDistance(y);
    return [finite(field.point[0] + d * field.normal[0], 'bent x'), finite(field.point[1] + d * field.normal[1], 'bent y')];
  };
  const bound = (b: BendBounds, span: BendSpan): number => {
    if (p.overflow === 'error' && (!rangeCertified(b.xmin) || !rangeCertified(b.xmax))) return Infinity;
    const s0 = distance(p, bendSpanPoint(span, 0)[0]), s1 = distance(p, bendSpanPoint(span, 1)[0]);
    const d = Math.max(Math.abs(normalDistance(b.ymin)), Math.abs(normalDistance(b.ymax)));
    return measured.chordError(distance(p, b.xmin), distance(p, b.xmax), s0, s1, d, p.scale * b.dx, p.scale * b.ddx, b.dy, b.ddy, wrap);
  };
  return approximate(source, p, map, bound, Math.max(prepared.scale, p.length));
}

function approximate(source: PathGeometry, p: Placement, map: (point: BendPoint) => BendPoint, bound: (bounds: BendBounds, span: BendSpan) => number, scale: number): PathGeometry {
  const output: PathSegment[] = [];
  let work = 0;
  const add = (segment: PathSegment) => {
    if (output.length >= p.maxSegments) throw new RangeError('Path bending exceeds maxSegments.');
    output.push(segment);
  };
  for (const item of bendSpans(source)) {
    if (item.type === 'move') {
      const [x, y] = map(item.point);
      checkPrecision(Math.max(scale, Math.abs(x), Math.abs(y), ...item.point.map(Math.abs)), p.tolerance);
      add({ type: 'move', x, y });
    } else if (item.type === 'close') {
      add({ type: 'close' });
    } else {
      const stack: Array<readonly [BendSpan, number]> = [[item.span, 0]];
      while (stack.length) {
        if (++work > MAX_WORK) throw new RangeError('Path bending exceeded its work budget.');
        const [span, depth] = stack.pop()!;
        const b = bendSpanBounds(span);
        const end = map(bendSpanPoint(span, 1));
        map(bendSpanPoint(span, 0));
        const roundoff = checkPrecision(Math.max(scale, Math.abs(b.xmin), Math.abs(b.xmax), Math.abs(b.ymin), Math.abs(b.ymax), ...end.map(Math.abs)), p.tolerance);
        const error = bound(b, span);
        if (Number.isFinite(error) && error + roundoff <= p.tolerance) {
          add({ type: 'line', x: end[0], y: end[1] });
          continue;
        }
        if (depth >= MAX_DEPTH) throw new RangeError('Path bending cannot certify tolerance or guide range due to numerical nonprogress.');
        const [left, right] = splitBendSpan(span);
        stack.push([right, depth + 1], [left, depth + 1]);
      }
    }
  }
  const result = new PathGeometry();
  if (output.length) result.spliceSegments(0, 0, output);
  return result;
}

function placement(options: Readonly<PathBendOptions>, length: number): Placement {
  const frame = options.source;
  object(frame, 'source frame');
  const x = finite(frame.x, 'source.x'), y = finite(frame.y, 'source.y');
  const width = positive(frame.width, 'source.width'), height = finite(frame.height, 'source.height');
  if (height < 0) throw new RangeError('source.height must be nonnegative.');
  const align = option(options.align, ['start', 'center', 'end'], 'start', 'align');
  const fit = option(options.fit, ['none', 'stretch'], 'none', 'fit');
  const overflow = option(options.overflow, ['error', 'extend', 'wrap'], 'error', 'overflow');
  const rawBaseline = options.baseline;
  const inputBaseline = rawBaseline === undefined ? 'center' : rawBaseline;
  const baseline = typeof inputBaseline === 'number' ? finite(inputBaseline, 'baseline')
    : y + height * ({ top: 0, center: 0.5, bottom: 1 }[option(inputBaseline, ['top', 'center', 'bottom'], 'center', 'baseline')]);
  const scale = fit === 'stretch' ? positive(length / width, 'fit scale') : 1;
  const rawOffset = options.offset, rawNormal = options.normalOffset, rawMaxSegments = options.maxSegments;
  const anchor = { start: 0, center: 0.5, end: 1 }[align], offset = finite(rawOffset === undefined ? 0 : rawOffset, 'offset');
  const shift = finite(anchor * (length - scale * width) + offset, 'alignment');
  const maxSegments = rawMaxSegments === undefined ? 1_000_000 : rawMaxSegments;
  if (!Number.isSafeInteger(maxSegments) || maxSegments <= 0) throw new RangeError('maxSegments must be a positive safe integer.');
  return {
    x, width, fit, anchor, offset, baseline: finite(baseline, 'resolved baseline'), normal: finite(rawNormal === undefined ? 0 : rawNormal, 'normalOffset'),
    shift, scale, length, tolerance: positive(options.tolerance, 'tolerance'), maxSegments, overflow,
  };
}
function checkPrecision(scale: number, tolerance: number): number {
  const roundoff = scale * Number.EPSILON * 64;
  if (!Number.isFinite(roundoff) || roundoff >= tolerance / 4) throw new RangeError('Path bending cannot certify tolerance at this coordinate scale.');
  return roundoff;
}
function object(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') throw new TypeError(`${name} must be an object.`);
}
function finite(value: number, name: string): number {
  if (typeof value !== 'number') throw new TypeError(`${name} must be a number.`);
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite.`);
  return value;
}
function positive(value: number, name: string): number {
  finite(value, name);
  if (value <= 0) throw new RangeError(`${name} must be positive.`);
  return value;
}
function option<T extends string>(value: T | undefined, allowed: readonly T[], fallback: T, name: string): T {
  const resolved = value === undefined ? fallback : value;
  if (!allowed.includes(resolved)) throw new TypeError(`Invalid path bending ${name}.`);
  return resolved;
}
