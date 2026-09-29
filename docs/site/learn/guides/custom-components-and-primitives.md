---
id: guide-custom-components-primitives
title: Create custom components and primitives
summary: Choose ordinary composites, direct Canvas painting, definePrimitive, or an external renderer layer.
kind: guide
slug: custom-components-and-primitives
order: 80
keywords: [components, primitives, definePrimitive, canvas, measurement]
---

# Create custom components and primitives

Choose the smallest extension mechanism that fits the job:

1. an ordinary function for composition;
2. `useCanvasContext()` for a simple custom painter;
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

To let the receiving custom component own a reactive input, declare
`SignalValue<T>` and resolve it at that boundary:

```tsx
import { resolveSignalValue, type SignalValue } from "@crc/core";

interface SparklineDataProps {
  data: SignalValue<readonly number[]>;
}

function SparklineData({ data }: SparklineDataProps): CRCNode {
  const values = resolveSignalValue(data);
  return <Sparkline points={values} />;
}
```

Resolve only fields your API declares as signal-valued. Do not recursively walk
datasets, arbitrary descriptors, callbacks, or metadata looking for signals.
Callbacks are values and are never invoked by resolution. If the API requires a
signal object for later imperative use, type that prop as `Signal<T>` or
`WritableSignal<T>` rather than `SignalValue<T>`.

## Direct Canvas painting

`useCanvasContext()` returns the current isolated Canvas 2D context during a
live render. It does not allocate a hook slot and does not schedule work. It is
unavailable outside rendering and during pure measurement.

```tsx
import {
  useCanvasContext,
  useLayoutBox,
  type BoxStyle,
  type StrokeStyle,
} from "@crc/core";

interface SparklineProps {
  points: readonly number[];
  style: BoxStyle & { stroke: StrokeStyle; strokeWidth?: number };
}

function Sparkline({ points, style }: SparklineProps): void {
  const context = useCanvasContext();
  const box = useLayoutBox();
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

An ordinary component does not receive framework style automatically. To
filter one painter, return its paint from a primitive carrying `style.filter`;
to filter several painters or built-ins as one silhouette, put them beneath a
filtered `Group`.

## A complete platform primitive

`definePrimitive` separates program props from specified style, installs
private capabilities on the returned component value, resolves style before
render, and permits pure measurement without invoking the renderer.

```tsx docs:complete-snippet=custom-primitive
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
The public primitive input type maps declared program and style leaves to
signal-valued inputs. Render, normalization, and measurement callbacks receive
resolved values, not signal wrappers. Pure standalone measurement resolves
untracked and never creates a persistent graph consumer.
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

Because each declared style extends `SystemStyle`, `Gauge` also accepts one
`CRCFilter` or a readonly filter list. The filter is owned by render dispatch:
CRC removes it before calling custom `normalizeStyle` and `resolveStyle`, then
attaches its validated canonical readonly list to the final resolved style seen
by the render callback. Custom capabilities cannot discard or reinterpret the
filter. Pure `measure` ignores it and never checks browser filter support or
allocates a surface.

With a nonempty filter, the render callback executes once against the real
upright local `OffscreenCanvasRenderingContext2D`. The callback's
`context.canvas` and `context.getTransform()` describe that local target; CRC
applies parent placement or a receiving Group transform exactly once when the
completed filtered result is composited. Imperative transforms, clips, alpha,
or native Canvas filter/shadow calls made by the callback remain paint inside
the custom primitive's captured source. CRC does not reinterpret them as
declarative presentation metadata.

The mutable Canvas current path cannot be copied between contexts. Do not rely
on beginning an implicit path outside a filter/Layer boundary and continuing it
inside, or the reverse. Keep custom draw operations self-contained with
`beginPath()` or use `Path2D`. The built-ins and examples follow this boundary.
Nonempty filters require browser `OffscreenCanvas` plus native Canvas `filter`;
`[]` is a no-op and has no offscreen requirement.

Ordinary application components should rarely need `definePrimitive`. The
executable contract is
[`define-primitive.test.tsx`](../../../../packages/core/src/lib/define-primitive.test.tsx).

## Custom 3D shapes

Use ordinary Three geometry, materials, meshes, shaders, loaders, and addons
inside a component returned by `defineThreeLayer()`. CRC deliberately does not
wrap those APIs in a second primitive vocabulary. The application owns and
disposes its Three resources; CRC owns the surrounding render-layer lifecycle,
composition, event arbitration, and focus.

See [Use Three.js inside CRC](#/learn/guides/three-js).
