---
id: guide-compose-layout
title: Compose and lay out scenes
summary: Arrange Canvas scenes with composition boundaries, declared-box layout, transforms, clips, and layers.
kind: guide
slug: compose-and-layout
order: 50
keywords: [layout, group, clip, layer, flex, grid]
---

# Compose and lay out scenes

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

```tsx docs:complete-snippet=layout-flex
import {
  Flex,
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
  const allocation = useLayoutBox();
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

The `style` received by `Tile` is its specified author value. The finite local
box calculated by the parent comes from `useLayoutBox()`. Parent placement uses
`left`/`top`; drawing-local geometry uses `x`/`y`. `width` and `height` describe
content boxes, padding is numeric, and `overflow: "clip"` clips both paint and
target geometry without creating scrolling.

### Forwarding a placed style

An `Absolute` child can forward its received `style` to a returned drawing
child with `{ ...style }`. CRC consumes the resolved `left` and `top` once for
that forwarding path. The rule is value-based: assigning the same resolved
`left` or `top` again still forwards parent placement, while a different value
becomes the returned child's local offset. A new style object that does not
spread the received style is independent local geometry, even when its numeric
offsets equal the parent's.

```tsx
function Card({ style }: { style: { left: number; top: number } }) {
  return (
    <Rectangle style={{ ...style, width: 120, height: 64, fill: "tomato" }} />
  );
}

function Badge(_props: { style: { left: number; top: number } }) {
  return (
    <Rectangle
      style={{ left: 30, top: 40, width: 24, height: 16, fill: "gold" }}
    />
  );
}

<Absolute>
  <Card style={{ left: 30, top: 40 }} />
  <Badge style={{ left: 30, top: 40 }} />
</Absolute>;
```

`Card` paints at `(30, 40)`. `Badge` has independent local geometry and paints
at `(60, 80)`. This rule concerns resolved placement values, not the identity
or mutability of the style object.

Layout parents inspect normalized direct-child style without invoking child
components. Measurement is pure and opt-in. See the [layout
contract](../../../design/layout-system-contract.md) for every supported Flex, Flow,
Grid, Overlay, and Absolute value.

Layout fields may be signals. During a mounted layout prepass, CRC attributes
such a read to the eventual receiving child rather than to the layout parent.
The receiver adopts that provisional dependency only after successful
evaluation. Standalone `measureElement()` resolves the same declared inputs
untracked and creates no persistent subscription. Plain layout values create no
provision or resolved-style copy.

## Group

`Group` composes Canvas transforms around any number of children:

```tsx docs:complete-snippet=layout-group
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
    <Text style={{ left: 20, top: 20 }}>Transformed together</Text>
  </Group>
);
```

`Group` is Canvas transformation, not layout. Its transform affects drawing,
clips, event geometry, and nested layers consistently. Canvas save/restore
isolates siblings.

## Clip

`Clip` applies one `Path2D` to all children. Nested clips intersect:

```tsx docs:complete-snippet=layout-clip
import { Clip, Image, createRegularPolygonPath } from "@crc/core";

const src = "/landscape.png";

const hexagon = createRegularPolygonPath({
  sides: 6,
  cx: 120,
  cy: 90,
  inradius: 70,
  cornerRadius: 6,
});

const clipped = (
  <Clip style={{ d: hexagon }}>
    <Image style={{ src, left: 40, top: 10, width: 160, height: 160 }} />
  </Clip>
);
```

The captured clip geometry applies to hit testing as well as paint. Creators
return fresh paths; call `useConst` when one path should have mount-lifetime
identity, or `useComputed` when a path is derived from reactive geometry. CRC
does not add a dedicated memo hook per shape.

## Layer

`Layer` owns a persistent offscreen CRC instance and accepts ordinary
multi-child content:

```tsx docs:complete-snippet=layout-layer
import { Layer, Rectangle, Text, type CRCNode } from "@crc/core";

