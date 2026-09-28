import { Path, Text, resolveSignalValue } from "@crc/core";
import type { AxisProps } from "./types.js";
import { useScale } from "./use-scale.js";
import { width, opacity } from "./paint.js";
export function Axis(props: AxisProps) {
  const scale = useScale(props.scale).get();
  if (props.position !== "bottom" && props.position !== "left")
    throw new TypeError("Axis position must be bottom or left.");
  const style = resolveSignalValue(props.style) ?? {};
  const stroke = resolveSignalValue(style.stroke) ?? "#64748b";
  const strokeWidth = width(resolveSignalValue(style.strokeWidth) ?? 1, "Axis");
  const fill = resolveSignalValue(style.fill) ?? "#64748b";
  const font = resolveSignalValue(style.font) ?? "12px sans-serif";
  const alpha = opacity(resolveSignalValue(style.opacity) ?? 1, "Axis");
  const bottom = props.position === "bottom";
  const h = scale.frame.height;
  const path = new Path2D();
  path.moveTo(bottom ? scale.range[0] : 0, bottom ? h : scale.range[0]);
  path.lineTo(bottom ? scale.range[1] : 0, bottom ? h : scale.range[1]);
  const labels = scale
    .ticks(resolveSignalValue(props.tickCount) ?? 5)
    .map((value, index) => {
      const p = scale.map(value);
      path.moveTo(bottom ? p : 0, bottom ? h : p);
      path.lineTo(bottom ? p : -6, bottom ? h + 6 : p);
      const label = props.tickFormat
        ? props.tickFormat(value, index)
        : String(Number(value.toPrecision(6)));
      if (typeof label !== "string")
        throw new TypeError("Axis tickFormat must return a string.");
      return (
        <Text
          key={index}
          pointerEvents="none"
          style={{
            x: bottom ? p : -10,
            y: bottom ? h + 10 : p,
            fill,
            font,
            opacity: alpha,
            textAlign: bottom ? "center" : "right",
            textBaseline: bottom ? "top" : "middle",
          }}
        >
          {label}
        </Text>
      );
    });
  return [
    <Path
      key="axis"
      pointerEvents="none"
      style={{ d: path, stroke, strokeWidth, opacity: alpha }}
    />,
    labels,
  ];
}
