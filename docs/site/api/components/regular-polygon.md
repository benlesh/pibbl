---
id: api-component-regular-polygon
title: RegularPolygon
summary: Draws a generated regular polygon with one explicit size mode.
kind: api
slug: regular-polygon
apiCategory: component
symbols: [RegularPolygon]
---

# RegularPolygon

```ts
import { RegularPolygon } from "@crc/core";
```

`RegularPolygon` uses `RegularPolygonProps` and `RegularPolygonStyle`. It
requires integer `sides >= 3` and exactly one of `circumradius`, `inradius`, or
`sideLength`. It rejects children; invalid sizes or nonfinite geometry produce
a contextual layout diagnostic.

```tsx
<RegularPolygon
  style={{ cx: 80, cy: 70, sides: 6, circumradius: 54, fill: "#22c55e" }}
/>
```

See the [Regular polygon live example](#/examples/drawing/regular-polygon).
