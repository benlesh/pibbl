import { resolveSignalValue, useComputed, useLayoutBox } from "@crc/core";
import type { ScaleProps } from "./types.js";
import { equalScale, resolveLinearScale } from "./linear-scale.js";
import { resolveBandScale } from "./band-scale.js";
import { provideScale } from "./scale-context.js";
export function Scale(props: ScaleProps) {
  if (
    (typeof props.id !== "string" || props.id.length === 0) &&
    typeof props.id !== "symbol"
  )
    throw new TypeError("Scale id requires a nonempty string or symbol.");
  if (props.type !== "linear" && props.type !== "band")
    throw new TypeError(`Scale supports type="linear" or type="band".`);
  const { width, height } = useLayoutBox();
  const dependencies = [
    props.type,
    props.domain,
    props.range,
    props.reverse,
    props.type === "band" ? props.paddingInner : undefined,
    props.type === "band" ? props.paddingOuter : undefined,
    width,
    height,
  ];
  const value = useComputed(
    () =>
      props.type === "band"
        ? resolveBandScale(
            resolveSignalValue(props.domain),
            resolveSignalValue(props.range),
            resolveSignalValue(props.reverse ?? false),
            width,
            height,
            resolveSignalValue(props.paddingInner ?? 0),
            resolveSignalValue(props.paddingOuter ?? 0),
          )
        : resolveLinearScale(
            resolveSignalValue(props.domain),
            resolveSignalValue(props.range),
            resolveSignalValue(props.reverse ?? false),
            width,
            height,
          ),
    dependencies,
    { equals: equalScale },
  );
  const linear = useComputed(() => {
    const resolved = value.get();
    if (resolved.type !== "linear")
      throw new TypeError(
        'useScale requires type=linear; use useScale(id, "band") for band scales.',
      );
    return resolved;
  }, dependencies);
  const band = useComputed(() => {
    const resolved = value.get();
    if (resolved.type !== "band")
      throw new TypeError("useScale requires type=band.");
    return resolved;
  }, dependencies);
  provideScale(props.id, value, linear, band);
  return props.children;
}
