import { resolveSignalValue, useLayoutBox } from "@pibbl/core";
import type { UTCScaleProps } from "./types.js";
import { resolveUtcScale } from "./utc-scale.js";
import { useScaleProvider } from "./scale-provider.js";
/**
 * Provides a named utc mapping to descendant visualization components.
 * @param props - Identity, domain, range, and children. See {@link UTCScaleProps}.
 * @returns Descendant content within the scale scope.
 */
export function UTCScale(props: UTCScaleProps) {
  const { width, height } = useLayoutBox();
  useScaleProvider(props.id, "utc", () => resolveUtcScale(
    resolveSignalValue(props.domain), resolveSignalValue(props.range),
    resolveSignalValue(props.reverse ?? false), width, height,
  ), [props.domain, props.range, props.reverse, width, height]);
  return props.children;
}
