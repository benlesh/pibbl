---
id: api-function-create-circle-path
title: createCirclePath
summary: Creates a fresh numeric circular Path2D.
kind: api
slug: create-circle-path
apiCategory: function
symbols: [createCirclePath]
---

# createCirclePath

```ts
import { Circle, Clip, createCirclePath } from "@crc/core";
```

`createCirclePath(options: CirclePathOptions): Path2D` creates a fresh circle
from a nonnegative numeric `radius` and optional `cx`/`cy`. It is pure and owns
no render state, events, or cache.

```tsx
<Clip style={{ d: createCirclePath({ cx: 80, cy: 80, radius: 56 }) }}>
  <Circle style={{ cx: 80, cy: 80, radius: 64, fill: "#2563eb" }} />
</Clip>
```

Numeric path creators do not accept percentages or `"auto"`.
