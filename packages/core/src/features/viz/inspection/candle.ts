import type { LayoutBox } from "@pibbl/core";
import type { CandlestickSeriesProps } from "../lib/candlestick-series.js";
import {
  invertNumericPosition,
  type NumericPositionScale,
} from "../lib/series-position.js";
import type { ResolvedContinuousScale } from "../lib/types.js";
import type {
  NumericRenderedSeries,
  RenderedSeriesPoint,
} from "./query-types.js";
import { nearestRecordedX } from "./queries.js";
import { useRenderedRef } from "./owned-ref.js";

/** One original candle with its evaluated OHLC values and committed local geometry.
 * @see {@link CandleRenderedSeries}
 */
export interface CandleObservation<D> {
  /** Caller-owned original record. */
  readonly datum: D;
  /** Original source index, including skipped records. */
  readonly sourceIndex: number;
  /** Evaluated UTC-millisecond timestamp. */
  readonly time: number;
  /** Evaluated opening value. */
  readonly open: number;
  /** Evaluated high value. */
  readonly high: number;
  /** Evaluated low value. */
  readonly low: number;
  /** Evaluated closing value. */
  readonly close: number;
  /** Closing endpoint in series-local logical units. */
  readonly anchorLocal: Readonly<RenderedSeriesPoint>;
  /** Closing endpoint in root-logical units. */
  readonly anchorRoot: Readonly<RenderedSeriesPoint>;
  /** Body rectangle before world transforms. */
  readonly bodyBoundsLocal: Readonly<LayoutBox>;
  /** Wick center and endpoints before world transforms. */
  readonly wickLocal: Readonly<{
    /** Horizontal wick center in series-local logical units. */
    x: number;
    /** Mapped low endpoint in series-local logical units. */
    lowY: number;
    /** Mapped high endpoint in series-local logical units. */
    highY: number;
  }>;
}

/** A candle candidate whose closing endpoint can be tested against committed clips.
 * @see {@link CandleObservation}
 */
export interface CandleInspectionCandidate<D> extends CandleObservation<D> {
  /**
   * @returns Whether the close anchor lies inside every committed clip.
   */
  anchorInsideClips(): boolean;
}

/** Candle selected by nearest timestamp.
 * @see {@link nearestRecordedCandleX}
 */
export interface NearestCandleHit<D> extends CandleObservation<D> {
  /** Absolute UTC-millisecond distance from the requested timestamp. */
  readonly timeDelta: number;
}

/** Candle part whose actual painted geometry covers a root-logical query point.
 * @see {@link paintedCandleAt}
 */
export interface PaintedCandleHit<D> extends CandleObservation<D> {
  /** Part selected in source paint order: body paints after wick. */
  readonly part: "body" | "wick";
}

/** @internal Local candle geometry and paint flags committed by CandlestickSeries. */
export interface CapturedCandleMark<D> extends Omit<
  CandleObservation<D>,
  "anchorRoot"
> {
  /** Whether the body paints an interior. */
  readonly bodyFill: boolean;
  /** Local body outline width, zero when its outline is not painted. */
  readonly bodyStrokeWidthLocal: number;
  /** Local wick stroke width, zero when its wick is not painted. */
  readonly wickStrokeWidthLocal: number;
}

/** Borrowed committed candle generation.
 * @see {@link CandleInspectionRef}
 */
