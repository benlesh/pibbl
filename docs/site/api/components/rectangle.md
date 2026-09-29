---
id: api-component-rectangle
title: Rectangle
summary: Draws a local rectangle with paint, events, and optional rounded corners.
kind: api
slug: rectangle
apiCategory: component
symbols: [Rectangle]
relatedTypes: [Canvas, RectStyle, RectangleProps]
---

# Rectangle

```ts
import { Rectangle } from "@crc/core";
```

`Rectangle` uses [`RectangleProps`](#/api/types/elements-components#rectangleprops) and [`RectStyle`](#/api/types/styles#rectstyle). It rejects children and
accepts local box geometry, fill, stroke, events, cursor, filters, and optional
`cornerRadius` or `cornerRadii`. Its signed-box rounding uses native [`Canvas`](#/api/types/canvas-runtime#canvas)
radius scaling and keeps paint and targeting aligned.

```tsx
<Rectangle
  style={{
    left: 24,
    top: 24,
    width: 180,
    height: 88,
    cornerRadius: 12,
    fill: "#2563eb",
  }}
/>
```

Try the [Rectangle live example](#/examples/drawing/rectangle).
