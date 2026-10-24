---
id: api-component-text
title: Text
summary: Draws recursive textual children with local fitting and paint.
kind: api
slug: text
apiCategory: component
symbols: [Text]
relatedTypes: [PibblTextChild, TextProps, TextStyle]
---

# Text

```ts
import { Text } from "@pibbl/core";
```

`Text` uses [`TextProps`](#/api/types/elements-components#textprops) and [`TextStyle`](#/api/types/styles#textstyle), and accepts recursive [`PibblTextChild`](#/api/types/elements-components#pibbltextchild)
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

Experimental finite LTR nowrap Flex can align fixed Text leaves with
`alignItems: "first-baseline"`. Nonempty visible content may wrap at its final
allocated width; the provider reports its first and last actual visible lines.
The bounded font form is a positive pixel size plus `sans-serif`, `serif`, or
`monospace`, optionally preceded by `bold`, `italic`, or `normal`. This uses live
Canvas metrics through the optional baseline-aware measurement service, without
claiming native font parity or font-load invalidation. See the
[first-baseline example](#/examples/layout/wasm-flex-baseline) and
[measurement service](#/api/types/layout#canvasmeasurementservice).

Try the [Text live example](#/examples/drawing/text).
