import type { PieLayoutProps, PieLayoutSlice } from './pie-types.js';
import type { LineAccessor } from "./types.js";
import type { PlotKeyAccessor } from "./plot-types.js";
import { pointAccessor, pointData } from "./point-data.js";

/**
 * Value and stable-key accessors used to derive pie-slice geometry.
 *
 * @see {@link LineAccessor}
 * @see {@link PlotKeyAccessor}
 * @see {@link pieSlices}
 * @see {@link PieLayoutProps}
 */
export interface PieOptions<D> {
  /** Value associated with this sample, input, or result. See {@link LineAccessor}. */
  readonly value: LineAccessor<D>;
  /** Property or callback supplying stable identity for each datum. See {@link PlotKeyAccessor}. */
  readonly keyBy?: PlotKeyAccessor<D>;
}

/**
 * A datum's key, value, fraction, and angular interval in a pie layout.
 *
 * @see {@link pieSlices}
 * @see {@link PieLayoutProps}
 * @see {@link PieLayoutSlice}
 */
export interface PieSliceGeometry<D> {
  /** The original data item selected by this result. See {@link PieSliceGeometry}. */
  readonly datum: D;
  /** Index of the selected datum in its source data. See {@link PieSliceGeometry}. */
  readonly index: number;
  /** Stable identity used by the containing protocol. See {@link PieSliceGeometry}. */
  readonly key: string;
  /** Value associated with this sample, input, or result. See {@link PieSliceGeometry}. */
  readonly value: number;
  /** Normalized share or position represented by this value. See {@link PieSliceGeometry}. */
  readonly fraction: number;
  /** Angle at which the arc or slice begins. See {@link PieSliceGeometry}. */
  readonly startAngle: number;
  /** Angle at which the arc or slice ends. See {@link PieSliceGeometry}. */
  readonly endAngle: number;
}

/**
 * Pure source-ordered full-circle layout. Angles use Canvas radians, clockwise from the top.
 *
 * @param data - Records whose values determine slice proportions.
 * @param options - Value accessor and optional stable key accessor. See {@link PieOptions}.
 * @returns Ordered slice geometry associated with the input records. See {@link PieSliceGeometry}.
 *
 * @see {@link PieOptions}
 * @see {@link PieSliceGeometry}
 */
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
