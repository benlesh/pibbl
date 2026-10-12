import {
  Path,
  resolveSignalValue,
  type FillStyle,
  type PibblNode,
  type SignalValue,
  type StrokeStyle,
} from "@pibbl/core";
import { withHooksForbidden, type SignalStyle } from "@pibbl/core/internal";
import type { IntervalSeriesProps } from "./interval-series.js";
import type { BandCategory } from "./types.js";
import { lookupScale } from "./scale-context.js";
import { useContinuousScale } from "./use-continuous-scale.js";
import { finiteCoordinate, pointAccessor, pointData } from "./point-data.js";
import { opacity, width } from "./paint.js";

/** Local-pixel height and shared paint for supplied summary diamonds.
 * @see {@link IntervalDiamondSeries}
 */
export interface IntervalDiamondSeriesStyle {
  /** Full perpendicular height in local pixels; defaults to 12. Zero hides marks. */
  readonly height?: number;
  /** Diamond interior paint; defaults to #087f8c. */
  readonly fill?: FillStyle;
  /** Diamond outline paint; defaults to #087f8c. */
  readonly stroke?: StrokeStyle;
  /** Visible outline width in local pixels; defaults to 1.5. */
  readonly strokeWidth?: number;
  /** Outline targeting width in local pixels; defaults to strokeWidth. */
  readonly lineInteractionWidth?: number;
  /** Shared opacity from zero to one; defaults to 1. */
  readonly opacity?: number;
  /** Cursor shown over painted diamonds. */
  readonly cursor?: string;
}

/** Supplied summary estimates and bounds placed horizontally at categorical centers.
 * @see {@link IntervalSeriesProps}
 * @see {@link IntervalDiamondSeriesStyle}
 */
export interface IntervalDiamondSeriesProps<D> extends Omit<
  IntervalSeriesProps<D>,
  "style"
> {
  /** Whole-object and shallow field signals are observed; per-datum styling is not supported. */
  readonly style?: SignalValue<SignalStyle<IntervalDiamondSeriesStyle>>;
}

/**
 * Draw supplied summary estimates as horizontal diamonds; no pooling or inference.
 * Left/right tips map lower/upper, top/bottom map the estimate. Estimates must
 * lie inside the supplied bounds. Missing/nonfinite rows and unknown categories
 * are omitted; reversed bounds and invalid log values reject included rows.
 * Diamonds share one ordinary Path target; handlers receive ordinary events.
 * Mapping does not clamp or clip. Compose a Clip when required.
 *
 * @param props - Supplied rows, accessors, categorical/value scales, and shared paint.
 * @returns One batched Pibbl Path containing the supplied diamonds in source order.
 * @see {@link IntervalDiamondSeriesProps}
 */
export function IntervalDiamondSeries<D>(
  props: IntervalDiamondSeriesProps<D>,
): PibblNode {
  const receiver = "IntervalDiamondSeries";
  const {
    data: input,
    category: categoryInput,
    estimate: estimateInput,
    lower: lowerInput,
    upper: upperInput,
    categoryScale,
    valueScale,
    defined,
    style: styleInput,
    ...events
  } = props;
  const categories = lookupScale(categoryScale, receiver)?.get();
  const values = useContinuousScale(valueScale).get();
  if (
    !categories ||
    (categories.type !== "point" && categories.type !== "band")
  )
    throw new TypeError(
      `${receiver}: categoryScale requires PointScale or BarScale.`,
    );
  const data = pointData(resolveSignalValue(input), receiver);
  const category =
    typeof categoryInput === "function"
      ? categoryInput
      : (datum: D) => datum[categoryInput] as BandCategory | null | undefined;
  const estimate = pointAccessor(estimateInput),
    lower = pointAccessor(lowerInput),
    upper = pointAccessor(upperInput);
  const specified = resolveSignalValue(styleInput) ?? {};
  if (typeof specified !== "object" || Array.isArray(specified))
    throw new TypeError(`${receiver}: style must be an object.`);
  const resolved: Record<string, unknown> = {};
  for (const key of Object.keys(specified)) {
    if (
      ![
        "height",
        "fill",
        "stroke",
        "strokeWidth",
        "lineInteractionWidth",
        "opacity",
        "cursor",
      ].includes(key)
    )
      throw new TypeError(`${receiver}: unsupported style field ${key}.`);
    resolved[key] = resolveSignalValue(
      specified[key as keyof typeof specified],
    );
  }
  const style = resolved as IntervalDiamondSeriesStyle;
  const halfHeight = width(style.height ?? 12, `${receiver} height`) / 2;
  const strokeWidth = width(style.strokeWidth ?? 1.5, receiver);
  const lineInteractionWidth = width(
    style.lineInteractionWidth ?? strokeWidth,
    receiver,
  );
  const alpha = opacity(style.opacity ?? 1, receiver);
  if (style.cursor !== undefined && typeof style.cursor !== "string")
    throw new TypeError(`${receiver}: cursor must be a string.`);
  const path = new Path2D();
  for (let i = 0; i < data.length; i++) {
    const datum = data[i];
    const row = withHooksForbidden(
      `${receiver}: accessors cannot call hooks.`,
      () => {
        if (defined && !defined(datum, i, data)) return undefined;
        return {
          category: category(datum, i, data),
          estimate: estimate(datum, i, data),
          lower: lower(datum, i, data),
          upper: upper(datum, i, data),
        };
      },
    );
    if (
      !row ||
      row.category == null ||
      !finiteCoordinate(row.estimate) ||
      !finiteCoordinate(row.lower) ||
      !finiteCoordinate(row.upper)
    )
      continue;
    const start = categories.map(row.category);
    if (start === undefined) continue;
    if (row.lower > row.upper)
      throw new RangeError(
        `${receiver}: lower must not exceed upper (row ${i}).`,
      );
    if (row.estimate < row.lower || row.estimate > row.upper)
      throw new RangeError(
        `${receiver}: estimate must lie inside supplied bounds (row ${i}).`,
      );
    const center =
      start + (categories.type === "band" ? categories.bandwidth / 2 : 0);
    const lo = values.map(row.lower),
      hi = values.map(row.upper),
      point = values.map(row.estimate);
    if (
      ![center - halfHeight, center + halfHeight, lo, hi, point].every(
        Number.isFinite,
      )
    )
      throw new RangeError(
        `${receiver}: mapped coordinates must be finite (row ${i}).`,
      );
    if (halfHeight === 0) continue;
    path.moveTo(lo, center);
    path.lineTo(point, center - halfHeight);
    path.lineTo(hi, center);
    path.lineTo(point, center + halfHeight);
    path.closePath();
  }
  return (
    <Path
      {...events}
      style={{
        d: path,
        fill: style.fill ?? "#087f8c",
        stroke: style.stroke ?? "#087f8c",
        strokeWidth,
        lineInteractionWidth,
        opacity: alpha,
        cursor: style.cursor,
      }}
    />
  );
}
