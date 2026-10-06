import { resolveSignalValue, useLayoutBox } from "@pibbl/core";
import type { PointScaleProps } from "./types.js";
import { resolvePointScale } from "./point-scale.js";
import { useScaleProvider } from "./scale-provider.js";
/**
 * Provides a named point mapping to descendant visualization components.
 * @param props - Identity, domain, range, and padding. See {@link PointScaleProps}.
 * @returns Descendant content within the scale scope.
 */
export function PointScale(props: PointScaleProps) {
  const { width, height } = useLayoutBox();
  useScaleProvider(props.id, "point", () => resolvePointScale(
    resolveSignalValue(props.domain), resolveSignalValue(props.range),
    resolveSignalValue(props.reverse ?? false), width, height, resolveSignalValue(props.padding ?? 0),
  ), [props.domain, props.range, props.reverse, props.padding, width, height]);
  return props.children;
}
