import { resolveSignalValue, useLayoutBox } from "@pibbl/core";
import type { LogScaleProps } from "./types.js";
import { resolveLogScale } from "./log-scale.js";
import { useScaleProvider } from "./scale-provider.js";
/**
 * Provides a named positive logarithmic mapping to descendant marks and axes.
 * @param props - Identity, positive domain, range, and optional tick base. See {@link LogScaleProps}.
 * @returns Descendant content within the logarithmic scale scope.
 */
export function LogScale(props: LogScaleProps) {
  const { width, height } = useLayoutBox();
  useScaleProvider(props.id, "log", () => resolveLogScale(
    resolveSignalValue(props.domain), resolveSignalValue(props.range),
    resolveSignalValue(props.reverse ?? false), width, height, resolveSignalValue(props.base ?? 10),
  ), [props.domain, props.range, props.reverse, props.base, width, height]);
  return props.children;
}
