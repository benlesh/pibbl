---
id: api-function-pibbl
title: pibbl
summary: Mounts or updates one Pibbl scene on a Canvas.
kind: api
slug: pibbl
apiCategory: function
symbols: [pibbl]
relatedTypes: [Canvas, PibblConfig, PibblController, PibblNode]
---

# pibbl

```ts
import { pibbl, Rectangle } from "@pibbl/core";
```

`pibbl(canvas, root, config?)` mounts a [`PibblNode`](#/api/types/elements-components#pibblnode) on a [`Canvas`](#/api/types/canvas-runtime#canvas) host and
returns a stable [`PibblController`](#/api/types/canvas-runtime#pibblcontroller). A later call for the same canvas queues the
latest root and returns the same controller. The first mount owns the surface
configuration; call `dispose()` when the mount is no longer needed.

```tsx
const canvas = document.querySelector("canvas")!;
const controller = pibbl(
  canvas,
  <Rectangle style={{ width: 160, height: 80, fill: "#2563eb" }} />,
);
// Later: controller.dispose();
```

The optional [`PibblConfig`](#/api/types/canvas-runtime#pibblconfig) selects the surface policy. Fixed surfaces capture the initial canvas viewport; `{ viewport: "responsive" }`
uses the CSS content box. See the [Getting started guide](#/learn/guides/configure-jsx).
