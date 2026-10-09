import {
  invertNumericPosition,
  type NumericPositionScale,
} from "../lib/series-position.js";
import type { LayoutBox } from "@pibbl/core";
import type { VolumeSeriesProps } from "../lib/volume-series.js";
import type { ResolvedContinuousScale } from "../lib/types.js";
import type {
  RenderedSeriesPoint,
  NumericRenderedSeries,
} from "./query-types.js";
import { useRenderedRef } from "./owned-ref.js";
import { nearestRecordedX } from "./queries.js";

/** One original volume record and the values/geometry evaluated during paint.
 * @see {@link useVolumeInspection}
 */
export interface VolumeObservation<D> {
  /** Caller-owned original record. */ readonly datum: D;
  /** Original index including skipped rows. */ readonly sourceIndex: number;
  /** Evaluated UTC milliseconds. */ readonly time: number;
  /** Evaluated nonnegative volume. */ readonly volume: number;
  /** Zero-volume baseline. */ readonly baseline: 0;
  /** Volume endpoint in series-local logical coordinates. */ readonly anchorLocal: Readonly<RenderedSeriesPoint>;
  /** Volume endpoint in root-logical coordinates. */ readonly anchorRoot: Readonly<RenderedSeriesPoint>;
  /** Column bounds in series-local logical coordinates. */ readonly boundsLocal: Readonly<LayoutBox>;
}
/** A nearest-time candidate with an explicit optional clip predicate.
 * @see {@link useVolumeInspection}
 */
export interface VolumeInspectionCandidate<D> extends VolumeObservation<D> {
  /** @returns Whether the endpoint lies inside every committed clip. */ anchorInsideClips(): boolean;
}
/** A recorded volume selected by timestamp proximity.
 * @see {@link useVolumeInspection}
 */
export interface NearestVolumeHit<D> extends VolumeObservation<D> {
  /** Absolute UTC-millisecond distance from the requested time. */ readonly timeDelta: number;
}
/** A recorded volume whose painted column covers the query point.
 * @see {@link useVolumeInspection}
 */
export interface PaintedVolumeHit<D> extends VolumeObservation<D> {}
/** @internal Immutable local renderer capture, without queries or transformed allocation.
 * @see {@link useVolumeInspection}
 */
export interface CapturedVolumeMark<D> extends Omit<
  VolumeObservation<D>,
  "anchorRoot"
> {
  /** Whether the rectangle paints its interior. */ readonly fill: boolean;
  /** Outline width when painted, zero otherwise. */ readonly strokeWidthLocal: number;
}
/** Borrowed committed volume values; expires after a new root generation or disposal.
 * @see {@link useVolumeInspection}
 */
export interface VolumeRenderedSeries<D> {
  /** Original observations and evaluated values in source order. */ readonly observations: readonly VolumeObservation<D>[];
  /** Throws when borrowed values are stale or disposed. */ assertLive(): void;
  /** Inverts a root-logical point to UTC milliseconds.
   * @param pointRoot - Root-logical Canvas position.
   * @returns Timestamp or undefined for unavailable inversion.
   */ timeAtRoot(pointRoot: Readonly<RenderedSeriesPoint>): number | undefined;
  /** Tests a local point against the committed clip stack.
   * @param pointLocal - Series-local position.
   * @returns Whether every clip includes it.
   */ anchorInsideClips(pointLocal: Readonly<RenderedSeriesPoint>): boolean;
  /** @internal Committed paint flags. */ readonly marks: readonly CapturedVolumeMark<D>[];
  /** @internal Shared numeric query view. */ readonly numeric: NumericRenderedSeries<D>;
  /** @internal Converts root coordinates to local coordinates.
   * @param point - Root-logical position.
   * @returns Local position or undefined for a singular transform.
   */ localAtRoot(
    point: Readonly<RenderedSeriesPoint>,
  ): Readonly<RenderedSeriesPoint> | undefined;
}
/** Mount-owned optional volume capture.
 * @see {@link useVolumeInspection}
 */
