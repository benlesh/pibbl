import { resolveSignalValue } from "@pibbl/core";
import { finiteCoordinate, pointAccessor, pointData } from "./point-data.js";
import type {
  ClosestPointHit,
  ClosestPointOptions,
  HoverQuery,
  HoverSeries,
  HoverSeriesMap,
} from "./hover-types.js";
/**
 * Creates a data descriptor without observing or copying its dataset.
 *
 * @param options - Data, accessors, and scales describing a hoverable series. See
 * {@link HoverSeries} .
 * @returns The series descriptor with its datum type preserved. See {@link HoverSeries}.
 *
 * @see {@link HoverSeries}
 */
export function defineSeries<D>(options: HoverSeries<D>): HoverSeries<D> {
  return Object.freeze({ ...options });
}
function finite(value: unknown, name: string): asserts value is number {
  if (!finiteCoordinate(value)) throw new RangeError(`${name} must be finite.`);
}
function limit(value: number | undefined, name: string): void {
  if (value === undefined) return;
  finite(value, name);
  if (value < 0) throw new RangeError(`${name} must be nonnegative.`);
}
/**
 * Creates an ordinary query function for the closest mapped recorded point.
 *
 * @param options - Series and distance policy for the hover query. See {@link ClosestPointOptions}
 * .
 * @returns A query that selects the closest eligible point, or yields undefined when none
 * qualifies. See {@link HoverQuery} , {@link ClosestPointHit} .
 *
 * @see {@link ClosestPointOptions}
 * @see {@link HoverQuery}
 * @see {@link ClosestPointHit}
 * @see {@link HoverSeriesMap}
 */
export function closestPoint<S extends HoverSeriesMap>(
  options: ClosestPointOptions<S>,
): HoverQuery<ClosestPointHit<S>> {
  return (context) => {
    limit(options.maxDistance, "closestPoint maxDistance");
    const position = resolveSignalValue(options.position);
    if (position === null) return undefined;
    finite(position.x, "closestPoint position.x");
    finite(position.y, "closestPoint position.y");
    const xs = context.scale(options.xScale),
      ys = context.scale(options.yScale);
    let best: ClosestPointHit<S> | undefined,
      distance = Infinity;
    for (const key of Object.keys(options.series)) {
      const series = options.series[key];
      const data = pointData(resolveSignalValue(series.data), "closestPoint");
      const x = pointAccessor(series.x),
        y = pointAccessor(series.y);
      for (let index = 0; index < data.length; index++) {
        const datum = data[index];
        if (series.defined && !series.defined(datum, index, data)) continue;
        const xv = x(datum, index, data),
          yv = y(datum, index, data);
        if (!finiteCoordinate(xv) || !finiteCoordinate(yv)) continue;
        const anchor = { x: xs.map(xv), y: ys.map(yv) };
        const next = Math.hypot(anchor.x - position.x, anchor.y - position.y);
        finite(next, "closestPoint distance");
        if (
          next < distance &&
          (options.maxDistance === undefined || next <= options.maxDistance)
        ) {
          distance = next;
          best = {
            series: key,
            datum,
            index,
            x: xv,
            y: yv,
            anchor,
            distance,
          } as ClosestPointHit<S>;
        }
      }
    }
    return best;
  };
}

import type {
  ClosestXOptions,
  ClosestXHit,
  HoverInterpolation,
  InterpolateXOptions,
  HoverSample,
} from "./hover-types.js";
/**
 * Selects a recorded observation by domain-x distance, independently of pointer y.
 *
 * @param options - Series and horizontal-distance policy. See {@link ClosestXOptions}.
 * @returns A query selecting the nearest horizontal match, or undefined when none qualifies. See
 * {@link HoverQuery} , {@link ClosestXHit} .
 *
 * @see {@link ClosestXOptions}
 * @see {@link HoverQuery}
 * @see {@link ClosestXHit}
 */
export function closestX<D>(
  options: ClosestXOptions<D>,
): HoverQuery<ClosestXHit<D>> {
  return (context) => {
    limit(options.maxDelta, "closestX maxDelta");
    const query = resolveSignalValue(options.x);
    if (query === null) return undefined;
    finite(query, "closestX x");
    const xs = context.scale(options.xScale),
      ys = context.scale(options.yScale);
    const series = options.series,
      data = pointData(resolveSignalValue(series.data), "closestX");
    const x = pointAccessor(series.x),
      y = pointAccessor(series.y);
    let best: ClosestXHit<D> | undefined,
      delta = Infinity;
    for (let index = 0; index < data.length; index++) {
      const datum = data[index];
      if (series.defined && !series.defined(datum, index, data)) continue;
      const xv = x(datum, index, data),
        yv = y(datum, index, data);
      if (!finiteCoordinate(xv) || !finiteCoordinate(yv)) continue;
      const distance = Math.abs(query - xv);
      finite(distance, "closestX delta");
      if (
        distance < delta &&
        (options.maxDelta === undefined || distance <= options.maxDelta)
      ) {
        delta = distance;
        best = {
          datum,
          index,
          x: xv,
          y: yv,
          anchor: { x: xs.map(xv), y: ys.map(yv) },
          delta,
        };
      }
    }
    return best;
  };
}
/**
 * Returns a plain data-space linear interpolation function.
 *
 * @returns A linear interpolator for values bracketing a sample position. See
 * {@link HoverInterpolation} .
 *
 * @see {@link HoverInterpolation}
 */
