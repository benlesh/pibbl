import { ellipseParameters, singularArcPoints } from './path-arc.js';
import { bendSpanBounds, bendSpanPoint, bendSpans, splitBendSpan, type BendPoint, type BendSpan } from './path-bend-spans.js';
import { PathGeometry } from './path-geometry.js';

interface Field { readonly point: BendPoint; readonly normal: BendPoint }
interface Leaf {
  readonly span: BendSpan; readonly depth: number;
  readonly first: Field; readonly last: Field;
  readonly chord: number; readonly excess: number;
  readonly sag: number; readonly normalError: number;
}
interface Knot extends Field { readonly distance: number }
export interface PreparedBendGuide {
  readonly spans: readonly BendSpan[];
  readonly closed: boolean;
  readonly scale: number;
}

// Includes failed refinement and field-envelope visits. No resource survives a call.
const MAX_GUIDE_WORK = 2_000_000;
const MAX_GUIDE_LEAVES = 131_072;
const MAX_GUIDE_DEPTH = 48;
const JOIN_ROUNDOFF = 512 * Number.EPSILON;

/** Validate all guide contours and joins, even if the source uses only part. */
export function prepareBendGuide(path: PathGeometry): PreparedBendGuide {
  const spans: BendSpan[] = [];
  let moves = 0, closed = false, scale = 0;
  for (const item of bendSpans(path)) {
    if (item.type === 'move') {
      if (++moves > 1) throw new RangeError('Along Path requires exactly one guide contour.');
      scale = Math.max(scale, ...item.point.map(Math.abs));
    } else if (item.type === 'close') closed = true;
    else {
      closed = false;
      const bounds = bendSpanBounds(item.span);
      scale = Math.max(scale, Math.abs(bounds.xmin), Math.abs(bounds.xmax), Math.abs(bounds.ymin), Math.abs(bounds.ymax));
      if ('arc' in item.span && !ellipseParameters(item.span.arc)) {
        const points = [bendSpanPoint(item.span, 0), ...singularArcPoints(item.span.arc)];
        for (let i = 1; i < points.length; i++) append({ points: [points[i - 1], points[i]] });
      } else append(item.span);
    }
  }
  if (!spans.length) throw new RangeError('Along Path requires a guide of positive length.');
  if (closed) sameTangent(tangent(spans.at(-1)!, true), tangent(spans[0], false));
  return { spans, closed, scale };

  function append(raw: BendSpan) {
    const b = bendSpanBounds(raw);
    // Numerically coincident endpoints/control hulls carry no reliable direction.
    if (Math.hypot(b.xmax - b.xmin, b.ymax - b.ymin) <= scale * Number.EPSILON * 32) return;
    const span = straightSpan(raw);
    const first = tangent(span, false), last = tangent(span, true);
    if (spans.length) sameTangent(tangent(spans.at(-1)!, true), first);
    if (![...first, ...last].every(Number.isFinite)) throw new RangeError('Guide limiting tangent is not finite.');
    spans.push(span);
  }
}

/**
 * A continuous piecewise-linear position/normal field with a certified error
 * against the true arc-length field. Interpolated normals are deliberately NOT
 * renormalized: this keeps the internal mapping bilinear within each leaf.
 */
