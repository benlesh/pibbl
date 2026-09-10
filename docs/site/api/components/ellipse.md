---
id: api-component-ellipse
title: Ellipse
summary: Draws a rotated ellipse from independent radii.
kind: api
slug: ellipse
apiCategory: component
symbols: [Ellipse]
---

# Ellipse

```ts
import { Ellipse } from "@crc/core";
```

`Ellipse` uses `EllipseProps` and `EllipseStyle`. It requires nonnegative
`radiusX` and `radiusY`; `rotation` is finite radians. It rejects children and
uses the same rotated geometry for paint, targeting, and default focus bounds.

```tsx
<Ellipse
  style={{
    cx: 100,
    cy: 70,
    radiusX: 72,
    radiusY: 34,
    rotation: 0.35,
    fill: "#38bdf8",
  }}
/>
```

Try the [Ellipse live example](#/examples/drawing/ellipse).
