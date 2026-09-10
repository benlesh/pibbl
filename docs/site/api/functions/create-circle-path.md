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
import { createCirclePath } from "@crc/core";
```

`createCirclePath(options: CirclePathOptions): Path2D` creates a fresh circle
from a nonnegative numeric `radius` and optional `cx`/`cy`. It is pure and owns
no render state, events, or cache.

```tsx
<Clip style={{ d: createCirclePath({ cx: 80, cy: 80, radius: 56 }) }}>
  <Artwork />
</Clip>
```

Numeric path creators do not accept percentages or `"auto"`.
