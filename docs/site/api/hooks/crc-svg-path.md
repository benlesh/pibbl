---
id: api-hook-crc-svg-path
title: crcSvgPath
summary: Memoizes a Path2D from SVG path data.
kind: api
slug: crc-svg-path
apiCategory: hook
symbols: [crcSvgPath]
---

# crcSvgPath

```ts
import { crcSvgPath } from "@crc/core";
```

`crcSvgPath(svgPathData)` is render-only and memoizes a browser-parsed `Path2D`
until the path-data string changes. It has no separate cleanup, and browser
`Path2D` parsing behavior remains authoritative.

```tsx
function Mark() {
  const path = crcSvgPath("M10 10h90v60H10z");
  return <Path d={path} style={{ fill: "#38bdf8" }} />;
}
```

See [SVG paths].
