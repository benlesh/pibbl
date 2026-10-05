import { Group, resolveSignalValue } from "@pibbl/core";
import type { ScaleAdjustProps } from "./types.js";
import { lookupScale } from "./scale-context.js";
/**
 * Adjusts descendant placement using configured x and y scales.
 *
 * @param props - Scale identity and domain or range adjustments for descendants. See
 * {@link ScaleAdjustProps} .
 * @returns Child content evaluated with the adjusted scale.
 *
 * @see {@link ScaleAdjustProps}
 */
export function ScaleAdjust(props: ScaleAdjustProps) {
  const x = lookupScale(props.xScale, "ScaleAdjust");
  const y = lookupScale(props.yScale, "ScaleAdjust");
  if (
    (props.x === undefined) !== (props.xScale === undefined) ||
    (props.y === undefined) !== (props.yScale === undefined)
  )
    throw new TypeError("ScaleAdjust coordinates require matching scale IDs.");
  if ((x && x.get().type === "band") || (y && y.get().type === "band"))
    throw new TypeError("ScaleAdjust requires continuous scales.");
  return (
    <Group
      style={{
        translateX: x ? x.get().map(resolveSignalValue(props.x!)) : 0,
        translateY: y ? y.get().map(resolveSignalValue(props.y!)) : 0,
      }}
    >
      {props.children}
    </Group>
  );
}
