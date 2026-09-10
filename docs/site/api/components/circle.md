---
id: api-component-circle
title: Circle
summary: Draws a center-and-radius circle with local paint and interaction.
kind: api
slug: circle
apiCategory: component
symbols: [Circle]
---

# Circle

```ts
import { Circle } from "@crc/core";
```

`Circle` uses `CircleProps` and `CircleStyle`. `radius` is required; `cx` and
`cy` default to zero. It rejects children. Its same geometry drives paint and
coordinate targeting, and percentage radii use the smaller available axis.

```tsx
<Circle
  style={{ cx: 96, cy: 80, radius: 44, fill: "#fb7185", stroke: "#881337" }}
/>
```

Try the [Circle live example].
