---
id: api-component-star
title: Star
summary: Draws one concave alternating-tip star outline.
kind: api
slug: star
apiCategory: component
symbols: [Star]
relatedTypes: [StarProps, StarStyle]
---

# Star

```ts
import { Star } from "@crc/core";
```

`Star` uses [`StarProps`](#/api/types/elements-components#starprops) and [`StarStyle`](#/api/types/styles#starstyle). It requires integer `points >= 3`,
nonnegative `outerRadius` and `innerRadius`, and `innerRadius <= outerRadius`.
It rejects children and creates one concave outline rather than intersecting
triangles.

```tsx
<Star
  style={{
    cx: 82,
    cy: 72,
    points: 5,
    outerRadius: 58,
    innerRadius: 26,
    fill: "#f59e0b",
  }}
/>
```

Try the [Star live example](#/examples/drawing/star).
