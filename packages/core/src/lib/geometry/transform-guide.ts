import { PathGeometry } from './path-geometry.js';
import {
  bendSpans,
  bendSpanPoint,
  bendSpanBounds,
  splitBendSpan,
  type BendSpan,
  type BendPoint,
} from './path-bend-spans.js';
import {
  type Jet,
  type Pair,
  type Interval,
  mulI,
  addI,
  interval,
} from './transform-math.js';

export interface PathGuideStation {
  readonly at: number;
  readonly distance: number;
}
export interface PathGuideOptions {
  readonly path: PathGeometry;
  readonly reverse?: boolean;
  readonly stations?: readonly PathGuideStation[];
}
export type PathGuide = PathGeometry | PathGuideOptions;
export interface GuideSnapshot {
  readonly spans: readonly BendSpan[];
  readonly reverse: boolean;
  readonly stations: readonly PathGuideStation[];
}
export interface SampledGuide {
  readonly error: number;
  readonly length: number;
  evaluate(t: Jet): Pair;
}
export function snapshotGuide(input: PathGuide): GuideSnapshot {
  const options = input instanceof PathGeometry ? { path: input } : input;
  if (!(options?.path instanceof PathGeometry))
    throw new TypeError('A guide requires PathGeometry.');
  if (options.reverse !== undefined && typeof options.reverse !== 'boolean')
    throw new TypeError('reverse must be boolean.');
  const spans: BendSpan[] = [];
  let moves = 0;
  for (const item of bendSpans(options.path)) {
    if (item.type === 'move') moves++;
    else if (item.type === 'close')
      throw new RangeError('A guide must be one open contour.');
    else spans.push(item.span);
  }
  if (moves !== 1 || !spans.length)
    throw new RangeError('A guide must be one nonempty open contour.');
  const stations = (
    options.stations ?? [
      { at: 0, distance: 0 },
      { at: 1, distance: 1 },
    ]
  ).map((s) => ({ at: s.at, distance: s.distance }));
  if (
    stations.length < 2 ||
    stations[0].at !== 0 ||
    stations[0].distance !== 0 ||
    stations.at(-1)!.at !== 1 ||
    stations.at(-1)!.distance !== 1 ||
    stations.some(
      (s, i) =>
        !Number.isFinite(s.at) ||
        !Number.isFinite(s.distance) ||
        (i > 0 &&
          (s.at <= stations[i - 1].at ||
            s.distance <= stations[i - 1].distance)),
    )
  ) {
    throw new RangeError(
      'Guide stations must strictly increase from (0,0) to (1,1).',
    );
  }
  return { spans, reverse: options.reverse ?? false, stations };
}

interface Leaf {
  span: BendSpan;
  a: BendPoint;
  b: BendPoint;
  chord: number;
  gap: number;
  sag: number;
}
function leaf(span: BendSpan): Leaf {
  const a = bendSpanPoint(span, 0),
    b = bendSpanPoint(span, 1),
    chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
  let upper: number;
  if ('points' in span)
    upper = span.points
      .slice(1)
      .reduce(
        (n, p, i) =>
          n + Math.hypot(p[0] - span.points[i][0], p[1] - span.points[i][1]),
        0,
      );
  else {
    const arc = span.arc,
      mid = arc.startAngle + arc.sweep / 2;
    const speed =
      Math.abs(arc.sweep) *
      Math.hypot(
        -arc.ux * Math.sin(mid) + arc.vx * Math.cos(mid),
        -arc.uy * Math.sin(mid) + arc.vy * Math.cos(mid),
      );
    const bounds = bendSpanBounds(span);
    upper = speed + Math.hypot(bounds.ddx, bounds.ddy) / 4;
  }
  const gap = Math.max(0, upper - chord);
  // Every point lies in the ellipse with these endpoints and total distance <= upper.
  const sag = Math.sqrt(gap * (upper + chord)) / 2;
  return { span, a, b, chord, gap, sag };
}

