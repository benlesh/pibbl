import type { closestPoint, closestX, interpolateX, linearInterpolation } from './hover-queries.js';
import type { HoverData } from './hover-data.js';
import type { PibblNode, SignalValue } from "@pibbl/core";
import type { PointAccessor } from "./point-types.js";
import type { ResolvedContinuousScale, ScaleId } from "./types.js";
/**
 * Scale lookup context supplied when evaluating a hover query.
 *
 * @see {@link ScaleId}
 * @see {@link ResolvedContinuousScale}
 * @see {@link HoverQuery}
 */
export interface HoverQueryContext {
  /**
   * Looks up a resolved continuous scale by its identifier. See {@link ResolvedContinuousScale}.
   * @param id - Identity of the scale needed by the query. See {@link ScaleId}.
   * @returns The resolved continuous scale. See {@link ResolvedContinuousScale}.
   */
  scale(id: ScaleId): ResolvedContinuousScale;
}
/**
 * A query that resolves reactive hover input into a hit or no result.
 *
 * @param context - Pointer position and scale lookup for this query. See {@link HoverQueryContext}
 * .
 * @returns The current match, or undefined when there is no match.
 *
 * @see {@link HoverQueryContext}
 * @see {@link HoverDataProps}
 * @see {@link closestPoint}
 */
export type HoverQuery<T> = (context: HoverQueryContext) => T | undefined;
/**
 * Authored inputs for HoverData, including the declared data and presentation options.
 *
 * @see {@link HoverQuery}
 * @see {@link PibblNode}
 * @see {@link HoverData}
 */
export interface HoverDataProps<T> {
  /** Query that selects a style rule or resolves a hover result. See {@link HoverQuery}. */
  readonly query: HoverQuery<T> & (T extends PromiseLike<unknown> ? never : unknown);
  /**
   * Descendant content or the callback that supplies it. See {@link PibblNode}.
   * @param result - Current query match, or undefined when there is no match.
   * @returns Pibbl content to render for the hover state. See {@link PibblNode}.
   */
  readonly children: (result: T | undefined) => PibblNode;
}
/**
 * Data and coordinate accessors describing one series available to hover queries.
 *
 * @see {@link SignalValue}
 * @see {@link PointAccessor}
 * @see {@link HoverSeriesMap}
 * @see {@link ClosestPointHit}
 * @see {@link ClosestXOptions}
 */
export interface HoverSeries<D> {
  /**
   * Application data supplied to the component or reported by the event. See {@link SignalValue}.
   */
  readonly data: SignalValue<readonly D[]>;
  /** Property key or callback extracting the horizontal domain coordinate. See {@link PointAccessor}. */
  readonly x: PointAccessor<D>;
  /** Property key or callback extracting the vertical domain coordinate. See {@link PointAccessor}. */
  readonly y: PointAccessor<D>;
  /**
   * Returns whether a datum contributes drawable or queryable coordinates. See {@link HoverSeries}
   * .
   * @param datum - Datum to test.
   * @param index - Zero-based index in the source data.
   * @param data - Complete source data array.
   * @returns Whether this datum should participate in the series or query.
   */
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
}
/**
 * A logical point used to query or anchor hover presentation.
 *
 * @see {@link HoverHit}
 * @see {@link ClosestPointOptions}
 * @see {@link HoverSample}
 */
export interface HoverPoint {
  /**
   * Horizontal coordinate or displacement in the containing coordinate system. See
   * {@link HoverPoint}.
   */
  readonly x: number;
  /**
   * Vertical coordinate or displacement in the containing coordinate system. See
   * {@link HoverPoint}.
   */
  readonly y: number;
}
/**
 * The selected datum, source index, coordinates, and presentation anchor of a hover result.
 *
 * @see {@link HoverPoint}
 * @see {@link ClosestPointHit}
 * @see {@link ClosestXHit}
 */
export interface HoverHit<D> {
  /** The original data item selected by this result. See {@link HoverHit}. */
  readonly datum: D;
  /** Index of the selected datum in its source data. See {@link HoverHit}. */
  readonly index: number;
  /**
   * Horizontal coordinate or displacement in the containing coordinate system. See
   * {@link HoverHit}.
   */
  readonly x: number;
  /**
   * Vertical coordinate or displacement in the containing coordinate system. See {@link HoverHit}
   * .
   */
  readonly y: number;
  /** Logical point to which the content or result is anchored. See {@link HoverPoint}. */
  readonly anchor: HoverPoint;
}
// The constraint permits independently typed descriptors; the mapped result below
// restores the exact association between a series key and its original datum.
/**
 * Named series participating in a multi-series hover query.
 *
 * @see {@link HoverSeries}
 * @see {@link ClosestPointHit}
 * @see {@link ClosestPointOptions}
 */
export type HoverSeriesMap = Readonly<Record<string, HoverSeries<any>>>;
/**
 * A closest-point result retaining the selected series identity and distance.
 *
 * @see {@link HoverSeriesMap}
 * @see {@link HoverSeries}
 * @see {@link HoverHit}
 */
