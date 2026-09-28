import { resolveSignalValue, useComputed, useLayoutBox } from "@crc/core";
import type { ScaleProps } from "./types.js";
import { equalScale, resolveLinearScale } from "./linear-scale.js";
import { provideScale } from "./scale-context.js";
export function Scale(props: ScaleProps) {
  if (
    (typeof props.id !== "string" || props.id.length === 0) &&
    typeof props.id !== "symbol"
  )
    throw new TypeError("Scale id requires a nonempty string or symbol.");
  if (props.type !== "linear")
    throw new TypeError(
      `Scale ${String(props.id)} supports type="linear" only.`,
    );
  const { width, height } = useLayoutBox();
  const value = useComputed(
    () =>
      resolveLinearScale(
        resolveSignalValue(props.domain),
        resolveSignalValue(props.range),
        resolveSignalValue(props.reverse ?? false),
        width,
        height,
      ),
    [props.domain, props.range, props.reverse, width, height],
    { equals: equalScale },
  );
  provideScale(props.id, value);
  return props.children;
}
