import type { OhlcBarSeriesProps } from "../lib/ohlc-bar-series.js";
import {
  invertNumericPosition,
  type NumericPositionScale,
} from "../lib/series-position.js";
import type { ResolvedContinuousScale } from "../lib/types.js";
import { useRenderedRef } from "./owned-ref.js";
import { nearestRecordedX } from "./queries.js";
import type {
  NumericRenderedSeries,
  RenderedSeriesPoint,
} from "./query-types.js";

/** One original OHLC record and its values and geometry as evaluated during paint.
 * @see {@link OhlcBarRenderedSeries}
 */
export interface OhlcBarObservation<D> {
  /** Caller-owned original record. */
  readonly datum: D;
  /** Original source index, including skipped rows. */
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
  /** Closing endpoint in series-local coordinates. */ readonly anchorLocal: Readonly<RenderedSeriesPoint>;
  /** Closing endpoint in root-logical coordinates. */ readonly anchorRoot: Readonly<RenderedSeriesPoint>;
  /** High/low segment before world transforms. */ readonly stemLocal: Readonly<{
    /** Horizontal center. */ x: number;
    /** Mapped high endpoint. */ highY: number;
    /** Mapped low endpoint. */ lowY: number;
  }>;
  /** Left-facing opening segment before world transforms. */ readonly openTickLocal: Readonly<{
    /** Left endpoint. */ x1: number;
    /** Center endpoint. */ x2: number;
    /** Mapped opening ordinate. */ y: number;
  }>;
  /** Right-facing closing segment before world transforms. */ readonly closeTickLocal: Readonly<{
    /** Center endpoint. */ x1: number;
    /** Right endpoint. */ x2: number;
    /** Mapped closing ordinate. */ y: number;
  }>;
}
/** A nearest-time OHLC candidate with committed clip eligibility.
 * @see {@link nearestRecordedOhlcBarX}
 */
export interface OhlcBarInspectionCandidate<D> extends OhlcBarObservation<D> {
  /** @returns Whether the close anchor lies inside every committed clip. */
  anchorInsideClips(): boolean;
}
/** Original OHLC selected by nearest timestamp.
 * @see {@link nearestRecordedOhlcBarX}
 */
export interface NearestOhlcBarHit<D> extends OhlcBarObservation<D> {
  /** Absolute UTC-millisecond distance from the requested timestamp. */
  readonly timeDelta: number;
}
/** An actual painted OHLC stroke segment covering a root-logical point.
 * @see {@link paintedOhlcBarAt}
 */
export interface PaintedOhlcBarHit<D> extends OhlcBarObservation<D> {
  /** Last painted matching segment. */
  readonly part: "stem" | "openTick" | "closeTick";
}
/** @internal Local OHLC paint capture. */
export interface CapturedOhlcBarMark<D> extends Omit<
  OhlcBarObservation<D>,
  "anchorRoot"
> {
  readonly strokeWidthLocal: number;
}
/** Borrowed committed OHLC generation.
 * @see {@link OhlcBarInspectionRef}
 */
export interface OhlcBarRenderedSeries<D> {
  /** Captured original observations in source order. */
  readonly observations: readonly OhlcBarObservation<D>[];
  /** Throws after replacement or disposal. */
  assertLive(): void;
  /** Inverts a root-logical point to a timestamp.
   * @param pointRoot - Root-logical point.
   * @returns Timestamp, or undefined for a singular transform.
   */
  timeAtRoot(pointRoot: Readonly<RenderedSeriesPoint>): number | undefined;
  /** Tests a local point against every committed clip.
   * @param pointLocal - Series-local point.
   * @returns Whether every committed clip contains it.
   */
  anchorInsideClips(pointLocal: Readonly<RenderedSeriesPoint>): boolean;
  /** @internal */ readonly marks: readonly CapturedOhlcBarMark<D>[];
  /** @internal */ readonly numeric: NumericRenderedSeries<D>;
  /** @internal Converts a root-logical point to local geometry.
   * @param point - Root-logical coordinate.
   * @returns Local coordinate, or undefined for a singular transform.
   */ localAtRoot(
    point: Readonly<RenderedSeriesPoint>,
  ): Readonly<RenderedSeriesPoint> | undefined;
}
/** Mount-owned optional OHLC bar receiver.
 * @see {@link useOhlcBarInspection}
 */
export interface OhlcBarInspectionRef<D> {
  /** @returns Current borrowed generation, or undefined before paint and after disposal. */
  rendered(): OhlcBarRenderedSeries<D> | undefined;
  /** @internal Records completed local paint without querying.
   * @param input - Captured marks and committed mappings.
   */ capture(input: {
    /** Local marks in source order. */
    marks: readonly CapturedOhlcBarMark<D>[];
    /** Committed horizontal mapping. */
    xScale: NumericPositionScale;
    /** Committed price mapping. */
    yScale: ResolvedContinuousScale;
  }): void;
}

