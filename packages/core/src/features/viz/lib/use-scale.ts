import { type Signal } from "@crc/core";
import type {
  ResolvedBandScale,
  ResolvedContinuousScale,
  ResolvedLinearScale,
  ResolvedScale,
  ResolvedUtcScale,
  ScaleId,
} from "./types.js";
import { lookupScale } from "./scale-context.js";
export function useScale(
  id: ScaleId,
  type?: "linear",
): Signal<ResolvedLinearScale>;
export function useScale(id: ScaleId, type: "band"): Signal<ResolvedBandScale>;
export function useScale(id: ScaleId, type: "utc"): Signal<ResolvedUtcScale>;
export function useScale(
  id: ScaleId,
  type: "continuous",
): Signal<ResolvedContinuousScale>;
export function useScale(
  id: ScaleId,
  type: "linear" | "band" | "utc" | "continuous" = "linear",
): Signal<ResolvedScale> {
  const scale = lookupScale(id, "useScale", type);
  if (!scale) throw new TypeError("useScale requires a scale ID.");
  return scale;
}
