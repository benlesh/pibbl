---
id: api-component-line
title: Line
summary: Draws an ordered polyline.
kind: api
slug: line
apiCategory: component
symbols: [Line]
relatedTypes: [Canvas, LineProps, LineStyle]
---

# Line

```ts
import { Line } from "@crc/core";
```

`Line` uses [`LineProps`](#/api/types/elements-components#lineprops) and [`LineStyle`](#/api/types/styles#linestyle). Its numeric coordinate pairs define
an ordered polyline; it rejects children. Stroke targeting uses
`lineInteractionWidth` when supplied. Coordinates must be finite logical
[`Canvas`](#/api/types/canvas-runtime#canvas) units.

```tsx
<Line
  style={{
    coords: [
      [12, 72],
      [64, 20],
      [128, 72],
    ],
    stroke: "#1d4ed8",
    strokeWidth: 5,
  }}
/>
```

Try the [Line live example](#/examples/drawing/line).
