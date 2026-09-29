---
id: guide-style-draw
title: Style and draw
summary: Use CRC's closed local style language for drawing, filters, shapes, and declared geometry.
kind: guide
slug: style-and-draw
order: 40
keywords: [style, drawing, filters, shapes, geometry]
---

# Style and draw

CRC drawing components accept explicit, local `style` objects. The style
language is closed: it does not cascade, inherit, use class names, selectors,
or computed DOM values. This guide preserves the style, filter, shape, and
allocation material from the earlier components guide; use
[components, props, and children](#/learn/guides/components-props-and-children)
for authoring structure.

CRC components are ordinary synchronous TypeScript or JavaScript functions.
The function itself is runtime identity. No wrapper, registration call, class,
or JSX-specific component base is required.

```tsx
import {
  Group,
  Rectangle,
  Text,
  type BoxStyle,
  type CRCNode,
  type LayoutItemStyle,
} from "@crc/core";

interface CardProps {
  title: string;
  selected: boolean;
  onSelect: () => void;
  style?: BoxStyle & LayoutItemStyle;
}

function Card({ title, selected, onSelect }: CardProps): CRCNode {
  return (
    <Group>
      <Rectangle
        style={{
          width: 180,
          height: 96,
          fill: selected ? "#f7c948" : "#1f4bd8",
          cursor: "pointer",
        }}
        onClick={onSelect}
      />
      <Text pointerEvents="none" style={{ x: 16, y: 20, fill: "white" }}>
        {title}
      </Text>
    </Group>
  );
}
```

`title`, `selected`, and `onSelect` are behavioral or application props.
Geometry, paint, image source, transforms, clipping, cursor, and layout
participation belong under `style`. `children` is declared only by components
that accept it. `key` is construction metadata: CRC normalizes strings and
numbers to a string and never delivers it in props.

## Local, closed style

Each built-in supports a closed style schema. Unsupported properties are type
errors. Styles do not cascade or inherit, and there are no class names,
selectors, specificity, or computed DOM styles. Reuse styles with ordinary
objects:

```tsx
const cardPaint = {
  fill: "#17324d",
  stroke: "#8dd8ff",
  strokeWidth: 2,
} as const;

const card = (
  <Rectangle
    style={{ ...cardPaint, x: 16, y: 16, width: 180, height: 80 }}
    onClick={() => console.log("selected")}
  />
);
```

Required style members make the `style` prop required. For example,
`Rectangle` requires `width` and `height`, `Path` requires `d`, and `Image`
requires `src`. Components whose complete style schema has defaults may omit
`style`.

`style.custom` is available for application-owned metadata and is not read or
inherited by CRC. Arbitrary top-level style keys are not accepted.

## Signal-valued style

Every declared style field accepts a compatible signal, and the whole style
object may itself be a signal:

```tsx
const x = useSignal(10);
const fill = useSignal("red");
const style = useComputed(() => ({
  x: x.get(),
  width: 80,
  height: 48,
  fill: fill.get(),
}));

<Rectangle style={{ x, width: 80, height: 48, fill }} />;
<Rectangle style={style} />;
```

CRC first resolves a whole-style signal once, then shallowly resolves the
fields declared by that primitive. It allocates a resolved copy only when a
signal field is actually present; all-plain styles keep the direct path. It
does not inspect `style.custom` or other arbitrary application objects for
nested signals.

## Choose pointer participation

Drawing primitives contribute their declared interaction geometry by default,
even without a handler or cursor. A front label, highlight, or transparent
fill can therefore become the logical target instead of content painted behind
it. Set the drawing prop `pointerEvents="none"` when decorative paint should
pass coordinate input through, as the card label above does. Structural
containers with handlers add propagation listeners but no rectangular target.

Opacity and filters affect pixels, not interaction geometry. See the [default
pointer-participation migration](../../../migrations/default-pointer-participation.md)
for an upgrade audit.

## Filters are typed local style

Every primitive, including composition and layout primitives, accepts one
filter descriptor or a readonly ordered list:

```tsx
import { Group, Rectangle, type CRCFilter } from "@crc/core";

const effects = [
  { type: "grayscale", amount: 1 },
  {
    type: "dropShadow",
    offsetX: 8,
    offsetY: 6,
    blurRadius: 4,
    color: "rgb(0 0 0 / 45%)",
  },
] satisfies readonly CRCFilter[];

const filteredCard = (
  <Group style={{ filter: effects }}>
    <Rectangle style={{ width: 180, height: 96, fill: "tomato" }} />
    <Rectangle style={{ x: 24, y: 24, width: 48, height: 48, fill: "gold" }} />
  </Group>
);
```

The list runs in declaration order over one combined image of the receiving
primitive and everything it returns. Put the filter on a `Group` when several
siblings should form one silhouette. Nested filtered primitives resolve inside
out. A single descriptor means a one-item list; `[]` means no filter and stays
on the direct rendering path.

Filters affect pixels only. They do not enlarge layout or measurement, and
blurred or shadow-only pixels outside original geometry are not clickable or
focusable. Nonempty filters require browser `OffscreenCanvas` and native Canvas
filter support. CRC accepts the ten typed descriptors documented in the [style
contract](../../../design/style-system-contract.md), not raw CSS strings, `url()`,
`backdrop-filter`, or `boxShadow`.

## Rounded and generated shapes

Rounded corners remain local drawing geometry. `cornerRadius` supplies a
default and `cornerRadii` selectively overrides corners in traversal order;
`0` is a useful explicit sharp override. A percentage radius uses the smaller
current width/height basis, while `"auto"`, negative values, non-finite values,
and arrays longer than the shape's corner count reject.

```tsx
import { Polygon, Rectangle, RegularPolygon, Star } from "@crc/core";

const shapes = (
  <>
    <Rectangle
      style={{ width: 180, height: 96, cornerRadii: [20, 0, 20, 0] }}
    />
    <Polygon
      style={{
        coords: [
          [240, 20],
          [320, 90],
          [270, 170],
        ],
        cornerRadius: 12,
      }}
    />
    <RegularPolygon
      style={{ sides: 6, cx: 430, cy: 90, inradius: 56, rotation: Math.PI / 6 }}
    />
    <Star
      style={{ points: 5, cx: 580, cy: 90, outerRadius: 64, innerRadius: 28 }}
    />
  </>
);
```

RegularPolygon takes exactly one of `circumradius`, `inradius`, or
`sideLength`; Star `points` counts outer tips and must be an integer of at
least three. Both are drawing leaves: their shape dimensions do not provide
intrinsic layout measurement, so layouts needing a size still receive a
declared box. `keyboardNavigationBounds` overrides the default generated
vertex bounds when an application needs a different focus region.

## Specified style and allocation

A layout parent reads a direct child's specified `style` to calculate its
allocation. A plain component still receives the exact author-supplied style;
the parent does not replace it with resolved numbers. Read the finite local
allocation through `useLayoutBox()`:

```tsx
import {
  Rectangle,
  useLayoutBox,
  type BoxStyle,
  type FlexItemStyle,
} from "@crc/core";

interface TileProps {
  color: string;
  style: BoxStyle & FlexItemStyle;
}

function Tile({ color, style: _specifiedStyle }: TileProps) {
  const box = useLayoutBox();
  return (
    <Rectangle style={{ width: box.width, height: box.height, fill: color }} />
  );
}
```

Do not blindly forward a composite's layout-participation style to its inner
drawing component; that can apply placement twice. Use the local allocation
for inner geometry and forward only visual fields the composite deliberately
owns.

Built-in drawing and layout components use the specified → normalized →
resolved pipeline. Allocation syntax such as percentages must resolve to finite
Canvas geometry before painting. [The style contract](../../../design/style-system-contract.md)
defines the accepted language, while [custom components and
primitives](#/learn/guides/custom-components-and-primitives) explains advanced extension.

See [responsive local styles](#/learn/guides/responsive-styles) for typed width
and height conditions, the placement/content distinction, and measurement limits.
