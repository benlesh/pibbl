import type { Signal } from "@pibbl/core";
import type { ResolvedUtcScale, ResolvedScale, ScaleId } from "./types.js";
import { scaleView } from "./scale-view.js";
const views = new WeakMap<Signal<ResolvedScale>, Signal<ResolvedUtcScale>>();
/**
 * Reads an ancestor utc scale as a stable, shared readonly signal.
 * @param id - Ancestor scale identity. See {@link ScaleId}.
 * @returns The reactive mapping. See {@link ResolvedUtcScale} and {@link Signal}.
 */
export function useUTCScale(id: ScaleId): Signal<ResolvedUtcScale> {
  return scaleView(views, id, "useUTCScale", (kind) => kind === "utc");
}
