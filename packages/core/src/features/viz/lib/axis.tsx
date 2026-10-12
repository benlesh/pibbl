import { Path, Text, resolveSignalValue, useCanvasContext } from "@pibbl/core";
import type { AxisProps } from "./types.js";
import { lookupScale } from "./scale-context.js";
import { width, opacity } from "./paint.js";

import { fitAxisLabel } from "./axis-labels.js";

import { ticks, position } from "./scale-ticks.js";

/**
 * Draws ticks and labels using a named scale and the configured orientation and style.
 *
 * @param props - Scale, orientation, tick, label, and styling options. See {@link AxisProps}.
 * @returns Pibbl nodes drawing the axis.
 *
 * @see {@link AxisProps}
 */
export function Axis(props: AxisProps) {
  if (
    props.position !== "bottom" &&
    props.position !== "left" &&
    props.position !== "top" &&
    props.position !== "right"
  )
    throw new TypeError("Axis position must be bottom, left, top, or right.");
  const source = lookupScale(props.scale, "Axis");
  if (!source) throw new TypeError("Axis requires a scale ID.");
  const scale = source.get();
  const style = resolveSignalValue(props.style) ?? {};
  const stroke = resolveSignalValue(style.stroke) ?? "#64748b";
  const strokeWidth = width(resolveSignalValue(style.strokeWidth) ?? 1, "Axis");
  const fill = resolveSignalValue(style.fill) ?? "#64748b";
  const font = resolveSignalValue(style.font) ?? "12px sans-serif";
  const alpha = opacity(resolveSignalValue(style.opacity) ?? 1, "Axis");
  const horizontal = props.position === "bottom" || props.position === "top";
  const outward = props.position === "bottom" || props.position === "right" ? 1 : -1;
  const baseline = horizontal
    ? props.position === "bottom" ? scale.frame.height : 0
    : props.position === "right" ? scale.frame.width : 0;
  const selected = ticks(scale, props);
  const context = useCanvasContext();
  const overlap = resolveSignalValue(props.labelOverlap ?? "allow");
  const gap = resolveSignalValue(props.labelGap ?? 8);
  if (overlap !== "allow" && overlap !== "skip") throw new TypeError("Axis labelOverlap must be allow or skip.");
  if (!Number.isFinite(gap) || gap < 0) throw new RangeError("Axis labelGap must be finite and nonnegative.");
  const overflow = resolveSignalValue(props.labelOverflow ?? "allow");
  const maxWidth = props.labelMaxWidth === undefined ? undefined : resolveSignalValue(props.labelMaxWidth);
  const maxLines = resolveSignalValue(props.labelMaxLines ?? 2);
  const lineHeightInput = props.labelLineHeight === undefined ? undefined : resolveSignalValue(props.labelLineHeight);
  if (!["allow", "wrap", "truncate"].includes(overflow)) throw new TypeError("Axis labelOverflow must be allow, wrap, or truncate.");
  if ((overflow !== "allow" && maxWidth === undefined) || (maxWidth !== undefined && (!Number.isFinite(maxWidth) || maxWidth <= 0))) throw new RangeError("Axis labelMaxWidth must be positive and finite for wrap/truncate.");
  if (!Number.isInteger(maxLines) || maxLines < 1 || maxLines > 20) throw new RangeError("Axis labelMaxLines must be an integer from 1 to 20.");
  if (lineHeightInput !== undefined && (!Number.isFinite(lineHeightInput) || lineHeightInput <= 0)) throw new RangeError("Axis labelLineHeight must be positive and finite.");
  let lineHeight = 0;
  const lines: (readonly string[])[] = [];
  const occupied: { start: number; end: number }[] = [];
  const visible = new Set<number>();
  const texts = selected.map((value, index) => {
    const label = props.tickFormat ? props.tickFormat(value, index)
      : scale.type === "utc" ? scale.formatTick(value as number)
      : typeof value === "number" ? String(Number(value.toPrecision(6))) : value;
    if (typeof label !== "string") throw new TypeError("Axis tickFormat must return a string.");
    return label;
  });
  // Endpoints have priority; sort by physical position for reversed ranges too.
  const order = selected.map((value, index) => ({ index, p: position(scale, value) })).sort((a, b) => a.p - b.p);
  const priority = order.length > 1 ? [order[0], order[order.length - 1], ...order.slice(1, -1)] : order;
  context.save();
  try {
    context.font = font;
    const fontMetrics = context.measureText("Mg");
    lineHeight = lineHeightInput ?? Math.ceil(fontMetrics.actualBoundingBoxAscent + fontMetrics.actualBoundingBoxDescent + 4);
    for (const text of texts) lines.push(fitAxisLabel(context, text, maxWidth ?? Infinity, overflow, maxLines));
    for (const { index, p } of priority) {
      const metrics = lines[index].map(text => context.measureText(text));
      const size = horizontal ? Math.max(...metrics.map(m => m.width)) : (lines[index].length - 1) * lineHeight + Math.max(...metrics.map(m => m.actualBoundingBoxAscent + m.actualBoundingBoxDescent));
      const interval = { start: p - size / 2, end: p + size / 2 };
      if (overlap === "allow" || occupied.every(other => interval.end + gap <= other.start || interval.start >= other.end + gap)) {
        visible.add(index); occupied.push(interval);
      }
    }
  } finally { context.restore(); }
  const path = new Path2D();
  if (horizontal) {
    path.moveTo(scale.range[0], baseline);
    path.lineTo(scale.range[1], baseline);
  } else {
    path.moveTo(baseline, scale.range[0]);
    path.lineTo(baseline, scale.range[1]);
  }
  const labels = selected.map((value, index) => {
    const p = position(scale, value);
    if (horizontal) {
      path.moveTo(p, baseline);
      path.lineTo(p, baseline + outward * 6);
    } else {
      path.moveTo(baseline, p);
      path.lineTo(baseline + outward * 6, p);
    }
    if (!visible.has(index)) return null;
    return lines[index].map((label, lineIndex) => (
      <Text
        key={`${index}:${lineIndex}`}
        pointerEvents="none"
        style={{
          left: horizontal ? p : baseline + outward * 10,
          top: horizontal ? baseline + outward * 10 + (outward > 0 ? lineIndex : lineIndex - lines[index].length + 1) * lineHeight : p + (lineIndex - (lines[index].length - 1) / 2) * lineHeight,
          fill,
          font,
          opacity: alpha,
          textAlign: horizontal ? "center" : outward < 0 ? "right" : "left",
          textBaseline: horizontal ? outward > 0 ? "top" : "bottom" : "middle",
        }}
      >
        {label}
      </Text>
    ));
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
