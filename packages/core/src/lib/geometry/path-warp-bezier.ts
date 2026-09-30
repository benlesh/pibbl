/** @internal Homogeneous Bernstein curves, degree at most six after warping. */
export interface WarpSpan { x: number[]; y: number[]; w: number[] }
export type WarpPoint = readonly [number, number];

const choose = Array.from({ length: 8 }, (_, n) => {
  const row = [1];
  for (let i = 1; i <= n; i++) row[i] = row[i - 1] * (n - i + 1) / i;
  return row;
});

export function product(a: readonly number[], b: readonly number[]): number[] {
  const n = a.length - 1, m = b.length - 1;
  const result = new Array<number>(n + m + 1).fill(0);
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= m; j++) {
      result[i + j] += a[i] * b[j] * choose[n][i] * choose[m][j] / choose[n + m][i + j];
    }
  }
  return result;
}

export function endpoint(span: WarpSpan, index: number): WarpPoint {
  const w = span.w[index], x = span.x[index] / w, y = span.y[index] / w;
  if (w === 0 || !Number.isFinite(x) || !Number.isFinite(y)) {
    throw new RangeError('warpPath encountered a projection pole or coordinate overflow.');
  }
  return [x, y];
}

/** Bound |R(t)-lerp(R(0),R(1),t)|, including collinear backtracking. */
function errorBound(span: WarpSpan, ax: number, ay: number, bx: number, by: number): number {
  const n = span.w.length - 1;
  const sign = Math.sign(span.w[0]);
  let lower = Infinity, scale = 0, magnitude = 0;
  for (let i = 0; i <= n; i++) {
    lower = Math.min(lower, sign * span.w[i]);
    scale = Math.max(scale, Math.abs(span.w[i]));
    magnitude = Math.max(magnitude, Math.abs(span.x[i]), Math.abs(span.y[i]));
  }
  if (lower <= 0) return Infinity;
  let bound = 0;
  // Degree elevation of N minus the Bernstein product W*L. Computing
  // centered terms reduces cancellation compared with subtracting products.
  for (let i = 0; i <= n + 1; i++) {
    const t = i / (n + 1);
    let x = 0, y = 0;
    if (i <= n) {
      x += (1 - t) * (span.x[i] - span.w[i] * ax);
      y += (1 - t) * (span.y[i] - span.w[i] * ay);
    }
    if (i > 0) {
      x += t * (span.x[i - 1] - span.w[i - 1] * bx);
      y += t * (span.y[i - 1] - span.w[i - 1] * by);
    }
    bound = Math.max(bound, Math.hypot(x, y));
  }
  const roundoff = 64 * Number.EPSILON * (magnitude + scale * Math.max(Math.abs(ax), Math.abs(ay), Math.abs(bx), Math.abs(by)));
  return (bound + roundoff) / lower;
}

/** Split into reusable buffers. The right destination may alias the input. */
function split(values: readonly number[], left: number[], right: number[], scratch: number[]): void {
  const n = values.length - 1;
  for (let i = 0; i <= n; i++) scratch[i] = values[i];
  left.length = right.length = n + 1;
  left[0] = scratch[0]; right[n] = scratch[n];
  for (let level = 1; level <= n; level++) {
    for (let i = 0; i <= n - level; i++) scratch[i] = scratch[i] / 2 + scratch[i + 1] / 2;
    left[level] = scratch[0]; right[n - level] = scratch[n - level];
  }
}

/** Call-owned workspace; at most 53 frames (degree <= 6), reused across spans. */
export interface WarpWork {
  remaining: number;
  pool: WarpSpan[];
  depths: number[];
  scratch: number[];
}
function frame(work: WarpWork, index: number): WarpSpan {
  return work.pool[index] ?? (work.pool[index] = { x: [], y: [], w: [] });
}
export function emitSpan(span: WarpSpan, tolerance: number, work: WarpWork, emit: (x: number, y: number) => void): void {
  const first = frame(work, 0);
  for (const key of ['x', 'y', 'w'] as const) {
    first[key].length = span[key].length;
    for (let i = 0; i < span[key].length; i++) {
      const value = span[key][i];
      if (!Number.isFinite(value)) throw new RangeError('warpPath homogeneous coordinates overflowed.');
      first[key][i] = value;
    }
  }
  let size = 1;
  work.depths[0] = 0;
  while (size) {
    if (--work.remaining < 0) throw new RangeError('warpPath exceeded its subdivision work limit.');
    const index = --size, current = work.pool[index], depth = work.depths[index];
    const n = current.w.length - 1;
    const aw = current.w[0], bw = current.w[n];
    const ax = current.x[0] / aw, ay = current.y[0] / aw, bx = current.x[n] / bw, by = current.y[n] / bw;
    if (aw === 0 || bw === 0 || !Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(bx) || !Number.isFinite(by)) {
      throw new RangeError('warpPath encountered a projection pole or coordinate overflow.');
    }
    if (Math.sign(aw) !== Math.sign(bw)) throw new RangeError('warpPath crosses a projection pole.');
    // A degree-one rational curve with like-signed weights traverses the
    // endpoint chord monotonically. Nonlinear parameter speed is not error.
    if (n === 1 && 64 * Number.EPSILON * Math.max(Math.abs(ax), Math.abs(ay), Math.abs(bx), Math.abs(by)) <= tolerance) {
      emit(bx, by); continue;
    }
    if (errorBound(current, ax, ay, bx, by) <= tolerance) { emit(bx, by); continue; }
    // 52 halvings exhaust meaningful double-precision parameter resolution.
    if (depth >= 52) throw new RangeError('warpPath cannot certify tolerance or finiteness at available precision.');
    const left = frame(work, index + 1);
    split(current.x, left.x, current.x, work.scratch);
    split(current.y, left.y, current.y, work.scratch);
    split(current.w, left.w, current.w, work.scratch);
    work.depths[index] = work.depths[index + 1] = depth + 1;
    size += 2;
  }
}