export function measureBendGuide(
  prepared: PreparedBendGuide,
  tolerance: number,
  maxDisplacement: number,
  distanceFactor: (length: number) => number,
) {
  let work = 0;
  const charge = () => { if (++work > MAX_GUIDE_WORK) throw new RangeError('Along Path exceeded its guide work budget.'); };
  const roundoff = prepared.scale * Number.EPSILON * 128;
  if (!Number.isFinite(roundoff) || roundoff >= tolerance / 16) throw new RangeError('Guide coordinates cannot support the requested tolerance.');
  let pending = prepared.spans.map(span => ({ span, depth: 0 }));
  let leaves: Leaf[] = [];
  let target = tolerance / 32;
  let length = 0, uncertainty = 0, error = Infinity;
  for (let pass = 0; pass < 24; pass++) {
    leaves = [];
    const stack = [...pending].reverse();
    while (stack.length) {
      charge();
      const { span, depth } = stack.pop()!;
      const leaf = certifyLeaf(span, depth);
      if (leaf && leaf.sag + maxDisplacement * leaf.normalError <= target) {
        if (leaves.length >= MAX_GUIDE_LEAVES) throw new RangeError('Along Path exceeded its guide subdivision budget.');
        leaves.push(leaf);
      } else {
        if (depth >= MAX_GUIDE_DEPTH) throw new RangeError('Guide has a cusp, reversal, or numerically uncertifiable tangent.');
        const [left, right] = splitBendSpan(span);
        stack.push({ span: right, depth: depth + 1 }, { span: left, depth: depth + 1 });
      }
    }
    length = 0; uncertainty = 0;
    let compensation = 0, sag = 0, normalError = 0, normalSlope = 0;
    let previous: Leaf | undefined;
    for (const leaf of leaves) {
      // A cusp can lie inside an original segment exactly at a subdivision
      // boundary. Certifying the two regular halves alone would miss it.
      if (previous) sameTangent(previous.last.normal, leaf.first.normal);
      previous = leaf;
      // Compensated sums avoid accumulating an O(number-of-leaves) length bias.
      const next = leaf.chord - compensation, sum = length + next;
      compensation = (sum - length) - next; length = sum;
      uncertainty += leaf.excess;
      normalSlope = Math.max(normalSlope, norm(subtract(leaf.last.normal, leaf.first.normal)) / leaf.chord);
      sag = Math.max(sag, leaf.sag); normalError = Math.max(normalError, leaf.normalError);
    }
    if (!(length > 0) || !Number.isFinite(length)) throw new RangeError('Guide length must be finite and positive.');
    uncertainty += roundoff + length * Number.EPSILON * 128;
    // phi maps chord distance to true arc distance and has inverse Lipschitz
    // constant <=1. Its deviation from identity is bounded by total excess.
    // distanceFactor includes fit/alignment and any unwrapped guide laps.
    const distanceError = uncertainty * distanceFactor(length);
    error = sag + maxDisplacement * (normalError + JOIN_ROUNDOFF) + (1 + maxDisplacement * normalSlope) * distanceError + roundoff;
    if (Number.isFinite(error) && error <= tolerance / 4) break;
    if (pass === 23) throw new RangeError('Along Path cannot certify its guide-distance and normal error.');
    target /= 2;
    pending = leaves.flatMap(leaf => {
      if (leaf.depth >= MAX_GUIDE_DEPTH) throw new RangeError('Guide measurement reached numerical nonprogress.');
      const [left, right] = splitBendSpan(leaf.span);
      return [{ span: left, depth: leaf.depth + 1 }, { span: right, depth: leaf.depth + 1 }];
    });
  }
  const knots: Knot[] = [{ ...leaves[0].first, distance: 0 }];
  let cumulative = 0, compensation = 0;
  for (const leaf of leaves) {
    const next = leaf.chord - compensation, sum = cumulative + next;
    compensation = (sum - cumulative) - next; cumulative = sum;
    knots.push({ ...leaf.last, distance: cumulative });
  }
  // Joins are already checked. Sharing the endpoint field prevents tiny normal
  // jumps at the closed seam from becoming artificial output edges.
  if (prepared.closed) knots[knots.length - 1] = { ...knots[0], distance: length };

  function field(distance: number, wrap: boolean): Field {
    charge();
    if (!Number.isFinite(distance)) throw new RangeError('Mapped guide distance overflowed.');
    if (wrap) distance = ((distance % length) + length) % length;
    if (distance < 0 || distance > length) {
      const end = distance < 0 ? knots[0] : knots.at(-1)!;
      const d = distance - end.distance;
      return { normal: end.normal, point: [end.point[0] + d * end.normal[1], end.point[1] - d * end.normal[0]] };
    }
    if (distance === length) return knots.at(-1)!;
    const i = index(distance), a = knots[i], b = knots[i + 1];
    const u = (distance - a.distance) / (b.distance - a.distance);
    return { point: lerp(a.point, b.point, u), normal: lerp(a.normal, b.normal, u) };
  }
  function index(distance: number): number {
    let low = 0, high = knots.length - 1;
    while (low + 1 < high) {
      const mid = Math.floor((low + high) / 2);
      if (knots[mid].distance <= distance) low = mid; else high = mid;
    }
    return low;
  }
  function envelope(low: number, high: number, wrap: boolean, visit: (distance: number, value: Field) => void) {
    visit(low, field(low, wrap)); visit(high, field(high, wrap));
    if (!wrap) {
      for (let i = index(Math.max(0, low)); i < knots.length && knots[i].distance <= high; i++) {
        if (knots[i].distance >= low) { charge(); visit(knots[i].distance, knots[i]); }
      }
    } else {
      const firstLap = Math.floor(low / length), lastLap = Math.floor(high / length);
      if (!Number.isSafeInteger(firstLap) || !Number.isSafeInteger(lastLap) || lastLap - firstLap > MAX_GUIDE_WORK) throw new RangeError('Too many guide laps to certify.');
      for (let lap = firstLap; lap <= lastLap; lap++) {
        charge();
        const offset = lap * length;
        for (let i = index(Math.max(0, low - offset)); i < knots.length && knots[i].distance + offset <= high; i++) {
          const s = knots[i].distance + offset;
          if (s >= low) { charge(); visit(s, knots[i]); }
        }
      }
    }
  }
  return {
    length, uncertainty, error, field,
    /** Conservative full-field residual, not a sampled flatness heuristic. */
    chordError(low: number, high: number, s0: number, s1: number, d: number, ds: number, dds: number, dy: number, ddy: number, wrap: boolean): number {
      const first = field(s0, wrap), last = field(s1, wrap);
      const delta = s1 - s0;
      const v = delta === 0 ? [0, 0] as const : scaleVector(subtract(last.point, first.point), 1 / delta);
      const q = delta === 0 ? [0, 0] as const : scaleVector(subtract(last.normal, first.normal), 1 / delta);
      const baseNormal = (s: number): BendPoint => add(first.normal, scaleVector(q, s - s0));
      let positionResidual = 0, normalResidual = 0;
      envelope(low, high, wrap, (s, value) => {
        positionResidual = Math.max(positionResidual, norm(subtract(value.point, add(first.point, scaleVector(v, s - s0)))));
        normalResidual = Math.max(normalResidual, norm(subtract(value.normal, baseNormal(s))));
      });
      const baseNormalSize = Math.max(norm(baseNormal(low)), norm(baseNormal(high)));
      const polynomialError = ((norm(v) + d * norm(q)) * dds + baseNormalSize * ddy + 2 * norm(q) * ds * dy) / 8;
      return error + polynomialError + positionResidual + d * normalResidual;
    },
  };
}

