---
id: api-component-horizontal-line
title: HorizontalLine
summary: Draws an allocation-aware horizontal line.
kind: api
slug: horizontal-line
apiCategory: component
symbols: [HorizontalLine]
---

# HorizontalLine

```ts
import { HorizontalLine } from "@crc/core";
```

`HorizontalLine` uses `HorizontalLineProps` and `HorizontalLineStyle`. It
rejects children and supplies an allocation-aware default endpoint, making it
useful inside declared layout boxes. Stroke targeting respects
`lineInteractionWidth`.

```tsx
<HorizontalLine
  style={{ x1: 16, x2: 196, y: 40, stroke: "#334155", strokeWidth: 2 }}
/>
```

Try the [Horizontal line live example](#/examples/drawing/horizontal-line).
