---
id: api-component-path
title: Path
summary: Paints a caller-owned Path2D with local interaction and style.
kind: api
slug: path
apiCategory: component
symbols: [Path]
relatedTypes: [PathProps, PathStyle]
---

# Path

Looking for ways to edit, bend, or warp a path? See
[PathGeometry: operations at a glance](#/api/functions/path-geometry#operations-at-a-glance)
for the complete operation map, detailed references, and runnable examples.

```ts
import { Path } from "@crc/core";
```

`Path` uses [`PathProps`](#/api/types/elements-components#pathprops) and [`PathStyle`](#/api/types/styles#pathstyle). Its required `d` is a `Path2D` or `PathGeometry`; it
rejects children. Reuse a path created with a public `create*Path` function or
construct one with the browser API. Paint and coordinate targeting use the
same path geometry.

```tsx
<Path style={{ d: new Path2D("M10 10H110V70H10Z"), fill: "#38bdf8" }} />
```

Try the [Path live example](#/examples/drawing/path).
