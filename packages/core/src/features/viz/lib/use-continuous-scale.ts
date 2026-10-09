import type { Signal } from "@pibbl/core";
import type {
  ResolvedContinuousScale,
  ResolvedScale,
  ScaleId,
} from "./types.js";
import { scaleView } from "./scale-view.js";
const views = new WeakMap<
  Signal<ResolvedScale>,
  Signal<ResolvedContinuousScale>
>();
/**
 * Reads an ancestor continuous scale as a stable, shared readonly signal.
 * @param id - Ancestor scale identity. See {@link ScaleId}.
 * @returns The reactive mapping. See {@link ResolvedContinuousScale} and {@link Signal}.
 */
export function useContinuousScale(
  id: ScaleId,
): Signal<ResolvedContinuousScale> {
  return scaleView(
    views,
    id,
    "useContinuousScale",
    (kind) => kind !== "band" && kind !== "point" && kind !== "trading-time",
  );
}
