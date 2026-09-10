---
id: api-component-vertical-line
title: VerticalLine
summary: Draws an allocation-aware vertical line.
kind: api
slug: vertical-line
apiCategory: component
symbols: [VerticalLine]
---

# VerticalLine

```ts
import { VerticalLine } from "@crc/core";
```

`VerticalLine` uses `VerticalLineProps` and `VerticalLineStyle`. It rejects
children and supplies an allocation-aware default endpoint. Stroke targeting
honors `lineInteractionWidth`; use a declared box when percentage geometry
needs a finite basis.

```tsx
<VerticalLine
  style={{ x: 52, y: 12, height: 140, stroke: "#334155", strokeWidth: 2 }}
/>
```

Try [Lines].
