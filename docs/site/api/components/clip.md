---
id: api-component-clip
title: Clip
summary: Restricts recursive children to a Path2D or PathGeometry clipping region.
kind: api
slug: clip
apiCategory: component
symbols: [Clip]
relatedTypes: [PibblNode, ClipProps, ClipStyle]
---

# Clip

```ts
import { Circle, Clip } from "@pibbl/core";
```

`Clip` uses [`ClipProps`](#/api/types/elements-components#clipprops) and [`ClipStyle`](#/api/types/styles#clipstyle) to apply a `Path2D` or [`PathGeometry`](#/api/functions/path-geometry) and fill rule to
recursive [`PibblNode`](#/api/types/elements-components#pibblnode) children. The clip geometry stays aligned with paint and
hit testing. Filters on the receiving clip are composed before its own clip is
presented.

```tsx
<Clip style={{ d: new Path2D("M0 0h140v90H0z") }}>
  <Circle style={{ cx: 100, cy: 45, radius: 64, fill: "#60a5fa" }} />
</Clip>
```

See the [Clip live example](#/examples/composition/clip).
