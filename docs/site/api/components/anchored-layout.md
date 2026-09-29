---
id: api-component-anchored-layout
title: AnchoredLayout
summary: Arranges keyed boxes without covering one another or their anchors.
kind: api
slug: anchored-layout
apiCategory: component
symbols: [AnchoredLayout, AnchoredItem, AnchoredPlacement, AnchoredLayoutProps]
---

# AnchoredLayout

Import from `@crc/viz`. Supply `items` with unique string/number `key`, local
`anchor`, optional `anchorRadius` (default 0), and numeric outer `width`/`height`.
Additional item fields are preserved and inferred by the children callback.

`direction` defaults to `vertical`: boxes form a column to the right of all
protected anchors, or to their left if that fits. `horizontal` forms a row below
all anchors, or above if that fits. Boxes pack near their anchor coordinates,
with `gap` (default 8) separating boxes and protecting anchors. Bounds default to
the incoming allocation. Items, gap, and explicit bounds can be signals.

`children(item, placement)` renders at the placed box's local origin. Placement
is in the parent's local frame, so connectors can subtract placement.x/y from
the original anchor. The callback cannot call hooks; return a component for hooks.
Stable keys preserve child state. Input order remains paint order, even when
geometric ordering changes. Each child receives its declared box as allocation
and percentage basis. Backgrounds, padding, and pointer behavior are user-owned.

If neither side or the complete stack fits, boxes overflow rather than overlap.
Ancestor clipping still applies. Include borders in declared outer dimensions;
arbitrary overflowing child paint is outside the guarantee. This layout requires
no scales, hover state, or DOM elements.

```tsx
import { Group, Rectangle, Text } from "@crc/core";
import { AnchoredLayout } from "@crc/viz";

export function Annotations() {
  const items = [
    {
      key: "a",
      anchor: { x: 100, y: 100 },
      width: 140,
      height: 40,
      label: "First",
    },
    {
      key: "b",
      anchor: { x: 100, y: 108 },
      width: 140,
      height: 40,
      label: "Second",
    },
  ];
  return (
    <AnchoredLayout items={items} gap={8}>
      {(item) => (
        <>
          <Rectangle
            pointerEvents="none"
            style={{
              width: "100%",
              height: "100%",
              fill: "white",
              cornerRadius: 6,
            }}
          />
          <Group style={{ translateX: 10, translateY: 10 }}>
            <Text pointerEvents="none" style={{ fill: "black" }}>
              {item.label}
            </Text>
          </Group>
        </>
      )}
    </AnchoredLayout>
  );
}
```

Keys use core's `String(key)` normalization; numeric `1` and string `"1"` conflict.
Along the packing axis, items sort by anchor coordinate, with normalized key as
the deterministic tie-breaker. Source order still controls painting. Width,
height, radius, gap, and bounds dimensions must be finite and nonnegative; anchor
and bounds coordinates must be finite. Unrepresentable placement arithmetic
throws before child rendering. Zero-sized boxes are permitted.

Changing a callback or item object preserves a returned component's state when
its key, component type, and tree position stay the same. Signal reads made inside
the callback belong to that item; removing it releases those subscriptions.