export interface CandleRenderedSeries<D> {
  /** Captured original records, values, and geometry in source order. */
  readonly observations: readonly CandleObservation<D>[];
  /** Throws after replacement or disposal. */
  assertLive(): void;
  /**
   * Selects the supplied/nearest timestamp at a root-logical coordinate.
   * @param pointRoot - Root-logical point to invert through the committed transform.
   * @returns UTC milliseconds, or undefined for singular transforms or empty mappings.
   */
  timeAtRoot(pointRoot: Readonly<RenderedSeriesPoint>): number | undefined;
  /**
   * Tests local geometry against each committed clip.
   * @param pointLocal - Series-local logical point.
   * @returns Whether every committed clip contains the point.
   */
  anchorInsideClips(pointLocal: Readonly<RenderedSeriesPoint>): boolean;
  /** @internal Captured paint flags in source paint order. */
  readonly marks: readonly CapturedCandleMark<D>[];
  /** @internal Numeric-query view based on close endpoints. */
  readonly numeric: NumericRenderedSeries<D>;
  /**
   * @internal Converts root-logical points to local geometry.
   * @param point - Root-logical point to convert.
   * @returns Series-local point, or undefined when the transform is singular.
   */
  localAtRoot(
    point: Readonly<RenderedSeriesPoint>,
  ): Readonly<RenderedSeriesPoint> | undefined;
}

/** Mount-owned optional candle capture.
 * @see {@link useCandleInspection}
 */
export interface CandleInspectionRef<D> {
  /**
   * @returns The current borrowed generation, or undefined before paint and after disposal.
   */
  rendered(): CandleRenderedSeries<D> | undefined;
  /**
   * @internal Records a completed CandlestickSeries paint without executing queries.
   * @param input - Source-ordered marks and the committed numeric mappings.
   */
  capture(input: {
    /** Source-ordered local marks and paint flags. */
    marks: readonly CapturedCandleMark<D>[];
    /** Committed numeric or trading-time horizontal mapping. */
    xScale: NumericPositionScale;
    /** Committed continuous vertical mapping. */
    yScale: ResolvedContinuousScale;
  }): void;
}

/**
 * Creates a stable optional candle receiver without reading data or subscribing.
 *
 * @param _inputs - Inputs retained only to infer the original datum type.
 * @returns A ref for exactly one CandlestickSeries inspection prop.
 * @see {@link CandleInspectionRef}
 */
export function useCandleInspection<D>(
  _inputs: Pick<
    CandlestickSeriesProps<D>,
    "data" | "time" | "open" | "high" | "low" | "close"
  >,
): CandleInspectionRef<D> {
  return useRenderedRef<
    {
      marks: readonly CapturedCandleMark<D>[];
      xScale: NumericPositionScale;
      yScale: ResolvedContinuousScale;
    },
    CandleRenderedSeries<D>
  >("candleInspection", (candidate, geometry) => {
    const observations = Object.freeze(
      candidate.marks.map((mark) =>
        Object.freeze({
          datum: mark.datum,
          sourceIndex: mark.sourceIndex,
          time: mark.time,
          open: mark.open,
          high: mark.high,
          low: mark.low,
          close: mark.close,
          anchorLocal: mark.anchorLocal,
          anchorRoot: geometry.rootAtLocal(mark.anchorLocal),
          bodyBoundsLocal: mark.bodyBoundsLocal,
          wickLocal: mark.wickLocal,
        }),
      ),
    );
    const numeric: NumericRenderedSeries<D> = Object.freeze({
      observations: Object.freeze(
        observations.map((row) =>
          Object.freeze({
            ...row,
            domainX: row.time,
            domainY: row.close,
            run: 0,
          }),
        ),
      ),
      assertLive: geometry.assertLive,
      domainXAtRoot(point: Readonly<RenderedSeriesPoint>) {
        const local = geometry.localAtRoot(point);
        return local
          ? invertNumericPosition(candidate.xScale, local.x)
          : undefined;
      },
      anchorInsideClips: geometry.anchorInsideClips,
      anchorAtDomain(point: Readonly<{ domainX: number; domainY: number }>) {
        geometry.assertLive();
        const anchorLocal = Object.freeze({
          x: candidate.xScale.map(point.domainX),
          y: candidate.yScale.map(point.domainY),
        });
        return Object.freeze({
          anchorLocal,
          anchorRoot: geometry.rootAtLocal(anchorLocal),
        });
      },
    });
    return Object.freeze({
      observations,
      marks: Object.freeze(candidate.marks.slice()),
      numeric,
      assertLive: geometry.assertLive,
      localAtRoot: geometry.localAtRoot,
      anchorInsideClips: geometry.anchorInsideClips,
      timeAtRoot: numeric.domainXAtRoot,
    });
  });
}

