import { Path, Text, resolveSignalValue, useCanvasContext } from "@pibbl/core";
import type { AxisProps, BandCategory, ResolvedScale } from "./types.js";
import { lookupScale } from "./scale-context.js";
import { width, opacity } from "./paint.js";

type Tick = number | string;

function ticks(scale: ResolvedScale, props: AxisProps): readonly Tick[] {
  if (props.tickValues !== undefined && props.tickCount !== undefined)
    throw new TypeError("Axis tickValues and tickCount are mutually exclusive.");
  const explicit = props.tickValues === undefined
    ? undefined
    : resolveSignalValue(props.tickValues);
  if (explicit !== undefined) {
    if (!Array.isArray(explicit) || explicit.length > 100)
      throw new RangeError("Axis tickValues must be an array with at most 100 values.");
    const seen = new Set<Tick>();
    for (const value of explicit) {
      if (seen.has(value)) throw new RangeError("Axis tickValues must not contain duplicates.");
      seen.add(value);
      if (scale.type !== "band") {
        if (typeof value !== "number" || !Number.isFinite(value))
          throw new TypeError("Axis tickValues for a continuous scale must be finite numbers.");
        const [a, b] = scale.domain;
        if (value < Math.min(a, b) || value > Math.max(a, b))
          throw new RangeError("Axis tickValues must be within the scale domain.");
      } else if (
        (typeof value !== "string" &&
          (typeof value !== "number" || !Number.isFinite(value))) ||
        scale.map(value as BandCategory) === undefined
      ) {
        throw new RangeError("Axis tickValues must be known band categories.");
      }
    }
    return explicit;
  }
  const count = resolveSignalValue(props.tickCount ?? 5);
  if (!Number.isInteger(count) || count < 0 || count > 100)
    throw new RangeError("Axis tickCount must be an integer from 0 to 100.");
  if (count === 0) return [];
  if (scale.type !== "band")
    return count === 1 ? [scale.domain[0]] : scale.ticks(count);
  const n = scale.domain.length;
  if (n === 0) return [];
  if (count === 1) return [scale.domain[0]];
  const m = Math.min(count, n);
  if (m === 1) return [scale.domain[0]];
  return Array.from(
    { length: m },
    (_, index) => scale.domain[Math.round((index * (n - 1)) / (m - 1))]!,
  );
}

function position(scale: ResolvedScale, value: Tick): number {
  return scale.type === "band"
    ? scale.map(value as BandCategory)! + scale.bandwidth / 2
    : scale.map(value as number);
}

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
    for (const { index, p } of priority) {
      const metrics = context.measureText(texts[index]);
      const size = horizontal ? metrics.width : metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
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
    const label = texts[index];
    return (
      <Text
        key={index}
        pointerEvents="none"
        style={{
          left: horizontal ? p : baseline + outward * 10,
          top: horizontal ? baseline + outward * 10 : p,
          fill,
          font,
          opacity: alpha,
          textAlign: horizontal ? "center" : outward < 0 ? "right" : "left",
          textBaseline: horizontal ? outward > 0 ? "top" : "bottom" : "middle",
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