function certifyLeaf(span: BendSpan, depth: number): Leaf | undefined {
  if ('arc' in span && Math.abs(span.arc.sweep) > Math.PI / 2) return undefined;
  const a = bendSpanPoint(span, 0), b = bendSpanPoint(span, 1), chordVector = subtract(b, a), chord = norm(chordVector);
  if (!(chord > 0) || !Number.isFinite(chord)) return undefined;
  const axis = scaleVector(chordVector, 1 / chord);
  let ratio = 0, minProjection = Infinity;
  const hull = derivativeHull(span);
  for (const vector of hull) {
    const magnitude = norm(vector);
    if (magnitude === 0) { minProjection = 0; continue; }
    const v = scaleVector(vector, 1 / magnitude);
    const projection = v[0] * axis[0] + v[1] * axis[1];
    if (!(projection > 0)) return undefined;
    minProjection = Math.min(minProjection, projection * magnitude);
    ratio = Math.max(ratio, Math.abs(v[0] * axis[1] - v[1] * axis[0]) / projection);
  }
  const hyp = Math.hypot(1, ratio);
  // All derivatives lie in a directed cone around the chord. Its minimum
  // projection bounds length; its diameter bounds normal interpolation error.
  const excess = chord * ratio * (ratio / (hyp + 1)); // chord*(hyp-1), without cancellation
  const eta = ratio * Math.sqrt(2 / (hyp * (hyp + 1)));
  const first = normal(tangent(span, false)), last = normal(tangent(span, true));
  let normalError = 2 * ratio / hyp;
  // On regular spans use the second derivative of N with respect to arc length.
  // |N''| <= Q/m³ + 4A²/m⁴, where m bounds speed below and A,Q bound the
  // second/third parameter derivatives. The cone remains the fallback at
  // removable stationary endpoints, where m can be zero but the normal exists.
  if (minProjection > 0) {
    let m: number, acceleration: number, jerk: number;
    if ('points' in span) {
      const degree = span.points.length - 1;
      m = minProjection * degree;
      const second = hull.slice(1).map((v, i) => scaleVector(subtract(v, hull[i]), degree * (degree - 1)));
      acceleration = Math.max(0, ...second.map(norm));
      jerk = Math.max(0, ...second.slice(1).map((v, i) => norm(subtract(v, second[i])) * (degree - 2)));
    } else {
      const h = Math.abs(span.arc.sweep), basis = Math.hypot(span.arc.ux, span.arc.uy) + Math.hypot(span.arc.vx, span.arc.vy);
      m = minProjection * h; acceleration = basis * h * h; jerk = acceleration * h;
    }
    const lengthOverSpeed = (chord + excess) / m;
    const error = (jerk / m + 4 * (acceleration / m) ** 2) * lengthOverSpeed ** 2 / 8;
    if (Number.isFinite(error)) normalError = Math.min(normalError, error);
  }
  return { span, depth, first: { point: a, normal: first }, last: { point: b, normal: last }, chord, excess, sag: (chord + excess) * eta / 2, normalError };
}

