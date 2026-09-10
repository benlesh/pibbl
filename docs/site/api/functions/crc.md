---
id: api-function-crc
title: crc
summary: Mounts or updates one CRC scene on a Canvas.
kind: api
slug: crc
apiCategory: function
symbols: [crc]
relatedTypes: [Canvas, CRCConfig, CRCController, CRCNode]
---

# crc

```ts
import { crc, Rectangle } from "@crc/core";
```

`crc(canvas, root, config?)` mounts a [`CRCNode`](#/api/types/elements-components#crcnode) on a [`Canvas`](#/api/types/canvas-runtime#canvas) host and
returns a stable [`CRCController`](#/api/types/canvas-runtime#crccontroller). A later call for the same canvas queues the
latest root and returns the same controller. The first mount owns the surface
configuration; call `dispose()` when the mount is no longer needed.

```tsx
const canvas = document.querySelector("canvas")!;
const controller = crc(
  canvas,
  <Rectangle style={{ width: 160, height: 80, fill: "#2563eb" }} />,
);
// Later: controller.dispose();
```

The optional [`CRCConfig`](#/api/types/canvas-runtime#crcconfig) selects the surface policy. Fixed surfaces capture the initial canvas viewport; `{ viewport: "responsive" }`
uses the CSS content box. See the [Getting started guide](#/learn/guides/configure-jsx).
