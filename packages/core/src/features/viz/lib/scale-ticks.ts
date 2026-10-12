import { resolveSignalValue } from "@pibbl/core";
import type { AxisProps, BandCategory, ResolvedScale } from "./types.js";
type Tick = number | string;

export function ticks(scale: ResolvedScale, props: Pick<AxisProps, "tickValues" | "tickCount">): readonly Tick[] {
  if (props.tickValues !== undefined && props.tickCount !== undefined)
    throw new TypeError("Axis tickValues and tickCount are mutually exclusive.");
  const explicit = props.tickValues === undefined
    ? undefined
    : resolveSignalValue(props.tickValues);
  if (explicit !== undefined) {
    if (!Array.isArray(explicit) || explicit.length > 100)
      throw new RangeError("Axis tickValues must be an array with at most 100 values.");
    const seen = new Set<Tick>();
    for (const value of explicit) {
      if (seen.has(value)) throw new RangeError("Axis tickValues must not contain duplicates.");
      seen.add(value);
      if (scale.type !== "band" && scale.type !== "point") {
        if (typeof value !== "number" || !Number.isFinite(value))
          throw new TypeError("Axis tickValues for a continuous scale must be finite numbers.");
        const [a, b] = scale.domain;
        if (value < Math.min(a, b) || value > Math.max(a, b))
          throw new RangeError("Axis tickValues must be within the scale domain.");
      } else if (
        (typeof value !== "string" &&
          (typeof value !== "number" || !Number.isFinite(value))) ||
        scale.map(value as BandCategory) === undefined
      ) {
        throw new RangeError("Axis tickValues must be known band categories.");
      }
    }
    return explicit;
  }
  const count = resolveSignalValue(props.tickCount ?? 5);
  if (!Number.isInteger(count) || count < 0 || count > 100)
    throw new RangeError("Axis tickCount must be an integer from 0 to 100.");
  if (count === 0) return [];
  if (scale.type !== "band" && scale.type !== "point")
    return count === 1 ? [scale.domain[0]] : scale.ticks(count);
  const n = scale.domain.length;
  if (n === 0) return [];
  if (count === 1) return [scale.domain[0]];
  const m = Math.min(count, n);
  if (m === 1) return [scale.domain[0]];
  return Array.from(
    { length: m },
    (_, index) => scale.domain[Math.round((index * (n - 1)) / (m - 1))]!,
  );
}

export function position(scale: ResolvedScale, value: Tick): number {
  if (scale.type === "point") return scale.map(value as BandCategory)!;
  return scale.type === "band"
    ? scale.map(value as BandCategory)! + scale.bandwidth / 2
    : scale.map(value as number);
}

