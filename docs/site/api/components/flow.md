---
id: api-component-flow
title: Flow
summary: Places direct children in the declared flow direction.
kind: api
slug: flow
apiCategory: component
symbols: [Flow]
---

# Flow

```ts
import { Flow, Text } from "@crc/core";
```

`Flow` uses `FlowProps` and `FlowStyle` to place recursive direct children in
source order. Children retain their own local drawing geometry; the parent
resolves only placement. Declare finite boxes when a child needs allocated
space.

```tsx
<Flow style={{ width: 220, height: 180, direction: "vertical", gap: 8 }}>
  <Text style={{ fill: "#0f172a", font: "16px sans-serif" }}>First</Text>
  <Text style={{ fill: "#0f172a", font: "16px sans-serif" }}>Second</Text>
</Flow>
```

See the [Flow live example](#/examples/layout/flow).
