import type { LineAccessor } from "./types.js";
import type { PlotKeyAccessor } from "./plot-types.js";
import { pointAccessor, pointData } from "./point-data.js";

export interface PieOptions<D> {
  readonly value: LineAccessor<D>;
  readonly keyBy?: PlotKeyAccessor<D>;
}

export interface PieSliceGeometry<D> {
  readonly datum: D;
  readonly index: number;
  readonly key: string;
  readonly value: number;
  readonly fraction: number;
  readonly startAngle: number;
  readonly endAngle: number;
}

/** Pure source-ordered full-circle layout. Angles use Canvas radians, clockwise from the top. */
export function pieSlices<D>(
  data: readonly D[],
  { value: input, keyBy }: PieOptions<D>,
): readonly PieSliceGeometry<D>[] {
  pointData(data, "pieSlices");
  const accessor = pointAccessor(input);
  const keys = new Set<string>();
  let total = 0;
  const rows = data.map((datum, index) => {
    const raw = accessor(datum, index, data);
    const value = raw == null ? 0 : raw;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
      throw new RangeError(
        `pieSlices: value at index ${index} must be finite and nonnegative, null, or undefined.`,
      );
    total += value;
    const rawKey =
      keyBy === undefined
        ? index
        : typeof keyBy === "function"
          ? keyBy(datum, index, data)
          : datum[keyBy];
    if (
      typeof rawKey !== "string" &&
      (typeof rawKey !== "number" || !Number.isFinite(rawKey))
    )
      throw new TypeError(
        `pieSlices: keyBy at index ${index} must return a string or finite number.`,
      );
    const key = String(rawKey);
    if (keys.has(key)) throw new Error(`pieSlices: duplicate key "${key}".`);
    keys.add(key);
    return { datum, index, key, value };
  });
  if (!Number.isFinite(total))
    throw new RangeError(
      "pieSlices: value total must be finite; rescale the values.",
    );
  const start = -Math.PI / 2;
  let sum = 0;
  let angle = start;
  return Object.freeze(
    rows.map((row) => {
      const startAngle = angle;
      sum += row.value;
      if (total > 0 && row.value > 0)
        angle = start + (sum / total) * Math.PI * 2;
      return Object.freeze({
        ...row,
        fraction: total === 0 ? 0 : row.value / total,
        startAngle,
        endAngle: angle,
      });
    }),
  );
}
