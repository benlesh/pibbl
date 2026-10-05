---
id: api-component-svg-path
title: SvgPath
summary: Draws browser-parsed SVG path data.
kind: api
slug: svg-path
apiCategory: component
symbols: [SvgPath]
relatedTypes: [SvgPathProps, SvgPathStyle]
---

# SvgPath

```ts
import { SvgPath } from "@pibbl/core";
```

`SvgPath` uses [`SvgPathProps`](#/api/types/elements-components#svgpathprops) and [`SvgPathStyle`](#/api/types/styles#svgpathstyle). Its SVG path-data input is
parsed by the browser into the geometry used for paint and targeting. It
rejects children; browser `Path2D` parsing behavior remains authoritative.

```tsx
<SvgPath style={{ d: "M10 10h90v60H10z", fill: "#38bdf8" }} />
```

See the [SVG path live example](#/examples/drawing/svg-path).