/** Creates a stable OHLC-bar inspection ref without reading data or subscribing.
 * @param _inputs - Inputs retained only to infer the original datum type.
 * @returns A ref for exactly one OhlcBarSeries inspection prop.
 * @see {@link OhlcBarInspectionRef}
 */
export function useOhlcBarInspection<D>(
  _inputs: Pick<
    OhlcBarSeriesProps<D>,
    "data" | "time" | "open" | "high" | "low" | "close"
  >,
): OhlcBarInspectionRef<D> {
  return useRenderedRef<
    {
      marks: readonly CapturedOhlcBarMark<D>[];
      xScale: NumericPositionScale;
      yScale: ResolvedContinuousScale;
    },
    OhlcBarRenderedSeries<D>
  >("ohlcBarInspection", (candidate, geometry) => {
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
          stemLocal: mark.stemLocal,
          openTickLocal: mark.openTickLocal,
          closeTickLocal: mark.closeTickLocal,
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

/** Selects captured original OHLC by nearest timestamp, retaining source-order ties.
 * @param rendered - Borrowed committed OHLC generation.
 * @param options - Timestamp and optional pure candidate filter.
 * @returns First source-order match on a tie, or undefined when none qualifies.
 * @see {@link NearestOhlcBarHit}
 */
export function nearestRecordedOhlcBarX<D>(
  rendered: OhlcBarRenderedSeries<D>,
  options: {
    time: number;
    filter?: (observation: OhlcBarInspectionCandidate<D>) => boolean;
  },
): NearestOhlcBarHit<D> | undefined {
  const hit = nearestRecordedX(rendered.numeric, {
    domainX: options.time,
    filter: options.filter
      ? (candidate) =>
          options.filter!(
            candidate as typeof candidate & OhlcBarInspectionCandidate<D>,
          )
      : undefined,
  });
  if (!hit) return undefined;
  const row = rendered.observations.find(
    (observation) => observation.sourceIndex === hit.sourceIndex,
  )!;
  return Object.freeze({ ...row, timeDelta: hit.domainDelta });
}

function segmentCovers(
  point: Readonly<RenderedSeriesPoint>,
  segment: Readonly<{ x1: number; x2: number; y: number }>,
  strokeWidth: number,
): boolean {
  if (strokeWidth <= 0) return false;
  const half = strokeWidth / 2;
  return (
    point.x >= Math.min(segment.x1, segment.x2) &&
    point.x <= Math.max(segment.x1, segment.x2) &&
    point.y >= segment.y - half &&
    point.y <= segment.y + half
  );
}
function stemCovers(
  point: Readonly<RenderedSeriesPoint>,
  stem: Readonly<{ x: number; highY: number; lowY: number }>,
  strokeWidth: number,
): boolean {
  return (
    segmentCovers(point, { x1: stem.x, x2: stem.x, y: 0 }, 0) ||
    (strokeWidth > 0 &&
      point.x >= stem.x - strokeWidth / 2 &&
      point.x <= stem.x + strokeWidth / 2 &&
      point.y >= Math.min(stem.highY, stem.lowY) &&
      point.y <= Math.max(stem.highY, stem.lowY))
  );
}
/** Finds the last-painted OHLC segment covering a root-logical point.
 * @param rendered - Borrowed committed OHLC generation.
 * @param options - Root-logical point; clips and singular transforms produce no result.
 * @returns Captured OHLC record and painted segment, or undefined for gaps.
 * @see {@link PaintedOhlcBarHit}
 */
export function paintedOhlcBarAt<D>(
  rendered: OhlcBarRenderedSeries<D>,
  options: { rootPoint: Readonly<RenderedSeriesPoint> },
): PaintedOhlcBarHit<D> | undefined {
  rendered.assertLive();
  if (
    !Number.isFinite(options.rootPoint.x) ||
    !Number.isFinite(options.rootPoint.y)
  )
    throw new RangeError("paintedOhlcBarAt rootPoint must be finite.");
  const point = rendered.localAtRoot(options.rootPoint);
  if (!point || !rendered.anchorInsideClips(point)) return undefined;
  for (let index = rendered.marks.length - 1; index >= 0; index--) {
    const mark = rendered.marks[index]!;
    if (segmentCovers(point, mark.closeTickLocal, mark.strokeWidthLocal))
      return Object.freeze({
        ...rendered.observations[index]!,
        part: "closeTick" as const,
      });
    if (segmentCovers(point, mark.openTickLocal, mark.strokeWidthLocal))
      return Object.freeze({
        ...rendered.observations[index]!,
        part: "openTick" as const,
      });
    if (stemCovers(point, mark.stemLocal, mark.strokeWidthLocal))
      return Object.freeze({
        ...rendered.observations[index]!,
        part: "stem" as const,
      });
  }
  return undefined;
}