export type ClosestPointHit<S extends HoverSeriesMap> = {
  [K in keyof S & string]: S[K] extends HoverSeries<infer D>
    ? HoverHit<D> & {
        /**
         * The named series or series collection participating in the query. See
         * {@link ClosestPointHit}.
         */
        readonly series: K;
        /** Distance measured in this query or guide's coordinate system. See {@link ClosestPointHit}. */
        readonly distance: number;
      }
    : never;
}[keyof S & string];
/**
 * Series, query point, scales, and distance limit for closest-point hover selection.
 *
 * @see {@link HoverSeriesMap}
 * @see {@link SignalValue}
 * @see {@link HoverPoint}
 * @see {@link ScaleId}
 * @see {@link closestPoint}
 */
export interface ClosestPointOptions<S extends HoverSeriesMap> {
  /**
   * The named series or series collection participating in the query. See
   * {@link ClosestPointOptions}.
   */
  readonly series: S;
  /**
   * Position of the geometry, source, or selected resize handle. See {@link SignalValue},
   * {@link HoverPoint}.
   */
  readonly position: SignalValue<HoverPoint | null>;
  /** The scale used to map horizontal data coordinates. See {@link ScaleId}. */
  readonly xScale: ScaleId;
  /** The scale used to map vertical data coordinates. See {@link ScaleId}. */
  readonly yScale: ScaleId;
  /** Maximum distance accepted by the query. See {@link ClosestPointOptions}. */
  readonly maxDistance?: number;
}
/**
 * A series, x-coordinate, scales, and optional maximum x delta for hover selection.
 *
 * @see {@link HoverSeries}
 * @see {@link SignalValue}
 * @see {@link ScaleId}
 * @see {@link InterpolateXOptions}
 * @see {@link closestX}
 */
export interface ClosestXOptions<D> {
  /** The named series or series collection participating in the query. See {@link HoverSeries}. */
  readonly series: HoverSeries<D>;
  /**
   * Horizontal coordinate or displacement in the containing coordinate system. See
   * {@link SignalValue}.
   */
  readonly x: SignalValue<number | null>;
  /** The scale used to map horizontal data coordinates. See {@link ScaleId}. */
  readonly xScale: ScaleId;
  /** The scale used to map vertical data coordinates. See {@link ScaleId}. */
  readonly yScale: ScaleId;
  /** Maximum x-coordinate difference accepted by the query. See {@link ClosestXOptions}. */
  readonly maxDelta?: number;
}
/**
 * The nearest datum in x together with its delta from the query coordinate.
 *
 * @see {@link HoverHit}
 * @see {@link closestX}
 */
export interface ClosestXHit<D> extends HoverHit<D> {
  /**
   * Difference between the selected datum's x coordinate and the query x coordinate. See
   * {@link ClosestXHit}.
   */
  readonly delta: number;
}
/**
 * Interpolates between two y values at a normalized position between samples.
 *
 * @param beforeY - Vertical value before the sample position.
 * @param afterY - Vertical value after the sample position.
 * @param fraction - Fraction of the distance from the before point to the after point.
 * @returns The interpolated vertical value.
 *
 * @see {@link InterpolateXOptions}
 * @see {@link linearInterpolation}
 */
export type HoverInterpolation = (
  beforeY: number,
  afterY: number,
  fraction: number,
) => number;
/**
 * Interpolation, gap, and duplicate-x policies for sampling a series at a requested x.
 *
 * @see {@link ClosestXOptions}
 * @see {@link HoverInterpolation}
 * @see {@link interpolateX}
 */
export interface InterpolateXOptions<D> extends Omit<ClosestXOptions<D>, "maxDelta"> {
  /** Computes y between the neighboring samples at the requested fraction. See {@link HoverInterpolation}. */
  readonly interpolation: HoverInterpolation;
  /**
   * Maximum gap between neighboring samples that permits interpolation. See
   * {@link InterpolateXOptions}.
   */
  readonly maxGap?: number;
  /** Policy for resolving samples with the same x coordinate. See {@link InterpolateXOptions}. */
  readonly duplicateX?: "error" | "first" | "last";
}
/**
 * An exact datum hit or an interpolated value with its neighboring data and anchor.
 *
 * @see {@link HoverHit}
 * @see {@link HoverPoint}
 * @see {@link interpolateX}
 */
export type HoverSample<D> =
  | (HoverHit<D> & {
      /** Selects the kind of geometry, material, or result. See {@link HoverSample}. */
      readonly kind: "exact";
    })
  | {
      /** Selects the kind of geometry, material, or result. See {@link HoverSample}. */
      readonly kind: "interpolated";
      /**
       * Horizontal coordinate or displacement in the containing coordinate system. See
       * {@link HoverSample}.
       */
      readonly x: number;
      /**
       * Vertical coordinate or displacement in the containing coordinate system. See
       * {@link HoverSample}.
       */
      readonly y: number;
      /** Source datum preceding the interpolated x coordinate. See {@link HoverSample}. */
      readonly before: D;
      /** Source datum following the interpolated x coordinate. See {@link HoverSample}. */
      readonly after: D;
      /** Source index of the sample before the interpolated position. See {@link HoverSample}. */
      readonly beforeIndex: number;
      /** Source index of the sample after the interpolated position. See {@link HoverSample}. */
      readonly afterIndex: number;
      /** Normalized share or position represented by this value. See {@link HoverSample}. */
      readonly fraction: number;
      /** Logical point to which the content or result is anchored. See {@link HoverPoint}. */
      readonly anchor: HoverPoint;
    };
