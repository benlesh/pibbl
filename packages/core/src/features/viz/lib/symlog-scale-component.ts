import { resolveSignalValue, useLayoutBox } from "@pibbl/core";
import type { SymlogScaleProps } from "./types.js";
import { resolveSymlogScale } from "./symlog-scale.js";
import { useScaleProvider } from "./scale-provider.js";
/**
 * Provides a named symlog mapping to descendant visualization components.
 * @param props - Identity, domain, range, and constant. See {@link SymlogScaleProps}.
 * @returns Descendant content within the scale scope.
 */
export function SymlogScale(props: SymlogScaleProps) {
  const { width, height } = useLayoutBox();
  useScaleProvider(props.id, "symlog", () => resolveSymlogScale(
    resolveSignalValue(props.domain), resolveSignalValue(props.range),
    resolveSignalValue(props.reverse ?? false), width, height, resolveSignalValue(props.constant ?? 1),
  ), [props.domain, props.range, props.reverse, props.constant, width, height]);
  return props.children;
}
