import type {
  BandCategory,
  BandDomain,
  ResolvedBandScale,
  ScaleRange,
} from "./types.js";
import { resolveLinearScale } from "./linear-scale.js";

/** Explicit category order; padding is measured in step units. */
export function resolveBandScale(
  input: BandDomain,
  rangeInput: ScaleRange,
  reverse: boolean,
  width: number,
  height: number,
  paddingInner: number,
  paddingOuter: number,
): ResolvedBandScale {
  if (!Array.isArray(input))
    throw new TypeError("Band scale domain must be an array.");
  const indices = new Map<BandCategory, number>();
  for (const category of input) {
    if (
      typeof category !== "string" &&
      (typeof category !== "number" || !Number.isFinite(category))
    )
      throw new TypeError(
        "Band scale categories must be strings or finite numbers.",
      );
    if (indices.has(category))
      throw new TypeError(
        `Band scale duplicate category: ${String(category)}.`,
      );
    indices.set(category, indices.size);
  }
  if (!Number.isFinite(paddingInner) || paddingInner < 0 || paddingInner > 1)
    throw new RangeError("Band scale paddingInner must be between 0 and 1.");
  if (!Number.isFinite(paddingOuter) || paddingOuter < 0)
    throw new RangeError(
      "Band scale paddingOuter must be finite and nonnegative.",
    );
  const { range, frame } = resolveLinearScale(
    [0, 1],
    rangeInput,
    reverse,
    width,
    height,
  );
  const count = input.length;
  const span = Math.abs(range[1] - range[0]);
  const denominator = Math.max(1, count - paddingInner + 2 * paddingOuter);
  if (!Number.isFinite(denominator))
    throw new RangeError("Band scale padding arithmetic must be finite.");
  const step = count === 0 ? 0 : span / denominator;
  const bandwidth = step * (1 - paddingInner);
  const offset = (span - step * (count - paddingInner)) / 2;
  const start = Math.min(...range) + offset;
  const domain = Object.freeze([...input]);
  return Object.freeze({
    type: "band",
    domain,
    range,
    frame,
    bandwidth,
    step,
    map(value: BandCategory) {
      const index = indices.get(value);
      if (index === undefined) return undefined;
      return start + (range[1] < range[0] ? count - 1 - index : index) * step;
    },
  });
}
