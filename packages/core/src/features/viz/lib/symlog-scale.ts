import type { LinearDomain, ResolvedSymlogScale, ScaleRange } from "./types.js";
import { resolveLinearScale } from "./linear-scale.js";
import { linearTicks } from "./numeric-ticks.js";
export function resolveSymlogScale(domain: LinearDomain, range: ScaleRange, reverse: boolean, width: number, height: number, constant: number): ResolvedSymlogScale {
  if (typeof constant !== "number" || !Number.isFinite(constant) || constant <= 0)
    throw new RangeError("SymlogScale constant must be finite and positive.");
  const original = resolveLinearScale(domain, range, reverse, width, height);
  const transform = (value: number) => {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new RangeError("SymlogScale map input must be finite.");
    const ratio = Math.abs(value) / constant;
    return Math.sign(value) * (Number.isFinite(ratio) ? Math.log1p(ratio) : Math.log(Math.abs(value)) - Math.log(constant));
  };
  const mapping = resolveLinearScale([transform(domain[0]), transform(domain[1])], original.range, false, width, height);
  return Object.freeze({
    ...original, type: "symlog", constant,
    map(value: number) { return mapping.map(transform(value)); },
    invert(pixel: number) {
      if (mapping.range[0] !== mapping.range[1]) {
        if (pixel === mapping.range[0]) return original.domain[0];
        if (pixel === mapping.range[1]) return original.domain[1];
      }
      const t = mapping.invert(pixel), magnitude = Math.abs(t);
      const value = Math.sign(t) * (magnitude < 700 ? constant * Math.expm1(magnitude) : Math.exp(magnitude + Math.log(constant)) - constant);
      if (!Number.isFinite(value)) throw new RangeError("SymlogScale inverted output must be finite.");
      return value || 0;
    },
    ticks(count = 5) { return linearTicks(original.domain, { count }); },
  });
}
