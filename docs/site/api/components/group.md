---
id: api-component-group
title: Group
summary: Applies a Canvas transform to recursive children.
kind: api
slug: group
apiCategory: component
symbols: [Group]
relatedTypes: [Canvas, PibblNode, GStyle, GroupProps]
---

# Group

```ts
import { Group, Rectangle } from "@pibbl/core";
```

`Group` uses [`GroupProps`](#/api/types/elements-components#groupprops) and [`GStyle`](#/api/types/styles#gstyle) to transform recursive [`PibblNode`](#/api/types/elements-components#pibblnode)
children. Interaction regions, clips, layers, and paint share the transformed
[`Canvas`](#/api/types/canvas-runtime#canvas) geometry. A receiving filter captures the group's recursive output before its
own transform is presented.

```tsx
<Group style={{ translateX: 48, rotationDegrees: 15 }}>
  <Rectangle style={{ width: 100, height: 60, fill: "#2563eb" }} />
</Group>
```

See the [Group live example](#/examples/composition/group).
