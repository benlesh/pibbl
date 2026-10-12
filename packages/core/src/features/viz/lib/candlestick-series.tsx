import {
  Group,
  Path,
  resolveSignalValue,
  type FillStyle,
  type StrokeStyle,
  type SignalValue,
  type PibblEventHandlers,
  type PibblEventParticipationOptions,
  type PibblNode,
} from "@pibbl/core";
import { withHooksForbidden } from "@pibbl/core/internal";
import type { LineAccessor, ScaleId } from "./types.js";
import type {
  CandleInspectionRef,
  CapturedCandleMark,
} from "../inspection/candle.js";
import { useNumericPosition } from "./series-position.js";
import { useContinuousScale } from "./use-continuous-scale.js";
import { pointAccessor, pointData, finiteCoordinate } from "./point-data.js";
import { financialMarkWidth, candleGeometry } from "./financial-geometry.js";
import { opacity, width } from "./paint.js";
/** Open/close body paint, independent from wick paint.
 * @see {@link CandlestickSeries}
 */
export interface CandleBodyStyle {
  /** Interior; default teal for close >= open, coral otherwise. Empty string disables fill. */ readonly fill?: FillStyle;
  /** Optional body outline. */ readonly stroke?: StrokeStyle;
  /** Nonnegative local outline width; default 1. */ readonly strokeWidth?: number;
}
/** High/low wick paint.
 * @see {@link CandlestickSeries}
 */
export interface CandleWickStyle {
  /** Wick paint; default dark teal. Empty string disables wick paint. */ readonly stroke?: StrokeStyle;
  /** Nonnegative local width; default 1. */ readonly strokeWidth?: number;
}
/** Accepted named body/wick presentation for OHLC marks.
 * @see {@link CandlestickSeries}
 */
export interface CandlestickSeriesStyle {
  /** Positive local body width, or automatic 70% spacing capped at 12; singleton fallback 8. */ readonly bandwidth?:
    number | "auto";
  /** Independent open/close body appearance. */ readonly body?: CandleBodyStyle;
  /** Independent high/low wick appearance. */ readonly wick?: CandleWickStyle;
  /** Opacity zero through one; default 1. */ readonly opacity?: number;
  /** Cursor while the series owns targeting. */ readonly cursor?: string;
}
/** Source-ordered OHLC records with named accessors and optional shared inspection.
 * @see {@link CandlestickSeries}
 */
export interface CandlestickSeriesProps<D>
  extends PibblEventHandlers, PibblEventParticipationOptions {
  /** Original records/signal; never sorted or mutated. */ readonly data: SignalValue<
    readonly D[]
  >;
  /** UTC-millisecond property or callback. */ readonly time: LineAccessor<D>;
  /** Open price property or callback. */ readonly open: LineAccessor<D>;
  /** High price property or callback. */ readonly high: LineAccessor<D>;
  /** Low price property or callback. */ readonly low: LineAccessor<D>;
  /** Close price property or callback. */ readonly close: LineAccessor<D>;
  /** Numeric/UTC/trading horizontal mapping identity. */ readonly xScale: ScaleId;
  /** Independent numeric price mapping identity. */ readonly yScale: ScaleId;
  /** Tests original rows before accessor evaluation.
   * @param datum - Original row.
   * @param index - Source index including skipped rows.
   * @param data - Original complete array.
   * @returns Whether the candle participates.
   */ readonly defined?: (
    datum: D,
    index: number,
    data: readonly D[],
  ) => boolean;
  /** Named body/wick appearance or a hook-free datum resolver.
   * @param datum - Original row.
   * @param index - Original source index.
   * @param data - Complete source array.
   * @returns Plain named candle styles.
   */ readonly style?:
    | SignalValue<CandlestickSeriesStyle>
    | ((datum: D, index: number, data: readonly D[]) => CandlestickSeriesStyle);
  /** Optional capture on the ordinary inspection foundation; no queries while painting. */ readonly inspection?: CandleInspectionRef<D>;
}
/**
 * Paints OHLC bodies and wicks, preserving source order and skipping complete missing candles.
 * Finite malformed OHLC rejects; equal open/close paints a one-local-unit doji.
 * @param props - Named OHLC accessors, scales, styles and optional inspection.
 * @returns Ordinary Pibbl composition; disjoint equal styles share paint paths.
 * @see {@link CandlestickSeriesProps}
 */
