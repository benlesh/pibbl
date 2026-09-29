import { Group, resolveSignalValue } from "@crc/core";
import type { ScaleAdjustProps } from "./types.js";
import { lookupScale } from "./scale-context.js";
export function ScaleAdjust(props: ScaleAdjustProps) {
  const x = lookupScale(props.xScale, "ScaleAdjust");
  const y = lookupScale(props.yScale, "ScaleAdjust");
  if (
    (props.x === undefined) !== (props.xScale === undefined) ||
    (props.y === undefined) !== (props.yScale === undefined)
  )
    throw new TypeError("ScaleAdjust coordinates require matching scale IDs.");
  if ((x && x.get().type !== "linear") || (y && y.get().type !== "linear"))
    throw new TypeError("ScaleAdjust requires linear scales.");
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
