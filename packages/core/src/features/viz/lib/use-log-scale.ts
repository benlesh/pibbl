import type { Signal } from "@pibbl/core";
import type { ResolvedLogScale, ResolvedScale, ScaleId } from "./types.js";
import { scaleView } from "./scale-view.js";
const views = new WeakMap<Signal<ResolvedScale>, Signal<ResolvedLogScale>>();
/**
 * Reads an ancestor logarithmic scale as a stable shared readonly signal.
 * @param id - Ancestor scale identity. See {@link ScaleId}.
 * @returns The reactive logarithmic mapping. See {@link ResolvedLogScale}.
 */
export function useLogScale(id: ScaleId): Signal<ResolvedLogScale> {
  return scaleView(views, id, "useLogScale", kind => kind === "log");
}