function derivativeHull(span: BendSpan): readonly BendPoint[] {
  if ('points' in span) return span.points.slice(1).map((point, i) => subtract(point, span.points[i]));
  const a = span.arc;
  return [a.startAngle, a.startAngle + a.sweep].map(theta => [
    Math.sign(a.sweep) * (-a.ux * Math.sin(theta) + a.vx * Math.cos(theta)),
    Math.sign(a.sweep) * (-a.uy * Math.sin(theta) + a.vy * Math.cos(theta)),
  ]);
}
function tangent(span: BendSpan, end: boolean): BendPoint {
  const vectors = derivativeHull(span);
  const vector = (end ? [...vectors].reverse() : vectors).find(v => norm(v) > 0);
  if (!vector) throw new RangeError('Guide has no limiting tangent.');
  const length = norm(vector);
  return scaleVector(vector, 1 / length);
}
function sameTangent(a: BendPoint, b: BendPoint) {
  if (norm(subtract(a, b)) > JOIN_ROUNDOFF) throw new RangeError('Along Path requires smooth directed guide joins; corners and cusps are unsupported.');
}

function straightSpan(span: BendSpan): BendSpan {
  if (!('points' in span)) return span;
  const a = span.points[0], b = span.points.at(-1)!, vector = subtract(b, a), length = norm(vector);
  if (!(length > 0) || !Number.isFinite(length)) return span;
  const direction = scaleVector(vector, 1 / length);
  if (!span.points.every(p => {
    const v = subtract(p, a);
    return v[0] * direction[1] - v[1] * direction[0] === 0;
  })) return span;
  const values = derivativeHull(span).map(v => v[0] * direction[0] + v[1] * direction[1]);
  let minimum = Math.min(values[0], values.at(-1)!);
  if (values.length === 3) {
    const denominator = values[0] - 2 * values[1] + values[2];
    const t = (values[0] - values[1]) / denominator;
    if (t > 0 && t < 1) minimum = Math.min(minimum, (1 - t) ** 2 * values[0] + 2 * t * (1 - t) * values[1] + t * t * values[2]);
  }
  if (minimum < -length * Number.EPSILON * 16) throw new RangeError('Guide reverses direction at a cusp.');
  return { points: [a, b] };
}
function normal(v: BendPoint): BendPoint { return [-v[1], v[0]]; }
function norm(v: BendPoint): number { return Math.hypot(v[0], v[1]); }
function add(a: BendPoint, b: BendPoint): BendPoint { return [a[0] + b[0], a[1] + b[1]]; }
function subtract(a: BendPoint, b: BendPoint): BendPoint { return [a[0] - b[0], a[1] - b[1]]; }
function scaleVector(a: BendPoint, scale: number): BendPoint { return [a[0] * scale, a[1] * scale]; }
function lerp(a: BendPoint, b: BendPoint, t: number): BendPoint { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
