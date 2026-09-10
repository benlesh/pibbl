---
id: api-component-line
title: Line
summary: Draws an ordered polyline.
kind: api
slug: line
apiCategory: component
symbols: [Line]
---

# Line

```ts
import { Line } from "@crc/core";
```

`Line` uses `LineProps` and `LineStyle`. Its numeric coordinate pairs define
an ordered polyline; it rejects children. Stroke targeting uses
`lineInteractionWidth` when supplied. Coordinates must be finite logical
Canvas units.

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
