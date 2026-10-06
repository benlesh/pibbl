import { Group, resolveSignalValue } from "@pibbl/core";
import type { ScaleAdjustProps, ResolvedScale, BandCategory } from "./types.js";
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
  const coordinate = (scale: ResolvedScale, value: BandCategory) => {
    if (scale.type === "band") throw new TypeError("ScaleAdjust requires continuous or point scales.");
    if (scale.type !== "point" && typeof value !== "number") throw new TypeError("ScaleAdjust continuous coordinates must be numbers.");
    const result = scale.type === "point" ? scale.map(value) : scale.map(value as number);
    if (result === undefined) throw new RangeError("ScaleAdjust point category is not in the domain.");
    return result;
  };
  return (
    <Group
      style={{
        translateX: x ? coordinate(x.get(), resolveSignalValue(props.x!)) : 0,
        translateY: y ? coordinate(y.get(), resolveSignalValue(props.y!)) : 0,
      }}
    >
      {props.children}
    </Group>
  );
}
