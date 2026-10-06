import type { Signal } from "@pibbl/core";
import type { ResolvedPointScale, ResolvedScale, ScaleId } from "./types.js";
import { scaleView } from "./scale-view.js";
const views = new WeakMap<Signal<ResolvedScale>, Signal<ResolvedPointScale>>();
/**
 * Reads an ancestor point scale as a stable shared readonly signal.
 * @param id - Ancestor scale identity. See {@link ScaleId}.
 * @returns The reactive mapping. See {@link ResolvedPointScale}.
 */
export function usePointScale(id: ScaleId): Signal<ResolvedPointScale> {
  return scaleView(views, id, "usePointScale", kind => kind === "point");
}