export function CandlestickSeries<D>({
  data: input,
  time: timeInput,
  open: openInput,
  high: highInput,
  low: lowInput,
  close: closeInput,
  xScale,
  yScale,
  defined,
  style: styleInput,
  inspection,
  pointerEvents,
  ...events
}: CandlestickSeriesProps<D>): PibblNode {
  const xs = useNumericPosition(xScale),
    ys = useContinuousScale(yScale).get();
  const data = pointData(resolveSignalValue(input), "CandlestickSeries");
  const time = pointAccessor(timeInput),
    open = pointAccessor(openInput),
    high = pointAccessor(highInput),
    low = pointAccessor(lowInput),
    close = pointAccessor(closeInput);
  const rows: {
    datum: D;
    sourceIndex: number;
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    x: number;
  }[] = [];
  for (let i = 0; i < data.length; i++) {
    const datum = data[i];
    if (defined && !defined(datum, i, data)) continue;
    const t = time(datum, i, data),
      o = open(datum, i, data),
      h = high(datum, i, data),
      l = low(datum, i, data),
      c = close(datum, i, data);
    if (
      !finiteCoordinate(t) ||
      !finiteCoordinate(o) ||
      !finiteCoordinate(h) ||
      !finiteCoordinate(l) ||
      !finiteCoordinate(c)
    )
      continue;
    if (l > Math.min(o, c) || h < Math.max(o, c))
      throw new RangeError(
        `CandlestickSeries: malformed OHLC at source index ${i}; require low <= open/close <= high.`,
      );
    rows.push({
      datum,
      sourceIndex: i,
      time: t,
      open: o,
      high: h,
      low: l,
      close: c,
      x: xs.map(t),
    });
  }
  const defaultWidth = financialMarkWidth(rows.map((row) => row.x));
  const specified =
    typeof styleInput === "function"
      ? styleInput
      : resolveSignalValue(styleInput);
  const marks: CapturedCandleMark<D>[] | undefined = inspection
    ? []
    : undefined;
  const batches: {
    body: Path2D;
    wick: Path2D;
    fill: FillStyle;
    bodyStroke: StrokeStyle | undefined;
    bodyWidth: number;
    wickStroke: StrokeStyle;
    wickWidth: number;
    opacity: number;
    cursor: string | undefined;
    minX: number;
    maxX: number;
  }[] = [];
  for (const row of rows) {
    const style =
      typeof specified === "function"
        ? withHooksForbidden("CandlestickSeries style callback", () =>
            specified(row.datum, row.sourceIndex, data),
          )
        : (specified ?? {});
    const markWidth =
      style.bandwidth === undefined || style.bandwidth === "auto"
        ? defaultWidth
        : financialMarkWidth([], { width: style.bandwidth });
    const g = candleGeometry({
      centerX: row.x,
      openY: ys.map(row.open),
      closeY: ys.map(row.close),
      highY: ys.map(row.high),
      lowY: ys.map(row.low),
      width: markWidth,
      dojiHeight: 1,
    });
    const fill =
        style.body?.fill ?? (row.close >= row.open ? "#087f8c" : "#d9674c"),
      bodyStroke = style.body?.stroke,
      bodyWidth = width(style.body?.strokeWidth ?? 1, "CandlestickSeries body"),
      wickStroke = style.wick?.stroke ?? "#173a35",
      wickWidth = width(style.wick?.strokeWidth ?? 1, "CandlestickSeries wick"),
      alpha = opacity(style.opacity ?? 1, "CandlestickSeries");
    marks?.push(
      Object.freeze({
        datum: row.datum,
        sourceIndex: row.sourceIndex,
        time: row.time,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        anchorLocal: Object.freeze({ x: row.x, y: ys.map(row.close) }),
        bodyBoundsLocal: g.bodyBoundsLocal,
        wickLocal: g.wickLocal,
        bodyFill: !!fill && alpha > 0,
        bodyStrokeWidthLocal: bodyStroke && alpha > 0 ? bodyWidth : 0,
        wickStrokeWidthLocal: wickStroke && alpha > 0 ? wickWidth : 0,
      }),
    );
    if (alpha === 0) continue;
    const half =
        Math.max(bodyStroke ? bodyWidth : 0, wickStroke ? wickWidth : 0) / 2,
      minX = g.bodyBoundsLocal.x - half,
      maxX = g.bodyBoundsLocal.x + markWidth + half;
    let batch = batches.at(-1);
    if (
      !batch ||
      (minX < batch.maxX && maxX > batch.minX) ||
      batch.fill !== fill ||
      batch.bodyStroke !== bodyStroke ||
      batch.bodyWidth !== bodyWidth ||
      batch.wickStroke !== wickStroke ||
      batch.wickWidth !== wickWidth ||
      batch.opacity !== alpha ||
      batch.cursor !== style.cursor
    ) {
      batch = {
        body: new Path2D(),
        wick: new Path2D(),
        fill,
        bodyStroke,
        bodyWidth,
        wickStroke,
        wickWidth,
        opacity: alpha,
        cursor: style.cursor,
        minX,
        maxX,
      };
      batches.push(batch);
    }
    batch.minX = Math.min(batch.minX, minX);
    batch.maxX = Math.max(batch.maxX, maxX);
    const b = g.bodyBoundsLocal;
    batch.body.rect(b.x, b.y, b.width, b.height);
    batch.wick.moveTo(g.wickLocal.x, g.wickLocal.highY);
    batch.wick.lineTo(g.wickLocal.x, g.wickLocal.lowY);
  }
  inspection?.capture({ marks: marks!, xScale: xs, yScale: ys });
  return (
    <Group {...events}>
      {batches.map((batch, index) => (
        <Group key={index}>
          <Path
            pointerEvents={pointerEvents}
            style={{
              d: batch.wick,
              stroke: batch.wickStroke,
              strokeWidth: batch.wickWidth,
              opacity: batch.opacity,
              cursor: batch.cursor,
            }}
          />
          <Path
            pointerEvents={pointerEvents}
            style={{
              d: batch.body,
              fill: batch.fill,
              stroke: batch.bodyStroke,
              strokeWidth: batch.bodyWidth,
              opacity: batch.opacity,
              cursor: batch.cursor,
            }}
          />
        </Group>
      ))}
    </Group>
  );
}
