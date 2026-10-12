import { Circle, Group, Line, resolveSignalValue } from "@pibbl/core";
import type {
  FillStyle,
  PibblEventHandlers,
  PibblEventParticipationOptions,
  PibblNode,
  SignalValue,
  StrokeStyle,
} from "@pibbl/core";
import type { SignalStyle } from "@pibbl/core/internal";
import { withHooksForbidden } from "@pibbl/core/internal";
import type { BarCategoryAccessor } from "./bar-series.js";
import type { BandCategory, LineAccessor, ScaleId } from "./types.js";
import { lookupScale } from "./scale-context.js";
import { useContinuousScale } from "./use-continuous-scale.js";
import { finiteCoordinate, pointAccessor, pointData } from "./point-data.js";
import { opacity, width } from "./paint.js";

/** Shared local-pixel geometry and paint for estimate-and-interval marks.
 * @see {@link IntervalSeriesProps}
 */
export interface IntervalSeriesStyle {
  /** Estimate circle radius in local pixels; defaults to 4. */
  readonly radius?: number;
  /** Full perpendicular length of each endpoint cap; defaults to 8 pixels. */
  readonly capSize?: number;
  /** Estimate circle fill; defaults to #087f8c. */
  readonly fill?: FillStyle;
  /** Interval, cap, and circle outline paint; defaults to #087f8c. */
  readonly stroke?: StrokeStyle;
  /** Visible stroke width in local pixels; defaults to 1.5. */
  readonly strokeWidth?: number;
  /** Stroke targeting width, independent of visible width; defaults to strokeWidth. */
  readonly lineInteractionWidth?: number;
  /** Shared paint opacity from zero to one; defaults to 1. */
  readonly opacity?: number;
  /** Cursor for painted mark targets. */
  readonly cursor?: string;
}

/** Explicit supplied estimates and numeric bounds placed at categorical centers.
 * @see {@link HorizontalIntervalSeries}
 * @see {@link VerticalIntervalSeries}
 */
export interface IntervalSeriesProps<D>
  extends PibblEventHandlers, PibblEventParticipationOptions {
  /** Original records, or a signal of records; no estimation is performed. */
  readonly data: SignalValue<readonly D[]>;
  /** Property or callback supplying a category; missing/unknown categories omit rows. */
  readonly category: BarCategoryAccessor<D>;
  /** Property or callback supplying the numeric point estimate. */
  readonly estimate: LineAccessor<D>;
  /** Property or callback supplying the numeric lower bound. */
  readonly lower: LineAccessor<D>;
  /** Property or callback supplying the numeric upper bound. */
  readonly upper: LineAccessor<D>;
  /** Ancestor PointScale or BarScale; band categories use their centers. */
  readonly categoryScale: ScaleId;
  /** Ancestor continuous numeric scale mapping estimate and both bounds independently. */
  readonly valueScale: ScaleId;
  /** Optional synchronous predicate; excluded rows contribute no marks.
   * @param datum - Original record being tested.
   * @param index - Source index of the record.
   * @param data - Complete supplied data array.
   * @returns Whether to include this record's estimate and interval.
   */
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
  /** Shared style; whole-object and shallow field signals are observed by the series. */
  readonly style?: SignalValue<SignalStyle<IntervalSeriesStyle>>;
}

/** Horizontal estimate-and-interval authoring inputs. See {@link HorizontalIntervalSeries}. */
export type HorizontalIntervalSeriesProps<D> = IntervalSeriesProps<D>;
/** Vertical estimate-and-interval authoring inputs. See {@link VerticalIntervalSeries}. */
export type VerticalIntervalSeriesProps<D> = IntervalSeriesProps<D>;

