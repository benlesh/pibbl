import { resolveSignalValue, useComputed, useLayoutBox } from "@pibbl/core";
import type { BarScaleProps, ScaleRange } from "./types.js";
import { resolveBandScale } from "./band-scale.js";
import { captureScaleLookup } from "./scale-context.js";
import { useScaleProvider } from "./scale-provider.js";
/**
 * Provides categorical bands, including nested groups sized to a parent band.
 * @param props - Categories, spacing, range, and children. See {@link BarScaleProps}.
 * @returns Descendant content within the scale scope.
 */
export function BarScale(props: BarScaleProps) {
  const { width, height } = useLayoutBox();
  const lookup = captureScaleLookup("BarScale bandwidthOf");
  function resolveParent() {
    const range = resolveSignalValue(props.range);
    if (typeof range !== "object" || range === null || !("bandwidthOf" in range)) return undefined;
    const parent = lookup(range.bandwidthOf)?.get();
    if (!parent || parent.type !== "band") throw new TypeError("BarScale bandwidthOf requires an ancestor band scale.");
    return parent;
  }
  const parent = useComputed(resolveParent, [props.range, lookup]).get();
  useScaleProvider(props.id, "band", () => {
    const currentParent = resolveParent();
    const range: ScaleRange = currentParent ? [0, currentParent.bandwidth] : resolveSignalValue(props.range) as ScaleRange;
    return resolveBandScale(resolveSignalValue(props.domain), range,
      resolveSignalValue(props.reverse ?? false), width, height,
      resolveSignalValue(props.paddingInner ?? 0), resolveSignalValue(props.paddingOuter ?? 0));
  }, [parent, props.domain, props.range, props.reverse, props.paddingInner, props.paddingOuter, width, height]);
  return props.children;
}
