import { resolveSignalValue } from "@crc/core";
import { finiteCoordinate, pointAccessor, pointData } from "./point-data.js";
import type {
  ClosestPointHit,
  ClosestPointOptions,
  HoverQuery,
  HoverSeries,
  HoverSeriesMap,
} from "./hover-types.js";
/** Creates a data descriptor without observing or copying its dataset. */
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
/** Creates an ordinary query function for the closest mapped recorded point. */
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
