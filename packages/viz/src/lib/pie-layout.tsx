import {
  Group,
  Wedge,
  definePrimitive,
  Line,
  Rectangle,
  resolveSignalValue,
  useComputed,
  useCanvasContext,
  useLayoutBox,
} from "@crc/core";
import { withHooksForbidden } from "@crc/core/internal";
import type {
  PieLayoutProps,
  PieSliceProps,
  PieLabelProps,
  PieLabelLayout,
} from "./pie-types.js";
import { pieSlices } from "./pie-slices.js";
import { layoutPie } from "./layout-pie.js";
function finite(value: number, name: string, nonnegative = false) {
  if (!Number.isFinite(value) || (nonnegative && value < 0))
    throw new RangeError(
      `PieLayout: ${name} must be finite${nonnegative ? " and nonnegative" : ""}.`,
    );
  return value;
}
export function PieLayout<D>(props: PieLayoutProps<D>) {
  const allocation = useLayoutBox();
  const context = useCanvasContext();
  const style = resolveSignalValue(props.style) ?? {};
  const bounds = resolveSignalValue(props.bounds) ?? {
    x: 0,
    y: 0,
    width: allocation.width,
    height: allocation.height,
  };
  const bx = finite(bounds.x, "bounds.x"),
    by = finite(bounds.y, "bounds.y");
  const bw = finite(bounds.width, "bounds.width", true),
    bh = finite(bounds.height, "bounds.height", true);
  finite(bx + bw, "bounds right");
  finite(by + bh, "bounds bottom");
  const cx = finite(resolveSignalValue(style.cx) ?? bx + bw / 2, "cx");
  const cy = finite(resolveSignalValue(style.cy) ?? by + bh / 2, "cy");
  const radius = finite(
    resolveSignalValue(style.radius) ?? Math.min(bw * 0.28, bh * 0.4),
    "radius",
    true,
  );
  const gap = finite(resolveSignalValue(style.labelGap) ?? 8, "labelGap", true);
  finite(cx + radius + gap, "right label edge");
  finite(cx - radius - gap, "left label edge");
  finite(cy + radius, "bottom");
  finite(cy - radius, "top");
  const font = resolveSignalValue(style.labelFont) ?? "14px sans-serif";
  if (typeof font !== "string" || !font.trim())
    throw new TypeError("PieLayout: labelFont must be a Canvas font string.");
  const placement = resolveSignalValue(props.placement) ?? "outside";
  if (!["inside", "outside", "auto"].includes(placement))
    throw new TypeError(
      "PieLayout: placement must be inside, outside, or auto.",
    );
  if (typeof props.children !== "function")
    throw new TypeError(
      "PieLayout: children must be a function returning CRC elements.",
    );
  const slices = useComputed(
    () =>
      pieSlices(resolveSignalValue(props.data), {
        value: props.value,
        keyBy: props.keyBy,
      }),
    [props.data, props.value, props.keyBy],
  );
  const layout = useComputed(() => {
    context.save();
    try {
      // Canvas silently ignores malformed fonts. Two distinct sentinels detect
      // that without depending on the caller's inherited font or CSS spelling.
      context.font = "10px serif";
      context.font = font;
      const normalized = context.font;
      context.font = "11px monospace";
      context.font = font;
      if (context.font !== normalized)
        throw new TypeError("PieLayout: labelFont must be a valid Canvas font.");
      context.textAlign = "left";
      context.textBaseline = "alphabetic";
      return layoutPie(
        slices.get(),
        cx,
        cy,
        radius,
        { x: bx, y: by, width: bw, height: bh },
        context.font,
        gap,
        placement,
        props.label,
        (text) => {
          const m = context.measureText(text);
          const width = Math.max(
            m.width,
            m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
          );
          const ascent = Math.max(0, m.actualBoundingBoxAscent),
            descent = Math.max(0, m.actualBoundingBoxDescent);
          return {
            width: finite(width, "label width", true),
            height: finite(Math.max(1, ascent + descent), "label height", true),
            left: Math.max(0, m.actualBoundingBoxLeft),
            ascent,
          };
        },
      );
    } finally {
      context.restore();
    }
  }, [
    slices,
    cx,
    cy,
    radius,
    bx,
    by,
    bw,
    bh,
    font,
    gap,
    placement,
    props.label,
    context,
  ]);
  return layout
    .get()
    .map((slice) => (
      <Group key={slice.key}>
        {withHooksForbidden(
          "PieLayout children cannot call hooks; return a component instead.",
          () => props.children(slice),
        )}
      </Group>
    ));
}
export function PieSlice<D>({
  slice,
  style: input,
  children,
  ...events
}: PieSliceProps<D>) {
  const style = resolveSignalValue(input) ?? {};
  return (
    <Group>
      <Wedge
        {...events}
        style={{
          ...style,
          cx: slice.cx,
          cy: slice.cy,
          radius: slice.radius,
          startAngle: slice.startAngle,
          endAngle: slice.endAngle,
        }}
      />
      {children}
    </Group>
  );
}

const LabelText = definePrimitive<
  { label: Extract<PieLabelLayout, { status: "placed" }> },
  { readonly custom?: never; fill: import("@crc/core").FillStyle }
>(({ label }, style, context) => {
  context.font = label.font;
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillStyle = style.fill;
  context.fillText(label.text, label.textX, label.textY);
});

export function PieLabel<D>({
  slice,
  style: input,
  pointerEvents = "none",
  ...events
}: PieLabelProps<D>) {
  const style = resolveSignalValue(input) ?? {};
  const label = slice.label;
  if (!label || label.status !== "placed") return null;
  return (
    <Group {...events}>
      {label.leader && (
        <Line
          pointerEvents="none"
          style={{
            coords: label.leader.map((p) => [p[0], p[1]]),
            stroke: resolveSignalValue(style.leaderStroke) ?? "#94a3b8",
            strokeWidth: resolveSignalValue(style.leaderWidth) ?? 1,
          }}
        />
      )}
      <Rectangle
        pointerEvents={pointerEvents}
        style={{
          left: label.x,
          top: label.y,
          width: label.width,
          height: label.height,
          fill: "transparent",
        }}
      />
      <LabelText
        label={label}
        style={{ fill: resolveSignalValue(style.fill) ?? "#182c42" }}
      />
    </Group>
  );
}
