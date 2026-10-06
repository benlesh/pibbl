import type { Signal } from "@pibbl/core";
import { scaleView } from "./scale-view.js";
import type {
  ResolvedScale,
  ResolvedContinuousScale,
  ResolvedPointScale,
  ScaleId,
  SeriesAccessor,
  SeriesCoordinate,
} from "./types.js";
type PositionScale = ResolvedContinuousScale | ResolvedPointScale;
const views = new WeakMap<Signal<ResolvedScale>, Signal<PositionScale>>();
/** Private position receiver; public scale hooks retain their dedicated contracts. */
export function useSeriesPosition(id: ScaleId): PositionScale {
  return scaleView(views, id, "Series", (kind) => kind !== "band").get();
}
export function seriesAccessor<D>(
  input: SeriesAccessor<D>,
): (datum: D, index: number, data: readonly D[]) => SeriesCoordinate {
  return typeof input === "function"
    ? input
    : (datum) => datum[input] as SeriesCoordinate;
}
export function mapSeriesPosition(
  scale: PositionScale,
  value: SeriesCoordinate,
): number | undefined {
  if (value == null || (typeof value === "number" && !Number.isFinite(value)))
    return undefined;
  if (scale.type === "point") {
    const mapped = scale.map(value);
    if (mapped === undefined)
      throw new RangeError(
        `Series: unknown point category ${String(value)} (${typeof value}).`,
      );
    return mapped;
  }
  if (typeof value !== "number")
    throw new TypeError(
      "Series: continuous coordinates must be numbers; use PointScale for categories.",
    );
  return scale.map(value);
}
