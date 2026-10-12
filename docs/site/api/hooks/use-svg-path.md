---
id: api-hook-use-svg-path
title: useSvgPath
summary: Memoizes a Path2D from SVG path data.
kind: api
slug: use-svg-path
apiCategory: hook
symbols: [useSvgPath]
---

# useSvgPath

```ts
import { useSvgPath, Path } from "@pibbl/core";
```

`useSvgPath(svgPathData)` is render-only and memoizes a browser-parsed `Path2D`
until the path-data string changes. It has no separate cleanup, and browser
`Path2D` parsing behavior remains authoritative.

```tsx
function Mark() {
  const path = useSvgPath("M10 10h90v60H10z");
  return <Path style={{ d: path, fill: "#38bdf8" }} />;
}
```

See the [SVG path live example](#/examples/drawing/svg-path).
