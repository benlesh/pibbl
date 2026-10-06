import type { Signal } from "@pibbl/core";
import type { ResolvedSymlogScale, ResolvedScale, ScaleId } from "./types.js";
import { scaleView } from "./scale-view.js";
const views = new WeakMap<Signal<ResolvedScale>, Signal<ResolvedSymlogScale>>();
/**
 * Reads an ancestor symlog scale as a stable shared readonly signal.
 * @param id - Ancestor scale identity. See {@link ScaleId}.
 * @returns The reactive mapping. See {@link ResolvedSymlogScale}.
 */
export function useSymlogScale(id: ScaleId): Signal<ResolvedSymlogScale> {
  return scaleView(views, id, "useSymlogScale", kind => kind === "symlog");
}
