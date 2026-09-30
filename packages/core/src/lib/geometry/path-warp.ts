import { arcPoint } from './path-arc.js';
import { PathGeometry } from './path-geometry.js';
import { emitSpan, endpoint, product, type WarpPoint, type WarpSpan, type WarpWork } from './path-warp-bezier.js';

export interface PathWarpPoint { readonly x: number; readonly y: number }
export interface PathWarpRect { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
export interface PathWarpCorners {
  readonly topLeft: PathWarpPoint;
  readonly topRight: PathWarpPoint;
  readonly bottomLeft: PathWarpPoint;
  readonly bottomRight: PathWarpPoint;
}
export type PathWarpMode = 'bilinear' | 'perspective';
export interface WarpPathOptions {
  readonly source: PathWarpRect;
  readonly destination: PathWarpCorners;
  readonly mode?: PathWarpMode;
  readonly tolerance: number;
  readonly maxSegments?: number;
}

function number(value: unknown, name: string): number {
  if (typeof value !== 'number') throw new TypeError(`warpPath ${name} must be a number.`);
  if (!Number.isFinite(value)) throw new RangeError(`warpPath ${name} must be finite.`);
  return value;
}
function point(value: PathWarpPoint | undefined, name: string): WarpPoint {
  return [number(value?.x, `${name}.x`), number(value?.y, `${name}.y`)];
}
function polynomial(points: readonly WarpPoint[]): WarpSpan {
  return { x: points.map(p => p[0]), y: points.map(p => p[1]), w: points.map(() => 1) };
}

/** Normalize destination coordinates before solving the unit-square homography. */
function perspective(corners: readonly WarpPoint[]): (span: WarpSpan) => WarpSpan {
  const scale = Math.max(...corners.flatMap(p => [Math.abs(p[0]), Math.abs(p[1])]));
  if (scale === 0) throw new RangeError('Perspective warp requires a strictly convex quadrilateral.');
  const normalized = corners.map(p => [p[0] / scale, p[1] / scale] as const);
  const origin = normalized[0];
  const extent = Math.max(...normalized.flatMap(p => [Math.abs(p[0] - origin[0]), Math.abs(p[1] - origin[1])]));
  if (extent === 0) throw new RangeError('Perspective destination is degenerate.');
  const q = normalized.map(p => [(p[0] - origin[0]) / extent, (p[1] - origin[1]) / extent] as const);
  const perimeter = [q[0], q[1], q[3], q[2]];
  let orientation = 0;
  for (let i = 0; i < 4; i++) {
    const a = perimeter[i], b = perimeter[(i + 1) % 4], c = perimeter[(i + 2) % 4];
    const p = (b[0] - a[0]) * (c[1] - b[1]), r = (b[1] - a[1]) * (c[0] - b[0]);
    const cross = p - r;
    if (Math.abs(cross) <= 32 * Number.EPSILON * (Math.abs(p) + Math.abs(r)) ||
        (orientation !== 0 && Math.sign(cross) !== orientation)) {
      throw new RangeError('Perspective warp requires a strictly convex, nondegenerate quadrilateral.');
    }
    orientation = Math.sign(cross);
  }
  const [a, b, c, d] = q;
  const dx1 = b[0] - d[0], dx2 = c[0] - d[0], dx3 = a[0] - b[0] - c[0] + d[0];
  const dy1 = b[1] - d[1], dy2 = c[1] - d[1], dy3 = a[1] - b[1] - c[1] + d[1];
  const determinant = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(determinant) <= 32 * Number.EPSILON * (Math.abs(dx1 * dy2) + Math.abs(dx2 * dy1))) {
    throw new RangeError('Perspective mapping is numerically singular.');
  }
  const g = (dx3 * dy2 - dx2 * dy3) / determinant;
  const h = (dx1 * dy3 - dx3 * dy1) / determinant;
  if ([1 + g, 1 + h, 1 + g + h].some(w => w <= 64 * Number.EPSILON * (1 + Math.abs(g) + Math.abs(h)))) {
    throw new RangeError('Perspective mapping cannot certify a finite source rectangle.');
  }
  const xx = b[0] - a[0] + g * b[0], xy = c[0] - a[0] + h * c[0];
  const yx = b[1] - a[1] + g * b[1], yy = c[1] - a[1] + h * c[1];
  return span => {
    const w = span.w.map((weight, i) => g * span.x[i] + h * span.y[i] + weight);
    const x = w.map((weight, i) => ((xx * span.x[i] + xy * span.y[i] + a[0] * span.w[i]) * extent + origin[0] * weight) * scale);
    const y = w.map((weight, i) => ((yx * span.x[i] + yy * span.y[i] + a[1] * span.w[i]) * extent + origin[1] * weight) * scale);
    return { x, y, w };
  };
}

