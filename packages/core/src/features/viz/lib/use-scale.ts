import { type Signal } from "@crc/core";
import type {
  ResolvedBandScale,
  ResolvedLinearScale,
  ResolvedScale,
  ScaleId,
} from "./types.js";
import { lookupScale } from "./scale-context.js";
/**
 * Reads a named continuous mapping as a signal. See {@link ScaleId}, {@link Signal}, and
 * {@link ResolvedLinearScale}.
 * @param id - Identity of an ancestor-provided scale. See {@link ScaleId}.
 * @param type - Expected scale kind; defaults to linear.
 * @returns A signal exposing the resolved scale of the requested kind. See {@link Signal} ,
 * {@link ResolvedLinearScale} .
 */
export function useScale(
  id: ScaleId,
  type?: "linear",
): Signal<ResolvedLinearScale>;
/**
 * Reads a named categorical mapping as a signal. See {@link ScaleId}, {@link Signal}, and
 * {@link ResolvedBandScale}.
 * @param id - Identity of an ancestor-provided scale. See {@link ScaleId}.
 * @param type - Expected scale kind; defaults to linear.
 * @returns A signal exposing the resolved scale of the requested kind. See {@link Signal} ,
 * {@link ResolvedBandScale} .
 */
export function useScale(id: ScaleId, type: "band"): Signal<ResolvedBandScale>;
/**
 * Reads the named scale of the requested kind as a reactive resolved mapping.
 *
 * @param id - Identity of an ancestor-provided scale. See {@link ScaleId}.
 * @param type - Expected scale kind; defaults to linear.
 * @returns A signal exposing the resolved scale of the requested kind. See {@link Signal} ,
 * {@link ResolvedScale} .
 *
 * @see {@link ScaleId}
 * @see {@link Signal}
 * @see {@link ResolvedScale}
 */
export function useScale(
  id: ScaleId,
  type: "linear" | "band" = "linear",
): Signal<ResolvedScale> {
  const scale = lookupScale(id, "useScale", type);
  if (!scale) throw new TypeError("useScale requires a scale ID.");
  return scale;
}
