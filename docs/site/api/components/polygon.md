---
id: api-component-polygon
title: Polygon
summary: Draws a closed polygon from numeric coordinate pairs.
kind: api
slug: polygon
apiCategory: component
symbols: [Polygon]
relatedTypes: [PolygonProps, PolygonStyle]
---

# Polygon

```ts
import { Polygon } from "@pibbl/core";
```

`Polygon` uses [`PolygonProps`](#/api/types/elements-components#polygonprops) and [`PolygonStyle`](#/api/types/styles#polygonstyle). `coords` is a finite numeric
pair list; three or more points form one closed outline, and shorter lists are
empty geometry. It rejects children and supports shared rounded-corner style.

```tsx
<Polygon
  style={{
    coords: [
      [20, 90],
      [70, 12],
      [130, 90],
    ],
    fill: "#f59e0b",
  }}
/>
```

See the [Polygon live example](#/examples/drawing/polygon).
