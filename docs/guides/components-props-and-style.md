# Components, props, and style

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
      <Text style={{ x: 16, y: 20, fill: "white" }}>{title}</Text>
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

## Specified style and allocation

A layout parent reads a direct child's specified `style` to calculate its
allocation. A plain component still receives the exact author-supplied style;
the parent does not replace it with resolved numbers. Read the finite local
allocation through `crcLayoutBox()`:

```tsx
import {
  Rectangle,
  crcLayoutBox,
  type BoxStyle,
  type FlexItemStyle,
} from "@crc/core";

interface TileProps {
  color: string;
  style: BoxStyle & FlexItemStyle;
}

function Tile({ color, style: _specifiedStyle }: TileProps) {
  const box = crcLayoutBox();
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
Canvas geometry before painting. [The style contract](../design/style-system-contract.md)
defines the accepted language, while [custom components and
primitives](./custom-components-and-primitives.md) explains advanced extension.
