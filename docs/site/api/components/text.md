---
id: api-component-text
title: Text
summary: Draws recursive textual children with local fitting and paint.
kind: api
slug: text
apiCategory: component
symbols: [Text]
---

# Text

```ts
import { Text } from "@crc/core";
```

`Text` uses `TextProps` and `TextStyle`, and accepts recursive `CRCTextChild`
content rather than visual child elements. It supports paint, wrapping, fitting,
and measurement under its local style. Font rasterization and measurement are
browser behavior.

```tsx
<Text style={{ x: 20, y: 44, fill: "#0f172a", font: "600 24px sans-serif" }}>
  Hello, {42}
</Text>
```

Try the [Text live example](#/examples/drawing/text).
