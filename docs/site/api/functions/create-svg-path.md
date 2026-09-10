---
id: api-function-create-svg-path
title: createSvgPath
summary: Creates a fresh browser-parsed SVG Path2D.
kind: api
slug: create-svg-path
apiCategory: function
symbols: [createSvgPath]
---

# createSvgPath

```ts
import { createSvgPath, Path } from "@crc/core";
```

`createSvgPath(options: SvgPathOptions): Path2D` returns a fresh `Path2D` from
SVG path data. Browser parsing is authoritative; the function is pure and does
not install rendering, interaction, or caching behavior.

```tsx
<Path
  style={{ d: createSvgPath({ d: "M10 10h80v50H10z" }), fill: "#38bdf8" }}
/>
```

See the [SVG path live example](#/examples/drawing/svg-path).
