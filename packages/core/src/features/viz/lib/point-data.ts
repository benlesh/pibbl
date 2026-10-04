import type { PointAccessor } from "./point-types.js";
import type { LineCoordinate } from "./types.js";
export function pointAccessor<D>(
  input: PointAccessor<D>,
): (datum: D, index: number, data: readonly D[]) => LineCoordinate {
  return typeof input === "function"
    ? input
    : (datum) => datum[input] as LineCoordinate;
}
export function finiteCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
export function pointData<D>(
  data: readonly D[],
  receiver: string,
): readonly D[] {
  if (!Array.isArray(data))
    throw new TypeError(`${receiver}: data must be an array.`);
  return data;
}