export function linearInterpolation(): HoverInterpolation {
  return (before, after, fraction) => {
    finite(before, "linearInterpolation before");
    finite(after, "linearInterpolation after");
    finite(fraction, "linearInterpolation fraction");
    const result = before * (1 - fraction) + after * fraction;
    finite(result, "linearInterpolation result");
    return result;
  };
}
/**
 * Samples sorted recorded observations without bridging explicit data gaps.
 *
 * @param options - Series, horizontal sampling, and interpolation policy. See
 * {@link InterpolateXOptions} .
 * @returns A query producing an interpolated sample, or undefined when sampling is unavailable.
 * See {@link HoverQuery} , {@link HoverSample} .
 *
 * @see {@link InterpolateXOptions}
 * @see {@link HoverQuery}
 * @see {@link HoverSample}
 */
export function interpolateX<D>(
  options: InterpolateXOptions<D>,
): HoverQuery<HoverSample<D>> {
  return (context) => {
    limit(options.maxGap, "interpolateX maxGap");
    const policy = options.duplicateX ?? "error";
    if (!["error", "first", "last"].includes(policy))
      throw new TypeError(
        "interpolateX duplicateX must be error, first, or last.",
      );
    if (typeof options.interpolation !== "function")
      throw new TypeError("interpolateX requires an interpolation function.");
    const query = resolveSignalValue(options.x);
    if (query === null) return undefined;
    finite(query, "interpolateX x");
    const xs = context.scale(options.xScale),
      ys = context.scale(options.yScale);
    const series = options.series,
      data = pointData(resolveSignalValue(series.data), "interpolateX");
    const x = pointAccessor(series.x),
      y = pointAccessor(series.y);
    type Row = { datum: D; index: number; x: number; y: number };
    const segments: Row[][] = [];
    let segment: Row[] = [],
      previousX = -Infinity;
    const breakSegment = () => {
      if (segment.length) segments.push(segment);
      segment = [];
    };
    // Validate the complete source before answering even an exact query.
    for (let index = 0; index < data.length; index++) {
      const datum = data[index];
      if (series.defined && !series.defined(datum, index, data)) {
        breakSegment();
        continue;
      }
      const xv = x(datum, index, data),
        yv = y(datum, index, data);
      if (finiteCoordinate(xv)) {
        if (xv < previousX)
          throw new RangeError(
            "interpolateX requires nondecreasing source x order.",
          );
        previousX = xv;
      }
      if (!finiteCoordinate(xv) || !finiteCoordinate(yv)) {
        breakSegment();
        continue;
      }
      const row = { datum, index, x: xv, y: yv },
        previous = segment.at(-1);
      if (previous?.x === xv) {
        if (policy === "error")
          throw new RangeError(
            "interpolateX duplicate x requires an explicit first/last policy.",
          );
        if (policy === "last") segment[segment.length - 1] = row;
      } else segment.push(row);
    }
    breakSegment();
    for (const rows of segments) {
      for (let i = 0; i < rows.length; i++) {
        const before = rows[i];
        if (before.x === query)
          return {
            kind: "exact",
            ...before,
            anchor: { x: xs.map(query), y: ys.map(before.y) },
          };
        const after = rows[i + 1];
        if (!after || query <= before.x || query >= after.x) continue;
        const span = after.x - before.x,
          offset = query - before.x;
        finite(span, "interpolateX interval");
        finite(offset, "interpolateX offset");
        if (options.maxGap !== undefined && span > options.maxGap)
          return undefined;
        const fraction = offset / span,
          value = options.interpolation(before.y, after.y, fraction);
        finite(value, "interpolateX interpolator result");
        return {
          kind: "interpolated",
          x: query,
          y: value,
          before: before.datum,
          after: after.datum,
          beforeIndex: before.index,
          afterIndex: after.index,
          fraction,
          anchor: { x: xs.map(query), y: ys.map(value) },
        };
      }
    }
    return undefined;
  };
}
