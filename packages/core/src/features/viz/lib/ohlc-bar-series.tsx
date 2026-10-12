import {
  Group,
  Path,
  resolveSignalValue,
  type PibblEventHandlers,
  type PibblEventParticipationOptions,
  type PibblNode,
  type SignalValue,
  type StrokeStyle,
} from "@pibbl/core";
import { withHooksForbidden } from "@pibbl/core/internal";
import type {
  OhlcBarInspectionRef,
  CapturedOhlcBarMark,
} from "../inspection/ohlc-bar.js";
import { financialMarkWidth } from "./financial-geometry.js";
import { opacity, width } from "./paint.js";
import { finiteCoordinate, pointAccessor, pointData } from "./point-data.js";
import { useNumericPosition } from "./series-position.js";
import type { LineAccessor, ScaleId } from "./types.js";
import { useContinuousScale } from "./use-continuous-scale.js";

/** Shared stroke presentation for an OHLC bar.
 * @see {@link OhlcBarSeries}
 */
export interface OhlcBarSeriesStyle {
  /** Positive total width, or automatic 70% spacing capped at 12; singleton fallback 8. */ readonly bandwidth?:
    number | "auto";
  /** Stem and tick stroke; defaults to dark teal. Empty string disables painting. */ readonly stroke?: StrokeStyle;
  /** Nonnegative local stroke width; default 1. */ readonly strokeWidth?: number;
  /** Paint opacity from zero through one; default 1. */ readonly opacity?: number;
  /** Cursor while the series owns targeting. */ readonly cursor?: string;
}

/** Source-ordered OHLC records rendered as a high/low stem with open/close ticks.
 * @see {@link OhlcBarSeries}
 */
export interface OhlcBarSeriesProps<D>
  extends PibblEventHandlers, PibblEventParticipationOptions {
  /** Original records or signal; never sorted or mutated. */
  readonly data: SignalValue<readonly D[]>;
  /** UTC-millisecond property or callback. */
  readonly time: LineAccessor<D>;
  /** Opening price property or callback. */
  readonly open: LineAccessor<D>;
  /** High price property or callback. */
  readonly high: LineAccessor<D>;
  /** Low price property or callback. */
  readonly low: LineAccessor<D>;
  /** Closing price property or callback. */
  readonly close: LineAccessor<D>;
  /** Numeric, UTC, or trading-time horizontal mapping identity. */
  readonly xScale: ScaleId;
  /** Continuous price mapping identity. */
  readonly yScale: ScaleId;
  /** Tests original rows before accessor evaluation.
   * @param datum - Original row.
   * @param index - Source index including skipped rows.
   * @param data - Complete source array.
   * @returns Whether the bar participates.
   */
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
  /** Shared presentation or a hook-free original-row resolver.
   * @param datum - Original row.
   * @param index - Source index.
   * @param data - Complete source array.
   * @returns Plain OHLC-bar style.
   */
  readonly style?:
    | SignalValue<OhlcBarSeriesStyle>
    | ((datum: D, index: number, data: readonly D[]) => OhlcBarSeriesStyle);
  /** Optional committed capture; the renderer does not execute inspection queries. */ readonly inspection?: OhlcBarInspectionRef<D>;
}

/** Paints source-ordered OHLC bars with a high/low stem, left open tick, and right close tick.
 * @param props - Original OHLC accessors, scales, styles, events, and optional capture.
 * @returns Ordinary Pibbl composition; equal disjoint styles share paths.
 * @see {@link OhlcBarSeriesProps}
 */
