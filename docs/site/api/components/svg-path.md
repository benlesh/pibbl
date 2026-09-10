---
id: api-component-svg-path
title: SvgPath
summary: Draws browser-parsed SVG path data.
kind: api
slug: svg-path
apiCategory: component
symbols: [SvgPath]
---

# SvgPath

```ts
import { SvgPath } from "@crc/core";
```

`SvgPath` uses `SvgPathProps` and `SvgPathStyle`. Its SVG path-data input is
parsed by the browser into the geometry used for paint and targeting. It
rejects children; browser `Path2D` parsing behavior remains authoritative.

```tsx
<SvgPath style={{ d: "M10 10h90v60H10z", fill: "#38bdf8" }} />
```

See the [SVG path live example](#/examples/drawing/svg-path).