export interface VolumeInspectionRef<D> {
  /** @returns Borrowed committed values, or undefined before paint/after disposal. */ rendered():
    VolumeRenderedSeries<D> | undefined;
  /** @internal Records local values without executing a query.
   * @param input - Immutable local marks and committed time mapping.
   */ capture(input: {
    /** Captured local paint marks. */ marks: readonly CapturedVolumeMark<D>[];
    /** Committed horizontal mapping. */ xScale: NumericPositionScale;
    /** Committed volume mapping. */ yScale: ResolvedContinuousScale;
  }): void;
}
/**
 * Creates a stable optional volume receiver without reading data or subscribing.
 * @param _inputs - Data/accessors used only for original datum inference.
 * @returns Ref to pass to exactly one VolumeSeries inspection prop.
 * @see {@link VolumeInspectionRef}
 */
export function useVolumeInspection<D>(
  _inputs: Pick<VolumeSeriesProps<D>, "data" | "time" | "volume">,
): VolumeInspectionRef<D> {
  return useRenderedRef<
    {
      marks: readonly CapturedVolumeMark<D>[];
      xScale: NumericPositionScale;
      yScale: ResolvedContinuousScale;
    },
    VolumeRenderedSeries<D>
  >("volumeInspection", (candidate, geometry) => {
    const observations = Object.freeze(
      candidate.marks.map((mark) =>
        Object.freeze({
          datum: mark.datum,
          sourceIndex: mark.sourceIndex,
          time: mark.time,
          volume: mark.volume,
          baseline: mark.baseline,
          anchorLocal: mark.anchorLocal,
          anchorRoot: geometry.rootAtLocal(mark.anchorLocal),
          boundsLocal: mark.boundsLocal,
        }),
      ),
    );
    const numeric: NumericRenderedSeries<D> = Object.freeze({
      observations: Object.freeze(
        observations.map((row) =>
          Object.freeze({
            ...row,
            domainX: row.time,
            domainY: row.volume,
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
 * Selects a recorded volume by timestamp; equal distances choose first source index.
 * @param rendered - Borrowed committed volume values.
 * @param options - UTC-millisecond request and optional pure candidate filter.
 * @returns Captured original volume and time delta, or undefined when no candidate survives.
 * @see {@link NearestVolumeHit}
 */
export function nearestRecordedVolumeX<D>(
  rendered: VolumeRenderedSeries<D>,
  options: {
    time: number;
    filter?: (observation: VolumeInspectionCandidate<D>) => boolean;
  },
): NearestVolumeHit<D> | undefined {
  const hit = nearestRecordedX(rendered.numeric, {
    domainX: options.time,
    filter: options.filter
      ? (candidate) =>
          options.filter!(
            candidate as typeof candidate & VolumeInspectionCandidate<D>,
          )
      : undefined,
  });
  if (!hit) return undefined;
  const row = rendered.observations.find(
    (row) => row.sourceIndex === hit.sourceIndex,
  )!;
  return Object.freeze({ ...row, timeDelta: hit.domainDelta });
}
/**
 * Finds the last-painted volume column covering a root-logical point.
 * @param rendered - Borrowed committed volume values and paint geometry.
 * @param options - Root-logical point; respects clips, zero height and source paint order.
 * @returns Captured original volume, or undefined for gaps/singular transforms.
 * @see {@link PaintedVolumeHit}
 */
export function paintedVolumeAt<D>(
  rendered: VolumeRenderedSeries<D>,
  options: { rootPoint: Readonly<RenderedSeriesPoint> },
): PaintedVolumeHit<D> | undefined {
  rendered.assertLive();
  if (
    !Number.isFinite(options.rootPoint.x) ||
    !Number.isFinite(options.rootPoint.y)
  )
    throw new RangeError("paintedVolumeAt rootPoint must be finite.");
  const p = rendered.localAtRoot(options.rootPoint);
  if (!p || !rendered.anchorInsideClips(p)) return undefined;
  for (let i = rendered.marks.length - 1; i >= 0; i--) {
    const mark = rendered.marks[i],
      b = mark.boundsLocal,
      h = mark.strokeWidthLocal / 2;
    if (b.height === 0) continue;
    const inside =
      p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
    const outline =
      h > 0 &&
      p.x >= b.x - h &&
      p.x <= b.x + b.width + h &&
      p.y >= b.y - h &&
      p.y <= b.y + b.height + h &&
      !(
        p.x > b.x + h &&
        p.x < b.x + b.width - h &&
        p.y > b.y + h &&
        p.y < b.y + b.height - h
      );
    if ((mark.fill && inside) || outline) return rendered.observations[i];
  }
  return undefined;
}