function intervalSeries<D>(
  props: IntervalSeriesProps<D>,
  horizontal: boolean,
): PibblNode {
  const receiver = horizontal
    ? "HorizontalIntervalSeries"
    : "VerticalIntervalSeries";
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
    pointerEvents,
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
  const style: Record<string, unknown> = {};
  for (const key of Object.keys(specified)) {
    if (
      ![
        "radius",
        "capSize",
        "fill",
        "stroke",
        "strokeWidth",
        "lineInteractionWidth",
        "opacity",
        "cursor",
      ].includes(key)
    )
      throw new TypeError(`${receiver}: unsupported style field ${key}.`);
    style[key] = resolveSignalValue(specified[key as keyof typeof specified]);
  }
  const resolved = style as IntervalSeriesStyle;
  const radius = width(resolved.radius ?? 4, `${receiver} radius`);
  const halfCap = width(resolved.capSize ?? 8, `${receiver} capSize`) / 2;
  const strokeWidth = width(resolved.strokeWidth ?? 1.5, receiver);
  const lineInteractionWidth = width(
    resolved.lineInteractionWidth ?? strokeWidth,
    receiver,
  );
  const alpha = opacity(resolved.opacity ?? 1, receiver);
  if (resolved.cursor !== undefined && typeof resolved.cursor !== "string")
    throw new TypeError(`${receiver}: cursor must be a string.`);
  const stroke = resolved.stroke ?? "#087f8c";
  const lineStyle = {
    stroke,
    strokeWidth,
    lineInteractionWidth,
    opacity: alpha,
    cursor: resolved.cursor,
  };
  const nodes: PibblNode[] = [];
  for (let i = 0; i < data.length; i++) {
    const datum = data[i];
    const coordinates = withHooksForbidden(
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
      !coordinates ||
      coordinates.category == null ||
      !finiteCoordinate(coordinates.estimate) ||
      !finiteCoordinate(coordinates.lower) ||
      !finiteCoordinate(coordinates.upper)
    )
      continue;
    const start = categories.map(coordinates.category);
    if (start === undefined) continue;
    if (coordinates.lower > coordinates.upper)
      throw new RangeError(
        `${receiver}: lower must not exceed upper (row ${i}).`,
      );
    const center =
      start + (categories.type === "band" ? categories.bandwidth / 2 : 0);
    const lo = values.map(coordinates.lower),
      hi = values.map(coordinates.upper),
      point = values.map(coordinates.estimate);
    if (![center, lo, hi, point].every(Number.isFinite))
      throw new RangeError(
        `${receiver}: mapped coordinates must be finite (row ${i}).`,
      );
    const position = (value: number, offset = 0): [number, number] =>
      horizontal ? [value, center + offset] : [center + offset, value];
    nodes.push(
      <Group key={i}>
        <Line
          pointerEvents={pointerEvents}
          style={{ ...lineStyle, coords: [position(lo), position(hi)] }}
        />
        {halfCap > 0 && (
          <>
            <Line
              pointerEvents={pointerEvents}
              style={{
                ...lineStyle,
                coords: [position(lo, -halfCap), position(lo, halfCap)],
              }}
            />
            <Line
              pointerEvents={pointerEvents}
              style={{
                ...lineStyle,
                coords: [position(hi, -halfCap), position(hi, halfCap)],
              }}
            />
          </>
        )}
        {radius > 0 && (
          <Circle
            pointerEvents={pointerEvents}
            style={{
              ...lineStyle,
              cx: horizontal ? point : center,
              cy: horizontal ? center : point,
              radius,
              fill: resolved.fill ?? "#087f8c",
            }}
          />
        )}
      </Group>,
    );
  }
  return <Group {...events}>{nodes}</Group>;
}

/**
 * Draw supplied numeric intervals horizontally with an estimate circle per category.
 * Missing/non-finite coordinates omit the entire row; reversed bounds reject it.
 * Mapping does not clamp or clip; compose a Clip when required. Marks use ordinary
 * Line/Circle targets, with series handlers receiving their bubbled events.
 *
 * @param props - Supplied data, categorical/numeric scale IDs, and shared style.
 * @returns Ordinary Pibbl content in source order, interval then circle for each row.
 * @see {@link HorizontalIntervalSeriesProps}
 */
export function HorizontalIntervalSeries<D>(
  props: HorizontalIntervalSeriesProps<D>,
): PibblNode {
  return intervalSeries(props, true);
}

/**
 * Draw supplied numeric intervals vertically with an estimate circle per category.
 * Shares the missing-data, bounds, paint, targeting, and clipping contract of
 * HorizontalIntervalSeries; orientation is explicit in the operation name.
 *
 * @param props - Supplied data, categorical/numeric scale IDs, and shared style.
 * @returns Ordinary Pibbl content in source order, interval then circle for each row.
 * @see {@link VerticalIntervalSeriesProps}
 */
export function VerticalIntervalSeries<D>(
  props: VerticalIntervalSeriesProps<D>,
): PibblNode {
  return intervalSeries(props, false);
}
