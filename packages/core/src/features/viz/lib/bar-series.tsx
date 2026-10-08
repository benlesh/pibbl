import {
  Group,
  isSignal,
  Rectangle,
  resolveSignalValue,
  useCanvasContext,
} from "@pibbl/core";
import type {
  PibblEventHandlers,
  PibblEventParticipationOptions,
  PibblNode,
  FillStyle,
  SignalValue,
  StrokeStyle,
} from "@pibbl/core";
import { withHooksForbidden } from "@pibbl/core/internal";
import { lookupScale } from "./scale-context.js";
import type { SignalStyle } from "@pibbl/core/internal";
import type { BandCategory, LineAccessor, ScaleId } from "./types.js";
import { useContinuousScale } from "./use-continuous-scale.js";
import { useBarScale } from "./use-bar-scale.js";
import { pointAccessor, pointData, finiteCoordinate } from "./point-data.js";
import { opacity, width } from "./paint.js";
/**
 * A data property or callback that extracts a category, with nullish values treated as missing.
 *
 * @param datum - Datum whose category is being read.
 * @param index - Zero-based index in the source data.
 * @param data - Complete source data array.
 * @returns The category, or null/undefined to indicate a missing category. See
 * {@link BandCategory} .
 *
 * @see {@link BandCategory}
 * @see {@link BarSeriesProps}
 */
export type BarCategoryAccessor<D> =
  | {
      [K in keyof D]-?: D[K] extends BandCategory | null | undefined
        ? K
        : never;
    }[keyof D]
  | ((
      datum: D,
      index: number,
      data: readonly D[],
    ) => BandCategory | null | undefined);
import { barFill, type BarThresholdFill } from "./bar-fill.js";
export type { BarThresholdFill } from "./bar-fill.js";
/**
 * Supported geometry and presentation properties for BarSeries.
 *
 * @see {@link FillStyle}
 * @see {@link BarThresholdFill}
 * @see {@link StrokeStyle}
 * @see {@link BarStyleResolver}
 */
export interface BarSeriesStyle {
  /** Width allocated to one categorical band. See {@link BarSeriesStyle}. */
  readonly bandwidth?: number | "auto";
  /** Paint used for the interior. See {@link FillStyle}, {@link BarThresholdFill}. */
  readonly fill?: FillStyle | BarThresholdFill;
  /** Paint used for the outline. See {@link StrokeStyle}. */
  readonly stroke?: StrokeStyle;
  /** Width of the painted outline. See {@link BarSeriesStyle}. */
  readonly strokeWidth?: number;
  /** Opacity of the painted result. See {@link BarSeriesStyle}. */
  readonly opacity?: number;
  /** Cursor shown while this target owns pointer presentation. See {@link BarSeriesStyle}. */
  readonly cursor?: string;
}
/**
 * Computes bar styling from the datum, index, and source data.
 *
 * @param datum - Datum being styled.
 * @param index - Zero-based index in the source data.
 * @param data - Complete source data array.
 * @returns Style for this datum's bar. See {@link BarSeriesStyle}.
 *
 * @see {@link BarSeriesStyle}
 */
export type BarStyleResolver<D> = (
  datum: D,
  index: number,
  data: readonly D[],
) => BarSeriesStyle;
/**
 * Shared data, category/value scales, orientation, filtering, and styling for bar variants.
 *
 * @see {@link BarCategoryAccessor}
 * @see {@link BarSeriesStyle}
 * @see {@link BarSeriesProps}
 */
interface BarSeriesBaseProps<D> extends PibblEventHandlers, PibblEventParticipationOptions {
  /**
   * Application data supplied to the component or reported by the event. See {@link SignalValue}.
   */
  readonly data: SignalValue<readonly D[]>;
  /** Optional committed bar capture; rendering alone performs no inspection searches. */
  readonly inspection?: import("../inspection/bar.js").BarInspectionRef<D>;
  /** Selects `"vertical"`, `"horizontal"` for orientation. See {@link BarSeriesBaseProps}. */
  readonly orientation?: "vertical" | "horizontal";
  /** Property or callback extracting a bar's discrete category. See {@link BarCategoryAccessor}. */
  readonly category: BarCategoryAccessor<D>;
  /** Band scale used to place categories. See {@link ScaleId}. */
  readonly categoryScale: ScaleId;
  /** Numeric scale used to map bar values. See {@link ScaleId}. */
  readonly valueScale: ScaleId;
  /**
   * Selects the records that participate in the bar series. See {@link BarSeriesProps}.
   * @param datum - Record to test.
   * @param index - Zero-based index in the source array.
   * @param data - Complete source data array.
   * @returns Whether this record should contribute a bar.
   */
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
  /**
   * Declared presentation and layout properties. See {@link SignalValue}, {@link SignalStyle},
   * {@link BarSeriesStyle}, {@link BarStyleResolver}.
   */
  readonly style?: SignalValue<SignalStyle<BarSeriesStyle> | BarStyleResolver<D>>;
}
/**
 * Authored inputs for BarSeries, including the declared data and presentation options.
 *
 * @see {@link LineAccessor}
 * @see {@link SignalValue}
 * @see {@link BarCategoryAccessor}
 * @see {@link ScaleId}
 * @see {@link BarSeries}
 */
