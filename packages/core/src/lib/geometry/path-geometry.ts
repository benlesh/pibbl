import { arcPoint, arcSweep, TAU, type ArcSegment } from './path-arc.js';
/** A canonical, independently editable path segment. */
export type PathSegment =
  | { type: 'move' | 'line'; x: number; y: number }
  | { type: 'quadratic'; cpx: number; cpy: number; x: number; y: number }
  | { type: 'cubic'; cp1x: number; cp1y: number; cp2x: number; cp2y: number; x: number; y: number }
  | ArcSegment
  | { type: 'close' };

const names = ['move', 'line', 'quadratic', 'cubic', 'close', 'arc'] as const;
const widths = [2, 2, 4, 6, 0, 8] as const;
interface Storage {
  types: Uint8Array;
  data: Float64Array;
  count: number;
  length: number;
  revision: number;
  x: number; y: number; startX: number; startY: number;
}
const storage = new WeakMap<PathGeometry, Storage>();

function state(path: PathGeometry): Storage {
  const value = storage.get(path);
  if (!value) throw new TypeError('Expected a PathGeometry.');
  return value;
}

/** @internal Borrowed buffers must never escape this synchronous traversal. */
export function visitPathGeometry(
  path: PathGeometry,
  visit: (type: number, data: Float64Array, offset: number) => void,
): void {
  const value = state(path);
  let offset = 0;
  for (let i = 0; i < value.count; i++) {
    const type = value.types[i];
    visit(type, value.data, offset);
    offset += widths[type];
  }
}

function ensureRevision(value: Storage): void {
  if (value.revision >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError('PathGeometry revision exhausted.');
  }
}

function reserve(value: Storage, count: number, length: number): void {
  if (count > value.types.length) {
    const next = new Uint8Array(Math.max(count, value.types.length * 2, 8));
    next.set(value.types.subarray(0, value.count));
    value.types = next;
  }
  if (length > value.data.length) {
    const next = new Float64Array(Math.max(length, value.data.length * 2, 32));
    next.set(value.data.subarray(0, value.length));
    value.data = next;
  }
}

function append(value: Storage, type: number, data: readonly number[]): void {
  reserve(value, value.count + 1, value.length + data.length);
  value.types[value.count++] = type;
  value.data.set(data, value.length);
  value.length += data.length;
  updatePoint(value, type, data, 0);
}

function operands(segment: PathSegment): number[] {
  switch (segment.type) {
    case 'move': case 'line': return [segment.x, segment.y];
    case 'quadratic': return [segment.cpx, segment.cpy, segment.x, segment.y];
    case 'cubic': return [segment.cp1x, segment.cp1y, segment.cp2x, segment.cp2y, segment.x, segment.y];
    case 'close': return [];
    case 'arc': return [segment.cx, segment.cy, segment.ux, segment.uy, segment.vx, segment.vy, segment.startAngle, segment.sweep];
    default: throw new TypeError('Unknown path segment type.');
  }
}

/** Mutable packed geometry. Mutations do not schedule CRC rendering. */
export class PathGeometry implements Iterable<PathSegment> {
  constructor(source?: PathGeometry) {
    const original = source === undefined ? undefined : state(source);
    storage.set(this, {
      types: original ? original.types.slice(0, original.count) : new Uint8Array(0),
      data: original ? original.data.slice(0, original.length) : new Float64Array(0),
      count: original?.count ?? 0,
      length: original?.length ?? 0,
      revision: 0,
      x: original?.x ?? 0, y: original?.y ?? 0,
      startX: original?.startX ?? 0, startY: original?.startY ?? 0,
    });
  }

  get revision(): number { return state(this).revision; }
  get segmentCount(): number { return state(this).count; }

  clone(): PathGeometry { return new PathGeometry(this); }

  clear(): void {
    const value = state(this);
    if (!value.count) return;
    ensureRevision(value);
    value.count = value.length = 0;
    value.x = value.y = value.startX = value.startY = 0;
    value.revision++;
  }

