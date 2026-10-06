import { Line, resolveSignalValue, type SignalValue } from "@pibbl/core";
import type { AxisProps, AxisStyle, BandCategory, ScaleId } from "./types.js";
import type { SignalStyle } from "@pibbl/core/internal";
import { lookupScale } from "./scale-context.js";
import { ticks, position } from "./scale-ticks.js";
import { width, opacity } from "./paint.js";
/** Shared geometry and paint for decorative chart lines; no layout is allocated. */
export interface ChartLineProps {
  /** Ancestor scale providing the line's mapped coordinate. */
  readonly scale: ScaleId;
  /** Direction the painted line extends. */
  readonly direction: "horizontal" | "vertical";
  /** Explicit perpendicular pixel endpoints, in the caller's local coordinate space. */
  readonly span: SignalValue<readonly [number, number]>;
  /** Stroke defaults to #dce5e8, width to 1, opacity to 1. */
  readonly style?: SignalValue<SignalStyle<Pick<AxisStyle, "stroke" | "strokeWidth" | "opacity">>>;
}
/** Grid positions use Axis tick rules, independent of Axis label visibility. */
export type GridLinesProps = ChartLineProps & (
  { readonly tickValues: AxisProps["tickValues"]; readonly tickCount?: never } |
  { readonly tickValues?: never; readonly tickCount?: AxisProps["tickCount"] }
);
/** A reference value must belong to the selected scale's domain. */
export interface ReferenceLineProps extends ChartLineProps {
  /** Numeric domain value or categorical identity; signals update the line. */
  readonly value: SignalValue<BandCategory>;
}
function lines(props: ChartLineProps, selection: Pick<AxisProps, "tickCount" | "tickValues">) {
  if (props.direction !== "horizontal" && props.direction !== "vertical") throw new TypeError("Chart line direction must be horizontal or vertical.");
  const source = lookupScale(props.scale, "Chart line");
  if (!source) throw new TypeError("Chart lines require a scale ID.");
  const scale = source.get(), span = resolveSignalValue(props.span);
  if (!Array.isArray(span) || span.length !== 2 || !span.every(v => typeof v === "number" && Number.isFinite(v))) throw new RangeError("Chart line span must have two finite pixel endpoints.");
  const style = resolveSignalValue(props.style) ?? {};
  const stroke = resolveSignalValue(style.stroke) ?? "#dce5e8";
  const strokeWidth = width(resolveSignalValue(style.strokeWidth) ?? 1, "Chart line");
  const alpha = opacity(resolveSignalValue(style.opacity) ?? 1, "Chart line");
  return ticks(scale, selection).map((value, index) => {
    const p = position(scale, value);
    const coords: [number, number][] = props.direction === "horizontal" ? [[span[0], p], [span[1], p]] : [[p, span[0]], [p, span[1]]];
    return <Line key={index} pointerEvents="none" style={{ coords, stroke, strokeWidth, opacity: alpha }} />;
  });
}
/** Paint grid lines at scale ticks, without labels or allocation. */
export function GridLines(props: GridLinesProps) { return lines(props, props); }
/** Paint one decorative line at a domain value, without labels or allocation. */
export function ReferenceLine(props: ReferenceLineProps) { return lines(props, { tickValues: [resolveSignalValue(props.value)] }); }