export function OhlcBarSeries<D>({
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
}: OhlcBarSeriesProps<D>): PibblNode {
  const xs = useNumericPosition(xScale),
    ys = useContinuousScale(yScale).get();
  const data = pointData(resolveSignalValue(input), "OhlcBarSeries");
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
        `OhlcBarSeries: malformed OHLC at source index ${i}; require low <= open/close <= high.`,
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
  const marks: CapturedOhlcBarMark<D>[] | undefined = inspection
    ? []
    : undefined;
  const batches: {
    stem: Path2D;
    openTick: Path2D;
    closeTick: Path2D;
    stroke: StrokeStyle;
    strokeWidth: number;
    opacity: number;
    cursor: string | undefined;
    minX: number;
    maxX: number;
  }[] = [];
  for (const row of rows) {
    const style =
      typeof specified === "function"
        ? withHooksForbidden("OhlcBarSeries style callback", () =>
            specified(row.datum, row.sourceIndex, data),
          )
        : (specified ?? {});
    const markWidth =
      style.bandwidth === undefined || style.bandwidth === "auto"
        ? defaultWidth
        : financialMarkWidth([], { width: style.bandwidth });
    const halfWidth = markWidth / 2;
    const stemLocal = Object.freeze({
      x: row.x,
      highY: ys.map(row.high),
      lowY: ys.map(row.low),
    });
    const openTickLocal = Object.freeze({
      x1: row.x - halfWidth,
      x2: row.x,
      y: ys.map(row.open),
    });
    const closeTickLocal = Object.freeze({
      x1: row.x,
      x2: row.x + halfWidth,
      y: ys.map(row.close),
    });
    const stroke = style.stroke ?? "#173a35",
      strokeWidth = width(style.strokeWidth ?? 1, "OhlcBarSeries"),
      alpha = opacity(style.opacity ?? 1, "OhlcBarSeries");
    marks?.push(
      Object.freeze({
        datum: row.datum,
        sourceIndex: row.sourceIndex,
        time: row.time,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        anchorLocal: Object.freeze({ x: row.x, y: closeTickLocal.y }),
        stemLocal,
        openTickLocal,
        closeTickLocal,
        strokeWidthLocal: stroke && alpha > 0 ? strokeWidth : 0,
      }),
    );
    if (alpha === 0 || !stroke) continue;
    const xPad = strokeWidth / 2,
      minX = row.x - halfWidth - xPad,
      maxX = row.x + halfWidth + xPad;
    let batch = batches.at(-1);
    if (
      !batch ||
      (minX < batch.maxX && maxX > batch.minX) ||
      batch.stroke !== stroke ||
      batch.strokeWidth !== strokeWidth ||
      batch.opacity !== alpha ||
      batch.cursor !== style.cursor
    ) {
      batch = {
        stem: new Path2D(),
        openTick: new Path2D(),
        closeTick: new Path2D(),
        stroke,
        strokeWidth,
        opacity: alpha,
        cursor: style.cursor,
        minX,
        maxX,
      };
      batches.push(batch);
    }
    batch.minX = Math.min(batch.minX, minX);
    batch.maxX = Math.max(batch.maxX, maxX);
    batch.stem.moveTo(stemLocal.x, stemLocal.highY);
    batch.stem.lineTo(stemLocal.x, stemLocal.lowY);
    batch.openTick.moveTo(openTickLocal.x1, openTickLocal.y);
    batch.openTick.lineTo(openTickLocal.x2, openTickLocal.y);
    batch.closeTick.moveTo(closeTickLocal.x1, closeTickLocal.y);
    batch.closeTick.lineTo(closeTickLocal.x2, closeTickLocal.y);
  }
  inspection?.capture({ marks: marks!, xScale: xs, yScale: ys });
  return (
    <Group {...events}>
      {batches.map((batch, index) => (
        <Group key={index}>
          <Path
            pointerEvents={pointerEvents}
            style={{
              d: batch.stem,
              stroke: batch.stroke,
              strokeWidth: batch.strokeWidth,
              opacity: batch.opacity,
              cursor: batch.cursor,
            }}
          />
          <Path
            pointerEvents={pointerEvents}
            style={{
              d: batch.openTick,
              stroke: batch.stroke,
              strokeWidth: batch.strokeWidth,
              opacity: batch.opacity,
              cursor: batch.cursor,
            }}
          />
          <Path
            pointerEvents={pointerEvents}
            style={{
              d: batch.closeTick,
              stroke: batch.stroke,
              strokeWidth: batch.strokeWidth,
              opacity: batch.opacity,
              cursor: batch.cursor,
            }}
          />
        </Group>
      ))}
    </Group>
  );
}
