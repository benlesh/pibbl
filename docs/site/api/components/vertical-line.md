---
id: api-component-vertical-line
title: VerticalLine
summary: Draws an allocation-aware vertical line.
kind: api
slug: vertical-line
apiCategory: component
symbols: [VerticalLine]
relatedTypes: [VerticalLineProps, VerticalLineStyle]
---

# VerticalLine

```ts
import { VerticalLine } from "@crc/core";
```

`VerticalLine` uses [`VerticalLineProps`](#/api/types/elements-components#verticallineprops) and [`VerticalLineStyle`](#/api/types/styles#verticallinestyle). It rejects
children and supplies an allocation-aware default endpoint. Stroke targeting
honors `lineInteractionWidth`; use a declared box when percentage geometry
needs a finite basis.

```tsx
<VerticalLine
  style={{ x: 52, y1: 12, y2: 152, stroke: "#334155", strokeWidth: 2 }}
/>
```

Try the [Vertical line live example](#/examples/drawing/vertical-line).
