import { Group, Text, resolveSignalValue, type SignalValue } from "@pibbl/core";
import type { SignalStyle } from "@pibbl/core/internal";
import type { AxisProps, AxisStyle, ScaleId } from "./types.js";
import { lookupScale } from "./scale-context.js";
import { opacity } from "./paint.js";
/** Scale-aligned axis text; callers reserve the margin outside the plot. */
export interface AxisTitleProps {
  /** Ancestor scale whose range supplies the title midpoint. */
  readonly scale: ScaleId;
  /** Plot edge; left/right titles rotate along the axis. */
  readonly position: AxisProps["position"];
  /** Single-line title. */
  readonly label: SignalValue<string>;
  /** Optional unit appended in parentheses; empty string omits it. */
  readonly unit?: SignalValue<string>;
  /** Nonnegative finite distance outside the plot edge, default 40 pixels. */
  readonly offset?: SignalValue<number>;
  /** Font defaults to 12px sans-serif, fill to #617783, opacity to 1. */
  readonly style?: SignalValue<SignalStyle<Pick<AxisStyle, "font" | "fill" | "opacity">>>;
}
/** Paint an axis title with optional units, without allocating margins or changing ticks. */
export function AxisTitle(props: AxisTitleProps) {
  if (!["top", "bottom", "left", "right"].includes(props.position)) throw new TypeError("AxisTitle position must be top, bottom, left, or right.");
  const source = lookupScale(props.scale, "AxisTitle");
  if (!source) throw new TypeError("AxisTitle requires a scale ID.");
  const scale = source.get(), label = resolveSignalValue(props.label), unit = resolveSignalValue(props.unit) ?? "";
  if ([label, unit].some(value => typeof value !== "string" || /[\r\n]/.test(value))) throw new TypeError("AxisTitle label and unit must be single-line strings.");
  const offset = resolveSignalValue(props.offset) ?? 40;
  if (typeof offset !== "number" || !Number.isFinite(offset) || offset < 0) throw new RangeError("AxisTitle offset must be finite and nonnegative.");
  const horizontal = props.position === "top" || props.position === "bottom";
  const midpoint = scale.range[0] / 2 + scale.range[1] / 2;
  const x = horizontal ? midpoint : props.position === "left" ? -offset : scale.frame.width + offset;
  const y = horizontal ? props.position === "top" ? -offset : scale.frame.height + offset : midpoint;
  const style = resolveSignalValue(props.style) ?? {};
  return <Group style={{ translateX: x, translateY: y }}><Group style={{ rotationDegrees: horizontal ? 0 : props.position === "left" ? -90 : 90 }}>
    <Text pointerEvents="none" style={{ textAlign: "center", textBaseline: "middle", font: resolveSignalValue(style.font) ?? "12px sans-serif", fill: resolveSignalValue(style.fill) ?? "#617783", opacity: opacity(resolveSignalValue(style.opacity) ?? 1, "AxisTitle") }}>{unit ? `${label} (${unit})` : label}</Text>
  </Group></Group>;
}
