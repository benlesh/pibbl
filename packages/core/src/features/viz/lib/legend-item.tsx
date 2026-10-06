import { Rectangle, Text, resolveSignalValue, type SignalValue } from "@pibbl/core";
import type { SignalStyle } from "@pibbl/core/internal";
import type { AxisStyle } from "./types.js";
import { opacity } from "./paint.js";
/** A decorative swatch and label; the caller positions and allocates each item. */
export interface LegendItemProps {
  /** Single-line label, updated through a signal when needed. */
  readonly label: SignalValue<string>;
  /** Swatch paint, matched explicitly to the associated mark. */
  readonly color: SignalValue<NonNullable<AxisStyle["fill"]>>;
  /** Positive finite square side in local pixels, default 14. */
  readonly swatchSize?: SignalValue<number>;
  /** Nonnegative finite space after the swatch, default 4. */
  readonly gap?: SignalValue<number>;
  /** Label font defaults to 12px sans-serif, fill to #617783, opacity to 1. */
  readonly style?: SignalValue<SignalStyle<Pick<AxisStyle, "font" | "fill" | "opacity">>>;
}
/** Paint one legend entry without layout allocation, clipping, or interaction. */
export function LegendItem(props: LegendItemProps) {
  const label = resolveSignalValue(props.label), size = resolveSignalValue(props.swatchSize) ?? 14, gap = resolveSignalValue(props.gap) ?? 4;
  if (typeof label !== "string" || /[\r\n]/.test(label)) throw new TypeError("LegendItem label must be a single-line string.");
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0 || typeof gap !== "number" || !Number.isFinite(gap) || gap < 0 || !Number.isFinite(size + gap)) throw new RangeError("LegendItem requires a positive finite swatchSize and nonnegative finite gap.");
  const style = resolveSignalValue(props.style) ?? {}, alpha = opacity(resolveSignalValue(style.opacity) ?? 1, "LegendItem");
  return <>
    <Rectangle pointerEvents="none" style={{ width: size, height: size, fill: resolveSignalValue(props.color), opacity: alpha }} />
    <Text pointerEvents="none" style={{ left: size + gap, top: size / 2, textBaseline: "middle", font: resolveSignalValue(style.font) ?? "12px sans-serif", fill: resolveSignalValue(style.fill) ?? "#617783", opacity: alpha }}>{label}</Text>
  </>;
}
