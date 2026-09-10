---
id: api-component-clip
title: Clip
summary: Restricts recursive children to a Path2D clipping region.
kind: api
slug: clip
apiCategory: component
symbols: [Clip]
---

# Clip

```ts
import { Clip } from "@crc/core";
```

`Clip` uses `ClipProps` and `ClipStyle` to apply a `Path2D` and fill rule to
recursive `CRCNode` children. The clip geometry stays aligned with paint and
hit testing. Filters on the receiving clip are composed before its own clip is
presented.

```tsx
<Clip style={{ d: new Path2D("M0 0h140v90H0z") }}>
  <Circle style={{ cx: 100, cy: 45, radius: 64, fill: "#60a5fa" }} />
</Clip>
```

See [Composition].
