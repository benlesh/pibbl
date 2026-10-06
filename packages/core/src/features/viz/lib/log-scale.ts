import type { LinearDomain, ResolvedLogScale, ScaleRange } from "./types.js";
import { resolveLinearScale } from "./linear-scale.js";
function positive(value: number, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    throw new RangeError(`LogScale ${field} must be finite and positive.`);
  return value;
}
export function resolveLogScale(domainInput: LinearDomain, range: ScaleRange, reverse: boolean, width: number, height: number, base: number): ResolvedLogScale {
  if (typeof base !== "number" || !Number.isFinite(base) || base <= 1)
    throw new RangeError("LogScale base must be finite and greater than one.");
  if (!Array.isArray(domainInput) || domainInput.length !== 2)
    throw new RangeError("LogScale domain requires two positive endpoints.");
  const domain = Object.freeze([positive(domainInput[0], "domain"), positive(domainInput[1], "domain")] as const);
  const logarithm = (value: number) => Math.log(positive(value, "map input"));
  const mapping = resolveLinearScale([logarithm(domain[0]), logarithm(domain[1])], range, reverse, width, height);
  return Object.freeze({
    ...mapping, type: "log", domain, base,
    map(value: number) { return mapping.map(logarithm(value)); },
    invert(pixel: number) {
      if (pixel === mapping.range[0] && mapping.range[0] !== mapping.range[1]) return domain[0];
      if (pixel === mapping.range[1] && mapping.range[0] !== mapping.range[1]) return domain[1];
      return positive(Math.exp(mapping.invert(pixel)), "inverted output");
    },
    ticks(count = 5) {
      if (!Number.isInteger(count) || count < 2 || count > 100)
        throw new RangeError("LogScale ticks count must be an integer from 2 to 100.");
      if (count === 2) return Object.freeze([...domain]);
      const lo = Math.min(...domain), hi = Math.max(...domain);
      const first = Math.floor(Math.log(lo) / Math.log(base)) + 1;
      const last = Math.ceil(Math.log(hi) / Math.log(base)) - 1;
      if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last))
        throw new RangeError("LogScale tick exponents exceed numeric precision; choose a larger base.");
      const stride = Math.max(1, Math.ceil((last - first + 1) / (count - 2)));
      const ticks: number[] = [lo];
      for (let i = 0; i < count - 2; i++) {
        const exponent = first + i * stride;
        if (exponent > last) break;
        const value = base ** exponent;
        if (Number.isFinite(value) && value > ticks[ticks.length - 1] && value < hi) ticks.push(value);
      }
      ticks.push(hi);
      return Object.freeze(domain[0] > domain[1] ? ticks.reverse() : ticks);
    },
  });
}
