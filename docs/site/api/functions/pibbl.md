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
returns a Promise for the stable [`PibblController`](#/api/types/canvas-runtime#pibblcontroller). A later call for the same canvas queues the
latest root after preparation and resolves to the same controller. The first mount owns the surface
configuration; call `dispose()` when the mount is no longer needed.

```tsx
const canvas = document.querySelector("canvas")!;
const controller = await pibbl(
  canvas,
  <Rectangle style={{ width: 160, height: 80, fill: "#2563eb" }} />,
);
// Later: controller.dispose();
```

The optional [`PibblConfig`](#/api/types/canvas-runtime#pibblconfig) selects the surface policy. Fixed surfaces capture the initial canvas viewport; `{ viewport: "responsive" }`
uses the CSS content box. See the [Getting started guide](#/learn/guides/configure-jsx).

The external layout WASM asset is fetched and compiled before a new mount admits
components, events or frames, including drawing-only roots. Layout and frame
execution remain synchronous afterward. Use
[prepareLayoutEngine](#/api/functions/prepare-layout-engine) to warm the shared
module before mounting, or the separate
[pibblSync](#/api/functions/pibbl-sync) entry for an intentionally synchronous host.

Loading failures reject with their cause and asset/phase context, without leaving
a partial mount. A later call retries a failed preparation attempt.
`config.signal` cancels only that caller's pending wait with `AbortError`; it does
not cancel shared preparation or other canvases. A newer same-canvas request
supersedes older pending requests. Cancelling a pending update does not dispose
the existing mount; its original lifetime signal remains authoritative.