export function sampleGuide(
  snapshot: GuideSnapshot,
  accuracy: number,
): SampledGuide {
  let leaves = snapshot.spans.map(leaf);
  let gap: number, sag: number;
  for (let depth = 0; ; depth++) {
    gap = leaves.reduce((sum, p) => sum + p.gap, 0);
    sag = leaves.reduce((max, p) => Math.max(max, p.sag), 0);
    if (sag + 3 * gap <= accuracy) break;
    if (depth >= 30 || leaves.length > 32768)
      throw new RangeError('Guide approximation exceeded its work limit.');
    const share = accuracy / (12 * leaves.length);
    leaves = leaves.flatMap((p) =>
      p.gap > share || p.sag > accuracy / 4
        ? splitBendSpan(p.span).map(leaf)
        : [p],
    );
  }
  const length = leaves.reduce((sum, p) => sum + p.chord, 0);
  if (!(length > 0) || !Number.isFinite(length))
    throw new RangeError('Guide length must be finite and nonzero.');
  let distance = 0;
  const points: BendPoint[] = [leaves[0].a],
    knots = [0];
  for (const p of leaves) {
    if (!p.chord) continue;
    distance += p.chord;
    points.push(p.b);
    knots.push(distance / length);
  }
  knots[knots.length - 1] = 1;
  if (snapshot.reverse) {
    points.reverse();
    knots.reverse();
    for (let i = 0; i < knots.length; i++) knots[i] = 1 - knots[i];
  }
  const stations = snapshot.stations;
  const remap = (d: number) => {
    let i = 0;
    while (i < stations.length - 2 && d > stations[i + 1].distance) i++;
    const a = stations[i],
      b = stations[i + 1];
    return (
      a.at + ((d - a.distance) * (b.at - a.at)) / (b.distance - a.distance)
    );
  };
  // Include correspondence breaks, not just geometric polyline vertices.
  const parameters = [...knots.map(remap), ...stations.map((s) => s.at)]
    .sort((a, b) => a - b)
    .filter((v, i, a) => !i || v !== a[i - 1]);
  const values = parameters.map((t) => {
    let j = 0;
    while (j < stations.length - 2 && t > stations[j + 1].at) j++;
    const a = stations[j],
      b = stations[j + 1];
    const d =
      a.distance + ((t - a.at) * (b.distance - a.distance)) / (b.at - a.at);
    const i = locate(knots, d),
      f = (d - knots[i]) / (knots[i + 1] - knots[i]);
    return [
      points[i][0] + (points[i + 1][0] - points[i][0]) * f,
      points[i][1] + (points[i + 1][1] - points[i][1]) * f,
    ] as BendPoint;
  });
  return {
    error: sag + 3 * gap,
    length,
    evaluate: (t) => evaluatePolyline(parameters, values, t),
  };
}
function locate(knots: readonly number[], t: number): number {
  let lo = 0,
    hi = knots.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1;
    if (knots[mid] <= t) lo = mid;
    else hi = mid;
  }
  return Math.min(lo, knots.length - 2);
}
export function evaluatePolyline(
  knots: readonly number[],
  points: readonly BendPoint[],
  t: Jet,
): Pair {
  const first = locate(knots, t.v[0]),
    last = locate(knots, t.v[1]);
  return [0, 1].map((axis) => {
    let low = Infinity,
      high = -Infinity,
      slopeLow = Infinity,
      slopeHigh = -Infinity;
    for (let i = first; i <= last; i++) {
      const slope =
        (points[i + 1][axis] - points[i][axis]) / (knots[i + 1] - knots[i]);
      const a = i === first ? t.v[0] : knots[i],
        b = i === last ? t.v[1] : knots[i + 1];
      const va = points[i][axis] + (a - knots[i]) * slope,
        vb = points[i][axis] + (b - knots[i]) * slope;
      low = Math.min(low, va, vb);
      high = Math.max(high, va, vb);
      slopeLow = Math.min(slopeLow, slope);
      slopeHigh = Math.max(slopeHigh, slope);
    }
    const slopes: Interval = [slopeLow, slopeHigh];
    return {
      v: [low, high] as Interval,
      d: mulI(slopes, t.d),
      dd: addI(
        mulI(slopes, t.dd),
        first === last || slopeLow === slopeHigh
          ? interval(0)
          : [-Infinity, Infinity],
      ),
    };
  }) as unknown as Pair;
}