function Chart(): CRCNode {
  return (
    <Rectangle
      style={{ left: 40, top: 60, width: 220, height: 80, fill: "navy" }}
    />
  );
}

const cached = (
  <Layer style={{ width: 300, height: 200 }}>
    <Rectangle style={{ width: 300, height: 200, fill: "#eef2ff" }} />
    <Chart />
    <Text style={{ left: 12, top: 12 }}>Cached offscreen content</Text>
  </Layer>
);
```

The layer uses a stable internal fragment root, shallow structural cache
comparison, and the root's physical density. Its targets participate in the
same global paint ledger, pointer/focus state, transforms, and clips as root
content. A logical focus change invalidates a retained layer containing the
affected target. Removing or disposing the layer recursively releases the
offscreen controller and owned resources. Browser `OffscreenCanvas` support is
required.

## External render layers

A component returned by `defineRenderLayer()` or `defineThreeLayer()` receives
a normal declared box and can be placed by Absolute, Overlay, Flow, Flex, or
Grid. It has no intrinsic measurement capability, so an auto-sized layout path
must give it a definite allocation instead of rendering external content to
discover a preferred size.

Outer `Group` transforms, `Clip`, layout overflow, `Layer`, alpha/compositing,
and filters apply to the complete external bitmap. Objects inside that bitmap
cannot interleave around an external Canvas sibling. Use two render layers when
Canvas content must appear between a back and front 3D pass. See [Use Three.js
inside CRC](#/learn/guides/three-js).

## Filters across layout and composition

All five layout primitives and `Group`, `Clip`, and `Layer` accept
`style.filter`. A filter on a layout primitive consumes that primitive's entire
laid-out subtree as one image; it does not independently filter each direct
child. Functions in one list run in declaration order, while nested filtered
primitives form separate boundaries and resolve from the inside out.

The receiving container's presentation happens outside its own local filter:

- a receiving `Group` filters its upright local subtree, then applies its scale,
  rotation, translation, and skew;
- a receiving `Clip` filters first and applies its own clip to the result;
- a descendant Group or Clip is already part of an ancestor's captured source,
  while an ancestor clip constrains the completed result;
- a filter on `Layer` consumes the combined cached Layer bitmap. Changing only
  that or an outer filter can reuse the Layer cache, while filters inside the
  Layer belong to its child CRC instance.
- a filter on an external render layer consumes the complete committed bitmap.
  Inner Three objects use Three materials and post-processing rather than CRC
  Canvas filter descriptors.

The full order is `local subtree paint -> receiving filter -> receiving clip ->
receiving transform -> ancestor clip/alpha/compositing -> parent target`.
Blurred and shadowed overflow is clipped by existing ancestor Clip and layout
`overflow: "clip"` boundaries. It does not enlarge declared boxes,
measurement, event paths, focus/navigation bounds, or cursor regions.

Filter captures are transient upright local surfaces rather than retained
Layers. A nonempty list requires browser `OffscreenCanvas` and native Canvas
filter support; `[]` stays on the direct path. See the [filter
lesson](../../../../packages/scenarios/src/learning/composition/filters.example.tsx)
and [drawing contract](../../../design/drawing-components-contract.md).

Executable lessons cover [Group](../../../../packages/scenarios/src/learning/composition/group.example.tsx),
[Clip](../../../../packages/scenarios/src/learning/composition/clip.example.tsx),
[Layer](../../../../packages/scenarios/src/learning/composition/layer.example.tsx),
[Filters](../../../../packages/scenarios/src/learning/composition/filters.example.tsx),
and every layout component. The deterministic
[`first-class-filters` laboratory](../../../../packages/scenarios/src/filter-lab.example.tsx)
is shared by the Studio and headless browser evidence.

See [responsive local styles](#/learn/guides/responsive-styles) for typed width
and height conditions, the placement/content distinction, and measurement limits.