  moveTo(x: number, y: number): void { this.#build(0, [x, y]); }
  lineTo(x: number, y: number): void { this.#build(1, [x, y]); }
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this.#build(2, [cpx, cpy, x, y]);
  }
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void {
    this.#build(3, [cp1x, cp1y, cp2x, cp2y, x, y]);
  }
  closePath(): void {
    const value = state(this);
    if (!value.count || value.types[value.count - 1] === 4) return;
    this.#build(4, []);
  }

  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise = false): void {
    this.ellipse(x, y, radius, radius, 0, startAngle, endAngle, counterclockwise);
  }

  ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number, counterclockwise = false): void {
    if (![x, y, radiusX, radiusY, rotation, startAngle, endAngle].every(Number.isFinite)) return;
    if (radiusX < 0 || radiusY < 0) throw new DOMException('Arc radii must not be negative.', 'IndexSizeError');
    const cos = Math.cos(rotation), sin = Math.sin(rotation);
    const arc: ArcSegment = {
      type: 'arc', cx: x, cy: y, ux: radiusX * cos, uy: radiusX * sin,
      vx: -radiusY * sin, vy: radiusY * cos, startAngle: startAngle % TAU,
      sweep: arcSweep(startAngle, endAngle, counterclockwise),
    };
    this.#appendArc(arc);
  }

  #appendArc(arc: ArcSegment): void {
    const [x, y] = arcPoint(arc, arc.startAngle);
    const end = arcPoint(arc, arc.startAngle + arc.sweep);
    if (![x, y, ...end].every(Number.isFinite)) throw new RangeError('Arc coordinates overflowed.');
    const value = state(this);
    ensureRevision(value);
    if (!value.count) append(value, 0, [x, y]);
    else if (value.x !== x || value.y !== y) append(value, 1, [x, y]);
    append(value, 5, operands(arc));
    value.revision++;
  }

  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void {
    if (![x1, y1, x2, y2, radius].every(Number.isFinite)) return;
    if (radius < 0) throw new DOMException('Arc radius must not be negative.', 'IndexSizeError');
    const value = state(this);
    if (!value.count) { this.moveTo(x1, y1); return; }
    const ax = value.x - x1, ay = value.y - y1, bx = x2 - x1, by = y2 - y1;
    const al = Math.hypot(ax, ay), bl = Math.hypot(bx, by);
    if (al === 0 || bl === 0 || radius === 0) { this.lineTo(x1, y1); return; }
    const ux = ax / al, uy = ay / al, vx = bx / bl, vy = by / bl;
    const cross = ux * vy - uy * vx;
    if (cross === 0) { this.lineTo(x1, y1); return; }
    const dot = Math.max(-1, Math.min(1, ux * vx + uy * vy));
    const distance = radius * (1 + dot) / Math.abs(cross);
    const startX = x1 + ux * distance, startY = y1 + uy * distance;
    const sign = cross < 0 ? -1 : 1;
    const cx = startX - uy * radius * sign, cy = startY + ux * radius * sign;
    const endX = x1 + vx * distance, endY = y1 + vy * distance;
    const start = Math.atan2(startY - cy, startX - cx);
    const end = Math.atan2(endY - cy, endX - cx);
    if (![cx, cy, endX, endY].every(Number.isFinite)) throw new RangeError('Arc coordinates overflowed.');
    this.#appendArc({ type: 'arc', cx, cy, ux: radius, uy: 0, vx: 0, vy: radius,
      startAngle: start, sweep: arcSweep(start, end, cross > 0) });
  }

  rect(x: number, y: number, width: number, height: number): void {
    if (![x, y, width, height].every(Number.isFinite)) return;
    if (![x + width, y + height].every(Number.isFinite)) throw new RangeError('Rectangle coordinates overflowed.');
    const value = state(this);
    ensureRevision(value);
    append(value, 0, [x, y]);
    append(value, 1, [x + width, y]);
    append(value, 1, [x + width, y + height]);
    append(value, 1, [x, y + height]);
    append(value, 4, []);
    append(value, 0, [x, y]);
    value.revision++;
  }

  roundRect(x: number, y: number, width: number, height: number,
    radii: number | DOMPointInit | (number | DOMPointInit)[] = 0): void {
    if (![x, y, width, height].every(Number.isFinite)) return;
    const list = Array.isArray(radii) ? radii : [radii];
    if (!list.length || list.length > 4) throw new RangeError('Expected one to four corner radii.');
    const values: [number, number][] = [];
    for (const radius of list) {
      const rx = typeof radius === 'number' ? radius : radius.x ?? 0;
      const ry = typeof radius === 'number' ? radius : radius.y ?? 0;
      if (![rx, ry].every(Number.isFinite)) return;
      if (rx < 0 || ry < 0) throw new RangeError('Corner radii must not be negative.');
      values.push([rx, ry]);
    }
    const corners = [values[0], values[1] ?? values[0], values[2] ?? values[0], values[3] ?? values[1] ?? values[0]];
    const w = Math.abs(width), h = Math.abs(height);
    const ratio = (length: number, sum: number) => sum === 0 ? 1 : length / sum;
    const scale = Math.min(1, ratio(w, corners[0][0] + corners[1][0]), ratio(w, corners[2][0] + corners[3][0]),
      ratio(h, corners[0][1] + corners[3][1]), ratio(h, corners[1][1] + corners[2][1]));
    const [tl, tr, br, bl] = corners.map(([rx, ry]) => [rx * scale, ry * scale]);
    const path = new PathGeometry();
    path.moveTo(tl[0], 0);
    path.lineTo(w - tr[0], 0);
    path.ellipse(w - tr[0], tr[1], tr[0], tr[1], 0, -Math.PI / 2, 0);
    path.lineTo(w, h - br[1]);
    path.ellipse(w - br[0], h - br[1], br[0], br[1], 0, 0, Math.PI / 2);
    path.lineTo(bl[0], h);
    path.ellipse(bl[0], h - bl[1], bl[0], bl[1], 0, Math.PI / 2, Math.PI);
    path.lineTo(0, tl[1]);
    path.ellipse(tl[0], tl[1], tl[0], tl[1], 0, Math.PI, Math.PI * 1.5);
    path.closePath();
    // Chromium resumes at the normalized rectangle origin after negative dimensions.
    path.moveTo(width < 0 ? w : 0, height < 0 ? h : 0);
    path.transform({ a: width < 0 ? -1 : 1, d: height < 0 ? -1 : 1, e: x, f: y });
    this.#copyPath(path);
  }

  addPath(other: PathGeometry, matrix: DOMMatrix2DInit = {}): void {
    if (!state(other).count) return;
    const normalized = DOMMatrix.fromMatrix(matrix);
    if (!normalized.is2D) throw new TypeError('PathGeometry requires a 2D affine matrix.');
    if (![normalized.a, normalized.b, normalized.c, normalized.d, normalized.e, normalized.f].every(Number.isFinite)) return;
    const copy = other.clone();
    copy.transform(normalized);
    const value = state(copy);
    append(value, 0, [value.x, value.y]);
    this.#copyPath(copy);
  }

  #copyPath(other: PathGeometry): void {
    const source = state(other), value = state(this);
    ensureRevision(value);
    reserve(value, value.count + source.count, value.length + source.length);
    value.types.set(source.types.subarray(0, source.count), value.count);
    value.data.set(source.data.subarray(0, source.length), value.length);
    value.count += source.count; value.length += source.length;
    value.x = source.x; value.y = source.y;
    value.startX = source.startX; value.startY = source.startY;
    value.revision++;
  }

  spliceSegments(start: number, deleteCount: number, segments: readonly PathSegment[] = []): void {
    const value = state(this);
    if (!Number.isInteger(start) || start < 0 || start > value.count ||
      !Number.isInteger(deleteCount) || deleteCount < 0 || deleteCount > value.count - start) {
      throw new RangeError('Invalid path splice range.');
    }
    const additions = segments.map(segment => ({ type: names.indexOf(segment.type), data: validatedOperands(segment) }));
    const count = value.count - deleteCount + additions.length;
    const firstType = start === 0 ? (additions[0]?.type ?? value.types[deleteCount]) : value.types[0];
    if (count > 0 && firstType !== 0) throw new TypeError('A path must start with a move segment.');
    if (!deleteCount && !additions.length) return;
    ensureRevision(value);
    let offset = 0, removed = 0;
    for (let i = 0; i < start; i++) offset += widths[value.types[i]];
    for (let i = start; i < start + deleteCount; i++) removed += widths[value.types[i]];
    const added = additions.reduce((sum, segment) => sum + segment.data.length, 0);
    const length = value.length - removed + added;
    reserve(value, count, length);
    value.types.copyWithin(start + additions.length, start + deleteCount, value.count);
    value.data.copyWithin(offset + added, offset + removed, value.length);
    for (let i = 0; i < additions.length; i++) {
      value.types[start + i] = additions[i].type;
      value.data.set(additions[i].data, offset);
      offset += additions[i].data.length;
    }
    value.count = count; value.length = length;
    rebuildPoint(value);
    value.revision++;
  }

  #build(type: number, data: number[]): void {
    if (!data.every(Number.isFinite)) return;
    const value = state(this);
    ensureRevision(value);
    if (!value.count && type !== 0) {
      // Canvas starts a missing subpath at the first control point (or endpoint).
      append(value, 0, data.slice(0, 2));
      if (type === 1) {
        value.revision++;
        return;
      }
    }
    append(value, type, data);
    value.revision++;
  }

  #offset(index: number): number {
    const value = state(this);
    if (!Number.isInteger(index) || index < 0 || index >= value.count) {
      throw new RangeError('Path segment index is out of range.');
    }
    let offset = 0;
    for (let i = 0; i < index; i++) offset += widths[value.types[i]];
    return offset;
  }

  getSegment(index: number): PathSegment {
    return readSegment(state(this), index, this.#offset(index));
  }

  setSegment(index: number, segment: PathSegment): void {
    const offset = this.#offset(index);
    const type = names.indexOf(segment.type);
    const data = validatedOperands(segment);
    if (!data.every(Number.isFinite)) throw new RangeError('Path coordinates must be finite.');
    if (index === 0 && type !== 0) throw new TypeError('A path must start with a move segment.');
    const value = state(this);
    ensureRevision(value);
    const oldWidth = widths[value.types[index]];
    const length = value.length + data.length - oldWidth;
    reserve(value, value.count, length);
    value.data.copyWithin(offset + data.length, offset + oldWidth, value.length);
    value.data.set(data, offset);
    value.types[index] = type;
    value.length = length;
    rebuildPoint(value);
    value.revision++;
  }

  /** Applies a finite 2D affine matrix. Old native conversions remain unchanged. */
  transform(matrix: DOMMatrix2DInit): void {
    const input = matrix as DOMMatrixInit;
    const normalized = DOMMatrix.fromMatrix(input);
    if (!normalized.is2D) throw new TypeError('PathGeometry requires a 2D affine matrix.');
    const { a, b, c, d, e, f } = normalized;
    if (![a, b, c, d, e, f].every(Number.isFinite)) {
      throw new RangeError('Path transform must be finite.');
    }
    const value = state(this);
    if (!value.count) return;
    ensureRevision(value);
    // Two passes keep overflow errors atomic without allocating another buffer.
    for (const write of [false, true]) {
      visitPathGeometry(this, (type, data, offset) => {
        const length = type === 5 ? 6 : widths[type];
        for (let i = 0; i < length; i += 2) {
          const x = data[offset + i], y = data[offset + i + 1];
          const vector = type === 5 && i > 0;
          const nextX = a * x + c * y + (vector ? 0 : e);
          const nextY = b * x + d * y + (vector ? 0 : f);
          if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) {
            throw new RangeError('Path transform coordinates overflowed.');
          }
          if (write) { data[offset + i] = nextX; data[offset + i + 1] = nextY; }
        }
      });
    }
    rebuildPoint(value);
    value.revision++;
  }

  *[Symbol.iterator](): IterableIterator<PathSegment> {
    const value = state(this);
    const revision = value.revision;
    let offset = 0;
    for (let index = 0; index < value.count; index++) {
      if (value.revision !== revision) throw new Error('PathGeometry changed during iteration.');
      const width = widths[value.types[index]];
      yield readSegment(value, index, offset);
      if (value.revision !== revision) throw new Error('PathGeometry changed during iteration.');
      offset += width;
    }
  }
}

