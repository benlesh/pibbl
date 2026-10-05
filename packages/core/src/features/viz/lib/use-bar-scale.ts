import type { Signal } from "@pibbl/core";
import type { ResolvedBandScale, ResolvedScale, ScaleId } from "./types.js";
import { scaleView } from "./scale-view.js";
const views = new WeakMap<Signal<ResolvedScale>, Signal<ResolvedBandScale>>();
/**
 * Reads an ancestor band scale as a stable, shared readonly signal.
 * @param id - Ancestor scale identity. See {@link ScaleId}.
 * @returns The reactive mapping. See {@link ResolvedBandScale} and {@link Signal}.
 */
export function useBarScale(id: ScaleId): Signal<ResolvedBandScale> {
  return scaleView(views, id, "useBarScale", (kind) => kind === "band");
}