/** Approximate a four-corner warp in destination units, returning independent line geometry. */
export function warpPath(path: PathGeometry, options: Readonly<WarpPathOptions>): PathGeometry {
  if (!(path instanceof PathGeometry)) throw new TypeError('warpPath requires PathGeometry.');
  const source = options?.source, destination = options?.destination;
  const sx = number(source?.x, 'source.x'), sy = number(source?.y, 'source.y');
  const width = number(source?.width, 'source.width'), height = number(source?.height, 'source.height');
  const tolerance = number(options?.tolerance, 'tolerance');
  const requestedLimit = options?.maxSegments;
  const maxSegments = number(requestedLimit === undefined ? 1_000_000 : requestedLimit, 'maxSegments');
  if (width <= 0 || height <= 0 || tolerance <= 0 || !Number.isSafeInteger(maxSegments) || maxSegments <= 0) {
    throw new RangeError('warpPath requires positive dimensions, tolerance, and a positive safe-integer maxSegments.');
  }
  const requestedMode = options?.mode;
  const mode = requestedMode === undefined ? 'bilinear' : requestedMode;
  if (mode !== 'bilinear' && mode !== 'perspective') throw new TypeError('Unknown warpPath mode.');
  const corners = [point(destination?.topLeft, 'topLeft'), point(destination?.topRight, 'topRight'),
    point(destination?.bottomLeft, 'bottomLeft'), point(destination?.bottomRight, 'bottomRight')];
  const project = mode === 'perspective' ? perspective(corners) : undefined;
  const map = (span: WarpSpan): WarpSpan => {
    const u = span.x.map((x, i) => (x - sx * span.w[i]) / width);
    const v = span.y.map((y, i) => (y - sy * span.w[i]) / height);
    if (project) return project({ x: u, y: v, w: span.w });
    const wu = span.w.map((w, i) => w - u[i]), wv = span.w.map((w, i) => w - v[i]);
    const weights = [product(wu, wv), product(u, wv), product(wu, v), product(u, v)];
    const w = product(span.w, span.w);
    const x = w.map((_, i) => weights.reduce((sum, ws, j) => sum + ws[i] * corners[j][0], 0));
    const y = w.map((_, i) => weights.reduce((sum, ws, j) => sum + ws[i] * corners[j][1], 0));
    return { x, y, w };
  };
  const output = new PathGeometry();
  let count = 0, closed = false;
  const reserve = () => {
    if (++count > maxSegments) throw new RangeError('warpPath exceeded maxSegments.');
  };
  const line = (x: number, y: number) => { reserve(); output.lineTo(x, y); closed = false; };
  // At most 4M subdivision visits per call, even for a pole with no output.
  const work: WarpWork = { remaining: Math.min(4_000_000, 2 * maxSegments + 53), pool: [], depths: [], scratch: [] };
  const emit = (span: WarpSpan) => {
    if (count >= maxSegments) throw new RangeError('warpPath exceeded maxSegments.');
    emitSpan(map(span), tolerance, work, line);
  };
  let current: WarpPoint = [0, 0], start: WarpPoint = current;
  for (const segment of path) {
    switch (segment.type) {
      case 'move': {
        current = start = [segment.x, segment.y];
        const p = endpoint(map(polynomial([current])), 0);
        reserve(); output.moveTo(p[0], p[1]); closed = false;
        break;
      }
      case 'line': {
        const end: WarpPoint = [segment.x, segment.y];
        emit(polynomial([current, end])); current = end; break;
      }
      case 'quadratic': {
        const end: WarpPoint = [segment.x, segment.y];
        emit(polynomial([current, [segment.cpx, segment.cpy], end])); current = end; break;
      }
      case 'cubic': {
        const end: WarpPoint = [segment.x, segment.y];
        emit(polynomial([current, [segment.cp1x, segment.cp1y], [segment.cp2x, segment.cp2y], end]));
        current = end; break;
      }
      case 'arc': {
        const first = arcPoint(segment, segment.startAngle);
        if (current[0] !== first[0] || current[1] !== first[1]) emit(polynomial([current, first]));
        const pieces = Math.max(1, Math.ceil(Math.abs(segment.sweep) / (Math.PI / 2)));
        for (let i = 0; i < pieces; i++) {
          const a = segment.startAngle + segment.sweep * i / pieces;
          const b = segment.startAngle + segment.sweep * (i + 1) / pieces;
          const mid = (a + b) / 2, weight = Math.cos((b - a) / 2);
          const p = arcPoint(segment, a), q = arcPoint(segment, b);
          emit({
            x: [p[0], segment.cx * weight + segment.ux * Math.cos(mid) + segment.vx * Math.sin(mid), q[0]],
            y: [p[1], segment.cy * weight + segment.uy * Math.cos(mid) + segment.vy * Math.sin(mid), q[1]],
            w: [1, weight, 1],
          });
        }
        current = arcPoint(segment, segment.startAngle + segment.sweep);
        break;
      }
      case 'close':
        if (current[0] !== start[0] || current[1] !== start[1]) emit(polynomial([current, start]));
        if (!closed) { reserve(); output.closePath(); closed = true; }
        current = start; break;
    }
  }
  return output;
}
