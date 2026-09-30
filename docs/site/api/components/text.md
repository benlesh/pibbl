---
id: api-component-text
title: Text
summary: Draws recursive textual children with local fitting and paint.
kind: api
slug: text
apiCategory: component
symbols: [Text]
relatedTypes: [CRCTextChild, TextProps, TextStyle]
---

# Text

```ts
import { Text } from "@crc/core";
```

`Text` uses [`TextProps`](#/api/types/elements-components#textprops) and [`TextStyle`](#/api/types/styles#textstyle), and accepts recursive [`CRCTextChild`](#/api/types/elements-components#crctextchild)
content rather than visual child elements. It supports paint, wrapping, fitting,
and measurement under its local style. Font rasterization and measurement are
browser behavior. Ellipsis fitting preserves complete grapheme clusters, including
combining marks and joined emoji, using the browser’s `Intl.Segmenter`. It does not
truncate inside a cluster. Font loading and any update needed after a font arrives
remain application responsibilities.

```tsx
<Text
  style={{ left: 20, top: 44, fill: "#0f172a", font: "600 24px sans-serif" }}
>
  Hello, {42}
</Text>
```

Try the [Text live example](#/examples/drawing/text).
