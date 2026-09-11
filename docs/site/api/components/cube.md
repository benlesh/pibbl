---
id: api-component-cube
title: Cube
summary: Draws and ray-picks a centered indexed cube in a WebGL island.
kind: api
slug: cube
apiCategory: component
symbols: [Cube]
relatedTypes: [CRCWebGLTransformStyle, CubeProps, CubeStyle]
---

# Cube

```ts
import { Cube } from "@crc/webgl";
```

`Cube` uses the built-in indexed cube geometry centered at the local origin.
`style.size` defaults to `1` and must be finite and positive. It also accepts
the [`Mesh`](#/api/components/mesh) transform, color, opacity, and cursor style
plus event/focus props.
Its public surface is [`CubeProps`](#/api/types/webgl#cubeprops) with
[`CubeStyle`](#/api/types/webgl#cubestyle), including the shared
[`CRCWebGLTransformStyle`](#/api/types/webgl#crcwebgltransformstyle).

```tsx
<Cube
  keyboardFocusable
  style={{ size: 1.4, rotationYDegrees: 25, color: "#8b5cf6" }}
  onClick={() => console.log("cube selected")}
/>
```

The same committed model transform drives paint, picking, and projected focus
bounds. `pointerEvents="none"` keeps the cube visible but removes it from hit
and focus participation.
