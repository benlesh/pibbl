---
id: api-function-create-line-path
title: createLinePath
summary: Creates a fresh numeric polyline Path2D.
kind: api
slug: create-line-path
apiCategory: function
symbols: [createLinePath]
relatedTypes: [LinePathOptions]
---

# createLinePath

```ts
import { createLinePath, Path } from "@crc/core";
```

[`LinePathOptions`](#/api/types/elements-components#linepathoptions) is accepted by `createLinePath(options): Path2D`, which creates a fresh path from
finite numeric coordinate pairs and optional `closePath`. It is pure, and does
not attach paint, events, or caching.

```tsx
<Path
  style={{
    d: createLinePath({
      coords: [
        [0, 0],
        [80, 40],
        [160, 0],
      ],
    }),
    stroke: "#2563eb",
  }}
/>
```

Try the [Line live example](#/examples/drawing/line).
