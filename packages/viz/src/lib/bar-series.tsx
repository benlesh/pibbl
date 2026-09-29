import {
  Group,
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
export interface BarSeriesProps<D>
  extends CRCEventHandlers, CRCEventParticipationOptions {
  readonly data: SignalValue<readonly D[]>;
  readonly orientation?: "vertical";
  readonly x: BarCategoryAccessor<D>;
  readonly y: LineAccessor<D>;
  readonly xScale: ScaleId;
  readonly yScale: ScaleId;
  readonly baseline?: SignalValue<number>;
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
  readonly style?: SignalValue<SignalStyle<BarSeriesStyle>>;
}
/** Value bars in source order; rectangles supply ordinary paint and event geometry. */
export function BarSeries<D>({
  data: input,
  orientation,
  x,
  y,
  xScale,
  yScale,
  baseline,
  defined,
  style: styleInput,
  pointerEvents,
  ...events
}: BarSeriesProps<D>) {
  const categories = useScale(xScale, "band").get();
  const values = useScale(yScale).get();
  if (orientation !== undefined && orientation !== "vertical")
    throw new TypeError(
      "BarSeries currently supports vertical value bars only.",
    );
  const data = pointData(resolveSignalValue(input), "BarSeries");
  const category =
    typeof x === "function"
      ? x
      : (datum: D) => datum[x] as BandCategory | null | undefined;
  const value = pointAccessor(y);
  const baselineValue = resolveSignalValue(baseline ?? 0);
  const base = values.map(baselineValue);
  const style = resolveSignalValue(styleInput) ?? {};
  const requested = resolveSignalValue(style.bandwidth) ?? "auto";
  const bandwidth =
    requested === "auto"
      ? categories.bandwidth
      : width(requested, "BarSeries bandwidth");
  const fill = barFill(
    useCanvasContext(),
    resolveSignalValue(style.fill) ?? "#2563eb",
    (value) => values.map(value),
  );
  const stroke = resolveSignalValue(style.stroke);
  const strokeWidth = width(
    resolveSignalValue(style.strokeWidth) ?? 1,
    "BarSeries strokeWidth",
  );
  const alpha = opacity(resolveSignalValue(style.opacity) ?? 1, "BarSeries");
  const cursor = resolveSignalValue(style.cursor);
  const nodes: CRCNode[] = [];
  for (let i = 0; i < data.length; i++) {
    const datum = data[i];
    if (defined && !defined(datum, i, data)) continue;
    const c = category(datum, i, data),
      v = value(datum, i, data);
    if (c == null || !finiteCoordinate(v)) continue;
    const start = categories.map(c);
    if (start === undefined || bandwidth === 0) continue;
    const end = values.map(v);
    const height = Math.abs(end - base);
    if (!Number.isFinite(height))
      throw new RangeError("BarSeries height must be finite.");
    if (height === 0) continue;
    nodes.push(
      <Rectangle
        key={i}
        pointerEvents={pointerEvents}
        style={{
          x: start + (categories.bandwidth - bandwidth) / 2,
          y: Math.min(base, end),
          width: bandwidth,
          height,
          fill: fill(baselineValue, v),
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
