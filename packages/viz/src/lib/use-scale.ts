import type { Signal } from "@crc/core";
import type { ResolvedScale, ScaleId } from "./types.js";
import { lookupScale } from "./scale-context.js";
export function useScale(id: ScaleId): Signal<ResolvedScale> {
  const scale = lookupScale(id, "useScale");
  if (!scale) throw new TypeError("useScale requires a scale ID.");
  return scale;
}
