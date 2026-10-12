import { useComputed } from "@pibbl/core";
import { equalScale } from "./linear-scale.js";
import { provideScale } from "./scale-context.js";
import type { ResolvedScale, ScaleId } from "./types.js";
export function useScaleProvider(id: ScaleId, kind: ResolvedScale["type"], resolve: () => ResolvedScale, dependencies: readonly unknown[]): void {
  if ((typeof id !== "string" || id.length === 0) && typeof id !== "symbol")
    throw new TypeError("Scale id requires a nonempty string or symbol.");
  const value = useComputed(resolve, dependencies, { equals: equalScale });
  provideScale(id, value, kind);
}
