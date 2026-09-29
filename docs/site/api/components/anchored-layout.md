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
