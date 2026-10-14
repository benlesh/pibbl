import {
  Group,
  isSignal,
  Rectangle,
  resolveSignalValue,
  useCanvasContext,
} from "@crc/core";
import type {
  CRCEventHandlers,
  CRCEventParticipationOptions,
  CRCNode,
  FillStyle,
  SignalValue,
  StrokeStyle,
} from "@crc/core";
import { withHooksForbidden } from "@crc/core/internal";
import { lookupScale } from "./scale-context.js";
import type { SignalStyle } from "@crc/core/internal";
import type { BandCategory, LineAccessor, ScaleId } from "./types.js";
import { useScale } from "./use-scale.js";
import { pointAccessor, pointData, finiteCoordinate } from "./point-data.js";
import { opacity, width } from "./paint.js";
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
export interface BarSeriesStyle {
  readonly bandwidth?: number | "auto";
  readonly fill?: FillStyle | BarThresholdFill;
  readonly stroke?: StrokeStyle;
  readonly strokeWidth?: number;
  readonly opacity?: number;
  readonly cursor?: string;
}
export type BarStyleResolver<D> = (
  datum: D,
  index: number,
  data: readonly D[],
) => BarSeriesStyle;
interface BarSeriesBaseProps<D>
  extends CRCEventHandlers, CRCEventParticipationOptions {
  readonly data: SignalValue<readonly D[]>;
  readonly orientation?: "vertical" | "horizontal";
  readonly category: BarCategoryAccessor<D>;
  readonly categoryScale: ScaleId;
  readonly valueScale: ScaleId;
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
  readonly style?: SignalValue<
    SignalStyle<BarSeriesStyle> | BarStyleResolver<D>
  >;
}
export type BarSeriesProps<D> = BarSeriesBaseProps<D> &
  (
    | {
        readonly value: LineAccessor<D>;
        readonly baseline?: SignalValue<number>;
        readonly valueStart?: never;
        readonly valueEnd?: never;
      }
    | {
        readonly value?: never;
        readonly baseline?: never;
        readonly valueStart: LineAccessor<D>;
        readonly valueEnd: LineAccessor<D>;
      }
  ) &
  (
    | { readonly group: BarCategoryAccessor<D>; readonly groupScale: ScaleId }
    | { readonly group?: never; readonly groupScale?: never }
  );
/** Value bars in source order; rectangles supply ordinary paint and event geometry. */
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
  ...events
}: BarSeriesProps<D>) {
  const categories = useScale(categoryScale, "band").get();
  const values = useScale(valueScale, "continuous").get();
  const groups = lookupScale(groupScale, "BarSeries groupScale", "band")?.get();
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
    throw new TypeError(
      "BarSeries orientation must be vertical or horizontal.",
    );
  const data = pointData(resolveSignalValue(input), "BarSeries");
  const category =
    typeof categoryInput === "function"
      ? categoryInput
      : (datum: D) => datum[categoryInput] as BandCategory | null | undefined;
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
      fill: barFill(
        ctx,
        resolved.fill ?? "#2563eb",
        (value) => values.map(value),
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
  const nodes: CRCNode[] = [];
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
    nodes.push(
      <Rectangle
        key={i}
        pointerEvents={pointerEvents}
        style={{
          left: vertical
            ? start + (slotWidth - bandwidth) / 2
            : Math.min(base, end),
          top: vertical
            ? Math.min(base, end)
            : start + (slotWidth - bandwidth) / 2,
          width: vertical ? bandwidth : extent,
          height: vertical ? extent : bandwidth,
          fill: fill(from, v),
          stroke,
          strokeWidth,
          opacity: alpha,
          cursor,
        }}
      />,
    );
  }
  return <Group {...events}>{nodes}</Group>;
}
