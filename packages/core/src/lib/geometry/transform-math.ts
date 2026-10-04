/** Interval automatic differentiation of an approximating map, along a source span. */
export type Interval = readonly [number, number];
export interface Jet { v: Interval; d: Interval; dd: Interval }
export type Pair = readonly [Jet, Jet];
export const interval = (n: number): Interval => [n, n];
export const addI = (a: Interval, b: Interval): Interval => [a[0] + b[0], a[1] + b[1]];
export const negI = (a: Interval): Interval => [-a[1], -a[0]];
export const mulI = (a: Interval, b: Interval): Interval => {
  if ((a[0] === 0 && a[1] === 0) || (b[0] === 0 && b[1] === 0)) return [0, 0];
  const p = [a[0] * b[0], a[0] * b[1], a[1] * b[0], a[1] * b[1]];
  return [Math.min(...p), Math.max(...p)];
};
export const absI = (a: Interval) => Math.max(Math.abs(a[0]), Math.abs(a[1]));
export const constant = (n: number): Jet => ({ v: interval(n), d: interval(0), dd: interval(0) });
export const add = (a: Jet, b: Jet): Jet => ({ v: addI(a.v, b.v), d: addI(a.d, b.d), dd: addI(a.dd, b.dd) });
export const scale = (a: Jet, n: number): Jet => ({ v: mulI(a.v, interval(n)), d: mulI(a.d, interval(n)), dd: mulI(a.dd, interval(n)) });
export const sub = (a: Jet, b: Jet) => add(a, scale(b, -1));
export const mul = (a: Jet, b: Jet): Jet => ({
  v: mulI(a.v, b.v),
  d: addI(mulI(a.d, b.v), mulI(a.v, b.d)),
  dd: addI(addI(mulI(a.dd, b.v), mulI(a.v, b.dd)), mulI(interval(2), mulI(a.d, b.d))),
});
export const lerp = (a: Jet, b: Jet, t: Jet) => add(a, mul(sub(b, a), t));
export function reciprocal(a: Jet): Jet {
  if (a.v[0] <= 0 && a.v[1] >= 0) return { v: [-Infinity, Infinity], d: [-Infinity, Infinity], dd: [-Infinity, Infinity] };
  const r: Interval = [1 / a.v[1], 1 / a.v[0]];
  const r2 = mulI(r, r), r3 = mulI(r2, r);
  return { v: r, d: negI(mulI(a.d, r2)), dd: addI(mulI(interval(2), mulI(mulI(a.d, a.d), r3)), negI(mulI(a.dd, r2))) };
}
export function trig(a: Jet, cosine = false): Jet {
  function range(v: Interval, cos: boolean): Interval {
    if (!v.every(Number.isFinite) || v[1] - v[0] >= Math.PI * 2) return [-1, 1];
    const f = cos ? Math.cos : Math.sin, offset = cos ? 0 : Math.PI / 2;
    const values = [f(v[0]), f(v[1])];
    for (let k = Math.ceil((v[0] - offset) / Math.PI); k <= Math.floor((v[1] - offset) / Math.PI); k++) values.push(k % 2 ? -1 : 1);
    return [Math.min(...values), Math.max(...values)];
  }
  const v = range(a.v, cosine), first = cosine ? negI(range(a.v, false)) : range(a.v, true);
  return { v, d: mulI(first, a.d), dd: addI(mulI(negI(v), mulI(a.d, a.d)), mulI(first, a.dd)) };
}
