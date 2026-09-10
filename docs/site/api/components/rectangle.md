---
id: api-component-rectangle
title: Rectangle
summary: Draws a local rectangle with paint, events, and optional rounded corners.
kind: api
slug: rectangle
apiCategory: component
symbols: [Rectangle]
---

# Rectangle

```ts
import { Rectangle } from "@crc/core";
```

`Rectangle` uses `RectangleProps` and `RectStyle`. It rejects children and
accepts local box geometry, fill, stroke, events, cursor, filters, and optional
`cornerRadius` or `cornerRadii`. Its signed-box rounding uses native Canvas
radius scaling and keeps paint and targeting aligned.

```tsx
<Rectangle
  style={{
    x: 24,
    y: 24,
    width: 180,
    height: 88,
    cornerRadius: 12,
    fill: "#2563eb",
  }}
/>
```

Try the [Rectangle live example].
