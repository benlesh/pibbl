---
id: api-function-define-webgl-primitive
title: defineWebGLPrimitive
summary: Defines a WebGL-only CRC primitive with explicit draw and hit capabilities.
kind: api
slug: define-webgl-primitive
apiCategory: function
symbols: [defineWebGLPrimitive]
relatedTypes:
  [
    CRCWebGLHitCapability,
    CRCWebGLPrimitiveCapabilities,
    CRCWebGLPrimitiveInput,
    CRCWebGLPrimitiveRender,
    CRCWebGLProgramProps,
  ]
---

# defineWebGLPrimitive

```ts
import { defineWebGLPrimitive } from "@crc/webgl";
```

`defineWebGLPrimitive(render, capabilities)` is the WebGL counterpart of core's
`definePrimitive`. It creates a platform component that renders only inside
[`WebGLLayer`](#/api/components/webgl-layer), with optional pure style
normalization/resolution and one required hit capability.
Its generic public surface is described by
[`CRCWebGLPrimitiveRender`](#/api/types/webgl#crcwebglprimitiverender),
[`CRCWebGLPrimitiveCapabilities`](#/api/types/webgl#crcwebglprimitivecapabilities),
[`CRCWebGLHitCapability`](#/api/types/webgl#crcwebglhitcapability),
[`CRCWebGLProgramProps`](#/api/types/webgl#crcwebglprogramprops), and
[`CRCWebGLPrimitiveInput`](#/api/types/webgl#crcwebglprimitiveinput).

The capability is one of:

- `{ kind: "geometry", geometry(props, style) }` for ray picking against an
  immutable `CRCWebGLGeometry`;
- `{ kind: "custom", resolve(input) }` for a synchronous `null` miss or finite
  nonnegative ray-distance hit;
- `{ kind: "none" }` for decorative paint whose input permits only
  `pointerEvents="none"`.

The render callback receives readonly props, resolved style, and a
[`CRCWebGLContext`](#/api/types/webgl#crcwebglcontext). Canvas filters are not
valid on inner WebGL primitive styles. Raw code must own resources through
`context.resources.use`, set every WebGL state value it depends on, restore
extension-specific state, and keep draw and hit geometry aligned. See
[Add WebGL islands](#/learn/guides/webgl-islands#define-a-raw-webgl-primitive).
