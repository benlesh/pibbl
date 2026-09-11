---
id: api-hook-crc-webgl-context
title: crcWebGLContext
summary: Returns the immutable context snapshot for the active WebGL primitive callback.
kind: api
slug: crc-webgl-context
apiCategory: hook
symbols: [crcWebGLContext]
relatedTypes: [CRCWebGLContext]
---

# crcWebGLContext

```ts
import { crcWebGLContext } from "@crc/webgl";
```

`crcWebGLContext()` returns the active
[`CRCWebGLContext`](#/api/types/webgl#crcwebglcontext) while a custom WebGL
primitive is rendering. The same value is passed as the third argument to its
`defineWebGLPrimitive` render callback.

The snapshot exposes the WebGL2 context, context generation, camera and model
matrices, logical/backing viewports, density, frame timestamp, and
component-owned `resources.use(create, release, deps)` facility. Do not retain
the snapshot, context-dependent mutable state, or framework scratch values.

Calling it outside render, from Canvas 2D rendering, or during pure measurement
throws a targeted error. Use it only under
[`WebGLLayer`](#/api/components/webgl-layer).
