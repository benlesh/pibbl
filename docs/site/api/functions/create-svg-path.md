---
id: api-function-create-svg-path
title: createSvgPath
summary: Creates a fresh browser-parsed SVG Path2D.
kind: api
slug: create-svg-path
apiCategory: function
symbols: [createSvgPath]
relatedTypes: [SvgPathOptions]
---

# createSvgPath

```ts
import { createSvgPath, Path } from "@pibbl/core";
```

[`SvgPathOptions`](#/api/types/elements-components#svgpathoptions) is accepted by `createSvgPath(options): Path2D`, which returns a fresh `Path2D` from
SVG path data. Browser parsing is authoritative; the function is pure and does
not install rendering, interaction, or caching behavior.

```tsx
<Path
  style={{ d: createSvgPath({ d: "M10 10h80v50H10z" }), fill: "#38bdf8" }}
/>
```

See the [SVG path live example](#/examples/drawing/svg-path).
