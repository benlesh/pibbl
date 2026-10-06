import type { BandCategory, BandDomain, ResolvedPointScale, ScaleRange } from "./types.js";
import { resolveLinearScale } from "./linear-scale.js";
export function resolvePointScale(input: BandDomain, rangeInput: ScaleRange, reverse: boolean, width: number, height: number, padding: number): ResolvedPointScale {
  if (!Array.isArray(input)) throw new TypeError("PointScale domain must be an array.");
  const indices = new Map<BandCategory, number>();
  for (const category of input) {
    if (typeof category !== "string" && (typeof category !== "number" || !Number.isFinite(category))) throw new TypeError("PointScale categories must be strings or finite numbers.");
    if (indices.has(category)) throw new TypeError("PointScale domain must not contain duplicate categories.");
    indices.set(category, indices.size);
  }
  if (typeof padding !== "number" || !Number.isFinite(padding) || padding < 0 || !Number.isFinite(2 * padding)) throw new RangeError("PointScale padding must be finite and nonnegative with finite arithmetic.");
  const { range, frame } = resolveLinearScale([0, 1], rangeInput, reverse, width, height);
  const domain = Object.freeze([...input]), span = range[1] - range[0];
  const step = domain.length < 2 ? 0 : span / Math.max(1, domain.length - 1 + 2 * padding);
  const start = range[0] + (span - step * (domain.length - 1)) / 2;
  const map = (value: BandCategory) => { const index = indices.get(value); return index === undefined ? undefined : start + index * step; };
  return Object.freeze({
    type: "point", domain, range, frame, padding, step: Math.abs(step), map,
    invert(pixel: number) {
      if (typeof pixel !== "number" || !Number.isFinite(pixel)) throw new RangeError("PointScale invert input must be finite.");
      if (!domain.length) return undefined;
      if (!step) return domain[0];
      const position = (pixel - start) / step;
      const index = Math.max(0, Math.min(domain.length - 1, Math.ceil(position - 0.5)));
      return domain[index];
    },
    ticks(count = 5) {
      if (!Number.isInteger(count) || count < 0 || count > 100) throw new RangeError("PointScale ticks count must be an integer from 0 to 100.");
      const size = Math.min(count, domain.length);
      return Object.freeze(size === 0 ? [] : size === 1 ? [domain[0]] : Array.from({ length: size }, (_, i) => domain[Math.round(i * (domain.length - 1) / (size - 1))]));
    },
  });
}