function readSegment(value: Storage, index: number, offset: number): PathSegment {
  const d = value.data;
  switch (value.types[index]) {
    case 0: return { type: 'move', x: d[offset], y: d[offset + 1] };
    case 1: return { type: 'line', x: d[offset], y: d[offset + 1] };
    case 2: return { type: 'quadratic', cpx: d[offset], cpy: d[offset + 1], x: d[offset + 2], y: d[offset + 3] };
    case 3: return { type: 'cubic', cp1x: d[offset], cp1y: d[offset + 1], cp2x: d[offset + 2], cp2y: d[offset + 3], x: d[offset + 4], y: d[offset + 5] };
    case 5: return { type: 'arc', cx: d[offset], cy: d[offset + 1], ux: d[offset + 2], uy: d[offset + 3], vx: d[offset + 4], vy: d[offset + 5], startAngle: d[offset + 6], sweep: d[offset + 7] };
    default: return { type: 'close' };
  }
}

function validatedOperands(segment: PathSegment): number[] {
  const data = operands(segment);
  if (!data.every(Number.isFinite)) throw new RangeError('Path coordinates must be finite.');
  if (segment.type === 'arc' && (Math.abs(segment.sweep) > TAU || Math.abs(segment.startAngle) > TAU)) {
    throw new RangeError('Arc angles must be normalized to one revolution.');
  }
  return data;
}

function updatePoint(value: Storage, type: number, data: ArrayLike<number>, offset: number): void {
  if (type === 4) { value.x = value.startX; value.y = value.startY; return; }
  if (type === 5) {
    const angle = data[offset + 6] + data[offset + 7];
    value.x = data[offset] + data[offset + 2] * Math.cos(angle) + data[offset + 4] * Math.sin(angle);
    value.y = data[offset + 1] + data[offset + 3] * Math.cos(angle) + data[offset + 5] * Math.sin(angle);
  } else {
    value.x = data[offset + widths[type] - 2]; value.y = data[offset + widths[type] - 1];
  }
  if (type === 0) { value.startX = value.x; value.startY = value.y; }
}
function rebuildPoint(value: Storage): void {
  value.x = value.y = value.startX = value.startY = 0;
  let offset = 0;
  for (let i = 0; i < value.count; i++) {
    updatePoint(value, value.types[i], value.data, offset);
    offset += widths[value.types[i]];
  }
}
