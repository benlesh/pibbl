import type { ResolvedLinearScale } from "./types.js";
import type { PointAccessor } from "./point-types.js";
import { finiteCoordinate, pointAccessor, pointData } from "./point-data.js";
export interface NearestPointOptions<D> {
  readonly x: PointAccessor<D>;
  readonly y: PointAccessor<D>;
  readonly xScale: ResolvedLinearScale;
  readonly yScale: ResolvedLinearScale;
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
  readonly maxDistance?: number;
}
export interface NearestPoint<D> {
  readonly datum: D;
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly distance: number;
}
function finite(value: unknown, name: string): asserts value is number {
  if (!finiteCoordinate(value)) throw new RangeError(`${name} must be finite.`);
}
export function nearestDomainValue(
  values: readonly number[],
  rangeValue: number,
  scale: ResolvedLinearScale,
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
