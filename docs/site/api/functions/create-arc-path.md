---
id: api-function-create-arc-path
title: createArcPath
summary: Creates a fresh open circular Path2D sweep.
kind: api
slug: create-arc-path
apiCategory: function
symbols: [createArcPath]
---

# createArcPath

```ts
import { createArcPath, Path } from "@crc/core";
```

`createArcPath(options: ArcPathOptions): Path2D` is a pure numeric constructor.
It accepts finite logical-unit center/radius/sweep options and returns a fresh,
open `Path2D`; it owns no render state, events, or cache.

```tsx
<Path
  style={{
    d: createArcPath({ radius: 48, startAngle: 0, endAngle: Math.PI }),
    stroke: "#2563eb",
  }}
/>
```

Use a component when geometry needs percentage or allocation resolution.
