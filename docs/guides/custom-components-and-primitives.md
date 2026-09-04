# Custom components and primitives

Choose the smallest extension mechanism that fits the job:

1. an ordinary function for composition;
2. `crcCanvasContext()` for a simple custom painter;
3. `definePrimitive()` only for a platform component that needs style
   normalization, allocation-aware resolution, pure measurement, or custom
   layout capabilities.

## Ordinary composites

```tsx
import { Group, Rectangle, Text, type CRCNode } from "@crc/core";

interface BadgeProps {
  label: string;
  active: boolean;
}

function Badge({ label, active }: BadgeProps): CRCNode {
  return (
    <Group>
      <Rectangle
        style={{ width: 180, height: 64, fill: active ? "gold" : "navy" }}
      />
      <Text style={{ x: 16, y: 18, fill: active ? "black" : "white" }}>
        {label}
      </Text>
    </Group>
  );
}
```

The function is the component identity. Call it through JSX or
`createElement`; a direct JavaScript call does not create a CRC element or
establish render context.

## Direct Canvas painting

`crcCanvasContext()` returns the current isolated Canvas 2D context during a
live render. It does not allocate a hook slot and does not schedule work. It is
unavailable outside rendering and during pure measurement.

```tsx
import {
  crcCanvasContext,
  crcLayoutBox,
  type BoxStyle,
  type StrokeStyle,
} from "@crc/core";

interface SparklineProps {
  points: readonly number[];
  style: BoxStyle & { stroke: StrokeStyle; strokeWidth?: number };
}

function Sparkline({ points, style }: SparklineProps): void {
  const context = crcCanvasContext();
  const box = crcLayoutBox();
  if (points.length === 0) return;

  context.beginPath();
  points.forEach((point, index) => {
    const x =
      points.length === 1 ? 0 : (index / (points.length - 1)) * box.width;
    const y = box.height - point * box.height;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.strokeStyle = style.stroke;
  context.lineWidth = style.strokeWidth ?? 1;
  context.stroke();
}
```

Canvas save/restore, source order, clipping, layout placement, failure cleanup,
and parent transforms apply as they do for built-ins. A plain painter has no
pure intrinsic measurement capability.

## A complete platform primitive

`definePrimitive` separates program props from specified style, installs
private capabilities on the returned component value, resolves style before
render, and permits pure measurement without invoking the renderer.

```tsx
import {
  definePrimitive,
  type FillStyle,
  type Percentage,
  type SystemStyle,
} from "@crc/core";

interface GaugeProps {
  value: number;
}

interface GaugeStyle extends SystemStyle {
  width: number | Percentage;
  height?: number;
  fill?: FillStyle;
}

interface NormalizedGaugeStyle extends SystemStyle {
  width: number | Percentage;
  height: number;
  fill: FillStyle;
}

interface ResolvedGaugeStyle extends SystemStyle {
  width: number;
  height: number;
  fill: FillStyle;
}

export const Gauge = definePrimitive<
  GaugeProps,
  GaugeStyle,
  NormalizedGaugeStyle,
  ResolvedGaugeStyle
>(
  function renderGauge({ value }, style, context) {
    const progress = Math.max(0, Math.min(1, value));
    context.fillStyle = style.fill;
    context.fillRect(0, 0, style.width * progress, style.height);
  },
  {
    normalizeStyle: (style) => ({
      ...style,
      height: style.height ?? 12,
      fill: style.fill ?? "#2563eb",
    }),
    resolveStyle: (style, resolution) => ({
      ...style,
      width:
        typeof style.width === "number"
          ? style.width
          : (Number.parseFloat(style.width) / 100) *
            resolution.percentageBasis.width,
    }),
    measure: ({ style, constraints }) => {
      if (
        typeof style.width !== "number" &&
        !Number.isFinite(constraints.maxWidth)
      ) {
        return {
          status: "unsupported",
          reason: "percentage width needs a finite maximum width",
        };
      }
      const percentageBasis = Number.isFinite(constraints.maxWidth)
        ? constraints.maxWidth
        : 0;
      const width =
        typeof style.width === "number"
          ? style.width
          : (Number.parseFloat(style.width) / 100) * percentageBasis;
      return { status: "measured", size: { width, height: style.height } };
    },
  },
);
```

The four generic stages are program props, specified style, normalized style,
and resolved style. Program props cannot declare reserved `key` or `style`.
When a specified style admits percentages or `auto`, a resolver is required,
and the resolved type cannot retain allocation syntax. The render callback
receives only program props, the finite resolved style, and the isolated Canvas
context.

`normalizeStyle` must be pure and allocation-independent. `resolveStyle`
receives the current allocation, percentage basis, constraints, component
name, and render algorithm. `measure` receives program props, normalized style,
constraints, a Canvas text-measurement service, and a recursive
`measureElement` function. It must not paint, invoke hooks, load images, register
events, or acquire resources. Return `{ status: "unsupported", reason }` when
intrinsic sizing cannot be answered safely.

Ordinary application components should rarely need `definePrimitive`. The
executable contract is
[`define-primitive.test.tsx`](../../packages/core/src/lib/define-primitive.test.tsx).