export type BarSeriesProps<D> = BarSeriesBaseProps<D> &
  (
    | {
        /** Value associated with this sample, input, or result. See {@link LineAccessor}. */
        readonly value: LineAccessor<D>;
        /** Numeric value from which each ordinary bar starts. See {@link SignalValue}. */
        readonly baseline?: SignalValue<number>;
        /**
         * Not accepted in this variant; use the alternative fields instead. See
         * {@link BarSeriesProps}.
         */
        readonly valueStart?: never;
        /**
         * Not accepted in this variant; use the alternative fields instead. See
         * {@link BarSeriesProps}.
         */
        readonly valueEnd?: never;
      }
    | {
        /**
         * Not accepted in this variant; use the alternative fields instead. See
         * {@link BarSeriesProps}.
         */
        readonly value?: never;
        /**
         * Not accepted in this variant; use the alternative fields instead. See
         * {@link BarSeriesProps}.
         */
        readonly baseline?: never;
        /** Accessor for the beginning of a range bar. See {@link LineAccessor}. */
        readonly valueStart: LineAccessor<D>;
        /** Accessor for the end of a range bar. See {@link LineAccessor}. */
        readonly valueEnd: LineAccessor<D>;
      }
  ) &
  (
    | {
        /** Accessor identifying the subgroup of each bar. See {@link BarCategoryAccessor}. */
        readonly group: BarCategoryAccessor<D>;
        /** Band scale used to place subgroups within a category. See {@link ScaleId}. */
        readonly groupScale: ScaleId;
      }
    | {
        /** Accessor identifying the subgroup of each bar. See {@link BarSeriesProps}. */
        readonly group?: never;
        /**
         * Not accepted in this variant; use the alternative fields instead. See
         * {@link BarSeriesProps}.
         */
        readonly groupScale?: never;
      }
  );
/**
 * Value bars in source order; rectangles supply ordinary paint and event geometry.
 *
 * @param props - Data, category and value accessors, scales, grouping, and styling. See
 * {@link BarSeriesProps} .
 * @returns Pibbl nodes drawing the bars.
 *
 * @see {@link BarSeriesProps}
 */
