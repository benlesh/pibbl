---
id: api-component-hover-card
title: HoverCard
summary: Places a readable card without covering its protected anchor.
kind: api
slug: hover-card
apiCategory: component
symbols:
  [HoverCard, HoverCardProps, HoverCardStyle, HoverBounds, HoverPlacement]
---

# HoverCard

Import from `@crc/viz`. Supply a local `anchor` and required style width/height.
Card dimensions use core content-box sizing: padding adds to width and height.
Default padding is 10, cornerRadius 7, white fill at 92% opacity, and a subtle
one-pixel border. Background and content are drawn at ordinary source position;
place cards after the series. Decorations should use `pointerEvents="none"`.

The outer stroked card box stays clear of `anchorRadius` (default 0) plus `gap`
(default 8). Auto tries above, below, right, left; `placement` prefers a side.
It slides tangentially or flips, never across the anchor. If nothing fits it
allows overflow; ancestor clips still apply. `bounds` defaults to the incoming
allocation. Anchor, bounds, and card placement use the same local coordinate
frame. Explicitly transformed/overflowing child paint is outside the guarantee.

Signals may supply anchor, bounds, gap/radius, whole style, or style fields.
Interactive children retain their ordinary targets; the decorative background
passes pointer input through. No selection, pointer tracking, portal, or automatic
collision avoidance between cards is provided.
