import type { Signal } from "@pibbl/core";
import type { ResolvedLinearScale, ResolvedScale, ScaleId } from "./types.js";
import { scaleView } from "./scale-view.js";
const views = new WeakMap<Signal<ResolvedScale>, Signal<ResolvedLinearScale>>();
/**
 * Reads an ancestor linear scale as a stable, shared readonly signal.
 * @param id - Ancestor scale identity. See {@link ScaleId}.
 * @returns The reactive mapping. See {@link ResolvedLinearScale} and {@link Signal}.
 */
export function useLinearScale(id: ScaleId): Signal<ResolvedLinearScale> {
  return scaleView(views, id, "useLinearScale", (kind) => kind === "linear");
}
