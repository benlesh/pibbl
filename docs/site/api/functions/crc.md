---
id: api-function-crc
title: crc
summary: Mounts or updates one CRC scene on a Canvas.
kind: api
slug: crc
apiCategory: function
symbols: [crc]
---

# crc

```ts
import { crc, Rectangle } from "@crc/core";
```

`crc(canvas, root, config?)` mounts a `CRCNode` on an `HTMLCanvasElement` and
returns a stable `CRCController`. A later call for the same canvas queues the
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

Fixed surfaces capture the initial canvas viewport; `{ viewport: "responsive" }`
uses the CSS content box. See the [Getting started guide](#/learn/guides/configure-jsx).