export function BarSeries<D>({
  data: input,
  orientation = "vertical",
  category: categoryInput,
  value: valueInput,
  valueStart,
  valueEnd,
  categoryScale,
  valueScale,
  baseline,
  group,
  groupScale,
  defined,
  style: styleInput,
  pointerEvents,
  inspection,
  ...events
}: BarSeriesProps<D>) {
  const categories = useBarScale(categoryScale).get();
  const values = useContinuousScale(valueScale).get();
  const groups = lookupScale(groupScale, "BarSeries groupScale")?.get();
  if ((group === undefined) !== (groupScale === undefined))
    throw new TypeError("BarSeries requires group and groupScale together.");
  if (groups && groups.type !== "band")
    throw new TypeError("BarSeries groupScale requires a band scale.");
  const groupValue =
    typeof group === "function"
      ? group
      : (datum: D) =>
          group === undefined
            ? undefined
            : (datum[group] as BandCategory | null | undefined);
  const slotWidth =
    groups?.type === "band" ? groups.bandwidth : categories.bandwidth;
  if (orientation !== "vertical" && orientation !== "horizontal")
    throw new TypeError("BarSeries orientation must be vertical or horizontal.");
  const data = pointData(resolveSignalValue(input), "BarSeries");
  const category =
    typeof categoryInput === "function"
      ? categoryInput
      : (datum: D) =>
          datum[categoryInput] as BandCategory | null | undefined;
  const ranged = valueStart !== undefined || valueEnd !== undefined;
  if (
    ranged
      ? valueInput !== undefined ||
        baseline !== undefined ||
        valueStart === undefined ||
        valueEnd === undefined
      : valueInput === undefined
  )
    throw new TypeError(
      "BarSeries requires either value with optional baseline, or both valueStart and valueEnd without value or baseline.",
    );
  const value = pointAccessor((ranged ? valueEnd : valueInput)!);
  const startValue = ranged ? pointAccessor(valueStart!) : undefined;
  const baselineValue = resolveSignalValue(baseline ?? 0);
  const sharedBase = ranged ? undefined : values.map(baselineValue);
  const specified = resolveSignalValue(styleInput);
  const ctx = useCanvasContext();
  function normalize(input: unknown, callback: boolean) {
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new TypeError("BarSeries style must be an object.");
    if (
      callback &&
      Object.getPrototypeOf(input) !== Object.prototype &&
      Object.getPrototypeOf(input) !== null
    )
      throw new TypeError(
        "BarSeries datum style must be a plain synchronous object.",
      );
    const style: Record<string, unknown> = {};
    for (const key of Object.keys(input)) {
      if (
        ![
          "bandwidth",
          "fill",
          "stroke",
          "strokeWidth",
          "opacity",
          "cursor",
        ].includes(key)
      )
        throw new TypeError(`BarSeries: unsupported style field ${key}.`);
      const value = (input as Record<string, unknown>)[key];
      if (callback && isSignal(value))
        throw new TypeError(
          "BarSeries datum styles require plain values; read signals explicitly.",
        );
      style[key] = callback ? value : resolveSignalValue(value);
    }
    const resolved = style as BarSeriesStyle;
    if (resolved.cursor !== undefined && typeof resolved.cursor !== "string")
      throw new TypeError("BarSeries cursor must be a string.");
    return {
      bandwidth:
        resolved.bandwidth === undefined || resolved.bandwidth === "auto"
          ? slotWidth
          : width(resolved.bandwidth, "BarSeries bandwidth"),
      fill: barFill(ctx, resolved.fill ?? "#2563eb", (value) =>
        values.map(value),
        orientation,
      ),
      stroke: resolved.stroke,
      strokeWidth: width(resolved.strokeWidth ?? 1, "BarSeries strokeWidth"),
      alpha: opacity(resolved.opacity ?? 1, "BarSeries"),
      cursor: resolved.cursor,
    };
  }
  const shared =
    typeof specified === "function"
      ? undefined
      : normalize(specified ?? {}, false);
  const nodes: PibblNode[] = [];
  const captured: import("../inspection/bar.js").CapturedBarMark<D>[] | undefined = inspection ? [] : undefined;
  for (let i = 0; i < data.length; i++) {
    const datum = data[i];
    if (defined && !defined(datum, i, data)) continue;
    const c = category(datum, i, data),
      v = value(datum, i, data),
      from = startValue ? startValue(datum, i, data) : baselineValue;
    if (c == null || !finiteCoordinate(v) || !finiteCoordinate(from)) continue;
    const categoryStart = categories.map(c);
    const g = groups ? groupValue(datum, i, data) : undefined;
    const offset = groups ? (g == null ? undefined : groups.map(g)) : 0;
    if (categoryStart === undefined || offset === undefined || slotWidth === 0)
      continue;
    const start = categoryStart + offset;
    const { bandwidth, fill, stroke, strokeWidth, alpha, cursor } =
      shared ??
      normalize(
        withHooksForbidden("BarSeries style callback", () =>
          (specified as BarStyleResolver<D>)(datum, i, data),
        ),
        true,
      );
    if (bandwidth === 0) continue;
    const base = sharedBase ?? values.map(from);
    const end = values.map(v);
    const extent = Math.abs(end - base);
    if (!Number.isFinite(extent))
      throw new RangeError("BarSeries value extent must be finite.");
    if (extent === 0) continue;
    const vertical = orientation === "vertical";
    const markFill = fill(from,v);
    captured?.push(Object.freeze({datum,sourceIndex:i,category:c,group:g ?? undefined,valueStart:from,valueEnd:v,
      boundsLocal:Object.freeze({x:vertical?start+(slotWidth-bandwidth)/2:Math.min(base,end),y:vertical?Math.min(base,end):start+(slotWidth-bandwidth)/2,width:vertical?bandwidth:extent,height:vertical?extent:bandwidth}),
      fill:!!markFill,strokeWidthLocal:stroke?strokeWidth:0}));
    nodes.push(
      <Rectangle
        key={i}
        pointerEvents={pointerEvents}
        style={{
          left: vertical ? start + (slotWidth - bandwidth) / 2 : Math.min(base, end),
          top: vertical ? Math.min(base, end) : start + (slotWidth - bandwidth) / 2,
          width: vertical ? bandwidth : extent,
          height: vertical ? extent : bandwidth,
          fill: markFill,
          stroke,
          strokeWidth,
          opacity: alpha,
          cursor,
        }}
      />,
    );
  }
  if (inspection) inspection.capture(captured!);
  return <Group {...events}>{nodes}</Group>;
}
