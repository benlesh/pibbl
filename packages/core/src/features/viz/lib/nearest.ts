import type { ResolvedContinuousScale } from "./types.js";
import type { PointAccessor } from "./point-types.js";
import { finiteCoordinate, pointAccessor, pointData } from "./point-data.js";
/**
 * Coordinate accessors, resolved scales, and candidate filtering for a nearest-point search.
 *
 * @see {@link PointAccessor}
 * @see {@link ResolvedContinuousScale}
 * @see {@link nearestPoint}
 */
export interface NearestPointOptions<D> {
  /** Property key or callback extracting the horizontal domain coordinate. See {@link PointAccessor}. */
  readonly x: PointAccessor<D>;
  /** Property key or callback extracting the vertical domain coordinate. See {@link PointAccessor}. */
  readonly y: PointAccessor<D>;
  /** The scale used to map horizontal data coordinates. See {@link ResolvedContinuousScale}. */
  readonly xScale: ResolvedContinuousScale;
  /** The scale used to map vertical data coordinates. See {@link ResolvedContinuousScale}. */
  readonly yScale: ResolvedContinuousScale;
  /**
   * Returns whether a datum contributes drawable or queryable coordinates. See
   * {@link NearestPointOptions}.
   * @param datum - Datum to test.
   * @param index - Zero-based index in the source data.
   * @param data - Complete source data array.
   * @returns Whether this datum should participate in the series or query.
   */
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
  /** Maximum distance accepted by the query. See {@link NearestPointOptions}. */
  readonly maxDistance?: number;
}
/**
 * The selected datum, source index, mapped coordinates, and distance from the query point.
 *
 * @see {@link nearestPoint}
 */
export interface NearestPoint<D> {
  /** The original data item selected by this result. See {@link NearestPoint}. */
  readonly datum: D;
  /** Index of the selected datum in its source data. See {@link NearestPoint}. */
  readonly index: number;
  /**
   * Horizontal coordinate or displacement in the containing coordinate system. See
   * {@link NearestPoint}.
   */
  readonly x: number;
  /**
   * Vertical coordinate or displacement in the containing coordinate system. See
   * {@link NearestPoint}.
   */
  readonly y: number;
  /** Distance measured in this query or guide's coordinate system. See {@link NearestPoint}. */
  readonly distance: number;
}
function finite(value: unknown, name: string): asserts value is number {
  if (!finiteCoordinate(value)) throw new RangeError(`${name} must be finite.`);
}
/**
 * Finds the domain value nearest to a logical range coordinate; returns undefined for no
 * candidate.
 *
 * @param values - Candidate domain values.
 * @param rangeValue - Pointer coordinate in the scale's range.
 * @param scale - Scale mapping candidates into range coordinates. See {@link ResolvedContinuousScale}.
 * @returns The nearest domain value, or undefined when no candidate can be selected.
 *
 * @see {@link ResolvedContinuousScale}
 */
export function nearestDomainValue(
  values: readonly number[],
  rangeValue: number,
  scale: ResolvedContinuousScale,
): number | undefined {
  pointData(values, "nearestDomainValue");
  finite(rangeValue, "nearestDomainValue rangeValue");
  let best: number | undefined,
    distance = Infinity;
  for (const value of values) {
    if (!finiteCoordinate(value)) continue;
    const next = Math.abs(scale.map(value) - rangeValue);
    finite(next, "nearestDomainValue distance");
    if (next < distance) {
      best = value;
      distance = next;
    }
  }
  return best;
}
/**
 * Finds the nearest defined datum in scaled coordinates, subject to an optional maximum distance.
 *
 * @param data - Candidate data records.
 * @param point - Query point in plotted range coordinates.
 * @param options - Accessors, scales, eligibility, and distance settings. See
 * {@link NearestPointOptions} .
 * @returns The nearest matching point, or undefined when no candidate qualifies. See
 * {@link NearestPoint} .
 *
 * @see {@link NearestPointOptions}
 * @see {@link NearestPoint}
 */
export function nearestPoint<D>(
  data: readonly D[],
  point: Readonly<{ x: number; y: number }>,
  options: NearestPointOptions<D>,
): NearestPoint<D> | undefined {
  pointData(data, "nearestPoint");
  finite(point.x, "nearestPoint x");
  finite(point.y, "nearestPoint y");
  const max = options.maxDistance;
  if (max !== undefined) {
    finite(max, "nearestPoint maxDistance");
    if (max < 0)
      throw new RangeError("nearestPoint maxDistance must be nonnegative.");
  }
  const x = pointAccessor(options.x),
    y = pointAccessor(options.y);
  let best: NearestPoint<D> | undefined,
    distance = Infinity;
  for (let i = 0; i < data.length; i++) {
    const datum = data[i];
    if (options.defined && !options.defined(datum, i, data)) continue;
    const xv = x(datum, i, data),
      yv = y(datum, i, data);
    if (!finiteCoordinate(xv) || !finiteCoordinate(yv)) continue;
    const px = options.xScale.map(xv),
      py = options.yScale.map(yv);
    const next = Math.hypot(px - point.x, py - point.y);
    finite(next, "nearestPoint distance");
    if (next < distance && (max === undefined || next <= max)) {
      distance = next;
      best = { datum, index: i, x: px, y: py, distance: next };
    }
  }
  return best;
}