/**
 * Selects a captured candle nearest to a requested UTC timestamp.
 *
 * @param rendered - Borrowed committed candle generation.
 * @param options - Timestamp and optional pure candidate filter.
 * @returns The first source-order candle on a tie, or undefined when none qualifies.
 * @see {@link NearestCandleHit}
 */
export function nearestRecordedCandleX<D>(
  rendered: CandleRenderedSeries<D>,
  options: {
    time: number;
    filter?: (observation: CandleInspectionCandidate<D>) => boolean;
  },
): NearestCandleHit<D> | undefined {
  const hit = nearestRecordedX(rendered.numeric, {
    domainX: options.time,
    filter: options.filter
      ? (candidate) =>
          options.filter!(
            candidate as typeof candidate & CandleInspectionCandidate<D>,
          )
      : undefined,
  });
  if (!hit) return undefined;
  const row = rendered.observations.find(
    (observation) => observation.sourceIndex === hit.sourceIndex,
  )!;
  return Object.freeze({ ...row, timeDelta: hit.domainDelta });
}

function rectangleCovers(
  point: Readonly<RenderedSeriesPoint>,
  bounds: Readonly<LayoutBox>,
  fill: boolean,
  strokeWidth: number,
): boolean {
  const half = strokeWidth / 2;
  const inside =
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height;
  const outline =
    half > 0 &&
    point.x >= bounds.x - half &&
    point.x <= bounds.x + bounds.width + half &&
    point.y >= bounds.y - half &&
    point.y <= bounds.y + bounds.height + half &&
    !(
      point.x > bounds.x + half &&
      point.x < bounds.x + bounds.width - half &&
      point.y > bounds.y + half &&
      point.y < bounds.y + bounds.height - half
    );
  return (fill && inside) || outline;
}

function wickCovers(
  point: Readonly<RenderedSeriesPoint>,
  wick: Readonly<{ x: number; lowY: number; highY: number }>,
  strokeWidth: number,
): boolean {
  if (strokeWidth <= 0 || wick.lowY === wick.highY) return false;
  const half = strokeWidth / 2;
  return (
    point.x >= wick.x - half &&
    point.x <= wick.x + half &&
    point.y >= Math.min(wick.lowY, wick.highY) &&
    point.y <= Math.max(wick.lowY, wick.highY)
  );
}

/**
 * Finds the last-painted candle body or wick covering a root-logical point.
 *
 * Body coverage is tested before wick coverage because a candle paints its body after its wick.
 *
 * @param rendered - Borrowed committed candle generation.
 * @param options - Root-logical point; clips and singular transforms produce no result.
 * @returns Captured candle and painted part, or undefined for gaps and unpainted geometry.
 * @see {@link PaintedCandleHit}
 */
export function paintedCandleAt<D>(
  rendered: CandleRenderedSeries<D>,
  options: { rootPoint: Readonly<RenderedSeriesPoint> },
): PaintedCandleHit<D> | undefined {
  rendered.assertLive();
  if (
    !Number.isFinite(options.rootPoint.x) ||
    !Number.isFinite(options.rootPoint.y)
  )
    throw new RangeError("paintedCandleAt rootPoint must be finite.");
  const point = rendered.localAtRoot(options.rootPoint);
  if (!point || !rendered.anchorInsideClips(point)) return undefined;
  for (let index = rendered.marks.length - 1; index >= 0; index--) {
    const mark = rendered.marks[index]!;
    if (
      rectangleCovers(
        point,
        mark.bodyBoundsLocal,
        mark.bodyFill,
        mark.bodyStrokeWidthLocal,
      )
    )
      return Object.freeze({
        ...rendered.observations[index]!,
        part: "body" as const,
      });
    if (wickCovers(point, mark.wickLocal, mark.wickStrokeWidthLocal))
      return Object.freeze({
        ...rendered.observations[index]!,
        part: "wick" as const,
      });
  }
  return undefined;
}
