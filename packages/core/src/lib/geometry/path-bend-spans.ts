import { arcPoint, type ArcSegment } from './path-arc.js';
import { PathGeometry } from './path-geometry.js';

/** Private continuous source spans; bounds use the span's local parameter [0,1]. */
export type BendPoint = readonly [number, number];
export type BendSpan = { readonly points: readonly BendPoint[] } | { readonly arc: ArcSegment };
export interface BendBounds {
  readonly xmin: number; readonly xmax: number;
  readonly ymin: number; readonly ymax: number;
  readonly dx: number; readonly dy: number;
  readonly ddx: number; readonly ddy: number;
}

export function* bendSpans(path: PathGeometry): Generator<
  { type: 'move'; point: BendPoint } | { type: 'span'; span: BendSpan } | { type: 'close' }
> {
  let current: BendPoint = [0, 0], start = current;
  for (const segment of path) {
    switch (segment.type) {
      case 'move':
        current = start = [segment.x, segment.y];
        yield { type: 'move', point: current };
        break;
      case 'line': {
        const end: BendPoint = [segment.x, segment.y];
        yield { type: 'span', span: { points: [current, end] } };
        current = end;
        break;
      }
      case 'quadratic': {
        const end: BendPoint = [segment.x, segment.y];
        yield { type: 'span', span: { points: [current, [segment.cpx, segment.cpy], end] } };
        current = end;
        break;
      }
      case 'cubic': {
        const end: BendPoint = [segment.x, segment.y];
        yield { type: 'span', span: { points: [current, [segment.cp1x, segment.cp1y], [segment.cp2x, segment.cp2y], end] } };
        current = end;
        break;
      }
      case 'arc': {
        const first = arcPoint(segment, segment.startAngle);
        if (current[0] !== first[0] || current[1] !== first[1]) {
          yield { type: 'span', span: { points: [current, first] } };
        }
        yield { type: 'span', span: { arc: segment } };
        current = arcPoint(segment, segment.startAngle + segment.sweep);
        break;
      }
      case 'close':
        yield { type: 'span', span: { points: [current, start] } };
        yield { type: 'close' };
        current = start;
        break;
    }
  }
}

export function bendSpanPoint(span: BendSpan, t: number): BendPoint {
  if ('arc' in span) return arcPoint(span.arc, span.arc.startAngle + span.arc.sweep * t);
  let points = span.points;
  while (points.length > 1) {
    points = points.slice(1).map((b, i) => [
      (1 - t) * points[i][0] + t * b[0], (1 - t) * points[i][1] + t * b[1],
    ]);
  }
  return points[0];
}

export function splitBendSpan(span: BendSpan): readonly [BendSpan, BendSpan] {
  if ('arc' in span) {
    const arc = span.arc, sweep = arc.sweep / 2;
    return [{ arc: { ...arc, sweep } }, { arc: { ...arc, startAngle: arc.startAngle + sweep, sweep } }];
  }
  let row = span.points;
  const left = [row[0]], right = [row.at(-1)!];
  while (row.length > 1) {
    row = row.slice(1).map((b, i) => [row[i][0] / 2 + b[0] / 2, row[i][1] / 2 + b[1] / 2]);
    left.push(row[0]); right.push(row.at(-1)!);
  }
  return [{ points: left }, { points: right.reverse() }];
}

export function bendSpanBounds(span: BendSpan): BendBounds {
  if ('arc' in span) {
    const a = span.arc;
    const [xmin, xmax] = arcRange(a.cx, a.ux, a.vx, a.startAngle, a.sweep);
    const [ymin, ymax] = arcRange(a.cy, a.uy, a.vy, a.startAngle, a.sweep);
    const dx = Math.hypot(a.ux, a.vx) * Math.abs(a.sweep);
    const dy = Math.hypot(a.uy, a.vy) * Math.abs(a.sweep);
    return { xmin, xmax, ymin, ymax, dx, dy, ddx: dx * Math.abs(a.sweep), ddy: dy * Math.abs(a.sweep) };
  }
  const p = span.points, n = p.length - 1;
  const xs = p.map(point => point[0]), ys = p.map(point => point[1]);
  const first = (axis: number) => Math.max(0, ...p.slice(1).map((b, i) => Math.abs(n * (b[axis] - p[i][axis]))));
  const second = (axis: number) => Math.max(0, ...p.slice(2).map((b, i) => Math.abs(n * (n - 1) * ((b[axis] - p[i + 1][axis]) - (p[i + 1][axis] - p[i][axis])))));
  return {
    xmin: Math.min(...xs), xmax: Math.max(...xs), ymin: Math.min(...ys), ymax: Math.max(...ys),
    dx: first(0), dy: first(1), ddx: second(0), ddy: second(1),
  };
}

function arcRange(center: number, u: number, v: number, start: number, sweep: number): readonly [number, number] {
  const values = [center + u * Math.cos(start) + v * Math.sin(start), center + u * Math.cos(start + sweep) + v * Math.sin(start + sweep)];
  const low = Math.min(start, start + sweep), high = Math.max(start, start + sweep);
  const phase = Math.atan2(v, u);
  for (let k = Math.ceil((low - phase) / Math.PI); k <= Math.floor((high - phase) / Math.PI); k++) {
    values.push(center + (k % 2 === 0 ? 1 : -1) * Math.hypot(u, v));
  }
  return [Math.min(...values), Math.max(...values)];
}
