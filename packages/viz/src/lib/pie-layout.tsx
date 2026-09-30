import {
  Group,
  Absolute,
  Path,
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
  PieLayoutSlice,
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
  const innerRadius = finite(
    resolveSignalValue(style.innerRadius) ?? 0,
    "innerRadius",
    true,
  );
  if (radius === 0 ? innerRadius !== 0 : innerRadius >= radius)
    throw new RangeError(
      "PieLayout: innerRadius must be zero when radius is zero, or less than radius.",
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
  if (props.label !== undefined && props.labelBox !== undefined)
    throw new TypeError(
      "PieLayout: label and labelBox are mutually exclusive.",
    );
  const revision =
    props.revision === undefined
      ? undefined
      : resolveSignalValue(props.revision);
  if (
    revision !== undefined &&
    (!Number.isSafeInteger(revision) || revision < 0)
  )
    throw new RangeError(
      "PieLayout: revision must be a finite nonnegative safe integer.",
    );
  // An omitted revision deliberately replaces this token on every evaluation.
  // Stable callback identities alone are not evidence of stable results.
  const cacheKey = revision === undefined ? {} : revision;
  const slices = useComputed(
    () =>
      pieSlices(resolveSignalValue(props.data), {
        value: props.value,
        keyBy: props.keyBy,
      }),
    [cacheKey, props.data, props.value, props.keyBy],
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
        throw new TypeError(
          "PieLayout: labelFont must be a valid Canvas font.",
        );
      context.textAlign = "left";
      context.textBaseline = "alphabetic";
      return layoutPie(
        slices.get(),
        cx,
        cy,
        radius,
        innerRadius,
        { x: bx, y: by, width: bw, height: bh },
        context.font,
        gap,
        placement,
        props.label,
        props.labelBox,
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
    innerRadius,
    bx,
    by,
    bw,
    bh,
    font,
    gap,
    placement,
    props.label,
    props.labelBox,
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
  if (slice.innerRadius === 0) {
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
  const sweep = resolveClockwiseSweep(slice.startAngle, slice.endAngle);
  const path = new Path2D();
  path.arc(slice.cx, slice.cy, slice.radius, sweep.startAngle, sweep.endAngle);
  if (slice.innerRadius > 0)
    path.arc(
      slice.cx,
      slice.cy,
      slice.innerRadius,
      sweep.endAngle,
      sweep.startAngle,
      true,
    );
  else path.lineTo(slice.cx, slice.cy);
  path.closePath();
  return (
    <Group>
      <Path
        {...events}
        keyboardNavigationBounds={
          events.keyboardNavigationBounds ?? annularSliceBounds(slice, sweep)
        }
        style={{
          ...style,
          d: path,
        }}
      />
      {children}
    </Group>
  );
}

/** The outer and inner arcs both contribute to an annular path's focus box. */
function annularSliceBounds(
  slice: PieLayoutSlice<unknown>,
  sweep: Readonly<ClockwiseSweep>,
) {
  if (sweep.sweep === 0) return undefined;
  if (sweep.fullCircle)
    return {
      x: slice.cx - slice.radius,
      y: slice.cy - slice.radius,
      width: slice.radius * 2,
      height: slice.radius * 2,
    };
  const angles = [sweep.startAngle, sweep.endAngle];
  for (const cardinal of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const angle = cardinal < sweep.startAngle ? cardinal + fullTurn : cardinal;
    if (angle <= sweep.endAngle) angles.push(angle);
  }
  const xs: number[] = [];
  const ys: number[] = [];
  for (const angle of angles) {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    xs.push(
      slice.cx + slice.radius * cosine,
      slice.cx + slice.innerRadius * cosine,
    );
    ys.push(
      slice.cy + slice.radius * sine,
      slice.cy + slice.innerRadius * sine,
    );
  }
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

const fullTurn = Math.PI * 2;

interface ClockwiseSweep {
  readonly startAngle: number;
  readonly endAngle: number;
  readonly sweep: number;
  readonly fullCircle: boolean;
}

/** Matches Canvas's bounded clockwise arc rule without retaining unbounded turns. */
function resolveClockwiseSweep(
  startAngle: number,
  endAngle: number,
): ClockwiseSweep {
  if (!Number.isFinite(startAngle) || !Number.isFinite(endAngle))
    throw new RangeError("PieSlice: slice angles must be finite.");
  const start = positiveModulo(startAngle, fullTurn);
  if (endAngle - startAngle >= fullTurn)
    return {
      startAngle: start,
      endAngle: start + fullTurn,
      sweep: fullTurn,
      fullCircle: true,
    };
  const sweep = positiveModulo(
    positiveModulo(endAngle, fullTurn) - start,
    fullTurn,
  );
  return {
    startAngle: start,
    endAngle: start + sweep,
    sweep,
    fullCircle: false,
  };
}

function positiveModulo(value: number, divisor: number) {
  const result = value % divisor;
  if (result === 0) return 0;
  return result < 0 ? result + divisor : result;
}

const LabelText = definePrimitive<
  { label: Extract<PieLabelLayout, { kind: "text"; status: "placed" }> },
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
  children,
  ...events
}: PieLabelProps<D>) {
  const style = resolveSignalValue(input) ?? {};
  const label = slice.label;
  if (label?.kind === "text" && children != null && children !== false)
    throw new TypeError(
      "PieLabel: children require PieLayout labelBox; string label layouts cannot size custom content.",
    );
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
      {label.kind === "text" ? (
        <LabelText
          label={label}
          style={{ fill: resolveSignalValue(style.fill) ?? "#182c42" }}
        />
      ) : (
        <Group style={{ translateX: label.x, translateY: label.y }}>
          <Absolute style={{ width: label.width, height: label.height }}>
            <Group style={{ width: label.width, height: label.height }}>
              {children}
            </Group>
          </Absolute>
        </Group>
      )}
    </Group>
  );
}
