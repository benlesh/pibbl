# Layout, groups, clips, and layers

CRC composes immediate Canvas rendering with five declared-box layout
components and three non-layout containers. All accept recursive synchronous
children and preserve source paint order.

## Declared-box layout

- `Absolute` independently places definite direct children with `left` and
  `top`.
- `Overlay` shares one allocation and aligns each child.
- `Flow` performs CRC-native horizontal or vertical sequential placement and
  optional wrapping.
- `Flex` implements the documented Flexbox subset.
- `Grid` uses explicit tracks and explicit one-based item placement; there is
  no auto placement.

<!-- docs:complete-snippet:start layout-flex -->

```tsx
import {
  Flex,
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
  const allocation = crcLayoutBox();
  return (
    <Rectangle
      style={{
        width: allocation.width,
        height: allocation.height,
        fill: color,
      }}
    />
  );
}

const row = (
  <Flex style={{ width: 520, height: 180, gap: 16, alignItems: "center" }}>
    <Tile
      key="left"
      color="#1f4bd8"
      style={{ width: 140, height: 100, flexGrow: 1, minWidth: 80 }}
    />
    <Tile
      key="right"
      color="#ff6b57"
      style={{ width: 180, height: 140, flexGrow: 2, minWidth: 80 }}
    />
  </Flex>
);
```

<!-- docs:complete-snippet:end -->

The `style` received by `Tile` is its specified author value. The finite local
box calculated by the parent comes from `crcLayoutBox()`. Parent placement uses
`left`/`top`; drawing-local geometry uses `x`/`y`. `width` and `height` describe
content boxes, padding is numeric, and `overflow: "clip"` clips both paint and
target geometry without creating scrolling.

Layout parents inspect normalized direct-child style without invoking child
components. Measurement is pure and opt-in. See the [layout
contract](../design/layout-system-contract.md) for every supported Flex, Flow,
Grid, Overlay, and Absolute value.

## Group

`Group` composes Canvas transforms around any number of children:

<!-- docs:complete-snippet:start layout-group -->

```tsx
import { Group, Rectangle, Text } from "@crc/core";

const transformed = (
  <Group
    style={{
      translateX: 80,
      translateY: 40,
      scaleX: 1.25,
      scaleY: 1.25,
      rotationDegrees: -8,
      rotationOrigin: [100, 50],
    }}
  >
    <Rectangle style={{ width: 200, height: 100, fill: "tomato" }} />
    <Text style={{ x: 20, y: 20 }}>Transformed together</Text>
  </Group>
);
```

<!-- docs:complete-snippet:end -->

`Group` is Canvas transformation, not layout. Its transform affects drawing,
clips, event geometry, and nested layers consistently. Canvas save/restore
isolates siblings.

## Clip

`Clip` applies one `Path2D` to all children. Nested clips intersect:

<!-- docs:complete-snippet:start layout-clip -->

```tsx
import { Clip, Rectangle, Text } from "@crc/core";

const windowPath = new Path2D();
windowPath.arc(100, 100, 80, 0, Math.PI * 2);

const clipped = (
  <Clip style={{ d: windowPath, fillRule: "evenodd" }}>
    <Rectangle style={{ width: 200, height: 200, fill: "#1f4bd8" }} />
    <Text style={{ x: 45, y: 90, fill: "white" }}>One clip</Text>
  </Clip>
);
```

<!-- docs:complete-snippet:end -->

The captured clip geometry applies to hit testing as well as paint.

## Layer

`Layer` owns a persistent offscreen CRC instance and accepts ordinary
multi-child content:

<!-- docs:complete-snippet:start layout-layer -->

```tsx
import { Layer, Rectangle, Text, type CRCNode } from "@crc/core";

function Chart(): CRCNode {
  return (
    <Rectangle style={{ x: 40, y: 60, width: 220, height: 80, fill: "navy" }} />
  );
}

const cached = (
  <Layer style={{ width: 300, height: 200 }}>
    <Rectangle style={{ width: 300, height: 200, fill: "#eef2ff" }} />
    <Chart />
    <Text style={{ x: 12, y: 12 }}>Cached offscreen content</Text>
  </Layer>
);
```

<!-- docs:complete-snippet:end -->

The layer uses a stable internal fragment root, shallow structural cache
comparison, and the root's physical density. Its targets participate in the
same global paint ledger, pointer/focus state, transforms, and clips as root
content. A logical focus change invalidates a retained layer containing the
affected target. Removing or disposing the layer recursively releases the
offscreen controller and owned resources. Browser `OffscreenCanvas` support is
required.

Executable lessons cover [Group](../../packages/scenarios/src/learning/composition/group.example.tsx),
[Clip](../../packages/scenarios/src/learning/composition/clip.example.tsx),
[Layer](../../packages/scenarios/src/learning/composition/layer.example.tsx),
and every layout component.
