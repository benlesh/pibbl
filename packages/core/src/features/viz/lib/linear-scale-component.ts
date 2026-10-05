import { resolveSignalValue, useLayoutBox } from "@pibbl/core";
import type { LinearScaleProps } from "./types.js";
import { resolveLinearScale } from "./linear-scale.js";
import { useScaleProvider } from "./scale-provider.js";
/**
 * Provides a named linear mapping to descendant visualization components.
 * @param props - Identity, domain, range, and children. See {@link LinearScaleProps}.
 * @returns Descendant content within the scale scope.
 */
export function LinearScale(props: LinearScaleProps) {
  const { width, height } = useLayoutBox();
  useScaleProvider(props.id, "linear", () => resolveLinearScale(
    resolveSignalValue(props.domain), resolveSignalValue(props.range),
    resolveSignalValue(props.reverse ?? false), width, height,
  ), [props.domain, props.range, props.reverse, width, height]);
  return props.children;
}
